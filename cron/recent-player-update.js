const cron = require('node-cron');
const cheerio = require('cheerio');
const https = require('https');
const { Game, InProgress, sequelize } = require('../models');
const { visitGame, sleep } = require('./helpers');

// Runs monthly on the 14th at 06:00.
// Finds all players active in the last N days, scrapes each player's Twixt
// game list from LittleGolem, and visits every game number we don't have in
// the database yet:
//   in-progress games checked against the in_progress table
//   finished games   checked against the games table
// So each missing game gets fetched from LittleGolem via the /game route.

const HOST = 'www.littlegolem.net';

// Number of days to look back for "recent" players.
const DAYS = 45;

// Helper: fetch URL via HTTPS, returns { statusCode, body }
function httpsGet(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { host, port: 443, path, headers: { 'User-Agent': 'TwixtCommentator/1.0' } },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
  });
}

// Extract game numbers from the game list table.
// The table is the first <table> following the "List of games" <h2>.
// The 1st column of each data row is the game number, rendered as
// <a href="/jsp/game/game.jsp?gid=N">#N</a>. We read the number from
// the anchor text rather than the href.
// The 6th column is the result: empty means the game is in progress,
// non-empty (win/lost/draw) means it is finished.
// Returns { inProgress, finished } arrays, or null if the table is not found.
function extractGameLists(html) {
  const $ = cheerio.load(html);

  const heading = $('h2').filter((_, el) => $(el).text().trim() === 'List of games');
  const table = heading.nextAll('table').first();
  if (!table.length) return null;

  const inProgress = [];
  const finished = [];
  table.find('tr').each((i, row) => {
    if (i === 0) return; // column header row

    const anchor = $(row).find('a[href*="game.jsp?gid="]').first();
    if (!anchor.length) return;

    // Anchor text looks like "#2559780" — keep only the digits
    const digits = anchor.text().replace(/[^0-9]/g, '');
    if (!digits) return;
    const gameNum = parseInt(digits, 10);

    const resultText = $(row).children('td').eq(5).text().trim();
    if (resultText === '') inProgress.push(gameNum);
    else finished.push(gameNum);
  });

  return { inProgress, finished };
}

// Distinct player ids (from both seat columns) that played a game
// within the lookback window.
async function getRecentPlayerIds() {
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  // Union both player-id columns so a player is listed once regardless of
  // which seat they played in, then dedupe and sort for stable output.
  const rows = await sequelize.query(
    `SELECT DISTINCT player_id FROM (
       SELECT player1_id AS player_id FROM games
         WHERE created_on >= :cutoff AND player1_id IS NOT NULL
       UNION
       SELECT player2_id AS player_id FROM games
         WHERE created_on >= :cutoff AND player2_id IS NOT NULL
     ) AS recent_players
     ORDER BY player_id`,
    { replacements: { cutoff }, type: sequelize.QueryTypes.SELECT }
  );

  return rows.map(row => row.player_id);
}

// Scrape one player's game list and return the game numbers (both
// in-progress and finished) that are not in the database.
async function getPlayerMissingGames(playerId, inProgressInDb, finishedInDb) {
  const resp = await httpsGet(HOST, `/jsp/info/player_game_list.jsp?gtid=twixt&plid=${playerId}`);
  if (resp.statusCode !== 200) {
    throw new Error(`HTTP ${resp.statusCode} — could not fetch game list`);
  }

  const lists = extractGameLists(resp.body);
  if (lists === null) {
    throw new Error('could not find the "List of games" table on the page');
  }

  return [
    ...lists.inProgress.filter(n => !inProgressInDb.has(n)),
    ...lists.finished.filter(n => !finishedInDb.has(n)),
  ];
}

cron.schedule('0 6 14 * *', async () => {
  console.log('[cron] Checking recent players for missing games...');

  let playerIds;
  try {
    playerIds = await getRecentPlayerIds();
  } catch (err) {
    console.error(`[cron] Failed to look up recent players: ${err.message}`);
    return;
  }

  if (playerIds.length === 0) {
    console.log('[cron] No recent players found.');
    return;
  }

  // Load the game numbers we already have, from the two tables (once).
  let inProgressInDb, finishedInDb;
  try {
    const [inProgressRows, finishedRows] = await Promise.all([
      InProgress.findAll({ attributes: ['lg_game_num'] }),
      Game.findAll({ attributes: ['lg_game_num'] }),
    ]);
    inProgressInDb = new Set(inProgressRows.map(r => r.lg_game_num));
    finishedInDb = new Set(finishedRows.map(r => r.lg_game_num).filter(n => n !== null));
  } catch (err) {
    console.error(`[cron] Failed to load existing games: ${err.message}`);
    return;
  }

  const missing = new Set();
  for (const playerId of playerIds) {
    try {
      for (const gameNum of await getPlayerMissingGames(playerId, inProgressInDb, finishedInDb)) {
        missing.add(gameNum);
      }
    } catch (err) {
      console.error(`[cron] Skipping player ${playerId}: ${err.message}`);
    }
    // 1-second pause between requests to avoid hammering LittleGolem
    await sleep(1000);
  }

  const gameNums = [...missing].sort((a, b) => a - b);
  if (gameNums.length === 0) {
    console.log('[cron] No missing games found for recent players.');
    return;
  }

  console.log(`[cron] Found ${gameNums.length} missing game(s), visiting each...`);
  for (const gameNum of gameNums) {
    await visitGame(gameNum);
    // 1-second pause between requests to avoid hammering LittleGolem
    await sleep(1000);
  }

  console.log('[cron] Finished visiting missing recent-player games.');
});

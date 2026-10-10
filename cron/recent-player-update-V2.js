const cron = require('node-cron');
const https = require('https');
const { Game, InProgress, sequelize } = require('../models');
const { visitGame, sleep } = require('./helpers');

// Runs monthly on the 2nd at 06:00.
// Finds all players active in the last N days, fetches each player's most
// recent 100 Twixt games for every variant (DEFAULT, SIZE30, SIZE48) from the
// LittleGolem JSON API (both in-progress and finished), and visits every game
// number we don't have in the database yet:
//   in-progress games checked against the in_progress table
//   finished games   checked against the games table
// So each missing game gets fetched from LittleGolem via the /game route.
// Kept alongside the old scraper (recent-player-update.js) so we can compare
// coverage and retire the old one once confident.

// Number of days to look back for "recent" players.
const DAYS = 45;

// How many recent games we fetch per player from the API.
const LIMIT = 100;

const VARIANTS = ['DEFAULT', 'SIZE30', 'SIZE48'];
const API_BASE = 'https://api.littlegolem.net/players/{plid}/games?gtype=twixt&variant={variant}&offset=0&limit={limit}';

// Helper: fetch URL via HTTPS, returns { statusCode, body }
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { headers: { 'User-Agent': 'TwixtCommentator/1.0' } },
      url,
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          return reject(new Error(`Unexpected redirect (${res.statusCode}) from LittleGolem API`));
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
  });
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

// Fetch one player's most recent LIMIT games for a variant from the
// LittleGolem JSON API. Returns the `games` array (or []). Rejects on HTTP
// or JSON errors.
function getPlayerGames(playerId, variant) {
  const url = API_BASE.replace('{plid}', String(playerId)).replace('{variant}', variant).replace('{limit}', String(LIMIT));
  return httpsGet(url).then((resp) => {
    if (resp.statusCode !== 200) {
      throw new Error(`HTTP ${resp.statusCode} — could not fetch game list`);
    }
    const json = JSON.parse(resp.body);
    return json.games || [];
  });
}

cron.schedule('0 6 11 * *', async () => {
  console.log('[cron] Checking recent players for missing games (API)...');

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
  for (const variant of VARIANTS) {
    for (const playerId of playerIds) {
      let games;
      try {
        games = await getPlayerGames(playerId, variant);
      } catch (err) {
        console.error(`[cron] Skipping player ${playerId} (${variant}): ${err.message}`);
        await sleep(1000);
        continue;
      }

      // status 1 = finished, 0 = in progress. Check each against the matching
      // table's set of game numbers.
      for (const game of games) {
        const known = game.status === 1 ? finishedInDb.has(game.gid) : inProgressInDb.has(game.gid);
        if (!known) missing.add(game.gid);
      }

      // 1-second pause between requests to avoid hammering LittleGolem
      await sleep(1000);
    }
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

  console.log('[cron] Finished visiting missing recent-player games (API).');
});

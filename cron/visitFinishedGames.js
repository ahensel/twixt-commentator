const cron = require('node-cron');
const https = require('https');
const cheerio = require('cheerio');
const { visitGame, sleep } = require('./helpers');

// Runs daily at 05:30.
// Scrapes LittleGolem's Twixt page for the last five finished games,
// hitting each game route so it gets fetched from LittleGolem.
cron.schedule('30 5 * * *', async () => {
  console.log('[cron] Checking for recently finished games...');

  let html;
  try {
    html = await fetchLGPage();
  } catch (err) {
    console.error(`[cron] Failed to fetch LittleGolem page: ${err.message}`);
    return;
  }

  const gameNums = parseLastFiveFinishedGames(html);

  if (gameNums.length === 0) {
    console.log('[cron] No recently finished games found on LittleGolem page.');
    return;
  }

  console.log(`[cron] Found ${gameNums.length} recently finished game(s), visiting each...`);

  for (const gameNum of gameNums) {
    await visitGame(gameNum);
    // 1-second pause between requests to avoid hammering LittleGolem
    await sleep(1000);
  }

  console.log('[cron] Finished visiting recently finished games.');
});

const LG_URL = 'https://www.littlegolem.net/jsp/games/gamedetail.jsp?gtid=twixt';

function fetchLGPage() {
  return new Promise((resolve, reject) => {
    https.get(LG_URL, { headers: { 'User-Agent': 'TwixtCommentator/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse the game numbers of the last five finished games from the LG page HTML.
 * The site doesn't use semantic classes/ids, so we navigate by portlet structure:
 * find the .portlet whose .portlet-title contains "Last five finished games",
 * then read its sibling .portlet-body. The first <tr> of the table is a heading
 * row; each data row's first <td> holds an anchor like "#2559850".
 */
function parseLastFiveFinishedGames(html) {
  const $ = cheerio.load(html);

  const portlet = $('.portlet')
    .filter((_, el) => $(el).find('.portlet-title').text().includes('Last five finished games'))
    .first();

  const table = portlet.find('.portlet-body').find('table');
  if (table.length === 0) return [];

  const gameNums = [];
  table.find('tr').slice(1, 6).each((_, tr) => {
    const m = $(tr).find('td').first().find('a').text().match(/#(\d+)/);
    if (m) gameNums.push(parseInt(m[1], 10));
  });

  return gameNums;
}

const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { visitGame, sleep } = require('./helpers');

// Runs twice daily at 05:15 and 17:15.
// Uses the LittleGolem JSON API to get the 10 most recently finished games
// for each variant (DEFAULT, SIZE30, SIZE48), then visits each game that is
// newer than the last one seen in the previous run (saved in last-seen.json).
// Kept alongside the old scraper (visitFinishedGames.js) so we can compare
// coverage and retire the old one once confident.
cron.schedule('15 5,17 * * *', async () => {
  console.log('[cron] Checking for recently finished games (API)...');

  const state = readLastSeen();

  for (const variant of ['DEFAULT', 'SIZE30', 'SIZE48']) {
    let games;
    try {
      games = await fetchFinishedGames(variant);
    } catch (err) {
      console.error(`[cron] Failed to fetch finished games for ${variant}: ${err.message}`);
      continue;
    }

    if (games.length === 0) {
      console.log(`[cron] No recently finished games found for ${variant}.`);
      continue;
    }

    // Only visit games up to (but not including) the most recent game from
    // the previous run, so we don't skip past games that finished between runs.
    const lastSeen = state[variant];
    const stopIndex = lastSeen === undefined ? -1 : games.findIndex((g) => g.gid === lastSeen);
    const toVisit = stopIndex === -1 ? games : games.slice(0, stopIndex);

    if (toVisit.length === 0) {
      console.log(`[cron] No new ${variant} games to visit since last run.`);
      continue;
    }

    console.log(`[cron] Found ${toVisit.length} new ${variant} game(s), visiting each...`);

    for (const game of toVisit) {
      await visitGame(game.gid);
      // 1-second pause between requests to avoid hammering LittleGolem
      await sleep(1000);
    }

    // Remember the most recent game for this variant so we know where to
    // stop next time. Only update on success — otherwise we'd lose track.
    state[variant] = games[0].gid;
  }

  writeLastSeen(state);

  console.log('[cron] Finished visiting recently finished games (API).');
});

const API_BASE = 'https://api.littlegolem.net/games/variant/twixt/{variant}?state=finished&min_rating=0&offset=0&limit=10';
const LAST_SEEN_FILE = path.join(__dirname, 'last-seen.json');

/**
 * Fetch the most recently finished Twixt games for a given variant from the
 * LittleGolem JSON API. Resolves with the `games` array (or []).
 */
function fetchFinishedGames(variant) {
  return new Promise((resolve, reject) => {
    const url = API_BASE.replace('{variant}', variant);
    https.get(url, { headers: { 'User-Agent': 'TwixtCommentator/1.0' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return reject(new Error(`Unexpected redirect (${res.statusCode}) from LittleGolem API`));
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from LittleGolem API`));
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.games || []);
        } catch (err) {
          reject(new Error(`Failed to parse JSON from LittleGolem API: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

// { variant: gid of most recent game visited last run }, e.g.
// { "DEFAULT": 2566650, "SIZE30": 1234567, "SIZE48": 2345678 }
function readLastSeen() {
  try {
    return JSON.parse(fs.readFileSync(LAST_SEEN_FILE, 'utf8'));
  } catch (err) {
    // First run (no file) or unreadable file — start fresh.
    return {};
  }
}

function writeLastSeen(state) {
  try {
    fs.writeFileSync(LAST_SEEN_FILE, JSON.stringify(state, null, 2) + '\n');
  } catch (err) {
    console.error(`[cron] Failed to write ${LAST_SEEN_FILE}: ${err.message}`);
  }
}

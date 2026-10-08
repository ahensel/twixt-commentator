const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { visitGame, sleep } = require('./helpers');

// Runs twice daily at 05:15 and 17:15.
// Uses the LittleGolem JSON API to get recently finished games for each variant
// (DEFAULT, SIZE30, SIZE48), then visits each game that is newer than the last
// one seen in the previous run (saved in last-seen.json). It fetches pages of 10
// and keeps going until it finds the last-seen game — so we don't skip past games
// that finished between runs — or until it has looked back MAX_GAMES.
// Kept alongside the old scraper (visitFinishedGames.js) so we can compare
// coverage and retire the old one once confident.
cron.schedule('15 5,17 * * *', async () => {
  console.log('[cron] Checking for recently finished games (API)...');

  const state = readLastSeen();

  for (const variant of ['DEFAULT', 'SIZE30', 'SIZE48']) {
    const { toVisit, newestGid, fetchError } = await fetchNewGames(variant, state[variant]);

    if (newestGid === undefined) {
      // Nothing fetched — leave last-seen unchanged so the next run picks up
      // everything from where it left off.
      if (fetchError) {
        console.error(`[cron] Skipping ${variant}; will retry from last seen game next run.`);
      } else {
        console.log(`[cron] No recently finished games found for ${variant}.`);
      }
      continue;
    }

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
    state[variant] = newestGid;
  }

  writeLastSeen(state);

  console.log('[cron] Finished visiting recently finished games (API).');
});

// How many games per page we request from the LittleGolem API.
const PAGE_SIZE = 10;
// How far back we'll look for the last-seen game (MAX_GAMES / PAGE_SIZE pages).
const MAX_GAMES = 100;

const API_BASE = 'https://api.littlegolem.net/games/variant/twixt/{variant}?state=finished&min_rating=0&offset={offset}&limit=10';
const LAST_SEEN_FILE = path.join(__dirname, 'last-seen.json');

/**
 * Fetch pages of recently finished games (newest first) until we find
 * `lastSeen` — so we don't skip past anything that finished between runs — or
 * until we've looked back MAX_GAMES. On a first run there's no last-seen game,
 * so we only fetch a single page.
 *
 * Returns `{ toVisit, newestGid, fetchError }`: the games newer than `lastSeen`
 * (or [] if none), the gid of the most recent game fetched (for updating
 * last-seen state; undefined when no games were found at all), and the message
 * of any fetch error that stopped pagination early.
 */
async function fetchNewGames(variant, lastSeen) {
  let games = [];
  let newestGid;
  let fetchError;
  let offset = 0;

  while (games.length < MAX_GAMES) {
    let page;
    try {
      page = await fetchFinishedGames(variant, offset);
    } catch (err) {
      console.error(`[cron] Failed to fetch finished games for ${variant} (offset=${offset}): ${err.message}`);
      fetchError = err.message;
      break;
    }

    if (page.length === 0) break;

    if (newestGid === undefined) newestGid = page[0].gid;

    const foundIndex = lastSeen === undefined ? -1 : page.findIndex((g) => g.gid === lastSeen);
    if (foundIndex !== -1) {
      // Only visit games newer than the one we saw last run.
      games.push(...page.slice(0, foundIndex));
      break;
    }

    const room = MAX_GAMES - games.length;
    if (page.length > room) {
      // Hit the cap before finding the last-seen game — take what fits.
      games.push(...page.slice(0, room));
      break;
    }

    games.push(...page);
    offset += PAGE_SIZE;

    // No point fetching more if we've exhausted the list or have nothing to look for.
    if (lastSeen === undefined || page.length < PAGE_SIZE) break;
  }

  return { toVisit: games, newestGid, fetchError };
}

/**
 * Fetch a page of recently finished Twixt games for a given variant from the
 * LittleGolem JSON API. Resolves with the `games` array (or []).
 */
function fetchFinishedGames(variant, offset) {
  return new Promise((resolve, reject) => {
    const url = API_BASE.replace('{variant}', variant).replace('{offset}', String(offset));
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

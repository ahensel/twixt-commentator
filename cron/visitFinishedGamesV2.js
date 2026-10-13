const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { InProgress } = require('../models');
const { visitGame, sleep } = require('./helpers');

// Runs twice daily at 05:15 and 17:15.
// Phase 1: uses the LittleGolem JSON API to get recently finished games for
// each variant (DEFAULT, SIZE30, SIZE48), then visits each game that is newer
// than the last one seen in the previous run (saved in last-seen.json). It
// fetches pages of 10 and keeps going until it finds the last-seen game — so
// we don't skip past games that finished between runs — or until it has looked
// back MAX_GAMES.
// Phase 2: fetches the current ongoing games the same way (state=ongoing,
// pages of ONGOING_PAGE_SIZE, all of them) and compares against the
// in_progress table. Ongoing games the API reports that are missing from the
// table are visited (the /game route upserts them into in_progress). Games in
// the table that the API no longer reports are also visited — interesting
// because phase 1 just ran and should have captured any that finished between
// runs, so these suggest phase 1 is missing games.
// Kept alongside the old scraper (visitFinishedGames.js) so we can compare
// coverage and retire the old one once confident.
cron.schedule('30 5 * * *', async () => {
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

  console.log('[cron] Checking for ongoing games (API)...');

  let inProgressInDb;
  try {
    const rows = await InProgress.findAll({ attributes: ['lg_game_num'] });
    inProgressInDb = new Set(rows.map(r => r.lg_game_num));
  } catch (err) {
    // Without the table we can't tell which ongoing games are new — skip
    // rather than blindly re-visiting the full ongoing set.
    console.error(`[cron] Failed to load in_progress table, skipping ongoing check: ${err.message}`);
  }

  if (inProgressInDb !== undefined) {
    const toVisit = new Set();

    for (const variant of ['DEFAULT', 'SIZE30', 'SIZE48']) {
      const games = await fetchAllOngoingGames(variant);
      if (games === null) continue;

      // Ongoing games the API reports that we don't track yet. Visiting
      // upserts them into in_progress via the /game route.
      const missing = games.filter((g) => !inProgressInDb.has(g.gid)).map((g) => g.gid);
      if (missing.length > 0) {
        console.warn(`[cron] ${missing.length} ongoing ${variant} game(s) not in in_progress: ${missing.join(', ')}`);
        for (const gid of missing) toVisit.add(gid);
      }

      // Subtract this run's API view from the table set, so what remains at
      // the end are only games no longer reported as ongoing for any variant.
      for (const game of games) inProgressInDb.delete(game.gid);
    }

    // In-progress games the API no longer reports as ongoing for any variant —
    // they presumably finished between runs. Phase 1 just ran, so these are
    // the games it failed to capture.
    const vanished = [...inProgressInDb].sort((a, b) => a - b);
    if (vanished.length > 0) {
      console.warn(`[cron] ${vanished.length} in_progress game(s) no longer reported as ongoing: ${vanished.join(', ')}`);
      for (const gid of vanished) toVisit.add(gid);
    } else {
      console.log('[cron] in_progress table matches the API\'s ongoing games.');
    }

    const toVisitList = [...toVisit].sort((a, b) => a - b);
    for (const gid of toVisitList) {
      await visitGame(gid);
      // 1-second pause between requests to avoid hammering the app
      await sleep(1000);
    }
  }

  console.log('[cron] Finished visiting recently finished and ongoing games (API).');
});

// How many games per page we request from the LittleGolem API.
// The finished list walks back from the newest until the last-seen game is
// found, so small pages are fine. The ongoing list is expected to be around
// 60-90 size 24 games on a normal day (though it can exceed 100 during a
// major tournament), so pages are larger there.
const PAGE_SIZE = 10;
const ONGOING_PAGE_SIZE = 100;
// How far back we'll look for the last-seen game (MAX_GAMES / PAGE_SIZE pages).
const MAX_GAMES = 100;

const API_BASE = 'https://api.littlegolem.net/games/variant/twixt/{variant}?state={state}&min_rating=0&offset={offset}&limit={limit}';
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
      page = await fetchGamePage(variant, 'finished', offset, PAGE_SIZE);
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
 * Fetch every ongoing Twixt game for a given variant from the LittleGolem
 * JSON API, in pages of ONGOING_PAGE_SIZE. Resolves with the combined games
 * array (possibly []), or null if any page failed to fetch.
 */
async function fetchAllOngoingGames(variant) {
  const games = [];
  let offset = 0;

  while (true) {
    let page;
    try {
      page = await fetchGamePage(variant, 'ongoing', offset, ONGOING_PAGE_SIZE);
    } catch (err) {
      console.error(`[cron] Failed to fetch ongoing games for ${variant} (offset=${offset}): ${err.message}`);
      return null;
    }

    games.push(...page);

    // No point fetching more if we've exhausted the list.
    if (page.length < ONGOING_PAGE_SIZE) break;
    offset += ONGOING_PAGE_SIZE;
  }

  return games;
}

/**
 * Fetch a page of Twixt games for a given variant from the LittleGolem JSON
 * API. Resolves with the `games` array (or []).
 */
function fetchGamePage(variant, state, offset, limit) {
  return new Promise((resolve, reject) => {
    const url = API_BASE
      .replace('{variant}', variant)
      .replace('{state}', state)
      .replace('{offset}', String(offset))
      .replace('{limit}', String(limit));
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

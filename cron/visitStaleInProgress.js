const cron = require('node-cron');
const http = require('http');
const { InProgress } = require('../models');

// Runs monthly on the 1st at 06:00.
// Visits every in_progress game that hasn't been touched in over 14 days,
// hitting the game route so it gets re-fetched from LittleGolem.
cron.schedule('0 6 1 * *', async () => {
  console.log('[cron] Checking for stale in_progress games...');

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const stale = await InProgress.findAll({
    where: {
      last_visited: {
        [require('sequelize').Op.lt]: twoWeeksAgo,
      },
    },
  });

  if (stale.length === 0) {
    console.log('[cron] No stale in_progress games to visit.');
    return;
  }

  console.log(`[cron] Found ${stale.length} stale game(s), visiting each...`);

  for (const record of stale) {
    await visitGame(record.lg_game_num);
    // 1-second pause between requests to avoid hammering LittleGolem
    await sleep(1000);
  }

  console.log('[cron] Finished visiting stale in_progress games.');
});

function visitGame(gameNum) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: `/game/${gameNum}`,
      method: 'GET',
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      // Consume the response body so the connection can be freed
      res.resume();
      res.on('end', () => {
        console.log(`[cron] Visited game ${gameNum} (HTTP ${res.statusCode})`);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`[cron] Failed to visit game ${gameNum}: ${err.message}`);
      resolve();
    });

    req.on('timeout', () => {
      console.error(`[cron] Timeout visiting game ${gameNum}`);
      req.destroy();
      resolve();
    });

    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

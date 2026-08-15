const http = require('http');

// Visits a game on this app (hitting the local /game/:num route) so it gets
// re-fetched from LittleGolem. Resolves on success, error, or timeout —
// a single failed visit should not crash the cron job.
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

module.exports = { visitGame, sleep };

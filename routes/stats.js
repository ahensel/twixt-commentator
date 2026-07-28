const express = require('express');
const router = express.Router();
const https = require('https');
const { sequelize } = require('../models');

const LG_URL = 'https://www.littlegolem.net/jsp/games/gamedetail.jsp?gtid=twixt';

/**
 * Fetch the raw HTML from Little Golem's Twixt game detail page.
 * Returns a Promise<string> of the response body.
 */
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
 * Parse the total game count from the LG page HTML.
 * The page contains text like:
 *   Number of tournaments/games: <b>5784 /\r\n104745</b>
 */
function parseLGGameCount(html) {
  // Match "Number of tournaments/games:" followed by bold content containing "/ <number>"
  const match = html.match(/Number of tournaments\/games:\s*<b>[^<]*\/\s*([\d,]+)/i);
  if (!match) return null;
  return parseInt(match[1].replace(/,/g, ''), 10);
}

// Result codes shown in the breakdown table, in display order.
const RESULT_CODES = ['R', 'L', 'F', 'D'];
const RESULT_LABELS = { R: 'Resign', L: 'Connect', F: 'Forfeit', D: 'Draw' };

/**
 * Pivot flat {board_size, result, cnt} rows into:
 *   [
 *     { size: 24, R: 80, L: 10, F: 2, D: 0, total: 92 },
 *     ...
 *     { size: null, R: 5, ..., total: 7 },   // null = unknown size
 *   ]
 * Rows are sorted by board_size ascending (nulls last), then a Grand Total row
 * is appended.
 */
function pivotBreakdown(rows) {
  const map = new Map(); // key: board_size (or '__null__')

  for (const row of rows) {
    const sizeKey = row.board_size == null ? '__null__' : row.board_size;
    if (!map.has(sizeKey)) {
      const entry = { size: row.board_size == null ? null : parseInt(row.board_size, 10) };
      for (const code of RESULT_CODES) entry[code] = 0;
      entry.other = 0;
      entry.total = 0;
      map.set(sizeKey, entry);
    }
    const entry = map.get(sizeKey);
    const cnt = parseInt(row.cnt, 10);
    if (RESULT_CODES.includes(row.result)) {
      entry[row.result] += cnt;
    } else {
      entry.other += cnt;
    }
    entry.total += cnt;
  }

  // Sort: known sizes ascending, nulls last
  const sizeRows = [...map.values()].sort((a, b) => {
    if (a.size === null) return 1;
    if (b.size === null) return -1;
    return a.size - b.size;
  });

  // Grand total row
  const grand = { size: 'Total' };
  for (const code of RESULT_CODES) grand[code] = 0;
  grand.other = 0;
  grand.total = 0;
  for (const r of sizeRows) {
    for (const code of RESULT_CODES) grand[code] += r[code];
    grand.other += r.other;
    grand.total += r.total;
  }

  return { sizeRows, grand };
}

router.get('/', async (req, res) => {
  try {
    // 1. Count cached LG games in our DB
    const [[{ cached }]] = await sequelize.query(
      'SELECT COUNT(*) AS cached FROM games WHERE lg_game_num IS NOT NULL'
    );
    const cachedCount = parseInt(cached, 10);

    // 2. Breakdown by board_size × result
    const [breakdownRows] = await sequelize.query(`
      SELECT board_size, result, COUNT(*) AS cnt
      FROM games
      WHERE lg_game_num IS NOT NULL
      GROUP BY board_size, result
      ORDER BY board_size, result
    `);
    const breakdown = pivotBreakdown(breakdownRows);

    // 3. Fair comparison: for each board size, count games since that size
    //    was first introduced (determined by its lowest lg_game_num).
    //    total_since_intro = all games (any known board_size) from that
    //    game number onward, so the percentages are directly comparable.
    const [sizeIntroRows] = await sequelize.query(`
      SELECT
        s.board_size,
        s.first_game_num,
        COUNT(CASE WHEN g.board_size = s.board_size THEN 1 END) AS size_count,
        COUNT(*) AS total_since_intro
      FROM (
        SELECT board_size, MIN(lg_game_num) AS first_game_num
        FROM games
        WHERE lg_game_num IS NOT NULL
          AND board_size IS NOT NULL
        GROUP BY board_size
      ) s
      JOIN games g
        ON g.lg_game_num >= s.first_game_num
        AND g.lg_game_num IS NOT NULL
        AND g.board_size IS NOT NULL
      WHERE s.board_size != 24
      GROUP BY s.board_size, s.first_game_num
      ORDER BY s.first_game_num
    `);
    // Normalize numeric types from MySQL
    const sizeIntro = sizeIntroRows.map(r => ({
      size:             parseInt(r.board_size, 10),
      sizeCount:        parseInt(r.size_count, 10),
      totalSinceIntro:  parseInt(r.total_since_intro, 10),
    }));

    // 3. Scrape total count from Little Golem
    let lgTotal = null;
    let lgError = null;
    try {
      const html = await fetchLGPage();
      lgTotal = parseLGGameCount(html);
      if (lgTotal === null) lgError = 'Could not parse game count from Little Golem.';
    } catch (err) {
      lgError = `Failed to fetch Little Golem: ${err.message}`;
    }

    const percentage = (lgTotal && lgTotal > 0)
      ? ((cachedCount / lgTotal) * 100).toFixed(2)
      : null;

    res.render('stats/index', {
      cachedCount,
      lgTotal,
      lgError,
      percentage,
      breakdown,
      sizeIntro,
      RESULT_CODES,
      RESULT_LABELS,
      params: req.query,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

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

router.get('/pegs', async (req, res) => {
  try {
    const RESULT_CODES = ['R', 'L', 'D', 'F'];

    // Distinct board sizes that have peg data
    const [sizeRows] = await sequelize.query(`
      SELECT DISTINCT board_size
      FROM games
      WHERE lg_game_num IS NOT NULL
        AND num_pegs IS NOT NULL
        AND board_size IS NOT NULL
      ORDER BY board_size
    `);
    const boardSizes = sizeRows.map(r => parseInt(r.board_size, 10));

    // Per-size cutoff: 3.5× board size (captures nearly all real games)
    const limitBySize = {};
    for (const size of boardSizes) {
      limitBySize[size] = Math.ceil(3.5 * size);
    }
    const maxLimit = Math.max(...Object.values(limitBySize));

    // All data in one query; use a generous upper bound to exclude board-filling outliers
    const [pegsRows] = await sequelize.query(`
      SELECT board_size, num_pegs, result, COUNT(*) AS cnt
      FROM games
      WHERE lg_game_num IS NOT NULL
        AND num_pegs IS NOT NULL
        AND num_pegs < 500
        AND board_size IS NOT NULL
      GROUP BY board_size, num_pegs, result
      ORDER BY board_size, num_pegs, result
    `);

    // Build { size: { result: Array(limit) } } — each array is sized to its own limit
    const pegsBySize = {};
    for (const size of boardSizes) {
      const limit = limitBySize[size];
      pegsBySize[size] = {};
      for (const code of RESULT_CODES) {
        pegsBySize[size][code] = Array(limit).fill(0);
      }
    }
    for (const row of pegsRows) {
      const size = parseInt(row.board_size, 10);
      const pegs = parseInt(row.num_pegs, 10);
      const limit = limitBySize[size];
      if (RESULT_CODES.includes(row.result) && pegsBySize[size] && pegs < limit) {
        pegsBySize[size][row.result][pegs] = parseInt(row.cnt, 10);
      }
    }

    const defaultSize = boardSizes.includes(24) ? 24 : boardSizes[0];

    res.render('stats/pegs', {
      pegsBySize,
      boardSizes,
      defaultSize,
      limitBySize,
      RESULT_CODES,
      params: req.query,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// ── First Moves: Elo-adjusted residuals ──────────────────────────────────────

// Simple in-memory cache (survives across requests, recomputed after TTL)
let _firstMovesCache = null;
const FIRST_MOVES_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Run a full online Elo pass over all games ordered by lg_game_num, then
 * accumulate per-move1n actual vs. expected scores for the filtered set
 * (board_size=24, num_pegs>7, result not 'F' or 'D').
 *
 * Returns { moveStats, movesSorted, totalGames, maxAbsResidual }
 */
async function computeFirstMoves() {
  if (_firstMovesCache && Date.now() - _firstMovesCache.computedAt < FIRST_MOVES_TTL_MS) {
    return _firstMovesCache.data;
  }

  // Fetch every game that has player IDs and a winner, in chronological order.
  // We need all games (not just size-24) so Elo ratings are accurate.
  const [eloGames] = await sequelize.query(`
    SELECT player1_id, player2_id, winner,
           board_size, num_pegs, result, move1n, swapped
    FROM games
    WHERE lg_game_num IS NOT NULL
      AND player1_id IS NOT NULL
      AND player2_id IS NOT NULL
      AND winner      IS NOT NULL
    ORDER BY lg_game_num ASC
  `);

  const ratings = new Map(); // player_id (string key) → current Elo rating
  const K = 32;
  const getR = (id) => ratings.get(String(id)) ?? 1500;

  const perMove = {}; // move1n → { n, sumActual, sumExpected }
  let totalGames = 0;

  for (const g of eloGames) {
    const p1id = String(g.player1_id);
    const p2id = String(g.player2_id);

    const r1 = getR(p1id);
    const r2 = getR(p2id);

    // Standard Elo expected score for player 1
    const expected1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const actual1   = parseInt(g.winner, 10) === 1 ? 1 : 0;

    // Update ratings (pre-game expected, post-game update)
    ratings.set(p1id, r1 + K * (actual1       - expected1));
    ratings.set(p2id, r2 + K * ((1 - actual1) - (1 - expected1)));

    // Accumulate only for the filtered dataset
    const boardSize = parseInt(g.board_size, 10);
    const numPegs   = parseInt(g.num_pegs,   10);
    if (
      boardSize === 24 &&
      numPegs   >  7  &&
      g.result !== 'F' &&
      g.result !== 'D' &&
      g.move1n != null &&
      g.move1n.length === 2
    ) {
      const m = g.move1n;
      if (!perMove[m]) perMove[m] = { n: 0, sumActual: 0, sumExpected: 0, sumSwapped: 0 };
      perMove[m].n++;
      perMove[m].sumActual   += actual1;
      perMove[m].sumExpected += expected1;
      perMove[m].sumSwapped  += (parseInt(g.swapped, 10) === 1 || g.swapped === true) ? 1 : 0;
      totalGames++;
    }
  }

  // Compute per-move summary statistics
  const moveStats = {};
  for (const [move1n, { n, sumActual, sumExpected, sumSwapped }] of Object.entries(perMove)) {
    const winRate      = sumActual   / n;
    const expectedRate = sumExpected / n;
    moveStats[move1n] = {
      n,
      winRate,
      expectedRate,
      residual: winRate - expectedRate,
      swapRate: sumSwapped / n,
    };
  }

  // Sorted list (residual descending) for the ranked table
  const movesSorted = Object.entries(moveStats)
    .map(([move1n, stats]) => ({ move1n, ...stats }))
    .sort((a, b) => b.residual - a.residual);

  const maxAbsResidual = movesSorted.reduce(
    (acc, m) => Math.max(acc, Math.abs(m.residual)),
    0.001 // guard against all-zero
  );

  const data = { moveStats, movesSorted, totalGames, maxAbsResidual };
  _firstMovesCache = { data, computedAt: Date.now() };
  return data;
}

router.get('/first-moves', async (req, res) => {
  try {
    const data = await computeFirstMoves();
    res.render('stats/first-moves', { ...data, params: req.query });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

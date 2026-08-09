const express = require('express');
const router = express.Router();
const https = require('https');
const cheerio = require('cheerio');
const { Op } = require('sequelize');
const { Game } = require('../models');
const { LittleGolemParser } = require('../lib/domain/LittleGolemParser');

const MIN_TWIXT_GAME_NUM = 37491;

// Helper: fetch URL via HTTPS, returns { statusCode, body }
function httpsGet(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({ host, port: 443, path }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
  });
}

function parseGameNumber(gidStr, flash) {
  if (!gidStr) return null;
  const n = parseInt(gidStr, 10);
  if (isNaN(n) || String(n) !== String(gidStr).trim()) {
    flash.error = `${gidStr} is not an integer.`;
    return null;
  }
  if (n < 0) {
    flash.error = `${n} is not a positive integer.`;
    return null;
  }
  if (n < MIN_TWIXT_GAME_NUM) {
    flash.error = `Game ${n} is not a Twixt game.`;
    return null;
  }
  return n;
}

// LittleGolem SGF is encoding coordinates beyond 'z' (26) as simply further up the ASCII chart.
// The problem is, in Size 48 games, this gets into codes above 127, which causes character encoding headaches.
// This translates coordinates beyond 'z' to the range 'A-Z', which is in agreement with board coordinates.
function fixSgfCoordinates(sgf) {
  return sgf.replace(/([br])\[(.)(.)([\s\S]*?\])/g, (_, color, c1, c2, rest) => {
    const fix = c => (c.charCodeAt(0) > 122 && c.charCodeAt(0) < 149)
      ? String.fromCharCode(c.charCodeAt(0) - 58)
      : c;
    return `${color}[${fix(c1)}${fix(c2)}${rest}`;
  });
}

// Extract player IDs from the HTML game page.
// The HTML contains links like:
//   <a href="/jsp/info/player.jsp?plid=12345">Player Name ★</a>
// The player ID is in the `plid` query parameter, and the link text is the
// player name (optionally followed by a star). We match each player name
// against these links to find their ID.
function extractPlayerIds(html, player1Name, player2Name) {
  const $ = cheerio.load(html);

  // Build a map: player name (trimmed, star stripped) -> plid
  const playerLinks = $('.page-content a[href*="player.jsp?plid="]');
  const nameToId = {};
  playerLinks.each((_, el) => {
    const href = $(el).attr('href');
    const plidMatch = href.match(/plid=([0-9]+)/);
    if (plidMatch) {
      const name = $(el).text().replace(/\s*★.*/, '').trim();
      nameToId[name] = parseInt(plidMatch[1], 10);
    }
  });

  return { player1_id: nameToId[player1Name], player2_id: nameToId[player2Name] };
}

async function scrapeHtmlPage(gameNumber, cacheBust, flash) {
  try {
    return await httpsGet('www.littlegolem.net', `/jsp/game/game.jsp?gid=${gameNumber}&${cacheBust}`);
  } catch (e) {
    flash.error = `Network error scraping HTML for game ${gameNumber}: ${e.message}`;
    return null;
  }
}

async function getGameFromLittleGolem(gameNumber, flash) {
  const cacheBust = Math.random().toString();
  let response;

  try {
    response = await httpsGet('www.littlegolem.net', `/jsp/game/png.jsp?gid=${gameNumber}&${cacheBust}`);
  } catch (e) {
    flash.error = `Network error fetching game ${gameNumber}: ${e.message}`;
    return { game: null, parser: null };
  }

  if (response.statusCode === 500 || !response.body || response.body.trim() === '') {
    flash.error = `Game ${gameNumber} does not exist.`;
    return { game: null, parser: null };
  }
  if (response.statusCode !== 200) {
    flash.error = `HTTP error ${response.statusCode} trying to get game ${gameNumber}.`;
    return { game: null, parser: null };
  }

  const lgData = fixSgfCoordinates(response.body.trim());

  // if the EV[] (event) tag does not contain the string 'twixt' somewhere between the square brackets
  if (!/EV\[[^\]]*twixt[^\]]*\]/i.test(lgData)) {
    flash.error = `Game ${gameNumber} is not a Twixt game.`;
    return { game: null, parser: null };
  }

  const parser = new LittleGolemParser(lgData);

  // Always scrape the HTML page to get player IDs and check forfeit status
  const htmlResp = await scrapeHtmlPage(gameNumber, cacheBust, flash);
  if (!htmlResp) {
    return { game: null, parser: null };
  }

  if (htmlResp.statusCode !== 200) {
    flash.error = `HTTP error ${htmlResp.statusCode} scraping HTML for game ${gameNumber}.`;
    return { game: null, parser: null };
  }

  const player1Name = parser.getPlayer1();
  const player2Name = parser.getPlayer2();
  const { player1_id, player2_id } = extractPlayerIds(htmlResp.body, player1Name, player2Name);

  if (!parser.isGameOver()) {
    if (htmlResp.body.includes('game finished')) {
      parser.forfeit();
      // fall through to save as forfeit
    } else {
      // Game still in progress — return an unsaved Game object for display only
      const inProgressGame = Game.build({
        lg_game_num: gameNumber,
        lg_data: lgData,
        result: '?',
        player1: player1Name,
        player2: player2Name,
        player1_id,
        player2_id,
        winner: 0,
        tournament: parser.getTournament(),
        board_size: parser.getBoardSize(),
      });
      return { game: inProgressGame, parser };
    }
  }

  const board = parser.getTwixtBoard();
  const savedGame = await Game.create({
    lg_game_num: gameNumber,
    lg_data: lgData,
    result: parser.getResultChar(),
    player1: player1Name,
    player2: player2Name,
    player1_id,
    player2_id,
    winner: board.hasWonPlayer(1) ? 1 : board.hasWonPlayer(2) ? 2 : 0,
    tournament: parser.getTournament(),
    board_size: parser.getBoardSize(),
    num_pegs: board.numPegs(),
    created_on: new Date(),
  });

  return { game: savedGame, parser };
}

// GET /game/blank — unsaved blank board (no DB, no comments)
router.get('/blank', (req, res) => {
  let size = parseInt(req.query.size, 10);
  if (isNaN(size) || size < 8) size = 8;
  if (size > 52) size = 52;

  const player1 = req.query.player1 || 'Player1';
  const player2 = req.query.player2 || 'Player2';
  const link_policy = req.query.link_policy === 'R' ? 'R' : null;
  const swap_style = req.query.swap_style === 'P' ? 'P' : null;

  // Build a minimal object that satisfies the game/index.ejs template
  const game = {
    player1,
    player2,
    winner: 0,
    result: '',
    tournament: '',
    board_size: size,
    link_policy,
    swap_style,
    comments: [],
    isInProgress: () => false,
    isDraw: () => false,
    isResignation: () => false,
    isForfeit: () => false,
    winnerName: () => player1,
    loserName: () => player2,
    isBlank: true,
  };

  // Build a minimal parser-like object so the view can read board size and moves
  const parser = {
    getMovesList: () => [],
    getBoardSize: () => size,
  };

  res.render('game/index', {
    game,
    parser,
    flash: {},
    params: { controller: 'game', gid: 'blank', ...req.query },
    session: req.session,
  });
});

// GET /game/blank/:id — saved blank board with comments
router.get('/blank/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).send('Not found');
  }

  const game = await Game.findOne({
    where: { id, lg_game_num: { [Op.is]: null } },
    include: [{ association: 'comments', include: [{ association: 'author' }] }],
  });

  if (!game) {
    return res.status(404).send('Blank game not found');
  }

  // Mark as blank so the template suppresses LG-specific UI
  game.isBlank = true;

  const parser = {
    getMovesList: () => [],
    getBoardSize: () => game.board_size || 24,
  };

  res.render('game/index', {
    game,
    parser,
    flash: {},
    params: { controller: 'game', gid: `blank/${id}`, ...req.query },
    session: req.session,
  });
});

// GET /game/:gid
router.get('/:gid', async (req, res) => {
  const flash = req.flash ? { error: req.flash.getError() } : {};

  const gameNumber = parseGameNumber(req.params.gid, flash);
  if (!gameNumber) {
    if (flash.error) req.flash && req.flash.error(flash.error);
    return res.render('game/index', { game: null, parser: null, flash, params: { controller: 'game', gid: req.params.gid, ...req.query } });
  }

  let game = await Game.findOne({
    where: { lg_game_num: gameNumber },
    include: [{ association: 'comments', include: [{ association: 'author' }] }],
  });

  let parser = null;

  if (game) {
    parser = new LittleGolemParser(game.lg_data);
    if (game.isForfeit()) parser.forfeit();
    // Eagerly load comments if not already (Sequelize include above handles it)
  } else {
    const result = await getGameFromLittleGolem(gameNumber, flash);
    game = result.game;
    parser = result.parser;

    // If fetched game is saved, reload with comments
    if (game && game.id) {
      game = await Game.findOne({
        where: { id: game.id },
        include: [{ association: 'comments', include: [{ association: 'author' }] }],
      });
    } else if (game) {
      game.comments = [];
    }
  }

  if (flash.error) req.flash && req.flash.error(flash.error);

  res.render('game/index', {
    game,
    parser,
    flash,
    params: { controller: 'game', gid: req.params.gid, ...req.query },
    session: req.session,
  });
});

// POST /game — redirect (Go form submits here from game page)
router.post('/', (req, res) => {
  const gid = req.body.new_gid;
  res.redirect(`/game/${gid}`);
});

module.exports = router;

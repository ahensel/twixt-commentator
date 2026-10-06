const express = require('express');
const router = express.Router();
const https = require('https');
const { Op } = require('sequelize');
const { Game, InProgress } = require('../models');
const { LittleGolemParser } = require('../lib/domain/LittleGolemParser');
const { LittleGolemNewParser } = require('../lib/domain/LittleGolemNewParser');

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

// Fetch game JSON from the new LittleGolem API.
async function fetchLgApi(gameNumber, flash) {
  try {
    const response = await httpsGet('api.littlegolem.net', `/games/gamedetail/${gameNumber}`);
    if (response.statusCode === 404 || !response.body || response.body.trim() === '') {
      flash.error = `Game ${gameNumber} does not exist.`;
      return null;
    }
    if (response.statusCode !== 200) {
      flash.error = `HTTP error ${response.statusCode} trying to get game ${gameNumber}.`;
      return null;
    }
    // The API sometimes returns duplicate JSON objects concatenated — take the first.
    const firstJson = response.body.trim().replace(/}\s*\{[\s\S]*$/, '}');
    return JSON.parse(firstJson);
  } catch (e) {
    flash.error = `Network error fetching game ${gameNumber}: ${e.message}`;
    return null;
  }
}

async function getGameFromLittleGolem(gameNumber, flash) {
  const apiJson = await fetchLgApi(gameNumber, flash);
  if (!apiJson) return { game: null, parser: null };

  if (apiJson.gtid !== 'twixt') {
    flash.error = `Game ${gameNumber} is not a Twixt game.`;
    return { game: null, parser: null };
  }

  const parser = new LittleGolemNewParser(apiJson);
  const lgData = LittleGolemNewParser.buildLgData(apiJson);

  const player1Name = parser.getPlayer1();
  const player2Name = parser.getPlayer2();
  const player1_id = parser.getPlayer1Id();
  const player2_id = parser.getPlayer2Id();

  if (!parser.isCompleted()) {
    // Game still in progress — upsert to in_progress, then return for display only
    await InProgress.upsert({
      lg_game_num: gameNumber,
      last_visited: new Date(),
    });
    const inProgressGame = Game.build({
      lg_game_num: gameNumber,
      lg_data: lgData,
      lg_data_type: 'N',
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

  const board = parser.getTwixtBoard();
  const savedGame = await Game.create({
    lg_game_num: gameNumber,
    lg_data: lgData,
    lg_data_type: 'N',
    result: parser.getResultChar(),
    player1: player1Name,
    player2: player2Name,
    player1_id,
    player2_id,
    winner: board.hasWonPlayer(1) ? 1 : board.hasWonPlayer(2) ? 2 : 0,
    tournament: parser.getTournament(),
    board_size: parser.getBoardSize(),
    num_pegs: board.numPegs(),
    move1n: parser.getNormalizedFirstMove(),
    swapped: parser.getSwapped(),
    created_on: new Date(),
  });

  // Remove from in_progress if it exists there
  await InProgress.destroy({ where: { lg_game_num: gameNumber } });

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
    if (game.lg_data_type === 'N') {
      parser = new LittleGolemNewParser(game.lg_data, game);
      if (game.isForfeit()) parser.forfeit();
    } else {
      parser = new LittleGolemParser(game.lg_data);
      if (game.isForfeit()) parser.forfeit();
    }
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

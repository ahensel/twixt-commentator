// Translated from game_controller.rb

const express = require('express');
const router = express.Router();
const https = require('https');
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

  const lgData = response.body.trim();

  if (!lgData.includes('SZ[24]')) {
    flash.error = `Game ${gameNumber} is not a Twixt game.`;
    return { game: null, parser: null };
  }

  const parser = new LittleGolemParser(lgData);

  if (!parser.isGameOver()) {
    // Game may be a forfeit — scrape the HTML page to check
    let htmlResp;
    try {
      htmlResp = await httpsGet('www.littlegolem.net', `/jsp/game/game.jsp?gid=${gameNumber}&${cacheBust}`);
    } catch (e) {
      flash.error = `Network error checking game ${gameNumber} forfeit status: ${e.message}`;
      return { game: null, parser: null };
    }

    if (htmlResp.statusCode !== 200) {
      flash.error = `HTTP error ${htmlResp.statusCode} checking forfeit for game ${gameNumber}.`;
      return { game: null, parser: null };
    }

    if (htmlResp.body.includes('game finished')) {
      parser.forfeit();
      // fall through to save as forfeit
    } else {
      // Game still in progress — return an unsaved Game object for display only
      const inProgressGame = Game.build({
        lg_game_num: gameNumber,
        lg_data: lgData,
        result: '?',
        player1: parser.getPlayer1(),
        player2: parser.getPlayer2(),
        winner: 0,
        tournament: parser.getTournament(),
      });
      return { game: inProgressGame, parser };
    }
  }

  const board = parser.getTwixtBoard();
  const savedGame = await Game.create({
    lg_game_num: gameNumber,
    lg_data: lgData,
    result: parser.getResultChar(),
    player1: parser.getPlayer1(),
    player2: parser.getPlayer2(),
    winner: board.hasWonPlayer(1) ? 1 : board.hasWonPlayer(2) ? 2 : 0,
    tournament: parser.getTournament(),
    created_on: new Date(),
  });

  return { game: savedGame, parser };
}

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
    include: [{ association: 'comments' }],
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
        include: [{ association: 'comments' }],
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

const express = require('express');
const router = express.Router();
const https = require('https');
const { Game } = require('../models');
const { LittleGolemParser } = require('../lib/domain/LittleGolemParser');
const { LittleGolemNewParser } = require('../lib/domain/LittleGolemNewParser');
const { JTwixtFormatter } = require('../lib/domain/JTwixtFormatter');

function httpsGet(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({ host, port: 443, path }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
  });
}

async function getGameFromLittleGolem(gameNumber) {
  try {
    const response = await httpsGet('api.littlegolem.net', `/games/gamedetail/${gameNumber}`);
    if (response.statusCode !== 200 || !response.body || response.body.trim() === '') return null;

    // The API sometimes returns duplicate JSON objects concatenated — take the first.
    const firstJson = response.body.trim().replace(/}\s*\{[\s\S]*$/, '}');
    const apiJson = JSON.parse(firstJson);

    if (apiJson.gtid !== 'twixt') return null;

    const parser = new LittleGolemNewParser(apiJson);
    const lgData = LittleGolemNewParser.buildLgData(apiJson);
    return Game.build({
      lg_game_num: gameNumber,
      lg_data: lgData,
      lg_data_type: 'N',
      result: '?',
      player1: parser.getPlayer1(),
      player2: parser.getPlayer2(),
      winner: 0,
      tournament: parser.getTournament(),
      board_size: parser.getBoardSize(),
    });
  } catch (e) {
    return null;
  }
}

function buildJTwixtFileData(game) {
  const jtwixt = new JTwixtFormatter();

  let parser;
  if (game.lg_data_type === 'N') {
    parser = new LittleGolemNewParser(game.lg_data, game);
  } else {
    parser = new LittleGolemParser(game.lg_data);
  }

  let fileData = jtwixt.formatStandardTwixtHeader(game.player1, game.player2);
  parser.forEachMoveForJtwixt((x, y, player) => {
    fileData = Buffer.concat([fileData, jtwixt.formatShortMove(x, y, player)]);
  });
  fileData = Buffer.concat([fileData, jtwixt.format2byteInt(0)]);
  return fileData;
}

const FORMATS = {
  tgt: { extension: '.tgt', build: (game) => buildJTwixtFileData(game) },
  t1: { extension: '.t1', build: (game) => require('../lib/domain/TwixtbotFormatter').TwixtbotFormatter.buildFile(game) },
};

// GET /jtwixt/gen?gameid=X[&format=tgt][&filename=...]
router.get('/gen', async (req, res) => {
  const gameId = req.query.gameid;
  if (!gameId) {
    return res.status(400).send('Missing required query parameter: gameid');
  }

  const format = FORMATS[req.query.format] ? req.query.format : 'tgt';
  let game = await Game.findOne({ where: { lg_game_num: gameId } });
  if (!game) {
    game = await getGameFromLittleGolem(gameId);
  }

  if (!game) {
    return res.status(404).send('Game not found');
  }

  const fileData = FORMATS[format].build(game);
  let fileName = req.query.filename ? String(req.query.filename).trim().replace(/[^\w. -]/g, '') : '';
  if (!fileName) fileName = `game${gameId}`;
  if (!fileName.toLowerCase().endsWith(FORMATS[format].extension)) fileName += FORMATS[format].extension;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(fileData);
});

module.exports = router;

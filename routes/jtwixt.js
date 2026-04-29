const express = require('express');
const router = express.Router();
const https = require('https');
const { Game } = require('../models');
const { LittleGolemParser } = require('../lib/domain/LittleGolemParser');
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
  const cacheBust = Math.random().toString();
  const response = await httpsGet('www.littlegolem.net', `/jsp/game/png.jsp?gid=${gameNumber}&${cacheBust}`);
  if (response.statusCode !== 200 || !response.body || response.body.trim() === '') return null;

  const lgData = response.body.trim();
  if (!lgData.includes('SZ[24]')) return null;

  const parser = new LittleGolemParser(lgData);
  return Game.build({
    lg_game_num: gameNumber,
    lg_data: lgData,
    result: '?',
    player1: parser.getPlayer1(),
    player2: parser.getPlayer2(),
    winner: 0,
    tournament: parser.getTournament(),
  });
}

function buildJTwixtFileData(game) {
  const parser = new LittleGolemParser(game.lg_data);
  const jtwixt = new JTwixtFormatter();

  let fileData = jtwixt.formatStandardTwixtHeader(game.player1, game.player2);
  parser.forEachMoveForJtwixt((x, y, player) => {
    fileData = Buffer.concat([fileData, jtwixt.formatShortMove(x, y, player)]);
  });
  fileData = Buffer.concat([fileData, jtwixt.format2byteInt(0)]);
  return fileData;
}

// GET /jtwixt/gen?gameid=X
router.get('/gen', async (req, res) => {
  const gameId = req.query.gameid;
  let game = await Game.findOne({ where: { lg_game_num: gameId } });
  if (!game) {
    game = await getGameFromLittleGolem(gameId);
  }

  if (!game) {
    return res.status(404).send('Game not found');
  }

  const fileData = buildJTwixtFileData(game);
  const fileName = `game${gameId}.tgt`;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(fileData);
});

module.exports = router;

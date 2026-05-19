// This endpoint is called via Ajax.
// It returns an HTML fragment that is inserted into #current_comments.

const express = require('express');
const router = express.Router();
const { Comment, Game, User } = require('../models');
const { prepareComment } = require('../lib/helpers/applicationHelper');

router.post('/', async (req, res) => {
  if (!req.session.user_id) {
    return res.status(403).send('');
  }

  const rawComment = (req.body.new_comment || '').trim();
  let gameId = req.body.game;
  const buttonPressed = req.body.button_pressed;
  const isBlankBoard = (gameId === 'blank');

  let comment;
  let preview = false;
  let newGameId = null;

  if (buttonPressed === 'Preview') {
    // For preview we don't need a real game row yet
    comment = Comment.build({
      game_id: isBlankBoard ? null : gameId,
      comment: rawComment,
      user_id: req.session.user_id,
      created_on: new Date(),
    });
    preview = true;
  } else if (rawComment.length > 0) {
    if (isBlankBoard) {
      // First comment on a blank board — create the game row now
      let boardSize = parseInt(req.body.board_size, 10);
      if (isNaN(boardSize) || boardSize < 8) boardSize = 24;
      if (boardSize > 52) boardSize = 52;

      const game = await Game.create({
        lg_game_num: null,
        lg_data: null,
        result: null,
        player1: req.body.player1 || 'Player1',
        player2: req.body.player2 || 'Player2',
        winner: 0,
        board_size: boardSize,
        created_on: new Date(),
      });

      newGameId = game.id;
      gameId = game.id;
    }

    comment = await Comment.create({
      game_id: gameId,
      comment: rawComment,
      user_id: req.session.user_id,
      created_on: new Date(),
    });

    await Game.update(
      { last_commented_on: comment.created_on, last_commented_by: req.session.user_id },
      { where: { id: gameId } }
    );
  }

  if (comment) {
    if (newGameId !== null) {
      res.set('X-New-Game-Id', String(newGameId));
    }
    const author = await User.findByPk(req.session.user_id);
    res.render('comment/index', {
      comment,
      preview,
      author,
      prepareComment,
      params: req.body,
      session: req.session,
    });
  } else {
    res.send('');
  }
});

module.exports = router;

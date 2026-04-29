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
  const gameId = req.body.game;
  const buttonPressed = req.body.button_pressed;

  let comment;
  let preview = false;

  if (buttonPressed === 'Preview') {
    comment = Comment.build({
      game_id: gameId,
      comment: rawComment,
      user_id: req.session.user_id,
      created_on: new Date(),
    });
    preview = true;
  } else if (rawComment.length > 0) {
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

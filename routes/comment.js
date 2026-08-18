// This endpoint is called via Ajax.
// It returns an HTML fragment that is inserted into #current_comments.

const express = require('express');
const router = express.Router();
const { Comment, Game, User } = require('../models');


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
        link_policy: req.body.link_policy === 'R' ? 'R' : null,
        swap_style: req.body.swap_style === 'P' ? 'P' : null,
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
      params: req.body,
      session: req.session,
    });
  } else {
    res.send('');
  }
});

// Recalculate last_commented_on / last_commented_by from non-deleted comments
async function refreshLastCommented(gameId) {
  const latest = await Comment.findOne({
    where: { game_id: gameId, deleted_at: null },
    order: [['created_on', 'DESC']],
    attributes: ['created_on', 'user_id'],
  });

  await Game.update(
    {
      last_commented_on: latest ? latest.created_on : null,
      last_commented_by: latest ? latest.user_id : null,
    },
    { where: { id: gameId } }
  );
}

// GET /comment/:id — fetch comment text for inline editing (author only, AJAX)
router.get('/:id', async (req, res) => {
  if (!req.session.user_id) return res.status(403).json({ error: 'Not logged in' });

  const comment = await Comment.findByPk(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.user_id !== req.session.user_id) return res.status(403).json({ error: 'Forbidden' });

  res.json({ comment: comment.comment });
});

// PUT /comment/:id — edit comment (author only, AJAX)
router.put('/:id', async (req, res) => {
  if (!req.session.user_id) return res.status(403).json({ error: 'Not logged in' });

  const comment = await Comment.findByPk(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.user_id !== req.session.user_id) return res.status(403).json({ error: 'Forbidden' });

  const newText = (req.body.new_comment || '').trim();
  if (newText.length === 0) return res.status(400).json({ error: 'Comment cannot be empty' });

  comment.comment = newText;
  await comment.save();

  // Re-render the comment with the same context used on the game page
  const author = await User.findByPk(req.session.user_id);
  const game = await Game.findByPk(comment.game_id);
  res.render('comment/index', {
    comment,
    preview: false,
    author: author,
    params: req.body,
    session: req.session,
  });
});

// DELETE /comment/:id — soft-delete (author only, AJAX)
router.delete('/:id', async (req, res) => {
  if (!req.session.user_id) return res.status(403).json({ error: 'Not logged in' });

  const comment = await Comment.findByPk(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.user_id !== req.session.user_id) return res.status(403).json({ error: 'Forbidden' });

  comment.deleted_at = new Date();
  await comment.save();

  await refreshLastCommented(comment.game_id);
  res.json({ ok: true });
});

// POST /comment/:id/undelete — restore a soft-deleted comment (author only, AJAX)
router.post('/:id/undelete', async (req, res) => {
  if (!req.session.user_id) return res.status(403).json({ error: 'Not logged in' });

  const comment = await Comment.findByPk(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.user_id !== req.session.user_id) return res.status(403).json({ error: 'Forbidden' });

  comment.deleted_at = null;
  await comment.save();

  await refreshLastCommented(comment.game_id);
  res.json({ ok: true });
});

module.exports = router;


// Translated from rss_feed_controller.rb

const express = require('express');
const router = express.Router();
const { Comment, Game, User } = require('../models');
const { h2, sanitizeHtml } = require('../lib/helpers/applicationHelper');

// GET /rss_feed/all_comments.rss
router.get('/all_comments.rss', async (req, res) => {
  const comments = await Comment.findAll({
    order: [['created_on', 'DESC']],
    limit: 20,
    include: [{ association: 'game' }],
  });

  // Gather user ids and fetch
  const userIds = [...new Set(comments.map(c => c.user_id))];
  const users = await User.findAll({ where: { id: userIds } });
  const userMap = {};
  for (const u of users) userMap[u.id] = u;

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const items = comments.map(comment => {
    const game = comment.game;
    const user = userMap[comment.user_id];
    const rssUrl = `${baseUrl}/rss_feed/show/${comment.id}`;
    const pubDate = comment.created_on ? new Date(comment.created_on).toUTCString() : '';
    const description = sanitizeHtml(comment.comment || '').replace(/\n/g, '<br/>');
    const title = `Game ${game ? game.lg_game_num : '?'}: ${h2(game ? game.player1 : '')} vs. ${h2(game ? game.player2 : '')} in ${game ? game.tournament : ''}`;
    const author = h2(user ? user.name : 'unknown');

    return `
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <link>${rssUrl}</link>
      <guid>${rssUrl}</guid>
      <author>${author}</author>
    </item>`;
  }).join('\n');

  const feedUrl = `${baseUrl}/rss_feed/all_comments.rss`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Twixt Commentator</title>
    <description>The latest comments on Twixt Commentator</description>
    <link>${feedUrl}</link>
    ${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

// GET /rss_feed/show/:id — redirect to the associated game page
router.get('/show/:id', async (req, res) => {
  const comment = await Comment.findByPk(req.params.id, {
    include: [{ association: 'game' }],
  });
  if (!comment || !comment.game) return res.redirect('/');
  res.redirect(`/game/${comment.game.lg_game_num}`);
});

module.exports = router;

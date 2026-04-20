// Translated from main_page_controller.rb + main_page_helper.rb pagination

const express = require('express');
const router = express.Router();
const { Game, User } = require('../models');
const { Op } = require('sequelize');
const { paginationLinks } = require('../lib/helpers/applicationHelper');

const PER_PAGE = 20;

router.get('/', async (req, res) => {
  try {
    const pageParam = parseInt(req.query.page, 10) || 1;
    const page = pageParam < 1 ? 1 : pageParam;
    const offset = (page - 1) * PER_PAGE;

    const { count, rows: commentedGames } = await Game.findAndCountAll({
      where: { last_commented_on: { [Op.ne]: null } },
      order: [['last_commented_on', 'DESC']],
      limit: PER_PAGE,
      offset,
    });

    const totalPages = Math.ceil(count / PER_PAGE);

    // Pre-load authors for displayed games
    const authorIds = commentedGames.map(g => g.last_commented_by).filter(Boolean);
    const authors = await User.findAll({ where: { id: authorIds } });
    const authorMap = {};
    for (const a of authors) authorMap[a.id] = a;

    const pages = paginationLinks(page, totalPages, (p) => `/?page=${p}`);

    res.render('main_page/index', {
      commentedGames,
      authorMap,
      currentPage: page,
      totalPages,
      pages,
      params: req.query,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// POST /game — redirect from the "Go" form on the main page
router.post('/game', (req, res) => {
  const gid = req.body.new_gid;
  res.redirect(`/game/${gid}`);
});

module.exports = router;

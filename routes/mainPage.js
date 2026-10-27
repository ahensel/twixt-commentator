const express = require('express');
const router = express.Router();
const { Game, User } = require('../models');
const { Op } = require('sequelize');

const PER_PAGE = 20;

// Pagination helper
// Returns an array of page descriptors: { page: Number|null, label: String }
// (null page means '...' ellipsis)
function paginationLinks(currentPage, totalPages, buildUrl) {
  const cur = (currentPage == null || currentPage < 1 || currentPage > totalPages) ? 1 : currentPage;
  const top = totalPages;
  const parts = [];

  for (let pageNumber = 1; pageNumber <= top; pageNumber++) {
    if (top > 9 && ((pageNumber === 2 && cur > 5) || (pageNumber === top - 1 && cur < top - 4))) {
      parts.push({ page: null, label: '...' });
    } else if (
      pageNumber === 1 ||
      pageNumber === top ||
      (pageNumber > cur - 3 && pageNumber < cur + 3) ||
      (cur < 6 && pageNumber < 8) ||
      (cur > top - 5 && pageNumber > top - 7)
    ) {
      parts.push({ page: pageNumber, label: String(pageNumber), current: pageNumber === cur, url: buildUrl(pageNumber) });
    }
  }
  return parts;
}

router.get('/', async (req, res) => {
  try {
    let page;
    if (req.query.page) {
      page = parseInt(req.query.page, 10);
    } else {
      page = parseInt(req.session.main_page, 10) || 1;
    }

    // Ensure page is a valid positive integer, defaulting to 1
    if (!Number.isInteger(page) || page < 1) {
      page = 1;
    }

    req.session.main_page = page;
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

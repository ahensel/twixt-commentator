const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { sanitizeHtml } = require('../lib/helpers/applicationHelper');

// Helper: reconstruct the "back" redirect URL from hidden form params,
// mirroring Rails' go_back action.
function buildBackUrl(params) {
  const backTo = params.back_to;
  const retGid = params.ret_gid;

  if (!backTo) return '/';

  if (backTo === 'game' && retGid) {
    if (retGid === 'blank') {
      // Reconstruct the blank board URL with its player/size params
      const qs = new URLSearchParams();
      if (params.player1) qs.set('player1', params.player1);
      if (params.player2) qs.set('player2', params.player2);
      if (params.size)        qs.set('size',        params.size);
      if (params.link_policy) qs.set('link_policy', params.link_policy);
      if (params.swap_style) qs.set('swap_style', params.swap_style);
      const qstr = qs.toString();
      return `/game/blank${qstr ? '?' + qstr : ''}`;
    }
    return `/game/${retGid}`;
  }
  return '/';
}

// GET /user/add_user
router.get('/add_user', (req, res) => {
  res.render('user/add_user', {
    errors: [],
    params: req.query,
    session: req.session,
  });
});

// POST /user/add_user
router.post('/add_user', async (req, res) => {
  const { name, password, password_confirmation, on_lg, name_on_lg, info } = req.body.user || req.body;
  const errors = [];

  if (!name || name.trim() === '') errors.push('Name is required.');
  if (!password || password.trim() === '') errors.push('Password is required.');
  if (password !== password_confirmation) errors.push('Password confirmation does not match.');

  const existing = await User.findOne({ where: { name } });
  if (existing) errors.push('Name has already been taken.');

  if (errors.length) {
    return res.render('user/add_user', { errors, params: req.body, session: req.session });
  }

  const user = User.build({ name, on_lg: !!on_lg, name_on_lg: name_on_lg || '', info: info || '', created_on: new Date() });
  user.setPassword(password);
  await user.save();

  req.session.user_id = user.id;
  res.redirect(buildBackUrl(req.body));
});

// POST /user/login
router.post('/login', async (req, res) => {
  req.session.user_id = null;
  const user = await User.authenticate(req.body.name, req.body.password);
  if (user) {
    req.session.user_id = user.id;
  } else {
    req.session.login_notice = 'Invalid Name or Password';
  }
  res.redirect(buildBackUrl(req.body));
});

// GET /user/logout
router.get('/logout', (req, res) => {
  req.session.user_id = null;
  res.redirect(buildBackUrl(req.query));
});

// GET /user/info/:id.json — JSON endpoint for the popup modal
router.get('/info/:id.json', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const d = user.dataValues;
  res.json({
    id: d.id,
    name: d.name,
    on_lg: d.on_lg,
    name_on_lg: d.name_on_lg || '',
    info: sanitizeHtml(d.info || ''),
    created_on: d.created_on ? new Date(d.created_on).toISOString().slice(0, 10) : '',
  });
});

// GET /user/profile/:id
router.get('/profile/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).send('User not found');
  res.render('user/profile', { user, errors: [], params: req.query, session: req.session });
});

// POST /user/profile/:id
router.post('/profile/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).send('User not found');

  const { name, password, password_confirmation, on_lg, name_on_lg, info } = req.body.user || req.body;
  const errors = [];

  if (!name || name.trim() === '') errors.push('Name is required.');
  if (password && password !== password_confirmation) errors.push('Password confirmation does not match.');

  if (errors.length) {
    return res.render('user/profile', { user, errors, params: req.body, session: req.session });
  }

  user.name = name;
  user.on_lg = !!on_lg;
  user.name_on_lg = name_on_lg || '';
  user.info = info || '';
  if (password && password.trim() !== '') user.setPassword(password);
  await user.save();

  res.redirect(buildBackUrl(req.body));
});

module.exports = router;


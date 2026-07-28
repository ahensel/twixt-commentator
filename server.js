require('dotenv').config();
const path = require('path');
const express = require('express');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const bodyParser = require('body-parser');

const { sequelize, User } = require('./models');
const { h2, xssize, prepareComment } = require('./lib/helpers/applicationHelper');

// ── Routes ──────────────────────────────────────────────────────────────────
const mainPageRouter = require('./routes/mainPage');
const gameRouter = require('./routes/game');
const commentRouter = require('./routes/comment');
const userRouter = require('./routes/user');
const jtwixtRouter = require('./routes/jtwixt');
const statsRouter = require('./routes/stats');
const app = express();
const PORT = process.env.PORT || 3000;

// ── View engine ──────────────────────────────────────────────────────────────
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static assets ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true, encoding: 'utf-8' }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
    return 'dev-only-insecure-secret';
  })(),
  resave: false,
  saveUninitialized: false,
  name: '_twixt_session_id',
}));

// ── Expose helpers and session to all EJS templates via res.locals ───────────
app.use(async (req, res, next) => {
  res.locals.h2 = h2;
  res.locals.xssize = xssize;
  res.locals.prepareComment = prepareComment;
  res.locals.session = req.session;
  res.locals.flash = {
    error: req.session._flash_error || null,
    notice: req.session._flash_notice || null,
  };
  // Clear flash after reading
  delete req.session._flash_error;
  delete req.session._flash_notice;

  // Load current user for loginbox
  if (req.session.user_id) {
    try {
      res.locals.currentUser = await User.findByPk(req.session.user_id);
    } catch (e) {
      res.locals.currentUser = null;
    }
  } else {
    res.locals.currentUser = null;
  }

  next();
});

// Simple flash helpers (avoids connect-flash dependency)
app.use((req, res, next) => {
  req.flash = {
    error: (msg) => { req.session._flash_error = msg; },
    getError: () => { return req.session._flash_error; },
    notice: (msg) => { req.session._flash_notice = msg; },
    getNotice: () => { return req.session._flash_notice; },
  };
  next();
});

// ── Mount routes ─────────────────────────────────────────────────────────────
app.use('/', mainPageRouter);
app.use('/game', gameRouter);
app.use('/comment', commentRouter);
app.use('/user', userRouter);
app.use('/jtwixt', jtwixtRouter);
app.get('/faq', (req, res) => res.render('about/faq', { params: req.query }));
app.use('/stats', statsRouter);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

// ── Start ─────────────────────────────────────────────────────────────────────
const HOST = process.env.HOST || 'localhost';

sequelize.authenticate()
  .then(() => {
    console.log('Database connection established.');
    app.listen(PORT, HOST, () => {
      console.log(`Twixt Commentator running at http://${HOST}:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });

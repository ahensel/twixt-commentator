// Phase 2 — Models

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─── Game ────────────────────────────────────────────────────────────────────

const Game = sequelize.define('Game', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lg_game_num: { type: DataTypes.INTEGER },
  result: { type: DataTypes.STRING(1) },
  lg_data: { type: DataTypes.TEXT },
  created_on: { type: DataTypes.DATE },
  last_commented_on: { type: DataTypes.DATE },
  last_commented_by: { type: DataTypes.INTEGER },
  player1: { type: DataTypes.STRING },
  player2: { type: DataTypes.STRING },
  winner: { type: DataTypes.INTEGER },
  tournament: { type: DataTypes.STRING },
  board_size: { type: DataTypes.INTEGER },
  link_policy: { type: DataTypes.STRING(1) },
  swap_style: { type: DataTypes.STRING(1) },
}, {
  tableName: 'games',
  timestamps: false,
});

// Instance helpers mirroring game.js
Game.prototype.winnerName = function () {
  return this.winner !== 2 ? this.player1 : this.player2;
};
Game.prototype.loserName = function () {
  return this.winner === 2 ? this.player1 : this.player2;
};
Game.prototype.isDraw = function () { return this.result === 'D'; };
Game.prototype.isResignation = function () { return this.result === 'R'; };
Game.prototype.isForfeit = function () { return this.result === 'F'; };
Game.prototype.isLoss = function () { return this.result === 'L'; };
Game.prototype.isInProgress = function () { return this.result === '?'; };

// ─── Comment ──────────────────────────────────────────────────────────────────

const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comment: { type: DataTypes.TEXT },
  game_id: { type: DataTypes.INTEGER },
  created_on: { type: DataTypes.DATE },
  user_id: { type: DataTypes.INTEGER },
}, {
  tableName: 'comments',
  timestamps: false,
});

// ─── User ─────────────────────────────────────────────────────────────────────

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING },
  hashed_password: { type: DataTypes.STRING },
  salt: { type: DataTypes.STRING },
  created_on: { type: DataTypes.DATE },
  on_lg: { type: DataTypes.BOOLEAN },
  name_on_lg: { type: DataTypes.STRING },
  info: { type: DataTypes.TEXT },
}, {
  tableName: 'users',
  timestamps: false,
});

const crypto = require('crypto');
User._encryptedPassword = function (password, salt) {
  return crypto.createHash('sha1')
    .update(password + (process.env.PEPPER || '') + salt)
    .digest('hex');
};

User.authenticate = async function (name, password) {
  const user = await User.findOne({ where: { name } });
  if (!user) return null;
  const expected = User._encryptedPassword(password, user.salt);
  return user.hashed_password === expected ? user : null;
};

User.prototype.setPassword = function (pwd) {
  if (pwd && pwd.trim() !== '') {
    this.salt = String(Math.random()) + String(Math.random());
    this.hashed_password = User._encryptedPassword(pwd, this.salt);
  }
};

// ─── Associations ─────────────────────────────────────────────────────────────

Game.hasMany(Comment, { foreignKey: 'game_id', as: 'comments' });
Comment.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(Comment,  { foreignKey: 'user_id', as: 'comments' });

module.exports = { sequelize, Game, Comment, User };

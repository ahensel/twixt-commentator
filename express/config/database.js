const { Sequelize } = require('sequelize');
const cfg = require('./config')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host: cfg.host,
  dialect: cfg.dialect,
  logging: false,
  define: {
    // Rails used snake_case timestamps named created_on / last_commented_on
    // We'll manage timestamp columns manually per-model
    timestamps: false,
    underscored: true,
  },
});

module.exports = sequelize;

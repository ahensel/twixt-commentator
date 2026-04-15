const { Sequelize } = require('sequelize');
const cfg = require('./config')[process.env.NODE_ENV || 'development'];

// Create sequelize instance with proper UTF-8 configuration for MySQL
const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host: cfg.host,
  dialect: cfg.dialect,
  logging: false,
  // Keep this for when you run migrations/sync
  charset: 'utf8mb4',
  define: {
    // Rails used snake_case timestamps named created_on / last_commented_on
    // We'll manage timestamp columns manually per-model
    timestamps: false,
    underscored: true,
  },
  dialectOptions: {
    charset: 'utf8mb4',
  },
});

module.exports = sequelize;

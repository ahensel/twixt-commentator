const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('./config');
const cfg = config[env] || config.development;

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
  // Recycle idle connections so we never hand out a socket that MySQL (or an
  // intermediate proxy/firewall) has already closed — otherwise the first
  // query after a quiet period fails with "Connection lost".
  pool: {
    max: 10,
    min: 0,
    idle: 10000,   // destroy pooled connections after 10s of idleness
    evict: 60000,  // ping connections before reuse if they've been idle this long
  },
  dialectOptions: {
    charset: 'utf8mb4',
    enableKeepAlive: true,
  },
});

module.exports = sequelize;

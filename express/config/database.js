const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('twixt_development', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false,
  define: {
    // Rails used snake_case timestamps named created_on / last_commented_on
    // We'll manage timestamp columns manually per-model
    timestamps: false,
    underscored: true,
  },
});

module.exports = sequelize;

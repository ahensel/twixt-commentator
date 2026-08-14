'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('in_progress', {
      lg_game_num: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      last_visited: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('in_progress');
  },
};

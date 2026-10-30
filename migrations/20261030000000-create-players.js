'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('players', {
      player_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true,
      },
      player_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });

    await queryInterface.addIndex('players', ['player_id'], {
      name: 'players_player_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('players');
  },
};


'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('games', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      lg_game_num: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      result: {
        type: Sequelize.STRING(1),
        allowNull: true,
      },
      lg_data: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_on: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_commented_on: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_commented_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      player1: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      player2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      winner: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      tournament: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('games');
  },
};


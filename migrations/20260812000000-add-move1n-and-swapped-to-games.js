'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('games', 'move1n', {
      type: Sequelize.STRING(2),
      allowNull: true,
    });
    await queryInterface.addColumn('games', 'swapped', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('games', 'swapped');
    await queryInterface.removeColumn('games', 'move1n');
  },
};

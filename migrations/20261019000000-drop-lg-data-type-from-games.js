'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('games', 'lg_data_type');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('games', 'lg_data_type', {
      type: Sequelize.STRING(1),
      allowNull: true,
      defaultValue: null,
    });
  },
};

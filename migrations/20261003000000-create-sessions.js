'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Matches the schema.sql shipped with express-mysql-session v3.
    await queryInterface.createTable('sessions', {
      session_id: {
        type: Sequelize.STRING(128),
        allowNull: false,
        primaryKey: true,
      },
      expires: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      data: {
        type: Sequelize.TEXT('medium'),
        allowNull: true,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_bin',
      engine: 'InnoDB',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sessions');
  },
};

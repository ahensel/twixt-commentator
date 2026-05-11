'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      hashed_password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      salt: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      created_on: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      on_lg: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      name_on_lg: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      info: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};

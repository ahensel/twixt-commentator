  module.exports = {
    async up(queryInterface, Sequelize) {
      await queryInterface.addColumn('games', 'swap_style', {
        type: Sequelize.STRING(1),
        allowNull: true,
      });
    },

    async down(queryInterface) {
      await queryInterface.removeColumn('games', 'swap_style');
    },
  };

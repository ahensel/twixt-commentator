class CreateGames < ActiveRecord::Migration
  def self.up
    create_table :games do |t|
      t.column :lg_game_num, :integer
      t.column :result, :char
      t.column :lg_data, :text
      t.column :created_on, :datetime
    end
  end

  def self.down
    drop_table :games
  end
end

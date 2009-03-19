class DefineGameIdIndex < ActiveRecord::Migration
  def self.up
    add_index :games, :lg_game_num, :unique => true
  end

  def self.down
    remove_index :games, :lg_game_num
  end
end

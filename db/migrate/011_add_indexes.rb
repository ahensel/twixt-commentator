class AddIndexes < ActiveRecord::Migration
  def self.up
    add_index :comments, :game_id
    add_index :users, :id
  end

  def self.down
    remove_index :comments, :game_id
    remove_index :users, :id
  end
end

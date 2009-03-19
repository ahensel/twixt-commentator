class MainPageColumnsForGames < ActiveRecord::Migration
  def self.up
    add_column :games, :last_commented_on, :datetime
  end

  def self.down
    remove_column :games, :last_commented_on
  end
end

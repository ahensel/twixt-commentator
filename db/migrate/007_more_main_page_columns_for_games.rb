class MoreMainPageColumnsForGames < ActiveRecord::Migration
  def self.up
    add_column :games, :last_commented_by, :integer
  end

  def self.down
    remove_column :games, :last_commented_by
  end
end

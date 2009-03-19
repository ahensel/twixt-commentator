class CreateComments < ActiveRecord::Migration
  def self.up
    create_table :comments do |t|
      t.column :comment, :text
      t.column :game_id, :integer
      t.column :created_on, :datetime
    end
  end

  def self.down
    drop_table :comments
  end
end

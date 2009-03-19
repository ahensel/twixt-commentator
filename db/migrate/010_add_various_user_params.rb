class AddVariousUserParams < ActiveRecord::Migration
  def self.up
    add_column :users, :created_on, :datetime
    add_column :users, :on_lg, :boolean
    add_column :users, :name_on_lg, :string
    add_column :users, :info, :text
    
    User.update_all("created_on = '2007-06-23', on_lg=1, name_on_lg = name")
    
  end

  def self.down
    remove_column :users, :created_on
    remove_column :users, :on_lg
    remove_column :users, :name_on_lg
    remove_column :users, :info
  end
end

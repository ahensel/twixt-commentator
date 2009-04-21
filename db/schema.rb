# This file is auto-generated from the current state of the database. Instead of editing this file, 
# please use the migrations feature of Active Record to incrementally modify your database, and
# then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your database schema. If you need
# to create the application database on another system, you should be using db:schema:load, not running
# all the migrations from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended to check this file into your version control system.

ActiveRecord::Schema.define(:version => 11) do

  create_table "comments", :force => true do |t|
    t.text     "comment"
    t.integer  "game_id"
    t.datetime "created_on"
    t.integer  "user_id"
  end

  create_table "games", :force => true do |t|
    t.integer  "lg_game_num"
    t.string   "result",            :limit => 1
    t.text     "lg_data"
    t.datetime "created_on"
    t.datetime "last_commented_on"
    t.integer  "last_commented_by"
    t.string   "player1"
    t.string   "player2"
    t.integer  "winner"
    t.string   "tournament"
  end

  add_index "games", ["lg_game_num"], :name => "index_games_on_lg_game_num", :unique => true

  create_table "schema_info", :id => false, :force => true do |t|
    t.integer "version"
  end

  create_table "temp_comment", :force => true do |t|
    t.text "comment"
  end

  create_table "users", :force => true do |t|
    t.string   "name"
    t.string   "hashed_password"
    t.string   "salt"
    t.datetime "created_on"
    t.boolean  "on_lg"
    t.string   "name_on_lg"
    t.text     "info"
  end

end

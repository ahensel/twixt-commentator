require 'LittleGolemParser'

class AddTourneyToGame < ActiveRecord::Migration
  def self.up
    add_column :games, :tournament, :string

    for game in Game.find(:all)
      parser = LittleGolemParser.new(game.lg_data)
      Game.update(game.id,
        :tournament => parser.getTournament
      )
    end
  end

  def self.down
    remove_column :games, :tournament
  end
end

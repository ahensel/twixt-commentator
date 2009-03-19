require 'LittleGolemParser'

class PlayerNamesInGamesTable < ActiveRecord::Migration
  def self.up
    
    add_column :games, :player1, :string
    add_column :games, :player2, :string
    add_column :games, :winner, :integer
    
    for game in Game.find(:all)
      parser = LittleGolemParser.new(game.lg_data)
      if game.result == 'F'
        parser.forfeit
      end
      Game.update(game.id,
        :player1 => parser.getPlayer1,
        :player2 => parser.getPlayer2,
        :winner => parser.getTwixtBoard.hasWonPlayer(1)? 1:
                   parser.getTwixtBoard.hasWonPlayer(2)? 2: 0
      )
    end
  end

  def self.down
    remove_column :games, :player1
    remove_column :games, :player2
    remove_column :games, :winner
  end
end

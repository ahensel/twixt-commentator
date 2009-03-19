require 'JTwixtFormatter'
require 'LittleGolemParser'

class JtwixtController < ApplicationController
  def gen
    game = Game.find(:first, :conditions => ["lg_game_num = ?", params[:gameid]])
    
    file_data = jTwixtFileData(game)
    file_name = "game#{params[:gameid]}.tgt"
    
    send_data(file_data, :filename => file_name, :type => "application/octet-stream")
  end

private
  
  def jTwixtFileData(game)
    parser = LittleGolemParser.new(game.lg_data)
    jtwixt = JTwixtFormatter.new

    jtwixtFileData = jtwixt.formatStandardTwixtHeader(game.player1, game.player2)
    parser.forEachMoveForJtwixt { |x, y, player|
      jtwixtFileData += jtwixt.formatShortMove(x, y, player)
    }

    return jtwixtFileData + jtwixt.format2byteInt(0)
  end
  
end

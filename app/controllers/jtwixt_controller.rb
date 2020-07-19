require 'net/https'
require 'JTwixtFormatter'
require 'LittleGolemParser'

class JtwixtController < ApplicationController
  def gen
    game_id = params[:gameid]
    game = Game.find(:first, :conditions => ["lg_game_num = ?", game_id]) || getGameFromLittleGolem(game_id)

    if (game)
      file_data = jTwixtFileData(game)
      file_name = "game#{game_id}.tgt"
    
      send_data(file_data, :filename => file_name, :type => "application/octet-stream")
    end
  end

private
  #refactor: this is remarkably similar to code in game_controller...
  def getGameFromLittleGolem(game_number)
    http_connection = Net::HTTP::new('www.littlegolem.net', 443)
    http_connection.use_ssl = true
    lg_response, lg_data = http_connection.get("/jsp/game/png.jsp?gid=#{game_number}&#{rand.to_s}")
    
    if lg_response.code != '200' || lg_data == nil || lg_data.strip == ''
      return nil  # HTML error
    else
      lg_data = lg_data.strip

      if lg_data.index('SZ[24]') == nil
        return nil  # not a Twixt game
      end
      
      parser = LittleGolemParser.new(lg_data)
      
      return Game.new(
        :lg_game_num => game_number,
        :lg_data => lg_data,
        :result => '?',
        :player1 => parser.getPlayer1,
        :player2 => parser.getPlayer2,
        :winner => 0,
        :tournament => parser.getTournament
      )
    end
  end
  
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

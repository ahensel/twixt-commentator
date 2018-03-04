require 'net/http'
#require 'iconv'
require 'LittleGolemParser'

class GameController < ApplicationController
  def index
    if request.post?
      redirect_to :controller => 'game', :gid => params[:new_gid]
    end
    
    @parser = nil
    flash[:error] = nil
    
    game_number = getGameNumber
    return if !game_number
    
    @game = Game.find(:first, :conditions => ["lg_game_num = ?", game_number])
    if @game
      lg_data = @game.lg_data
      @parser = LittleGolemParser.new(lg_data)
      if @game.is_forfeit
        @parser.forfeit
      end
    else
      @game = getGameFromLittleGolem(game_number)  # @parser is set up, and @game enters database, as side effects of this.
    end
  end

private

  def getGameFromLittleGolem(game_number)
    http_connection = Net::HTTP::new('www.littlegolem.net')
    lg_response, lg_data = http_connection.get("/jsp/game/png.jsp?gid=#{game_number}&#{rand.to_s}")

    if lg_response.code == '500'
      flash[:error] = "Game #{game_number} does not exist."
      return nil
    elsif lg_response.code != '200'
      flash[:error] = "HTTP error #{lg_response.code} trying to get game #{game_number}."
      return nil
    else
      # LG data is delivered in ISO-8859-1 encoding.
      # Convert data immediately to UTF-8, because RoR works with UTF-8.
#      conv = Iconv.new('utf-8', 'iso-8859-1')
#      lg_data = conv.iconv(lg_data.strip)
      lg_data = lg_data.strip

      if lg_data.index('SZ[24]') == nil
        flash[:error] = "Game #{game_number} is not a Twixt game."
        return nil
      end
      
      @parser = LittleGolemParser.new(lg_data)
      
      if !@parser.isGameOver   # resign, loss, or draw
        # Could still be a forfeit. Scrape the HTML to find out.
        lg_response, html_data = http_connection.get("/jsp/game/game.jsp?gid=#{game_number}&#{rand.to_s}")

        if lg_response.code != '200'
          @parser = nil
          flash[:error] = "HTTP error #{lg_response.code} trying to determine whether game #{game_number}" + 
            " is a forfeit, or still in progress."
          return nil
        else
          if (html_data.index("game finished") != nil)

             @parser.forfeit
             # game is a forfeit 
             # TODO: might want to double-check that - potential rare race condition.
          else
            # @parser = nil
            # flash[:error] = "Twixt Game #{game_number} is still in progress."
            # return nil
            return Game.new(
              :lg_game_num => game_number,
              :lg_data => lg_data,
              :result => '?',
              :player1 => @parser.getPlayer1,
              :player2 => @parser.getPlayer2,
              :winner => 0,
              :tournament => @parser.getTournament
            )
          end
        end
      end

      Game.create(
        :lg_game_num => game_number,
        :lg_data => lg_data,
        :result => @parser.getResultChar,
        :player1 => @parser.getPlayer1,
        :player2 => @parser.getPlayer2,
        :winner => @parser.getTwixtBoard.hasWonPlayer(1)? 1:
                   @parser.getTwixtBoard.hasWonPlayer(2)? 2: 0,
        :tournament => @parser.getTournament
      )
    end
  end

  def getGameNumber
    game_num_str = params[:gid]
    if game_num_str == nil
      return nil
    end
    
    game_number = nil
    
    begin
      game_number = Integer(game_num_str)
    rescue
      flash[:error] = "#{game_num_str} is not an integer."
      return nil
    end
    
    if game_number < 0
      flash[:error] = "#{game_number} is not a positive integer."
      return nil
    elsif game_number < 37491
      flash[:error] = "Game #{game_number} is not a Twixt game."
      return nil
    end
    
    return game_number
  end
end

class RssFeedController < ApplicationController
  session :off
  layout :except => :rss
  
  def all_comments
    @comments = Comment.find(:all, :order => "created_on DESC", :limit => 20)
    response.headers["Content-Type"] = "application/rss+xml"
  end
  
  def show
    comment = Comment.find(params[:id])
    redirect_to "/game/#{comment.game.lg_game_num}"
  end
end

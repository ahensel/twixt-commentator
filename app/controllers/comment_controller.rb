class CommentController < ApplicationController
  def index
    if !session[:user_id]
      return  # really, we mean it, no faking out the controller if you're not logged in
    end
    
    comment = params[:new_comment]
    comment.strip!
        
    if params[:button_pressed] == 'Preview'
      @comment = Comment.new(
        :game_id => params[:game],
        :comment => comment,
        :user_id => session[:user_id],
        :created_on => DateTime.now)
      @preview = true
    elsif comment.length > 0
      @comment = Comment.create(
        :game_id => params[:game],
        :comment => comment,
        :user_id => session[:user_id],
        :created_on => DateTime.now)
        
      Game.update(params[:game],
        :last_commented_on => @comment.created_on,
        :last_commented_by => session[:user_id])
    end
  end
end

class UserController < ApplicationController
  layout 'admin'

  def go_back
    redirect_to :controller => params[:back_to], :gid => params[:ret_gid], :page => params[:main_page]
  end
  
  def add_user
    @user = User.new(params[:user])
    if request.post? and @user.save
      
      session[:user_id] = @user.id  # auto-login after registration
      
      flash.now[:notice] = "User #{@user.name} created"
      @user = User.new
      go_back
    end
  end

  def login
    session[:user_id] = nil
    
    user = User.authenticate(params[:name], params[:password])
    if user
      session[:user_id] = user.id
    else
      flash[:login_notice] = 'Invalid Name or Password'
    end
    go_back
  end

  def logout
    session[:user_id] = nil
    go_back
  end

  def info
    @user = User.find(params[:id])
  end
  
  def profile
    @user = User.find(params[:id])

    if request.post? and @user.update_attributes(params[:user])
      flash.now[:notice] = "Your profile has been updated"

      go_back
    end
  end

  def index
  end
end

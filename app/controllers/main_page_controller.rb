require 'will_paginate'

class MainPageController < ApplicationController
  def index
    @commented_games =
      Game.paginate(:page => params[:page],
        :per_page => 20,
        :order => 'last_commented_on DESC',
        :conditions => ['last_commented_on is not null'])
  end
end

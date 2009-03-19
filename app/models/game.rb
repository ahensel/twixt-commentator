class Game < ActiveRecord::Base
  has_many :comments
  
  def winner_name
    (winner !=2)? player1 : player2
  end
  
  def loser_name
    (winner == 2)? player1 : player2
  end
  
  def is_draw
    result == 'D'
  end
  
  def is_resignation
    result == 'R'
  end
  
  def is_forfeit
    result == 'F'
  end
  
  def is_loss
    result == 'L'
  end
  
  def is_in_progress
    result == '?'
  end
end

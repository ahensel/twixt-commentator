class AbstractMove
  attr_accessor :player
  attr_accessor :type
  
  def color
    (player == 1)? :white :
    (player == 2)? :black : nil
  end
end

class Move < AbstractMove
  Peg = 1
  Swap = 2
  Resign = 3
  Draw = 4
  Forfeit = 5
  Lost = 6
  
  attr_accessor :x
  attr_accessor :y

  def initialize(x, y, player)
    @x = x
    @y = y
    @player = player
    @type = Peg
  end
  
  def text
    letters = "abcdefghijklmnopqrstuvwxyz"
    letters[@x..@x] + String(@y + 1)
  end
end

class SwapMove < AbstractMove
  def initialize(player)
    @player = player
    @type = Move::Swap
  end

  def text
    "swap"
  end
end

class ResignMove < AbstractMove
  def initialize(player)
    @player = player
    @type = Move::Resign
  end

  def text
    "resign"
  end
end

class DrawMove < AbstractMove
  def initialize(player)
    @player = player
    @type = Move::Draw
  end
  
  def text
    "draw"
  end
end

class ForfeitMove < AbstractMove
  def initialize(player)
    @player = player
    @type = Move::Forfeit
  end

  def text
    "forfeit"
  end
end

class LostMove < AbstractMove
  def initialize(player)
    @player = player
    @type = Move::Lost
  end

  def text
    "lost"
  end
end

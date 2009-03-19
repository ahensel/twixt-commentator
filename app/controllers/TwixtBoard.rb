require 'Move'

class TwixtBoard

  def initialize(width, height)
    @width = width
    @height = height
    @swapped = false
    @draw = false
    @moves = Array.new
    @board = Array.new(width).collect {|a| Array.new(height, nil)}
  end

  def isPegAt(x, y)
    return (x >= 0 and x < @width and y >= 0 and y < @height and @board[x][y] != nil)
  end

  def getColor(x,y)
    if isPegAt(x,y)
      peg = @board[x][y]
      return peg.color
    end
    return nil
  end

  def isValidSpot(x,y,color)
    return (((color == :white and (x > 0 and x < (@width - 1))) or
             (color == :black and (y > 0 and y < (@height - 1)))) and
             @board[x][y] == nil)
  end

  def play(move)
    if move.type == Move::Peg
      setPegAndLink(move.x, move.y, move.color)
    elsif move.type == Move::Swap
      swap
    elsif move.type == Move::Resign
      resign(move.color)
    elsif move.type == Move::Forfeit
      forfeit(move.color)
    elsif move.type == Move::Draw
      draw
    end
    @moves << move
  end

  def getMove(n)
    return @moves[n]
  end

  def setPeg(x,y,color)
    if isValidSpot(x,y,color)
      @board[x][y] = Peg.new(color)
    end
  end

  def setPegAndLink(x,y,color)
    if isValidSpot(x,y,color)
      @board[x][y] = Peg.new(color)

      forEachKnightNeighbor {|dx, dy|
        link(x, y, x + dx, y + dy)
      }
    end
  end
  
  def removePeg(x,y)
    forEachKnightNeighbor {|dx, dy|
      unlink(x, y, x + dx, y + dy)
    }
    @board[x][y] = nil
  end

  def swap
    @swapped = true
  end

  def resign(color)
    @resignation = color
  end

  def forfeit(color)
    @forfeit = color
  end

  def draw
    @draw = true
  end

  def isSwapped
    return @swapped
  end

  def isDraw
    return @draw
  end

  def isForfeit
    return (@forfeit != nil)
  end

  def setPlayer(num, name)
    if num == 1
      @player1 = name
    elsif num == 2
      @player2 = name
    end
  end

  def getPlayerName(num)
    if num == 1
      return @player1
    elsif num == 2
      return @player2
    end
    return nil
  end

  def isLinkDistance(dx, dy)
    return ((dx * dy).abs == 2)
  end

  def canLink(x1, y1, x2, y2)
    return (isPegAt(x1, y1) and isPegAt(x2, y2) and
            getColor(x1, y1) == getColor(x2, y2) and
            isLinkDistance(x1 - x2, y1 - y2) and
            !crossesExistingLink(x1, y1, x2, y2))
  end

  def crossesExistingLink(x1, y1, x2, y2)
    # Any crossing link has an endpoint in the (2,3) block that the link is in.
    minX, maxX = (x1 < x2)? [x1,x2] : [x2,x1]
    minY, maxY = (y1 < y2)? [y1,y2] : [y2,y1]

    # TwixtPP rule: equal colors are allowed to cross.
    relevantColor = (@board[x1][y1]).color

    # Loop thru all 6,
    for x in (minX .. maxX)
      for y in (minY .. maxY)
        if @board[x][y] != nil and @board[x][y].color != relevantColor and crossesPegsLinks(x, y, x1, y1, x2, y2)
          return true
        end
      end
    end
    return false
  end

  def crossesPegsLinks(x, y, x1, y1, x2, y2)
    peg = @board[x][y]
    if peg != nil
      # if there's a peg there, test every link it's got.
      forEachKnightNeighbor {|dx,dy|
        if peg.hasLink(dx, dy) and doLinksCross(x1, y1, x2, y2, x, y, x + dx, y + dy)
          return true
        end
      }
    end
    return false
  end

  def doLinksCross(x1, y1, x2, y2, x3, y3, x4, y4)
    # Does (x1,y1)--(x2,y2) cross with (x3,y3)--(x4,y4)?
    # First, get the distance between the link centers,
    # times 2 to keep this in integer math.
    distX = (x1 + x2 - x3 - x4).abs
    distY = (y1 + y2 - y3 - y4).abs

    return (distX + distY < 3 and
             (distX == distY or
               (y2 - y1) * (x2 - x1) * (y4 - y3) * (x4 - x3) < 0))
  end

  def link(x1, y1, x2, y2)
    if canLink(x1, y1, x2, y2)
      peg1 = @board[x1][y1]
      peg2 = @board[x2][y2]

      peg1.setLink(x2 - x1, y2 - y1)
      peg2.setLink(x1 - x2, y1 - y2)
    end
  end

  def unlink(x1, y1, x2, y2)
    peg1 = @board[x1][y1]
    peg2 = @board[x2][y2]

    if peg1 != nil and peg2 != nil
      peg1.removeLink(x2 - x1, y2 - y1)
      peg2.removeLink(x1 - x2, y1 - y2)
    end
  end

  def isLinked(x1, y1, x2, y2)
    peg = @board[x1][y1]
    return (peg != nil and
            peg.hasLink(x2 - x1, y2 - y1))
  end
  
  def forEachKnightNeighbor
    for dx, dy in [[-1, -2], [-2, -1], [ 1, -2], [ 2, -1],
                   [-2,  1], [-1,  2], [ 2,  1], [ 1,  2]]
      yield dx, dy
    end
  end

  def searchForEdge(indexBoard, x, y, color, index)
    if ((color == :white and y == @height-1) or
        (color == :black and x == @width-1))
      return true
    end

    indexBoard[x][y] = index
    peg = @board[x][y]
    forEachKnightNeighbor {|dx, dy|
      if peg.hasLink(dx,dy) and indexBoard[x + dx][y + dy] == nil and
         searchForEdge(indexBoard, x + dx, y + dy, color, index)
        return true
      end
    }
    return false
  end

  def forStartEdge(color)
    if color == :white
      for x in 0..@width-1
        yield x, 0
      end
    elsif color == :black
      for y in 0..@height-1
        yield 0, y
      end
    end
  end

  def winner
    hasWonPlayer(1)? 1 :
    hasWonPlayer(2)? 2 :
    (isDraw)?        0 : nil
  end

  def colorOfPlayer(num)
    ((num == 1) ^ isSwapped)? :white : :black
  end

  def hasWonPlayer(num)
    hasWonColor(colorOfPlayer(num))
  end

  def hasConnectedPlayer(num)
    hasConnectedColor(colorOfPlayer(num))
  end

  def isResignation
    @resignation != nil
  end

  def hasWonColor(color)
    if @resignation != nil
      return (@resignation != color)
    elsif @forfeit != nil
      return (@forfeit != color)
    elsif @draw
      return false
    else
      return hasConnectedColor(color)
    end
  end
  
  def hasConnectedColor(color)
    indexBoard = Array.new(@width).collect {|a| Array.new(@height, nil)}
    index = 0
    forStartEdge(color) { |x, y|
      if getColor(x, y) == color and indexBoard[x][y] == nil
        index += 1
        if searchForEdge(indexBoard, x, y, color, index)
          return true
        end
      end
    }
    return false
  end
end

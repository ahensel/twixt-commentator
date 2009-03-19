#!/usr/bin/ruby
require 'TwixtBoard'
require 'Peg'
require 'Move'

class LittleGolemParser
  def initialize(game)
    @game = game
  end

  def getPlayer1
    p = @game.scan(/PB\[[^\]]*\]/)[0]
    return p[3..(p.length - 2)]
  end

  def getPlayer2
    p = @game.scan(/PW\[[^\]]*\]/)[0]
    return p[3..(p.length - 2)]
  end
  
  def getTournament
    p = @game.scan(/EV\[[^\]]*\]/)[0]
    tourney = p[3..(p.length - 2)]
    return (tourney == 'null')? '': tourney
  end

  def getMoves
    moves = @game.scan(/[br]\[[^\]]*\]/)
  end

  def getWinner
    p = @game.scan(/[br]\[resign\]/)[0]
    if p == nil
      return nil
    else
      return " rb".index(p[0])
    end
  end

  def forEachMove
    letters=" abcdefghijklmnopqrstuvwx"
    moves = getMoves
    swapped = false

    # swap rule
    if moves.length > 1 and moves[1] == "r[swap]"
       move = moves[0]
       x = letters.index(move[2]) - 1
       y = letters.index(move[3]) - 1
       yield Move.new(x, y, 1)  # place white peg
       yield SwapMove.new(2) # player 2 swaps
       moves.delete_at(1)  # remove the swap move
       moves.delete_at(0)  # remove the first move
       swapped = true
    end

    player = 1
    # the rest of the moves
    for move in moves
      if swapped
        player = " rb".index(move[0])
      else
        player = " br".index(move[0])
      end
      
      if move.length == 5 or move[4..9] == "|draw]"
        x = letters.index(move[2]) - 1
        y = letters.index(move[3]) - 1
        if swapped
          yield Move.new(y, x, player)
        else
          yield Move.new(x, y, player)
        end
      elsif move[1..8] == "[resign]"
        yield ResignMove.new(player)
      elsif move[1..6] == "[draw]"
        yield DrawMove.new(player)
      end
    end

    if @forfeit
      yield ForfeitMove.new(3 - player)
    end
  end

  def getTwixtBoard
    board = TwixtBoard.new(24, 24)

    board.setPlayer(1, getPlayer1)
    board.setPlayer(2, getPlayer2)

    forEachMove { |move|
      board.play(move)
    }
    
    board
  end
  
  def isGameOver
    board = getTwixtBoard
    board.isDraw | board.hasWonColor(:white) | board.hasWonColor(:black)
  end

  def isGameLostOnMoves
    board = getTwixtBoard
    board.hasConnectedColor(:white) | board.hasConnectedColor(:black)
  end

  # much simpler parser -- keeps the swap move in there, keeps LG conventions of swapped boards.
  def forEachLittleGolemMove
    letters=" abcdefghijklmnopqrstuvwx"
    moves = getMoves

    player = 1
    for move in moves
      player = " br".index(move[0])

      if move.length == 5 or move[4..9] == "|draw]"
        x = letters.index(move[2])
        y = letters.index(move[3])
        yield Move.new(x, y, player)
      elsif move[1..8] == "[resign]"
        yield ResignMove.new(player)
      elsif move[1..6] == "[draw]"
        yield DrawMove.new(player)
      elsif move == "r[swap]"
        yield SwapMove.new(player)
      end
    end
    if (@forfeit)
      yield ForfeitMove.new(3 - player)
    elsif (isGameLostOnMoves)
      yield LostMove.new(3 - player)
    end
  end

  def getMovesList
    moves = []
    forEachLittleGolemMove { |move| moves << move }
    moves
  end
  
  def forfeit
    @forfeit = true
  end
  
  def getResultChar
    board = getTwixtBoard
    
    (board.isResignation)? 'R':
    (board.hasConnectedColor(:white) | board.hasConnectedColor(:black))? 'L':
    (board.isDraw)? 'D':
    (@forfeit)? 'F':
    '?'
  end
  
  
  def forEachMoveForJtwixt
    letters=" abcdefghijklmnopqrstuvwx"
    moves = getMoves

    # swap rule
    if moves.length > 1 and moves[1] == "r[swap]"
      move = moves[0]
      x = letters.index(move[3])
      y = letters.index(move[2])
      yield x, y, 1       # place white peg first so Jtwixt doesn't get confused
      yield x, y, 2       # then put black peg right on top of it.
      moves.delete_at(1)  # remove the swap move
      moves.delete_at(0)  # remove the first move
    end

    # the rest of the moves
    for move in moves
      if move.length > 4 and (move[4..4] == "]" or move[4..4] == "|") 
        player = " br".index(move[0])
        x = letters.index(move[2])
        y = letters.index(move[3])
        yield x, y, player
      end
    end
  end
end

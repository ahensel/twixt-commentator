# Methods added to this helper will be available to all templates in the application.
module ApplicationHelper
  # user names should obey entities, but escape everything else.
  def h2(html)
    html.gsub(/</, "&lt;").gsub(/>/, "&gt;")
  end
  
  def xssize(html)
    html = sanitize(html)
    hiliteTwixtMoves!(html)
    html.gsub(/\n/, '<br/>')
  end
  
  def hiliteTwixtMoves!(html)
    # regular expression parts:
    actionMove = '[a-xA-X](2[0-4]|1\d|[1-9])\**|swap'
    endMove = 'resign|draw|forfeit|lost'
    m = "(#{actionMove}|#{endMove}|\\?+)"
    dot = '\.\s?'
    nm = '[1-9]\d*' + dot + m      # a numbered move, like 12.m7
    oddm = '\d*[13579]' + dot + m  # an odd-numbered move
    seq = "#{nm}(\\s+#{nm})*"       # a sequence of numbered moves
    bracketed = "\\[\\s*#{seq}\\s*\\]"
    pre = "(\\|\\s*)?(#{bracketed}\\s*)?"  # the | or [ moves ] prefix to a sequence of moves
    
    # substitutions:
    html.gsub!(/#{pre}#{seq}/) {|moves|
      moveArray = []
      firstMoveNum = nil
      jumpMethod = (moves.starts_with?('|') || moves.starts_with?('['))? 'cJumpMain' : 'cJump'
      
      moves.gsub!(/#{bracketed}/) { |bracketedMoves|
        bracketedMoves.gsub!(/#{nm}/) {|move|
          moveNum, moveText = move.split(/#{dot}/)
          moveArray << (moveText.split('*')[0]) if (moveText =~ /#{actionMove}/)
          firstMoveNum = moveNum if firstMoveNum == nil
        }
      }
      
      moves.gsub!(/#{nm}/) {|move|
        color = (move =~ /#{oddm}/)? 'white' : 'black'
        moveNum, moveText = move.split(/#{dot}/)
        moveArray << (moveText.split('*')[0]) if (moveText =~ /#{actionMove}/)
        firstMoveNum = moveNum if firstMoveNum == nil

        "<a href='' class='#{color}' onclick='#{jumpMethod}(#{firstMoveNum}, #{moveArray.to_json}); return false;'>#{move}</a>"
      }
      if moves.starts_with?('|')
        "|<span class='moves'>#{moves[1..moves.length]}</span>"
      elsif moves.starts_with?('[')
        closeBracket = moves.index("\]") + 1
        shownMoves = moves[closeBracket .. moves.length]
        "[]<span class='moves'>#{shownMoves}</span>"
      else
        "<span class='moves'>#{moves}</span>"
      end
    }
      
  end
end

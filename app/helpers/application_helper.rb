# Methods added to this helper will be available to all templates in the application.
module ApplicationHelper
  # user names should obey entities, but escape everything else.
  def h2(html)
    html.gsub(/</, "&lt;").gsub(/>/, "&gt;")
  end
  
  def xssize(html)
    html = sanitize(html)
    html.gsub(/\n/, '<br/>')
  end

  def prepare_comment(html)
    html = sanitize(html)
    html = hilite_twixt_moves(html)
    html.gsub(/\n/, '<br/>')
  end
  
  def hilite_twixt_moves(html)
    # regular expression parts:
    action_move = '[a-xA-X](2[0-4]|1\d|[1-9])\**|swap'
    end_move = 'resign|draw|forfeit|lost'
    m = "(#{action_move}|#{end_move}|\\?+)"
    dot = '\.\s?'
    nm = '[1-9]\d*' + dot + m      # a numbered move, like 12.m7
    oddm = '\d*[13579]' + dot + m  # an odd-numbered move
    seq = "#{nm}(\\s+#{nm})*"      # a sequence of numbered moves
    pre = "(\\|\\s*)?"  # the | prefix to a sequence of moves
    
    move_array = []
    first_move_num = nil
    last_move_num = 0
    
    # substitutions:
    html.gsub(/#{pre}#{seq}/) {|moves|
      jump_method = (moves.starts_with?('|'))? 'cJumpMain' : 'cJump'
      
      moves.gsub!(/#{nm}/) {|move|
        color = (move =~ /#{oddm}/)? 'white' : 'black'
        move_num, move_text = move.split(/#{dot}/)
        move_num = move_num.to_i
        if move_text =~ /#{action_move}/
          move_offset = last_move_num + 1 - move_num
          if move_offset < 0 || move_offset > move_array.size
            move_array = []
            first_move_num = move_num
          elsif move_offset > 0
            move_array.pop(move_offset)
          end
          move_array << (move_text.split('*')[0])
          last_move_num = move_num
        end
        first_move_num = move_num if first_move_num == nil

        "<a href='' class='#{color}' onclick='#{jump_method}(#{first_move_num}, #{move_array.to_json}); return false;'>#{move}</a>"
      }

      if moves.starts_with?('|')
        "|<span class='moves'>#{moves[1..moves.length]}</span>"
      else
        "<span class='moves'>#{moves}</span>"
      end
    }
  end
end

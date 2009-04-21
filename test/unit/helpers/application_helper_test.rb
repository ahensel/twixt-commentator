require File.dirname(__FILE__) + '/../../test_helper'

class ApplicationHelperTest < ActionView::TestCase
  def test_hilite_twixt_moves
    assert_equal "no moves", hilite_twixt_moves("no moves")
    
    assert_equal "<span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\"]); return false;'>1.f3</a></span>", 
      hilite_twixt_moves("1.f3")
      
    assert_equal "<span class='moves'><a href='' class='black' onclick='cJump(2, [\"j10\"]); return false;'>2.j10</a></span>", 
      hilite_twixt_moves("2.j10")
    
    # intervening text is unaffected
    assert_equal "text <span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\"]); return false;'>1.f3</a> <a href='' class='black' onclick='cJump(1, [\"f3\", \"j10\"]); return false;'>2.j10</a></span> more text", 
      hilite_twixt_moves("text 1.f3 2.j10 more text")
    
    # vertical bar | signifies start from main line
    assert_equal "text |<span class='moves'><a href='' class='white' onclick='cJumpMain(1, [\"f3\"]); return false;'>1.f3</a> <a href='' class='black' onclick='cJumpMain(1, [\"f3\", \"j10\"]); return false;'>2.j10</a></span> more text",
      hilite_twixt_moves("text |1.f3 2.j10 more text")
      
    # numbering break signifies a break in the sequence: jumps ahead mean reset
    assert_equal "text <span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\"]); return false;'>1.f3</a> <a href='' class='white' onclick='cJump(3, [\"j10\"]); return false;'>3.j10</a></span> more text", 
      hilite_twixt_moves("text 1.f3 3.j10 more text")
      
    # numbering break signifies a break in the sequence: jumps back mean rewind
    assert_equal "<span class='moves'><a href='' class='white' onclick='cJump(5, [\"f3\"]); return false;'>5.f3</a> <a href='' class='black' onclick='cJump(5, [\"f3\", \"j10\"]); return false;'>6.j10</a>\n<a href='' class='white' onclick='cJump(5, [\"f3\", \"j10\", \"g17\"]); return false;'>7.g17</a>\n<a href='' class='white' onclick='cJump(5, [\"f3\", \"j10\", \"g18\"]); return false;'>7.g18</a></span>", 
      hilite_twixt_moves("5.f3 6.j10\n7.g17\n7.g18")
      
    # numbering break signifies a break in the sequence: jumps back too far mean reset
    assert_equal "<span class='moves'><a href='' class='white' onclick='cJump(5, [\"f3\"]); return false;'>5.f3</a> <a href='' class='black' onclick='cJump(5, [\"f3\", \"j10\"]); return false;'>6.j10</a>\n<a href='' class='black' onclick='cJump(2, [\"g17\"]); return false;'>2.g17</a></span>", 
      hilite_twixt_moves("5.f3 6.j10\n2.g17")

    # remove bracket notation - I hate to remove stuff, but you know, it just isn't used anymore, and it's too confusing
    assert_equal "[<span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\"]); return false;'>1.f3</a> <a href='' class='black' onclick='cJump(1, [\"f3\", \"j10\"]); return false;'>2.j10</a></span>] <span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\", \"j10\", \"g17\"]); return false;'>3.g17</a></span>", 
      hilite_twixt_moves("[1.f3 2.j10] 3.g17")
    # brackets have been used in comments in games 534505, 605397, 667535, 730990, 731017, 731033, 795274, 826288, 853459

    # intervening text will not interrupt lines
    assert_equal "so <span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\"]); return false;'>1.f3</a> <a href='' class='black' onclick='cJump(1, [\"f3\", \"j10\"]); return false;'>2.j10</a></span> and then <span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\", \"j10\", \"p12\"]); return false;'>3.p12</a></span>.", 
      hilite_twixt_moves("so 1.f3 2.j10 and then 3.p12.")

    # catch a bug?
    assert_equal "so <span class='moves'><a href='' class='white' onclick='cJump(1, [\"f3\"]); return false;'>1.f3</a> <a href='' class='black' onclick='cJump(1, [\"f3\", \"j10\"]); return false;'>2.j10</a></span> and also <span class='moves'><a href='' class='white' onclick='cJump(1, [\"e3\"]); return false;'>1.e3</a> <a href='' class='black' onclick='cJump(1, [\"e3\", \"j10\"]); return false;'>2.j10</a></span>.", 
      hilite_twixt_moves("so 1.f3 2.j10 and also 1.e3 2.j10.")

    
    # proposal:
    #   parenthetical expression following move sequence defines a name for the branch
    #   bracketed expression preceding a move sequence brings it to that branch
    #   Keep these sequence definitions from previous comments
    # assert_equal "|<span class='moves'><a href='' class='black' onclick='cJump(4, [\"p15\"]); return false;'>4.p15</a> <a href='' class='white' onclick='cJump(5, [\"p15\", \"r16\"]); return false;'>5.r16</a> <span class='def_variation'>(var 1)</span>, and then [var 1] 6.q16, or [var 1] 5.r17 6.q16",
    #   hilite_twixt_moves("|4.p15 5.r16 (var 1), and then [var 1] 6.q16, or [var 1] 5.r17 6.q16")
    
    # proposal:
    #   move ## becomes a link to that move in the main line.
    #   [var 1] move ## becomes a link to that move in the variation.
    
    # proposal:
    #   unnumbered moves give at least a little hover help
    
  end
end
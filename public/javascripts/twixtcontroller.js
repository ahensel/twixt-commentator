// TwixtController records actions and keeps track of things in terms of "moves" (gets interesting when there's link removal)
function TwixtController(size)
{
  this.board = new TwixtBoard(size)
  this.move = new Move()
  this.dx = [ 1,  2, 2, 1, -1, -2, -2, -1]
  this.dy = [-2, -1, 1, 2,  2,  1, -1, -2]

  this.isLinkable = function(x, y) {
    var peg = this.board.getPeg(x, y)
    if (peg == null) return false

    for (var i=0; i<8; i++) {
      if (!peg.hasLink(this.dx[i], this.dy[i]) && this.canLink(x, y, x + this.dx[i], y + this.dy[i])) {
        return true
      }
    }
    return false
  }

  this.removeLink = function(link) {
    this.move.removeLink(link)
  }
  
  this.addLinksTo = function(peg, isNew) {
    for (var i=0; i<8; i++) {
      this.link(peg.x, peg.y, peg.x + this.dx[i], peg.y + this.dy[i], isNew)
    }
  }

  this.link = function(x1, y1, x2, y2, isNew) {
    if (this.canLink(x1, y1, x2, y2)) {
      var peg1 = this.board.board[x1][y1]
      var peg2 = this.board.board[x2][y2]
      if (!peg1.hasLink(x2 - x1, y2 - y1)) {
        var link = new Link(peg1, peg2)
        if (!isNew) this.move.addLink(link) // new peg's links are implicit
      }
    }
  }
  
  this.canLink = function(x1, y1, x2, y2) {
    var peg1 = this.board.getPeg(x1, y1)
    var peg2 = this.board.getPeg(x2, y2)
    return (peg1 != null && peg2 != null && peg1.color == peg2.color &&
      !this.crossesExistingLink(x1, y1, x2, y2))
  }
  
  this.crossesExistingLink = function(x1, y1, x2, y2) {
    for (var x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (var y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (!((x==x1 && y==y1) || (x==x2 && y==y2))) {
          if (this.crossesPegsLinks(x, y, x1, y1, x2, y2)) {
            return true
          }
        }
      }
    }
    return false
  }
  
  this.crossesPegsLinks = function(x, y, x1, y1, x2, y2) {
    var peg = this.board.board[x][y]
    if (peg != null) {
      for (var i=0; i<8; i++) {
        var dx = this.dx[i]
        var dy = this.dy[i]
        if (peg.hasLink(dx, dy) && this.doLinksCross(x1, y1, x2, y2, x, y, x+dx, y+dy)) {
          if (linkCrossingPolicy != PENCIL_AND_PAPER) {
            return true
          }
          else if (peg.color != this.board.getPeg(x1, y1).color) {
            return true
          }
        }
      }
    }
    return false
  }
  
  this.doLinksCross = function(x1, y1, x2, y2, x3, y3, x4, y4) {
    var distX = Math.abs(x1 + x2 - x3 - x4)
    var distY = Math.abs(y1 + y2 - y3 - y4)

    return (distX + distY < 3 &&
      (distX == distY ||
        (y2 - y1) * (x2 - x1) * (y4 - y3) * (x4 - x3) < 0))
  }
  
  this.placePeg = function(x, y, color) {
    var peg = new Peg(color, x, y)
    this.board.setPeg(peg)
    this.move.setPeg(peg)
    return peg
  }  
}
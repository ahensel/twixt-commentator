function TwixtMoves()
{
  this.moves = []
  this.userMoves = []
  this.settingUp = false
  this.jumpingTo = false
  
  this.commitMove = function(controller) {
    if (!this.jumpingTo) {
      if (this.settingUp) {
        this.moves.push(controller.move)
      }
      else {
        this.userMoves.push(controller.move)
      }
    }
    controller.move = new Move()
  }
  
  this.swapFirstMove = function() {
    if (this.moves.length == 1) {
      this.moves[0].peg.swapped = true
      this.moves.push(new SwapMove())
    }
  }
  
  this.finalMove = function(move) {
    this.moves.push(move)
  }
  
  this.getMoves = function() {
    return this.moves
  }
  
  this.getUserMoves = function() {
    return this.userMoves
  }
  
  this.hasUserMoves = function() {
    return (this.userMoves.length > 0)
  }
  
  this.popMove = function() {
    return this.userMoves.pop()
  }
  
  this.clearUserMoves = function() {
    this.userMoves = []
  }
}
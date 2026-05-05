class TwixtMoves {
  constructor() {
    this.moves = [];
    this.userMoves = [];
    this.settingUp = false;
    this.jumpingTo = false;
  }

  commitMove(controller) {
    if (!this.jumpingTo) {
      if (this.settingUp) {
        this.moves.push(controller.move);
      } else {
        this.userMoves.push(controller.move);
      }
    }
    controller.move = new EditMove();
  }

  swapFirstMove() {
    if (this.moves.length === 1) {
      this.moves[0].peg.swapped = true;
      this.moves.push(new SwapMove());
    }
  }

  finalMove(move)    { this.moves.push(move); }
  getMoves()         { return this.moves; }
  getUserMoves()     { return this.userMoves; }
  hasUserMoves()     { return this.userMoves.length > 0; }
  popMove()          { return this.userMoves.pop(); }
  clearUserMoves()   { this.userMoves = []; }
}
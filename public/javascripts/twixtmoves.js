class TwixtMoves {
  constructor() {
    this.moves = [];
    this.userMoves = [];
  }

  recordMainline(move) { this.moves.push(move); }
  recordUserMove(move) { this.userMoves.push(move); }

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
  popUserMove()      { return this.userMoves.pop(); }
  clearUserMoves()   { this.userMoves = []; }
  gameIsInProgress() { return !this.moves[this.moves.length - 1]?.isFinalMove; }
}

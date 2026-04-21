class TwixtBoard {
  constructor(size) {
    this.size = size;
    this.board = [];
    for (let i = 1; i <= size; i++) {
      this.board[i] = [];
    }
  }

  isLegalSpot(x, y, color) {
    return (
      (color === 1 && x > 1 && x < this.size && y >= 1 && y <= this.size) ||
      (color === 0 && x >= 1 && x <= this.size && y > 1 && y < this.size)
    );
  }

  setPeg(peg) {
    if (this.board[peg.x][peg.y] == null) {
      this.board[peg.x][peg.y] = peg;
    }
  }

  getPeg(x, y) {
    if (x < 1 || x > this.size || y < 1 || y > this.size) return null;
    if (this.board[x] == null) return null;
    return this.board[x][y];
  }

  getAllPegs() {
    const allPegs = [];
    for (let y = 1; y <= this.size; y++) {
      for (let x = 1; x <= this.size; x++) {
        const peg = this.board[x][y];
        if (peg) allPegs.push(peg);
      }
    }
    return allPegs;
  }
}

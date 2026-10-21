class TwixtBoard {
  static LINK_REMOVAL     = 0;
  static PENCIL_AND_PAPER = 1;

  constructor(size, linkXingPolicy) {
    this.size = size;
    this.linkXingPolicy = linkXingPolicy ?? TwixtBoard.PENCIL_AND_PAPER;
    // 1-based: board[x][y] is valid for x, y in 1..size
    this.board = Array.from({ length: size + 1 }, () => []);
    this.allPegs = [];
  }

  isLegalSpot(x, y, color) {
    return (
      (color === 1 && x > 1 && x < this.size && y >= 1 && y <= this.size) ||
      (color === 0 && x >= 1 && x <= this.size && y > 1 && y < this.size)
    );
  }

  setPeg(peg) {
    if (!this.board[peg.x][peg.y]) {
      this.board[peg.x][peg.y] = peg;
      this.allPegs.push(peg);
    }
  }

  getPeg(x, y) {
    if (x < 1 || x > this.size || y < 1 || y > this.size) return null;
    return this.board[x][y];
  }

  pegCount() {
    return this.allPegs.length;
  }

  getFirstPeg() {
    return this.allPegs[0];
  }
}

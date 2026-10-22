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

  winner() {
    const whiteWon = this._hasConnection(1, (peg) => peg.y < 3, (peg) => peg.y > this.size - 2);
    const blackWon = this._hasConnection(0, (peg) => peg.x < 3, (peg) => peg.x > this.size - 2);
    return whiteWon ? "White" : blackWon ? "Black" : null;
  }

  _hasConnection(color, startSide, endSide) {
    this.allPegs.forEach((peg) => peg._visited = false);
    const visitStack = this.allPegs.filter((peg) => peg.color === color && startSide(peg));
    visitStack.forEach((peg) => peg._visited = true);
    while (visitStack.length > 0) {
      const peg = visitStack.pop();
      for (let link of peg.getLinks()) {
        const linkedPeg = (peg === link.peg1) ? link.peg2 : link.peg1;
        if (endSide(linkedPeg)) {
          return true;
        }
        if (!linkedPeg._visited) {
          linkedPeg._visited = true;
          visitStack.push(linkedPeg);
        }
      }
    }
    return false;
  }

}

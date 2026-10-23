const KNIGHT_MOVES = [
  [ 1, -2], [ 2, -1], [ 2,  1], [ 1,  2],
  [-1,  2], [-2,  1], [-2, -1], [-1, -2],
];

class TwixtBoard {
  static LINK_REMOVAL     = 0;
  static PENCIL_AND_PAPER = 1;

  static WHITE = 1;
  static BLACK = 0;

  constructor(size, linkXingPolicy) {
    this.size = size;
    this.linkXingPolicy = linkXingPolicy ?? TwixtBoard.PENCIL_AND_PAPER;
    // 1-based: board[x][y] is valid for x, y in 1..size
    this.board = Array.from({ length: size + 1 }, () => new Array(size + 1).fill(null));
    this.allPegs = [];
  }

  forEachKnightMove(callback) {
    for (const [dx, dy] of KNIGHT_MOVES) {
      if (callback(dx, dy)) return true;
    }
    return false;
  }

  isLegalSpot(x, y, color) {
    return (
      (color === TwixtBoard.WHITE && x > 1 && x < this.size && y >= 1 && y <= this.size) ||
      (color === TwixtBoard.BLACK && x >= 1 && x <= this.size && y > 1 && y < this.size)
    );
  }

  setPeg(peg) {
    if (this.board[peg.x][peg.y] === null) {
      this.board[peg.x][peg.y] = peg;
      this.allPegs.push(peg);
    }
  }

  getPeg(x, y) {
    if (x < 1 || x > this.size || y < 1 || y > this.size) return null;
    return this.board[x][y];
  }

  isLinkable(x, y) {
    const peg = this.getPeg(x, y);
    if (peg == null) return false;
    return this.forEachKnightMove((dx, dy) => this.canLink(x, y, x + dx, y + dy));
  }

  canLink(x1, y1, x2, y2) {
    const peg1 = this.getPeg(x1, y1);
    const peg2 = this.getPeg(x2, y2);
    return peg1 != null && peg2 != null &&
           peg1.color === peg2.color &&
           !peg1.hasLink(x2 - x1, y2 - y1) &&
           !this.crossesExistingLink(x1, y1, x2, y2);
  }

  // If a link may be added, returns the new Link; otherwise null
  // (including when the pegs are already linked).
  link(x1, y1, x2, y2) {
    if (!this.canLink(x1, y1, x2, y2)) return null;
    return new Link(this.getPeg(x1, y1), this.getPeg(x2, y2));
  }

  crossesExistingLink(x1, y1, x2, y2, endpointColor = this.getPeg(x1, y1)?.color) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (!((x === x1 && y === y1) || (x === x2 && y === y2))) {
          if (this.crossesPegsLinks(x, y, x1, y1, x2, y2, endpointColor)) return true;
        }
      }
    }
    return false;
  }

  crossesPegsLinks(x, y, x1, y1, x2, y2, endpointColor = this.getPeg(x1, y1)?.color) {
    const peg = this.getPeg(x, y);
    if (!peg) return false;
    return this.forEachKnightMove((dx, dy) => {
      if (!peg.hasLink(dx, dy) || !this.doLinksCross(x1, y1, x2, y2, x, y, x + dx, y + dy)) {
        return false;
      }
      return (this.linkXingPolicy === TwixtBoard.LINK_REMOVAL) || (peg.color !== endpointColor);
    });
  }

  doLinksCross(x1, y1, x2, y2, x3, y3, x4, y4) {
    const distX = Math.abs(x1 + x2 - x3 - x4);
    const distY = Math.abs(y1 + y2 - y3 - y4);
    return (distX + distY < 3 &&
            (distX === distY ||
             (y2 - y1) * (x2 - x1) * (y4 - y3) * (x4 - x3) < 0));
  }

  pegCount() {
    return this.allPegs.length;
  }

  getFirstPeg() {
    return this.allPegs[0];
  }

  winner() {
    const whiteWon = this._hasConnection(TwixtBoard.WHITE, (peg) => peg.y < 3, (peg) => peg.y > this.size - 2);
    const blackWon = this._hasConnection(TwixtBoard.BLACK, (peg) => peg.x < 3, (peg) => peg.x > this.size - 2);
    return whiteWon ? "White" : blackWon ? "Black" : null;
  }

  _hasConnection(color, startSide, endSide) {
    const visited = new Set();
    for (const peg of this.allPegs) {
      if (peg.color === color && startSide(peg)) visited.add(peg);
    }
    const visitStack = [...visited];
    while (visitStack.length > 0) {
      const peg = visitStack.pop();
      for (const link of peg.getLinks()) {
        const linkedPeg = (peg === link.peg1) ? link.peg2 : link.peg1;
        if (endSide(linkedPeg)) {
          return true;
        }
        if (!visited.has(linkedPeg)) {
          visited.add(linkedPeg);
          visitStack.push(linkedPeg);
        }
      }
    }
    return false;
  }

  isDraw() {
    return this._isColorBlocked(TwixtBoard.WHITE) &&
           this._isColorBlocked(TwixtBoard.BLACK);
  }

  // Returns true if `color` can no longer reach their goal side.
  // Explores all grid squares reachable via knight moves from the start border,
  // treating opponent-occupied squares, moves blocked by opponent links, and
  // squares outside the player's legal area as impassable.
  // Own links are irrelevant (they may cross in P&P mode).
  //
  // The start border (row 1 for White, column 1 for Black) cannot legally hold
  // any opponent pegs, so the seed squares are simply the full legal range there.
  _isColorBlocked(color) {
    const isWhite = color === TwixtBoard.WHITE;
    const endCoord = this.size; // y===size for White, x===size for Black
    const key = (x, y) => x * (this.size + 1) + y;
    const visited = new Set();
    const stack = [];

    // Seed: x=2..size-1 on row 1 (White) or y=2..size-1 on column 1 (Black).
    for (let i = 2; i < this.size; i++) {
      const [x, y] = isWhite ? [i, 1] : [1, i];
      visited.add(key(x, y));
      stack.push([x, y]);
    }

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of KNIGHT_MOVES) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.isLegalSpot(nx, ny, color)) continue; // outside player's legal area
        const nPeg = this.getPeg(nx, ny);
        if (nPeg && nPeg.color !== color) continue; // square owned by opponent
        if (this.crossesExistingLink(x, y, nx, ny, color)) continue;
        if (isWhite ? ny === endCoord : nx === endCoord) return false; // can still reach the goal
        const k = key(nx, ny);
        if (!visited.has(k)) {
          visited.add(k);
          stack.push([nx, ny]);
        }
      }
    }
    return true; // goal is unreachable
  }

}

if (typeof module !== 'undefined') module.exports = { TwixtBoard };

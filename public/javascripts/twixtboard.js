class TwixtBoard {
  static LINK_REMOVAL     = 0;
  static PENCIL_AND_PAPER = 1;

  constructor(size, linkXingPolicy) {
    this.size = size;
    this.linkXingPolicy = linkXingPolicy ?? TwixtBoard.PENCIL_AND_PAPER;
    // 1-based: board[x][y] is valid for x, y in 1..size
    this.board = Array.from({ length: size + 1 }, () => []);
    this.allPegs = [];
    this.dx = [ 1,  2, 2, 1, -1, -2, -2, -1];
    this.dy = [-2, -1, 1, 2,  2,  1, -1, -2];
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

  isLinkable(x, y) {
    const peg = this.getPeg(x, y);
    if (peg == null) return false;
    for (let i = 0; i < 8; i++) {
      if (!peg.hasLink(this.dx[i], this.dy[i]) &&
          this.canLink(x, y, x + this.dx[i], y + this.dy[i])) {
        return true;
      }
    }
    return false;
  }

  canLink(x1, y1, x2, y2) {
    const peg1 = this.getPeg(x1, y1);
    const peg2 = this.getPeg(x2, y2);
    return (peg1 != null && peg2 != null && peg1.color === peg2.color &&
            !this.crossesExistingLink(x1, y1, x2, y2));
  }

  // If a link may be added, returns the new Link; otherwise null
  // (including when the pegs are already linked).
  link(x1, y1, x2, y2) {
    if (!this.canLink(x1, y1, x2, y2)) return null;
    const peg1 = this.board[x1][y1];
    const peg2 = this.board[x2][y2];
    if (peg1.hasLink(x2 - x1, y2 - y1)) return null;
    return new Link(peg1, peg2);
  }

  crossesExistingLink(x1, y1, x2, y2) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (!((x === x1 && y === y1) || (x === x2 && y === y2))) {
          if (this.crossesPegsLinks(x, y, x1, y1, x2, y2)) return true;
        }
      }
    }
    return false;
  }

  crossesPegsLinks(x, y, x1, y1, x2, y2) {
    const peg = this.getPeg(x, y);
    if (peg != null) {
      for (let i = 0; i < 8; i++) {
        const dx = this.dx[i];
        const dy = this.dy[i];
        if (peg.hasLink(dx, dy) &&
            this.doLinksCross(x1, y1, x2, y2, x, y, x + dx, y + dy)) {
          if (this.linkXingPolicy === TwixtBoard.LINK_REMOVAL) {
            return true;
          } else if (peg.color !== this.getPeg(x1, y1).color) {
            return true;
          }
        }
      }
    }
    return false;
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

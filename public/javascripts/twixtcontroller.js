class TwixtController {
  constructor(size, linkXingPolicy) {
    this.board = new TwixtBoard(size, linkXingPolicy);
    this.move = new EditMove();
    this.dx = [ 1,  2, 2, 1, -1, -2, -2, -1];
    this.dy = [-2, -1, 1, 2,  2,  1, -1, -2];
  }

  isLinkable(x, y) {
    const peg = this.board.getPeg(x, y);
    if (peg == null) return false;
    for (let i = 0; i < 8; i++) {
      if (!peg.hasLink(this.dx[i], this.dy[i]) &&
          this.canLink(x, y, x + this.dx[i], y + this.dy[i])) {
        return true;
      }
    }
    return false;
  }

  removeLink(link) {
    this.move.removeLink(link);
  }

  addLinksTo(peg, isNew) {
    for (let i = 0; i < 8; i++) {
      this.link(peg.x, peg.y, peg.x + this.dx[i], peg.y + this.dy[i], isNew);
    }
  }

  link(x1, y1, x2, y2, isNew) {
    if (this.canLink(x1, y1, x2, y2)) {
      const peg1 = this.board.board[x1][y1];
      const peg2 = this.board.board[x2][y2];
      if (!peg1.hasLink(x2 - x1, y2 - y1)) {
        const link = new Link(peg1, peg2);
        if (!isNew) this.move.addLink(link); // new peg's links are implicit
      }
    }
  }

  canLink(x1, y1, x2, y2) {
    const peg1 = this.board.getPeg(x1, y1);
    const peg2 = this.board.getPeg(x2, y2);
    return (peg1 != null && peg2 != null && peg1.color === peg2.color &&
            !this.crossesExistingLink(x1, y1, x2, y2));
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
    const peg = this.board.board[x][y];
    if (peg != null) {
      for (let i = 0; i < 8; i++) {
        const dx = this.dx[i];
        const dy = this.dy[i];
        if (peg.hasLink(dx, dy) &&
            this.doLinksCross(x1, y1, x2, y2, x, y, x + dx, y + dy)) {
          if (this.board.linkXingPolicy === TwixtBoard.LINK_REMOVAL) {
            return true;
          } else if (peg.color !== this.board.getPeg(x1, y1).color) {
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

  placePeg(x, y, color) {
    const peg = new Peg(color, x, y);
    this.board.setPeg(peg);
    this.move.setPeg(peg);
    return peg;
  }
}
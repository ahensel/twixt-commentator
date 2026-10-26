class TwixtGame {
  constructor(size, linkXingPolicy) {
    this.board = new TwixtBoard(size, linkXingPolicy);
    this.move = new EditMove();
  }

  isLinkable(x, y) {
    return this.board.isLinkable(x, y);
  }

  removeLink(link) {
    this.move.removeLink(link);
  }

  addLinksTo(peg, isNew) {
    this.board.forEachKnightMove((dx, dy) => {
      this.link(peg.x, peg.y, peg.x + dx, peg.y + dy, isNew);
    });
  }

  link(x1, y1, x2, y2, isNew) {
    const link = this.board.link(x1, y1, x2, y2);
    if (link && !isNew) this.move.addLink(link); // new peg's links are implicit
  }

  placePeg(x, y, color) {
    const peg = new Peg(color, x, y);
    this.board.setPeg(peg);
    this.move.setPeg(peg);
    return peg;
  }

  // Hands off the in-progress edit and starts a fresh one. The caller decides
  // where the returned move belongs (main line vs. user variation).
  takeCurrentEdit() {
    const edit = this.move;
    this.move = new EditMove();
    return edit;
  }
}

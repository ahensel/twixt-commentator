class PendingEdit {
  constructor(board) {
    this.board = board;
    this._resetEdit();
  }

  isLinkable(x, y) {
    return this.board.isLinkable(x, y);
  }

  removeLink(link) {
    const index = this._indexOf(this._addedLinks, link);
    if (index >= 0) {
      this._addedLinks.splice(index, 1);
    } else {
      this._removedLinks.push(link);
    }
  }

  addLinksTo(peg, isNew) {
    this.board.forEachKnightMove((dx, dy) => {
      this.link(peg.x, peg.y, peg.x + dx, peg.y + dy, isNew);
    });
  }

  link(x1, y1, x2, y2, isNew) {
    const link = this.board.link(x1, y1, x2, y2);
    if (link && !isNew) this._addLink(link); // new peg's links are implicit
  }

  placePeg(x, y, color) {
    const peg = new Peg(color, x, y);
    this.board.setPeg(peg);
    this._peg = peg;
    return peg;
  }

  // Hands off the in-progress edit as an EditMove and starts a fresh one.
  // The caller decides where the returned move belongs (main line vs. user
  // variation).
  takeCurrentEdit() {
    const edit = new EditMove(this._peg, this._removedLinks, this._addedLinks);
    this._resetEdit();
    return edit;
  }

  // ─── In-progress edit state ─────────────────────────────────────────────

  _resetEdit() {
    this._peg = null;
    this._removedLinks = [];
    this._addedLinks = [];
  }

  _addLink(link) {
    const index = this._indexOf(this._removedLinks, link);
    if (index >= 0) {
      this._removedLinks.splice(index, 1);
    } else {
      this._addedLinks.push(link);
    }
  }

  _indexOf(links, link) {
    for (let i = 0; i < links.length; i++) {
      if (links[i].toString() === link.toString()) return i;
    }
    return -1;
  }
}

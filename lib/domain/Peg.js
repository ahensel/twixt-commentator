class Peg {
  constructor(color) {
    this.color = color;
    this._link = new Array(8).fill(false);
  }

  isLinkDistance(dx, dy) {
    return Math.abs(dx * dy) === 2;
  }

  getLinkIndex(dx, dy) {
    //    0     2
    //  1         3
    //       *
    //  4         6
    //    5     7
    // (opposite links add up to 7)
    return (dx > 0 ? 2 : 0) + (dy > 0 ? 3 : 2) + dy;
  }

  setLinkStatus(dx, dy, status) {
    if (this.isLinkDistance(dx, dy)) {
      this._link[this.getLinkIndex(dx, dy)] = status;
    }
  }

  setLink(dx, dy) { this.setLinkStatus(dx, dy, true); }
  removeLink(dx, dy) { this.setLinkStatus(dx, dy, false); }

  hasLink(dx, dy) {
    return !!(this.isLinkDistance(dx, dy)
      && this._link[this.getLinkIndex(dx, dy)]);
  }
}

module.exports = { Peg };

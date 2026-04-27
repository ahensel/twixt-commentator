class Peg {
  constructor(color, x, y) {
    this.color = color;
    this.x = x;
    this.y = y;
    this.links = [];
    this.swapped = false;
  }

  getXnotation(x) {
    return ' abcdefghijklmnopqrstuvwx'.charAt(x);
  }

  getYnotation(y) {
    return y;
  }

  getXYnotation(x, y) {
    return this.getXnotation(x) + this.getYnotation(y);
  }

  getNotation() {
    return this.swapped
      ? this.getXYnotation(this.y, this.x)
      : this.getXYnotation(this.x, this.y);
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

  addLink(link) {
    this.links[link.getIndex(this)] = link;
  }

  removeLink(link) {
    this.links[link.getIndex(this)] = null;
  }

  getLink(dx, dy) {
    return this.links[this.getLinkIndex(dx, dy)];
  }

  getLinks() {
    return this.links.filter(link => !!link);
  }

  hasLink(dx, dy) {
    return !!this.getLink(dx, dy);
  }
}

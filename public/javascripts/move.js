class Move {
  constructor() {
    this.removedLinks = [];
    this.addedLinks = [];
  }

  removeLink(link) {
    const index = this._indexOf(this.addedLinks, link);
    if (index >= 0) {
      this.addedLinks.splice(index, 1);
    } else {
      this.removedLinks.push(link);
    }
  }

  addLink(link) {
    const index = this._indexOf(this.removedLinks, link);
    if (index >= 0) {
      this.removedLinks.splice(index, 1);
    } else {
      this.addedLinks.push(link);
    }
  }

  _indexOf(links, link) {
    for (let i = 0; i < links.length; i++) {
      if (links[i].toString() === link.toString()) return i;
    }
    return -1;
  }

  _sortLinks(links) {
    return links.slice().sort((a, b) => {
      const ay = a.peg1.y + a.peg2.y;
      const by = b.peg1.y + b.peg2.y;
      if (ay !== by) return ay - by;
      return (a.peg1.x + a.peg2.x) - (b.peg1.x + b.peg2.x);
    });
  }

  setPeg(peg) {
    this.peg = peg;
  }

  getText() {
    let text = '';
    this._sortLinks(this.removedLinks).forEach(link => { text += link.getRemoveNotation(); });
    this._sortLinks(this.addedLinks).forEach(link => { text += link.getAddNotation(); });
    return text + this.peg.getNotation();
  }
}

class SwapMove   { getText() { return 'swap';    } }
class ResignMove { getText() { return 'resign';  } }
class DrawMove   { getText() { return 'draw';    } }
class ForfeitMove{ getText() { return 'forfeit'; } }
class LostMove   { getText() { return 'lost';    } }
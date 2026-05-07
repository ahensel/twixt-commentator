// ─── Game-move constants ───────────────────────────────────────────────────────
// These represent moves as recorded in the game log (parsed from LittleGolem).

const PEG = 1;
const SWAP = 2;
const RESIGN = 3;
const DRAW = 4;
const FORFEIT = 5;
const LOST = 6;

class AbstractMove {
  get color() {
    if (this.player === 1) return 'white';
    if (this.player === 2) return 'black';
    return null;
  }
}

class Move extends AbstractMove {
  constructor(x, y, player) {
    super();
    this.x = x;
    this.y = y;
    this.player = player;
    this.type = PEG;
  }

  get text() {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[this.x] + String(this.y + 1);
  }

  // getText() alias used by front-end display code.
  getText() { return this.text; }
}

Move.Peg     = PEG;
Move.Swap    = SWAP;
Move.Resign  = RESIGN;
Move.Draw    = DRAW;
Move.Forfeit = FORFEIT;
Move.Lost    = LOST;

class SwapMove extends AbstractMove {
  constructor(player) { super(); this.player = player; this.type = SWAP; }
  get text() { return 'swap'; }
  getText()  { return this.text; }
}

class ResignMove extends AbstractMove {
  constructor(player) { super(); this.player = player; this.type = RESIGN; }
  get text() { return 'resign'; }
  getText()  { return this.text; }
}

class DrawMove extends AbstractMove {
  constructor(player) { super(); this.player = player; this.type = DRAW; }
  get text() { return 'draw'; }
  getText()  { return this.text; }
}

class ForfeitMove extends AbstractMove {
  constructor(player) { super(); this.player = player; this.type = FORFEIT; }
  get text() { return 'forfeit'; }
  getText()  { return this.text; }
}

class LostMove extends AbstractMove {
  constructor(player) { super(); this.player = player; this.type = LOST; }
  get text() { return 'lost'; }
  getText()  { return this.text; }
}

// ─── Editor move ──────────────────────────────────────────────────────────────
// Tracks the link additions/removals and peg placement for a single interactive
// editing step on the board.  This is a purely front-end concept used by
// TwixtController and TwixtMoves to build the move notation displayed in the
// sidebar and to support undo.

class EditMove {
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

if (typeof module !== 'undefined') {
  module.exports = { Move, SwapMove, ResignMove, DrawMove, ForfeitMove, LostMove, EditMove };
}
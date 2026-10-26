class Move {
  constructor(x, y, player) {
    this.x = x;
    this.y = y;
    this.player = player;
    this.type = Move.Peg;
  }

  get text() {
    const letters = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[this.x] + String(this.y);
  }

  // getText() alias used by front-end display code.
  getText() { return this.text; }
}

Move.Peg     = 1;
Move.Swap    = 2;
Move.Resign  = 3;
Move.Draw    = 4;
Move.Forfeit = 5;
Move.Lost    = 6;

class SwapMove {
  constructor(player) { this.player = player; this.type = Move.Swap; }
  get text() { return 'swap'; }
  getText()  { return this.text; }
}

class ResignMove {
  constructor(player) { this.player = player; this.type = Move.Resign; this.isFinalMove = true; }
  get text() { return 'resign'; }
  getText()  { return this.text; }
}

class DrawMove {
  constructor(player) { this.player = player; this.type = Move.Draw; this.isFinalMove = true; }
  get text() { return 'draw'; }
  getText()  { return this.text; }
}

class ForfeitMove {
  constructor(player) { this.player = player; this.type = Move.Forfeit; this.isFinalMove = true; }
  get text() { return 'forfeit'; }
  getText()  { return this.text; }
}

class LostMove {
  constructor(player) { this.player = player; this.type = Move.Lost; this.isFinalMove = true; }
  get text() { return 'lost'; }
  getText()  { return this.text; }
}

// ─── Editor move ──────────────────────────────────────────────────────────────
// Snapshot of a completed editing step on the board: the placed peg plus any
// links added or removed along the way.  Purely a front-end concept; it is
// produced by TwixtGame.takeCurrentEdit() and recorded by TwixtMoves to build
// the move notation displayed in the moves-panel.  The live, in-progress edit
// state itself is tracked by TwixtGame.

class EditMove {
  constructor(peg, removedLinks, addedLinks) {
    this.peg = peg;
    this.removedLinks = removedLinks;
    this.addedLinks = addedLinks;
  }

  _sortLinks(links) {
    return links.slice().sort((a, b) => {
      const ay = a.peg1.y + a.peg2.y;
      const by = b.peg1.y + b.peg2.y;
      if (ay !== by) return ay - by;
      return (a.peg1.x + a.peg2.x) - (b.peg1.x + b.peg2.x);
    });
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

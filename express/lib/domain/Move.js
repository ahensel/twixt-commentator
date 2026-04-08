// Translated from Move.rb

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
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    return letters[this.x] + String(this.y + 1);
  }
}

Move.Peg = PEG;
Move.Swap = SWAP;
Move.Resign = RESIGN;
Move.Draw = DRAW;
Move.Forfeit = FORFEIT;
Move.Lost = LOST;

class SwapMove extends AbstractMove {
  constructor(player) {
    super();
    this.player = player;
    this.type = SWAP;
  }
  get text() { return 'swap'; }
}

class ResignMove extends AbstractMove {
  constructor(player) {
    super();
    this.player = player;
    this.type = RESIGN;
  }
  get text() { return 'resign'; }
}

class DrawMove extends AbstractMove {
  constructor(player) {
    super();
    this.player = player;
    this.type = DRAW;
  }
  get text() { return 'draw'; }
}

class ForfeitMove extends AbstractMove {
  constructor(player) {
    super();
    this.player = player;
    this.type = FORFEIT;
  }
  get text() { return 'forfeit'; }
}

class LostMove extends AbstractMove {
  constructor(player) {
    super();
    this.player = player;
    this.type = LOST;
  }
  get text() { return 'lost'; }
}

module.exports = { Move, SwapMove, ResignMove, DrawMove, ForfeitMove, LostMove };

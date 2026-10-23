const { Peg } = require('../../public/javascripts/peg');
const { Link } = require('../../public/javascripts/link');
const { Move } = require('../../public/javascripts/move');

const KNIGHT_MOVES = [
  [ 1, -2], [ 2, -1], [ 2,  1], [ 1,  2],
  [-1,  2], [-2,  1], [-2, -1], [-1, -2],
];

class TwixtBoard {
  constructor(size) {
    this._size = size;
    this._draw = false;
    this._resignation = null;
    this._forfeit = null;
    this._moves = [];
    // board[x][y] = Peg or null
    this._board = Array.from({ length: size }, () => new Array(size).fill(null));
  }

  isPegAt(x, y) {
    return x >= 0 && x < this._size && y >= 0 && y < this._size && this._board[x][y] !== null;
  }

  getColor(x, y) {
    if (this.isPegAt(x, y)) return this._board[x][y].color;
    return null;
  }

  isValidSpot(x, y, color) {
    const inBounds = (color === 'white')
      ? (x > 0 && x < this._size - 1)
      : (y > 0 && y < this._size - 1);
    return inBounds && this._board[x][y] === null;
  }

  play(move) {
    if (move.type === Move.Peg) {
      this.setPegAndLink(move.x, move.y, move.color);
    } else if (move.type === Move.Swap) {
      this.swap();
    } else if (move.type === Move.Resign) {
      this.resign(move.color);
    } else if (move.type === Move.Forfeit) {
      this.forfeit(move.color);
    } else if (move.type === Move.Draw) {
      this.draw();
    }
    this._moves.push(move);
  }

  setPegAndLink(x, y, color) {
    if (this.isValidSpot(x, y, color)) {
      this._board[x][y] = new Peg(color, x, y);
      for (const [dx, dy] of KNIGHT_MOVES) {
        this.link(x, y, x + dx, y + dy);
      }
    }
  }

  swap() {
    // Swap is only legal on move 2, so there is always exactly one peg on the board here.
    // Move it from (x, y) to (y, x) and flip its color per the LG swap rule.
    if (this._moves.length === 1) {
      const firstMove = this._moves[0];
      const [x, y] = [firstMove.x, firstMove.y];
      this._board[x][y] = null;
      this._board[y][x] = new Peg('black', y, x);
    }
  }
  resign(color) { this._resignation = color; }
  forfeit(color) { this._forfeit = color; }
  draw() { this._draw = true; }

  isDraw() { return this._draw; }
  isForfeit() { return this._forfeit !== null; }
  isResignation() { return this._resignation !== null; }

  setPlayer(num, name) {
    if (num === 1) this._player1 = name;
    else if (num === 2) this._player2 = name;
  }

  isLinkDistance(dx, dy) {
    return Math.abs(dx * dy) === 2;
  }

  canLink(x1, y1, x2, y2) {
    return (
      this.isPegAt(x1, y1) &&
      this.isPegAt(x2, y2) &&
      this.getColor(x1, y1) === this.getColor(x2, y2) &&
      this.isLinkDistance(x1 - x2, y1 - y2) &&
      !this._board[x1][y1].hasLink(x2 - x1, y2 - y1) &&
      !this.crossesExistingLink(x1, y1, x2, y2)
    );
  }

  crossesExistingLink(x1, y1, x2, y2, endpointColor = this._board[x1]?.[y1]?.color) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (!((x === x1 && y === y1) || (x === x2 && y === y2))) {
          if (this.crossesPegsLinks(x, y, x1, y1, x2, y2, endpointColor)) return true;
        }
      }
    }
    return false;
  }

  crossesPegsLinks(x, y, x1, y1, x2, y2, endpointColor = this._board[x1]?.[y1]?.color) {
    const peg = this._board[x][y];
    if (peg === null) return false;
    for (const [dx, dy] of KNIGHT_MOVES) {
      if (peg.hasLink(dx, dy) && peg.color !== endpointColor &&
          this.doLinksCross(x1, y1, x2, y2, x, y, x + dx, y + dy)) {
        return true;
      }
    }
    return false;
  }

  doLinksCross(x1, y1, x2, y2, x3, y3, x4, y4) {
    const distX = Math.abs(x1 + x2 - x3 - x4);
    const distY = Math.abs(y1 + y2 - y3 - y4);
    return (
      distX + distY < 3 &&
      (distX === distY ||
        (y2 - y1) * (x2 - x1) * (y4 - y3) * (x4 - x3) < 0)
    );
  }

  link(x1, y1, x2, y2) {
    if (this.canLink(x1, y1, x2, y2)) {
      const peg1 = this._board[x1][y1];
      const peg2 = this._board[x2][y2];
      // Link constructor registers itself on both pegs via peg.addLink(this).
      new Link(peg1, peg2);
    }
  }

  unlink(x1, y1, x2, y2) {
    const peg1 = this._board[x1][y1];
    const peg2 = this._board[x2][y2];
    if (peg1 !== null && peg2 !== null) {
      const link = peg1.getLink(x2 - x1, y2 - y1);
      if (link) link.remove();
    }
  }

  searchForEdge(indexBoard, x, y, color, index) {
    if ((color === 'white' && y === this._size - 1) ||
        (color === 'black' && x === this._size - 1)) {
      return true;
    }
    indexBoard[x][y] = index;
    const peg = this._board[x][y];
    for (const [dx, dy] of KNIGHT_MOVES) {
      const nx = x + dx;
      const ny = y + dy;
      if (peg.hasLink(dx, dy) && indexBoard[nx][ny] === null &&
          this.searchForEdge(indexBoard, nx, ny, color, index)) {
        return true;
      }
    }
    return false;
  }

  winner() {
    if (this.hasWonPlayer(1)) return 1;
    if (this.hasWonPlayer(2)) return 2;
    if (this.isDraw()) return 0;
    return null;
  }

  colorOfPlayer(num) {
    return num === 1 ? 'white' : 'black';
  }

  hasWonPlayer(num) { return this.hasWonColor(this.colorOfPlayer(num)); }

  hasWonColor(color) {
    if (this._resignation !== null) return this._resignation !== color;
    if (this._forfeit !== null) return this._forfeit !== color;
    if (this._draw) return false;
    return this.hasConnectedColor(color);
  }

  hasConnectedColor(color) {
    const indexBoard = Array.from({ length: this._size }, () => new Array(this._size).fill(null));
    let index = 0;

    // forStartEdge: iterate start-edge for color
    if (color === 'white') {
      for (let x = 0; x < this._size; x++) {
        if (this.getColor(x, 0) === color && indexBoard[x][0] === null) {
          index++;
          if (this.searchForEdge(indexBoard, x, 0, color, index)) return true;
        }
      }
    } else {
      for (let y = 0; y < this._size; y++) {
        if (this.getColor(0, y) === color && indexBoard[0][y] === null) {
          index++;
          if (this.searchForEdge(indexBoard, 0, y, color, index)) return true;
        }
      }
    }
    return false;
  }

  numPegs() {
    let count = 0;
    for (let x = 0; x < this._size; x++) {
      for (let y = 0; y < this._size; y++) {
        if (this._board[x][y] !== null) count++;
      }
    }
    return count;
  }
}

module.exports = { TwixtBoard };

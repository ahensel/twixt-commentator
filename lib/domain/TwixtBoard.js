const { Peg } = require('../../public/javascripts/peg');
const { Link } = require('../../public/javascripts/link');
const { Move } = require('../../public/javascripts/move');

const KNIGHT_NEIGHBORS = [
  [-1, -2], [-2, -1], [1, -2], [2, -1],
  [-2, 1], [-1, 2], [2, 1], [1, 2],
];

class TwixtBoard {
  constructor(width, height) {
    this._width = width;
    this._height = height;
    this._swapped = false;
    this._draw = false;
    this._resignation = null;
    this._forfeit = null;
    this._moves = [];
    // board[x][y] = Peg or null
    this._board = Array.from({ length: width }, () => new Array(height).fill(null));
  }

  isPegAt(x, y) {
    return x >= 0 && x < this._width && y >= 0 && y < this._height && this._board[x][y] !== null;
  }

  getColor(x, y) {
    if (this.isPegAt(x, y)) return this._board[x][y].color;
    return null;
  }

  isValidSpot(x, y, color) {
    const inBounds = (color === 'white')
      ? (x > 0 && x < this._width - 1)
      : (y > 0 && y < this._height - 1);
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

  getMove(n) { return this._moves[n]; }

  setPeg(x, y, color) {
    if (this.isValidSpot(x, y, color)) {
      this._board[x][y] = new Peg(color, x, y);
    }
  }

  setPegAndLink(x, y, color) {
    if (this.isValidSpot(x, y, color)) {
      this._board[x][y] = new Peg(color, x, y);
      for (const [dx, dy] of KNIGHT_NEIGHBORS) {
        this.link(x, y, x + dx, y + dy);
      }
    }
  }

  removePeg(x, y) {
    for (const [dx, dy] of KNIGHT_NEIGHBORS) {
      this.unlink(x, y, x + dx, y + dy);
    }
    this._board[x][y] = null;
  }

  swap() { this._swapped = true; }
  resign(color) { this._resignation = color; }
  forfeit(color) { this._forfeit = color; }
  draw() { this._draw = true; }

  isSwapped() { return this._swapped; }
  isDraw() { return this._draw; }
  isForfeit() { return this._forfeit !== null; }
  isResignation() { return this._resignation !== null; }

  setPlayer(num, name) {
    if (num === 1) this._player1 = name;
    else if (num === 2) this._player2 = name;
  }

  getPlayerName(num) {
    if (num === 1) return this._player1;
    if (num === 2) return this._player2;
    return null;
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
      !this.crossesExistingLink(x1, y1, x2, y2)
    );
  }

  crossesExistingLink(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const relevantColor = this._board[x1][y1].color;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (this._board[x][y] !== null &&
            this._board[x][y].color !== relevantColor &&
            this.crossesPegsLinks(x, y, x1, y1, x2, y2)) {
          return true;
        }
      }
    }
    return false;
  }

  crossesPegsLinks(x, y, x1, y1, x2, y2) {
    const peg = this._board[x][y];
    if (peg !== null) {
      for (const [dx, dy] of KNIGHT_NEIGHBORS) {
        if (peg.hasLink(dx, dy) && this.doLinksCross(x1, y1, x2, y2, x, y, x + dx, y + dy)) {
          return true;
        }
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

  isLinked(x1, y1, x2, y2) {
    const peg = this._board[x1][y1];
    return peg !== null && peg.hasLink(x2 - x1, y2 - y1);
  }

  // Iterate knight neighbors: cb(dx, dy)
  _forEachKnightNeighbor(cb) {
    for (const [dx, dy] of KNIGHT_NEIGHBORS) cb(dx, dy);
  }

  searchForEdge(indexBoard, x, y, color, index) {
    if ((color === 'white' && y === this._height - 1) ||
        (color === 'black' && x === this._width - 1)) {
      return true;
    }
    indexBoard[x][y] = index;
    const peg = this._board[x][y];
    for (const [dx, dy] of KNIGHT_NEIGHBORS) {
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
    return (num === 1) !== this.isSwapped() ? 'white' : 'black';
  }

  hasWonPlayer(num) { return this.hasWonColor(this.colorOfPlayer(num)); }
  hasConnectedPlayer(num) { return this.hasConnectedColor(this.colorOfPlayer(num)); }

  hasWonColor(color) {
    if (this._resignation !== null) return this._resignation !== color;
    if (this._forfeit !== null) return this._forfeit !== color;
    if (this._draw) return false;
    return this.hasConnectedColor(color);
  }

  hasConnectedColor(color) {
    const indexBoard = Array.from({ length: this._width }, () => new Array(this._height).fill(null));
    let index = 0;

    // forStartEdge: iterate start-edge for color
    if (color === 'white') {
      for (let x = 0; x < this._width; x++) {
        if (this.getColor(x, 0) === color && indexBoard[x][0] === null) {
          index++;
          if (this.searchForEdge(indexBoard, x, 0, color, index)) return true;
        }
      }
    } else {
      for (let y = 0; y < this._height; y++) {
        if (this.getColor(0, y) === color && indexBoard[0][y] === null) {
          index++;
          if (this.searchForEdge(indexBoard, 0, y, color, index)) return true;
        }
      }
    }
    return false;
  }
}

module.exports = { TwixtBoard };

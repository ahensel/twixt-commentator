const { Peg } = require('../../public/javascripts/peg');
const { Link } = require('../../public/javascripts/link');
const { Move } = require('../../public/javascripts/move');

const KNIGHT_MOVES = [
  [ 1, -2], [ 2, -1], [ 2,  1], [ 1,  2],
  [-1,  2], [-2,  1], [-2, -1], [-1, -2],
];

class TwixtBoard {
  static WHITE = 1;
  static BLACK = 0;

  constructor(size) {
    this._size = size;
    this._draw = false;
    this._resignation = null;
    this._forfeit = null;
    this._moves = [];
    // board[x][y] = Peg or null
    this._board = Array.from({ length: size }, () => new Array(size).fill(null));
    this._allPegs = [];
  }

  isPegAt(x, y) {
    return x >= 0 && x < this._size && y >= 0 && y < this._size && this._board[x][y] !== null;
  }

  getColor(x, y) {
    if (this.isPegAt(x, y)) return this._board[x][y].color;
    return null;
  }

  _isValidSpot(x, y, color) {
    const inBounds = (color === TwixtBoard.WHITE)
      ? (x > 0 && x < this._size - 1)
      : (y > 0 && y < this._size - 1);
    return inBounds;
  }

  _isUnoccupiedSpot(x, y) {
    return this._board[x][y] === null;
  }

  play(move) {
    if (move.type === Move.Peg) {
      this.setPegAndLink(move.x, move.y, this.colorOfPlayer(move.player));
    } else if (move.type === Move.Swap) {
      this.swap();
    } else if (move.type === Move.Resign) {
      this.resign(this.colorOfPlayer(move.player));
    } else if (move.type === Move.Forfeit) {
      this.forfeit(this.colorOfPlayer(move.player));
    } else if (move.type === Move.Draw) {
      this.draw();
    }
    this._moves.push(move);
  }

  setPegAndLink(x, y, color) {
    if (this._isValidSpot(x, y, color) && this._isUnoccupiedSpot(x, y)) {
      const peg = new Peg(color, x, y);
      this._board[x][y] = peg;
      this._allPegs.push(peg);
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
      this._board[y][x] = new Peg(TwixtBoard.BLACK, y, x);
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

  _searchForEdge(indexBoard, x, y, color, index) {
    if ((color === TwixtBoard.WHITE && y === this._size - 1) ||
        (color === TwixtBoard.BLACK && x === this._size - 1)) {
      return true;
    }
    indexBoard[x][y] = index;
    const peg = this._board[x][y];
    for (const [dx, dy] of KNIGHT_MOVES) {
      const nx = x + dx;
      const ny = y + dy;
      if (peg.hasLink(dx, dy) && indexBoard[nx][ny] === null &&
          this._searchForEdge(indexBoard, nx, ny, color, index)) {
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
    return num === 1 ? TwixtBoard.WHITE : TwixtBoard.BLACK;
  }

  hasWonPlayer(num) { return this.hasWonColor(this.colorOfPlayer(num)); }

  hasWonColor(color) {
    if (this._resignation !== null) return this._resignation !== color;
    if (this._forfeit !== null) return this._forfeit !== color;
    if (this._draw) return false;
    return this.hasConnectedColor(color);
  }

  // connection across the entire board, from row 1 to the last row.
  hasConnectedColor(color) {
    if (color === TwixtBoard.WHITE) {
      return this._hasConnection(color, (peg) => peg.y < 1, (peg) => peg.y > this._size - 2);
    }
    if (color === TwixtBoard.BLACK) {
      return this._hasConnection(color, (peg) => peg.x < 1, (peg) => peg.x > this._size - 2);
    }
  }

  // Depth-first search for absolute win by continuous chain of connected pegs from one side to the other
  _hasConnection(color, startSide, endSide) {
    const visited = new Set();
    for (const peg of this._allPegs) {
      if (peg.color === color && startSide(peg)) visited.add(peg);
    }
    const visitStack = [...visited];
    while (visitStack.length > 0) {
      const peg = visitStack.pop();
      for (const link of peg.getLinks()) {
        const linkedPeg = (peg === link.peg1) ? link.peg2 : link.peg1;
        if (endSide(linkedPeg)) {
          return true;
        }
        if (!visited.has(linkedPeg)) {
          visited.add(linkedPeg);
          visitStack.push(linkedPeg);
        }
      }
    }
    return false;
  }

  numPegs() {
    return this._allPegs.length;
  }
}

module.exports = { TwixtBoard };

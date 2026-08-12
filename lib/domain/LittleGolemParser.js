const { TwixtBoard } = require('./TwixtBoard');
const { Move, SwapMove, ResignMove, DrawMove, ForfeitMove, LostMove } = require('../../public/javascripts/move');

class LittleGolemParser {
  constructor(game) {
    this._game = game;
    this._forfeit = false;
  }

  getPlayer1() {
    const m = this._game.match(/PB\[[^\]]*\]/);
    if (!m) return null;
    const p = m[0];
    return p.slice(3, p.length - 1);
  }

  getPlayer2() {
    const m = this._game.match(/PW\[[^\]]*\]/);
    if (!m) return null;
    const p = m[0];
    return p.slice(3, p.length - 1);
  }

  getBoardSize() {
    const m = this._game.match(/SZ\[[^\]]*\]/);
    const p = m[0];
    return parseInt(p.slice(3, p.length - 1), 10);
  }

  _getMoveFromLetter(letter) {
    // zero based index: 'a' (97) --> 0, 'A' (65) --> 26
    return (letter >= 'a' && letter <= 'z')?
      letter.charCodeAt(0) - 97:
      letter.charCodeAt(0) - 39;
  }

  getTournament() {
    const m = this._game.match(/EV\[[^\]]*\]/);
    if (!m) return '';
    const p = m[0];
    const tourney = p.slice(3, p.length - 1);
    return tourney === 'null' ? '' : tourney;
  }

  getMoves() {
    return this._game.match(/[br]\[[^\]]*\]/g) || [];
  }

  // Iterates moves, calling cb(move) for each Move object.
  // Mirrors forEachMove in Ruby (handles swap rule, player attribution).
  forEachMove(cb) {
    let moves = this.getMoves();
    let swapped = false;

    // swap rule
    if (moves.length > 1 && moves[1] === 'r[swap]') {
      const m = moves[0];
      const x = this._getMoveFromLetter(m[2]);
      const y = this._getMoveFromLetter(m[3]);
      cb(new Move(x, y, 1));       // place white peg
      cb(new SwapMove(2));          // player 2 swaps
      moves.splice(0, 2);           // remove first two
      swapped = true;
    }

    let player = 2;
    for (const move of moves) {
      if (swapped) {
        player = ' rb'.indexOf(move[0]);
      } else {
        player = ' br'.indexOf(move[0]);
      }

      if (move.length === 5 || move.slice(4, 10) === '|draw]') {
        const x = this._getMoveFromLetter(move[2]);
        const y = this._getMoveFromLetter(move[3]);
        if (swapped) {
          cb(new Move(y, x, player));
        } else {
          cb(new Move(x, y, player));
        }
      } else if (move.slice(1, 9) === '[resign]') {
        cb(new ResignMove(player));
      } else if (move.slice(1, 7) === '[draw]') {
        cb(new DrawMove(player));
      }
    }

    if (this._forfeit) {
      cb(new ForfeitMove(3 - player));
    }
  }

  getTwixtBoard() {
    const size = this.getBoardSize();
    const board = new TwixtBoard(size, size);
    board.setPlayer(1, this.getPlayer1());
    board.setPlayer(2, this.getPlayer2());
    this.forEachMove(move => board.play(move));
    return board;
  }

  isGameOver() {
    const board = this.getTwixtBoard();
    return board.isDraw() || board.hasWonColor('white') || board.hasWonColor('black');
  }

  isGameLostOnMoves() {
    const board = this.getTwixtBoard();
    return board.hasConnectedColor('white') || board.hasConnectedColor('black');
  }

  // Simpler parser — keeps swap move and LG conventions of swapped boards.
  forEachLittleGolemMove(cb) {
    const moves = this.getMoves();
    let player = 1;

    for (const move of moves) {
      player = ' br'.indexOf(move[0]);

      if (move.length === 5 || move.slice(4, 10) === '|draw]') {
        const x = this._getMoveFromLetter(move[2]) + 1;
        const y = this._getMoveFromLetter(move[3]) + 1;
        cb(new Move(x, y, player));
      } else if (move.slice(1, 9) === '[resign]') {
        cb(new ResignMove(player));
      } else if (move.slice(1, 7) === '[draw]') {
        cb(new DrawMove(player));
      } else if (move === 'r[swap]') {
        cb(new SwapMove(player));
      }
    }

    if (this._forfeit) {
      cb(new ForfeitMove(3 - player));
    } else if (this.isGameLostOnMoves()) {
      cb(new LostMove(3 - player));
    }
  }

  getMovesList() {
    const moves = [];
    this.forEachLittleGolemMove(m => moves.push(m));
    return moves;
  }

  // Convert a zero-based coordinate index back to its letter representation.
  // 0-25 -> 'a'-'z', 26-51 -> 'A'-'Z'
  _letterFromIndex(index) {
    if (index >= 0 && index <= 25) {
      return String.fromCharCode(97 + index);
    }
    return String.fromCharCode(39 + index);
  }

  // Normalize a coordinate index to the upper-left quadrant.
  // On a board of size N, index i becomes min(i, N-1-i).
  _normalizeCoordinate(index, boardSize) {
    return Math.min(index, boardSize - 1 - index);
  }

  // Return the first move normalized to the upper-left quadrant as a 2-char string.
  // Returns null if there is no first move (e.g., empty game).
  getNormalizedFirstMove() {
    const moves = this.getMoves();
    if (!moves.length) return null;

    const first = moves[0];

    // Only coordinate moves (e.g. b[ab] or b[ab|draw]) have a normalized first move.
    // Non-coordinate moves like b[resign] return null.
    if (first.length !== 5 && first.slice(4, 10) !== '|draw]') return null;

    const boardSize = this.getBoardSize();

    const xNorm = this._normalizeCoordinate(this._getMoveFromLetter(first[2]), boardSize);
    const yNorm = this._normalizeCoordinate(this._getMoveFromLetter(first[3]), boardSize);

    return this._letterFromIndex(xNorm) + this._letterFromIndex(yNorm);
  }

  // Return whether the game used a swap (second SGF move is r[swap]).
  getSwapped() {
    const moves = this.getMoves();
    return moves.length > 1 && moves[1] === 'r[swap]';
  }

  // Called externally when we've determined the game is a forfeit via HTML scrape.
  forfeit() {
    this._forfeit = true;
  }

  getResultChar() {
    const board = this.getTwixtBoard();
    if (board.isResignation()) return 'R';
    if (board.hasConnectedColor('white') || board.hasConnectedColor('black')) return 'L';
    if (board.isDraw()) return 'D';
    if (this._forfeit) return 'F';
    return '?';
  }

  // Used by jtwixt route to generate JTwixt file data.
  forEachMoveForJtwixt(cb) {
    let moves = this.getMoves();

    // swap rule
    if (moves.length > 1 && moves[1] === 'r[swap]') {
      const m = moves[0];
      const x = this._getMoveFromLetter(m[3]) + 1;
      const y = this._getMoveFromLetter(m[2]) + 1;
      cb(x, y, 1);   // place white peg first
      cb(x, y, 2);   // then black on top
      moves.splice(0, 2);
    }

    for (const move of moves) {
      if (move.length > 4 && (move[4] === ']' || move[4] === '|')) {
        const player = ' br'.indexOf(move[0]);
        const x = this._getMoveFromLetter(move[2]) + 1;
        const y = this._getMoveFromLetter(move[3]) + 1;
        cb(x, y, player);
      }
    }
  }
}

module.exports = { LittleGolemParser };

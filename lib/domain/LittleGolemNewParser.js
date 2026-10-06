const { TwixtBoard } = require('./TwixtBoard');
const { Move, SwapMove, ResignMove, DrawMove, ForfeitMove, LostMove } = require('../../public/javascripts/move');

/**
 * Parser for the new LittleGolem JSON API response.
 *
 * lg_data for 'N' games is stored as space-separated dmoves, e.g. 'f4 t27 B24'.
 * The first entry in the API's moves array (nmove=0) is a placeholder with an
 * empty dmove and is always skipped.
 *
 * Coordinate system:
 *   dmove format is like "f4" — column letter (a-z, A-Z) + row number (1-based).
 *   Internally TwixtBoard uses 0-based (x, y) where x is the column and y is the row.
 *
 * Player assignment:
 *   In the API, players[0] is the first player (plays first, color white in SGF terms,
 *   corresponds to player 1 / 'b' in LG SGF convention). players[1] is player 2 ('r').
 *   The plid of the mover tells us which player placed a peg.
 */
class LittleGolemNewParser {
  /**
   * @param {string|object} data  Either the raw JSON string from the API, or an
   *                              already-parsed object, or the stored space-separated
   *                              dmove string (when reading back from the DB).
   * @param {object} [meta]       When reading from the DB, pass the game row so we
   *                              can reconstruct player info, board size, etc.
   *                              If data is a full API JSON object/string, meta is not needed.
   */
  constructor(data, meta = null) {
    // If data is a space-separated move string (from DB), we need meta to reconstruct context.
    if (typeof data === 'string' && meta) {
      this._fromDb = true;
      this._dmoves = data.trim() === '' ? [] : data.trim().split(' ');
      this._meta = meta;
    } else {
      this._fromDb = false;
      this._json = typeof data === 'string' ? JSON.parse(data) : data;
      this._dmoves = this._json.moves
        .filter(m => m.dmove !== '')
        .map(m => m.dmove);
    }

    this._forfeit = false;
  }

  // --- Static helpers ----------------------------------------------------------

  /**
   * Parse a dmove string like "f4" into zero-based {x, y}.
   * Column: 'a'=0 ... 'z'=25, 'A'=26 ... 'Z'=51
   * Row: numeric 1-based -> subtract 1 for zero-based y.
   */
  static dmoveToXY(dmove) {
    const col = dmove[0];
    const row = parseInt(dmove.slice(1), 10);
    const x = (col >= 'a' && col <= 'z')
      ? col.charCodeAt(0) - 97
      : col.charCodeAt(0) - 39;  // 'A'(65) - 39 = 26
    const y = row - 1;
    return { x, y };
  }

  /**
   * Build the space-separated dmove string to store in lg_data.
   * Filters out the placeholder nmove=0 entry (empty dmove).
   */
  static buildLgData(apiJson) {
    return apiJson.moves
      .filter(m => m.dmove !== '')
      .map(m => m.dmove)
      .join(' ');
  }

  // --- Metadata getters (from API JSON) ----------------------------------------

  getPlayer1() {
    if (this._fromDb) return this._meta.player1;
    return this._json.players[0].player.real_name;
  }

  getPlayer2() {
    if (this._fromDb) return this._meta.player2;
    return this._json.players[1].player.real_name;
  }

  getPlayer1Id() {
    if (this._fromDb) return this._meta.player1_id;
    return this._json.players[0].player.plid;
  }

  getPlayer2Id() {
    if (this._fromDb) return this._meta.player2_id;
    return this._json.players[1].player.plid;
  }

  getBoardSize() {
    if (this._fromDb) return this._meta.board_size;
    const variant = this._json.variant;
    if (variant === 'DEFAULT') return 24;
    const m = variant.match(/^SIZE(\d+)$/);
    return m ? parseInt(m[1], 10) : 24;
  }

  getTournament() {
    if (this._fromDb) return this._meta.tournament || '';
    return this._json.trnid || '';
  }

  isGameType(type) {
    if (this._fromDb) return true; // already validated on insert
    return this._json.gtid === type;
  }

  /**
   * API status: 0 = in progress, 1 = completed.
   */
  isCompleted() {
    if (this._fromDb) return true; // DB rows are always completed
    return this._json.status === 1;
  }

  /**
   * Determine result from the API "results" array.
   * results[i]: 0 = in progress / not set, 1 = draw share, 2 = win.
   * e.g. [2,0] = p1 won, [0,2] = p2 won, [1,1] = draw.
   */
  _getApiWinner() {
    if (this._fromDb || !this._json) return null;
    const [r0, r1] = this._json.results;
    if (r0 === 1 && r1 === 1) return 0; // draw
    if (r0 > r1) return 1; // player 1 wins
    if (r1 > r0) return 2; // player 2 wins
    return null; // in progress or unknown
  }

  // Called externally when we've determined the game is a forfeit.
  forfeit() {
    this._forfeit = true;
  }

  // --- Move iteration ----------------------------------------------------------

  /**
   * Iterate moves calling cb(Move) for each move object.
   * Player 1 goes first (plays white/horizontal edges in standard TwixtBoard terms).
   * Swap: if the second dmove is "swap" the board is swapped.
   */
  forEachMove(cb) {
    const dmoves = this._dmoves;
    let swapped = false;

    let i = 0;
    // Check for swap
    if (dmoves.length > 1 && dmoves[1].toLowerCase() === 'swap') {
      const { x, y } = LittleGolemNewParser.dmoveToXY(dmoves[0]);
      cb(new Move(x, y, 1));   // first move as white
      cb(new SwapMove(2));      // player 2 swaps
      i = 2;
      swapped = true;
    }

    for (; i < dmoves.length; i++) {
      const dmove = dmoves[i];
      if (dmove.toLowerCase() === 'resign') {
        const player = swapped
          ? (i % 2 === 0 ? 2 : 1)
          : (i % 2 === 0 ? 1 : 2);
        cb(new ResignMove(player));
        continue;
      }
      if (dmove.toLowerCase() === 'draw') {
        const player = swapped
          ? (i % 2 === 0 ? 2 : 1)
          : (i % 2 === 0 ? 1 : 2);
        cb(new DrawMove(player));
        continue;
      }

      const { x, y } = LittleGolemNewParser.dmoveToXY(dmove);
      // Player alternates: index 0 -> player 1, index 1 -> player 2, etc.
      // After a swap we continue from i=2 so the alternation is preserved.
      let player;
      if (swapped) {
        player = (i % 2 === 0) ? 2 : 1;
      } else {
        player = (i % 2 === 0) ? 1 : 2;
      }
      cb(new Move(x, y, player));
    }

    if (this._forfeit) {
      const lastPlayer = this._getLastPlayer(swapped);
      cb(new ForfeitMove(3 - lastPlayer));
    }
  }

  _getLastPlayer(swapped) {
    const n = this._dmoves.length;
    if (n === 0) return 0;
    const lastIndex = n - 1;
    if (swapped) {
      return (lastIndex % 2 === 0) ? 2 : 1;
    }
    return (lastIndex % 2 === 0) ? 1 : 2;
  }

  // --- LG-style move list (used by game view / JTwixt) -------------------------

  /**
   * Simpler iteration that keeps swap and uses 1-based LG coordinate conventions.
   * Mirrors forEachLittleGolemMove in the SGF parser.
   */
  forEachLittleGolemMove(cb) {
    const dmoves = this._dmoves;

    for (let i = 0; i < dmoves.length; i++) {
      const dmove = dmoves[i];
      const player = (i % 2 === 0) ? 1 : 2;

      if (dmove.toLowerCase() === 'swap') {
        cb(new SwapMove(player));
        continue;
      }
      if (dmove.toLowerCase() === 'resign') {
        cb(new ResignMove(player));
        continue;
      }
      if (dmove.toLowerCase() === 'draw') {
        cb(new DrawMove(player));
        continue;
      }

      const { x, y } = LittleGolemNewParser.dmoveToXY(dmove);
      // Use 1-based for LG conventions (matches what the SGF parser produces here)
      cb(new Move(x + 1, y + 1, player));
    }

    if (this._forfeit) {
      const lastPlayer = this._getLastPlayer(false);
      cb(new ForfeitMove(3 - lastPlayer));
    } else if (this.isGameLostOnMoves()) {
      const lastPlayer = this._getLastPlayer(false);
      cb(new LostMove(3 - lastPlayer));
    }
  }

  getMovesList() {
    const moves = [];
    this.forEachLittleGolemMove(m => moves.push(m));
    return moves;
  }

  // --- Board analysis ----------------------------------------------------------

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

  getResultChar() {
    const board = this.getTwixtBoard();
    if (board.isResignation()) return 'R';
    if (board.hasConnectedColor('white') || board.hasConnectedColor('black')) return 'L';
    if (board.isDraw()) return 'D';
    if (this._forfeit) return 'F';
    return '?';
  }

  // --- First-move / swap helpers (used for stats) ------------------------------

  _normalizeCoordinate(index, boardSize) {
    return Math.min(index, boardSize - 1 - index);
  }

  _letterFromIndex(index) {
    if (index >= 0 && index <= 25) return String.fromCharCode(97 + index);
    return String.fromCharCode(39 + index);
  }

  getNormalizedFirstMove() {
    if (this._dmoves.length === 0) return null;
    const first = this._dmoves[0];
    if (['swap', 'resign', 'draw'].includes(first.toLowerCase())) return null;

    const { x, y } = LittleGolemNewParser.dmoveToXY(first);
    const boardSize = this.getBoardSize();
    const xNorm = this._normalizeCoordinate(x, boardSize);
    const yNorm = this._normalizeCoordinate(y, boardSize);
    return this._letterFromIndex(xNorm) + this._letterFromIndex(yNorm);
  }

  getSwapped() {
    return this._dmoves.length > 1 && this._dmoves[1].toLowerCase() === 'swap';
  }

  // --- JTwixt helpers ----------------------------------------------------------

  forEachMoveForJtwixt(cb) {
    const dmoves = this._dmoves;

    // Handle swap
    if (dmoves.length > 1 && dmoves[1].toLowerCase() === 'swap') {
      const { x, y } = LittleGolemNewParser.dmoveToXY(dmoves[0]);
      cb(y + 1, x + 1, 1); // white peg first (JTwixt uses transposed coords)
      cb(y + 1, x + 1, 2); // then black on top
      for (let i = 2; i < dmoves.length; i++) {
        const dmove = dmoves[i];
        if (['swap', 'resign', 'draw'].includes(dmove.toLowerCase())) continue;
        const pos = LittleGolemNewParser.dmoveToXY(dmove);
        const player = (i % 2 === 0) ? 2 : 1;
        cb(pos.x + 1, pos.y + 1, player);
      }
      return;
    }

    for (let i = 0; i < dmoves.length; i++) {
      const dmove = dmoves[i];
      if (['swap', 'resign', 'draw'].includes(dmove.toLowerCase())) continue;
      const { x, y } = LittleGolemNewParser.dmoveToXY(dmove);
      const player = (i % 2 === 0) ? 1 : 2;
      cb(x + 1, y + 1, player);
    }
  }
}

module.exports = { LittleGolemNewParser };

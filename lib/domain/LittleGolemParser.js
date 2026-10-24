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
 *   Internally TwixtBoard uses 1-based (x, y) where x is the column and y is the row.
 *
 * Player assignment:
 *   In the JSON API, players[0] is the first player (color white);
 *   players[1] is the second player (color black).
 *   The plid of the mover tells us which player placed a peg.
 */
class LittleGolemParser {
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
      this._dmoves = (this._json && this._json.moves)
        ? this._json.moves.filter(m => m.dmove !== '').map(m => m.dmove)
        : [];
    }

    this._forfeit = (this._fromDb && this._meta && this._meta.result === 'F') || false;
  }

  // --- Static helpers ----------------------------------------------------------

  /**
   * Parse a dmove string like "f4" into one-based x, y coordinates.
   * Column: 'a'=1 ... 'z'=26, 'A'=27 ... 'Z'=52
   */
  static dmoveToXY(dmove) {
    const col = dmove[0];
    const x = (col >= 'a' && col <= 'z')
      ? col.charCodeAt(0) - 96   // 'a'(97) - 96 = 1
      : col.charCodeAt(0) - 38;  // 'A'(65) - 38 = 27
    const y = parseInt(dmove.slice(1), 10);
    return { x, y };
  }

  /**
   * Build the space-separated dmove string to store in lg_data.
   * Filters out the placeholder nmove=0 entry (empty dmove).
   */
  static buildLgData(apiJson) {
    return (apiJson.moves || [])
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
   * API status: 0 = in progress, 1 or 2 = completed (1 = normal finish, 2 = forfeit / timeout / abandoned).
   */
  isCompleted() {
    if (this._fromDb) return true; // DB rows are always completed
    return Boolean(this._json && this._json.status !== 0);
  }

  /**
   * Determine result from the API "results" array.
   * results[i]: 0 = in progress / not set, 1 = draw share, 2 = win.
   * e.g. [2,0] = p1 won, [0,2] = p2 won, [1,1] = draw.
   */
  _getApiWinner() {
    if (this._fromDb || !this._json || !this._json.results) return null;
    const [r0, r1] = this._json.results;
    if (r0 === 1 && r1 === 1) return 0; // draw
    if (r0 > r1) return 1; // player 1 wins
    if (r1 > r0) return 2; // player 2 wins
    return null; // in progress or unknown
  }

  // Called externally when reading from DB and game.result === 'F'.
  forfeit() {
    this._forfeit = true;
  }

  /**
   * Auto-detect forfeit from the API JSON:
   * - status === 2 is explicitly forfeited / timed out.
   * - status === 1 that is completed but last move is not resign or draw.
   */
  _isForfeitedByApi() {
    if (this._fromDb || !this._json) return false;
    if (this._json.status === 2) return true;
    if (!this.isCompleted()) return false;

    const last = this._dmoves[this._dmoves.length - 1]?.toLowerCase();
    return last !== 'resign' && last !== 'draw';
  }

  // Single source of truth: forfeit flag set explicitly (DB) OR auto-detected (API).
  _isForfeit() {
    return this._forfeit || this._isForfeitedByApi();
  }

  // Helper: In LittleGolem, turn index i corresponds to player 1 (even i) or player 2 (odd i).
  _playerForIndex(i) {
    return (i % 2 === 0) ? 1 : 2;
  }

  // The player who forfeits:
  // If 0 moves, Player 1 is on turn to move and forfeited (or based on API winner if known).
  // Otherwise, the player whose turn it was to move next forfeits: (3 - lastPlayer).
  _getForfeitingPlayer() {
    if (this._dmoves.length === 0) {
      const winner = this._getApiWinner();
      if (winner === 1) return 2;
      if (winner === 2) return 1;
      return 1;
    }
    const lastIndex = this._dmoves.length - 1;
    const lastPlayer = this._playerForIndex(lastIndex);
    return 3 - lastPlayer;
  }

  // --- Move iteration ----------------------------------------------------------

  /**
   * Iterate moves calling cb(Move) for each move object.
   * Player 1 goes first (plays white/horizontal edges in standard TwixtBoard terms).
   * Swap: if the second dmove is "swap" the board is swapped.
   */
  forEachMove(cb) {
    const dmoves = this._dmoves;
    let i = 0;

    // Check for swap
    if (dmoves.length > 1 && dmoves[1].toLowerCase() === 'swap') {
      const { x, y } = LittleGolemParser.dmoveToXY(dmoves[0]);
      cb(new Move(x, y, 1));   // first move as white
      cb(new SwapMove(2));     // player 2 swaps
      i = 2;
    }

    for (; i < dmoves.length; i++) {
      const dmove = dmoves[i];
      const player = this._playerForIndex(i);

      if (dmove.toLowerCase() === 'resign') {
        cb(new ResignMove(player));
        continue;
      }
      if (dmove.toLowerCase() === 'draw') {
        cb(new DrawMove(player));
        continue;
      }

      const { x, y } = LittleGolemParser.dmoveToXY(dmove);
      cb(new Move(x, y, player));
    }

    if (this._isForfeit()) {
      cb(new ForfeitMove(this._getForfeitingPlayer()));
    }
  }

  // --- LG-style move list (used by game view / JTwixt) -------------------------

  /**
   * Simpler iteration that keeps swap and uses 1-based LG coordinate conventions.
   */
  forEachLittleGolemMove(cb) {
    const dmoves = this._dmoves;

    for (let i = 0; i < dmoves.length; i++) {
      const dmove = dmoves[i];
      const player = this._playerForIndex(i);

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

      const { x, y } = LittleGolemParser.dmoveToXY(dmove);
      cb(new Move(x, y, player));
    }

    if (this.isGameLostOnMoves()) {
      const lastIndex = dmoves.length - 1;
      const lastPlayer = (lastIndex >= 0) ? this._playerForIndex(lastIndex) : 1;
      cb(new LostMove(3 - lastPlayer));
    } else if (this._isForfeit()) {
      cb(new ForfeitMove(this._getForfeitingPlayer()));
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
    const board = new TwixtBoard(size);
    board.setPlayer(1, this.getPlayer1());
    board.setPlayer(2, this.getPlayer2());
    this.forEachMove(move => board.play(move));
    return board;
  }

  isGameOver() {
    const board = this.getTwixtBoard();
    return board.isDraw() || board.hasWonColor(TwixtBoard.WHITE) || board.hasWonColor(TwixtBoard.BLACK);
  }

  isGameLostOnMoves() {
    const board = this.getTwixtBoard();
    return board.hasConnectedColor(TwixtBoard.WHITE) || board.hasConnectedColor(TwixtBoard.BLACK);
  }

  getResultChar() {
    const board = this.getTwixtBoard();
    if (board.isResignation()) return 'R';
    if (board.hasConnectedColor(TwixtBoard.WHITE) || board.hasConnectedColor(TwixtBoard.BLACK)) return 'L';
    if (board.isDraw()) return 'D';
    if (this._isForfeit()) return 'F';
    return '?';
  }

  // --- First-move / swap helpers (used for stats) ------------------------------

  _normalizeCoordinate(index, boardSize) {
    return Math.min(index, boardSize + 1 - index);
  }

  _letterFromIndex(index) {
    if (index >= 1 && index <= 26) return String.fromCharCode(96 + index);
    return String.fromCharCode(38 + index);
  }

  getNormalizedFirstMove() {
    if (this._dmoves.length === 0) return null;
    const first = this._dmoves[0];
    if (['swap', 'resign', 'draw'].includes(first.toLowerCase())) return null;

    const { x, y } = LittleGolemParser.dmoveToXY(first);
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
      const { x, y } = LittleGolemParser.dmoveToXY(dmoves[0]);
      cb(y, x, 1); // white peg first (JTwixt uses transposed coords)
      cb(y, x, 2); // then black on top
      for (let i = 2; i < dmoves.length; i++) {
        const dmove = dmoves[i];
        if (['swap', 'resign', 'draw'].includes(dmove.toLowerCase())) continue;
        const pos = LittleGolemParser.dmoveToXY(dmove);
        const player = this._playerForIndex(i);
        cb(pos.x, pos.y, player);
      }
      return;
    }

    for (let i = 0; i < dmoves.length; i++) {
      const dmove = dmoves[i];
      if (['swap', 'resign', 'draw'].includes(dmove.toLowerCase())) continue;
      const { x, y } = LittleGolemParser.dmoveToXY(dmove);
      const player = this._playerForIndex(i);
      cb(x, y, player);
    }
  }
}

module.exports = { LittleGolemParser };

// The browser classes in public/javascripts are globals there; emulate that
// here so TwixtBoard can resolve Peg and Link.
const { Peg } = require('../public/javascripts/peg');
const { Link } = require('../public/javascripts/link');
const { TwixtBoard } = require('../public/javascripts/twixtboard');
const { EditMove } = require('../public/javascripts/move');

globalThis.Peg = Peg;
globalThis.Link = Link;
globalThis.EditMove = EditMove;

function placePeg(board, color, x, y) {
  board.setPeg(new Peg(color, x, y));
}

describe('TwixtBoard (public/javascripts/twixtboard.js)', () => {
  describe('isLegalSpot', () => {
    const board = new TwixtBoard(5);

    test('white cannot place on the edge columns', () => {
      expect(board.isLegalSpot(1, 3, TwixtBoard.WHITE)).toBe(false);
      expect(board.isLegalSpot(5, 3, TwixtBoard.WHITE)).toBe(false);
      expect(board.isLegalSpot(3, 3, TwixtBoard.WHITE)).toBe(true);
    });

    test('black cannot place on the edge rows', () => {
      expect(board.isLegalSpot(3, 1, TwixtBoard.BLACK)).toBe(false);
      expect(board.isLegalSpot(3, 5, TwixtBoard.BLACK)).toBe(false);
      expect(board.isLegalSpot(3, 3, TwixtBoard.BLACK)).toBe(true);
    });
  });

  describe('setPeg / getPeg', () => {
    test('getPeg returns null off-board and for empty cells', () => {
      const board = new TwixtBoard(5);
      expect(board.getPeg(0, 3)).toBeNull();
      expect(board.getPeg(6, 3)).toBeNull();
      expect(board.getPeg(3, 3)).toBeNull();
    });

    test('setPeg records the peg; duplicate setPeg is ignored', () => {
      const board = new TwixtBoard(5);
      const peg = new Peg(TwixtBoard.WHITE, 3, 3);
      board.setPeg(peg);
      board.setPeg(peg);
      expect(board.getPeg(3, 3)).toBe(peg);
      expect(board.pegCount()).toBe(1);
      expect(board.getFirstPeg()).toBe(peg);
    });
  });

  describe('link / canLink / isLinkable', () => {
    test('linking the same pair twice is rejected', () => {
      const board = new TwixtBoard(5);
      placePeg(board, TwixtBoard.WHITE, 2, 1);
      placePeg(board, TwixtBoard.WHITE, 3, 3);

      expect(board.link(2, 1, 3, 3)).toBeInstanceOf(Link);
      expect(board.canLink(2, 1, 3, 3)).toBe(false);
      expect(board.link(2, 1, 3, 3)).toBeNull();
      expect(board.isLinkable(2, 1)).toBe(false);
    });

    test('different-colored pegs cannot be linked', () => {
      const board = new TwixtBoard(5);
      placePeg(board, TwixtBoard.WHITE, 2, 1);
      placePeg(board, TwixtBoard.BLACK, 3, 3);

      expect(board.canLink(2, 1, 3, 3)).toBe(false);
    });

    test('isLinkable is true for an unlinked knight-move neighbor', () => {
      const board = new TwixtBoard(5);
      placePeg(board, TwixtBoard.WHITE, 2, 1);
      placePeg(board, TwixtBoard.WHITE, 3, 3);

      expect(board.isLinkable(2, 1)).toBe(true);
      expect(board.isLinkable(9, 9)).toBe(false);
    });
  });

  describe('crossing links', () => {
    // x-y grid (5x5):
    //   . W B . .
    //   . .\. . .
    //   . B W . .
    //   . . . . .
    //   . . . . .
    // The white link (2,1)-(3,3) crosses the black link (3,1)-(2,3).
    function crossedBoard(policy) {
      const board = new TwixtBoard(5, policy);
      placePeg(board, TwixtBoard.WHITE, 2, 1);
      placePeg(board, TwixtBoard.WHITE, 3, 3);
      placePeg(board, TwixtBoard.BLACK, 3, 1);
      placePeg(board, TwixtBoard.BLACK, 2, 3);
      board.link(2, 1, 3, 3);
      return board;
    }

    test('PENCIL_AND_PAPER: opponent crossing is blocked', () => {
      const board = crossedBoard(TwixtBoard.PENCIL_AND_PAPER);
      expect(board.canLink(3, 1, 2, 3)).toBe(false);
    });

    test('LINK_REMOVAL: any crossing is blocked', () => {
      const board = crossedBoard(TwixtBoard.LINK_REMOVAL);
      expect(board.canLink(3, 1, 2, 3)).toBe(false);

      const sameColor = new TwixtBoard(5, TwixtBoard.LINK_REMOVAL);
      placePeg(sameColor, TwixtBoard.WHITE, 2, 1);
      placePeg(sameColor, TwixtBoard.WHITE, 3, 3);
      placePeg(sameColor, TwixtBoard.WHITE, 3, 1);
      placePeg(sameColor, TwixtBoard.WHITE, 2, 3);
      sameColor.link(2, 1, 3, 3);
      expect(sameColor.canLink(3, 1, 2, 3)).toBe(false);
    });

    test('PENCIL_AND_PAPER: same-color crossing is allowed', () => {
      const board = crossedBoard(TwixtBoard.PENCIL_AND_PAPER);
      const peg1 = board.getPeg(3, 1);
      peg1.color = TwixtBoard.WHITE; // make the "black" pair white
      const peg2 = board.getPeg(2, 3);
      peg2.color = TwixtBoard.WHITE;
      expect(board.canLink(3, 1, 2, 3)).toBe(true);
    });
  });

  describe('winner', () => {
    test('detects a white connection from bottom to top', () => {
      const board = new TwixtBoard(5);
      placePeg(board, TwixtBoard.WHITE, 2, 1);
      placePeg(board, TwixtBoard.WHITE, 3, 3);
      placePeg(board, TwixtBoard.WHITE, 2, 5);
      board.link(2, 1, 3, 3);
      board.link(3, 3, 2, 5);
      expect(board.winner()).toBe('White');
    });

    test('detects a black connection from left to right', () => {
      const board = new TwixtBoard(5);
      placePeg(board, TwixtBoard.BLACK, 1, 3);
      placePeg(board, TwixtBoard.BLACK, 3, 4);
      placePeg(board, TwixtBoard.BLACK, 5, 3);
      board.link(1, 3, 3, 4);
      board.link(3, 4, 5, 3);
      expect(board.winner()).toBe('Black');
    });

    test('returns null when nothing is connected', () => {
      const board = new TwixtBoard(5);
      placePeg(board, TwixtBoard.WHITE, 2, 1);
      placePeg(board, TwixtBoard.WHITE, 3, 3);
      expect(board.winner()).toBeNull();
    });
  });
});

const { TwixtNotation } = require('../public/javascripts/notation');
const { TwixtBoard } = require('../public/javascripts/twixtboard');
const { Peg } = require('../public/javascripts/peg');

describe('TwixtNotation', () => {
  describe('letterToX', () => {
    test('converts lowercase letters 1-26 for standard 24x24 board', () => {
      expect(TwixtNotation.letterToX('a', 24)).toBe(1);
      expect(TwixtNotation.letterToX('b', 24)).toBe(2);
      expect(TwixtNotation.letterToX('f', 24)).toBe(6);
      expect(TwixtNotation.letterToX('x', 24)).toBe(24);
    });

    test('case-insensitive on boards < 27', () => {
      expect(TwixtNotation.letterToX('A', 24)).toBe(1);
      expect(TwixtNotation.letterToX('F', 24)).toBe(6);
    });

    test('handles 52-column notation for large boards (size >= 27)', () => {
      expect(TwixtNotation.letterToX('a', 30)).toBe(1);
      expect(TwixtNotation.letterToX('z', 30)).toBe(26);
      expect(TwixtNotation.letterToX('A', 30)).toBe(27);
      expect(TwixtNotation.letterToX('B', 30)).toBe(28);
    });
  });

  describe('getPegCoordinates', () => {
    test('extracts [x, y] from simple peg move', () => {
      expect(TwixtNotation.getPegCoordinates('f4', 24)).toEqual([6, 4]);
      expect(TwixtNotation.getPegCoordinates('a1', 24)).toEqual([1, 1]);
      expect(TwixtNotation.getPegCoordinates('t20', 24)).toEqual([20, 20]);
    });

    test('extracts [x, y] ignoring link addition and removal prefixes', () => {
      expect(TwixtNotation.getPegCoordinates("-a'3d5", 24)).toEqual([4, 5]);
      expect(TwixtNotation.getPegCoordinates("/b4'\\c'6e7", 24)).toEqual([5, 7]);
    });
  });

  describe('parseMove', () => {
    test('parses swap', () => {
      expect(TwixtNotation.parseMove('swap')).toEqual({
        isSwap: true,
        actions: [],
        peg: null
      });
      expect(TwixtNotation.parseMove('SWAP')).toEqual({
        isSwap: true,
        actions: [],
        peg: null
      });
    });

    test('parses standard peg placement without link changes', () => {
      const parsed = TwixtNotation.parseMove('f4', 24);
      expect(parsed.isSwap).toBe(false);
      expect(parsed.actions).toEqual([]);
      expect(parsed.peg).toEqual({ x: 6, y: 4 });
    });

    test('parses link removals and additions with peg placement', () => {
      const parsed = TwixtNotation.parseMove("-a'3/b4'\\c'6d5", 24);
      expect(parsed.isSwap).toBe(false);
      expect(parsed.actions).toEqual([
        { prefix: '-', notation: "a'3" },
        { prefix: '/', notation: "b4'" },
        { prefix: '\\', notation: "c'6" }
      ]);
      expect(parsed.peg).toEqual({ x: 4, y: 5 });
    });
  });

  describe('parseLinkEndpoints', () => {
    test('parses case A (dx=1, dy=2) backslash', () => {
      // "b'4" with "\" -> xVal=2, yVal=4 -> (2, 3) to (3, 5)
      const endpoints = TwixtNotation.parseLinkEndpoints("b'4", '\\', 24);
      expect(endpoints).toEqual({ x1: 2, y1: 3, x2: 3, y2: 5 });
    });

    test('parses case A (dx=1, dy=2) slash', () => {
      // "b'4" with "/" -> xVal=2, yVal=4 -> (2, 5) to (3, 3)
      const endpoints = TwixtNotation.parseLinkEndpoints("b'4", '/', 24);
      expect(endpoints).toEqual({ x1: 2, y1: 5, x2: 3, y2: 3 });
    });

    test('parses case B (dx=2, dy=1) backslash', () => {
      // "c4'" with "\" -> xVal=3, yVal=4 -> (2, 4) to (4, 5)
      const endpoints = TwixtNotation.parseLinkEndpoints("c4'", '\\', 24);
      expect(endpoints).toEqual({ x1: 2, y1: 4, x2: 4, y2: 5 });
    });

    test('parses case B (dx=2, dy=1) slash', () => {
      // "c4'" with "/" -> xVal=3, yVal=4 -> (2, 5) to (4, 4)
      const endpoints = TwixtNotation.parseLinkEndpoints("c4'", '/', 24);
      expect(endpoints).toEqual({ x1: 2, y1: 5, x2: 4, y2: 4 });
    });

    test('returns null for invalid link notation', () => {
      expect(TwixtNotation.parseLinkEndpoints('invalid', '\\', 24)).toBeNull();
    });
  });

  describe('findLink on board', () => {
    test('finds existing link by midpoint notation', () => {
      const board = new TwixtBoard(24);
      // Link between (2, 3) and (3, 5) -> case A midpoint "b'4"
      const p1 = new Peg(TwixtBoard.WHITE, 2, 3);
      const p2 = new Peg(TwixtBoard.WHITE, 3, 5);
      board.setPeg(p1);
      board.setPeg(p2);
      const link = board.link(2, 3, 3, 5);
      expect(link).not.toBeNull();

      const found = TwixtNotation.findLink("b'4", board);
      expect(found).toBe(link);
    });

    test('returns null if link does not exist', () => {
      const board = new TwixtBoard(24);
      expect(TwixtNotation.findLink("b'4", board)).toBeNull();
    });
  });

  describe('validateMove & validateCommentMoves', () => {
    test('reports error when swapping on empty board', () => {
      const board = new TwixtBoard(24);
      const err = TwixtNotation.validateMove('swap', board, 1, 0);
      expect(err).toBe('- Cannot swap as the first move of the game.');
    });

    test('reports error when swapping with more than one peg', () => {
      const board = new TwixtBoard(24);
      board.setPeg(new Peg(TwixtBoard.WHITE, 2, 3));
      board.setPeg(new Peg(TwixtBoard.BLACK, 4, 5));
      const err = TwixtNotation.validateMove('swap', board, 1, 0);
      expect(err).toBe('- Cannot swap. There is more than one peg on the board.');
    });

    test('allows swap when exactly 1 peg is on board', () => {
      const board = new TwixtBoard(24);
      board.setPeg(new Peg(TwixtBoard.WHITE, 2, 3));
      expect(TwixtNotation.validateMove('swap', board, 0, 0)).toBe('');
    });

    test('reports error if spot is already occupied', () => {
      const board = new TwixtBoard(24);
      board.setPeg(new Peg(TwixtBoard.WHITE, 4, 4));
      const err = TwixtNotation.validateMove('d4', board, 0, 0);
      expect(err).toContain('already a peg on that spot');
    });

    test('reports error if spot is illegal for player turn', () => {
      const board = new TwixtBoard(24);
      // White (turn 1) cannot play on row 1 column 1 or outer columns x=1, x=size
      const err = TwixtNotation.validateMove('a4', board, 1, 0);
      expect(err).toContain('Illegal spot for peg');
    });

    test('valid sequence produces no errors', () => {
      const board = new TwixtBoard(24);
      const errors = TwixtNotation.validateCommentMoves(['d4', 'e6', 'f8'], board, 1);
      expect(errors).toBe('');
    });
  });
});


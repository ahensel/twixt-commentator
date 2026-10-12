const { LittleGolemNewParser } = require('../lib/domain/LittleGolemNewParser');
const { Move, SwapMove, ResignMove, DrawMove, ForfeitMove, LostMove } = require('../public/javascripts/move');

describe('LittleGolemNewParser', () => {
  describe('Static helpers', () => {
    test('dmoveToXY converts column letters and 1-based rows', () => {
      expect(LittleGolemNewParser.dmoveToXY('a1')).toEqual({ x: 0, y: 0 });
      expect(LittleGolemNewParser.dmoveToXY('f4')).toEqual({ x: 5, y: 3 });
      expect(LittleGolemNewParser.dmoveToXY('z24')).toEqual({ x: 25, y: 23 });
      expect(LittleGolemNewParser.dmoveToXY('A1')).toEqual({ x: 26, y: 0 });
      expect(LittleGolemNewParser.dmoveToXY('B24')).toEqual({ x: 27, y: 23 });
    });

    test('buildLgData joins non-empty dmoves', () => {
      const apiJson = {
        moves: [
          { nmove: 0, dmove: '' },
          { nmove: 1, dmove: 'f4' },
          { nmove: 2, dmove: 'swap' },
          { nmove: 3, dmove: 't20' }
        ]
      };
      expect(LittleGolemNewParser.buildLgData(apiJson)).toBe('f4 swap t20');
    });
  });

  describe('Forfeit detection on 0 moves', () => {
    const zeroMoveApiJson = {
      gtid: 'twixt',
      status: 1,
      variant: 'DEFAULT',
      results: [0, 2], // player 2 won
      players: [
        { player: { plid: 101, real_name: 'Alice' } },
        { player: { plid: 102, real_name: 'Bob' } }
      ],
      moves: [
        { nmove: 0, dmove: '' }
      ]
    };

    test('detects forfeit on completed API game with 0 moves', () => {
      const parser = new LittleGolemNewParser(zeroMoveApiJson);
      expect(parser.isCompleted()).toBe(true);
      expect(parser.getResultChar()).toBe('F');

      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(1);
      expect(movesList[0]).toBeInstanceOf(ForfeitMove);
      // Alice (player 1) forfeited on move 0, so player 1 forfeited
      expect(movesList[0].player).toBe(1);
    });

    test('detects forfeit when loaded from DB with result = "F"', () => {
      const meta = {
        player1: 'Alice',
        player2: 'Bob',
        player1_id: 101,
        player2_id: 102,
        result: 'F',
        board_size: 24
      };
      const parser = new LittleGolemNewParser('', meta);
      expect(parser.getResultChar()).toBe('F');

      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(1);
      expect(movesList[0]).toBeInstanceOf(ForfeitMove);
      expect(movesList[0].player).toBe(1);
    });

    test('board evaluation handles 0-move forfeit', () => {
      const parser = new LittleGolemNewParser(zeroMoveApiJson);
      const board = parser.getTwixtBoard();
      expect(board.isForfeit()).toBe(true);
      expect(board.hasWonPlayer(2)).toBe(true);
      expect(board.hasWonPlayer(1)).toBe(false);
      expect(board.winner()).toBe(2);
    });

    test('handles status: 2 forfeited 0-move game like game 2566016', () => {
      const rawApiJson = {"gid":2566016,"gtid":"twixt","variant":"DEFAULT","players":[{"player":{"plid":42052,"real_name":"Andrew Boniface","membership":false,"country":"US"},"rating":1298.427,"deviation":30},{"player":{"plid":7228,"real_name":"gamestalker","membership":false,"country":"US"},"rating":1268.8358,"deviation":30}],"status":2,"results":[0,2],"onmove":42052,"expire_time":1790484446030,"chngr":[0,0],"moves":[{"nmove":0,"plid":1,"movetime":1789620179159,"jmove":"","dmove":""}],"messages":[],"ulid":"01M4RWF3P5MGWY05KJW4TQTF9C","time":[864000000,864000000],"points":[0,0],"tournament":"ld","trnid":"twixt.ld.DEFAULT"};
      const parser = new LittleGolemNewParser(rawApiJson);
      expect(parser.isCompleted()).toBe(true);
      expect(parser.getResultChar()).toBe('F');
      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(1);
      expect(movesList[0]).toBeInstanceOf(ForfeitMove);
      expect(movesList[0].player).toBe(1); // Andrew Boniface forfeited
      const board = parser.getTwixtBoard();
      expect(board.winner()).toBe(2);
    });
  });

  describe('Forfeit detection on multi-move games', () => {
    test('detects forfeit when completed game ends without resign/draw/connection', () => {
      const apiJson = {
        gtid: 'twixt',
        status: 1,
        variant: 'DEFAULT',
        results: [2, 0], // player 1 won because player 2 forfeited
        players: [
          { player: { plid: 101, real_name: 'Alice' } },
          { player: { plid: 102, real_name: 'Bob' } }
        ],
        moves: [
          { nmove: 0, dmove: '' },
          { nmove: 1, dmove: 'f4' } // Alice played f4, then Bob timed out
        ]
      };
      const parser = new LittleGolemNewParser(apiJson);
      expect(parser.getResultChar()).toBe('F');

      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(2);
      expect(movesList[0]).toBeInstanceOf(Move);
      expect(movesList[0].player).toBe(1);
      expect(movesList[1]).toBeInstanceOf(ForfeitMove);
      // Last move was by player 1, so forfeit is by player 2
      expect(movesList[1].player).toBe(2);

      const board = parser.getTwixtBoard();
      expect(board.winner()).toBe(1);
    });
  });

  describe('Swap handling in LittleGolem games', () => {
    test('marks getSwapped() true when move 2 is swap', () => {
      const parser = new LittleGolemNewParser('f4 swap t20', {
        player1: 'Alice', player2: 'Bob', board_size: 24, result: 'R'
      });
      expect(parser.getSwapped()).toBe(true);
    });

    test('forEachLittleGolemMove emits SwapMove without altering player alternating order', () => {
      const parser = new LittleGolemNewParser('f4 swap t20 resign', {
        player1: 'Alice', player2: 'Bob', board_size: 24, result: 'R'
      });
      const moves = parser.getMovesList();
      expect(moves.length).toBe(4);
      expect(moves[0]).toBeInstanceOf(Move);
      expect(moves[0].player).toBe(1);
      expect(moves[1]).toBeInstanceOf(SwapMove);
      expect(moves[1].player).toBe(2);
      expect(moves[2]).toBeInstanceOf(Move);
      expect(moves[2].player).toBe(1);
      expect(moves[3]).toBeInstanceOf(ResignMove);
      expect(moves[3].player).toBe(2);
    });

    test('forEachMove handles LittleGolem swap transposition and player assignment', () => {
      // In LittleGolem, Player 1 plays f4 (col 5, row 3).
      // Player 2 swaps.
      // Under LG rules, the first peg is transposed to (3, 5) and becomes black.
      // Player 1 then plays the next move.
      const parser = new LittleGolemNewParser('f4 swap d6', {
        player1: 'Alice', player2: 'Bob', board_size: 24, result: 'R'
      });
      const moves = [];
      parser.forEachMove(m => moves.push(m));

      expect(moves[0]).toBeInstanceOf(Move);
      expect(moves[0].x).toBe(5);
      expect(moves[0].y).toBe(3);
      expect(moves[0].player).toBe(1);

      expect(moves[1]).toBeInstanceOf(SwapMove);
      expect(moves[1].player).toBe(2);

      expect(moves[2]).toBeInstanceOf(Move);
      // Next move d6: col 'd' is 3, row 6 is 5
      expect(moves[2].x).toBe(3);
      expect(moves[2].y).toBe(5);
      expect(moves[2].player).toBe(1);
    });

    test('forEachMoveForJtwixt produces correct moves for swapped game', () => {
      const parser = new LittleGolemNewParser('f4 swap d6', {
        player1: 'Alice', player2: 'Bob', board_size: 24, result: 'R'
      });
      const jtwixtCalls = [];
      parser.forEachMoveForJtwixt((x, y, player) => {
        jtwixtCalls.push({ x, y, player });
      });

      // Swap places white peg then black on top with transposed coords
      expect(jtwixtCalls[0]).toEqual({ x: 4, y: 6, player: 1 });
      expect(jtwixtCalls[1]).toEqual({ x: 4, y: 6, player: 2 });
      // Next move d6: x='d'(4), y=6, player=1
      expect(jtwixtCalls[2]).toEqual({ x: 4, y: 6, player: 1 });
    });
  });

  describe('Resignation and Draw moves', () => {
    test('handles resign correctly', () => {
      const parser = new LittleGolemNewParser('f4 e5 resign', {
        player1: 'Alice', player2: 'Bob', board_size: 24, result: 'R'
      });
      expect(parser.getResultChar()).toBe('R');
      const moves = parser.getMovesList();
      expect(moves[2]).toBeInstanceOf(ResignMove);
      expect(moves[2].player).toBe(1); // 3rd move in 0-indexed is move index 2 -> player 1
    });

    test('handles draw correctly', () => {
      const parser = new LittleGolemNewParser('f4 e5 draw', {
        player1: 'Alice', player2: 'Bob', board_size: 24, result: 'D'
      });
      expect(parser.getResultChar()).toBe('D');
      const moves = parser.getMovesList();
      expect(moves[2]).toBeInstanceOf(DrawMove);
      expect(moves[2].player).toBe(1);
    });
  });

  describe('Metadata and variant handling', () => {
    test('extracts board size from variant', () => {
      const parserDefault = new LittleGolemNewParser({
        variant: 'DEFAULT',
        moves: [],
        players: [{ player: {} }, { player: {} }]
      });
      expect(parserDefault.getBoardSize()).toBe(24);

      const parser30 = new LittleGolemNewParser({
        variant: 'SIZE30',
        moves: [],
        players: [{ player: {} }, { player: {} }]
      });
      expect(parser30.getBoardSize()).toBe(30);

      const parser48 = new LittleGolemNewParser({
        variant: 'SIZE48',
        moves: [],
        players: [{ player: {} }, { player: {} }]
      });
      expect(parser48.getBoardSize()).toBe(48);
    });
  });
});

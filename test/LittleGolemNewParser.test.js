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
      const rawApiJson = {"gid":2566016,"gtid":"twixt","variant":"DEFAULT","players":[{"player":{"plid":4,"real_name":"Alice","membership":false,"country":"US"},"rating":1298.427,"deviation":30},{"player":{"plid":7,"real_name":"Bob","membership":false,"country":"US"},"rating":1268.8358,"deviation":30}],"status":2,"results":[0,2],"onmove":42052,"expire_time":1790484446030,"chngr":[0,0],"moves":[{"nmove":0,"plid":1,"movetime":1789620179159,"jmove":"","dmove":""}],"messages":[],"ulid":"01M4RWF3P5MGWY05KJW4TQTF9C","time":[864000000,864000000],"points":[0,0],"tournament":"ld","trnid":"twixt.ld.DEFAULT"};
      const parser = new LittleGolemNewParser(rawApiJson);
      expect(parser.isCompleted()).toBe(true);
      expect(parser.getResultChar()).toBe('F');
      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(1);
      expect(movesList[0]).toBeInstanceOf(ForfeitMove);
      expect(movesList[0].player).toBe(1);
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

    describe("Resign after swap (regression: game 2565947)", () => {
      const gameJson = {
        gid: 2565947,
        gtid: "twixt",
        variant: "DEFAULT",
        players: [
          {
            player: {
              plid: 2,
              real_name: "Alice",
              membership: false,
              country: "SE",
            },
            rating: 1972.5,
            deviation: 30,
          },
          {
            player: {
              plid: 10,
              real_name: "Bob",
              membership: false,
              country: "SI",
            },
            rating: 2023.432,
            deviation: 30,
          },
        ],
        status: 1,
        results: [2, 0],
        moves: [
          { nmove: 0, plid: 1, movetime: 1789561948493, jmove: "", dmove: "" },
          {
            nmove: 1,
            plid: 2,
            jmove: "ju",
            dmove: "j21",
          },
          {
            nmove: 2,
            plid: 10,
            jmove: "swap",
            dmove: "swap",
          },
          {
            nmove: 3,
            plid: 2,
            jmove: "lk",
            dmove: "l11",
          },
          {
            nmove: 4,
            plid: 10,
            jmove: "ln",
            dmove: "l14",
          },
          {
            nmove: 5,
            plid: 2,
            jmove: "pn",
            dmove: "p14",
          },
          {
            nmove: 6,
            plid: 10,
            jmove: "og",
            dmove: "o7",
          },
          {
            nmove: 7,
            plid: 2,
            jmove: "ih",
            dmove: "i8",
          },
          {
            nmove: 8,
            plid: 10,
            jmove: "lr",
            dmove: "l18",
          },
          {
            nmove: 9,
            plid: 2,
            jmove: "so",
            dmove: "s15",
          },
          {
            nmove: 10,
            plid: 10,
            jmove: "ok",
            dmove: "o11",
          },
          {
            nmove: 11,
            plid: 2,
            jmove: "nj",
            dmove: "n10",
          },
          {
            nmove: 12,
            plid: 10,
            jmove: "nm",
            dmove: "n13",
          },
          {
            nmove: 13,
            plid: 2,
            jmove: "pk",
            dmove: "p11",
          },
          {
            nmove: 14,
            plid: 10,
            jmove: "ql",
            dmove: "q12",
          },
          {
            nmove: 15,
            plid: 2,
            jmove: "rl",
            dmove: "r12",
          },
          {
            nmove: 16,
            plid: 10,
            jmove: "sm",
            dmove: "s13",
          },
          {
            nmove: 17,
            plid: 2,
            jmove: "tm",
            dmove: "t13",
          },
          {
            nmove: 18,
            plid: 10,
            jmove: "sq",
            dmove: "s17",
          },
          {
            nmove: 19,
            plid: 2,
            jmove: "jp",
            dmove: "j16",
          },
          {
            nmove: 20,
            plid: 10,
            jmove: "kp",
            dmove: "k16",
          },
          {
            nmove: 21,
            plid: 2,
            jmove: "ho",
            dmove: "h15",
          },
          {
            nmove: 22,
            plid: 10,
            jmove: "ik",
            dmove: "i11",
          },
          {
            nmove: 23,
            plid: 2,
            jmove: "hm",
            dmove: "h13",
          },
          {
            nmove: 24,
            plid: 10,
            jmove: "hr",
            dmove: "h18",
          },
          {
            nmove: 25,
            plid: 2,
            jmove: "hq",
            dmove: "h17",
          },
          {
            nmove: 26,
            plid: 10,
            jmove: "jm",
            dmove: "j13",
          },
          {
            nmove: 27,
            plid: 2,
            jmove: "gk",
            dmove: "g11",
          },
          {
            nmove: 28,
            plid: 10,
            jmove: "he",
            dmove: "h5",
          },
          {
            nmove: 29,
            plid: 2,
            jmove: "gg",
            dmove: "g7",
          },
          {
            nmove: 30,
            plid: 10,
            jmove: "gc",
            dmove: "g3",
          },
          {
            nmove: 31,
            plid: 2,
            jmove: "jf",
            dmove: "j6",
          },
          {
            nmove: 32,
            plid: 10,
            jmove: "resign",
            dmove: "resign",
          },
        ],
        tournament: "ld",
        trnid: "twixt.ld.DEFAULT",
      };

      test("player 2 resigns after swap: player 1 (Alice) should win", () => {
        const parser = new LittleGolemNewParser(gameJson);
        expect(parser.getResultChar()).toBe("R");
        const board = parser.getTwixtBoard();
        expect(board.isResignation()).toBe(true);
        // After swap, player 1 is black, player 2 is white. Player 2 resigned → player 1 wins.
        expect(board.hasWonPlayer(1)).toBe(true);
        expect(board.hasWonPlayer(2)).toBe(false);
        expect(board.winner()).toBe(1);
      });

      test("minimal swap+resign: last mover player 2 resigns, player 1 wins", () => {
        // f4 swap e5 resign  → resign is index 3 (player 2), but after swap player 2 is 'white'
        const parser = new LittleGolemNewParser("f4 swap e5 resign", {
          player1: "Alice",
          player2: "Bob",
          board_size: 24,
          result: "R",
        });
        expect(parser.getResultChar()).toBe("R");
        const board = parser.getTwixtBoard();
        expect(board.isResignation()).toBe(true);
        expect(board.winner()).toBe(1); // player 1 wins; player 2 resigned
      });
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

  describe('number of pegs', () => {
    test('counts number of pegs correctly', () => {
      const parser = new LittleGolemNewParser('F17 swap F17',
        { player1: 'Alice', player2: 'Bob', board_size: 48, result: 'R' });
      expect(parser.getTwixtBoard().numPegs()).toBe(2);
    });
  })

  describe('Game won by connection (LostMove)', () => {
    const connectedGameJson = {"gid":143962,"gtid":"twixt","variant":"DEFAULT","players":[{"player":{"plid":4,"real_name":"Alice","membership":false,"country":"US"},"rating":1500,"deviation":60},{"player":{"plid":7,"real_name":"Bob","membership":false,"country":"US"},"rating":1500,"deviation":60}],"status":2,"results":[2,0],"onmove":0,"expire_time":1080144988331,"chngr":[0,0],"moves":[{"nmove":0,"plid":1,"movetime":1079117955853,"jmove":"","dmove":""},{"nmove":1,"plid":4,"movetime":1079128379677,"jmove":"nv","dmove":"n22"},{"nmove":2,"plid":7,"movetime":1079272256440,"jmove":"pt","dmove":"p20"},{"nmove":3,"plid":4,"movetime":1079273463275,"jmove":"mt","dmove":"m20"},{"nmove":4,"plid":7,"movetime":1079375561051,"jmove":"ow","dmove":"o23"},{"nmove":5,"plid":4,"movetime":1079377348243,"jmove":"mx","dmove":"m24"},{"nmove":6,"plid":7,"movetime":1079383429336,"jmove":"ns","dmove":"n19"},{"nmove":7,"plid":4,"movetime":1079410041011,"jmove":"lr","dmove":"l18"},{"nmove":8,"plid":7,"movetime":1079543956792,"jmove":"jh","dmove":"j8"},{"nmove":9,"plid":4,"movetime":1079582426288,"jmove":"lj","dmove":"l10"},{"nmove":10,"plid":7,"movetime":1079635570301,"jmove":"lg","dmove":"l7"},{"nmove":11,"plid":4,"movetime":1079655052167,"jmove":"og","dmove":"o7"},{"nmove":12,"plid":7,"movetime":1079663217869,"jmove":"nh","dmove":"n8"},{"nmove":13,"plid":4,"movetime":1079705318708,"jmove":"ni","dmove":"n9"},{"nmove":14,"plid":7,"movetime":1079720757418,"jmove":"of","dmove":"o6"},{"nmove":15,"plid":4,"movetime":1079792193455,"jmove":"pe","dmove":"p5"},{"nmove":16,"plid":7,"movetime":1079817615496,"jmove":"pd","dmove":"p4"},{"nmove":17,"plid":4,"movetime":1079961925119,"jmove":"qc","dmove":"q3"},{"nmove":18,"plid":7,"movetime":1079965586402,"jmove":"qb","dmove":"q2"},{"nmove":19,"plid":4,"movetime":1079967325774,"jmove":"ra","dmove":"r1"},{"nmove":20,"plid":7,"movetime":1079993552865,"jmove":"kj","dmove":"k10"},{"nmove":21,"plid":4,"movetime":1080053327315,"jmove":"ml","dmove":"m12"},{"nmove":22,"plid":7,"movetime":1080067663826,"jmove":"ll","dmove":"l12"},{"nmove":23,"plid":4,"movetime":1080079126457,"jmove":"ln","dmove":"l14"},{"nmove":24,"plid":7,"movetime":1080079824570,"jmove":"lp","dmove":"l16"},{"nmove":25,"plid":4,"movetime":1080144988329,"jmove":"kp","dmove":"k16"}],"messages":[],"ulid":"01M4SKCNBPQP12C83NB86RF0SB","time":[864000000,864000000],"points":[0,0],"tournament":"FR","trnid":""};

    test('detects win by connection and appends LostMove for the losing player', () => {
      const parser = new LittleGolemNewParser(connectedGameJson);
      expect(parser.isCompleted()).toBe(true);
      expect(parser.isGameOver()).toBe(true);
      expect(parser.isGameLostOnMoves()).toBe(true);
      expect(parser.getResultChar()).toBe('L');

      const board = parser.getTwixtBoard();
      expect(board.hasWonPlayer(1)).toBe(true);
      expect(board.hasWonPlayer(2)).toBe(false);
      expect(board.winner()).toBe(1);

      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(26); // 25 peg moves + 1 LostMove
      const lastMove = movesList[movesList.length - 1];
      expect(lastMove).toBeInstanceOf(LostMove);
      expect(lastMove.player).toBe(2); // Player 2 lost on moves
      expect(lastMove.text).toBe('lost');
    });

    test('handles connection win when loaded from DB with result = "L"', () => {
      const dmoves = 'n22 p20 m20 o23 m24 n19 l18 j8 l10 l7 o7 n8 n9 o6 p5 p4 q3 q2 r1 k10 m12 l12 l14 l16 k16';
      const meta = {
        player1: 'Alice',
        player2: 'Bob',
        board_size: 24,
        result: 'L'
      };
      const parser = new LittleGolemNewParser(dmoves, meta);
      expect(parser.getResultChar()).toBe('L');
      expect(parser.isGameLostOnMoves()).toBe(true);

      const board = parser.getTwixtBoard();
      expect(board.hasWonPlayer(1)).toBe(true);
      expect(board.winner()).toBe(1);

      const movesList = parser.getMovesList();
      expect(movesList.length).toBe(26);
      expect(movesList[25]).toBeInstanceOf(LostMove);
      expect(movesList[25].player).toBe(2);
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

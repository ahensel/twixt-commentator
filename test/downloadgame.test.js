jest.mock('../models', () => ({ Game: {} }));

const { decodeVariation, buildTargetGame } = require('../routes/downloadgame');
const { LittleGolemParser } = require('../lib/domain/LittleGolemParser');
const { TwixtbotFormatter } = require('../lib/domain/TwixtbotFormatter');

describe('Variation Download Backend Handling', () => {
  describe('decodeVariation', () => {
    it('decodes standard 2-letter peg moves', () => {
      // 'f' (col 5) + 'd' (row 3) -> f4
      // 'e' (col 4) + 'b' (row 1) -> e2
      expect(decodeVariation('fdeb')).toEqual(['f4', 'e2']);
    });

    it('decodes uppercase letters for coordinates beyond 26', () => {
      // 'A' (col 26) + 'a' (row 0) -> A1
      // 'z' (col 25) + 'x' (row 23) -> z24
      expect(decodeVariation('Aazx')).toEqual(['A1', 'z24']);
    });

    it('decodes double tilde (~~) as swap', () => {
      expect(decodeVariation('fd~~')).toEqual(['f4', 'swap']);
      expect(decodeVariation('~~Aa')).toEqual(['swap', 'A1']);
    });

    it('handles empty or truncated variation string gracefully', () => {
      expect(decodeVariation('')).toEqual([]);
      expect(decodeVariation('f')).toEqual([]);
      expect(decodeVariation('fdebk')).toEqual(['f4', 'e2']);
    });
  });

  describe('buildTargetGame', () => {
    const baseGame = {
      player1: 'Alice',
      player2: 'Bob',
      board_size: 24,
      lg_data: 'f4 swap t20 c15 resign',
      result: 'R',
    };

    it('returns unmodified game when currentMoveNum is missing or empty', () => {
      expect(buildTargetGame(baseGame, undefined, undefined)).toBe(baseGame);
      expect(buildTargetGame(baseGame, '', '')).toBe(baseGame);
      expect(buildTargetGame(baseGame, null, null)).toBe(baseGame);
    });

    it('truncates main line without terminal moves when currentMoveNum is specified', () => {
      const truncated = buildTargetGame(baseGame, '2', undefined);
      expect(truncated.lg_data).toBe('f4 swap');
      expect(truncated.result).toBeNull();
    });

    it('truncates main line to 0 moves if currentMoveNum is 0', () => {
      const truncated = buildTargetGame(baseGame, '0', undefined);
      expect(truncated.lg_data).toBe('');
    });

    it('appends decoded variation moves to truncated main line', () => {
      // At move 2 ('f4 swap'), user adds 't20' (t=19 -> 't', 20=19 -> 't') and 'd6' (d=3 -> 'd', 6=5 -> 'f')
      const variationGame = buildTargetGame(baseGame, '2', 'ttdf');
      expect(variationGame.lg_data).toBe('f4 swap t20 d6');
    });

    it('handles swap in variation', () => {
      // Starting from move 1 ('f4'), user plays swap ('~~') and then 'd6' ('df')
      const variationGame = buildTargetGame(baseGame, '1', '~~df');
      expect(variationGame.lg_data).toBe('f4 swap d6');

      // Verify TwixtbotFormatter can format this variation cleanly
      const t1Output = TwixtbotFormatter.buildFile(variationGame);
      expect(t1Output).toContain('swap\n');
      expect(t1Output).toContain('d6\n');
    });

    it('handles variation from move 0 with swap and subsequent moves (regression: d3 swap j10)', () => {
      // 1.d3 (col 4 'd', row 3 'c' -> 'dc')
      // 2.swap ('~~')
      // 3.j10 (col 10 'j', row 10 'j' -> 'jj')
      const variationGame = buildTargetGame(baseGame, '0', 'dc~~jj');
      expect(variationGame.lg_data).toBe('d3 swap j10');

      const t1Output = TwixtbotFormatter.buildFile(variationGame);
      expect(t1Output).toContain('d3\nswap\nj10\n');
    });

    it('builds clean LittleGolemParser moves for variation game', () => {
      const variationGame = buildTargetGame(baseGame, '1', 'df');
      const parser = new LittleGolemParser(variationGame.lg_data, variationGame);
      const moves = parser.getMovesList();
      expect(moves.length).toBe(2);
      expect(moves[0].x).toBe(6);
      expect(moves[0].y).toBe(4);
      expect(moves[1].x).toBe(4);
      expect(moves[1].y).toBe(6);
    });
  });

  describe('Blank game handling', () => {
    const blankGame = {
      player1: 'Alice',
      player2: 'Bob',
      board_size: 24,
      lg_data: '',
      result: '?',
    };

    it('builds target game with 0 moves for blank game without variation', () => {
      const target = buildTargetGame(blankGame, '0', undefined);
      expect(target.lg_data).toBe('');

      const t1Output = TwixtbotFormatter.buildFile(target);
      expect(t1Output).toContain('Alice # Name of player 1\nBob # Name of player 2\n');
      expect(t1Output).toContain('24 # y-size of board\n');
    });

    it('builds target game with user variation on blank game', () => {
      // User plays 1.d3 ('dc'), 2.swap ('~~'), 3.j10 ('jj') on a blank board
      const target = buildTargetGame(blankGame, '0', 'dc~~jj');
      expect(target.lg_data).toBe('d3 swap j10');

      const t1Output = TwixtbotFormatter.buildFile(target);
      expect(t1Output).toContain('d3\nswap\nj10\n');
    });

    it('handles custom board size and player names on blank game', () => {
      const customBlank = {
        player1: 'Eve',
        player2: 'Mallory',
        board_size: 30,
        lg_data: '',
      };
      const target = buildTargetGame(customBlank, '0', 'eedf'); // e5, d6
      expect(target.lg_data).toBe('e5 d6');

      const t1Output = TwixtbotFormatter.buildFile(target);
      expect(t1Output).toContain('Eve # Name of player 1\nMallory # Name of player 2\n');
      expect(t1Output).toContain('30 # y-size of board\n');
      expect(t1Output).toContain('e5\nd6\n');
    });
  });

  describe('GET /downloadgame/gen router endpoint', () => {
    const router = require('../routes/downloadgame');
    const express = require('express');

    let app;
    beforeAll(() => {
      app = express();
      app.use('/downloadgame', router);
    });

    it('generates .t1 for blank game variation via HTTP request', (done) => {
      const http = require('http');
      const server = app.listen(0, () => {
        const port = server.address().port;
        http.get(`http://127.0.0.1:${port}/downloadgame/gen?gameid=blank&format=t1&player1=Alice&player2=Bob&boardSize=24&currentMoveNum=0&variation=dc~~jj`, (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-disposition']).toContain('filename="game_blank.t1"');
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            expect(body).toContain('Alice # Name of player 1');
            expect(body).toContain('Bob # Name of player 2');
            expect(body).toContain('d3\nswap\nj10\n');
            server.close(done);
          });
        });
      });
    });

    it('generates .tgt for blank game variation via HTTP request', (done) => {
      const http = require('http');
      const server = app.listen(0, () => {
        const port = server.address().port;
        http.get(`http://127.0.0.1:${port}/downloadgame/gen?gameid=blank&format=tgt&player1=Alice&player2=Bob&boardSize=24&currentMoveNum=0&variation=dc~~jj`, (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-disposition']).toContain('filename="game_blank.tgt"');
          const chunks = [];
          res.on('data', chunk => { chunks.push(chunk); });
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            expect(buf.length).toBeGreaterThan(0);
            server.close(done);
          });
        });
      });
    });
  });
});

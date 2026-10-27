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
});

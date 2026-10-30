const { sequelize, Player, Game, InProgress } = require('../models');
const gameRouter = require('../routes/game');
const { getGameFromLittleGolem } = gameRouter;

describe('Player Lookup Table & Recording', () => {
  const TEST_ID_1 = 987654321;
  const TEST_ID_2 = 987654322;

  afterEach(async () => {
    await Player.destroy({ where: { player_id: [TEST_ID_1, TEST_ID_2] } });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Player.recordPlayer', () => {
    it('records a player name and ID', async () => {
      await Player.recordPlayer('Test Player One', TEST_ID_1);

      const record = await Player.findOne({
        where: { player_name: 'Test Player One', player_id: TEST_ID_1 },
      });
      expect(record).not.toBeNull();
      expect(record.player_name).toBe('Test Player One');
      expect(record.player_id).toBe(TEST_ID_1);
    });

    it('trims leading and trailing whitespace from player name', async () => {
      await Player.recordPlayer('  Untrimmed Player  ', TEST_ID_1);

      const record = await Player.findOne({
        where: { player_name: 'Untrimmed Player', player_id: TEST_ID_1 },
      });
      expect(record).not.toBeNull();
      expect(record.player_name).toBe('Untrimmed Player');
    });

    it('gracefully ignores missing or invalid player name and ID', async () => {
      const res1 = await Player.recordPlayer(null, TEST_ID_1);
      const res2 = await Player.recordPlayer('', TEST_ID_1);
      const res3 = await Player.recordPlayer('Valid Name', null);
      const res4 = await Player.recordPlayer('Valid Name', 'invalid');

      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(res3).toBeNull();
      expect(res4).toBeNull();
    });

    it('is idempotent when recording the same player name and ID multiple times', async () => {
      await Player.recordPlayer('Same Player', TEST_ID_1);
      await Player.recordPlayer('Same Player', TEST_ID_1);

      const count = await Player.count({
        where: { player_name: 'Same Player', player_id: TEST_ID_1 },
      });
      expect(count).toBe(1);
    });

    it('supports many-to-many relationship: same player ID with multiple names', async () => {
      await Player.recordPlayer('Old Username', TEST_ID_1);
      await Player.recordPlayer('New Username', TEST_ID_1);

      const records = await Player.findAll({
        where: { player_id: TEST_ID_1 },
        order: [['player_name', 'ASC']],
      });
      expect(records).toHaveLength(2);
      expect(records.map(r => r.player_name)).toEqual(['New Username', 'Old Username']);
    });

    it('supports many-to-many relationship: multiple player IDs with the same username', async () => {
      await Player.recordPlayer('CommonUsername', TEST_ID_1);
      await Player.recordPlayer('CommonUsername', TEST_ID_2);

      const records = await Player.findAll({
        where: { player_name: 'CommonUsername' },
        order: [['player_id', 'ASC']],
      });
      expect(records).toHaveLength(2);
      expect(records.map(r => r.player_id)).toEqual([TEST_ID_1, TEST_ID_2]);
    });
  });

  describe('getGameFromLittleGolem integration', () => {
    const TEST_GAME_NUM = 99999999;
    const https = require('https');

    afterEach(async () => {
      await Game.destroy({ where: { lg_game_num: TEST_GAME_NUM } });
      await InProgress.destroy({ where: { lg_game_num: TEST_GAME_NUM } });
      await Player.destroy({ where: { player_id: [TEST_ID_1, TEST_ID_2] } });
      jest.restoreAllMocks();
    });

    it('records both players in players lookup table when a completed game is saved', async () => {
      const mockGameJson = {
        gid: TEST_GAME_NUM,
        gtid: 'twixt',
        variant: 'DEFAULT',
        players: [
          { player: { plid: TEST_ID_1, real_name: 'Integration Player 1' } },
          { player: { plid: TEST_ID_2, real_name: 'Integration Player 2' } },
        ],
        status: 2,
        results: [2, 0],
        moves: [{ nmove: 0, plid: 1, movetime: 1000, jmove: '', dmove: '' }],
      };

      const EventEmitter = require('events');
      jest.spyOn(https, 'get').mockImplementation((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        process.nextTick(() => {
          callback(res);
          res.emit('data', JSON.stringify(mockGameJson));
          res.emit('end');
        });
        const req = new EventEmitter();
        return req;
      });

      const flash = {};
      const { game } = await getGameFromLittleGolem(TEST_GAME_NUM, flash);

      expect(game).not.toBeNull();
      expect(game.player1).toBe('Integration Player 1');
      expect(game.player2).toBe('Integration Player 2');

      const p1 = await Player.findOne({
        where: { player_name: 'Integration Player 1', player_id: TEST_ID_1 },
      });
      const p2 = await Player.findOne({
        where: { player_name: 'Integration Player 2', player_id: TEST_ID_2 },
      });

      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();
    });
  });
});

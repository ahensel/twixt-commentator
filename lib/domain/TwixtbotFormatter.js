class TwixtbotFormatter {
  static buildFile(game) {
    const { LittleGolemParser } = require('./LittleGolemParser');
    const { LittleGolemNewParser } = require('./LittleGolemNewParser');
    
    let parser;
    if (game.lg_data_type === 'N') {
      parser = new LittleGolemNewParser(game.lg_data, game);
    } else {
      parser = new LittleGolemParser(game.lg_data);
    }

    const lines = [];
    lines.push('# File created by Twixt Commentator');
    lines.push('# Twixt Commentator is a website to comment on Twixt games (https://twixt-commentator.duckdns.org/)');
    lines.push('1 # version of file-format');
    lines.push(`${game.player1} # Name of player 1`);
    lines.push(`${game.player2} # Name of player 2`);
    
    const boardSize = parser.getBoardSize();
    lines.push(`${boardSize} # y-size of board`);
    lines.push(`${boardSize} # x-size of board`);
    
    lines.push('H # player 1 human or computer');
    lines.push('H # player 2 human or computer');
    lines.push('1 # starting player (1 plays top-down)');
    lines.push('V # direction of letters');
    lines.push('Y # pie rule?');
    
    const gameOver = parser.isGameOver() ? 'Y' : 'N';
    lines.push(`${gameOver} # game already over?`);

    parser.forEachLittleGolemMove(m => {
      if (m.text === 'swap') {
        lines.push('swap');
      } else if (m.x !== undefined && m.y !== undefined) {
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const text = letters[m.x - 1] + String(m.y);
        lines.push(text);
      }
    });

    return lines.join('\n') + '\n';
  }
}

module.exports = { TwixtbotFormatter };

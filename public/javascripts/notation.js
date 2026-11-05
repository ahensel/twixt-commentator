class TwixtNotation {
  static letterToX(xChar, boardSize = 24) {
    return (boardSize < 27)
      ? xChar.toUpperCase().charCodeAt(0) - 64
      : ((xChar >= 'a') ? xChar.charCodeAt(0) - 96 : xChar.charCodeAt(0) - 38);
  }

  static parseLinkEndpoints(notation, prefix, boardSize = 24) {
    let letter, number, isCaseA;
    const matchA = notation.match(/^([a-zA-Z])'(\d+)$/);
    if (matchA) {
      letter = matchA[1];
      number = matchA[2];
      isCaseA = true;
    } else {
      const matchB = notation.match(/^([a-zA-Z])(\d+)'$/);
      if (matchB) {
        letter = matchB[1];
        number = matchB[2];
        isCaseA = false;
      } else {
        return null;
      }
    }

    const num = parseInt(number, 10);
    const xVal = TwixtNotation.letterToX(letter, boardSize);
    const yVal = num;

    let x1, y1, x2, y2;
    if (isCaseA) {
      if (prefix === '\\') {
        x1 = xVal;     y1 = yVal - 1;
        x2 = xVal + 1; y2 = yVal + 1;
      } else if (prefix === '/') {
        x1 = xVal;     y1 = yVal + 1;
        x2 = xVal + 1; y2 = yVal - 1;
      } else {
        return null;
      }
    } else {
      if (prefix === '\\') {
        x1 = xVal - 1; y1 = yVal;
        x2 = xVal + 1; y2 = yVal + 1;
      } else if (prefix === '/') {
        x1 = xVal - 1; y1 = yVal + 1;
        x2 = xVal + 1; y2 = yVal;
      } else {
        return null;
      }
    }
    return { x1, y1, x2, y2 };
  }

  static findLink(notation, board) {
    let letter, number, isCaseA;
    const matchA = notation.match(/^([a-zA-Z])'(\d+)$/);
    if (matchA) {
      letter = matchA[1];
      number = matchA[2];
      isCaseA = true;
    } else {
      const matchB = notation.match(/^([a-zA-Z])(\d+)'$/);
      if (matchB) {
        letter = matchB[1];
        number = matchB[2];
        isCaseA = false;
      } else {
        return null;
      }
    }

    const num = parseInt(number, 10);
    const xVal = TwixtNotation.letterToX(letter, board.size);
    const yVal = num;

    if (isCaseA) {
      const link1 = board.getPeg(xVal, yVal - 1)?.getLink(1, 2);
      if (link1) return link1;
      const link2 = board.getPeg(xVal, yVal + 1)?.getLink(1, -2);
      if (link2) return link2;
      return null;
    } else {
      const link1 = board.getPeg(xVal - 1, yVal)?.getLink(2, 1);
      if (link1) return link1;
      const link2 = board.getPeg(xVal - 1, yVal + 1)?.getLink(2, -1);
      if (link2) return link2;
      return null;
    }
  }

  static getPegCoordinates(pegString, boardSize = 24) {
    let workingString = pegString;
    while (true) {
      let match = workingString.match(/^([-/\\])([a-zA-Z]'[1-9]\d*|[a-zA-Z][1-9]\d*')/);
      if (!match) {
        match = workingString.match(/^(\\\\)([a-zA-Z]'[1-9]\d*|[a-zA-Z][1-9]\d*')/);
      }
      if (match) {
        workingString = workingString.substring(match[0].length);
      } else {
        break;
      }
    }

    const xChar = workingString.substr(0, 1);
    const x = TwixtNotation.letterToX(xChar, boardSize);
    const y = parseInt(workingString.substr(1), 10);
    return [x, y];
  }

  static parseMove(pegString, boardSize = 24) {
    if (pegString.toLowerCase() === 'swap') {
      return { isSwap: true, actions: [], peg: null };
    }

    let workingString = pegString;
    const actions = [];
    while (true) {
      let match = workingString.match(/^([-/\\])([a-zA-Z]'[1-9]\d*|[a-zA-Z][1-9]\d*')/);
      if (!match) {
        match = workingString.match(/^(\\\\)([a-zA-Z]'[1-9]\d*|[a-zA-Z][1-9]\d*')/);
      }
      if (match) {
        actions.push({
          prefix: match[1] === '\\\\' ? '\\' : match[1],
          notation: match[2]
        });
        workingString = workingString.substring(match[0].length);
      } else {
        break;
      }
    }

    const [x, y] = TwixtNotation.getPegCoordinates(workingString, boardSize);
    return {
      isSwap: false,
      actions,
      peg: { x, y }
    };
  }

  static validateMove(pegString, board, turn, movesSoFar = 0) {
    if (pegString === 'swap') {
      const pegsSoFar = board.numPegs() + movesSoFar;
      if (pegsSoFar === 0) return '- Cannot swap as the first move of the game.';
      if (pegsSoFar > 1) return '- Cannot swap. There is more than one peg on the board.';
      return '';
    }

    const [x, y] = TwixtNotation.getPegCoordinates(pegString, board.size);
    if (board.getPeg(x, y) != null) {
      return `- Peg ${pegString} cannot be placed because there is already a peg on that spot.\n`;
    }
    if (!board.isValidSpot(x, y, (turn + movesSoFar) % 2)) {
      return `- Illegal spot for peg: ${pegString}\n`;
    }
    return '';
  }

  static validateCommentMoves(moves, board, turn) {
    let errors = '';
    let movesSoFar = 0;
    moves.forEach(move => {
      errors += TwixtNotation.validateMove(move, board, turn, movesSoFar);
      movesSoFar++;
    });
    return errors;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { TwixtNotation };
}


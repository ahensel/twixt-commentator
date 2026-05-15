// Lightweight getElementById shorthand — NOT Prototype's $().
// Use document.getElementById directly if you prefer explicitness.
const $ = id => document.getElementById(id);

const root = document.documentElement;
const styles = getComputedStyle(root);
const GRID_MARGIN = parseInt(styles.getPropertyValue('--grid-margin'), 10);
const GRID_SPACING = parseInt(styles.getPropertyValue('--grid-spacing'), 10);
const PEG_SIZE = 13;
// links are on the hypotenuse of a 1-2-sqrt(5) right triangle.
// const LINK_LENGTH = GRID_SPACING * Math.sqrt(5) - PEG_SIZE;
// const LINK_SHORT_DIM = Math.round(LINK_LENGTH / Math.sqrt(5)) + 3;  // 3 for a little overlap with pegs
// const LINK_LONG_DIM = Math.round(LINK_LENGTH * 2 / Math.sqrt(5)) + 3;
// We could calculate link image dimensions this way, but the fact is that the link images are 15x27 pixels.
const LINK_SHORT_DIM = 15;
const LINK_LONG_DIM = 27;
const LINK_SHORT_OFFSET = (GRID_SPACING - LINK_SHORT_DIM) / 2;
const LINK_LONG_OFFSET = (GRID_SPACING * 2 - LINK_LONG_DIM) / 2;

// ─── Centralized mutable board state ──────────────────────────────────────────

const BoardState = {
  turn: 1,  // 1 = White's turn, 0 = Black's turn
  bg: 1,    // board glass, for double buffering, to eliminate flicker. 1 or 2.

  twixtGame: null,  // TwixtController object, created on load
  currentMoves: new TwixtMoves(),  // tracks both main line and user variation
  currentMoveNum: null,   // current move in the main line, not the variation

  // Link removal state tracking
  cutLink: null,
  holdingForMarkers: false,
  numLinkableMarkers: 0,

  // Layout values set by positionElements() and read by setCommentDivTop().
  leftMargin: null,
  topMargin: null,

  // Helper methods
  isLegalSpot: (x, y) => {
    return BoardState.twixtGame.board.isLegalSpot(x, y, BoardState.turn);
  },
  getPeg: (x, y) => {
    return BoardState.twixtGame.board.getPeg(x, y);
  },
  hasLinkRemoval: () => {
    return BoardState.twixtGame.board.linkXingPolicy === TwixtBoard.LINK_REMOVAL;
  }
};

document.addEventListener('mousedown', clickOnBoard);
document.addEventListener('mousemove', mouseOverBoard);
document.addEventListener('keydown',  e => keyIntercept(e));

window.addEventListener('load', () => {
  disableSelections();

  BoardState.twixtGame = new TwixtController(parseInt($('boardSize').value, 10), TwixtBoard.PENCIL_AND_PAPER);

  positionElements();
  showMovesOnLoad();

  Object.assign($('white-player-label'), { src: whitepeg_img });
  Object.assign($('black-player-label'), { src: blackpeg_img });
});

function disableSelection(target) {
  if (!target) return;
  target.classList.add('no-select');
}

function disableSelections() {
  disableSelection($('board'));
  disableSelection($('newwhitepeg'));
  disableSelection($('newblackpeg'));
  disableSelection($('backLink'));
  disableSelection($('nextLink'));
}

function positionElements() {
  if (!$('board')) return;

  // absolute positioning of the board on the page
  BoardState.leftMargin = 10;
  BoardState.topMargin  = 80;

  const boardPixels = BoardState.twixtGame.board.size * GRID_SPACING;
  const boardWidth  = (GRID_MARGIN * 2) + boardPixels + 3;  // +2 for 1px border, +1 fudge factor
  const boardHeight = boardWidth;

  Object.assign($('turn').style, { left: `${BoardState.leftMargin}px`, top: `${BoardState.topMargin}px` });

  Object.assign($('board').style, {
    left: `${BoardState.leftMargin}px`, top: `${BoardState.topMargin + 20}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('twixt-board').style, {
    width: `${boardWidth}px`, height: `${boardHeight}px`
  });

  Object.assign($('boardglass1').style, {
    left: `${BoardState.leftMargin + 1}px`, top: `${BoardState.topMargin + 21}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('boardglass2').style, {
    left: `${BoardState.leftMargin + 1}px`, top: `${BoardState.topMargin + 21}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('markerglass').style, {
    left: `${BoardState.leftMargin + 1}px`, top: `${BoardState.topMargin + 21}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('sidebar').style, {
    left: `${BoardState.leftMargin + boardWidth + 10}px`, top: `${BoardState.topMargin + 20}px`,
    right: '10px', display: 'inline',
  });

  Object.assign($('underbar').style, {
    left: `${BoardState.leftMargin}px`, top: `${BoardState.topMargin + boardHeight + 30}px`,
    width: `${boardWidth}px`,
  });

  Object.assign($('comments').style, {
    left: `${BoardState.leftMargin + boardWidth + 10}px`, bottom: '10px',
    right: '10px', display: 'inline',
  });

  setCommentDivTop();
}

function setCommentDivTop() {
  $('comments').style.top = `${BoardState.topMargin + 30 + $('sidebar').offsetHeight}px`;
}

function showMovesOnLoad() {
  const movesJsonEl = $('movesJson');
  if (!movesJsonEl) return;

  const movesJson = movesJsonEl.value;
  if (!movesJson || movesJson.length === 0) return;

  const moves = JSON.parse(movesJson);

  if (moves.length > 1 && moves[1].type === Move.Swap) {
    [moves[0].x, moves[0].y] = [moves[0].y, moves[0].x];
    moves[0].player = 3 - moves[0].player;
  }

  BoardState.currentMoves.settingUp = true;
  moves.forEach(move => {
    if (move.type === Move.Peg) {
      BoardState.turn = 2 - move.player;
      placePeg(move.x, move.y);
    } else if (move.type === Move.Swap) {
      BoardState.currentMoves.swapFirstMove();
    } else if (move.type === Move.Resign) {
      BoardState.currentMoves.finalMove(new ResignMove());
    } else if (move.type === Move.Draw) {
      BoardState.currentMoves.finalMove(new DrawMove());
    } else if (move.type === Move.Forfeit) {
      BoardState.currentMoves.finalMove(new ForfeitMove());
    } else if (move.type === Move.Lost) {
      BoardState.currentMoves.finalMove(new LostMove());
    }
  });
  BoardState.currentMoves.settingUp = false;

  BoardState.currentMoveNum = BoardState.currentMoves.moves.length - (BoardState.currentMoves.gameIsInProgress() ? 0 : 1);

  showMovesText();
}

function buildMovesText(moves, firstNum, fn) {
  return moves.map((move, index) => {
    const moveNum = firstNum + index;
    const moveText  = `${moveNum}.${move.getText()}`;
    const className = ['black', 'white'][moveNum % 2];
    return fn(moveText, moveNum, className);
  }).join(' ');
}

function showMovesText() {
  $('moves').innerHTML = buildMovesText(BoardState.currentMoves.getMoves(), 1,
    (moveText, moveNum, className) => {
      return `<a id='move_${moveNum}' class='${className}' href='' ` +
             `onclick='jumpTo(${moveNum}); return false;'>${moveText}</a>`;
    });
  setCommentDivTop();
}

function getUserMovesFirstNum() {
  let moveNum = BoardState.currentMoveNum;
  if (moveNum > 0) {
    const move = BoardState.currentMoves.getMoves()[moveNum - 1];
    if (move.isFinalMove) { // "resign", "forfeit", "draw", "loss"
      moveNum--;
    }
  }
  return moveNum + 1;
}

function showUserMovesText() {
  let userMovesText = '';

  if (BoardState.currentMoves.hasUserMoves()) {
    $('copyMovesBtn').classList.remove('hidden');

    userMovesText = "|<span class='user-moves'>" +
      buildMovesText(BoardState.currentMoves.getUserMoves(), getUserMovesFirstNum(),
        (moveText, moveNum, className) => {
          return `<span id='userMove_${moveNum}' class='${className}'>${moveText}</span>`;
        }) +
      '</span>';
  }
  else {
    $('copyMovesBtn').classList.add('hidden');
  }

  $('user-moves').innerHTML = userMovesText;
  setCommentDivTop();
}

function jumpTo(moveNum) {
  uncolorMove(BoardState.currentMoveNum);
  BoardState.currentMoves.clearUserMoves();
  $('user-moves').innerHTML = '';
  showAllMoves(moveNum, null);
}

function cJumpMain(firstMoveNum, commentMoves) {
  if (firstMoveNum > BoardState.currentMoves.getMoves().length) {
    firstMoveNum = BoardState.currentMoves.getMoves().length;
  }
  uncolorMove(BoardState.currentMoveNum);
  BoardState.currentMoves.clearUserMoves();
  showAllMoves(firstMoveNum - 1, commentMoves);
}

function cJump(firstMoveNum, moves) {
  let nextMoveNum = null;
  if (BoardState.currentMoveNum != null) {
    nextMoveNum = BoardState.currentMoveNum + BoardState.currentMoves.getUserMoves().length + 1;
  }

  if (nextMoveNum === firstMoveNum) {
    placeCommentPegs(moves);
  } else if (nextMoveNum > firstMoveNum && overlapMovesMatch(firstMoveNum, nextMoveNum, moves)) {
    if (nextMoveNum <= firstMoveNum + moves.length) {
      placeCommentPegs(moves.slice(nextMoveNum - firstMoveNum));
    } else {
      if (BoardState.currentMoves.hasUserMoves()) {
        uncolorMove(BoardState.currentMoveNum);
        for (let i = 0; i < (nextMoveNum - (firstMoveNum + moves.length)); i++) {
          if (BoardState.currentMoves.hasUserMoves()) {
            BoardState.currentMoves.popMove();
          } else {
            BoardState.currentMoveNum--;
          }
        }
        showAllMoves(BoardState.currentMoveNum, null);
      } else {
        jumpTo(firstMoveNum - 1);
        placeCommentPegs(moves);
      }
    }
  } else if (nextMoveNum > firstMoveNum && firstMoveNum > BoardState.currentMoves.getMoves().length) {
    for (let i = 0; i < (nextMoveNum - firstMoveNum); i++) {
      BoardState.currentMoves.popMove();
    }
    showAllMoves(BoardState.currentMoveNum, moves);
  } else {
    cJumpMain(firstMoveNum, moves);
  }
}

function overlapMovesMatch(firstMoveNum, nextMoveNum, moves) {
  for (let moveNum = firstMoveNum; moveNum < Math.min(nextMoveNum, firstMoveNum + moves.length); moveNum++) {
    const shownMove = (moveNum <= BoardState.currentMoveNum)
      ? BoardState.currentMoves.getMoves()[moveNum - 1]
      : BoardState.currentMoves.getUserMoves()[moveNum - BoardState.currentMoveNum - 1];
    const shownMoveCoord = getPegCoordinates(shownMove.getText()).join(',');
    const commentMoveCoord = getPegCoordinates(moves[moveNum - firstMoveNum]).join(',');
    if (shownMoveCoord !== commentMoveCoord) {
      return false;
    }
  }
  return true;
}

function placeCommentPegs(moves) {
  const errors = getCommentPegErrors(moves);
  if (errors.length === 0) {
    moves.forEach(move => placePegByNotation(move));
    showUserMovesText();
  } else {
    alert(errors);
  }
}

function getCommentPegErrors(moves) {
  let errors = '';
  let movesSoFar = 0;
  moves.forEach(move => {
    errors += getNextCommentPegError(move, movesSoFar);
    movesSoFar++;
  });
  return errors;
}

function getPegCoordinates(pegString) {
  const xChar = pegString.substr(0, 1);
  const x = (BoardState.twixtGame.board.size < 27)? xChar.toUpperCase().charCodeAt(0) - 64 : 
    ((xChar >= 'a')? xChar.charCodeAt(0) - 96 : xChar.charCodeAt(0) - 38);
  const y = parseInt(pegString.substr(1), 10);

  return [x, y];
}

function getNextCommentPegError(pegString, movesSoFar) {
  if (pegString === 'swap') {
    const pegsSoFar = BoardState.twixtGame.board.getAllPegs().length + movesSoFar;
    if (pegsSoFar === 0) return '- Cannot swap as the first move of the game.';
    if (pegsSoFar >  1) return '- Cannot swap. There is more than one peg on the board.';
    return '';
  }

  const [x, y] = getPegCoordinates(pegString);

  if (BoardState.getPeg(x, y) != null) {
    return `- Peg ${pegString} cannot be placed because there is already a peg on that spot.\n`;
  }
  if (!BoardState.twixtGame.board.isLegalSpot(x, y, (BoardState.turn + movesSoFar + 1) % 2)) {
    return `- Illegal spot for peg: ${pegString}\n`;
  }
  return '';
}

function placePegByNotation(pegString) {
  if (pegString.toLowerCase() === 'swap') {
    swapFirstPeg();
  } else {
    const [x, y] = getPegCoordinates(pegString);
    if (BoardState.getPeg(x, y) == null && BoardState.isLegalSpot(x, y)) {
      placePeg(x, y);
    }
  }
}

// only used by comment clicking; on other occasions handled more efficiently
function swapFirstPeg() {
  const pegs = BoardState.twixtGame.board.getAllPegs();
  if (pegs.length === 1) {
    const peg = pegs[0];
    clearBoard();
    BoardState.turn = 1 - BoardState.turn;
    placePeg(peg.y, peg.x);

    // it erroneously put the peg on the user moves stack; correct that.
    BoardState.currentMoves.popMove();
    const firstMove = BoardState.currentMoves.hasUserMoves() ? BoardState.currentMoves.userMoves[0] : BoardState.currentMoves.moves[0];
    const peg1 = firstMove.peg;
    if (!peg1.swapped) {
      peg1.swapped = true;
      [peg1.x, peg1.y] = [peg1.y, peg1.x];
    }
    if (BoardState.currentMoves.hasUserMoves() ||
        (BoardState.currentMoves.moves.length > 1 && BoardState.currentMoves.moves[1].getText().toLowerCase() !== 'swap')) {
      BoardState.currentMoves.userMoves.push(new SwapMove());
    } else {
      uncolorMove(BoardState.currentMoveNum);
      BoardState.currentMoveNum++;
      colorMove(BoardState.currentMoveNum);
    }
  }
}

function showMovesUpTo(moves, moveNum) {
  for (let i = 0; i < moveNum; i++) {
    const move = moves[i];
    if (move.peg) {
      if (move.peg.swapped &&
          ((!BoardState.currentMoves.hasUserMoves() && moveNum === 1) ||
           (BoardState.currentMoves.hasUserMoves() && (BoardState.currentMoveNum + BoardState.currentMoves.userMoves.length === 1)))) {
        // jump to move 1: show the peg in its original unswapped position
        placePeg(move.peg.y, move.peg.x);
      } else {
        if (i === 0 && move.peg.swapped) {
          BoardState.turn = 1 - BoardState.turn; // switch color for swapped first peg
        }
        placePeg(move.peg.x, move.peg.y);
      }
    } else if (move.getText === 'swap') {
      nextTurn();
    }
  }
}

function showAllMoves(moveNum, commentMoves) {
  uncolorMove(BoardState.currentMoveNum);
  colorMove(moveNum);

  BoardState.currentMoves.jumpingTo = true;
  BoardState.bg = 3 - BoardState.bg;  // 1 → 2, 2 → 1 (double buffering)

  clearBoard();

  const moves = BoardState.currentMoves.getMoves();

  // make sure swapping is figured out
  const firstMove  = (moveNum > 0)
    ? moves[0]
    : (BoardState.currentMoves.hasUserMoves() ? BoardState.currentMoves.userMoves[0] : null);
  const secondMove = (moveNum > 1)
    ? moves[1]
    : (moveNum === 1) ? (BoardState.currentMoves.hasUserMoves() ? BoardState.currentMoves.userMoves[0] : null)
    : (moveNum === 0) ? ((BoardState.currentMoves.userMoves.length > 1) ? BoardState.currentMoves.userMoves[1] : null)
    : null;

  if (firstMove && secondMove) {
    const swapped = (secondMove.getText() === 'swap');
    const peg1 = firstMove.peg;
    if (peg1.swapped !== swapped) {
      peg1.swapped = swapped;
      [peg1.x, peg1.y] = [peg1.y, peg1.x];
    }
  }

  showMovesUpTo(moves, moveNum);
  BoardState.currentMoveNum = moveNum;

  if (BoardState.currentMoves.hasUserMoves()) {
    const userMoves = BoardState.currentMoves.getUserMoves();
    showMovesUpTo(userMoves, userMoves.length);
  }

  BoardState.currentMoves.jumpingTo = false;

  if (commentMoves != null) {
    const errors = getCommentPegErrors(commentMoves);
    if (errors.length === 0) {
      commentMoves.forEach(move => placePegByNotation(move));
    } else {
      alert(errors);
    }
  }

  showUserMovesText();

  // double buffering to eliminate flicker on slow machines
  $(`boardglass${BoardState.bg}`).classList.remove('hidden');
  $(`boardglass${3 - BoardState.bg}`).classList.add('hidden');
}

function uncolorMove(moveNum) {
  if (moveNum != null && moveNum > 0) {
    const el = $(`move_${moveNum}`);
    if (el) el.classList.remove('current-move');
  }
}

function colorMove(moveNum) {
  if (moveNum != null && moveNum > 0) {
    const el = $(`move_${moveNum}`);
    if (el) el.classList.add('current-move');
  }
}

function highlightMoveInSidebar(peg) {
  if (!peg) return;
  const pegName = peg.getPegName();

  if (BoardState.currentMoves.hasUserMoves()) {
    const firstUserMoveNum = getUserMovesFirstNum();
    const userMoves = BoardState.currentMoves.getUserMoves();
    for (let i = 0; i < userMoves.length; i++) {
      if (userMoves[i].peg?.getPegName() === pegName) {
        $(`userMove_${i + firstUserMoveNum}`)?.classList.add('hovered-peg');
        return;
      }
    }
  }

  const mainMoves = BoardState.currentMoves.getMoves();
  for (let i = 0; i <= BoardState.currentMoveNum; i++) {
    if (mainMoves[i].peg?.getPegName() === pegName) {
      $(`move_${i + 1}`)?.classList.add('hovered-peg');
      return;
    }
  }
}

function unhighlightMoveInSidebar() {
  const hovered = document.getElementsByClassName('hovered-peg');
  if (hovered) {
    for (const el of hovered) {
      el.classList.remove('hovered-peg');
    }
  }
}

function backButton() {
  if (BoardState.currentMoves.hasUserMoves()) {
    BoardState.currentMoves.popMove();
    showAllMoves(BoardState.currentMoveNum, null);
  } else if (BoardState.currentMoveNum > 0) {
    showAllMoves(BoardState.currentMoveNum - 1, null);
  }
}

function nextButton() {
  if (!BoardState.currentMoves.hasUserMoves() && BoardState.currentMoveNum < BoardState.currentMoves.moves.length) {
    showAllMoves(BoardState.currentMoveNum + 1, null);
  }
}

function clearBoard() {
  BoardState.turn = 1;
  BoardState.twixtGame = new TwixtController(BoardState.twixtGame.board.size, BoardState.twixtGame.board.linkXingPolicy);
  BoardState.cutLink = null;
  BoardState.holdingForMarkers = false;
  BoardState.numLinkableMarkers = 0;

  $(`boardglass${BoardState.bg}`).replaceChildren();

  $('newwhitepeg').classList.add('hidden');
  $('newblackpeg').classList.add('hidden');
}

// ─── Mouse / board interaction ────────────────────────────────────────────────

function mouseOverBoard(evt) {
  unhighlightMoveInSidebar();

  const pixelX = evt.pageX;
  const pixelY = evt.pageY;

  if (isPegSpot(pixelX, pixelY)) {
    if (BoardState.hasLinkRemoval()) eraseCutLink();

    const x = xCoord(pixelX);
    const y = yCoord(pixelY);
    const peg = BoardState.getPeg(x, y);

    if (peg) {
      highlightMoveInSidebar(peg);
    }

    if (!BoardState.holdingForMarkers && BoardState.isLegalSpot(x, y)) {
      if (peg == null) {
        drawCrosshair(x, y);
      } else {
        drawTickMarks(xPixels(x), yPixels(y), 'tick-mouse-peg');
      }
    } else {
      eraseCrosshair();
    }
  } else {
    eraseCrosshair();

    if (BoardState.hasLinkRemoval()) {
      const link = getRemovableLink(pixelX, pixelY, BoardState.turn);
      if (link != null) drawCutLink(link);
      else              eraseCutLink();
    }
  }
  return true;
}

function clickOnBoard(evt) {
  const pixelX = evt.pageX;
  const pixelY = evt.pageY;

  if (isPegSpot(pixelX, pixelY)) {
    const x = xCoord(pixelX);
    const y = yCoord(pixelY);
    const peg = BoardState.getPeg(x, y);

    if (peg == null && !BoardState.holdingForMarkers && BoardState.isLegalSpot(x, y)) {
      const peg = placePeg(x, y);
      showUserMovesText();
      highlightMoveInSidebar(peg);
    } else if (BoardState.hasLinkRemoval() && peg != null && peg.color === BoardState.turn) {
      placeLinks(peg, false);
      if (BoardState.holdingForMarkers && BoardState.numLinkableMarkers === 0) {
        nextTurn();
        BoardState.holdingForMarkers = false;
      }
    }
  } else if (BoardState.hasLinkRemoval() && BoardState.cutLink != null) {
    executeCutLink();
  }
  return true;
}

function placePeg(x, y) {
  const peg = BoardState.twixtGame.placePeg(x, y, BoardState.turn);
  drawPeg(peg);
  placeLinks(peg, true);
  if (BoardState.numLinkableMarkers === 0) nextTurn();
  else BoardState.holdingForMarkers = true;
  return peg;
}

function placeLinks(peg, isNew) {
  BoardState.twixtGame.addLinksTo(peg, isNew);
  drawLinks(peg);
  if (BoardState.hasLinkRemoval()) eraseLinkableMarkersAround(peg);
}

function executeCutLink() {
  const link = BoardState.cutLink;
  link.remove();
  BoardState.twixtGame.removeLink(link);
  eraseCutLink();
  eraseLink(link);
  drawLinkableMarkers(link);
}

function nextTurn() {
  if (!BoardState.currentMoves.settingUp && !BoardState.currentMoves.jumpingTo &&
      BoardState.currentMoves.userMoves.length === 0 &&
      BoardState.currentMoveNum < BoardState.currentMoves.moves.length &&
      BoardState.currentMoves.moves[BoardState.currentMoveNum].getText() === BoardState.twixtGame.move.getText()) {
    uncolorMove(BoardState.currentMoveNum);
    BoardState.currentMoveNum++;
    colorMove(BoardState.currentMoveNum);
  } else {
    BoardState.currentMoves.commitMove(BoardState.twixtGame);
  }
  flipTurn();
  if (BoardState.hasLinkRemoval()) {
    drawLinkableMarkersInBox(1, 1, BoardState.twixtGame.board.size, BoardState.twixtGame.board.size, BoardState.turn);
  }
}

function flipTurn() {
  BoardState.turn = 1 - BoardState.turn;
  $('turn').innerHTML = `${['Black', 'White'][BoardState.turn]}'s turn:`;
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

function copyMovesToClipboard() {
  const plainText = '|' + buildMovesText(BoardState.currentMoves.getUserMoves(), getUserMovesFirstNum(),
    (moveText) => moveText);

  const onSuccess = () => {
    const btn = $('copyMovesBtn');
    const original = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = original; }, 1000);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(plainText).then(onSuccess);
  } else {
    // Fallback for non-secure contexts (HTTP)
    const textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (e) {
      console.error('Failed to copy to clipboard');
    }
    document.body.removeChild(textarea);
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

// Inline images, because board pieces are small
const blackpeg_img = 'data:image/webp;base64,UklGRmAAAABXRUJQVlA4TFMAAAAvDAADECcgECBDltgiJCBDLnGLkIAMucQt8x8AoKryA4NIkhpN1a+BCwJIDkAA+Jf1yUJE/wPWFDDMqthmZodyV/I2xeP6y4fKXdn3gWFWBawpAAA=';
const whitepeg_img = 'data:image/webp;base64,UklGRnYAAABXRUJQVlA4TGoAAAAvDAADEDdAJm2bqqSu38ikbVOV1PUbmbRtqpK6fpv/AAC3qfxXUYFVbNtKzrMA+o8G8AAMAaCCnf4hnlSI6L/atm0Yjz15A9gWA2C0tjW47HG6G81E7i3iQ9IZ/5EMqoaMTmPZvfn16S8A';

const eselink_img = 'data:image/webp;base64,UklGRlIAAABXRUJQVlA4TEUAAAAvGoADECcgECBDltgiJCBDLnGLkIAMucQt8x8AoKryg6JIUiMuAzgAB1f8y1t+eUf0X2HSBkw6b0nC8sa8y/UR22HGNxgA';
const sselink_img = 'data:image/webp;base64,UklGRlIAAABXRUJQVlA4TEUAAAAvDoAGECcgECBDltgiJCBDLnGLkIAMucQt8x8AoKrycyiKJKm5JCAhBPzbG75IoCL6LyRIMPqkQlA7pdI+wv5lHjmMlgIA';
const sswlink_img = 'data:image/webp;base64,UklGRlQAAABXRUJQVlA4TEcAAAAvDoAGECcgECBDltgiJCBDLnGLkIAMucQt8x8AoKryg5o2kpxLANID+edPb679OqL/QoIEu0MEHaUxKp7uo9xr/9i69zpAAAA=';
const wswlink_img = 'data:image/webp;base64,UklGRlIAAABXRUJQVlA4TEYAAAAvGoADECcgECBDltgiJCBDLnGLkIAMucQt8x8AoKryg5pIkqK5AwM4AAevf3lDRB7RfwUBASDiDGoPZbbwV/X58OvzmIEC';

const esecut_img = 'data:image/webp;base64,UklGRmAAAABXRUJQVlA4TFMAAAAvGoADEC8gECBDltgiJCBDLnGLkIAMucQt8x8AoKryU0FRJEnNHWAg/sFBFJL9u8kIiOi/wrZtkMJ4j1iYk/s5Eh9z5bGSXiwdX+nvB7ZY4rw0CAA=';
const ssecut_img = 'data:image/webp;base64,UklGRl4AAABXRUJQVlA4TFEAAAAvDoAGEC8gECBDltgiJCBDLnGLkIAMucQt8x8AoKryUznYNJLk6Gxugdwx8fzJ9KQP4RXRf6Jpm1TN7Y4cDCqekqW+DHsq0lRD5i/qNzx31CwA';
const sswcut_img = 'data:image/webp;base64,UklGRlwAAABXRUJQVlA4TE8AAAAvDoAGEC8gECBDltgiJCBDLnGLkIAMucQt8x8AoKryU0FNJFsNsY9CwEn2b+ZeSR/Rf7JJG7s3fxisWaqOMp/mEJGe4lNflLTnf+4V7QUwAA==';
const wswcut_img = 'data:image/webp;base64,UklGRmQAAABXRUJQVlA4TFcAAAAvGoADEC8gECBDltgiJCBDLnGLkIAMucQt8x8AoKryU4FVJNmJNmAA/xMHKITu/LsJC4joP9mkTdpOJY9gGEuGeDGkmMBH+//xO1mYGHjJyGMDYwNwGAIA';

const linkablemarker_img = 'data:image/webp;base64,UklGRioAAABXRUJQVlA4TB4AAAAvDAADEA8Q8z8z8x84CLJtNn/JI0ziDhH9T25k5ng=';

const LINK_IMAGES = {
  eselink_img, sselink_img, sswlink_img, wswlink_img,
  esecut_img, ssecut_img, sswcut_img, wswcut_img
}

const PEG_IMAGES = [blackpeg_img, whitepeg_img];

// useful functions for drawing
function boardOffsetX() { return $('board')?.offsetLeft; }
function boardOffsetY() { return $('board')?.offsetTop; }

const GRID_ZERO = GRID_MARGIN - GRID_SPACING/2;
function xDelta(pixelX) { return pixelX - boardOffsetX() - xPixels(xCoord(pixelX)); }
function yDelta(pixelY) { return pixelY - boardOffsetY() - yPixels(yCoord(pixelY)); }
function xCoord(pixelX) { return Math.round((pixelX - boardOffsetX() - GRID_ZERO) / GRID_SPACING); }
function yCoord(pixelY) { return Math.round((pixelY - boardOffsetY() - GRID_ZERO) / GRID_SPACING); }
function xPixels(x)     { return GRID_ZERO + GRID_SPACING * x; }
function yPixels(y)     { return GRID_ZERO + GRID_SPACING * y; }

// actual drawing functions

function drawLinks(peg) {
  peg.getLinks().forEach(link => drawLink(link));
}

function getLinkAt(x, y, dx, dy, color) {
  const peg = BoardState.getPeg(x, y);
  if (peg != null && peg.color === color) return peg.getLink(dx, dy);
  return null;
}

function getRemovableLink(pixelX, pixelY, color) {
  const xd  = xDelta(pixelX);
  const yd  = yDelta(pixelY);
  const sxd = Math.sign(xd);
  const syd = Math.sign(yd);
  const x   = xCoord(pixelX - xd);
  const y   = yCoord(pixelY - yd);

  if (Math.abs(xd) > Math.abs(yd)) {
    return getLinkAt(x, y - 1, sxd, 2, color) || getLinkAt(x + sxd, y - 1, -sxd, 2, color) ||
      (yd !== 0 ? (getLinkAt(x, y, 2 * sxd, syd, color) || getLinkAt(x + sxd, y, -2 * sxd, syd, color)) : null);
  } else if (Math.abs(xd) < Math.abs(yd)) {
    return getLinkAt(x - 1, y, 2, syd, color) || getLinkAt(x - 1, y + syd, 2, -syd, color) ||
      (xd !== 0 ? (getLinkAt(x, y, sxd, 2 * syd, color) || getLinkAt(x, y + syd, sxd, -2 * syd, color)) : null);
  } else if (xd !== 0 && yd !== 0) {
    return getLinkAt(x, y + syd, sxd, -2 * syd, color) || getLinkAt(x + sxd, y, -2 * sxd, syd, color);
  }
  return null;
}

function isPegSpot(pixelX, pixelY) {
  const xd = xDelta(pixelX);
  const yd = yDelta(pixelY);
  return (xd * xd + yd * yd) < (PEG_SIZE * PEG_SIZE / 4 + 1);
}

function drawPeg(peg) {
  const image = addInlineImgToBoard(
    PEG_IMAGES[peg.color], `peg${peg.getPegName()}-${BoardState.bg}`,
    xPixels(peg.x) - (PEG_SIZE/2), yPixels(peg.y) - (PEG_SIZE/2), PEG_SIZE, PEG_SIZE
  );
  eraseCrosshair();
  overlayNewPegMarker(image, peg.color);
}

function overlayNewPegMarker(image, pegColor) {
  $('newwhitepeg').classList.add('hidden');
  $('newblackpeg').classList.add('hidden');
  const newpeg = $(`new${['black', 'white'][pegColor]}peg`);
  newpeg.style.left    = image.style.left;
  newpeg.style.top     = image.style.top;
  newpeg.classList.remove('hidden');
  newpeg.draggable = false;
}

function getMarkerName(x, y) { return `marker_${x}_${y}`; }

function drawLinkableMarkersInBox(minX, minY, maxX, maxY, color) {
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (BoardState.twixtGame.isLinkable(x, y) && BoardState.getPeg(x, y).color === color) {
        const markerName = getMarkerName(x, y);
        if (!$(markerName)) {
          addInlineImgToBoard(linkablemarker_img, markerName,
            xPixels(x) - (PEG_SIZE/2), yPixels(y) - (PEG_SIZE/2), PEG_SIZE, PEG_SIZE);
          BoardState.numLinkableMarkers++;
        }
      }
    }
  }
}

function drawLinkableMarkers(link) {
  drawLinkableMarkersInBox(link.minX() - 1, link.minY() - 1,
                           link.maxX() + 1, link.maxY() + 1, link.peg1.color);
}

function eraseLinkableMarkersAround(peg) {
  for (let x = peg.x - 3; x <= peg.x + 3; x++) {
    for (let y = peg.y - 3; y <= peg.y + 3; y++) {
      const m = $(getMarkerName(x, y));
      if (m != null && !BoardState.twixtGame.isLinkable(x, y)) {
        $(`boardglass${BoardState.bg}`).removeChild(m);
        BoardState.numLinkableMarkers--;
      }
    }
  }
}

function eraseCrosshair() {
  const ch = $('crosshair');
  if (ch) ch.classList.add('hidden');
  eraseTickMarks();
}

function eraseTickMarks() {
  ['vtick', 'vtick2', 'htick', 'htick2'].forEach(id => {
    const tick = $(id);
    if (tick) tick.classList.add('hidden');
  });
}

function drawCrosshair(x, y) {
  const ch = $('crosshair');
  if (ch) {
    const leftPos = xPixels(x);
    const topPos  = yPixels(y);
    ch.style.left    = `${leftPos - 5.5}px`;
    ch.style.top     = `${topPos - 5.5}px`;
    ch.classList.remove('hidden');
    drawTickMarks(leftPos, topPos, 'tick-mouse-hole');
  }
}

function drawTickMarks(leftPos, topPos, tickClass) {
  const boardWidth = BoardState.twixtGame.board.size * GRID_SPACING + GRID_MARGIN*2;

  const vtick = getVtick('vtick', leftPos, 1);
  const vtick2 = getVtick('vtick2', leftPos, boardWidth - 9);
  const htick = getHtick('htick', 1, topPos);
  const htick2 = getHtick('htick2', boardWidth - 9, topPos);

  [vtick, vtick2, htick, htick2].forEach(tick => {
    tick.classList.remove('tick-mouse-hole', 'tick-mouse-peg', 'tick-mouse-link');
    tick.classList.add(tickClass);
  });
}

function getVtick(id, left, top) {
  const vtick = getTick(id, left, top);
  vtick.classList.add('vtick');
  return vtick;
}

function getHtick(id, left, top) {
  const htick = getTick(id, left, top);
  htick.classList.add('htick');
  return htick;
}

function getTick(id, left, top) {
  const tick = $(id) || buildTickMark(id);
  tick.style.left = left + 'px';
  tick.style.top = top + 'px';
  tick.classList.remove('hidden');
  return tick;
}

function buildTickMark(id) {
  const tick = document.createElement('div');
  tick.id = id;
  tick.classList.add('tick-mark');
  const b = $('board');
  if (b) b.appendChild(tick);  // guard against race conditions on loading
  return tick;
}

function eraseCutLink() {
  if (BoardState.cutLink != null) {
    const linkElement = $(`cut${BoardState.cutLink.getLinkName()}-${BoardState.bg}`);
    BoardState.cutLink = null;
    if (linkElement) $(`boardglass${BoardState.bg}`).removeChild(linkElement);
    eraseTickMarks();
  }
}

function eraseLink(link) {
  const linkElement = $(`link${link.getLinkName()}-${BoardState.bg}`);
  if (linkElement) $(`boardglass${BoardState.bg}`).removeChild(linkElement);
}

function drawLink(link)    { drawLinkGeneral(link, 'link'); }
function drawCutLink(link) {
  if (BoardState.cutLink != null && link.getLinkName() !== BoardState.cutLink.getLinkName()) eraseCutLink();
  drawLinkGeneral(link, 'cut');
  drawTickMarks(
    (xPixels(link.peg1.x) + xPixels(link.peg2.x)) / 2,
    (yPixels(link.peg1.y) + yPixels(link.peg2.y)) / 2,
    'tick-mouse-link'
  );
  BoardState.cutLink = link;
}

function drawLinkGeneral(link, linkType) {
  const id = `${linkType}${link.getLinkName()}-${BoardState.bg}`;
  if ($(id)) return;

  const dx = Math.sign(link.peg1.y - link.peg2.y) * (link.peg1.x - link.peg2.x);

  const linkImg = LINK_IMAGES[['wsw','ssw','','sse','ese'][dx+2] + linkType + '_img'];
  const leftPos = xPixels(link.minX());
  const topPos = yPixels(link.minY());

  if (Math.abs(dx) === 1) {
    addInlineImgToBoard(linkImg, id,
      leftPos + LINK_SHORT_OFFSET, topPos + LINK_LONG_OFFSET,
      LINK_SHORT_DIM, LINK_LONG_DIM);
  } else {
    addInlineImgToBoard(linkImg, id,
      leftPos + LINK_LONG_OFFSET, topPos + LINK_SHORT_OFFSET,
      LINK_LONG_DIM, LINK_SHORT_DIM);
  }
}

function addInlineImgToBoard(imgfile, id, leftPos, topPos, width, height) {
  const b = $(`boardglass${BoardState.bg}`);

  const img = document.createElement('img');
  Object.assign(img, {
    src: imgfile,
    draggable: false,
    oncontextmenu: 'return false;',
    width,
    height,
    id
  });
  Object.assign(img.style, {
    position: 'absolute',
    left: `${leftPos}px`,
    top: `${topPos}px`
  });
  b.appendChild(img);
  disableSelection(img);
  return img;
}

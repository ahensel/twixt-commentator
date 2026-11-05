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

// Lightweight getElementById shorthand — NOT Prototype's $().
// Use document.getElementById directly if you prefer explicitness.
const $ = id => document.getElementById(id);

const styles = getComputedStyle(document.documentElement);
const GRID = {
  MARGIN: parseInt(styles.getPropertyValue('--grid-margin'), 10),
  SPACING: parseInt(styles.getPropertyValue('--grid-spacing'), 10),
  TICK_SIZE: parseInt(styles.getPropertyValue('--tick-size'), 10),
  ZERO: () => GRID.MARGIN - GRID.SPACING/2,
};
const PEG = {
  SIZE: 13,
  IMAGES: [blackpeg_img, whitepeg_img],
};
const LINK = {
  // links are on the hypotenuse of a 1-2-sqrt(5) right triangle.
  // const LINK_LENGTH = GRID.SPACING * Math.sqrt(5) - PEG.SIZE;
  // const LINK.SHORT_DIM = Math.round(LINK_LENGTH / Math.sqrt(5)) + 3;  // 3 for a little overlap with pegs
  // const LINK.LONG_DIM = Math.round(LINK_LENGTH * 2 / Math.sqrt(5)) + 3;
  // We could calculate link image dimensions this way, but the fact is that the link images are 15x27 pixels.
  SHORT_DIM: 15,
  LONG_DIM: 27,
  SHORT_OFFSET: () => (GRID.SPACING - LINK.SHORT_DIM) / 2,
  LONG_OFFSET: () => (GRID.SPACING * 2 - LINK.LONG_DIM) / 2,
  IMAGES: {
    eselink_img, sselink_img, sswlink_img, wswlink_img,
    esecut_img, ssecut_img, sswcut_img, wswcut_img
  }
};

// ─── Game & Session State ───────────────────────────────────────────────────

const GameState = {
  turn: 1,  // 1 = White's turn, 0 = Black's turn
  board: null,  // TwixtBoard object
  currentMoves: new TwixtMoves(),  // tracks mainline and user variation
  currentMoveNum: null,   // current move in mainline
  replayMode: 'none',  // 'none' | 'setup' | 'jump'
  colorsSwapped: false,  // true when player-color swap occurred
  declaredWinner: null,
  winnerBannerTimer: null,

  init(size, linkPolicy, swapStyle) {
    this.turn = 1;
    this.colorsSwapped = false;
    this.board = new TwixtBoard(size, linkPolicy, swapStyle);
  },

  reset() {
    const size = this.board?.size ?? 24;
    const linkPolicy = this.board?.linkXingPolicy ?? TwixtBoard.PENCIL_AND_PAPER;
    const swapStyle = this.board?.swapStyle ?? TwixtBoard.SWAP_LG;
    this.init(size, linkPolicy, swapStyle);
  },

  isPlayerColorSwap() {
    return this.board?.isPlayerColorSwap;
  },

  isLegalSpot(x, y, turn = this.turn) {
    return this.board?.isValidSpot(x, y, turn);
  },

  getPeg(x, y) {
    return this.board?.getPeg(x, y);
  },

  hasLinkRemoval() {
    return this.board?.linkXingPolicy === TwixtBoard.LINK_REMOVAL;
  },

  flipTurn() {
    this.turn = 1 - this.turn;
  }
};

// ─── Interaction & Tool State ───────────────────────────────────────────────

const BoardInteraction = {
  pendingEdit: null,
  cutLink: null,
  holdingForMarkers: false,
  numLinkableMarkers: 0,

  reset() {
    this.cutLink = null;
    this.holdingForMarkers = false;
    this.numLinkableMarkers = 0;
  }
};

// ─── Board Rendering & Double Buffering ─────────────────────────────────────

const BoardRenderer = {
  bg: 1,  // board glass index for double buffering (1 or 2)

  boardglass() {
    return $(`boardglass${this.bg}`);
  },

  revealNewBoardglass() {
    $(`boardglass${this.bg}`).classList.remove('hidden');
    $(`boardglass${3 - this.bg}`).classList.add('hidden');
  },

  switchDrawingBoardglass() {
    this.bg = 3 - this.bg;  // 1 → 2, 2 → 1
  },

  clear() {
    this.boardglass().replaceChildren();
    $('newwhitepeg')?.classList.add('hidden');
    $('newblackpeg')?.classList.add('hidden');
  }
};

// ─── BoardState Facade (Backwards Compatibility) ───────────────────────────

const BoardState = {
  get board() { return GameState.board; },
  set board(b) { GameState.board = b; },

  get turn() { return GameState.turn; },
  set turn(t) { GameState.turn = t; },

  get currentMoves() { return GameState.currentMoves; },
  set currentMoves(m) { GameState.currentMoves = m; },

  get currentMoveNum() { return GameState.currentMoveNum; },
  set currentMoveNum(n) { GameState.currentMoveNum = n; },

  get replayMode() { return GameState.replayMode; },
  set replayMode(m) { GameState.replayMode = m; },

  get colorsSwapped() { return GameState.colorsSwapped; },
  set colorsSwapped(s) { GameState.colorsSwapped = s; },

  get declaredWinner() { return GameState.declaredWinner; },
  set declaredWinner(w) { GameState.declaredWinner = w; },

  get winnerBannerTimer() { return GameState.winnerBannerTimer; },
  set winnerBannerTimer(t) { GameState.winnerBannerTimer = t; },

  get pendingEdit() { return BoardInteraction.pendingEdit; },
  set pendingEdit(p) { BoardInteraction.pendingEdit = p; },

  get cutLink() { return BoardInteraction.cutLink; },
  set cutLink(c) { BoardInteraction.cutLink = c; },

  get holdingForMarkers() { return BoardInteraction.holdingForMarkers; },
  set holdingForMarkers(h) { BoardInteraction.holdingForMarkers = h; },

  get numLinkableMarkers() { return BoardInteraction.numLinkableMarkers; },
  set numLinkableMarkers(n) { BoardInteraction.numLinkableMarkers = n; },

  get bg() { return BoardRenderer.bg; },
  set bg(val) { BoardRenderer.bg = val; },

  isPlayerColorSwap: () => GameState.isPlayerColorSwap(),
  isLegalSpot: (x, y, turn) => GameState.isLegalSpot(x, y, turn),
  getPeg: (x, y) => GameState.getPeg(x, y),
  hasLinkRemoval: () => GameState.hasLinkRemoval(),

  boardglass: () => BoardRenderer.boardglass(),
  revealNewBoardglass: () => BoardRenderer.revealNewBoardglass(),
  switchDrawingBoardglass: () => BoardRenderer.switchDrawingBoardglass(),
};

document.addEventListener('keydown',  e => keyIntercept(e));

window.addEventListener('load', () => {
  if (!$('board')) return;
  const size = parseInt($('boardSize').value, 10);
  const linkPolicy = $('linkPolicy')?.value === 'R' ? TwixtBoard.LINK_REMOVAL : TwixtBoard.PENCIL_AND_PAPER;
  const swapStyle = $('swapStyle')?.value === 'P' ? TwixtBoard.SWAP_PLAYER_COLORS : TwixtBoard.SWAP_LG;
  GameState.init(size, linkPolicy, swapStyle);
  BoardInteraction.pendingEdit = new PendingEdit(GameState.board);
  setBoardSize(size);
  showMovesOnLoad();
  showTurn();

  setPlayerLabels(GameState.colorsSwapped);

  $('topglass').addEventListener('mousedown', clickOnBoard);
  $('topglass').addEventListener('mousemove', mouseOverBoard);
  $('topglass').addEventListener('mouseout', eraseCrosshair);
  $('swap-button').addEventListener('click', () => { swapFirstPeg(); showUserMovesText(); });
  $('winner-banner').addEventListener('click', hideWinnerBanner);
});

function setBoardSize(size) {
  const board = $('board');
  if (!board) return;

  const boardPixels  = (GRID.MARGIN * 2) + (GRID.SPACING * size) + 2;  // +2 for 1px border

  Object.assign(board.style, {
    width: `${boardPixels}px`, height: `${boardPixels}px`,
  });
}

function showMovesOnLoad() {
  const movesJsonEl = $('movesJson');
  if (!movesJsonEl) return;

  const movesJson = movesJsonEl.value;
  if (!movesJson || movesJson.length === 0) return;

  const moves = JSON.parse(movesJson);

  BoardState.replayMode = 'setup';
  moves.forEach(move => {
    if (move.type === Move.Peg) {
      BoardState.turn = 2 - move.player;
      placePeg(move.x, move.y);
    } else if (move.type === Move.Swap) {
      executeSwap();
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
  BoardState.replayMode = 'none';

  BoardState.currentMoveNum = BoardState.currentMoves.moves.length - (BoardState.currentMoves.gameIsInProgress() ? 0 : 1);

  // For player-color-swap games, detect whether a swap was played and update labels/colors.
  if (BoardState.isPlayerColorSwap()) {
    const swapOccurred = BoardState.currentMoves.moves.length >= 2 &&
                         BoardState.currentMoves.moves[1].getText() === 'swap';
    BoardState.colorsSwapped = swapOccurred;
    setPlayerLabels(swapOccurred);
  }

  showMovesText();
  updateBackNextButtons();
}

// Returns the CSS class ('black' or 'white') for move number moveNum.
// When colorsSwapped is true (pie-rule swap occurred), move colors flip from move 3 onward.
function getMoveColor(moveNum, colorsSwapped) {
  if (colorsSwapped && moveNum === 2) return 'black-white-swap';
  const isOdd = moveNum % 2 === 1;
  if (colorsSwapped && moveNum >= 3) return isOdd ? 'black' : 'white';
  return isOdd ? 'white' : 'black';
}

function buildMovesText(moves, firstNum, fn) {
  const colorsSwapped = BoardState.colorsSwapped;
  return moves.map((move, index) => {
    const moveNum = firstNum + index;
    const moveText  = `${moveNum}.${move.getText()}`;
    const className = getMoveColor(moveNum, colorsSwapped);
    return fn(moveText, moveNum, className);
  }).join(' ');
}

function showMovesText() {
  $('moves').innerHTML = buildMovesText(BoardState.currentMoves.getMoves(), 1,
    (moveText, moveNum, className) => {
      return `<a id='move_${moveNum}' class='${className}' href='' ` +
             `onclick='jumpTo(${moveNum}); return false;'>${moveText}</a>`;
    });
}

function getUserMovesFirstNum() {
  let moveNum = BoardState.currentMoveNum;
  if (moveNum > 0) {
    const move = BoardState.currentMoves.getMoves()[moveNum - 1];
    if (move.isFinalMove) { // "resign", "forfeit", "draw", "loss"
      moveNum--;
    }
  }
  else if (moveNum < 0) {
    return 1;
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
  updateBackNextButtons();
  declareWinnerIfWinner();
}

function jumpTo(moveNum) {
  uncolorMove(BoardState.currentMoveNum);
  BoardState.currentMoves.clearUserMoves();
  $('user-moves').innerHTML = '';
  showAllMoves(moveNum, null);
}

function jumpFromComment(firstMoveNum, commentMoves) {
  const finalEditMoveNum = BoardState.currentMoves.getMoves().length +
    (BoardState.currentMoves.gameIsInProgress() ? 1 : 0);
  if (firstMoveNum > finalEditMoveNum) {
    firstMoveNum = finalEditMoveNum;
  }
  uncolorMove(BoardState.currentMoveNum);
  BoardState.currentMoves.clearUserMoves();

  showAllMoves(firstMoveNum - 1, commentMoves);
}

function getCommentPegErrors(moves) {
  return TwixtNotation.validateCommentMoves(moves, BoardState.board, BoardState.turn);
}

function getNextCommentPegError(pegString, movesSoFar) {
  return TwixtNotation.validateMove(pegString, BoardState.board, BoardState.turn, movesSoFar);
}

function getXFromLetter(xChar) {
  return TwixtNotation.letterToX(xChar, BoardState.board.size);
}

function parseLinkNotation(notation, prefix) {
  if (prefix === '-') {
    return TwixtNotation.findLink(notation, BoardState.board);
  }
  return TwixtNotation.parseLinkEndpoints(notation, prefix, BoardState.board.size);
}

function getPegCoordinates(pegString) {
  return TwixtNotation.getPegCoordinates(pegString, BoardState.board.size);
}

function placePegByNotation(pegString) {
  const parsed = TwixtNotation.parseMove(pegString, BoardState.board.size);
  if (parsed.isSwap) {
    swapFirstPeg();
    return;
  }

  const { x, y } = parsed.peg;
  if (BoardState.getPeg(x, y) == null && BoardState.isLegalSpot(x, y)) {
    // 1. Apply removals
    parsed.actions.forEach(action => {
      if (action.prefix === '-') {
        const link = TwixtNotation.findLink(action.notation, BoardState.board);
        if (link) {
          link.remove();
          BoardState.pendingEdit.removeLink(link);
          eraseLink(link);
        }
      }
    });

    // 2. Apply additions
    parsed.actions.forEach(action => {
      if (action.prefix === '/' || action.prefix === '\\') {
        const endpoints = TwixtNotation.parseLinkEndpoints(action.notation, action.prefix, BoardState.board.size);
        if (endpoints) {
          BoardState.pendingEdit.link(endpoints.x1, endpoints.y1, endpoints.x2, endpoints.y2, false);
          const peg1 = BoardState.getPeg(endpoints.x1, endpoints.y1);
          if (peg1) {
            const link = peg1.getLink(endpoints.x2 - endpoints.x1, endpoints.y2 - endpoints.y1);
            if (link) {
              drawLink(link);
              eraseLinkableMarkersAround(peg1);
              const peg2 = BoardState.getPeg(endpoints.x2, endpoints.y2);
              if (peg2) eraseLinkableMarkersAround(peg2);
            }
          }
        }
      }
    });

    // 3. Place the peg
    placePeg(x, y);

    // 4. Force completion of move if we had markers holding it
    if (BoardState.holdingForMarkers) {
      nextTurn();
      BoardState.holdingForMarkers = false;
    }
  }
}

function executeSwap() {
  if (BoardState.isPlayerColorSwap()) {
    BoardState.colorsSwapped = !BoardState.colorsSwapped;
    setPlayerLabels(BoardState.colorsSwapped);
    BoardState.turn = 0;
    showTurn();
  } else {
    const firstPeg = BoardState.board.getFirstPeg();
    if (firstPeg) {
      const oldImg = $(`peg${firstPeg.getPegName()}-${BoardState.bg}`);
      if (oldImg) oldImg.remove();
      BoardState.board.swap();
      const newPeg = BoardState.board.getFirstPeg();
      drawPeg(newPeg);
      BoardState.turn = 1;
      showTurn();
    }
  }
}

// only used by comment clicking; on other occasions handled more efficiently
function swapFirstPeg() {
  if (BoardState.board.numPegs() === 1) {
    executeSwap();

    // Record the swap move (same for both styles).
    if (BoardState.currentMoves.hasUserMoves() ||
        (BoardState.currentMoves.moves.length > 1 && BoardState.currentMoves.moves[1].getText().toLowerCase() !== 'swap')) {
      BoardState.currentMoves.userMoves.push(new SwapMove());
    } else {
      uncolorMove(BoardState.currentMoveNum);
      BoardState.currentMoveNum++;
      colorMove(BoardState.currentMoveNum);
    }

    if (BoardState.isPlayerColorSwap()) {
      // Re-render the main moves list so colors reflect the new swap state.
      showMovesText();
    }
  }
  updateSwapButton();
}

function showMovesUpTo(moves, moveNum) {
  for (let i = 0; i < moveNum; i++) {
    const move = moves[i];
    if (move.type === Move.Swap || move.getText?.() === 'swap') {
      executeSwap();
    } else if (move.peg) {
      placePegByNotation(move.getText());
    }
  }
}

function showAllMoves(moveNum, commentMoves) {
  uncolorMove(BoardState.currentMoveNum);
  colorMove(moveNum);

  BoardState.replayMode = 'jump';

  BoardState.switchDrawingBoardglass();
  clearBoard();  // resets colorsSwapped to false

  const moves = BoardState.currentMoves.getMoves();
  if (moves.length > 0) {
    showMovesUpTo(moves, moveNum);
    BoardState.currentMoveNum = moveNum;
  }

  if (BoardState.currentMoves.hasUserMoves()) {
    const userMoves = BoardState.currentMoves.getUserMoves();
    showMovesUpTo(userMoves, userMoves.length);
  }

  // For player-color-swap games, re-derive whether a swap is active in the displayed position.
  // clearBoard() above reset colorsSwapped to false, so we must restore it if needed.
  if (BoardState.isPlayerColorSwap()) {
    const allDisplayed = [
      ...BoardState.currentMoves.getMoves().slice(0, BoardState.currentMoveNum),
      ...BoardState.currentMoves.getUserMoves(),
    ];
    BoardState.colorsSwapped = allDisplayed.some(m => m.getText() === 'swap');
    setPlayerLabels(BoardState.colorsSwapped);
  }

  BoardState.replayMode = 'none';

  if (commentMoves != null) {
    const errors = getCommentPegErrors(commentMoves);
    if (errors.length === 0) {
      commentMoves.forEach(move => placePegByNotation(move));
    } else {
      alert(errors);
    }
  }

  showUserMovesText();
  updateSwapButton();

  BoardState.revealNewBoardglass();
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
      if (userMoves[i].getText?.() === 'swap' && BoardState.board.isSwapped()) {
        const first = BoardState.board.getFirstPeg();
        if (first?.getPegName() === pegName) {
          $(`userMove_${i + firstUserMoveNum}`)?.classList.add('hovered-peg');
          return;
        }
      }
    }
  }

  const mainMoves = BoardState.currentMoves.getMoves();
  if (mainMoves.length > 0) {
    for (let i = 0; i <= BoardState.currentMoveNum; i++) {
      if (mainMoves[i].peg?.getPegName() === pegName) {
        $(`move_${i + 1}`)?.classList.add('hovered-peg');
        return;
      }
      if (i === 1 && mainMoves[1]?.getText() === 'swap' && BoardState.board.isSwapped()) {
        const first = BoardState.board.getFirstPeg();
        if (first?.getPegName() === pegName) {
          $('move_2')?.classList.add('hovered-peg');
          return;
        }
      }
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

function updateBackNextButtons() {
  const backDisabled = !BoardState.currentMoves.hasUserMoves() && BoardState.currentMoveNum <= 0;
  const nextDisabled = BoardState.currentMoves.hasUserMoves() || BoardState.currentMoveNum >= BoardState.currentMoves.moves.length;

  $('backLink').classList.toggle('disabled', backDisabled);
  $('nextLink').classList.toggle('disabled', nextDisabled);
  if (backDisabled) $('backLink').blur();
  if (nextDisabled) $('nextLink').blur();
}

function backButton() {
  if (BoardState.hasLinkRemoval() && BoardState.numLinkableMarkers > 0) {
    eraseAllLinkableMarkers();
    showAllMoves(BoardState.currentMoveNum, null);
  } else if (BoardState.currentMoves.hasUserMoves()) {
    BoardState.currentMoves.popUserMove();
    showAllMoves(BoardState.currentMoveNum, null);
  } else if (BoardState.currentMoveNum > 0) {
    showAllMoves(BoardState.currentMoveNum - 1, null);
  }
  const pegCount = BoardState.board.numPegs();
  if (pegCount === 0) {
    showTurn();
  }
}

function nextButton() {
  if (!BoardState.currentMoves.hasUserMoves() && BoardState.currentMoveNum < BoardState.currentMoves.moves.length) {
    showAllMoves(BoardState.currentMoveNum + 1, null);
  }
}

function updateSwapButton() {
  const swapBtn = $('swap-button');
  if (!swapBtn) return;
  const moveCount = BoardState.currentMoves.userMoves.length + BoardState.currentMoveNum;
  const pegCount = BoardState.board.numPegs();
  // count moves because there is still one peg after a swap
  // count pegs because first move could be forfeit or resign
  if (moveCount === 1 && pegCount === 1) {
    swapBtn.classList.remove('hidden');
  } else {
    swapBtn.classList.add('hidden');
  }
}

function clearBoard() {
  GameState.reset();
  BoardInteraction.pendingEdit = new PendingEdit(GameState.board);
  BoardInteraction.reset();
  BoardRenderer.clear();
  setPlayerLabels(false);
  updateSwapButton();
}

// ─── Mouse / board interaction ────────────────────────────────────────────────

function mouseOverBoard(evt) {
  unhighlightMoveInSidebar();

  const pixelX = evt.offsetX;
  const pixelY = evt.offsetY;

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

function declareWinnerIfWinner() {
  const winner = GameState.board.calculateWinner();

  if (winner !== GameState.declaredWinner) {
    if (winner !== null) {
      showWinnerBanner(["It's a draw!", "White wins!", "Black wins!"][winner]);
    }
  }
  GameState.declaredWinner = winner;
}

function showWinnerBanner(text) {
  const banner = $('winner-banner');
  if (!banner) return;
  banner.firstElementChild.textContent = text;
  banner.classList.add('visible');
  GameState.winnerBannerTimer = setTimeout(hideWinnerBanner, 2000);
}

function hideWinnerBanner() {
  const banner = $('winner-banner');
  if (!banner) return;
  clearTimeout(GameState.winnerBannerTimer);
  banner.classList.remove('visible');
}

function clickOnBoard(evt) {
  const pixelX = evt.offsetX;
  const pixelY = evt.offsetY;

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
        showUserMovesText();
        BoardState.holdingForMarkers = false;
      }
    }
  } else if (BoardState.hasLinkRemoval() && BoardState.cutLink != null) {
    executeCutLink();
  }
  return true;
}

function placePeg(x, y) {
  const peg = BoardState.pendingEdit.placePeg(x, y, BoardState.turn);
  drawPeg(peg);
  placeLinks(peg, true);
  if (BoardState.numLinkableMarkers === 0) nextTurn();
  else BoardState.holdingForMarkers = true;
  return peg;
}

function placeLinks(peg, isNew) {
  BoardState.pendingEdit.addLinksTo(peg, isNew);
  drawLinks(peg);
  if (BoardState.hasLinkRemoval()) eraseLinkableMarkersAround(peg);
}

function executeCutLink() {
  const link = BoardState.cutLink;
  link.remove();
  BoardState.pendingEdit.removeLink(link);
  eraseCutLink();
  eraseLink(link);
  drawLinkableMarkers(link);
}

// True when the just-finished edit continues the main line: no user
// variation is in progress and the edit matches the next mainline move.
function continuesMainline(edit) {
  return BoardState.currentMoves.userMoves.length === 0 &&
         BoardState.currentMoves.moves[BoardState.currentMoveNum]?.getText() === edit.getText();
}

function nextTurn() {
  const edit = BoardState.pendingEdit.takeCurrentEdit();
  if (BoardState.replayMode === 'setup') {
    // Building the main line from the game's recorded moves.
    BoardState.currentMoves.recordMainline(edit);
  } else if (BoardState.replayMode === 'none' && continuesMainline(edit)) {
    uncolorMove(BoardState.currentMoveNum);
    BoardState.currentMoveNum++;
    colorMove(BoardState.currentMoveNum);
  } else if (BoardState.replayMode === 'none') {
    // The user branched off the main line.
    BoardState.currentMoves.recordUserMove(edit);
  }
  flipTurn();
  updateSwapButton();
  if (BoardState.hasLinkRemoval()) {
    drawLinkableMarkersInBox(1, 1, BoardState.board.size, BoardState.board.size, BoardState.turn);
  }
}

// Sets player label icons to reflect the current color assignment.
// When colorsSwapped is true (pie-rule swap), player1 plays black and player2 plays white.
function setPlayerLabels(colorsSwapped = false) {
  $('player1-label').src = colorsSwapped ? blackpeg_img : whitepeg_img;
  $('player2-label').src = colorsSwapped ? whitepeg_img : blackpeg_img;
}

function showTurn() {
  $('turn').innerHTML = `${['Black', 'White'][BoardState.turn]}'s turn:`;
}

function flipTurn() {
  GameState.flipTurn();
  showTurn();
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

// useful functions for drawing
function xDelta(pixelX) { return pixelX - xPixels(xCoord(pixelX)); }
function yDelta(pixelY) { return pixelY - yPixels(yCoord(pixelY)); }
function xCoord(pixelX) { return Math.round((pixelX - GRID.ZERO()) / GRID.SPACING); }
function yCoord(pixelY) { return Math.round((pixelY - GRID.ZERO()) / GRID.SPACING); }
function xPixels(x)     { return GRID.ZERO() + GRID.SPACING * x; }
function yPixels(y)     { return GRID.ZERO() + GRID.SPACING * y; }

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
  return (xd * xd + yd * yd) < (PEG.SIZE * PEG.SIZE / 4 + 1);
}

function drawPeg(peg) {
  const image = addInlineImgToBoard(
    PEG.IMAGES[peg.color], `peg${peg.getPegName()}-${BoardState.bg}`,
    xPixels(peg.x) - (PEG.SIZE/2), yPixels(peg.y) - (PEG.SIZE/2), PEG.SIZE, PEG.SIZE
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
      if (BoardState.board.isLinkable(x, y) && BoardState.getPeg(x, y).color === color) {
        const markerName = getMarkerName(x, y);
        if (!$(markerName)) {
          addInlineImgToBoard(linkablemarker_img, markerName,
            xPixels(x) - (PEG.SIZE/2), yPixels(y) - (PEG.SIZE/2), PEG.SIZE, PEG.SIZE);
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
      if (m != null && !BoardState.board.isLinkable(x, y)) {
        BoardState.boardglass().removeChild(m);
        BoardState.numLinkableMarkers--;
      }
    }
  }
}

function eraseAllLinkableMarkers() {
  document.querySelectorAll('img[id^="marker_"]').forEach(m => BoardRenderer.boardglass().removeChild(m));
  BoardInteraction.reset();
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
    ch.style.left = `${leftPos - PEG.SIZE/2}px`;
    ch.style.top  = `${topPos - PEG.SIZE/2}px`;
    ch.classList.remove('hidden');
    drawTickMarks(leftPos, topPos, 'tick-mouse-hole');
  }
}

function drawTickMarks(leftPos, topPos, tickClass) {
  const boardPixels = (BoardState.board.size * GRID.SPACING) + (GRID.MARGIN * 2);

  const vtick = getVtick('vtick', leftPos, 0);
  const vtick2 = getVtick('vtick2', leftPos, boardPixels - GRID.TICK_SIZE);
  const htick = getHtick('htick', 0, topPos);
  const htick2 = getHtick('htick2', boardPixels - GRID.TICK_SIZE, topPos);

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
  $('markerglass').appendChild(tick);
  return tick;
}

function getLinkId(link, linkType) {
  return `${linkType}${link.getLinkName()}-${BoardState.bg}`;
}

function eraseCutLink() {
  if (BoardState.cutLink != null) {
    const linkElement = $(getLinkId(BoardState.cutLink, 'cut'));
    BoardState.cutLink = null;
    if (linkElement) BoardState.boardglass().removeChild(linkElement);
    eraseTickMarks();
  }
}

function eraseLink(link) {
  const linkElement = $(getLinkId(link, 'link'));
  if (linkElement) BoardState.boardglass().removeChild(linkElement);
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
  const id = getLinkId(link, linkType);
  if ($(id)) return;

  const dx = Math.sign(link.peg1.y - link.peg2.y) * (link.peg1.x - link.peg2.x);

  const linkImg = LINK.IMAGES[['wsw','ssw','','sse','ese'][dx+2] + linkType + '_img'];
  const leftPos = xPixels(link.minX());
  const topPos = yPixels(link.minY());

  if (Math.abs(dx) === 1) {
    addInlineImgToBoard(linkImg, id,
      leftPos + LINK.SHORT_OFFSET(), topPos + LINK.LONG_OFFSET(),
      LINK.SHORT_DIM, LINK.LONG_DIM);
  } else {
    addInlineImgToBoard(linkImg, id,
      leftPos + LINK.LONG_OFFSET(), topPos + LINK.SHORT_OFFSET(),
      LINK.LONG_DIM, LINK.SHORT_DIM);
  }
}

function addInlineImgToBoard(imgfile, id, leftPos, topPos, width, height) {
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
    left: `${leftPos}px`,
    top: `${topPos}px`
  });
  img.classList.add('piece');

  BoardState.boardglass().appendChild(img);

  return img;
}

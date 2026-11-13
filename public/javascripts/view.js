// ─── Board metrics (from CSS) ───────────────────────────────────────────────
const styles = getComputedStyle(document.documentElement);
const GRID = {
  MARGIN: parseInt(styles.getPropertyValue('--grid-margin'), 10),
  SPACING: parseInt(styles.getPropertyValue('--grid-spacing'), 10),
  TICK_SIZE: parseInt(styles.getPropertyValue('--tick-size'), 10),
};
GRID.ZERO = GRID.MARGIN - GRID.SPACING / 2;
const PEG = {
  SIZE: parseInt(styles.getPropertyValue('--peg-size'), 10),
  IMAGES: ['blackpeg', 'whitepeg']
};
const LINK = {
  SHORT_DIM: parseInt(styles.getPropertyValue('--link-short-dim'), 10),
  LONG_DIM: parseInt(styles.getPropertyValue('--link-long-dim'), 10)
};
LINK.SHORT_OFFSET = (GRID.SPACING - LINK.SHORT_DIM) / 2;
LINK.LONG_OFFSET = (GRID.SPACING * 2 - LINK.LONG_DIM) / 2;

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
  },

  getUserMovesFirstNum() {
    let moveNum = this.currentMoveNum;
    if (moveNum > 0) {
      const move = this.currentMoves.getMoves()[moveNum - 1];
      if (move.isFinalMove) { // "resign", "forfeit", "draw", "loss"
        moveNum--;
      }
    }
    else if (moveNum < 0) {
      return 1;
    }
    return moveNum + 1;
  },

  swapOccurred() {
    if (this.currentMoveNum < 0) {
      return false;
    }
    const secondMove = (this.currentMoveNum > 1) ?
      this.currentMoves.moves[1] : this.currentMoves.userMoves[1 - this.currentMoveNum];
    return !!secondMove && secondMove.getText() === 'swap';
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

  boardglass(bg) {
    return document.getElementById(`boardglass${bg || this.bg}`);
  },

  revealNewBoardglass() {
    this.boardglass().classList.remove('hidden');
    this.boardglass(3 - this.bg).classList.add('hidden');
  },

  switchDrawingBoardglass() {
    this.bg = 3 - this.bg;  // 1 → 2, 2 → 1
  },

  clear() {
    this.boardglass().replaceChildren();
    document.getElementById('newwhitepeg')?.classList.add('hidden');
    document.getElementById('newblackpeg')?.classList.add('hidden');
  }
};

window.addEventListener('load', () => {
  if (!document.getElementById('board')) return;
  const size = parseInt(document.getElementById('boardSize').value, 10);
  const linkPolicy = document.getElementById('linkPolicy')?.value === 'R' ? TwixtBoard.LINK_REMOVAL : TwixtBoard.PENCIL_AND_PAPER;
  const swapStyle = document.getElementById('swapStyle')?.value === 'P' ? TwixtBoard.SWAP_PLAYER_COLORS : TwixtBoard.SWAP_LG;
  GameState.init(size, linkPolicy, swapStyle);
  BoardInteraction.pendingEdit = new PendingEdit(GameState.board);
  setBoardSize(size);
  showMovesOnLoad();
  showTurn();

  setPlayerLabels(GameState.colorsSwapped);

  const topGlass = document.getElementById('topglass');
  topGlass.addEventListener('contextmenu', e => e.preventDefault());
  topGlass.addEventListener('mousedown', e => { if (e.button === 0) clickOnBoard(e); });
  topGlass.addEventListener('mousemove', mouseOverBoard);
  topGlass.addEventListener('mouseout', eraseCrosshair);

  document.getElementById('swap-button').addEventListener('click', () => { swapFirstPeg(); showUserMovesText(); });
  document.getElementById('winner-banner').addEventListener('click', hideWinnerBanner);
});

function setBoardSize(size) {
  const board = document.getElementById('board');
  if (!board) return;

  const boardPixels  = (GRID.MARGIN * 2) + (GRID.SPACING * size) + 2;  // +2 for 1px border

  Object.assign(board.style, {
    width: `${boardPixels}px`, height: `${boardPixels}px`,
  });
}

function showMovesOnLoad() {
  const movesJsonEl = document.getElementById('movesJson');
  if (!movesJsonEl) return;

  const movesJson = movesJsonEl.value;
  if (!movesJson || movesJson.length === 0) return;

  const moves = JSON.parse(movesJson);

  GameState.replayMode = 'setup';
  moves.forEach(move => {
    if (move.type === Move.Peg) {
      GameState.turn = 2 - move.player;
      placePeg(move.x, move.y);
    } else if (move.type === Move.Swap) {
      executeSwap();
      GameState.currentMoves.swapFirstMove();
    } else if (move.type === Move.Resign) {
      GameState.currentMoves.finalMove(new ResignMove());
    } else if (move.type === Move.Draw) {
      GameState.currentMoves.finalMove(new DrawMove());
    } else if (move.type === Move.Forfeit) {
      GameState.currentMoves.finalMove(new ForfeitMove());
    } else if (move.type === Move.Lost) {
      GameState.currentMoves.finalMove(new LostMove());
    }
  });
  GameState.replayMode = 'none';

  GameState.currentMoveNum = GameState.currentMoves.moves.length - (GameState.currentMoves.gameIsInProgress() ? 0 : 1);

  // For player-color-swap games, detect whether a swap was played and update labels/colors.
  if (GameState.isPlayerColorSwap()) {
    GameState.colorsSwapped = GameState.swapOccurred();
    setPlayerLabels(GameState.colorsSwapped);
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
  const colorsSwapped = GameState.colorsSwapped;
  return moves.map((move, index) => {
    const moveNum = firstNum + index;
    const moveText  = `${moveNum}.${move.getText()}`;
    const className = getMoveColor(moveNum, colorsSwapped);
    return fn(moveText, moveNum, className);
  }).join(' ');
}

function showMovesText() {
  document.getElementById('moves').innerHTML = buildMovesText(GameState.currentMoves.getMoves(), 1,
    (moveText, moveNum, className) => {
      return `<a id='move_${moveNum}' class='${className}' href='' ` +
             `onclick='jumpTo(${moveNum}); return false;'>${moveText}</a>`;
    });
}

function showUserMovesText() {
  let userMovesText = '';

  if (GameState.currentMoves.hasUserMoves()) {
    document.getElementById('copyMovesBtn').classList.remove('hidden');

    userMovesText = "|<span class='user-moves'>" +
      buildMovesText(GameState.currentMoves.getUserMoves(), GameState.getUserMovesFirstNum(),
        (moveText, moveNum, className) => {
          return `<span id='userMove_${moveNum}' class='${className}'>${moveText}</span>`;
        }) +
      '</span>';
  }
  else {
    document.getElementById('copyMovesBtn').classList.add('hidden');
  }

  document.getElementById('user-moves').innerHTML = userMovesText;
  updateBackNextButtons();
  declareWinnerIfWinner();
}

function jumpTo(moveNum) {
  uncolorMove(GameState.currentMoveNum);
  GameState.currentMoves.clearUserMoves();
  document.getElementById('user-moves').innerHTML = '';
  showAllMoves(moveNum, null);
}

function jumpFromComment(firstMoveNum, commentMoves) {
  const finalEditMoveNum = GameState.currentMoves.getMoves().length +
    (GameState.currentMoves.gameIsInProgress() ? 1 : 0);
  if (firstMoveNum > finalEditMoveNum) {
    firstMoveNum = finalEditMoveNum;
  }
  uncolorMove(GameState.currentMoveNum);
  GameState.currentMoves.clearUserMoves();

  showAllMoves(firstMoveNum - 1, commentMoves);
}

function placePegByNotation(pegString) {
  const parsed = TwixtNotation.parseMove(pegString, GameState.board.size);
  if (parsed.isSwap) {
    swapFirstPeg();
    return;
  }

  const { x, y } = parsed.peg;
  if (GameState.getPeg(x, y) == null && GameState.isLegalSpot(x, y)) {
    // 1. Apply removals
    parsed.actions.forEach(action => {
      if (action.prefix === '-') {
        const link = TwixtNotation.findLink(action.notation, GameState.board);
        if (link) {
          link.remove();
          BoardInteraction.pendingEdit.removeLink(link);
          eraseLink(link);
        }
      }
    });

    // 2. Apply additions
    parsed.actions.forEach(action => {
      if (action.prefix === '/' || action.prefix === '\\') {
        const endpoints = TwixtNotation.parseLinkEndpoints(action.notation, action.prefix, GameState.board.size);
        if (endpoints) {
          BoardInteraction.pendingEdit.link(endpoints.x1, endpoints.y1, endpoints.x2, endpoints.y2, false);
          const peg1 = GameState.getPeg(endpoints.x1, endpoints.y1);
          if (peg1) {
            const link = peg1.getLink(endpoints.x2 - endpoints.x1, endpoints.y2 - endpoints.y1);
            if (link) {
              drawLink(link);
              eraseLinkableMarkersAround(peg1);
              const peg2 = GameState.getPeg(endpoints.x2, endpoints.y2);
              if (peg2) eraseLinkableMarkersAround(peg2);
            }
          }
        }
      }
    });

    // 3. Place the peg
    placePeg(x, y);

    // 4. Force completion of move if we had markers holding it
    if (BoardInteraction.holdingForMarkers) {
      nextTurn();
      BoardInteraction.holdingForMarkers = false;
    }
  }
}

function executeSwap() {
  if (GameState.isPlayerColorSwap()) {
    GameState.colorsSwapped = !GameState.colorsSwapped;
    setPlayerLabels(GameState.colorsSwapped);
    GameState.turn = 0;
    showTurn();
  } else {
    const firstPeg = GameState.board.getFirstPeg();
    if (firstPeg) {
      document.getElementById(getPegId(firstPeg))?.remove();
      GameState.board.swap();
      drawPeg(GameState.board.getFirstPeg());
      GameState.turn = 1;
      showTurn();
    }
  }
}

// only used by comment clicking; on other occasions handled more efficiently
function swapFirstPeg() {
  if (GameState.board.numPegs() === 1) {
    executeSwap();

    // Record the swap move (same for both styles).
    if (GameState.currentMoves.hasUserMoves() ||
        (GameState.currentMoves.moves.length > 1 && GameState.currentMoves.moves[1].getText().toLowerCase() !== 'swap')) {
      GameState.currentMoves.userMoves.push(new SwapMove());
    } else {
      uncolorMove(GameState.currentMoveNum);
      GameState.currentMoveNum++;
      colorMove(GameState.currentMoveNum);
    }

    if (GameState.isPlayerColorSwap()) {
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
  uncolorMove(GameState.currentMoveNum);
  colorMove(moveNum);

  GameState.replayMode = 'jump';

  BoardRenderer.switchDrawingBoardglass();
  clearBoard();  // resets colorsSwapped to false

  const moves = GameState.currentMoves.getMoves();
  if (moves.length > 0) {
    showMovesUpTo(moves, moveNum);
    GameState.currentMoveNum = moveNum;
  }

  if (GameState.currentMoves.hasUserMoves()) {
    const userMoves = GameState.currentMoves.getUserMoves();
    showMovesUpTo(userMoves, userMoves.length);
  }

  // For player-color-swap games, re-derive whether a swap is active in the displayed position.
  // clearBoard() above reset colorsSwapped to false, so we must restore it if needed.
  if (GameState.isPlayerColorSwap()) {
    GameState.colorsSwapped = GameState.swapOccurred();
    setPlayerLabels(GameState.colorsSwapped);
  }

  GameState.replayMode = 'none';

  if (commentMoves != null) {
    const errors = TwixtNotation.validateCommentMoves(commentMoves, GameState.board, GameState.turn);
    if (errors.length === 0) {
      commentMoves.forEach(move => placePegByNotation(move));
    } else {
      alert(errors);
    }
  }

  showUserMovesText();
  updateSwapButton();

  BoardRenderer.revealNewBoardglass();
}

function findMoveElement(moveNum) {
  if (!!moveNum && moveNum > 0) {
    return document.getElementById(`move_${moveNum}`);
  }
}

function uncolorMove(moveNum) {
  findMoveElement(moveNum)?.classList.remove('current-move');
}

function colorMove(moveNum) {
  findMoveElement(moveNum)?.classList.add('current-move');
}

function highlightMoveInSidebar(peg) {
  if (!peg) return;
  const pegName = peg.getPegName();

  if (GameState.currentMoves.hasUserMoves()) {
    const firstUserMoveNum = GameState.getUserMovesFirstNum();
    const userMoves = GameState.currentMoves.getUserMoves();
    for (let i = 0; i < userMoves.length; i++) {
      if (userMoves[i].peg?.getPegName() === pegName) {
        document.getElementById(`userMove_${i + firstUserMoveNum}`)?.classList.add('hovered-peg');
        return;
      }
      if (userMoves[i].getText?.() === 'swap' && GameState.board.isSwapped()) {
        const first = GameState.board.getFirstPeg();
        if (first?.getPegName() === pegName) {
          document.getElementById(`userMove_${i + firstUserMoveNum}`)?.classList.add('hovered-peg');
          return;
        }
      }
    }
  }

  const mainMoves = GameState.currentMoves.getMoves();
  if (mainMoves.length > 0) {
    for (let i = 0; i <= GameState.currentMoveNum; i++) {
      if (mainMoves[i].peg?.getPegName() === pegName) {
        findMoveElement(i + 1)?.classList.add('hovered-peg');
        return;
      }
      if (i === 1 && mainMoves[1]?.getText() === 'swap' && GameState.board.isSwapped()) {
        const first = GameState.board.getFirstPeg();
        if (first?.getPegName() === pegName) {
          findMoveElement(2)?.classList.add('hovered-peg');
          return;
        }
      }
    }
  }
}

function unhighlightMoveInSidebar() {
  const hovered = document.getElementsByClassName('hovered-peg');
  for (const el of hovered) {
    el.classList.remove('hovered-peg');
  }
}

function updateBackNextButtons() {
  const backDisabled = !GameState.currentMoves.hasUserMoves() && GameState.currentMoveNum <= 0;
  const nextDisabled = GameState.currentMoves.hasUserMoves() || GameState.currentMoveNum >= GameState.currentMoves.moves.length;

  const backLink = document.getElementById('backLink');
  const nextLink = document.getElementById('nextLink');
  backLink.classList.toggle('disabled', backDisabled);
  nextLink.classList.toggle('disabled', nextDisabled);
  if (backDisabled) backLink.blur();
  if (nextDisabled) nextLink.blur();
}

function backButton() {
  if (GameState.hasLinkRemoval() && BoardInteraction.numLinkableMarkers > 0) {
    eraseAllLinkableMarkers();
    showAllMoves(GameState.currentMoveNum, null);
  } else if (GameState.currentMoves.hasUserMoves()) {
    GameState.currentMoves.popUserMove();
    showAllMoves(GameState.currentMoveNum, null);
  } else if (GameState.currentMoveNum > 0) {
    showAllMoves(GameState.currentMoveNum - 1, null);
  }
  const pegCount = GameState.board.numPegs();
  if (pegCount === 0) {
    showTurn();
  }
}

function nextButton() {
  if (!GameState.currentMoves.hasUserMoves() && GameState.currentMoveNum < GameState.currentMoves.moves.length) {
    showAllMoves(GameState.currentMoveNum + 1, null);
  }
}

function updateSwapButton() {
  const swapBtn = document.getElementById('swap-button');
  if (!swapBtn) return;
  const moveCount = GameState.currentMoves.getUserMoves().length + GameState.currentMoveNum;
  const pegCount = GameState.board.numPegs();
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
    if (GameState.hasLinkRemoval()) eraseCutLink();

    const x = xCoord(pixelX);
    const y = yCoord(pixelY);
    const peg = GameState.getPeg(x, y);

    if (peg) {
      highlightMoveInSidebar(peg);
    }

    if (!BoardInteraction.holdingForMarkers && GameState.isLegalSpot(x, y)) {
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

    if (GameState.hasLinkRemoval()) {
      const link = getRemovableLink(pixelX, pixelY, GameState.turn);
      if (link != null) drawCutLink(link);
      else              eraseCutLink();
    }
  }
  return true;
}

function declareWinnerIfWinner() {
  const winner = GameState.board.calculateWinner();

  if (winner !== null && winner !== GameState.declaredWinner) {
    showWinnerBanner(["It's a draw!", "White wins!", "Black wins!"][winner]);
  }
  GameState.declaredWinner = winner;
}

function showWinnerBanner(text) {
  const banner = document.getElementById('winner-banner');
  if (!banner) return;
  banner.firstElementChild.textContent = text;
  banner.classList.add('visible');
  GameState.winnerBannerTimer = setTimeout(hideWinnerBanner, 2000);
}

function hideWinnerBanner() {
  const banner = document.getElementById('winner-banner');
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
    const peg = GameState.getPeg(x, y);

    if (peg == null && !BoardInteraction.holdingForMarkers && GameState.isLegalSpot(x, y)) {
      const peg = placePeg(x, y);
      showUserMovesText();
      highlightMoveInSidebar(peg);
    } else if (GameState.hasLinkRemoval() && peg != null && peg.color === GameState.turn) {
      placeLinks(peg, false);
      if (BoardInteraction.holdingForMarkers && BoardInteraction.numLinkableMarkers === 0) {
        nextTurn();
        showUserMovesText();
        BoardInteraction.holdingForMarkers = false;
      }
    }
  } else if (GameState.hasLinkRemoval() && BoardInteraction.cutLink != null) {
    executeCutLink();
  }
  return true;
}

function placePeg(x, y) {
  const peg = BoardInteraction.pendingEdit.placePeg(x, y, GameState.turn);
  drawPeg(peg);
  placeLinks(peg, true);
  if (BoardInteraction.numLinkableMarkers === 0) nextTurn();
  else BoardInteraction.holdingForMarkers = true;
  return peg;
}

function placeLinks(peg, isNew) {
  BoardInteraction.pendingEdit.addLinksTo(peg, isNew);
  drawLinks(peg);
  if (GameState.hasLinkRemoval()) eraseLinkableMarkersAround(peg);
}

function executeCutLink() {
  const link = BoardInteraction.cutLink;
  link.remove();
  BoardInteraction.pendingEdit.removeLink(link);
  eraseCutLink();
  eraseLink(link);
  drawLinkableMarkers(link);
}

// True when the just-finished edit continues the main line: no user
// variation is in progress and the edit matches the next mainline move.
function continuesMainline(edit) {
  return GameState.currentMoves.userMoves.length === 0 &&
         GameState.currentMoves.moves[GameState.currentMoveNum]?.getText() === edit.getText();
}

function nextTurn() {
  const edit = BoardInteraction.pendingEdit.takeCurrentEdit();
  if (GameState.replayMode === 'setup') {
    // Building the main line from the game's recorded moves.
    GameState.currentMoves.recordMainline(edit);
  } else if (GameState.replayMode === 'none' && continuesMainline(edit)) {
    uncolorMove(GameState.currentMoveNum);
    GameState.currentMoveNum++;
    colorMove(GameState.currentMoveNum);
  } else if (GameState.replayMode === 'none') {
    // The user branched off the main line.
    GameState.currentMoves.recordUserMove(edit);
  }
  flipTurn();
  updateSwapButton();
  if (GameState.hasLinkRemoval()) {
    drawLinkableMarkersInBox(1, 1, GameState.board.size, GameState.board.size, GameState.turn);
  }
}

// Sets player label icons to reflect the current color assignment.
// When colorsSwapped is true (pie-rule swap), player1 plays black and player2 plays white.
function setPlayerLabels(colorsSwapped = false) {
  const p1 = document.getElementById('player1-label');
  const p2 = document.getElementById('player2-label');
  p1?.classList.remove('blackpeg', 'whitepeg');
  p2?.classList.remove('blackpeg', 'whitepeg');
  p1?.classList.add(colorsSwapped ? 'blackpeg' : 'whitepeg');
  p2?.classList.add(colorsSwapped ? 'whitepeg' : 'blackpeg');
}

function showTurn() {
  document.getElementById('turn').innerHTML = `${['Black', 'White'][GameState.turn]}'s turn:`;
}

function flipTurn() {
  GameState.flipTurn();
  showTurn();
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

function copyMovesToClipboard() {
  const plainText = '|' + buildMovesText(GameState.currentMoves.getUserMoves(), GameState.getUserMovesFirstNum(),
    (moveText) => moveText);

  const onSuccess = () => {
    const btn = document.getElementById('copyMovesBtn');
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
function xCoord(pixelX) { return Math.round((pixelX - GRID.ZERO) / GRID.SPACING); }
function yCoord(pixelY) { return Math.round((pixelY - GRID.ZERO) / GRID.SPACING); }
function xPixels(x)     { return GRID.ZERO + GRID.SPACING * x; }
function yPixels(y)     { return GRID.ZERO + GRID.SPACING * y; }

// actual drawing functions

function drawLinks(peg) {
  peg.getLinks().forEach(link => drawLink(link));
}

function getLinkAt(x, y, dx, dy, color) {
  const peg = GameState.getPeg(x, y);
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

function getPegId(peg) {
  return `peg${peg.getPegName()}-${BoardRenderer.bg}`;
}

function drawPeg(peg) {
  const pegElement = addPiece(
    PEG.IMAGES[peg.color], getPegId(peg),
    xPixels(peg.x) - (PEG.SIZE/2), yPixels(peg.y) - (PEG.SIZE/2)
  );
  eraseCrosshair();
  overlayNewPegMarker(pegElement, peg.color);
}

function overlayNewPegMarker(pegElement, pegColor) {
  document.getElementById('newwhitepeg').classList.add('hidden');
  document.getElementById('newblackpeg').classList.add('hidden');
  const newpeg = document.getElementById(`new${['black', 'white'][pegColor]}peg`);
  newpeg.style.left = pegElement.style.left;
  newpeg.style.top  = pegElement.style.top;
  newpeg.classList.remove('hidden');
  newpeg.draggable = false;
}

function getMarkerName(x, y) { return `marker_${x}_${y}`; }

function drawLinkableMarkersInBox(minX, minY, maxX, maxY, color) {
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (GameState.board.isLinkable(x, y) && GameState.getPeg(x, y).color === color) {
        const markerName = getMarkerName(x, y);
        if (!document.getElementById(markerName)) {
          addPiece('linkablemarker', markerName,
            xPixels(x) - (PEG.SIZE/2), yPixels(y) - (PEG.SIZE/2));
          BoardInteraction.numLinkableMarkers++;
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
      const m = document.getElementById(getMarkerName(x, y));
      if (m != null && !GameState.board.isLinkable(x, y)) {
        BoardRenderer.boardglass().removeChild(m);
        BoardInteraction.numLinkableMarkers--;
      }
    }
  }
}

function eraseAllLinkableMarkers() {
  document.querySelectorAll('[id^="marker_"]').forEach(m => BoardRenderer.boardglass().removeChild(m));
  BoardInteraction.reset();
}

function eraseCrosshair() {
  const ch = document.getElementById('crosshair');
  if (ch) ch.classList.add('hidden');
  eraseTickMarks();
}

function eraseTickMarks() {
  ['vtick', 'vtick2', 'htick', 'htick2'].forEach(id => {
    const tick = document.getElementById(id);
    if (tick) tick.classList.add('hidden');
  });
}

function drawCrosshair(x, y) {
  const ch = document.getElementById('crosshair');
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
  const boardPixels = (GameState.board.size * GRID.SPACING) + (GRID.MARGIN * 2);

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
  const tick = document.getElementById(id) || buildTickMark(id);
  tick.style.left = left + 'px';
  tick.style.top = top + 'px';
  tick.classList.remove('hidden');
  return tick;
}

function buildTickMark(id) {
  const tick = document.createElement('div');
  tick.id = id;
  tick.classList.add('tick-mark');
  document.getElementById('markerglass').appendChild(tick);
  return tick;
}

function getLinkId(link, linkType) {
  return `${linkType}${link.getLinkName()}-${BoardRenderer.bg}`;
}

function eraseCutLink() {
  if (BoardInteraction.cutLink != null) {
    const linkElement = document.getElementById(getLinkId(BoardInteraction.cutLink, 'cut'));
    BoardInteraction.cutLink = null;
    if (linkElement) BoardRenderer.boardglass().removeChild(linkElement);
    eraseTickMarks();
  }
}

function eraseLink(link) {
  const linkElement = document.getElementById(getLinkId(link, 'link'));
  if (linkElement) BoardRenderer.boardglass().removeChild(linkElement);
}

function drawLink(link)    { drawLinkGeneral(link, 'link'); }
function drawCutLink(link) {
  if (BoardInteraction.cutLink != null && link.getLinkName() !== BoardInteraction.cutLink.getLinkName()) eraseCutLink();
  drawLinkGeneral(link, 'cut');
  drawTickMarks(
    (xPixels(link.peg1.x) + xPixels(link.peg2.x)) / 2,
    (yPixels(link.peg1.y) + yPixels(link.peg2.y)) / 2,
    'tick-mouse-link'
  );
  BoardInteraction.cutLink = link;
}

function drawLinkGeneral(link, linkType) {
  const id = getLinkId(link, linkType);
  if (document.getElementById(id)) return;

  const dx = Math.sign(link.peg1.y - link.peg2.y) * (link.peg1.x - link.peg2.x);

  const linkClass = ['wsw','ssw','','sse','ese'][dx+2] + linkType;
  const leftPos = xPixels(link.minX());
  const topPos = yPixels(link.minY());

  if (Math.abs(dx) === 1) {
    addPiece(linkClass, id, leftPos + LINK.SHORT_OFFSET, topPos + LINK.LONG_OFFSET);
  } else {
    addPiece(linkClass, id, leftPos + LINK.LONG_OFFSET, topPos + LINK.SHORT_OFFSET);
  }
}

function addPiece(className, id, leftPos, topPos) {
  const div = document.createElement('div');
  div.id = id;
  div.draggable = false;
  div.classList.add('piece');
  if (className) div.classList.add(className);
  Object.assign(div.style, {
    left: `${leftPos}px`,
    top: `${topPos}px`
  });
  div.addEventListener('contextmenu', e => e.preventDefault());

  BoardRenderer.boardglass().appendChild(div);

  return div;
}

// Lightweight getElementById shorthand — NOT Prototype's $().
// Use document.getElementById directly if you prefer explicitness.
const $ = id => document.getElementById(id);

const LINK_REMOVAL    = 0;
const PENCIL_AND_PAPER = 1;
let linkCrossingPolicy = PENCIL_AND_PAPER;

const GRID_SPACING = 18;
const PEG_SIZE = 13;
// const LINK_LENGTH = GRID_SPACING * Math.sqrt(5) - PEG_SIZE;
// const LINK_SHORT_DIM = Math.round(LINK_LENGTH / Math.sqrt(5)) + 3;  // 3 for a little overlap with pegs
// const LINK_LONG_DIM = Math.round(LINK_LENGTH * 2 / Math.sqrt(5)) + 3;

let BOARD_SIZE;

let turn = 1;
let twixtGame = null;
let cutLink = null;
let holdingForMarkers = false;
let numLinkableMarkers = 0;
let currentMoveNum = null;   // current move in the mainline, not the variation
let currentMoves = new TwixtMoves();
let bg = 1;

// These are set by positionElements() and read by setCommentDivTop().
let leftMargin, topMargin;

document.addEventListener('mousedown', clickOnBoard);
document.addEventListener('mousemove', mouseOverBoard);
document.addEventListener('keydown',  e => keyIntercept(e));
document.addEventListener('keypress', e => keyIntercept(e));

window.addEventListener('load', () => {
  disableSelections();

  BOARD_SIZE = parseInt($('boardSize').value, 10);
  twixtGame = new TwixtController(BOARD_SIZE);

  positionElements();
  showMovesOnLoad();
});

function disableSelection(target) {
  if (!target) return;
  target.style.userSelect = 'none';
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

  leftMargin = 10;
  topMargin  = 80;

  const boardPixels = BOARD_SIZE * GRID_SPACING;
  const boardWidth  = 45 + boardPixels;
  const boardHeight = 45 + boardPixels;

  Object.assign($('turn').style, { left: `${leftMargin}px`, top: `${topMargin}px` });

  Object.assign($('board').style, {
    left: `${leftMargin}px`, top: `${topMargin + 20}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('twixt-board').style, {
    width: `${boardWidth}px`, height: `${boardHeight}px`
  });

  Object.assign($('boardglass1').style, {
    left: `${leftMargin + 1}px`, top: `${topMargin + 21}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('boardglass2').style, {
    left: `${leftMargin + 1}px`, top: `${topMargin + 21}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('markerglass').style, {
    left: `${leftMargin + 1}px`, top: `${topMargin + 21}px`,
    width: `${boardWidth}px`, height: `${boardHeight}px`,
  });

  Object.assign($('sidebar').style, {
    left: `${leftMargin + boardWidth + 10}px`, top: `${topMargin + 20}px`,
    right: '10px', display: 'inline',
  });

  Object.assign($('underbar').style, {
    left: `${leftMargin}px`, top: `${topMargin + boardHeight + 30}px`,
    width: `${boardWidth}px`,
  });

  Object.assign($('comments').style, {
    left: `${leftMargin + boardWidth + 10}px`, bottom: '10px',
    right: '10px', display: 'inline',
  });

  setCommentDivTop();
}

function setCommentDivTop() {
  $('comments').style.top = `${topMargin + 30 + $('sidebar').offsetHeight}px`;
}

function showMovesOnLoad() {
  const movesJsonEl = $('movesJson');
  if (!movesJsonEl) return;

  const movesJson = movesJsonEl.value;
  if (!movesJson || movesJson.length === 0) return;

  const moves = JSON.parse(movesJson);

  const swapped = (moves.length > 1 && moves[1].type === 2);
  if (swapped) {
    const tmp = moves[0].x;
    moves[0].x = moves[0].y;
    moves[0].y = tmp;
    moves[0].player = 3 - moves[0].player;
  }

  currentMoves.settingUp = true;
  let gameIsInProgress = true;

  moves.forEach(move => {
    if (move.type === 1) {
      turn = 2 - move.player;
      placePeg(move.x, move.y);
    } else if (move.type === 2) {
      currentMoves.swapFirstMove();
    } else if (move.type === 3) {
      currentMoves.finalMove(new ResignMove());
      gameIsInProgress = false;
    } else if (move.type === 4) {
      currentMoves.finalMove(new DrawMove());
      gameIsInProgress = false;
    } else if (move.type === 5) {
      currentMoves.finalMove(new ForfeitMove());
      gameIsInProgress = false;
    } else if (move.type === 6) {
      currentMoves.finalMove(new LostMove());
      gameIsInProgress = false;
    }
  });

  currentMoves.settingUp = false;
  currentMoveNum = currentMoves.moves.length - (gameIsInProgress ? 0 : 1);

  showMovesText();
}

function showMovesText() {
  $('moves').innerHTML = currentMoves.getMoves().map((move, index) => {
    const moveNum = index + 1;
    const className = (moveNum % 2 === 0) ? 'black' : 'white';
    const moveText  = `${moveNum}.${move.getText()}`;
    return `<a id='move_${moveNum}' class='${className}' href='' ` +
           `onclick='jumpTo(${moveNum}); return false;'>${moveText}</a> `;
  }).join(' ');

  setCommentDivTop();
}

function getUserMovesFirstNum() {
  let moveNum = currentMoveNum;
  if (moveNum > 0) {
    const move = currentMoves.getMoves()[moveNum - 1];
    if (!(move.peg || move.getText() === 'swap')) {
      // back off from "resign", "forfeit", "draw", "loss"
      moveNum--;
    }
  }
  return moveNum + 1;
}

function showUserMovesText() {
  let userMovesText = '';

  if (currentMoves.hasUserMoves()) {
    $('copyMovesBtn').style.display = 'inline';
    userMovesText += "|<span class='userMoves'>";
    let moveNum = getUserMovesFirstNum();

    currentMoves.getUserMoves().forEach(move => {
      const className = (moveNum % 2 === 0) ? 'black' : 'white';
      const moveText  = `${moveNum}.${move.getText()}`;
      userMovesText += `<span id='userMove_${moveNum}' class='${className}'>${moveText}</span> `;
      moveNum++;
    });

    userMovesText += '</span>';
  }
  else {
    $('copyMovesBtn').style.display = 'none';
  }

  $('userMoves').innerHTML = userMovesText;
  setCommentDivTop();
}

function jumpTo(moveNum) {
  uncolorMove(currentMoveNum);
  currentMoves.clearUserMoves();
  $('userMoves').innerHTML = '';
  showAllMoves(moveNum, null);
}

function cJumpMain(firstMoveNum, commentMoves) {
  if (firstMoveNum > currentMoves.getMoves().length) {
    firstMoveNum = currentMoves.getMoves().length;
  }
  uncolorMove(currentMoveNum);
  currentMoves.clearUserMoves();
  showAllMoves(firstMoveNum - 1, commentMoves);
}

function cJump(firstMoveNum, moves) {
  let nextMoveNum = null;
  if (currentMoveNum != null) {
    nextMoveNum = currentMoveNum + currentMoves.getUserMoves().length + 1;
  }

  if (nextMoveNum === firstMoveNum) {
    placeCommentPegs(moves);
  } else if (nextMoveNum > firstMoveNum && overlapMovesMatch(firstMoveNum, nextMoveNum, moves)) {
    if (nextMoveNum <= firstMoveNum + moves.length) {
      placeCommentPegs(moves.slice(nextMoveNum - firstMoveNum));
    } else {
      if (currentMoves.hasUserMoves()) {
        uncolorMove(currentMoveNum);
        for (let i = 0; i < (nextMoveNum - (firstMoveNum + moves.length)); i++) {
          if (currentMoves.hasUserMoves()) {
            currentMoves.popMove();
          } else {
            currentMoveNum--;
          }
        }
        showAllMoves(currentMoveNum, null);
      } else {
        jumpTo(firstMoveNum - 1);
        placeCommentPegs(moves);
      }
    }
  } else if (nextMoveNum > firstMoveNum && firstMoveNum > currentMoves.getMoves().length) {
    for (let i = 0; i < (nextMoveNum - firstMoveNum); i++) {
      currentMoves.popMove();
    }
    showAllMoves(currentMoveNum, moves);
  } else {
    cJumpMain(firstMoveNum, moves);
  }
}

function overlapMovesMatch(firstMoveNum, nextMoveNum, moves) {
  for (let moveNum = firstMoveNum; moveNum < Math.min(nextMoveNum, firstMoveNum + moves.length); moveNum++) {
    const shownMove = (moveNum <= currentMoveNum)
      ? currentMoves.getMoves()[moveNum - 1]
      : currentMoves.getUserMoves()[moveNum - currentMoveNum - 1];
    if (shownMove.getText().toUpperCase() !== moves[moveNum - firstMoveNum].toUpperCase()) {
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

function getXcoordinate(pegString) {
}

function getPegCoordinates(pegString) {
  const xChar = pegString.substr(0, 1);
  const x = (BOARD_SIZE < 27)? xChar.toUpperCase().charCodeAt(0) - 64 : 
  ((xChar >= 'a')? xChar.charCodeAt(0) - 96 : xChar.charCodeAt(0) - 38);
  const y = parseInt(pegString.substr(1), 10);

  return [x, y];
}

function getNextCommentPegError(pegString, movesSoFar) {
  if (pegString === 'swap') {
    const pegsSoFar = twixtGame.board.getAllPegs().length + movesSoFar;
    if (pegsSoFar === 0) return '- Cannot swap as the first move of the game.';
    if (pegsSoFar >  1) return '- Cannot swap. There is more than one peg on the board.';
    return '';
  }

  const [x, y] = getPegCoordinates(pegString);

  if (twixtGame.board.getPeg(x, y) != null) {
    return `- Peg ${pegString} cannot be placed because there is already a peg on that spot.\n`;
  }
  if (!twixtGame.board.isLegalSpot(x, y, (turn + movesSoFar + 1) % 2)) {
    return `- Illegal spot for peg: ${pegString}\n`;
  }
  return '';
}

function placePegByNotation(pegString) {
  if (pegString.toLowerCase() === 'swap') {
    swapFirstPeg();
  } else {
    const [x, y] = getPegCoordinates(pegString);
    if (twixtGame.board.getPeg(x, y) == null && twixtGame.board.isLegalSpot(x, y, turn)) {
      placePeg(x, y);
    }
  }
}

// only used by comment clicking; on other occasions handled more efficiently
function swapFirstPeg() {
  const pegs = twixtGame.board.getAllPegs();
  if (pegs.length === 1) {
    const peg = pegs[0];
    clearBoard();
    turn = 1 - turn;
    placePeg(peg.y, peg.x);

    // it erroneously put the peg on the user moves stack; correct that.
    currentMoves.popMove();
    const firstMove = currentMoves.hasUserMoves() ? currentMoves.userMoves[0] : currentMoves.moves[0];
    const peg1 = firstMove.peg;
    if (!peg1.swapped) {
      peg1.swapped = true;
      const tmp = peg1.x;
      peg1.x = peg1.y;
      peg1.y = tmp;
    }
    if (currentMoves.hasUserMoves() ||
        (currentMoves.moves.length > 1 && currentMoves.moves[1].getText().toLowerCase() !== 'swap')) {
      currentMoves.userMoves.push(new SwapMove());
    } else {
      uncolorMove(currentMoveNum);
      currentMoveNum++;
      colorMove(currentMoveNum);
    }
  }
}

function showMovesUpTo(moves, moveNum) {
  for (let i = 0; i < moveNum; i++) {
    const move = moves[i];
    if (move.peg) {
      if (move.peg.swapped &&
          ((!currentMoves.hasUserMoves() && moveNum === 1) ||
           (currentMoves.hasUserMoves() && (currentMoveNum + currentMoves.userMoves.length === 1)))) {
        // jump to move 1: show the peg in its original unswapped position
        placePeg(move.peg.y, move.peg.x);
      } else {
        if (i === 0 && move.peg.swapped) {
          turn = 1 - turn; // switch color for swapped first peg
        }
        placePeg(move.peg.x, move.peg.y);
      }
    } else if (move.getText === 'swap') {
      nextTurn();
    }
  }
}

function showAllMoves(moveNum, commentMoves) {
  uncolorMove(currentMoveNum);
  colorMove(moveNum);

  currentMoves.jumpingTo = true;
  bg = 3 - bg;  // 1 → 2, 2 → 1 (double buffering)

  clearBoard();

  const moves = currentMoves.getMoves();

  // make sure swapping is figured out
  const firstMove  = (moveNum > 0)
    ? moves[0]
    : (currentMoves.hasUserMoves() ? currentMoves.userMoves[0] : null);
  const secondMove = (moveNum > 1)
    ? moves[1]
    : (moveNum === 1) ? (currentMoves.hasUserMoves() ? currentMoves.userMoves[0] : null)
    : (moveNum === 0) ? ((currentMoves.userMoves.length > 1) ? currentMoves.userMoves[1] : null)
    : null;

  if (firstMove && secondMove) {
    const swapped = (secondMove.getText() === 'swap');
    const peg1 = firstMove.peg;
    if (peg1.swapped !== swapped) {
      peg1.swapped = swapped;
      const tmp = peg1.x;
      peg1.x = peg1.y;
      peg1.y = tmp;
    }
  }

  showMovesUpTo(moves, moveNum);
  currentMoveNum = moveNum;

  if (currentMoves.hasUserMoves()) {
    const userMoves = currentMoves.getUserMoves();
    showMovesUpTo(userMoves, userMoves.length);
  }

  currentMoves.jumpingTo = false;

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
  $(`boardglass${bg}`).style.display        = 'inline';
  $(`boardglass${3 - bg}`).style.display    = 'none';

  // Safari loses the new peg marker unless we put its div back on top
  $('markerglass').style.zIndex = 10; //$(`boardglass${bg}`).style.zIndex + 1;
}

function uncolorMove(moveNum) {
  if (moveNum != null && moveNum > 0) {
    const el = $(`move_${moveNum}`);
    if (el) el.classList.remove('currentMove');
  }
}

function colorMove(moveNum) {
  if (moveNum != null && moveNum > 0) {
    const el = $(`move_${moveNum}`);
    if (el) el.classList.add('currentMove');
  }
}

function highlightMoveInSidebar(peg) {
  if (!peg) return;
  const pegName = peg.getPegName();

  if (currentMoves.hasUserMoves()) {
    const firstUserMoveNum = getUserMovesFirstNum();
    const userMoves = currentMoves.getUserMoves();
    for (let i = 0; i < userMoves.length; i++) {
      if (userMoves[i].peg?.getPegName() === pegName) {
        $(`userMove_${i + firstUserMoveNum}`)?.classList.add('hoveredPeg');
        return;
      }
    }
  }

  const mainMoves = currentMoves.getMoves();
  for (let i = 0; i <= currentMoveNum; i++) {
    if (mainMoves[i].peg?.getPegName() === pegName) {
      $(`move_${i + 1}`)?.classList.add('hoveredPeg');
      return;
    }
  }
}

function unhighlightMoveInSidebar() {
  const hovered = document.getElementsByClassName('hoveredPeg');
  if (hovered) {
    for (const el of hovered) {
      el.classList.remove('hoveredPeg');
    }
  }
}

function backButton() {
  if (currentMoves.hasUserMoves()) {
    currentMoves.popMove();
    showAllMoves(currentMoveNum, null);
  } else if (currentMoveNum > 0) {
    showAllMoves(currentMoveNum - 1, null);
  }
}

function nextButton() {
  if (!currentMoves.hasUserMoves() && currentMoveNum < currentMoves.moves.length) {
    showAllMoves(currentMoveNum + 1, null);
  }
}

function clearBoard() {
  turn = 1;
  twixtGame = new TwixtController(BOARD_SIZE);
  cutLink = null;
  holdingForMarkers = false;
  numLinkableMarkers = 0;

  const b = $(`boardglass${bg}`);
  while (b.firstChild) b.removeChild(b.firstChild);

  $('newwhitepeg').style.display = 'none';
  $('newblackpeg').style.display = 'none';
}

// ─── Mouse / board interaction ────────────────────────────────────────────────

function mouseOverBoard(evt) {
  unhighlightMoveInSidebar();

  const pixelX = evt.pageX;
  const pixelY = evt.pageY;

  if (isPegSpot(pixelX, pixelY)) {
    if (linkCrossingPolicy === LINK_REMOVAL) eraseCutLink();

    const x = xCoord(pixelX);
    const y = yCoord(pixelY);
    const peg = twixtGame.board.getPeg(x, y);

    if (peg) {
      highlightMoveInSidebar(peg);
    }

    if (!holdingForMarkers && twixtGame.board.isLegalSpot(x, y, turn)) {
      if (peg == null) {
        drawCrosshair(x, y, turn);
      } else {
        drawTickMarks(xPixels(x), yPixels(y), '#808080');
      }
    } else {
      eraseCrosshair();
    }
  } else {
    eraseCrosshair();

    if (linkCrossingPolicy === LINK_REMOVAL) {
      const link = getRemovableLink(pixelX, pixelY, turn);
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
    const peg = twixtGame.board.getPeg(x, y);

    if (peg == null && !holdingForMarkers && twixtGame.board.isLegalSpot(x, y, turn)) {
      const peg = placePeg(x, y);
      showUserMovesText();
      highlightMoveInSidebar(peg);
    } else if (linkCrossingPolicy === LINK_REMOVAL && peg != null && peg.color === turn) {
      placeLinks(peg, false);
      if (holdingForMarkers && numLinkableMarkers === 0) {
        nextTurn();
        holdingForMarkers = false;
      }
    }
  } else if (linkCrossingPolicy === LINK_REMOVAL && cutLink != null) {
    executeCutLink();
  }
  return true;
}

function placePeg(x, y) {
  const peg = twixtGame.placePeg(x, y, turn);
  drawPeg(peg);
  placeLinks(peg, true);
  if (numLinkableMarkers === 0) nextTurn();
  else holdingForMarkers = true;
  return peg;
}

function placeLinks(peg, isNew) {
  twixtGame.addLinksTo(peg, isNew);
  drawLinks(peg);
  if (linkCrossingPolicy === LINK_REMOVAL) eraseLinkableMarkersAround(peg);
}

function executeCutLink() {
  const link = cutLink;
  link.remove();
  twixtGame.removeLink(link);
  eraseCutLink();
  eraseLink(link);
  drawLinkableMarkers(link);
}

function nextTurn() {
  if (!currentMoves.settingUp && !currentMoves.jumpingTo &&
      currentMoves.userMoves.length === 0 &&
      currentMoveNum < currentMoves.moves.length &&
      currentMoves.moves[currentMoveNum].getText() === twixtGame.move.getText()) {
    uncolorMove(currentMoveNum);
    currentMoveNum++;
    colorMove(currentMoveNum);
  } else {
    currentMoves.commitMove(twixtGame);
  }
  turn = 1 - turn;
  showTitle();
  if (linkCrossingPolicy === LINK_REMOVAL) {
    drawLinkableMarkersInBox(1, 1, BOARD_SIZE, BOARD_SIZE, turn);
  }
}

function showTitle() {
  $('turn').innerHTML = `${turn === 1 ? 'White' : 'Black'}'s turn:`;
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

function copyMovesToClipboard() {
  const plainText = '|' + currentMoves.getUserMoves()
    .map((move, index) => `${index + currentMoveNum + 1}.${move.getText()}`)
    .join(' ');

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

function drawLinks(peg) {
  peg.getLinks().forEach(link => drawLink(link));
}

function getLinkAt(x, y, dx, dy, color) {
  const peg = twixtGame.board.getPeg(x, y);
  if (peg != null && peg.color === color) return peg.getLink(dx, dy);
  return null;
}

function getRemovableLink(pixelX, pixelY, color) {
  const xd  = xDelta(pixelX);
  const yd  = yDelta(pixelY);
  const sxd = sign(xd);
  const syd = sign(yd);
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

function sign(x) { return (x < 0) ? -1 : 1; }

function isPegSpot(pixelX, pixelY) {
  const xd = xDelta(pixelX);
  const yd = yDelta(pixelY);
  return (xd * xd + yd * yd) < (PEG_SIZE * PEG_SIZE / 4 + 1);
}

function boardOffsetX() { return $('board')?.offsetLeft; }
function boardOffsetY() { return $('board')?.offsetTop; }

function xDelta(pixelX) { return pixelX - xPixels(xCoord(pixelX)) - boardOffsetX(); }
function yDelta(pixelY) { return pixelY - yPixels(yCoord(pixelY)) - boardOffsetY(); }
function xCoord(pixelX) { return Math.round((pixelX - 12.5 - boardOffsetX()) / GRID_SPACING); }
function yCoord(pixelY) { return Math.round((pixelY - 12.5 - boardOffsetY()) / GRID_SPACING); }
function xPixels(x)     { return 12.5 + GRID_SPACING * x; }
function yPixels(y)     { return 12.5 + GRID_SPACING * y; }

function drawPeg(peg) {
  const pegColor = (peg.color === 0) ? 'black' : 'white';
  const image = addImgToBoard(
    `/images/pieces/${pegColor}peg.gif`, `peg${peg.getPegName()}-${bg}`,
    xPixels(peg.x) - 7, yPixels(peg.y) - 7, PEG_SIZE, PEG_SIZE
  );
  eraseCrosshair();
  overlayNewPegMarker(image, pegColor);
}

function overlayNewPegMarker(image, pegColor) {
  $('newwhitepeg').style.display = 'none';
  $('newblackpeg').style.display = 'none';
  const newpeg = $(`new${pegColor}peg`);
  newpeg.style.left    = image.style.left;
  newpeg.style.top     = image.style.top;
  newpeg.style.display = 'inline';
}

function getMarkerName(x, y) { return `marker_${x}_${y}`; }

function drawLinkableMarkersInBox(minX, minY, maxX, maxY, color) {
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (twixtGame.isLinkable(x, y) && twixtGame.board.getPeg(x, y).color === color) {
        const markerName = getMarkerName(x, y);
        if (!$(markerName)) {
          addImgToBoard('/images/pieces/linkablemarker.gif', markerName,
            xPixels(x) - 6, yPixels(y) - 6, 13, 13);
          numLinkableMarkers++;
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
      if (m != null && !twixtGame.isLinkable(x, y)) {
        $('board').removeChild(m);
        numLinkableMarkers--;
      }
    }
  }
}

function eraseCrosshair() {
  const ch = $('crosshair');
  if (ch) ch.style.display = 'none';
  eraseTickMarks();
}

function eraseTickMarks() {
  ['vtick', 'vtick2', 'htick', 'htick2'].forEach(id => {
    const tick = $(id);
    if (tick) tick.style.display = 'none';
  });
}

function drawCrosshair(x, y) {
  const ch = $('crosshair');
  if (ch) {
    const leftPos = xPixels(x);
    const topPos  = yPixels(y);
    ch.style.left    = `${leftPos - 6}px`;
    ch.style.top     = `${topPos - 6}px`;
    ch.style.display = 'inline';
    drawTickMarks(leftPos, topPos, '#cc0000');
  }
}

function drawTickMarks(leftPos, topPos, color) {
  const boardPixels = BOARD_SIZE * GRID_SPACING;
  const tickStyle = `1px solid ${color}`;

  const vtick = getVtick('vtick');
  vtick.style.left       = `${leftPos}px`;
  vtick.style.borderLeft = tickStyle;

  const vtick2 = getVtick('vtick2');
  vtick2.style.left       = `${leftPos}px`;
  vtick2.style.top        = (boardPixels + 34) + 'px';
  vtick2.style.borderLeft = tickStyle;

  const htick = getHtick('htick');
  htick.style.top       = `${topPos}px`;
  htick.style.borderTop = tickStyle;

  const htick2 = getHtick('htick2');
  htick2.style.top       = `${topPos}px`;
  htick2.style.left      = (boardPixels + 34) + 'px';
  htick2.style.borderTop = tickStyle;
}

function getVtick(id) {
  let vtick = $(id);
  if (!vtick) {
    vtick = buildTickMark(id);
    vtick.style.height = '11px';
  }
  vtick.style.display = 'inline';
  return vtick;
}

function getHtick(id) {
  let htick = $(id);
  if (!htick) {
    htick = buildTickMark(id);
    htick.style.width = '11px';
  }
  htick.style.display = 'inline';
  return htick;
}

function buildTickMark(id) {
  const tick = document.createElement('div');
  tick.id = id;
  Object.assign(tick.style, { position: 'absolute', left: '1px', top: '1px', width: '0', height: '0' });
  const b = $('board');
  if (b) b.appendChild(tick);  // guard against race conditions on loading
  return tick;
}

function eraseCutLink() {
  if (cutLink != null) {
    const linkElement = $(`cut${cutLink.getLinkName()}`);
    cutLink = null;
    if (linkElement) $(`boardglass${bg}`).removeChild(linkElement);
    eraseTickMarks();
  }
}

function eraseLink(link) {
  const linkElement = $(`link${link.getLinkName()}`);
  if (linkElement) $(`boardglass${bg}`).removeChild(linkElement);
}

function drawLink(link)    { drawLinkGeneral(link, 'link'); }
function drawCutLink(link) {
  if (cutLink != null && link.getLinkName() !== cutLink.getLinkName()) eraseCutLink();
  drawLinkGeneral(link, 'cut');
  drawTickMarks(
    (xPixels(link.peg1.x) + xPixels(link.peg2.x)) / 2,
    (yPixels(link.peg1.y) + yPixels(link.peg2.y)) / 2,
    'red'
  );
  cutLink = link;
}

function drawLinkGeneral(link, linkType) {
  const id = `${linkType}${link.getLinkName()}-${bg}`;
  if ($(id)) return;

  const dx = sign(link.peg1.y - link.peg2.y) * (link.peg1.x - link.peg2.x);
  const linkImg = `/images/pieces/${
    dx === -2 ? 'wsw' : dx === -1 ? 'ssw' : dx === 1 ? 'sse' : 'ese'
  }${linkType}.gif`;

  if (Math.abs(dx) === 1) {
    addImgToBoard(linkImg, id, xPixels(link.minX()) + 1, yPixels(link.minY()) + 4, 15, 27);
  } else {
    addImgToBoard(linkImg, id, xPixels(link.minX()) + 4, yPixels(link.minY()) + 1, 27, 15);
  }
}

function addImgToBoard(imgfile, id, leftPos, topPos, width, height) {
  const b = $(`boardglass${bg}`);

  // Prevent the containing box from growing (needed in some browsers)
  b.style.width = `${46 + BOARD_SIZE * GRID_SPACING}px`;

  const img = document.createElement('img');
  img.src    = imgfile;
  img.width  = width;
  img.height = height;
  img.id     = id;
  Object.assign(img.style, { position: 'absolute', left: `${leftPos}px`, top: `${topPos}px` });

  b.appendChild(img);
  disableSelection(img);
  return img;
}

var LINK_REMOVAL = 0;
var PENCIL_AND_PAPER = 1;
var linkCrossingPolicy = PENCIL_AND_PAPER;

var turn = 1;
var twixtGame = new TwixtController(24);
var cutLink = null;
var holdingForMarkers = false;
var numLinkableMarkers = 0;
var currentMoveNum = null;   // current move in the mainline, not the variation
var currentMoves = new TwixtMoves();
var bg = 1;

document.onmousedown = clickOnBoard;
document.onmousemove = mouseOverBoard;
document.onkeydown = function(e) { keyIntercept(e); };
document.onkeypress = function(e) { keyIntercept(e); };

Event.observe(window, 'load', function() { disableSelections(); positionElements(); showMovesOnLoad(); });

function disableSelection(target) {
  if (typeof target.onselectstart!="undefined") {
    target.onselectstart = function() {return false;};  // IE
    target.style.KhtmlUserSelect = "none";  // Safari
  }
  else if (typeof target.style.MozUserSelect != "undefined") {
    target.style.MozUserSelect = "none";   //Firefox
  }
  else {  // All others
    target.onmousedown = function() {return false;};
  }
}
function disableSelections() {
  disableSelection($('board'));
  disableSelection($('newwhitepeg'));
  disableSelection($('newblackpeg'));
  disableSelection($('backLink'));
  disableSelection($('nextLink'));
}

function positionElements() {
  leftMargin = 10;
  topMargin = 80;

  var boardSize = twixtGame.board.size;  // 24
  var boardWidth = 46 + boardSize * 18;  // 478
  var boardHeight = 44 + boardSize * 18; // 476
  
  var ts = $('turn').style;
  ts.left = leftMargin + 'px';
  ts.top = topMargin + 'px';

  var bs = $('board').style;
  bs.left = leftMargin + 'px';
  bs.top = topMargin + 20 + 'px';
  bs.width = boardWidth + 'px';
  bs.height = boardHeight + 'px';
  
  var bg1s = $('boardglass1').style;
  bg1s.left = leftMargin + 1 + 'px';
  bg1s.top = topMargin + 21 + 'px';
  bg1s.width = boardWidth + 'px';
  bg1s.height = boardHeight + 'px';
  
  var bg2s = $('boardglass2').style;
  bg2s.left = leftMargin + 1 + 'px';
  bg2s.top = topMargin + 21 + 'px';
  bg2s.width = boardWidth + 'px';
  bg2s.height = boardHeight + 'px';
  
  var mgs = $('markerglass').style;
  mgs.left = leftMargin + 1 + 'px';
  mgs.top = topMargin + 21 + 'px';
  mgs.width = boardWidth + 'px';
  mgs.height = boardHeight + 'px';
  
  var sbs = $('sidebar').style;
  sbs.left = (leftMargin + boardWidth + 10) + 'px';
  sbs.top = topMargin + 20 + 'px';
  sbs.right = '10px';
  sbs.display = 'inline';
  
  var ubs = $('underbar').style;
  ubs.left = leftMargin + 'px';
  ubs.top = (topMargin + boardHeight + 30) + 'px';
  ubs.width = boardWidth + 'px';

  var cs = $('comments').style;
  cs.left = (leftMargin + boardWidth + 10) + 'px';
  cs.bottom = '10px';
  cs.right = '10px';
  cs.display = 'inline';
  setCommentDivTop();
}

function setCommentDivTop() {
  var cs = $('comments').style;
  cs.top = topMargin + 30 + $('sidebar').offsetHeight + 'px';
  
  // compensate for IE's shortcomings
  if(typeof(window.innerWidth) == 'number') {
    // Not IE; we're good
  }
  else {
    // Uh-oh, IE
    var height = 0;
    var width  = 0;
    
    if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
      //IE 6+ in 'standards compliant mode'
      height = document.documentElement.clientHeight;
      width  = document.documentElement.clientWidth;
    } else if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
      //IE 4 compatible
      height = document.body.clientHeight;
      width  = document.body.clientWidth;
    }
    var top  = $('comments').offsetTop;
    var left = $('comments').offsetLeft;

    var newWidth = width - left - 10;
    var newHeight = height - top - 10;

    if (newHeight > 0) {
      cs.height = newHeight + 'px';
    }
    if (newWidth > 0) {
      cs.width  = newWidth + 'px';
      $(sidebar).style.width = newWidth + 'px';
    }
  }
}

function showMovesOnLoad() {
  var movesJson = $F('movesJson');
  if (movesJson != null && movesJson.length > 0) {
    var moves = eval(movesJson);
    
    var swapped = (moves.length > 1 && moves[1].type == 2);
    if (swapped) {
      var tmp = moves[0].x;
      moves[0].x = moves[0].y;
      moves[0].y = tmp;
      moves[0].player = 3 - moves[0].player;
    }
    
    currentMoves.settingUp = true;
    var gameIsInProgress = true;
    moves.each(function (move) {
      if (move.type == 1) {
        turn = 2 - move.player;
        placePeg(move.x, move.y);
      }
      else if (move.type == 2) {
        currentMoves.swapFirstMove();
      }
      else if (move.type == 3) {
        currentMoves.finalMove(new ResignMove());
        gameIsInProgress = false;
      }
      else if (move.type == 4) {
        currentMoves.finalMove(new DrawMove());
        gameIsInProgress = false;
      }
      else if (move.type == 5) {
        currentMoves.finalMove(new ForfeitMove());
        gameIsInProgress = false;
      }
      else if (move.type == 6) {
        currentMoves.finalMove(new LostMove());
        gameIsInProgress = false;
      }
    });
    currentMoves.settingUp = false;
    currentMoveNum = currentMoves.moves.length - (gameIsInProgress? 0:1);
    
    showMovesText();
  }
}

function showMovesText() {
  var movesTextDiv = $('moves');
  
  var moveNum = 1;
  currentMoves.getMoves().each(function (move) {
    var className = (moveNum % 2 == 0)? 'black' : 'white';
    var moveText = moveNum + "." + move.getText();

    movesTextDiv.innerHTML += " <a id='move_" + moveNum + "' class='" + className + 
      "' href='' onclick='jumpTo(" + moveNum + "); return false;'>" + moveText + 
      "</a> ";

    moveNum ++;
  });
  setCommentDivTop();
}

function getUserMovesFirstNum() {
  var moveNum = currentMoveNum;
  
  if (moveNum > 0) {
    var move = currentMoves.getMoves()[moveNum - 1];
    if (!(move.peg || move.getText() == 'swap')) {
      // back off from "resign", "forfeit", "draw", "loss"
      moveNum --;
    }
  }
  return moveNum + 1;
}

function showUserMovesText() {
  var userMovesText = '';

  if (currentMoves.hasUserMoves()) {
    userMovesText += "|<span class='userMoves'>";
    var moveNum = getUserMovesFirstNum();

    currentMoves.getUserMoves().each(function (move) {
      var className = (moveNum % 2 == 0)? 'black' : 'white';
      var moveText = moveNum + "." + move.getText();
      userMovesText += "<span class='" + className + "'>" + moveText + "</span> ";
      moveNum ++;
    });
    userMovesText += "</span>";
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
    // can't jump to a move beyond the end of the game. So continue numbering from end.
    firstMoveNum = currentMoves.getMoves().length;
  }
  uncolorMove(currentMoveNum);
  currentMoves.clearUserMoves();
  showAllMoves(firstMoveNum - 1, commentMoves);
}

function cJump(firstMoveNum, moves) {
  var nextMoveNum = null;
  if (currentMoveNum != null) {
    nextMoveNum = currentMoveNum + currentMoves.getUserMoves().length + 1;
  }

  if (nextMoveNum == firstMoveNum) {
    // no overlap, continue from current
    placeCommentPegs(moves);
  }
  else if (nextMoveNum > firstMoveNum && overlapMovesMatch(firstMoveNum, nextMoveNum, moves)) {
    // overlap, but overlap matches
    if (nextMoveNum <= firstMoveNum + moves.length) {
      placeCommentPegs(moves.slice(nextMoveNum - firstMoveNum));
    }
    else {
      if (currentMoves.hasUserMoves()) {
        uncolorMove(currentMoveNum);
        // going backwards
        for (var i = 0; i < (nextMoveNum - (firstMoveNum + moves.length)); i++) {
          if (currentMoves.hasUserMoves()) {
            currentMoves.popMove();
          }
          else {
            currentMoveNum --;
          }
        }
        showAllMoves(currentMoveNum, null);
      }
      else {
        jumpTo(firstMoveNum - 1);
        placeCommentPegs(moves);
      }
    }
  }
  else if (nextMoveNum > firstMoveNum && firstMoveNum > currentMoves.getMoves().length) {
    // no overlap, but beyond the mainline variation, so back up and go down this path
    for (var i = 0; i < (nextMoveNum - firstMoveNum); i++) {
      currentMoves.popMove();
    }
    showAllMoves(currentMoveNum, moves);
  }
  else {
    cJumpMain(firstMoveNum, moves);
  }  
}

function overlapMovesMatch(firstMoveNum, nextMoveNum, moves) {
  for (var moveNum = firstMoveNum; moveNum < Math.min(nextMoveNum, firstMoveNum + moves.length); moveNum++) {
    var shownMove = (moveNum <= currentMoveNum)? currentMoves.getMoves()[moveNum - 1] :
                                                 currentMoves.getUserMoves()[moveNum - currentMoveNum - 1];
    if (shownMove.getText().toUpperCase() != moves[moveNum - firstMoveNum].toUpperCase()) {
      return false;
    }
  }
  return true;
}

function placeCommentPegs(moves) {
  var errors = getCommentPegErrors(moves);
  
  if (errors.length == 0) {
    moves.each(function(move) {
      placePegByNotation(move);
    });
    showUserMovesText();
  }
  else {
    alert(errors);
  }
}

function getCommentPegErrors(moves) {
  var errors = '';
  var movesSoFar = 0;
  moves.each(function(move) {
    errors += getNextCommentPegError(move, movesSoFar);
    movesSoFar ++;
  });
  return errors;
}

function getNextCommentPegError(pegString, movesSoFar) {
  if (pegString == "swap") {
    var pegsSoFar = twixtGame.board.getAllPegs().length + movesSoFar;
    if (pegsSoFar == 0) {
      return "- Cannot swap as the first move of the game.";
    }
    else if (pegsSoFar > 1) {
      return "- Cannot swap. There is more than one peg on the board.";
    }
    else {
      return "";
    }
  }
  
  var x = pegString.toUpperCase().charCodeAt(0) - 64;
  var y = parseInt(pegString.substr(1), 10);

  if (twixtGame.board.getPeg(x, y) != null) {
    return "- Peg " + pegString + " cannot be placed because there is already a peg on that spot.\n";
  }
  else if (!twixtGame.board.isLegalSpot(x,y, (turn + movesSoFar + 1) % 2)) {
    return "- Illegal spot for peg: " + pegString + "\n";
  }
  else {
    return "";
  }
}

function placePegByNotation(pegString) {
  if (pegString.toLowerCase() == "swap") {
    swapFirstPeg();
  }
  else {
    var x = pegString.toUpperCase().charCodeAt(0) - 64;
    var y = parseInt(pegString.substr(1), 10);

    if (twixtGame.board.getPeg(x, y) == null && twixtGame.board.isLegalSpot(x,y, turn)) {
      placePeg(x, y);
    }
  }
}

// only used by comment clicking; on other occasions, it's handled more efficiently
function swapFirstPeg() {
  var pegs = twixtGame.board.getAllPegs();
  if (pegs.length == 1) {
    var peg = pegs[0];
    clearBoard();
    turn = 1 - turn;
    placePeg(peg.y, peg.x);
    
    // unfortunately, it erroneously put the peg on the user moves stack; must correct that.
    currentMoves.popMove();
    var firstMove = (currentMoves.hasUserMoves())? currentMoves.userMoves[0] : currentMoves.moves[0];
    var peg1 = firstMove.peg;
    if (!peg1.swapped) {
      peg1.swapped = true;
      var tmp = peg1.x;
      peg1.x = peg1.y;
      peg1.y = tmp;
    }
    if (currentMoves.hasUserMoves() || (currentMoves.moves.length > 1 && currentMoves.moves[1].getText().toLowerCase() != "swap")) {
      currentMoves.userMoves.push(new SwapMove());
    }
    else {
      uncolorMove(currentMoveNum);
      currentMoveNum++;
      colorMove(currentMoveNum, '#ff8080');
    }
  }
}

function showMovesUpTo(moves, moveNum) {
  for(var i = 0; i < moveNum; i++) {
    var move = moves[i];
    if (move.peg) {
      if (move.peg.swapped && 
          ((!currentMoves.hasUserMoves() && moveNum == 1) ||
            (currentMoves.hasUserMoves() && (currentMoveNum + currentMoves.userMoves.length == 1)))) {
        // jump to move 1: show the peg in its original unswapped position.
        placePeg(move.peg.y, move.peg.x);
      }
      else {
        if (i == 0 && move.peg.swapped) {
          // switch color for swapped first peg.
          turn = 1 - turn;
        }
        placePeg(move.peg.x, move.peg.y);
      }
    }
    else if (move.getText == 'swap') {
      nextTurn();
    }
  }
}

function showAllMoves(moveNum, commentMoves) {
  uncolorMove(currentMoveNum);
  colorMove(moveNum, '#ff8080');

  currentMoves.jumpingTo = true;
  bg = 3 - bg;  // 1 --> 2, 2 --> 1 (double buffering)

  clearBoard();
  
  var moves = currentMoves.getMoves();

  // make sure swapping is figured out
  var firstMove = (moveNum > 0)? moves[0] : (currentMoves.hasUserMoves()? currentMoves.userMoves[0] : null);
  var secondMove = (moveNum > 1)? moves[1] :
                   (moveNum == 1)? (currentMoves.hasUserMoves()? currentMoves.userMoves[0] : null) :
                   (moveNum == 0)? ((currentMoves.userMoves.length > 1)? currentMoves.userMoves[1] : null) : null;
  if (firstMove && secondMove) {
    var swapped = (secondMove.getText() == 'swap');
    var peg1 = firstMove.peg;
    if (peg1.swapped != swapped) {
      peg1.swapped = swapped;
      var tmp = peg1.x;
      peg1.x = peg1.y;
      peg1.y = tmp;
    }
  }
  
  // show mainline moves
  showMovesUpTo(moves, moveNum);
  currentMoveNum = moveNum;

  // add user moves
  if (currentMoves.hasUserMoves()) {
    var userMoves = currentMoves.getUserMoves();
    showMovesUpTo(userMoves, userMoves.length);
  }
  
  currentMoves.jumpingTo = false;

  // add comment moves
  if (commentMoves != null) {
    var errors = getCommentPegErrors(commentMoves);

    if (errors.length == 0) {
      commentMoves.each(function(move) {
        placePegByNotation(move);
      });
    }
    else {
      alert(errors);
    }
  }
  showUserMovesText();

  // double buffering to eliminate flicker on slow machines
  $('boardglass' + bg).style.display = 'inline';
  $('boardglass' + (3-bg)).style.display = 'none';
  
  // Safari loses the new peg marker unless we put its div back on top
  $('markerglass').style.zIndex = $('boardglass' + bg).style.zIndex + 1;
}

function uncolorMove(moveNum) {
  colorMove(moveNum, '#b0b0b0');
}

function colorMove(moveNum, color) {
  if (moveNum != null && moveNum > 0) {
    var moveElement = $('move_' + moveNum);
    if (moveElement) {
      moveElement.style.backgroundColor = color;
    }
  }
}

function backButton() {
  if (currentMoves.hasUserMoves()) {
    currentMoves.popMove();
    showAllMoves(currentMoveNum, null);
  }
  else if (currentMoveNum > 0) {
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
  twixtGame = new TwixtController(24);
  cutLink = null;
  holdingForMarkers = false;
  numLinkableMarkers = 0;
  
  var b = $('boardglass' + bg);
  for (var i = b.childNodes.length-1; i>=0; i--) {
    var childNode = b.childNodes[i];
    b.removeChild(childNode);
  }
  
  $('newwhitepeg').style.display = 'none';
  $('newblackpeg').style.display = 'none';
}

// -----------------------------------------------------

function mouseOverBoard(evt) {
  if (evt == null) {
    evt = event;
  }
  var pixelX = (document.all)? evt.clientX - 2 : evt.pageX;
  var pixelY = (document.all)? evt.clientY - 2 : evt.pageY;

  if (isPegSpot(pixelX, pixelY))
  {
    if (linkCrossingPolicy == LINK_REMOVAL) {
      eraseCutLink();
    }
    
    var x = xCoord(pixelX);
    var y = yCoord(pixelY);

    var peg = twixtGame.board.getPeg(x, y);

    if (!holdingForMarkers && twixtGame.board.isLegalSpot(x,y, turn)) {
      if (peg == null) {
        drawCrosshair(x, y, turn);
      }
      else {
        drawTickMarks(xPixels(x), yPixels(y), '#808080');
      }
    }
    else {
      eraseCrosshair();
    }
  }
  else
  {
    eraseCrosshair();

    if (linkCrossingPolicy == LINK_REMOVAL) {
      var link = getRemovableLink(pixelX, pixelY, turn);

      if (link != null) {
        drawCutLink(link);
      }
      else {
        eraseCutLink();
      }
    }
  }
  return true;
}

function clickOnBoard(evt) {
  if (evt == null) {
    evt = event;
  }
  var pixelX = (document.all)? evt.clientX - 2 : evt.pageX;
  var pixelY = (document.all)? evt.clientY - 2 : evt.pageY;

  if (isPegSpot(pixelX, pixelY))
  {
    var x = xCoord(pixelX);
    var y = yCoord(pixelY);
    var peg = twixtGame.board.getPeg(x, y);

    if (peg == null && !holdingForMarkers && twixtGame.board.isLegalSpot(x,y, turn)) {
      placePeg(x, y);
      showUserMovesText();
    }
    else if (linkCrossingPolicy == LINK_REMOVAL && peg != null && peg.color == turn) {
      placeLinks(peg, false);

      if (holdingForMarkers && numLinkableMarkers == 0) {
        nextTurn();
        holdingForMarkers = false;
      }
    }
  }
  else if (linkCrossingPolicy == LINK_REMOVAL && cutLink != null) {
    executeCutLink();
  }

  return true;
}

function placePeg(x, y)
{
  var peg = twixtGame.placePeg(x, y, turn);
  
  drawPeg(peg);
  placeLinks(peg, true);

  if (numLinkableMarkers == 0) {
    nextTurn();
  }
  else {
    holdingForMarkers = true;
  }
}

function placeLinks(peg, isNew)
{
  twixtGame.addLinksTo(peg, isNew);
  drawLinks(peg);
  if (linkCrossingPolicy == LINK_REMOVAL) {
    eraseLinkableMarkersAround(peg);
  }
}

function executeCutLink()
{
  var link = cutLink;
  link.remove();
  twixtGame.removeLink(link);

  eraseCutLink();
  eraseLink(link);
  drawLinkableMarkers(link);
}

function nextTurn()
{  
  if (!currentMoves.settingUp && !currentMoves.jumpingTo &&   // if user clicked on the Twixt board
    currentMoves.userMoves.length == 0 &&                     // and it's the first user move (not in a variation already)
    currentMoveNum < currentMoves.moves.length &&             // and the next move isn't "resign"
    currentMoves.moves[currentMoveNum].getText() == twixtGame.move.getText())   // and it's the same move as in the game
  { 
    uncolorMove(currentMoveNum);
    currentMoveNum ++;
    colorMove(currentMoveNum, '#ff8080');
  }
  else {
    currentMoves.commitMove(twixtGame);
  }
  turn = 1 - turn;

  showTitle();
  if (linkCrossingPolicy == LINK_REMOVAL) {
    drawLinkableMarkersInBox(1, 1, twixtGame.board.size, twixtGame.board.size, turn);
  }
}

function showTitle() {
  $('turn').innerHTML = ((turn==1)?'White' : 'Black') + "'s turn:";
}

function drawLinks(peg)
{
  var links = peg.getLinks();
  for (var i=0; i<links.length; i++) {
    drawLink(links[i]);
  }
}

function getLinkAt(x, y, dx, dy, turn)
{
    var peg = twixtGame.board.getPeg(x, y);
    if (peg != null && peg.color == turn) {
      return peg.getLink(dx, dy);
    }
    return null;
}

function getRemovableLink(pixelX, pixelY, turn)
{
  var xd = xDelta(pixelX);  // pixel distance to nearest peg spot
  var yd = yDelta(pixelY);
  var sxd = sign(xd);
  var syd = sign(yd);
  var x = xCoord(pixelX - xd);  // nearest peg spot coordinates (doesn't need to contain a peg)
  var y = yCoord(pixelY - yd);

  // find nearby link - warning: heavy logic follows...
  if (Math.abs(xd) > Math.abs(yd)) { // Nearer horizontal
    return getLinkAt(x, y-1, sxd, 2, turn) || getLinkAt(x + sxd, y-1, -sxd, 2, turn) ||
      (yd != 0 ? (getLinkAt(x, y, 2 * sxd, syd, turn) || getLinkAt(x + sxd, y, -2 * sxd, syd, turn)) : null);
  }
  else if (Math.abs(xd) < Math.abs(yd)) { // Nearer vertical
    return getLinkAt(x-1, y, 2, syd, turn) || getLinkAt(x-1, y + syd, 2, -syd, turn) ||
      (xd != 0 ? (getLinkAt(x, y, sxd, 2 * syd, turn) || getLinkAt(x, y + syd, sxd, -2 * syd, turn)) : null);
  }
  else if (xd != 0 && yd != 0) { // On 45-degree diagonal, but not right on the peg
    return getLinkAt(x, y + syd, sxd, -2 * syd, turn) || getLinkAt(x + sxd, y, -2 * sxd, syd, turn);
  }
  return null;
}

function sign(x) {
  return (x < 0)? -1:1;
}

function isPegSpot(pixelX, pixelY) {
  var xd = xDelta(pixelX);
  var yd = yDelta(pixelY);
  // peg is a circle
  var distSquared = xd*xd + yd*yd;
  return (distSquared < 43);
}

function boardOffsetX() {
  return $('board').offsetLeft;
}
function boardOffsetY() {
  return $('board').offsetTop;
}

function xDelta(pixelX) {
  return pixelX - xPixels(xCoord(pixelX)) - boardOffsetX();
}
function yDelta(pixelY) {
  return pixelY - yPixels(yCoord(pixelY)) - boardOffsetY();
}
function xCoord(pixelX) {
  return Math.round((pixelX - 14 - boardOffsetX()) / 18);
}
function yCoord(pixelY) {
  return Math.round((pixelY - 13 - boardOffsetY()) / 18);
}
function xPixels(x) {
  return 14 + 18*x;
}
function yPixels(y) {
  return 13 + 18*y;
}

function drawPeg(peg) {
  var pegColor = (peg.color == 0)? 'black': 'white';
  var leftPos = xPixels(peg.x) - 6;
  var topPos = yPixels(peg.y) - 6;
  var image = addImgToBoard('/images/pieces/' + pegColor + 'peg.gif', 'peg', leftPos, topPos, 13, 13);
  eraseCrosshair();

  overlayNewPegMarker(image, pegColor);
}

function overlayNewPegMarker(image, pegColor) {
  $('newwhitepeg').style.display = 'none';
  $('newblackpeg').style.display = 'none';
  var newpeg = 'new' + pegColor + 'peg';
  $(newpeg).style.left = image.style.left;
  $(newpeg).style.top = image.style.top;
  $(newpeg).style.display = 'inline';
}

function getMarkerName(x, y) {
  return 'marker_' + x + '_' + y;
}

function drawLinkableMarkersInBox(minX, minY, maxX, maxY, color)
{
  for (var x = minX; x <= maxX; x++) {
    for (var y = minY; y <= maxY; y++) {
      if (twixtGame.isLinkable(x, y) && twixtGame.board.getPeg(x, y).color == color) {
        var markerName = getMarkerName(x, y);
        if ($(markerName) == null) {
          addImgToBoard('/images/pieces/linkablemarker.gif', markerName, xPixels(x) - 6, yPixels(y) - 6, 13, 13);
          numLinkableMarkers++;
        }
      }
    }
  }
}

function drawLinkableMarkers(link)
{
  drawLinkableMarkersInBox(link.minX() - 1, link.minY() - 1, link.maxX() + 1, link.maxY() + 1, link.peg1.color);
}

function eraseLinkableMarkersAround(peg)
{
  for (var x = peg.x - 3; x <= peg.x + 3; x++) {
    for (var y = peg.y - 3; y <= peg.y + 3; y++) {
      var markerName = getMarkerName(x, y);
      var m = $(markerName);
      if (m != null) {
        if (!twixtGame.isLinkable(x, y)) {
          var b = document.getElementById('board');
          b.removeChild(m);
          numLinkableMarkers--;
        }
      }
    }
  }
}

function eraseCrosshair() {
  var ch = $('crosshair');
  if (ch != null) {
    ch.style.display = "none";
  }
  eraseTickMarks();
}

function eraseTickMarks() {
  eraseTickMark('vtick');
  eraseTickMark('vtick2');
  eraseTickMark('htick');
  eraseTickMark('htick2');
}

function eraseTickMark(id) {
  var tick = $(id);
  if (tick != null) {
    tick.style.display = 'none';
  }
}

function drawCrosshair(x, y, color) {
  var ch = $('crosshair');
  if (ch != null) {
    var leftPos = xPixels(x);
    var topPos = yPixels(y);
    ch.style.left = (leftPos - 6) + 'px';
    ch.style.top = (topPos - 6) + 'px';
    ch.style.display = 'inline';
  }
  drawTickMarks(leftPos, topPos, '#cc0000');
}

function drawTickMarks(leftPos, topPos, color) {
  var tickStyle = '1px solid ' + color;
  var vtick = getVtick('vtick');
  vtick.style.left = leftPos + 'px';
  vtick.style.borderLeft = tickStyle;
  
  var vtick2 = getVtick('vtick2');
  vtick2.style.left = leftPos + 'px';
  vtick2.style.top = '464px';
  vtick2.style.borderLeft = tickStyle;
  
  var htick = getHtick('htick');
  htick.style.top = topPos + 'px';
  htick.style.borderTop = tickStyle;

  var htick2 = getHtick('htick2');
  htick2.style.top = topPos + 'px';
  htick2.style.left = '466px';
  htick2.style.borderTop = tickStyle;
}

function getVtick(id) {
  var vtick = $(id);
  if (vtick == null) {
    vtick = buildTickMark(id);
    vtick.style.height = '11px';
  }
  vtick.style.display = 'inline';
  return vtick;
}

function getHtick(id) {
  var htick = $(id);
  if (htick == null) {
    htick = buildTickMark(id);
    htick.style.width  = '11px';
  }
  htick.style.display = 'inline';
  return htick;
}

function buildTickMark(id) {
  var tick = document.createElement("DIV");
  tick.setAttribute("id", id);
  tick.style.position = "absolute";
  tick.style.left = "1px";
  tick.style.top  = "1px";
  tick.style.width  = "0px";
  tick.style.height = "0px";
  var b = $('board');
  if (b != null) b.appendChild(tick);  // race conditions on loading
  return tick;
}

function eraseCutLink() {
  if (cutLink != null)
  {
    var linkElement = $('cut' + cutLink.getLinkName());
    cutLink = null;
    if (linkElement != null) {
      $('boardglass' + bg).removeChild(linkElement);
    }
    eraseTickMarks();
  }
}

function eraseLink(link) {
  var linkElement = $('link' + link.getLinkName());
  if (linkElement != null) {
    $('boardglass' + bg).removeChild(linkElement);
  }
}

function drawLink(link) {
  drawLinkGeneral(link, 'link');
}

function drawCutLink(link) {
  if (cutLink != null && link.getLinkName() != cutLink.getLinkName()) {
    eraseCutLink();
  }
  drawLinkGeneral(link, 'cut');
  drawTickMarks((xPixels(link.peg1.x) + xPixels(link.peg2.x))/2, (yPixels(link.peg1.y) + yPixels(link.peg2.y))/2, 'red');
  cutLink = link;
}

function drawLinkGeneral(link, linkType)
{
  var id = linkType + link.getLinkName() + "-" + bg;
  if ($(id) != null) return;

  var dx = sign(link.peg1.y - link.peg2.y) * (link.peg1.x - link.peg2.x);

  var linkImg = '/images/pieces/' +
                ((dx == -2)? 'wsw':
                 (dx == -1)? 'ssw':
                 (dx ==  1)? 'sse':
                             'ese') + linkType + '.gif';
  var leftPos = xPixels(link.minX());
  var topPos = yPixels(link.minY());

  if (Math.abs(dx) == 1) {
    addImgToBoard(linkImg, id, leftPos + 2, topPos + 5, 15, 27);
  }
  else {
    addImgToBoard(linkImg, id, leftPos + 5, topPos + 2, 27, 15);
  }
}

function addImgToBoard(imgfile, id, leftPos, topPos, width, height)
{
  var b = $('boardglass' + bg);

  // Safari needs this, so the box doesn't grow
  var boardSize = twixtGame.board.size;
  var boardWidth = 46 + boardSize * 18;
  b.style.width = boardWidth + "px";

  var img = document.createElement("IMG");
  img.setAttribute("src", imgfile);
  img.setAttribute("width", width);
  img.setAttribute("height", height);
  img.setAttribute("id", id);
  img.style.position = "absolute";
  img.style.left = leftPos + "px";
  img.style.top = topPos + "px";
  b.appendChild(img);
  disableSelection(img);

  return img;
}

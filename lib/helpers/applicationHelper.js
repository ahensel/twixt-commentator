
// Escape < and > only (same behaviour as Rails h2 helper)
function h2(html) {
  if (html == null) return '';
  return String(html).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sanitize and convert newlines — simple allow-list sanitiser
const ALLOWED_TAGS = /(<\/?(b|i|u|em|strong|s|strike|sup|sub|blockquote|code|pre|br\s*\/?)>)/gi;
function sanitize(html) {
  if (html == null) return '';
  // Strip all tags except the allowed list
  return String(html)
    .replace(/<[^>]*>/g, tag => ALLOWED_TAGS.test(tag) ? tag : '')
    // reset lastIndex after stateful regex
    .replace(/<[^>]*>/g, tag => {
      ALLOWED_TAGS.lastIndex = 0;
      return ALLOWED_TAGS.test(tag) ? tag : '';
    });
    // simpler: just strip unknown tags
}

// Better sanitizer: keep only known safe opening/closing tags, strip everything else
function sanitizeHtml(html) {
  if (html == null) return '';
  const allowed = /^<\/?(b|i|u|em|strong|s|strike|sup|sub|blockquote|code|pre|br)(\s[^>]*)?>$/i;
  return String(html).replace(/<[^>]*>/g, tag => allowed.test(tag) ? tag : '');
}

function xssize(html) {
  return sanitizeHtml(html).replace(/\n/g, '<br/>');
}

function prepareComment(html, swapStyle) {
  let out = sanitizeHtml(html);
  out = hiliteTwixtMoves(out, swapStyle);
  return out.replace(/\n/g, '<br/>');
}

// Returns the CSS class ('black' or 'white') for a move in a comment sequence.
// When swapped is true (pie-rule swap occurred), colors flip from move 3 onward.
function getMoveColorForComment(moveNum, swapped) {
  if (swapped && moveNum === 2) return 'black-white-swap';
  const isOdd = moveNum % 2 === 1;
  if (swapped && moveNum >= 3) return isOdd ? 'black' : 'white';
  return isOdd ? 'white' : 'black';
}

// Detects move sequences in comment text and wraps them in clickable <a> links.
function hiliteTwixtMoves(html, swapStyle) {
  // Regex parts
  const moveDigits = '(?:5[0-2]|[1-4]\\d|[1-9])' // 1 to 52, inclusive
  const linkAction = `(?:[-/\\\\](?:[a-zA-Z]\'${moveDigits}|[a-zA-Z]${moveDigits}\'))`; // link removal notation
  const pegAction = `[a-zA-Z]${moveDigits}\\**`; // optional asterisks to illustrate number of auto-links
  const actionMove = `(?:${linkAction})*${pegAction}|swap`;
  const endMove = 'resign|draw|forfeit|lost';
  const m = `(?:${actionMove}|${endMove}|\\?+)`;
  const dot = '\\.\\s?';
  const nm = `[1-9]\\d*${dot}${m}`;          // numbered move like 12.m7
  const seq = `${nm}(?:\\s+${nm})*`;         // sequence of numbered moves
  const pre = `(?:\\|\\s*)?`;                // optional | prefix

  const fullPattern = new RegExp(`${pre}${seq}`, 'g');
  const nmPattern = new RegExp(nm, 'g');
  const nmSplit = new RegExp(dot);
  const actionMovePattern = new RegExp(actionMove);

  let moveArray = [];
  let firstMoveNum = null;
  let lastMoveNum = 0;
  let hasSwapped = false;  // true after a pie-rule swap is seen at move 2

  // commentaryByMoveNum records the board state (moveArray + firstMoveNum) after
  // every move — both | main-sequence moves and prose moves. Prose sequences use
  // this to find context for move N by looking up the most recent state at N-1,
  // regardless of whether that state came from the main game or from prose.
  // (e.g. "4.o10" after "15.i9 … 3.j10" looks up commentaryByMoveNum[3] and
  // finds j10's context, not the main-game's move 3.)
  const commentaryByMoveNum = {};

  return html.replace(fullPattern, (moves) => {
    const isMain = moves.startsWith('|');
    if (isMain) {
      moveArray = [];
      firstMoveNum = null;
      lastMoveNum = 0;
      hasSwapped = false;
    }
    const jumpMethod = isMain ? 'cJumpMain' : 'cJump';

    const replaced = moves.replace(nmPattern, (move) => {
      const parts = move.split(nmSplit);
      const moveNumStr = parts[0];
      const moveText = parts.slice(1).join('.');
      const moveNum = parseInt(moveNumStr, 10);

      // Detect a pie-rule swap at move 2 so moves 3+ get flipped colors.
      if (swapStyle === 'P' && moveNum === 2 && moveText === 'swap') {
        hasSwapped = true;
      }
      const color = getMoveColorForComment(moveNum, hasSwapped);

      const isAction = actionMovePattern.test(moveText);
      if (isAction) {
        const moveOffset = lastMoveNum + 1 - moveNum;
        if (moveOffset !== 0) {
          // For non-| sequences, prefer the last commentary state at moveNum-1
          // so e.g. "4.o10" after "15.i9 … 3.j10" uses j10 as the base for
          // move 3, not q11 from the main sequence that seeded 15.i9.
          const savedBase = !isMain ? commentaryByMoveNum[moveNum - 1] : null;
          if (savedBase) {
            moveArray = savedBase.arr.slice();
            firstMoveNum = savedBase.firstMoveNum;
          } else if (moveOffset > 0 && moveOffset <= moveArray.length) {
            moveArray.splice(moveArray.length - moveOffset, moveOffset);
          } else {
            // No usable context: start this sequence fresh.
            moveArray = [];
            firstMoveNum = moveNum;
          }
        }
        moveArray.push(moveText.split('*')[0]);
        lastMoveNum = moveNum;
      }
      if (firstMoveNum === null) firstMoveNum = moveNum;

      // Save the state after every move (main and prose) so that later prose
      // sequences can seed from the main game when no prior prose move N-1 exists.
      if (isAction) {
        commentaryByMoveNum[moveNum] = { arr: moveArray.slice(), firstMoveNum };
      }

      return `<a href='' class='${color}' onclick='${jumpMethod}(${firstMoveNum}, ${JSON.stringify(moveArray).replace(/'/g, "&#39;")}); return false;'>${move}</a>`;
    });

    if (isMain) {
      return `|<span class='moves'>${replaced.slice(1)}</span>`;
    } else {
      return `<span class='moves'>${replaced}</span>`;
    }
  });
}

// Pagination helper
// Returns an array of page descriptors: { page: Number|null, label: String }
// (null page means '...' ellipsis)
function paginationLinks(currentPage, totalPages, buildUrl) {
  const cur = (currentPage == null || currentPage < 1 || currentPage > totalPages) ? 1 : currentPage;
  const top = totalPages;
  const parts = [];

  for (let pageNumber = 1; pageNumber <= top; pageNumber++) {
    if (top > 9 && ((pageNumber === 2 && cur > 5) || (pageNumber === top - 1 && cur < top - 4))) {
      parts.push({ page: null, label: '...' });
    } else if (
      pageNumber === 1 ||
      pageNumber === top ||
      (pageNumber > cur - 3 && pageNumber < cur + 3) ||
      (cur < 6 && pageNumber < 8) ||
      (cur > top - 5 && pageNumber > top - 7)
    ) {
      parts.push({ page: pageNumber, label: String(pageNumber), current: pageNumber === cur, url: buildUrl(pageNumber) });
    }
  }
  return parts;
}

module.exports = { h2, sanitizeHtml, xssize, prepareComment, hiliteTwixtMoves, paginationLinks };

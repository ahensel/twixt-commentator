
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

function prepareComment(html, swapStyle, namedSequences) {
  let out = sanitizeHtml(html);
  out = hiliteTwixtMoves(out, swapStyle, namedSequences);
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
// `namedSequences` (optional) — shared object that persists named sequence
// definitions across multiple calls (e.g. across comments within one game).
function hiliteTwixtMoves(html, swapStyle, namedSequences) {
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
  // Name pattern: case-sensitive, starts with letter, allows letters/numbers/dashes
  const namePattern = '[a-zA-Z][a-zA-Z0-9-]*';
  const pre = `(?:\\|(${namePattern})\\|\\s*|\\|\\s*)?`;  // optional |name| or | prefix, capturing the name
  const nameDefPattern = `(?:\\s*\\[(${namePattern})\\])?`;  // optional [name] suffix, capturing the name

  const fullPattern = new RegExp(`${pre}${seq}${nameDefPattern}`, 'g');
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

  // If no shared namedSequences object was passed, create a local one.
  // (When called from the EJS template, the same object is shared across
  //  all comments in a game so that names carry over.)
  if (namedSequences === undefined) namedSequences = {};

  return html.replace(fullPattern, (moves, nameUsage, nameDef) => {
    // isMain = bare | prefix (not a |name| usage).
    const isMain = moves.startsWith('|') && !nameUsage;

    if (nameUsage && namedSequences[nameUsage]) {
      // Seed from the named sequence's board state
      const saved = namedSequences[nameUsage];
      moveArray = saved.arr.slice();
      firstMoveNum = saved.firstMoveNum;
      lastMoveNum = saved.lastMoveNum;
      hasSwapped = saved.hasSwapped;
    } else if (isMain) {
      moveArray = [];
      firstMoveNum = null;
      lastMoveNum = 0;
      hasSwapped = false;
    }

    let replaced = moves.replace(nmPattern, (move) => {
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

      return `<a href='' class='${color}' onclick='jumpFromComment(${firstMoveNum}, ${JSON.stringify(moveArray).replace(/'/g, "&#39;")}); return false;'>${move}</a>`;
    });

    // Save the final board state if this sequence was named
    if (nameDef) {
      namedSequences[nameDef] = {
        arr: moveArray.slice(),
        firstMoveNum,
        lastMoveNum,
        hasSwapped,
      };
      // Highlight the [name] definition in the output
      replaced = replaced.replace(`[${nameDef}]`, `<span class='seq-name'>[${nameDef}]</span>`);
    }

    // Highlight the |name| usage in the output
    if (nameUsage) {
      replaced = replaced.replace(`|${nameUsage}|`, `<span class='seq-name'>|${nameUsage}|</span>`);
    }

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

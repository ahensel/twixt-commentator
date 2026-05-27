
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

function prepareComment(html) {
  let out = sanitizeHtml(html);
  out = hiliteTwixtMoves(out);
  return out.replace(/\n/g, '<br/>');
}

// Detects move sequences in comment text and wraps them in clickable <a> links.
function hiliteTwixtMoves(html) {
  // Regex parts
  const moveDigits = '(?:5[0-2]|[1-4]\\d|[1-9])' // 1 to 52, inclusive
  const linkAction = `(?:[-/\\\\](?:[a-zA-Z]\'${moveDigits}|[a-zA-Z]${moveDigits}\'))`; // link removal notation
  const pegAction = `[a-zA-Z]${moveDigits}\\**`; // optional asterisks to illustrate number of auto-links
  const actionMove = `(?:${linkAction})*${pegAction}|swap`;
  const endMove = 'resign|draw|forfeit|lost';
  const m = `(?:${actionMove}|${endMove}|\\?+)`;
  const dot = '\\.\\s?';
  const nm = `[1-9]\\d*${dot}${m}`;          // numbered move like 12.m7
  const oddm = `\\d*[13579]${dot}${m}`;      // odd-numbered move
  const seq = `${nm}(?:\\s+${nm})*`;         // sequence of numbered moves
  const pre = `(?:\\|\\s*)?`;                // optional | prefix

  const fullPattern = new RegExp(`${pre}${seq}`, 'g');
  const nmPattern = new RegExp(nm, 'g');
  const oddmPattern = new RegExp(oddm);
  const nmSplit = new RegExp(dot);

  let moveArray = [];
  let firstMoveNum = null;
  let lastMoveNum = 0;

  return html.replace(fullPattern, (moves) => {
    if (moves.startsWith('|')) {
      moveArray = [];
      firstMoveNum = null;
      lastMoveNum = 0;
    }
    const jumpMethod = moves.startsWith('|') ? 'cJumpMain' : 'cJump';

    const replaced = moves.replace(nmPattern, (move) => {
      const color = oddmPattern.test(move) ? 'white' : 'black';
      const parts = move.split(nmSplit);
      const moveNumStr = parts[0];
      const moveText = parts.slice(1).join('.');
      const moveNum = parseInt(moveNumStr, 10);

      if (new RegExp(actionMove).test(moveText)) {
        const moveOffset = lastMoveNum + 1 - moveNum;
        if (moveOffset < 0 || moveOffset > moveArray.length) {
          moveArray = [];
          firstMoveNum = moveNum;
        } else if (moveOffset > 0) {
          moveArray.splice(moveArray.length - moveOffset, moveOffset);
        }
        moveArray.push(moveText.split('*')[0]);
        lastMoveNum = moveNum;
      }
      if (firstMoveNum === null) firstMoveNum = moveNum;

      return `<a href='' class='${color}' onclick='${jumpMethod}(${firstMoveNum}, ${JSON.stringify(moveArray).replace(/'/g, "&#39;")}); return false;'>${move}</a>`;
    });

    if (moves.startsWith('|')) {
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

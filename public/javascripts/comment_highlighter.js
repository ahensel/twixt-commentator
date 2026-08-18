// Sanitizer: keep only known safe opening/closing tags, strip everything else.
// Attributes are not allowed on any tag (prevents XSS via inline event handlers etc.).
function sanitizeHtml(html) {
  if (html == null) return '';
  
  // Split the string by the allowed tags.
  const allowedRegex = /(<\/?(?:b|i|u|em|strong|s|strike|sup|sub|blockquote|code|pre)>|<br\s*\/?>)/i;
  let parts = String(html).split(allowedRegex);
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // This is a text node (not an allowed tag), so escape < and >
      parts[i] = parts[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
  
  return parts.join('');
}

function xssize(html) {
  return sanitizeHtml(html).replace(/\n/g, '<br/>');
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

function renderAllComments() {
  const swapStyleElement = document.getElementById('swapStyle');
  const swapStyle = swapStyleElement ? swapStyleElement.value : null;
  const namedSequences = {};

  document.querySelectorAll('[data-raw-comment]').forEach(container => {
    // Check if we are in edit mode (contains a textarea)
    if (container.querySelector('textarea.comment-textarea')) {
      // Rebuild state but don't inject HTML over the textarea
      let rawText = container.getAttribute('data-raw-comment') || '';
      let safeText = sanitizeHtml(rawText);
      hiliteTwixtMoves(safeText, swapStyle, namedSequences);
      return;
    }
    
    let rawText = container.getAttribute('data-raw-comment') || '';
    let safeText = sanitizeHtml(rawText);
    let highlightedHtml = hiliteTwixtMoves(safeText, swapStyle, namedSequences);
    
    container.innerHTML = highlightedHtml.replace(/\n/g, '<br/>') + '<br/><br/>';
  });
}

// Run initially
document.addEventListener('DOMContentLoaded', () => {
  renderAllComments();
});

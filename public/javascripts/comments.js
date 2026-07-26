let saveTimer = null;

// ── Scroll position preservation across reloads ─────────────────────────────

function saveScrollPosition() {
  const commentsDiv = document.getElementById('comments');
  if (commentsDiv) {
    sessionStorage.setItem('comments_scroll_top', commentsDiv.scrollTop);
  }
}

function restoreScrollPosition() {
  const scrollTop = sessionStorage.getItem('comments_scroll_top');
  if (scrollTop) {
    const commentsDiv = document.getElementById('comments');
    if (commentsDiv) {
      commentsDiv.scrollTop = parseInt(scrollTop, 10);
    }
    sessionStorage.removeItem('comments_scroll_top');
  }
}

document.addEventListener('DOMContentLoaded', restoreScrollPosition);

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const text = document.getElementById('new_comment').value;
    if (text.trim()) {
      sessionStorage.setItem('discard_' + location.pathname, text);
    }
  }, 2000);
}

function scrollToBottom() {
  const comments = document.getElementById('comments');
  comments.scrollTop = 0; // ensure scroll resets before jumping to bottom
  comments.scrollTop = comments.scrollHeight;
}

function showAddCommentBox() {
  document.getElementById('new_comment').value = '';
  checkStateChange();
  document.getElementById('addCommentLink').classList.add('hidden');
  document.getElementById('addComment').classList.remove('hidden');
  document.getElementById('new_comment').focus();
  scrollToBottom();
  return false;
}

function undoDiscard() {
  const key = 'discard_' + location.pathname;
  const text = sessionStorage.getItem(key);
  if (text != null) {
    sessionStorage.removeItem(key);
    showAddCommentBox();
    document.getElementById('new_comment').value = text;
    checkStateChange();
  }
  return false;
}

function updateUndoLink() {
  const key = 'discard_' + location.pathname;
  const link = document.getElementById('undoDiscardLink');
  if (link) {
    if (sessionStorage.getItem(key)) {
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
  }
}

function hideAddCommentBox() {
  removePreview();
  const hasComments = commentBoxHasComments();
  if (hasComments) {
    sessionStorage.setItem('discard_' + location.pathname, document.getElementById('new_comment').value);
  }
  document.getElementById('addComment').classList.add('hidden');
  document.getElementById('addCommentLink').classList.remove('hidden');
  updateUndoLink();
  return hasComments;
}

function commentBoxHasComments() {
  return document.getElementById('new_comment').value.replace(/\s*/, '').length > 0;
}

// Multiple submit buttons share a form: track which was clicked via a hidden field.
function setButtonPressed(button, name) {
  button.form.elements['button_pressed'].value = name;
}

function removePreview() {
  const preview = document.getElementById('preview');
  if (preview != null) preview.parentNode.removeChild(preview);
}

function checkStateChange() {
  const hasComments = commentBoxHasComments();
  document.getElementById('comment_button').disabled = !hasComments;
  document.getElementById('preview_button').disabled = !hasComments;
}

function commentsInFocus(state) {
  document.getElementById('addComment').focused = state;
}

// If the user types Backspace, focus must return to the comment box immediately,
// otherwise the browser interprets it as the Back button — potentially losing their work.
function keyIntercept(evt) {
  const addCommentElement = document.getElementById('addComment');
  if (addCommentElement != null &&
      addCommentElement.style.display === 'inline' &&
      !addCommentElement.focused) {
    if (evt.key === 'Backspace' || (!evt.altKey && !evt.ctrlKey && !evt.metaKey)) {
      document.getElementById('new_comment').focus();
      if (evt.key === 'Backspace') {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    }
  }
  return true;
}

// ── Inline editing ──────────────────────────────────────────────────────────

/**
 * Replace the comment body with a textarea for inline editing.
 * Fetches the raw comment text from the server, then stores the original HTML
 * so we can cancel back to it.
 */
async function editComment(commentId) {
  const body = document.getElementById('comment-body-' + commentId);
  if (!body) return false;

  // Hide the "Add a comment" box if it's open to prevent two textareas
  hideAddCommentBox();

  // Store original rendered HTML so cancel can restore it
  body.dataset.originalHtml = body.innerHTML;

  // Fetch the raw comment text from the server
  try {
    const resp = await fetch('/comment/' + commentId);
    if (!resp.ok) {
      alert('Could not load comment for editing. Please try again.');
      delete body.dataset.originalHtml;
      return false;
    }
    const data = await resp.json();
    const rawText = data.comment || '';

    body.innerHTML =
      '<textarea class="comment-textarea" rows="6">' +
        escapeHtml(rawText) +
      '</textarea>' +
      '<div class="comment-buttons">' +
        '<input type="button" value="Save" onclick="saveComment(' + commentId + '); return false;">' +
        '<input type="button" class="discard" value="Cancel" onclick="cancelEdit(' + commentId + '); return false;">' +
      '</div>';

    // Focus the textarea
    const textarea = body.querySelector('textarea');
    if (textarea) textarea.focus();

    // Hide the "Add a comment" link while editing
    const addLink = document.getElementById('addCommentLink');
    if (addLink) addLink.classList.add('hidden');

    // Hide ALL action links while editing
    document.querySelectorAll('.comment-edit-delete-links a').forEach(link => {
      link.classList.add('hidden');
    });
  } catch (err) {
    alert('Error loading comment for editing: ' + err.message);
    delete body.dataset.originalHtml;
  }

  return false;
}

/**
 * Send the edited comment text to the server and replace the comment
 * with the re-rendered HTML.
 */
async function saveComment(commentId) {
  const body = document.getElementById('comment-body-' + commentId);
  if (!body) return false;

  const textarea = body.querySelector('textarea');
  if (!textarea) return false;

  const newText = textarea.value;

  try {
    const resp = await fetch('/comment/' + commentId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_comment: newText }),
    });

    if (!resp.ok) {
      alert('Could not save comment. Please try again.');
      return false;
    }

    // Server confirmed the save; reload to reflect the new state
    saveScrollPosition();
    window.location.reload();
  } catch (err) {
    alert('Error saving comment: ' + err.message);
  }

  return false;
}

/**
 * Cancel inline editing and restore the original rendered comment.
 */
function cancelEdit(commentId) {
  const body = document.getElementById('comment-body-' + commentId);
  if (!body) return false;

  // Restore original rendered HTML
  if (body.dataset.originalHtml) {
    body.innerHTML = body.dataset.originalHtml;
    delete body.dataset.originalHtml;
  }

  // Re-show the "Add a comment" link
  const addLink = document.getElementById('addCommentLink');
  if (addLink) addLink.classList.remove('hidden');

  // Re-show ALL action links
  document.querySelectorAll('.comment-edit-delete-links a').forEach(link => {
    link.classList.remove('hidden');
  });

  return false;
}

/**
 * Minimal HTML escaper for putting raw text into a textarea safely.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Delete / Undelete ────────────────────────────────────────────────────────

async function deleteComment(commentId) {
  const resp = await fetch('/comment/' + commentId, { method: 'DELETE' });
  if (!resp.ok) { alert('Could not delete comment. Please try again.'); return false; }

  saveScrollPosition();
  window.location.reload();
  return false;
}

async function undeleteComment(commentId) {
  const resp = await fetch('/comment/' + commentId + '/undelete', { method: 'POST' });
  if (!resp.ok) { alert('Could not restore comment. Please try again.'); return false; }

  saveScrollPosition();
  window.location.reload();
  return false;
}

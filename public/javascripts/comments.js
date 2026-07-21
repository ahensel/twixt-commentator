let saveTimer = null;

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

async function deleteComment(commentId) {
  const resp = await fetch('/comment/' + commentId, { method: 'DELETE' });
  if (!resp.ok) { alert('Could not delete comment. Please try again.'); return false; }
  const header = document.getElementById('comment-header-' + commentId);
  if (header) {
    header.classList.add('comment-header-deleted');
    const deleteLink = header.querySelector('.comment-delete-link');
    if (deleteLink) deleteLink.innerHTML = '<a href="" onclick="return undeleteComment(' + commentId + ');">Undelete</a>';
    const body = document.getElementById('comment-body-' + commentId);
    if (body) body.style.display = 'none';
  }
  return false;
}

async function undeleteComment(commentId) {
  const resp = await fetch('/comment/' + commentId + '/undelete', { method: 'POST' });
  if (!resp.ok) { alert('Could not restore comment. Please try again.'); return false; }
  const header = document.getElementById('comment-header-' + commentId);
  if (header) {
    header.classList.remove('comment-header-deleted');
    const deleteLink = header.querySelector('.comment-delete-link');
    if (deleteLink) deleteLink.innerHTML = '<a href="" onclick="return deleteComment(' + commentId + ');">Delete</a>';
    const body = document.getElementById('comment-body-' + commentId);
    if (body) body.style.display = '';
  }
  return false;
}

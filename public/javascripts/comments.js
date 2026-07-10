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

function hideAddCommentBox() {
  document.getElementById('addComment').classList.add('hidden');
  document.getElementById('addCommentLink').classList.remove('hidden');
  return commentBoxHasComments();
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


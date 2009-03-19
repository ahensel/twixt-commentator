function scrollToBottom() {
  $('comments').scrollTop = 0 // IE needs this
  $('comments').scrollTop = $('comments').scrollHeight
}
function showAddCommentBox() {
  $('new_comment').value=''
  checkStateChange()
  $('addCommentLink').style.display = 'none'
  $('addComment').style.display = 'inline'
  $('new_comment').focus()
  scrollToBottom()
  return false
}
function hideAddCommentBox() {
  $('addComment').style.display = 'none'
  $('addCommentLink').style.display = 'inline'
  return commentBoxHasComments()
}
function commentBoxHasComments() {
  return ($('new_comment').value.replace(/\s*/, '').length > 0)
}
// workaround for Rail's non-support of multiple buttons on a form: set hidden field
function setButtonPressed(button, name) {
  Form.getInputs(button.form, null, 'button_pressed')[0].value = name
}
function removePreview() {
  if ($('preview') != null) {
    $('preview').parentNode.removeChild($('preview'))
  }
}
function checkStateChange() {
  if (commentBoxHasComments()) {
    $('comment_button').value = 'Comment'
    $('preview_button').disabled = false
  }
  else {
    $('comment_button').value = 'No Comment'
    $('preview_button').disabled = true
  }
}
function commentsInFocus(state) {
  $('addComment').focused = state
}

// If user types Backspace key, focus must go back to "Add Comments" box immediately, or the browser
// will interpret this like the "Back" button -- which may potentially lose the user's work!
function keyIntercept(evt) {
  var addCommentElement = $('addComment')
  if (addCommentElement != null && addCommentElement.style.display == 'inline' && !addCommentElement.focused) {
    if (evt == null) {
      evt = event
    }
    if (evt.keyCode == 8 || (!evt.altKey && !evt.ctrlKey && !evt.metaKey)) {
      $('new_comment').focus()      

      if (evt.keyCode == 8) {
        evt.returnValue = false
        Event.stop(evt)
        return false
      }
    }
  }
  /*
  else {
    if (evt == null) {
      evt = event
    }
    if (evt.keyCode == 78) {
      next()
    }
    else if (evt.keyCode == 66) {
      back()
    }
  }
  */
  
  return true
}

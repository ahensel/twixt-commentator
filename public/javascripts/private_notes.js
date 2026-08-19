// private_notes.js — Client-side private notes stored in localStorage.
// Notes are keyed by the game's params.gid value (LG game number or blank/id).
// Each note is stored as JSON at localStorage key: private_note_<gid>_<index>
// The total count is stored at: private_note_<gid>_count

(function () {
  'use strict';

  // ── Initialise from the DOM ───────────────────────────────────────────────

  const gameIdEl = document.getElementById('privateNoteGameId');
  if (!gameIdEl) return;

  const GAME_ID = gameIdEl.value;           // e.g. "1234567" or "blank/42"
  const STORAGE_PREFIX = 'twixt_private_note_';
  const LS_PREFIX = STORAGE_PREFIX + GAME_ID + '_';
  const LS_COUNT_KEY = LS_PREFIX + 'count';
  const SS_DISCARD_KEY = STORAGE_PREFIX + 'discard_' + GAME_ID;

  // Move number captured when the "Add a private note" form is opened.
  let noteStartMoveNum = 0;

  // ── localStorage helpers ─────────────────────────────────────────────────

  function getNote(index) {
    const raw = localStorage.getItem(LS_PREFIX + index);
    if (raw) {
      try {
        return JSON.parse(raw);
      }
      catch(e) {
        console.error(e);
      }
    }
    return null;
  }

  function setNote(index, note) {
    localStorage.setItem(LS_PREFIX + index, JSON.stringify(note));
  }

  function removeNote(index) {
    localStorage.removeItem(LS_PREFIX + index);
  }

  function getNoteCount() {
    return parseInt(localStorage.getItem(LS_COUNT_KEY) || '0', 10);
  }

  // Return all non-deleted notes sorted by startMoveNum, then creation order.
  function getNotesSorted() {
    const count = getNoteCount();
    const notes = [];
    for (let i = 0; i < count; i++) {
      const note = getNote(i);
      if (note) notes.push({ index: i, note });
    }
    notes.sort((a, b) => {
      if (a.note.startMoveNum !== b.note.startMoveNum) {
        return a.note.startMoveNum - b.note.startMoveNum;
      }
      return a.index - b.index;
    });
    return notes;
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  function renderAllNotes() {
    const container = document.getElementById('private-notes-container');
    if (!container) return;
    container.innerHTML = '';

    const notes = getNotesSorted();
    notes.forEach(({ index, note }) => {
      // Header
      const headerEl = document.createElement('div');
      headerEl.id = 'note-header-' + index;
      headerEl.className = 'note-header';

      const headerText = document.createElement('span');
      headerText.className = 'note-header-text';
      headerText.textContent = 'Private note created at move ' + note.startMoveNum;

      const editDeleteSpan = document.createElement('span');
      editDeleteSpan.className = 'note-edit-delete-links';

      const editLink = document.createElement('a');
      editLink.href = '';
      editLink.textContent = 'Edit';
      editLink.addEventListener('click', (e) => {
        e.preventDefault();
        editNote(index);
      });

      const deleteLink = document.createElement('a');
      deleteLink.href = '';
      deleteLink.textContent = 'Delete';
      deleteLink.addEventListener('click', (e) => {
        e.preventDefault();
        confirmDeleteNote(index);
      });

      editDeleteSpan.appendChild(editLink);
      editDeleteSpan.appendChild(deleteLink);
      headerEl.appendChild(headerText);
      headerEl.appendChild(editDeleteSpan);

      // Body
      const bodyEl = document.createElement('div');
      bodyEl.id = 'note-body-' + index;
      bodyEl.setAttribute('data-raw-comment', note.text);
      bodyEl.classList.add('note');

      container.appendChild(headerEl);
      container.appendChild(bodyEl);
    });

    if (typeof renderAllComments === 'function') renderAllComments();
  }

  // ── "Add a private note" form ────────────────────────────────────────────

  function showAddNoteBox() {
    // Capture the current highest move number in the game.
    noteStartMoveNum =
      (typeof BoardState !== 'undefined' && BoardState.currentMoves)
        ? BoardState.currentMoves.moves.length
        : 0;

    document.getElementById('new_note').value = '';
    setNotePreviewButtonLabel(false);
    checkNoteStateChange();
    document.getElementById('addNoteLink').classList.add('hidden');
    document.getElementById('addNote').classList.remove('hidden');
    document.getElementById('new_note').focus();
    return false;
  }

  function closeAddNoteBox() {
    document.getElementById('addNote').classList.add('hidden');
    document.getElementById('addNoteLink').classList.remove('hidden');
    updateNoteUndoLink();
  }

  function hideAddNoteBox() {
    removeNotePreview();
    const hasText = noteBoxHasText();
    if (hasText) {
      sessionStorage.setItem(SS_DISCARD_KEY, document.getElementById('new_note').value);
    }
    closeAddNoteBox();
    return hasText;
  }

  function noteBoxHasText() {
    const el = document.getElementById('new_note');
    return !!(el && el.value.trim().length > 0);
  }

  function checkNoteStateChange() {
    const saveBtn = document.getElementById('note_save_button');
    const hasText = noteBoxHasText();
    if (saveBtn) saveBtn.disabled = !hasText;
  }

  function updateNoteUndoLink() {
    const link = document.getElementById('undoNoteDiscardLink');
    if (!link) return;
    if (sessionStorage.getItem(SS_DISCARD_KEY)) {
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
  }

  function undoNoteDiscard() {
    const text = sessionStorage.getItem(SS_DISCARD_KEY);
    if (text != null) {
      sessionStorage.removeItem(SS_DISCARD_KEY);
      showAddNoteBox();
      document.getElementById('new_note').value = text;
      checkNoteStateChange();
    }
    return false;
  }

  function saveNewNote() {
    const text = document.getElementById('new_note').value.trim();
    if (!text) return false;

    const count = getNoteCount();
    setNote(count, {
      text,
      startMoveNum: noteStartMoveNum,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(LS_COUNT_KEY, String(count + 1));

    sessionStorage.removeItem(SS_DISCARD_KEY);

    document.getElementById('new_note').value = '';
    removeNotePreview();
    closeAddNoteBox();

    renderAllNotes();
    return false;
  }

  // ── Preview (new note) ───────────────────────────────────────────────────

  function previewNewNote() {
    let previewDiv = document.getElementById('note-new-preview');
    if (previewDiv) {
      previewDiv.remove();
      setNotePreviewButtonLabel(false);
      document.getElementById('new_note').focus();
      return false;
    }

    previewDiv = document.createElement('div');
    previewDiv.id = 'note-new-preview';

    const header = document.createElement('div');
    header.classList.add('preview-header', 'preview-header-note');
    header.textContent = 'Preview:';

    const body = document.createElement('div');
    body.id = 'note-new-preview-body';
    body.setAttribute('data-raw-comment', document.getElementById('new_note').value);
    body.classList.add('note');

    previewDiv.appendChild(header);
    previewDiv.appendChild(body);

    // Insert the preview just before the note form
    const addNote = document.getElementById('addNote');
    addNote.parentNode.insertBefore(previewDiv, addNote);

    setNotePreviewButtonLabel(true);
    if (typeof renderAllComments === 'function') renderAllComments();
    document.getElementById('new_note').focus();
    return false;
  }

  function removeNotePreview() {
    const preview = document.getElementById('note-new-preview');
    if (preview) preview.remove();
  }

  function setNotePreviewButtonLabel(showing) {
    const btn = document.getElementById('note_preview_button');
    if (btn) btn.value = showing ? 'Hide Preview' : 'Show Preview';
  }

  // ── Inline editing ───────────────────────────────────────────────────────

  function editNote(noteIndex) {
    const body = document.getElementById('note-body-' + noteIndex);
    if (!body) return false;

    const note = getNote(noteIndex);
    if (!note) return false;

    // If the "Add a private note" box is open, close it and discard its
    // draft — only one edit box should be visible at a time.
    hideAddNoteBox();

    // Store originals so Cancel can restore
    body.dataset.originalHtml = body.innerHTML;
    body.dataset.originalRaw = body.getAttribute('data-raw-comment');

    body.innerHTML =
      '<textarea id="edit-box-' + noteIndex + '" class="comment-textarea" rows="8" onkeyup="checkEditBoxStateChange(' + noteIndex + ');">' +
        escapeHtml(note.text) +
      '</textarea>' +
      '<div class="comment-buttons">' +
        '<input type="button" id="save-btn-' + noteIndex + '" value="Save"' +
          ' onclick="privateNotes.saveNoteEdit(' + noteIndex + '); return false;"' +
          ' title="Save to browser local storage">' +
        '<input type="button" id="note-edit-preview-btn-' + noteIndex + '" value="Show Preview"' +
          ' onclick="privateNotes.previewNoteEdit(' + noteIndex + '); return false;">' +
        '<button type="button" class="help-btn" onclick="openHelpModal(); return false;" title="Help">?</button>' +
        '<input type="button" class="discard" value="Cancel"' +
          ' onclick="privateNotes.cancelNoteEdit(' + noteIndex + '); return false;">' +
      '</div>';

    const textarea = body.querySelector('textarea');
    if (textarea) {
      textarea.focus();
      textarea.addEventListener('input', (e) => {
        body.setAttribute('data-raw-comment', e.target.value);
        const previewBody = document.getElementById('note-edit-preview-body-' + noteIndex);
        if (previewBody) previewBody.setAttribute('data-raw-comment', e.target.value);
        if (typeof renderAllComments === 'function') renderAllComments();
      });
    }

    if (typeof renderAllComments === 'function') renderAllComments();

    // Hide all note and comment action links while editing
    document.querySelectorAll('.note-edit-delete-links a, .comment-edit-delete-links a').forEach(link => {
      link.classList.add('hidden');
    });
    const addNoteLink = document.getElementById('addNoteLink');
    if (addNoteLink) addNoteLink.classList.add('hidden');
    const addCommentLink = document.getElementById('addCommentLink');
    if (addCommentLink) addCommentLink.classList.add('hidden');

    return false;
  }

  function checkEditBoxStateChange(noteIndex) {
    const hasComments = document.getElementById('edit-box-' + noteIndex).value.trim().length > 0;
    document.getElementById('save-btn-' + noteIndex).disabled = !hasComments;
  }

  function previewNoteEdit(noteIndex) {
    const body = document.getElementById('note-body-' + noteIndex);
    if (!body) return false;
    const textarea = body.querySelector('textarea');
    if (!textarea) return false;

    let previewBody = document.getElementById('note-edit-preview-body-' + noteIndex);
    const btn = document.getElementById('note-edit-preview-btn-' + noteIndex);

    if (previewBody) {
      previewBody.remove();
      if (btn) btn.value = 'Show Preview';
      if (typeof renderAllComments === 'function') renderAllComments();
      textarea.focus();
      return false;
    }

    previewBody = document.createElement('div');
    previewBody.id = 'note-edit-preview-body-' + noteIndex;
    previewBody.classList.add('edit-preview');
    previewBody.classList.add('note');
    body.insertBefore(previewBody, body.firstChild);

    previewBody.setAttribute('data-raw-comment', textarea.value);
    if (btn) btn.value = 'Hide Preview';
    if (typeof renderAllComments === 'function') renderAllComments();
    textarea.focus();
    return false;
  }

  function saveNoteEdit(noteIndex) {
    const body = document.getElementById('note-body-' + noteIndex);
    if (!body) return false;
    const textarea = body.querySelector('textarea');
    if (!textarea) return false;

    const newText = textarea.value.trim();
    if (!newText) return false;

    const note = getNote(noteIndex);
    if (!note) return false;
    note.text = newText;
    setNote(noteIndex, note);

    delete body.dataset.originalHtml;
    delete body.dataset.originalRaw;
    body.setAttribute('data-raw-comment', newText);
    body.innerHTML = '';

    _restoreLinksAfterEdit();
    if (typeof renderAllComments === 'function') renderAllComments();
    return false;
  }

  function cancelNoteEdit(noteIndex) {
    const body = document.getElementById('note-body-' + noteIndex);
    if (!body) return false;

    if (body.dataset.originalHtml !== undefined) {
      body.innerHTML = body.dataset.originalHtml;
      delete body.dataset.originalHtml;
    }
    if (body.dataset.originalRaw != null) {
      body.setAttribute('data-raw-comment', body.dataset.originalRaw);
      delete body.dataset.originalRaw;
    }

    _restoreLinksAfterEdit();
    return false;
  }

  function _restoreLinksAfterEdit() {
    document.querySelectorAll('.note-edit-delete-links a, .comment-edit-delete-links a').forEach(link => {
      link.classList.remove('hidden');
    });
    const addNoteLink = document.getElementById('addNoteLink');
    if (addNoteLink) addNoteLink.classList.remove('hidden');
    const addCommentLink = document.getElementById('addCommentLink');
    if (addCommentLink) addCommentLink.classList.remove('hidden');
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  function confirmDeleteNote(noteIndex) {
    if (!confirm('Permanently delete this private note? This cannot be undone.')) return false;
    removeNote(noteIndex);
    renderAllNotes();
    return false;
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Initialise on DOMContentLoaded ───────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    updateNoteUndoLink();
    renderAllNotes();

    // Wire up the new-note textarea for live preview updates and state checking
    const noteTextarea = document.getElementById('new_note');
    if (noteTextarea) {
      noteTextarea.addEventListener('input', (e) => {
        checkNoteStateChange();
        const previewBody = document.getElementById('note-new-preview-body');
        if (previewBody) {
          previewBody.setAttribute('data-raw-comment', e.target.value);
          if (typeof renderAllComments === 'function') renderAllComments();
        }
      });
    }

    // Save draft if the note box is open when the page is unloaded
    window.addEventListener('beforeunload', () => {
      const addNote = document.getElementById('addNote');
      if (addNote && !addNote.classList.contains('hidden')) {
        const text = document.getElementById('new_note').value;
        if (text.trim()) sessionStorage.setItem(SS_DISCARD_KEY, text);
      }
    });
  });

  // ── Expose to inline onclick handlers ────────────────────────────────────

  window.privateNotes = {
    showAddNoteBox,
    hideAddNoteBox,
    saveNewNote,
    previewNewNote,
    undoNoteDiscard,
    checkNoteStateChange,
    editNote,
    saveNoteEdit,
    cancelNoteEdit,
    previewNoteEdit,
    confirmDeleteNote,
  };

})();

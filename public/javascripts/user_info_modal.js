/* ── User Info Popup Modal ──────────────────────────────────────── */
(function () {
  'use strict';

  let overlay = null;
  let focusTrapDispose = null;

  function showModal(userId) {
    fetch('/user/info/' + userId + '.json')
      .then(function (resp) {
        if (!resp.ok) throw new Error('User not found');
        return resp.json();
      })
      .then(function (user) {
        const lgText = user.on_lg
          ? 'Plays on Little Golem&nbsp;' +
            (user.name_on_lg && user.name_on_lg !== user.name
              ? 'as&nbsp;<b>' + user.name_on_lg + '</b>'
              : '(under same name)')
          : 'Does not play on Little Golem';

        const infoText = user.info
          ? '<div class="info-scroll boxed">' + user.info + '</div>'
          : 'None';

        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML =
          '<div class="modal user-info-modal" tabindex="-1">' +
            '<a class="modal-close-btn" href="#" onclick="return closeUserInfoModal()">&times;</a>' +
            '<span>Name:&nbsp;<b>' + user.name + '</b></span><br/>' +
            '<span>' + lgText + '</span><br/>' +
            '<span>Account created on:&nbsp;' + user.created_on + '</span><br/>' +
            'Info: ' +
            infoText +
          '</div>';

        document.body.appendChild(overlay);

        // Focus the close button so the focus trap works
        overlay.querySelector('.modal-close-btn')?.focus();

        // Trap focus within the modal
        focusTrapDispose = modalFocusTrap(overlay);

        // Close when clicking the overlay background (not the modal itself)
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) closeUserInfoModal();
        });
      })
      .catch(function (err) {
        console.error('Failed to load user info:', err);
      });
  }

  function hideModal() {
    if (overlay) {
      if (focusTrapDispose) focusTrapDispose();
      focusTrapDispose = null;
      document.body.removeChild(overlay);
      overlay = null;
    }
  }

  // Expose globally so inline onclick handlers can call it
  window.closeUserInfoModal = function () {
    hideModal();
    return false;
  };

  // Intercept clicks on info icons
  document.addEventListener('click', function (e) {
    // Walk up the DOM tree to find the <a> linking to /user/info/
    let el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').indexOf('/user/info/') === 0) {
        e.preventDefault();
        const path = el.getAttribute('href').split('?')[0];
        const userId = path.split('/').pop();
        if (userId) showModal(userId);
        return;
      }
      el = el.parentElement;
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay) {
      closeUserInfoModal();
    }
  });
})();

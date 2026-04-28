/* ── User Info Popup Modal ──────────────────────────────────────── */
(function () {
  'use strict';

  let overlay = null;

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
          ? '<blockquote>' + user.info.replace(/\n/g, '<br/>') + '</blockquote>'
          : 'None';

        overlay = document.createElement('div');
        overlay.className = 'user-info-overlay';
        overlay.innerHTML =
          '<div class="user-info-modal">' +
            '<a class="close-btn" href="#" onclick="return closeUserInfoModal()">&times;</a>' +
            '<p>Name:&nbsp;<b>' + user.name + '</b></p>' +
            '<p>' + lgText + '</p>' +
            '<p>Account created on:&nbsp;' + user.created_on + '</p>' +
            '<div class="info-scroll">' +
              '<p>Info:&nbsp;' + infoText + '</p>' +
            '</div>' +
          '</div>';

        document.body.appendChild(overlay);

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
    const infoImg = e.target;
    // Walk up to find the <a> if the click landed on the <img>
    if (infoImg.tagName === 'IMG' && infoImg.classList.contains('info')) {
      const link = infoImg.parentElement;
      if (link && link.getAttribute('href') && link.getAttribute('href').indexOf('/user/info/') === 0) {
        e.preventDefault();
        // Extract user id from the URL path: /user/info/<id>?...
        const path = link.getAttribute('href').split('?')[0];
        const userId = path.split('/').pop();
        if (userId) showModal(userId);
      }
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay) {
      closeUserInfoModal();
    }
  });
})();

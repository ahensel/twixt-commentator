/* ── Modal Focus Trap ───────────────────────────────────────────── */
(function () {
  'use strict';

  var FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /**
   * Attach a focus-trap to the given overlay element.
   * Tab / Shift+Tab will cycle through focusable children only.
   * Returns a dispose function to remove the listener.
   */
  function trapFocus(overlay) {
    var handler = function (e) {
      if (e.key !== 'Tab') return;

      var focusable = overlay.querySelectorAll(FOCUSABLE_SELECTORS);
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first → last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last → first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    overlay.addEventListener('keydown', handler);

    return function dispose() {
      overlay.removeEventListener('keydown', handler);
    };
  }

  window.modalFocusTrap = trapFocus;
})();

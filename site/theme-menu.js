(function (root) {
  'use strict';

  function modeFrom() { return 'light'; }
  function resolve() { return 'light'; }
  function storageValue() { return null; }

  var api = {
    KEY: 'theme',
    MODES: ['light'],
    LABELS: { light: 'Light' },
    modeFrom: modeFrom,
    resolve: resolve,
    storageValue: storageValue
  };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.AIFSThemeMenu = api;
  if (!root.document) return;

  var doc = root.document;
  var html = doc.documentElement;

  function forceLight() {
    if (html.getAttribute('data-theme') !== 'light') html.setAttribute('data-theme', 'light');
    try { root.localStorage.removeItem('theme'); } catch (_) {}
    var button = doc.getElementById('themeToggle');
    if (button) {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.setAttribute('tabindex', '-1');
    }
  }

  forceLight();
  if (typeof root.MutationObserver === 'function') {
    new root.MutationObserver(forceLight).observe(html, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  doc.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('#themeToggle') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forceLight();
  }, true);
})(typeof window !== 'undefined' ? window : this);

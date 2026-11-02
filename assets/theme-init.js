/* Blocking local head script: execute before the body to avoid an incorrect first palette. */
(function () {
  var preference = 'system';
  try {
    var stored = localStorage.getItem('torobticket.appearance');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch (_) {
    /* Storage may be unavailable; system preference still works. */
  }
  var dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  var appearance = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.preference = preference;
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.dataset.mode = 'flight';
  document.documentElement.style.colorScheme = appearance;
  function syncBrandMetadata() {
    var resolved = document.documentElement.dataset.appearance === 'dark' ? 'dark' : 'light';
    var icon = document.querySelector('[data-brand-favicon]');
    if (icon) icon.setAttribute('href', icon.getAttribute('data-' + resolved + '-src'));
    var color = document.querySelector('[data-brand-theme-color]');
    if (color && color.getAttribute('data-' + resolved + '-color')) color.setAttribute('content', color.getAttribute('data-' + resolved + '-color'));
  }
  syncBrandMetadata();
  // Follows the resolved app preference without timers or an animation loop.
  new MutationObserver(syncBrandMetadata).observe(document.documentElement, { attributes: true, attributeFilter: ['data-appearance'] });
})();

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
})();

/* Dingsi Lab Homescreen V32: local preview themes, never affects the production app. */
(() => {
  'use strict';
  const storageKey = 'mod-dingsi-lab-homescreen-theme';
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-home-theme]')];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  function apply(theme, persist) {
    const next = theme === 'pastel' ? 'pastel' : 'dark';
    root.dataset.labTheme = next;
    root.style.colorScheme = next === 'pastel' ? 'light' : 'dark';
    if (themeMeta) themeMeta.setAttribute('content', next === 'pastel' ? '#fcf9fd' : '#000000');
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.homeTheme === next));
    }
    if (persist) {
      try { localStorage.setItem(storageKey, next); } catch (_) { /* private mode */ }
    }
  }
  apply(root.dataset.labTheme, false);
  for (const button of buttons) {
    button.addEventListener('click', () => apply(button.dataset.homeTheme, true));
  }
})();

/* Canonical visible build metadata. No historical shim chaining. */
(function () {
  const BUILD_VERSION = "V401";
  const BUILD_DATE = "19.08.2026";
  const BUILD_TIME = "17:02";
  const BUILD_LABEL = BUILD_DATE + " · " + BUILD_TIME + " Uhr";

  window.__MOD_BUILD__ = Object.freeze({ version: BUILD_VERSION, date: BUILD_DATE, time: BUILD_TIME, label: BUILD_LABEL });

  function applyCanonicalBuildLabel() {
    document.querySelectorAll('.dev-build-item').forEach(item => {
      const label = item.querySelector('.dev-build-label');
      const value = item.querySelector('.dev-build-value');
      if (!label || !value) return;
      const key = (label.textContent || '').trim().toUpperCase();
      if (key === 'VERSION') value.textContent = BUILD_VERSION;
      if (key === 'BUILD') value.textContent = BUILD_LABEL;
    });
  }

  const observer = new MutationObserver(applyCanonicalBuildLabel);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  applyCanonicalBuildLabel();
  window.addEventListener('load', () => setTimeout(applyCanonicalBuildLabel, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(applyCanonicalBuildLabel, 0);
  });
})();

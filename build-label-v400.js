/* V400 · KANONISCHE BUILD-ANZEIGE
   Letzter Display-Layer. Korrigiert ausschließlich die sichtbare App-Buildzeile,
   falls ältere Display-Shims noch V395/08:23 anzeigen.
*/
(function () {
  const BUILD_VERSION = "V400";
  const BUILD_DATE = "19.08.2026";
  const BUILD_TIME = "16:58";

  function looksLikeBuildLeaf(el, text) {
    if (!el || el.children.length) return false;
    if (!/V39[5-9]|V400/.test(text)) return false;
    return text.includes("19.08.2026") || /08:23|09:12|16:23|16:32|16:58/.test(text);
  }

  function applyCanonicalBuildLabel() {
    document.querySelectorAll("*").forEach(el => {
      const text = el.textContent || "";
      if (!looksLikeBuildLeaf(el, text)) return;

      let next = text
        .replace(/V39[5-9]|V400/g, BUILD_VERSION)
        .replace(/19\.08\.2026/g, BUILD_DATE)
        .replace(/(?:08:23|09:12|16:23|16:32|16:58)/g, BUILD_TIME);

      if (next !== text) el.textContent = next;
    });
  }

  new MutationObserver(applyCanonicalBuildLabel).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  applyCanonicalBuildLabel();
  window.addEventListener("load", () => setTimeout(applyCanonicalBuildLabel, 50));
})();

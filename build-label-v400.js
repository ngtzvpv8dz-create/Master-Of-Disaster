/* V401 · SINGLE SOURCE OF TRUTH FOR VISIBLE BUILD METADATA */
(function () {
  const BUILD_VERSION = "V401";
  const BUILD_DATE = "19.08.2026";
  const BUILD_TIME = "17:02";

  function isBuildInfoLeaf(el, text) {
    if (!el || el.children.length) return false;
    const t = String(text || "");
    return /APP.?VERSION|BUILD.?VERSION|VERSION/i.test(t) && /V\d{3}/i.test(t);
  }

  function applyCanonicalBuildLabel() {
    document.querySelectorAll("*").forEach(el => {
      const text = el.textContent || "";
      if (!isBuildInfoLeaf(el, text)) return;
      let next = text.replace(/V\d{3}/gi, BUILD_VERSION);
      next = next.replace(/\b\d{2}\.\d{2}\.20\d{2}\b/g, BUILD_DATE);
      next = next.replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, BUILD_TIME);
      if (next !== text) el.textContent = next;
    });
  }

  window.__MOD_BUILD__ = Object.freeze({ version:BUILD_VERSION, date:BUILD_DATE, time:BUILD_TIME });
  new MutationObserver(applyCanonicalBuildLabel).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  applyCanonicalBuildLabel();
  window.addEventListener("load",()=>setTimeout(applyCanonicalBuildLabel,0));
})();

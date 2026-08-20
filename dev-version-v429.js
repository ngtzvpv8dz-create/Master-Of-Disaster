/* V429 · 20.08.2026 · 23:08 · REMOVE REDUNDANT REPEAT ACTION */
(function(){
  const VERSION='V429';
  const BUILD='20.08.2026 · 23:08';
  function patch(){
    document.querySelectorAll('.dev-version-value,.build-version,.app-version').forEach(el=>{if(/V\d+/i.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/V\d+/i,VERSION);});
    document.querySelectorAll('.dev-build-value,.build-date,.build-time').forEach(el=>{if(/20\.08\.2026|\d{2}\.\d{2}\.\d{4}/.test(el.textContent||''))el.textContent=BUILD;});
  }
  const old=window.__modDevVersionV428;
  window.__modDevVersionV429={version:VERSION,build:BUILD,previous:old||null,patch};
  window.addEventListener('load',()=>setTimeout(patch,250));
  patch();
})();

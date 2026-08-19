/* V399 visible build metadata. */
(function(){
  const VERSION="V399";
  const DATE="19.08.2026";
  const TIME="22:49";
  const apply=()=>{
    document.querySelectorAll("*").forEach(el=>{
      if(el.children.length) return;
      let t=el.textContent||"";
      if(/V3(?:82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98)/.test(t)) t=t.replace(/V3(?:82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98)/g,VERSION);
      if(t.includes(DATE) && /\b\d{2}:\d{2}\b/.test(t) && /V399|BUILD|VERSION/i.test(t)) t=t.replace(/\b\d{2}:\d{2}\b/,TIME);
      if(t!==el.textContent) el.textContent=t;
    });
  };
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  apply();
})();

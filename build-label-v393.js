/* V393 display shim. Keeps the visible DEV build label aligned while app.js remains split from patch modules. */
(function(){
  const apply=()=>{
    document.querySelectorAll("*").forEach(el=>{
      if(el.children.length) return;
      const t=el.textContent||"";
      if(t.includes("V392")) el.textContent=t.replaceAll("V392","V393");
      if(t.includes("19.08.2026")&&t.includes("05:28")) el.textContent=el.textContent.replace("05:28","05:38");
    });
  };
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  apply();
})();

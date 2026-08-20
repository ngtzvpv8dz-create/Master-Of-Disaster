/* V419 · unified icon loader + DEV build label */
(function(){
 function ensureAssets(){if(!document.getElementById('unifiedIconsCssV419')){const l=document.createElement('link');l.id='unifiedIconsCssV419';l.rel='stylesheet';l.href='./unified-icons-v419.css?v=419-1752';document.head.appendChild(l);}if(!document.getElementById('unifiedIconsJsV419')){const s=document.createElement('script');s.id='unifiedIconsJsV419';s.src='./unified-icons-v419.js?v=419-1752';document.body.appendChild(s);}}
 function patch(){if(typeof currentTab!=='undefined'&&currentTab!=='dev')return;const vals=document.querySelectorAll('.dev-build-value');if(vals[0])vals[0].textContent='V419';if(vals[1])vals[1].textContent='20.08.2026 · 17:52 Uhr';}
 ensureAssets();const prev=typeof render==='function'?render:null;if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(patch,0);return r;};}window.addEventListener('load',()=>setTimeout(()=>{ensureAssets();patch();},400));
})();
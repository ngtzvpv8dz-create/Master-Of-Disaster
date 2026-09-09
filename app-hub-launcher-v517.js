/* V518 · HOMESCREEN LAUNCHER ASSET UPGRADE
   - Keeps the compact V517 2x2 launcher and navigation behavior.
   - Uses the final high-resolution GitHub-hosted launcher icons.
   - Releases the V518 first-paint gate only after the final launcher assets settle.
*/
(function(){
  'use strict';
  if(window.__modHubLauncherV517)return;

  const VERSION='V518';
  const ROOT_ID='modAppHubV515';
  const SOURCES={
    todo:'./assets/icons/todo-v518-1024.webp?v=518-1920',
    sport:'./assets/icons/sport-v518-1024.webp?v=518-1920',
    food:'./assets/icons/food-v518-1024.webp?v=518-1920',
    future:'./assets/icons/future-v518-1024.webp?v=518-1920'
  };
  const MODULES=[
    {id:'todo',label:'TO-DO',active:true},
    {id:'sport',label:'SPORT',active:true},
    {id:'food',label:'FOOD',active:false},
    {id:'future',label:'',active:false}
  ];

  let observer=null;
  let patching=false;
  let renderGeneration=0;

  function hubApi(){return window.__modAppHubV515||null;}

  function iconMarkup(item){
    const src=SOURCES[item.id];
    return `<img class="mod-hub-app-icon-v517" src="${src}" alt="" draggable="false" decoding="async">`;
  }

  function labelMarkup(item){
    if(item.label)return `<span class="mod-hub-app-label-v517">${item.label}</span>`;
    return '<span class="mod-hub-app-label-v517 mod-hub-app-label-empty-v517" aria-hidden="true">&nbsp;</span>';
  }

  function legacyOpenMarker(item){
    return item.id==='future'?'':` data-mod-hub-open="${item.id}"`;
  }

  function pulse(button){
    button.classList.remove('mod-hub-app-pulse-v517');
    void button.offsetWidth;
    button.classList.add('mod-hub-app-pulse-v517');
    setTimeout(()=>button.classList.remove('mod-hub-app-pulse-v517'),420);
  }

  function activate(item,button){
    if(item.id==='todo')return hubApi()?.open?.('todo',{source:'hub'});
    if(item.id==='sport')return hubApi()?.open?.('sport',{source:'hub'});
    pulse(button);
    return item.id;
  }

  function waitForImage(img){
    if(img.complete){
      if(img.naturalWidth>0&&typeof img.decode==='function')return img.decode().catch(()=>{});
      return Promise.resolve();
    }
    return new Promise(resolve=>{
      let done=false;
      const finish=()=>{
        if(done)return;
        done=true;
        img.removeEventListener('load',finish);
        img.removeEventListener('error',finish);
        if(img.naturalWidth>0&&typeof img.decode==='function')img.decode().catch(()=>{}).finally(resolve);
        else resolve();
      };
      img.addEventListener('load',finish,{once:true});
      img.addEventListener('error',finish,{once:true});
    });
  }

  function settleFinalAssets(root,shell,generation){
    const images=[...shell.querySelectorAll('.mod-hub-app-icon-v517')];
    let finished=false;
    const finish=(reason)=>{
      if(finished||generation!==renderGeneration||!root.isConnected||!shell.isConnected)return;
      finished=true;
      const loaded=images.filter(img=>img.complete&&img.naturalWidth>0).length;
      const allLoaded=images.length===MODULES.length&&loaded===images.length;
      root.dataset.modHubAssetsV518=allLoaded?'ready':'degraded';
      root.dataset.modHubAssetCountV518=String(loaded);
      root.dataset.modHubAssetReleaseV518=String(reason||'settled');
      if(allLoaded)document.documentElement.classList.add('mod-hub-assets-ready-v518');
      try{window.__modReleaseHubBootV518?.(allLoaded?'assets-ready':'assets-fallback');}catch(_){}
    };

    Promise.all(images.map(waitForImage)).then(()=>finish('settled'));
    setTimeout(()=>finish('timeout'),3000);
  }

  function renderLauncher(){
    if(patching)return false;
    const root=document.getElementById(ROOT_ID);
    const shell=root?.querySelector('.mod-hub-shell-v515');
    if(!root||!shell)return false;
    if(shell.dataset.modHubLauncherV517==='ready'&&shell.querySelector('.mod-hub-app-grid-v517'))return true;

    patching=true;
    try{
      const generation=++renderGeneration;
      shell.dataset.modHubLauncherV517='ready';
      shell.innerHTML=`
        <div class="mod-hub-intro-v517">
          <div class="mod-hub-kicker-v517">DEINE BEREICHE</div>
          <h2 class="mod-hub-title-v517">Was steht heute an?</h2>
        </div>
        <div class="mod-hub-app-grid-v517" role="group" aria-label="Bereiche auswählen">
          ${MODULES.map(item=>`
            <div class="mod-hub-app-slot-v517 mod-hub-app-slot-${item.id}-v517">
              <button type="button"
                class="mod-hub-app-button-v517 mod-hub-app-button-${item.id}-v517"
                data-mod-hub-launch-v517="${item.id}"${legacyOpenMarker(item)}
                aria-label="${item.id==='todo'?'To-do öffnen':item.id==='sport'?'Sport öffnen':item.id==='food'?'Food Bereich vorbereitet':'Weitere Kategorie vorbereitet'}"
                ${item.active?'':'aria-disabled="true"'}>
                <span class="mod-hub-app-face-v517">${iconMarkup(item)}</span>
              </button>
              ${labelMarkup(item)}
            </div>`).join('')}
        </div>`;

      shell.querySelectorAll('[data-mod-hub-launch-v517]').forEach(button=>{
        const item=MODULES.find(entry=>entry.id===button.dataset.modHubLaunchV517);
        button.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          if(item)activate(item,button);
        });
      });

      root.dataset.modHubLauncherV517='ready';
      root.dataset.modHubFinalV518='ready';
      settleFinalAssets(root,shell,generation);
      return true;
    }finally{patching=false;}
  }

  function startObserver(){
    const root=document.getElementById(ROOT_ID);
    if(!root||observer)return;
    observer=new MutationObserver(()=>queueMicrotask(renderLauncher));
    observer.observe(root,{childList:true});
  }

  function init(){
    if(!hubApi()||!document.getElementById(ROOT_ID))return false;
    renderLauncher();
    startObserver();
    return true;
  }

  const publicApi={
    version:VERSION,
    render:renderLauncher,
    sources:{...SOURCES},
    modules:MODULES.map(item=>({...item})),
    homescreenStyle:true,
    compactGrid:true,
    wideCardsRemoved:true,
    v515OpenMarkersPreserved:true,
    sportHealthHookPreserved:true,
    todoDataUntouched:true,
    sportDataUntouched:true,
    foodPrepared:true,
    futureCategoryPrepared:true,
    finalAssetsV518:true,
    githubHostedAssetsV518:true,
    cleanStartReleaseV518:true
  };
  window.__modHubLauncherV517=publicApi;
  window.__modHubLauncherV518=publicApi;

  let tries=0;
  const boot=setInterval(()=>{tries++;if(init()||tries>240)clearInterval(boot);},75);
  window.addEventListener('load',()=>setTimeout(init,320));
})();

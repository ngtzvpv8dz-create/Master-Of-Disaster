/* V520 · SIX-TILE LAUNCHER DESIGN
   - Expands the compact launcher from 2x2 to 2x3.
   - Adds KISTOLOGY and BACKSTAGE as prepared visual modules.
   - Keeps TO-DO and SPORT as the only active modules for now.
   - Preserves the V515 navigation hooks and V518 boot release compatibility.
*/
(function(){
  'use strict';
  if(window.__modHubLauncherV517)return;

  const VERSION='V520';
  const ROOT_ID='modAppHubV515';
  const SOURCES={
    todo:'./assets/icons/todo-v519-1024.png?v=520-2329',
    sport:'./assets/icons/sport-v519-1024.png?v=520-2329',
    kistology:'./assets/icons/kistology-v520-1024.PNG?v=520-2329',
    food:'./assets/icons/food-v519-1024.png?v=520-2329',
    future:'./assets/icons/future-v519-1024.png?v=520-2329',
    backstage:'./assets/icons/backstage-v520-1024.PNG?v=520-2329'
  };
  const MODULES=[
    {id:'todo',label:'TO-DO',active:true},
    {id:'sport',label:'SPORT',active:true},
    {id:'kistology',label:'KISTOLOGY',active:false},
    {id:'food',label:'FOOD',active:false},
    {id:'future',label:'FUTURE',active:false},
    {id:'backstage',label:'BACKSTAGE',active:false}
  ];

  let observer=null;
  let patching=false;
  let renderGeneration=0;

  function hubApi(){return window.__modAppHubV515||null;}

  function iconMarkup(item){
    return `<img class="mod-hub-app-icon-v517" src="${SOURCES[item.id]}" alt="" draggable="false" decoding="async">`;
  }

  function labelMarkup(item){
    return `<span class="mod-hub-app-label-v517">${item.label}</span>`;
  }

  function legacyOpenMarker(item){
    return item.id==='todo'||item.id==='sport'?` data-mod-hub-open="${item.id}"`:'';
  }

  function ariaLabel(item){
    if(item.id==='todo')return 'To-do öffnen';
    if(item.id==='sport')return 'Sport öffnen';
    if(item.id==='kistology')return 'Kistology Bereich vorbereitet';
    if(item.id==='food')return 'Food Bereich vorbereitet';
    if(item.id==='future')return 'Future Bereich vorbereitet';
    return 'Backstage Bereich vorbereitet';
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
      if(img.naturalWidth>0&&typeof img.decode==='function')return img.decode();
      return img.naturalWidth>0?Promise.resolve():Promise.reject(new Error('image-decode-failed'));
    }
    return new Promise((resolve,reject)=>{
      const loaded=()=>{
        cleanup();
        if(img.naturalWidth<=0){reject(new Error('image-width-zero'));return;}
        if(typeof img.decode==='function')img.decode().then(resolve,reject);
        else resolve();
      };
      const failed=()=>{cleanup();reject(new Error('image-load-error'));};
      const cleanup=()=>{
        img.removeEventListener('load',loaded);
        img.removeEventListener('error',failed);
      };
      img.addEventListener('load',loaded,{once:true});
      img.addEventListener('error',failed,{once:true});
    });
  }

  function settleFinalAssets(root,shell,generation){
    const images=[...shell.querySelectorAll('.mod-hub-app-icon-v517')];
    let finished=false;
    const finish=(reason)=>{
      if(finished||generation!==renderGeneration||!root.isConnected||!shell.isConnected)return;
      finished=true;
      const loaded=images.filter(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0).length;
      const allLoaded=images.length===MODULES.length&&loaded===images.length;
      root.dataset.modHubAssetsV520=allLoaded?'ready':'degraded';
      root.dataset.modHubAssetCountV520=String(loaded);
      root.dataset.modHubAssetReleaseV520=String(reason||'settled');
      if(allLoaded)document.documentElement.classList.add('mod-hub-assets-ready-v520');
      try{window.__modReleaseHubBootV518?.(allLoaded?'assets-ready-v520':'assets-fallback-v520');}catch(_){}
    };

    Promise.all(images.map(waitForImage)).then(()=>finish('settled')).catch(()=>finish('decode-error'));
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
                aria-label="${ariaLabel(item)}"
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
      root.dataset.modHubFinalV520='ready';
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
    sixTileGrid:true,
    wideCardsRemoved:true,
    v515OpenMarkersPreserved:true,
    sportHealthHookPreserved:true,
    todoDataUntouched:true,
    sportDataUntouched:true,
    kistologyPrepared:true,
    foodPrepared:true,
    futureCategoryPrepared:true,
    backstagePrepared:true,
    finalAssetsV520:true,
    githubHostedAssetsV520:true,
    cleanStartReleaseV520:true
  };
  window.__modHubLauncherV517=publicApi;
  window.__modHubLauncherV518=publicApi;
  window.__modHubLauncherV519=publicApi;
  window.__modHubLauncherV520=publicApi;

  let tries=0;
  const boot=setInterval(()=>{tries++;if(init()||tries>240)clearInterval(boot);},75);
  window.addEventListener('load',()=>setTimeout(init,320));
})();

/* V475 · FIXED APP HEADER
   - MASTER OF DISASTER + subtitle + tabs stay together at the top
   - only page content moves beneath the opaque themed shell
   - shell height is measured for scrollIntoView/anchor offsets
   - iPhone safe-area is respected without hard-coded header heights
*/
(function(){
  'use strict';

  const BUILD_VERSION='V475';
  const SHELL_ID='appFixedTopV475';
  const STYLE_ID='appFixedTopV475Style';
  let resizeObserver=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html{scroll-padding-top:calc(var(--mod-fixed-top-height-v475,0px) + 10px)!important}
      body{padding-top:0!important}
      #${SHELL_ID}{
        position:sticky;
        top:0;
        z-index:1650;
        margin:0 -12px 18px;
        padding:calc(12px + env(safe-area-inset-top)) 12px 10px;
        background:var(--mod-bg-top,#15191d);
        border-bottom:1px solid color-mix(in srgb,var(--mod-border,#30363b) 72%,transparent);
        box-shadow:0 10px 22px rgba(0,0,0,.20);
        isolation:isolate;
      }
      #${SHELL_ID}::before{
        content:'';
        position:absolute;
        inset:0;
        z-index:-1;
        background:var(--mod-bg-top,#15191d);
        pointer-events:none;
      }
      #${SHELL_ID} .header{
        margin:0 0 14px!important;
        padding-top:3px;
      }
      #${SHELL_ID} .tabs-wrapper{
        position:relative!important;
        top:auto!important;
        z-index:auto!important;
        margin:0!important;
        background:var(--mod-control,#101315)!important;
        border-color:var(--mod-border,#30363b)!important;
        box-shadow:0 6px 16px rgba(0,0,0,.18)!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
      }
      #${SHELL_ID} .tabs{overscroll-behavior-inline:contain}
      @media (min-width:625px){
        #${SHELL_ID}{border-radius:0 0 16px 16px}
      }
    `;
    document.head.appendChild(style);
  }

  function updateHeight(){
    const shell=document.getElementById(SHELL_ID);
    if(!shell)return 0;
    const height=Math.ceil(shell.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--mod-fixed-top-height-v475',`${height}px`);
    return height;
  }

  function install(){
    injectStyle();
    const app=document.querySelector('.app');
    if(!app)return false;
    let shell=document.getElementById(SHELL_ID);
    const header=app.querySelector(':scope > .header')||shell?.querySelector('.header');
    const tabs=app.querySelector(':scope > .tabs-wrapper')||shell?.querySelector('.tabs-wrapper');
    if(!header||!tabs)return false;

    if(!shell){
      shell=document.createElement('div');
      shell.id=SHELL_ID;
      shell.className='app-fixed-top-v475';
      app.insertBefore(shell,header);
      shell.appendChild(header);
      shell.appendChild(tabs);
    }else{
      if(header.parentElement!==shell)shell.appendChild(header);
      if(tabs.parentElement!==shell)shell.appendChild(tabs);
    }

    updateHeight();
    if(typeof ResizeObserver==='function'&&!resizeObserver){
      resizeObserver=new ResizeObserver(()=>updateHeight());
      resizeObserver.observe(shell);
    }
    return true;
  }

  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){
    window.render=function(){
      const out=baseRender.apply(this,arguments);
      install();
      requestAnimationFrame(updateHeight);
      return out;
    };
  }

  window.addEventListener('resize',updateHeight,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(updateHeight,120),{passive:true});
  window.addEventListener('load',()=>{install();setTimeout(updateHeight,120);});
  install();

  window.__modFixedAppHeaderV475={
    version:BUILD_VERSION,
    shellId:SHELL_ID,
    fixedHeader:true,
    headerAndTabsTogether:true,
    opaqueShell:true,
    dynamicHeight:true,
    install,
    updateHeight,
    get height(){return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mod-fixed-top-height-v475'))||0;}
  };
})();
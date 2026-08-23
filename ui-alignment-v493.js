/* V493 · TITEL/NUMMER-AUSRICHTUNG + EINGABE-OPTIONEN */
(function(){
  'use strict';

  const BUILD_VERSION='V493';
  let observer=null;
  let queued=false;

  function firstTextNode(el){
    if(!el)return null;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const text=String(node.textContent||'');
      if(/\S/.test(text))return node;
    }
    return null;
  }

  function firstGlyphRect(el){
    const node=firstTextNode(el);
    if(!node)return el?.getBoundingClientRect?.()||null;
    const text=String(node.textContent||'');
    const start=Math.max(0,text.search(/\S/));
    const end=Math.min(text.length,start+1);
    if(end<=start)return el.getBoundingClientRect();
    try{
      const range=document.createRange();
      range.setStart(node,start);
      range.setEnd(node,end);
      const rect=range.getBoundingClientRect();
      return rect&&rect.height?rect:el.getBoundingClientRect();
    }catch(_){return el.getBoundingClientRect();}
  }

  function alignNumberWithTitle(card){
    if(!card)return false;
    const rail=card.querySelector(':scope > .v492-number-status-rail');
    const number=rail?.querySelector('.task-number,.archive-number');
    const status=rail?.querySelector('.status-symbol');
    const title=card.querySelector('.task-text');
    if(!rail||!number||!title)return false;

    number.style.setProperty('transform','none','important');
    number.style.setProperty('margin-bottom','0px','important');

    const numberRect=firstGlyphRect(number);
    const titleRect=firstGlyphRect(title);
    if(!numberRect||!titleRect)return false;

    const delta=Math.max(-2,Math.min(9,titleRect.bottom-numberRect.bottom));
    if(Math.abs(delta)>0.1){
      number.style.setProperty('transform',`translateY(${delta.toFixed(2)}px)`,'important');
      number.style.setProperty('margin-bottom',`${Math.max(0,delta-3).toFixed(2)}px`,'important');
    }
    number.dataset.v493TitleAligned='true';
    if(status)status.dataset.v493BelowNumber='true';
    return true;
  }

  function wrapOptionRow(row){
    if(!row)return false;
    const label=row.querySelector(':scope > .option-label');
    if(!label)return false;
    let buttons=row.querySelector(':scope > .v493-option-buttons');
    if(!buttons){
      buttons=document.createElement('div');
      buttons.className='v493-option-buttons';
      [...row.children].filter(el=>el!==label&&el.classList.contains('option-button')).forEach(button=>buttons.appendChild(button));
      row.appendChild(buttons);
    }
    row.dataset.v493OptionGrid='true';
    return true;
  }

  function alignInputOptions(){
    document.querySelectorAll('#inputPanel .option-row').forEach(wrapOptionRow);
    return true;
  }

  function injectStyle(){
    if(document.getElementById('uiAlignmentV493Style'))return;
    const style=document.createElement('style');
    style.id='uiAlignmentV493Style';
    style.textContent=`
      #inputPanel .option-row[data-v493-option-grid="true"]{
        display:grid!important;
        grid-template-columns:62px minmax(0,1fr)!important;
        align-items:start!important;
        column-gap:5px!important;
        row-gap:0!important;
      }
      #inputPanel .option-row[data-v493-option-grid="true"]>.option-label{
        min-width:0!important;
        width:62px!important;
        padding-top:10px!important;
      }
      #inputPanel .v493-option-buttons{
        min-width:0!important;
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:5px!important;
      }
      #viewContainer .v492-number-status-rail>.task-number[data-v493-title-aligned="true"],
      #viewContainer .v492-number-status-rail>.archive-number[data-v493-title-aligned="true"]{
        transform-origin:left top!important;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;
    injectStyle();
    alignInputOptions();
    document.querySelectorAll('#viewContainer .task,#viewContainer .archive-task').forEach(alignNumberWithTitle);
    return true;
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(enhanceAll);
  }

  function observe(){
    if(observer)return;
    const roots=[document.getElementById('viewContainer'),document.getElementById('inputPanel')].filter(Boolean);
    if(!roots.length)return;
    observer=new MutationObserver(queue);
    roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      enhanceAll();
      setTimeout(enhanceAll,0);
      return result;
    };
  }

  injectStyle();
  alignInputOptions();
  observe();
  setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));

  window.__modUiAlignmentV493={
    version:BUILD_VERSION,
    enhanceAll,
    alignNumberWithTitle,
    alignInputOptions,
    numberTitleBottomAligned:true,
    statusStillBelowNumber:true,
    fourDigitRailPreserved:true,
    wrappedOptionRowsIndented:true,
    typeOptionsAligned:true,
    priorityOptionsAligned:true,
    dataSemanticsUntouched:true
  };
})();

/* V492 · NUMMER/STATUS-SCHIENE + DEZENTE GEWICHTSDETAILS */
(function(){
  'use strict';

  const BUILD_VERSION='V492';
  let observer=null;
  let queued=false;

  function clearPosition(el){
    if(!el)return;
    for(const prop of ['position','transform','top','right','bottom','left','inset','z-index','width']){
      try{el.style.removeProperty(prop);}catch(_){}
    }
  }

  function ensureRail(card){
    if(!card)return false;
    const isArchive=card.classList.contains('archive-task');
    const number=card.querySelector(isArchive?'.archive-number':'.task-number');
    const status=card.querySelector('.status-symbol');
    if(!number&&!status)return false;

    let rail=card.querySelector(':scope > .v492-number-status-rail');
    if(!rail){
      rail=document.createElement('div');
      rail.className='v492-number-status-rail';
      rail.dataset.v492Rail='true';
      const anchor=card.querySelector(':scope > .task-content,:scope > .edit-area')||card.firstElementChild;
      if(anchor)card.insertBefore(rail,anchor);else card.prepend(rail);
    }
    rail.classList.toggle('v492-archive-rail',isArchive);

    if(number){clearPosition(number);if(number.parentElement!==rail)rail.appendChild(number);}
    if(status){clearPosition(status);if(status.parentElement!==rail)rail.appendChild(status);}
    return true;
  }

  function splitWeightLine(el){
    if(!el||el.dataset.v492Aligned==='true')return false;
    const raw=String(el.textContent||'').trim();
    const match=raw.match(/^(↳\s*🏋️)\s*(.*)$/u);
    if(!match)return false;
    el.textContent='';
    const prefix=document.createElement('span');prefix.className='v492-weight-prefix';prefix.textContent=match[1];
    const copy=document.createElement('span');copy.className='v492-weight-copy';copy.textContent=match[2];
    el.append(prefix,copy);
    el.dataset.v492Aligned='true';
    const sub=el.nextElementSibling;
    if(sub&&sub.classList.contains('v490-weight-subline'))sub.classList.add('v492-weight-subline-aligned');
    return true;
  }

  function polishWeights(card){
    card.querySelectorAll('.v490-weight-partial,.v490-weight-full').forEach(splitWeightLine);
    return true;
  }

  function enhanceCard(card){
    ensureRail(card);
    polishWeights(card);
    return true;
  }

  function injectStyle(){
    if(document.getElementById('taskCardRailPolishV492Style'))return;
    const style=document.createElement('style');
    style.id='taskCardRailPolishV492Style';
    style.textContent=`
      #viewContainer .task:not(.archive-task),
      #viewContainer .archive-task{
        align-items:flex-start!important;
        column-gap:2px!important;
      }
      #viewContainer .v492-number-status-rail{
        flex:0 0 42px!important;
        width:42px!important;
        min-width:42px!important;
        align-self:stretch!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        gap:5px!important;
        padding:1px 0 0!important;
      }
      #viewContainer .v492-number-status-rail.v492-archive-rail{
        flex-basis:46px!important;
        width:46px!important;
        min-width:46px!important;
      }
      #viewContainer .v492-number-status-rail>.task-number,
      #viewContainer .v492-number-status-rail>.archive-number,
      #viewContainer .v492-number-status-rail>.status-symbol{
        position:static!important;
        transform:none!important;
        inset:auto!important;
        z-index:auto!important;
        flex:0 0 auto!important;
        align-self:stretch!important;
        margin:0!important;
        padding:0!important;
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        text-align:left!important;
      }
      #viewContainer .v492-number-status-rail>.task-number,
      #viewContainer .v492-number-status-rail>.archive-number{
        font-variant-numeric:tabular-nums!important;
        white-space:nowrap!important;
      }
      #viewContainer .v492-number-status-rail>.status-symbol{
        min-height:18px!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
      }
      #viewContainer .task:not(.archive-task)>.task-content,
      #viewContainer .task:not(.archive-task)>.edit-area,
      #viewContainer .archive-task>.task-content,
      #viewContainer .archive-task>.edit-area{
        flex:1 1 auto!important;
        min-width:0!important;
      }

      /* V492: Gewicht wie die kleinen Archiv-Gewichtszeilen: dunkler und nicht fett. */
      #viewContainer .v490-overall-weight,
      #viewContainer .v490-weight-nested,
      #viewContainer .v490-weight-subline{
        color:#7e8b68!important;
        font-weight:400!important;
        opacity:.92!important;
      }
      #viewContainer .v490-weight-nested[data-v492-aligned="true"]{
        display:grid!important;
        grid-template-columns:28px minmax(0,1fr)!important;
        column-gap:0!important;
        padding-left:12px!important;
        align-items:start!important;
      }
      #viewContainer .v492-weight-prefix{
        display:block!important;
        width:28px!important;
        white-space:nowrap!important;
        color:inherit!important;
        font-weight:400!important;
      }
      #viewContainer .v492-weight-copy{
        display:block!important;
        min-width:0!important;
        color:inherit!important;
        font-weight:400!important;
      }
      #viewContainer .v490-weight-subline.v492-weight-subline-aligned{
        padding-left:40px!important;
      }

      /* Dünne optische Trennung: Gesamtbereich oben, Arbeitssegmente unten. */
      #viewContainer .task-detail-v490{
        margin-top:6px!important;
        padding-top:5px!important;
        border-top:1px solid rgba(126,139,145,.22)!important;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;
    injectStyle();
    document.querySelectorAll('#viewContainer .task,#viewContainer .archive-task').forEach(enhanceCard);
    return true;
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(enhanceAll);}
  function observe(){
    if(observer)return;
    const root=document.getElementById('viewContainer');if(!root)return;
    observer=new MutationObserver(queue);
    observer.observe(root,{childList:true,subtree:true});
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){const result=previousRender.apply(this,arguments);enhanceAll();setTimeout(enhanceAll,0);return result;};
  }

  injectStyle();observe();setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));

  window.__modTaskCardRailPolishV492={
    version:BUILD_VERSION,
    enhanceAll,
    ensureRail,
    splitWeightLine,
    numberTopLeftEverywhere:true,
    statusBelowNumber:true,
    fourDigitTaskNumberReady:true,
    archiveNumberFutureReady:true,
    taskRailWidthPx:42,
    archiveRailWidthPx:46,
    numberAndStatusLeftAligned:true,
    subtleWeightStyle:true,
    weightSecondLineAligned:true,
    segmentSeparator:true,
    dataSemanticsUntouched:true
  };
})();

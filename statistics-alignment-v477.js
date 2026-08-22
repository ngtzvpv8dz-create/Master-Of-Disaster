/* V477 · STATISTIK-ZUSAMMENFASSUNGEN BÜNDIG
   Die fünf V451-Entwicklungsblöcke behalten ihre Kartenbreite, bekommen aber
   exakt das Summary-Padding der übrigen V452-Statistik-Klappblöcke.
   Damit wird die alte, spezifischere V451-Regel `padding:8px 0` neutralisiert.
*/
(function(){
  'use strict';
  const STYLE_ID='statisticsAlignmentV477Style';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #developmentStatsV451{--v476-dev-indent:0px!important}
      #developmentStatsV451>details.statistics-collapsible-v452.v476-development-block{
        margin-left:0!important;
        width:100%!important;
      }
      #developmentStatsV451>details.statistics-collapsible-v452.v476-development-block>summary{
        padding:12px 13px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function patch(){
    if(typeof currentTab!=='undefined'&&currentTab!=='statistics')return false;
    ensureStyle();
    const root=document.getElementById('developmentStatsV451');
    if(!root)return false;
    const blocks=[...root.children].filter(el=>el.matches?.('details.statistics-collapsible-v452'));
    blocks.forEach(el=>el.classList.add('v476-development-block'));
    root.style.setProperty('--v476-dev-indent','0px','important');
    return blocks.length===5;
  }

  const prev=typeof window.renderStatistics==='function'?window.renderStatistics:null;
  if(prev){window.renderStatistics=function(container){const r=prev.apply(this,arguments);setTimeout(patch,40);return r;};}
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-tab="statistics"]'))setTimeout(patch,160);},true);
  window.addEventListener('load',()=>setTimeout(patch,700));

  window.__modStatisticsAlignmentV477={
    version:'V477',
    fixedSummaryPadding:true,
    dynamicIndentRemoved:true,
    targetBlockCount:5,
    patch
  };
  if(typeof currentTab!=='undefined'&&currentTab==='statistics')setTimeout(patch,80);
})();
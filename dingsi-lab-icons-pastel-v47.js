/* V47 · Dingsi Lab only. 14 standalone pastel/used 3D icons, independent of
   the original I01-I12 choices and the V46 gallery. No production changes. */
(function(){
 'use strict';
 const entries=[
  ['todo','TO-DO'],['fitness','FITNESS'],['kistologie','KISTOLOGIE'],
  ['food','FOOD'],['einkauf','EINKAUF'],['finanzen','FINANZEN'],
  ['kalender','KALENDER'],['progress','PROGRESS'],['denkfabrik','DENKFABRIK'],
  ['outdoor','OUTDOOR'],['wohnung','WOHNUNG'],['werkstatt','WERKSTATT'],
  ['reisen','REISEN'],['backstage','BACKSTAGE']
 ];
 const path=id=>'./assets/dingsi-lab-icons/pastel-used-v47-'+id+'.webp?v=47';
 const button=document.getElementById('pastel-toggle-v47');
 const panel=document.getElementById('pastel-panel-v47');
 const grid=document.getElementById('pastel-grid-v47');
 const surface=document.getElementById('pastel-surface-v47');
 const preview=document.getElementById('preview');
 const detail=document.getElementById('pastel-detail-v47');
 const info=document.getElementById('pastel-info-v47');
 if(!button||!panel||!grid||!surface||!preview||!detail)return;
 let built=false;
 function syncBackground(){
  const theme=preview.dataset.surface;
  surface.dataset.surface=['dark','pastel','checker','photo'].includes(theme)?theme:'pastel';
  const background=preview.style.getPropertyValue('--photo-background');
  if(background)surface.style.setProperty('--photo-background',background);
 }
 function showDetail(id,title){
  detail.hidden=false;
  detail.replaceChildren();
  const pic=document.createElement('img');
  pic.src=path(id);pic.alt='';
  const data=document.createElement('div');
  const heading=document.createElement('strong');heading.textContent=title;
  const note=document.createElement('span');
  note.textContent='Pastell / Used 3D · eigenständiges Icon · transparent';
  data.appendChild(heading);data.appendChild(note);
  detail.appendChild(pic);detail.appendChild(data);
  grid.querySelectorAll('[data-pastel-id]').forEach(tile=>{
   tile.setAttribute('aria-pressed',String(tile.dataset.pastelId===id));
  });
 }
 function init(){
  if(built)return;built=true;
  entries.forEach(([id,title])=>{
   const tile=document.createElement('button');
   tile.type='button';
   tile.className='fullset-card-v45';
   tile.dataset.pastelId=id;
   tile.setAttribute('aria-pressed','false');
   tile.setAttribute('aria-label',title+' in der Pastell-/Used-3D-Serie im Detail ansehen');
   const img=document.createElement('img');img.src=path(id);img.alt='';img.loading='lazy';img.decoding='async';
   const caption=document.createElement('strong');caption.textContent=title;
   tile.appendChild(img);tile.appendChild(caption);
   tile.addEventListener('click',()=>showDetail(id,title));
   grid.appendChild(tile);
  });
 }
 button.addEventListener('click',()=>{
  const open=panel.hidden;
  panel.hidden=!open;
  button.setAttribute('aria-expanded',String(open));
  button.textContent=open?'🎨 Pastell / Used 3D · Vorschau schließen':'🎨 Pastell / Used 3D · 14 neue Icons ansehen';
  if(open){
   init();syncBackground();
   panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  }
 });
 new MutationObserver(()=>{if(!panel.hidden)syncBackground();}).observe(preview,{attributes:true,attributeFilter:['data-surface','style']});
 if(info)info.textContent='14 einzelne 3D-Icons · FOOD: Vorratsregal mit Pasta (Variante 4) · Kistologie: TOP SECRET mit Schulter-Röntgenbild';
})();

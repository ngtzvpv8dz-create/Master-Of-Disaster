'use strict';
(function(){
const KEYS=['fresh','freeze','frozen','thaw'];
const NAMES={fresh:'Frisch',freeze:'Noch einzufrieren',frozen:'Eingefroren',thaw:'Auftauen läuft'};
const DEMO={
 fresh:{product:'H-Milch',subtitle:'Geöffnete Packung · 1,5 % Fett',amount:'716 ml',info:'Kühlschrank · Nächste Verwendung: morgen'},
 freeze:{product:'Paprika',subtitle:'Vorbereitete Einfrierportion',amount:'150 g',info:'Einfrieren geplant · Kauf heute'},
 frozen:{product:'Blattspinat TK',subtitle:'Eine separate TK-Portion',amount:'212 g',info:'Eingefroren · Frostig gelagert'},
 thaw:{product:'Hackfleisch gemischt',subtitle:'Rind und Schwein · Kühlschrank',amount:'241 g',info:'Auftauen läuft · Für das Abendessen'}
};
const BASE={
 cardWidth:346,cardHeight:266,padding:17,radius:18,shadow:18,contentGap:7,buttonPad:9,
 fontSize:12,titleSize:19,detailSize:11,amountSize:26,titleWeight:850,lineHeight:135,
 crystalCount:24,crystalSize:34,crystalVariance:60,crystalRandomness:48,crystalOpacity:69,crystalBlur:0,
 crystalStroke:17,crystalCenterX:78,crystalCenterY:80,crystalSpreadX:64,crystalSpreadY:70,seed:423,
 crystalColor:'#ffffff',frostRim:35,frostHaze:42,frostBlur:11,
 coldType:'radial',coldColor1:'#8bc6ed',coldColor2:'#e6f6ff',coldX:104,coldY:107,coldSpread:74,coldSoftness:67,
 coldOpacity:73,coldAngle:135,coldStrength:78,
 sunEnabled:false,sunX:91,sunY:7,sunSize:94,sunGlow:17,sunRays:70,sunOpacity:78,sunHeat:77,
 sunSpread:48,sunColor:'#fff4d6',warmColor:'#ffba72',sunType:'radial',sunAngle:145,sunSoftness:58,
 borderThickness:2,borderColor1:'#b5d9ec',borderColor2:'#e9fafc',borderOpacity:80,borderType:'linear',
 borderAngle:130,borderX:90,borderY:80,borderConcentration:40,borderContrast:65,
 imageMode:'placeholder',imageSize:94,imageX:85,imageY:62,imageOpacity:68,imageRadius:19,
 imageRotate:0,imageShadow:10,imageLayer:'back',imageData:null,
 frostEnabled:true,sunRayCount:8,sunRotation:0,sunFillEnabled:true,sunFillOpacity:28,
 sunOutlineOpacity:95,sunOutlineThickness:2,sunRayOpacity:90
};
const DEFAULTS={
 fresh:{coldStrength:12,coldOpacity:23,crystalCount:0,frostRim:3,frostHaze:4,sunEnabled:false,frostEnabled:false,
 coldColor1:'#c3e2c8',coldColor2:'#f4fff4',borderColor1:'#c3ddc9',borderColor2:'#f5faf0',
 imageMode:'demo',imageX:82,imageY:56,imageOpacity:70},
 freeze:{coldStrength:47,coldOpacity:68,crystalCount:24,crystalSize:32,crystalCenterX:101,crystalCenterY:104,
 crystalSpreadX:40,crystalSpreadY:43,frostRim:18,imageMode:'placeholder'},
 frozen:{coldStrength:92,coldOpacity:79,crystalCount:65,crystalSize:41,crystalCenterX:92,crystalCenterY:79,
 crystalSpreadX:95,crystalSpreadY:95,frostRim:56,frostHaze:58,imageMode:'demo',
 imageX:84,imageY:56,imageOpacity:57},
 thaw:{coldStrength:47,coldOpacity:62,crystalCount:39,crystalSize:33,crystalCenterX:63,crystalCenterY:97,
 crystalSpreadX:86,crystalSpreadY:42,frostRim:34,frostHaze:38,sunEnabled:true,sunOpacity:85,
 sunHeat:88,sunX:94,sunY:6,imageMode:'demo',imageOpacity:65}
};
const GROUPS=[
 {title:'Typografie',hint:'Titel, Menge, Lesbarkeit',fields:[
 ['fontSize','Grundschrift',6,23,1,'px'],['titleSize','Produkttitel',7,35,1,'px'],['detailSize','Infotext',6,23,1,'px'],
 ['amountSize','Mengenanzeige',9,45,1,'px'],['titleWeight','Schriftstärke Titel',400,950,50,''],
 ['lineHeight','Zeilenhöhe',105,200,5,'%']]},
 {title:'Karten & Abstände',hint:'Breite, Höhe und Buttons',fields:[
 ['cardWidth','Kartenbreite',220,600,5,'px'],['cardHeight','Kartenhöhe',175,510,5,'px'],
 ['padding','Innenabstand',6,45,1,'px'],['radius','Eckenradius',0,45,1,'px'],
 ['shadow','Schattentiefe',0,45,1,'px'],['contentGap','Textabstände',0,25,1,'px'],['buttonPad','Buttonhöhe / Padding',3,22,1,'px']]},
 {title:'Eiskristalle & Zufall',hint:'Bis zu 160 kleine SVG-Kristalle',fields:[
 ['crystalCount','Kristallanzahl',0,160,1,''],['crystalSize','Durchschnittsgröße',6,125,1,'px'],
 ['crystalVariance','Größenunterschiede',0,100,1,'%'],['crystalRandomness','Zufällige Anordnung',0,100,1,'%'],
 ['crystalOpacity','Deckkraft Kristalle',0,100,1,'%'],['crystalBlur','Kristallschärfe / Blur',0,8,.25,'px'],
 ['crystalStroke','Linienstärke',4,45,1,'/10'],['crystalCenterX','Kristallzentrum X',-10,115,1,'%'],
 ['crystalCenterY','Kristallzentrum Y',-10,115,1,'%'],['crystalSpreadX','Verteilung horizontal',0,130,1,'%'],
 ['crystalSpreadY','Verteilung vertikal',0,130,1,'%'],
 ['seed','Zufalls-Seed',1,9999,1,''],['crystalColor','Kristallfarbe','color']]},
 {title:'Frostnebel & Kälteverlauf',hint:'An/Aus, Farben, Richtung und Auslauf',fields:[
 ['frostEnabled','Frosteffekt anzeigen','checkbox'],
 ['coldType','Verlaufstyp','select',['radial','linear']],
 ['coldColor1','Kältefarbe 1','color'],['coldColor2','Kältefarbe 2','color'],
 ['coldX','Verlaufzentrum X',-30,130,1,'%'],['coldY','Verlaufzentrum Y',-30,130,1,'%'],
 ['coldAngle','Linearer Winkel',0,360,1,'°'],['coldSpread','Ausbreitung',12,180,1,'%'],
 ['coldSoftness','Sanfter Auslauf',0,100,1,'%'],['coldOpacity','Farbdeckkraft',0,100,1,'%'],
 ['coldStrength','Verlaufsintensität',0,100,1,'%'],
 ['frostRim','Frostrand',0,100,1,'%'],['frostHaze','Nebelintensität',0,100,1,'%'],
 ['frostBlur','Nebelweichheit',0,35,1,'px']]},
 {title:'Sonne & Wärme',hint:'Position oben rechts oder komplett frei',fields:[
 ['sunEnabled','Sonne anzeigen','checkbox'],
 ['sunX','Sonnenposition X',-20,125,1,'%'],['sunY','Sonnenposition Y',-20,125,1,'%'],
 ['sunSize','Sonnengröße',25,240,1,'px'],['sunGlow','Sonnenglanz / Glow',0,65,1,'px'],
 ['sunRays','Strahlenlänge',0,100,1,'%'],['sunRayCount','Anzahl Sonnenstrahlen',0,32,1,''],
 ['sunRotation','Sonne drehen',-180,180,1,'°'],['sunFillEnabled','Sonnenkreis füllen','checkbox'],
 ['sunFillOpacity','Fülltransparenz',0,100,1,'%'],['sunOutlineOpacity','Kontur-Deckkraft',0,100,1,'%'],
 ['sunOutlineThickness','Konturstärke',0,10,.5,'px'],['sunRayOpacity','Strahlen-Deckkraft',0,100,1,'%'],
 ['sunOpacity','Sonnen-Deckkraft',0,100,1,'%'],
 ['sunHeat','Wärmeintensität',0,100,1,'%'],['sunSpread','Wärme-Ausbreitung',10,160,1,'%'],
 ['sunType','Wärmeverlauf-Typ','select',['radial','linear']],['sunAngle','Wärme-Richtung',0,360,1,'°'],
 ['sunSoftness','Wärme-Auslauf',0,100,1,'%'],['sunColor','Sonnenfarbe','color'],['warmColor','Wärmefarbe','color']]},
 {title:'Rahmen & Farbverlauf',hint:'Zweifarbig, radial oder linear, mit Konzentration',fields:[
 ['borderThickness','Rahmendicke',0,15,.5,'px'],
 ['borderColor1','Rahmenfarbe 1','color'],['borderColor2','Rahmenfarbe 2','color'],
 ['borderOpacity','Rahmen-Deckkraft',0,100,1,'%'],['borderType','Rahmen-Verlaufstyp','select',['linear','radial']],
 ['borderAngle','Rahmenwinkel',0,360,1,'°'],['borderX','Rahmenzentrum X',-25,125,1,'%'],
 ['borderY','Rahmenzentrum Y',-25,125,1,'%'],['borderConcentration','Farbkonzentration',0,100,1,'%'],
 ['borderContrast','Rahmen-Kontrast',0,100,1,'%']]},
 {title:'Produktbild & Platzhalter',hint:'Demo-SVG, eigener Upload, Position und Ebenen',fields:[
 ['imageMode','Bildmodus','select',['none','placeholder','demo','upload']],
 ['imageLayer','Bildebene','select',['back','front']],
 ['imageSize','Bildgröße',20,260,1,'px'],['imageX','Bildposition X',-30,130,1,'%'],
 ['imageY','Bildposition Y',-30,130,1,'%'],['imageOpacity','Bild-Deckkraft',0,100,1,'%'],
 ['imageRadius','Bild-Eckenradius',0,100,1,'px'],['imageRotate','Bilddrehung',-180,180,1,'°'],
 ['imageShadow','Bildschatten',0,45,1,'px']]}
];
const FIELD_DEF=new Map(GROUPS.flatMap(g=>g.fields).map(row=>[row[0],row]));
const storeKey='mod-dingsi-lab-v32-designs';
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>Object.fromEntries(KEYS.map(k=>[k,{...BASE,...DEFAULTS[k]}]));
const originals=initial();
const draft=clone(originals);
let saved={},savedAt={},approved={},selected='frozen',compareOn=false,saveWarning='';
try{
 const data=JSON.parse(localStorage.getItem(storeKey)||'null');
 if(data&&data.version===32&&data.saved){
  for(const key of KEYS)if(data.saved[key]&&typeof data.saved[key]==='object'){
   saved[key]=sanitize(data.saved[key],key);
   draft[key]=clone(saved[key]);
   savedAt[key]=String(data.savedAt?.[key]||'');
   if(data.approved?.[key]===true)approved[key]=true;
  }
 }
}catch(e){saveWarning='Lokaler Speicher nicht verfügbar; verwende JSON-Export.'}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function sanitize(candidate,key){
 const b={...BASE,...DEFAULTS[key]};
 for(const [k,row] of FIELD_DEF){
  const incoming=candidate?.[k];
  if(incoming===undefined)continue;
  if(row[2]==='color'){
   if(typeof incoming==='string'&&/^#[0-9a-fA-F]{6}$/.test(incoming))b[k]=incoming;
  }else if(row[2]==='select'){
   if(row[3].includes(incoming))b[k]=incoming;
  }else if(row[2]==='checkbox'){
   b[k]=incoming===true;
  }else if(typeof incoming==='number'&&Number.isFinite(incoming))b[k]=clamp(incoming,row[2],row[3]);
 }
 if(typeof candidate?.imageData==='string'&&candidate.imageData.length<350000&&/^data:image\/(?:jpeg|png|webp);base64,/.test(candidate.imageData))b.imageData=candidate.imageData;
 return b;
}
function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const $=id=>document.getElementById(id);
function hexrgba(hex,a){const h=String(hex).replace('#','');return 'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+clamp(a,0,1).toFixed(3)+')'}
function mixedGradient(p){
 const a=p.coldOpacity/100*p.coldStrength/100,b=hexrgba(p.coldColor1,a),c=hexrgba(p.coldColor2,a*.75);
 const threshold=clamp(p.coldSoftness*.35+6,8,42);
 if(p.coldType==='linear')return 'linear-gradient('+p.coldAngle+'deg,'+b+' 0%,'+c+' '+(35+threshold)+'%,transparent 100%)';
 return 'radial-gradient(ellipse '+(Math.max(20,p.coldSpread*1.9))+'% '+(Math.max(20,p.coldSpread*1.65))+'% at '+p.coldX+'% '+p.coldY+'%,'+b+' 0%,'+c+' '+threshold+'%,transparent 100%)';
}
function sunGradient(p){
 const strength=p.sunHeat/100,soft=clamp(p.sunSoftness*.55+12,12,78);
 const c=hexrgba(p.warmColor,strength*.85),c2=hexrgba(p.warmColor,strength*.30);
 if(p.sunType==='linear')return 'linear-gradient('+p.sunAngle+'deg,'+c+' 0%,'+c2+' '+soft+'%,transparent 100%)';
 return 'radial-gradient(circle '+(p.sunSpread*1.5)+'% at '+p.sunX+'% '+p.sunY+'%,'+c+' 0%,'+c2+' '+soft+'%,transparent 100%)';
}
function borderGradient(p){
 const a=p.borderOpacity/100,b=hexrgba(p.borderColor1,a),c=hexrgba(p.borderColor2,a*Math.max(.12,p.borderContrast/100));
 const stop=Math.round(p.borderConcentration*.8);
 if(p.borderType==='radial')return 'radial-gradient(ellipse 150% 140% at '+p.borderX+'% '+p.borderY+'%,'+b+' '+stop+'%,'+c+' 100%)';
 return 'linear-gradient('+p.borderAngle+'deg,'+b+' '+stop+'%,'+c+' 100%)';
}
function styleVars(p){
 const haze=p.frostHaze/100;
 const props={
 '--w':p.cardWidth+'px','--h':p.cardHeight+'px','--pd':p.padding+'px','--radius':p.radius+'px',
 '--shadow':p.shadow+'px','--gap':p.contentGap+'px','--lh':p.lineHeight/100,
 '--button-padding':p.buttonPad+'px','--fs':p.fontSize+'px','--ts':p.titleSize+'px',
 '--ds':p.detailSize+'px','--qs':p.amountSize+'px','--weight':p.titleWeight,
 '--bw':p.borderThickness+'px','--border-bg':borderGradient(p),
 '--main-gradient':mixedGradient(p),'--bg-strength':p.frostEnabled?1:0,
 '--haze-gradient':'radial-gradient(ellipse '+(p.coldSpread*2)+'% '+(p.coldSpread*1.8)+'% at '+p.coldX+'% '+p.coldY+'%,'+hexrgba('#ffffff',haze*.76)+' 0%,transparent 74%)',
 '--haze-alpha':p.frostEnabled?haze:0,'--haze-blur':p.frostBlur+'px',
 '--rim-radius':(p.frostRim*.35)+'px','--rim-color':hexrgba('#ffffff',p.frostEnabled?p.frostRim/100*.9:0),
 '--flake-opacity':p.frostEnabled?p.crystalOpacity/100:0,'--flake-blur':p.crystalBlur+'px',
 '--flake-color':p.crystalColor,
 '--sun-halo':sunGradient(p),
 '--sun-alpha':p.sunEnabled?p.sunOpacity/100:0,
 '--sun-x':p.sunX+'%','--sun-y':p.sunY+'%','--sun-size':p.sunSize+'px',
 '--sun-glow':p.sunGlow+'px','--sun-visibility':p.sunEnabled?p.sunOpacity/100:0,'--sun-color':p.sunColor,
 '--image-x':p.imageX+'%','--image-y':p.imageY+'%','--image-size':p.imageSize+'px',
 '--image-alpha':p.imageOpacity/100,'--image-radius':p.imageRadius+'px','--image-angle':p.imageRotate+'deg',
 '--image-shadow':p.imageShadow+'px','--image-layer':p.imageLayer==='front'?4:2
 };
 return Object.entries(props).map(([k,v])=>k+':'+v).join(';');
}
function rand(seed){let s=(seed|0)||1;return ()=>{s=(Math.imul(1664525,s)+1013904223)|0;return (s>>>0)/4294967296;}}
function flakes(p){
 if(!p.frostEnabled||!p.crystalCount)return '';
 const r=rand(p.seed);
 let out='';
 for(let i=0;i<p.crystalCount;i++){
  const u=r(),v=r(),z=r(),rot=r(),sz=r();
  const naturalX=u*100,naturalY=v*100;
  const x=clamp(p.crystalCenterX+(naturalX-50)*p.crystalSpreadX/50*(p.crystalRandomness/100)+((i%5)-2)*p.crystalSpreadX/9*(1-p.crystalRandomness/100),-20,120);
  const y=clamp(p.crystalCenterY+(naturalY-50)*p.crystalSpreadY/50*(p.crystalRandomness/100)+((i%4)-1.5)*p.crystalSpreadY/7*(1-p.crystalRandomness/100),-20,120);
  const size=clamp(p.crystalSize*(1+(sz-.5)*2*p.crystalVariance/100),3,240);
  const stroke=p.crystalStroke/10;
  out+='<svg class="st-flake" aria-hidden="true" viewBox="0 0 100 100" style="left:'+x.toFixed(1)+'%;top:'+y.toFixed(1)+'%;width:'+size.toFixed(1)+'px;height:'+size.toFixed(1)+'px;--rot:'+(rot*360|0)+'deg;stroke-width:'+stroke.toFixed(1)+'"><use href="#st-crystal"></use></svg>';
 }
 return out;
}
function demoSvg(key){
 if(key==='fresh')return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#c8edf6"/></linearGradient></defs><path d="M31 20h35l7 17v48H27V37z" fill="url(#m)" stroke="#9ac9d5" stroke-width="2"/><path d="M31 20l9-9h27l-1 9M27 37h46" fill="none" stroke="#89b4c3" stroke-width="2"/><rect x="35" y="48" width="30" height="23" rx="5" fill="#9ad9c9"/><path d="M50 51c-8 11-10 14 0 18 10-4 8-7 0-18" fill="#ffffffd9"/></svg>';
 if(key==='freeze')return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M25 41c0-19 18-28 29-15 11-11 32-1 27 15-3 23-23 39-42 39-24 0-34-20-14-39z" fill="#ed6659" stroke="#b64b43" stroke-width="2"/><path d="M51 26c2-10 10-17 19-16m-19 16c-6-9-15-10-23-8" fill="none" stroke="#568f50" stroke-width="5" stroke-linecap="round"/><path d="M51 26L40 40" stroke="#e59879" stroke-width="2"/></svg>';
 if(key==='frozen')return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M20 67c-6-19 20-48 36-49 13-1 29 16 24 31-3 11-31 35-48 32z" fill="#519d63" stroke="#397c4e" stroke-width="2"/><path d="M25 75c26-31 45-49 51-49" stroke="#b2de9c" stroke-width="3" fill="none"/><path d="M36 62l-7-19m22 4-6-20m17 9 13 7M47 64l12 9" stroke="#b1d5a0" stroke-width="2"/></svg>';
 return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 63Q5 36 37 24 73 10 83 40 95 71 62 79 31 88 18 63z" fill="#c57c75" stroke="#9a5756" stroke-width="2"/><path d="M20 48c17 5 24-17 42-9 15 6 4 19 20 25M28 66c13-20 19 10 35 0M30 30c6 17 18 5 24-8" fill="none" stroke="#e7a7a1" stroke-width="4" stroke-linecap="round"/></svg>';
}
function imageMarkup(key,p){
 if(p.imageMode==='none')return '<div class="st-image is-none"></div>';
 const cl=p.imageLayer==='front'?'is-front':'is-back';
 let body='';
 if(p.imageMode==='upload'&&p.imageData)body='<img alt="" src="'+html(p.imageData)+'">';
 else if(p.imageMode==='demo')body=demoSvg(key);
 else body='<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="10" y="17" width="80" height="66" rx="11" stroke="#87afbb" stroke-width="2" fill="#eff8fbd9"/><circle cx="33" cy="36" r="7" fill="#b6ddeb"/><path d="M18 70l21-22 13 13 12-17 18 26" fill="none" stroke="#81b2be" stroke-width="3"/><text x="50" y="94" text-anchor="middle" font-size="10" fill="#6a9cae">BILDBEREICH</text></svg>';
 return '<div class="st-image '+cl+'">'+body+'</div>';
}
function sunMarkup(p){
 if(!p.sunEnabled)return '';
 const count=clamp(Math.round(p.sunRayCount),0,32);
 const length=5+p.sunRays/100*22;
 const arms=Array.from({length:count},(_,i)=>{
   const angle=i*Math.PI*2/count;
   const x1=(50+25*Math.sin(angle)).toFixed(2),y1=(50-25*Math.cos(angle)).toFixed(2);
   const x2=(50+(25+length)*Math.sin(angle)).toFixed(2),y2=(50-(25+length)*Math.cos(angle)).toFixed(2);
   return '<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'"/>';
 }).join('');
 const fill=p.sunFillEnabled?html(p.sunColor):'none';
 return '<svg class="st-sun" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate('+p.sunRotation+' 50 50)">'+
 '<circle cx="50" cy="50" r="20" fill="'+fill+'" fill-opacity="'+(p.sunFillEnabled?p.sunFillOpacity/100:0)+'" stroke-opacity="'+p.sunOutlineOpacity/100+'" stroke-width="'+p.sunOutlineThickness+'"/>'+
 '<g fill="none" stroke-opacity="'+p.sunRayOpacity/100+'">'+arms+'</g></g></svg>';
}
function cardMarkup(key,p){
 const row=DEMO[key];const bold=''+html(row.product);
 return '<div class="st-card" style="'+html(styleVars(p))+'" data-st-card="'+html(key)+'">'+
 '<div class="st-bg"></div><div class="st-haze"></div><div class="st-rim"></div>'+
 '<div class="st-crystals">'+flakes(p)+'</div><div class="st-sunlight"></div>'+sunMarkup(p)+
 imageMarkup(key,p)+
 '<div class="st-card-content"><span class="st-status-pill">'+html(NAMES[key]).toUpperCase()+'</span>'+
 '<h2 class="st-card-name">'+bold+'</h2><p class="st-card-meta">'+html(row.subtitle)+'</p>'+
 '<div class="st-card-quantity">'+html(row.amount)+'</div><p class="st-card-notes">'+html(row.info)+'</p>'+
 '<div class="st-card-buttons"><span>Menge ändern</span><span>Zustand & Verwendung</span></div></div></div>';
}
function renderPreview(){
 const p=draft[selected],slot=$('st-preview'),space=$('st-demo-space');
 slot.innerHTML=cardMarkup(selected,p);
 $('st-preview-label').textContent=NAMES[selected];
 // A card is always rendered at native pixel font sizes.
 // Only its maximum width is limited by the actual screen; never use CSS transform/zoom.
 const card=slot.querySelector('.st-card');
 if(card){
  card.style.width='100%';
  card.style.maxWidth='100%';
  card.style.minHeight=p.cardHeight+'px';
  card.style.height='auto';
  card.style.transform='none';
 }
 slot.style.width='min(100%, '+p.cardWidth+'px)';
 slot.style.maxWidth='100%';
 slot.style.height='auto';
 // The viewport itself is capped by CSS: extra-tall cards scroll inside the preview.
 space.style.height='auto';
}
function renderComparison(){
 if(!compareOn)return;
 $('st-comparison').innerHTML=KEYS.map(k=>'<div class="st-compare-item"><strong>'+html(NAMES[k])+'</strong>'+cardMarkup(k,draft[k])+'</div>').join('');
}
function fieldMarkup(row){
 const [key,label,type,max,step,unit]=row,p=draft[selected];
 let control='';
 if(type==='color')control='<input type="color" data-setting="'+key+'" value="'+html(p[key])+'" aria-label="'+html(label)+'">';
 else if(type==='select')control='<select data-setting="'+key+'" aria-label="'+html(label)+'">'+max.map(v=>'<option value="'+html(v)+'"'+(p[key]===v?' selected':'')+'>'+html(v)+'</option>').join('')+'</select>';
 else if(type==='checkbox')control='<input type="checkbox" data-setting="'+key+'" '+(p[key]?'checked':'')+' aria-label="'+html(label)+'">';
 else control='<div class="st-range"><input type="range" data-setting="'+key+'" min="'+type+'" max="'+max+'" step="'+step+'" value="'+p[key]+'" aria-label="'+html(label)+'"><output>'+p[key]+(unit||'')+'</output></div>'
   +((key==='imageRotate'||key==='sunRotation')?'<button type="button" class="st-zero-button" data-zero-setting="'+key+'">0° · Gerade</button>':'');
 return '<div class="st-field"><label>'+html(label)+'</label>'+control+'</div>';
}
function renderGroups(){
 const opening=[...document.querySelectorAll('details.st-group[open]')].map(d=>d.dataset.group);
 const previous=document.querySelectorAll('details.st-group').length;
 $('st-groups').innerHTML=GROUPS.map((g,i)=>'<details class="st-group" data-group="'+i+'" '+((previous?opening.includes(String(i)):i===2)?'open':'')+'><summary><span>'+g.title+' <small style="font-weight:450;color:#789087">· '+g.hint+'</small></span></summary><div class="st-fields">'+g.fields.map(fieldMarkup).join('')+'</div></details>').join('');
}
function unsaved(){return !saved[selected]||JSON.stringify(draft[selected])!==JSON.stringify(saved[selected])}
function renderSaved(){
 $('st-save-status').textContent=unsaved()
   ?'Nicht gespeicherte Änderungen · '+NAMES[selected]
   :'Gespeichert: '+NAMES[selected]+(savedAt[selected]?' · '+new Date(savedAt[selected]).toLocaleString('de-DE'):'')+(approved[selected]?' · Für Übernahme vorgemerkt':'');
 $('st-save-status').className='st-saved '+(unsaved()?'unsaved':'ok');
 document.querySelectorAll('[data-status]').forEach(el=>{
 const k=el.dataset.status;
 el.setAttribute('aria-selected',String(k===selected));
 el.classList.toggle('saved',Boolean(saved[k]));
 });
 $('st-selected-heading').textContent='Regler für: '+NAMES[selected];
 const pickerLabel=$('st-picker-label');if(pickerLabel)pickerLabel.textContent=NAMES[selected];
}
function renderAll(){renderPreview();renderGroups();renderSaved();renderComparison();}
function changeSelected(key){if(!KEYS.includes(key))return;selected=key;const picker=$('st-status-picker');if(picker)picker.open=false;renderAll();}
function showNotice(s,good=true){const n=$('st-notice');n.textContent=s;n.style.color=good?'#237253':'#a14f35';}
function persist(){
 const data={version:32,saved,savedAt,approved};
 try{localStorage.setItem(storeKey,JSON.stringify(data));return true}
 catch(e){showNotice('Speichern im Browser fehlgeschlagen. Bitte JSON-Export verwenden.',false);return false}
}
function saveCurrent(){
 saved[selected]=clone(draft[selected]);savedAt[selected]=new Date().toISOString();delete approved[selected];
 if(persist()){renderSaved();showNotice('✓ '+NAMES[selected]+' gespeichert. Für geräteübergreifende Sicherung bitte zusätzlich JSON exportieren.');}
}
function approveCurrent(){
 if(unsaved())return showNotice('Erst die aktuellen Einstellungen speichern, danach für die Übernahme vormerken.',false);
 approved[selected]=true;
 if(persist()){renderSaved();showNotice('✓ '+NAMES[selected]+' für spätere Übernahme vorgemerkt, nicht produktiv veröffentlicht.');}
}
function loadCurrent(){draft[selected]=clone(saved[selected]||originals[selected]);renderAll();showNotice('Gespeicherten Stand geladen (oder Standard, falls noch nichts gespeichert).');}
function resetCurrent(){draft[selected]=clone(originals[selected]);renderAll();showNotice('Diese Variante wurde auf Standard zurückgesetzt. Noch nicht gespeichert.');}
function setPreset(name){
 const b=clone(originals[selected]);
 const presets={
 soft:{crystalCount:10,crystalOpacity:32,crystalSize:25,frostHaze:22,coldStrength:38,borderThickness:1},
 balanced:{crystalCount:35,crystalOpacity:56,crystalSize:32,coldStrength:65,frostHaze:35},
 bloom:{crystalCount:75,crystalOpacity:73,crystalSize:43,crystalVariance:74,coldStrength:84,frostHaze:57,frostRim:70},
 storm:{crystalCount:130,crystalOpacity:86,crystalSize:54,crystalVariance:87,crystalRandomness:100,coldStrength:96,frostHaze:80}
 };
 Object.assign(b,presets[name]||{});
 if(selected==='fresh'){b.crystalCount=name==='storm'?20:0;b.coldStrength=Math.min(30,b.coldStrength);}
 draft[selected]=b;renderAll();showNotice('Preset eingestellt, noch nicht gespeichert.');
}
function downloadJSON(){
 const data={format:'dingsi-lab-style-v32',version:32,createdAt:new Date().toISOString(),saved,saveDates:savedAt,approved};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Dingsi-Lab-Designs-V32.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 showNotice('JSON-Export gestartet. Er enthält ausschließlich explizit gespeicherte Varianten.');
}
async function importJSON(file){
 if(!file||file.size>2e6)throw Error('Importdatei fehlt oder ist größer als 2 MB');
 const data=JSON.parse(await file.text());
 if(data.format!=='dingsi-lab-style-v32'||data.version!==32||!data.saved||typeof data.saved!=='object')throw Error('Keine gültige Dingsi-Lab-V32-Konfiguration');
 let count=0;
 for(const key of KEYS)if(data.saved[key]&&typeof data.saved[key]==='object'){
  const corrected=sanitize(data.saved[key],key);
  saved[key]=corrected;draft[key]=clone(corrected);
  savedAt[key]=String(data.saveDates?.[key]||new Date().toISOString());
  if(data.approved?.[key]===true)approved[key]=true;else delete approved[key];count++;
 }
 if(!count)throw Error('Keine gespeicherten Varianten vorhanden');
 if(!persist())throw Error('Konfiguration geladen, aber Speichern im Browser nicht möglich');
 renderAll();showNotice('✓ '+count+' Variante(n) importiert und lokal gespeichert.');
}
function copyCurrent(){
 const target=$('st-copy-target').value;
 if(!KEYS.includes(target)||target===selected)return showNotice('Bitte andere Zielvariante auswählen.',false);
 const media=draft[target].imageData;
 draft[target]=clone({...draft[selected],imageData:media});
 changeSelected(target);showNotice('Werte kopiert, noch nicht gespeichert. Bild-Upload des Ziels bleibt erhalten.');
}
function updateControl(control){
 const key=control.dataset.setting,row=FIELD_DEF.get(key);if(!row)return;
 let v;
 if(row[2]==='color'||row[2]==='select')v=control.value;
 else if(row[2]==='checkbox')v=control.checked;
 else v=clamp(Number(control.value),row[2],row[3]);
 draft[selected][key]=v;
 const out=control.parentElement.querySelector('output');
 if(out)out.textContent=v+(row[5]||'');
 if(key==='imageMode'&&v==='upload'&&!draft[selected].imageData)showNotice('Noch kein eigenes Bild vorhanden: Erst ein Bild auswählen.',false);
 renderPreview();renderSaved();if(compareOn)renderComparison();
}
async function upload(file){
 if(!file) return;
 if(!/^image\/(?:png|jpeg|webp)$/.test(file.type))throw Error('Bitte PNG, JPEG oder WebP hochladen.');
 if(file.size>12e6)throw Error('Bild ist größer als 12 MB');
 const u=URL.createObjectURL(file);
 try{
  const img=new Image();img.decoding='async';
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Bild konnte nicht geladen werden'));img.src=u;});
  const scale=Math.min(1,360/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Bildverarbeitung nicht verfügbar');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const uri=canvas.toDataURL('image/jpeg',.72);
  if(uri.length>300000)throw Error('Vorschau zu groß');
  draft[selected].imageData=uri;draft[selected].imageMode='upload';
  renderAll();showNotice('Bild verkleinert und eingesetzt. Speichere die Variante, um es zu behalten.');
 }finally{URL.revokeObjectURL(u);}
}
function statusInit(){
 $('st-groups').addEventListener('click',e=>{
  const zero=e.target.closest('[data-zero-setting]');
  if(!zero)return;
  const key=zero.dataset.zeroSetting;
  if(key!=='imageRotate'&&key!=='sunRotation')return;
  draft[selected][key]=0;
  renderPreview();renderGroups();renderSaved();if(compareOn)renderComparison();
 });
 document.querySelectorAll('[data-status]').forEach(el=>el.addEventListener('click',()=>changeSelected(el.dataset.status)));
 $('st-groups').addEventListener('input',e=>{const c=e.target.closest('[data-setting]');if(c)updateControl(c);});
 $('st-groups').addEventListener('change',e=>{const c=e.target.closest('[data-setting]');if(c)updateControl(c);});
 $('st-save').addEventListener('click',saveCurrent);
 $('st-approve').addEventListener('click',approveCurrent);
 $('st-load').addEventListener('click',loadCurrent);
 $('st-reset').addEventListener('click',resetCurrent);
 $('st-reseed').addEventListener('click',()=>{draft[selected].seed=draft[selected].seed+1>9999?1:draft[selected].seed+1;renderAll();showNotice('Kristalle neu gemischt.');});
 $('st-copy').addEventListener('click',copyCurrent);
 $('st-presets').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)setPreset(b.dataset.preset)});
 $('st-export').addEventListener('click',downloadJSON);
 $('st-import').addEventListener('change',async e=>{try{await importJSON(e.target.files?.[0]);}catch(err){showNotice(err.message||String(err),false)}e.target.value='';});
 $('st-upload').addEventListener('change',async e=>{try{await upload(e.target.files?.[0]);}catch(err){showNotice(err.message||String(err),false)}e.target.value='';});
 $('st-compare-toggle').addEventListener('click',()=>{
  compareOn=!compareOn;$('st-compare').classList.toggle('open',compareOn);
  $('st-compare-toggle').textContent=compareOn?'Vergleich schließen':'Alle vier vergleichen';
  renderComparison();
 });
 $('st-copy-target').innerHTML=KEYS.map(k=>'<option value="'+k+'">'+NAMES[k]+'</option>').join('');
 $('st-copy-target').value='thaw';
 if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',renderPreview,{passive:true});
 renderAll();
 if(saveWarning)showNotice(saveWarning,false);
}
statusInit();
})();
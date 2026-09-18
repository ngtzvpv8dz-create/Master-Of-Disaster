/* V543 · FOOD STARTBEREICH
   Tagesküche, Vorratsküche und Rezeptgarten auf gemeinsamer Datenbasis.
   Planung wird niemals stillschweigend als bestätigter Verbrauch behandelt.
*/
(function(){
  'use strict';
  if(window.__modFoodV543)return;

  const VERSION='V543';
  const ROOT_ID='modFoodV543';
  const BODY_CLASS='mod-food-v543';
  const TABS=['today','plan','inventory','shopping','recipes'];
  const labels={today:'Heute',plan:'Plan',inventory:'Vorrat',shopping:'Einkauf',recipes:'Rezepte'};
  let activeTab='today';
  let loadPromise=null;

  const fallback={
    meals:[
      {id:'breakfast',meal_type:'breakfast',title:'Skyr-Bananen-Bowl',status:'consumed',sort_order:1,ingredients:['250 g Skyr Natur','1 Banane','3 EL zarte Haferflocken'],note:'Frühstück ist bestätigt gegessen.'},
      {id:'snack',meal_type:'snack',title:'Apfel & Mandeln',status:'prepared',sort_order:2,ingredients:['1 Apfel','25 g Mandeln natur'],note:'Menge geplant; noch nicht als vollständig gegessen bestätigt.'},
      {id:'lunch',meal_type:'lunch',title:'Roggenbrot mit Pute & Gurke',status:'prepared',sort_order:3,ingredients:['2 Scheiben Roggen-Vollkornbrot · 111 g','100 g Putenbrust','30 g Frischkäse Balance','118 g Gurke auf dem Brot','106 g Tomaten separat'],note:'Zusammengestellt; noch nicht als vollständig gegessen bestätigt.'},
      {id:'dinner',meal_type:'dinner',title:'Hähnchen, Kartoffeln & Brokkoli',status:'planned',sort_order:4,ingredients:['200 g Hähnchenbrust','300 g Kartoffeln','300 g Brokkoli','2–3 EL Magerquark als Dip'],note:'Für heute Abend geplant. Noch nichts davon wurde vom Bestand abgezogen.'}
    ],
    inventory:[
      {name:'Gurke',quantity_label:'324 g',forecast_label:null,tone:'fresh',note:'442 g gewogen · 118 g fürs Mittag vorbereitet'},
      {name:'Tomaten · Fruchtig & Süß',quantity_label:'394 g',forecast_label:null,tone:'fresh',note:'500-g-Packung · 106 g separat zum Mittag'},
      {name:'Brokkoli',quantity_label:'500 g',forecast_label:'200 g nach dem Abendessen',tone:'priority',note:'300 g sind erst geplant, nicht verbraucht'},
      {name:'Hähnchenbrustfilet',quantity_label:'600 g',forecast_label:'400 g nach dem Abendessen',tone:'priority',note:'200 g sind erst geplant, nicht verbraucht'},
      {name:'Kartoffeln',quantity_label:'2.500 g',forecast_label:'2.200 g nach dem Abendessen',tone:'stock',note:'300 g fürs Abendessen geplant'},
      {name:'Skyr Natur',quantity_label:'250 g',forecast_label:null,tone:'priority',note:'250 g beim Frühstück gegessen'},
      {name:'Frischkäse Balance',quantity_label:'270 g',forecast_label:null,tone:'fresh',note:'30 g fürs Mittag vorbereitet'},
      {name:'Magerquark',quantity_label:'250 g',forecast_label:'Dip-Menge noch ungenau',tone:'stock',note:'2–3 EL geplant; keine Grammzahl erfunden'},
      {name:'Roggen-Vollkornbrot',quantity_label:'ca. 389 g · 7 Scheiben',forecast_label:null,tone:'fresh',note:'500 g / 9 Scheiben · 2 Scheiben = ca. 111 g'},
      {name:'Putenbrust',quantity_label:'0 g',forecast_label:null,tone:'empty',note:'100-g-Packung fürs Mittag verwendet'},
      {name:'Bananen',quantity_label:'4 Stück',forecast_label:null,tone:'fresh',note:'5 gekauft · 1 beim Frühstück gegessen'},
      {name:'Äpfel grün',quantity_label:'8 Stück gekauft',forecast_label:'7 nach dem Snack',tone:'stock',note:'1 Stück geplant, noch nicht bestätigt gegessen'},
      {name:'Mandeln natur',quantity_label:'200 g gekauft',forecast_label:'175 g nach dem Snack',tone:'stock',note:'25 g geplant, noch nicht bestätigt gegessen'},
      {name:'Zarte Haferflocken',quantity_label:'Rest nicht grammgenau',forecast_label:null,tone:'stock',note:'500-g-Packung · 3 EL beim Frühstück verwendet'},
      {name:'Hackfleisch gemischt',quantity_label:'800 g',forecast_label:null,tone:'stock',note:'Noch keiner heutigen Mahlzeit zugeordnet'},
      {name:'Pepsi Zero Cherry',quantity_label:'6 × 1,25 l',forecast_label:null,tone:'stock',note:'Getränkevorrat'}
    ]
  };

  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const statusText=status=>({consumed:'Gegessen',prepared:'Vorbereitet',planned:'Geplant'}[status]||status);
  const mealIcon=type=>({breakfast:'☀',snack:'●',lunch:'◒',dinner:'☾'}[type]||'•');

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-food-root-v543';
    root.setAttribute('aria-label','FOOD');
    app.appendChild(root);
    return root;
  }

  function client(){
    try{
      if(typeof window.getSupabaseClient==='function')return window.getSupabaseClient();
      if(typeof getSupabaseClient==='function')return getSupabaseClient();
    }catch(_){}
    return null;
  }

  async function remoteData(){
    const supabase=client();
    if(!supabase)return null;
    const sessionResult=await supabase.auth.getSession();
    const user=sessionResult?.data?.session?.user;
    if(sessionResult?.error||!user?.id)return null;
    const [mealResult,inventoryResult]=await Promise.all([
      supabase.from('food_meals').select('id,meal_type,title,status,sort_order,note,food_meal_ingredients(label,sort_order)').eq('meal_date','2026-09-18').order('sort_order'),
      supabase.from('food_inventory_overview').select('name,quantity_label,forecast_label,tone,note,sort_order').order('sort_order')
    ]);
    if(mealResult.error||inventoryResult.error)throw mealResult.error||inventoryResult.error;
    return {
      meals:(mealResult.data||[]).map(row=>({...row,ingredients:(row.food_meal_ingredients||[]).sort((a,b)=>a.sort_order-b.sort_order).map(item=>item.label)})),
      inventory:inventoryResult.data||[]
    };
  }

  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=remoteData().then(data=>data&&data.meals?.length?data:fallback).catch(error=>{
      console.warn('V543 FOOD Cloud-Daten nicht erreichbar; lokaler Startstand wird gezeigt.',error);
      return fallback;
    });
    return loadPromise;
  }

  function hero(){
    return `<div class="food-hero-v543"><div><span class="food-kicker-v543">TAGESKÜCHE</span><h2>Was gibt es heute?</h2><p>Dein Plan, dein Vorrat und die Reste von morgen – ohne Mengen zu erfinden.</p></div><div class="food-date-v543"><strong>18</strong><span>SEP</span></div></div>`;
  }

  function nav(){
    return `<nav class="food-nav-v543" aria-label="FOOD Bereiche">${TABS.map(tab=>`<button type="button" data-food-tab="${tab}" class="${tab===activeTab?'active':''}" aria-pressed="${tab===activeTab}">${labels[tab]}</button>`).join('')}</nav>`;
  }

  function mealsView(data){
    return `<div class="food-section-head-v543"><div><span>HEUTE</span><h3>Deine vier Stationen</h3></div><small>Bestätigt ≠ geplant</small></div><div class="food-meal-list-v543">${data.meals.map(meal=>`<article class="food-meal-card-v543 status-${esc(meal.status)}"><div class="food-meal-icon-v543">${mealIcon(meal.meal_type)}</div><div class="food-meal-copy-v543"><div class="food-meal-title-row-v543"><h4>${esc(meal.title)}</h4><span>${esc(statusText(meal.status))}</span></div><ul>${meal.ingredients.map(i=>`<li>${esc(i)}</li>`).join('')}</ul><p>${esc(meal.note||'')}</p></div></article>`).join('')}</div>`;
  }

  function planView(data){
    const dinner=data.meals.find(m=>m.meal_type==='dinner');
    return `<div class="food-section-head-v543"><div><span>PLAN</span><h3>Heute sicher, morgen klug</h3></div></div><article class="food-focus-card-v543"><span class="food-pill-v543">HEUTE ABEND</span><h4>${esc(dinner?.title||'Abendessen')}</h4><p>${esc(dinner?.ingredients?.join(' · ')||'')}</p><div class="food-rule-v543"><strong>Noch nicht abgezogen</strong><span>Erst die echte Zubereitung oder dein bestätigter Verbrauch verändert den belastbaren Bestand.</span></div></article><article class="food-tomorrow-card-v543"><span class="food-pill-v543">MORGEN VERBRAUCHEN</span><h4>Hähnchen + Brokkoli weiterverwenden</h4><p>Wenn das heutige Abendessen wie geplant läuft, bleiben voraussichtlich <strong>400 g Hähnchen</strong> und <strong>200 g Brokkoli</strong>. Daraus bauen wir morgen erst dann ein exaktes Rezept, wenn die heutigen Mengen bestätigt sind.</p></article>`;
  }

  function inventoryView(data){
    return `<div class="food-section-head-v543"><div><span>VORRATSKÜCHE</span><h3>Was wirklich da ist</h3></div><small>${data.inventory.length} Positionen</small></div><div class="food-inventory-grid-v543">${data.inventory.map(item=>`<article class="food-stock-card-v543 tone-${esc(item.tone)}"><div><h4>${esc(item.name)}</h4><strong>${esc(item.quantity_label)}</strong></div>${item.forecast_label?`<span class="food-forecast-v543">↳ ${esc(item.forecast_label)}</span>`:''}<p>${esc(item.note||'')}</p></article>`).join('')}</div>`;
  }

  function shoppingView(){
    return `<div class="food-section-head-v543"><div><span>EINKAUF</span><h3>Sauberer Neustart</h3></div></div><article class="food-empty-card-v543"><div class="food-empty-icon-v543">✓</div><h4>Der heutige Einkauf ist im Vorrat erfasst.</h4><p>Der Kassenzettel bleibt absichtlich draußen. Preise und Belegimport bauen wir später als eigenen, kontrollierten Schritt – nicht als geratenen Datenmix.</p></article>`;
  }

  function recipesView(data){
    return `<div class="food-section-head-v543"><div><span>REZEPTGARTEN</span><h3>Dein erster Bestand</h3></div><small>4 Rezepte</small></div><div class="food-recipe-grid-v543">${data.meals.map(meal=>`<article class="food-recipe-card-v543"><span>${esc(statusText(meal.status))}</span><h4>${esc(meal.title)}</h4><p>${meal.ingredients.map(esc).join(' · ')}</p><div class="food-recipe-fit-v543">${meal.status==='planned'?'Bestand passt · Mengen noch nicht gebucht':'Heute verwendet'}</div></article>`).join('')}</div>`;
  }

  function content(data){
    if(activeTab==='today')return mealsView(data);
    if(activeTab==='plan')return planView(data);
    if(activeTab==='inventory')return inventoryView(data);
    if(activeTab==='shopping')return shoppingView();
    return recipesView(data);
  }

  async function render(){
    const root=ensureRoot();
    if(!root)return false;
    root.innerHTML=`${hero()}${nav()}<div class="food-content-v543"><div class="food-loading-v543">FOOD wird gedeckt …</div></div><footer class="food-footer-v543">Physisch bestätigt schlägt Planung · ${VERSION}</footer>`;
    root.querySelectorAll('[data-food-tab]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.foodTab;render();}));
    const data=await load();
    const target=root.querySelector('.food-content-v543');
    if(target)target.innerHTML=content(data);
    return true;
  }

  function open(){
    window.__modAppHubV515?.hide?.();
    document.body.classList.remove('mod-backstage-v530');
    document.body.classList.add(BODY_CLASS);
    document.body.dataset.modAppSurfaceV515='food';
    ensureRoot()?.setAttribute('aria-hidden','false');
    render();
    window.scrollTo?.({top:0,left:0,behavior:'instant'});
    return 'food';
  }

  function close(){
    document.body.classList.remove(BODY_CLASS);
    ensureRoot()?.setAttribute('aria-hidden','true');
  }

  function patchHub(){
    const hub=window.__modAppHubV515;
    if(hub&&!hub.__foodPatchedV543){
      const originalShow=hub.show?.bind(hub);
      hub.show=function(){close();return originalShow?.();};
      hub.__foodPatchedV543=true;
      hub.foodReserved=false;
      hub.foodActiveV543=true;
    }
    const launcher=window.__modHubLauncherV517||window.__modHubLauncherV540;
    const item=launcher?.modules?.find?.(entry=>entry.id==='food');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="food"]').forEach(button=>{
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Food öffnen');
    });
  }

  document.addEventListener('click',event=>{
    const foodButton=event.target?.closest?.('[data-mod-hub-launch-v517="food"],[data-mod-hub-open="food"]');
    if(!foodButton)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  },true);

  const observer=new MutationObserver(patchHub);
  function init(){ensureRoot()?.setAttribute('aria-hidden','true');patchHub();observer.observe(document.documentElement,{subtree:true,childList:true});}
  window.__modFoodV543={version:VERSION,open,close,render,reload(){loadPromise=null;return render();},fallbackData:fallback,planningDoesNotConsume:true,receiptExcluded:true};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

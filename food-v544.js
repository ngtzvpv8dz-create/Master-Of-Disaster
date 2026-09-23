/* V544 · FOOD
   Bedienung: Geplant/Erledigt, belastbare Bestandsbuchung, 14-Tage-Plan,
   editierbarer Vorrat, Einkaufslücken und einplanbare Rezepte.
*/
(function(){
  'use strict';
  if(window.__modFoodV544)return;

  const VERSION='V625';
  const ROOT_ID='modFoodV544';
  const BODY_CLASS='mod-food-v544';
  const SURFACE_CLASS='mod-food-surface-v544';
  const TABS=['today','plan','inventory','shopping','recipes'];
  const LABELS={today:'Heute',plan:'Plan',inventory:'Vorrat',shopping:'Einkauf',recipes:'Rezepte'};
  const MEAL_LABELS={breakfast:'Frühstück',snack:'Snack',lunch:'Mittag',dinner:'Abendessen'};
  const RECIPE_GROUP_LABELS={breakfast:'Frühstück',snack:'Snacks',lunch:'Mittag / Arbeit',dinner:'Abendessen'};
  const MEAL_ICONS={breakfast:'☀',snack:'●',lunch:'◒',dinner:'☾'};
  let activeTab='today';
  let loadPromise=null;
  let renderSerial=0;
  let state=null;
  const REQUEST_TIMEOUT_MS=3500;
  const SOURCE_KEYS=['meals','inventory','recipes','shopping','leftovers'];
  let sourceState=Object.fromEntries(SOURCE_KEYS.map(key=>[key,'unknown']));
  let cloudIssues=[];
  const cardArcs=new Map();
  const expandedRecipes=new Set();
  const expandedMeals=new Set();

  function decorateCards(root){
    root.querySelectorAll('.food-meal-card-v544,.food-stock-card-v544,.food-recipe-card-v544,.food-empty-card-v544,.food-shopping-list-v544>li').forEach((card,index)=>{
      const key=activeTab+':'+(card.querySelector('h4,strong')?.textContent||index);
      if(!cardArcs.has(key)){
        const count=1+Math.floor(Math.random()*3);
        const edges=['top:left','top:right','bottom:left','bottom:right'].sort(()=>Math.random()-.5);
        cardArcs.set(key,Array.from({length:count},(_,i)=>{
          const [vertical,horizontal]=edges[i].split(':');
          const size=90+Math.floor(Math.random()*100);
          return '<i aria-hidden="true" class="food-arc-v545" style="width:'+size+'px;height:'+Math.round(size*(.7+Math.random()*.5))+'px;'+vertical+':-'+Math.round(size*.6)+'px;'+horizontal+':-'+Math.round(size*.4)+'px;transform:rotate('+Math.floor(Math.random()*180)+'deg)"></i>';
        }).join(''));
      }
      card.insertAdjacentHTML('afterbegin',cardArcs.get(key));
    });
  }

  const todayIso=()=>{
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  };
  const plusDays=(iso,days)=>{
    const date=new Date(iso+'T12:00:00');
    date.setDate(date.getDate()+days);
    return date.toISOString().slice(0,10);
  };
  const fmtDate=iso=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(iso+'T12:00:00'));
  const fmtDay=iso=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long',timeZone:'Europe/Berlin'}).format(new Date(iso+'T12:00:00'));
  const fmtPreparedAt=value=>{
    if(!value)return 'Zubereitet';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return 'Zubereitet';
    return 'Zubereitet am '+new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(date);
  };
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const num=value=>value===null||value===undefined||value===''?null:Number(value);
  const fmtQty=(value,unit)=>{
    const n=num(value);
    if(n===null||Number.isNaN(n))return 'Menge offen';
    const text=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
    const singular=Math.abs(n-1)<.0001;
    const plurals={
      Zehe:'Zehen',
      Knolle:'Knollen',
      Scheibe:'Scheiben',
      Portion:'Portionen',
      Packung:'Packungen',
      Glas:'Gläser'
    };
    let displayUnit=unit||'';
    if(!singular&&plurals[unit])displayUnit=plurals[unit];
    return displayUnit?text+' '+displayUnit:text;
  };
  const normalizedStatus=status=>status==='consumed'||status==='prepared'?'completed':status==='completed'?'completed':'planned';
  const portionLabel=value=>{
    const n=num(value);
    if(n===null||Number.isNaN(n))return 'Portion offen';
    const text=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
    return text+' '+(Math.abs(n-1)<.0001?'Portion':'Portionen');
  };
  const ingredientName=item=>String(item?.name||item?.label||'Zutat').trim();
  const ingredientDisplay=item=>{
    const q=num(item?.quantity);
    if(q===null||Number.isNaN(q))return ingredientName(item);
    return fmtQty(q,item?.unit)+' '+ingredientName(item);
  };
  const recipeInstructions=recipe=>String(recipe?.instructions||'').split(/\s*\|\s*|\n+/).map(line=>line.trim().replace(/^\s*(?:\d+[.)]|[-•])\s*/,'' )).filter(Boolean);
  const mealTypeOptions=selected=>['breakfast','snack','lunch','dinner'].map(type=>'<option value="'+type+'" '+(type===selected?'selected':'')+'>'+esc(MEAL_LABELS[type])+'</option>').join('');
  const statusLabel=status=>normalizedStatus(status)==='completed'?'Erledigt':'Geplant';
  const priorityLabel=value=>({tomorrow:'Morgen verwenden',three_days:'In den nächsten 3 Tagen',later:'Hält sich länger'}[value]||'Keine Priorität');

  const fallback={
    meals:[
      {id:'breakfast',meal_date:todayIso(),meal_type:'breakfast',title:'Skyr-Bananen-Bowl',status:'completed',sort_order:1,recipe_id:null,ingredients:[
        {label:'250 g Skyr Natur',quantity:250,unit:'g',inventory_id:null},
        {label:'1 Banane',quantity:1,unit:'Stück',inventory_id:null},
        {label:'3 EL zarte Haferflocken',quantity:3,unit:'EL',inventory_id:null}
      ]},
      {id:'snack',meal_date:todayIso(),meal_type:'snack',title:'Apfel & Mandeln',status:'planned',sort_order:2,recipe_id:null,ingredients:[
        {label:'1 Apfel',quantity:1,unit:'Stück',inventory_id:null},
        {label:'25 g Mandeln naturbelassen',quantity:25,unit:'g',inventory_id:null}
      ]},
      {id:'lunch',meal_date:todayIso(),meal_type:'lunch',title:'Roggenbrot mit Pute & Gurke',status:'completed',sort_order:3,recipe_id:null,ingredients:[
        {label:'2 Scheiben Roggen-Vollkornbrot · 111 g',quantity:111,unit:'g',inventory_id:null},
        {label:'100 g Putenbrust-Aufschnitt',quantity:100,unit:'g',inventory_id:null},
        {label:'30 g Frischkäse Balance',quantity:30,unit:'g',inventory_id:null},
        {label:'118 g Gurke auf dem Brot',quantity:118,unit:'g',inventory_id:null},
        {label:'106 g Tomaten separat',quantity:106,unit:'g',inventory_id:null}
      ]},
      {id:'dinner',meal_date:todayIso(),meal_type:'dinner',title:'Hähnchen, Kartoffeln & Brokkoli',status:'planned',sort_order:4,recipe_id:null,ingredients:[
        {label:'200 g Hähnchenbrust',quantity:200,unit:'g',inventory_id:null},
        {label:'300 g Kartoffeln',quantity:300,unit:'g',inventory_id:null},
        {label:'300 g Brokkoli',quantity:300,unit:'g',inventory_id:null},
        {label:'2–3 EL Magerquark als Dip',quantity:null,unit:'EL',inventory_id:null}
      ]}
    ],
    inventory:[
      {id:'cucumber',name:'Gurke',quantity:324,unit:'g',quantity_label:'324 g',forecast_label:null,tone:'fresh',note:'442 g gewogen',opened:false,use_priority:'three_days',is_active:true},
      {id:'tomatoes',name:'Tomaten · Fruchtig & Süß',quantity:394,unit:'g',quantity_label:'394 g',forecast_label:null,tone:'fresh',note:'500-g-Packung',opened:false,use_priority:'three_days',is_active:true},
      {id:'broccoli',name:'Brokkoli',quantity:500,unit:'g',quantity_label:'500 g',forecast_label:'200 g nach dem Abendessen',tone:'priority',note:'Noch unangebrochen · morgen zuerst verwenden',opened:false,use_priority:'tomorrow',is_active:true},
      {id:'chicken',name:'Hähnchenbrustfilet',quantity:600,unit:'g',quantity_label:'600 g',forecast_label:'400 g nach dem Abendessen',tone:'priority',note:'Noch unangebrochen · morgen zuerst verwenden',opened:false,use_priority:'tomorrow',is_active:true},
      {id:'potatoes',name:'Kartoffeln',quantity:2500,unit:'g',quantity_label:'2.500 g',forecast_label:'2.200 g nach dem Abendessen',tone:'stock',note:'2.500 g Ausgangsbestand',opened:false,use_priority:'later',is_active:true},
      {id:'skyr',name:'Skyr Natur',quantity:250,unit:'g',quantity_label:'250 g',forecast_label:null,tone:'priority',note:null,opened:true,use_priority:'tomorrow',is_active:true},
      {id:'cream',name:'Frischkäse Balance',quantity:270,unit:'g',quantity_label:'270 g',forecast_label:null,tone:'priority',note:null,opened:true,use_priority:'tomorrow',is_active:true},
      {id:'quark',name:'Magerquark',quantity:250,unit:'g',quantity_label:'250 g',forecast_label:null,tone:'stock',note:'Dip-Menge noch offen',opened:false,use_priority:'later',is_active:true},
      {id:'bread',name:'Roggen-Vollkornbrot',quantity:389,unit:'g',quantity_label:'ca. 389 g · 7 Scheiben',forecast_label:null,tone:'priority',note:'500 g / 9 Scheiben',opened:true,use_priority:'tomorrow',is_active:true},
      {id:'turkey',name:'Putenbrust-Aufschnitt',quantity:0,unit:'g',quantity_label:'0 g',forecast_label:null,tone:'empty',note:'100-g-Packung verwendet',opened:false,use_priority:'later',is_active:true},
      {id:'bananas',name:'Bananen',quantity:4,unit:'Stück',quantity_label:'4 Stück',forecast_label:null,tone:'fresh',note:'5 Stück Ausgangsbestand',opened:false,use_priority:'later',is_active:true},
      {id:'apples',name:'Granny Smith',quantity:8,unit:'Stück',quantity_label:'8 Stück',forecast_label:'7 nach dem Snack',tone:'stock',note:null,opened:false,use_priority:'later',is_active:true},
      {id:'almonds',name:'Mandeln naturbelassen',quantity:200,unit:'g',quantity_label:'200 g',forecast_label:'175 g nach dem Snack',tone:'stock',note:null,opened:false,use_priority:'later',is_active:true},
      {id:'oats',name:'Zarte Haferflocken',quantity:null,unit:'g',quantity_label:'Rest nicht grammgenau',forecast_label:null,tone:'stock',note:'500-g-Packung',opened:true,use_priority:'later',is_active:true},
      {id:'mince',name:'Hackfleisch gemischt',quantity:800,unit:'g',quantity_label:'800 g',forecast_label:null,tone:'stock',note:null,opened:false,use_priority:'later',is_active:true},
      {id:'pepsi',name:'Pepsi Zero Cherry',quantity:7.5,unit:'l',quantity_label:'6 × 1,25 l',forecast_label:null,tone:'stock',note:'Getränkevorrat',opened:false,use_priority:'later',is_active:true}
    ],
    recipes:[],
    shopping:[],
    leftovers:[]
  };

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-food-root-v544';
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

  function flattenMeals(rows){
    return (rows||[]).map(row=>({
      ...row,
      status:normalizedStatus(row.status),
      ingredients:(row.food_meal_ingredients||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
    }));
  }

  const sourceIsReal=key=>sourceState[key]==='cloud'||sourceState[key]==='stale';

  function withTimeout(promise,label,ms=REQUEST_TIMEOUT_MS){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error(label+' hat zu lange gebraucht.')),ms);
      })
    ]);
  }

  function keepOrFallback(key){
    if(state&&Array.isArray(state[key])&&sourceIsReal(key)){
      sourceState[key]='stale';
      return state[key];
    }
    sourceState[key]='fallback';
    return structuredClone(fallback[key]||[]);
  }

  function unavailableSnapshot(message){
    cloudIssues=[message];
    return Object.fromEntries(SOURCE_KEYS.map(key=>[key,keepOrFallback(key)]));
  }

  async function safeQuery(key,promise){
    try{
      const result=await withTimeout(promise,key);
      if(result?.error)return {data:null,error:result.error};
      return result||{data:[]};
    }catch(error){
      return {data:null,error};
    }
  }

  async function remoteData(){
    const supabase=client();
    if(!supabase)return unavailableSnapshot('Cloud-Verbindung fehlt.');
    let session;
    try{
      session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
    }catch(error){
      console.warn('V548 FOOD Sitzung nicht rechtzeitig verfügbar.',error);
      return unavailableSnapshot('Cloud-Sitzung antwortet gerade nicht.');
    }
    const user=session?.data?.session?.user;
    if(session?.error||!user?.id)return unavailableSnapshot('Cloud-Sitzung ist nicht verfügbar.');

    const results=await Promise.all([
      safeQuery('Mahlzeiten',supabase.from('food_meals').select('id,meal_date,meal_type,title,status,sort_order,note,recipe_id,prepared_servings,eaten_servings,leftover_id,prepared_at,food_meal_ingredients(id,name,label,quantity,unit,quantity_confirmed,sort_order,inventory_id)').gte('meal_date',todayIso()).lte('meal_date',plusDays(todayIso(),14)).order('meal_date').order('sort_order')),
      safeQuery('Vorrat',supabase.from('food_inventory_overview').select('id,name,quantity,unit,quantity_label,forecast_label,tone,note,sort_order,is_active,opened,use_priority,pending_weighing').order('sort_order')),
      safeQuery('Rezepte',supabase.from('food_recipes').select('id,title,meal_type,description,servings,prep_minutes,difficulty,instructions,display_note,calories_kcal_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,food_recipe_ingredients(id,name,label,quantity,unit,sort_order,inventory_id)').eq('active',true).order('title')),
      safeQuery('Einkauf',supabase.from('food_shopping_items').select('id,label,quantity,unit,checked,created_at').order('created_at')),
      safeQuery('Restportionen',supabase.from('food_leftovers').select('id,recipe_id,source_meal_id,available_servings,original_servings,status,note,created_at,food_recipes(title,meal_type)').eq('status','available').gt('available_servings',0).order('created_at',{ascending:false}))
    ]);

    cloudIssues=[];
    function take(key,index,transform){
      const result=results[index];
      if(!result?.error){
        sourceState[key]='cloud';
        return transform(result.data||[]);
      }
      console.warn('V548 FOOD '+key+' nicht aktualisiert.',result.error);
      cloudIssues.push(key+': '+(result.error?.message||'Cloud-Anfrage fehlgeschlagen'));
      return keepOrFallback(key);
    }

    return {
      meals:take('meals',0,flattenMeals),
      inventory:take('inventory',1,rows=>rows),
      recipes:take('recipes',2,rows=>rows),
      shopping:take('shopping',3,rows=>rows),
      leftovers:take('leftovers',4,rows=>rows)
    };
  }

  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=remoteData().catch(error=>{
      console.warn('V548 FOOD Cloud-Daten nicht erreichbar.',error);
      return unavailableSnapshot(error?.message||'Cloud-Daten konnten nicht geladen werden.');
    });
    state=await loadPromise;
    return state;
  }

  function cloudNotice(){
    if(!cloudIssues.length)return '';
    const fallbackActive=SOURCE_KEYS.some(key=>sourceState[key]==='fallback');
    const text=fallbackActive
      ?'Mindestens ein Bereich zeigt gerade nur die Notfallansicht. Änderungen daran sind gesperrt, damit keine falschen IDs gespeichert werden.'
      :'Die Cloud war langsam. Die zuletzt bestätigten Daten bleiben sichtbar und können erneut synchronisiert werden.';
    return '<div class="food-cloud-warning-v548" role="status"><div><strong>Cloud hakt gerade</strong><span>'+esc(text)+'</span></div><button type="button" data-food-retry>Erneut laden</button></div>';
  }

  function shell(){
    return '<div class="food-hero-v544"><div><span class="food-kicker-v544">TAGESKÜCHE</span><h2>Was ist heute dran?</h2><p>Dein Plan, dein Vorrat und die nächsten Mahlzeiten – klar getrennt und direkt bedienbar.</p></div><div class="food-date-v544"><strong>'+new Date().getDate()+'</strong><span>'+new Intl.DateTimeFormat('de-DE',{month:'short',timeZone:'Europe/Berlin'}).format(new Date()).replace('.','').toUpperCase()+'</span></div></div>'+
      '<nav class="food-nav-v544" aria-label="FOOD Bereiche">'+TABS.map(tab=>'<button type="button" data-food-tab="'+tab+'" class="'+(tab===activeTab?'active':'')+'" aria-pressed="'+(tab===activeTab)+'">'+LABELS[tab]+'</button>').join('')+'</nav>'+
      '<div class="food-content-v544"><div class="food-loading-v544">FOOD wird gedeckt …</div></div>';
  }

  function recipePresentation(recipe,expanded){
    const items=recipe.food_recipe_ingredients||recipe.ingredients||[];
    const servings=Math.max(1,Number(recipe.servings)||1);
    const instructions=recipeInstructions(recipe);
    const nutrition=[
      num(recipe.calories_kcal_per_serving)!==null?Math.round(Number(recipe.calories_kcal_per_serving))+' kcal':null,
      num(recipe.protein_g_per_serving)!==null?fmtQty(recipe.protein_g_per_serving,'g')+' Protein':null
    ].filter(Boolean).join(' · ');
    const details=expanded
      ?'<div class="food-recipe-details-v572"><div class="food-recipe-detail-block-v572"><strong>Zutaten für '+esc(portionLabel(servings))+'</strong><ul>'+items.map(item=>{const q=num(item.quantity);return '<li><span>'+esc(ingredientName(item))+'</span>'+(q===null||Number.isNaN(q)?'':'<b>'+esc(fmtQty(q,item.unit))+'</b>')+'</li>';}).join('')+'</ul></div><div class="food-recipe-detail-block-v572"><strong>Zubereitung</strong>'+(instructions.length?'<ol>'+instructions.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>':'<p>Noch keine Zubereitung hinterlegt.</p>')+'</div>'+(recipe.description?'<p class="food-recipe-note-v572">'+esc(recipe.description)+'</p>':'')+'</div>'
      :'';
    const meta=[portionLabel(servings),recipe.prep_minutes?recipe.prep_minutes+' Min.':null,nutrition||null].filter(Boolean).join(' · ');
    return {details,meta};
  }

  function mealPlanMeta(meal){
    const prepared=Math.max(.01,Number(meal.prepared_servings)||1);
    const eaten=Math.max(.01,Number(meal.eaten_servings)||prepared);
    const rest=Math.max(0,prepared-eaten);
    const isToday=meal.meal_date===todayIso();
    if(meal.leftover_id)return portionLabel(eaten)+' aus Resten geplant';
    if(rest>0){
      return isToday
        ?portionLabel(prepared)+' geplant · '+portionLabel(eaten)+' heute · '+portionLabel(rest)+' für morgen'
        :portionLabel(prepared)+' geplant · '+portionLabel(eaten)+' an diesem Tag · '+portionLabel(rest)+' als Rest';
    }
    return portionLabel(eaten)+' geplant';
  }

  function mealCard(meal){
    const status=normalizedStatus(meal.status);
    const expanded=expandedMeals.has(String(meal.id));
    const recipe=meal.recipe_id?(state?.recipes||[]).find(item=>String(item.id)===String(meal.recipe_id)):null;
    const action=status==='completed'?'':'<button type="button" class="food-action-v544 food-meal-complete-v573" data-food-complete="'+esc(meal.id)+'">Als zubereitet markieren</button>';
    const statusMeta=status==='completed'?fmtPreparedAt(meal.prepared_at):'Geplant';

    if(recipe){
      const view=recipePresentation(recipe,expanded);
      return '<article class="food-recipe-card-v544 '+(expanded?'is-expanded-v572':'')+'" data-food-meal-card="'+esc(meal.id)+'">'
        +'<button type="button" class="food-recipe-toggle-v572" data-food-meal-toggle="'+esc(meal.id)+'" aria-expanded="'+expanded+'">'
          +'<span><small class="food-recipe-type-v544">'+esc(MEAL_LABELS[recipe.meal_type]||recipe.meal_type)+'</small><h4>'+esc(recipe.title)+'</h4><em>'+esc(view.meta)+'</em></span>'
          +'<b aria-hidden="true">'+(expanded?'−':'+')+'</b>'
        +'</button>'
        +view.details
        +'<p class="food-meal-plan-note-v581">'+esc(mealPlanMeta(meal)+' · '+statusMeta)+'</p>'
        +action
        +'</article>';
    }

    const items=meal.ingredients||[];
    const portionMeta=mealPlanMeta(meal);
    const editAction=status==='completed'
      ?''
      :'<button type="button" class="food-action-v544 compact" data-food-edit-free-meal="'+esc(meal.id)+'">Zutaten bearbeiten</button>';
    const details=expanded
      ?'<div class="food-recipe-details-v572">'
        +(items.length?'<div class="food-recipe-detail-block-v572"><strong>Zutaten</strong><ul>'+items.map(item=>'<li><span>'+esc(ingredientName(item))+'</span><b>'+esc(fmtQty(item.quantity,item.unit))+'</b></li>').join('')+'</ul></div>':'')
        +(meal.note?'<p class="food-recipe-note-v572">'+esc(meal.note)+'</p>':'')
        +(!items.length&&!meal.note?'<p class="food-recipe-note-v572">Für diese Mahlzeit sind keine weiteren Details hinterlegt.</p>':'')
        +(expanded&&editAction?'<div class="food-meal-edit-actions-v618">'+editAction+'</div>':'')
        +'</div>'
      :'';
    return '<article class="food-meal-card-v544 '+(expanded?'is-expanded-v573':'')+' status-'+status+'" data-food-meal-card="'+esc(meal.id)+'">'
      +'<button type="button" class="food-meal-toggle-v573" data-food-meal-toggle="'+esc(meal.id)+'" aria-expanded="'+expanded+'">'
        +'<span><small class="food-recipe-type-v544">'+esc(MEAL_LABELS[meal.meal_type]||meal.meal_type)+'</small><h4>'+esc(meal.title)+'</h4><em>'+esc(portionMeta+' · '+statusMeta)+'</em></span>'
        +'<b aria-hidden="true">'+(expanded?'−':'+')+'</b>'
      +'</button>'
      +details+action
      +'</article>';
  }

  function todayView(data){
    const meals=data.meals.filter(meal=>meal.meal_date===todayIso()).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    return '<div class="food-section-head-v544"><div><span>HEUTE</span><h3>Dein Tagesplan</h3></div><small>'+meals.length+' Mahlzeiten</small></div>'+
      (meals.length?'<div class="food-meal-list-v544">'+meals.map(mealCard).join('')+'</div>':'<div class="food-empty-card-v544"><h4>Heute ist noch nichts eingeplant.</h4><p>Ein Rezept kann direkt aus dem Rezeptgarten eingeplant werden.</p><button type="button" class="food-action-v544" data-food-jump="recipes">Rezepte öffnen</button></div>');
  }

  function planView(data){
    const future=data.meals.filter(meal=>meal.meal_date>todayIso()).sort((a,b)=>(a.meal_date+a.sort_order).localeCompare(b.meal_date+b.sort_order));
    const groups=[];
    future.forEach(meal=>{let group=groups.find(item=>item.date===meal.meal_date);if(!group){group={date:meal.meal_date,meals:[]};groups.push(group);}group.meals.push(meal);});
    const priority=data.inventory.filter(item=>item.is_active!==false&&item.use_priority==='tomorrow');
    const leftovers=(data.leftovers||[]).filter(item=>Number(item.available_servings)>0);
    const leftoverBlock=leftovers.length
      ?'<section class="food-leftovers-v572"><div class="food-leftovers-head-v572"><strong>Restportionen</strong><span>'+leftovers.length+' verfügbar</span></div><div class="food-leftovers-grid-v572">'+leftovers.map(item=>{const recipe=item.food_recipes||{};return '<article><div><small>'+esc(MEAL_LABELS[recipe.meal_type]||'RESTE')+'</small><strong>'+esc(recipe.title||'Restportion')+'</strong><span>'+esc(portionLabel(item.available_servings))+' verfügbar</span></div><button type="button" class="food-action-v544 compact" data-food-schedule-leftover="'+esc(item.id)+'">Einplanen</button></article>';}).join('')+'</div></section>'
      :'';
    return '<div class="food-section-head-v544"><div><span>PLAN</span><h3>Die nächsten 14 Tage</h3></div><small>Heute bleibt bei Heute</small></div>'+
      '<div class="food-priority-strip-v544"><strong>Als Nächstes im Blick</strong><span>'+esc(priority.map(item=>item.name).join(' · ')||'Noch keine Prioritäten')+'</span></div>'+
      leftoverBlock+
      (groups.length?groups.map(group=>'<section class="food-day-group-v544"><div class="food-day-label-v544"><strong>'+esc(fmtDay(group.date))+'</strong><span>'+esc(fmtDate(group.date))+'</span></div><div class="food-meal-list-v544">'+group.meals.map(mealCard).join('')+'</div></section>').join(''):'<div class="food-empty-card-v544"><h4>Noch kein weiterer Tag geplant.</h4><p>Wähle bei einem Rezept „Einplanen“, dann landet es hier – mit dem Vorrat abgeglichen.</p><button type="button" class="food-action-v544" data-food-jump="recipes">Rezept einplanen</button></div>');
  }

  function inventoryCard(item){
    const baseQuantity=(item.unit==='Zehe'||item.unit==='Knolle')?fmtQty(item.quantity,item.unit):(item.quantity_label||fmtQty(item.quantity,item.unit));
    const pending=item.pending_weighing===true;
    const known=num(item.quantity);
    const quantity=pending
      ?((known!==null&&known>0)?baseQuantity+' + Einkauf noch abwiegen':'Einkauf noch abwiegen')
      :baseQuantity;
    const forecast=item.forecast_label?'<span class="food-forecast-v544">↳ '+esc(item.forecast_label)+'</span>':'';
    const priority=item.use_priority&&item.use_priority!=='later'?'<span class="food-priority-v544">'+esc(priorityLabel(item.use_priority))+'</span>':'';
    const weighing=pending?'<span class="food-weigh-pending-v625">⚖ Menge noch offen</span>':'';
    const tomorrowClass=item.use_priority==='tomorrow'&&Number(item.quantity)!==0?' priority-tomorrow-v574':'';
    const weighAction=pending?'<button type="button" data-food-weigh="'+esc(item.id)+'">Jetzt abwiegen</button>':'';
    return '<article class="food-stock-card-v544 tone-'+esc(item.tone||'stock')+tomorrowClass+'"><div class="food-stock-top-v544"><div><h4>'+esc(item.name)+'</h4><strong>'+esc(quantity)+'</strong></div><span class="food-stock-open-v544">'+(item.opened?'angebrochen':'unangebrochen')+'</span></div>'+weighing+priority+forecast+'<p>'+esc(item.note||'')+'</p><div class="food-stock-actions-v544"><button type="button" data-food-adjust="'+esc(item.id)+'">Menge ändern</button>'+weighAction+'<button type="button" data-food-archive="'+esc(item.id)+'">Entfernen</button></div></article>';
  }

  function garlicParts(data=state){
    const rows=(data?.inventory||[]).filter(item=>item.is_active!==false);
    const bulb=rows.find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')==='knoblauchknollen'&&String(item.unit||'')==='Knolle')||null;
    const clove=rows.find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')==='knoblauchzehen'&&String(item.unit||'')==='Zehe')||null;
    return {bulb,clove,bulbs:Math.max(0,num(bulb?.quantity)||0),cloves:Math.max(0,num(clove?.quantity)||0)};
  }

  function garlicCard(data){
    const garlic=garlicParts(data);
    if(!garlic.bulb&&!garlic.clove)return '';
    const quantity=fmtQty(garlic.bulbs,'Knolle')+' · '+fmtQty(garlic.cloves,'Zehe');
    const tone=garlic.bulbs>0||garlic.cloves>0?'stock':'empty';
    const open=garlic.bulb&&garlic.bulbs>0?'<button type="button" data-food-open-garlic="'+esc(garlic.bulb.id)+'">Knolle öffnen</button>':'';
    return '<article class="food-stock-card-v544 tone-'+tone+'"><div class="food-stock-top-v544"><div><h4>Knoblauch</h4><strong>'+esc(quantity)+'</strong></div><span class="food-stock-open-v544">kombiniert</span></div><p>Ganze Knollen und lose Zehen in einem Vorratseintrag.</p><div class="food-stock-actions-v544"><button type="button" data-food-garlic-adjust>Menge ändern</button>'+open+'</div></article>';
  }

  function inventoryView(data){
    const regular=data.inventory.filter(item=>{
      const name=String(item.name||'').trim().toLocaleLowerCase('de-DE');
      return name!=='knoblauchknollen'&&name!=='knoblauchzehen';
    });
    const cards=garlicCard(data)+regular.map(inventoryCard).join('');
    return '<div class="food-section-head-v544"><div><span>VORRAT</span><h3>Was wirklich da ist</h3></div><button type="button" class="food-action-v544 compact" data-food-add-inventory>+ Vorrat</button></div><div class="food-inventory-grid-v544">'+(cards||'<div class="food-empty-card-v544"><h4>Der Vorrat ist leer.</h4></div>')+'</div>';
  }

  function deriveShopping(data){
    const needs=new Map();
    data.meals.filter(meal=>normalizedStatus(meal.status)==='planned').forEach(meal=>(meal.ingredients||[]).forEach(item=>{
      const quantity=num(item.quantity);
      if(quantity===null||quantity<=0)return;
      const name=ingredientName(item);
      const unit=String(item.unit||'').trim();
      const key=item.inventory_id?'stock|'+item.inventory_id+'|'+unit:'free|'+name.toLocaleLowerCase('de-DE')+'|'+unit.toLocaleLowerCase('de-DE');
      const current=needs.get(key)||{inventory_id:item.inventory_id||null,label:name,unit,required:0};
      current.required+=quantity;
      needs.set(key,current);
    }));
    const inventoryById=new Map(data.inventory.map(item=>[item.id,item]));
    const inventoryByName=new Map(data.inventory.filter(item=>item.is_active!==false).map(item=>[String(item.name||'').trim().toLocaleLowerCase('de-DE'),item]));
    const gaps=[];
    needs.forEach(need=>{
      const normalizedNeed=String(need.label||'').trim().toLocaleLowerCase('de-DE');
      if(normalizedNeed==='knoblauchzehen'){
        const cloveStock=inventoryByName.get('knoblauchzehen');
        const bulbStock=inventoryByName.get('knoblauchknollen');
        const cloveQty=String(cloveStock?.unit||'')==='Zehe'?num(cloveStock?.quantity):0;
        const available=cloveQty===null?0:Math.max(0,cloveQty||0);
        const missing=Math.max(0,need.required-available);
        const bulbsAvailable=String(bulbStock?.unit||'')==='Knolle'?Math.max(0,num(bulbStock?.quantity)||0):0;
        if(missing>0&&bulbsAvailable<=0){
          gaps.push({...need,inventory_id:null,available,missing,label:'Knoblauchzehen',garlic:true,purchaseInventoryId:bulbStock?.id||null,purchaseName:'Knoblauchknollen',purchaseQuantity:1,purchaseUnit:'Knolle'});
        }
        return;
      }
      const stock=need.inventory_id
        ?inventoryById.get(need.inventory_id)
        :inventoryByName.get(normalizedNeed);
      const sameUnit=!stock||String(stock.unit||'')===String(need.unit||'');
      if(stock?.pending_weighing===true&&sameUnit)return;
      const stockQty=sameUnit?num(stock?.quantity):0;
      const available=stockQty===null?0:Math.max(0,stockQty||0);
      const missing=Math.max(0,need.required-available);
      if(missing>0)gaps.push({...need,inventory_id:need.inventory_id||stock?.id||null,available,missing,label:stock?.name||need.label,unitMismatch:!!stock&&!sameUnit});
    });
    return gaps;
  }

  function shoppingView(data){
    const gaps=deriveShopping(data);
    const manual=(data.shopping||[]).filter(item=>!item.checked);
    const inventoryByName=new Map((data.inventory||[]).filter(item=>item.is_active!==false).map(item=>[String(item.name||'').trim().toLocaleLowerCase('de-DE'),item]));
    const planned=gaps.map(item=>{
      const buyText=item.garlic?'Kaufen '+fmtQty(item.purchaseQuantity,item.purchaseUnit):'Kaufen '+fmtQty(item.missing,item.unit);
      const stockName=item.garlic?item.purchaseName:item.label;
      const stockQty=item.garlic?item.purchaseQuantity:item.missing;
      const stockUnit=item.garlic?item.purchaseUnit:item.unit;
      const stockId=item.garlic?item.purchaseInventoryId:item.inventory_id;
      return '<li class="food-shopping-gap-v572"><strong>'+esc(item.label)+'</strong><span><small>Benötigt '+esc(fmtQty(item.required,item.unit))+' · Vorrat '+esc(fmtQty(item.available,item.unit))+'</small><b>'+esc(buyText)+'</b>'+(item.unitMismatch?'<em>Einheit prüfen</em>':'')+'<button type="button" data-food-stock-gap data-food-stock-name="'+esc(stockName)+'" data-food-stock-quantity="'+esc(stockQty)+'" data-food-stock-unit="'+esc(stockUnit||'')+'" data-food-stock-id="'+esc(stockId||'')+'">Vorhanden / eingekauft</button></span></li>';
    }).join('');
    const manualHtml=manual.map(item=>{
      const required=num(item.quantity);
      const unit=String(item.unit||'').trim();
      if(required===null||required<=0||!unit){
        return '<li class="manual"><strong>'+esc(item.label)+'</strong><span><button type="button" data-shopping-check="'+esc(item.id)+'" aria-label="'+esc(item.label)+' abhaken">✓ Abhaken</button></span></li>';
      }
      const normalized=String(item.label||'').trim().toLocaleLowerCase('de-DE');
      const stock=inventoryByName.get(normalized);
      const sameUnit=!stock||String(stock.unit||'')===unit;
      if(stock?.pending_weighing===true&&sameUnit)return '';
      const stockQty=sameUnit?num(stock?.quantity):0;
      const available=stockQty===null?0:Math.max(0,stockQty||0);
      const missing=Math.max(0,required-available);
      if(missing<=0)return '';
      return '<li class="food-shopping-gap-v572"><strong>'+esc(item.label)+'</strong><span><small>Benötigt '+esc(fmtQty(required,unit))+' · Vorrat '+esc(fmtQty(available,unit))+'</small><b>Kaufen '+esc(fmtQty(missing,unit))+'</b>'+(stock&&!sameUnit?'<em>Einheit prüfen</em>':'')+'<button type="button" data-food-stock-gap data-food-stock-name="'+esc(item.label)+'" data-food-stock-quantity="'+esc(missing)+'" data-food-stock-unit="'+esc(unit)+'" data-food-stock-id="'+esc(sameUnit?(stock?.id||''):'')+'" data-shopping-id="'+esc(item.id)+'" data-shopping-required="'+esc(required)+'">Vorhanden / eingekauft</button></span></li>';
    }).join('');
    const all=planned+manualHtml;
    return '<div class="food-section-head-v544"><div><span>EINKAUF</span><h3>Was noch fehlt</h3></div><button type="button" class="food-action-v544 compact" data-food-add-shopping>+ Eintrag</button></div>'+
      (all?'<ul class="food-shopping-list-v544">'+all+'</ul>':'<div class="food-empty-card-v544"><div class="food-empty-icon-v544">✓</div><h4>Aus dem aktuellen Plan fehlt gerade nichts.</h4><p>Vorrat und geplante Rezeptmengen decken sich aktuell.</p></div>');
  }

  function stockGapModal(button){
    const name=String(button?.dataset?.foodStockName||'').trim();
    const suggested=Number(button?.dataset?.foodStockQuantity||0);
    const unit=String(button?.dataset?.foodStockUnit||'').trim();
    const inventoryId=String(button?.dataset?.foodStockId||'').trim()||null;
    const shoppingId=String(button?.dataset?.shoppingId||'').trim()||null;
    const shoppingRequired=Number(button?.dataset?.shoppingRequired||0);
    if(!name)return;

    let modal;
    modal=addModal('Vorrat übernehmen','<form><p class="food-modal-copy-v544"><strong>'+esc(name)+'</strong></p><div class="food-form-grid-v544"><label>Menge vorhanden / gekauft<input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(suggested||1)+'" required></label><label>Einheit<input name="unit" value="'+esc(unit||'Stück')+'" required></label></div><label class="food-weigh-later-v625"><input name="weigh_later" type="checkbox"> Menge später abwiegen</label><p class="food-modal-copy-v544">Ideal für lose Ware wie Zucchini, Paprika oder Obst. Der Einkauf gilt dann als erledigt, das echte Gewicht trägst du zuhause nach.</p><button class="food-action-v544" type="submit">In Vorrat übernehmen</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Nicht angemeldet.');

      const weighLater=form.get('weigh_later')==='on';
      const quantity=Number(form.get('quantity'));
      const chosenUnit=String(form.get('unit')||'').trim();
      if(!weighLater&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Bitte eine gültige Menge eingeben.');
      if(!chosenUnit)throw new Error('Bitte eine Einheit eingeben.');

      let existing=inventoryId
        ?(state?.inventory||[]).find(item=>String(item.id)===String(inventoryId))
        :(state?.inventory||[]).find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE'));

      if(!existing){
        const archivedLookup=await supabase
          .from('food_inventory')
          .select('id,name,quantity,unit,is_active,sort_order,pending_weighing')
          .eq('user_id',user.id)
          .eq('name',name)
          .limit(1)
          .maybeSingle();
        if(archivedLookup.error)throw archivedLookup.error;
        if(archivedLookup.data)existing=archivedLookup.data;
      }

      if(weighLater){
        const current=Math.max(0,num(existing?.quantity)||0);
        const hasKnownStock=current>0;
        if(existing&&hasKnownStock&&String(existing.unit||'')!==chosenUnit){
          throw new Error('Der bekannte Vorrat hat eine andere Einheit. Bitte erst die Einheit angleichen.');
        }

        if(existing){
          const pendingUpdate=await supabase.from('food_inventory').update({
            quantity:current,
            unit:hasKnownStock?existing.unit:chosenUnit,
            quantity_label:hasKnownStock?fmtQty(current,existing.unit):'Menge noch offen · abwiegen',
            is_active:true,
            opened:false,
            pending_weighing:true,
            note:'Eingekauft · Menge noch abwiegen',
            tone:hasKnownStock?'stock':'stock',
            forecast_label:null,
            use_priority:'three_days',
            archived_at:null,
            archived_reason:null
          }).eq('id',existing.id);
          if(pendingUpdate.error)throw pendingUpdate.error;
        }else{
          const maxSort=(state?.inventory||[]).reduce((max,item)=>Math.max(max,Number(item.sort_order)||0),0);
          const pendingInsert=await supabase.from('food_inventory').insert({
            user_id:user.id,name,quantity:0,unit:chosenUnit,quantity_label:'Menge noch offen · abwiegen',
            forecast_label:null,tone:'stock',note:'Eingekauft · Menge noch abwiegen',sort_order:maxSort+1,
            opened:false,use_priority:'three_days',is_active:true,pending_weighing:true
          });
          if(pendingInsert.error)throw pendingInsert.error;
        }

        if(shoppingId){
          const check=await supabase.from('food_shopping_items').update({checked:true}).eq('id',shoppingId);
          if(check.error)throw check.error;
        }
        await mutate(()=>true);
        return;
      }

      let quantityAfter=quantity;
      if(existing){
        const current=num(existing.quantity);
        const isInactive=existing.is_active===false;
        const unitMatches=String(existing.unit||'')===chosenUnit;

        if(!unitMatches&&!isInactive){
          throw new Error('Die Einheit passt nicht zum vorhandenen Vorrat.');
        }
        if(!unitMatches&&!((current===null?0:current)<=0)){
          throw new Error('Der alte Vorrat hat noch eine Menge in einer anderen Einheit.');
        }

        if(isInactive){
          const newQuantity=(current===null?0:current)+quantity;
          const revive=await supabase.from('food_inventory').update({
            quantity:newQuantity,
            unit:chosenUnit,
            quantity_label:fmtQty(newQuantity,chosenUnit),
            is_active:true,
            opened:false,
            tone:'stock',
            forecast_label:null,
            use_priority:'later',
            pending_weighing:false,
            note:null,
            archived_at:null,
            archived_reason:null
          }).eq('id',existing.id);
          if(revive.error)throw revive.error;
          quantityAfter=newQuantity;
        }else{
          const newQuantity=(current===null?0:current)+quantity;
          const result=await supabase.rpc('adjust_food_inventory',{p_inventory_id:existing.id,p_new_quantity:newQuantity,p_reason:'Vorrat vorhanden / eingekauft',p_note:null});
          if(result.error)throw result.error;
          const clearPending=await supabase.from('food_inventory').update({pending_weighing:false,note:null}).eq('id',existing.id);
          if(clearPending.error)throw clearPending.error;
          quantityAfter=newQuantity;
        }
      }else{
        const maxSort=(state?.inventory||[]).reduce((max,item)=>Math.max(max,Number(item.sort_order)||0),0);
        const result=await supabase.from('food_inventory').insert({
          user_id:user.id,name,quantity,unit:chosenUnit,quantity_label:fmtQty(quantity,chosenUnit),
          forecast_label:null,tone:'stock',note:null,sort_order:maxSort+1,opened:false,use_priority:'later',is_active:true,pending_weighing:false
        });
        if(result.error)throw result.error;
      }
      if(shoppingId&&shoppingRequired>0&&quantityAfter>=shoppingRequired){
        const check=await supabase.from('food_shopping_items').update({checked:true}).eq('id',shoppingId);
        if(check.error)throw check.error;
      }
      await mutate(()=>true);
    });

    const weighBox=modal?.querySelector('[name="weigh_later"]');
    const quantityInput=modal?.querySelector('[name="quantity"]');
    const syncWeighLater=()=>{
      const pending=weighBox?.checked===true;
      if(quantityInput){
        quantityInput.disabled=pending;
        quantityInput.required=!pending;
      }
    };
    weighBox?.addEventListener('change',syncWeighLater);
    syncWeighLater();
  }

  function openGarlicModal(id){
    const item=(state?.inventory||[]).find(row=>String(row.id)===String(id));
    if(!item)return;
    addModal('Knoblauchknolle öffnen','<form><p class="food-modal-copy-v544">Wie viele Zehen sind in dieser Knolle? Die App zieht 1 Knolle ab und legt genau diese Anzahl als Knoblauchzehen an.</p><label>Zehen in dieser Knolle<input name="cloves" type="number" min="1" step="1" inputmode="numeric" required></label><button class="food-action-v544" type="submit">Knolle in Zehen umwandeln</button></form>',async form=>{
      const cloves=Number(form.get('cloves'));
      if(!Number.isInteger(cloves)||cloves<1)throw new Error('Bitte die tatsächliche Zahl der Zehen eintragen.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('open_food_garlic_bulb',{p_bulb_inventory_id:id,p_cloves:cloves});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function recipeCard(recipe){
    const expanded=expandedRecipes.has(String(recipe.id));
    const view=recipePresentation(recipe,expanded);
    return '<article class="food-recipe-card-v544 '+(expanded?'is-expanded-v572':'')+'" data-food-recipe-card="'+esc(recipe.id)+'"><button type="button" class="food-recipe-toggle-v572" data-food-recipe-toggle="'+esc(recipe.id)+'" aria-expanded="'+expanded+'"><span><small class="food-recipe-type-v544">'+esc(MEAL_LABELS[recipe.meal_type]||recipe.meal_type)+'</small><h4>'+esc(recipe.title)+'</h4><em>'+esc(view.meta)+'</em></span><b aria-hidden="true">'+(expanded?'−':'+')+'</b></button>'+view.details+'<div class="food-recipe-actions-v582"><button type="button" class="food-action-v544 compact" data-food-edit-recipe="'+esc(recipe.id)+'">Bearbeiten</button><button type="button" class="food-action-v544 food-recipe-plan-v572" data-food-schedule="'+esc(recipe.id)+'">Einplanen</button></div></article>';
  }

  function recipesView(data){
    const recipes=data.recipes.length?data.recipes:data.meals.map(meal=>({id:meal.id,title:meal.title,meal_type:meal.meal_type,ingredients:meal.ingredients}));
    const order=['breakfast','snack','lunch','dinner'];
    const groups=order.map(type=>({
      type,
      label:RECIPE_GROUP_LABELS[type]||MEAL_LABELS[type]||type,
      recipes:recipes.filter(recipe=>recipe.meal_type===type)
    })).filter(group=>group.recipes.length);
    const uncategorized=recipes.filter(recipe=>!order.includes(recipe.meal_type));
    if(uncategorized.length)groups.push({type:'other',label:'Weitere Rezepte',recipes:uncategorized});
    const sections=groups.map(group=>
      '<section class="food-day-group-v544" data-food-recipe-group="'+esc(group.type)+'">'
        +'<div class="food-day-label-v544"><strong>'+esc(group.label)+'</strong><span>'+group.recipes.length+' '+(group.recipes.length===1?'Rezept':'Rezepte')+'</span></div>'
        +'<div class="food-recipe-grid-v544">'+group.recipes.map(recipeCard).join('')+'</div>'
      +'</section>'
    ).join('');
    return '<div class="food-section-head-v544"><div><span>REZEPTE</span><h3>Nach Mahlzeit sortiert</h3></div><div class="food-section-actions-v549"><small>'+recipes.length+' Rezepte</small><button type="button" class="food-action-v544 compact" data-food-add-recipe>+ Rezept</button></div></div>'
      +(sections||'<div class="food-empty-card-v544"><h4>Noch keine Rezepte gespeichert.</h4><p>Lege dein erstes Rezept an und ordne es direkt einer Mahlzeit zu.</p></div>');
  }

  function content(data){
    if(activeTab==='today')return todayView(data);
    if(activeTab==='plan')return planView(data);
    if(activeTab==='inventory')return inventoryView(data);
    if(activeTab==='shopping')return shoppingView(data);
    return recipesView(data);
  }

  async function mutate(task){
    const result=await task();
    loadPromise=null;
    await render();
    return result;
  }

  async function saveInventoryStorage(id,opened,usePriority){
    const supabase=client();
    if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    let firstError=null;
    try{
      const result=await withTimeout(
        supabase.from('food_inventory')
          .update({opened,use_priority:usePriority})
          .eq('id',id)
          .eq('is_active',true)
          .select('id,opened,use_priority')
          .maybeSingle(),
        'Vorratsstatus speichern',
        8000
      );
      if(!result?.error&&result?.data)return result.data;
      firstError=result?.error||new Error('Die Cloud hat den Speichervorgang nicht bestätigt.');
    }catch(error){
      firstError=error;
    }

    await new Promise(resolve=>setTimeout(resolve,350));
    try{
      const check=await withTimeout(
        supabase.from('food_inventory')
          .select('id,opened,use_priority')
          .eq('id',id)
          .eq('is_active',true)
          .maybeSingle(),
        'Speicherstand prüfen',
        3500
      );
      if(!check?.error&&check?.data&&check.data.opened===opened&&check.data.use_priority===usePriority)return check.data;
      if(!firstError)firstError=check?.error;
    }catch(error){
      if(!firstError)firstError=error;
    }
    throw firstError||new Error('Der neue Vorratsstatus konnte nicht bestätigt werden.');
  }

  async function completeMeal(id){
    const supabase=client();
    if(!supabase){
      const meal=state?.meals.find(item=>item.id===id);
      if(meal){meal.status='completed';meal.prepared_at=new Date().toISOString();}
      return render();
    }
    const result=await supabase.rpc('complete_food_meal',{p_meal_id:id});
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  function addModal(title,body,onSubmit){
    const root=ensureRoot();
    if(!root)return;
    const old=root.querySelector('.food-modal-v544');if(old)old.remove();
    root.insertAdjacentHTML('beforeend','<div class="food-modal-v544" role="dialog" aria-modal="true"><div class="food-modal-card-v544"><div class="food-modal-head-v544"><h3>'+title+'</h3><button type="button" data-food-modal-close aria-label="Schließen">×</button></div>'+body+'</div></div>');
    const modal=root.querySelector('.food-modal-v544');
    modal.querySelector('[data-food-modal-close]')?.addEventListener('click',()=>modal.remove());
    modal.querySelector('form')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const submit=modal.querySelector('button[type="submit"]');
      if(submit)submit.disabled=true;
      try{await onSubmit(new FormData(event.currentTarget));modal.remove();}catch(error){console.error(error);alert(error?.message||'Das konnte nicht gespeichert werden.');if(submit)submit.disabled=false;}
    });
    return modal;
  }

  function recipeNeedPreview(recipe,preparedServings){
    const base=Math.max(.01,Number(recipe?.servings)||1);
    const factor=Math.max(.01,Number(preparedServings)||base)/base;
    const inventoryById=new Map((state?.inventory||[]).map(item=>[item.id,item]));
    const items=recipe?.food_recipe_ingredients||recipe?.ingredients||[];
    if(!items.length)return '<p class="food-recipe-preview-empty-v572">Keine Zutaten hinterlegt.</p>';
    return '<div class="food-recipe-preview-v572">'+items.map(item=>{
      const required=num(item.quantity)===null?null:Number(item.quantity)*factor;
      const stock=item.inventory_id?inventoryById.get(item.inventory_id):null;
      const sameUnit=!stock||String(stock.unit||'')===String(item.unit||'');
      const available=sameUnit&&num(stock?.quantity)!==null?Number(stock.quantity):0;
      const missing=required===null?null:Math.max(0,required-available);
      const stateLabel=required===null?'Menge offen':missing>0?'Kaufen '+fmtQty(missing,item.unit):'Vorrat reicht';
      return '<div><span><strong>'+esc(ingredientName(item))+'</strong><small>Benötigt '+esc(required===null?'offen':fmtQty(required,item.unit))+' · vorhanden '+esc(fmtQty(available,item.unit))+'</small></span><b class="'+(missing>0?'is-missing':'is-ok')+'">'+esc(stateLabel)+'</b></div>';
    }).join('')+'</div>';
  }

  function scheduleModal(recipeId){
    const recipe=(state?.recipes||[]).find(item=>String(item.id)===String(recipeId));
    if(!recipe){alert('Rezept nicht gefunden.');return;}
    const base=Math.max(1,Number(recipe.servings)||1);
    let modal;
    const body='<form><div class="food-form-grid-v544"><label class="food-plan-field-v546">Tag<input name="date" type="date" min="'+todayIso()+'" value="'+plusDays(todayIso(),1)+'" required></label><label class="food-plan-field-v546">Mahlzeit<select name="type">'+mealTypeOptions(recipe.meal_type||'dinner')+'</select></label></div><div class="food-form-grid-v544"><label>Portionen zubereiten<input name="prepared" type="number" min="0.5" max="99" step="0.5" inputmode="decimal" value="'+esc(base)+'" required></label><label>Davon an diesem Tag<input name="eaten" type="number" min="0.5" max="'+esc(base)+'" step="0.5" inputmode="decimal" value="'+esc(base)+'" required></label></div><div class="food-portion-hint-v572" data-food-portion-hint></div><div data-food-recipe-preview>'+recipeNeedPreview(recipe,base)+'</div><button class="food-action-v544" type="submit">In den Plan übernehmen</button></form>';
    modal=addModal('Rezept einplanen',body,async form=>{
      const prepared=Number(form.get('prepared'));
      const eaten=Number(form.get('eaten'));
      if(!Number.isFinite(prepared)||prepared<=0)throw new Error('Bitte eine gültige Zahl zubereiteter Portionen wählen.');
      if(!Number.isFinite(eaten)||eaten<=0||eaten>prepared)throw new Error('Die Portionen für den Tag dürfen nicht größer sein als die zubereitete Menge.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('schedule_food_recipe',{p_recipe_id:recipeId,p_meal_date:form.get('date'),p_meal_type:form.get('type'),p_prepared_servings:prepared,p_eaten_servings:eaten});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
    const preparedInput=modal.querySelector('[name="prepared"]');
    const eatenInput=modal.querySelector('[name="eaten"]');
    const preview=modal.querySelector('[data-food-recipe-preview]');
    const hint=modal.querySelector('[data-food-portion-hint]');
    const sync=()=>{
      const prepared=Math.max(.5,Number(preparedInput.value)||base);
      let eaten=Math.max(.5,Number(eatenInput.value)||prepared);
      eatenInput.max=String(prepared);
      if(eaten>prepared){eaten=prepared;eatenInput.value=String(prepared);}
      const rest=Math.max(0,prepared-eaten);
      if(preview)preview.innerHTML=recipeNeedPreview(recipe,prepared);
      if(hint)hint.textContent=rest>0?portionLabel(rest)+' werden nach dem Essen als Restportionen gespeichert.':'Es entstehen keine Restportionen.';
    };
    preparedInput?.addEventListener('input',sync);
    eatenInput?.addEventListener('input',sync);
    sync();
  }

  function scheduleLeftoverModal(leftoverId){
    const leftover=(state?.leftovers||[]).find(item=>String(item.id)===String(leftoverId));
    if(!leftover){alert('Restportion nicht gefunden.');return;}
    const max=Math.max(.5,Number(leftover.available_servings)||.5);
    const recipe=leftover.food_recipes||{};
    addModal('Restportion einplanen','<form><p class="food-leftover-modal-copy-v572"><strong>'+esc(recipe.title||'Restportion')+'</strong><br>'+esc(portionLabel(max))+' verfügbar</p><div class="food-form-grid-v544"><label>Tag<input name="date" type="date" min="'+todayIso()+'" value="'+plusDays(todayIso(),1)+'" required></label><label>Mahlzeit<select name="type">'+mealTypeOptions(recipe.meal_type||'dinner')+'</select></label></div><label>Portionen<input name="servings" type="number" min="0.5" max="'+esc(max)+'" step="0.5" value="'+esc(Math.min(1,max))+'" required></label><button class="food-action-v544" type="submit">Rest einplanen</button></form>',async form=>{
      const servings=Number(form.get('servings'));
      if(!Number.isFinite(servings)||servings<=0||servings>max)throw new Error('Ungültige Restportion.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('schedule_food_leftover',{p_leftover_id:leftoverId,p_meal_date:form.get('date'),p_meal_type:form.get('type'),p_servings:servings});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function freeMealIngredientRow(index,item={}){
    const activeInventory=(state?.inventory||[]).filter(entry=>entry.is_active!==false);
    const options=activeInventory.map(entry=>'<option value="'+esc(entry.id)+'" '+(String(item.inventory_id||'')===String(entry.id)?'selected':'')+'>'+esc(entry.name)+'</option>').join('');
    const displayName=String(item.name||'').trim()||ingredientName(item);
    return '<div class="food-recipe-ingredient-row-v549" data-food-free-meal-row>'
      +'<div class="food-recipe-row-head-v549"><strong>Zutat '+(index+1)+'</strong><button type="button" data-food-free-meal-remove aria-label="Zutat entfernen">×</button></div>'
      +'<label>Aus Vorrat wählen<select data-food-free-meal-inventory><option value="">Eigene Zutat eingeben</option>'+options+'</select></label>'
      +'<label>Name<input data-food-free-meal-name value="'+esc(displayName)+'" placeholder="z. B. Roggen-Vollkornbrot" required></label>'
      +'<div class="food-form-grid-v544"><label>Menge<input data-food-free-meal-quantity type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(item.quantity??'')+'" placeholder="offen"></label><label>Einheit<input data-food-free-meal-unit value="'+esc(item.unit||'')+'" placeholder="g, ml, Stück …"></label></div>'
      +'</div>';
  }

  function wireFreeMealIngredientRow(row){
    const select=row.querySelector('[data-food-free-meal-inventory]');
    const name=row.querySelector('[data-food-free-meal-name]');
    const unit=row.querySelector('[data-food-free-meal-unit]');
    const sync=()=>{
      const item=(state?.inventory||[]).find(entry=>String(entry.id)===String(select?.value||''));
      if(item){
        if(name){name.value=item.name;name.readOnly=true;}
        if(unit){unit.value=item.unit||'';unit.readOnly=true;}
      }else{
        if(name)name.readOnly=false;
        if(unit)unit.readOnly=false;
      }
    };
    select?.addEventListener('change',sync);
    sync();
  }

  function renumberFreeMealRows(rows){
    rows.querySelectorAll('[data-food-free-meal-row]').forEach((row,index)=>{
      const strong=row.querySelector('.food-recipe-row-head-v549 strong');
      if(strong)strong.textContent='Zutat '+(index+1);
    });
  }

  function editFreeMealModal(mealId){
    const meal=(state?.meals||[]).find(item=>String(item.id)===String(mealId));
    if(!meal){alert('Mahlzeit nicht gefunden.');return;}
    if(meal.recipe_id){alert('Diese Mahlzeit stammt aus einem Rezept. Bitte das Rezept bearbeiten.');return;}
    if(normalizedStatus(meal.status)==='completed'){alert('Bereits gebuchte Mahlzeiten werden nicht nachträglich verändert.');return;}

    const items=meal.ingredients||[];
    let modal;
    const rowsHtml=items.map((item,index)=>freeMealIngredientRow(index,item)).join('');
    const body='<form class="food-recipe-form-v549">'
      +'<p class="food-modal-copy-v544"><strong>'+esc(meal.title)+'</strong><br>Zutaten und Mengen für genau diese geplante Mahlzeit ändern.</p>'
      +'<div class="food-recipe-builder-v549"><div class="food-recipe-builder-head-v549"><strong>Zutaten</strong><button type="button" data-food-free-meal-add>+ Zutat</button></div><div data-food-free-meal-rows>'+rowsHtml+'</div></div>'
      +'<button class="food-action-v544" type="submit">Änderungen speichern</button>'
      +'</form>';

    modal=addModal('Mahlzeit bearbeiten',body,async()=>{
      if(!sourceIsReal('meals'))throw new Error('Die Mahlzeitdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst neu laden.');
      const rows=[...modal.querySelectorAll('[data-food-free-meal-row]')];
      const ingredients=rows.map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-free-meal-inventory]')?.value||'')||null;
        const inventoryItem=inventoryId?(state?.inventory||[]).find(item=>String(item.id)===inventoryId):null;
        const name=String(row.querySelector('[data-food-free-meal-name]')?.value||'').trim();
        const quantityRaw=String(row.querySelector('[data-food-free-meal-quantity]')?.value||'').trim();
        const quantity=quantityRaw===''?null:Number(quantityRaw);
        const unit=String(row.querySelector('[data-food-free-meal-unit]')?.value||'').trim()||null;
        if(!name)throw new Error('Bei Zutat '+(index+1)+' fehlt der Name.');
        if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Bei Zutat '+(index+1)+' ist die Menge ungültig.');
        if(quantity!==null&&!unit)throw new Error('Bei Zutat '+(index+1)+' fehlt die Einheit.');
        if(inventoryId&&!inventoryItem)throw new Error('Die ausgewählte Vorratszutat ist nicht mehr verfügbar.');
        return {inventory_id:inventoryId,name,quantity,unit,quantity_confirmed:quantity!==null};
      });

      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await withTimeout(
        supabase.rpc('update_food_free_meal_ingredients',{p_meal_id:meal.id,p_ingredients:ingredients}),
        'Mahlzeit aktualisieren',
        10000
      );
      if(result.error)throw result.error;
      expandedMeals.add(String(meal.id));
      await mutate(()=>result.data);
    });

    const rows=modal.querySelector('[data-food-free-meal-rows]');
    rows.querySelectorAll('[data-food-free-meal-row]').forEach(wireFreeMealIngredientRow);
    modal.querySelector('[data-food-free-meal-add]')?.addEventListener('click',()=>{
      const index=rows.querySelectorAll('[data-food-free-meal-row]').length;
      rows.insertAdjacentHTML('beforeend',freeMealIngredientRow(index,{}));
      const row=rows.lastElementChild;
      wireFreeMealIngredientRow(row);
      row.querySelector('[data-food-free-meal-name]')?.focus();
    });
    rows.addEventListener('click',event=>{
      const remove=event.target?.closest?.('[data-food-free-meal-remove]');
      if(!remove)return;
      remove.closest('[data-food-free-meal-row]')?.remove();
      renumberFreeMealRows(rows);
    });
  }

  function recipeIngredientRow(index){
    const options=sourceIsReal('inventory')
      ?(state?.inventory||[]).filter(item=>item.is_active!==false).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('')
      :'';
    return '<div class="food-recipe-ingredient-row-v549" data-food-recipe-row>'+
      '<div class="food-recipe-row-head-v549"><strong>Zutat '+(index+1)+'</strong><button type="button" data-food-recipe-remove aria-label="Zutat entfernen">×</button></div>'+
      '<label>Aus Vorrat wählen<select data-food-recipe-inventory><option value="">Eigene Zutat eingeben</option>'+options+'</select></label>'+
      '<label>Name<input data-food-recipe-name placeholder="z. B. Paprika" required></label>'+
      '<div class="food-form-grid-v544"><label>Menge<input data-food-recipe-quantity type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Einheit<input data-food-recipe-unit value="g" placeholder="g, ml, Stück …" required></label></div>'+
      '</div>';
  }

  function wireRecipeIngredientRow(row){
    const select=row.querySelector('[data-food-recipe-inventory]');
    const name=row.querySelector('[data-food-recipe-name]');
    const unit=row.querySelector('[data-food-recipe-unit]');
    const sync=()=>{
      const item=(state?.inventory||[]).find(entry=>entry.id===select?.value);
      if(item){
        name.value=item.name;
        name.readOnly=true;
        if(item.unit)unit.value=item.unit;
        unit.readOnly=true;
      }else{
        name.readOnly=false;
        unit.readOnly=false;
        if(select?.value==='')name.value='';
      }
    };
    select?.addEventListener('change',sync);
  }

  function addRecipeModal(){
    let modal;
    const body='<form class="food-recipe-form-v549">'+
      '<label>Rezeptname<input name="title" placeholder="z. B. Hähnchen-Brokkoli-Pfanne" required></label>'+
      '<div class="food-form-grid-v544"><label>Mahlzeit<select name="meal_type"><option value="breakfast">Frühstück</option><option value="snack">Snack</option><option value="lunch">Mittag</option><option value="dinner" selected>Abendessen</option></select></label><label>Basis-Portionen<input name="servings" type="number" min="1" max="99" step="1" inputmode="numeric" value="1" required></label></div>'+
      '<div class="food-form-grid-v544"><label>Vorbereitung / Kochen in Min.<input name="prep_minutes" type="number" min="0" max="1440" step="1" inputmode="numeric" placeholder="z. B. 30"></label><label>Kurzinfo<input name="description" placeholder="z. B. schnell, sättigend, Meal Prep"></label></div>'+
      '<label>Zubereitung<textarea name="instructions" rows="5" placeholder="Jeden Schritt in eine neue Zeile.\nHack anbraten\nGemüse dazugeben\n10 Minuten köcheln"></textarea></label>'+
      '<div class="food-recipe-builder-v549"><div class="food-recipe-builder-head-v549"><strong>Zutaten</strong><button type="button" data-food-recipe-add-ingredient>+ Zutat</button></div><div data-food-recipe-rows>'+recipeIngredientRow(0)+'</div></div>'+
      '<button class="food-action-v544" type="submit">Rezept speichern</button>'+
      '</form>';

    modal=addModal('Rezept hinzufügen',body,async form=>{
      if(!sourceIsReal('recipes'))throw new Error('Die Rezeptdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst „Erneut laden“ verwenden.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Nicht angemeldet.');

      const title=String(form.get('title')||'').trim();
      const mealType=String(form.get('meal_type')||'dinner');
      const servings=Number(form.get('servings')||1);
      const prepMinutes=form.get('prep_minutes')?Number(form.get('prep_minutes')):null;
      const description=String(form.get('description')||'').trim()||null;
      const instructions=String(form.get('instructions')||'').trim()||null;
      if(!title)throw new Error('Bitte einen Rezeptnamen eingeben.');
      if(!Number.isInteger(servings)||servings<1||servings>99)throw new Error('Bitte eine gültige Portionszahl zwischen 1 und 99 eingeben.');
      if(prepMinutes!==null&&(!Number.isFinite(prepMinutes)||prepMinutes<0||prepMinutes>1440))throw new Error('Die Zeitangabe ist ungültig.');

      const ingredientRows=Array.from(modal.querySelectorAll('[data-food-recipe-row]'));
      if(!ingredientRows.length)throw new Error('Bitte mindestens eine Zutat hinzufügen.');
      const ingredients=ingredientRows.map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-recipe-inventory]')?.value||'')||null;
        const inventoryItem=inventoryId?(state?.inventory||[]).find(item=>item.id===inventoryId):null;
        const name=String(row.querySelector('[data-food-recipe-name]')?.value||'').trim();
        const quantity=Number(row.querySelector('[data-food-recipe-quantity]')?.value);
        const unit=String(row.querySelector('[data-food-recipe-unit]')?.value||'').trim();
        if(!name)throw new Error('Bei Zutat '+(index+1)+' fehlt der Name.');
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bei Zutat '+(index+1)+' fehlt eine gültige Menge.');
        if(!unit)throw new Error('Bei Zutat '+(index+1)+' fehlt die Einheit.');
        if(inventoryId&&!inventoryItem)throw new Error('Die ausgewählte Vorratszutat ist nicht mehr verfügbar.');
        return {user_id:user.id,inventory_id:inventoryId,name,label:fmtQty(quantity,unit)+' '+name,quantity,unit,sort_order:index+1};
      });

      let recipe=null;
      const recipeResult=await withTimeout(
        supabase.from('food_recipes').insert({user_id:user.id,title,meal_type:mealType,description,servings,prep_minutes:prepMinutes,instructions,active:true}).select('id,title,meal_type,description,servings,prep_minutes,instructions,active,created_at').single(),
        'Rezept speichern',
        8000
      );
      if(recipeResult?.error){
        if(recipeResult.error.code==='23505')throw new Error('Ein Rezept mit diesem Namen gibt es bereits.');
        throw recipeResult.error;
      }
      recipe=recipeResult.data;

      const ingredientPayload=ingredients.map(item=>({...item,recipe_id:recipe.id}));
      const ingredientResult=await withTimeout(
        supabase.from('food_recipe_ingredients').insert(ingredientPayload).select('id,recipe_id,inventory_id,name,label,quantity,unit,sort_order'),
        'Rezeptzutaten speichern',
        8000
      );
      if(ingredientResult?.error){
        try{await supabase.from('food_recipes').delete().eq('id',recipe.id);}catch(_){}
        throw ingredientResult.error;
      }

      const created={...recipe,food_recipe_ingredients:ingredientResult.data||[]};
      state.recipes=[created,...(state?.recipes||[]).filter(item=>item.id!==recipe.id)];
      sourceState.recipes='cloud';
      renderState();
      return created;
    });

    const rows=modal.querySelector('[data-food-recipe-rows]');
    Array.from(rows.querySelectorAll('[data-food-recipe-row]')).forEach(wireRecipeIngredientRow);
    modal.querySelector('[data-food-recipe-add-ingredient]')?.addEventListener('click',()=>{
      const index=rows.querySelectorAll('[data-food-recipe-row]').length;
      rows.insertAdjacentHTML('beforeend',recipeIngredientRow(index));
      const row=rows.lastElementChild;
      wireRecipeIngredientRow(row);
      row.querySelector('[data-food-recipe-name]')?.focus();
    });
    rows.addEventListener('click',event=>{
      const remove=event.target?.closest?.('[data-food-recipe-remove]');
      if(!remove)return;
      const all=rows.querySelectorAll('[data-food-recipe-row]');
      if(all.length<=1){alert('Ein Rezept braucht mindestens eine Zutat.');return;}
      remove.closest('[data-food-recipe-row]')?.remove();
      rows.querySelectorAll('[data-food-recipe-row]').forEach((row,index)=>{
        const strong=row.querySelector('.food-recipe-row-head-v549 strong');
        if(strong)strong.textContent='Zutat '+(index+1);
      });
    });
  }

  function editRecipeModal(recipeId){
    const recipe=(state?.recipes||[]).find(item=>String(item.id)===String(recipeId));
    if(!recipe){alert('Rezept nicht gefunden.');return;}
    const items=recipe.food_recipe_ingredients||recipe.ingredients||[];
    let modal;
    const rowsHtml=(items.length?items:[{}]).map((_,index)=>recipeIngredientRow(index)).join('');
    const body='<form class="food-recipe-form-v549">'+
      '<label>Rezeptname<input name="title" value="'+esc(recipe.title||'')+'" required></label>'+
      '<div class="food-form-grid-v544"><label>Mahlzeit<select name="meal_type">'+mealTypeOptions(recipe.meal_type||'dinner')+'</select></label><label>Basis-Portionen<input name="servings" type="number" min="1" max="99" step="1" inputmode="numeric" value="'+esc(recipe.servings||1)+'" required></label></div>'+
      '<div class="food-form-grid-v544"><label>Vorbereitung / Kochen in Min.<input name="prep_minutes" type="number" min="0" max="1440" step="1" inputmode="numeric" value="'+esc(recipe.prep_minutes??'')+'"></label><label>Kurzinfo<input name="description" value="'+esc(recipe.description||'')+'"></label></div>'+
      '<label>Zubereitung<textarea name="instructions" rows="5">'+esc(recipeInstructions(recipe).join('\n'))+'</textarea></label>'+
      '<div class="food-recipe-builder-v549"><div class="food-recipe-builder-head-v549"><strong>Zutaten</strong><button type="button" data-food-recipe-add-ingredient>+ Zutat</button></div><div data-food-recipe-rows>'+rowsHtml+'</div></div>'+
      '<button class="food-action-v544" type="submit">Änderungen speichern</button>'+
      '</form>';

    modal=addModal('Rezept bearbeiten',body,async form=>{
      if(!sourceIsReal('recipes'))throw new Error('Die Rezeptdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst „Erneut laden“ verwenden.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');

      const title=String(form.get('title')||'').trim();
      const mealType=String(form.get('meal_type')||'dinner');
      const servings=Number(form.get('servings')||1);
      const prepMinutes=form.get('prep_minutes')?Number(form.get('prep_minutes')):null;
      const description=String(form.get('description')||'').trim()||null;
      const instructions=String(form.get('instructions')||'').trim()||null;
      if(!title)throw new Error('Bitte einen Rezeptnamen eingeben.');
      if(!Number.isInteger(servings)||servings<1||servings>99)throw new Error('Bitte eine gültige Portionszahl zwischen 1 und 99 eingeben.');
      if(prepMinutes!==null&&(!Number.isFinite(prepMinutes)||prepMinutes<0||prepMinutes>1440))throw new Error('Die Zeitangabe ist ungültig.');

      const ingredientRows=Array.from(modal.querySelectorAll('[data-food-recipe-row]'));
      if(!ingredientRows.length)throw new Error('Bitte mindestens eine Zutat hinzufügen.');
      const ingredients=ingredientRows.map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-recipe-inventory]')?.value||'')||null;
        const inventoryItem=inventoryId?(state?.inventory||[]).find(item=>item.id===inventoryId):null;
        const name=String(row.querySelector('[data-food-recipe-name]')?.value||'').trim();
        const quantity=Number(row.querySelector('[data-food-recipe-quantity]')?.value);
        const unit=String(row.querySelector('[data-food-recipe-unit]')?.value||'').trim();
        if(!name)throw new Error('Bei Zutat '+(index+1)+' fehlt der Name.');
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bei Zutat '+(index+1)+' fehlt eine gültige Menge.');
        if(!unit)throw new Error('Bei Zutat '+(index+1)+' fehlt die Einheit.');
        if(inventoryId&&!inventoryItem)throw new Error('Die ausgewählte Vorratszutat ist nicht mehr verfügbar.');
        return {inventory_id:inventoryId,name,label:fmtQty(quantity,unit)+' '+name,quantity,unit};
      });

      const result=await withTimeout(
        supabase.rpc('update_food_recipe',{
          p_recipe_id:recipeId,
          p_title:title,
          p_meal_type:mealType,
          p_servings:servings,
          p_prep_minutes:prepMinutes,
          p_description:description,
          p_instructions:instructions,
          p_ingredients:ingredients
        }),
        'Rezept aktualisieren',
        10000
      );
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });

    const rows=modal.querySelector('[data-food-recipe-rows]');
    Array.from(rows.querySelectorAll('[data-food-recipe-row]')).forEach((row,index)=>{
      const item=items[index];
      const select=row.querySelector('[data-food-recipe-inventory]');
      const name=row.querySelector('[data-food-recipe-name]');
      const quantity=row.querySelector('[data-food-recipe-quantity]');
      const unit=row.querySelector('[data-food-recipe-unit]');
      if(item){
        if(select&&item.inventory_id)select.value=String(item.inventory_id);
        if(name)name.value=String(item.name||'');
        if(quantity)quantity.value=String(item.quantity??'');
        if(unit)unit.value=String(item.unit||'g');
        if(item.inventory_id){if(name)name.readOnly=true;if(unit)unit.readOnly=true;}
      }
      wireRecipeIngredientRow(row);
    });
    modal.querySelector('[data-food-recipe-add-ingredient]')?.addEventListener('click',()=>{
      const index=rows.querySelectorAll('[data-food-recipe-row]').length;
      rows.insertAdjacentHTML('beforeend',recipeIngredientRow(index));
      const row=rows.lastElementChild;
      wireRecipeIngredientRow(row);
      row.querySelector('[data-food-recipe-name]')?.focus();
    });
    rows.addEventListener('click',event=>{
      const remove=event.target?.closest?.('[data-food-recipe-remove]');
      if(!remove)return;
      const all=rows.querySelectorAll('[data-food-recipe-row]');
      if(all.length<=1){alert('Ein Rezept braucht mindestens eine Zutat.');return;}
      remove.closest('[data-food-recipe-row]')?.remove();
      rows.querySelectorAll('[data-food-recipe-row]').forEach((row,index)=>{
        const strong=row.querySelector('.food-recipe-row-head-v549 strong');
        if(strong)strong.textContent='Zutat '+(index+1);
      });
    });
  }

  function garlicStockModal(){
    const garlic=garlicParts();
    addModal('Knoblauchbestand','<form><p class="food-modal-copy-v544">Knoblauch wird als eine Zutat angezeigt. Ganze Knollen und lose Zehen bleiben intern getrennt.</p><div class="food-form-grid-v544"><label>Ganze Knollen<input name="bulbs" type="number" min="0" step="1" inputmode="numeric" value="'+esc(garlic.bulbs)+'" required></label><label>Lose Zehen<input name="cloves" type="number" min="0" step="1" inputmode="numeric" value="'+esc(garlic.cloves)+'" required></label></div><button class="food-action-v544" type="submit">Knoblauch speichern</button></form>',async form=>{
      const bulbs=Number(form.get('bulbs'));
      const cloves=Number(form.get('cloves'));
      if(!Number.isInteger(bulbs)||bulbs<0||!Number.isInteger(cloves)||cloves<0)throw new Error('Knollen und Zehen bitte als ganze Zahlen eingeben.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('set_food_garlic_stock',{p_bulbs:bulbs,p_cloves:cloves});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function addInventoryModal(){
    let modal;
    const body='<form><label>Bezeichnung<input name="name" placeholder="z. B. Zucchini oder Knoblauch" required></label>'+
      '<div data-food-generic-stock><div class="food-form-grid-v544"><label>Menge<input name="quantity" type="number" min="0" step="0.01" required></label><label>Einheit<input name="unit" value="g" required></label></div><label><input name="opened" type="checkbox"> bereits geöffnet</label><label>Verwenden<select name="priority"><option value="tomorrow">morgen</option><option value="three_days">in den nächsten 3 Tagen</option><option value="later" selected>später</option></select></label></div>'+
      '<div data-food-garlic-stock hidden><p class="food-modal-copy-v544">Knoblauch ist ein Sonderfall: ganze Knollen und lose Zehen werden gemeinsam angezeigt.</p><div class="food-form-grid-v544"><label>Ganze Knollen<input name="garlic_bulbs" type="number" min="0" step="1" inputmode="numeric" value="0"></label><label>Lose Zehen<input name="garlic_cloves" type="number" min="0" step="1" inputmode="numeric" value="0"></label></div></div>'+
      '<button class="food-action-v544" type="submit">Vorrat speichern</button></form>';
    modal=addModal('Vorrat ergänzen',body,async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await supabase.auth.getSession();const user=session?.data?.session?.user;if(!user?.id)throw new Error('Nicht angemeldet.');
      const name=String(form.get('name')||'').trim();
      const normalized=name.toLocaleLowerCase('de-DE');
      if(normalized.startsWith('knoblauch')){
        const bulbs=Number(form.get('garlic_bulbs')||0);
        const cloves=Number(form.get('garlic_cloves')||0);
        if(!Number.isInteger(bulbs)||bulbs<0||!Number.isInteger(cloves)||cloves<0)throw new Error('Knollen und Zehen bitte als ganze Zahlen eingeben.');
        const result=await supabase.rpc('set_food_garlic_stock',{p_bulbs:bulbs,p_cloves:cloves});
        if(result.error)throw result.error;
        await mutate(()=>result.data);
        return;
      }
      const quantity=Number(form.get('quantity'));const unit=String(form.get('unit')||'g');
      const result=await supabase.from('food_inventory').insert({user_id:user.id,name,quantity,unit,quantity_label:fmtQty(quantity,unit),forecast_label:null,tone:quantity>0?'stock':'empty',note:'Manuell ergänzt',sort_order:999,opened:form.get('opened')==='on',use_priority:String(form.get('priority')||'later')});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
    const nameInput=modal?.querySelector('[name="name"]');
    const generic=modal?.querySelector('[data-food-generic-stock]');
    const garlic=modal?.querySelector('[data-food-garlic-stock]');
    const genericRequired=Array.from(generic?.querySelectorAll('[required]')||[]);
    const sync=()=>{
      const special=String(nameInput?.value||'').trim().toLocaleLowerCase('de-DE').startsWith('knoblauch');
      if(generic)generic.hidden=special;
      if(garlic)garlic.hidden=!special;
      genericRequired.forEach(input=>input.required=!special);
    };
    nameInput?.addEventListener('input',sync);
    sync();
  }

  function adjustModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    addModal('Menge ändern','<form><p class="food-modal-copy-v544">'+esc(item.name)+'</p><label>Neue Menge<input name="quantity" type="number" min="0" step="0.01" value="'+esc(item.quantity??0)+'" required></label><label>Notiz (optional)<input name="note" placeholder="z. B. verschüttet"></label><button class="food-action-v544" type="submit">Menge speichern</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('adjust_food_inventory',{p_inventory_id:id,p_new_quantity:Number(form.get('quantity')),p_reason:'Menge manuell geändert',p_note:String(form.get('note')||'')||null});
      if(result.error)throw result.error;
      if(item.pending_weighing===true){
        const clearPending=await supabase.from('food_inventory').update({pending_weighing:false}).eq('id',id);
        if(clearPending.error)throw clearPending.error;
      }
      await mutate(()=>result.data);
    });
  }


  function weighPendingModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item||item.pending_weighing!==true)return;
    const known=Math.max(0,num(item.quantity)||0);
    addModal('Einkauf abwiegen','<form><p class="food-modal-copy-v544"><strong>'+esc(item.name)+'</strong><br>'+(known>0?'Schon sicher im Vorrat: '+esc(fmtQty(known,item.unit))+'. ':'')+'Wiege nur die neu eingekaufte Menge.</p><label>Gewogene Einkaufsmenge ('+esc(item.unit||'g')+')<input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" required autofocus></label><button class="food-action-v544" type="submit">Gewicht übernehmen</button></form>',async form=>{
      const measured=Number(form.get('quantity'));
      if(!Number.isFinite(measured)||measured<=0)throw new Error('Bitte eine gültige gewogene Menge eintragen.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const newQuantity=known+measured;
      const result=await supabase.rpc('adjust_food_inventory',{p_inventory_id:id,p_new_quantity:newQuantity,p_reason:'Einkauf nachträglich abgewogen',p_note:null});
      if(result.error)throw result.error;
      const clearPending=await supabase.from('food_inventory').update({
        pending_weighing:false,
        quantity_label:fmtQty(newQuantity,item.unit),
        note:null
      }).eq('id',id);
      if(clearPending.error)throw clearPending.error;
      await mutate(()=>result.data);
    });
  }

  function storageModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    addModal('Zustand &amp; Verwendung','<form><p class="food-modal-copy-v544">'+esc(item.name)+'</p><label>Zustand<select name="opened"><option value="false" '+(!item.opened?'selected':'')+'>Unangebrochen</option><option value="true" '+(item.opened?'selected':'')+'>Angebrochen</option></select></label><label>Einplanen<select name="priority">'+['tomorrow','three_days','later'].map(value=>'<option value="'+value+'" '+(item.use_priority===value?'selected':'')+'>'+priorityLabel(value)+'</option>').join('')+'</select></label><button class="food-action-v544" type="submit">Speichern</button></form>',async form=>{
      if(!sourceIsReal('inventory'))throw new Error('Der Vorrat wird gerade nur aus Notfalldaten gezeigt. Bitte die Cloud-Verbindung erneut laden.');
      const opened=form.get('opened')==='true';
      const usePriority=String(form.get('priority')||'later');
      const previous={opened:item.opened,use_priority:item.use_priority};

      item.opened=opened;
      item.use_priority=usePriority;
      renderState();

      try{
        const saved=await saveInventoryStorage(id,opened,usePriority);
        item.opened=saved.opened;
        item.use_priority=saved.use_priority;
        sourceState.inventory='cloud';
        cloudIssues=cloudIssues.filter(issue=>!String(issue).startsWith('inventory:'));
        renderState();
        return saved;
      }catch(error){
        item.opened=previous.opened;
        item.use_priority=previous.use_priority;
        renderState();
        const message=error?.message||'Unbekannter Cloud-Fehler';
        throw new Error('Speichern konnte nicht bestätigt werden. Der vorige Zustand wurde wiederhergestellt. '+message);
      }
    });
  }

  function consumeModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    if(num(item.quantity)===null){alert('Bitte zuerst die vorhandene Menge eintragen.');return;}
    const bottle=item.name==='Pepsi Zero Cherry'&&item.unit==='l';
    const amount=bottle?1.25:1;
    addModal('Verbrauch eintragen','<form><p class="food-modal-copy-v544">'+esc(item.name)+' · vorhanden: '+esc(fmtQty(item.quantity,item.unit))+'</p>'+(bottle?'<p class="food-modal-copy-v544">1 Flasche = 1,25 l</p>':'')+'<label>Verbrauchte Menge ('+esc(item.unit)+')<input name="quantity" type="number" min="0.01" max="'+esc(item.quantity)+'" step="0.01" value="'+amount+'" required></label><button class="food-action-v544" type="submit">Vom Vorrat abziehen</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const quantity=Number(form.get('quantity'));
      if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bitte eine positive Menge eingeben.');
      const result=await supabase.rpc('consume_food_inventory',{p_inventory_id:id,p_quantity:quantity,p_unit:item.unit,p_expected_quantity:Number(item.quantity)});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  async function archiveInventory(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    if(!confirm('Vorrat "'+item.name+'" entfernen? Du kannst ihn später neu anlegen.'))return;
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await supabase.rpc('archive_food_inventory',{p_inventory_id:id,p_reason:'Manuell entfernt'});
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  function shoppingModal(){
    addModal('Einkauf ergänzen','<form><label>Was fehlt?<input name="label" placeholder="z. B. Zucchini" required></label><div class="food-form-grid-v544"><label>Menge<input name="quantity" type="number" min="0" step="0.01"></label><label>Einheit<input name="unit" value="Stück"></label></div><button class="food-action-v544" type="submit">Zur Einkaufsliste</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await supabase.auth.getSession();const user=session?.data?.session?.user;if(!user?.id)throw new Error('Nicht angemeldet.');
      const result=await supabase.from('food_shopping_items').insert({user_id:user.id,label:String(form.get('label')).trim(),quantity:form.get('quantity')?Number(form.get('quantity')):null,unit:String(form.get('unit')||'')||null});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  async function checkShopping(id){
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await supabase.from('food_shopping_items').update({checked:true}).eq('id',id);
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  function wire(root){
    root.querySelectorAll('[data-food-adjust]').forEach(button=>{
      const id=button.dataset.foodAdjust;
      button.insertAdjacentHTML('afterend','<button type="button" data-food-consume="'+esc(id)+'">Verbraucht</button><button type="button" data-food-storage="'+esc(id)+'">Zustand &amp; Verwendung</button>');
    });
    root.querySelectorAll('[data-food-consume]').forEach(button=>button.addEventListener('click',()=>consumeModal(button.dataset.foodConsume)));
    root.querySelectorAll('[data-food-weigh]').forEach(button=>button.addEventListener('click',()=>weighPendingModal(button.dataset.foodWeigh)));
    root.querySelectorAll('[data-food-meal-toggle]').forEach(button=>button.addEventListener('click',()=>{const id=String(button.dataset.foodMealToggle);if(expandedMeals.has(id))expandedMeals.delete(id);else expandedMeals.add(id);renderState();}));
    root.querySelectorAll('[data-food-meal-card]').forEach(card=>card.addEventListener('click',event=>{
      if(event.target?.closest?.('button,input,select,textarea,label'))return;
      const id=String(card.dataset.foodMealCard);
      if(expandedMeals.has(id))expandedMeals.delete(id);else expandedMeals.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-stock-gap]').forEach(button=>button.addEventListener('click',()=>stockGapModal(button)));
    root.querySelectorAll('[data-food-open-garlic]').forEach(button=>button.addEventListener('click',()=>openGarlicModal(button.dataset.foodOpenGarlic)));
    root.querySelectorAll('[data-food-garlic-adjust]').forEach(button=>button.addEventListener('click',()=>garlicStockModal()));
    root.querySelectorAll('[data-food-storage]').forEach(button=>button.addEventListener('click',()=>storageModal(button.dataset.foodStorage)));
    root.querySelectorAll('[data-food-tab]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.foodTab;render();}));
    root.querySelectorAll('[data-food-complete]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await completeMeal(button.dataset.foodComplete);}catch(error){alert(error?.message||'Mahlzeit konnte nicht abgeschlossen werden.');button.disabled=false;}}));
    root.querySelectorAll('[data-food-edit-free-meal]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editFreeMealModal(button.dataset.foodEditFreeMeal);}));
    root.querySelectorAll('[data-food-edit-recipe]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editRecipeModal(button.dataset.foodEditRecipe);}));
    root.querySelectorAll('[data-food-schedule]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();scheduleModal(button.dataset.foodSchedule);}));
    root.querySelectorAll('[data-food-schedule-leftover]').forEach(button=>button.addEventListener('click',()=>scheduleLeftoverModal(button.dataset.foodScheduleLeftover)));
    root.querySelectorAll('[data-food-recipe-toggle]').forEach(button=>button.addEventListener('click',event=>{
      event.stopPropagation();
      const id=String(button.dataset.foodRecipeToggle);
      if(expandedRecipes.has(id))expandedRecipes.delete(id);else expandedRecipes.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-recipe-card]').forEach(card=>card.addEventListener('click',event=>{
      if(event.target?.closest?.('button,input,select,textarea,label'))return;
      const id=String(card.dataset.foodRecipeCard);
      if(expandedRecipes.has(id))expandedRecipes.delete(id);else expandedRecipes.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-adjust]').forEach(button=>button.addEventListener('click',()=>adjustModal(button.dataset.foodAdjust)));
    root.querySelectorAll('[data-food-archive]').forEach(button=>button.addEventListener('click',()=>archiveInventory(button.dataset.foodArchive).catch(error=>alert(error?.message||'Vorrat konnte nicht entfernt werden.'))));
    root.querySelector('[data-food-add-inventory]')?.addEventListener('click',addInventoryModal);
    root.querySelector('[data-food-add-shopping]')?.addEventListener('click',shoppingModal);
    root.querySelector('[data-food-add-recipe]')?.addEventListener('click',addRecipeModal);
    root.querySelectorAll('[data-shopping-check]').forEach(button=>button.addEventListener('click',()=>checkShopping(button.dataset.shoppingCheck).catch(error=>alert(error?.message||'Eintrag konnte nicht geändert werden.'))));
    root.querySelectorAll('[data-food-jump]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.foodJump;render();}));
    root.querySelector('[data-food-retry]')?.addEventListener('click',()=>{loadPromise=null;render();});
  }

  function paint(root,data){
    const target=root.querySelector('.food-content-v544');
    if(target)target.innerHTML=cloudNotice()+content(data);
    root.querySelectorAll('.food-section-head-v544>div>span').forEach(label=>label.remove());
    if(activeTab==='plan')root.querySelector('.food-section-head-v544 small')?.remove();
    decorateCards(root);
    wire(root);
    return true;
  }

  function renderState(){
    ++renderSerial;
    const root=ensureRoot();if(!root||!state)return false;
    root.innerHTML=shell();
    return paint(root,state);
  }

  async function render(){
    const serial=++renderSerial;
    const root=ensureRoot();if(!root)return false;
    root.innerHTML=shell();
    const data=await load();
    if(serial!==renderSerial)return false;
    state=data;
    return paint(root,data);
  }

  function setSurface(active){
    const html=document.documentElement;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(active){
      document.body.classList.add(BODY_CLASS);
      html.classList.add(SURFACE_CLASS);
      document.body.dataset.modAppSurfaceV515='food';
      if(meta)meta.setAttribute('content','#eef3e8');
    }else{
      document.body.classList.remove(BODY_CLASS);
      html.classList.remove(SURFACE_CLASS);
      if(document.body.dataset.modAppSurfaceV515==='food')delete document.body.dataset.modAppSurfaceV515;
      if(meta)meta.setAttribute('content','#0b0d0f');
    }
  }

  function open(){
    cardArcs.clear();
    window.__modAppHubV515?.hide?.();
    document.body.classList.remove('mod-backstage-v530');
    setSurface(true);
    ensureRoot()?.setAttribute('aria-hidden','false');
    loadPromise=null;
    render();
    window.scrollTo?.({top:0,left:0,behavior:'instant'});
    return 'food';
  }

  function close(){
    setSurface(false);
    ensureRoot()?.setAttribute('aria-hidden','true');
  }

  function patchHub(){
    const hub=window.__modAppHubV515;
    if(hub&&!hub.__foodPatchedV544){
      const originalShow=hub.show?.bind(hub);
      hub.show=function(){close();return originalShow?.();};
      hub.__foodPatchedV544=true;
    }
    const launcher=window.__modHubLauncherV517||window.__modHubLauncherV540;
    const item=launcher?.modules?.find?.(entry=>entry.id==='food');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="food"],[data-mod-hub-open="food"]').forEach(button=>{
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Food öffnen');
    });
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-mod-hub-launch-v517="food"],[data-mod-hub-open="food"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  },true);

  const api={version:VERSION,open,close,render,reload(){loadPromise=null;return render();},fallbackData:fallback,planningDoesNotConsume:true,receiptExcluded:true,getDataSources(){return {...sourceState};},getCloudIssues(){return [...cloudIssues];}};
  window.__modFoodV544=api;
  window.__modFoodV543=api;
  const observer=new MutationObserver(patchHub);
  function init(){ensureRoot()?.setAttribute('aria-hidden','true');patchHub();observer.observe(document.documentElement,{subtree:true,childList:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

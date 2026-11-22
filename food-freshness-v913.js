/* V913 · FOOD freshness policy for V1.
   Read-only audit. Never invents opening dates, purchases, MHD or stock.
   Inconclusive evidence is a warning, not a phantom consumption.
*/
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ModFoodFreshnessV913=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const iso=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):null;
  const shift=(value,days)=>{
    const day=iso(value);if(!day)return null;
    const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);
    return d.toISOString().slice(0,10);
  };
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g,' ').trim();
  const textName=item=>norm([item?.name||item?.label||'',item?.variant||''].join(' '));
  function classify(item){
    const n=textName(item);
    if(!n)return null;
    if(/\b(tk|tiefkuhl|tiefgekuhlt|gefroren|tiefgefroren|frozen|getrocknet|trocken|pulver)\b/.test(n))return null;
    if(/wrap|tortilla/.test(n))return 'wrap';
    if(/brot|brotchen|toast|pita|pide|baguette/.test(n))return 'bread';
    if(/hahnchen|pute|rind|schwein|mett|hackfleisch|huhner|geflugel/.test(n))return 'meat';
    if(/quark|skyr|joghurt|yoghurt|frischkase|huttenkase|hirtenkase|feta|mozzarella|ricotta|milch|kefir|ayran|schmand|sahne/.test(n))return 'dairy';
    if(/\b(dose|konserve|glas)\b/.test(n)&&/\b(mais|bohnen|kichererbsen|erbsen|ananas|tomaten|salsa|passata)\b/.test(n))return 'canned';
    if(/kartoffel|zwiebel|knoblauch/.test(n))return 'durable';
    if(/apfel|birne|kiwi|mango|maracuja|passionsfrucht|passion fruit|kaki|avocado|banane|orange|mandarine|clementine|limette|zitrone|ananas|beere|himbeere|erdbeere|traube|pfirsich|nektarine|pflaume|melone/.test(n))return 'fruit';
    if(/tomate|paprika|gurke|karotte|mohre|zucchini|aubergine|brokkoli|salat|champignon|pilz|radieschen|kohl|spinat|sellerie|kurbis|lauch|krauter|petersilie|schnittlauch/.test(n))return 'vegetable';
    return null;
  }
  function deadline(purchaseDate,kind,{openedOn=null,mhd=null}={}){
    const purchased=iso(purchaseDate),open=iso(openedOn),bestBefore=iso(mhd);
    const constraints=[];
    if(purchased&&['fruit','vegetable','dairy'].includes(kind))constraints.push(shift(purchased,7));
    if(purchased&&kind==='bread')constraints.push(shift(purchased,14));
    if(purchased&&kind==='meat')constraints.push(shift(purchased,2));
    if(open)constraints.push(shift(open,7));
    if(bestBefore)constraints.push(bestBefore);
    return constraints.sort()[0]||null;
  }
  function purchaseAllowed(purchaseDate,mealDate,mealType){
    const purchase=iso(purchaseDate),meal=iso(mealDate);
    if(!purchase||!meal)return false;
    if(meal<purchase)return false;
    if(meal>purchase)return true;
    const weekday=new Date(purchase+'T12:00:00Z').getUTCDay();
    if(weekday===6)return mealType!=='breakfast'; // Sa-Einkauf nach Frühstück.
    if(weekday===3)return mealType==='dinner'; // Mi-Einkauf nach Snack.
    return true; // Sonder-/Zwischeneinkauf: Uhrzeit ungeklärt.
  }
  function afterDeadline(purchaseDate,kind,mealDate,mealType,extras={}){
    const end=deadline(purchaseDate,kind,extras);
    if(!end||!iso(mealDate))return false;
    if(mealDate>end)return true;
    if(mealDate===end&&kind==='dairy'&&iso(purchaseDate)&&shift(purchaseDate,7)===end){
      const day=new Date(end+'T12:00:00Z').getUTCDay();
      if(day===6)return mealType!=='breakfast';
      if(day===3)return mealType==='dinner';
    }
    return false;
  }
  const makeIssue=(type,subject,message,block=false)=>({type,subject:String(subject||''),message,block});
  function gapIssues(gap,products=[]){
    const issues=[],kind=classify(gap),buy=iso(gap?.buyFrom);
    if(!kind||!buy)return issues;
    const uses=Array.isArray(gap.uses)?gap.uses:[];
    for(const use of uses){
      const date=iso(use?.date);
      if(!date)continue;
      if(!purchaseAllowed(buy,date,use?.mealType)){
        issues.push(makeIssue('slot',gap.label,'Einkaufszeitpunkt '+buy+' liegt nach der geplanten '+date+'-Mahlzeit. Erst Einkaufsslot oder Rezept korrigieren.',true));
      }else if(afterDeadline(buy,kind,date,use?.mealType)){
        const frozenOption=kind==='meat';
        issues.push(makeIssue(frozenOption?'freeze':'window',gap.label,
          frozenOption
            ?'Fleisch für '+date+' ist länger als zwei Tage ab geplantem Einkauf '+buy+' eingeteilt: sofort portionieren und einfrieren oder später frisch kaufen.'
            :'Verbrauch am '+date+' liegt außerhalb der zulässigen Frischefrist ab '+buy+'. Kauf aufteilen oder Mahlzeit verschieben.',
          !frozenOption));
      }
    }
    if(['fruit','vegetable','dairy','bread'].includes(kind)){
      const quantity=Number(gap?.missing);
      const unit=norm(gap?.unit);
      const matching=(products||[]).filter(p=>p.active!==false&&gap?.inventory_id
        &&String(p.inventory_id||'')===String(gap.inventory_id));
      const capacities=matching.map(p=>{
        const data=p.product_data||{};
        const q=Number(p.package_quantity??data.package_quantity??data.pieces_per_pack);
        const u=norm(p.package_unit||data.package_unit||(data.pieces_per_pack?'Stück':''));
        return Number.isFinite(q)&&q>0&&u===unit?q:null;
      }).filter(q=>q!==null);
      if(quantity>0&&capacities.length){
        const smallest=Math.min(...capacities);
        const packs=Math.ceil((quantity-1e-8)/smallest);
        const surplus=packs*smallest-quantity;
        if(surplus>0.0001){
          issues.push(makeIssue('pack',gap.label,'Kleinste bekannte Packung: '+smallest+' '+(gap.unit||'')+'; geplanter Bedarf nur '+quantity+' '+(gap.unit||'')+'. Rest '+Number(surplus.toFixed(2))+' nicht verplant. Kleinere Packung/Einzelware wählen oder Restverbrauch innerhalb der Frist einplanen.',true));
        }
      }
    }
    return issues;
  }
  function plannedUses(meals,today){
    const result=[];
    for(const meal of meals||[]){
      if(meal.status==='skipped'||meal.status==='completed'||meal.status==='prepared'||meal.status==='consumed')continue;
      const date=iso(meal.meal_date);
      if(!date||date<today)continue;
      for(const ingredient of meal.ingredients||[]){
        if(!(Number(ingredient.quantity)>0))continue;
        result.push({name:ingredient.name||ingredient.label||'',inventory_id:ingredient.inventory_id||null,
          date,mealType:meal.meal_type||'',quantity:Number(ingredient.quantity),unit:ingredient.unit||''});
      }
    }
    return result;
  }
  function planIssues({meals=[],inventory=[],lots=[],today=null}={}){
    const from=iso(today)||new Date().toISOString().slice(0,10);
    const uses=plannedUses(meals,from),issues=[],stocks=new Map(inventory.map(i=>[String(i.id),i]));
    const emitted=new Set();
    // V916: A legacy opened remainder is NOT proof the user has failed to
    // review that product. Opening and purchase metadata may exist in notes,
    // prior user decisions, or pre-tracking stock; do not re-open a blanket
    // missing-date warning for every old lot. Future opening transitions are
    // dated at write time. Known MHD / time conflicts remain checked below.
    for(const use of uses){
      if(!use.inventory_id)continue;
      const stock=stocks.get(String(use.inventory_id));
      if(!stock||!(Number(stock.quantity)>0))continue;
      const kind=classify(stock)||classify(use);
      if(!kind||kind==='durable'||kind==='wrap')continue;
      const relevant=lots.filter(l=>String(l.inventory_id)===String(use.inventory_id)
        &&((Number(l.unopened_packages)>0)||(Number(l.opened_remaining_quantity)>0)));
      if(!relevant.length)continue;
      const eligibility=relevant.map(lot=>{
        const frozen=/tk|tiefkuhl|gefrier|freezer/i.test(String(lot.storage_location||''));
        if(frozen)return {safe:true,known:true};
        const open=lot.batch_data?.opened_at||lot.batch_data?.opened_on||lot.opened_at||null;
        const bought=lot.purchased_on||null;
        const mhd=lot.best_before_date||null;
        const end=deadline(bought,kind,{openedOn:open,mhd});
        if(!end)return {safe:false,known:false};
        return {safe:!afterDeadline(bought,kind,use.date,use.mealType,{openedOn:open,mhd})
          &&(!iso(bought)||purchaseAllowed(bought,use.date,use.mealType)),known:true};
      });
      if(eligibility.some(x=>x.safe)||eligibility.some(x=>!x.known))continue;
      const key=use.inventory_id+'|'+use.date;
      if(emitted.has(key))continue;
      emitted.add(key);
      issues.push(makeIssue('lot',stock.name||use.name,'Am '+use.date+' geplant, aber alle datierten vorhandenen Chargen überschreiten Frischefrist/MHD oder wurden erst später gekauft. Charge und Einkauf vor der Zubereitung prüfen.',true));
    }
    return issues;
  }
  function stockupIssues(row,uses){
    const general=row?.general||{};
    if(general.source!=='food-stockup')return [];
    const kind=classify(row);
    // Confirmed shelf-stable staples / frozen reserve are a separate long-term stock policy (#200).
    if(!['fruit','vegetable','dairy','bread','meat','canned'].includes(kind))return [];
    const label=norm(row.label),future=(uses||[]).filter(u=>u.date&&u.date>=(iso(general.needed_by)||'0000-00-00'));
    const comparable=future.filter(use=>{
      const n=norm(use.name);
      return label===n||label.includes(n)&&n.length>=5||n.includes(label)&&label.length>=5;
    });
    if(comparable.length)return [];
    return [makeIssue('unused',row.label,'Dieser automatische Vorratskauf hat keinen nachgewiesenen zukünftigen Rezeptbedarf. Nicht in den Wagen legen, bis ein passender Verbrauch eingeplant ist.',true)];
  }
  function auditPlan(data){
    const issues=planIssues(data);
    const gaps=Array.isArray(data.gaps)?data.gaps:[];
    for(const gap of gaps)issues.push(...gapIssues(gap,data.products||[]));
    const unique=new Map();
    for(const issue of issues)unique.set([issue.type,issue.subject,issue.message].join('|'),issue);
    return [...unique.values()];
  }
  return Object.freeze({classify,deadline,purchaseAllowed,afterDeadline,gapIssues,
    plannedUses,planIssues,stockupIssues,auditPlan,shift});
});

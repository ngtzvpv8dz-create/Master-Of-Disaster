/* V553 · FINANZEN · Supabase-Datenanbindung
   Ergänzt die V552-Terminaloberfläche um echte, persistente Finanzdaten.
*/
(function(){
  'use strict';
  if(window.__modFinanceDataV553)return;

  const VERSION='V553';
  const ROOT_ID='modFinanceV552';
  const REQUEST_TIMEOUT_MS=5000;
  let loadPromise=null;
  let rootObserver=null;
  let bodyObserver=null;
  let state={loaded:false,loading:false,error:null,userId:null,monthTransactions:[],recentTransactions:[]};

  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const num=value=>Number.isFinite(Number(value))?Number(value):0;

  function client(){
    try{
      if(typeof window.getSupabaseClient==='function')return window.getSupabaseClient();
      if(typeof getSupabaseClient==='function')return getSupabaseClient();
    }catch(_){}
    return null;
  }

  function withTimeout(promise,label,ms=REQUEST_TIMEOUT_MS){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' hat zu lange gebraucht.')),ms);})
    ]);
  }

  function todayIso(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  }

  function monthRange(){
    const parts=todayIso().split('-').map(Number);
    const year=parts[0];
    const month=parts[1];
    const start=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-01';
    const next=new Date(Date.UTC(year,month,1));
    return {start,end:next.toISOString().slice(0,10),year,month};
  }

  function monthLabel(){
    const range=monthRange();
    try{
      return new Intl.DateTimeFormat('de-DE',{month:'short',year:'numeric',timeZone:'Europe/Berlin'})
        .format(new Date(range.start+'T12:00:00Z')).replace('.','').toUpperCase();
    }catch(_){return range.start.slice(0,7);}
  }

  function todayLabel(){
    try{return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date()).toUpperCase();}
    catch(_){return 'AKTUELL';}
  }

  function fmtMoney(value,currency='EUR'){
    if(value===null||value===undefined||Number.isNaN(Number(value)))return '—';
    try{return new Intl.NumberFormat('de-DE',{style:'currency',currency:currency||'EUR'}).format(Number(value));}
    catch(_){return Number(value).toFixed(2)+' '+(currency||'EUR');}
  }

  function fmtDate(value){
    if(!value)return '';
    try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(value+'T12:00:00Z'));}
    catch(_){return value;}
  }

  const fmtTime=value=>value?String(value).slice(0,5):'';

  function isOpen(){
    const root=document.getElementById(ROOT_ID);
    return !!root&&document.body.classList.contains('mod-finance-v552')&&root.getAttribute('aria-hidden')!=='true';
  }

  function summarize(){
    let income=0;
    let expenses=0;
    let discounts=0;
    let deposits=0;
    (state.monthTransactions||[]).forEach(row=>{
      const amount=num(row.total_amount);
      if(row.transaction_type==='income')income+=amount;
      if(row.transaction_type==='expense')expenses+=amount;
      discounts+=num(row.discount_total);
      deposits+=num(row.deposit_total);
    });
    return {income,expenses,cashflow:income-expenses,discounts,deposits,count:(state.monthTransactions||[]).length};
  }

  function chartModel(){
    const range=monthRange();
    const days=new Date(Date.UTC(range.year,range.month,0)).getUTCDate();
    const daily=Array.from({length:days},()=>0);
    (state.monthTransactions||[]).forEach(row=>{
      const day=Number(String(row.transaction_date||'').slice(8,10));
      if(!day||day>days)return;
      if(row.transaction_type==='income')daily[day-1]+=num(row.total_amount);
      else if(row.transaction_type==='expense')daily[day-1]-=num(row.total_amount);
    });
    let running=0;
    const cumulative=daily.map(value=>(running+=value));
    const min=Math.min(0,...cumulative);
    const max=Math.max(0,...cumulative);
    const spread=Math.max(1,max-min);
    const width=1000;
    const height=180;
    const pad=14;
    const y=value=>pad+(max-value)/spread*(height-pad*2);
    const points=cumulative.map((value,index)=>{
      const x=days<=1?0:index/(days-1)*width;
      return x.toFixed(1)+','+y(value).toFixed(1);
    }).join(' ');
    return {days,points,zeroY:y(0).toFixed(1),hasData:(state.monthTransactions||[]).length>0};
  }

  function categoryModel(){
    const totals=new Map();
    const add=(label,value)=>{
      const amount=num(value);
      if(amount<=0)return;
      const key=String(label||'Sonstiges').trim()||'Sonstiges';
      totals.set(key,(totals.get(key)||0)+amount);
    };

    (state.monthTransactions||[]).filter(row=>row.transaction_type==='expense').forEach(row=>{
      const items=Array.isArray(row.finance_items)?row.finance_items:[];
      if(!items.length){
        add(row.category||'Sonstiges',row.total_amount);
        return;
      }
      let assigned=0;
      items.forEach(item=>{
        const itemAmount=num(item.total_price);
        const deposit=num(item.deposit_amount);
        add(item.category||'Sonstiges',itemAmount);
        if(deposit>0)add('Pfand',deposit);
        assigned+=itemAmount+deposit;
      });
      const remainder=num(row.total_amount)-assigned;
      if(remainder>0.009)add('Nicht zugeordnet',remainder);
    });

    const rows=Array.from(totals.entries())
      .map(([label,amount])=>({label,amount}))
      .sort((a,b)=>b.amount-a.amount);
    const total=rows.reduce((sum,row)=>sum+row.amount,0);
    return rows.slice(0,7).map(row=>({...row,share:total?row.amount/total*100:0}));
  }

  function chartHtml(){
    const chart=chartModel();
    if(!chart.hasData){
      return '<div class="finance-chart-v552" aria-label="Noch keine Cashflow-Daten">'+
        '<div class="finance-axis-v552"><span>1</span><span>15</span><span>'+chart.days+'</span></div>'+
        '<div class="finance-chart-empty-v552"><strong>NO DATA</strong><span>Die Datenquelle ist bereit. Mit der ersten Buchung entsteht hier dein Monatsverlauf.</span></div>'+
      '</div>';
    }
    return '<div class="finance-chart-v552 finance-chart-has-data-v553" aria-label="Cashflow-Monatsverlauf">'+
      '<svg class="finance-chart-live-v553" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">'+
        '<line class="finance-chart-zero-v553" x1="0" x2="1000" y1="'+chart.zeroY+'" y2="'+chart.zeroY+'"></line>'+
        '<polyline class="finance-chart-line-v553" points="'+chart.points+'"></polyline>'+
      '</svg>'+
      '<div class="finance-axis-v552"><span>1</span><span>15</span><span>'+chart.days+'</span></div>'+
    '</div>';
  }

  function recentHtml(){
    const rows=state.recentTransactions||[];
    if(!rows.length){
      return '<div class="finance-empty-row-v552"><span>Keine Buchungen vorhanden.</span><small>Der Bereich ist verbunden. Die erste echte Buchung erscheint hier nach dem Speichern.</small></div>';
    }
    return '<div class="finance-recent-v553">'+rows.map(row=>{
      const type=row.transaction_type||'expense';
      const sign=type==='income'?'+':type==='expense'?'−':'↔';
      const amountClass=type==='income'?'is-positive':type==='expense'?'is-negative':'is-neutral';
      const meta=[fmtDate(row.transaction_date),fmtTime(row.transaction_time),row.payment_method].filter(Boolean).join(' · ');
      return '<div class="finance-recent-row-v553">'+
        '<div><strong>'+esc(row.merchant||'Unbekannt')+'</strong><span>'+esc(meta)+'</span></div>'+
        '<b class="'+amountClass+'">'+sign+fmtMoney(row.total_amount,row.currency)+'</b>'+
      '</div>';
    }).join('')+'</div>';
  }

  function categoriesHtml(){
    const rows=categoryModel();
    if(!rows.length){
      return '<div class="finance-empty-row-v552"><span>Noch keine Kategorien auswertbar.</span><small>Einzelartikel werden nach Kategorien ausgewertet, sobald Buchungen vorhanden sind.</small></div>';
    }
    return '<div class="finance-categories-v553">'+rows.map(row=>
      '<div class="finance-category-row-v553">'+
        '<div><span>'+esc(row.label)+'</span><b>'+fmtMoney(row.amount)+'</b></div>'+
        '<i><em style="width:'+Math.max(2,row.share).toFixed(1)+'%"></em></i>'+
      '</div>'
    ).join('')+'</div>';
  }

  function shell(){
    const summary=summarize();
    const currency=(state.monthTransactions[0]&&state.monthTransactions[0].currency)||'EUR';
    const connected=state.loaded&&!state.error;
    const statusText=state.loading?'VERBINDUNG…':state.error?'VERBINDUNGSFEHLER':connected?'SUPABASE · LIVE':'BEREIT';
    const statusClass=state.error?'is-error':connected?'is-connected':'';
    const errorHtml=state.error?'<div class="finance-alert-v553"><strong>DATENFEHLER</strong><span>'+esc(state.error)+'</span></div>':'';
    const cashflowClass=summary.cashflow>0?'is-positive':summary.cashflow<0?'is-negative':'';

    return '<div class="finance-terminal-v552">'+
      '<div class="finance-topline-v552" aria-hidden="true"><span>MOD FINANCE</span><span class="finance-live-v552"><i></i> '+(state.loading?'SYNC':'BEREIT')+'</span><span>'+todayLabel()+'</span></div>'+
      '<header class="finance-hero-v552"><div><span class="finance-kicker-v552">FINANZZENTRALE</span><h2>MONEY DESK</h2><p>Ausgaben, Einnahmen und Monatsverlauf auf einen Blick.</p></div><div class="finance-status-v552 '+statusClass+'"><span>DATENQUELLE</span><strong>'+statusText+'</strong></div></header>'+
      errorHtml+
      '<div class="finance-ticker-v552" aria-label="Finanzkennzahlen">'+
        '<div><span>MONAT</span><strong>'+monthLabel()+'</strong></div>'+
        '<div><span>EINNAHMEN</span><strong class="is-positive">'+(connected?fmtMoney(summary.income,currency):'—')+'</strong></div>'+
        '<div><span>AUSGABEN</span><strong class="is-negative">'+(connected?fmtMoney(summary.expenses,currency):'—')+'</strong></div>'+
        '<div><span>CASHFLOW</span><strong class="'+cashflowClass+'">'+(connected?fmtMoney(summary.cashflow,currency):'—')+'</strong></div>'+
        '<div><span>FREI</span><strong>—</strong></div>'+
      '</div>'+
      '<div class="finance-grid-v552">'+
        '<section class="finance-panel-v552 finance-chart-panel-v552"><div class="finance-panel-head-v552"><div><span>01 · CASHFLOW</span><h3>Monatsverlauf</h3></div><small>LIVE VIEW</small></div>'+chartHtml()+'</section>'+
        '<section class="finance-panel-v552 finance-score-panel-v552"><div class="finance-panel-head-v552"><div><span>02 · STATUS</span><h3>Monat</h3></div><small>EUR</small></div><div class="finance-score-v552"><strong class="'+cashflowClass+'">'+(connected?fmtMoney(summary.cashflow,currency):'—')+'</strong><span>Saldo</span></div><div class="finance-mini-stats-v552"><div><span>Buchungen</span><b>'+(connected?String(summary.count):'—')+'</b></div><div><span>Rabatte</span><b>'+(connected?fmtMoney(summary.discounts,currency):'—')+'</b></div><div><span>Pfand</span><b>'+(connected?fmtMoney(summary.deposits,currency):'—')+'</b></div></div></section>'+
        '<section class="finance-panel-v552 finance-list-panel-v552"><div class="finance-panel-head-v552"><div><span>03 · BUCHUNGEN</span><h3>Letzte Bewegungen</h3></div><small>RECENT</small></div>'+recentHtml()+'</section>'+
        '<section class="finance-panel-v552 finance-list-panel-v552"><div class="finance-panel-head-v552"><div><span>04 · KATEGORIEN</span><h3>Ausgabenstruktur</h3></div><small>SPLIT</small></div>'+categoriesHtml()+'</section>'+
      '</div>'+
      '<footer class="finance-footer-v552"><span><i></i> '+(connected?'Supabase verbunden':'Oberfläche bereit')+'</span><span>'+VERSION+' · LIVE DATA</span></footer>'+
    '</div>';
  }

  function render(){
    if(!isOpen())return false;
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    root.innerHTML=shell();
    return true;
  }

  async function remoteData(){
    const supabase=client();
    if(!supabase)throw new Error('Supabase-Client ist nicht verfügbar.');
    const sessionResult=await withTimeout(supabase.auth.getSession(),'Anmeldung',3000);
    const user=sessionResult?.data?.session?.user;
    if(sessionResult?.error)throw sessionResult.error;
    if(!user?.id)throw new Error('Keine aktive Cloud-Sitzung.');

    const range=monthRange();
    const monthQuery=supabase.from('finance_transactions')
      .select('id,transaction_date,transaction_time,merchant,location,total_amount,currency,payment_method,transaction_type,category,receipt_source,discount_total,deposit_total,notes,finance_items(id,item_name,quantity,unit,unit_price,total_price,category,subcategory,discount_amount,deposit_amount,sort_order)')
      .gte('transaction_date',range.start)
      .lt('transaction_date',range.end)
      .order('transaction_date',{ascending:false})
      .order('transaction_time',{ascending:false});

    const recentQuery=supabase.from('finance_transactions')
      .select('id,transaction_date,transaction_time,merchant,total_amount,currency,payment_method,transaction_type,category,receipt_source,discount_total,deposit_total')
      .order('transaction_date',{ascending:false})
      .order('transaction_time',{ascending:false})
      .limit(8);

    const [monthResult,recentResult]=await Promise.all([
      withTimeout(monthQuery,'Monatsdaten'),
      withTimeout(recentQuery,'Letzte Buchungen')
    ]);
    if(monthResult?.error)throw monthResult.error;
    if(recentResult?.error)throw recentResult.error;

    return {
      userId:user.id,
      monthTransactions:(monthResult?.data||[]).map(row=>({...row,finance_items:(row.finance_items||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))})),
      recentTransactions:recentResult?.data||[]
    };
  }

  async function load(force=false){
    if(loadPromise&&!force)return loadPromise;
    state={...state,loading:true,error:null};
    render();
    const task=remoteData().then(data=>{
      state={loaded:true,loading:false,error:null,...data};
      if(window.__modFinanceV552)window.__modFinanceV552.dataConnected=true;
      render();
      return state;
    }).catch(error=>{
      console.warn('V553 FINANZEN Daten konnten nicht geladen werden.',error);
      state={...state,loaded:false,loading:false,error:error?.message||String(error)};
      if(window.__modFinanceV552)window.__modFinanceV552.dataConnected=false;
      render();
      return state;
    }).finally(()=>{if(loadPromise===task)loadPromise=null;});
    loadPromise=task;
    return task;
  }

  function activate(){
    if(!isOpen())return false;
    render();
    load(false);
    return true;
  }

  function patchBaseApi(){
    const base=window.__modFinanceV552;
    if(!base||base.__dataPatchedV553)return;
    const baseOpen=base.open?.bind(base);
    base.open=function(){
      const result=baseOpen?.(...arguments);
      setTimeout(activate,0);
      return result;
    };
    base.render=render;
    base.refresh=()=>load(true);
    base.version=VERSION;
    base.storage='supabase';
    base.dataConnected=false;
    base.__dataPatchedV553=true;
    window.__modFinanceV553=base;
  }

  function attachObservers(){
    patchBaseApi();
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    rootObserver?.disconnect?.();
    bodyObserver?.disconnect?.();
    rootObserver=new MutationObserver(()=>{if(isOpen())setTimeout(activate,0);});
    rootObserver.observe(root,{attributes:true,attributeFilter:['aria-hidden']});
    bodyObserver=new MutationObserver(()=>{if(isOpen())setTimeout(activate,0);});
    bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    if(isOpen())activate();
    return true;
  }

  const api={version:VERSION,activate,load,render,getState:()=>structuredClone(state)};
  window.__modFinanceDataV553=api;

  function init(){
    if(attachObservers())return;
    const wait=new MutationObserver(()=>{
      if(attachObservers())wait.disconnect();
    });
    wait.observe(document.documentElement,{subtree:true,childList:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
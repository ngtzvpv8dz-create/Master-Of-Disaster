/* V553 · FINANZEN · Supabase-Datenanbindung
   Ergänzt die V552-Terminaloberfläche um echte, persistente Finanzdaten.
*/
(function(){
  'use strict';
  if(window.__modFinanceDataV555)return;

  const VERSION='V691';
  const ROOT_ID='modFinanceV552';
  const REQUEST_TIMEOUT_MS=9000;
  let loadPromise=null;
  let visibleRefreshTimer=null;
  let rootObserver=null;
  let bodyObserver=null;
  let state={loaded:false,loading:false,error:null,userId:null,currentBalance:null,periodMode:'month',periodTransactions:[],pendingTransactions:[],notVisibleTransactions:[]};
  const expandedTransactions=new Set();
  const expandedCategories=new Set();

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

  function yearRange(){
    const year=Number(todayIso().slice(0,4));
    return {start:String(year).padStart(4,'0')+'-01-01',end:String(year+1).padStart(4,'0')+'-01-01',year};
  }

  function periodSpec(mode=state.periodMode){
    if(mode==='year'){
      const range=yearRange();
      return {mode:'year',start:range.start,end:range.end,label:String(range.year),title:'Jahresverlauf'};
    }
    if(mode==='all')return {mode:'all',start:null,end:null,label:'GESAMT',title:'Gesamtverlauf'};
    const range=monthRange();
    return {mode:'month',start:range.start,end:range.end,label:monthLabel(),title:'Monatsverlauf'};
  }

  function periodRows(){
    return state.periodTransactions||[];
  }

  function setPeriodMode(mode){
    if(!['month','year','all'].includes(mode)||mode===state.periodMode)return false;
    state={...state,periodMode:mode,periodTransactions:[],loading:true,error:null};
    expandedTransactions.clear();
    expandedCategories.clear();
    try{localStorage.setItem('mod.finance.period.v691',mode);}catch(_){}
    render();
    load(true);
    return true;
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

  function bookingImpact(row){
    const amount=num(row?.total_amount);
    if(row?.transaction_type==='income')return amount;
    if(row?.transaction_type==='expense')return -amount;
    return 0;
  }

  function fmtImpact(value,currency='EUR'){
    const amount=num(value);
    return (amount>=0?'+':'−')+fmtMoney(Math.abs(amount),currency);
  }

  function openBalanceModel(){
    const pending=state.pendingTransactions||[];
    const notVisible=state.notVisibleTransactions||[];
    const pendingImpact=pending.reduce((sum,row)=>sum+bookingImpact(row),0);
    const notVisibleImpact=notVisible.reduce((sum,row)=>sum+bookingImpact(row),0);
    const current=num(state.currentBalance);
    return {
      pendingCount:pending.length,
      notVisibleCount:notVisible.length,
      pendingImpact,
      notVisibleImpact,
      afterPending:current+pendingImpact,
      afterAll:current+pendingImpact+notVisibleImpact
    };
  }

  function bookingTagHtml(row){
    const tags=[];
    if(row?.booking_status==='pending')tags.push('<small class="finance-booking-tag-v679 is-pending">VORGEMERKT</small>');
    if(row?.category==='Testgutschrift'&&/schwarz payment/i.test(String(row?.merchant||''))&&Math.abs(num(row?.total_amount)-0.01)<0.0001)tags.push('<small class="finance-booking-tag-v679 is-work">TESTBUCHUNG · LIDL APP</small>');
    if(row?.booking_status==='not_visible')tags.push('<small class="finance-booking-tag-v679 is-not-visible">NOCH NICHT BANKSEITIG</small>');
    if(row?.work_related)tags.push('<small class="finance-booking-tag-v679 is-work">ARBEIT</small>');
    if(row?.reimbursement_expected)tags.push('<small class="finance-booking-tag-v679 is-reimbursement">ERSTATTUNG OFFEN</small>');
    return tags.length?'<div class="finance-booking-tags-v679">'+tags.join('')+'</div>':'';
  }

  function isOpen(){
    const root=document.getElementById(ROOT_ID);
    return !!root&&document.body.classList.contains('mod-finance-v552')&&root.getAttribute('aria-hidden')!=='true';
  }

  function summarize(){
    let income=0,expenses=0,expenseCount=0,incomeCount=0;
    periodRows().forEach(row=>{
      const amount=num(row.total_amount);
      if(row.transaction_type==='income'){income+=amount;incomeCount+=1;}
      if(row.transaction_type==='expense'){expenses+=amount;expenseCount+=1;}
    });
    return {income,expenses,cashflow:income-expenses,balance:num(state.currentBalance),count:periodRows().length,expenseCount,incomeCount};
  }

  function chartModel(){
    const rows=periodRows();
    const spec=periodSpec();
    let buckets=[];
    let axisLabels=['','',''];

    if(spec.mode==='month'){
      const range=monthRange();
      const days=new Date(Date.UTC(range.year,range.month,0)).getUTCDate();
      buckets=Array.from({length:days},()=>0);
      rows.forEach(row=>{
        const day=Number(String(row.transaction_date||'').slice(8,10));
        if(day>=1&&day<=days)buckets[day-1]+=bookingImpact(row);
      });
      axisLabels=['1',String(Math.ceil(days/2)),String(days)];
    }else if(spec.mode==='year'){
      buckets=Array.from({length:12},()=>0);
      rows.forEach(row=>{
        const month=Number(String(row.transaction_date||'').slice(5,7));
        if(month>=1&&month<=12)buckets[month-1]+=bookingImpact(row);
      });
      axisLabels=['JAN','JUN','DEZ'];
    }else{
      const monthMap=new Map();
      rows.forEach(row=>{
        const key=String(row.transaction_date||'').slice(0,7);
        if(!/^\d{4}-\d{2}$/.test(key))return;
        monthMap.set(key,(monthMap.get(key)||0)+bookingImpact(row));
      });
      const keys=Array.from(monthMap.keys()).sort();
      buckets=keys.map(key=>monthMap.get(key)||0);
      const short=key=>key?key.slice(5,7)+'/'+key.slice(2,4):'';
      if(keys.length){
        axisLabels=[short(keys[0]),short(keys[Math.floor((keys.length-1)/2)]),short(keys[keys.length-1])];
      }else axisLabels=['START','','HEUTE'];
    }

    if(!buckets.length)buckets=[0];
    let running=0;
    const cumulative=buckets.map(value=>(running+=value));
    const min=Math.min(0,...cumulative);
    const max=Math.max(0,...cumulative);
    const spread=Math.max(1,max-min);
    const width=1000;
    const height=180;
    const pad=14;
    const y=value=>pad+(max-value)/spread*(height-pad*2);
    const points=cumulative.map((value,index)=>{
      const x=cumulative.length<=1?500:index/(cumulative.length-1)*width;
      return x.toFixed(1)+','+y(value).toFixed(1);
    }).join(' ');
    return {points,zeroY:y(0).toFixed(1),hasData:rows.length>0,axisLabels,title:spec.title};
  }

  function categoryModel(){
    const groups=new Map();
    const ensure=(key,label,kind='spend')=>{
      if(!groups.has(key))groups.set(key,{key,label,kind,amount:0,details:[]});
      return groups.get(key);
    };
    const add=(key,label,kind,amount,detail)=>{
      const value=num(amount);
      if(value<=0)return;
      const group=ensure(key,label,kind);
      group.amount+=value;
      group.details.push({...detail,amount:value,kind});
    };
    const transactionMeta=row=>({
      merchant:row.merchant||'Unbekannt',
      date:row.transaction_date||null,
      time:row.transaction_time||null,
      currency:row.currency||'EUR',
      transactionId:row.id
    });

    periodRows().filter(row=>row.transaction_type==='expense').forEach(row=>{
      const items=Array.isArray(row.finance_items)?row.finance_items:[];
      const txMeta=transactionMeta(row);
      let assigned=0,itemDiscounts=0,itemDeposits=0,itemDepositReturns=0;

      if(items.length){
        items.forEach(item=>{
          const itemAmount=num(item.total_price);
          const deposit=num(item.deposit_amount);
          const depositReturn=num(item.deposit_return_amount);
          const discount=num(item.discount_amount);
          const label=String(item.category||row.category||'Sonstiges').trim()||'Sonstiges';
          const detail={...txMeta,name:item.item_name||label,category:label,subcategory:item.subcategory||null,quantity:item.quantity,unit:item.unit,sortOrder:item.sort_order||0};
          add('cat:'+label,label,'spend',itemAmount,detail);
          if(deposit>0)add('special:deposit-paid','Pfand bezahlt','deposit-paid',deposit,detail);
          if(depositReturn>0)add('special:deposit-returned','Pfand zurückbekommen','deposit-returned',depositReturn,detail);
          if(discount>0)add('special:discounts','Rabatte erhalten','discount',discount,detail);
          assigned+=itemAmount+deposit-depositReturn-discount;
          itemDiscounts+=discount;
          itemDeposits+=deposit;
          itemDepositReturns+=depositReturn;
        });
      }else{
        const deposit=num(row.deposit_total);
        const depositReturn=num(row.deposit_return_total);
        const discount=num(row.discount_total);
        const baseAmount=Math.max(0,num(row.total_amount)-deposit+depositReturn+discount);
        const label=String(row.category||'Sonstiges').trim()||'Sonstiges';
        const detail={...txMeta,name:row.merchant||label,category:label,subcategory:null,quantity:null,unit:null,sortOrder:0};
        add('cat:'+label,label,'spend',baseAmount,detail);
        if(deposit>0)add('special:deposit-paid','Pfand bezahlt','deposit-paid',deposit,detail);
        if(depositReturn>0)add('special:deposit-returned','Pfand zurückbekommen','deposit-returned',depositReturn,detail);
        if(discount>0)add('special:discounts','Rabatte erhalten','discount',discount,detail);
        assigned=baseAmount+deposit-depositReturn-discount;
      }

      const depositRemainder=Math.max(0,num(row.deposit_total)-itemDeposits);
      if(items.length&&depositRemainder>0.009){
        add('special:deposit-paid','Pfand bezahlt','deposit-paid',depositRemainder,{...txMeta,name:'Weiteres Pfand',category:'Pfand',subcategory:null,quantity:null,unit:null,sortOrder:999});
        assigned+=depositRemainder;
      }
      const depositReturnRemainder=Math.max(0,num(row.deposit_return_total)-itemDepositReturns);
      if(items.length&&depositReturnRemainder>0.009){
        add('special:deposit-returned','Pfand zurückbekommen','deposit-returned',depositReturnRemainder,{...txMeta,name:'Weitere Pfandrückgabe',category:'Pfand',subcategory:null,quantity:null,unit:null,sortOrder:999});
        assigned-=depositReturnRemainder;
      }
      const discountRemainder=Math.max(0,num(row.discount_total)-itemDiscounts);
      if(discountRemainder>0.009){
        add('special:discounts','Rabatte erhalten','discount',discountRemainder,{...txMeta,name:'Weiterer Rabatt',category:'Rabatt',subcategory:null,quantity:null,unit:null,sortOrder:999});
        assigned-=discountRemainder;
      }

      const unassigned=Math.max(0,num(row.total_amount)-assigned);
      if(unassigned>0.009){
        const label=String(row.category||'Nicht zugeordnet').trim()||'Nicht zugeordnet';
        add('cat:'+label,label,'spend',unassigned,{...txMeta,name:row.merchant||label,category:label,subcategory:null,quantity:null,unit:null,sortOrder:999});
      }
    });

    periodRows().filter(row=>row.transaction_type==='income').forEach(row=>{
      const haystack=[row.category,row.merchant,row.receipt_source,row.notes].filter(Boolean).join(' ').toLowerCase();
      if(!/pfand|leergut/.test(haystack)&&num(row.deposit_total)<=0)return;
      const amount=num(row.deposit_total)>0?num(row.deposit_total):num(row.total_amount);
      add('special:deposit-returned','Pfand zurückbekommen','deposit-returned',amount,{...transactionMeta(row),name:row.merchant||'Pfandrückgabe',category:row.category||'Pfand',subcategory:null,quantity:null,unit:null,sortOrder:0});
    });

    const rows=Array.from(groups.values()).filter(row=>row.amount>0);
    const maxAmount=Math.max(1,...rows.map(row=>row.amount));
    return rows.sort((a,b)=>{
      const specialA=a.kind==='spend'?0:1,specialB=b.kind==='spend'?0:1;
      return specialA-specialB||b.amount-a.amount||a.label.localeCompare(b.label,'de');
    }).map(row=>({...row,share:row.amount/maxAmount*100,details:row.details.sort((a,b)=>{
      const dateCompare=String(b.date||'').localeCompare(String(a.date||''));
      if(dateCompare)return dateCompare;
      return (a.sortOrder||0)-(b.sortOrder||0);
    })}));
  }

  function chartHtml(){
    const chart=chartModel();
    const axis='<div class="finance-axis-v552"><span>'+esc(chart.axisLabels[0])+'</span><span>'+esc(chart.axisLabels[1])+'</span><span>'+esc(chart.axisLabels[2])+'</span></div>';
    if(!chart.hasData){
      return '<div class="finance-chart-v552" aria-label="Noch keine Cashflow-Daten">'+axis+
        '<div class="finance-chart-empty-v552"><strong>NO DATA</strong><span>Für diesen Zeitraum sind noch keine Buchungen vorhanden.</span></div>'+
      '</div>';
    }
    return '<div class="finance-chart-v552 finance-chart-has-data-v553" aria-label="'+esc(chart.title)+'">'+
      '<svg class="finance-chart-live-v553" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">'+
        '<line class="finance-chart-zero-v553" x1="0" x2="1000" y1="'+chart.zeroY+'" y2="'+chart.zeroY+'"></line>'+
        '<polyline class="finance-chart-line-v553" points="'+chart.points+'"></polyline>'+
      '</svg>'+axis+
    '</div>';
  }

  function fmtQuantity(quantity,unit){
    if(quantity===null||quantity===undefined||quantity==='')return '';
    const value=Number(quantity);
    if(!Number.isFinite(value))return '';
    let formatted;
    try{formatted=new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(value);}catch(_){formatted=String(value);}
    return [formatted,unit].filter(Boolean).join(' ');
  }

  function transactionDetailHtml(row){
    const items=Array.isArray(row.finance_items)?row.finance_items:[];
    if(!items.length||!expandedTransactions.has(row.id))return '';
    const detailRows=items.map(item=>{
      const meta=[item.category,item.subcategory,fmtQuantity(item.quantity,item.unit)].filter(Boolean).join(' · ');
      const discount=num(item.discount_amount),deposit=num(item.deposit_amount),depositReturn=num(item.deposit_return_amount);
      const extras=[
        deposit>0?'<small class="is-deposit">Pfand +'+fmtMoney(deposit,row.currency)+'</small>':'',
        depositReturn>0?'<small class="is-discount">Pfandrückgabe −'+fmtMoney(depositReturn,row.currency)+'</small>':'',
        discount>0?'<small class="is-discount">Rabatt −'+fmtMoney(discount,row.currency)+'</small>':''
      ].filter(Boolean).join('');
      return '<div class="finance-detail-row-v554"><div class="finance-detail-main-v554"><strong>'+esc(item.item_name||'Position')+'</strong><span>'+esc(meta)+'</span>'+(extras?'<div class="finance-detail-tags-v554">'+extras+'</div>':'')+'</div><b>'+fmtMoney(item.total_price,row.currency)+'</b></div>';
    }).join('');
    const footerBits=[
      items.length+' '+(items.length===1?'Position':'Positionen'),
      num(row.deposit_total)>0?'Pfand bezahlt '+fmtMoney(row.deposit_total,row.currency):'',
      num(row.deposit_return_total)>0?'Pfandrückgabe '+fmtMoney(row.deposit_return_total,row.currency):'',
      num(row.discount_total)>0?'Rabatt '+fmtMoney(row.discount_total,row.currency):''
    ].filter(Boolean).join(' · ');
    return '<div class="finance-transaction-detail-v554" id="finance-tx-'+esc(row.id)+'">'+detailRows+'<div class="finance-detail-footer-v554">'+esc(footerBits)+'</div></div>';
  }

  function recentHtml(){
    const rows=periodRows();
    if(!rows.length)return '<div class="finance-empty-row-v552"><span>Keine Buchungen in diesem Zeitraum.</span><small>Wechsle oben zwischen Monat, Jahr und Gesamt.</small></div>';
    return '<div class="finance-recent-v553">'+rows.map(row=>{
      const type=row.transaction_type||'expense';
      const sign=type==='income'?'+':type==='expense'?'−':'↔';
      const amountClass=type==='income'?'is-positive':type==='expense'?'is-negative':'is-neutral';
      const meta=[fmtDate(row.transaction_date),fmtTime(row.transaction_time),row.payment_method].filter(Boolean).join(' · ');
      const items=Array.isArray(row.finance_items)?row.finance_items:[];
      const expandable=items.length>0,expanded=expandedTransactions.has(row.id);
      const tags=bookingTagHtml(row);
      const rowContent='<div class="finance-recent-main-v554"><strong>'+esc(row.merchant||'Unbekannt')+'</strong><span>'+esc(meta)+'</span>'+tags+'</div><div class="finance-recent-amount-v554"><b class="'+amountClass+'">'+sign+fmtMoney(row.total_amount,row.currency)+'</b>'+(expandable?'<i class="finance-chevron-v554" aria-hidden="true">'+(expanded?'⌃':'⌄')+'</i>':'')+'</div>';
      if(!expandable)return '<div class="finance-recent-entry-v554"><div class="finance-recent-row-v553 is-static">'+rowContent+'</div></div>';
      return '<div class="finance-recent-entry-v554"><button type="button" class="finance-recent-row-v553 finance-toggle-v554" data-finance-transaction-toggle="'+esc(row.id)+'" aria-expanded="'+String(expanded)+'" aria-controls="finance-tx-'+esc(row.id)+'">'+rowContent+'</button>'+transactionDetailHtml(row)+'</div>';
    }).join('')+'</div>';
  }

  function categoryDetailHtml(row){
    if(!expandedCategories.has(row.key))return '';
    return '<div class="finance-category-detail-v554" id="finance-cat-'+esc(row.key)+'">'+row.details.map(detail=>{
      const meta=[detail.merchant,detail.date?fmtDate(detail.date):'',detail.subcategory,fmtQuantity(detail.quantity,detail.unit)].filter(Boolean).join(' · ');
      const amountClass=detail.kind==='discount'||detail.kind==='deposit-returned'?'is-positive':detail.kind==='deposit-paid'?'is-negative':'';
      const prefix=detail.kind==='discount'?'−':detail.kind==='deposit-returned'?'+':'';
      return '<div class="finance-category-detail-row-v554"><div><strong>'+esc(detail.name||row.label)+'</strong><span>'+esc(meta)+'</span></div><b class="'+amountClass+'">'+prefix+fmtMoney(detail.amount,detail.currency)+'</b></div>';
    }).join('')+'</div>';
  }

  function categoriesHtml(){
    const rows=categoryModel();
    if(!rows.length)return '<div class="finance-empty-row-v552"><span>Noch keine Kategorien auswertbar.</span><small>Einzelartikel werden nach Kategorien ausgewertet, sobald Buchungen vorhanden sind.</small></div>';
    return '<div class="finance-categories-v553">'+rows.map(row=>{
      const expanded=expandedCategories.has(row.key);
      const amountClass=row.kind==='discount'||row.kind==='deposit-returned'?'is-positive':row.kind==='deposit-paid'?'is-negative':'';
      return '<div class="finance-category-entry-v554"><button type="button" class="finance-category-row-v553 finance-category-toggle-v554 kind-'+esc(row.kind)+'" data-finance-category-toggle="'+esc(row.key)+'" aria-expanded="'+String(expanded)+'" aria-controls="finance-cat-'+esc(row.key)+'"><div><span>'+esc(row.label)+'</span><span class="finance-category-value-v554"><b class="'+amountClass+'">'+fmtMoney(row.amount)+'</b><i class="finance-chevron-v554" aria-hidden="true">'+(expanded?'⌃':'⌄')+'</i></span></div><i class="finance-category-bar-v554"><em style="width:'+Math.max(2,row.share).toFixed(1)+'%"></em></i></button>'+categoryDetailHtml(row)+'</div>';
    }).join('')+'</div>';
  }

  function shell(){
    const summary=summarize();
    const currency=(state.periodTransactions[0]&&state.periodTransactions[0].currency)||'EUR';
    const connected=state.loaded&&!state.error;
    const statusText=state.loading?'VERBINDUNG…':state.error?'VERBINDUNGSFEHLER':connected?'SUPABASE · LIVE':'BEREIT';
    const statusClass=state.error?'is-error':connected?'is-connected':'';
    const errorHtml=state.error?'<div class="finance-alert-v553"><strong>DATENFEHLER</strong><span>'+esc(state.error)+'</span></div>':'';
    const cashflowClass=summary.cashflow>0?'is-positive':summary.cashflow<0?'is-negative':'';
    const balanceClass=summary.balance>0?'is-positive':summary.balance<0?'is-negative':'';
    const openBalance=openBalanceModel();
    const balanceNotesHtml=connected
      ?'<div class="finance-balance-open-v679">'
        +(openBalance.pendingCount?'<div><span>'+openBalance.pendingCount+' vorgemerkt · '+fmtImpact(openBalance.pendingImpact,currency)+'</span><strong>nach Buchung: '+fmtMoney(openBalance.afterPending,currency)+'</strong></div>':'')
        +(openBalance.notVisibleCount?'<div class="is-soft"><span>+ '+openBalance.notVisibleCount+' noch nicht bankseitig sichtbar · '+fmtImpact(openBalance.notVisibleImpact,currency)+'</span><strong>danach: '+fmtMoney(openBalance.afterAll,currency)+'</strong></div>':'')
      +'</div>'
      :'';

    return '<div class="finance-terminal-v552">'+
      '<div class="finance-topline-v552" aria-hidden="true"><span>MOD FINANCE</span><span class="finance-live-v552"><i></i> '+(state.loading?'SYNC':'BEREIT')+'</span><span>'+todayLabel()+'</span></div>'+
      '<header class="finance-hero-v552"><div><span class="finance-kicker-v552">FINANZZENTRALE</span><h2>MONEY DESK</h2><p>Ausgaben, Einnahmen und Verlauf auf einen Blick.</p></div><div class="finance-status-v552 '+statusClass+'"><span>DATENQUELLE</span><strong>'+statusText+'</strong></div></header>'+
      errorHtml+
      '<div class="finance-period-switch-v691" role="group" aria-label="Finanzzeitraum">'+
        '<button type="button" data-finance-period="month" class="'+(state.periodMode==='month'?'is-active':'')+'">MONAT</button>'+
        '<button type="button" data-finance-period="year" class="'+(state.periodMode==='year'?'is-active':'')+'">JAHR</button>'+
        '<button type="button" data-finance-period="all" class="'+(state.periodMode==='all'?'is-active':'')+'">GESAMT</button>'+
      '</div>'+
      '<div class="finance-ticker-v552" aria-label="Finanzkennzahlen">'+
        '<div><span>ZEITRAUM</span><strong>'+periodSpec().label+'</strong></div>'+
        '<div><span>EINNAHMEN</span><strong class="is-positive">'+(connected?fmtMoney(summary.income,currency):'—')+'</strong></div>'+
        '<div><span>AUSGABEN</span><strong class="is-negative">'+(connected?fmtMoney(summary.expenses,currency):'—')+'</strong></div>'+
        '<div><span>CASHFLOW</span><strong class="'+cashflowClass+'">'+(connected?fmtMoney(summary.cashflow,currency):'—')+'</strong></div>'+
        '<div><span>FREI</span><strong>—</strong></div>'+
      '</div>'+
      '<div class="finance-grid-v552">'+
        '<section class="finance-panel-v552 finance-chart-panel-v552"><div class="finance-panel-head-v552"><div><span>01 · CASHFLOW</span><h3>'+periodSpec().title+'</h3></div><small>LIVE VIEW</small></div>'+chartHtml()+'</section>'+
        '<section class="finance-panel-v552 finance-score-panel-v552"><div class="finance-panel-head-v552"><div><span>02 · STATUS</span><h3>Konto</h3></div><small>AKTUELL</small></div><div class="finance-score-v552"><strong class="'+balanceClass+'">'+(connected?fmtMoney(summary.balance,currency):'—')+'</strong><span>Saldo</span></div>'+balanceNotesHtml+'<div class="finance-mini-stats-v552"><div><span>Buchungen</span><b>'+(connected?String(summary.count):'—')+'</b></div><div><span>Ausgaben</span><b>'+(connected?String(summary.expenseCount):'—')+'</b></div><div><span>Einnahmen</span><b>'+(connected?String(summary.incomeCount):'—')+'</b></div></div></section>'+
        '<section class="finance-panel-v552 finance-list-panel-v552"><div class="finance-panel-head-v552"><div><span>03 · BUCHUNGEN</span><h3>Alle im Zeitraum</h3></div><small>'+esc(periodSpec().label)+'</small></div>'+recentHtml()+'</section>'+
        '<section class="finance-panel-v552 finance-list-panel-v552"><div class="finance-panel-head-v552"><div><span>04 · KATEGORIEN</span><h3>Ausgaben & Vorteile</h3></div><small>DETAIL</small></div>'+categoriesHtml()+'</section>'+
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

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function remoteDataWithRetry(){
    let lastError=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        return await remoteData();
      }catch(error){
        lastError=error;
        const message=String(error?.message||error||'');
        const transient=/Load failed|Failed to fetch|NetworkError|fetch/i.test(message);
        if(!transient||attempt>1)throw error;
        await sleep(750);
      }
    }
    throw lastError||new Error('Finanzdaten konnten nicht geladen werden.');
  }

  const TRANSACTION_SELECT='id,transaction_date,transaction_time,created_at,merchant,location,total_amount,currency,payment_method,transaction_type,category,receipt_source,discount_total,deposit_total,deposit_return_total,notes,booking_status,bank_reference,work_related,reimbursement_expected,finance_items(id,item_name,quantity,unit,unit_price,total_price,category,subcategory,discount_amount,deposit_amount,deposit_return_amount,sort_order)';

  async function fetchPeriodTransactions(supabase,spec){
    const pageSize=500;
    let from=0;
    const rows=[];
    while(true){
      let query=supabase.from('finance_transactions')
        .select(TRANSACTION_SELECT)
        .order('transaction_date',{ascending:false})
        .order('transaction_time',{ascending:false})
        .order('created_at',{ascending:false})
        .range(from,from+pageSize-1);
      if(spec.start)query=query.gte('transaction_date',spec.start);
      if(spec.end)query=query.lt('transaction_date',spec.end);
      const result=await withTimeout(query,'Buchungen laden',12000);
      if(result?.error)throw result.error;
      const page=result?.data||[];
      rows.push(...page);
      if(page.length<pageSize)break;
      from+=pageSize;
    }
    return rows.map(row=>({...row,finance_items:(row.finance_items||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))}));
  }

  async function remoteData(){
    const supabase=client();
    if(!supabase)throw new Error('Supabase-Client ist nicht verfügbar.');
    const sessionResult=await withTimeout(supabase.auth.getSession(),'Anmeldung',3000);
    const user=sessionResult?.data?.session?.user;
    if(sessionResult?.error)throw sessionResult.error;
    if(!user?.id)throw new Error('Keine aktive Cloud-Sitzung.');

    const mode=state.periodMode||'month';
    const spec=periodSpec(mode);
    const periodPromise=fetchPeriodTransactions(supabase,spec);
    const balanceQuery=supabase.rpc('finance_current_balance');
    const openQuery=supabase.from('finance_transactions')
      .select('id,transaction_date,transaction_time,created_at,merchant,location,total_amount,currency,payment_method,transaction_type,category,receipt_source,notes,booking_status,bank_reference,work_related,reimbursement_expected')
      .in('booking_status',['pending','not_visible'])
      .order('transaction_date',{ascending:false})
      .order('created_at',{ascending:false});

    const [periodTransactions,balanceResult,openResult]=await Promise.all([
      periodPromise,
      withTimeout(balanceQuery,'Kontostand'),
      withTimeout(openQuery,'Vorgemerkte Buchungen')
    ]);
    if(balanceResult?.error)throw balanceResult.error;
    if(openResult?.error)throw openResult.error;

    return {
      userId:user.id,
      currentBalance:num(balanceResult?.data),
      periodMode:mode,
      periodTransactions,
      pendingTransactions:(openResult?.data||[]).filter(row=>row.booking_status==='pending'),
      notVisibleTransactions:(openResult?.data||[]).filter(row=>row.booking_status==='not_visible')
    };
  }

  async function load(force=false){
    if(loadPromise&&!force)return loadPromise;
    const requestedMode=state.periodMode||'month';
    const hadData=state.loaded&&state.periodTransactions.length>=0;
    state={...state,loading:true,error:null};
    render();
    const task=remoteDataWithRetry().then(data=>{
      if(data.periodMode!==state.periodMode)return state;
      state={loaded:true,loading:false,error:null,...data};
      if(window.__modFinanceV552)window.__modFinanceV552.dataConnected=true;
      render();
      return state;
    }).catch(error=>{
      console.warn('V691 FINANZEN Daten konnten nicht geladen werden.',error);
      state={...state,loaded:hadData,loading:false,error:hadData?null:(error?.message||String(error))};
      if(window.__modFinanceV552)window.__modFinanceV552.dataConnected=hadData;
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

  function refreshWhenVisible(){
    if(document.visibilityState!=='visible'||!isOpen())return;
    clearTimeout(visibleRefreshTimer);
    visibleRefreshTimer=setTimeout(()=>{
      visibleRefreshTimer=null;
      if(document.visibilityState==='visible'&&isOpen())load(true);
    },450);
  }

  function patchBaseApi(){
    const base=window.__modFinanceV552;
    if(!base||base.__dataPatchedV555)return;
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
    base.__dataPatchedV555=true;
    window.__modFinanceV555=base;
    window.__modFinanceV554=base;
    window.__modFinanceV553=base;
  }

  function toggleExpanded(set,key){
    if(set.has(key))set.delete(key);
    else set.add(key);
    render();
  }

  function attachInteractions(root){
    if(!root||root.dataset.financeInteractionsV554==='true')return;
    root.dataset.financeInteractionsV554='true';
    root.addEventListener('click',event=>{
      const transactionButton=event.target?.closest?.('[data-finance-transaction-toggle]');
      if(transactionButton&&root.contains(transactionButton)){
        toggleExpanded(expandedTransactions,transactionButton.dataset.financeTransactionToggle);
        return;
      }
      const categoryButton=event.target?.closest?.('[data-finance-category-toggle]');
      if(categoryButton&&root.contains(categoryButton)){toggleExpanded(expandedCategories,categoryButton.dataset.financeCategoryToggle);return;}
      const periodButton=event.target?.closest?.('[data-finance-period]');
      if(periodButton&&root.contains(periodButton))setPeriodMode(periodButton.dataset.financePeriod);
    });
  }

  function attachObservers(){
    patchBaseApi();
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    attachInteractions(root);
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
  window.__modFinanceDataV555=api;
  window.__modFinanceDataV554=api;
  window.__modFinanceDataV553=api;

  function init(){
    try{const saved=localStorage.getItem('mod.finance.period.v691');if(['month','year','all'].includes(saved))state.periodMode=saved;}catch(_){}
    document.addEventListener('visibilitychange',refreshWhenVisible);
    window.addEventListener('focus',refreshWhenVisible);
    window.addEventListener('pageshow',refreshWhenVisible);
    if(attachObservers())return;
    const wait=new MutationObserver(()=>{
      if(attachObservers())wait.disconnect();
    });
    wait.observe(document.documentElement,{subtree:true,childList:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
/* V900 · Finanzprognose: vollständiger Rechenweg und periodische Abbuchungen.
   Reine Anzeige: keine Bankbuchung oder neue Planung wird hier erzeugt. */
(function(){
  'use strict';
  if(window.__modFinanceForecastV900)return;

  // Manuell bestätigte/aus Bankbuchungen abgeleitete Rhythmen.
  // Beträge und Ankerdaten stammen aus der Datenbank, nicht aus dieser Liste.
  const RULES=[
    {key:'rent',label:'Kaltmiete',category:'Wohnen / Kaltmiete',merchant:'Michael Würger',months:1},
    {key:'utilities',label:'Betriebskosten',category:'Wohnen / Betriebskosten',merchant:'Michael Würger',months:1},
    {key:'electricity',label:'Strom (EWE)',category:'Energie / Strom',merchant:'EWE Vertrieb GmbH',months:1},
    {key:'internet',label:'Internet (Telefónica)',category:'Internet / Zuhause',merchant:'Telefonica Germany',months:1},
    {key:'prime',label:'Amazon Prime',category:'Abos & Streaming',merchant:'Amazon EU S.à r.l. (Amazon Prime)',months:1},
    {key:'dropbox',label:'Dropbox (bis zur Kündigung)',category:'Digitales / Cloudspeicher',merchant:'Dropbox',months:1},
    {key:'youtube',label:'YouTube Premium',category:'Abos & Streaming',merchant:'YouTube Premium',months:1},
    {key:'fitx',label:'FitX Monatsbeitrag',category:'Fitness / Mitgliedschaft',merchant:'FitX Deutschland',months:1},
    {key:'epoch',label:'Epoch EU Ltd',category:'Sonstiges',merchant:'Epoch EU Ltd',months:1},
    {key:'freenet',label:'freenet',category:'Telekommunikation',merchant:'freenet',months:1},
    {key:'getsafe',label:'Getsafe',category:'Versicherung',merchant:'Getsafe',months:1},
    {key:'netflix',label:'Netflix',category:'Abos & Streaming',merchant:'Netflix.com',months:1},
    {key:'spotify',label:'Spotify',category:'Abos & Streaming',merchant:'Spotify',months:1},
    {key:'icloud',label:'iCloud+',category:'Digitales / Cloudspeicher',merchant:'Apple Services',months:1},
    {key:'chatgpt',label:'ChatGPT über Apple',category:'Digitales / ChatGPT',merchant:'Apple Services',months:1},
    {key:'bankfees',label:'Sparkasse Kontoführung',category:'Bankgebühren',merchant:'Entgeltabrechnung',months:1},
    {key:'broadcast',label:'Rundfunkbeitrag (vierteljährlich)',category:'Rundfunkbeitrag',merchant:'Rundfunk ARD',months:3}
  ];

  function shiftMonths(dateIso,count){
    const p=String(dateIso||'').split('-').map(Number);
    if(p.length!==3||p.some(x=>!Number.isFinite(x)))return null;
    const d=new Date(Date.UTC(p[0],p[1]-1+count,1,12));
    const y=d.getUTCFullYear(),month=d.getUTCMonth();
    const last=new Date(Date.UTC(y,month+1,0)).getUTCDate();
    return [String(y).padStart(4,'0'),String(month+1).padStart(2,'0'),String(Math.min(p[2],last)).padStart(2,'0')].join('-');
  }

  function shiftDays(iso,days){
    const d=new Date(iso+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+days);
    return d.toISOString().slice(0,10);
  }

  function nextAdvance(today){
    const p=today.split('-').map(Number);
    let day=shiftMonths(p[0]+'-'+String(p[1]).padStart(2,'0')+'-20',p[2]>=20?1:0);
    const weekday=new Date(day+'T12:00:00Z').getUTCDay();
    // Abschlag normalerweise ca. 20.; am Wochenende nur vorsichtige Näherung.
    if(weekday===6)day=shiftDays(day,-1);
    if(weekday===0)day=shiftDays(day,-2);
    return day;
  }

  function recurringExpenses(rows,today,cutoff,planned,num){
    const all=[],upcoming=[];
    RULES.forEach(rule=>{
      const list=rows.filter(row=>row.transaction_type==='expense'
        &&row.category===rule.category
        &&String(row.merchant||'').toLocaleLowerCase('de-DE').includes(rule.merchant.toLocaleLowerCase('de-DE'))
        &&['booked','pending','not_visible'].includes(row.booking_status))
        .sort((a,b)=>String(b.transaction_date).localeCompare(String(a.transaction_date)));
      if(!list.length)return;
      const last=list[0];
      // Einmaliger FitX-Zuschlag (Armband) nicht als Abo-Preis hochrechnen.
      const nominal=rule.key==='fitx'
        ?list.find(r=>num(r.total_amount)>0&&num(r.total_amount)<num(last.total_amount))||last
        :last;
      const amount=num(nominal.total_amount);
      if(amount<=0)return;
      let due=null;
      for(let n=1;n<=18;n++){
        const x=shiftMonths(last.transaction_date,n*rule.months);
        if(x&&x>=today){due=x;break;}
      }
      if(!due)return;
      const item={...rule,date:due,amount,observations:list.length,lastDate:last.transaction_date};
      all.push(item);
      if(due>=cutoff)return;
      // Explizite geplante Ausgabe desselben Anbieters am selben Termin
      // soll nicht gleichzeitig als automatisch extrapoliertes Abo erscheinen.
      const duplicate=planned.some(p=>{
        const title=String(p.title||'').toLocaleLowerCase('de-DE');
        const ruleLabel=rule.label.split(' (')[0].toLocaleLowerCase('de-DE');
        return title.includes(ruleLabel)&&Math.abs(Date.parse(p.planned_date)-Date.parse(due))<=7*86400000;
      });
      if(!duplicate)upcoming.push(item);
    });
    const order=(a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label);
    all.sort(order);upcoming.sort(order);
    return {all,upcoming,total:upcoming.reduce((s,r)=>s+r.amount,0)};
  }

  function calculate(state,h){
    const today=h.todayIso();
    const advance=nextAdvance(today);
    const pending=state.pendingTransactions||[];
    const unseen=state.notVisibleTransactions||[];
    const plans=(state.plannedExpenses||[]).filter(r=>r.status==='planned');
    const plansWindow=plans.filter(r=>String(r.planned_date)<advance);
    const pendingImpact=pending.reduce((s,r)=>s+h.bookingImpact(r),0);
    const unseenImpact=unseen.reduce((s,r)=>s+h.bookingImpact(r),0);
    const plannedTotal=plans.reduce((s,r)=>s+h.num(r.amount),0);
    const windowTotal=plansWindow.reduce((s,r)=>s+h.num(r.amount),0);
    const recurring=recurringExpenses(state.recurringTransactions||[],today,advance,plansWindow,h.num);
    const money=v=>Math.round((v+Number.EPSILON)*100)/100;
    const current=h.num(state.currentBalance);
    return {today,advance,pending,unseen,plans,plansWindow,pendingImpact,unseenImpact,plannedTotal,windowTotal,recurring,
      current,afterPending:money(current+pendingImpact),afterAll:money(current+pendingImpact+unseenImpact),
      afterPlans:money(current+pendingImpact+unseenImpact-plannedTotal),
      afterAdvance:money(current+pendingImpact+unseenImpact-windowTotal-recurring.total)};
  }

  function render(state,h){
    if(!state.loaded||state.error)return '';
    if(state.plannedError){
      return h.panelSectionHtml('forecast','03 · PROGNOSE','Finanzvorschau','PLANUNGSFEHLER',
        ()=>'<div class="finance-plan-notice-v826">Geplante Ausgaben konnten nicht geladen werden; eine vollständige Prognose ist derzeit nicht möglich.</div>');
    }
    const m=calculate(state,h),okay=!state.recurringError;
    const fmtMoney=h.fmtMoney,fmtImpact=h.fmtImpact,fmtDate=h.fmtDate,esc=h.esc;
    const row=(label,impact,note='',sub=false)=>
      '<div class="finance-ledger-row-v900'+(sub?' is-sub':'')+'"><div><strong>'+esc(label)+'</strong>'+
      (note?'<span>'+esc(note)+'</span>':'')+'</div><b>'+fmtImpact(impact)+'</b></div>';

    const bankRows=items=>{
      if(!items.length)return '<div class="finance-plan-empty-v826">Keine offenen Bankbewegungen.</div>';
      return items.slice().sort((a,b)=>String(a.transaction_date).localeCompare(String(b.transaction_date))).map(item=>{
        const pieces=(item.finance_items||[]).slice().sort((a,b)=>h.num(a.sort_order)-h.num(b.sort_order));
        return row(item.merchant||'Unbekannter Umsatz',h.bookingImpact(item),fmtDate(item.transaction_date))+
          (pieces.length>1?'<div class="finance-ledger-items-v900">'+pieces.map(p=>
            row(p.item_name,-h.num(p.total_price),'Einzelposition',true)).join('')+'</div>':'');
      }).join('');
    };
    const plannedRows=()=>{
      const erik=m.plans.filter(r=>r.category==='Offen bei Erik');
      const other=m.plans.filter(r=>r.category!=='Offen bei Erik');
      const show=(p,sub)=>row(p.title,-h.num(p.amount),fmtDate(p.planned_date)+' · '+(p.amount_type==='estimate'?'GESCHÄTZT':'FEST'),sub);
      return other.map(p=>show(p,false)).join('')+
        (erik.length?'<div class="finance-ledger-erik-v900"><strong>Offen bei Erik · '+fmtMoney(erik.reduce((s,p)=>s+h.num(p.amount),0))+'</strong><span>Gemeinsame Rückzahlung, noch unbezahlt</span></div>'+erik.map(p=>show(p,true)).join(''):'');
    };
    const group=(heading,count,impact,content,subtotalLabel,total)=>
      '<div class="finance-ledger-group-v900"><div class="finance-ledger-group-head-v900"><span>'+esc(heading)+' · '+count+'</span><strong>'+fmtImpact(impact)+'</strong></div>'+
      content+'<div class="finance-ledger-subtotal-v900"><span>'+esc(subtotalLabel)+'</span><b>'+fmtMoney(total)+'</b></div></div>';
    const extraBroadcast=m.recurring.all.find(r=>r.key==='broadcast');
    const title=okay?'ca. '+fmtMoney(m.afterAdvance):'Hochrechnung offen';
    return h.panelSectionHtml('forecast','03 · PROGNOSE','Finanzvorschau bis zum Abschlag',title,()=>{
      return '<div class="finance-forecast-v826 finance-ledger-v900">'+
        '<div class="finance-ledger-start-v900"><span>AKTUELL GEBUCHTER KONTOSTAND</span><strong>'+fmtMoney(m.current)+'</strong></div>'+
        group('Bei der Bank vorgemerkt',m.pending.length,m.pendingImpact,bankRows(m.pending),'Nach Bankvormerkungen',m.afterPending)+
        group('Bekannt, aber bankseitig noch nicht sichtbar',m.unseen.length,m.unseenImpact,bankRows(m.unseen),'Nach bekannten Ausgaben',m.afterAll)+
        group('Geplante Ausgaben',m.plans.length,-m.plannedTotal,plannedRows(),'Nach allen Planwerten',m.afterPlans)+
        '<div class="finance-ledger-next-v900"><div class="finance-ledger-next-head-v900"><span>REGELMÄSSIGE AUSGABEN BIS ZUM NÄCHSTEN ABSCHLAG</span><strong>voraussichtlich '+fmtDate(m.advance)+'</strong></div>'+
        (okay
          ?(m.recurring.upcoming.length?m.recurring.upcoming.map(item=>
            row(item.label,-item.amount,'ca. '+fmtDate(item.date)+' · '+(item.months===3?'vierteljährlich':'monatlich')+' · aus Bankhistorie')).join('')
            :'<div class="finance-plan-empty-v826">Bis zum Abschlag keine zusätzlichen regelmäßigen Abbuchungen erkannt.</div>')
          :'<div class="finance-plan-notice-v826">Bisherige regelmäßige Abbuchungen konnten nicht geladen werden. Die Hochrechnung wird deshalb nicht als verfügbarer Restbetrag angezeigt.</div>')+
        (okay&&extraBroadcast&&extraBroadcast.date>=m.advance
          ?'<p class="finance-forecast-disclaimer-v826">Rundfunkbeitrag: '+fmtMoney(extraBroadcast.amount)+' voraussichtlich '+fmtDate(extraBroadcast.date)+' (vierteljährlich; diesmal außerhalb des Zeitraums).</p>':'')+
        (m.plans.length!==m.plansWindow.length
          ?'<p class="finance-forecast-disclaimer-v826">Geplante Ausgaben nach dem nächsten Abschlag sind im Gesamtrechenweg enthalten, aber nicht im geschätzten Rest bis zum Abschlag.</p>':'')+
        (okay?'<div class="finance-ledger-surplus-v900"><span>GESCHÄTZTER REST BIS ZUM ABSCHLAG</span><strong>'+fmtMoney(m.afterAdvance)+'</strong><small>Ohne den nächsten Lohnabschlag und ohne noch unbekannte Einkäufe oder Rechnungen.</small></div>'
          :'<div class="finance-ledger-surplus-v900"><span>RESTBETRAG</span><strong>Hochrechnung unvollständig</strong></div>')+
        '</div>'+
        '<p class="finance-forecast-disclaimer-v826">Sichtbare Bankvormerkungen, noch nicht sichtbare Ausgaben, Planwerte und historische Wiederholungen sind getrennt. Die Prognose wird nach jeder Aktualisierung neu berechnet. Rhythmus, Abbuchungsdatum und Betrag können abweichen; insbesondere sind unregelmäßige Einkäufe nicht vorhersagbar.</p>'+
      '</div>';
    });
  }
  window.__modFinanceForecastV900={render,calculate,rules:RULES};
})();
// admin-v15-4-dashboard.js - parte 2/7 de admin-v15-4.js. Tela "Hoje" (admin.html).
// Ver header de admin-v15-4-core.js pras regras do split (escopo compartilhado, sem IIFE).
//
// v29.175.0 — FASE 3 DA REFORMA DO ADMIN: a Visão geral virou a tela "Hoje" (decisão do Juliano,
// 11/09/2026: "no visão geral já é o resumão do dia, eu iria na agenda só quando quisesse consultar
// algo específico"). O que ela junta, e de onde veio cada pedaço:
//   - linha do dia com o card completo da Agenda (v29.171.0) + a pergunta "já cortou aqui antes?"
//     que só existia no Modo Atendimento (v29.98.0) — o Modo Atendimento deixou de existir como
//     tela (admin-atendimento.html redireciona pra cá);
//   - marcador "agora" no meio da fila, pra ver de relance o que já passou e o que falta;
//   - CAIXA DO DIA: o que entrou hoje (serviços líquidos + produtos, só concluídos, mesma conta
//     dos Relatórios/Financeiro: cortesia = 0, prêmio da fidelidade abatido), caixinha à parte,
//     despesas lançadas hoje e a divisão por forma de pagamento — antes o Financeiro era só mensal;
//   - lista de espera de hoje (quem pediu vaga pra hoje), e os clientes com ausência.
  const HOJE_PAGAMENTOS={pix:'Pix',debito:'Débito',credito:'Crédito',dinheiro:'Dinheiro',fidelidade:'Fidelidade'};
  function renderDashboard(){const today=isoLocal(new Date()),tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const tmr=isoLocal(tomorrow),todayRows=allBookings.filter(x=>x.booking_date===today),tomorrowRows=allBookings.filter(x=>x.booking_date===tmr&&['pending','confirmed'].includes(x.status)),completed=todayRows.filter(x=>x.status==='completed'),noShowsToday=todayRows.filter(x=>x.status==='no_show');setText('metric-today',todayRows.filter(x=>x.status!=='cancelled').length);setText('metric-pending',todayRows.filter(x=>x.status==='pending').length);setText('metric-confirmed',todayRows.filter(x=>x.status==='confirmed').length);setText('metric-revenue',money(completed.reduce((a,x)=>a+(x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0)))+Number(x.products_price||0),0)));setText('metric-completed',completed.length);
    // Pedido do Juliano: ticket médio e média de serviços por cliente do dia — mesma
    // lógica de contagem usada no snapshot da JuIA admin (split de combo por "+", telefone
    // normalizado pra distinct clients), só que aqui local, direto dos dados já carregados.
    const completedRevenue=completed.reduce((a,x)=>a+Number(x.service_price||0)+Number(x.products_price||0),0);
    // v29.160.0 (pedido do Juliano, 09/09): caixinhas do dia visíveis ao lado do faturado, mas
    // fora dele — mesma regra do Financeiro (v29.20.0): caixinha é do barbeiro, não da casa.
    const completedTips=completed.reduce((a,x)=>a+Number(x.tip_amount||0),0);
    setText('metric-revenue-sub',completedTips>0?`concluídos · + ${money(completedTips)} de caixinha, à parte`:'concluídos');
    const completedServiceCount=completed.reduce((a,x)=>a+String(x.service_name||'').split('+').map(s=>s.trim()).filter(Boolean).length,0);
    const completedDistinctClients=new Set(completed.map(x=>phoneKey(x.customer_phone)).filter(Boolean)).size;
    setText('metric-ticket-medio',completed.length?money(completedRevenue/completed.length):money(0));
    setText('metric-servicos-cliente',completedDistinctClients?(completedServiceCount/completedDistinctClients).toFixed(1):'0');
    // v29.43.8 (pedido do Juliano, 18/08): quantos SERVIÇOS foram feitos hoje (corte + barba conta 2), além do número de atendimentos.
    setText('metric-servicos-hoje',String(completedServiceCount));
    // v29.46.0 (19/08): card "Cadeira (câmera)" — sessões contadas pela câmera (pessoa na cadeira
    // por 6+ min) x atendimentos concluídos no sistema. Divergência = atendimento não registrado
    // (ou sessão falsa) → pintar de alerta. Heartbeat > 15 min sem sinal = contador parado.
    if($('metric-cadeira')){sb.rpc('chair_day_summary').then(({data,error})=>{
      if(error||!data){setText('metric-cadeira','–');setText('metric-cadeira-sub','sem dados');return}
      const cam=Number(data.chair_sessions||0),aberta=Number(data.chair_open||0),reg=Number(data.bookings_completed||0);
      const seen=data.camera_last_seen?new Date(data.camera_last_seen):null,minAgo=seen?Math.round((Date.now()-seen.getTime())/60000):null;
      setText('metric-cadeira',String(cam)+(aberta?' +1 na cadeira':''));
      const status=minAgo===null?'câmera nunca conectou':minAgo>15?`contador parado há ${minAgo} min`:'câmera ok';
      setText('metric-cadeira-sub',`vs ${reg} registrado${reg===1?'':'s'} · ${status}`);
      const card=$('metric-cadeira-card');if(card){card.classList.toggle('admin-metric-warn',cam!==reg||(minAgo!==null&&minAgo>15))}
    }).catch(()=>{})}
    // v29.48.0 (19/08): card "Alarme" — central(is) EKASA via Tuya Cloud (tuya-watch, 10 min). Mostra modo
    // (armado/casa/desarmado), online, e alertas abertos (offline, sensor sem prova de vida, bateria, disparo).
    if($('metric-alarme')){sb.rpc('alarm_summary').then(({data,error})=>{
      if(error||!data||!Array.isArray(data.hubs)||!data.hubs.length){setText('metric-alarme','–');setText('metric-alarme-sub',error?'sem dados':'nenhuma central vinculada');return}
      const hubs=data.hubs,alerts=Array.isArray(data.open_alerts)?data.open_alerts:[];
      const modeLabel=m=>({armado:'Armado 🔒',casa:'Modo Casa 🏠',desarmado:'Desarmado 🔓'})[m]||(m||'?');
      const main=hubs.length===1?modeLabel(hubs[0].mode):hubs.map(h=>`${h.name}: ${modeLabel(h.mode)}`).join(' · ');
      setText('metric-alarme',main);
      const off=hubs.filter(h=>!h.online).map(h=>h.name);
      // v29.53.1 (20/08): hora da última leitura no card — a central é lida a cada 10 min,
      // então o modo pode estar "atrasado" (caso real: Juliano rearmou 10h10 e o card ficou
      // "Desarmado" até a leitura seguinte, parecendo bug). Com o horário, dá pra ver que é
      // foto de minutos atrás, não estado ao vivo.
      const lastRead=hubs.map(h=>h.last_seen_at?new Date(h.last_seen_at):null).filter(Boolean).sort((a,b)=>b-a)[0];
      const readLabel=lastRead?` · lido às ${String(lastRead.getHours()).padStart(2,'0')}h${String(lastRead.getMinutes()).padStart(2,'0')}`:'';
      const sub=(alerts.length?alerts.map(a=>a.message).join(' · '):(off.length?`offline: ${off.join(', ')}`:`${hubs.length===1?'central online':hubs.length+' centrais online'} · ${hubs.reduce((n,h)=>n+((h.sensors||[]).length),0)} sensores ok`))+readLabel;
      setText('metric-alarme-sub',sub);
      const card=$('metric-alarme-card');if(card){card.classList.toggle('admin-metric-warn',alerts.length>0||off.length>0||hubs.some(h=>h.alarm_on))}
    }).catch(()=>{})}
    setText('metric-noshows',noShowsToday.length);setText('metric-clients',customers.length);setText('metric-tomorrow',tomorrowRows.length);

    // ---- Cabeçalho do dia ----
    const active=todayRows.filter(x=>['pending','confirmed'].includes(x.status)).sort((a,b)=>a.start_time.localeCompare(b.start_time));
    setText('metric-remaining',active.length);
    const agora=new Date(),nowHM=`${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
    const titulo=agora.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    setText('today-title',titulo.charAt(0).toUpperCase()+titulo.slice(1));
    const proximo=active.find(x=>String(x.start_time).slice(0,5)>=nowHM)||null;
    setText('today-sub',!todayRows.filter(x=>x.status!=='cancelled').length?'Nenhum atendimento marcado pra hoje.':`${active.length} restante${active.length===1?'':'s'} · ${completed.length} concluído${completed.length===1?'':'s'}${proximo?` · próximo: ${firstNameOf(proximo.customer_name)} às ${String(proximo.start_time).slice(0,5)}`:active.length?' · o restante já passou do horário':''}`);

    // ---- Linha do dia (card completo da Agenda + pergunta de primeira vez + marcador "agora") ----
    const list=$('dashboard-today-list'),fila=todayRows.filter(x=>x.status!=='cancelled').sort((a,b)=>a.start_time.localeCompare(b.start_time));
    let marcado=false;
    list.innerHTML=fila.length?fila.map(x=>{
      let pre='';
      if(!marcado&&String(x.start_time).slice(0,5)>nowHM){marcado=true;pre=`<div class="admin-now-line"><span>agora · ${nowHM}</span></div>`}
      return pre+bookingCardHtml(x,(typeof primeiraVezHtml==='function'?primeiraVezHtml(x):'')+bookingActionsHtml(x))
    }).join('')+(!marcado&&fila.some(x=>['pending','confirmed'].includes(x.status))?`<div class="admin-now-line is-end"><span>agora · ${nowHM} — os de cima ainda estão em aberto</span></div>`:''):BDJ_UX.empty('Nenhum atendimento para hoje. Dia livre pra balcão, conteúdo e descanso.');
    bindBookingActions(list);
    list.querySelectorAll('[data-firsttime]').forEach(b=>b.onclick=()=>marcarPrimeiraVez(b));

    // ---- Caixa do dia ----
    renderCaixaDoDia(completed,completedTips,today);
    // ---- Lista de espera pra hoje ----
    renderEsperaHoje(today);
    // ---- Clientes com ausência ----
    const alerts=$('dashboard-alerts'),noShows=customers.filter(c=>c.noShows>0).sort((a,b)=>b.noShows-a.noShows).slice(0,5);alerts.innerHTML=noShows.length?noShows.map(c=>`<div class="admin-alert-row"><span>${esc(c.name)}</span><strong>${c.noShows} ausência${c.noShows>1?'s':''}</strong></div>`).join(''):BDJ_UX.empty('Nenhuma ausência registrada.');
    $('today-refresh')?.addEventListener('click',async e=>{const b=e.currentTarget;BDJ_UX.setBusy(b,true,'Atualizando…');try{await loadBaseData();renderDashboard()}finally{BDJ_UX.setBusy(b,false)}},{once:true});
  }
  function firstNameOf(name){return String(name||'').trim().split(/\s+/)[0]||'cliente'}
  // Serviço líquido = mesma regra dos Relatórios (v29.138.0): cortesia não é receita, prêmio da
  // fidelidade é abatido. Produtos entram inteiros. Caixinha nunca entra (é do barbeiro).
  function servicoLiquido(x){return x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0))} // service_price já vem líquido do desconto manual (migration 147)
  function renderCaixaDoDia(completed,tips,today){
    const box=$('today-caixa');if(!box)return;
    const serv=completed.reduce((a,x)=>a+servicoLiquido(x),0),prod=completed.reduce((a,x)=>a+Number(x.products_price||0),0);
    const porForma={};
    completed.forEach(x=>{
      const pm=x.payment_method||'(sem registro)';porForma[pm]=(porForma[pm]||0)+servicoLiquido(x);
      const ppm=x.products_payment_method||x.payment_method||'(sem registro)';porForma[ppm]=(porForma[ppm]||0)+Number(x.products_price||0);
    });
    const formas=Object.entries(porForma).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const balcao=completed.filter(x=>x.channel==='balcao').length;
    box.innerHTML=`<div class="admin-caixa-total"><span>Entrou hoje</span><strong>${money(serv+prod)}</strong><small>${completed.length} atendimento${completed.length===1?'':'s'} concluído${completed.length===1?'':'s'}${balcao?` · ${balcao} sem hora marcada`:''}</small></div>
      <ul class="admin-caixa-rows"><li><span>Serviços</span><b>${money(serv)}</b></li><li><span>Produtos</span><b>${money(prod)}</b></li><li><span>Caixinha (à parte, é sua)</span><b>${money(tips)}</b></li><li id="today-caixa-despesas"><span>Despesas lançadas hoje</span><b>…</b></li></ul>
      <div class="admin-caixa-formas">${formas.length?formas.map(([k,v])=>`<span><small>${esc(HOJE_PAGAMENTOS[k]||(k==='(sem registro)'?'Sem forma registrada':k))}</small><b>${money(v)}</b></span>`).join(''):'<em>Nada concluído ainda.</em>'}</div>
      <a class="admin-caixa-link" href="admin-financeiro.html">Ver o Financeiro do mês →</a>`;
    sb.from('finance_entries').select('amount,category').eq('entry_date',today).then(({data,error})=>{
      const li=$('today-caixa-despesas');if(!li)return;
      if(error){li.querySelector('b').textContent='–';return}
      const total=(data||[]).reduce((a,e)=>a+Number(e.amount||0),0);
      li.querySelector('b').textContent=total?`− ${money(total)}`:money(0);
      if(data&&data.length)li.title=data.map(e=>`${e.category}: ${money(e.amount)}`).join(' · ');
    }).catch(()=>{});
  }
  // Quem está esperando vaga pra HOJE: data exata, janela que cobre hoje, ou dia da semana
  // marcado. Ação fica na Lista de espera (Encaixar), aqui é só o aviso — pra ele lembrar de
  // ligar quando abrir um buraco na fila.
  function renderEsperaHoje(today){
    const box=$('today-waitlist');if(!box)return;
    const wd=new Date(today+'T12:00:00').getDay(),wdNames=['dom','seg','ter','qua','qui','sex','sab'];
    sb.from('waitlist').select('id,customer_name,service_name,preferred_date,preferred_weekdays,preferred_period,window_start,window_end,status').eq('status','esperando').order('created_at',{ascending:true}).then(({data,error})=>{
      if(error){box.innerHTML=BDJ_UX.empty('Não consegui ler a lista de espera.');return}
      const hoje=(data||[]).filter(r=>{
        if(r.preferred_date)return r.preferred_date===today;
        if(r.window_start&&r.window_end)return r.window_start<=today&&today<=r.window_end;
        const wds=Array.isArray(r.preferred_weekdays)?r.preferred_weekdays:[];
        return wds.some(d=>Number(d)===wd||String(d).toLowerCase().slice(0,3)===wdNames[wd]);
      });
      const periodo=p=>({manha:'manhã',tarde:'tarde',qualquer:'qualquer horário'})[p]||p||'';
      box.innerHTML=hoje.length?hoje.map(r=>`<div class="admin-alert-row"><span><strong>${esc(r.customer_name)}</strong><small>${esc(r.service_name||'')}${r.preferred_period?` · ${esc(periodo(r.preferred_period))}`:''}</small></span><a href="admin-espera.html">Encaixar</a></div>`).join(''):BDJ_UX.empty('Ninguém esperando vaga pra hoje.');
    }).catch(()=>{box.innerHTML=BDJ_UX.empty('Não consegui ler a lista de espera.')});
  }

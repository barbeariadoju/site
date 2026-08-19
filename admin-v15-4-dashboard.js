// admin-v15-4-dashboard.js - parte 2/7 de admin-v15-4.js. Modo "dashboard"
// (admin.html). Ver header de admin-v15-4-core.js pras regras do split.
  function renderDashboard(){const today=isoLocal(new Date()),tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const tmr=isoLocal(tomorrow),todayRows=allBookings.filter(x=>x.booking_date===today),tomorrowRows=allBookings.filter(x=>x.booking_date===tmr&&['pending','confirmed'].includes(x.status)),completed=todayRows.filter(x=>x.status==='completed'),noShowsToday=todayRows.filter(x=>x.status==='no_show');setText('metric-today',todayRows.filter(x=>x.status!=='cancelled').length);setText('metric-pending',todayRows.filter(x=>x.status==='pending').length);setText('metric-confirmed',todayRows.filter(x=>x.status==='confirmed').length);setText('metric-revenue',money(completed.reduce((a,x)=>a+Number(x.service_price||0)+Number(x.products_price||0),0)));setText('metric-completed',completed.length);
    // Pedido do Juliano: ticket médio e média de serviços por cliente do dia — mesma
    // lógica de contagem usada no snapshot da JuIA admin (split de combo por "+", telefone
    // normalizado pra distinct clients), só que aqui local, direto dos dados já carregados.
    const completedRevenue=completed.reduce((a,x)=>a+Number(x.service_price||0)+Number(x.products_price||0),0);
    const completedServiceCount=completed.reduce((a,x)=>a+String(x.service_name||'').split('+').map(s=>s.trim()).filter(Boolean).length,0);
    const completedDistinctClients=new Set(completed.map(x=>phoneDigits(x.customer_phone))).size;
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
    setText('metric-noshows',noShowsToday.length);setText('metric-clients',customers.length);setText('metric-tomorrow',tomorrowRows.length);
    // Card colapsável reaproveitado da Agenda (v28.26.0) — pedido do Juliano: poder clicar
    // num atendimento aqui e ver o detalhe completo (pagamento, produtos etc.) sem precisar
    // ir pra tela da Agenda. Ação só tem o link "Ver na agenda" — editar/mudar status continua
    // só na Agenda/Atendimento, o dashboard é só um resumo rápido.
    const list=$('dashboard-today-list'),active=todayRows.filter(x=>x.status!=='cancelled').sort((a,b)=>a.start_time.localeCompare(b.start_time));
    list.innerHTML=active.length?active.map(x=>bookingCardHtml(x,`<a href="admin-agenda.html?data=${x.booking_date}">Ver na agenda</a>`)).join(''):'<div class="admin-empty">Nenhum atendimento para hoje.</div>';
    bindBookingActions(list);
    const alerts=$('dashboard-alerts'),noShows=customers.filter(c=>c.noShows>0).sort((a,b)=>b.noShows-a.noShows).slice(0,5);alerts.innerHTML=noShows.length?noShows.map(c=>`<div class="admin-alert-row"><span>${esc(c.name)}</span><strong>${c.noShows} ausência${c.noShows>1?'s':''}</strong></div>`).join(''):'<div class="admin-empty">Nenhuma ausência registrada.</div>'}

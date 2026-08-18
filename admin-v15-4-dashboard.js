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
    setText('metric-noshows',noShowsToday.length);setText('metric-clients',customers.length);setText('metric-tomorrow',tomorrowRows.length);
    // Card colapsável reaproveitado da Agenda (v28.26.0) — pedido do Juliano: poder clicar
    // num atendimento aqui e ver o detalhe completo (pagamento, produtos etc.) sem precisar
    // ir pra tela da Agenda. Ação só tem o link "Ver na agenda" — editar/mudar status continua
    // só na Agenda/Atendimento, o dashboard é só um resumo rápido.
    const list=$('dashboard-today-list'),active=todayRows.filter(x=>x.status!=='cancelled').sort((a,b)=>a.start_time.localeCompare(b.start_time));
    list.innerHTML=active.length?active.map(x=>bookingCardHtml(x,`<a href="admin-agenda.html?data=${x.booking_date}">Ver na agenda</a>`)).join(''):'<div class="admin-empty">Nenhum atendimento para hoje.</div>';
    bindBookingActions(list);
    const alerts=$('dashboard-alerts'),noShows=customers.filter(c=>c.noShows>0).sort((a,b)=>b.noShows-a.noShows).slice(0,5);alerts.innerHTML=noShows.length?noShows.map(c=>`<div class="admin-alert-row"><span>${esc(c.name)}</span><strong>${c.noShows} ausência${c.noShows>1?'s':''}</strong></div>`).join(''):'<div class="admin-empty">Nenhuma ausência registrada.</div>'}

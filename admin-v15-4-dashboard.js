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
  // v29.187.0 (pedido do Juliano, 12/09/2026, ~15h40): "nesta tela deveria ter a opção de ver a tela de
  // ontem e dos dias anteriores — queria saber quantos serviços fiz ontem e não achei". A tela Hoje
  // passa a andar por dia: ◀ ▶ no cabeçalho, "Voltar pra hoje" quando está em outro dia, e ?dia=AAAA-MM-DD
  // na URL. Tudo que era "hoje" (linha do dia, caixa, despesas, lista de espera, métricas) vira "o dia
  // escolhido"; o marcador "agora", o "próximo" e o texto "restantes" só existem no dia real; câmera e
  // alarme são do momento, não do dia. Atualizar e o Balcão mantêm o dia escolhido.
  let hojeDia=null;
  function diaEscolhido(){const real=isoLocal(new Date());if(!hojeDia){const q=new URLSearchParams(location.search).get('dia');hojeDia=/^\d{4}-\d{2}-\d{2}$/.test(q||'')?q:real}return hojeDia}
  function mudarDia(delta){const d=new Date(diaEscolhido()+'T12:00:00');d.setDate(d.getDate()+delta);hojeDia=isoLocal(d);renderDashboard()}
  function bindDiaNav(){
    const p=$('today-prev'),n=$('today-next'),h=$('today-now');
    if(p&&!p.dataset.bound){p.dataset.bound='1';p.onclick=()=>mudarDia(-1)}
    if(n&&!n.dataset.bound){n.dataset.bound='1';n.onclick=()=>mudarDia(1)}
    if(h&&!h.dataset.bound){h.dataset.bound='1';h.onclick=()=>{hojeDia=isoLocal(new Date());renderDashboard()}}
  }
  function rotuloDia(id,titulo,sub){const el=$(id);const art=el&&el.closest('article');if(!art)return;const s=art.querySelector('span'),m=art.querySelector('small');if(s&&titulo)s.textContent=titulo;if(m&&sub)m.textContent=sub}
  // v29.287.0 — PREVISÃO E META (pedido do Juliano, 09/10/2026: "este campo faturado hoje previsão de
  // faturamento não aparece no mobile… aparecer no mobile pra eu já ver de manhã quanto vou fazer, quanto
  // falta pra minha meta"). No celular a faixa de 4 números esconde o texto pequeno (é o que cabe), e a
  // previsão morava ali. Agora tem bloco próprio, logo abaixo dos números, em qualquer tela:
  //   - previsão do dia escolhido = já entrou + ainda marcado (mesma conta do card, v29.271.0) — em
  //     "Seguinte" vira a previsão de amanhã, que é o que ele quer ver de manhã;
  //   - meta do dia = meta do mês (tabela revenue_goals, R$ 14.100 desde out/2026) ÷ dias que ele atende
  //     no mês (terça a sábado, sem os dias bloqueados inteiros). Sábado conta como dia cheio — conta
  //     simples de propósito, pra ele conferir de cabeça;
  //   - o mês: o que já entrou + o que ainda está marcado daqui pra frente, contra a meta.
  //   v29.287.1: "marcado" no mês confundiu (Juliano, 09/10) — virou "agendado até o fim do mês (N horários)".
  const metaCache={}
  function liquidoAg(x){return x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0)-(['pending','confirmed'].includes(x.status)?Number(x.discount_amount||0):0))+Number(x.products_price||0)}
  function metaDoMes(mes){
    if(!metaCache[mes])metaCache[mes]=Promise.all([
      sb.from('revenue_goals').select('month,revenue_goal').lte('month',mes+'-01').order('month',{ascending:false}).limit(1),
      sb.from('schedule_blocks').select('block_date').eq('all_day',true).gte('block_date',mes+'-01').lte('block_date',mes+'-31')
    ]).then(([g,b])=>{
      if(g.error){delete metaCache[mes];throw g.error}
      const [y,m]=mes.split('-').map(Number),fim=new Date(y,m,0).getDate(),bloq=new Set((b.data||[]).map(r=>r.block_date))
      const dias=[];for(let d=1;d<=fim;d++){const dt=new Date(y,m-1,d),ds=isoLocal(dt);if(dt.getDay()>=2&&!bloq.has(ds))dias.push(ds)}
      return {meta:g.data&&g.data[0]?Number(g.data[0].revenue_goal):0,dias,bloq}
    })
    return metaCache[mes]
  }
  async function renderMetaDoDia(today,ehHoje){
    const box=$('today-meta');if(!box)return
    const mes=today.slice(0,7),realHoje=isoLocal(new Date())
    const doDia=allBookings.filter(x=>x.booking_date===today)
    const entrou=doDia.filter(x=>x.status==='completed').reduce((a,x)=>a+liquidoAg(x),0)
    const marcado=doDia.filter(x=>['pending','confirmed'].includes(x.status)).reduce((a,x)=>a+liquidoAg(x),0)
    const previsao=entrou+marcado
    let info
    try{info=await metaDoMes(mes)}catch(e){console.error('[meta]',e);info={meta:0,dias:[],bloq:new Set()}}
    if(diaEscolhido()!==today)return
    const doMes=allBookings.filter(x=>String(x.booking_date).slice(0,7)===mes)
    const mesEntrou=doMes.filter(x=>x.status==='completed').reduce((a,x)=>a+liquidoAg(x),0)
    const mesFuturos=doMes.filter(x=>x.booking_date>=realHoje&&['pending','confirmed'].includes(x.status))
    const mesMarcado=mesFuturos.reduce((a,x)=>a+liquidoAg(x),0)
    const concl=doMes.filter(x=>x.status==='completed').length,ticket=concl?mesEntrou/concl:70
    const atende=info.dias.includes(today),metaDia=info.meta&&info.dias.length?info.meta/info.dias.length:0
    const quando=ehHoje?'de hoje':today===(()=>{const d=new Date(realHoje+'T12:00:00');d.setDate(d.getDate()+1);return isoLocal(d)})()?'de amanhã':'do dia'
    const pct=v=>metaDia?Math.min(100,Math.round(v/metaDia*100)):0
    let linhaMeta=''
    if(!info.meta)linhaMeta=`<p class="today-meta-msg">Sem meta cadastrada. <button type="button" class="link-btn" data-meta-editar>Definir meta do mês</button></p>`
    else if(!atende)linhaMeta=`<p class="today-meta-msg">${info.bloq.has(today)?'Dia bloqueado':'Dia sem atendimento'} — não entra na conta da meta.</p>`
    else{
      const falta=metaDia-previsao
      const n=Math.ceil(falta/ticket)
      linhaMeta=`<div class="today-meta-bar" role="img" aria-label="Previsão ${money(previsao)} de ${money(metaDia)} da meta do dia"><i class="is-done" style="width:${pct(entrou)}%"></i><i class="is-booked" style="width:${Math.max(0,pct(previsao)-pct(entrou))}%"></i></div>
        <p class="today-meta-msg">${falta>0?`Faltam <b>${money(falta)}</b> pra meta do dia (${money(metaDia)}) — cerca de ${n} atendimento${n===1?'':'s'}.`:`A previsão passa a meta do dia (${money(metaDia)}) em <b>${money(-falta)}</b>.`}</p>`
    }
    const mesNome=new Date(mes+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long'})
    const mesPrev=mesEntrou+mesMarcado,mesFalta=info.meta-mesPrev
    const linhaMes=info.meta?`<div class="today-meta-mes"><div class="today-meta-bar is-thin"><i class="is-done" style="width:${Math.min(100,mesEntrou/info.meta*100)}%"></i><i class="is-booked" style="width:${Math.max(0,Math.min(100,mesPrev/info.meta*100)-Math.min(100,mesEntrou/info.meta*100))}%"></i></div>
      <p><span>${mesNome.charAt(0).toUpperCase()+mesNome.slice(1)}:</span> já entrou ${money(mesEntrou)} + agendados até o fim do mês ${money(mesMarcado)} (${mesFuturos.length} horário${mesFuturos.length===1?'':'s'}) = <b>${money(mesPrev)}</b> de ${money(info.meta)}${mesFalta>0?` · faltam ${money(mesFalta)}`:' · meta do mês coberta'} <button type="button" class="link-btn" data-meta-editar>mudar meta</button></p></div>`:''
    box.innerHTML=`<div class="today-meta-head"><span>Previsão ${quando}</span><strong>${money(previsao)}</strong><small>já entrou ${money(entrou)} · agendados ${money(marcado)}</small></div><div class="today-meta-body">${linhaMeta}${linhaMes}</div>`
    box.querySelectorAll('[data-meta-editar]').forEach(b=>b.onclick=()=>editarMeta(mes,info.meta))
  }
  async function editarMeta(mes,atual){
    const v=await BDJ_UX.prompt(`Meta de faturamento do mês (${mes.slice(5)}/${mes.slice(0,4)}). Vale daqui pra frente até você mudar.`,atual?String(atual).replace('.',','):'',{input:{placeholder:'14100'}})
    if(v==null||v===false)return
    const n=Number(String(v).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))
    if(!(n>0)){BDJ_UX.toast('Digite um valor, por exemplo 14100.','error');return}
    const {error}=await sb.from('revenue_goals').upsert({month:mes+'-01',revenue_goal:n,updated_at:new Date().toISOString()})
    if(error){BDJ_UX.toast(error.message,'error');return}
    Object.keys(metaCache).forEach(k=>delete metaCache[k])
    BDJ_UX.toast(`Meta de ${money(n)} salva.`,'success');renderMetaDoDia(diaEscolhido(),diaEscolhido()===isoLocal(new Date()))
  }
  function renderDashboard(){bindDiaNav();const today=diaEscolhido(),realHoje=isoLocal(new Date()),ehHoje=today===realHoje,tomorrow=new Date(today+'T12:00:00');tomorrow.setDate(tomorrow.getDate()+1);const tmr=isoLocal(tomorrow),todayRows=allBookings.filter(x=>x.booking_date===today),tomorrowRows=allBookings.filter(x=>x.booking_date===tmr&&['pending','confirmed'].includes(x.status)),completed=todayRows.filter(x=>x.status==='completed'),noShowsToday=todayRows.filter(x=>x.status==='no_show');setText('metric-today',todayRows.filter(x=>x.status!=='cancelled').length);setText('metric-pending',todayRows.filter(x=>x.status==='pending').length);setText('metric-confirmed',todayRows.filter(x=>x.status==='confirmed').length);setText('metric-revenue',money(completed.reduce((a,x)=>a+(x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0)))+Number(x.products_price||0),0)));setText('metric-completed',completed.length);
    // Pedido do Juliano: ticket médio e média de serviços por cliente do dia — mesma
    // lógica de contagem usada no snapshot da JuIA admin (split de combo por "+", telefone
    // normalizado pra distinct clients), só que aqui local, direto dos dados já carregados.
    const completedRevenue=completed.reduce((a,x)=>a+Number(x.service_price||0)+Number(x.products_price||0),0);
    // v29.160.0 (pedido do Juliano, 09/09): caixinhas do dia visíveis ao lado do faturado, mas
    // fora dele — mesma regra do Financeiro (v29.20.0): caixinha é do barbeiro, não da casa.
    const completedTips=completed.reduce((a,x)=>a+Number(x.tip_amount||0),0);
    // v29.271.0 (pedido do Juliano, 01/10/2026): previsão do dia = o que já foi faturado + o que ainda está
    // marcado (pendente/confirmado), pelo preço gravado no agendamento, já sem fidelidade, desconto/Clube e
    // cortesia. Não conta ausência nem cancelado. É o "se todo mundo vier".
    const aindaMarcado=todayRows.filter(x=>['pending','confirmed'].includes(x.status)).reduce((a,x)=>a+(x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0)-Number(x.discount_amount||0)))+Number(x.products_price||0),0);
    const faturado=completed.reduce((a,x)=>a+(x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0)))+Number(x.products_price||0),0);
    const previsao=aindaMarcado>0?` · previsão do dia ${money(faturado+aindaMarcado)}`:'';
    setText('metric-revenue-sub',(completedTips>0?`concluídos · + ${money(completedTips)} de caixinha, à parte`:'concluídos')+previsao);
    const completedServiceCount=completed.reduce((a,x)=>a+String(x.service_name||'').split('+').map(s=>s.trim()).filter(Boolean).length,0);
    const completedDistinctClients=new Set(completed.map(x=>phoneKey(x.customer_phone)).filter(Boolean)).size;
    setText('metric-ticket-medio',completed.length?money(completedRevenue/completed.length):money(0));
    setText('metric-servicos-cliente',completedDistinctClients?(completedServiceCount/completedDistinctClients).toFixed(1).replace('.',','):'0');
    // v29.43.8 (pedido do Juliano, 18/08): quantos SERVIÇOS foram feitos hoje (corte + barba conta 2), além do número de atendimentos.
    setText('metric-servicos-hoje',String(completedServiceCount));
    // v29.46.0 (19/08): card "Cadeira (câmera)" — sessões contadas pela câmera (pessoa na cadeira
    // por 6+ min) x atendimentos concluídos no sistema. Divergência = atendimento não registrado
    // (ou sessão falsa) → pintar de alerta. Heartbeat > 15 min sem sinal = contador parado.
    if($('metric-cadeira')){sb.rpc('chair_day_summary').then(({data,error})=>{
      if(error||!data){setText('metric-cadeira','–');setText('metric-cadeira-sub','sem dados');const c0=$('metric-cadeira-card');if(c0)c0.hidden=true;return}
      const cam=Number(data.chair_sessions||0),aberta=Number(data.chair_open||0),reg=Number(data.bookings_completed||0);
      const seen=data.camera_last_seen?new Date(data.camera_last_seen):null,minAgo=seen?Math.round((Date.now()-seen.getTime())/60000):null;
      setText('metric-cadeira',String(cam)+(aberta?' +1 na cadeira':''));
      const status=minAgo===null?'câmera nunca conectou':minAgo>15?`contador parado há ${minAgo} min`:'câmera ok';
      setText('metric-cadeira-sub',`vs ${reg} registrado${reg===1?'':'s'} · ${status}`);
      const card=$('metric-cadeira-card');if(card){card.classList.toggle('admin-metric-warn',cam!==reg||(minAgo!==null&&minAgo>15))}
    }).catch(()=>{})}
    // v29.228.0 (23/09/2026): o card "Alarme" (v29.48.0) saiu — o Juliano voltou para o app da EKASA.
    setText('metric-noshows',noShowsToday.length);setText('metric-clients',customers.length);setText('metric-tomorrow',tomorrowRows.length);

    // ---- Cabeçalho do dia ----
    const active=todayRows.filter(x=>['pending','confirmed'].includes(x.status)).sort((a,b)=>a.start_time.localeCompare(b.start_time));
    setText('metric-remaining',active.length);
    const agora=new Date(),nowHM=ehHoje?`${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`:'99:99';
    const titulo=new Date(today+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    setText('today-title',titulo.charAt(0).toUpperCase()+titulo.slice(1));
    const ontemReal=(()=>{const d=new Date(realHoje+'T12:00:00');d.setDate(d.getDate()-1);return isoLocal(d)})(),amanhaReal=(()=>{const d=new Date(realHoje+'T12:00:00');d.setDate(d.getDate()+1);return isoLocal(d)})();
    setText('today-eyebrow',ehHoje?'Hoje':today===ontemReal?'Ontem':today===amanhaReal?'Amanhã':today<realHoje?'Dia anterior':'Dia seguinte');
    const btnNow=$('today-now');if(btnNow)btnNow.hidden=ehHoje;
    rotuloDia('metric-revenue',ehHoje?'Faturado hoje':'Faturado no dia',null);
    rotuloDia('metric-completed',null,ehHoje?'atendimentos hoje':'atendimentos no dia');
    rotuloDia('metric-servicos-hoje',null,ehHoje?'feitos hoje':'feitos no dia');
    rotuloDia('metric-remaining',null,ehHoje?'ainda por atender':(today<realHoje?'ficaram sem desfecho':'marcados'));
    const proximo=ehHoje?(active.find(x=>String(x.start_time).slice(0,5)>=nowHM)||null):null;
    const resumoOutroDia=`${completed.length} concluído${completed.length===1?'':'s'} · ${noShowsToday.length} ausência${noShowsToday.length===1?'':'s'}${active.length?(today<realHoje?` · ${active.length} sem desfecho registrado`:` · ${active.length} marcado${active.length===1?'':'s'}`):''}`;
    setText('today-sub',!todayRows.filter(x=>x.status!=='cancelled').length?(ehHoje?'Nenhum atendimento marcado pra hoje.':'Nenhum atendimento nesse dia.'):ehHoje?`${active.length} restante${active.length===1?'':'s'} · ${completed.length} concluído${completed.length===1?'':'s'}${proximo?` · próximo: ${firstNameOf(proximo.customer_name)} às ${String(proximo.start_time).slice(0,5)}`:active.length?' · o restante já passou do horário':''}`:resumoOutroDia);

    // ---- Linha do dia (card completo da Agenda + pergunta de primeira vez + marcador "agora") ----
    const list=$('dashboard-today-list'),fila=todayRows.filter(x=>x.status!=='cancelled').sort((a,b)=>a.start_time.localeCompare(b.start_time));
    let marcado=false;
    // v29.188.0 — quem tem prêmio de fidelidade pra usar aparece em cima da fila (caso Juliano
    // Prando, 15/09: fechou 10 pontos na sexta, ninguém viu, e a barba de terça saiu de cabeça).
    const premioHoje=fila.filter(x=>['pending','confirmed'].includes(x.status)&&(typeof loyaltyFor==='function')&&loyaltyFor(x.customer_phone).rewards>0);
    const premioHtml=premioHoje.length?`<div class="admin-day-callout"><b>Prêmio de fidelidade pra usar ${ehHoje?'hoje':'nesse dia'}:</b> ${premioHoje.map(x=>`${esc(x.customer_name)} (${String(x.start_time).slice(0,5)})`).join(', ')} — 1 serviço por nossa conta. No Concluir, "Bônus de fidelidade" já vem marcado.</div>`:'';
    list.innerHTML=premioHtml+(fila.length?fila.map(x=>{
      let pre='';
      if(!marcado&&String(x.start_time).slice(0,5)>nowHM){marcado=true;pre=`<div class="admin-now-line"><span>agora · ${nowHM}</span></div>`}
      return pre+bookingCardHtml(x,(typeof primeiraVezHtml==='function'?primeiraVezHtml(x):'')+bookingActionsHtml(x))
    }).join('')+(ehHoje&&!marcado&&fila.some(x=>['pending','confirmed'].includes(x.status))?`<div class="admin-now-line is-end"><span>agora · ${nowHM} — os de cima ainda estão em aberto</span></div>`:''):BDJ_UX.empty(ehHoje?'Nenhum atendimento para hoje. Dia livre pra balcão, conteúdo e descanso.':'Nenhum atendimento nesse dia.'));
    bindBookingActions(list);
    list.querySelectorAll('[data-firsttime]').forEach(b=>b.onclick=()=>marcarPrimeiraVez(b));

    // ---- Caixa do dia ----
    renderCaixaDoDia(completed,completedTips,today);
    // ---- Previsão e meta (v29.287.0) ----
    renderMetaDoDia(today,ehHoje);
    // ---- Lista de espera pra hoje ----
    renderEsperaHoje(today);
    // ---- Clientes com ausência ----
    const alerts=$('dashboard-alerts'),noShows=customers.filter(c=>c.noShows>0).sort((a,b)=>b.noShows-a.noShows).slice(0,5);alerts.innerHTML=noShows.length?noShows.map(c=>`<div class="admin-alert-row"><span>${esc(c.name)}</span><strong>${c.noShows} ausência${c.noShows>1?'s':''}</strong></div>`).join(''):BDJ_UX.empty('Nenhuma ausência registrada.');
    const bb=$('today-balcao');if(bb&&!bb.dataset.bound){bb.dataset.bound='1';bb.onclick=openBalcaoInline}
    // v29.242.0 — Abrir/Fechar a barbearia (admin-v15-4-expediente.js). Guardado: a tela não pode cair se o módulo não carregar.
    if(typeof renderExpediente==='function')renderExpediente(today,ehHoje).catch(e=>console.error('[expediente]',e));
    $('today-refresh')?.addEventListener('click',async e=>{const b=e.currentTarget;BDJ_UX.setBusy(b,true,'Atualizando…');try{await loadBaseData();renderDashboard()}finally{BDJ_UX.setBusy(b,false)}},{once:true});
  }
  // v29.179.0 — BALCÃO DENTRO DA TELA HOJE (pedido do Juliano: "arruma tudo o que faltou"). O botão
  // "Sem hora marcada" abre o Atendimento Balcão num modal, embutido (admin-balcao.html?embed=1), sem
  // sair da tela: uma implementação só do formulário, e a Hoje se redesenha quando o Balcão avisa
  // (postMessage 'bdj:walkin-saved') que registrou o atendimento.
  function openBalcaoInline(){
    let modal=document.getElementById('balcao-inline-modal');
    if(!modal){
      modal=document.createElement('div');modal.id='balcao-inline-modal';modal.className='admin-modal';modal.hidden=true;
      modal.innerHTML='<div class="admin-modal-backdrop" data-balcao-close></div><section class="admin-modal-card admin-embed-card" role="dialog" aria-modal="true" aria-label="Atendimento sem hora marcada"><header class="admin-embed-head"><strong>Atendimento sem hora marcada</strong><span><a href="admin-balcao.html">Abrir em tela cheia</a><button type="button" data-balcao-close aria-label="Fechar">×</button></span></header><iframe title="Atendimento Balcão" loading="lazy"></iframe></section>';
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-balcao-close]').forEach(x=>x.onclick=()=>{modal.hidden=true});
      window.addEventListener('message',async e=>{if(e.origin!==location.origin||!e.data||e.data.type!=='bdj:walkin-saved')return;await loadBaseData();renderDashboard();BDJ_UX.toast('Atendimento de balcão registrado. A tela Hoje foi atualizada.','success')});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)modal.hidden=true});
    }
    const frame=modal.querySelector('iframe');
    if(!frame.getAttribute('src'))frame.src='admin-balcao.html?embed=1&app=1';
    modal.hidden=false;
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
    const ehHojeCaixa=today===isoLocal(new Date());
    box.innerHTML=`<div class="admin-caixa-total"><span>${ehHojeCaixa?'Entrou hoje':'Entrou nesse dia'}</span><strong>${money(serv+prod)}</strong><small>${completed.length} atendimento${completed.length===1?'':'s'} concluído${completed.length===1?'':'s'}${balcao?` · ${balcao} sem hora marcada`:''}</small></div>
      <ul class="admin-caixa-rows"><li><span>Serviços</span><b>${money(serv)}</b></li><li><span>Produtos</span><b>${money(prod)}</b></li><li><span>Caixinha (à parte, é sua)</span><b>${money(tips)}</b></li><li id="today-caixa-despesas"><span>${ehHojeCaixa?'Despesas lançadas hoje':'Despesas lançadas no dia'}</span><b>…</b></li></ul>
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

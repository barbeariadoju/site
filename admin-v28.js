(()=>{
  const cfg=window.BDJ_AGENDA_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl)return;
  const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const digits=s=>String(s||'').replace(/\D/g,'');
  const localISO=d=>{const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};
  const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const msgLink=(phone,text)=>`https://wa.me/55${digits(phone).replace(/^55/,'')}?text=${encodeURIComponent(text)}`;

  function addNav(){document.querySelectorAll('.admin-sidebar nav').forEach(nav=>{
    if(!nav.querySelector('[data-admin-nav="inteligencia"]')){
      const anchor=nav.querySelector('[data-admin-nav="assistente"]');
      const html='<a data-admin-nav="inteligencia" href="admin-inteligencia.html"><span>◈</span>Inteligência</a><a data-admin-nav="satisfacao" href="admin-satisfacao.html"><span>★</span>Satisfação</a>';
      anchor?anchor.insertAdjacentHTML('beforebegin',html):nav.insertAdjacentHTML('beforeend',html);
    }
  })}

  function protectFutureCompletion(){
    document.addEventListener('click',e=>{
      const btn=e.target.closest('button[data-status="completed"]'); if(!btn)return;
      const card=btn.closest('[data-booking-date],.admin-booking-card,.service-mode-card');
      const selected=document.getElementById('agenda-selected-date')?.dataset?.date || document.getElementById('agenda-date')?.value;
      let date=card?.dataset?.bookingDate||selected;
      const time=card?.querySelector('.admin-booking-time strong,.service-mode-time strong')?.textContent?.trim();
      if(!date||!time)return;
      const when=new Date(`${date}T${time}:00`);
      if(when>Date.now()){
        const ok=confirm(`Este atendimento está marcado para ${when.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})} e ainda não aconteceu.\n\nDeseja realmente marcá-lo como concluído?`);
        if(!ok){e.preventDefault();e.stopImmediatePropagation();}
      }
    },true);
  }

  async function waitSession(){for(let i=0;i<50;i++){const {data:{session}}=await sb.auth.getSession();if(session&&!document.getElementById('admin-app')?.hidden)return session;await new Promise(r=>setTimeout(r,250))}return null}

  async function fetchCore(){
    const since=new Date();since.setMonth(since.getMonth()-6);
    const [{data:bookings,error:bErr},{data:profiles},{data:experiences}]=await Promise.all([
      sb.from('bookings').select('*').gte('booking_date',localISO(since)).order('booking_date',{ascending:false}),
      sb.from('customer_profiles').select('*').eq('archived',false),
      sb.from('experience_requests').select('*').order('created_at',{ascending:false}).limit(500)
    ]);
    if(bErr)throw bErr; return {bookings:bookings||[],profiles:profiles||[],experiences:experiences||[]};
  }

  function dashboardHTML(data){
    const {bookings,profiles,experiences}=data, now=new Date(),today=localISO(now),weekStart=dayStart(now);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
    const completed=bookings.filter(b=>b.status==='completed');
    const revenue=r=>r.reduce((a,b)=>a+Number(b.service_price||0)+Number(b.products_price||0),0);
    const inRange=(b,start)=>new Date(`${b.booking_date}T12:00:00`)>=start;
    const week=completed.filter(b=>inRange(b,weekStart)),month=completed.filter(b=>inRange(b,monthStart));
    const known=new Set();let novos=0,recorrentes=0;completed.slice().sort((a,b)=>a.booking_date.localeCompare(b.booking_date)).forEach(b=>{const p=digits(b.customer_phone);if(new Date(`${b.booking_date}T12:00:00`)>=monthStart){known.has(p)?recorrentes++:novos++}known.add(p)});
    const todayRows=bookings.filter(b=>b.booking_date===today&&!['cancelled'].includes(b.status));
    const occupied=todayRows.reduce((a,b)=>a+Number(b.duration_minutes||0),0),capacity=(now.getDay()===6?420:660),occupation=Math.min(100,Math.round(occupied/capacity*100));
    const failed=experiences.filter(e=>e.status==='failed').length,feedback=experiences.filter(e=>e.status==='feedback').length;
    return `<section class="v28-kpis">
      <article><small>Faturamento semanal</small><strong>${money(revenue(week))}</strong><em>${week.length} atendimentos</em></article>
      <article><small>Faturamento mensal</small><strong>${money(revenue(month))}</strong><em>Ticket ${money(month.length?revenue(month)/month.length:0)}</em></article>
      <article><small>Clientes no mês</small><strong>${novos+recorrentes}</strong><em>${novos} novos · ${recorrentes} retornos</em></article>
      <article><small>Ocupação de hoje</small><strong>${occupation}%</strong><em>${occupied} min reservados</em></article>
      <article><small>Experiência</small><strong>${feedback}</strong><em>${failed?`${failed} falha(s)`:'sem falhas'}</em></article>
      <article><small>Base ativa</small><strong>${profiles.length}</strong><em>clientes cadastrados</em></article>
    </section>`;
  }

  async function enhanceDashboard(){if(document.body.dataset.adminPage!=='dashboard')return;const header=document.querySelector('.admin-page-header');if(!header)return;const box=document.createElement('section');box.className='v28-dashboard';box.innerHTML='<div class="admin-surface">Carregando painel executivo…</div>';header.insertAdjacentElement('afterend',box);try{const data=await fetchCore();box.innerHTML=dashboardHTML(data)}catch(e){box.innerHTML=`<div class="admin-surface">Não foi possível carregar os indicadores: ${esc(e.message)}</div>`}}

  function customerInsights(data){
    const byPhone=new Map();data.bookings.filter(b=>b.status==='completed').forEach(b=>{const p=digits(b.customer_phone);if(!p)return;const x=byPhone.get(p)||{name:b.customer_name,phone:b.customer_phone,email:b.customer_email,last:null,visits:0,total:0,services:new Map(),dates:[]};x.visits++;x.total+=Number(b.service_price||0)+Number(b.products_price||0);x.dates.push(b.booking_date);x.services.set(b.service_name,(x.services.get(b.service_name)||0)+1);if(!x.last||b.booking_date>x.last)x.last=b.booking_date;byPhone.set(p,x)});
    const now=dayStart(new Date());return [...byPhone.values()].map(x=>{x.dates.sort();let avg=30;if(x.dates.length>1){let sum=0;for(let i=1;i<x.dates.length;i++)sum+=(new Date(x.dates[i])-new Date(x.dates[i-1]))/86400000;avg=Math.round(sum/(x.dates.length-1))}x.days=Math.floor((now-new Date(`${x.last}T00:00:00`))/86400000);x.avgInterval=avg;x.overdue=x.days-Math.max(21,avg);x.favorite=[...x.services.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Corte';return x}).sort((a,b)=>b.overdue-a.overdue)
  }

  async function renderIntelligence(){if(document.body.dataset.adminPage!=='inteligencia')return;const host=document.getElementById('v28-intelligence');try{const d=await fetchCore(),clients=customerInsights(d),recover=clients.filter(x=>x.overdue>=7),today=localISO(new Date()),todayRows=d.bookings.filter(b=>b.booking_date===today&&!['cancelled','no_show'].includes(b.status)).sort((a,b)=>a.start_time.localeCompare(b.start_time));
    const open=(()=>{const end=new Date().getDay()===6?15*60:19*60;let cursor=8*60;const gaps=[];for(const b of todayRows){const [h,m]=b.start_time.split(':').map(Number),s=h*60+m;if(s-cursor>=30)gaps.push([cursor,s]);cursor=Math.max(cursor,s+Number(b.duration_minutes||0))}if(end-cursor>=30)gaps.push([cursor,end]);return gaps})();
    const hm=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
    host.innerHTML=`<section class="v28-kpis"><article><small>Clientes para recuperar</small><strong>${recover.length}</strong><em>atrasados em relação ao hábito</em></article><article><small>Janelas livres hoje</small><strong>${open.length}</strong><em>${open.slice(0,2).map(g=>`${hm(g[0])}–${hm(g[1])}`).join(' · ')||'agenda preenchida'}</em></article><article><small>Clientes recorrentes</small><strong>${clients.filter(x=>x.visits>=3).length}</strong><em>3 ou mais visitas</em></article><article><small>VIP potenciais</small><strong>${clients.filter(x=>x.total>=700||x.visits>=10).length}</strong><em>alto relacionamento</em></article></section>
    <section class="v28-grid"><article class="admin-surface"><p class="eyebrow">Retenção inteligente</p><h2>Próximas melhores ações</h2><div class="v28-list">${recover.slice(0,20).map(x=>{const text=`Olá, ${x.name.split(' ')[0]}! Tudo bem? Notei que já faz um tempinho desde seu último ${x.favorite.toLowerCase()}. Quando quiser, será um prazer te receber novamente na Barbearia do Ju 💈`;return `<div><span><strong>${esc(x.name)}</strong><small>${x.days} dias sem voltar · média ${x.avgInterval} dias · ${x.visits} visitas</small></span><a target="_blank" rel="noopener" href="${msgLink(x.phone,text)}">Enviar lembrete</a></div>`}).join('')||'<p>Nenhum cliente atrasado neste momento.</p>'}</div></article>
    <article class="admin-surface"><p class="eyebrow">Agenda inteligente</p><h2>Espaços disponíveis hoje</h2><div class="v28-list">${open.map(g=>`<div><span><strong>${hm(g[0])} às ${hm(g[1])}</strong><small>${g[1]-g[0]} minutos livres</small></span><a href="admin-agendamento.html">Preencher</a></div>`).join('')||'<p>Não há janelas livres de 30 minutos ou mais.</p>'}</div><hr><p class="eyebrow">Leitura do negócio</p><p>${recover.length?`Há ${recover.length} clientes com oportunidade real de retorno. Priorize os primeiros da lista, que estão mais atrasados em relação ao padrão de visitas.`:'Sua base está retornando dentro do padrão observado.'}</p></article></section>`;
  }catch(e){host.innerHTML=`<div class="admin-surface">Erro: ${esc(e.message)}</div>`}}

  async function renderSatisfaction(){if(document.body.dataset.adminPage!=='satisfacao')return;const host=document.getElementById('v28-satisfaction');try{const {data,error}=await sb.from('experience_requests').select('*,bookings(customer_name,customer_email,service_name,booking_date,start_time)').order('created_at',{ascending:false}).limit(500);if(error)throw error;const rows=data||[],count=s=>rows.filter(x=>x.status===s).length;host.innerHTML=`<section class="v28-kpis"><article><small>Pendentes</small><strong>${count('pending')}</strong><em>aguardando envio</em></article><article><small>Enviadas/abertas</small><strong>${count('sent')+count('opened')}</strong><em>sem resposta ainda</em></article><article><small>Satisfeitos</small><strong>${count('satisfied')+count('review_clicked')}</strong><em>respostas positivas</em></article><article><small>Sugestões</small><strong>${count('feedback')}</strong><em>feedback privado</em></article><article><small>Falhas</small><strong>${count('failed')}</strong><em>requer atenção</em></article></section><section class="admin-surface"><div class="admin-section-title"><div><p class="eyebrow">Experiência do cliente</p><h2>Histórico de pesquisas</h2></div><button id="v28-refresh" class="btn ghost">↻ Atualizar</button></div><div class="v28-table">${rows.map(x=>`<div class="v28-row"><span><strong>${esc(x.bookings?.customer_name||'Cliente')}</strong><small>${esc(x.bookings?.service_name||'')} · ${x.bookings?.booking_date?new Date(x.bookings.booking_date+'T12:00').toLocaleDateString('pt-BR'):''}</small></span><span class="v28-status ${esc(x.status)}">${esc(x.status)}</span><span>${x.feedback_text?esc(x.feedback_text):x.last_error?`Erro: ${esc(x.last_error)}`:'—'}</span></div>`).join('')||'<p>Nenhuma pesquisa criada ainda.</p>'}</div></section>`;document.getElementById('v28-refresh')?.addEventListener('click',()=>location.reload())}catch(e){host.innerHTML=`<div class="admin-surface">Erro: ${esc(e.message)}</div>`}}

  const css=document.createElement('style');css.textContent=`.v28-dashboard{margin-bottom:18px}.v28-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin:0 0 18px}.v28-kpis article{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;min-width:0}.v28-kpis small,.v28-kpis em{display:block;color:var(--muted);font-style:normal}.v28-kpis strong{display:block;font-size:24px;margin:7px 0}.v28-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}.v28-list>div{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}.v28-list span,.v28-list small{display:block}.v28-list small{color:var(--muted);margin-top:4px}.v28-list a{white-space:nowrap;color:var(--gold2);font-weight:700}.v28-table{display:grid}.v28-row{display:grid;grid-template-columns:1fr 140px 1.4fr;gap:16px;padding:14px 0;border-bottom:1px solid var(--line);align-items:center}.v28-row span,.v28-row small{display:block}.v28-row small{color:var(--muted);margin-top:4px}.v28-status{text-transform:uppercase;font-size:11px;font-weight:800}.v28-status.failed{color:#ff8080}.v28-status.feedback{color:var(--gold2)}@media(max-width:1100px){.v28-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.v28-kpis{grid-template-columns:repeat(2,1fr)}.v28-grid{grid-template-columns:1fr}.v28-row{grid-template-columns:1fr}.v28-list>div{align-items:flex-start;flex-direction:column}}`;document.head.appendChild(css);

  addNav();protectFutureCompletion();waitSession().then(s=>{if(!s)return;enhanceDashboard();renderIntelligence();renderSatisfaction()});
})();

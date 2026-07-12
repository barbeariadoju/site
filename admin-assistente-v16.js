(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey)
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;
  let session = null;
  let snapshot = null;

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const phone = (v='') => String(v).replace(/\D/g,'');
  const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const daysBetween = (a,b) => Math.floor((new Date(b+'T12:00:00') - new Date(a+'T12:00:00')) / 86400000);

  function bind() {
    $('admin-signin')?.addEventListener('click', signIn);
    $('admin-signout')?.addEventListener('click', () => sb.auth.signOut());
    $('ai-refresh')?.addEventListener('click', loadSnapshot);
    $('ai-form')?.addEventListener('submit', askAI);
    document.querySelectorAll('[data-ai-prompt]').forEach(btn => btn.addEventListener('click', () => {
      $('ai-question').value = btn.dataset.aiPrompt;
      $('ai-question').focus();
    }));
    document.querySelectorAll('[data-admin-nav]').forEach(a => {
      if (a.dataset.adminNav === 'assistente') a.classList.add('is-active');
    });
  }

  async function init() {
    bind();
    if (!sb) return showLogin('Configuração do Supabase ausente.');
    const {data, error} = await sb.auth.getSession();
    if (error) return showLogin(error.message);
    session = data.session;
    renderAuth();
    sb.auth.onAuthStateChange((_event, current) => {
      session = current;
      renderAuth();
    });
  }

  async function signIn() {
    const msg = $('admin-message');
    msg.textContent = 'Entrando...';
    const {error} = await sb.auth.signInWithPassword({
      email: $('admin-email').value,
      password: $('admin-password').value
    });
    msg.textContent = error ? (error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message) : '';
  }

  function showLogin(message='') {
    $('admin-login').hidden = false;
    $('admin-app').hidden = true;
    if ($('admin-message')) $('admin-message').textContent = message;
  }

  async function renderAuth() {
    if (!session) return showLogin();
    $('admin-login').hidden = true;
    $('admin-app').hidden = false;
    await loadSnapshot();
    await pingAssistant();
  }

  async function loadSnapshot() {
    $('ai-refresh').disabled = true;
    $('ai-refresh').textContent = 'Atualizando...';
    const today = new Date();
    const todayIso = iso(today);
    const from90 = new Date(today); from90.setDate(from90.getDate()-90);
    const to30 = new Date(today); to30.setDate(to30.getDate()+30);
    const [bookingsRes, customersRes] = await Promise.all([
      sb.from('bookings').select('*').gte('booking_date', iso(from90)).lte('booking_date', iso(to30)).order('booking_date').order('start_time'),
      sb.from('customer_profiles').select('*').eq('archived', false).order('name')
    ]);
    if (bookingsRes.error || customersRes.error) {
      $('ai-insights').innerHTML = `<div class="admin-empty">Erro ao carregar: ${esc(bookingsRes.error?.message || customersRes.error?.message || '')}</div>`;
      $('ai-refresh').disabled = false;
      $('ai-refresh').textContent = '↻ Atualizar análise';
      return;
    }
    const bookings = bookingsRes.data || [];
    const customers = customersRes.data || [];
    snapshot = buildSnapshot(bookings, customers, todayIso);
    renderSnapshot(snapshot);
    $('ai-refresh').disabled = false;
    $('ai-refresh').textContent = '↻ Atualizar análise';
  }

  function buildSnapshot(bookings, customers, todayIso) {
    const active = bookings.filter(x => ['pending','confirmed'].includes(x.status));
    const todayRows = active.filter(x => x.booking_date === todayIso);
    const completed90 = bookings.filter(x => x.status === 'completed');
    const noShows90 = bookings.filter(x => x.status === 'no_show');
    const forecast = todayRows.reduce((sum,x) => sum + Number(x.service_price||0) + Number(x.products_price||0),0);
    const pending = todayRows.filter(x => x.status === 'pending').length;

    const latestByPhone = new Map();
    for (const b of completed90) {
      const p = phone(b.customer_phone);
      if (!p) continue;
      const current = latestByPhone.get(p);
      if (!current || b.booking_date > current.booking_date) latestByPhone.set(p,b);
    }
    const inactive = customers.map(c => {
      const last = latestByPhone.get(phone(c.phone));
      return {...c,last_visit:last?.booking_date || null,days_away:last ? daysBetween(last.booking_date,todayIso) : null};
    }).filter(c => c.days_away !== null && c.days_away > 30).sort((a,b)=>b.days_away-a.days_away);

    const birthdays = customers.map(c => ({...c,days:daysUntilBirthday(c.birth_date)}))
      .filter(c => c.days !== null && c.days <= 7).sort((a,b)=>a.days-b.days);

    const noShowCount = new Map();
    noShows90.forEach(x => { const p=phone(x.customer_phone); noShowCount.set(p,(noShowCount.get(p)||0)+1); });
    const repeatNoShows = [...noShowCount.entries()].filter(([,n])=>n>=2).map(([p,n])=>({phone:p,count:n,name:customers.find(c=>phone(c.phone)===p)?.name || bookings.find(b=>phone(b.customer_phone)===p)?.customer_name || 'Cliente'})).sort((a,b)=>b.count-a.count);

    const nextRows = active.filter(x => x.booking_date >= todayIso).slice(0,40);
    return {today:todayIso,todayRows,forecast,pending,customers:customers.length,inactive,birthdays,noShows:noShows90.length,repeatNoShows,nextRows,completed90,bookings};
  }

  function daysUntilBirthday(value) {
    if (!value) return null;
    const now = new Date(); now.setHours(0,0,0,0);
    const b = new Date(value+'T12:00:00');
    let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < now) next = new Date(now.getFullYear()+1, b.getMonth(), b.getDate());
    return Math.round((next-now)/86400000);
  }

  function renderSnapshot(s) {
    $('ai-today').textContent = s.todayRows.length;
    $('ai-today-note').textContent = s.todayRows.length ? `${s.todayRows.filter(x=>x.status==='confirmed').length} confirmados` : 'agenda livre';
    $('ai-forecast').textContent = money(s.forecast);
    $('ai-pending').textContent = s.pending;
    $('ai-inactive').textContent = s.inactive.length;
    $('ai-birthdays').textContent = s.birthdays.length;
    $('ai-noshow').textContent = s.noShows;
    const insights = [];
    if (s.pending) insights.push({icon:'⏰',title:`${s.pending} confirmação${s.pending>1?'ões':''} pendente${s.pending>1?'s':''} hoje`,text:'Use a agenda para abrir o WhatsApp e confirmar os horários.'});
    if (s.inactive.length) insights.push({icon:'↩',title:`${s.inactive.length} clientes há mais de 30 dias sem voltar`,text:`Prioridade: ${s.inactive.slice(0,3).map(c=>`${c.name} (${c.days_away} dias)`).join(', ')}.`});
    if (s.birthdays.length) insights.push({icon:'🎂',title:`${s.birthdays.length} aniversário${s.birthdays.length>1?'s':''} nos próximos 7 dias`,text:s.birthdays.slice(0,4).map(c=>`${c.name} (${c.days===0?'hoje':`em ${c.days} dias`})`).join(', ')+'.'});
    if (s.repeatNoShows.length) insights.push({icon:'⚠',title:'Ausências reincidentes',text:s.repeatNoShows.slice(0,4).map(c=>`${c.name}: ${c.count}`).join(' • ')+'.'});
    if (!s.todayRows.length) insights.push({icon:'📣',title:'Agenda de hoje sem horários ativos',text:'Pode ser um bom momento para divulgar os horários vagos ou recuperar clientes inativos.'});
    if (s.forecast >= 380) insights.push({icon:'✓',title:'Meta diária prevista alcançada',text:`A agenda ativa soma ${money(s.forecast)}, acima da meta de R$ 380,00.`});
    else if (s.todayRows.length) insights.push({icon:'◎',title:'Espaço para elevar o ticket',text:`Faltam ${money(380-s.forecast)} em receita prevista para a meta diária de R$ 380,00.`});
    $('ai-insights').innerHTML = insights.length ? insights.map(x=>`<div class="ai-insight"><i>${x.icon}</i><div><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></div></div>`).join('') : '<div class="admin-empty">Nenhuma atenção especial neste momento.</div>';
  }

  async function pingAssistant() {
    try {
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/ju-ia-admin`, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':cfg.supabaseAnonKey},
        body:JSON.stringify({mode:'ping'})
      });
      if (!res.ok) throw new Error('offline');
      const data = await res.json();
      $('ai-status').textContent = data.openai_enabled ? 'IA ativa' : 'Modo análise';
      $('ai-status').classList.toggle('offline', !data.openai_enabled);
    } catch {
      $('ai-status').textContent = 'Função não instalada';
      $('ai-status').classList.add('offline');
    }
  }

  async function askAI(event) {
    event.preventDefault();
    const question = $('ai-question').value.trim();
    if (!question) return;
    addMessage('user','Você',question);
    $('ai-question').value='';
    const loading = addMessage('assistant','JuIA','Analisando os dados...',true);
    try {
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/ju-ia-admin`, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':cfg.supabaseAnonKey},
        body:JSON.stringify({question})
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      loading.querySelector('p').textContent = data.answer || 'Não consegui gerar uma resposta.';
      loading.classList.remove('ai-loading');
    } catch (error) {
      loading.querySelector('p').textContent = `Não consegui consultar a JuIA agora. ${error.message}`;
      loading.classList.remove('ai-loading');
    }
  }

  function addMessage(type,name,text,loading=false) {
    const div=document.createElement('div');
    div.className=`ai-message ${type}${loading?' ai-loading':''}`;
    div.innerHTML=`<div class="ai-avatar">${type==='user'?'J':'IA'}</div><div><strong>${esc(name)}</strong><p>${esc(text)}</p></div>`;
    $('ai-chat').appendChild(div);
    $('ai-chat').scrollTop=$('ai-chat').scrollHeight;
    return div;
  }

  init();
})();

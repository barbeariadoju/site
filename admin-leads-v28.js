(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const dateLabel = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
  const REASON_LABEL = { sem_horario_desejado: 'Sem horário desejado', preco: 'Preço', so_pesquisando: 'Só pesquisando', outro: 'Outro motivo' };
  const KIND_LABEL = { availability: 'Pediu dia + serviço', price_or_service: 'Perguntou preço/serviço', greeting: 'Só cumprimentou' };

  let rows = [];
  let heatFilter = 'all';

  async function auth() {
    if (!sb) { showLogin('Configuração do Supabase ausente.'); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (session) return show();
    $('admin-signin').onclick = signIn;
    $('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  }
  async function signIn() {
    const msg = $('admin-message'); msg.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value });
    if (error) { msg.textContent = error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message; return; }
    show();
  }
  function showLogin(m = '') { $('admin-login').hidden = false; $('admin-app').hidden = true; if ($('admin-message')) $('admin-message').textContent = m; }
  async function show() {
    $('admin-login').hidden = true; $('admin-app').hidden = false;
    $('admin-signout').onclick = () => sb.auth.signOut().then(() => location.reload());
    document.querySelectorAll('[data-leads-tab]').forEach(b => b.onclick = () => {
      heatFilter = b.dataset.leadsTab;
      document.querySelectorAll('[data-leads-tab]').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    });
    $('leads-campaign-send').onclick = sendCampaign;
    await load();
  }

  async function load() {
    const { data, error } = await sb.from('conversation_leads_scored').select('*').order('last_message_at', { ascending: false });
    if (error) { console.error(error); $('leads-list').innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    rows = data || [];
    render();
  }

  function render() {
    const open = rows.filter(r => !r.resolved_at);
    const booked = rows.filter(r => r.resolution === 'booked');
    const rate = rows.length ? Math.round((booked.length / rows.length) * 100) : 0;
    $('leads-metric-quente').textContent = open.filter(r => r.heat === 'quente').length;
    $('leads-metric-morno').textContent = open.filter(r => r.heat === 'morno').length;
    $('leads-metric-frio').textContent = open.filter(r => r.heat === 'frio').length;
    $('leads-metric-rate').textContent = `${rate}%`;

    const responded = rows.filter(r => r.reason);
    const reasonCounts = {};
    responded.forEach(r => { reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1; });
    const reasonsBox = $('leads-reasons');
    reasonsBox.innerHTML = Object.keys(REASON_LABEL).map(k => `<span>${REASON_LABEL[k]}: <strong>${reasonCounts[k] || 0}</strong></span>`).join('') || '<span>Ninguém respondeu a pesquisa de motivo ainda.</span>';

    const list = open.filter(r => heatFilter === 'all' || r.heat === heatFilter);
    const box = $('leads-list');
    if (!list.length) { box.innerHTML = '<div class="admin-empty"><strong>Nada por aqui.</strong><small>Sem leads em aberto nesse filtro.</small></div>'; return; }
    box.innerHTML = list.map(cardHtml).join('');
    bindCardActions(box);
  }

  function cardHtml(row) {
    return `<article class="leads-card" data-row="${row.phone}">
      <button type="button" class="admin-booking-summary" data-toggle-card aria-expanded="false">
        <span class="admin-booking-summary-main">
          <strong>${esc(row.customer_name || row.phone)}</strong>
          <small>${esc(KIND_LABEL[row.kind] || row.kind)}${row.service_interest ? ` · ${esc(row.service_interest)}` : ''}</small>
        </span>
        <span class="leads-heat" data-heat="${row.heat}">${row.heat}</span>
        <span class="admin-booking-chevron">⌄</span>
      </button>
      <div class="admin-booking-detail">
        <div class="admin-booking-detail-inner">
          <p class="leads-meta">${esc(row.phone)}${row.date_interest ? ` • dia desejado: ${dateLabel(row.date_interest)}` : ''} • última mensagem: ${dateLabel(row.last_message_at)}</p>
          ${row.last_message_text ? `<p class="leads-meta">"${esc(row.last_message_text)}"</p>` : ''}
          ${row.reason ? `<p class="leads-reason-tag">Motivo: ${esc(REASON_LABEL[row.reason] || row.reason)}${row.reason_detail ? ` — "${esc(row.reason_detail)}"` : ''}</p>` : ''}
          ${row.slot_reopened_at ? `<p class="leads-reason-tag">🎉 Vaga reaberta${row.slot_reopened_notified_at ? ' — cliente já avisado' : ' — aviso pendente'}</p>` : ''}
          ${row.campaign_sent_at ? `<p class="leads-reason-tag">📣 Campanha enviada em ${dateLabel(row.campaign_sent_at)}</p>` : ''}
        </div>
      </div>
    </article>`;
  }

  function bindCardActions(box) {
    box.querySelectorAll('[data-toggle-card]').forEach(b => b.onclick = () => {
      const detail = b.closest('.leads-card').querySelector('.admin-booking-detail');
      const opening = !detail.classList.contains('is-open');
      detail.classList.toggle('is-open', opening);
      b.setAttribute('aria-expanded', String(opening));
    });
  }

  async function sendCampaign() {
    const button = $('leads-campaign-send');
    const result = $('leads-campaign-result');
    const filter = $('leads-campaign-filter').value.trim();
    if (!confirm(filter ? `Disparar campanha manual pra leads antigos sobre "${filter}"?` : 'Disparar campanha manual pra TODOS os leads antigos (sem filtro de serviço)?')) return;
    button.disabled = true; result.textContent = 'Disparando...';
    const { data, error } = await sb.functions.invoke('conversation-leads-campaign', { body: { service_filter: filter } });
    button.disabled = false;
    if (error || data?.error) { result.textContent = data?.error || error?.message || 'Falha ao disparar.'; return; }
    result.textContent = `${data.sent} mensagem(ns) enviada(s) de ${data.matched} lead(s) encontrado(s) (${data.skipped} pulado(s)).`;
    await load();
  }

  auth();
})();

(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const dateLabel = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const STATUS_LABEL = { pending: 'Pendente', approved: 'Aprovada', posted: 'Publicada', ignored: 'Ignorada' };

  let rows = [];
  let statusFilter = 'pending';

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
    document.querySelectorAll('[data-avaliacoes-tab]').forEach(b => b.onclick = () => {
      statusFilter = b.dataset.avaliacoesTab;
      document.querySelectorAll('[data-avaliacoes-tab]').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    });
    await load();
  }

  async function load() {
    const { data, error } = await sb.from('google_reviews').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); $('avaliacoes-list').innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    rows = data || [];
    render();
  }

  function render() {
    const pending = rows.filter(r => r.status === 'pending').length;
    const now = new Date();
    const postedMonth = rows.filter(r => r.status === 'posted' && r.posted_at && new Date(r.posted_at).getMonth() === now.getMonth() && new Date(r.posted_at).getFullYear() === now.getFullYear()).length;
    $('avaliacoes-metric-pending').textContent = pending;
    $('avaliacoes-metric-posted').textContent = postedMonth;

    const list = rows.filter(r => r.status === statusFilter);
    const box = $('avaliacoes-list');
    if (!list.length) { box.innerHTML = '<div class="admin-empty"><strong>Nada por aqui.</strong><small>Avaliações novas aparecem automaticamente quando a integração com o Google estiver ativa.</small></div>'; return; }
    box.innerHTML = list.map(cardHtml).join('');
    bindCardActions(box);
  }

  function starsHtml(n) { return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—'; }

  function cardHtml(row) {
    const hasDraft = Boolean(row.ai_draft_reply || row.final_reply);
    return `<article class="avaliacoes-card" data-row="${row.id}">
      <button type="button" class="admin-booking-summary" data-toggle-card aria-expanded="false">
        <span class="admin-booking-summary-main">
          <strong>${esc(row.reviewer_name || 'Cliente')}</strong>
          <small class="avaliacoes-stars">${starsHtml(row.star_rating)}</small>
          <small>${esc((row.comment || '(sem comentário escrito)').slice(0, 80))}${(row.comment || '').length > 80 ? '…' : ''}</small>
        </span>
        <span class="avaliacoes-status" data-status="${row.status}">${STATUS_LABEL[row.status] || row.status}</span>
        <span class="admin-booking-chevron">⌄</span>
      </button>
      <div class="admin-booking-detail">
        <div class="admin-booking-detail-inner">
          <p class="avaliacoes-meta">${row.review_created_at ? `Avaliado em ${dateLabel(row.review_created_at)}` : ''}${row.posted_at ? ` • Publicado em ${dateLabel(row.posted_at)}` : ''}</p>
          <p class="avaliacoes-comment">${esc(row.comment || '(sem comentário escrito, só a nota)')}</p>
          ${hasDraft
            ? `<textarea class="avaliacoes-draft" data-field="final_reply" ${row.status === 'posted' ? 'disabled' : ''}>${esc(row.final_reply || row.ai_draft_reply || '')}</textarea>`
            : `<p class="avaliacoes-no-draft">Sem rascunho gerado (IA indisponível no momento da sincronização) — escreva a resposta manualmente antes de aprovar.</p><textarea class="avaliacoes-draft" data-field="final_reply" placeholder="Escreva a resposta aqui..."></textarea>`
          }
          ${row.last_error ? `<p class="avaliacoes-no-draft">Falha ao publicar: ${esc(row.last_error)}</p>` : ''}
          <p class="field-help" data-row-message></p>
          <div class="avaliacoes-card-actions">
            ${row.status === 'pending' ? `<button class="is-primary" data-approve="${row.id}">Aprovar</button><button class="is-danger" data-ignore="${row.id}">Ignorar</button>` : ''}
            ${row.status === 'approved' ? `<button class="is-primary" data-publish="${row.id}">Publicar no Google</button><button data-unapprove="${row.id}">Voltar pra pendente</button><button class="is-danger" data-ignore="${row.id}">Ignorar</button>` : ''}
            ${row.status === 'ignored' ? `<button data-reopen="${row.id}">Reabrir</button>` : ''}
          </div>
        </div>
      </div>
    </article>`;
  }

  function bindCardActions(box) {
    box.querySelectorAll('[data-toggle-card]').forEach(b => b.onclick = () => {
      const detail = b.closest('.avaliacoes-card').querySelector('.admin-booking-detail');
      const opening = !detail.classList.contains('is-open');
      detail.classList.toggle('is-open', opening);
      b.setAttribute('aria-expanded', String(opening));
    });
    box.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => approve(b.dataset.approve, b));
    box.querySelectorAll('[data-unapprove]').forEach(b => b.onclick = () => setStatus(b.dataset.unapprove, 'pending', b));
    box.querySelectorAll('[data-ignore]').forEach(b => b.onclick = () => setStatus(b.dataset.ignore, 'ignored', b));
    box.querySelectorAll('[data-reopen]').forEach(b => b.onclick = () => setStatus(b.dataset.reopen, 'pending', b));
    box.querySelectorAll('[data-publish]').forEach(b => b.onclick = () => publish(b.dataset.publish, b));
  }

  function currentDraft(id) {
    const card = document.querySelector(`.avaliacoes-card[data-row="${id}"]`);
    return card?.querySelector('[data-field="final_reply"]')?.value?.trim() || '';
  }
  function cardMessage(id, text) {
    const card = document.querySelector(`.avaliacoes-card[data-row="${id}"]`);
    const el = card?.querySelector('[data-row-message]');
    if (el) el.textContent = text;
  }

  async function approve(id, button) {
    const finalReply = currentDraft(id);
    if (!finalReply) { cardMessage(id, 'Escreva a resposta antes de aprovar.'); return; }
    button.disabled = true;
    const { error } = await sb.from('google_reviews').update({ status: 'approved', final_reply: finalReply }).eq('id', id);
    if (error) { cardMessage(id, error.message); button.disabled = false; return; }
    await load();
  }

  async function setStatus(id, status, button) {
    button.disabled = true;
    const payload = { status };
    if (status === 'pending') payload.final_reply = currentDraft(id);
    const { error } = await sb.from('google_reviews').update(payload).eq('id', id);
    if (error) { cardMessage(id, error.message); button.disabled = false; return; }
    await load();
  }

  async function publish(id, button) {
    const finalReply = currentDraft(id);
    if (!finalReply) { cardMessage(id, 'Resposta vazia.'); return; }
    button.disabled = true; button.textContent = 'Publicando...';
    const { error: saveError } = await sb.from('google_reviews').update({ final_reply: finalReply }).eq('id', id);
    if (saveError) { cardMessage(id, saveError.message); button.disabled = false; button.textContent = 'Publicar no Google'; return; }
    const { data, error } = await sb.functions.invoke('google-reviews-publish', { body: { id } });
    if (error || data?.error) {
      cardMessage(id, data?.error || error?.message || 'Não foi possível publicar.');
      button.disabled = false; button.textContent = 'Publicar no Google';
      return;
    }
    await load();
  }

  auth();
})();

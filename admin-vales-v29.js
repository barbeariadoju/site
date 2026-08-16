// v29.25.0 — Painel de vales-presente.
//
// O Juliano confere o Pix (o comprovante chega no WhatsApp) e clica em "Confirmar Pix":
// a function gift-card-confirm gera o código no banco e manda pro comprador na hora.
// A baixa (redeem) é feita aqui também — no balcão, o cliente dita o código.
(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateLabel = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const STATUS_LABEL = { pending_payment: 'Aguardando Pix', active: 'Ativo', used: 'Usado', expired: 'Vencido', cancelled: 'Cancelado' };
  const phoneLabel = (p = '') => { const d = String(p).replace(/\D/g, '').replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d; };

  let rows = [];
  let statusFilter = 'pending_payment';

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
    document.querySelectorAll('[data-vales-tab]').forEach(b => b.onclick = () => {
      statusFilter = b.dataset.valesTab;
      document.querySelectorAll('[data-vales-tab]').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    });
    $('vale-redeem-btn').onclick = redeem;
    $('vale-redeem-code').addEventListener('keydown', e => { if (e.key === 'Enter') redeem(); });
    await load();
  }

  async function load() {
    const { data, error } = await sb.from('gift_cards').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); $('vales-list').innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    rows = data || [];
    metrics();
    render();
  }

  function metrics() {
    const pending = rows.filter(r => r.status === 'pending_payment').length;
    const active = rows.filter(r => r.status === 'active').length;
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    const vendido = rows
      .filter(r => r.paid_at && new Date(r.paid_at) >= mes)
      .reduce((s, r) => s + Number(r.amount_cents || 0), 0);
    $('vales-metric-pending').textContent = pending;
    $('vales-metric-active').textContent = active;
    $('vales-metric-month').textContent = money(vendido);
  }

  function itemsLabel(card) {
    const items = Array.isArray(card.items) ? card.items : [];
    if (!items.length) return 'Vale em valor livre';
    return items.map(i => i.name).join(' + ');
  }

  function card(c) {
    const isPending = c.status === 'pending_payment';
    const wa = `https://wa.me/55${String(c.buyer_phone || '').replace(/\D/g, '').replace(/^55/, '')}`;
    return `<article class="vale-card" data-card="${c.id}">
      <div class="vale-head">
        <span class="vale-code">${c.code ? esc(c.code) : '— código sai na confirmação —'}</span>
        <span class="vale-status" data-status="${c.status}">${STATUS_LABEL[c.status] || c.status}</span>
      </div>
      <p class="vale-items"><strong>${money(c.amount_cents)}</strong> · ${esc(itemsLabel(c))}</p>
      <p class="vale-meta">
        Comprou: <strong>${esc(c.buyer_name || '')}</strong> · ${esc(phoneLabel(c.buyer_phone))}<br>
        ${c.recipient_name ? `Para: <strong>${esc(c.recipient_name)}</strong><br>` : ''}
        ${c.message ? `Mensagem: “${esc(c.message)}”<br>` : ''}
        Pedido em ${dateLabel(c.created_at)}${c.paid_at ? ` · Pago em ${dateLabel(c.paid_at)}` : ''}${c.used_at ? ` · Usado em ${dateLabel(c.used_at)}` : ''} · Vence ${dateLabel(c.expires_at)}
      </p>
      <div class="vale-actions">
        ${isPending ? `<button class="is-primary" data-confirm="${c.id}" type="button">✅ Confirmar Pix e liberar código</button>` : ''}
        <a href="${wa}" target="_blank" rel="noopener">💬 Abrir WhatsApp</a>
        ${isPending ? `<button class="is-danger" data-cancel="${c.id}" type="button">Cancelar pedido</button>` : ''}
      </div>
    </article>`;
  }

  function render() {
    const list = statusFilter === 'all' ? rows : rows.filter(r => r.status === statusFilter);
    const box = $('vales-list');
    box.innerHTML = list.length
      ? list.map(card).join('')
      : '<div class="admin-empty">Nenhum vale aqui por enquanto.</div>';
    box.querySelectorAll('[data-confirm]').forEach(b => b.onclick = () => confirmar(b));
    box.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => cancelar(b.dataset.cancel));
  }

  async function confirmar(btn) {
    const id = btn.dataset.confirm;
    const antes = btn.textContent;
    btn.disabled = true; btn.textContent = 'Liberando…';
    const { data: { session } } = await sb.auth.getSession();
    let resp = null;
    try {
      const r = await fetch(`${cfg.supabaseUrl}/functions/v1/gift-card-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ id }),
      });
      resp = await r.json().catch(() => null);
    } catch { resp = null; }
    if (!resp || !resp.ok) {
      btn.disabled = false; btn.textContent = antes;
      alert((resp && resp.message) || 'Não consegui liberar agora. Tente de novo.');
      return;
    }
    alert(resp.notified
      ? `Código ${resp.code} liberado e enviado no WhatsApp do comprador. ✅`
      : `Código ${resp.code} liberado. ⚠️ Não consegui avisar por WhatsApp — mande o código manualmente.`);
    await load();
  }

  async function cancelar(id) {
    if (!confirm('Cancelar este pedido de vale? Use quando o Pix não foi feito.')) return;
    const { error } = await sb.from('gift_cards').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { alert(error.message); return; }
    await load();
  }

  async function redeem() {
    const code = $('vale-redeem-code').value.trim().toUpperCase();
    const msg = $('vale-redeem-msg');
    if (!code) { msg.textContent = 'Digite o código do vale.'; return; }
    msg.textContent = 'Validando…';
    const { data, error } = await sb.rpc('redeem_gift_card', { p_code: code, p_booking_id: null });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.ok) { msg.textContent = row?.message || error?.message || 'Não foi possível validar.'; return; }
    msg.textContent = `Vale de ${money(row.amount_cents)} baixado com sucesso. ✅`;
    $('vale-redeem-code').value = '';
    await load();
  }

  auth();
})();

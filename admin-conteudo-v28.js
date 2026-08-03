(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  let rows = [];
  let statusTab = 'rascunho';
  let session = null;

  async function auth() {
    if (!sb) { showLogin('Configuração do Supabase ausente.'); return; }
    const { data } = await sb.auth.getSession();
    if (data.session) { session = data.session; return show(); }
    $('admin-signin').onclick = signIn;
    $('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  }
  async function signIn() {
    const msg = $('admin-message'); msg.textContent = 'Entrando...';
    const { data, error } = await sb.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value });
    if (error) { msg.textContent = error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message; return; }
    session = data.session;
    show();
  }
  function showLogin(m = '') { $('admin-login').hidden = false; $('admin-app').hidden = true; if ($('admin-message')) $('admin-message').textContent = m; }
  async function show() {
    $('admin-login').hidden = true; $('admin-app').hidden = false;
    $('admin-signout').onclick = () => sb.auth.signOut().then(() => location.reload());
    document.querySelectorAll('[data-conteudo-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-conteudo-tab]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        statusTab = btn.dataset.conteudoTab;
        render();
      });
    });
    await load();
  }

  async function load() {
    const { data, error } = await sb.from('content_posts').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); $('conteudo-list').innerHTML = `<div class="conteudo-empty">${esc(error.message)}</div>`; return; }
    rows = data || [];
    updateMetrics();
    render();
  }

  function updateMetrics() {
    const pendentes = rows.filter(r => r.status === 'rascunho').length;
    const now = new Date();
    const publicadosMes = rows.filter(r => r.status === 'publicado' && r.published_at && new Date(r.published_at).getMonth() === now.getMonth() && new Date(r.published_at).getFullYear() === now.getFullYear()).length;
    $('conteudo-metric-pendentes').textContent = pendentes;
    $('conteudo-metric-publicados').textContent = publicadosMes;
  }

  function contextLabel(ctx) {
    if (!ctx) return '';
    if (ctx.tipo === 'vaga_aberta') return `📅 Vaga aberta hoje — ${ctx.horarios_livres} horário(s), primeiro às ${ctx.primeiro_horario}`;
    if (ctx.tipo === 'servico_destaque') return `✂️ Serviço em destaque: ${ctx.servico}`;
    return '';
  }

  function render() {
    const list = $('conteudo-list');
    const filtered = rows.filter(r => r.status === statusTab);
    if (!filtered.length) { list.innerHTML = `<div class="conteudo-empty">Nenhum post ${statusTab === 'rascunho' ? 'pendente' : statusTab} por aqui.</div>`; return; }
    list.innerHTML = filtered.map(r => {
      const created = new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const meta = r.status === 'publicado' && r.published_at
        ? `Publicado em ${new Date(r.published_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : `Gerado em ${created} · ${r.source === 'ia' ? 'IA' : 'Manual'}`;
      const contextText = contextLabel(r.context);
      const editable = r.status === 'rascunho';
      // Prévia visual (pedido do Juliano): mostra a arte exatamente como vai sair no
      // Status, antes de aprovar — evita publicar algo com visual ruim sem perceber.
      const imageUrl = r.context && typeof r.context.image_url === 'string' ? r.context.image_url : '';
      return `<article class="conteudo-card" data-id="${r.id}">
        <span class="badge ${esc(r.status)}">${r.status === 'rascunho' ? 'Pendente de aprovação' : r.status === 'publicado' ? 'Publicado' : 'Rejeitado'}</span>
        ${contextText ? `<p class="meta">${esc(contextText)}</p>` : ''}
        ${imageUrl ? `<div class="conteudo-preview"><p class="meta">Prévia — a imagem abaixo é publicada junto, com o texto como legenda:</p><img src="${esc(imageUrl)}" alt="Arte que será publicada no Status" loading="lazy"></div>` : `<p class="meta">Este rascunho é só texto (sem arte) — o WhatsApp renderiza sobre fundo escuro.</p>`}
        <textarea data-role="caption" ${editable ? '' : 'readonly'}>${esc(r.caption)}</textarea>
        <p class="meta">${esc(meta)}</p>
        ${editable ? `<div class="conteudo-card-actions">
          <button type="button" class="is-primary" data-action="publish">✅ Aprovar e publicar no Status</button>
          <button type="button" class="is-danger" data-action="reject">Rejeitar</button>
        </div>` : ''}
      </article>`;
    }).join('');

    list.querySelectorAll('[data-action="publish"]').forEach(btn => {
      btn.addEventListener('click', () => publish(btn.closest('.conteudo-card')));
    });
    list.querySelectorAll('[data-action="reject"]').forEach(btn => {
      btn.addEventListener('click', () => reject(btn.closest('.conteudo-card')));
    });
  }

  async function publish(card) {
    const id = card.dataset.id;
    const caption = card.querySelector('[data-role="caption"]').value.trim();
    const buttons = card.querySelectorAll('button');
    buttons.forEach(b => b.disabled = true);
    const publishBtn = card.querySelector('[data-action="publish"]');
    publishBtn.textContent = 'Publicando...';
    try {
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/content-publish-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: cfg.supabaseAnonKey },
        body: JSON.stringify({ id, caption }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao publicar.');
      await load();
    } catch (error) {
      alert(`Não foi possível publicar: ${error.message}`);
      buttons.forEach(b => b.disabled = false);
      publishBtn.textContent = '✅ Aprovar e publicar no Status';
    }
  }

  async function reject(card) {
    const id = card.dataset.id;
    const { error } = await sb.from('content_posts').update({ status: 'rejeitado' }).eq('id', id);
    if (error) { alert(`Erro: ${error.message}`); return; }
    await load();
  }

  auth();
})();

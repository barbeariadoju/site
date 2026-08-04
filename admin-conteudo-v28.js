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
    $('conteudo-new-btn').addEventListener('click', () => {
      $('conteudo-new-form').hidden = false;
      $('conteudo-new-btn').hidden = true;
    });
    $('conteudo-new-cancel').addEventListener('click', () => {
      $('conteudo-new-form').reset();
      $('conteudo-new-error').textContent = '';
      $('conteudo-new-form').hidden = true;
      $('conteudo-new-btn').hidden = false;
    });
    $('conteudo-new-form').addEventListener('submit', createDraft);
    await load();
  }

  async function createDraft(e) {
    e.preventDefault();
    const errorEl = $('conteudo-new-error');
    errorEl.textContent = '';
    const platform = $('conteudo-new-platform').value;
    const caption = $('conteudo-new-caption').value.trim();
    const imageUrl = $('conteudo-new-image').value.trim();
    if (!caption) { errorEl.textContent = 'Escreva o texto do post.'; return; }
    if (PLATFORMS_REQUIRE_IMAGE.has(platform) && !imageUrl) { errorEl.textContent = `${PLATFORM_LABEL[platform]} exige um link de imagem.`; return; }
    // A Meta busca a imagem pelos próprios servidores dela, não pelo navegador — um link
    // relativo (ex. "/assets/foto.jpg") funciona aqui no admin mas falha silenciosamente
    // na hora de publicar. Exige link completo com https:// pra evitar esse bug.
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) { errorEl.textContent = 'O link da imagem precisa ser completo, começando com https:// (não funciona um caminho relativo).'; return; }
    const submitBtn = $('conteudo-new-form').querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';
    const { error } = await sb.from('content_posts').insert({
      platform,
      caption,
      status: 'rascunho',
      source: 'manual',
      context: imageUrl ? { image_url: imageUrl } : null,
    });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Salvar rascunho';
    if (error) { errorEl.textContent = error.message; return; }
    $('conteudo-new-form').reset();
    $('conteudo-new-form').hidden = true;
    $('conteudo-new-btn').hidden = false;
    document.querySelector('[data-conteudo-tab="rascunho"]').click();
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
    const pendentes = rows.filter(r => r.status === 'rascunho' || r.status === 'aprovado').length;
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

  const PLATFORM_LABEL = { whatsapp_business: 'Status do WhatsApp', facebook: 'Facebook', instagram: 'Instagram', facebook_story: 'Story do Facebook', instagram_story: 'Story do Instagram' };
  const PLATFORM_FN = { whatsapp_business: 'content-publish-whatsapp', facebook: 'content-publish-meta', instagram: 'content-publish-meta', facebook_story: 'content-publish-meta', instagram_story: 'content-publish-meta' };
  // Só o feed do Facebook aceita post de texto puro — os dois Stories e o feed do
  // Instagram sempre exigem imagem (mesma regra aplicada em content-publish-meta).
  const PLATFORMS_REQUIRE_IMAGE = new Set(['instagram', 'instagram_story', 'facebook_story']);

  function render() {
    const list = $('conteudo-list');
    // 'aprovado' = publicação em andamento (lease de 3 min no servidor) — aparece junto
    // dos rascunhos pra nunca "sumir" da tela se uma tentativa travar no meio.
    const filtered = rows.filter(r => statusTab === 'rascunho' ? (r.status === 'rascunho' || r.status === 'aprovado') : r.status === statusTab);
    if (!filtered.length) { list.innerHTML = `<div class="conteudo-empty">Nenhum post ${statusTab === 'rascunho' ? 'pendente' : statusTab} por aqui.</div>`; return; }
    list.innerHTML = filtered.map(r => {
      const created = new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const meta = r.status === 'publicado' && r.published_at
        ? `Publicado em ${new Date(r.published_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : `Gerado em ${created} · ${r.source === 'ia' ? 'IA' : 'Manual'}`;
      const contextText = contextLabel(r.context);
      const editable = r.status === 'rascunho' || r.status === 'aprovado';
      // Prévia visual (pedido do Juliano): mostra a arte exatamente como vai sair no
      // Status, antes de aprovar — evita publicar algo com visual ruim sem perceber.
      const imageUrl = r.context && typeof r.context.image_url === 'string' ? r.context.image_url : '';
      const platformLabel = PLATFORM_LABEL[r.platform] || r.platform;
      const noImageNote = PLATFORMS_REQUIRE_IMAGE.has(r.platform)
        ? `${platformLabel} exige uma imagem — este rascunho ainda não tem arte definida.`
        : r.platform === 'facebook'
        ? 'Este rascunho é só texto (sem arte) — vai como post de texto no Facebook.'
        : 'Este rascunho é só texto (sem arte) — o WhatsApp renderiza sobre fundo escuro.';
      // Story não tem legenda de verdade na Meta (o texto precisa estar na própria
      // imagem) — o campo de texto aqui é só anotação interna, não sai publicado.
      const isStoryPlatform = r.platform === 'facebook_story' || r.platform === 'instagram_story';
      return `<article class="conteudo-card" data-id="${r.id}" data-platform="${esc(r.platform)}">
        <span class="badge ${r.status === 'aprovado' ? 'rascunho' : esc(r.status)}">${r.status === 'rascunho' ? 'Pendente de aprovação' : r.status === 'aprovado' ? 'Publicando… (se travar, tente de novo em 3 min)' : r.status === 'publicado' ? 'Publicado' : 'Rejeitado'}</span>
        <p class="meta"><strong>${esc(platformLabel)}</strong></p>
        ${contextText ? `<p class="meta">${esc(contextText)}</p>` : ''}
        ${imageUrl ? `<div class="conteudo-preview"><p class="meta">${isStoryPlatform ? 'Prévia — é exatamente essa imagem que vai pro Story (sem legenda, a Meta não permite texto sobreposto por API):' : 'Prévia — a imagem abaixo é publicada junto, com o texto como legenda:'}</p><img src="${esc(imageUrl)}" alt="Arte que será publicada" loading="lazy"></div>` : `<p class="meta">${esc(noImageNote)}</p>`}
        <textarea data-role="caption" ${editable ? '' : 'readonly'}>${esc(r.caption)}</textarea>
        ${isStoryPlatform ? '<p class="meta">Esse texto é só anotação interna — o Story não tem legenda, sai só a imagem.</p>' : ''}
        <p class="meta">${esc(meta)}</p>
        ${editable ? `<div class="conteudo-card-actions">
          <button type="button" class="is-primary" data-action="publish">✅ Aprovar e publicar no ${esc(platformLabel)}</button>
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
    const platform = card.dataset.platform;
    const caption = card.querySelector('[data-role="caption"]').value.trim();
    const buttons = card.querySelectorAll('button');
    const publishBtn = card.querySelector('[data-action="publish"]');
    const originalLabel = publishBtn.textContent;
    buttons.forEach(b => b.disabled = true);
    publishBtn.textContent = 'Publicando...';
    try {
      const fnName = PLATFORM_FN[platform] || 'content-publish-whatsapp';
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/${fnName}`, {
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
      publishBtn.textContent = originalLabel;
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

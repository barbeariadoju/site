(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  let rows = [];
  let statusTab = 'rascunho';
  let session = null;
  let socialRows = [];
  let socialTab = 'rascunho';

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
  // v28.58.0 — o access_token guardado em `session` expira em ~1h. Quando o app ficava
  // aberto em segundo plano no celular e o Juliano voltava pelo push, qualquer clique de
  // enviar/publicar ia com o token vencido e o servidor devolvia 401 ("Não autorizado").
  // getSession() renova o token sozinho quando necessário — buscar um fresco a cada clique.
  async function freshToken() {
    const { data } = await sb.auth.getSession();
    if (data && data.session) session = data.session;
    return session ? session.access_token : '';
  }
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
    document.querySelectorAll('[data-social-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-social-tab]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        socialTab = btn.dataset.socialTab;
        renderSocial();
      });
    });
    await load();
    await loadSocial();
  }

  async function createDraft(e) {
    e.preventDefault();
    const errorEl = $('conteudo-new-error');
    errorEl.textContent = '';
    const platform = $('conteudo-new-platform').value;
    const caption = $('conteudo-new-caption').value.trim();
    // v29.21.0 — carrossel: o campo de imagem aceita vários links (um por linha, ou
    // separados por espaço/vírgula). 2+ links no feed do Instagram = carrossel.
    const imageLinks = $('conteudo-new-image').value.trim().split(/[\s,]+/).filter(Boolean);
    const imageUrl = imageLinks.length === 1 ? imageLinks[0] : '';
    const isCarousel = imageLinks.length > 1;
    // v28.57.0 — campo de vídeo (Reels/Status de vídeo). Espelha o de imagem; quando os
    // dois estão preenchidos, o vídeo é o que vai publicado e a imagem fica só como capa
    // de referência aqui no admin.
    const videoField = $('conteudo-new-video');
    const videoUrl = videoField ? videoField.value.trim() : '';
    const mediaUrl = videoUrl || imageUrl;
    if (!caption) { errorEl.textContent = 'Escreva o texto do post.'; return; }
    if (isCarousel && platform !== 'instagram') { errorEl.textContent = 'Vários links de imagem = carrossel, e carrossel só existe no feed do Instagram. Deixe um link só, ou mude a plataforma.'; return; }
    if (isCarousel && videoUrl) { errorEl.textContent = 'Carrossel é só de imagens — tire o link do vídeo ou deixe uma imagem só.'; return; }
    if (isCarousel && imageLinks.length > 10) { errorEl.textContent = 'O carrossel aceita no máximo 10 imagens.'; return; }
    if (PLATFORMS_REQUIRE_IMAGE.has(platform) && !mediaUrl && !isCarousel) { errorEl.textContent = `${PLATFORM_LABEL[platform]} exige um link de imagem ou de vídeo.`; return; }
    // A Meta busca a mídia pelos próprios servidores dela, não pelo navegador — um link
    // relativo (ex. "/assets/foto.jpg") funciona aqui no admin mas falha silenciosamente
    // na hora de publicar. Exige link completo com https:// pra evitar esse bug.
    for (const link of imageLinks) {
      if (!/^https?:\/\//i.test(link)) { errorEl.textContent = 'Todos os links de imagem precisam ser completos, começando com https:// (não funciona um caminho relativo).'; return; }
    }
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) { errorEl.textContent = 'O link do vídeo precisa ser completo, começando com https:// (não funciona um caminho relativo).'; return; }
    if (videoUrl && !/\.(mp4|mov)(\?|$)/i.test(videoUrl)) { errorEl.textContent = 'O vídeo precisa ser um arquivo .mp4 ou .mov — é o que o Instagram e o WhatsApp aceitam.'; return; }
    const submitBtn = $('conteudo-new-form').querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';
    const { error } = await sb.from('content_posts').insert({
      platform,
      caption,
      status: 'rascunho',
      source: 'manual',
      context: (imageUrl || videoUrl || isCarousel)
        ? {
            ...(imageUrl ? { image_url: imageUrl } : {}),
            ...(videoUrl ? { video_url: videoUrl } : {}),
            ...(isCarousel ? { carousel_urls: imageLinks } : {}),
          }
        : null,
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
    const pendentes = rows.filter(r => r.status === 'rascunho' || r.status === 'aprovado' || r.status === 'agendado').length;
    const now = new Date();
    const publicadosMes = rows.filter(r => r.status === 'publicado' && r.published_at && new Date(r.published_at).getMonth() === now.getMonth() && new Date(r.published_at).getFullYear() === now.getFullYear()).length;
    $('conteudo-metric-pendentes').textContent = pendentes;
    $('conteudo-metric-publicados').textContent = publicadosMes;
  }

  // v28.58.0 — pedido do Juliano: nunca mais exibir contagem de horários livres, nem
  // aqui no admin (o rótulo antigo "Vaga aberta hoje — N horário(s)" passava a impressão
  // errada de barbearia vazia toda manhã). O rótulo agora só diz o TEMA do post.
  function contextLabel(ctx) {
    if (!ctx) return '';
    if (ctx.tipo === 'vaga_aberta') return '📅 Tema: convite pra agendar hoje';
    if (ctx.tipo === 'reta_final') return '🔥 Tema: agenda de hoje quase cheia (procura alta)';
    if (ctx.tipo === 'campanha') return `📣 Tema: campanha ativa`;
    if (ctx.tipo === 'experiencia') return '💈 Tema: experiência na barbearia';
    if (ctx.tipo === 'fidelidade') return '🎁 Tema: cartão fidelidade';
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
    // v29.44.0: 'agendado' (publicação automática marcada) também mora na aba de rascunhos.
    const filtered = rows.filter(r => statusTab === 'rascunho' ? (r.status === 'rascunho' || r.status === 'aprovado' || r.status === 'agendado') : r.status === statusTab);
    if (!filtered.length) { list.innerHTML = `<div class="conteudo-empty">Nenhum post ${statusTab === 'rascunho' ? 'pendente' : statusTab} por aqui.</div>`; return; }
    list.innerHTML = filtered.map(r => {
      const created = new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const meta = r.status === 'publicado' && r.published_at
        ? `Publicado em ${new Date(r.published_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : `Gerado em ${created} · ${r.source === 'ia' ? 'IA' : 'Manual'}`;
      const contextText = contextLabel(r.context);
      const editable = r.status === 'rascunho' || r.status === 'aprovado' || r.status === 'agendado';
      // v29.44.0 — hora agendada (scheduled_for é UTC; mostra em horário local).
      const scheduledLabel = r.status === 'agendado' && r.scheduled_for
        ? new Date(r.scheduled_for).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '';
      const scheduleError = r.context && typeof r.context.schedule_error === 'string' ? r.context.schedule_error : '';
      // Prévia visual (pedido do Juliano): mostra a arte exatamente como vai sair no
      // Status, antes de aprovar — evita publicar algo com visual ruim sem perceber.
      const imageUrl = r.context && typeof r.context.image_url === 'string' ? r.context.image_url : '';
      // v28.57.0 — vídeo (Reel/Status de vídeo). Quando existe, ele é a mídia publicada e
      // a prévia vira um player, pro Juliano assistir antes de aprovar.
      const videoUrl = r.context && typeof r.context.video_url === 'string' ? r.context.video_url : '';
      // v29.21.0 — carrossel (só feed do Instagram): a prévia mostra todas as imagens na
      // ordem em que vão sair, pro Juliano conferir a sequência antes de aprovar.
      const carouselUrls = r.context && Array.isArray(r.context.carousel_urls) ? r.context.carousel_urls : [];
      const platformLabel = PLATFORM_LABEL[r.platform] || r.platform;
      const noImageNote = PLATFORMS_REQUIRE_IMAGE.has(r.platform)
        ? `${platformLabel} exige uma imagem ou vídeo — este rascunho ainda não tem mídia definida.`
        : r.platform === 'facebook'
        ? 'Este rascunho é só texto (sem arte) — vai como post de texto no Facebook.'
        : 'Este rascunho é só texto (sem arte) — o WhatsApp renderiza sobre fundo escuro.';
      // Story não tem legenda de verdade na Meta (o texto precisa estar na própria
      // imagem) — o campo de texto aqui é só anotação interna, não sai publicado.
      const isStoryPlatform = r.platform === 'facebook_story' || r.platform === 'instagram_story';
      return `<article class="conteudo-card" data-id="${r.id}" data-platform="${esc(r.platform)}" data-carousel="${carouselUrls.length || ''}">
        <span class="badge ${r.status === 'aprovado' || r.status === 'agendado' ? 'rascunho' : esc(r.status)}">${r.status === 'rascunho' ? 'Pendente de aprovação' : r.status === 'aprovado' ? 'Publicando… (se travar, tente de novo em 3 min)' : r.status === 'agendado' ? `⏰ Agendado — sai sozinho ${esc(scheduledLabel)}` : r.status === 'publicado' ? 'Publicado' : 'Rejeitado'}</span>
        ${scheduleError && r.status === 'rascunho' ? `<p class="meta">⚠️ A publicação agendada falhou e voltou pra fila: ${esc(scheduleError)}</p>` : ''}
        <p class="meta"><strong>${esc(platformLabel)}</strong></p>
        ${contextText ? `<p class="meta">${esc(contextText)}</p>` : ''}
        ${carouselUrls.length
          ? `<div class="conteudo-preview"><p class="meta">Prévia — vai como <strong>carrossel de ${carouselUrls.length} imagens</strong> no Instagram, nesta ordem, com o texto como legenda:</p><div style="display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.4rem">${carouselUrls.map((u, i) => `<figure style="margin:0;flex:0 0 auto;text-align:center"><img src="${esc(u)}" alt="Imagem ${i + 1} do carrossel" loading="lazy" style="max-height:180px;border-radius:.6rem"><figcaption class="meta">${i + 1}ª</figcaption></figure>`).join('')}</div></div>`
          : videoUrl
          ? `<div class="conteudo-preview"><p class="meta">${r.platform === 'instagram' ? 'Prévia — este vídeo vai como <strong>Reel</strong> no Instagram, com o texto abaixo como legenda:' : isStoryPlatform ? 'Prévia — este vídeo vai pro Story (sem legenda):' : 'Prévia — este vídeo é publicado com o texto como legenda:'}</p><video src="${esc(videoUrl)}" controls playsinline preload="metadata"></video></div>`
          : imageUrl ? `<div class="conteudo-preview"><p class="meta">${isStoryPlatform ? 'Prévia — é exatamente essa imagem que vai pro Story (sem legenda, a Meta não permite texto sobreposto por API):' : 'Prévia — a imagem abaixo é publicada junto, com o texto como legenda:'}</p><img src="${esc(imageUrl)}" alt="Arte que será publicada" loading="lazy"></div>` : `<p class="meta">${esc(noImageNote)}</p>`}
        <textarea data-role="caption" ${editable ? '' : 'readonly'}>${esc(r.caption)}</textarea>
        ${isStoryPlatform ? '<p class="meta">Esse texto é só anotação interna — o Story não tem legenda, sai só a imagem.</p>' : ''}
        <p class="meta">${esc(meta)}</p>
        ${editable ? `<div class="conteudo-card-actions">
          ${(videoUrl || carouselUrls.length) ? '' : !imageUrl ? `<button type="button" data-action="generate-image">🎨 Gerar imagem com IA</button>` : `<button type="button" data-action="generate-image">🔄 Gerar outra imagem com IA</button>`}
          <button type="button" class="is-primary" data-action="publish">✅ ${r.status === 'agendado' ? 'Publicar agora' : 'Aprovar e publicar'} no ${esc(platformLabel)}</button>
          ${r.status === 'agendado'
            ? `<button type="button" data-action="unschedule">Cancelar agendamento</button>`
            : r.status === 'rascunho' ? `<button type="button" data-action="schedule">⏰ Agendar</button>` : ''}
          <button type="button" class="is-danger" data-action="reject">Rejeitar</button>
        </div>` : ''}
      </article>`;
    }).join('');

    list.querySelectorAll('[data-action="publish"]').forEach(btn => {
      btn.addEventListener('click', () => publish(btn.closest('.conteudo-card')));
    });
    list.querySelectorAll('[data-action="schedule"]').forEach(btn => {
      btn.addEventListener('click', () => schedule(btn.closest('.conteudo-card')));
    });
    list.querySelectorAll('[data-action="unschedule"]').forEach(btn => {
      btn.addEventListener('click', () => unschedule(btn.closest('.conteudo-card')));
    });
    list.querySelectorAll('[data-action="reject"]').forEach(btn => {
      btn.addEventListener('click', () => reject(btn.closest('.conteudo-card')));
    });
    list.querySelectorAll('[data-action="generate-image"]').forEach(btn => {
      btn.addEventListener('click', () => generateImage(btn.closest('.conteudo-card')));
    });
  }

  // Central de Marketing — Fase 2 (v28.49.0): chama content-generate-image (Gemini) pra
  // criar a arte do rascunho direto no servidor, sem depender do Gemini no navegador.
  async function generateImage(card) {
    const id = card.dataset.id;
    const buttons = card.querySelectorAll('button');
    const genBtn = card.querySelector('[data-action="generate-image"]');
    const originalLabel = genBtn.textContent;
    buttons.forEach(b => b.disabled = true);
    genBtn.textContent = 'Gerando imagem... (pode levar ~30s)';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/content-generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}`, apikey: cfg.supabaseAnonKey },
        body: JSON.stringify({ id }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar imagem.');
      await load();
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      alert(timedOut ? 'A geração demorou demais e o navegador desistiu de esperar. Tente de novo.' : `Não foi possível gerar a imagem: ${error.message}`);
      buttons.forEach(b => b.disabled = false);
      genBtn.textContent = originalLabel;
    } finally {
      clearTimeout(timeout);
    }
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
    // v28.47.1: sem isso, se o servidor não responder por qualquer motivo (raro, mas
    // aconteceu na prática numa chamada de Story), o navegador ficava esperando pra
    // sempre e o botão nunca saía de "Publicando...". 100s cobre com folga o pior caso
    // real (Instagram com espera de imagem) sem deixar a tela travada indefinidamente.
    // v29.21.0: carrossel processa cada imagem em sequência na Meta — com 8-10 imagens
    // pode passar dos 100s tranquilamente; espera 4min antes de desistir.
    const isCarouselCard = Boolean(card.dataset.carousel);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isCarouselCard ? 240000 : 100000);
    try {
      const fnName = PLATFORM_FN[platform] || 'content-publish-whatsapp';
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}`, apikey: cfg.supabaseAnonKey },
        body: JSON.stringify({ id, caption }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao publicar.');
      await load();
      if (data.publishing) {
        // v28.48.2: a publicação de Status roda em segundo plano no servidor (a resposta
        // volta na hora). Recarrega a lista algumas vezes pra o card virar "Publicado"
        // sozinho quando o servidor confirmar — o desfecho também chega por push.
        [15000, 45000, 90000, 150000].forEach((ms) => setTimeout(() => load().catch(() => {}), ms));
      }
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      alert(timedOut
        ? 'A publicação demorou demais e o navegador desistiu de esperar. Isso NÃO significa que falhou — confira direto no Facebook/Instagram/WhatsApp antes de tentar de novo, pra não publicar duplicado.'
        : `Não foi possível publicar: ${error.message}`);
      buttons.forEach(b => b.disabled = false);
      publishBtn.textContent = originalLabel;
    } finally {
      clearTimeout(timeout);
    }
  }

  // v29.44.0 — publicação agendada: o card fica 'agendado' com a hora escolhida e o cron
  // content-publish-scheduled (a cada 5 min) publica sozinho quando chegar. A legenda
  // editada no card é salva junto (é ela que sai). Hora digitada em horário local.
  async function schedule(card) {
    const id = card.dataset.id;
    const caption = card.querySelector('[data-role="caption"]').value.trim();
    const suggested = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const suggestedText = `${pad(suggested.getDate())}/${pad(suggested.getMonth() + 1)} ${pad(suggested.getHours())}:${pad(suggested.getMinutes())}`;
    const answer = prompt('Publicar automaticamente em (dia/mês hora:minuto):', suggestedText);
    if (answer === null) return;
    const m = answer.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2}):(\d{2})$/);
    if (!m) { alert('Formato inválido. Use dia/mês hora:minuto, por exemplo 21/08 18:00.'); return; }
    const now = new Date();
    let year = m[3] ? Number(m[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const when = new Date(year, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), 0, 0);
    if (Number.isNaN(when.getTime())) { alert('Data inválida.'); return; }
    if (when.getTime() < Date.now() - 60000) { alert('Essa hora já passou — escolha uma hora futura (ou use "Aprovar e publicar" pra sair agora).'); return; }
    if (card.dataset.platform === 'whatsapp_business') {
      const h = when.getHours();
      if (h >= 20 || h < 8) alert('Aviso: Status do WhatsApp não sai entre 20h e 8h (horário de silêncio). Se agendar nessa faixa, ele sai na primeira rodada depois das 8h.');
    }
    const { data, error } = await sb.from('content_posts')
      .update({ status: 'agendado', scheduled_for: when.toISOString(), caption })
      .eq('id', id).eq('status', 'rascunho').select('id');
    if (error) { alert(`Erro ao agendar: ${error.message}`); return; }
    if (!data || !data.length) alert('Esse post mudou de situação enquanto você agendava. Atualize a página.');
    await load();
  }

  async function unschedule(card) {
    const id = card.dataset.id;
    const { data, error } = await sb.from('content_posts')
      .update({ status: 'rascunho', scheduled_for: null })
      .eq('id', id).eq('status', 'agendado').select('id');
    if (error) { alert(`Erro: ${error.message}`); return; }
    if (!data || !data.length) alert('Esse post já saiu do agendamento (pode ter sido publicado agora). Atualize a página.');
    await load();
  }

  async function reject(card) {
    const id = card.dataset.id;
    // Só rejeita quem ainda está em 'rascunho' (ou 'agendado', v29.44.0 — cancelar o
    // agendamento e rejeitar de uma vez). Rejeitar um card em 'aprovado'
    // (publicação em andamento) seria mentira: a publicação que já está rodando no
    // servidor continuaria e sobrescreveria pra 'publicado' no final — a tela diria
    // "rejeitado" mas o post sairia de verdade. A condição de status no update torna
    // a checagem atômica (não dá pra rejeitar "no meio").
    const { data, error } = await sb.from('content_posts').update({ status: 'rejeitado', scheduled_for: null }).eq('id', id).in('status', ['rascunho', 'agendado']).select('id');
    if (error) { alert(`Erro: ${error.message}`); return; }
    if (!data || !data.length) {
      alert('Esse post está sendo publicado agora (ou acabou de mudar de situação) — não dá mais pra rejeitar. Atualize a página pra ver como ficou.');
    }
    await load();
  }

  // JuIA Social — Fase 1 (v28.50.0): comentários (FB+IG) e mensagens (Messenger+Direct)
  // vivem em social_inbox, aprovação separada da Central de Conteúdo mas na mesma tela.
  const SOCIAL_PLATFORM_LABEL = { facebook: 'Facebook', instagram: 'Instagram' };
  const SOCIAL_KIND_LABEL = { comment: 'Comentário', message: 'Mensagem direta' };

  async function loadSocial() {
    const { data, error } = await sb.from('social_inbox').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); $('social-list').innerHTML = `<div class="conteudo-empty">${esc(error.message)}</div>`; return; }
    socialRows = data || [];
    renderSocial();
  }

  function renderSocial() {
    const list = $('social-list');
    const filtered = socialRows.filter(r => socialTab === 'rascunho' ? r.status === 'rascunho' : socialTab === 'enviado' ? r.status === 'enviado' : (r.status === 'rejeitado' || r.status === 'ignorado'));
    if (!filtered.length) { list.innerHTML = `<div class="conteudo-empty">Nada por aqui.</div>`; return; }
    list.innerHTML = filtered.map(r => {
      const created = new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const editable = r.status === 'rascunho';
      // v29.9.0: a JuIA Social responde sozinha agora (comentário e DM); o que cai aqui
      // como 'rascunho' são só os 2 casos que precisam de você — mensagem sem texto
      // (figurinha/mídia, a IA não tem o que responder) ou o envio automático falhou de
      // verdade (ex. permissão da Meta). O motivo real da falha some no card, mas fica
      // registrado em context.auto_send_error se precisar investigar.
      const semTexto = !r.original_text;
      return `<article class="conteudo-card" data-id="${r.id}">
        <span class="badge ${r.status === 'enviado' ? 'publicado' : r.status === 'rascunho' ? 'rascunho' : 'rejeitado'}">${esc(SOCIAL_PLATFORM_LABEL[r.platform] || r.platform)} · ${esc(SOCIAL_KIND_LABEL[r.kind] || r.kind)}${r.status === 'enviado' ? ' · enviado automaticamente' : ''}</span>
        <p class="meta"><strong>${esc(r.sender_name || 'Cliente (a Meta não informou o nome)')}</strong> disse:</p>
        <p class="meta" style="color:var(--text);white-space:pre-wrap">${r.original_text ? esc(r.original_text) : '<em>(mensagem sem texto — provavelmente figurinha, áudio, foto ou reação; abra o Direct/Messenger pra ver o conteúdo antes de responder)</em>'}</p>
        ${editable && !semTexto ? `<p class="meta" style="color:var(--gold);border:1px solid var(--line);border-radius:.7rem;padding:.6rem .8rem;background:rgba(240,201,135,.06)">⚠️ A JuIA tentou responder sozinha e não conseguiu enviar — escreva/ajuste a resposta e aprove manualmente abaixo.</p>` : ''}
        <textarea data-role="social-reply" ${editable ? '' : 'readonly'}>${esc(r.reply_text || r.ai_draft || '')}</textarea>
        <p class="meta">Recebido em ${esc(created)}</p>
        ${editable ? `<div class="conteudo-card-actions">
          <button type="button" class="is-primary" data-action="social-send">✅ Aprovar e enviar</button>
          <button type="button" data-action="social-ignore">Ignorar</button>
          <button type="button" class="is-danger" data-action="social-reject">Rejeitar</button>
        </div>` : ''}
      </article>`;
    }).join('');

    list.querySelectorAll('[data-action="social-send"]').forEach(btn => {
      btn.addEventListener('click', () => sendSocial(btn.closest('.conteudo-card')));
    });
    list.querySelectorAll('[data-action="social-reject"]').forEach(btn => {
      btn.addEventListener('click', () => updateSocialStatus(btn.closest('.conteudo-card').dataset.id, 'rejeitado'));
    });
    list.querySelectorAll('[data-action="social-ignore"]').forEach(btn => {
      btn.addEventListener('click', () => updateSocialStatus(btn.closest('.conteudo-card').dataset.id, 'ignorado'));
    });
  }

  async function sendSocial(card) {
    const id = card.dataset.id;
    const replyText = card.querySelector('[data-role="social-reply"]').value.trim();
    const buttons = card.querySelectorAll('button');
    const sendBtn = card.querySelector('[data-action="social-send"]');
    const originalLabel = sendBtn.textContent;
    buttons.forEach(b => b.disabled = true);
    sendBtn.textContent = 'Enviando...';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${cfg.supabaseUrl}/functions/v1/meta-social-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}`, apikey: cfg.supabaseAnonKey },
        body: JSON.stringify({ id, reply_text: replyText }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar.');
      await loadSocial();
    } catch (error) {
      alert(`Não foi possível enviar: ${error.message}`);
      buttons.forEach(b => b.disabled = false);
      sendBtn.textContent = originalLabel;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function updateSocialStatus(id, status) {
    const { error } = await sb.from('social_inbox').update({ status }).eq('id', id).eq('status', 'rascunho');
    if (error) { alert(`Erro: ${error.message}`); return; }
    await loadSocial();
  }

  auth();
})();

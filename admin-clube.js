// v29.233.0 — Tela do Clube do Ju no painel.
//
// Só leitura, com duas exceções: as configurações do Clube (vagas, vendas abertas) e o liga/desliga
// da mensagem de lançamento — as duas gravam em club_settings (a RLS deixa o admin dar UPDATE só
// nessa tabela). Cancelar, dar visita extra e estornar têm regra de negócio e ficam fora desta versão.
//
// O aceite do contrato (versão, data/hora, IP, navegador) aparece legível nos detalhes de cada
// assinante: é a prova do aceite se um dia alguém contestar.
(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = window.BDJ_H.esc;
  const money = window.BDJ_H.money;
  const TZ = 'America/Sao_Paulo';

  const STATUS = {
    aguardando_pagamento: 'Aguardando 1º pagamento',
    ativa: 'Ativa',
    atrasada: 'Mensalidade em aberto',
    cancelada: 'Cancelada',
    arrependida: 'Desistiu no prazo de 7 dias',
    expirada: 'Não pagou (expirou)',
    encerrada: 'Encerrada',
  };
  const CHARGE = { pendente: 'Em aberto', paga: 'Paga', cancelada: 'Cancelada', expirada: 'Vencida', estornada: 'Estornada' };
  const METODO = { pix: 'Pix', PIX: 'Pix', credit_card: 'Cartão', CREDIT_CARD: 'Cartão', cartao: 'Cartão', boleto: 'Boleto', BOLETO: 'Boleto' };
  const USO = { reservada: 'marcada', usada: 'usada', perdida: 'perdida' };
  const DIA = { 2: 'terça', 3: 'quarta', 4: 'quinta' };
  const VIVAS = ['ativa', 'atrasada', 'aguardando_pagamento'];
  const ENCERRADAS = ['cancelada', 'arrependida', 'expirada', 'encerrada'];

  let subs = [], plans = {}, charges = [], usage = [], waitlist = [], settings = null, vagas = [], anuncios = {};
  let filtro = 'vivas';
  let ligado = false;

  // ---- formatação ----
  const digits = (p) => String(p || '').replace(/\D/g, '');
  const phoneLabel = (p) => { const d = digits(p).replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };
  const waLink = (p) => { let d = digits(p); if (d.length === 10 || d.length === 11) d = '55' + d; return `https://wa.me/${d}`; };
  const phoneHtml = (p) => p ? `<a class="clube-wa" href="${esc(waLink(p))}" target="_blank" rel="noopener">${esc(phoneLabel(p))}</a>` : '';
  // Colunas date ("2026-09-24") viram dd/mm sem passar por Date (evita o fuso comer um dia).
  const dm = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}` : ''; };
  const dmy = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const dataHora = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const dataCurta = (ts) => ts ? new Date(ts).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const hora = (t) => { const m = /^(\d{2}):(\d{2})/.exec(String(t || '')); return m ? (m[2] === '00' ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`) : ''; };
  const planName = (id) => (plans[id] && plans[id].name) || id || '';
  const isCativa = (s) => s.fixed_weekday != null || (plans[s.plan_id] && plans[s.plan_id].pool === 'cativa');
  const horasDesde = (ts) => ts ? (Date.now() - new Date(ts).getTime()) / 36e5 : 0;

  // ---- login (mesmo padrão das outras telas: a casca já desenhou o cartão) ----
  async function auth() {
    if (!sb) { showLogin('Configuração do Supabase ausente.'); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (session) return show();
    $('admin-signin').onclick = signIn;
    $('admin-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') signIn(); });
  }
  async function signIn() {
    const msg = $('admin-message'); msg.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value });
    if (error) { msg.textContent = error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message; return; }
    show();
  }
  function showLogin(m = '') { $('admin-login').hidden = false; $('admin-app').hidden = true; if ($('admin-message')) $('admin-message').textContent = m; }

  let ligou = false;
  async function show() {
    $('admin-login').hidden = true; $('admin-app').hidden = false;
    if (!ligou) {
      ligou = true;
      $('admin-signout').onclick = () => sb.auth.signOut().then(() => location.reload());
      document.querySelectorAll('[data-clube-tab]').forEach((b) => b.onclick = () => {
        filtro = b.dataset.clubeTab;
        document.querySelectorAll('[data-clube-tab]').forEach((x) => x.classList.toggle('is-active', x === b));
        renderLista();
      });
      $('clube-reload').onclick = () => load();
      $('clube-config-save').onclick = salvarConfig;
      $('clube-anuncio-toggle').onclick = alternarAnuncio;
    }
    await load();
  }

  // ---- dados ----
  async function contarAnuncios() {
    const out = {};
    await Promise.all(['fila', 'enviada', 'falhou', 'pulada'].map(async (st) => {
      const { count, error } = await sb.from('club_announcements').select('phone_mkey', { count: 'exact', head: true }).eq('status', st);
      out[st] = error ? null : (count || 0);
    }));
    return out;
  }

  async function load() {
    const btn = $('clube-reload'); if (btn) btn.disabled = true;
    try {
      const [rSubs, rPlans, rCharges, rUsage, rWait, rCfg, rVagas, cont] = await Promise.all([
        sb.from('club_subscriptions').select('*').order('created_at', { ascending: false }),
        sb.from('club_plans').select('id,name,price,table_value,pool,sort').order('sort', { ascending: true }),
        sb.from('club_charges').select('id,subscription_id,seq,amount,status,method,paid_at,pay_link,cycle_start,cycle_end,created_at').order('seq', { ascending: true }),
        sb.from('club_usage').select('subscription_id,booking_id,cycle_start,covered_items,covered_value,status'),
        sb.from('club_waitlist').select('id,name,phone,plan_id,created_at,notified_at').order('created_at', { ascending: true }),
        sb.from('club_settings').select('*').eq('id', 1).maybeSingle(),
        sb.rpc('club_vagas'),
        contarAnuncios(),
      ]);
      const erro = [rSubs, rPlans, rCharges, rUsage, rWait].find((r) => r.error);
      if (erro) {
        // Só a mensagem do erro, nunca a linha (PII) no console.
        console.error('Clube: falha ao carregar', erro.error.message);
        $('clube-lista').innerHTML = BDJ_UX.empty('Não consegui carregar o Clube agora: ' + erro.error.message);
        return;
      }
      subs = rSubs.data || [];
      plans = Object.fromEntries((rPlans.data || []).map((p) => [p.id, p]));
      charges = rCharges.data || [];
      usage = rUsage.data || [];
      waitlist = rWait.data || [];
      settings = rCfg.error ? null : rCfg.data;
      vagas = rVagas.error ? [] : (Array.isArray(rVagas.data) ? rVagas.data : []);
      anuncios = cont;
      renderMetricas();
      renderPendencias();
      renderLista();
      renderEspera();
      renderConfig();
    } finally { if (btn) btn.disabled = false; }
  }

  // ---- topo ----
  function renderMetricas() {
    const receita = subs.filter((s) => s.status === 'ativa' || s.status === 'atrasada').reduce((t, s) => t + Number(s.price || 0), 0);
    const ativos = subs.filter((s) => s.status === 'ativa').length;
    const abertos = subs.filter((s) => s.status === 'atrasada').length;
    $('clube-metric-receita').textContent = money(receita);
    $('clube-metric-ativos').textContent = String(ativos);
    $('clube-metric-ativos-detail').textContent = abertos ? `em dia · ${abertos} em aberto` : 'em dia';

    const g = vagas.find((v) => v.pool === 'geral');
    const c = vagas.find((v) => v.pool === 'cativa');
    if (g || c) {
      $('clube-metric-vagas').textContent = `${g ? `${g.ocupadas}/${g.total}` : '—'} · ${c ? `${c.ocupadas}/${c.total}` : '—'}`;
      const aberto = (g || c).vendas_abertas;
      $('clube-metric-vagas-detail').textContent = `planos · Cativa${aberto === false ? ' · vendas fechadas' : ''}`;
    } else {
      $('clube-metric-vagas').textContent = '—';
    }

    const agora = new Date();
    const chaveMes = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(agora);
    const pagasMes = charges.filter((ch) => ch.status === 'paga' && ch.paid_at
      && new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(new Date(ch.paid_at)) === chaveMes);
    $('clube-metric-recebido').textContent = money(pagasMes.reduce((t, ch) => t + Number(ch.amount || 0), 0));
    $('clube-metric-recebido-detail').textContent = `${pagasMes.length} ${pagasMes.length === 1 ? 'pagamento' : 'pagamentos'} neste mês`;
  }

  // ---- pendências ----
  function renderPendencias() {
    const itens = [];
    subs.filter((s) => s.status === 'arrependida' && Number(s.refund_due || 0) > 0 && !s.refunded_at).forEach((s) => itens.push({
      tipo: 'devolver',
      titulo: `Devolver ${money(s.refund_due)} pelo PagBank`,
      texto: `${planName(s.plan_id)} · desistiu ${s.cancelled_at ? 'em ' + dataCurta(s.cancelled_at) : 'no prazo de 7 dias'}. O estorno é feito na conta do PagBank.`,
      s,
    }));
    subs.filter((s) => s.status === 'atrasada').forEach((s) => {
      const aberta = charges.filter((ch) => ch.subscription_id === s.id && ch.status === 'pendente').sort((a, b) => b.seq - a.seq)[0];
      itens.push({
        tipo: 'aberto',
        titulo: `Mensalidade em aberto${aberta ? ` · ${money(aberta.amount)}` : ''}`,
        texto: `${planName(s.plan_id)}${s.current_cycle_end ? ` · ciclo pago até ${dm(s.current_cycle_end)}` : ''}. Enquanto não pagar, o atendimento sai pelo preço normal.`,
        link: aberta && aberta.pay_link,
        s,
      });
    });
    subs.filter((s) => s.status === 'aguardando_pagamento' && horasDesde(s.created_at) > 24).forEach((s) => {
      const dias = Math.floor(horasDesde(s.created_at) / 24);
      const aberta = charges.filter((ch) => ch.subscription_id === s.id && ch.status === 'pendente').sort((a, b) => b.seq - a.seq)[0];
      itens.push({
        tipo: 'aguardando',
        titulo: `Aguardando o 1º pagamento há ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
        texto: `${planName(s.plan_id)} · ${money(s.price)} por mês. A vaga não fica mais reservada depois de 24h.`,
        link: aberta && aberta.pay_link,
        s,
      });
    });
    const box = $('clube-pendencias');
    if (!itens.length) { box.innerHTML = BDJ_UX.empty('Nenhuma pendência no Clube.'); return; }
    box.innerHTML = '<ul class="clube-pend-list">' + itens.map((i) => `<li class="clube-pend" data-tipo="${i.tipo}">
      <div><strong>${esc(i.titulo)}</strong><span>${esc(i.s.name)} · ${phoneHtml(i.s.phone)} · ${esc(i.s.code || '')}</span><small>${esc(i.texto)}</small></div>
      ${i.link ? `<a class="clube-link" href="${esc(i.link)}" target="_blank" rel="noopener">Link de pagamento</a>` : ''}
    </li>`).join('') + '</ul>';
  }

  // ---- lista de assinantes ----
  function usoTexto(s) {
    if (isCativa(s)) {
      const quando = s.fixed_weekday != null ? `Toda ${DIA[s.fixed_weekday] || '?'}${s.fixed_time ? ` às ${hora(s.fixed_time)}` : ''}` : 'Horário fixo a definir';
      return quando;
    }
    if (!s.current_cycle_start) return 'Ciclo começa no primeiro pagamento';
    const doCiclo = usage.filter((u) => u.subscription_id === s.id && u.cycle_start === s.current_cycle_start && USO[u.status]);
    const bonus = Number((s.bonus_visits && s.bonus_visits[s.current_cycle_start]) || 0);
    const limite = Number(s.visits_per_cycle || 0) + bonus;
    const partes = ['reservada', 'usada', 'perdida'].map((st) => { const n = doCiclo.filter((u) => u.status === st).length; return n ? `${n} ${USO[st]}${n > 1 ? 's' : ''}` : ''; }).filter(Boolean);
    return `${doCiclo.length} de ${limite} visitas no ciclo${bonus ? ` (${bonus} extra)` : ''}${partes.length ? ` · ${partes.join(', ')}` : ''}`;
  }

  function checksHtml(checks) {
    if (!checks || typeof checks !== 'object') return '';
    const marcados = Object.entries(checks).filter(([, v]) => v === true || (v && v !== false));
    if (!marcados.length) return '';
    return `<dt>Confirmações marcadas</dt><dd>${marcados.map(([k, v]) => esc(v === true ? k : `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)).join('<br>')}</dd>`;
  }

  function detalhes(s) {
    const cob = charges.filter((ch) => ch.subscription_id === s.id);
    const tabela = cob.length ? `<div class="clube-table-wrap"><table class="clube-table"><thead><tr><th>Nº</th><th>Período</th><th>Valor</th><th>Situação</th><th>Forma</th><th>Pago em</th></tr></thead><tbody>${cob.map((ch) => `<tr>
        <td>${esc(ch.seq)}</td>
        <td>${ch.cycle_start ? `${esc(dm(ch.cycle_start))}–${esc(dm(ch.cycle_end))}` : '—'}</td>
        <td>${money(ch.amount)}</td>
        <td><span class="clube-charge" data-status="${esc(ch.status)}">${esc(CHARGE[ch.status] || ch.status)}</span>${ch.status === 'pendente' && ch.pay_link ? ` <a class="clube-link" href="${esc(ch.pay_link)}" target="_blank" rel="noopener">link</a>` : ''}</td>
        <td>${esc(METODO[ch.method] || ch.method || '—')}</td>
        <td>${ch.paid_at ? esc(dataHora(ch.paid_at)) : '—'}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="clube-muted">Nenhuma cobrança gerada ainda.</p>';

    const cancel = (s.cancelled_at || s.cancel_reason || s.cancel_requested_at) ? `<dl class="clube-dl">
        ${s.cancel_requested_at ? `<dt>Pedido de cancelamento</dt><dd>${esc(dataHora(s.cancel_requested_at))}${s.cancel_channel ? ` · ${esc(s.cancel_channel)}` : ''}</dd>` : ''}
        ${s.cancelled_at ? `<dt>Encerrada em</dt><dd>${esc(dataHora(s.cancelled_at))}</dd>` : ''}
        ${s.cancel_reason ? `<dt>Motivo</dt><dd>${esc(s.cancel_reason)}</dd>` : ''}
        ${s.refund_due ? `<dt>Devolução</dt><dd>${money(s.refund_due)}${s.refunded_at ? ` · devolvido em ${esc(dataHora(s.refunded_at))}` : ' · ainda não devolvido'}</dd>` : ''}
      </dl>` : '';

    return `<details class="clube-details"><summary>Detalhes</summary>
      <h4>Cobranças</h4>${tabela}
      <h4>Registro do aceite do contrato</h4>
      <dl class="clube-dl clube-aceite">
        <dt>Versão do contrato</dt><dd>${esc(s.terms_version || '—')}</dd>
        <dt>Aceito em</dt><dd>${s.accepted_at ? `${esc(dataHora(s.accepted_at))} (horário de Brasília)` : '—'}</dd>
        <dt>IP</dt><dd><code>${esc(s.accept_ip || '—')}</code></dd>
        <dt>Navegador</dt><dd><code>${esc(s.accept_user_agent || '—')}</code></dd>
        ${s.phone_verified_at ? `<dt>Telefone confirmado</dt><dd>${esc(dataHora(s.phone_verified_at))} (código pelo WhatsApp)</dd>` : ''}
        ${checksHtml(s.accept_checks)}
        <dt>Pedido feito em</dt><dd>${esc(dataHora(s.created_at))}</dd>
        ${s.activated_at ? `<dt>Ativada em</dt><dd>${esc(dataHora(s.activated_at))}</dd>` : ''}
        ${s.email ? `<dt>E-mail</dt><dd>${esc(s.email)}</dd>` : ''}
      </dl>
      ${cancel}
      <p class="clube-muted">Para cancelar ou dar visita extra, fale comigo (Claude) por enquanto.</p>
    </details>`;
  }

  function card(s) {
    const itens = Array.isArray(s.visit_items) && s.visit_items.length ? s.visit_items.join(' + ') : '';
    const ciclo = s.current_cycle_start ? `${dm(s.current_cycle_start)}–${dm(s.current_cycle_end)}` : '—';
    return `<article class="clube-card" data-status="${esc(s.status)}">
      <div class="clube-card-head">
        <div><strong class="clube-nome">${esc(s.name)}</strong><span class="clube-sub">${phoneHtml(s.phone)} · <code>${esc(s.code || '')}</code></span></div>
        <span class="clube-status" data-status="${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
      </div>
      <dl class="clube-grid">
        <div><dt>Plano</dt><dd>${esc(planName(s.plan_id))}${itens ? `<small>${esc(itens)}</small>` : ''}</dd></div>
        <div><dt>Mensalidade</dt><dd>${money(s.price)}${s.table_value ? `<small>tabela ${money(s.table_value)}${s.discount_pct ? ` · ${esc(s.discount_pct)}% off` : ''}</small>` : ''}</dd></div>
        <div><dt>Ciclo atual</dt><dd>${esc(ciclo)}</dd></div>
        <div><dt>${isCativa(s) ? 'Horário fixo' : 'Uso'}</dt><dd>${esc(usoTexto(s))}</dd></div>
      </dl>
      ${s.cancel_at_cycle_end ? `<p class="clube-aviso">Cancelamento agendado: termina no fim do ciclo${s.current_cycle_end ? `, em ${esc(dmy(s.current_cycle_end))}` : ''}.</p>` : ''}
      ${detalhes(s)}
    </article>`;
  }

  function renderLista() {
    const lista = subs.filter((s) => filtro === 'todas' ? true
      : filtro === 'vivas' ? VIVAS.includes(s.status)
      : filtro === 'encerradas' ? ENCERRADAS.includes(s.status)
      : s.status === filtro);
    $('clube-lista').innerHTML = lista.length ? lista.map(card).join('') : BDJ_UX.empty('Nenhuma assinatura aqui por enquanto.');
  }

  // ---- lista de espera ----
  function renderEspera() {
    const box = $('clube-espera');
    if (!waitlist.length) { box.innerHTML = BDJ_UX.empty('Ninguém na lista de espera.'); return; }
    box.innerHTML = '<ul class="clube-pend-list">' + waitlist.map((w) => `<li class="clube-pend">
      <div><strong>${esc(w.name)}</strong><span>${phoneHtml(w.phone)}${w.plan_id ? ` · ${esc(planName(w.plan_id))}` : ''}</span><small>Entrou em ${esc(dataCurta(w.created_at))}${w.notified_at ? ` · avisado em ${esc(dataCurta(w.notified_at))}` : ''}</small></div>
    </li>`).join('') + '</ul>';
  }

  // ---- configurações ----
  function renderConfig() {
    const ok = !!settings;
    ['clube-vagas-geral', 'clube-vagas-cativa', 'clube-vendas-abertas', 'clube-config-save'].forEach((id) => { $(id).disabled = !ok; });
    if (!ok) { $('clube-config-msg').textContent = 'Não consegui ler as configurações do Clube.'; }
    else {
      $('clube-vagas-geral').value = settings.vagas_geral ?? '';
      $('clube-vagas-cativa').value = settings.vagas_cativa ?? '';
      $('clube-vendas-abertas').checked = !!settings.vendas_abertas;
    }
    const rot = { fila: 'Na fila', enviada: 'Enviadas', falhou: 'Falharam', pulada: 'Puladas' };
    $('clube-anuncio-counts').innerHTML = Object.entries(rot).map(([k, r]) => `<span><small>${r}</small><b>${anuncios[k] == null ? '—' : esc(anuncios[k])}</b></span>`).join('');
    ligado = !!(settings && settings.anuncio_ativo);
    const t = $('clube-anuncio-toggle');
    t.disabled = !ok || !settings || !('anuncio_ativo' in settings);
    t.textContent = ligado ? 'Pausar o envio' : 'Ligar o envio';
    t.classList.toggle('primary', !ligado);
    t.classList.toggle('ghost', ligado);
    $('clube-anuncio-state').textContent = !settings || !('anuncio_ativo' in settings) ? 'Envio indisponível' : ligado ? 'Envio ligado' : 'Envio desligado';
    $('clube-anuncio-state').dataset.on = ligado ? '1' : '0';
  }

  async function salvarConfig() {
    const msg = $('clube-config-msg');
    const geral = Number($('clube-vagas-geral').value);
    const cativa = Number($('clube-vagas-cativa').value);
    if (!Number.isInteger(geral) || geral < 0 || geral > 200 || !Number.isInteger(cativa) || cativa < 0 || cativa > 50) {
      msg.textContent = 'Use números inteiros: até 200 vagas nos planos e até 50 na Cadeira Cativa.'; return;
    }
    const g = vagas.find((v) => v.pool === 'geral'); const c = vagas.find((v) => v.pool === 'cativa');
    if ((g && geral < g.ocupadas) || (c && cativa < c.ocupadas)) {
      const okAbaixo = await BDJ_UX.confirm('O número de vagas ficou abaixo de quem já assina. Ninguém perde a assinatura, só não entram novos até liberar vaga. Salvar assim mesmo?');
      if (!okAbaixo) return;
    }
    const btn = $('clube-config-save');
    BDJ_UX.setBusy(btn, true, 'Salvando…');
    const { error } = await sb.from('club_settings').update({
      vagas_geral: geral, vagas_cativa: cativa, vendas_abertas: $('clube-vendas-abertas').checked, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    BDJ_UX.setBusy(btn, false);
    if (error) { msg.textContent = 'Não foi possível salvar: ' + error.message; return; }
    msg.textContent = '';
    BDJ_UX.toast('Configurações do Clube salvas.', 'success');
    await load();
  }

  async function alternarAnuncio() {
    const ligar = !ligado;
    const ok = await BDJ_UX.confirm(ligar
      ? 'Envia a mensagem de lançamento para os clientes cadastrados, 2 por vez a cada 10 minutos (cerca de 12 por hora), das 9h às 19h, de terça a sábado. Quem responder SAIR não recebe mais novidades.'
      : 'Pausar o envio da mensagem de lançamento? Quem ainda está na fila continua lá e recebe quando você ligar de novo.',
    { title: ligar ? 'Ligar a mensagem de lançamento?' : 'Pausar a mensagem de lançamento?', ok: ligar ? 'Ligar o envio' : 'Pausar', danger: false });
    if (!ok) return;
    const btn = $('clube-anuncio-toggle');
    BDJ_UX.setBusy(btn, true, ligar ? 'Ligando…' : 'Pausando…');
    const { error } = await sb.from('club_settings').update({ anuncio_ativo: ligar, updated_at: new Date().toISOString() }).eq('id', 1);
    BDJ_UX.setBusy(btn, false);
    if (error) { BDJ_UX.toast('Não foi possível mudar o envio: ' + error.message, 'error'); return; }
    BDJ_UX.toast(ligar ? 'Envio da mensagem de lançamento ligado.' : 'Envio pausado.', 'success');
    await load();
  }

  auth();
})();

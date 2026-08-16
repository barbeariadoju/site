// v29.32.0 — Painel da Equipe (Fase 1 do sistema do 2º profissional).
//
// A tela existe para resolver uma conversa que, sem ela, acontece de cabeça toda segunda:
// quanto o parceiro produziu, quanto consumiu, quanto entregou em dinheiro e quanto sai no
// Pix. Cada linha do extrato traz a memória de cálculo (bruto, taxa, custo, percentual),
// porque numa relação em que o dinheiro passa todo pela mão de um dos dois, "confia em mim"
// não é resposta.
//
// O fechamento NÃO paga: ele fecha a conta para os dois conferirem. Pagar é um segundo
// clique, deliberado, depois do acerto — foi assim que o Juliano pediu em 16/08/2026.
(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dayLabel = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
  const KIND_LABEL = {
    cota_servico: 'Serviço', cota_produto: 'Produto', consumo: 'Consumo',
    ressarcimento: 'Ressarcimento', estorno: 'Estorno', ajuste: 'Ajuste',
  };

  let professionals = [];
  let entries = [];
  let lastSettlementId = null;

  // ---------------------------------------------------------------- autenticação
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

    document.querySelectorAll('[data-eq-tab]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-eq-tab]').forEach(x => x.classList.toggle('is-active', x === b));
      document.querySelectorAll('[data-eq-panel]').forEach(p => { p.hidden = p.dataset.eqPanel !== b.dataset.eqTab; });
    });

    // Semana fechada anterior: segunda a domingo, que é o período do repasse (Cl. 4.2).
    const hoje = new Date();
    const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
    const fimSemanaPassada = new Date(hoje); fimSemanaPassada.setDate(hoje.getDate() - diaSemana - 1);
    const inicioSemanaPassada = new Date(fimSemanaPassada); inicioSemanaPassada.setDate(fimSemanaPassada.getDate() - 6);
    const iso = (d) => d.toISOString().slice(0, 10);
    $('eq-start').value = iso(inicioSemanaPassada);
    $('eq-end').value = iso(fimSemanaPassada);

    $('eq-load').onclick = loadStatement;
    $('eq-close').onclick = closeSettlement;
    $('eq-mark-paid').onclick = markPaid;
    $('eq-add-entry').onclick = addEntry;
    $('eq-new-save').onclick = saveProfessional;

    await Promise.all([loadProfessionals(), loadFees(), loadProducts()]);
  }

  // ---------------------------------------------------------------- profissionais
  async function loadProfessionals() {
    const { data, error } = await sb.rpc('admin_list_professionals', { p_include_inactive: true });
    if (error) { $('eq-list').innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    professionals = data || [];

    const parceiros = professionals.filter(p => !p.is_owner);
    $('eq-metric-ativos').textContent = parceiros.filter(p => p.status === 'ativo').length;

    // O seletor do fechamento só lista quem tem cota-parte: o dono não tem acerto consigo
    // mesmo, e deixá-lo na lista só geraria extrato vazio e dúvida.
    $('eq-prof-select').innerHTML = parceiros.length
      ? parceiros.map(p => `<option value="${p.id}">${esc(p.display_name || p.name)}${p.status !== 'ativo' ? ` (${p.status})` : ''}</option>`).join('')
      : '<option value="">Nenhum profissional cadastrado ainda</option>';

    $('eq-list').innerHTML = professionals.map(p => `
      <div class="eq-card">
        <div class="eq-head">
          <span class="eq-name">${esc(p.display_name || p.name)}${p.is_owner ? ' (você)' : ''}</span>
          <span class="eq-status" data-status="${esc(p.status)}">${esc(p.status)}</span>
        </div>
        <p class="eq-meta">
          Cota-parte: <strong>${Number(p.share_percent)}%</strong>${p.is_owner ? ' — sem rateio' : ''}<br>
          ${p.cnpj ? `CNPJ ${esc(p.cnpj)}` : p.cnpj_deadline ? `Sem CNPJ — prazo até ${dayLabel(p.cnpj_deadline)}${p.cnpj_pendente ? ' <strong style="color:#e6a0a0">(vencido)</strong>' : ''}` : 'Sem CNPJ'}<br>
          ${p.pix_key ? `Pix: ${esc(p.pix_key)}` : 'Chave Pix não cadastrada'}
        </p>
        ${p.is_owner ? '' : `<div class="eq-actions">
          ${p.status === 'ativo'
            ? `<button data-eq-status="suspenso" data-id="${p.id}">Suspender</button>
               <button class="is-danger" data-eq-status="encerrado" data-id="${p.id}">Encerrar parceria</button>`
            : `<button class="is-primary" data-eq-status="ativo" data-id="${p.id}">Reativar</button>`}
        </div>`}
      </div>`).join('');

    $('eq-list').querySelectorAll('[data-eq-status]').forEach(b => b.onclick = () => setStatus(b.dataset.id, b.dataset.eqStatus));
    renderSetupAlert();
  }

  async function saveProfessional() {
    const nome = $('eq-new-name').value.trim();
    if (!nome) { alert('Informe o nome do profissional.'); return; }
    const btn = $('eq-new-save'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const { error } = await sb.rpc('admin_upsert_professional', {
        p_name: nome,
        p_display_name: $('eq-new-display').value.trim() || null,
        p_phone: $('eq-new-phone').value.trim() || null,
        p_cpf: $('eq-new-cpf').value.trim() || null,
        p_cnpj: $('eq-new-cnpj').value.trim() || null,
        p_pix_key: $('eq-new-pix').value.trim() || null,
        p_share_percent: Number($('eq-new-share').value || 50),
      });
      if (error) { alert(error.message); return; }
      ['eq-new-name', 'eq-new-display', 'eq-new-phone', 'eq-new-cpf', 'eq-new-cnpj', 'eq-new-pix'].forEach(id => { $(id).value = ''; });
      await loadProfessionals();
    } finally { btn.disabled = false; btn.textContent = 'Cadastrar profissional'; }
  }

  async function setStatus(id, status) {
    // Encerrar é a ação que o Juliano queria a um clique de distância, mas é também a que
    // não dá para desfazer sem conversa — por isso o aviso diz exatamente o que acontece.
    if (status === 'encerrado' && !confirm('Encerrar a parceria?\n\nO acesso dele é revogado e nenhuma cota-parte nova é gerada. O histórico de atendimentos e repasses é preservado (é ele que comprova os pagamentos feitos).')) return;
    const { error } = await sb.rpc('admin_set_professional_status', { p_id: id, p_status: status });
    if (error) { alert(error.message); return; }
    await loadProfessionals();
  }

  // ---------------------------------------------------------------- extrato
  async function loadStatement() {
    const profId = $('eq-prof-select').value;
    if (!profId) { alert('Cadastre um profissional antes.'); return; }
    const btn = $('eq-load'); btn.disabled = true; btn.textContent = 'Carregando…';
    try {
      const { data, error } = await sb.rpc('admin_professional_statement', {
        p_professional_id: profId, p_start: $('eq-start').value, p_end: $('eq-end').value,
      });
      if (error) { alert(error.message); return; }
      entries = data || [];
      renderStatement();
    } finally { btn.disabled = false; btn.textContent = 'Ver extrato'; }
  }

  function renderStatement() {
    const tbody = $('eq-statement').querySelector('tbody');
    if (!entries.length) {
      tbody.innerHTML = '<tr><td class="admin-empty">Nenhum lançamento neste período.</td></tr>';
      $('eq-totals').hidden = true; $('eq-close-actions').hidden = true;
      return;
    }

    tbody.innerHTML = `<tr>
        <th>Dia</th><th>Tipo</th><th>Descrição</th>
        <th class="num">Bruto</th><th class="num">Taxa</th><th class="num">Custo</th>
        <th class="num">Base</th><th class="num">%</th><th class="num">Valor</th>
      </tr>` + entries.map(e => `
      <tr data-pending="${e.pending_reason ? 1 : 0}">
        <td>${dayLabel(e.entry_date)}</td>
        <td>${esc(KIND_LABEL[e.kind] || e.kind)}</td>
        <td>${esc(e.description || '')}${e.pending_reason ? `<br><small style="color:#f1c69a">${esc(e.pending_reason)}</small>` : ''}</td>
        <td class="num">${e.gross_amount != null ? money(e.gross_amount) : '—'}</td>
        <td class="num">${e.fee_amount != null ? money(e.fee_amount) : '—'}</td>
        <td class="num">${e.cost_amount != null ? money(e.cost_amount) : '—'}</td>
        <td class="num">${e.base_amount != null ? money(e.base_amount) : '—'}</td>
        <td class="num">${e.share_percent != null ? `${Number(e.share_percent)}%` : '—'}</td>
        <td class="num"><strong style="color:${Number(e.amount) < 0 ? '#e6a0a0' : 'inherit'}">${money(e.amount)}</strong></td>
      </tr>`).join('');

    const creditos = entries.reduce((a, e) => a + (Number(e.amount) > 0 ? Number(e.amount) : 0), 0);
    const debitos = entries.reduce((a, e) => a + (Number(e.amount) < 0 ? -Number(e.amount) : 0), 0);
    $('eq-credits').textContent = money(creditos);
    $('eq-debits').textContent = money(debitos);
    $('eq-net').textContent = money(creditos - debitos);
    $('eq-totals').hidden = false;
    $('eq-close-actions').hidden = false;
    $('eq-metric-apagar').textContent = money(creditos - debitos);

    // Aviso de pendência vai num elemento fixo, e não inserido ao lado do total: recarregar
    // o extrato empilharia um aviso novo a cada clique.
    const pendentes = entries.filter(e => e.pending_reason).length;
    $('eq-pending-note').textContent = pendentes
      ? `${pendentes} lançamento(s) sem cálculo — resolva antes de pagar`
      : '';
  }

  async function closeSettlement() {
    const profId = $('eq-prof-select').value;
    if (!profId) return;
    const btn = $('eq-close'); btn.disabled = true; btn.textContent = 'Fechando…';
    try {
      const { data, error } = await sb.rpc('admin_close_settlement', {
        p_professional_id: profId, p_start: $('eq-start').value, p_end: $('eq-end').value,
      });
      if (error) { alert(error.message); return; }
      const r = Array.isArray(data) ? data[0] : data;
      lastSettlementId = r?.settlement_id || null;
      $('eq-cash').textContent = money(r?.cash_expected);
      $('eq-mark-paid').disabled = !lastSettlementId;
      const conferencia = [
        `Período fechado.`,
        ``,
        `A pagar: ${money(r?.net_amount)}`,
        `Espécie que ele deveria ter entregue: ${money(r?.cash_expected)}`,
        `Espécie conferida: ${money(r?.cash_received)}`,
        Number(r?.pending_count) ? `\n⚠ ${r.pending_count} lançamento(s) sem cálculo (produto sem custo cadastrado).` : '',
      ].filter(Boolean).join('\n');
      alert(conferencia);
      await loadStatement();
    } finally { btn.disabled = false; btn.textContent = 'Fechar período e conferir'; }
  }

  // Marcar como pago e emitir o recibo são o mesmo gesto, de propósito. Separar viraria
  // "depois eu mando o recibo" — e o recibo que não sai é exatamente o que falta no dia em
  // que alguém alega não ter recebido.
  async function markPaid() {
    if (!lastSettlementId) return;
    if (!confirm('Confirmar que o Pix do repasse já foi feito?\n\nO recibo vai pro WhatsApp dele para confirmação de recebimento.')) return;
    const referencia = prompt('Referência do Pix (opcional — end-to-end, ou deixe em branco):', '') || null;
    const btn = $('eq-mark-paid'); btn.disabled = true; btn.textContent = 'Registrando…';
    try {
      const { error } = await sb.rpc('admin_mark_settlement_paid', {
        p_settlement_id: lastSettlementId, p_method: 'pix', p_reference: referencia,
      });
      if (error) { alert(error.message); btn.disabled = false; btn.textContent = 'Marcar como pago (Pix)'; return; }

      const { data, error: recErr } = await sb.functions.invoke('settlement-receipt', {
        body: { action: 'emitir', settlement_id: lastSettlementId },
      });
      // O pagamento já está registrado; falha no recibo não pode parecer falha no repasse.
      if (recErr || data?.error) {
        alert(`Repasse marcado como pago.\n\nMas o recibo NÃO foi emitido: ${data?.error || recErr?.message}\n\nTente de novo pelo botão de recibo.`);
        return;
      }
      alert(data.whatsapp_sent
        ? `Recibo ${data.receipt_number} enviado no WhatsApp dele.\n\nEle confirma o recebimento pelo link, e a quitação fica arquivada.`
        : `Recibo ${data.receipt_number} emitido, mas o WhatsApp não saiu (${data.whatsapp_error || 'motivo desconhecido'}).\n\nMande este link pra ele:\n${data.link}`);
      await loadStatement();
    } finally {
      if (btn.isConnected) btn.textContent = 'Marcar como pago (Pix)';
    }
  }

  async function addEntry() {
    const profId = $('eq-prof-select').value;
    if (!profId) return;
    const tipo = prompt('Tipo do lançamento:\n\nressarcimento — dano acordado (Anexo I, 3.4)\nestorno — venda estornada depois do repasse\najuste — correção combinada\n\nDigite um dos três:', 'ressarcimento');
    if (!tipo) return;
    const descricao = prompt('Descrição (obrigatória — lançamento sem motivo não é contestável):', '');
    if (!descricao) return;
    const valorTxt = prompt('Valor em reais. Use número negativo para descontar do repasse (ex.: -50 para um ressarcimento de R$ 50):', '-0');
    const valor = Number(String(valorTxt).replace(',', '.'));
    if (!Number.isFinite(valor) || valor === 0) { alert('Valor inválido.'); return; }
    const { error } = await sb.rpc('admin_add_ledger_entry', {
      p_professional_id: profId, p_kind: tipo.trim(), p_amount: valor, p_description: descricao.trim(),
    });
    if (error) { alert(error.message); return; }
    await loadStatement();
  }

  // ---------------------------------------------------------------- custos e taxas
  async function loadFees() {
    const { data, error } = await sb.from('payment_method_fees').select('*').order('method');
    if (error) { $('eq-fees').innerHTML = `<p class="eq-hint">${esc(error.message)}</p>`; return; }
    $('eq-fees').innerHTML = (data || []).filter(f => !['dinheiro', 'cortesia'].includes(f.method)).map(f => `
      <label>${esc(f.label)} (%)${f.configured ? '' : ' <span style="color:#f1c69a">— não configurado</span>'}
        <input type="number" step="0.01" min="0" max="99" value="${Number(f.fee_percent)}" data-eq-fee="${esc(f.method)}">
      </label>`).join('');
    $('eq-fees').querySelectorAll('[data-eq-fee]').forEach(input => {
      input.onchange = async () => {
        const { error: err } = await sb.rpc('admin_set_payment_fee', {
          p_method: input.dataset.eqFee, p_percent: Number(input.value || 0),
        });
        if (err) { alert(err.message); return; }
        await loadFees(); renderSetupAlert();
      };
    });
  }

  async function loadProducts() {
    const { data, error } = await sb.from('products').select('id,name,price,cost_price,active').eq('active', true).order('name');
    if (error) { return; }
    const tbody = $('eq-products').querySelector('tbody');
    tbody.innerHTML = `<tr><th>Produto</th><th class="num">Venda</th><th class="num">Custo</th><th class="num">Lucro</th></tr>`
      + (data || []).map(p => `
      <tr data-pending="${p.cost_price == null ? 1 : 0}">
        <td>${esc(p.name)}</td>
        <td class="num">${money(p.price)}</td>
        <td class="num"><input type="number" step="0.01" min="0" style="width:90px;padding:.3rem .5rem;border-radius:8px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);font:inherit;text-align:right" value="${p.cost_price != null ? Number(p.cost_price) : ''}" data-eq-cost="${p.id}"></td>
        <td class="num">${p.cost_price != null ? money(Number(p.price) - Number(p.cost_price)) : '—'}</td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-eq-cost]').forEach(input => {
      input.onchange = async () => {
        if (input.value === '') return;
        const { error: err } = await sb.rpc('admin_set_product_cost', {
          p_product_id: input.dataset.eqCost, p_cost: Number(input.value),
        });
        if (err) { alert(err.message); return; }
        await loadProducts(); renderSetupAlert();
      };
    });
    renderSetupAlert();
  }

  // Um aviso só, no topo, com o que ainda falta para o repasse sair correto. Vale mais que
  // três telas de configuração que ninguém abre: o erro aqui não trava nada, ele só paga
  // valor errado em silêncio — e isso é o pior tipo de bug num acerto entre duas pessoas.
  async function renderSetupAlert() {
    const box = $('eq-setup-alert');
    const pendencias = [];

    const { count: semCusto } = await sb.from('products').select('id', { count: 'exact', head: true }).is('cost_price', null).eq('active', true);
    if (semCusto) pendencias.push(`<strong>${semCusto} produto(s) sem custo cadastrado</strong> — a cota de produto fica pendente até você preencher (aba "Custos e taxas")`);

    const { data: fees } = await sb.from('payment_method_fees').select('label, configured').eq('configured', false);
    if (fees && fees.length) pendencias.push(`<strong>Taxa não configurada</strong> em: ${fees.map(f => esc(f.label)).join(', ')} — sem isso a cota sai sobre o valor cheio, incluindo o que a maquininha reteve`);

    const vencidos = professionals.filter(p => p.cnpj_pendente);
    if (vencidos.length) pendencias.push(`<strong>CNPJ vencido</strong>: ${vencidos.map(p => esc(p.display_name || p.name)).join(', ')} — prazo da Cláusula 5.3 passou`);

    box.hidden = !pendencias.length;
    box.innerHTML = pendencias.length
      ? `Antes do primeiro repasse:<ul style="margin:8px 0 0;padding-left:18px">${pendencias.map(p => `<li>${p}</li>`).join('')}</ul>`
      : '';
  }

  // Espécie pendente de conferência, para o card do topo.
  async function loadCashMetric() {
    const { data } = await sb.from('cash_handovers').select('expected_amount').is('confirmed_at', null);
    const total = (data || []).reduce((a, r) => a + Number(r.expected_amount || 0), 0);
    $('eq-metric-especie').textContent = money(total);
  }

  auth().then(() => { if (!$('admin-app').hidden) loadCashMetric(); });
})();

/* v29.233.0 — Clube do Ju: página de venda e assinatura (/clube/) e botão Imprimir do contrato.
   Fala com a Edge Function `clube` (fonte da verdade de preço, vagas, horários da Cativa e contrato).
   Nada de preço fixo aqui: tudo vem de {action:'planos'} e {action:'cotar'}.
   dataLayer SEM dado pessoal: nunca nome, telefone ou e-mail. */
(() => {
  'use strict'

  // Contrato: botão Imprimir (esta mesma folha é usada em /clube/contrato/).
  document.querySelectorAll('[data-imprimir]').forEach((b) => b.addEventListener('click', () => window.print()))

  const raiz = document.getElementById('clube-planos')
  if (!raiz) return

  const cfg = window.BDJ_AGENDA_CONFIG || {}
  const KEY = cfg.supabaseAnonKey || ''
  const ENDPOINT = (cfg.supabaseUrl || 'https://rpkqluaxhqsxnewunhfm.supabase.co') + '/functions/v1/clube'
  const WHATS = 'https://wa.me/5511967073038'

  // Cópia da régua de desconto de supabase/functions/_shared/clube-regras.ts (mudou lá, muda aqui).
  // Só para explicar a régua na tela; o valor que vale é sempre o que o servidor devolve.
  const faixaDesconto = (tabelaMensal) => (tabelaMensal >= 200 ? 25 : tabelaMensal >= 120 ? 20 : 15)
  const mensalidade = (tabelaMensal) => Math.floor(Number(tabelaMensal || 0) * (100 - faixaDesconto(Number(tabelaMensal || 0))) / 100)
  window.BDJ_CLUBE_REGUA = { faixaDesconto, mensalidade }

  // Resumo de cada serviço, como a casa oferece (Barba Express é só na máquina; regra de 01/09/2026).
  const RESUMO_SERVICO = {
    'Barba Express': 'Barba Express (feita só na máquina)',
    'Barba na navalha com toalha quente': 'Barboterapia (navalha e toalha quente)',
    'Barboterapia com vaporizador de ozônio': 'Barboterapia com vaporizador de ozônio (a mais completa)',
    'Corte + Barba Express': 'Corte + Barba Express (barba feita só na máquina)',
    'Corte + Barba na navalha com toalha quente': 'Corte + Barboterapia (navalha e toalha quente)',
  }
  const COMBO_DE = { 'Barba Express': 'Corte + Barba Express', 'Barba na navalha com toalha quente': 'Corte + Barba na navalha com toalha quente' }
  const DIAS = { 2: 'Terça', 3: 'Quarta', 4: 'Quinta' }
  const DIAS_MIN = { 2: 'terça', 3: 'quarta', 4: 'quinta' }

  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const money = (v) => {
    const n = Number(v || 0)
    return 'R$\u00a0' + n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
  }
  const nomeServico = (s) => RESUMO_SERVICO[s] || s
  const digits = (s) => String(s || '').replace(/\D/g, '')
  const telefoneValido = (d) => d.length === 10 || d.length === 11 || ((d.length === 12 || d.length === 13) && d.startsWith('55'))
  const emailValido = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)
  const push = (event, extra) => { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event }, extra || {})) } catch (e) { /* sem GTM, segue */ } }

  const api = async (payload) => {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(payload),
    })
    let data = {}
    try { data = await r.json() } catch (e) { data = {} }
    if (!r.ok && !data.error) data.error = 'Não foi possível concluir agora. Tente de novo em instantes.'
    return data
  }

  const estado = {
    dados: null,
    plano: null,
    sob: { itens: [], visitas: 2, cota: null, seq: 0, timer: 0 },
    cativa: { dia: null, hora: '' },
    enviando: false,
    esperaPlano: null,
  }

  // ---------- disponibilidade (nunca mostra número de vagas livres) ----------
  const situacaoDo = (plano) => {
    const v = (estado.dados.vagas || []).find((x) => x.pool === plano.pool)
    if (v && v.vendas_abertas === false) return 'pre'
    if (v && Number(v.livres) <= 0) return 'esgotado'
    if (plano.kind === 'cativa' && !(estado.dados.cativa_horarios || []).length) return 'esgotado'
    return 'aberto'
  }
  const totalCativa = () => {
    const v = (estado.dados.vagas || []).find((x) => x.pool === 'cativa')
    return v && Number(v.total) > 0 ? Number(v.total) : 5
  }

  // ---------- cards ----------
  const incluiTexto = (p) => {
    if (p.kind === 'cativa') {
      const extras = Object.entries(p.extras_per_cycle || {}).map(([n, q]) => `${q > 1 ? q + ' ' : 'uma '}${n.split(' / ')[0].toLowerCase()} por mês`)
      return `Toda semana, no seu horário fixo: ${(p.visit_items || []).map(nomeServico).join(' + ')}${extras.length ? ', mais ' + extras.join(', ') : ''}.`
    }
    const itens = (p.visit_items || []).map(nomeServico).join(' + ')
    return `${p.visits_per_cycle} ${p.visits_per_cycle === 1 ? 'visita' : 'visitas'} por mês. Cada visita: ${itens}.`
  }

  const botaoDoPlano = (p, situacao) => {
    if (situacao === 'pre') return `<button type="button" class="btn" data-espera="${esc(p.id)}" data-motivo="pre">As assinaturas abrem em 1º de outubro</button>`
    if (situacao === 'esgotado') {
      const txt = p.kind === 'cativa' ? 'Cadeira Cativa esgotada — entre na lista de espera' : 'Vagas esgotadas'
      return `<p class="clube-card-estado">${txt}</p><button type="button" class="btn" data-espera="${esc(p.id)}" data-motivo="esgotado">Entrar na lista de espera</button>`
    }
    return `<button type="button" class="btn primary" data-assinar="${esc(p.id)}"${p.kind === 'sob_medida' ? ' disabled' : ''}>Assinar</button>`
  }

  const cardFixo = (p) => {
    const sit = situacaoDo(p)
    const tabela = Number(p.table_value || 0), preco = Number(p.price || 0)
    const economia = Math.max(0, tabela - preco)
    const extraCativa = p.kind === 'cativa'
      ? `<p>Um dia e um horário só seus, toda semana, de terça a quinta. É o plano mais limitado: só ${totalCativa()} vagas no total.</p>`
      : ''
    return `<article class="clube-card" data-plano="${esc(p.id)}">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.summary)}</p>
      <p class="clube-inclui">${esc(incluiTexto(p))}</p>
      ${extraCativa}
      <p class="clube-preco"><strong>${money(preco)}</strong><small>por mês</small></p>
      ${tabela > preco ? `<p class="clube-tabela">tabela <s>${money(tabela)}</s></p><p class="clube-economia">Economia de ${money(economia)} por mês</p>` : ''}
      ${botaoDoPlano(p, sit)}
    </article>`
  }

  const cardSobMedida = (p) => {
    const sm = estado.dados.sob_medida || { servicos: [], visitas: { min: 2, max: 4 } }
    const vmin = Number(sm.visitas?.min || 2), vmax = Number(sm.visitas?.max || 4)
    const servicos = (sm.servicos || []).map((s, i) => `<label class="clube-check"><input type="checkbox" value="${esc(s.name)}" data-sm-item id="sm-${i}"><span>${esc(nomeServico(s.name))}</span><em>${money(s.price)}</em></label>`).join('')
    const visitas = []
    for (let v = vmin; v <= vmax; v++) visitas.push(`<label><input type="radio" name="sm-visitas" value="${v}"${v === estado.sob.visitas ? ' checked' : ''}><span>${v}</span></label>`)
    return `<article class="clube-card clube-card--largo" data-plano="${esc(p.id)}">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.summary)}. O desconto segue a tabela do mês: 15% até ${money(119)}, 20% de ${money(120)} a ${money(199)} e 25% a partir de ${money(200)}.</p>
      <div class="clube-montador">
        <fieldset class="clube-servicos"><legend>Serviços de cada visita (preço de tabela)</legend>${servicos}</fieldset>
        <div>
          <fieldset class="clube-visitas"><legend>Visitas por mês</legend><div class="clube-seg">${visitas.join('')}</div></fieldset>
          <div class="clube-cota" id="sm-cota" aria-live="polite"><p>Escolha os serviços de cada visita.</p></div>
        </div>
      </div>
      ${botaoDoPlano(p, situacaoDo(p))}
    </article>`
  }

  const renderPlanos = () => {
    const planos = [...(estado.dados.planos || [])].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    raiz.innerHTML = planos.map((p) => (p.kind === 'sob_medida' ? cardSobMedida(p) : cardFixo(p))).join('')
    raiz.querySelectorAll('[data-assinar]').forEach((b) => b.addEventListener('click', () => abrirAssinatura(b.dataset.assinar)))
    raiz.querySelectorAll('[data-espera]').forEach((b) => b.addEventListener('click', () => abrirEspera(b.dataset.espera, b.dataset.motivo)))
    raiz.querySelectorAll('[data-sm-item]').forEach((c) => c.addEventListener('change', onSobMedidaMudou))
    raiz.querySelectorAll('input[name="sm-visitas"]').forEach((r) => r.addEventListener('change', onSobMedidaMudou))
    observarCards()
  }

  const observarCards = () => {
    if (!('IntersectionObserver' in window)) return
    const vistos = new Set()
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        const id = e.target.dataset.plano
        if (e.isIntersecting && !vistos.has(id)) { vistos.add(id); push('clube_ver_plano', { plano: id }); io.unobserve(e.target) }
      })
    }, { threshold: 0.5 })
    raiz.querySelectorAll('.clube-card').forEach((c) => io.observe(c))
  }

  // ---------- Sob Medida ----------
  const precoSM = (nome) => Number(((estado.dados.sob_medida || {}).servicos || []).find((s) => s.name === nome)?.price || 0)
  const planoSobMedida = () => (estado.dados.planos || []).find((p) => p.kind === 'sob_medida')

  const onSobMedidaMudou = () => {
    estado.sob.itens = [...raiz.querySelectorAll('[data-sm-item]:checked')].map((c) => c.value)
    const r = raiz.querySelector('input[name="sm-visitas"]:checked')
    estado.sob.visitas = r ? Number(r.value) : estado.sob.visitas
    estado.sob.cota = null
    if (estado.plano && estado.plano.kind === 'sob_medida' && !secAssinar.hidden && !estado.enviando) secAssinar.hidden = true
    const botao = raiz.querySelector('[data-assinar="' + (planoSobMedida()?.id || '') + '"]')
    if (botao) botao.disabled = true
    const box = $('sm-cota')
    clearTimeout(estado.sob.timer)
    if (!estado.sob.itens.length) { box.innerHTML = '<p>Escolha os serviços de cada visita.</p>'; return }
    box.innerHTML = '<p>Calculando...</p>'
    estado.sob.timer = setTimeout(cotar, 250)
  }

  const dicaCombo = () => {
    const itens = estado.sob.itens
    if (!itens.includes('Corte de cabelo')) return ''
    const barba = Object.keys(COMBO_DE).find((b) => itens.includes(b))
    if (!barba) return ''
    const combo = COMBO_DE[barba]
    const soltos = precoSM('Corte de cabelo') + precoSM(barba)
    const junto = precoSM(combo)
    if (!junto || junto >= soltos) return ''
    return `<p class="clube-dica">Dica: marque "${esc(nomeServico(combo))}" no lugar do corte e da barba separados. Sai ${money(soltos - junto)} mais barato por visita.<button type="button" class="clube-btn-link" data-trocar-combo="${esc(combo)}" data-barba="${esc(barba)}">Trocar pelo combo</button></p>`
  }

  const cotar = async () => {
    const seq = ++estado.sob.seq
    const box = $('sm-cota')
    const itens = [...estado.sob.itens], visitas = estado.sob.visitas
    let r
    try { r = await api({ action: 'cotar', itens, visitas }) } catch (e) { r = { error: 'Sem conexão para calcular agora. Tente de novo em instantes.' } }
    if (seq !== estado.sob.seq) return // resposta velha
    const botao = raiz.querySelector('[data-assinar="' + (planoSobMedida()?.id || '') + '"]')
    if (r.error || !r.ok) {
      box.innerHTML = `<p class="clube-erro">${esc(r.error || 'Não foi possível calcular.')}</p>${dicaCombo()}`
    } else {
      estado.sob.cota = r
      const economia = Math.max(0, Number(r.tabelaMensal) - Number(r.preco))
      box.innerHTML = `<p class="clube-tabela">Tabela no mês: <s>${money(r.tabelaMensal)}</s> (${visitas} visitas de ${money(r.porVisita)})</p>
        <p class="clube-economia">Desconto de ${r.pct}%: economia de ${money(economia)} por mês</p>
        <p class="clube-preco"><strong>${money(r.preco)}</strong><small>por mês</small></p>${dicaCombo()}`
      if (botao) botao.disabled = false
    }
    const troca = box.querySelector('[data-trocar-combo]')
    if (troca) troca.addEventListener('click', () => {
      raiz.querySelectorAll('[data-sm-item]').forEach((c) => {
        if (c.value === 'Corte de cabelo' || c.value === troca.dataset.barba) c.checked = false
        if (c.value === troca.dataset.trocarCombo) c.checked = true
      })
      onSobMedidaMudou()
    })
  }

  // ---------- Assinatura: etapas ----------
  const secAssinar = $('assinar'), secEspera = $('espera')
  const irPara = (passo) => {
    secAssinar.querySelectorAll('.clube-passo').forEach((d) => { d.hidden = d.dataset.passo !== String(passo) })
  }
  const focarTopo = (sec) => {
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const h = sec.querySelector('h2'); if (h) setTimeout(() => h.focus({ preventScroll: true }), 300)
  }
  const erro = (id, msg) => { const el = $(id); if (el) el.textContent = msg || '' }

  const planoPorId = (id) => (estado.dados.planos || []).find((p) => p.id === id)
  const valorAtual = () => {
    const p = estado.plano
    if (!p) return 0
    return p.kind === 'sob_medida' ? Number(estado.sob.cota?.preco || 0) : Number(p.price || 0)
  }
  const itensAtuais = () => {
    const p = estado.plano
    if (p.kind === 'sob_medida') return { itens: estado.sob.cota?.itens || [], visitas: estado.sob.cota?.visitas }
    return { itens: p.visit_items || [], visitas: p.visits_per_cycle }
  }
  const linhaInclui = () => {
    const p = estado.plano
    if (p.kind === 'cativa') {
      const quando = estado.cativa.dia && estado.cativa.hora ? ` (toda ${DIAS_MIN[estado.cativa.dia]} às ${estado.cativa.hora})` : ''
      return incluiTexto(p).replace('no seu horário fixo', 'no seu horário fixo' + quando)
    }
    const { itens, visitas } = itensAtuais()
    return `${visitas} visitas por mês. Cada visita: ${itens.map(nomeServico).join(' + ')}.`
  }

  const renderResumoPlano = () => {
    const p = estado.plano
    const tabela = p.kind === 'sob_medida' ? Number(estado.sob.cota?.tabelaMensal || 0) : Number(p.table_value || 0)
    $('assinar-plano-resumo').innerHTML = `<dl>
      <dt>Plano</dt><dd><strong>${esc(p.name)}</strong></dd>
      <dt>O que inclui</dt><dd>${esc(linhaInclui())}</dd>
      <dt>Mensalidade</dt><dd><strong>${money(valorAtual())} por mês</strong>${tabela > valorAtual() ? ` (tabela <s>${money(tabela)}</s>)` : ''}</dd>
    </dl>`
  }

  const renderCativa = () => {
    const box = $('assinar-cativa')
    if (estado.plano.kind !== 'cativa') { box.hidden = true; return }
    box.hidden = false
    const horarios = estado.dados.cativa_horarios || []
    const dias = [2, 3, 4].filter((d) => horarios.some((h) => Number(h.weekday) === d))
    $('cativa-dias').innerHTML = dias.map((d) => `<button type="button" data-dia="${d}" aria-pressed="${estado.cativa.dia === d}">${DIAS[d]}</button>`).join('')
    $('cativa-dias').querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => {
      estado.cativa.dia = Number(b.dataset.dia); estado.cativa.hora = ''
      renderCativa(); renderResumoPlano(); erro('passo1-erro', '')
      $('cativa-hora').focus()
    }))
    const campo = $('cativa-hora-campo'), sel = $('cativa-hora')
    if (!estado.cativa.dia) { campo.hidden = true; return }
    campo.hidden = false
    const lista = horarios.filter((h) => Number(h.weekday) === estado.cativa.dia).map((h) => h.time)
    sel.innerHTML = '<option value="">Escolha um horário</option>' + lista.map((t) => `<option value="${esc(t)}"${t === estado.cativa.hora ? ' selected' : ''}>${esc(t.replace(':', 'h'))}</option>`).join('')
  }
  $('cativa-hora').addEventListener('change', (e) => { estado.cativa.hora = e.target.value; renderResumoPlano(); erro('passo1-erro', '') })

  const abrirAssinatura = (id) => {
    const p = planoPorId(id)
    if (!p) return
    if (p.kind === 'sob_medida' && !estado.sob.cota) { erro('passo1-erro', ''); return }
    estado.plano = p
    if (p.kind !== 'cativa') estado.cativa = { dia: null, hora: '' }
    secEspera.hidden = true
    secAssinar.hidden = false
    ;['passo1-erro', 'passo2-erro', 'passo3-erro'].forEach((e) => erro(e, ''))
    renderResumoPlano(); renderCativa()
    irPara(1)
    focarTopo(secAssinar)
    push('clube_iniciar_assinatura', { plano: p.id })
  }

  const fechar = () => {
    secAssinar.hidden = true; secEspera.hidden = true
    $('planos').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fechar))
  secAssinar.querySelectorAll('[data-voltar]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.voltar)))

  $('passo1-continuar').addEventListener('click', () => {
    const p = estado.plano
    if (p.kind === 'sob_medida' && !estado.sob.cota) return erro('passo1-erro', 'Monte o seu Sob Medida na lista de planos antes de continuar.')
    if (p.kind === 'cativa' && !estado.cativa.dia) return erro('passo1-erro', 'Escolha o dia fixo da semana.')
    if (p.kind === 'cativa' && !estado.cativa.hora) return erro('passo1-erro', 'Escolha o horário fixo.')
    erro('passo1-erro', '')
    irPara(2)
    $('f-nome').focus()
  })

  // Código no WhatsApp
  let contagem = 0
  const bloquearCodigo = (seg) => {
    const b = $('btn-codigo')
    clearInterval(contagem)
    let s = Math.max(1, Math.round(seg))
    b.disabled = true
    const tick = () => {
      if (s <= 0) { clearInterval(contagem); b.disabled = false; b.textContent = 'Pedir outro código'; return }
      b.textContent = `Pedir outro código em ${s} s`
      s--
    }
    tick()
    contagem = setInterval(tick, 1000)
  }
  $('btn-codigo').addEventListener('click', async () => {
    const tel = digits($('f-telefone').value)
    const msg = $('codigo-msg')
    msg.className = 'clube-msg'
    if (!telefoneValido(tel)) { $('f-telefone').setAttribute('aria-invalid', 'true'); msg.classList.add('clube-erro'); msg.textContent = 'Informe um WhatsApp válido com DDD.'; return }
    $('f-telefone').removeAttribute('aria-invalid')
    const b = $('btn-codigo')
    b.disabled = true; b.textContent = 'Enviando...'
    let r
    try { r = await api({ action: 'enviar_codigo', telefone: tel }) } catch (e) { r = { error: 'Sem conexão agora. Tente de novo em instantes.' } }
    if (r.error) {
      msg.classList.add('clube-erro'); msg.textContent = r.error
      b.disabled = false; b.textContent = 'Receber código no WhatsApp'
      return
    }
    if (r.waitSeconds) {
      msg.classList.add('clube-ok'); msg.textContent = 'Um código foi enviado há pouco. Confira o WhatsApp ou aguarde para pedir outro.'
      bloquearCodigo(Number(r.waitSeconds))
    } else {
      msg.classList.add('clube-ok'); msg.textContent = 'Enviamos o código para o seu WhatsApp. Ele vale por 10 minutos.'
      bloquearCodigo(60)
      push('clube_codigo_enviado')
    }
    $('f-codigo').focus()
  })
  $('f-codigo').addEventListener('input', (e) => { const d = digits(e.target.value).slice(0, 6); if (d !== e.target.value) e.target.value = d })

  const validarDados = () => {
    const nome = $('f-nome').value.trim().replace(/\s+/g, ' ')
    const tel = digits($('f-telefone').value)
    const email = $('f-email').value.trim()
    const cod = digits($('f-codigo').value)
    const marcar = (id, ruim) => (ruim ? $(id).setAttribute('aria-invalid', 'true') : $(id).removeAttribute('aria-invalid'))
    marcar('f-nome', nome.split(' ').length < 2); marcar('f-telefone', !telefoneValido(tel)); marcar('f-email', !emailValido(email)); marcar('f-codigo', cod.length !== 6)
    if (nome.split(' ').length < 2) return 'Informe nome e sobrenome.'
    if (!telefoneValido(tel)) return 'Informe um WhatsApp válido com DDD.'
    if (!emailValido(email)) return 'Informe um e-mail válido.'
    if (cod.length !== 6) return 'Digite o código de 6 dígitos que chegou no WhatsApp.'
    return ''
  }
  $('passo2-continuar').addEventListener('click', () => {
    const e = validarDados()
    erro('passo2-erro', e)
    if (e) { const inv = secAssinar.querySelector('[data-passo="2"] [aria-invalid="true"]'); if (inv) inv.focus(); return }
    renderResumoContrato()
    irPara(3)
    focarTopo(secAssinar)
  })

  const renderResumoContrato = () => {
    const p = estado.plano
    const c = estado.dados.contrato || {}
    const cativa = p.kind === 'cativa'
    const regraAntecedencia = cativa
      ? 'O seu horário é fixo toda semana. Horário extra fora dele segue a regra geral: marcar com no mínimo 7 e no máximo 30 dias de antecedência.'
      : 'Marque com NO MÍNIMO 7 e NO MÁXIMO 30 DIAS de antecedência. Horário marcado com menos de 7 dias sai pelo preço normal.'
    $('resumo-contrato').innerHTML = `
      <h3>Prestador</h3>
      <p>Juliano Bruno Lopes Padilha (Barbearia do Ju), CNPJ 65.192.881/0001-35. Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista/SP. WhatsApp (11) 96707-3038.</p>
      <h3>Assinante</h3>
      <p>${esc($('f-nome').value.trim())} · WhatsApp ${esc($('f-telefone').value.trim())} · ${esc($('f-email').value.trim())}</p>
      <h3>O que você está contratando</h3>
      <dl>
        <dt>Plano</dt><dd><strong>${esc(p.name)}</strong></dd>
        <dt>O que inclui</dt><dd>${esc(linhaInclui())}</dd>
        <dt>Mensalidade</dt><dd><strong>${money(valorAtual())} por mês</strong></dd>
        <dt>Pagamento</dt><dd>Ciclo mensal pago adiantado, por Pix ou cartão, pelo link de pagamento do PagBank. O ciclo começa no dia em que o pagamento é confirmado e dura um mês. O link da renovação chega pelo WhatsApp até 3 dias antes do fim do ciclo.</dd>
      </dl>
      <div class="clube-destaque">
        <h3>Regras que limitam o uso (leia com atenção)</h3>
        <ul>
          <li>O Clube vale SÓ DE TERÇA A QUINTA-FEIRA. Em outro dia, o atendimento sai pelo preço normal.</li>
          <li>${regraAntecedencia}</li>
          <li>CANCELAR COM MENOS DE 24 HORAS OU FALTAR SEM AVISO CONTA COMO VISITA USADA. Com 24 horas ou mais, a visita volta ao saldo.</li>
          <li>As visitas valem SÓ DENTRO DO CICLO MENSAL. Visita não usada não passa para o ciclo seguinte e não vira dinheiro.</li>
          <li>O plano é PESSOAL E INTRANSFERÍVEL: só você usa as visitas.</li>
          <li>Renovação não paga deixa a assinatura em aberto: os horários saem pelo preço normal até o pagamento. DEPOIS DE 15 DIAS EM ABERTO, A ASSINATURA É ENCERRADA.</li>
        </ul>
      </div>
      <h3>Seus direitos</h3>
      <ul>
        <li>Desistir em até 7 dias da contratação, sem dar motivo, com devolução do valor pago. Se já tiver usado alguma visita, é descontado só o preço de tabela do que foi feito.</li>
        <li>Cancelar quando quiser, sem multa e sem fidelidade. Você usa as visitas do ciclo já pago até o fim dele, e não há nova cobrança.</li>
        <li>Se a barbearia fechar num dia em que você tinha horário, a visita não se perde.</li>
        <li>Reajuste só com aviso de 30 dias. O ciclo já pago nunca muda de preço.</li>
      </ul>
      <p>Contrato versão ${esc(c.versao || 'v1')}. Código de integridade (SHA-256): <span class="clube-hash">${esc(c.sha256 || '')}</span></p>`
    secAssinar.querySelectorAll('[data-versao]').forEach((s) => { s.textContent = c.versao || 'v1' })
  }

  // Envio final
  $('btn-assinar').addEventListener('click', async () => {
    if (estado.enviando) return
    const aceites = ['aceite-contrato', 'aceite-regras', 'aceite-privacidade'].map((id) => $(id).checked)
    if (aceites.includes(false)) { erro('passo3-erro', 'Para assinar, marque as três confirmações.'); const f = ['aceite-contrato', 'aceite-regras', 'aceite-privacidade'].find((id) => !$(id).checked); $(f).focus(); return }
    const e = validarDados()
    if (e) { erro('passo3-erro', e + ' Volte à etapa anterior para corrigir.'); return }
    erro('passo3-erro', '')
    const p = estado.plano
    if (p.kind === 'sob_medida' && !estado.sob.cota) { erro('passo3-erro', 'Monte o seu Sob Medida de novo na lista de planos.'); return }
    const c = estado.dados.contrato || {}
    const payload = {
      action: 'assinar', plano: p.id,
      nome: $('f-nome').value.trim().replace(/\s+/g, ' '), telefone: digits($('f-telefone').value), email: $('f-email').value.trim(),
      codigo: digits($('f-codigo').value),
      aceite: { contrato: true, regras: true, privacidade: true },
      contrato_versao: c.versao, contrato_sha256: c.sha256,
    }
    if (p.kind === 'sob_medida') { payload.itens = estado.sob.cota.itens; payload.visitas = estado.sob.cota.visitas }
    if (p.kind === 'cativa') payload.cativa = { dia: estado.cativa.dia, hora: estado.cativa.hora }
    const valor = valorAtual()
    const b = $('btn-assinar')
    estado.enviando = true; b.disabled = true; b.textContent = 'Enviando...'
    push('clube_assinar_enviado', { plano: p.id, valor })
    let r
    try { r = await api(payload) } catch (err) { r = { error: 'Sem conexão agora. Nada foi cobrado. Tente de novo em instantes.' } }
    if (r.error || !r.ok) {
      erro('passo3-erro', r.error || 'Não foi possível concluir agora. Tente de novo em instantes.')
      estado.enviando = false; b.disabled = false; b.textContent = 'Assinar e ir para o pagamento'
      return
    }
    const fim = $('assinar-fim')
    if (r.lista_espera) {
      fim.innerHTML = `<h3>As vagas acabaram</h3><p>As vagas do plano ${esc(p.name)} acabaram agora há pouco. Você entrou na lista de espera e avisamos pelo WhatsApp quando abrir uma vaga. Nada foi cobrado.</p>`
      irPara('fim'); focarTopo(secAssinar); return
    }
    const url = String(r.pay_url || '')
    if (!/^https:\/\//.test(url)) {
      fim.innerHTML = `<h3>Assinatura registrada</h3><p>O link de pagamento foi enviado para o seu WhatsApp. Se não chegar em alguns minutos, fale com a barbearia: <a href="${WHATS}" target="_blank" rel="noopener">(11) 96707-3038</a>.</p>`
      irPara('fim'); focarTopo(secAssinar); return
    }
    fim.innerHTML = `<h3>Quase lá</h3><p>Sua assinatura foi registrada. Agora é só pagar a primeira mensalidade de ${money(valor)} por Pix ou cartão na página do PagBank. Estamos te levando para lá.</p>
      <p>Se a página não abrir sozinha, <a class="btn primary" id="link-pagamento" href="${esc(url)}" rel="noopener">abra o pagamento aqui</a></p>
      <p class="clube-nota">O link de pagamento e o link da sua assinatura também foram enviados para o seu WhatsApp.</p>`
    irPara('fim'); focarTopo(secAssinar)
    push('clube_redirecionado_pagamento', { plano: p.id, valor })
    setTimeout(() => { window.location.href = url }, 1800)
  })

  // ---------- Lista de espera ----------
  const abrirEspera = (id, motivo) => {
    const p = planoPorId(id)
    estado.esperaPlano = p ? p.id : null
    $('espera-texto').textContent = motivo === 'pre'
      ? `As assinaturas abrem em 1º de outubro. Deixe seu nome e WhatsApp que avisamos quando abrir${p ? ' (plano ' + p.name + ')' : ''}.`
      : `As vagas ${p && p.kind === 'cativa' ? 'da Cadeira Cativa' : 'do plano ' + (p ? p.name : '')} estão esgotadas. Deixe seu nome e WhatsApp que avisamos quando abrir uma vaga.`
    $('espera-titulo').textContent = motivo === 'pre' ? 'Avise-me quando abrir' : 'Lista de espera'
    erro('espera-erro', ''); $('espera-ok').textContent = ''
    $('btn-espera').disabled = false
    secAssinar.hidden = true; secEspera.hidden = false
    focarTopo(secEspera)
  }
  $('btn-espera').addEventListener('click', async () => {
    const nome = $('e-nome').value.trim()
    const tel = digits($('e-telefone').value)
    if (!nome) { erro('espera-erro', 'Informe o seu nome.'); $('e-nome').focus(); return }
    if (!telefoneValido(tel)) { erro('espera-erro', 'Informe um WhatsApp válido com DDD.'); $('e-telefone').focus(); return }
    erro('espera-erro', '')
    const b = $('btn-espera')
    b.disabled = true; b.textContent = 'Enviando...'
    let r
    try { r = await api({ action: 'lista_espera', nome, telefone: tel, plano: estado.esperaPlano }) } catch (e) { r = { error: 'Sem conexão agora. Tente de novo em instantes.' } }
    b.textContent = 'Entrar na lista de espera'
    if (r.error || !r.ok) { erro('espera-erro', r.error || 'Não foi possível concluir agora.'); b.disabled = false; return }
    $('espera-ok').textContent = 'Pronto. Você está na lista e avisamos pelo WhatsApp.'
  })

  // ---------- carga ----------
  const carregar = async () => {
    let r
    try { r = await api({ action: 'planos' }) } catch (e) { r = { error: 'rede' } }
    if (!r || !r.ok || !Array.isArray(r.planos) || !r.planos.length) {
      raiz.innerHTML = `<p class="clube-erro-geral">Não foi possível carregar os planos agora. Tente recarregar a página em instantes ou fale com a barbearia pelo <a href="${WHATS}" target="_blank" rel="noopener">WhatsApp (11) 96707-3038</a>.</p>`
      return
    }
    estado.dados = r
    renderPlanos()
  }
  carregar()
})()

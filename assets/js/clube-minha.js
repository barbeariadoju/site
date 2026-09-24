/* v29.233.0 — Clube do Ju: página Minha assinatura (/clube/minha-assinatura/?c=CÓDIGO&t=TOKEN).
   O link com código e token chega pelo WhatsApp. O token NÃO é guardado no navegador
   (nem localStorage nem sessionStorage): só vive na URL que o próprio cliente recebeu.
   Esta página não carrega GTM/GA, para o token da URL não ir parar em relatório de terceiros. */
(() => {
  'use strict'
  const cfg = window.BDJ_AGENDA_CONFIG || {}
  const KEY = cfg.supabaseAnonKey || ''
  const ENDPOINT = (cfg.supabaseUrl || 'https://rpkqluaxhqsxnewunhfm.supabase.co') + '/functions/v1/clube'
  const WHATS = 'https://wa.me/5511967073038'

  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const money = (v) => { const n = Number(v || 0); return 'R$\u00a0' + n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) }
  const ddmm = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : '' }
  const ddmmaaaa = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '' }
  const hora = (t) => String(t || '').slice(0, 5).replace(':', 'h')
  const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const DIA_ISO = { 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado', 7: 'domingo' }
  const diaDaData = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; return SEMANA[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] }
  const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const pick = (o, ...ks) => { for (const k of ks) { const v = k.split('.').reduce((a, p) => (a == null ? undefined : a[p]), o); if (v !== undefined && v !== null && v !== '') return v } return undefined }

  const qs = new URLSearchParams(location.search)
  const c = String(qs.get('c') || '').trim().toUpperCase()
  const t = String(qs.get('t') || '').trim()
  const pago = qs.get('pago') === '1'

  const api = async (payload) => {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(Object.assign({ c, t }, payload)),
    })
    let data = {}
    try { data = await r.json() } catch (e) { data = {} }
    if (!r.ok && !data.error) data.error = 'Não foi possível concluir agora. Tente de novo em instantes.'
    return data
  }

  const intro = $('minha-intro')
  const painel = $('minha-painel')
  const invalido = (msg) => {
    painel.hidden = true
    intro.innerHTML = `${esc(msg)} Use o link que chegou no seu WhatsApp ou fale com a barbearia pelo <a href="${WHATS}" target="_blank" rel="noopener">WhatsApp (11) 96707-3038</a>.`
  }

  const STATUS = {
    aguardando_pagamento: ['Aguardando pagamento', 'A assinatura começa no dia em que o primeiro pagamento for confirmado.'],
    ativa: ['Ativa', 'Seu plano está valendo. Marque os horários de terça a quinta.'],
    atrasada: ['Em aberto', 'A renovação ainda não foi paga. Seus horários continuam marcados, mas saem pelo preço normal até o pagamento. Pagou, a cobertura volta na hora. Depois de 15 dias em aberto, a assinatura é encerrada.'],
    cancelada: ['Cancelada', 'Esta assinatura foi cancelada.'],
    arrependida: ['Desistência registrada', 'Você desistiu da assinatura no prazo de 7 dias.'],
    expirada: ['Expirada', 'O pagamento não foi concluído e esta tentativa de assinatura expirou.'],
    encerrada: ['Encerrada', 'Esta assinatura foi encerrada.'],
  }
  const VIVAS = ['aguardando_pagamento', 'ativa', 'atrasada']

  let atual = null

  const render = (a) => {
    atual = a
    const status = String(pick(a, 'status') || '')
    const [rotulo, texto] = STATUS[status] || [status || 'Situação desconhecida', '']
    const planoNome = pick(a, 'plano.name', 'plan.name', 'plan_name', 'plano_nome', 'plano')
    const nomePlano = typeof planoNome === 'string' ? planoNome : 'Clube do Ju'
    const fim = pick(a, 'current_cycle_end', 'ciclo_fim', 'ciclo.fim')
    const inicio = pick(a, 'current_cycle_start', 'ciclo_inicio', 'ciclo.inicio')
    const cancelFim = pick(a, 'cancel_at_cycle_end') === true
    const preco = pick(a, 'price', 'mensalidade', 'valor')
    const wd = Number(pick(a, 'fixed_weekday', 'cativa.dia'))
    const fixo = pick(a, 'fixed_time', 'cativa.hora')
    const itens = pick(a, 'visit_items', 'itens')
    const cativa = pick(a, 'kind') === 'cativa' || !!(wd && fixo)

    const primeiro = String(pick(a, 'name') || '').trim().split(/\s+/)[0] || ''
    const saud = primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : ''
    intro.textContent = `Olá${saud ? ', ' + saud : ''}. Aqui está o resumo da sua assinatura do Clube do Ju.`
    $('m-plano').textContent = nomePlano
    const st = $('m-status')
    st.className = 'clube-status clube-status--' + (status || 'x')
    st.textContent = cancelFim && status === 'ativa' ? 'Ativa até ' + ddmm(fim) : rotulo
    $('m-status-texto').textContent = cancelFim && VIVAS.includes(status)
      ? `Cancelamento registrado: você continua usando o Clube até ${ddmm(fim)} e não há nova cobrança.`
      : texto

    const linhas = []
    if (Array.isArray(itens) && itens.length) linhas.push(['Cada visita', itens.join(' + ')])
    if (preco != null) linhas.push(['Mensalidade', money(preco) + ' por mês'])
    if (inicio && fim) linhas.push(['Ciclo atual', `${ddmm(inicio)} a ${ddmm(fim)}`])
    if (cativa && wd && fixo) linhas.push(['Horário fixo', `toda ${DIA_ISO[wd] || ''} às ${hora(fixo)}`])
    $('m-dados').innerHTML = linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')

    // Uso no ciclo
    const usadas = Number(pick(a, 'usadas_no_ciclo', 'uso.usadas') || 0)
    const bonusObj = pick(a, 'bonus_visits') || {}
    const bonus = inicio && typeof bonusObj === 'object' ? Number(bonusObj[String(inicio).slice(0, 10)] || 0) : 0
    const total = Number(pick(a, 'visits_per_cycle', 'uso.total') || 0) + (cativa ? 0 : bonus)
    const uso = $('m-uso')
    if (cativa) {
      uso.innerHTML = `<p>Toda semana no seu horário fixo: <strong>${esc(DIA_ISO[wd] || '')} ${esc(hora(fixo))}</strong>.</p>${usadas ? `<p>Atendimentos usados ou já marcados neste ciclo: ${usadas}.</p>` : ''}${bonus > 0 ? `<p>Você tem ${bonus} ${bonus === 1 ? 'visita extra' : 'visitas extras'} neste ciclo, por semana em que a barbearia fechou.</p>` : ''}`
    } else if (total > 0) {
      const pct = Math.min(100, Math.round((usadas / total) * 100))
      uso.innerHTML = `<p><strong>${usadas} de ${total}</strong> visitas usadas ou já marcadas neste ciclo${fim ? ' (vale até ' + ddmm(fim) + ')' : ''}.</p>${bonus > 0 ? `<p>Inclui ${bonus} ${bonus === 1 ? 'visita extra' : 'visitas extras'} por dia em que a barbearia fechou.</p>` : ''}
        <div class="clube-medidor" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${usadas}" aria-label="Visitas usadas"><span></span></div>
        <p class="clube-nota">Visita não usada não passa para o ciclo seguinte.</p>`
      uso.querySelector('.clube-medidor span').style.width = pct + '%'
    } else {
      uso.innerHTML = '<p>As visitas aparecem aqui quando o ciclo estiver ativo.</p>'
    }

    // Próximos horários
    const prox = Array.isArray(a.proximos) ? a.proximos : []
    $('m-proximos').innerHTML = prox.length
      ? `<ul class="clube-lista">${prox.map((p) => `<li><span>${esc(diaDaData(p.date))} ${esc(ddmm(p.date))} às ${esc(hora(p.time))} · ${esc(p.service || '')}</span><span class="clube-selo${p.coberto ? ' clube-selo--coberto' : ''}">${p.coberto ? 'coberto pelo Clube' : 'preço normal'}</span></li>`).join('')}</ul>`
      : '<p>Nenhum horário marcado.</p>'

    // Pagamento
    const pend = pick(a, 'cobranca_pendente', 'pendente', 'pending_charge')
    const pagarBloco = $('m-pagar-bloco')
    if (VIVAS.includes(status) && (pend || status === 'aguardando_pagamento' || status === 'atrasada') && !(cancelFim && !pend)) {
      pagarBloco.hidden = false
      const valor = pend && typeof pend === 'object' ? pick(pend, 'amount', 'valor') : (typeof pend === 'number' ? pend : preco)
      $('m-pagar-texto').textContent = `Há uma mensalidade em aberto${valor != null ? ' de ' + money(valor) : ''}. Pague por Pix ou cartão na página do PagBank.`
    } else pagarBloco.hidden = true

    // Cancelar
    const cancBloco = $('m-cancelar-bloco')
    if (VIVAS.includes(status) && !cancelFim) {
      cancBloco.hidden = false
      const ate = pick(a, 'arrependimento_ate')
      const dentro = status === 'aguardando_pagamento' || (ate && hojeSP() <= String(ate).slice(0, 10))
      $('m-cancelar-explica').innerHTML = `
        <p><strong>Desistência${ate ? ' (até ' + esc(ddmmaaaa(ate)) + ')' : ' (nos primeiros 7 dias)'}:</strong> a assinatura termina na hora e o valor pago é devolvido pelo mesmo meio de pagamento, em até 7 dias. Se você já usou alguma visita, é descontado só o preço de tabela dos serviços feitos. Sem multa.</p>
        <p><strong>Cancelamento (depois desse prazo):</strong> você continua usando as visitas do ciclo já pago até ${fim ? esc(ddmm(fim)) : 'o fim dele'}, e não há nova cobrança. Sem multa e sem devolução do ciclo em andamento.</p>
        <p>${dentro ? 'Você ainda está no prazo de desistência.' : 'O prazo de desistência já passou: o pedido vira cancelamento no fim do ciclo.'}</p>`
      $('m-cancelar-confirma-texto').textContent = dentro
        ? (status === 'aguardando_pagamento' ? 'Confirmar a desistência? Nada foi cobrado ainda, e o link de pagamento deixa de valer.' : 'Confirmar a desistência? A assinatura termina agora e o valor pago é devolvido, descontado só o preço de tabela do que já foi feito.')
        : `Confirmar o cancelamento? Você usa o Clube até ${ddmm(fim) || 'o fim do ciclo'} e não será cobrado de novo.`
    } else cancBloco.hidden = true

    const ct = $('m-contrato')
    const url = pick(a, 'contrato.url')
    if (url && /^https:\/\/www\.barbeariadoju\.com\.br\//.test(url)) ct.href = url
    painel.hidden = false
  }

  const carregar = async () => {
    let r
    try { r = await api({ action: 'status' }) } catch (e) { r = { error: 'rede' } }
    if (r.error === 'rede') { invalido('Sem conexão para carregar a sua assinatura agora.'); return null }
    if (r.error || !r.ok || !r.assinatura) { invalido(r.error === 'Link inválido.' ? 'Este link não é válido.' : (r.error || 'Não foi possível carregar a sua assinatura.')); return null }
    render(Object.assign({}, r.assinatura, { contrato: r.contrato }))
    return r.assinatura
  }

  // Depois do pagamento: o PagBank avisa o servidor; confere a cada 5 s por até 1 minuto.
  const aguardarPagamento = async () => {
    const aviso = document.createElement('p')
    aviso.className = 'clube-destaque'
    aviso.setAttribute('role', 'status')
    aviso.textContent = 'Pagamento em processamento. Esta página se atualiza sozinha assim que o PagBank confirmar.'
    intro.after(aviso)
    for (let i = 0; i < 12; i++) {
      await new Promise((res) => setTimeout(res, 5000))
      const a = await carregar()
      if (a && a.status !== 'aguardando_pagamento') {
        aviso.textContent = a.status === 'ativa' ? 'Pagamento confirmado. Bem-vindo ao Clube do Ju. A confirmação também chega pelo WhatsApp.' : 'Situação atualizada.'
        return
      }
    }
    aviso.textContent = 'O pagamento ainda não foi confirmado. Se você já pagou, a confirmação chega pelo WhatsApp em alguns minutos. Pagamento por cartão pode levar um pouco mais.'
  }

  // Pagar agora
  $('m-pagar').addEventListener('click', async () => {
    const b = $('m-pagar'); const err = $('m-pagar-erro')
    b.disabled = true; b.textContent = 'Abrindo o pagamento...'; err.textContent = ''
    let r
    try { r = await api({ action: 'pagar' }) } catch (e) { r = { error: 'Sem conexão agora. Tente de novo em instantes.' } }
    if (r.error) { err.textContent = r.error; b.disabled = false; b.textContent = 'Pagar agora'; return }
    if (r.nada_a_pagar) { err.textContent = ''; $('m-pagar-texto').textContent = 'Não há nenhuma mensalidade em aberto.'; b.hidden = true; return }
    const url = String(r.pay_url || '')
    if (!/^https:\/\//.test(url)) { err.textContent = 'Não foi possível abrir o pagamento agora.'; b.disabled = false; b.textContent = 'Pagar agora'; return }
    $('m-pagar-texto').innerHTML = `Levando você para o PagBank. Se a página não abrir, <a href="${esc(url)}" rel="noopener">toque aqui</a>.`
    window.location.href = url
  })

  // Cancelar em dois passos
  $('m-cancelar').addEventListener('click', () => { $('m-cancelar-passo1').hidden = true; $('m-cancelar-passo2').hidden = false; $('m-cancelar-sim').focus() })
  $('m-cancelar-nao').addEventListener('click', () => { $('m-cancelar-passo2').hidden = true; $('m-cancelar-passo1').hidden = false; $('m-cancelar').focus() })
  $('m-cancelar-sim').addEventListener('click', async () => {
    const b = $('m-cancelar-sim'); const err = $('m-cancelar-erro')
    if (b.disabled) return
    b.disabled = true; b.textContent = 'Enviando...'; err.textContent = ''
    let r
    try { r = await api({ action: 'cancelar', motivo: $('m-motivo').value.trim().slice(0, 300) }) } catch (e) { r = { error: 'Sem conexão agora. Nada foi alterado. Tente de novo em instantes.' } }
    if (r.error || !r.ok) { err.textContent = r.error || 'Não foi possível concluir agora.'; b.disabled = false; b.textContent = 'Sim, confirmar o cancelamento'; return }
    let msg
    if (r.tipo === 'arrependida') msg = Number(r.devolver) > 0 ? `Desistência registrada. Vamos devolver ${money(r.devolver)} pelo mesmo meio de pagamento, em até 7 dias.` : 'Desistência registrada. Não há valor a devolver.'
    else if (r.tipo === 'fim_do_ciclo') msg = `Cancelamento registrado. Você continua usando o Clube até ${ddmm(r.fim) || 'o fim do ciclo'} e não será cobrado de novo.`
    else if (r.tipo === 'cancelada') msg = 'Assinatura cancelada. Não haverá nova cobrança.'
    else if (r.ja_cancelada) msg = `O cancelamento já estava registrado. Você usa o Clube até ${ddmm(r.fim) || 'o fim do ciclo'}.`
    else if (r.ja_encerrada) msg = 'Esta assinatura já estava encerrada.'
    else msg = 'Pedido registrado.'
    await carregar()
    $('m-cancelar-bloco').hidden = false
    $('m-cancelar-passo2').hidden = true; $('m-cancelar-passo1').hidden = true
    $('m-cancelar-explica').innerHTML = ''
    $('m-motivo').closest('label').hidden = true
    $('m-cancelar-resultado').innerHTML = `<p class="clube-ok">${esc(msg)} A confirmação também chega pelo WhatsApp.</p>`
  })

  if (!/^CJ-[A-Z0-9]{6}$/.test(c) || !/^[0-9a-f]{40}$/.test(t)) { invalido('Este link está incompleto.'); return }
  carregar().then((a) => { if (a && pago && a.status === 'aguardando_pagamento') aguardarPagamento() })
})()

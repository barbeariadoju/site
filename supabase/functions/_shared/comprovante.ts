// v29.121.0 — Cupom não fiscal do atendimento (pedido do Juliano, 03/09/2026).
//
// Origem: o Wellington questionou os valores DEPOIS de sair da cadeira (02/09/2026). O
// comprovante que existia desde a v29.30.0 já listava serviço, produtos e total, mas em
// linha corrida e sem nada que se parecesse com um documento — e, num atendimento de fim de
// dia, a mensagem nem tinha saído ainda (guarda de silêncio das 20h). O cliente ficou sem
// papel nenhum na mão justo na hora em que a dúvida nasceu.
//
// A resposta do Juliano à dúvida não é discutir preço, é entregar a conta aberta: cada item
// com seu valor, o que foi descontado, o total e como foi pago. Transparência como método.
//
// Por que módulo separado, e não texto solto dentro da function: o formato deste documento é
// o que o cliente guarda como prova do que pagou. Isolado, ele tem teste unitário de verdade
// (tests/unit/comprovante.spec.js) e um erro de conta aparece no `npm test`, não no WhatsApp
// de um cliente.
//
// SEM EMOJI de propósito (regra de 01/09/2026): as versões anteriores escreviam ✂️/🛍️/💳 que
// o semEmoji() removia na saída, deixando cada linha começando com um espaço órfão. Aqui o
// texto já nasce limpo.

export type ItemComprovante = { nome: string; valor: number }

export type DadosComprovante = {
  bookingId: string
  clienteNome: string
  /** booking_date, 'YYYY-MM-DD' */
  data: string
  /** hoje em America/Sao_Paulo, 'YYYY-MM-DD' — decide "hoje" / "ontem" / "02/09" */
  hoje: string
  /** start_time 'HH:MM' */
  hora: string
  servicoNome: string
  servicoValor: number
  produtos: ItemComprovante[]
  descontoFidelidade: number
  caixinha: number
  cortesia: boolean
  cortesiaMotivo: string
  /** chave crua do banco: pix | debito | credito | dinheiro | fidelidade */
  pagamentoServico: string
  pagamentoProdutos: string
  /** prepay_confirmed_at preenchido: vale como forma de pagamento por si só */
  pagamentoAntecipado: boolean
  /** channel === 'balcao' */
  balcao: boolean
}

export const money = (v: unknown) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const metodoLabel = (m: unknown) => {
  const k = String(m || '').toLowerCase()
  return k === 'pix' ? 'no Pix'
    : k === 'debito' ? 'no débito'
    : k === 'credito' ? 'no crédito'
    : k === 'dinheiro' ? 'em dinheiro'
    // v29.121.0 — 'fidelidade' é forma de pagamento aceita pelo admin-booking-status desde a
    // v29.10.0 e não tinha rótulo aqui: o comprovante de quem trocou pontos por corte saía
    // com a linha de pagamento em branco, que é exatamente o tipo de lacuna que gera dúvida.
    : k === 'fidelidade' ? 'com prêmio do cartão fidelidade'
    : k === 'cortesia' ? 'por cortesia'
    : ''
}

/**
 * Número do comprovante: data do atendimento + 6 dígitos do id do agendamento.
 * Derivado, não sequencial de propósito — não depende de coluna nova nem de contador no
 * banco, nunca colide, e o Juliano localiza o atendimento pelo prefixo do id.
 */
export const numeroComprovante = (bookingId: string, data: string) => {
  const d = String(data || '').replace(/-/g, '')
  const dia = d.length === 8 ? `${d.slice(6, 8)}${d.slice(4, 6)}${d.slice(2, 4)}` : '000000'
  const seq = String(bookingId || '').replace(/-/g, '').slice(0, 6).toUpperCase() || '------'
  return `${dia}-${seq}`
}

const rotuloDia = (data: string, hoje: string) => {
  if (!data) return ''
  if (data === hoje) return 'hoje'
  const ontem = new Date(`${hoje}T12:00:00Z`)
  ontem.setUTCDate(ontem.getUTCDate() - 1)
  if (data === ontem.toISOString().slice(0, 10)) return 'ontem'
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`
}

/**
 * Agrupa produtos repetidos numa linha só (2 águas viram "Água (2 x R$ 4,00)"), preservando
 * a ordem de lançamento. Duas linhas idênticas no cupom parecem cobrança dobrada.
 */
const agruparProdutos = (produtos: ItemComprovante[]) => {
  const linhas: { nome: string; valor: number; qtd: number }[] = []
  for (const p of produtos) {
    const nome = String(p?.nome || 'Produto')
    const valor = Number(p?.valor || 0)
    const existente = linhas.find(l => l.nome === nome && l.valor === valor)
    if (existente) existente.qtd++
    else linhas.push({ nome, valor, qtd: 1 })
  }
  return linhas
}

const RODAPE_CASA = 'Barbearia do Ju - Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista/SP'

export const ehVendaSoDeProduto = (d: Pick<DadosComprovante, 'servicoValor' | 'produtos'>) =>
  Number(d.servicoValor || 0) <= 0 && Array.isArray(d.produtos) && d.produtos.length > 0

/** O cupom em si, sem saudação e sem a pesquisa — é o que o teste unitário verifica. */
export const montarCupom = (d: DadosComprovante) => {
  const produtos = agruparProdutos(Array.isArray(d.produtos) ? d.produtos : [])
  const servicoValor = Number(d.servicoValor || 0)
  const desconto = Number(d.descontoFidelidade || 0)
  const caixinha = Number(d.caixinha || 0)
  // Venda só de produto no balcão (serviço "Venda de produtos" R$ 0): sem linha de serviço.
  const soProduto = ehVendaSoDeProduto(d)

  const itens: string[] = []
  if (!soProduto) itens.push(`${d.servicoNome || 'Atendimento'} — ${money(servicoValor)}`)
  for (const p of produtos) {
    itens.push(p.qtd > 1
      ? `${p.nome} (${p.qtd} x ${money(p.valor)}) — ${money(p.valor * p.qtd)}`
      : `${p.nome} — ${money(p.valor)}`)
  }

  const produtosValor = produtos.reduce((a, p) => a + p.valor * p.qtd, 0)
  const bruto = servicoValor + produtosValor
  // Cortesia zera o total do documento. Antes da v29.121.0 o atendimento por conta da casa
  // saía com o valor cheio e sem nenhuma linha de pagamento — o cliente que NÃO pagou
  // recebia um comprovante com cara de cobrança.
  const total = d.cortesia ? 0 : Math.max(0, bruto - desconto)

  const totais: string[] = []
  if (desconto > 0 || d.cortesia) totais.push(`Subtotal: ${money(bruto)}`)
  if (desconto > 0 && !d.cortesia) totais.push(`Desconto do cartão fidelidade: -${money(desconto)}`)
  if (d.cortesia) totais.push(`Cortesia (por conta da casa): -${money(bruto)}`)
  totais.push(`*Total: ${money(total)}*`)

  const pagServico = metodoLabel(d.pagamentoServico) || (d.pagamentoAntecipado ? 'no Pix (pago antecipado)' : '')
  const pagProdutos = metodoLabel(d.pagamentoProdutos) || pagServico
  if (d.cortesia) {
    // O motivo da cortesia NÃO sai no comprovante de propósito: o campo é anotação interna do
    // Juliano ("João, funcionário", "reclamou do corte passado") e o cliente não é o público
    // dela. O que ele precisa saber é que não há nada a pagar.
    totais.push('Nada a pagar — cortesia da casa')
  } else if (produtos.length > 0 && pagServico && pagProdutos && pagProdutos !== pagServico) {
    totais.push(`Pago: serviço ${pagServico}, produtos ${pagProdutos}`)
  } else if (pagServico) {
    totais.push(`Pago ${pagServico}`)
  }
  // A caixinha fica FORA do total (é do barbeiro, não é faturamento), mas SAI no documento:
  // o cliente entregou aquele dinheiro e a conta dele em casa tem que fechar.
  if (caixinha > 0) totais.push(`Caixinha, recebida à parte: ${money(caixinha)}`)

  const dia = rotuloDia(d.data, d.hoje)
  const quando = [dia, d.hora ? `às ${d.hora}` : ''].filter(Boolean).join(' ')

  return [
    '*COMPROVANTE DE ATENDIMENTO*',
    `Nº ${numeroComprovante(d.bookingId, d.data)}${quando ? ` — ${quando}` : ''}`,
    '',
    ...itens,
    '',
    ...totais,
    '',
    'Documento sem valor fiscal, emitido para sua conferência.',
    RODAPE_CASA,
  ].join('\n')
}

/** A mensagem completa que sai no WhatsApp: abertura + cupom + fechamento. */
export const montarMensagemComprovante = (d: DadosComprovante) => {
  const primeiro = String(d.clienteNome || 'Cliente').trim().split(/\s+/)[0]

  // Venda só de produto (caso Eduardo, 27/08) não sentou na cadeira: agradece a COMPRA e não
  // faz a pesquisa 1/2. Quem decide fechar o registro sem pesquisa é o chamador, pelo mesmo
  // ehVendaSoDeProduto().
  if (ehVendaSoDeProduto(d)) {
    return [
      `Olá, ${primeiro}. Obrigado pela compra na Barbearia do Ju.`,
      '',
      montarCupom(d),
      '',
      'Qualquer dúvida sobre como usar o produto, é só me chamar por aqui que eu te oriento.',
    ].join('\n')
  }

  return [
    `Olá, ${primeiro}. Muito obrigado pela visita à Barbearia do Ju.`,
    '',
    montarCupom(d),
    '',
    'Se algum valor não bater com o que combinamos, me avise por aqui que eu confiro na hora.',
    ...(d.balcao ? ['', 'Da próxima vez, se quiser, é só me chamar aqui que eu já deixo seu horário reservado.'] : []),
    '',
    'Como foi seu atendimento?',
    'Digite *1* para Satisfeito',
    'Digite *2* para Insatisfeito',
  ].join('\n')
}

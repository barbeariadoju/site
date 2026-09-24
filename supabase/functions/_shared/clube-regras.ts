// v29.233.0 — Clube do Ju: regras e textos com fonte única.
// Decisões do Juliano em 24/09/2026 (CHANGELOG 29.233.0). O banco tem a régua de desconto em
// club_discount_pct() e a cobertura dos atendimentos em club_quote(); a página /clube/ tem uma cópia
// da régua em assets/js/clube.js. Mudou aqui, muda lá (o teste tests/unit/clube-regras.spec.js confere).
// Nenhum texto para cliente leva emoji (regra de 01/09/2026); a saída passa pelo semEmoji de qualquer jeito.

export const TERMS_VERSION = 'v1'
export const TERMS_URL = 'https://www.barbeariadoju.com.br/clube/contrato/'
export const TERMS_TXT_URL = 'https://www.barbeariadoju.com.br/clube/contrato/v1.txt'
// SHA-256 do clube/contrato/v1.txt com quebras de linha LF (.gitattributes fixa eol=lf).
// O teste recalcula e falha se o texto mudar sem trocar a versão.
export const TERMS_SHA256 = '64c9488de8d25676756d4190a4cbd419045289b27105ab8c7e843359f5dc3e46'
export const PAGINA_CLUBE = 'https://www.barbeariadoju.com.br/clube/'
export const PAGINA_MINHA = 'https://www.barbeariadoju.com.br/clube/minha-assinatura/'

// Régua de desconto pela tabela mensal do que o plano inclui.
export const faixaDesconto = (tabelaMensal: number): number =>
  tabelaMensal >= 200 ? 25 : tabelaMensal >= 120 ? 20 : 15

// Mensalidade = tabela menos o desconto, arredondada para baixo no real inteiro.
export const mensalidade = (tabelaMensal: number): number =>
  Math.floor(Number(tabelaMensal || 0) * (100 - faixaDesconto(Number(tabelaMensal || 0))) / 100)

// Sob Medida: serviços que podem entrar (por visita) e limites.
export const SOB_MEDIDA_SERVICOS = [
  'Corte de cabelo', 'Corte + Lavagem', 'Raspar a cabeça',
  'Barba Express', 'Barba na navalha com toalha quente', 'Barboterapia com vaporizador de ozônio',
  'Corte + Barba Express', 'Corte + Barba na navalha com toalha quente',
  'Sobrancelha Masculina', 'Depilação nasal (cera quente)', 'Depilação orelhas', 'Pezinho (acabamento)',
]
export const SOB_MEDIDA_VISITAS = { min: 2, max: 4 }
// Menos que isso não é plano, é desconto avulso.
export const SOB_MEDIDA_TABELA_MINIMA = 90

export const DIAS_CLUBE = [2, 3, 4] // ISO: terça, quarta, quinta
export const ANTECEDENCIA = { min: 7, max: 30 }
export const DIAS_SEMANA_PT: Record<number, string> = { 2: 'terça', 3: 'quarta', 4: 'quinta' }

export const money = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const primeiro = (nome: string) => {
  const p = String(nome || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}
const ddmm = (iso: string) => { const [, m, d] = String(iso || '').split('-'); return d && m ? `${d}/${m}` : '' }

export const textoCodigo = (codigo: string) =>
  `Barbearia do Ju: seu código para assinar o Clube do Ju é ${codigo}. Ele vale por 10 minutos. Se não foi você que pediu, pode ignorar esta mensagem.`

export const textoLinkPagamento = (d: { nome: string; plano: string; valor: number; link: string }) =>
  `Olá, ${primeiro(d.nome)}. Recebemos a sua assinatura do Clube do Ju, plano ${d.plano}.\n\n` +
  `Para ativar, é só pagar a primeira mensalidade de ${money(d.valor)} por Pix ou cartão neste link do PagBank:\n${d.link}\n\n` +
  `O link vale por 24 horas. Assim que o pagamento cair, eu te mando a confirmação por aqui.`

export const textoBoasVindas = (d: {
  nome: string; plano: string; valor: number; inicio: string; fim: string; resumo: string
  gerenciar: string; cativa?: string | null
}) =>
  `Pagamento confirmado. Bem-vindo ao Clube do Ju, ${primeiro(d.nome)}.\n\n` +
  `Plano: ${d.plano} (${money(d.valor)} por mês)\n${d.resumo}\n` +
  `Ciclo atual: ${ddmm(d.inicio)} a ${ddmm(d.fim)}\n` +
  (d.cativa ? `Seu horário fixo: ${d.cativa}. Os horários deste ciclo já estão na agenda.\n` : '') +
  `\nComo funciona:\n` +
  `- O Clube vale de terça a quinta.\n` +
  (d.cativa ? '' : `- Marque com no mínimo 7 e no máximo 30 dias de antecedência, por aqui ou pelo site.\n`) +
  `- Cancelar com menos de 24 horas ou faltar conta como visita usada.\n` +
  `- As visitas valem dentro do ciclo.\n\n` +
  `Seu contrato (versão ${TERMS_VERSION}): ${TERMS_URL}\n` +
  `Sua assinatura, saldo e cancelamento: ${d.gerenciar}\n\n` +
  `Obrigado pela confiança. 🙏`

export const textoRenovacao = (d: { nome: string; plano: string; valor: number; fimCiclo: string; link: string }) =>
  `Olá, ${primeiro(d.nome)}. O seu ciclo do Clube do Ju (${d.plano}) termina em ${ddmm(d.fimCiclo)}.\n\n` +
  `Para renovar, a mensalidade de ${money(d.valor)} pode ser paga por Pix ou cartão neste link do PagBank:\n${d.link}\n\n` +
  `Se preferir não renovar, é só não pagar ou cancelar pela página da sua assinatura. Nada é cobrado sem o seu pagamento.`

export const textoRenovado = (d: { nome: string; inicio: string; fim: string }) =>
  `Pagamento confirmado, ${primeiro(d.nome)}. O seu Clube do Ju está renovado: novo ciclo de ${ddmm(d.inicio)} a ${ddmm(d.fim)}. 🙏`

export const textoEmAberto = (d: { nome: string; link: string | null }) =>
  `Olá, ${primeiro(d.nome)}. A mensalidade do seu Clube do Ju ainda está em aberto. Enquanto isso, os horários marcados continuam na agenda, pelo preço normal da tabela.` +
  (d.link ? `\n\nPara reativar, é só pagar por este link:\n${d.link}` : '') +
  `\n\nSem pagamento em 15 dias, a assinatura é encerrada, sem nenhum custo.`

export const textoEncerrada = (d: { nome: string }) =>
  `Olá, ${primeiro(d.nome)}. Como a mensalidade não foi paga em 15 dias, a sua assinatura do Clube do Ju foi encerrada, sem nenhum custo. Quando quiser voltar, é só assinar de novo pelo site: ${PAGINA_CLUBE}`

export const textoCancelamento = (d: { nome: string; fimCiclo: string | null }) =>
  `Cancelamento confirmado, ${primeiro(d.nome)}. Nenhuma cobrança nova será feita.` +
  (d.fimCiclo ? ` Você continua usando as visitas do ciclo pago até ${ddmm(d.fimCiclo)}.` : '') +
  ` Horários marcados depois disso continuam na agenda pelo preço normal e podem ser desmarcados sem custo.`

export const textoArrependimento = (d: { nome: string; devolver: number }) =>
  `Desistência confirmada, ${primeiro(d.nome)}. A assinatura do Clube do Ju foi cancelada.` +
  (d.devolver > 0 ? ` A devolução de ${money(d.devolver)} é feita pelo mesmo meio de pagamento em até 7 dias.` : '')

// Divulgação para a base: curta, sem vender vaga nem expor agenda, com saída fácil.
// Três versões para a mensagem não sair idêntica em série.
export const textosAnuncio = (nome: string): string[] => {
  const n = primeiro(nome)
  const oi = n ? `Olá, ${n}. ` : 'Olá. '
  const sair = '\n\nSe não quiser receber novidades da barbearia, responda SAIR.'
  return [
    `${oi}Aqui é o Juliano, da Barbearia do Ju. Queria que você soubesse por mim: lançamos o Clube do Ju, a assinatura mensal da barbearia, com planos de corte e barba de terça a quinta e desconto sobre a tabela. Os detalhes e as regras estão aqui: ${PAGINA_CLUBE}${sair}`,
    `${oi}Novidade na Barbearia do Ju: agora existe o Clube do Ju, uma assinatura mensal para quem vem sempre, com corte e barba de terça a quinta e desconto sobre a tabela. Se tiver interesse, os planos e as regras estão em ${PAGINA_CLUBE}${sair}`,
    `${oi}Está sabendo da novidade? Lançamos o Clube do Ju, a barbearia por assinatura: você escolhe o plano, paga por mês e tem desconto nos atendimentos de terça a quinta. Para saber mais: ${PAGINA_CLUBE}${sair}`,
  ]
}

// JuIA: resposta fixa para "o que é o Clube do Ju?" (texto conferido, sem o modelo inventar condição).
export const textoClubeExplica = (vendasAbertas: boolean) =>
  `O Clube do Ju é a assinatura mensal da barbearia: você escolhe um plano, paga por mês adiantado e tem desconto sobre a tabela nos atendimentos de terça a quinta, com hora marcada. ` +
  `Os planos vão do Clube Corte (2 cortes por mês, R$ 85) à Cadeira Cativa (horário fixo toda semana com corte, Barboterapia e sobrancelha, R$ 249), e tem o Sob Medida, em que você monta o seu. ` +
  `Pelo Clube, o horário é marcado com 7 a 30 dias de antecedência, e dá para cancelar quando quiser, sem multa.` +
  (vendasAbertas ? ` Os planos, as regras e a assinatura estão aqui: ${PAGINA_CLUBE}` : ` As assinaturas abrem em 1º de outubro. Os planos e as regras já estão aqui: ${PAGINA_CLUBE}`)

// v29.195.1 (16/09/2026) — Leitura da resposta ao pedido de confirmação de presença
// ("1 confirmo / 2 remarcar / 3 cancelar") — caso Sr. Magno, 16/09 15h09.
//
// Ele respondeu: "1.  Mas qto o cabelo so  vou cortar nao vou pintar  depilacao nas orelhas e
// depilacao nasal  ok podemos fazer". Isto é: CONFIRMO, e tirem a Pigmentação. O webhook lia
// "cancelar" antes de "confirmar", e o regex de cancelamento casava o "nao vou" de "nao vou
// pintar" — resultado: horário de amanhã cancelado, oferta de outro horário com a Pigmentação
// dentro, e "não encontrei nenhum agendamento" quando ele reclamou. O Juliano assumiu na mão.
//
// Regras, em ordem:
//   1. Número na frente decide ("1.", "1 -", "2 por favor", "3"): 1 confirma, 2 remarca, 3 cancela.
//   2. Sem número: remarcar antes de cancelar (regra da v28.59.0), cancelar só quando a negação
//      é sobre VIR ("não vou poder", "não posso") — negação sobre um SERVIÇO ("não vou pintar",
//      "sem barba", "só vou cortar") nunca cancela.
//   3. `servicosNegados` diz quais partes do serviço reservado o cliente tirou na mesma frase:
//      cada negação (não/sem/nem) vale para o PRIMEIRO serviço citado depois dela — "não vou
//      pintar depilação nas orelhas e nasal ok" tira só a Pigmentação. "Só vou cortar" / "só o
//      corte" tira tudo que não é corte.
// Texto de entrada sempre normalizado (sem acento, minúsculo), como o webhook entrega.

export type AcaoConfirmacao = 'confirm' | 'reschedule' | 'decline' | null

const normalize = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const numeroNaFrente = (t: string): '1' | '2' | '3' | null => {
  const m = t.trim().match(/^([123])\1*(?:[\s!.,)\-:;]|$)/)
  return m ? (m[1] as '1' | '2' | '3') : null
}

// Palavras que identificam cada família de serviço dentro da frase do cliente.
const CHAVES: Array<[RegExp, RegExp]> = [
  [/pigmenta.*capilar|tintura/, /\bpint|\btint|\bpigment|\btingir/],
  [/pigmenta.*barba/, /pigment[a-z]* (de |da )?barba/],
  [/pigmenta.*sobrancelha/, /pigment[a-z]* (de |da )?sobrancelha/],
  [/barba|barboterapia/, /\bbarb/],
  [/sobrancelha/, /\bsobrancelh/],
  [/nasal|nariz/, /\bnasal|\bnariz/],
  [/orelha/, /\borelha/],
  [/lavagem/, /\blavag/],
  [/hidrata|reconstru/, /\bhidrat|\breconstru/],
  [/alisamento|relaxamento/, /\balis|\brelax/],
  [/luzes|platinado|nevou/, /\bluzes|\bplatin|\bnevou/],
  [/pezinho/, /\bpezinho/],
  [/corte|cabelo/, /\bcort|\bcabelo/],
]

const chaveDe = (parteNormalizada: string): RegExp | null => {
  const par = CHAVES.find(([re]) => re.test(parteNormalizada))
  return par ? par[1] : null
}

// Negação sobre serviço (não sobre vir): "nao vou pintar", "sem barba", "so vou cortar".
export const negacaoDeServico = (normalizedReply: string): boolean => {
  const t = normalizedReply
  if (/\bso (vou )?(cortar|o corte|corte|cabelo)\b|\bsomente (o )?corte\b|\bapenas (o )?corte\b/.test(t)) return true
  const re = /\b(nao|sem|nem)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 45)
    if (/\b(vou|posso|consigo|vai dar|da|poderei|pode) (poder |conseguir |ir |vir |comparecer |chegar |estar |dar )?\b(ir|vir|comparecer|chegar|estar|dar)?\b/.test(depois) && !/\b(vou|quero|precisa|precisar|vai|faz|fazer)\s+(fazer\s+|a\s+|o\s+|as\s+|os\s+)?[a-z]{0,12}(pint|tint|pigment|tingir|barb|sobrancelh|depila|nasal|nariz|orelha|lavag|hidrat|alis|relax|luzes|platin|nevou|pezinho|cort|cabelo)/.test(depois)) {
      // "nao vou (poder vir)" — é sobre vir; segue procurando outra negação
      if (/\b(poder|conseguir|ir|vir|comparecer|chegar|estar)\b|\bposso\b|\bconsigo\b|\bvai dar\b|\bda\b/.test(depois.slice(0, 22))) continue
    }
    if (CHAVES.some(([, kw]) => kw.test(depois.slice(0, 45)))) return true
  }
  return false
}

export const lerRespostaConfirmacao = (normalizedReply: string): AcaoConfirmacao => {
  const t = normalizedReply.trim()
  const n = numeroNaFrente(t)
  if (n === '1') return 'confirm'
  if (n === '2') return 'reschedule'
  if (n === '3') return 'decline'
  if (/remarc|reagend|\bmudar\b|\btrocar\b|\btransferir\b|\badiantar\b|\bpassar (pra|para)\b|outro\s+horari|outro\s+dia/.test(t)) return 'reschedule'
  if (!negacaoDeServico(t) && /\bnao\b|nao vou|nao posso|nao consigo|cancela|infelizmente/.test(t)) return 'decline'
  if (/\bsim\b|confirmo|confirmado|\bpode ser\b|\bcerto\b|^ok$/.test(t)) return 'confirm'
  return null
}

// Partes do serviço reservado ("A + B + C") que o cliente tirou na frase.
export const servicosNegados = (serviceName: string, normalizedReply: string): string[] => {
  const partes = String(serviceName || '').split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
  if (partes.length < 2) return []
  const t = normalizedReply
  const negadas = new Set<string>()
  // "só vou cortar" / "só o corte": tudo que não é corte sai
  if (/\bso (vou )?(cortar|o corte|corte|cabelo)\b|\bsomente (o )?corte\b|\bapenas (o )?corte\b/.test(t)) {
    partes.forEach((p) => { if (!/corte|cabelo/.test(normalize(p))) negadas.add(p) })
  }
  const re = /\b(nao|sem|nem)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 45)
    // "nao vou (poder) vir" é sobre presença, não sobre serviço
    if (/^\s*(vou|posso|consigo|da|vai dar)?\s*(poder |conseguir )?(ir|vir|comparecer|chegar|estar|dar)\b/.test(depois)) continue
    let melhor: { parte: string; idx: number } | null = null
    for (const p of partes) {
      const kw = chaveDe(normalize(p)); if (!kw) continue
      const hit = kw.exec(depois); if (!hit) continue
      if (!melhor || hit.index < melhor.idx) melhor = { parte: p, idx: hit.index }
    }
    if (melhor) negadas.add(melhor.parte)
  }
  const lista = partes.filter((p) => negadas.has(p))
  return lista.length === partes.length ? [] : lista // tirar tudo não é ajuste, é outra conversa
}

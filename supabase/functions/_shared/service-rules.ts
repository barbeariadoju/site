// v29.62.0 — Cópia em TypeScript (Deno) de assets/js/service-rules.js — a regra das
// "famílias" de serviço: num mesmo atendimento só cabe 1 serviço de CORTE e 1 de BARBA.
// Barboterapia e Barba Express são alternativas (a Barboterapia é a completa), combos
// "Corte + X" já cobrem as duas famílias, pezinho já vem dentro de qualquer corte. Única
// exceção: corte adulto + corte infantil (pai e filho). Mudou aqui, mude lá também.
// Usada por ju-ia-site (normaliza o que a JuIA entendeu e avisa o cliente) e por
// create-public-booking (rede de segurança do formulário do site).

const CORTE_ADULTO = ['Corte de cabelo', 'Corte + Lavagem', 'Raspar a cabeça', 'Corte + Barba na navalha com toalha quente', 'Corte + Barba Express']
const CORTE_INFANTIL = ['Corte de cabelo infantil']
const BARBA = ['Barboterapia com vaporizador de ozônio', 'Barba na navalha com toalha quente', 'Barba Express', 'Corte + Barba na navalha com toalha quente', 'Corte + Barba Express']
const INCLUSOS: Record<string, string[]> = { 'Pezinho (acabamento)': ['corte', 'infantil'] }

const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const same = (a: string, b: string) => norm(a) === norm(b)
const inList = (list: string[], name: string) => list.some((n) => same(n, name))

export function familiesOf(name: string): Set<string> {
  const fam = new Set<string>()
  if (inList(CORTE_ADULTO, name)) fam.add('corte')
  if (inList(CORTE_INFANTIL, name)) fam.add('infantil')
  if (inList(BARBA, name)) fam.add('barba')
  const inc = Object.keys(INCLUSOS).find((k) => same(k, name))
  if (inc) INCLUSOS[inc].forEach((f) => fam.add(f))
  return fam
}

export function isIncluso(name: string): boolean {
  return Object.keys(INCLUSOS).some((k) => same(k, name))
}

const intersects = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x))
const covers = (big: Set<string>, small: Set<string>) => [...small].every((x) => big.has(x))
const shortName = (name: string) => norm(name).split(' ')[0]
const describe = (fam: Set<string>) => {
  if (fam.has('corte') && fam.has('barba')) return 'corte e barba'
  if (fam.has('barba')) return 'a barba'
  if (fam.has('corte')) return 'o corte'
  return 'o corte infantil'
}
const familyLabel = (fam: Set<string>) => describe(fam).replace(/^(o|a) /, '')

export interface RuleResult { services: string[]; added: boolean; message: string | null }

export function applyServiceRule(currentNames: string[], newName: string): RuleResult {
  const current = (currentNames || []).filter(Boolean)
  if (current.some((n) => same(n, newName))) return { services: current, added: false, message: `«${newName}» já está na sua lista.` }
  const famN = familiesOf(newName)
  if (!famN.size) return { services: [...current, newName], added: true, message: null }
  const conflicts = current.filter((e) => intersects(familiesOf(e), famN))
  if (!conflicts.length) return { services: [...current, newName], added: true, message: null }
  if (isIncluso(newName)) return { services: current, added: false, message: `«${conflicts[0]}» já inclui o ${shortName(newName)} — não precisa adicionar.` }
  const removed: { name: string; reason: string }[] = []
  for (const e of conflicts) {
    const famE = familiesOf(e)
    if (isIncluso(e)) { removed.push({ name: e, reason: `O ${shortName(e)} já vem incluso em «${newName}» — tirei da lista.` }); continue }
    if (covers(famE, famN) && famE.size > famN.size) return { services: current, added: false, message: `«${e}» já inclui ${describe(famN)} — não precisa adicionar «${newName}».` }
    removed.push({ name: e, reason: `Só 1 serviço de ${familyLabel(famE)} por atendimento — troquei «${e}» por «${newName}».` })
  }
  const services = current.filter((n) => !removed.some((r) => same(r.name, n)))
  services.push(newName)
  return { services, added: true, message: removed.map((r) => r.reason).join(' ') }
}

export interface NormalizeResult<T> { items: T[]; removed: { name: string; keptBy: string }[] }

/** Dentro de cada família fica o mais completo (combo > maior preço > ordem). Aceita strings ou { name, price }. */
export function normalizeServiceSet<T extends string | { name: string; price?: number }>(items: T[]): NormalizeResult<T> {
  const list: { name: string; price: number; _i: number; _raw: T }[] = []
  const removed: { name: string; keptBy: string }[] = []
  ;(items || []).forEach((it, i) => {
    const o = typeof it === 'string' ? { name: it, price: 0 } : (it || ({} as any))
    if (!o.name) return
    if (list.some((x) => same(x.name, o.name))) { removed.push({ name: o.name, keptBy: o.name }); return }
    list.push({ name: o.name, price: Number(o.price || 0), _i: i, _raw: it })
  })
  const ranked = list.slice().sort((a, b) => {
    if (isIncluso(a.name) !== isIncluso(b.name)) return isIncluso(a.name) ? 1 : -1
    const fa = familiesOf(a.name).size, fb = familiesOf(b.name).size
    if (fb !== fa) return fb - fa
    if (b.price !== a.price) return b.price - a.price
    return a._i - b._i
  })
  let names: string[] = []
  for (const it of ranked) {
    const r = applyServiceRule(names, it.name)
    // Na normalização quem chegou antes (mais completo, pelo ranking) vence.
    if (r.added && r.services.length === names.length + 1) {
      names = r.services
    } else {
      const keptBy = names.find((n) => intersects(familiesOf(n), familiesOf(it.name))) || names[0]
      removed.push({ name: it.name, keptBy })
    }
  }
  return { items: list.filter((it) => names.some((n) => same(n, it.name))).map((it) => it._raw), removed }
}

/** "Corte + Barboterapia + Barba Express" → ['Corte + Barboterapia', 'Barba Express'] sem confundir o " + " dos combos. */
export function splitServiceNames(serviceName: string, known: string[]): string[] {
  const tokens = String(serviceName || '').split(/\s*\+\s*/).map((t) => t.trim()).filter(Boolean)
  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    let matched = false
    for (let j = Math.min(tokens.length, i + 3); j > i; j--) {
      const cand = tokens.slice(i, j).join(' + ')
      const hit = (known || []).find((k) => same(k, cand))
      if (hit) { out.push(hit); i = j; matched = true; break }
    }
    if (!matched) { out.push(tokens[i]); i++ }
  }
  return out
}

// v29.165.0 — TROCA dentro da família (caso real, 10/09/2026, 10:35: cliente com "Corte de
// cabelo + Barboterapia com vaporizador de ozônio" anotados perguntou "e só com a máquina
// express e cabelo tem horário mais cedo?". A JuIA somou a Barba Express à lista, a
// normalização ficou com a Barboterapia (a mais completa) e a resposta foi "Barboterapia já
// inclui o que Barba Express faria" — o contrário do que ele pediu; o cliente desistiu).
// Regra: serviço citado AGORA que é da mesma família de um já anotado — e o antigo NÃO foi
// citado de novo — é troca, não soma. Combo antigo que cobre a família do novo é desmontado
// e a outra parte fica ("Corte + Barba Express" → Barboterapia = "Corte de cabelo" +
// Barboterapia). Combo citado agora substitui as partes soltas. Pai e filho (corte adulto x
// infantil) não se tocam. `prevNames` = lista atual; `mentionedNow` = só o que apareceu
// nesta mensagem. Sem troca, devolve a lista como veio.
const COMBO_PARTS: Record<string, string[]> = { 'Corte + Barba Express': ['Corte de cabelo', 'Barba Express'], 'Corte + Barba na navalha com toalha quente': ['Corte de cabelo', 'Barba na navalha com toalha quente'] }
export function swapWithinFamily(prevNames: string[], mentionedNow: string[]): { services: string[]; swaps: { from: string; to: string }[] } {
  const prev = (prevNames || []).filter(Boolean)
  const mentioned = (mentionedNow || []).filter(Boolean)
  const drop: string[] = [], parts: string[] = [], swaps: { from: string; to: string }[] = []
  for (const m of mentioned) {
    const famM = familiesOf(m)
    if (!famM.size || isIncluso(m)) continue
    for (const p of prev) {
      if (same(p, m) || isIncluso(p) || mentioned.some((x) => same(x, p))) continue
      const famP = familiesOf(p)
      if (!intersects(famP, famM)) continue
      if (covers(famP, famM) && famP.size > famM.size) {
        const key = Object.keys(COMBO_PARTS).find((k) => same(k, p))
        ;(key ? COMBO_PARTS[key] : []).filter((part) => !intersects(familiesOf(part), famM)).forEach((part) => parts.push(part))
      }
      if (!drop.some((d) => same(d, p))) { drop.push(p); swaps.push({ from: p, to: m }) }
    }
  }
  if (!swaps.length) return { services: prev, swaps }
  const services = prev.filter((p) => !drop.some((d) => same(d, p)))
  parts.forEach((part) => { if (!services.some((s) => same(s, part)) && !mentioned.some((x) => same(x, part))) services.push(part) })
  mentioned.forEach((m) => { if (familiesOf(m).size && !services.some((s) => same(s, m))) services.push(m) })
  return { services, swaps }
}

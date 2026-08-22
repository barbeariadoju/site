// v29.62.0 — Regra de "famílias" de serviço (pedido do Juliano, 22/08/2026, caso Augusto
// Monteiro: agendou "Corte + Barboterapia + Barba Express" pelo site — a etapa "quer
// incluir mais alguma coisa?" sugeria Barba Express pra qualquer carrinho com "Corte",
// mesmo já tendo Barboterapia dentro do combo).
//
// A regra do negócio é simples: num mesmo atendimento só cabe 1 serviço de CORTE e
// 1 serviço de BARBA. Barboterapia e Barba Express são alternativas (a Barboterapia é a
// versão completa), nunca soma. Combos "Corte + X" já cobrem as duas famílias. O pezinho
// já vem dentro de qualquer corte. ÚNICA exceção: corte adulto + corte infantil (pai e
// filho no mesmo horário).
//
// Este arquivo é a fonte única da regra no site (carrinho em /agendar/ e etapa de horário
// em /agendar/horario/). As Edge Functions têm uma cópia em TypeScript em
// supabase/functions/_shared/service-rules.ts (Deno não importa daqui) — mudou aqui,
// mude lá também.

const CORTE_ADULTO = ['Corte de cabelo', 'Corte + Lavagem', 'Raspar a cabeça', 'Corte + Barboterapia', 'Corte + Barba Express'];
const CORTE_INFANTIL = ['Corte de cabelo infantil'];
const BARBA = ['Barboterapia com vaporizador de ozônio', 'Barboterapia', 'Barba Express', 'Corte + Barboterapia', 'Corte + Barba Express'];
// Itens que já vêm INCLUSOS em qualquer serviço da(s) família(s) deles: nunca se somam a
// um corte, e saem sozinhos da lista quando um corte entra.
const INCLUSOS = { 'Pezinho (acabamento)': ['corte', 'infantil'] };

const LABEL = { corte: 'corte', barba: 'barba', infantil: 'corte infantil' };

const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const same = (a, b) => norm(a) === norm(b);
const inList = (list, name) => list.some(n => same(n, name));

export function familiesOf(name){
  const fam = new Set();
  if(inList(CORTE_ADULTO, name)) fam.add('corte');
  if(inList(CORTE_INFANTIL, name)) fam.add('infantil');
  if(inList(BARBA, name)) fam.add('barba');
  const inc = Object.keys(INCLUSOS).find(k => same(k, name));
  if(inc) INCLUSOS[inc].forEach(f => fam.add(f));
  return fam;
}

export function isIncluso(name){
  return Object.keys(INCLUSOS).some(k => same(k, name));
}

const intersects = (a, b) => [...a].some(x => b.has(x));
const covers = (big, small) => [...small].every(x => big.has(x));
const shortName = name => norm(name).split(' ')[0];
// "o corte" / "a barba" / "o corte infantil" / "corte e barba"
const describe = fam => {
  if(fam.has('corte') && fam.has('barba')) return 'corte e barba';
  if(fam.has('barba')) return 'a barba';
  if(fam.has('corte')) return 'o corte';
  return 'o corte infantil';
};
const familyLabel = fam => describe(fam).replace(/^(o|a) /, '');

/**
 * Tenta adicionar `newName` à lista `currentNames` respeitando a regra.
 * Retorna { services, added, message } — `services` é a lista resultante (nomes),
 * `message` explica qualquer troca/recusa em português simples (ou null).
 */
export function applyServiceRule(currentNames, newName){
  const current = (currentNames || []).filter(Boolean);
  if(current.some(n => same(n, newName))){
    return { services: current, added: false, message: `«${newName}» já está na sua lista.` };
  }
  const famN = familiesOf(newName);
  if(!famN.size) return { services: [...current, newName], added: true, message: null };

  const conflicts = current.filter(e => intersects(familiesOf(e), famN));
  if(!conflicts.length) return { services: [...current, newName], added: true, message: null };

  // Pezinho em cima de um corte: o corte já inclui.
  if(isIncluso(newName)){
    return { services: current, added: false, message: `«${conflicts[0]}» já inclui o ${shortName(newName)} — não precisa adicionar.` };
  }

  const removed = [];
  for(const e of conflicts){
    const famE = familiesOf(e);
    if(isIncluso(e)){ removed.push({ name: e, reason: `O ${shortName(e)} já vem incluso em «${newName}» — tirei da lista.` }); continue; }
    // Combo que já cobre o que está entrando (ex.: Corte + Barboterapia ⊇ Barba Express).
    if(covers(famE, famN) && famE.size > famN.size){
      return { services: current, added: false, message: `«${e}» já inclui ${describe(famN)} — não precisa adicionar «${newName}».` };
    }
    removed.push({ name: e, reason: `Só 1 serviço de ${familyLabel(famE)} por atendimento — troquei «${e}» por «${newName}».` });
  }
  const services = current.filter(n => !removed.some(r => same(r.name, n)));
  services.push(newName);
  return { services, added: true, message: removed.map(r => r.reason).join(' ') };
}

/**
 * Normaliza uma lista já montada (ex.: carrinho antigo salvo no navegador, ou o conjunto
 * de serviços que a JuIA entendeu de uma frase): dentro de cada família fica o mais
 * completo (combo > maior preço > ordem em que apareceu). Aceita strings ou objetos
 * { name, price }. Retorna { items, removed: [{ name, keptBy }] } mantendo a ordem
 * original dos que ficaram.
 */
export function normalizeServiceSet(items){
  const list = [];
  const removed = [];
  (items || []).forEach((it, i) => {
    const o = typeof it === 'string' ? { name: it, price: 0 } : (it || {});
    if(!o.name) return;
    if(list.some(x => same(x.name, o.name))){ removed.push({ name: o.name, keptBy: o.name }); return; }
    list.push({ name: o.name, price: Number(o.price || 0), _i: i, _raw: it });
  });
  const ranked = list.slice().sort((a, b) => {
    if(isIncluso(a.name) !== isIncluso(b.name)) return isIncluso(a.name) ? 1 : -1;
    const fa = familiesOf(a.name).size, fb = familiesOf(b.name).size;
    if(fb !== fa) return fb - fa;
    if(b.price !== a.price) return b.price - a.price;
    return a._i - b._i;
  });
  let names = [];
  for(const it of ranked){
    const r = applyServiceRule(names, it.name);
    // Na normalização quem chegou antes (mais completo, pelo ranking) vence: se o novo só
    // entraria substituindo alguém, ele é que fica de fora.
    if(r.added && r.services.length === names.length + 1){
      names = r.services;
    } else {
      const keptBy = names.find(n => intersects(familiesOf(n), familiesOf(it.name))) || names[0];
      removed.push({ name: it.name, keptBy });
    }
  }
  return { items: list.filter(it => names.some(n => same(n, it.name))).map(it => it._raw), removed };
}

/**
 * Desmonta um `service_name` gravado ("Corte + Barboterapia + Barba Express") nos nomes do
 * catálogo, sem confundir o " + " dos combos com o separador. `known` = nomes do catálogo.
 */
export function splitServiceNames(serviceName, known){
  const tokens = String(serviceName || '').split(/\s*\+\s*/).map(t => t.trim()).filter(Boolean);
  const out = [];
  let i = 0;
  while(i < tokens.length){
    let matched = false;
    for(let j = Math.min(tokens.length, i + 3); j > i; j--){
      const cand = tokens.slice(i, j).join(' + ');
      const hit = (known || []).find(k => same(k, cand));
      if(hit){ out.push(hit); i = j; matched = true; break; }
    }
    if(!matched){ out.push(tokens[i]); i++; }
  }
  return out;
}

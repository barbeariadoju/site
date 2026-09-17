// v29.198.0 — Ponte entre o módulo ES da regra de famílias (assets/js/service-rules.js, fonte
// única, já usada pelo carrinho do site e pela JuIA) e os scripts clássicos do admin, que não
// conseguem fazer `import`. Carregado como <script type="module">; quando termina, a regra
// fica em window.BDJ_SERVICE_RULES. Os pickers do admin funcionam sem ela (só sem a troca
// automática) — nunca é motivo pra tela quebrar.
import * as rules from './assets/js/service-rules.js?v=29.198.0';

// Aplica a regra a uma lista de caixinhas depois de um clique: `box` é o container, `input` a
// caixinha que acabou de mudar, `nameOf(input)` devolve o nome do serviço (ou '' pra ignorar,
// ex.: caixinha de produto). Ajusta as outras caixinhas e devolve { services, message } — ou
// null se o clique foi desmarcar (desmarcar nunca mexe nas outras).
function applyToPicker(box, input, nameOf) {
  if (!box || !input || !input.checked) return null;
  const all = [...box.querySelectorAll('input[type="checkbox"]')].filter(i => nameOf(i));
  const prev = all.filter(i => i !== input && i.checked).map(nameOf);
  const r = rules.toggleServiceSelection(prev, nameOf(input));
  const keep = new Set(r.services);
  all.forEach(i => { i.checked = keep.has(nameOf(i)); });
  return r;
}

window.BDJ_SERVICE_RULES = { ...rules, applyToPicker };

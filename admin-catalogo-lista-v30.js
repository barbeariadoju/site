// v29.244.0 — A lista de serviços do site (o modelo do /agendar/) para os pickers do painel.
//
// Os scripts do admin são clássicos (sem `import`), então esta é a versão em <script> comum da
// marcação que assets/js/catalogo-lista.js monta no site. Mesma linha por serviço, mesmo
// css/07-catalogo-lista.css. A diferença é o botão: aqui é um <label class="service-btn
// service-check"> com o checkbox escondido dentro — assim tudo o que o painel já faz
// (ler `input:checked`, applyToPicker da regra das famílias, pré-marcar, quantidade de produto)
// continua igual, e o visual marcado/desmarcado é só CSS (:has(input:checked)).
//
// Se mudar a marcação aqui, mude em assets/js/catalogo-lista.js (secoesDeItens) também.
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const precoCurto = (v) => { const n = Number(v || 0); return Number.isInteger(n) ? `R$ ${n}` : money(n); };

  // html(itens, { name, attrs, marcados, quantidade, titulo })
  //   name       → atributo name do checkbox (ex.: 'balcao-service'); o value é o nome do item
  //   attrs(item)→ atributos extras do checkbox (ex.: data-service-name/price/duration da agenda)
  //   marcados   → Set de nomes que já entram marcados
  //   quantidade → true põe o contador − n + do balcão (produtos) antes do botão
  //   titulo     → título da seção quando o item não tem categoria
  function html(itens, { name = '', attrs, marcados, quantidade = false, titulo = 'Serviços' } = {}) {
    const grupos = new Map();
    (itens || []).forEach((s) => { const k = s.category || titulo; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(s); });
    return [...grupos].map(([cat, lista]) => `<section class="section service-section"><div class="section-head"><h2>${esc(cat)}.</h2></div><div class="service-grid">${lista.map((s) => {
      const checked = marcados && marcados.has(s.name) ? ' checked' : '';
      const extra = attrs ? ' ' + attrs(s) : '';
      const qty = quantidade ? '<b class="qty-step"><button type="button" data-qty-dec aria-label="Menos um">−</button><span data-qty-view>1</span><button type="button" data-qty-inc aria-label="Mais um">+</button></b>' : '';
      return `<article class="service-card"><div class="service-content"><h3>${esc(s.name)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}</div><div class="service-meta">${s.duration ? `<span><span class="dur-longa">aproximadamente</span><span class="dur-curta">aprox.</span> ${Number(s.duration)} min</span>` : ''}<strong>${precoCurto(s.price)}</strong></div>${qty}<label class="service-btn service-check"><input type="checkbox"${name ? ` name="${esc(name)}"` : ''} value="${esc(s.name)}"${quantidade ? ' data-qty="1"' : ''}${extra}${checked}><span class="service-check-off">Adicionar</span><span class="service-check-on">✓ Adicionado</span></label></article>`;
    }).join('')}</div></section>`).join('');
  }

  window.BDJ_LISTA = { html };
})();

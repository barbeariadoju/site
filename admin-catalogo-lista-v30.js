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

  // v29.261.0 — busca na lista (pedido do Juliano, 29/09/2026: "tive que rodar até água; se eu digito
  // agua no campo vai direto na água pra eu selecionar"). Um campo fixo no topo filtra serviços e
  // produtos pelo nome (sem acento, sem maiúscula), rola até o primeiro e abre o "Mais opções" se o
  // item estiver lá dentro. Enter marca o primeiro e limpa o campo pro próximo; Esc só limpa.
  // busca(root, antes) → root contém os itens; o campo entra logo antes de `antes`. Chamar de novo
  // no mesmo root (modal reaberto) só limpa o campo.
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function estiloBusca() {
    if (document.getElementById('bdj-lista-busca-css')) return;
    const st = document.createElement('style');
    st.id = 'bdj-lista-busca-css';
    st.textContent = '.lista-busca{position:sticky;top:0;z-index:7;background:#141210;padding:10px 0 8px;margin:0 0 4px}.booking-edit-card .lista-busca{top:-18px}.lista-busca input{width:100%;box-sizing:border-box;border:1px solid rgba(240,201,135,.4);background:#0d0b09;color:#f3f3f3;border-radius:12px;padding:11px 14px;font:inherit;font-size:var(--t-base)}.lista-busca input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(240,201,135,.18)}.lista-busca small{display:block;color:#9a9a9a;font-size:var(--t-xs);margin-top:4px}';
    document.head.appendChild(st);
  }
  function busca(root, antes, { placeholder = 'Buscar serviço ou produto (ex.: água)' } = {}) {
    if (!root || !antes) return;
    const existente = root.querySelector('[data-lista-busca]');
    if (existente) { existente.value = ''; existente.dispatchEvent(new Event('input')); return; }
    estiloBusca();
    const wrap = document.createElement('div');
    wrap.className = 'lista-busca';
    wrap.innerHTML = `<input type="search" data-lista-busca placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done" aria-label="Buscar serviço ou produto"><small data-lista-busca-msg hidden></small>`;
    antes.parentNode.insertBefore(wrap, antes);
    const input = wrap.querySelector('input');
    const msg = wrap.querySelector('small');
    const nome = (el) => el.querySelector('h3,strong')?.textContent || '';
    const filtrar = (rolar = true) => {
      const q = semAcento(input.value);
      let primeiro = null;
      root.querySelectorAll('.service-card,.products-modal-option').forEach((el) => {
        const ok = !q || semAcento(nome(el)).includes(q);
        el.style.display = ok ? '' : 'none';
        if (ok && q && !primeiro) primeiro = el;
      });
      root.querySelectorAll('.service-section').forEach((sec) => {
        sec.style.display = q && ![...sec.querySelectorAll('.service-card')].some((c) => c.style.display !== 'none') ? 'none' : '';
      });
      msg.hidden = !q || Boolean(primeiro);
      msg.textContent = q && !primeiro ? `Nada com "${input.value.trim()}".` : '';
      if (primeiro) {
        const fold = primeiro.closest('details');
        if (fold && !fold.open) fold.open = true;
        if (rolar) primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return primeiro;
    };
    input.addEventListener('input', () => filtrar());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const p = filtrar(false);
        const cb = p?.querySelector('input[type="checkbox"],input[type="radio"]');
        if (cb && !cb.checked) cb.click();
        input.value = '';
        filtrar(false);
        p?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else if (e.key === 'Escape' && input.value) {
        e.preventDefault();
        e.stopPropagation();
        input.value = '';
        filtrar(false);
      }
    });
  }

  window.BDJ_LISTA = { html, busca };
})();

// admin-ux-v30.js — componentes de feedback do painel (sucessor do admin-ux-v22-4.js).
//
// v29.174.0 (fase 2 da reforma do admin, pedido do Juliano em 11/09/2026): além do toast e da
// rede de segurança de erro que já existiam, entram AS caixas de confirmação e de pergunta do
// painel — BDJ_UX.confirm(mensagem) e BDJ_UX.prompt(mensagem, valorInicial). Até aqui as 18
// telas usavam confirm()/prompt() nativos do navegador: caixa cinza, fonte do sistema, "Esta
// página diz…" no Chrome. Um software profissional pergunta com a própria cara. As duas devolvem
// Promise com o MESMO contrato das nativas (confirm → true/false; prompt → texto ou null), então
// a troca nos chamadores foi só "confirm(" → "await BDJ_UX.confirm(" (todos já eram async).
//
// Carrega em TODAS as páginas do admin, antes dos scripts de cada tela.
(() => {
  // v29.177.0 — fase 5: UMA função de escape pro painel inteiro (window.BDJ_H.esc). Antes cada tela
  // tinha a sua cópia (12 arquivos); todas equivalentes, só a de Mensagens tratava null como ''.
  // Esta trata: null/undefined viram '' (o comportamento mais seguro dos dois).
  const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // v29.179.0 — money também: 6 telas tinham a MESMA cópia; Vales converte centavos antes de chamar;
  // Fidelidade usava "money" só pra virar número (renomeado pra num lá).
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  window.BDJ_H = { esc, money };
  const root = document.createElement('div'); root.className = 'admin-toast-region'; root.setAttribute('aria-live', 'polite'); document.body.appendChild(root);

  function toast(message, type = 'info', timeout = 3200) {
    const el = document.createElement('div'); el.className = `admin-toast is-${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '!' : '•'}</span><p>${esc(message)}</p><button aria-label="Fechar">×</button>`;
    root.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 180); };
    el.querySelector('button').onclick = close; setTimeout(close, timeout);
  }
  function setBusy(button, busy, label = 'Processando…') {
    if (!button) return;
    if (busy) { button.dataset.oldText = button.textContent; button.disabled = true; button.classList.add('is-loading'); button.textContent = label; }
    else { button.disabled = false; button.classList.remove('is-loading'); button.textContent = button.dataset.oldText || button.textContent; }
  }
  async function withTimeout(promise, ms = 12000, message = 'A operação demorou mais que o esperado. Tente novamente.') {
    let id; const timer = new Promise((_, reject) => { id = setTimeout(() => reject(new Error(message)), ms); });
    try { return await Promise.race([promise, timer]); } finally { clearTimeout(id); }
  }

  // Caixa de diálogo da casa. `input` presente = pergunta com campo (prompt); ausente = sim/não.
  // Enter confirma, Esc cancela, foco vai pro campo ou pro botão principal. Ações destrutivas
  // (excluir, apagar, encerrar, definitivo) ganham botão vermelho sem ninguém precisar pedir.
  function dialog({ title = '', message = '', ok = 'Confirmar', cancel = 'Cancelar', danger = null, input = null }) {
    return new Promise((resolve) => {
      const isDanger = danger === null ? /\b(exclu|apag|definitiv|encerrar|remov)/i.test(String(message)) : Boolean(danger);
      const wrap = document.createElement('div'); wrap.className = 'admin-modal admin-dialog';
      wrap.innerHTML = `<div class="admin-modal-backdrop" data-dialog-cancel></div>`
        + `<section class="admin-modal-card admin-dialog-card" role="${input ? 'dialog' : 'alertdialog'}" aria-modal="true">`
        + (title ? `<h2>${esc(title)}</h2>` : '')
        + `<p class="admin-dialog-text">${esc(message)}</p>`
        + (input ? `<label class="admin-dialog-field">${esc(input.label || '')}<input type="${esc(input.type || 'text')}" value="${esc(input.value ?? '')}" placeholder="${esc(input.placeholder || '')}" autocomplete="off"></label>` : '')
        + `<div class="admin-modal-actions"><button type="button" data-dialog-cancel>${esc(cancel)}</button><button type="button" class="btn primary${isDanger ? ' is-danger' : ''}" data-dialog-ok>${esc(ok)}</button></div>`
        + `</section>`;
      document.body.appendChild(wrap);
      const field = wrap.querySelector('input');
      const finish = (value) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); resolve(value); };
      const cancelValue = input ? null : false;
      const okValue = () => (input ? field.value : true);
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); finish(cancelValue); }
        else if (e.key === 'Enter') { e.preventDefault(); finish(okValue()); }
      };
      wrap.querySelectorAll('[data-dialog-cancel]').forEach((b) => { b.onclick = () => finish(cancelValue); });
      wrap.querySelector('[data-dialog-ok]').onclick = () => finish(okValue());
      document.addEventListener('keydown', onKey, true);
      (field || wrap.querySelector('[data-dialog-ok]')).focus();
      if (field) field.select();
    });
  }
  const confirmDialog = (message, opts = {}) => dialog({ message, ...opts });
  const promptDialog = (message, value = '', opts = {}) => dialog({ message, ok: 'OK', ...opts, input: { value, ...(opts.input || {}) } });
  const empty = (text = 'Nada por aqui.') => `<div class="admin-empty">${esc(text)}</div>`;
  // v29.254.0 — erro ao carregar lista: 8 telas mostravam a mensagem crua do banco ("JWT expired",
  // "permission denied for table…"). Agora uma frase em português e "Tentar de novo"; o detalhe
  // técnico vai para o console.
  const falha = (erro) => { if (erro) console.error(erro); return '<div class="admin-empty is-error" role="alert"><strong>Não foi possível carregar agora.</strong><span>Confira a internet e tente de novo. Se continuar, saia e entre de novo no painel.</span><button type="button" class="btn ghost" data-recarregar>Tentar de novo</button></div>'; };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-recarregar]')) location.reload(); });

  window.BDJ_UX = { toast, setBusy, withTimeout, confirm: confirmDialog, prompt: promptDialog, dialog, empty, falha };
  // v29.259.0 — 17 pontos do painel fazem alert(error.message): a mensagem crua do banco ("JWT
  // expired", "Failed to fetch", "violates row-level security…") aparecia como aviso azul e sumia.
  // Mensagem técnica em inglês vira uma frase em português, como erro, e o original vai pro console.
  const TECNICO = /(failed|fetch|jwt|expired|violates|permission|denied|constraint|duplicate key|null value|syntax|function|network|timeout|unauthorized|forbidden|not found|non-2xx|row-level|column|relation|invalid input)/i;
  window.alert = (message) => {
    const texto = String(message ?? '');
    if (TECNICO.test(texto) && !/[ãõçáéíóúâêô]/i.test(texto)) {
      console.error('[painel]', texto);
      return toast('Não foi possível concluir agora. Confira a internet e tente de novo; se continuar, saia e entre de novo no painel.', 'error', 6000);
    }
    return toast(texto, /erro|falha|negado|inválid|não foi possível|nao foi possivel/i.test(texto) ? 'error' : 'info', 4200);
  };
  window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast(e.reason?.message || 'Não foi possível concluir a operação.', 'error', 5000); });
  window.addEventListener('error', (e) => { console.error(e.error || e.message); toast('Ocorreu um erro inesperado. Atualize a página e tente novamente.', 'error', 5000); });
  // v29.251.0 — auditoria impeccable (27/09/2026): o painel tinha 5 jeitos de abrir modal e só o
  // diálogo da casa fechava com Esc e levava o foco para dentro (Concluir, Editar, Remarcar,
  // Expediente, Balcão, Clientes, Espera não). Em vez de mexer em cada um: todo .admin-modal que
  // aparece ganha o mesmo comportamento — foco no primeiro campo, Tab preso dentro, Esc = clicar
  // no fundo escuro (que em todos eles já é "cancelar"), e o foco volta para quem abriu. O
  // diálogo da casa (.admin-dialog) continua cuidando de si mesmo.
  (() => {
    const FOCAVEL = 'input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
    const origem = new WeakMap();
    const aberto = () => [...document.querySelectorAll('.admin-modal:not([hidden]):not(.admin-dialog)')].pop();
    const visiveis = (m) => [...m.querySelectorAll(FOCAVEL)].filter((el) => el.offsetParent !== null);
    const preparar = (m) => {
      const card = m.querySelector('.admin-modal-card');
      if (card && !card.hasAttribute('aria-labelledby')) {
        const h = card.querySelector('h2,h3');
        if (h) { h.id = h.id || `modal-titulo-${Math.random().toString(36).slice(2, 8)}`; card.setAttribute('aria-labelledby', h.id); }
      }
      m.querySelectorAll('.admin-modal-close:not([aria-label])').forEach((b) => b.setAttribute('aria-label', 'Fechar'));
    };
    const abriu = (m) => {
      if (m.classList.contains('admin-dialog') || m.dataset.focoFeito === '1') return;
      m.dataset.focoFeito = '1';
      origem.set(m, document.activeElement);
      preparar(m);
      requestAnimationFrame(() => {
        if (m.contains(document.activeElement)) return;
        // Foco no primeiro campo de digitar (data, nome…); se o modal começa por caixinhas (Concluir,
        // Editar), o foco vai para o próprio modal — antes caía na 1ª caixinha de serviço.
        const card = m.querySelector('.admin-modal-card');
        const campo = visiveis(m).find((el) => el.matches('input:not([type=checkbox]):not([type=radio]),select,textarea'));
        const primeiroCampoAntesDeCaixinha = campo && !visiveis(m).slice(0, visiveis(m).indexOf(campo)).some((el) => el.matches('input[type=checkbox],input[type=radio]'));
        let alvo = m.querySelector('[autofocus]') || (primeiroCampoAntesDeCaixinha ? campo : null);
        if (!alvo && card) { if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1'); alvo = card; }
        alvo?.focus({ preventScroll: true });
      });
    };
    const fechou = (m) => {
      if (m.dataset.focoFeito !== '1') return;
      m.dataset.focoFeito = '0';
      const volta = origem.get(m);
      if (volta && document.contains(volta)) volta.focus({ preventScroll: true });
    };
    new MutationObserver((lista) => {
      for (const r of lista) {
        if (r.type === 'attributes' && r.target.classList?.contains('admin-modal')) (r.target.hidden ? fechou : abriu)(r.target);
        if (r.type === 'childList') r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('admin-modal') && !n.hidden) abriu(n); });
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('keydown', (e) => {
      const m = aberto();
      if (!m || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        const fundo = m.querySelector('.admin-modal-backdrop');
        if (fundo) { e.preventDefault(); fundo.click(); }
      } else if (e.key === 'Tab') {
        const els = visiveis(m);
        if (!els.length) return;
        const [primeiro, ultimo] = [els[0], els[els.length - 1]];
        if (!m.contains(document.activeElement)) { e.preventDefault(); primeiro.focus(); }
        else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    });
  })();
  document.documentElement.classList.add('admin-loading');
  window.addEventListener('load', () => document.documentElement.classList.remove('admin-loading'));
})();

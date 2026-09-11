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
  window.BDJ_H = { esc };
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

  window.BDJ_UX = { toast, setBusy, withTimeout, confirm: confirmDialog, prompt: promptDialog, dialog, empty };
  window.alert = (message) => toast(message, /erro|falha|negado|inválid|não foi possível|nao foi possivel/i.test(String(message)) ? 'error' : 'info', 4200);
  window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast(e.reason?.message || 'Não foi possível concluir a operação.', 'error', 5000); });
  window.addEventListener('error', (e) => { console.error(e.error || e.message); toast('Ocorreu um erro inesperado. Atualize a página e tente novamente.', 'error', 5000); });
  document.documentElement.classList.add('admin-loading');
  window.addEventListener('load', () => document.documentElement.classList.remove('admin-loading'));
})();

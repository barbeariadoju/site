// v29.25.0 — Vale-presente: escolher → para quem é → pagar.
//
// Desenho do Juliano (15/08/2026): "primeiro conduz por todas as telas ou ela escolhe vales
// que nós criamos (pacotes) ou monta o próprio, depois sim com valor total vai pro pagamento".
// A pessoa que compra pode não conhecer a barbearia — por isso ela vê exatamente o que está
// levando e quanto custa ANTES de qualquer pedido de Pix.
(function () {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const catalog = window.BDJ_SERVICES || [];
  const $ = (id) => document.getElementById(id);
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fire = (name, params) => { try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: name, ...params }); } catch { /* analytics nunca quebra a compra */ } };

  const byName = (n) => catalog.find((s) => s.name === n);
  // Pacotes prontos: os três combos que o Juliano quer vender como presente.
  const PACKAGES = [
    { id: 'corte-lavagem', title: 'Vale Corte + Lavagem', desc: 'Corte masculino com lavagem profissional e acabamento caprichado.', services: ['Corte + Lavagem'] },
    { id: 'barboterapia', title: 'Vale Barba na navalha com toalha quente', desc: 'Toalha quente, espuma, navalha e produtos profissionais — o ritual completo.', services: ['Barba na navalha com toalha quente'] },
    { id: 'corte-barbo', title: 'Vale Corte + Barba na navalha com toalha quente', desc: 'A experiência completa: corte e barba na navalha num só atendimento.', services: ['Corte + Barba na navalha com toalha quente'] },
  ];

  const state = { kind: 'package', items: [], pixPayload: '', orderRef: '' };

  const total = () => state.items.reduce((sum, i) => sum + Number(i.price || 0), 0);

  function renderTotals() {
    const t = total();
    $('vp-total').textContent = money(t);
    $('vp-total-2').textContent = money(t);
    $('vp-summary').textContent = state.items.length
      ? state.items.map((i) => i.name).join(' + ')
      : 'nada escolhido ainda';
    $('vp-go-2').disabled = state.items.length === 0;
  }

  function renderPackages() {
    const box = $('vp-packages');
    box.innerHTML = PACKAGES.map((p) => {
      const services = p.services.map(byName).filter(Boolean);
      const price = services.reduce((s, x) => s + Number(x.price || 0), 0);
      return `<article class="vp-card">
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
        <div class="vp-price">${money(price)}</div>
        <button class="btn primary" data-package="${p.id}" type="button">Escolher este</button>
      </article>`;
    }).join('');
    box.querySelectorAll('[data-package]').forEach((btn) => {
      btn.onclick = () => {
        const pack = PACKAGES.find((p) => p.id === btn.dataset.package);
        state.kind = 'package';
        state.items = pack.services.map(byName).filter(Boolean)
          .map((s) => ({ name: s.name, price: s.price, duration: s.duration }));
        renderTotals();
        renderServices();
        fire('gift_package_selected', { value: total(), package: pack.id });
        goTo(2);
      };
    });
  }

  function renderServices() {
    const box = $('vp-services');
    // Só serviços de cabelo/barba: química e tratamento dependem de avaliação presencial,
    // não fazem sentido como presente fechado.
    const list = catalog.filter((s) => ['Cortes e combos', 'Barba', 'Acabamentos e adicionais'].includes(s.category));
    box.innerHTML = list.map((s) => {
      const count = state.items.filter((i) => i.name === s.name).length;
      return `<div class="vp-item">
        <div><b>${s.name}</b><small>${s.duration} min · ${money(s.price)}</small></div>
        <div style="display:flex;align-items:center;gap:8px">
          ${count ? `<button class="btn ghost" data-remove="${s.name}" type="button">−</button><b>${count}</b>` : ''}
          <button class="btn" data-add="${s.name}" type="button">Adicionar</button>
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-add]').forEach((btn) => {
      btn.onclick = () => {
        const s = byName(btn.dataset.add);
        if (!s) return;
        state.kind = 'custom';
        state.items.push({ name: s.name, price: s.price, duration: s.duration });
        renderTotals(); renderServices();
      };
    });
    box.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.onclick = () => {
        const idx = state.items.findIndex((i) => i.name === btn.dataset.remove);
        if (idx >= 0) state.items.splice(idx, 1);
        renderTotals(); renderServices();
      };
    });
  }

  function goTo(step) {
    [1, 2, 3].forEach((n) => {
      $(`step-${n}`).classList.toggle('is-on', n === step);
      document.querySelector(`[data-step-label="${n}"]`).classList.toggle('is-on', n === step);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function criarPedido() {
    const buyer = $('vp-buyer').value.trim();
    const phone = $('vp-phone').value.replace(/\D/g, '');
    const status = $('vp-form-status');
    if (!buyer || phone.length < 10) {
      status.textContent = 'Preencha seu nome e um WhatsApp válido — é por lá que o código do vale chega.';
      return;
    }
    const btn = $('vp-go-3');
    btn.disabled = true; btn.textContent = 'Gerando o Pix…';
    status.textContent = '';
    let resp = null;
    try {
      const r = await fetch(`${cfg.supabaseUrl}/functions/v1/gift-card-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: state.kind,
          items: state.items,
          amount_cents: Math.round(total() * 100),
          buyer_name: buyer,
          buyer_phone: phone,
          recipient_name: $('vp-recipient').value.trim(),
          message: $('vp-message').value.trim(),
        }),
      });
      resp = await r.json().catch(() => null);
    } catch { resp = null; }

    btn.disabled = false; btn.textContent = 'Ir para o pagamento';

    if (!resp || !resp.ok || !resp.pix_payload) {
      status.textContent = (resp && resp.message)
        || 'Não consegui gerar o Pix agora. Chame a gente no WhatsApp que resolvemos na hora: 11 96707-3038.';
      return;
    }

    state.pixPayload = resp.pix_payload;
    state.orderRef = resp.order_ref || '';
    $('vp-pix-code').textContent = resp.pix_payload;
    const msg = `Olá! Acabei de pagar o vale-presente ${state.orderRef} de ${money(total())}. Segue o comprovante:`;
    $('vp-whats').href = `https://wa.me/5511967073038?text=${encodeURIComponent(msg)}`;
    fire('gift_order_created', { value: total(), order_ref: state.orderRef });
    goTo(3);
  }

  function copiarPix() {
    const btn = $('vp-copy');
    const done = (ok) => {
      btn.textContent = ok ? '✅ Código copiado!' : 'Copie manualmente acima';
      setTimeout(() => { btn.textContent = '📋 Copiar código Pix'; }, 2600);
      if (ok) fire('gift_pix_copied', { value: total() });
    };
    // Fallback pro execCommand: em WebView de app (Instagram, por exemplo) o clipboard costuma vir bloqueado.
    navigator.clipboard.writeText(state.pixPayload).then(() => done(true)).catch(() => {
      try {
        const ta = document.createElement('textarea');
        ta.value = state.pixPayload; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta); done(ok);
      } catch { done(false); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderPackages();
    renderServices();
    renderTotals();
    $('vp-go-2').onclick = () => goTo(2);
    $('vp-back-1').onclick = () => goTo(1);
    $('vp-back-2').onclick = () => goTo(2);
    $('vp-go-3').onclick = criarPedido;
    $('vp-copy').onclick = copiarPix;
  });
})();

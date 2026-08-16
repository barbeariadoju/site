// v29.33.0 — Página do recibo de repasse, aberta pelo profissional no celular dele.
//
// A tela tem uma responsabilidade só: mostrar exatamente o que ele está quitando, antes de
// ele quitar. Por isso o extrato completo aparece na própria página — recibo que diz apenas
// "você recebeu R$ X" não protege ninguém, nem ele nem a barbearia. E depois de confirmado,
// o botão some e o comprovante fica: ele pode reabrir o link quando quiser.
(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const box = document.getElementById('rc-content');
  const token = new URLSearchParams(location.search).get('t') || '';
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dia = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '';
  const dataHora = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const KIND = { cota_servico: 'Serviço', cota_produto: 'Produto', consumo: 'Consumo', ressarcimento: 'Ressarcimento', estorno: 'Estorno', ajuste: 'Ajuste' };

  const call = async (payload) => {
    const res = await fetch(`${cfg.supabaseUrl}/functions/v1/settlement-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
      body: JSON.stringify(payload),
    });
    return res.json().catch(() => ({ error: 'Falha de comunicação.' }));
  };

  function render(r) {
    const lancamentos = Array.isArray(r.snapshot?.lancamentos) ? r.snapshot.lancamentos : [];
    const quitado = Boolean(r.acknowledged_at);

    box.innerHTML = `
      <div class="rc-card">
        <p class="rc-num">${esc(r.receipt_number || '')}</p>
        <p style="margin:2px 0 0;color:var(--muted);font-size:.86rem">Repasse de ${esc(r.professional_name || '')} — ${dia(r.period_start)} a ${dia(r.period_end)}</p>
        <p class="rc-value">${money(r.net_amount)}</p>
        <p style="margin:4px 0 0;color:var(--muted);font-size:.84rem">${r.paid_at ? `Pago em ${dataHora(r.paid_at)}${r.paid_method ? ` via ${esc(r.paid_method)}` : ''}` : 'Pagamento em processamento'}</p>
      </div>

      <div class="rc-card">
        <div class="rc-row"><span>Cota-parte do período</span><strong>${money(r.total_credits)}</strong></div>
        ${Number(r.total_debits) > 0 ? `<div class="rc-row"><span>Descontos acordados</span><strong>− ${money(r.total_debits)}</strong></div>` : ''}
        <div class="rc-row"><span>Valor líquido recebido</span><strong>${money(r.net_amount)}</strong></div>
      </div>

      ${lancamentos.length ? `<div class="rc-card">
        <p style="margin:0 0 4px;font-weight:700">Detalhamento</p>
        <div style="overflow-x:auto"><table class="rc-table">
          <tr><th>Dia</th><th>Tipo</th><th>Descrição</th><th class="num">Valor</th></tr>
          ${lancamentos.map(l => `<tr>
            <td>${dia(l.entry_date).slice(0, 5)}</td>
            <td>${esc(KIND[l.kind] || l.kind)}</td>
            <td>${esc(l.description || '')}</td>
            <td class="num">${money(l.amount)}</td>
          </tr>`).join('')}
        </table></div>
      </div>` : ''}

      ${quitado ? `<div class="rc-card rc-ok">
        <h2>Recebimento confirmado</h2>
        <p style="margin:0;font-size:.9rem">Confirmado em ${dataHora(r.acknowledged_at)}.</p>
        <p class="rc-note" style="margin-top:10px">Este comprovante fica guardado. Você pode reabrir este link quando precisar.</p>
        <p class="rc-note" style="margin-top:10px">Código de verificação do documento:<br><span class="rc-hash">${esc(r.receipt_hash || '')}</span></p>
      </div>` : `<div class="rc-card">
        <p style="margin:0 0 14px;font-size:.92rem;line-height:1.65">Confira os valores acima. Ao confirmar, você declara que <strong>recebeu o valor de ${money(r.net_amount)}</strong> referente ao período de ${dia(r.period_start)} a ${dia(r.period_end)}, dando quitação deste repasse.</p>
        <button class="rc-btn" id="rc-ack" type="button">Confirmo que recebi</button>
        <p class="rc-note">Algum valor não bate? <strong>Não confirme</strong> — fale com o Juliano antes. A conferência é justamente para isso.</p>
      </div>`}
    `;

    const btn = document.getElementById('rc-ack');
    if (btn) btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Confirmando…';
      const out = await call({ action: 'quitar', token });
      if (out?.error) { alert(out.error); btn.disabled = false; btn.textContent = 'Confirmo que recebi'; return; }
      load();
    };
  }

  async function load() {
    if (!token) { box.innerHTML = '<div class="rc-card">Link inválido. Peça o recibo novamente.</div>'; return; }
    const out = await call({ action: 'ver', token });
    if (out?.error || !out?.receipt) {
      box.innerHTML = `<div class="rc-card">${esc(out?.error || 'Recibo não encontrado.')}</div>`;
      return;
    }
    render(out.receipt);
  }

  load();
})();

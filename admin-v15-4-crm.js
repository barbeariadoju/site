// admin-v15-4-crm.js - parte 5/7 de admin-v15-4.js. Modo Clientes/CRM
// (admin-clientes.html). Ver header de admin-v15-4-core.js.
  function initCRM(){const search=$('crm-search'),button=$('crm-search-button'),clear=$('crm-search-clear');let timer=null;const run=()=>{clearTimeout(timer);renderCRM()};search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(renderCRM,180)});search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();const rows=filteredCustomers();if(rows.length===1)setTimeout(()=>document.querySelector('.crm-card')?.scrollIntoView({behavior:'smooth',block:'center'}),20)}});button?.addEventListener('click',run);clear?.addEventListener('click',()=>{search.value='';renderCRM();search.focus()});$('crm-add-customer').onclick=()=>openCustomerModal();document.querySelectorAll('[data-close-customer-modal]').forEach(x=>x.onclick=closeCustomerModal);$('crm-customer-save').onclick=saveCustomer;document.querySelectorAll('[data-close-merge-modal]').forEach(x=>x.onclick=closeMergeModal);$('crm-merge-search').addEventListener('input',()=>{mergeSelectedCustomer=null;$('crm-merge-confirm').disabled=true;$('crm-merge-summary').hidden=true;renderMergeResults($('crm-merge-search').value)});$('crm-merge-confirm').onclick=confirmMerge;renderBirthdaySummary();renderCRM()}
  // Mesclar cadastro duplicado: mesmo cliente com 2 telefones diferentes vira 2 cards
  // sem ligação nenhuma no CRM (bookings.customer_phone é a chave, não tem customer_id) —
  // achado em 2026-07-30 com "Carlos Rodrigues" duplicado no autocomplete do Novo
  // agendamento. Abre pelo card de quem vai FICAR (mergeKeepCustomer); busca e escolhe o
  // outro cadastro (mergeSelectedCustomer) pra apagar, movendo atendimentos/fidelidade/
  // histórico pro que ficou (RPC admin_merge_customers, migration 056).
  let mergeKeepCustomer=null,mergeSelectedCustomer=null;
  function openMergeModal(c){
    if(!c)return;
    mergeKeepCustomer=c;mergeSelectedCustomer=null;
    $('crm-merge-modal').hidden=false;document.body.classList.add('modal-open');
    $('crm-merge-intro').textContent=`Buscar o outro cadastro do mesmo cliente pra juntar em ${c.name}. Atendimentos, histórico e pontos de fidelidade do outro cadastro passam pra cá, e o cadastro duplicado é apagado.`;
    $('crm-merge-search').value='';
    $('crm-merge-results').hidden=true;$('crm-merge-results').innerHTML='';
    $('crm-merge-summary').hidden=true;$('crm-merge-summary').innerHTML='';
    $('crm-merge-message').textContent='';
    $('crm-merge-confirm').disabled=true;
    setTimeout(()=>$('crm-merge-search').focus(),50);
  }
  function closeMergeModal(){$('crm-merge-modal').hidden=true;document.body.classList.remove('modal-open');mergeKeepCustomer=null;mergeSelectedCustomer=null}
  function renderMergeResults(term){
    const box=$('crm-merge-results');
    const q=normalizeSearch(term),digits=phoneDigits(term);
    if(q.length<2){box.hidden=true;box.innerHTML='';return}
    const matches=customers.filter(x=>x.id&&x.phone!==mergeKeepCustomer.phone&&(normalizeSearch(x.name).includes(q)||(digits&&x.phone.includes(digits)))).slice(0,8);
    box.hidden=false;
    box.innerHTML=matches.length
      ?matches.map(x=>`<button type="button" data-merge-pick="${x.phone}"><strong>${esc(x.name)}</strong><small>${formatPhone(x.phone)} • ${x.completed} atendimento${x.completed===1?'':'s'}</small></button>`).join('')
      :'<div class="is-empty">Nenhum outro cadastro encontrado.</div>';
    box.querySelectorAll('[data-merge-pick]').forEach(btn=>btn.onclick=()=>{
      mergeSelectedCustomer=customers.find(x=>x.phone===btn.dataset.mergePick);
      if(!mergeSelectedCustomer)return;
      box.hidden=true;box.innerHTML='';
      $('crm-merge-search').value=mergeSelectedCustomer.name;
      const summary=$('crm-merge-summary');
      summary.hidden=false;
      summary.innerHTML=`<p><strong>${esc(mergeSelectedCustomer.name)}</strong> (${formatPhone(mergeSelectedCustomer.phone)}) — ${mergeSelectedCustomer.completed} atendimento${mergeSelectedCustomer.completed===1?'':'s'}, ${money(mergeSelectedCustomer.total)} em histórico.</p><p>Tudo isso passa pra <strong>${esc(mergeKeepCustomer.name)}</strong> e o cadastro de ${esc(mergeSelectedCustomer.name)} é apagado. Essa ação não pode ser desfeita.</p>`;
      $('crm-merge-confirm').disabled=false;
    });
  }
  async function confirmMerge(){
    if(!mergeKeepCustomer?.id||!mergeSelectedCustomer?.id)return;
    if(!confirm(`Mesclar ${mergeSelectedCustomer.name} em ${mergeKeepCustomer.name}? O cadastro de ${mergeSelectedCustomer.name} será apagado. Essa ação não pode ser desfeita.`))return;
    const msg=$('crm-merge-message');msg.textContent='Mesclando...';
    $('crm-merge-confirm').disabled=true;
    const {error}=await sb.rpc('admin_merge_customers',{p_keep_id:mergeKeepCustomer.id,p_merge_id:mergeSelectedCustomer.id});
    if(error){msg.textContent=friendlyDb(error.message);$('crm-merge-confirm').disabled=false;return}
    await loadBaseData();closeMergeModal();renderBirthdaySummary();renderCRM();
  }
  function renderBirthdaySummary(){
    const withBirth=customers.filter(c=>c.birthDate),today=withBirth.filter(c=>daysUntilBirthday(c.birthDate)===0),week=withBirth.filter(c=>{const d=daysUntilBirthday(c.birthDate);return d!==null&&d<=7}),month=withBirth.filter(c=>{const b=new Date(c.birthDate+'T12:00:00'),t=new Date();return b.getMonth()===t.getMonth()});
    setText('crm-birthday-today',today.length);setText('crm-birthday-week',week.length);setText('crm-birthday-month',month.length);
    const box=$('crm-birthday-list');if(box){const next=withBirth.map(c=>({...c,days:daysUntilBirthday(c.birthDate)})).sort((a,b)=>a.days-b.days).slice(0,6);box.innerHTML=next.length?next.map(c=>`<span><strong>${esc(c.name)}</strong><small>${c.days===0?'Hoje':c.days===1?'Amanhã':`em ${c.days} dias`} • ${birthdayLabel(c.birthDate)}</small></span>`).join(''):'<small>Nenhuma data de nascimento cadastrada.</small>'}
  }
  function normalizeSearch(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
  function filteredCustomers(){const raw=$('crm-search')?.value||'',q=normalizeSearch(raw),digits=phoneDigits(raw);return customers.filter(c=>!q||normalizeSearch(c.name).includes(q)||(digits&&phoneDigits(c.phone).includes(digits))||normalizeSearch(c.email||'').includes(q))}
  function renderCRM(){const rows=filteredCustomers();setText('crm-count',rows.length);const box=$('crm-list');box.innerHTML=rows.length?rows.map(customerCard).join(''):'<div class="admin-empty"><strong>Nenhum cliente encontrado.</strong><small>Revise o nome, telefone ou e-mail pesquisado.</small></div>';bindCustomerCardToggle(box);box.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>toggleCustomerHistory(b.dataset.history));box.querySelectorAll('[data-audit]').forEach(b=>b.onclick=()=>toggleCustomerAudit(b.dataset.audit,b.dataset.auditPhone));box.querySelectorAll('[data-book-customer]').forEach(b=>b.onclick=()=>{const c=customers.find(x=>x.phone===b.dataset.bookCustomer);sessionStorage.setItem('bdj-prefill-customer',JSON.stringify(c));location.href='admin-agendamento.html?modo=retorno'});box.querySelectorAll('[data-edit-customer]').forEach(b=>b.onclick=()=>openCustomerModal(customers.find(x=>x.phone===b.dataset.editCustomer)));box.querySelectorAll('[data-merge-customer]').forEach(b=>b.onclick=()=>openMergeModal(customers.find(x=>x.phone===b.dataset.mergeCustomer)));box.querySelectorAll('[data-archive-customer]').forEach(b=>b.onclick=()=>archiveCustomer(b.dataset.archiveCustomer));box.querySelectorAll('[data-delete-customer]').forEach(b=>b.onclick=()=>deleteCustomerPermanently(b.dataset.deleteCustomer))}
  // Card colapsado por padrão (resumo: avatar/nome/telefone/badges) — mesmo padrão de
  // bookingCardHtml() em admin-v15-4-agenda.js, pedido do Juliano pra visual único em todo
  // o admin. Antes o card do CRM mostrava tudo (aniversário, tags, preferências, notas,
  // sugestão privada, stats) sempre, deixando a lista de clientes gigante e obrigando rolar
  // muito. Clique no resumo expande o detalhe completo; Histórico/Auditoria continuam com
  // seu próprio toggle independente, aninhado dentro do detalhe.
  function customerCard(c){const last=c.lastDate?formatDate(c.lastDate,{day:'2-digit',month:'2-digit',year:'numeric'}):'Sem atendimento';const email=c.email?`<a href="mailto:${encodeURIComponent(c.email)}">${esc(c.email)}</a>`:'<span>Sem e-mail</span>';const age=ageFromBirth(c.birthDate),birth=c.birthDate?`${birthdayLabel(c.birthDate)}${age!==null?` • ${age} anos`:''}`:'Nascimento não informado';return `<article class="crm-card"><button type="button" class="admin-booking-summary" data-toggle-card aria-expanded="false"><div class="crm-avatar">${esc(c.name.charAt(0).toUpperCase())}</div><span class="admin-booking-summary-main"><strong>${esc(c.name)}</strong><small>${formatPhone(c.phone)} • ${last}</small></span><span class="crm-summary-badges">${c.vip?'<span class="crm-vip-badge">★ VIP</span>':''}<span class="crm-score-badge">Ju Score ${c.juScore}</span></span><span class="admin-booking-chevron">⌄</span></button><div class="admin-booking-detail"><div class="admin-booking-detail-inner crm-detail-inner"><p>${email}</p><p class="crm-birth">🎂 ${esc(birth)}</p>${(c.internalTags||[]).length?`<div class="crm-tags">${c.internalTags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}${(c.preferredServices||[]).length?`<p class="crm-profile-line"><b>Preferidos:</b> ${c.preferredServices.map(esc).join(', ')}</p>`:''}${Object.values(c.stylePreferences||{}).filter(Boolean).length?`<p class="crm-profile-line"><b>Estilo:</b> ${Object.values(c.stylePreferences).filter(Boolean).map(esc).join(', ')}</p>`:''}${c.notes?`<p class="crm-notes">${esc(c.notes)}</p>`:''}${c.lastFeedback?`<p class="crm-private-feedback"><b>💬 Sugestão privada:</b> ${esc(c.lastFeedback)}</p>`:''}<div class="crm-score-row"><span class="crm-level">${c.level}</span>${c.daysInactive!==null?`<span>${c.daysInactive} dias desde a última visita</span>`:''}</div><div class="crm-stats"><span><strong>${c.completed}</strong> atendimentos</span><span><strong>${money(c.total)}</strong> gasto</span><span><strong>${money(c.avgTicket)}</strong> ticket médio</span><span><strong>${c.reviewClicks||0}</strong> cliques em avaliação</span><span><strong>${c.feedbacks||0}</strong> sugestões</span><span><strong>${c.noShows}</strong> ausências</span><span><strong>${last}</strong> última visita</span></div><div id="crm-history-${c.phone}" class="crm-history" hidden>${c.history.length?c.history.slice(0,30).map(x=>`<div><span>${formatDate(x.booking_date,{day:'2-digit',month:'2-digit',year:'numeric'})} • ${x.start_time.slice(0,5)}</span><strong>${esc(x.service_name)}${parseProducts(x).length?` + ${parseProducts(x).map(p=>esc(p.name)).join(', ')}`:''}</strong><small>${statusLabel(x.status)} • ${money(Number(x.service_price||0)+Number(x.products_price||0))}</small></div>`).join(''):'<div class="admin-empty">Cliente cadastrado manualmente, sem histórico.</div>'}</div><div id="crm-audit-${c.phone}" class="crm-audit" hidden></div><div class="crm-actions"><button data-history="${c.phone}">Histórico</button><button data-audit="${c.id||''}" data-audit-phone="${c.phone}" ${c.id?'':'disabled'}>🕘 Auditoria</button><button data-edit-customer="${c.phone}">Editar</button><button class="is-primary" data-book-customer="${c.phone}">Agendar</button><a href="${whatsappBusinessUrl(c.phone)}" target="_blank" rel="noopener">WhatsApp</a>${c.email?`<a href="mailto:${encodeURIComponent(c.email)}">E-mail</a>`:''}<button data-merge-customer="${c.phone}" ${c.id?'':'disabled'}>🔗 Mesclar</button><button data-archive-customer="${c.id||''}" ${c.id?'':'disabled'}>Arquivar</button><button class="is-danger" data-delete-customer="${c.id||''}" ${c.id?'':'disabled'}>Excluir definitivamente</button></div></div></div></article>`}
  function bindCustomerCardToggle(root){root.querySelectorAll('[data-toggle-card]').forEach(b=>b.onclick=()=>{const detail=b.closest('.crm-card').querySelector('.admin-booking-detail');const opening=!detail.classList.contains('is-open');detail.classList.toggle('is-open',opening);b.setAttribute('aria-expanded',String(opening))})}
  function toggleCustomerHistory(phone){const el=$(`crm-history-${phone}`);if(el)el.hidden=!el.hidden}
  // Timeline de auditoria (tabela customer_timeline): registra correções feitas pelo admin
  // (status, serviço, produtos, pagamento) em cada atendimento — carregada sob demanda (só
  // quando o botão é aberto) porque, ao contrário do histórico de agendamentos, não vem
  // junto do loadBaseData().
  function auditEventDetail(e){
    const d=e.details||{};
    switch(e.event_type){
      case 'booking_status_changed':return d.from&&d.to?`Status: ${statusLabel(d.from)} → ${statusLabel(d.to)}`:'';
      case 'booking_details_updated':{
        const parts=[];
        if(d.service)parts.push(`Serviço → ${esc(d.service.name)} (${money(d.service.price)})`);
        if(d.products&&d.products.length)parts.push(`Produtos → ${d.products.map(p=>esc(p.name)).join(', ')}`);
        if(d.payment_method)parts.push(`Pagamento → ${esc(d.payment_method)}`);
        if(d.products_payment_method)parts.push(`Pagamento dos produtos → ${esc(d.products_payment_method)}`);
        return parts.join(' • ');
      }
      case 'attendance_completed':case 'booking_completed':return `${d.services?esc(d.services)+' • ':''}${d.value!=null?money(d.value):''}`;
      case 'feedback_private':return d.feedback?`Sugestão: ${esc(d.feedback)}`:'';
      default:return '';
    }
  }
  function auditRowHtml(e){
    const when=new Date(e.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const detail=auditEventDetail(e);
    return `<div><span>${when}</span><strong>${esc(e.title||'')}</strong>${detail?`<small>${detail}</small>`:''}</div>`;
  }
  async function toggleCustomerAudit(customerId,phone){
    const el=$(`crm-audit-${phone}`);
    if(!el)return;
    el.hidden=!el.hidden;
    if(el.hidden||el.dataset.loaded)return;
    el.innerHTML='<div class="admin-empty">Carregando…</div>';
    const {data,error}=await sb.from('customer_timeline').select('*').eq('customer_id',customerId).order('created_at',{ascending:false}).limit(50);
    if(error){el.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return}
    el.dataset.loaded='1';
    el.innerHTML=(data&&data.length)?data.map(auditRowHtml).join(''):'<div class="admin-empty">Nenhum evento de auditoria registrado pra este cliente ainda.</div>';
  }
  function openCustomerModal(c=null){$('crm-customer-modal').hidden=false;document.body.classList.add('modal-open');$('crm-modal-title').textContent=c?'Editar cliente':'Adicionar cliente';$('crm-customer-id').value=c?.id||'';$('crm-customer-name').value=c?.name||'';$('crm-customer-phone').value=c?.phone||'';$('crm-customer-email').value=c?.email||'';$('crm-customer-birth').value=c?.birthDate||'';$('crm-customer-notes').value=c?.notes||'';$('crm-customer-preferred-services').value=(c?.preferredServices||[]).join(', ');$('crm-customer-favorite-products').value=(c?.favoriteProducts||[]).join(', ');$('crm-customer-style').value=Object.values(c?.stylePreferences||{}).filter(Boolean).join(', ');$('crm-customer-tags').value=(c?.internalTags||[]).join(', ');$('crm-customer-vip').checked=Boolean(c?.vip);$('crm-customer-payment').value=c?.preferredPayment||'';$('crm-customer-return-days').value=c?.returnIntervalDays||'';$('crm-customer-message').textContent='';setTimeout(()=>$('crm-customer-name').focus(),50)}
  function closeCustomerModal(){$('crm-customer-modal').hidden=true;document.body.classList.remove('modal-open')}
  async function saveCustomer(){const id=$('crm-customer-id').value||null,name=$('crm-customer-name').value.trim(),phone=phoneDigits($('crm-customer-phone').value),email=$('crm-customer-email').value.trim().toLowerCase()||null,birth=$('crm-customer-birth').value||null,notes=$('crm-customer-notes').value.trim()||null,split=v=>v.split(',').map(x=>x.trim()).filter(Boolean),preferredServices=split($('crm-customer-preferred-services').value),favoriteProducts=split($('crm-customer-favorite-products').value),styleList=split($('crm-customer-style').value),tags=split($('crm-customer-tags').value),vip=$('crm-customer-vip').checked,payment=$('crm-customer-payment').value||null,returnDays=Number($('crm-customer-return-days').value)||null,msg=$('crm-customer-message');if(name.length<2||phone.length<10){msg.textContent='Informe nome e WhatsApp válidos.';return}msg.textContent='Salvando...';const stylePreferences=Object.fromEntries(styleList.map((x,i)=>[`item_${i+1}`,x]));const {error}=await sb.rpc('admin_save_customer_v23',{p_customer_id:id,p_name:name,p_phone:phone,p_email:email,p_birth_date:birth,p_notes:notes,p_preferred_services:preferredServices,p_style_preferences:stylePreferences,p_favorite_products:favoriteProducts,p_internal_tags:tags,p_vip:vip,p_preferred_payment:payment,p_return_interval_days:returnDays});if(error){msg.textContent=friendlyDb(error.message);return}await loadBaseData();closeCustomerModal();renderBirthdaySummary();renderCRM()}
  async function archiveCustomer(id){if(!id)return;if(!confirm('Arquivar este cliente? Ele sairá da lista, mas o histórico será preservado.'))return;const {error}=await sb.rpc('admin_archive_customer',{p_customer_id:id});if(error){alert(error.message);return}await loadBaseData();renderBirthdaySummary();renderCRM()}
  async function deleteCustomerPermanently(id){if(!id)return;const c=customers.find(x=>x.id===id);const typed=prompt(`Exclusão definitiva de ${c?.name||'cliente'}:

Isso apagará o cadastro e TODOS os agendamentos vinculados ao telefone.

Digite EXCLUIR para confirmar.`);if(typed!=='EXCLUIR')return;const {error}=await sb.rpc('admin_delete_customer_permanently',{p_customer_id:id});if(error){alert(error.message);return}await loadBaseData();renderBirthdaySummary();renderCRM();alert('Cliente e agendamentos vinculados foram excluídos definitivamente.')}

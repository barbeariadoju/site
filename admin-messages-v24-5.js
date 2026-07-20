(()=>{
 const cfg=window.BDJ_AGENDA_CONFIG||{},$=id=>document.getElementById(id);
 if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
 const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
 let rows=[],emailRows=[];
 const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 const safeUrl=u=>{try{const parsed=new URL(String(u||''),window.location.href);return(parsed.protocol==='http:'||parsed.protocol==='https:')?parsed.href:'';}catch(_){return'';}};
 const digits=s=>String(s||'').replace(/\D/g,'');
 const formatPhone=p=>{p=digits(p);if(p.startsWith('55')&&p.length>=12)p=p.slice(2);return p.length===11?`(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`:p};
 const fmt=d=>new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
 const wa=r=>`https://wa.me/55${digits(r.phone).replace(/^55/,'')}?text=${encodeURIComponent(`Olá, ${r.name}! Recebi sua mensagem pelo site da Barbearia do Ju: “${r.message.slice(0,180)}”`)}`;
 const eventLabel=e=>({booking_confirmed:'Confirmação',booking_rescheduled:'Reagendamento',booking_cancelled:'Cancelamento',booking_reminder_24h:'Lembrete 24h',review_request:'Avaliação',birthday:'Aniversário',inactive_30:'Inativo 30d',inactive_45:'Inativo 45d',inactive_60:'Inativo 60d',campaign:'Campanha',test:'Teste'})[e]||e;
 async function load(){
   $('messages-status').textContent='Atualizando…';
   const [{data,error},{data:emails,error:emailError}]=await Promise.all([
     sb.from('contact_messages').select('*').order('created_at',{ascending:false}).limit(500),
     sb.from('email_queue').select('id,booking_id,event_type,recipient_type,recipient_email,recipient_name,subject,status,attempts,last_error,sent_at,created_at').order('created_at',{ascending:false}).limit(500)
   ]);
   if(error)$('messages-status').textContent=error.message;else{rows=data||[];$('messages-status').textContent='';renderContacts();updateContactCounts()}
   if(emailError)$('emails-status').textContent=emailError.message;else{emailRows=emails||[];$('emails-status').textContent='';renderEmails();updateEmailCounts()}
 }
 function updateContactCounts(){const c={all:rows.length,new:rows.filter(x=>x.status==='new').length,read:rows.filter(x=>x.status==='read').length,replied:rows.filter(x=>x.status==='replied').length};Object.entries(c).forEach(([k,v])=>{const el=$(`messages-count-${k}`);if(el)el.textContent=v})}
 function updateEmailCounts(){const c={all:emailRows.length,sent:emailRows.filter(x=>x.status==='sent').length,failed:emailRows.filter(x=>x.status==='failed').length,reminders:emailRows.filter(x=>x.event_type==='booking_reminder_24h').length};Object.entries(c).forEach(([k,v])=>{const el=$(`emails-count-${k}`);if(el)el.textContent=v})}
 function renderContacts(){
   const q=($('messages-search').value||'').toLowerCase().trim(),filter=$('messages-filter').value;
   const list=rows.filter(r=>(filter==='all'||r.status===filter)&&(!q||`${r.name} ${r.phone} ${r.message}`.toLowerCase().includes(q)));
   $('messages-result-count').textContent=list.length;
   $('messages-list').innerHTML=list.length?list.map(r=>`<article class="message-card ${r.status==='new'?'is-new':''}" data-id="${r.id}"><div class="message-card-head"><div><span class="message-status status-${r.status}">${({new:'Nova',read:'Lida',replied:'Respondida',archived:'Arquivada'})[r.status]||r.status}</span><h3>${esc(r.name)}</h3><a href="${wa(r)}" target="_blank" rel="noopener">${esc(formatPhone(r.phone))}</a></div><time>${esc(fmt(r.created_at))}</time></div><p class="message-body">${esc(r.message)}</p><div class="message-meta">${r.email_status==='sent'?'✉️ E-mail enviado':r.email_status==='failed'?'💾 Salva no painel; e-mail não enviado':'💾 Salva no painel'}${safeUrl(r.page_url)?` • <a href="${esc(safeUrl(r.page_url))}" target="_blank" rel="noopener">Página de origem</a>`:''}</div><div class="message-actions"><a class="btn primary" href="${wa(r)}" target="_blank" rel="noopener">Responder no WhatsApp</a>${r.status==='new'?'<button data-action="read">Marcar como lida</button>':''}${r.status!=='replied'?'<button data-action="replied">Marcar respondida</button>':''}${r.status!=='archived'?'<button data-action="archived">Arquivar</button>':''}<button class="is-danger" data-action="delete">Excluir</button></div></article>`).join(''):'<div class="admin-empty">Nenhuma mensagem encontrada.</div>';
 }
 function renderEmails(){
   const q=($('emails-search').value||'').toLowerCase().trim(),filter=$('emails-filter').value;
   const list=emailRows.filter(r=>(filter==='all'||r.status===filter)&&(!q||`${r.recipient_name||''} ${r.recipient_email} ${r.subject} ${r.event_type}`.toLowerCase().includes(q)));
   $('emails-result-count').textContent=list.length;
   $('emails-list').innerHTML=list.length?list.map(r=>`<article class="message-card email-log-card ${r.status==='failed'?'has-error':''}"><div class="message-card-head"><div><span class="message-status email-status-${esc(r.status)}">${({sent:'Enviado',failed:'Falhou',sending:'Enviando',pending:'Pendente'})[r.status]||r.status}</span><h3>${esc(r.recipient_name||r.recipient_email)}</h3><a href="mailto:${esc(r.recipient_email)}">${esc(r.recipient_email)}</a></div><time>${esc(fmt(r.sent_at||r.created_at))}</time></div><div class="email-log-summary"><strong>${esc(eventLabel(r.event_type))}</strong><span>${esc(r.subject)}</span><small>Destino: ${r.recipient_type==='customer'?'Cliente':r.recipient_type==='barbershop'?'Barbearia':'Teste'} • Tentativas: ${r.attempts||0}</small></div>${r.last_error?`<details class="email-error"><summary>Ver erro</summary><p>${esc(r.last_error)}</p></details>`:''}</article>`).join(''):'<div class="admin-empty">Nenhum e-mail encontrado.</div>';
 }
 async function action(id,action){if(action==='delete'){if(!confirm('Excluir esta mensagem definitivamente?'))return;const {error}=await sb.from('contact_messages').delete().eq('id',id);if(error)return alert(error.message)}else{const patch={status:action};if(action==='read')patch.read_at=new Date().toISOString();if(action==='replied')patch.replied_at=new Date().toISOString();if(action==='archived')patch.archived_at=new Date().toISOString();const {error}=await sb.from('contact_messages').update(patch).eq('id',id);if(error)return alert(error.message)}await load()}
 document.querySelectorAll('[data-comm-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-comm-tab]').forEach(x=>x.classList.toggle('is-active',x===btn));$('contacts-panel').hidden=btn.dataset.commTab!=='contacts';$('emails-panel').hidden=btn.dataset.commTab!=='emails'}));
 $('messages-search')?.addEventListener('input',renderContacts);$('messages-filter')?.addEventListener('change',renderContacts);$('emails-search')?.addEventListener('input',renderEmails);$('emails-filter')?.addEventListener('change',renderEmails);$('messages-refresh')?.addEventListener('click',load);
 $('messages-list')?.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b)action(b.closest('[data-id]').dataset.id,b.dataset.action)});
 sb.auth.getSession().then(({data})=>{if(data.session)load()});sb.auth.onAuthStateChange((_e,s)=>{if(s)load()});
})();

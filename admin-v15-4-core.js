// admin-v15-4-core.js - parte 1/7 de admin-v15-4.js (dividido em 2026-07-28).
//
// Config, helpers puros (money/esc/phoneDigits/formatDate/etc.), autenticacao
// (init/renderAuth) e carregamento de dados (loadBaseData/aggregateCustomers).
// Compartilhado por TODAS as paginas do admin, mesmo as que nao usam os
// modos abaixo (ex.: admin-notificacoes.html, admin-mensagens.html so
// precisam do login/nav, mas carregam este arquivo igual).
//
// IMPORTANTE: os 7 arquivos admin-v15-4-*.js NAO tem IIFE proprio (ao
// contrario dos outros scripts do admin) - de proposito, pra continuar
// compartilhando o mesmo escopo de variaveis/funcoes que tinham quando
// eram um unico arquivo soh. Isso significa que toda funcao aqui vira uma
// propriedade global de window (ex.: window.money, window.esc) - antes de
// dar nome a uma funcao nova em QUALQUER script do admin, conferir que nao
// colide com nenhum nome daqui. Os 7 arquivos precisam carregar juntos, na
// mesma ordem, em toda pagina que hoje carrega admin-v15-4.js (verificado
// que sao sempre as mesmas 7: admin.html, admin-agenda.html,
// admin-clientes.html, admin-agendamento.html, admin-atendimento.html,
// admin-notificacoes.html, admin-mensagens.html).
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const catalog = window.BDJ_SERVICES || [];
  // Catálogo único em products-catalog-v1.js (window.BDJ_PRODUCTS) — antes era uma cópia
  // local duplicada em admin-balcao-v29.js. Aqui usa o catálogo COMPLETO (inclusive bebidas):
  // quem vende no balcão/atendimento pode ter vendido qualquer item do produtos.html, não só
  // o recorte "sugestão de upsell" que o agendamento do site usa.
  const productCatalog = window.BDJ_PRODUCTS || [];
  const page = document.body.dataset.adminPage || 'dashboard';
  const $ = (id) => document.getElementById(id);
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  let session=null, allBookings=[], customerProfiles=[], experienceRequests=[], customers=[];
  let selectedDate=isoLocal(new Date()), calendarMonth=new Date(); calendarMonth.setDate(1);
  let monthBlocks=[];
  function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function formatDate(s,opts={weekday:'long',day:'2-digit',month:'long'}){return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',opts)}
  function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function phoneDigits(s=''){return String(s).replace(/\D/g,'')}
  function formatPhone(p=''){p=phoneDigits(p);return p.length===11?`(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`:p}
  // Nº da visita do cliente nessa reserva (pedido do Juliano: saber de cara se é a 1ª/2ª/
  // .../5ª vez ou já é "clientão"). Conta atendimentos CONCLUÍDOS do mesmo telefone antes
  // dessa data/hora + 1 — funciona tanto pra reserva já concluída (foi a Nª visita mesmo)
  // quanto pra reserva futura (vai ser a Nª visita quando o cliente chegar). Soma
  // prior_visits (v29.9.0) — cliente atendido desde antes do sistema existir (12/03/2026),
  // marcado manualmente na conclusão do atendimento, não deve aparecer como "1ª visita".
  // v29.12.0 — caso John Maicon: comparar os dígitos exatos fazia '5511974998541' e
  // '11974998541' parecerem clientes DIFERENTES, então quem tinha sido atendido antes com o
  // telefone gravado no outro formato voltava a aparecer como "1ª visita". Mesma regra da
  // função phone_match_key do banco: DDD + os 8 últimos dígitos, ignorando o 55 e o 9.
  function phoneKey(s=''){const d=phoneDigits(s).replace(/^55/,'');return d.length>=10?d.slice(0,2)+d.slice(-8):d}
  // v29.94.0 — MESMA REGRA da funcao phone_key() do banco: ultimos 8 digitos, e nulo
  // quando o telefone tem menos de 11 ou mais de 13 digitos. Existe separada de phoneKey()
  // (que e DDD + 8) porque o indice unico uq_customer_profiles_phone_key usa ESTA regra —
  // se o lote do upsert fosse deduplicado pela outra, duas linhas do mesmo lote poderiam
  // colidir no banco ("ON CONFLICT DO UPDATE cannot affect row a second time").
  function phoneKeyDb(s=''){const d=phoneDigits(s);return (d.length>=11&&d.length<=13)?d.slice(-8):null}
  function visitNumber(x){const ph=phoneKey(x.customer_phone);if(!ph)return 1;const before=allBookings.filter(b=>b.status==='completed'&&phoneKey(b.customer_phone)===ph&&(b.booking_date<x.booking_date||(b.booking_date===x.booking_date&&b.start_time<x.start_time))).length;const profile=customerProfiles.find(p=>phoneKey(p.phone)===ph);const prior=Number(profile?.prior_visits||0);return before+prior+1}
  // v29.98.0 — o sistema so conhece o que passou por ele (desde 12/03/2026). Cliente que o
  // Juliano ja atendia ANTES disso entra como '1ª visita' e leva mensagem de boas-vindas de
  // cliente novo. Este teste diz de quem vale a pena perguntar na cadeira: ninguem com
  // atendimento concluido no sistema e ninguem com prior_visits ja preenchido - pra esses o
  // numero ja e conhecido e a pergunta so atrapalharia.
  function podeMarcarPrimeiraVez(x){
    const ph=phoneKey(x.customer_phone);if(!ph)return false;
    const before=allBookings.filter(b=>b.status==='completed'&&phoneKey(b.customer_phone)===ph&&(b.booking_date<x.booking_date||(b.booking_date===x.booking_date&&b.start_time<x.start_time))).length;
    if(before>0)return false;
    return !(Number(customerProfiles.find(p=>phoneKey(p.phone)===ph)?.prior_visits||0)>0)
  }
  function visitBadgeHtml(x){const n=visitNumber(x);if(n>=6)return `<span class="admin-visit-badge is-recurring" title="${n}ª visita ou mais">⭐ Cliente recorrente</span>`;return `<span class="admin-visit-badge is-new">${n}ª visita</span>`}
  function statusLabel(s){return({pending:'Aguardando',confirmed:'Confirmado',cancelled:'Cancelado',completed:'Concluído',no_show:'Ausência'})[s]||s}
  function statusClass(s){return `status-${s||'pending'}`}
  function ageFromBirth(date){if(!date)return null;const b=new Date(date+'T12:00:00'),t=new Date();let a=t.getFullYear()-b.getFullYear();const m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a>=0?a:null}
  function birthdayLabel(date){if(!date)return '';const d=new Date(date+'T12:00:00');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}
  function daysUntilBirthday(date){if(!date)return null;const b=new Date(date+'T12:00:00'),t=new Date();t.setHours(0,0,0,0);let n=new Date(t.getFullYear(),b.getMonth(),b.getDate());if(n<t)n=new Date(t.getFullYear()+1,b.getMonth(),b.getDate());return Math.round((n-t)/86400000)}
  function friendlyDb(s=''){if(s.includes('indisponível')||s.includes('conflito'))return 'Esse período já está ocupado. Escolha outro horário.';if(s.includes('bloqueado'))return 'Esse horário está bloqueado.';return s}
  function setText(id,val){if($(id))$(id).textContent=val}
  function emailLink(x){if(!x.customer_email)return '';const subject=`Agendamento Barbearia do Ju — ${x.booking_date.split('-').reverse().join('/')} às ${x.start_time.slice(0,5)}`;const body=`Olá, ${x.customer_name}!%0D%0A%0D%0AEntramos em contato sobre seu agendamento na Barbearia do Ju em ${x.booking_date.split('-').reverse().join('/')} às ${x.start_time.slice(0,5)}.%0D%0A%0D%0AAtenciosamente,%0D%0ABarbearia do Ju`;return `mailto:${encodeURIComponent(x.customer_email)}?subject=${encodeURIComponent(subject)}&body=${body}`}
  function whatsappBusinessUrl(phone,msg=''){const digits=`55${phoneDigits(phone)}`;const web=`https://wa.me/${digits}${msg?`?text=${encodeURIComponent(msg)}`:''}`;if(/Android/i.test(navigator.userAgent)){const fallback=encodeURIComponent(web);return `intent://send?phone=${digits}${msg?`&text=${encodeURIComponent(msg)}`:''}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${fallback};end`}return web}
  function whatsappLink(x,type='confirm'){const when=formatDate(x.booking_date,{weekday:'long',day:'2-digit',month:'2-digit'});const msg=type==='reminder'?`Olá, ${x.customer_name}! Lembrete do seu horário amanhã, às ${x.start_time.slice(0,5)}, na Barbearia do Ju. Pode confirmar?`:`Olá, ${x.customer_name}! Seu horário está marcado para ${when}, às ${x.start_time.slice(0,5)}, na Barbearia do Ju. Pode confirmar?`;return whatsappBusinessUrl(x.customer_phone,msg)}
  function parseProducts(x){const p=Array.isArray(x.selected_products)?x.selected_products:[];return p.filter(i=>i&&i.name)}
  function productsHtml(x){const items=parseProducts(x);if(!items.length)return '';return `<div class="admin-products"><span class="admin-products-label">🛍 Produtos vendidos</span>${items.map(p=>`<span class="admin-product-chip"><b>${esc(p.name)}</b><small>${money(p.price)}</small></span>`).join('')}<strong class="admin-products-total">${money(x.products_price||items.reduce((a,p)=>a+Number(p.price||0),0))}</strong></div>`}
  const PAYMENT_LABELS={pix:'Pix',debito:'Débito',credito:'Crédito',dinheiro:'Dinheiro',fidelidade:'Fidelidade'};
  // Linha única e compacta (texto discreto, sem caixas) com serviço/produtos/total e a(s)
  // forma(s) de pagamento — pedido do Juliano depois que a 1ª versão (3 caixas + chips de
  // pagamento empilhadas) ficou grande demais e obrigava rolar muito com várias entradas.
  function priceSummaryHtml(x){
    const s=Number(x.service_price||0),p=Number(x.products_price||0);
    let pay='';
    if(x.payment_method){
      const hasSplit=x.products_payment_method&&x.products_payment_method!==x.payment_method;
      const serviceLabel=esc(PAYMENT_LABELS[x.payment_method]||x.payment_method);
      pay=hasSplit
        ? ` · 💳 Serviço ${serviceLabel} / Produtos ${esc(PAYMENT_LABELS[x.products_payment_method]||x.products_payment_method)}`
        : ` · 💳 ${serviceLabel}`;
    }
    return `<small class="admin-price-summary">Serviços ${money(s)} · Produtos ${money(p)} · <b>Total ${money(s+p)}</b>${pay}</small>`;
  }
  // v29.12.0 — o admin fica aberto o dia inteiro no celular do Juliano e NUNCA recarrega
  // sozinho. Em 11/08/2026 isso custou caro: três correções foram publicadas de manhã e à
  // tarde ele ainda estava concluindo atendimento com a tela velha, perdendo os pontos de
  // fidelidade que digitava (casos John, Cauã e Fernando). O service worker está certo
  // (busca JS sempre na rede) — o problema é a página que já está aberta há horas.
  // Agora a própria tela confere a versão publicada e se atualiza. Só recarrega quando não
  // há nada aberto na frente do usuário; se houver modal, avisa e espera ele fechar.
  const ADMIN_VERSION='29.98.0'
  async function checkForUpdate(){
    try{
      const r=await fetch('/admin-version.json',{cache:'no-store'})
      if(!r.ok)return
      const {v}=await r.json()
      if(!v||v===ADMIN_VERSION)return
      const modalAberto=document.querySelector('.admin-modal:not([hidden])')
      if(modalAberto){showUpdateBanner();return}
      location.reload()
    }catch(e){/* offline ou arquivo ausente: silencioso de propósito */}
  }
  function showUpdateBanner(){
    if(document.getElementById('admin-update-banner'))return
    const b=document.createElement('button')
    b.id='admin-update-banner'
    b.type='button'
    b.textContent='🔄 Nova versão disponível — toque para atualizar'
    b.style.cssText='position:fixed;left:12px;right:12px;bottom:88px;z-index:9999;padding:14px;border:none;border-radius:14px;background:var(--gold2,#c9a227);color:#111;font:inherit;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.45)'
    b.addEventListener('click',()=>location.reload())
    document.body.appendChild(b)
  }
  async function init(){bindGlobal();checkForUpdate();setInterval(checkForUpdate,10*60*1000);if(!sb){showLogin('Configuração do Supabase ausente.');return}const {data,error}=await sb.auth.getSession();if(error){showLogin(error.message);return}session=data.session;renderAuth();sb.auth.onAuthStateChange((_e,s)=>{session=s;renderAuth()})}
  function bindGlobal(){$('admin-signin')?.addEventListener('click',signIn);$('admin-signout')?.addEventListener('click',async()=>{await sb.auth.signOut()});document.querySelectorAll('[data-admin-nav]').forEach(a=>{if(a.dataset.adminNav===page)a.classList.add('is-active')})}
  async function signIn(){const msg=$('admin-message');msg.textContent='Entrando...';const {error}=await sb.auth.signInWithPassword({email:$('admin-email').value,password:$('admin-password').value});msg.textContent=error?(error.message.includes('Invalid login')?'E-mail ou senha incorretos.':error.message):''}
  function showLogin(msg=''){$('admin-login').hidden=false;$('admin-app').hidden=true;if($('admin-message'))$('admin-message').textContent=msg}
  async function renderAuth(){if(!session){showLogin();return}$('admin-login').hidden=true;$('admin-app').hidden=false;await loadBaseData();if(page==='dashboard')renderDashboard();if(page==='agenda')initAgenda();if(page==='clientes')initCRM();if(page==='agendamento')initBookingForm();if(page==='atendimento')initServiceMode()}
  async function loadBaseData(){
    const [{data:b,error:be},{data:p,error:pe},{data:e,error:ee}]=await Promise.all([
      // v29.84.0: payments embutido pra Agenda mostrar COMO o cliente pagou online
      // (Pix/débito/crédito) — pedido do Juliano ao ver "Pago online (PagBank)" sem o meio.
      sb.from('bookings').select('*, payments(method,status)').order('booking_date',{ascending:false}).order('start_time',{ascending:false}).limit(3000),
      sb.from('customer_profiles').select('*').order('name',{ascending:true}),
      sb.from('experience_requests').select('id,customer_id,booking_id,status,feedback,created_at,answered_at').order('created_at',{ascending:false}).limit(3000)
    ]);
    if(be){console.error(be);allBookings=[]}else allBookings=b||[];
    if(pe){console.error(pe);customerProfiles=[]}else customerProfiles=p||[];
    if(ee){console.warn('Experience requests indisponível:',ee.message);experienceRequests=[]}else experienceRequests=e||[];

    // Garante que clientes vindos somente de agendamentos também tenham perfil no CRM.
    // Sem isso, o botão de exclusão ficava desativado por falta do id do perfil.
    if(!pe && allBookings.length){
      // v29.12.0 — ESTA ERA A FÁBRICA DE FICHAS DUPLICADAS (achada em 11/08/2026).
      // A comparação era por dígitos EXATOS: um agendamento gravado como '11974998541'
      // não "encontrava" a ficha do mesmo cliente gravada como '5511974998541', e este
      // upsert criava uma ficha nova — automaticamente, toda vez que o admin abria. Foi
      // assim que o John voltou a duplicar 3 minutos depois de eu unificar as fichas dele.
      // Agora a comparação usa a chave canônica (mesma regra do phone_match_key do banco).
      const existing=new Set(customerProfiles.map(x=>phoneKeyDb(x.phone)).filter(Boolean));
      const latestByPhone=new Map();
      allBookings.forEach(x=>{
        const ph=phoneKeyDb(x.customer_phone);
        if(!ph || existing.has(ph) || latestByPhone.has(ph))return;
        latestByPhone.set(ph,{
          name:String(x.customer_name||'Cliente').trim(),
          // grava o telefone COMPLETO do agendamento, nunca a chave canônica (que é
          // truncada em DDD + 8 dígitos e serve só pra comparar)
          phone:phoneDigits(x.customer_phone),
          email:x.customer_email?String(x.customer_email).trim().toLowerCase():null,
          archived:false,
          updated_at:new Date().toISOString()
        });
      });
      const missing=[...latestByPhone.values()];
      if(missing.length){
        const {error:syncError}=await sb.from('customer_profiles').upsert(missing,{onConflict:'phone_key'});
        if(syncError)console.error('Falha ao sincronizar clientes do CRM:',syncError);
        else{
          const {data:refreshed,error:refreshError}=await sb.from('customer_profiles').select('*').order('name',{ascending:true});
          if(!refreshError)customerProfiles=refreshed||[];
        }
      }
    }
    customers=aggregateCustomers(allBookings,customerProfiles)
  }
  function aggregateCustomers(rows,profiles){const profileByPhone=new Map(profiles.map(p=>[phoneDigits(p.phone),p]));const map=new Map();profiles.filter(p=>!p.archived).forEach(p=>map.set(phoneDigits(p.phone),{id:p.id,phone:phoneDigits(p.phone),name:p.name,email:p.email||'',notes:p.notes||'',birthDate:p.birth_date||null,preferredServices:p.preferred_services||[],stylePreferences:p.style_preferences||{},favoriteProducts:p.favorite_products||[],internalTags:p.internal_tags||[],vip:Boolean(p.vip),preferredPayment:p.preferred_payment||'',returnIntervalDays:p.return_interval_days||null,visits:0,completed:0,noShows:0,total:0,lastDate:null,lastServices:'',history:[]}));rows.forEach(x=>{const ph=phoneDigits(x.customer_phone);if(!ph)return;const profile=profileByPhone.get(ph);if(profile?.archived)return;if(!map.has(ph))map.set(ph,{id:profile?.id||null,phone:ph,name:profile?.name||x.customer_name,email:profile?.email||x.customer_email||'',notes:profile?.notes||'',birthDate:profile?.birth_date||null,preferredServices:profile?.preferred_services||[],stylePreferences:profile?.style_preferences||{},favoriteProducts:profile?.favorite_products||[],internalTags:profile?.internal_tags||[],vip:Boolean(profile?.vip),preferredPayment:profile?.preferred_payment||'',returnIntervalDays:profile?.return_interval_days||null,visits:0,completed:0,noShows:0,total:0,lastDate:x.booking_date,lastServices:x.service_name,history:[]});const c=map.get(ph);c.history.push(x);c.visits++;if(x.status==='completed'){c.completed++;c.total+=Number(x.service_price||0)+Number(x.products_price||0)}if(x.status==='no_show')c.noShows++;if(!c.lastDate||x.booking_date>c.lastDate){c.lastDate=x.booking_date;c.lastServices=x.service_name;if(!profile)c.name=x.customer_name;if(!c.email)c.email=x.customer_email||''}});const expByCustomer=new Map();experienceRequests.forEach(e=>{if(!e.customer_id)return;const arr=expByCustomer.get(e.customer_id)||[];arr.push(e);expByCustomer.set(e.customer_id,arr)});for(const c of map.values()){const ex=expByCustomer.get(c.id)||[];c.feedbacks=ex.filter(x=>x.status==='feedback').length;c.reviewClicks=ex.filter(x=>x.status==='review_clicked').length;c.lastFeedback=ex.find(x=>x.status==='feedback'&&x.feedback)?.feedback||'';c.avgTicket=c.completed?c.total/c.completed:0;c.daysInactive=c.lastDate?Math.max(0,Math.floor((new Date()-new Date(c.lastDate+'T12:00:00'))/86400000)):null;const base=Math.min(45,c.completed*7)+Math.min(25,c.total/40)+(c.reviewClicks?10:0)+Math.max(0,20-(c.noShows*8));c.juScore=Math.max(0,Math.min(100,Math.round(base)));c.level=c.juScore>=85?'Platinum':c.juScore>=70?'Gold':c.juScore>=50?'Silver':'Bronze'}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))}

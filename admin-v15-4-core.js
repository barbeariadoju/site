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
  // CatÃ¡logo Ãºnico em products-catalog-v1.js (window.BDJ_PRODUCTS) â€” antes era uma cÃ³pia
  // local duplicada em admin-balcao-v29.js. Aqui usa o catÃ¡logo COMPLETO (inclusive bebidas):
  // quem vende no balcÃ£o/atendimento pode ter vendido qualquer item do produtos.html, nÃ£o sÃ³
  // o recorte "sugestÃ£o de upsell" que o agendamento do site usa.
  const productCatalog = window.BDJ_PRODUCTS || [];
  const page = document.body.dataset.adminPage || 'dashboard';
  const $ = (id) => document.getElementById(id);
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  let session=null, allBookings=[], customerProfiles=[], experienceRequests=[], customers=[], loyaltyAccounts=[], loyaltyRewards=[], customerBenefits=[];
  let selectedDate=isoLocal(new Date()), calendarMonth=new Date(); calendarMonth.setDate(1);
  let monthBlocks=[];
  function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function formatDate(s,opts={weekday:'long',day:'2-digit',month:'long'}){return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',opts)}
  function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function phoneDigits(s=''){return String(s).replace(/\D/g,'')}
  // v29.152.0 â€” o nÃºmero gravado com o 55 (13 dÃ­gitos, vindo do WhatsApp) saÃ­a cru na tela
  // ("5511974845870" ao lado de "(11) 97484-5870" â€” caso Helder). Tira o 55 e formata
  // tambÃ©m o fixo/8 dÃ­gitos locais. SÃ³ apresentaÃ§Ã£o: o valor gravado nÃ£o muda.
  function formatPhone(p=''){p=phoneDigits(p);if((p.length===13||p.length===12)&&p.startsWith('55'))p=p.slice(2);return p.length===11?`(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`:p.length===10?`(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}`:p}
  // NÂº da visita do cliente nessa reserva (pedido do Juliano: saber de cara se Ã© a 1Âª/2Âª/
  // .../5Âª vez ou jÃ¡ Ã© "clientÃ£o"). Conta atendimentos CONCLUÃDOS do mesmo telefone antes
  // dessa data/hora + 1 â€” funciona tanto pra reserva jÃ¡ concluÃ­da (foi a NÂª visita mesmo)
  // quanto pra reserva futura (vai ser a NÂª visita quando o cliente chegar). Soma
  // prior_visits (v29.9.0) â€” cliente atendido desde antes do sistema existir (12/03/2026),
  // marcado manualmente na conclusÃ£o do atendimento, nÃ£o deve aparecer como "1Âª visita".
  // v29.12.0 â€” caso John Maicon: comparar os dÃ­gitos exatos fazia '5511974998541' e
  // '11974998541' parecerem clientes DIFERENTES, entÃ£o quem tinha sido atendido antes com o
  // telefone gravado no outro formato voltava a aparecer como "1Âª visita". Mesma regra da
  // funÃ§Ã£o phone_match_key do banco: DDD + os 8 Ãºltimos dÃ­gitos, ignorando o 55 e o 9.
  function phoneKey(s=''){const d=phoneDigits(s).replace(/^55/,'');return d.length>=10?d.slice(0,2)+d.slice(-8):d}
  // v29.94.0 â€” MESMA REGRA da funcao phone_key() do banco: ultimos 8 digitos, e nulo
  // quando o telefone tem menos de 11 ou mais de 13 digitos. Existe separada de phoneKey()
  // (que e DDD + 8) porque o indice unico uq_customer_profiles_phone_key usa ESTA regra â€”
  // se o lote do upsert fosse deduplicado pela outra, duas linhas do mesmo lote poderiam
  // colidir no banco ("ON CONFLICT DO UPDATE cannot affect row a second time").
  function phoneKeyDb(s=''){const d=phoneDigits(s);return (d.length>=11&&d.length<=13)?d.slice(-8):null}
  function visitNumber(x){const ph=phoneKey(x.customer_phone);if(!ph)return 1;const before=allBookings.filter(b=>b.status==='completed'&&phoneKey(b.customer_phone)===ph&&(b.booking_date<x.booking_date||(b.booking_date===x.booking_date&&b.start_time<x.start_time))).length;const profile=customerProfiles.find(p=>phoneKey(p.phone)===ph);const prior=Number(profile?.prior_visits||0);return before+prior+1}
  // v29.98.0 â€” o sistema so conhece o que passou por ele (desde 12/03/2026). Cliente que o
  // Juliano ja atendia ANTES disso entra como '1Âª visita' e leva mensagem de boas-vindas de
  // cliente novo. Este teste diz de quem vale a pena perguntar na cadeira: ninguem com
  // atendimento concluido no sistema e ninguem com prior_visits ja preenchido - pra esses o
  // numero ja e conhecido e a pergunta so atrapalharia.
  function podeMarcarPrimeiraVez(x){
    const ph=phoneKey(x.customer_phone);if(!ph)return false;
    const before=allBookings.filter(b=>b.status==='completed'&&phoneKey(b.customer_phone)===ph&&(b.booking_date<x.booking_date||(b.booking_date===x.booking_date&&b.start_time<x.start_time))).length;
    if(before>0)return false;
    return !(Number(customerProfiles.find(p=>phoneKey(p.phone)===ph)?.prior_visits||0)>0)
  }
  function visitBadgeHtml(x){const n=visitNumber(x);if(n>=6)return `<span class="admin-visit-badge is-recurring" title="${n}Âª visita ou mais">â­ Cliente recorrente</span>`;return `<span class="admin-visit-badge is-new">${n}Âª visita</span>`}
  // v29.188.0 â€” fidelidade visÃ­vel onde o Juliano decide (caso Juliano Prando, 15/09/2026:
  // fechou 10 pontos na sexta, ninguÃ©m viu, e a barba de terÃ§a saiu "na fidelidade" de cabeÃ§a).
  // Cadastro pelo telefone (mesma chave do visitNumber), conta de fidelidade pelo id do cadastro.
  function loyaltyFor(phone=''){
    const ph=phoneKey(phone);if(!ph)return {points:0,rewards:0,expires:null,found:false};
    const ids=customerProfiles.filter(p=>phoneKey(p.phone)===ph).map(p=>p.id);
    const acc=loyaltyAccounts.find(a=>ids.includes(a.customer_id));
    if(!acc)return {points:0,rewards:0,expires:null,found:false};
    const exp=loyaltyRewards.filter(r=>ids.includes(r.customer_id)&&r.expires_at).map(r=>r.expires_at).sort()[0]||null;
    return {points:Number(acc.points||0),rewards:Number(acc.rewards_available||0),expires:exp,found:true};
  }
  // Selo no card: concluÃ­do com prÃªmio = "PrÃªmio usado"; em aberto com prÃªmio = verde, chamando;
  // sem prÃªmio = sÃ³ os pontos, discreto (e "quase lÃ¡" a partir de 8).
  function loyaltyBadgeHtml(x){
    if(x.status==='completed'){
      const ld=Number(x.loyalty_discount||0);
      return ld>0?`<span class="admin-visit-badge is-reward" title="PrÃªmio do cartÃ£o fidelidade usado neste atendimento">ðŸŽ PrÃªmio usado${x.loyalty_free_service?` Â· ${esc(x.loyalty_free_service)}`:''}</span>`:'';
    }
    const lo=loyaltyFor(x.customer_phone);if(!lo.found)return '';
    if(lo.rewards>0){const vence=lo.expires?` Â· vence ${new Date(lo.expires).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`:'';return `<span class="admin-visit-badge is-reward" title="Fechou 10 pontos: 1 serviÃ§o por nossa conta. No Concluir, BÃ´nus de fidelidade jÃ¡ vem marcado.">ðŸŽ PrÃªmio pra usar: 1 serviÃ§o por nossa conta${vence}</span>`}
    return `<span class="admin-visit-badge is-points" title="Pontos do cartÃ£o fidelidade (10 = 1 serviÃ§o por nossa conta)">${lo.points}/10 pontos${lo.points>=8?' Â· quase lÃ¡':''}</span>`;
  }
  // v29.195.0 â€” "Como foi feito" (pedido do Juliano, 16/09/2026, caso Tatiane: dois cortes pra
  // chegar no resultado, e nada anotado). O texto vive em customer_profiles.style_preferences
  // (o mesmo "PreferÃªncias de estilo" da tela Clientes); o Concluir e o BalcÃ£o gravam por
  // admin_set_customer_style, e o card do agendamento mostra como lembrete, abaixo dos serviÃ§os.
  function styleTextFor(phone=''){
    const ph=phoneKey(phone);if(!ph)return '';
    const p=customerProfiles.find(c=>c.phone&&phoneKey(c.phone)===ph&&!c.archived)||customerProfiles.find(c=>c.phone&&phoneKey(c.phone)===ph);
    return p?Object.values(p.style_preferences||{}).map(v=>String(v||'').trim()).filter(Boolean).join(', '):'';
  }
  function styleReminderHtml(x){
    if(x.status==='cancelled'||x.status==='no_show')return '';
    const t=styleTextFor(x.customer_phone);
    return t?`<small class="admin-style-reminder" title="Como foi feito da Ãºltima vez â€” anotado no Concluir ou em Clientes â€º PreferÃªncias de estilo">âœ‚ï¸ ${esc(t)}</small>`:'';
  }
  function statusLabel(s){return({pending:'Aguardando',confirmed:'Confirmado',cancelled:'Cancelado',completed:'ConcluÃ­do',no_show:'AusÃªncia'})[s]||s}
  function statusClass(s){return `status-${s||'pending'}`}
  function ageFromBirth(date){if(!date)return null;const b=new Date(date+'T12:00:00'),t=new Date();let a=t.getFullYear()-b.getFullYear();const m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a>=0?a:null}
  function birthdayLabel(date){if(!date)return '';const d=new Date(date+'T12:00:00');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}
  function daysUntilBirthday(date){if(!date)return null;const b=new Date(date+'T12:00:00'),t=new Date();t.setHours(0,0,0,0);let n=new Date(t.getFullYear(),b.getMonth(),b.getDate());if(n<t)n=new Date(t.getFullYear()+1,b.getMonth(),b.getDate());return Math.round((n-t)/86400000)}
  function friendlyDb(s=''){if(s.includes('indisponÃ­vel')||s.includes('conflito'))return 'Esse perÃ­odo jÃ¡ estÃ¡ ocupado. Escolha outro horÃ¡rio.';if(s.includes('bloqueado'))return 'Esse horÃ¡rio estÃ¡ bloqueado.';return s}
  function setText(id,val){if($(id))$(id).textContent=val}
  function emailLink(x){if(!x.customer_email)return '';const subject=`Agendamento Barbearia do Ju â€” ${x.booking_date.split('-').reverse().join('/')} Ã s ${x.start_time.slice(0,5)}`;const body=`OlÃ¡, ${x.customer_name}!%0D%0A%0D%0AEntramos em contato sobre seu agendamento na Barbearia do Ju em ${x.booking_date.split('-').reverse().join('/')} Ã s ${x.start_time.slice(0,5)}.%0D%0A%0D%0AAtenciosamente,%0D%0ABarbearia do Ju`;return `mailto:${encodeURIComponent(x.customer_email)}?subject=${encodeURIComponent(subject)}&body=${body}`}
  function whatsappBusinessUrl(phone,msg=''){const digits=`55${phoneDigits(phone)}`;const web=`https://wa.me/${digits}${msg?`?text=${encodeURIComponent(msg)}`:''}`;if(/Android/i.test(navigator.userAgent)){const fallback=encodeURIComponent(web);return `intent://send?phone=${digits}${msg?`&text=${encodeURIComponent(msg)}`:''}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${fallback};end`}return web}
  function whatsappLink(x,type='confirm'){const when=formatDate(x.booking_date,{weekday:'long',day:'2-digit',month:'2-digit'});const msg=type==='reminder'?`OlÃ¡, ${x.customer_name}! Lembrete do seu horÃ¡rio amanhÃ£, Ã s ${x.start_time.slice(0,5)}, na Barbearia do Ju. Pode confirmar?`:`OlÃ¡, ${x.customer_name}! Seu horÃ¡rio estÃ¡ marcado para ${when}, Ã s ${x.start_time.slice(0,5)}, na Barbearia do Ju. Pode confirmar?`;return whatsappBusinessUrl(x.customer_phone,msg)}
  function parseProducts(x){const p=Array.isArray(x.selected_products)?x.selected_products:[];return p.filter(i=>i&&i.name)}
  function productsHtml(x){const items=parseProducts(x);if(!items.length)return '';return `<div class="admin-products"><span class="admin-products-label">ðŸ› Produtos vendidos</span>${items.map(p=>`<span class="admin-product-chip"><b>${esc(p.name)}</b><small>${money(p.price)}</small></span>`).join('')}<strong class="admin-products-total">${money(x.products_price||items.reduce((a,p)=>a+Number(p.price||0),0))}</strong></div>`}
  const PAYMENT_LABELS={pix:'Pix',debito:'DÃ©bito',credito:'CrÃ©dito',dinheiro:'Dinheiro',fidelidade:'Fidelidade'};
  // Linha Ãºnica e compacta (texto discreto, sem caixas) com serviÃ§o/produtos/total e a(s)
  // forma(s) de pagamento â€” pedido do Juliano depois que a 1Âª versÃ£o (3 caixas + chips de
  // pagamento empilhadas) ficou grande demais e obrigava rolar muito com vÃ¡rias entradas.
  function priceSummaryHtml(x){
    const s=Number(x.service_price||0),p=Number(x.products_price||0);
    // v29.188.0 â€” prÃªmio da fidelidade abatido no card (antes somava o serviÃ§o cheio no Total)
    const ld=x.courtesy?0:Math.min(Number(x.loyalty_discount||0),s);
    let pay='';
    if(x.payment_method){
      const hasSplit=x.products_payment_method&&x.products_payment_method!==x.payment_method;
      const serviceLabel=esc(PAYMENT_LABELS[x.payment_method]||x.payment_method);
      pay=hasSplit
        ? ` Â· ðŸ’³ ServiÃ§o ${serviceLabel} / Produtos ${esc(PAYMENT_LABELS[x.products_payment_method]||x.products_payment_method)}`
        : ` Â· ðŸ’³ ${serviceLabel}`;
    }
    // v29.160.0 (pedido do Juliano, 09/09): a caixinha aparece no card, mas FORA do total â€”
    // Ã© dinheiro do barbeiro, nÃ£o faturamento, e o cupom do cliente diz o mesmo ("Ã  parte").
    const tip=Number(x.tip_amount||0);
    const tipHtml=tip>0?` Â· ðŸ’° Caixinha ${money(tip)} <i>(Ã  parte)</i>`:'';
    // v29.162.0 â€” desconto manual (migration 147): service_price jÃ¡ Ã© o lÃ­quido; o card
    // mostra o preÃ§o de tabela ao lado e o motivo, pra ele lembrar o que combinou.
    const disc=Number(x.discount_amount||0);
    const discHtml=disc>0?` Â· ðŸ·ï¸ Desconto ${money(disc)}${x.discount_reason?` <i>(${esc(x.discount_reason)})</i>`:''}`:'';
    return `<small class="admin-price-summary">ServiÃ§os ${money(s)}${disc>0?` <i>(tabela ${money(s+disc)})</i>`:''}${ld>0?` Â· ðŸŽ Fidelidade âˆ’${money(ld)}${x.loyalty_free_service?` <i>(${esc(x.loyalty_free_service)})</i>`:''}`:''} Â· Produtos ${money(p)} Â· <b>Total ${money(s-ld+p)}</b>${pay}${discHtml}${tipHtml}</small>`;
  }
  // v29.12.0 â€” o admin fica aberto o dia inteiro no celular do Juliano e NUNCA recarrega
  // sozinho. Em 11/08/2026 isso custou caro: trÃªs correÃ§Ãµes foram publicadas de manhÃ£ e Ã 
  // tarde ele ainda estava concluindo atendimento com a tela velha, perdendo os pontos de
  // fidelidade que digitava (casos John, CauÃ£ e Fernando). O service worker estÃ¡ certo
  // (busca JS sempre na rede) â€” o problema Ã© a pÃ¡gina que jÃ¡ estÃ¡ aberta hÃ¡ horas.
  // Agora a prÃ³pria tela confere a versÃ£o publicada e se atualiza. SÃ³ recarrega quando nÃ£o
  // hÃ¡ nada aberto na frente do usuÃ¡rio; se houver modal, avisa e espera ele fechar.
  const ADMIN_VERSION='29.242.0'
  // v29.99.0 â€” TRAVA ANTI-LOOP. Em 29/08 as versÃµes 29.96 a 29.98 subiram o ADMIN_VERSION
  // aqui e esqueceram o admin-version.json (parado no 29.94.0). Como as duas nunca iam
  // ficar iguais, TODA abertura do painel caÃ­a direto no location.reload() e recarregava
  // pra sempre: o Juliano abria o app no iPhone e sÃ³ via "carregando" (manhÃ£ de 30/08).
  // Agora o recarregamento sÃ³ acontece UMA vez por versÃ£o anunciada. Se depois de
  // recarregar o arquivo continuar anunciando a mesma versÃ£o, o cÃ³digo publicado Ã© o que
  // estÃ¡ rodando â€” entÃ£o em vez de recarregar de novo, o painel abre normal e mostra o
  // aviso. Recarregar em loop nunca conserta nada; deixar o painel abrir sempre conserta.
  async function checkForUpdate(){
    try{
      const r=await fetch('/admin-version.json',{cache:'no-store'})
      if(!r.ok)return
      const {v}=await r.json()
      if(!v||v===ADMIN_VERSION)return
      const modalAberto=document.querySelector('.admin-modal:not([hidden])')
      let jaTentou=false
      try{jaTentou=sessionStorage.getItem('bdj-admin-reload')===v}catch(_){jaTentou=true}
      if(modalAberto||jaTentou){showUpdateBanner();return}
      try{sessionStorage.setItem('bdj-admin-reload',v)}catch(_){return}
      location.reload()
    }catch(e){/* offline ou arquivo ausente: silencioso de propÃ³sito */}
  }
  function showUpdateBanner(){
    if(document.getElementById('admin-update-banner'))return
    const b=document.createElement('button')
    b.id='admin-update-banner'
    b.type='button'
    b.textContent='ðŸ”„ Nova versÃ£o disponÃ­vel â€” toque para atualizar'
    b.style.cssText='position:fixed;left:12px;right:12px;bottom:88px;z-index:9999;padding:14px;border:none;border-radius:14px;background:var(--gold2,#c9a227);color:#111;font:inherit;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.45)'
    b.addEventListener('click',()=>location.reload())
    document.body.appendChild(b)
  }
  async function init(){bindGlobal();checkForUpdate();setInterval(checkForUpdate,10*60*1000);if(!sb){showLogin('ConfiguraÃ§Ã£o do Supabase ausente.');return}const {data,error}=await sb.auth.getSession();if(error){showLogin(error.message);return}session=data.session;renderAuth();sb.auth.onAuthStateChange((_e,s)=>{session=s;renderAuth()})}
  function bindGlobal(){$('admin-signin')?.addEventListener('click',signIn);$('admin-signout')?.addEventListener('click',async()=>{await sb.auth.signOut()});document.querySelectorAll('[data-admin-nav]').forEach(a=>{if(a.dataset.adminNav===page)a.classList.add('is-active')})}
  async function signIn(){const msg=$('admin-message');msg.textContent='Entrando...';const {error}=await sb.auth.signInWithPassword({email:$('admin-email').value,password:$('admin-password').value});msg.textContent=error?(error.message.includes('Invalid login')?'E-mail ou senha incorretos.':error.message):''}
  function showLogin(msg=''){$('admin-login').hidden=false;$('admin-app').hidden=true;if($('admin-message'))$('admin-message').textContent=msg}
  async function renderAuth(){if(!session){showLogin();return}$('admin-login').hidden=true;$('admin-app').hidden=false;await loadBaseData();if(page==='dashboard')renderDashboard();if(page==='agenda')initAgenda();if(page==='clientes')initCRM();if(page==='agendamento')initBookingForm();if(page==='atendimento')initServiceMode()}
  async function loadBaseData(){
    // v29.188.0 â€” fidelidade junto (caso Juliano Prando, 15/09/2026): o card da Agenda/Hoje e o
    // Concluir precisam saber se o cliente tem prÃªmio pra usar. Duas tabelas pequenas; erro
    // aqui nunca derruba a tela â€” sÃ³ some o selo.
    const [{data:b,error:be},{data:p,error:pe},{data:e,error:ee},{data:la},{data:lr},{data:cb}]=await Promise.all([
      // v29.84.0: payments embutido pra Agenda mostrar COMO o cliente pagou online
      // (Pix/dÃ©bito/crÃ©dito) â€” pedido do Juliano ao ver "Pago online (PagBank)" sem o meio.
      sb.from('bookings').select('*, payments(method,status)').order('booking_date',{ascending:false}).order('start_time',{ascending:false}).limit(3000),
      sb.from('customer_profiles').select('*').order('name',{ascending:true}),
      sb.from('experience_requests').select('id,customer_id,booking_id,status,feedback,created_at,answered_at').order('created_at',{ascending:false}).limit(3000),
      sb.from('loyalty_accounts').select('customer_id,points,rewards_available,lifetime_points'),
      sb.from('loyalty_rewards').select('customer_id,status,expires_at').in('status',['available','reserved']),
      // v29.209.0 â€” presente de aniversÃ¡rio e indicaÃ§Ã£o (customer_benefits): o card e o Concluir
      // mostram o benefÃ­cio pra ele nÃ£o passar batido. Erro aqui sÃ³ some o aviso.
      sb.from('customer_benefits').select('id,kind,phone_mkey,amount,service_name,weekdays,valid_until,status,meta').eq('status','available')
    ]);
    if(be){console.error(be);allBookings=[]}else allBookings=b||[];
    if(pe){console.error(pe);customerProfiles=[]}else customerProfiles=p||[];
    if(ee){console.warn('Experience requests indisponÃ­vel:',ee.message);experienceRequests=[]}else experienceRequests=e||[];
    loyaltyAccounts=Array.isArray(la)?la:[];loyaltyRewards=Array.isArray(lr)?lr:[];customerBenefits=Array.isArray(cb)?cb:[];

    // Garante que clientes vindos somente de agendamentos tambÃ©m tenham perfil no CRM.
    // v29.198.0 â€” caso MaurÃ­cio Amorin (17/09/2026): desde a v29.98.0 este passo era um upsert
    // feito pelo navegador com on_conflict=phone_key, e o Ã­ndice Ãºnico de phone_key Ã© PARCIAL
    // (where phone_key is not null) â€” o Postgres recusava a inferÃªncia (42P10) e o erro morria
    // no console. 17 clientes novos de site/JuIA ficaram 19 dias sem ficha, e o "Como foi feito"
    // do Concluir falhava com "cadastro nÃ£o encontrado". Agora Ã© SQL no servidor
    // (admin_sync_customer_profiles, migration 158) com `on conflict do nothing`, sem inferÃªncia.
    if(!pe && allBookings.length){
      const {data:synced,error:syncError}=await sb.rpc('admin_sync_customer_profiles');
      if(syncError)console.error('Falha ao sincronizar clientes do CRM:',syncError);
      else if(Number(synced?.created||0)>0){
        const {data:refreshed,error:refreshError}=await sb.from('customer_profiles').select('*').order('name',{ascending:true});
        if(!refreshError)customerProfiles=refreshed||[];
      }
    }
    customers=aggregateCustomers(allBookings,customerProfiles)
  }
  // v29.152.0 â€” caso Helder (08/09/2026): a lista de clientes era agrupada pelos DÃGITOS
  // EXATOS do telefone. O cadastro dele tem 11974845870; os dois Ãºltimos agendamentos, feitos
  // pela JuIA, gravaram 5511974845870. Resultado: DOIS "Helder" na busca do Novo agendamento e
  // no CRM, um deles sem ficha (id nulo) â€” nÃ£o era cadastro duplicado no banco (lÃ¡ o Ã­ndice
  // Ãºnico por phone_key jÃ¡ impedia), era o painel tratando o mesmo nÃºmero como dois. Agora
  // agrupa por phoneKey (DDD + 8 Ãºltimos, a mesma regra de phone_match_key do banco). O campo
  // `phone` de cada cliente continua sendo os dÃ­gitos gravados (da ficha, quando existe), e Ã©
  // Ãºnico por cliente â€” Ã© por ele que a busca e a mesclagem identificam quem foi clicado.
  function aggregateCustomers(rows,profiles){const profileByPhone=new Map(profiles.map(p=>[phoneKey(p.phone),p]));const map=new Map();profiles.filter(p=>!p.archived).forEach(p=>map.set(phoneKey(p.phone),{id:p.id,phone:phoneDigits(p.phone),name:p.name,email:p.email||'',notes:p.notes||'',birthDate:p.birth_date||null,preferredServices:p.preferred_services||[],stylePreferences:p.style_preferences||{},favoriteProducts:p.favorite_products||[],internalTags:p.internal_tags||[],vip:Boolean(p.vip),preferredPayment:p.preferred_payment||'',returnIntervalDays:p.return_interval_days||null,visits:0,completed:0,noShows:0,total:0,lastDate:null,lastServices:'',history:[]}));rows.forEach(x=>{const ph=phoneKey(x.customer_phone);if(!ph)return;const profile=profileByPhone.get(ph);if(profile?.archived)return;if(!map.has(ph))map.set(ph,{id:profile?.id||null,phone:phoneDigits(x.customer_phone),name:profile?.name||x.customer_name,email:profile?.email||x.customer_email||'',notes:profile?.notes||'',birthDate:profile?.birth_date||null,preferredServices:profile?.preferred_services||[],stylePreferences:profile?.style_preferences||{},favoriteProducts:profile?.favorite_products||[],internalTags:profile?.internal_tags||[],vip:Boolean(profile?.vip),preferredPayment:profile?.preferred_payment||'',returnIntervalDays:profile?.return_interval_days||null,visits:0,completed:0,noShows:0,total:0,lastDate:x.booking_date,lastServices:x.service_name,history:[]});const c=map.get(ph);c.history.push(x);c.visits++;if(x.status==='completed'){c.completed++;c.total+=Number(x.service_price||0)+Number(x.products_price||0)}if(x.status==='no_show')c.noShows++;if(!c.lastDate||x.booking_date>c.lastDate){c.lastDate=x.booking_date;c.lastServices=x.service_name;if(!profile)c.name=x.customer_name;if(!c.email)c.email=x.customer_email||''}});const expByCustomer=new Map();experienceRequests.forEach(e=>{if(!e.customer_id)return;const arr=expByCustomer.get(e.customer_id)||[];arr.push(e);expByCustomer.set(e.customer_id,arr)});for(const c of map.values()){const ex=expByCustomer.get(c.id)||[];c.feedbacks=ex.filter(x=>x.status==='feedback').length;c.reviewClicks=ex.filter(x=>x.status==='review_clicked').length;c.lastFeedback=ex.find(x=>x.status==='feedback'&&x.feedback)?.feedback||'';c.avgTicket=c.completed?c.total/c.completed:0;c.daysInactive=c.lastDate?Math.max(0,Math.floor((new Date()-new Date(c.lastDate+'T12:00:00'))/86400000)):null;const base=Math.min(45,c.completed*7)+Math.min(25,c.total/40)+(c.reviewClicks?10:0)+Math.max(0,20-(c.noShows*8));c.juScore=Math.max(0,Math.min(100,Math.round(base)));c.level=c.juScore>=85?'Platinum':c.juScore>=70?'Gold':c.juScore>=50?'Silver':'Bronze'}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))}

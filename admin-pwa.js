(()=>{
  const ua=navigator.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let deferredInstallPrompt=null;

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=28.16.1',{updateViaCache:'none'}).catch(()=>{}));
    let bdjSwReloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(bdjSwReloaded) return;
      bdjSwReloaded=true;
      window.location.reload();
    });
  }

  // Navegação inferior compacta para iPhone e Android.
  const app=document.getElementById('admin-app');
  if(app){
    const current=document.body.dataset.adminPage||'dashboard';
    // v29.176.0 — fase 4 da reforma (pedido do Juliano, 11/09/2026): a barra tinha 7 atalhos fixos e
    // Balcão, Financeiro, Equipe, Espera, Vales… não existiam no celular. Agora são 5 atalhos do dia
    // + "Mais", que abre uma folha com TODOS os destinos, nos mesmos 4 grupos do menu (vem da casca,
    // window.BDJ_SHELL.groups — uma lista só pra desktop e celular).
    const items=[
      ['dashboard','admin.html','⌂','Hoje'],
      ['agenda','admin-agenda.html','▦','Agenda'],
      ['agendamento','admin-agendamento.html','＋','Agendar'],
      ['clientes','admin-clientes.html','👥','Clientes'],
      ['balcao','admin-balcao.html','🚶','Balcão']
    ];
    const nav=document.createElement('nav');
    nav.className='admin-mobile-nav is-six';
    nav.setAttribute('aria-label','Navegação do painel');
    nav.innerHTML=items.map(([key,url,icon,label])=>`<a href="${url}?app=1" class="${current===key?'is-active':''}"><span>${icon}</span><small>${label}</small></a>`).join('')+`<a href="#" data-more-open class="${items.some(i=>i[0]===current)?'':'is-active'}"><span>☰</span><small>Mais</small></a>`;
    document.body.appendChild(nav);
    const groups=(window.BDJ_SHELL&&window.BDJ_SHELL.groups)||[];
    const sheet=document.createElement('div');
    sheet.className='admin-more-sheet';sheet.hidden=true;
    sheet.innerHTML=`<div class="admin-more-backdrop" data-more-close></div><section class="admin-more-card" role="dialog" aria-modal="true" aria-label="Todas as telas do painel"><header><strong>Todas as telas</strong><button type="button" data-more-close aria-label="Fechar">×</button></header>${groups.map(([label,list])=>`<small>${label}</small><div class="admin-more-grid">${list.map(([key,url,icon,text])=>`<a href="${url}?app=1" class="${current===key?'is-active':''}"><span>${icon}</span><b>${text}</b></a>`).join('')}</div>`).join('')}</section>`;
    document.body.appendChild(sheet);
    const openMore=e=>{e.preventDefault();sheet.hidden=false;document.body.classList.add('admin-more-open')};
    const closeMore=()=>{sheet.hidden=true;document.body.classList.remove('admin-more-open')};
    nav.querySelector('[data-more-open]').addEventListener('click',openMore);
    sheet.querySelectorAll('[data-more-close]').forEach(b=>b.addEventListener('click',closeMore));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)closeMore()});
  }

  function dismissKey(){sessionStorage.setItem('juAdminInstallDismissed','1')}
  function showInstallTip(type){
    if(standalone||sessionStorage.getItem('juAdminInstallDismissed')||document.querySelector('.admin-install-tip')) return;
    const box=document.createElement('div');
    box.className='admin-install-tip';
    const android=type==='android';
    box.innerHTML=`<button type="button" class="admin-install-close" aria-label="Fechar">×</button><img src="assets/icon-192.png" alt=""><div><strong>Instale o Barbearia Admin</strong><span>${android?'Use como aplicativo no celular da barbearia e abra o WhatsApp Business direto pelo painel.':'Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.'}</span>${android?'<button type="button" class="admin-install-action">Instalar aplicativo</button>':''}</div>`;
    box.querySelector('.admin-install-close').onclick=()=>{dismissKey();box.remove()};
    const action=box.querySelector('.admin-install-action');
    if(action){
      action.onclick=async()=>{
        if(!deferredInstallPrompt){box.querySelector('span').textContent='No Chrome, abra o menu ⋮ e toque em “Instalar app” ou “Adicionar à tela inicial”.';return;}
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(()=>null);
        deferredInstallPrompt=null;
        box.remove();
      };
    }
    document.body.appendChild(box);
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    if(isAndroid) showInstallTip('android');
  });
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;document.querySelector('.admin-install-tip')?.remove()});

  if(isIOS) showInstallTip('ios');
  else if(isAndroid) setTimeout(()=>showInstallTip('android'),900);
})();

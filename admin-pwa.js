(()=>{
  const ua=navigator.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let deferredInstallPrompt=null;

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=28.0.14',{updateViaCache:'none'}).catch(()=>{}));
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
    const items=[
      ['dashboard','admin.html','⌂','Início'],
      ['agenda','admin-agenda.html','▦','Agenda'],
      ['agendamento','admin-agendamento.html','＋','Agendar'],
      ['clientes','admin-clientes.html','👥','Clientes'],
      ['assistente','admin-assistente.html','✦','JuIA'],
      ['notificacoes','admin-notificacoes.html','🔔','Alertas']
    ];
    const nav=document.createElement('nav');
    nav.className='admin-mobile-nav';
    nav.setAttribute('aria-label','Navegação do painel');
    nav.innerHTML=items.map(([key,url,icon,label])=>`<a href="${url}?app=1" class="${current===key?'is-active':''}"><span>${icon}</span><small>${label}</small></a>`).join('');
    document.body.appendChild(nav);
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

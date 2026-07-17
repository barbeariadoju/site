(()=>{
  const cfg=window.BDJ_AGENDA_CONFIG||{};
  const pushCfg=window.BDJ_PUSH_CONFIG||{};
  const $=id=>document.getElementById(id);
  const sb=(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;

  function b64ToUint8(value){
    const padding='='.repeat((4-value.length%4)%4);
    const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
  }

  function deviceLabel(){
    const ua=navigator.userAgent||'';
    if(/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
    if(/Android/i.test(ua)) return 'Android da barbearia';
    if(/Macintosh/i.test(ua)) return 'Mac';
    if(/Windows/i.test(ua)) return 'Computador Windows';
    return 'Dispositivo';
  }

  function setStatus(message,state='info'){
    const el=$('push-status');
    if(!el)return;
    el.textContent=message;
    el.dataset.state=state;
  }

  function setSupport(){
    const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
    $('push-support').textContent=supported?'Compatível':'Não compatível';
    $('push-support').className=`push-pill ${supported?'is-ok':'is-error'}`;
    $('push-enable').disabled=!supported;
    $('push-disable').disabled=!supported;
    $('push-test').disabled=!supported;
    return supported;
  }

  async function session(){
    const {data}=await sb.auth.getSession();
    return data.session;
  }

  async function currentSubscription(){
    const reg=await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function refresh(){
    if(!setSupport()||!sb)return;
    const permission=Notification.permission;
    $('push-permission').textContent=permission==='granted'?'Permitida':permission==='denied'?'Bloqueada':'Ainda não solicitada';
    $('push-permission').className=`push-pill ${permission==='granted'?'is-ok':permission==='denied'?'is-error':''}`;
    const sub=await currentSubscription().catch(()=>null);
    $('push-device').textContent=sub?'Ativo neste aparelho':'Inativo';
    $('push-device').className=`push-pill ${sub?'is-ok':''}`;
    $('push-enable').hidden=Boolean(sub);
    $('push-disable').hidden=!sub;
    $('push-test').disabled=!sub;
    const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');
    const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
    $('push-ios-note').hidden=!(ios&&!standalone);
  }

  async function saveSubscription(sub){
    const sess=await session();
    if(!sess)throw new Error('Sessão administrativa expirada. Entre novamente.');
    const json=sub.toJSON();
    const payload={
      user_id:sess.user.id,
      endpoint:json.endpoint,
      p256dh:json.keys?.p256dh,
      auth_key:json.keys?.auth,
      device_name:deviceLabel(),
      user_agent:navigator.userAgent||null,
      active:true,
      last_seen_at:new Date().toISOString()
    };
    const {error}=await sb.from('push_subscriptions').upsert(payload,{onConflict:'endpoint'});
    if(error)throw error;
  }

  async function enable(){
    try{
      window.BDJPushSound?.unlock?.();
      setStatus('Solicitando permissão…');
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('A permissão de notificações não foi concedida.');
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub){
        sub=await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:b64ToUint8(pushCfg.vapidPublicKey)
        });
      }
      await saveSubscription(sub);
      setStatus('Notificações ativadas neste aparelho.','success');
      await refresh();
    }catch(error){
      setStatus(error?.message||'Não foi possível ativar as notificações.','error');
    }
  }

  async function disable(){
    try{
      setStatus('Desativando…');
      const sub=await currentSubscription();
      if(sub){
        await sb.from('push_subscriptions').update({active:false,last_seen_at:new Date().toISOString()}).eq('endpoint',sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('Notificações desativadas neste aparelho.','success');
      await refresh();
    }catch(error){
      setStatus(error?.message||'Não foi possível desativar.','error');
    }
  }

  async function testPush(){
    try{
      window.BDJPushSound?.unlock?.();
      setStatus('Enviando notificação de teste…');
      const sess=await session();
      if(!sess)throw new Error('Sessão administrativa expirada.');
      const response=await fetch(`${cfg.supabaseUrl}/functions/v1/${pushCfg.sendPushFunction}`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':cfg.supabaseAnonKey,
          'Authorization':`Bearer ${sess.access_token}`
        },
        body:JSON.stringify({mode:'test'})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Falha ao enviar o teste.');
      setStatus(`Teste enviado para ${data.sent||0} aparelho(s). No computador, o painel também toca uma campainha quando estiver aberto.`,'success');
    }catch(error){
      setStatus(error?.message||'Não foi possível enviar o teste.','error');
    }
  }

  window.addEventListener('load',()=>{
    $('push-enable')?.addEventListener('click',enable);
    $('push-disable')?.addEventListener('click',disable);
    $('push-test')?.addEventListener('click',testPush);
    setTimeout(refresh,500);
  });
})();

(()=>{
  const cfg=window.BDJ_AGENDA_CONFIG||{};
  const pushCfg=window.BDJ_PUSH_CONFIG||{};
  const $=id=>document.getElementById(id);
  const sb=(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase)
    ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey)
    : null;

  function b64ToUint8(value){
    const padding='='.repeat((4-value.length%4)%4);
    const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
  }

  function bytesEqual(a,b){
    if(!a||!b||a.byteLength!==b.byteLength)return false;
    const aa=new Uint8Array(a);
    const bb=new Uint8Array(b);
    for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return false;
    return true;
  }

  function subscriptionUsesCurrentKey(sub){
    const configured=b64ToUint8(pushCfg.vapidPublicKey);
    const current=sub?.options?.applicationServerKey;
    return Boolean(current&&bytesEqual(current,configured));
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

  async function removeDatabaseSubscription(endpoint){
    if(!endpoint||!sb)return;
    await sb.from('push_subscriptions')
      .update({active:false,last_seen_at:new Date().toISOString()})
      .eq('endpoint',endpoint);
  }

  async function replaceOldSubscriptionIfNeeded(){
    const reg=await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();

    if(existing&&!subscriptionUsesCurrentKey(existing)){
      const oldEndpoint=existing.endpoint;
      await existing.unsubscribe().catch(()=>false);
      await removeDatabaseSubscription(oldEndpoint);
      return null;
    }

    return existing;
  }

  async function refresh(){
    if(!setSupport()||!sb)return;
    const permission=Notification.permission;
    $('push-permission').textContent=permission==='granted'?'Permitida':permission==='denied'?'Bloqueada':'Ainda não solicitada';
    $('push-permission').className=`push-pill ${permission==='granted'?'is-ok':permission==='denied'?'is-error':''}`;

    let sub=await currentSubscription().catch(()=>null);
    const stale=Boolean(sub&&!subscriptionUsesCurrentKey(sub));

    $('push-device').textContent=stale?'Precisa reativar':sub?'Ativo neste aparelho':'Inativo';
    $('push-device').className=`push-pill ${sub&&!stale?'is-ok':stale?'is-error':''}`;
    $('push-enable').hidden=Boolean(sub&&!stale);
    $('push-disable').hidden=!sub;
    $('push-test').disabled=!sub||stale;

    if(stale){
      setStatus('A assinatura deste aparelho usa uma chave antiga. Clique em Ativar neste aparelho para renovar.','error');
      $('push-enable').hidden=false;
    }

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
      if(!pushCfg.vapidPublicKey)throw new Error('Chave pública VAPID não carregada.');
      window.BDJPushSound?.unlock?.();
      setStatus('Preparando este aparelho…');

      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('A permissão de notificações não foi concedida.');

      const reg=await navigator.serviceWorker.ready;
      let sub=await replaceOldSubscriptionIfNeeded();

      if(!sub){
        sub=await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:b64ToUint8(pushCfg.vapidPublicKey)
        });
      }

      await saveSubscription(sub);
      setStatus('Notificações ativadas e sincronizadas neste aparelho.','success');
      await refresh();
    }catch(error){
      console.error('[push-enable]',error);
      setStatus(error?.message||'Não foi possível ativar as notificações.','error');
    }
  }

  async function disable(){
    try{
      setStatus('Desativando…');
      const sub=await currentSubscription();
      if(sub){
        await removeDatabaseSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('Notificações desativadas neste aparelho.','success');
      await refresh();
    }catch(error){
      console.error('[push-disable]',error);
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

      const sent=Number(data.sent||0);
      const failed=Number(data.failed||0);

      if(sent>0){
        setStatus(`Teste concluído: ${sent} aparelho(s) recebeu(ram) e ${failed} falhou(aram).`,'success');
      }else{
        setStatus(`Nenhuma notificação foi entregue. Falhas: ${failed}. Consulte os Logs da função send-push.`,'error');
      }
    }catch(error){
      console.error('[push-test]',error);
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

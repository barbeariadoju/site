(() => {
  const root=document.createElement('div'); root.className='admin-toast-region'; root.setAttribute('aria-live','polite'); document.body.appendChild(root);
  function toast(message,type='info',timeout=3200){
    const el=document.createElement('div'); el.className=`admin-toast is-${type}`; el.innerHTML=`<span>${type==='success'?'✓':type==='error'?'!':'•'}</span><p>${String(message)}</p><button aria-label="Fechar">×</button>`;
    root.appendChild(el); requestAnimationFrame(()=>el.classList.add('show'));
    const close=()=>{el.classList.remove('show'); setTimeout(()=>el.remove(),180)}; el.querySelector('button').onclick=close; setTimeout(close,timeout);
  }
  function setBusy(button,busy,label='Processando…'){
    if(!button)return; if(busy){button.dataset.oldText=button.textContent;button.disabled=true;button.classList.add('is-loading');button.textContent=label}else{button.disabled=false;button.classList.remove('is-loading');button.textContent=button.dataset.oldText||button.textContent}
  }
  async function withTimeout(promise,ms=12000,message='A operação demorou mais que o esperado. Tente novamente.'){
    let id; const timer=new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error(message)),ms)}); try{return await Promise.race([promise,timer])}finally{clearTimeout(id)}
  }
  window.BDJ_UX={toast,setBusy,withTimeout};
  window.alert=(message)=>toast(message,/erro|falha|negado|inválid/i.test(String(message))?'error':'info',4200);
  window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast(e.reason?.message||'Não foi possível concluir a operação.','error',5000)});
  window.addEventListener('error',e=>{console.error(e.error||e.message);toast('Ocorreu um erro inesperado. Atualize a página e tente novamente.','error',5000)});
  document.documentElement.classList.add('admin-loading');
  window.addEventListener('load',()=>document.documentElement.classList.remove('admin-loading'));
})();

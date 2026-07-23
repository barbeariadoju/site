(()=>{
  const cfg=window.BDJ_AGENDA_CONFIG||{},$=id=>document.getElementById(id),token=new URLSearchParams(location.search).get('token');
  const sb=(cfg.supabaseUrl&&cfg.supabaseAnonKey)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  const show=id=>document.querySelectorAll('[data-step]').forEach(x=>x.hidden=x.id!==id);
  const message=t=>{$('experience-message').textContent=t||''};
  async function load(){
    if(!sb||!token){show('experience-invalid');return}
    const {data,error}=await sb.rpc('get_experience_context',{p_token:token});
    if(error||!data?.valid){show('experience-invalid');return}
    $('experience-name').textContent=data.first_name?`, ${data.first_name}`:'';
    show(data.status==='feedback'?'experience-thanks-feedback':data.status==='review_clicked'?'experience-thanks-review':'experience-choice');
  }
  async function respond(response,feedback=null){
    message('Salvando sua resposta...');
    const {data,error}=await sb.rpc('submit_experience_response',{p_token:token,p_response:response,p_feedback:feedback});
    if(error||!data?.ok){message(data?.error||error?.message||'Não foi possível enviar.');return false}
    message('');return true;
  }
  $('experience-satisfied')?.addEventListener('click',async()=>{if(await respond('satisfied'))show('experience-review')});
  $('experience-feedback')?.addEventListener('click',()=>show('experience-feedback-form'));
  $('experience-review-feedback-link')?.addEventListener('click',()=>show('experience-feedback-form'));
  $('experience-feedback-send')?.addEventListener('click',async()=>{const text=$('experience-feedback-text').value.trim();if(await respond('feedback',text))show('experience-thanks-feedback')});
  $('experience-review-link')?.addEventListener('click',()=>{respond('review_clicked')});
  load();
})();

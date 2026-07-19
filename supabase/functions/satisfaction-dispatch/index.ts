import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-webhook-secret','Content-Type':'application/json; charset=utf-8'}
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers})
const esc=(v:string)=>v.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c))

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'Método não permitido.'},405)
 const secret=Deno.env.get('EMAIL_WEBHOOK_SECRET')||''
 if(!secret||req.headers.get('x-webhook-secret')!==secret)return json({error:'Não autorizado.'},401)
 const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 const admin=createClient(url,key,{auth:{persistSession:false}})
 const {data:rows,error}=await admin.from('experience_requests').select('*').eq('status','pending').lte('scheduled_for',new Date().toISOString()).lt('attempts',4).order('scheduled_for').limit(30)
 if(error)return json({error:error.message},500)
 let sent=0,failed=0
 for(const r of rows||[]){
  const first=esc(String(r.customer_name||'').trim().split(/\s+/)[0]||'Olá')
  const link=`https://www.barbeariadoju.com.br/experiencia.html?token=${encodeURIComponent(r.token)}`
  const html=`<div style="font-family:Arial,sans-serif;background:#111;padding:28px;color:#eee"><div style="max-width:560px;margin:auto;background:#1b1b1b;border:1px solid #333;border-radius:18px;padding:30px"><h2 style="color:#d8ad56">${first}, como foi sua experiência?</h2><p>Muito obrigado por confiar na Barbearia do Ju.</p><p>Sua opinião é muito importante para que eu continue melhorando cada atendimento.</p><p style="text-align:center;margin:30px 0"><a href="${link}" style="background:#d8ad56;color:#111;text-decoration:none;font-weight:bold;padding:15px 24px;border-radius:999px;display:inline-block">Responder em poucos segundos</a></p><p style="color:#aaa;font-size:13px">Sua resposta pode ser enviada de forma privada.</p></div></div>`
  try{
   const res=await fetch(`${url}/functions/v1/send-email`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':secret},body:JSON.stringify({to:r.customer_email,subject:'Como foi sua experiência na Barbearia do Ju?',html,booking_id:r.booking_id,event_type:'review_request',recipient_type:'customer',recipient_name:r.customer_name})})
   const text=await res.text(); if(!res.ok)throw new Error(text)
   await admin.from('experience_requests').update({status:'sent',sent_at:new Date().toISOString(),attempts:Number(r.attempts||0)+1,last_error:null,updated_at:new Date().toISOString()}).eq('id',r.id);sent++
  }catch(e){failed++;await admin.from('experience_requests').update({attempts:Number(r.attempts||0)+1,last_error:String(e).slice(0,2000),status:Number(r.attempts||0)+1>=4?'failed':'pending',updated_at:new Date().toISOString()}).eq('id',r.id)}
 }
 return json({ok:true,processed:(rows||[]).length,sent,failed})
})

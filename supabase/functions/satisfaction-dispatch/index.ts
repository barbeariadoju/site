import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers})
  if(req.method!=='POST') return json({error:'Método não permitido.'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')?.trim()||''
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()||''
  const emailSecret=Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim()||''
  const provided=req.headers.get('x-webhook-secret')||''
  const auth=req.headers.get('authorization')||''
  if(!supabaseUrl||!serviceRole||!emailSecret) return json({error:'Secrets obrigatórios ausentes.'},500)
  if(provided!==emailSecret && !auth) return json({error:'Não autorizado.'},401)

  const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:rows,error}=await admin
    .from('experience_requests')
    .select('id,token,booking_id,bookings(customer_name,customer_email,booking_date,start_time,service_name)')
    .in('status',['pending','failed'])
    .lte('scheduled_for',new Date().toISOString())
    .limit(50)
  if(error) return json({error:error.message},500)

  let sent=0,failed=0,skipped=0
  for(const row of rows||[]){
    const booking=Array.isArray(row.bookings)?row.bookings[0]:row.bookings
    const email=String(booking?.customer_email||'').trim().toLowerCase()
    if(!email){
      skipped++
      await admin.from('experience_requests').update({status:'expired',last_error:'Cliente sem e-mail.',updated_at:new Date().toISOString()}).eq('id',row.id)
      continue
    }
    const first=String(booking?.customer_name||'Cliente').trim().split(/\s+/)[0]
    const link=`https://www.barbeariadoju.com.br/avaliacao.html?token=${encodeURIComponent(row.token)}`
    const html=`<!doctype html><html><body style="margin:0;background:#0c0c0c;color:#f7f3e8;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px"><table width="100%" style="max-width:620px;background:#171717;border:1px solid #3a321c;border-radius:22px;overflow:hidden"><tr><td style="padding:34px"><p style="color:#d4af37;font-weight:bold;margin:0 0 12px">BARBEARIA DO JU</p><h1 style="font-size:28px;margin:0 0 18px">Como foi sua experiência?</h1><p style="font-size:17px;line-height:1.6;color:#d7d2c6">Olá, ${first}! Muito obrigado por confiar no meu trabalho.</p><p style="font-size:17px;line-height:1.6;color:#d7d2c6">Sua opinião é muito importante para que eu continue melhorando cada atendimento.</p><p style="text-align:center;margin:30px 0"><a href="${link}" style="display:inline-block;background:#d4af37;color:#111;text-decoration:none;font-weight:bold;padding:15px 26px;border-radius:999px">Compartilhar minha experiência</a></p><p style="font-size:13px;color:#8f8a7d">A resposta leva menos de um minuto.</p></td></tr></table></td></tr></table></body></html>`
    try{
      const response=await fetch(`${supabaseUrl}/functions/v1/send-email`,{
        method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':emailSecret},
        body:JSON.stringify({booking_id:row.booking_id,event_type:'experience_request',recipient_type:'customer',recipient_email:email,recipient_name:booking?.customer_name,to:email,subject:'Como foi sua experiência na Barbearia do Ju?',html})
      })
      const result=await response.json().catch(()=>({}))
      if(!response.ok||result?.error) throw new Error(String(result?.error||`Falha ${response.status}`))
      sent++
      await admin.from('experience_requests').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id)
    }catch(err){
      failed++
      await admin.from('experience_requests').update({status:'failed',last_error:String(err).slice(0,2000),updated_at:new Date().toISOString()}).eq('id',row.id)
    }
  }
  return json({ok:true,processed:(rows||[]).length,sent,failed,skipped})
})

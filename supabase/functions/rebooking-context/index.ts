import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'}
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers})
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('')
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'Método não permitido.'},405)
 try{
  const body=await req.json(),code=String(body?.code||'').trim().toUpperCase(),token=String(body?.token||'').trim()
  if(!code||!token)return json({error:'Link de reagendamento inválido.'},400)
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:b,error}=await admin.from('bookings').select('*').eq('booking_code',code).maybeSingle()
  if(error||!b)return json({error:'Agendamento não encontrado.'},404)
  if(!b.rebooking_token_hash||await hash(token)!==b.rebooking_token_hash)return json({error:'Link de reagendamento inválido ou expirado.'},403)
  if(b.rebooking_expires_at&&new Date(b.rebooking_expires_at)<new Date())return json({error:'Este link expirou. Fale com a Barbearia do Ju.'},410)
  if(b.status!=='cancelled')return json({error:'Este agendamento não está disponível para novo horário.'},400)
  if(b.rebooked_to_booking_id)return json({error:'Este reagendamento já foi concluído.',already_rebooked:true},409)
  return json({ok:true,booking:{id:b.id,customer_name:b.customer_name,customer_phone:b.customer_phone,customer_email:b.customer_email,service_name:b.service_name,service_price:Number(b.service_price||0),duration_minutes:Number(b.duration_minutes||0),selected_products:b.selected_products||[],products_price:Number(b.products_price||0),booking_date:b.booking_date,start_time:String(b.start_time||'').slice(0,5),notes:b.notes||''}})
 }catch(e){console.error('[rebooking-context]',e);return json({error:'Não foi possível abrir o reagendamento.'},500)}
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders})
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')
const safe=(b:any)=>({
  code:b.booking_code,name:b.customer_name,services:b.service_name,
  service_price:Number(b.service_price||0),products_price:Number(b.products_price||0),
  selected_products:b.selected_products||[],duration_minutes:Number(b.duration_minutes||0),
  booking_date:b.booking_date,start_time:String(b.start_time||'').slice(0,5),
  end_time:String(b.end_time||'').slice(0,5),status:b.status,
  previous_booking_date:b.previous_booking_date,
  previous_start_time:b.previous_start_time?String(b.previous_start_time).slice(0,5):null
})

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Método não permitido.'},405)
  try{
    const body=await req.json()
    const code=String(body?.code||'').trim().toUpperCase()
    const token=String(body?.token||'').trim()
    const action=String(body?.action||'view')
    if(!code||!token)return json({error:'Link de gerenciamento inválido.'},400)

    const url=Deno.env.get('SUPABASE_URL')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
    const emailSecret=Deno.env.get('EMAIL_WEBHOOK_SECRET')
    const admin=createClient(url,service)
    const {data:booking,error}=await admin.from('bookings').select('*').eq('booking_code',code).maybeSingle()
    if(error||!booking)return json({error:'Agendamento não encontrado.'},404)
    if(!booking.management_token_hash||await hash(token)!==booking.management_token_hash)return json({error:'Link de gerenciamento inválido ou expirado.'},403)

    if(action==='view'){
      await admin.from('booking_customer_actions').insert({booking_id:booking.id,action:'viewed'})
      return json({ok:true,booking:safe(booking)})
    }

    if(action==='cancel'){
      if(!['pending','confirmed'].includes(booking.status))return json({error:'Este agendamento não pode mais ser cancelado.'},400)
      const tokenHash=await hash(token)
      const {data:cancelledRows,error:updateError}=await admin.rpc('customer_cancel_booking_v25',{p_booking_id:booking.id,p_management_token_hash:tokenHash})
      if(updateError)return json({error:updateError.message},400)
      const updated=Array.isArray(cancelledRows)?cancelledRows[0]:cancelledRows
      if(!updated)return json({error:'Não foi possível localizar o agendamento cancelado.'},400)
      if(pushSecret)await fetch(`${url}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'❌ Agendamento cancelado',body:`${booking.customer_name} cancelou ${booking.booking_date.split('-').reverse().join('/')} às ${String(booking.start_time).slice(0,5)}\n${booking.service_name}`,url:'/admin-agenda.html?app=1',tag:`booking-cancelled-${booking.id}`}})}).catch(()=>{})
      if(emailSecret)await fetch(`${url}/functions/v1/booking-email`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':emailSecret},body:JSON.stringify({booking_id:booking.id,event_type:'booking_cancelled',management_token:token})}).catch(error=>console.error('[manage-booking] email cancel',error))
      // Aviso de vaga aberta: cliente cancelou por conta própria — se alguém está na lista
      // de espera esperando esse dia/turno, avisa o dono para oferecer o encaixe.
      if(pushSecret){
        try{
          const {data:waiting}=await admin.rpc('waitlist_matches_for_slot',{p_date:booking.booking_date,p_start_time:booking.start_time})
          if(Array.isArray(waiting)&&waiting.length){
            const names=waiting.slice(0,3).map((w:any)=>w.customer_name).join(', ')
            const extra=waiting.length>3?` +${waiting.length-3}`:''
            await fetch(`${url}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🎉 Vaga aberta — tem gente esperando!',body:`${booking.booking_date.split('-').reverse().join('/')} às ${String(booking.start_time).slice(0,5)} abriu. ${names}${extra} está(ão) na lista de espera para esse dia.`,url:'/admin-espera.html?app=1',tag:`waitlist-slot-${booking.id}`}})}).catch((pushError)=>console.error('[manage-booking] waitlist_push',pushError))
          }
        }catch(waitlistError){console.error('[manage-booking] waitlist_check',waitlistError)}
      }
      return json({ok:true,booking:safe(updated)})
    }

    if(action==='reschedule'){
      const newDate=String(body?.booking_date||'')
      const newTime=String(body?.start_time||'')
      if(!newDate||!newTime)return json({error:'Escolha a nova data e o novo horário.'},400)
      const oldDate=booking.booking_date,oldTime=String(booking.start_time).slice(0,5)
      const {data:updated,error:updateError}=await admin.rpc('customer_reschedule_booking_v25',{p_booking_id:booking.id,p_new_booking_date:newDate,p_new_start_time:newTime})
      if(updateError)return json({error:updateError.message},400)
      if(pushSecret)await fetch(`${url}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🔄 Agendamento reagendado',body:`${booking.customer_name}\nDe ${oldDate.split('-').reverse().join('/')} às ${oldTime} para ${newDate.split('-').reverse().join('/')} às ${newTime.slice(0,5)}`,url:'/admin-agenda.html?app=1',tag:`booking-rescheduled-${booking.id}`}})}).catch(()=>{})
      if(emailSecret)await fetch(`${url}/functions/v1/booking-email`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':emailSecret},body:JSON.stringify({booking_id:booking.id,event_type:'booking_rescheduled',management_token:token})}).catch(error=>console.error('[manage-booking] email reschedule',error))
      return json({ok:true,booking:safe(updated)})
    }

    return json({error:'Ação inválida.'},400)
  }catch(error){
    console.error('[manage-booking]',error)
    return json({error:'Não foi possível processar sua solicitação.'},500)
  }
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, x-webhook-secret','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'}
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers})
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const brl=(v:unknown)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dateBR=(v:string)=>v?.split('-').reverse().join('/')||''
const button=(href:string,label:string)=>`<a href="${esc(href)}" style="display:inline-block;background:#d4af37;color:#111;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:9px;margin:5px">${esc(label)}</a>`
const layout=(title:string,lead:string,details:string,buttons:string)=>`<!doctype html><html><body style="margin:0;background:#f2f2f2;font-family:Arial,sans-serif;color:#222"><table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px"><table width="100%" style="max-width:620px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#10131d;color:#fff;padding:26px;text-align:center"><div style="font-size:28px">💈</div><div style="font-size:20px;font-weight:bold">Barbearia do Ju</div></td></tr><tr><td style="padding:30px"><h1 style="font-size:25px;margin:0 0 12px">${esc(title)}</h1><p style="font-size:16px;line-height:1.6">${esc(lead)}</p>${details}<div style="text-align:center;margin:24px 0">${buttons}</div><p style="color:#666;font-size:13px;line-height:1.5">Rua Dr. Antônio da Cruz, 482 – Centro, Bragança Paulista<br>WhatsApp: (11) 96707-3038<br>www.barbeariadoju.com.br</p></td></tr></table></td></tr></table></body></html>`

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'Método não permitido.'},405)
 const secret=Deno.env.get('EMAIL_WEBHOOK_SECRET')||''
 if(!secret||req.headers.get('x-webhook-secret')!==secret)return json({error:'Não autorizado.'},401)
 try{
  const body=await req.json(); const bookingId=String(body?.booking_id||''); const event=String(body?.event_type||'booking_confirmed'); const token=String(body?.management_token||'')
  if(!bookingId)return json({error:'booking_id ausente.'},400)
  const url=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:b,error}=await admin.from('bookings').select('*').eq('id',bookingId).single(); if(error||!b)return json({error:'Agendamento não encontrado.'},404)
  const manageUrl=token&&b.booking_code?`https://www.barbeariadoju.com.br/meu-agendamento.html?code=${encodeURIComponent(b.booking_code)}&token=${encodeURIComponent(token)}`:''
  const routeUrl='https://www.google.com/maps/search/?api=1&query=Rua%20Dr.%20Ant%C3%B4nio%20da%20Cruz%2C%20482%2C%20Bragan%C3%A7a%20Paulista'
  const details=`<div style="background:#f6f6f6;border-radius:12px;padding:18px;line-height:1.8"><strong>Data:</strong> ${esc(dateBR(b.booking_date))}<br><strong>Horário:</strong> ${esc(String(b.start_time).slice(0,5))}<br><strong>Serviço:</strong> ${esc(b.service_name)}<br><strong>Valor estimado:</strong> ${esc(brl(Number(b.service_price||0)+Number(b.products_price||0)))}</div>`
  let customerTitle='Agendamento confirmado',customerLead=`Olá, ${b.customer_name}! Seu horário foi reservado com sucesso.`,adminSubject='📅 Novo agendamento confirmado'
  if(event==='booking_rescheduled'){customerTitle='Agendamento reagendado';customerLead=`Olá, ${b.customer_name}! A alteração do seu horário foi concluída com sucesso.`;adminSubject='🔄 Agendamento reagendado'}
  if(event==='booking_cancelled'){customerTitle='Agendamento cancelado';customerLead=`Olá, ${b.customer_name}. Seu agendamento foi cancelado conforme solicitado.`;adminSubject='❌ Agendamento cancelado'}
  const customerButtons=(manageUrl?button(manageUrl,'Gerenciar agendamento'):'')+button(routeUrl,'Como chegar')
  const customerHtml=layout(customerTitle,customerLead,details,customerButtons)
  const adminHtml=layout(adminSubject,`${b.customer_name} — ${b.customer_phone}${b.customer_email?` — ${b.customer_email}`:''}`,details,button('https://www.barbeariadoju.com.br/admin-agenda.html?app=1','Abrir agenda'))
  const send=async(payload:any)=>{const r=await fetch(`${url}/functions/v1/send-email`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':secret},body:JSON.stringify(payload)});return {ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))}}
  const results:any[]=[]
  if(b.customer_email)results.push(await send({booking_id:b.id,event_type:event,recipient_type:'customer',recipient_email:b.customer_email,recipient_name:b.customer_name,to:b.customer_email,subject:`${event==='booking_cancelled'?'❌':event==='booking_rescheduled'?'🔄':'✅'} ${customerTitle} | Barbearia do Ju`,html:customerHtml}))
  results.push(await send({booking_id:b.id,event_type:event,recipient_type:'barbershop',recipient_email:'contato@barbeariadoju.com.br',recipient_name:'Barbearia do Ju',to:'contato@barbeariadoju.com.br',subject:adminSubject,html:adminHtml}))
  return json({ok:results.every(r=>r.ok),customer_skipped:!b.customer_email,results})
 }catch(error){console.error('[booking-email]',error);return json({error:error instanceof Error?error.message:'Falha ao preparar e-mails.'},500)}
})

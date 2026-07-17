import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders})
const money=(value:unknown)=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dateLabel=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(new Date(`${iso}T12:00:00-03:00`))

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Método não permitido.'},405)

  const url=Deno.env.get('SUPABASE_URL')!
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublic=Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate=Deno.env.get('VAPID_PRIVATE_KEY')
  const webhookSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
  if(!vapidPublic||!vapidPrivate)return json({error:'VAPID não configurado.'},500)
  webpush.setVapidDetails('mailto:contato@barbeariadoju.com.br',vapidPublic,vapidPrivate)

  const body=await req.json().catch(()=>({}))
  const isWebhook=req.headers.get('x-webhook-secret')===webhookSecret&&Boolean(webhookSecret)
  let isAdmin=false
  if(!isWebhook){
    const authorization=req.headers.get('Authorization')||''
    const client=createClient(url,anon,{global:{headers:{Authorization:authorization}}})
    const {data:{user}}=await client.auth.getUser()
    isAdmin=Boolean(user)
  }
  if(!isWebhook&&!isAdmin)return json({error:'Não autorizado.'},401)

  const admin=createClient(url,service)
  const {data:subs,error}=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('active',true)
  if(error)return json({error:error.message},500)
  if(!subs?.length)return json({ok:true,sent:0,failed:0})

  let payload:any
  if(body.mode==='test'){
    payload={title:'🔔 Teste da Barbearia do Ju',body:'As notificações estão funcionando neste aparelho.',url:'/admin-notificacoes.html?app=1',tag:`push-test-${Date.now()}`}
  }else{
    const record=body.record||body?.payload?.record||{}
    const name=record.customer_name||'Cliente'
    const serviceName=record.service_name||'Atendimento'
    const date=record.booking_date?dateLabel(record.booking_date):''
    const time=String(record.start_time||'').slice(0,5)
    const value=Number(record.service_price||0)+Number(record.products_price||0)
    payload={
      title:'💈 Novo agendamento',
      body:`${name} • ${date} às ${time}\n${serviceName}${value?` • ${money(value)}`:''}`,
      url:'/admin-agenda.html?app=1',
      tag:`booking-${record.id||Date.now()}`
    }
  }

  let sent=0,failed=0
  await Promise.all(subs.map(async(sub:any)=>{
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify(payload),{TTL:120,urgency:'high'})
      sent++
    }catch(err:any){
      failed++
      const status=err?.statusCode||err?.status
      if(status===404||status===410)await admin.from('push_subscriptions').update({active:false}).eq('id',sub.id)
      console.error('[send-push]',status,err?.body||err?.message)
    }
  }))
  return json({ok:true,sent,failed})
})

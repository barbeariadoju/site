// v29.16.0 — Convite de retorno pós-atendimento (ideia do Juliano, 12/08/2026).
// Roda 1x por dia (cron 10h de Brasília) e convida, pelo WhatsApp, quem foi atendido
// ONTEM a já deixar o retorno reservado — sugerindo o mesmo dia da semana e horário,
// 4 semanas depois. Regras combinadas com o Juliano:
//   - manda no DIA SEGUINTE (nunca no mesmo dia: a pesquisa de satisfação e o pedido de
//     avaliação já saem logo depois do atendimento — emendar mais uma mensagem cansaria);
//   - NUNCA manda pra quem já tem agendamento futuro;
//   - UMA mensagem por atendimento concluído, zero insistência (sem resposta em 72h o
//     convite expira em silêncio);
//   - quem recusou explicitamente 2 vezes seguidas entra em pausa de 60 dias;
//   - se o Juliano assumiu a conversa há pouco (human_takeover), não atravessa.
// A resposta do cliente (1/2/3 ou texto) é interpretada pelo whatsapp-webhook.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})

const fetchWithTimeout=async(url:string|URL,init:RequestInit,timeoutMs=15000)=>{
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),timeoutMs)
  try{ return await fetch(url,{...init,signal:controller.signal}) }
  finally{ clearTimeout(timeout) }
}

const canonicalPhone=(value='')=>{
  const digits=String(value).replace(/\D/g,'')
  if((digits.length===12||digits.length===13)&&digits.startsWith('55'))return digits
  if(digits.length===10||digits.length===11)return `55${digits}`
  return ''
}
const formatDateBR=(value:any)=>{
  const iso=String(value||'').slice(0,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return ''
  const [y,m,d]=iso.split('-')
  return `${d}/${m}/${y}`
}
const spDate=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms))
const TEST_PHONE='5599900011234' // Teste Claude — nunca recebe convite real

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers})
  if(req.method!=='POST') return json({error:'Método não permitido.'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')?.trim()||''
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()||''
  const webhookSecret=Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim()||''
  const evolutionApiUrl=Deno.env.get('EVOLUTION_API_URL')?.trim()||''
  const evolutionApiKey=Deno.env.get('EVOLUTION_API_KEY')?.trim()||''
  const evolutionInstance=Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim()||''
  if(!supabaseUrl||!serviceRole||!webhookSecret) return json({error:'Secrets obrigatórios ausentes.'},500)
  if((req.headers.get('x-webhook-secret')||'')!==webhookSecret) return json({error:'Não autorizado.'},401)
  if(!evolutionApiUrl||!evolutionApiKey||!evolutionInstance) return json({error:'Evolution API não configurada.'},500)

  const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const nowIso=new Date().toISOString()

  // Convite sem resposta há mais de 72h expira em silêncio — mantém o histórico limpo pro
  // critério de pausa (expirado NÃO conta como recusa) e impede um "1" perdido de semanas
  // depois criar agendamento fantasma (o webhook só considera convites das últimas 48h).
  await admin.from('return_invites').update({status:'expired',updated_at:nowIso})
    .eq('status','sent').lt('sent_at',new Date(Date.now()-72*3600*1000).toISOString())

  const today=spDate(Date.now())
  const yesterday=spDate(Date.now()-24*3600*1000)

  const {data:completedRows,error:completedError}=await admin.from('bookings')
    .select('id,customer_name,customer_phone,booking_date,start_time,service_name,service_price,duration_minutes')
    .eq('status','completed').eq('booking_date',yesterday)
  if(completedError) return json({error:completedError.message},500)

  const {data:futureRows}=await admin.from('bookings')
    .select('customer_phone').gte('booking_date',today).in('status',['pending','confirmed'])
  const futurePhones=new Set((futureRows||[]).map((b:any)=>canonicalPhone(b.customer_phone)).filter(Boolean))

  // 1 convite por telefone por dia — se a pessoa teve 2 atendimentos ontem (ex.: pai e
  // filho no mesmo número), fica o mais tarde do dia.
  const byPhone=new Map<string,any>()
  for(const b of completedRows||[]){
    const phone=canonicalPhone(String(b.customer_phone||''))
    if(phone.length<12||phone===TEST_PHONE)continue
    const prev=byPhone.get(phone)
    if(!prev||String(b.start_time)>String(prev.start_time))byPhone.set(phone,b)
  }

  let sent=0,skipped=0,failed=0
  for(const [phone,b] of byPhone){
    const {data:existing}=await admin.from('return_invites').select('id').eq('booking_id',b.id).maybeSingle()
    if(existing){skipped++;continue} // idempotente: re-rodar o cron não duplica

    const skip=async(reason:string)=>{
      await admin.from('return_invites').insert({booking_id:b.id,phone,customer_name:b.customer_name,service_name:b.service_name,service_price:b.service_price,duration_minutes:b.duration_minutes,status:'skipped',skip_reason:reason})
      skipped++
    }

    if(futurePhones.has(phone)){await skip('ja_tem_agendamento_futuro');continue}

    const {data:lastInvites}=await admin.from('return_invites').select('status,sent_at')
      .eq('phone',phone).neq('status','skipped').order('sent_at',{ascending:false}).limit(2)
    const twoDeclines=(lastInvites||[]).length===2&&(lastInvites||[]).every((i:any)=>i.status==='declined')
    if(twoDeclines&&lastInvites![0].sent_at&&new Date(lastInvites![0].sent_at).getTime()>Date.now()-60*24*3600*1000){
      await skip('recusou_2_vezes_seguidas');continue
    }

    const {data:conv}=await admin.from('whatsapp_conversations').select('human_takeover,human_takeover_at').eq('phone',phone).maybeSingle()
    if(conv?.human_takeover&&conv.human_takeover_at&&Date.now()-new Date(conv.human_takeover_at).getTime()<3*3600*1000){
      await skip('conversa_com_humano');continue
    }

    // Sugestão: mesmo dia da semana e horário, 4 semanas depois. Se o dia +28 não tiver
    // agenda (fechado/lotado), tenta até +35 dias; escolhe sempre o horário mais próximo
    // do original. get_available_slots valida bloqueios e dias fechados sozinha.
    const duration=Number(b.duration_minutes)||30
    const targetTime=String(b.start_time).slice(0,5)
    const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
    let suggestedDate='',suggestedTime=''
    for(let d=28;d<=35;d++){
      const iso=new Date(new Date(`${b.booking_date}T12:00:00Z`).getTime()+d*24*3600*1000).toISOString().slice(0,10)
      const {data:slots}=await admin.rpc('get_available_slots',{p_date:iso,p_duration_minutes:duration})
      const list=(slots||[]).map((x:any)=>String(x.slot_time).slice(0,5))
      if(!list.length)continue
      let best=list[0]
      for(const t of list){ if(Math.abs(mins(t)-mins(targetTime))<Math.abs(mins(best)-mins(targetTime)))best=t }
      suggestedDate=iso;suggestedTime=best;break
    }
    if(!suggestedDate){await skip('sem_horario_nas_proximas_semanas');continue}

    const first=String(b.customer_name||'').trim().split(/\s+/)[0]||''
    const weekday=new Date(suggestedDate+'T12:00:00-03:00').toLocaleDateString('pt-BR',{weekday:'long'})
    const waText=`Oi${first?`, ${first}`:''}! 💈 Passando pra agradecer a visita de ontem 🙏 Quer já deixar seu retorno reservado? Tenho ${weekday}, ${formatDateBR(suggestedDate)} às ${suggestedTime} (${b.service_name}) — daqui a 4 semanas.\n*1* — Pode reservar ✅\n*2* — Prefiro outro dia/horário 🔄\n*3* — Agora não, obrigado\nSe preferir decidir depois, tranquilo — é só me chamar por aqui 😊`
    try{
      const sendResponse=await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`,{
        method:'POST',
        headers:{'Content-Type':'application/json',apikey:evolutionApiKey},
        body:JSON.stringify({number:phone,text:waText}),
      })
      if(!sendResponse.ok)throw new Error(`Evolution ${sendResponse.status}`)
      const sendData=await sendResponse.json().catch(()=>({}))
      await admin.from('whatsapp_messages').insert({phone,direction:'out',body:waText,sent_by:'bot',evolution_message_id:String(sendData?.key?.id||'')||null})
      await admin.from('whatsapp_conversations').upsert({phone,human_takeover:false,last_message_at:nowIso,updated_at:nowIso},{onConflict:'phone'})
      await admin.from('return_invites').insert({booking_id:b.id,phone,customer_name:b.customer_name,service_name:b.service_name,service_price:b.service_price,duration_minutes:b.duration_minutes,suggested_date:suggestedDate,suggested_time:suggestedTime,status:'sent',sent_at:nowIso})
      sent++
    }catch(sendError){
      failed++
      console.error('[return-invite-dispatch]',phone,sendError)
    }
  }
  return json({ok:true,processed:byPhone.size,sent,skipped,failed})
})

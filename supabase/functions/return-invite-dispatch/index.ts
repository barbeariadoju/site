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
  // v29.21.0 / v29.26.0 - guarda local de horario (20h-8h). A JANELA COMPLETA de contato
  // (domingo e feriado nunca; sabado ate 15h; demais dias 8h-20h) e aplicada no AGENDADOR,
  // pela migration 110: o cron so chama esta function quando public.juia_quiet_now() e falso.
  // Regra em um lugar so; isto aqui e apenas rede de seguranca para disparo manual.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (quietHour >= 20 || quietHour < 8) return json({ok:true,quiet_hours:true})

  const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const nowIso=new Date().toISOString()

  // Convite sem resposta há mais de 72h expira em silêncio — mantém o histórico limpo pro
  // critério de pausa (expirado NÃO conta como recusa) e impede um "1" perdido de semanas
  // depois criar agendamento fantasma (o webhook só considera convites das últimas 48h).
  await admin.from('return_invites').update({status:'expired',updated_at:nowIso})
    .eq('status','sent').lt('sent_at',new Date(Date.now()-72*3600*1000).toISOString())

  const today=spDate(Date.now())
  // v29.17.0 — caso Robson (13/08/2026): o convite saía com a pesquisa de satisfação de
  // ontem ainda SEM resposta — duas perguntas numéricas pendentes ao mesmo tempo, e o "1"
  // do cliente (que era da pesquisa) virou uma reserva de retorno errada. Regra nova:
  // enquanto a pesquisa daquele telefone estiver pendente (janela de 48h do
  // find_pending_experience_by_phone), o convite ESPERA — sem gravar linha, pra tentar de
  // novo no cron do dia seguinte. Por isso a janela de candidatos vai a 3 dias: no pior
  // caso (pesquisa nunca respondida), ela sai da janela de 48h e o convite sai no 3º dia.
  const candidateDays=[1,2,3].map(d=>spDate(Date.now()-d*24*3600*1000))

  const {data:completedRows,error:completedError}=await admin.from('bookings')
    .select('id,customer_name,customer_phone,booking_date,start_time,service_name,service_price,duration_minutes')
    .eq('status','completed').in('booking_date',candidateDays)
  if(completedError) return json({error:completedError.message},500)

  const {data:futureRows}=await admin.from('bookings')
    .select('customer_phone').gte('booking_date',today).in('status',['pending','confirmed'])
  const futurePhones=new Set((futureRows||[]).map((b:any)=>canonicalPhone(b.customer_phone)).filter(Boolean))

  // 1 convite por telefone por rodada — se a pessoa teve 2 atendimentos na janela (ex.: pai
  // e filho no mesmo número), fica o mais RECENTE (dia + horário, já que agora a janela de
  // candidatos cobre 3 dias).
  const byPhone=new Map<string,any>()
  for(const b of completedRows||[]){
    const phone=canonicalPhone(String(b.customer_phone||''))
    if(phone.length<12||phone===TEST_PHONE)continue
    const prev=byPhone.get(phone)
    if(!prev||`${b.booking_date} ${b.start_time}`>`${prev.booking_date} ${prev.start_time}`)byPhone.set(phone,b)
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

    // v29.17.0 — pesquisa de satisfação pendente: o convite espera (SEM gravar linha em
    // return_invites, pra este mesmo booking ser reconsiderado no cron de amanhã).
    const {data:pendingExpRows}=await admin.rpc('find_pending_experience_by_phone',{p_phone:phone})
    const pendingSurvey=Array.isArray(pendingExpRows)?pendingExpRows[0]:pendingExpRows
    if(pendingSurvey){skipped++;continue}
    // v29.43.0 — fila unica: qualquer outra pergunta numerada pendente (confirmacao de
    // presenca, follow-up de lead) tambem segura o convite ate o cron de amanha.
    {
      const {data:pendente}=await admin.rpc('juia_pending_numeric_question',{p_phone:phone})
      if(pendente){console.log('[return-invite] fila unica: adiado',pendente,phone);skipped++;continue}
    }

    // Sugestão: mesmo dia da semana e horário, 4 semanas depois. Se o dia +28 não tiver
    // agenda (fechado/lotado), tenta até +35 dias; escolhe sempre o horário mais próximo
    // do original. get_available_slots valida bloqueios e dias fechados sozinha.
    const duration=Number(b.duration_minutes)||30
    const targetTime=String(b.start_time).slice(0,5)
    const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
    let suggestedDate='',suggestedTime=''
    // v29.43.0 — cadencia do proprio cliente (caso Luiz Andre, 15/08: faz barba a cada ~9
    // dias e recebeu convite pra 4 semanas depois; respondeu "agora nao"). Mediana dos
    // intervalos das ultimas visitas (>=3 visitas); sem base, segue o padrao de 4 semanas.
    const {data:cadenciaRaw}=await admin.rpc('customer_visit_cadence_days',{p_phone:phone})
    const cadencia=Number(cadenciaRaw)||0
    const alvoDias=!cadencia?28:cadencia<=10?7:cadencia<=17?14:cadencia<=24?21:28
    const semanasLabel=alvoDias===7?'na semana que vem':`daqui a ${alvoDias/7} semanas`
    for(let d=alvoDias;d<=alvoDias+7;d++){
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
    // "de ontem" só quando é verdade — convite adiado pela pesquisa pode sair 2-3 dias depois.
    const visitWord=b.booking_date===candidateDays[0]?'a visita de ontem':'sua visita'
    // v29.56.0 — pedido do Juliano (21/08/2026, caso Rinaldo): o convite NÃO propõe mais data.
    // Cravar "quinta, 17/09 às 17:30 — daqui a 4 semanas" (a) escancara que a agenda está
    // livre lá na frente e (b) decide pelo cliente um intervalo que talvez não seja o dele.
    // Agora são três passos curtos: quer reservar? (1/2) -> pra quando? (1 semana/15/30 dias)
    // -> escolhe entre alguns horários daquele dia. A data sugerida continua sendo calculada
    // aqui (guarda "tem agenda nas próximas semanas" e fica registrada pra relatório), mas
    // NUNCA aparece na mensagem. Ver [[posicionamento-barbearia-do-ju]] e a regra de 20/08.
    const waText=`Oi${first?`, ${first}`:''}! 💈 Passando pra agradecer ${visitWord} 🙏\n\nQuer já deixar seu próximo horário reservado?\n*1* — Quero sim ✅\n*2* — Agora não, obrigado\n\nSe preferir decidir depois, tranquilo — é só me chamar por aqui 😊`
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

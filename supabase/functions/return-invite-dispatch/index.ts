// v29.16.0 — Convite de retorno pós-atendimento (ideia do Juliano, 12/08/2026).
// v29.154.0 — Convite NO TEMPO DO CLIENTE (08/09/2026). Antes saía no dia seguinte ao corte,
// junto com a pesquisa e o pedido de avaliação, pedindo pra reservar "o próximo horário" a quem
// acabou de sair da cadeira: de 112 enviados, 76 ignorados, 13 recusas, 2 aceites. Agora sai
// alguns dias antes do retorno típico — dia 12 pra corte, dia 5 pra barba, ou a cadência do
// próprio cliente menos 4 (regra e números em _shared/convite-retorno.ts).
//
// Roda 1x por dia (cron 10h de Brasília, só dentro da janela de contato) e, pra cada telefone,
// olha o ÚLTIMO atendimento concluído sem convite:
//   - antes do dia-alvo: não faz nada (nem grava linha — volta a olhar amanhã);
//   - no dia-alvo ou até 3 dias depois: manda, se nada segurar (pesquisa/pergunta pendente e
//     conversa com o Juliano seguram até o dia seguinte, dentro da janela);
//   - passou da janela: grava 'skipped' (janela_perdida) e não manda mais — atrasado é insistência.
// Regras mantidas: NUNCA pra quem já tem agendamento futuro; UMA mensagem por atendimento; sem
// resposta em 72h expira em silêncio; 2 recusas seguidas = pausa de 60 dias; venda só de produto
// não recebe convite. A resposta (1/2 ou texto) é interpretada pelo whatsapp-webhook.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { alvoDias, decisaoEnvio, diasEntre, mensagemConvite, retornoTipicoDias, somarDiasIso, JANELA_DIAS } from '../_shared/convite-retorno.ts'

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
const spDate=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms))
const TEST_PHONE='5599900011234' // Teste Claude — nunca recebe convite real

// Quantos dias pra trás o cron olha atendimentos sem convite. Cobre o maior alvo plausível
// (cadência de 30 dias → alvo 26 + janela 3) com folga; mais velho que isso já perdeu a janela
// de qualquer jeito e é marcado como tal na primeira passada.
const LOOKBACK_DIAS=45

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

  const {data:futureRows}=await admin.from('bookings')
    .select('customer_phone').gte('booking_date',today).in('status',['pending','confirmed'])
  const futurePhones=new Set((futureRows||[]).map((b:any)=>canonicalPhone(b.customer_phone)).filter(Boolean))

  const sendText=async(phone:string,waText:string)=>{
    const sendResponse=await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:evolutionApiKey},
      body:JSON.stringify({number:phone,text:semEmoji(waText)}),
    })
    if(!sendResponse.ok)throw new Error(`Evolution ${sendResponse.status}`)
    const sendData=await sendResponse.json().catch(()=>({}))
    await admin.from('whatsapp_messages').insert({phone,direction:'out',body:waText,sent_by:'bot',evolution_message_id:String(sendData?.key?.id||'')||null})
    await admin.from('whatsapp_conversations').upsert({phone,human_takeover:false,last_message_at:nowIso,updated_at:nowIso},{onConflict:'phone'})
  }

  const humanoNaConversa=async(phone:string)=>{
    const {data:conv}=await admin.from('whatsapp_conversations').select('human_takeover,human_takeover_at').eq('phone',phone).maybeSingle()
    return !!(conv?.human_takeover&&conv.human_takeover_at&&Date.now()-new Date(conv.human_takeover_at).getTime()<3*3600*1000)
  }

  // v29.149.0 — lembrete combinado (caso Pedro, 08/09/2026: "me chama daqui 14 dias"). O
  // webhook deixou o convite em 'deferred' com remind_at; chegou o dia, mandamos UMA mensagem
  // e o convite volta a 'sent' — daí o webhook trata 1/2 como sempre. Quem marcou por conta
  // própria nesse meio-tempo não recebe nada (expired). Conversa com o Juliano ou outra
  // pergunta numerada pendente: fica pro cron de amanhã (remind_at continua no passado).
  let sent=0,skipped=0,failed=0,reminded=0,waiting=0
  {
    const {data:deferredRows}=await admin.from('return_invites').select('*').eq('status','deferred').lte('remind_at',today).order('remind_at',{ascending:true}).limit(50)
    for(const r of deferredRows||[]){
      const phone=canonicalPhone(String(r.phone||''))
      if(phone.length<12||phone===TEST_PHONE)continue
      if(futurePhones.has(phone)){
        await admin.from('return_invites').update({status:'expired',skip_reason:'marcou_antes_do_lembrete',updated_at:nowIso}).eq('id',r.id)
        continue
      }
      if(await humanoNaConversa(phone)){skipped++;continue}
      const {data:pendente}=await admin.rpc('juia_pending_numeric_question',{p_phone:phone})
      if(pendente){console.log('[return-invite] lembrete adiado pela fila unica',pendente,phone);skipped++;continue}
      const first=String(r.customer_name||'').trim().split(/\s+/)[0]||''
      // "próximo horário reservado" e "quero sim" ficam de propósito: são as âncoras que o
      // webhook usa pra reconhecer um "1" tardio como resposta ao convite.
      const waText=`Oi${first?`, ${first}`:''}! Passando como você pediu, pra ver se já quer deixar seu próximo horário reservado.\n*1* — Quero sim\n*2* — Agora não, obrigado\n\nSe preferir outro momento, é só me dizer.`
      try{
        await sendText(phone,waText)
        await admin.from('return_invites').update({status:'sent',sent_at:nowIso,reminded_at:nowIso,responded_at:null,updated_at:nowIso}).eq('id',r.id)
        reminded++
      }catch(sendError){
        failed++
        console.error('[return-invite-dispatch] lembrete',phone,sendError)
      }
    }
  }

  // Candidatos: atendimentos concluídos dos últimos LOOKBACK_DIAS dias. Por telefone, só o mais
  // RECENTE conta — se a pessoa já voltou, o atendimento anterior não precisa de convite (e o
  // novo entra na régua com a própria data). Atendimentos que já têm linha em return_invites
  // (enviado, pulado, expirado…) ficam de fora: uma decisão por atendimento, nunca duas.
  const desde=somarDiasIso(today,-LOOKBACK_DIAS)
  const {data:completedRows,error:completedError}=await admin.from('bookings')
    .select('id,customer_name,customer_phone,booking_date,start_time,service_name,service_price,duration_minutes')
    .eq('status','completed').gte('booking_date',desde).lte('booking_date',today)
  if(completedError) return json({error:completedError.message},500)

  const byPhone=new Map<string,any>()
  for(const b of completedRows||[]){
    const phone=canonicalPhone(String(b.customer_phone||''))
    if(phone.length<12||phone===TEST_PHONE)continue
    const prev=byPhone.get(phone)
    if(!prev||`${b.booking_date} ${b.start_time}`>`${prev.booking_date} ${prev.start_time}`)byPhone.set(phone,b)
  }

  const ids=[...byPhone.values()].map((b:any)=>b.id)
  const jaDecididos=new Set<string>()
  for(let i=0;i<ids.length;i+=200){
    const {data:rows}=await admin.from('return_invites').select('booking_id').in('booking_id',ids.slice(i,i+200))
    for(const r of rows||[])jaDecididos.add(String(r.booking_id))
  }

  for(const [phone,b] of byPhone){
    if(jaDecididos.has(String(b.id))){skipped++;continue} // idempotente: re-rodar o cron não duplica

    const diasDesde=diasEntre(b.booking_date,today)
    const skip=async(reason:string,alvo:number|null)=>{
      await admin.from('return_invites').insert({booking_id:b.id,phone,customer_name:b.customer_name,service_name:b.service_name,service_price:b.service_price,duration_minutes:b.duration_minutes,status:'skipped',skip_reason:reason,target_days:alvo,days_since:diasDesde})
      skipped++
    }

    // v29.80.0 — venda só de produto no balcão (serviço R$0) não é atendimento na cadeira:
    // convidar pra "reservar o próximo horário" não faz sentido aqui. Decide na hora.
    if(Number(b.service_price||0)<=0){await skip('venda_so_produto',null);continue}

    // v29.43.0 — cadência do próprio cliente (caso Luiz André, 15/08: faz barba a cada ~9 dias
    // e recebeu convite pra 4 semanas depois). Mediana dos intervalos das últimas visitas.
    const {data:cadenciaRaw}=await admin.rpc('customer_visit_cadence_days',{p_phone:phone})
    const cadencia=Number(cadenciaRaw)||0
    const alvo=alvoDias(cadencia,String(b.service_name||''))
    const decisao=decisaoEnvio(diasDesde,alvo)

    if(decisao==='esperar'){waiting++;continue} // sem linha: volta a olhar amanhã
    if(decisao==='perdeu'){await skip('janela_perdida',alvo);continue}

    // Daqui pra baixo: dentro da janela de envio (alvo … alvo + JANELA_DIAS).
    if(futurePhones.has(phone)){await skip('ja_tem_agendamento_futuro',alvo);continue}

    const {data:lastInvites}=await admin.from('return_invites').select('status,sent_at')
      .eq('phone',phone).neq('status','skipped').order('sent_at',{ascending:false}).limit(2)
    const twoDeclines=(lastInvites||[]).length===2&&(lastInvites||[]).every((i:any)=>i.status==='declined')
    if(twoDeclines&&lastInvites![0].sent_at&&new Date(lastInvites![0].sent_at).getTime()>Date.now()-60*24*3600*1000){
      await skip('recusou_2_vezes_seguidas',alvo);continue
    }

    // Conversa com o Juliano agora, ou pergunta numerada pendente (pesquisa, confirmação,
    // follow-up): o convite ESPERA, sem gravar linha — o cron de amanhã tenta de novo, ainda
    // dentro da janela. Se a janela fechar nesse meio-tempo, vira janela_perdida.
    if(await humanoNaConversa(phone)){waiting++;continue}
    {
      const {data:pendente}=await admin.rpc('juia_pending_numeric_question',{p_phone:phone})
      if(pendente){console.log('[return-invite] fila unica: adiado',pendente,phone);waiting++;continue}
    }

    // Data sugerida: só pra relatório e pra garantir que existe agenda perto do retorno típico
    // (nunca aparece na mensagem — regra de 21/08, caso Rinaldo). Procura a partir de amanhã ou
    // do retorno típico, o que vier depois, por até 14 dias; horário mais próximo do original.
    const duration=Number(b.duration_minutes)||30
    const targetTime=String(b.start_time).slice(0,5)
    const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
    let suggestedDate='',suggestedTime=''
    const retornoIso=somarDiasIso(b.booking_date,retornoTipicoDias(cadencia,String(b.service_name||'')))
    const amanha=somarDiasIso(today,1)
    const inicio=retornoIso>amanha?retornoIso:amanha
    for(let d=0;d<=14;d++){
      const iso=somarDiasIso(inicio,d)
      const {data:slots}=await admin.rpc('get_available_slots',{p_date:iso,p_duration_minutes:duration})
      const list=(slots||[]).map((x:any)=>String(x.slot_time).slice(0,5))
      if(!list.length)continue
      let best=list[0]
      for(const t of list){ if(Math.abs(mins(t)-mins(targetTime))<Math.abs(mins(best)-mins(targetTime)))best=t }
      suggestedDate=iso;suggestedTime=best;break
    }
    if(!suggestedDate){await skip('sem_horario_nas_proximas_semanas',alvo);continue}

    const first=String(b.customer_name||'').trim().split(/\s+/)[0]||''
    const waText=mensagemConvite(first,diasDesde,String(b.service_name||''))
    try{
      await sendText(phone,waText)
      await admin.from('return_invites').insert({booking_id:b.id,phone,customer_name:b.customer_name,service_name:b.service_name,service_price:b.service_price,duration_minutes:b.duration_minutes,suggested_date:suggestedDate,suggested_time:suggestedTime,status:'sent',sent_at:nowIso,target_days:alvo,days_since:diasDesde})
      sent++
    }catch(sendError){
      failed++
      console.error('[return-invite-dispatch]',phone,sendError)
    }
  }
  return json({ok:true,processed:byPhone.size,sent,reminded,waiting,skipped,failed,janela_dias:JANELA_DIAS})
})

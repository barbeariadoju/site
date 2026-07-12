import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {...corsHeaders, 'Content-Type':'application/json; charset=utf-8'},
})

const phone = (value='') => String(value).replace(/\D/g,'')
const todayISO = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const addDays = (iso:string, amount:number) => { const d=new Date(iso+'T12:00:00-03:00'); d.setDate(d.getDate()+amount); return d.toISOString().slice(0,10) }
const daysBetween = (a:string,b:string) => Math.floor((new Date(b+'T12:00:00-03:00').getTime()-new Date(a+'T12:00:00-03:00').getTime())/86400000)

function outputText(data:any) {
  if (typeof data?.output_text === 'string') return data.output_text.trim()
  const texts:string[]=[]
  for (const item of data?.output || []) for (const content of item?.content || []) if (content?.type==='output_text' && content?.text) texts.push(content.text)
  return texts.join('\n').trim()
}

function birthdayDistance(date:string|null, today:string) {
  if (!date) return null
  const [,m,d]=date.split('-').map(Number)
  const [y]=today.split('-').map(Number)
  let next=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  if (next < today) next=`${y+1}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  return daysBetween(today,next)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders})
  if (req.method !== 'POST') return json({error:'Método não permitido.'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')!
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader=req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({error:'Sessão ausente.'},401)

  const authClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}})
  const {data:{user},error:userError}=await authClient.auth.getUser()
  if (userError || !user) return json({error:'Sessão inválida.'},401)

  const body=await req.json().catch(()=>({}))
  const openaiKey=Deno.env.get('OPENAI_API_KEY')
  if (body.mode==='ping') return json({ok:true,openai_enabled:Boolean(openaiKey)})

  const question=String(body.question||'').trim().slice(0,700)
  if (!question) return json({error:'Pergunta vazia.'},400)

  const admin=createClient(supabaseUrl,serviceKey)
  const today=todayISO(), from=addDays(today,-120), to=addDays(today,45)
  const [{data:bookings,error:bError},{data:customers,error:cError}]=await Promise.all([
    admin.from('bookings').select('id,customer_name,customer_phone,customer_email,service_name,service_price,products_price,selected_products,duration_minutes,booking_date,start_time,status,notes,created_at').gte('booking_date',from).lte('booking_date',to).order('booking_date').order('start_time'),
    admin.from('customer_profiles').select('id,name,phone,email,birth_date,notes,created_at').eq('archived',false).order('name')
  ])
  if (bError || cError) return json({error:bError?.message || cError?.message},500)

  const rows=bookings || [], profiles=customers || []
  const active=rows.filter((x:any)=>['pending','confirmed'].includes(x.status))
  const todayRows=active.filter((x:any)=>x.booking_date===today)
  const completed=rows.filter((x:any)=>x.status==='completed')
  const noShows=rows.filter((x:any)=>x.status==='no_show')
  const lastVisit=new Map<string,any>()
  completed.forEach((x:any)=>{const p=phone(x.customer_phone);const old=lastVisit.get(p);if(p&&(!old||x.booking_date>old.booking_date))lastVisit.set(p,x)})
  const inactive=profiles.map((c:any)=>{const last=lastVisit.get(phone(c.phone));return {name:c.name,phone:c.phone,last_visit:last?.booking_date||null,days_away:last?daysBetween(last.booking_date,today):null,last_services:last?.service_name||null}}).filter((c:any)=>c.days_away!==null&&c.days_away>30).sort((a:any,b:any)=>b.days_away-a.days_away).slice(0,30)
  const birthdays=profiles.map((c:any)=>({name:c.name,phone:c.phone,birth_date:c.birth_date,days:birthdayDistance(c.birth_date,today)})).filter((c:any)=>c.days!==null&&c.days<=30).sort((a:any,b:any)=>a.days-b.days).slice(0,20)
  const noShowMap=new Map<string,{name:string,count:number}>()
  noShows.forEach((x:any)=>{const p=phone(x.customer_phone);const old=noShowMap.get(p)||{name:x.customer_name,count:0};old.count++;noShowMap.set(p,old)})
  const repeatNoShows=[...noShowMap.values()].filter(x=>x.count>=2).sort((a,b)=>b.count-a.count).slice(0,15)
  const revenue30=completed.filter((x:any)=>x.booking_date>=addDays(today,-30)).reduce((a:number,x:any)=>a+Number(x.service_price||0)+Number(x.products_price||0),0)
  const completed30=completed.filter((x:any)=>x.booking_date>=addDays(today,-30))
  const snapshot={
    date:today,
    today:{appointments:todayRows.length,pending:todayRows.filter((x:any)=>x.status==='pending').length,confirmed:todayRows.filter((x:any)=>x.status==='confirmed').length,forecast:todayRows.reduce((a:number,x:any)=>a+Number(x.service_price||0)+Number(x.products_price||0),0),schedule:todayRows.map((x:any)=>({time:String(x.start_time).slice(0,5),name:x.customer_name,services:x.service_name,status:x.status,value:Number(x.service_price||0)+Number(x.products_price||0)}))},
    last_30_days:{completed:completed30.length,revenue:revenue30,average_ticket:completed30.length?revenue30/completed30.length:0,no_shows:noShows.filter((x:any)=>x.booking_date>=addDays(today,-30)).length},
    customers:{total:profiles.length,inactive_over_30_days:inactive,birthdays_next_30_days:birthdays,repeat_no_shows:repeatNoShows},
    upcoming:active.filter((x:any)=>x.booking_date>=today).slice(0,35).map((x:any)=>({date:x.booking_date,time:String(x.start_time).slice(0,5),name:x.customer_name,services:x.service_name,status:x.status,value:Number(x.service_price||0)+Number(x.products_price||0)}))
  }

  let answer=''
  if (openaiKey) {
    const instructions=`Você é JuIA, assistente interna de gestão da Barbearia do Ju, em Bragança Paulista. Responda em português do Brasil, de forma objetiva, clara e prática. Use somente os dados fornecidos. Não invente números. Quando houver nomes de clientes, seja discreta. Sugira no máximo 3 ações prioritárias. Valores em reais. Juliano trabalha sozinho e a meta diária atual é R$ 380. Não diga que enviou mensagens ou executou ações; apenas proponha ações.`
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${openaiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-5.6-luna',reasoning:{effort:'low'},max_output_tokens:650,instructions,input:`Pergunta do Juliano: ${question}\n\nDados atuais do sistema:\n${JSON.stringify(snapshot)}`})
    })
    const data=await response.json()
    if (!response.ok) return json({error:data?.error?.message || 'Erro na API de IA.'},502)
    answer=outputText(data)
  } else {
    const q=question.toLowerCase()
    if (q.includes('hoje') || q.includes('dia')) answer=`Hoje há ${snapshot.today.appointments} agendamento(s), ${snapshot.today.pending} pendente(s) e receita prevista de R$ ${snapshot.today.forecast.toFixed(2).replace('.',',')}. ${snapshot.today.schedule.slice(0,6).map((x:any)=>`${x.time} ${x.name}`).join(' • ') || 'Nenhum atendimento ativo.'}`
    else if (q.includes('30 dias') || q.includes('mês') || q.includes('mes')) answer=`Nos últimos 30 dias foram ${snapshot.last_30_days.completed} atendimentos concluídos, faturamento registrado de R$ ${snapshot.last_30_days.revenue.toFixed(2).replace('.',',')} e ticket médio de R$ ${snapshot.last_30_days.average_ticket.toFixed(2).replace('.',',')}. Houve ${snapshot.last_30_days.no_shows} ausência(s).`
    else if (q.includes('anivers')) answer=snapshot.customers.birthdays_next_30_days.length?`Próximos aniversariantes: ${snapshot.customers.birthdays_next_30_days.slice(0,8).map((x:any)=>`${x.name} (${x.days===0?'hoje':`em ${x.days} dias`})`).join(', ')}.`:'Não há aniversários cadastrados nos próximos 30 dias.'
    else if (q.includes('ausên') || q.includes('falta')) answer=snapshot.customers.repeat_no_shows.length?`Clientes com ausências repetidas: ${snapshot.customers.repeat_no_shows.map((x:any)=>`${x.name} (${x.count})`).join(', ')}.`:'Não encontrei clientes com duas ou mais ausências no período analisado.'
    else answer=snapshot.customers.inactive_over_30_days.length?`Há ${snapshot.customers.inactive_over_30_days.length} clientes há mais de 30 dias sem voltar. Prioridades: ${snapshot.customers.inactive_over_30_days.slice(0,8).map((x:any)=>`${x.name} (${x.days_away} dias)`).join(', ')}.`:'Não encontrei clientes inativos há mais de 30 dias no período disponível.'
    answer+=' A chave da OpenAI ainda não está configurada; esta resposta usa o modo de análise local.'
  }

  await admin.from('ai_conversations').insert({user_id:user.id,question,answer,model:openaiKey?'gpt-5.6-luna':'local-analysis'}).then(()=>{})
  return json({answer,openai_enabled:Boolean(openaiKey)})
})

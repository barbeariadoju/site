import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}})
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const money=(n:number)=>`R$ ${Number(n).toFixed(2).replace('.',',')}`
const normalize=(s='')=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

const canonicalPhone=(value='')=>{
 const digits=String(value).replace(/\D/g,'')
 if((digits.length===12||digits.length===13)&&digits.startsWith('55'))return digits
 if(digits.length===10||digits.length===11)return `55${digits}`
 return digits
}
const extractPhoneFromMessage=(text='')=>{
 const match=String(text).match(/(?:\+?55\D*)?(?:\(?\d{2}\)?\D*)?\d{4,5}\D*\d{4}/)
 return match?canonicalPhone(match[0]):''
}

const formatDateBR=(value:any)=>{
 const iso=String(value||'').slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return ''
 const [y,m,d]=iso.split('-')
 return `${d}/${m}/${y}`
}
const firstName=(value:any)=>String(value||'').trim().split(/\s+/)[0]||'cliente'
const includesAny=(text:string,terms:string[])=>terms.some(term=>text.includes(term))

const extractRequestedTime=(text='')=>{
 const match=String(text).match(/(?:^|\D)([01]?\d|2[0-3])(?:[:hH])([0-5]\d)(?:\D|$)/)
 if(!match)return ''
 return `${String(Number(match[1])).padStart(2,'0')}:${match[2]}`
}
const slotHour=(slot:string)=>Number(String(slot).slice(0,2))
const detectPeriod=(text:string)=>{
 if(includesAny(text,['manha','pela manha','de manha','cedo']))return 'morning'
 if(includesAny(text,['tarde','pela tarde','de tarde']))return 'afternoon'
 if(includesAny(text,['noite','final do dia','fim do dia','depois das 18','apos as 18']))return 'evening'
 return ''
}
const slotsForPeriod=(slots:string[],period:string)=>slots.filter(slot=>{
 const hour=slotHour(slot)
 if(period==='morning')return hour<12
 if(period==='afternoon')return hour>=12&&hour<18
 if(period==='evening')return hour>=18
 return true
})
const periodLabel=(period:string)=>period==='morning'?'manhã':period==='afternoon'?'tarde':'final do dia'

const services=[
 ['Corte + Lavagem',50,40,'corte'],['Corte de cabelo',40,30,'corte'],['Corte + Barboterapia',80,60,'combo'],['Corte + Barba Express',65,50,'combo'],
 ['Barboterapia com vaporizador de ozônio',50,40,'barba'],['Barboterapia',40,30,'barba'],['Barba Express',25,20,'barba'],['Pezinho (acabamento)',15,10,'adicional'],
 ['Sobrancelha Masculina',15,10,'adicional'],['Depilação nasal (cera quente)',25,20,'adicional'],['Depilação orelhas',25,20,'adicional'],['Freestyle (risquinho)',15,10,'adicional'],
 ['Nevou / Platinado',150,120,'quimica'],['Luzes',120,90,'quimica'],['Alisamento / Relaxamento',70,45,'quimica'],['Pigmentação Capilar (Tintura)',50,30,'quimica'],
 ['Hidratação / Reconstrução Capilar',40,20,'tratamento'],['Pigmentação de Barba',35,20,'pigmentacao'],['Pigmentação de Sobrancelha',20,20,'pigmentacao'],
 ['Aparação Corporal Masculina',120,60,'estetica']
].map(([name,price,duration,category])=>({name:String(name),price:Number(price),duration:Number(duration),category:String(category)}))

const products=[
 {name:'Pasta Matte 150g',price:34,tags:['corte','combo']},
 {name:'Pasta Modeladora Brilho Extra Forte 150g',price:38,tags:['corte','combo']},
 {name:'Pomada em pó',price:35,tags:['corte','combo']},
 {name:'Óleo Para Barba 30mL',price:36,tags:['barba','combo']},
 {name:'Balm Para Barba 150g',price:35,tags:['barba','combo']},
 {name:'Shampoo Para Barba 240mL',price:35,tags:['barba','combo']},
 {name:'Shampoo Caspbell Anticaspa',price:42.99,tags:['tratamento','quimica','corte']},
 {name:'Energético Monster Energy 473ml',price:14,tags:['all']},
 {name:'Energético Monster Zero Sugar 473ml',price:14,tags:['all']}
]

const findService=(name:string)=>services.find(s=>normalize(s.name)===normalize(name))||services.find(s=>normalize(s.name).includes(normalize(name))||normalize(name).includes(normalize(s.name)))
const findProduct=(name:string)=>products.find(p=>normalize(p.name)===normalize(name))||products.find(p=>normalize(p.name).includes(normalize(name))||normalize(name).includes(normalize(p.name)))
const textFrom=(d:any)=>typeof d?.output_text==='string'?d.output_text.trim():(d?.output||[]).flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('\n').trim()
function parseJSON(text:string){try{return JSON.parse(text.replace(/^```json\s*|\s*```$/g,''))}catch{return null}}
function serviceSuggestions(chosen:any[]){
 const names=chosen.map(s=>s.name)
 const out:any[]=[]
 if(!names.some(n=>n.includes('Sobrancelha')))out.push(findService('Sobrancelha Masculina'))
 if(!chosen.some(s=>s.category==='barba'||s.category==='combo'))out.push(findService('Barba Express'))
 if(!names.some(n=>n.includes('Depilação nasal')))out.push(findService('Depilação nasal (cera quente)'))
 if(chosen.some(s=>s.category==='quimica')&&!names.some(n=>n.includes('Hidratação')))out.unshift(findService('Hidratação / Reconstrução Capilar'))
 return out.filter(Boolean).slice(0,3)
}
function productSuggestions(chosen:any[],ctx:any){
 const tags=new Set(chosen.flatMap(s=>[s.category,s.category==='combo'?'corte':'']))
 let result=products.filter(p=>p.tags.includes('all')||p.tags.some(t=>tags.has(t)))
 const last=Array.isArray(ctx?.last_products)?ctx.last_products.map((x:any)=>x.name):[]
 result.sort((a,b)=>(last.includes(b.name)?1:0)-(last.includes(a.name)?1:0))
 return result.slice(0,4)
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)
 const body=await req.json().catch(()=>({}))
 const message=String(body.message||'').trim().slice(0,500)
 if(!message)return respond({error:'Mensagem vazia.'},400)
 const state=body.state&&typeof body.state==='object'?body.state:{}
 const sessionId=String(body.session_id||crypto.randomUUID()).slice(0,80)
 const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 const key=Deno.env.get('OPENAI_API_KEY')
 const {count}=await supabase.from('site_chat_messages').select('*',{count:'exact',head:true}).eq('session_id',sessionId).gte('created_at',new Date(Date.now()-86400000).toISOString())
 if((count||0)>80)return respond({error:'Limite diário de mensagens atingido. Fale com o Juliano pelo WhatsApp.'},429)

 let context:any={}
 const messagePhone=extractPhoneFromMessage(message)
 const knownPhone=canonicalPhone(String(state.phone||messagePhone||''))
 if(knownPhone.length>=12){
  state.phone=knownPhone
  const {data}=await supabase.rpc('get_customer_commercial_context',{p_phone:knownPhone})
  context=data||{}
  if(context?.customer_id&&context?.name&&!state.name)state.name=context.name
 }
 const catalog=services.map(s=>`${s.name} — ${money(s.price)} — ${s.duration} min`).join('\n')
 const productCatalog=products.map(p=>`${p.name} — ${money(p.price)}`).join('\n')
 const prompt=`Você é JuIA, atendente e consultora comercial oficial da Barbearia do Ju. Seja extremamente educada, acolhedora, objetiva e eficiente. Responda em português do Brasil, normalmente em até 4 linhas. Seu objetivo é resolver a necessidade e converter em agendamento sem pressionar. Nunca invente preço, serviço, produto, fidelidade ou disponibilidade. Não confirme horário sem consultar o sistema. Se pedirem Juliano, houver reclamação, dúvida complexa ou pedido humano, faça handoff.\n\nEndereço: Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista. Agenda: terça a sexta 08:00–19:00; sábado 08:00–15:00; domingo e segunda fechado. Pagamentos: Pix, dinheiro, débito e crédito. Ambiente climatizado, café e Wi-Fi. Zona Azul nas proximidades.\nServiços:\n${catalog}\nProdutos:\n${productCatalog}\nHoje: ${today()}. Estado: ${JSON.stringify(state)}. Contexto conhecido do cliente: ${JSON.stringify(context)}.\n\nRetorne SOMENTE JSON válido: {"reply":"...","intent":"faq|services|availability|book|upsell_services|upsell_products|loyalty|handoff|other","updates":{"name":null,"phone":null,"email":null,"services":[],"products":[],"date":null,"time":null,"sales_stage":null},"handoff":false}. Preserve dados conhecidos. Serviços e produtos devem usar nomes exatos. Datas YYYY-MM-DD e horários HH:MM. Para agendar, colete nome, WhatsApp, serviço(s), data e horário. Após o cliente escolher o serviço, ofereça no máximo 3 complementos relevantes uma única vez. Depois, ofereça no máximo 4 produtos relevantes uma única vez. Se ele disser não, avance sem insistir. Se ele perguntar fidelidade e houver telefone, use o contexto. Quando reconhecer um cliente, cumprimente pelo primeiro nome. NÃO revele por conta própria pontos de fidelidade, recompensas, status VIP, última visita ou histórico de atendimentos — o telefone informado no chat não é verificado como sendo de quem está digitando, então só fale desses dados se o cliente perguntar explicitamente sobre fidelidade/pontos/histórico. Se o cliente disser "o mesmo", "igual da última vez" ou "repetir meu último atendimento", use last_services e ajude a repetir (isso é um pedido explícito, pode usar). Em recomendações, priorize preferred_services ou last_services e explique em uma frase, só quando o cliente pedir uma recomendação. Se perguntado sobre fidelidade, humanize a resposta: informe pontos, quantos faltam e recompensas disponíveis. Se houver last_products ou favorite_products, ofereça repetir o produto somente quando isso for relevante e o cliente já estiver interagindo sobre produtos. Use preferências, produtos favoritos e intervalo de retorno apenas para personalizar quando já em contexto de agendamento, sem expor observações internas, etiquetas ou dados privados.`
 let ai:any=null
 if(key){
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',reasoning:{effort:'low'},max_output_tokens:550,instructions:prompt,input:`Histórico recente: ${JSON.stringify(body.history||[])}\nMensagem: ${message}`})})
  const d=await r.json();if(r.ok)ai=parseJSON(textFrom(d))
 }
 if(!ai){const q=normalize(message);ai={reply:q.includes('juliano')?'Claro! Vou direcionar você ao Juliano.':'Posso ajudar com serviços, preços, produtos, fidelidade e agendamento. O que você precisa?',intent:q.includes('juliano')?'handoff':'other',updates:state,handoff:q.includes('juliano')}}
 const next={...state,...Object.fromEntries(Object.entries(ai.updates||{}).filter(([,v])=>v!==null&&v!==''))}
 next.services=Array.isArray(next.services)?next.services.map((x:string)=>findService(x)?.name).filter(Boolean):[]
 next.products=Array.isArray(next.products)?next.products.map((x:string)=>findProduct(x)?.name).filter(Boolean):[]
 let reply=String(ai.reply||'Como posso ajudar?'),actions:any[]=[],intent=String(ai.intent||'other'),handoff=Boolean(ai.handoff)

 const normalizedQuestion=normalize(message)
 const hasCustomer=Boolean(context?.customer_id)
 const customerFirstName=firstName(context?.name)
 const lastServiceName=String(context?.last_services||'').trim()
 const lastService=findService(lastServiceName)
 const lastVisitBR=formatDateBR(context?.last_visit)
 const points=Math.max(0,Number(context?.points||0))
 const rewards=Math.max(0,Number(context?.rewards_available||0))
 const visits=Math.max(0,Number(context?.completed_visits||0))
 const isVip=Boolean(context?.vip)||visits>=15
 const lastProducts=Array.isArray(context?.last_products)?context.last_products:[]
 const favoriteProducts=Array.isArray(context?.favorite_products)?context.favorite_products:[]

 const repeatRequest=includesAny(normalizedQuestion,[
  'repetir meu ultimo','repetir o ultimo','mesmo atendimento','mesmo servico',
  'igual da ultima vez','igual da outra vez','o mesmo de sempre','quero o mesmo','fazer o mesmo'
 ])
 const recommendationRequest=includesAny(normalizedQuestion,[
  'o que voce recomenda','o que recomenda','qual voce recomenda','me recomenda','qual servico combina'
 ])
 const productRepeatRequest=includesAny(normalizedQuestion,[
  'mesmo produto','repetir produto','produto da ultima vez','qual produto comprei','o que levei da ultima vez'
 ])
 const simpleYes=includesAny(normalizedQuestion,['sim','pode ser','isso','quero','confirmo']) && normalizedQuestion.length<35

 if(hasCustomer && repeatRequest){
  if(lastService){
   next.services=[lastService.name]
   next.pending_repeat_service=lastService.name
   next.upsell_services_done=true
   next.sales_stage='repeat_confirmation'
   reply=`${customerFirstName}, seu último atendimento foi ${lastService.name}${lastVisitBR?` em ${lastVisitBR}`:''}. Quer repetir esse serviço?`
   actions=[
    {label:'Sim, repetir',message:'Sim, quero repetir meu último atendimento'},
    {label:'Escolher outro',url:'https://www.barbeariadoju.com.br/agendar/'}
   ]
   intent='other'
   handoff=false
  }else{
   reply=`${customerFirstName}, encontrei seu cadastro, mas ainda não há um atendimento concluído para repetir. Posso mostrar os serviços disponíveis.`
   actions=[{label:'Ver serviços',url:'https://www.barbeariadoju.com.br/agendar/'}]
   intent='services'
  }
 }

 if(hasCustomer && simpleYes && state?.pending_repeat_service){
  const repeated=findService(String(state.pending_repeat_service))
  if(repeated){
   next.services=[repeated.name]
   next.pending_repeat_service=null
   next.upsell_services_done=true
   next.upsell_products_done=true
   next.sales_stage='schedule'
   reply=`Perfeito, ${customerFirstName}! Vou repetir ${repeated.name}. Qual dia você prefere?`
   actions=[]
   intent='other'
   handoff=false
  }
 }

 if(hasCustomer && recommendationRequest){
  const preferred=Array.isArray(context?.preferred_services)?context.preferred_services:[]
  const preferredName=String(preferred?.[0]?.name||preferred?.[0]||'').trim()
  const recommended=findService(preferredName)||lastService
  if(recommended){
   reply=`${customerFirstName}, pelo seu histórico eu recomendo ${recommended.name} (${money(recommended.price)}). É a opção mais próxima do atendimento que você já costuma fazer.`
   actions=[
    {label:`Escolher ${recommended.name}`,message:`Quero agendar ${recommended.name}`},
    {label:'Ver outras opções',url:'https://www.barbeariadoju.com.br/agendar/'}
   ]
   intent='other'
   handoff=false
  }
 }

 if(hasCustomer && productRepeatRequest){
  const productName=String(lastProducts?.[0]?.name||favoriteProducts?.[0]?.name||favoriteProducts?.[0]||'').trim()
  const remembered=findProduct(productName)
  if(remembered){
   reply=`Na sua última compra aparece ${remembered.name}, por ${money(remembered.price)}. Quer deixar outro reservado para retirar no atendimento?`
   actions=[
    {label:'Sim, reservar',message:`Adicionar produto ${remembered.name}`},
    {label:'Não, obrigado',message:'Não quero produto'}
   ]
   intent='other'
   handoff=false
  }else{
   reply='Não encontrei uma compra anterior de produto no seu histórico. Posso mostrar as opções disponíveis.'
   actions=[{label:'Ver produtos',url:'https://www.barbeariadoju.com.br/produtos.html'}]
   intent='other'
  }
 }
 const asksIdentity=normalizedQuestion.includes('quem sou eu')||normalizedQuestion.includes('sabe quem eu sou')||normalizedQuestion.includes('me reconhece')
 if(context?.customer_id&&asksIdentity){
  // Não revelar VIP, histórico ou fidelidade aqui: telefone informado em texto livre
  // não é verificado como sendo de quem está digitando. Fidelidade só é detalhada
  // quando o próprio cliente pede explicitamente (intent==='loyalty' abaixo).
  reply=`Olá, ${customerFirstName}! Encontrei seu cadastro. Como posso ajudar?`
  intent='other'
  handoff=false
  next.name=context.name
  next.phone=knownPhone
 }

 if(intent==='services'){
  reply='Mais procurados:\n• Corte — R$ 40\n• Corte + Barba Express — R$ 65\n• Corte + Barboterapia — R$ 80\n• Barboterapia — R$ 40\nQual combina com você?'
  actions=[{label:'Ver catálogo completo',url:'https://www.barbeariadoju.com.br/agendar/'}]
 }
 if(intent==='loyalty'){
  if(!knownPhone){reply='Para consultar sua fidelidade, informe seu WhatsApp com DDD, por favor.'}
  else if(!context?.customer_id){reply='Ainda não encontrei um cadastro de fidelidade nesse número. Posso fazer seu agendamento e iniciar seu histórico.'}
  else if(rewards>0){reply=`${customerFirstName}, você tem ${rewards} corte(s) gratuito(s) disponível(is)! 🎁 No ciclo atual, está com ${points}/10 pontos.`}
  else{
   const missing=Math.max(0,10-points)
   const encouragement=points===0?'Seu cartão está pronto para começar.':points>=9?'Falta apenas 1 atendimento para ganhar seu corte gratuito! 🎉':points>=5?'Você já passou da metade do caminho.':'Cada corte concluído soma 1 ponto.'
   reply=`${customerFirstName}, você acumulou ${points} de 10 pontos. Faltam ${missing} para ganhar um corte gratuito. ${encouragement}`
  }
 }
 const chosen=next.services.map((n:string)=>findService(n)).filter(Boolean)
 if(chosen.length && !next.upsell_services_done && (intent==='upsell_services'||next.sales_stage==='services_selected')){
  const sug=serviceSuggestions(chosen)
  if(sug.length){reply='Quer aproveitar o horário e incluir algum complemento?';actions=sug.map((s:any)=>({label:`${s.name} · +${money(s.price)}`,message:`Adicionar ${s.name}`}));actions.push({label:'Não, continuar',message:'Não quero serviço adicional'});next.sales_stage='upsell_services'}
  else next.upsell_services_done=true
 }
 if(normalize(message).includes('nao quero servico adicional')||normalize(message).includes('sem adicional')){next.upsell_services_done=true;next.sales_stage='products'}
 if(chosen.length && next.upsell_services_done && !next.upsell_products_done && (intent==='upsell_products'||next.sales_stage==='products')){
  const sug=productSuggestions(chosen,context)
  reply='Posso deixar algum produto separado para você retirar no atendimento?';actions=sug.map(p=>({label:`${p.name} · ${money(p.price)}`,message:`Adicionar produto ${p.name}`}));actions.push({label:'Não, continuar',message:'Não quero produto'});next.sales_stage='upsell_products'
 }
 if(normalize(message).includes('nao quero produto')||normalize(message).includes('sem produto')){next.upsell_products_done=true;next.sales_stage='schedule'}
 const requestedPeriod=detectPeriod(normalizedQuestion)
 const requestedTime=extractRequestedTime(message)
 if((requestedPeriod||requestedTime)&&next.date&&chosen.length)intent='availability'

 if(intent==='availability'&&next.date&&chosen.length){
  const duration=chosen.reduce((a:number,s:any)=>a+s.duration,0)
  const {data,error}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:duration})
  if(error)return respond({error:error.message},500)
  const allSlots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5))

  if(!allSlots.length){
   reply='Não encontrei horário nessa data para todos os serviços. Quer verificar outro dia?'
  }else if(requestedTime){
   if(allSlots.includes(requestedTime)){
    reply=`Sim, ${requestedTime} está disponível para esse atendimento de ${duration} minutos. Quer reservar esse horário?`
    actions=[{label:`Reservar ${requestedTime}`,message:`Quero reservar ${requestedTime}`}]
    next.time=requestedTime
   }else{
    const samePeriod=slotsForPeriod(allSlots,slotHour(requestedTime)<12?'morning':slotHour(requestedTime)<18?'afternoon':'evening')
    const alternatives=(samePeriod.length?samePeriod:allSlots)
    reply=`${requestedTime} não está disponível para esse atendimento. Estes são os horários disponíveis no mesmo período: ${alternatives.join(', ')}.`
    actions=alternatives.map((t:string)=>({label:t,message:t}))
   }
  }else if(requestedPeriod){
   const periodSlots=slotsForPeriod(allSlots,requestedPeriod)
   if(periodSlots.length){
    reply=`No período da ${periodLabel(requestedPeriod)}, estes são todos os horários disponíveis para ${duration} minutos: ${periodSlots.join(', ')}. Qual você prefere?`
    actions=periodSlots.map((t:string)=>({label:t,message:t}))
   }else{
    reply=`Não há horários disponíveis no período da ${periodLabel(requestedPeriod)} nessa data. Posso mostrar outro período ou verificar outro dia.`
    actions=[
     {label:'Ver manhã',message:'Prefiro manhã'},
     {label:'Ver tarde',message:'Prefiro tarde'},
     {label:'Ver final do dia',message:'Prefiro final do dia'}
    ]
   }
  }else if(allSlots.length>10){
   reply=`Tenho ${allSlots.length} horários disponíveis para esse atendimento de ${duration} minutos. Você prefere manhã, tarde ou final do dia?`
   actions=[
    {label:'Manhã',message:'Prefiro manhã'},
    {label:'Tarde',message:'Prefiro tarde'},
    {label:'Final do dia',message:'Prefiro final do dia'}
   ]
  }else{
   reply=`Para ${duration} minutos, estes são todos os horários disponíveis: ${allSlots.join(', ')}. Qual você prefere?`
   actions=allSlots.map((t:string)=>({label:t,message:t}))
  }
 }
 if(intent==='book'){
  const missing=[];if(!next.name)missing.push('seu nome');if(!next.phone)missing.push('seu WhatsApp');if(!chosen.length)missing.push('o serviço');if(!next.date)missing.push('a data');if(!next.time)missing.push('o horário')
  if(missing.length){reply=`Para concluir, preciso de ${missing.join(', ')}.`;intent='other'}
  else{
   const phone=String(next.phone).replace(/\D/g,'')
   if(phone.length<10){reply='Pode informar seu WhatsApp com DDD, por favor?';next.phone=null;intent='other'}
   else{
    const duration=chosen.reduce((a:number,s:any)=>a+s.duration,0),price=chosen.reduce((a:number,s:any)=>a+s.price,0)
    const selectedProducts=next.products.map((n:string)=>findProduct(n)).filter(Boolean).map((p:any)=>({name:p.name,price:p.price}))
    const {data:bookingId,error}=await supabase.rpc('create_public_booking_v15',{p_customer_name:next.name,p_customer_phone:phone,p_customer_email:next.email||null,p_service_name:chosen.map((s:any)=>s.name).join(' + '),p_service_price:price,p_duration_minutes:duration,p_booking_date:next.date,p_start_time:next.time,p_notes:'Agendado pela JuIA no chat do site',p_selected_products:selectedProducts})
    if(error){reply=error.message.includes('indisponível')?'Esse horário acabou de ficar indisponível. Posso consultar outro para você.':error.message;intent='availability';next.time=null}
    else{
      try{
        const {data:record}=await supabase.from('bookings').select('*').eq('id',bookingId).single()
        const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
        const supabaseUrl=Deno.env.get('SUPABASE_URL')
        if(record&&pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({record})})
      }catch(pushError){console.error('[ju-ia-site] push',pushError)}
      const prodText=selectedProducts.length?` Produtos reservados: ${selectedProducts.map((p:any)=>p.name).join(', ')}.`:''
      reply=`✅ Agendamento confirmado! ${next.name}, seu horário para ${chosen.map((s:any)=>s.name).join(' + ')} está confirmado para ${next.date.split('-').reverse().join('/')} às ${next.time}.${prodText} Aguardamos você na Barbearia do Ju! 😊`
      actions=[{label:'Falar com a barbearia',url:'https://wa.me/5511967073038?text='+encodeURIComponent(`Olá, sou ${next.name}. Tenho um agendamento confirmado para ${next.date} às ${next.time}.`),primary:true}]
      next.completed=true
    }
   }
  }
 }
 await supabase.from('site_chat_messages').insert([{session_id:sessionId,role:'user',content:message,state},{session_id:sessionId,role:'assistant',content:reply,state:next,intent}]).then(()=>{})
 return respond({reply,intent,state:next,actions,handoff})
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}})
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const money=(n:number)=>`R$ ${Number(n).toFixed(2).replace('.',',')}`
const normalize=(s='')=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()

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
// Saudação correta pelo horário de Brasília — computada aqui (não pedida ao modelo) pra
// garantir que "Bom dia/Boa tarde/Boa noite" nunca saia errado.
const greetingNow=()=>{
 const hour=Number(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(new Date()))
 return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'
}

const extractRequestedTime=(text='')=>{
 const match=String(text).match(/(?:^|\D)([01]?\d|2[0-3])(?:[:hH])([0-5]\d)(?:\D|$)/)
 if(!match)return ''
 return `${String(Number(match[1])).padStart(2,'0')}:${match[2]}`
}
const slotHour=(slot:string)=>Number(String(slot).slice(0,2))
const detectPeriod=(text:string)=>{
 // "boa tarde"/"boa noite" são cumprimentos, não pedido de período — sem isso, um simples
 // "Oi, boa tarde" com data/serviço ainda na memória da conversa (ex.: agendamento
 // anterior já concluído) disparava checagem de disponibilidade sozinho (caso real:
 // áudio "Oi! Boa tarde!" virou "Não encontrei horário nessa data...").
 const withoutGreeting=text.replace(/\bboa tarde\b/g,'').replace(/\bboa noite\b/g,'')
 // Palavras soltas usam \b (limite de palavra) em vez de includes() puro: "manha" também
 // aparece DENTRO de "amanha" (sem acento), então "tem horario amanha?" estava sendo lido
 // como pedido de manhã. \b garante que só casa a palavra inteira, não um pedaço de outra.
 if(/\bmanha\b|pela manha|de manha|\bcedo\b/.test(withoutGreeting))return 'morning'
 if(/\btarde\b|pela tarde|de tarde/.test(withoutGreeting))return 'afternoon'
 if(/\bnoite\b|final do dia|fim do dia|depois das 18|apos as 18/.test(withoutGreeting))return 'evening'
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

// Antes um array fixo aqui (cópia manual que só divergia com o tempo do catálogo real
// em services-catalog-v7.js/products-catalog-v1.js — esta function roda em Deno e não
// consegue importar esses arquivos de front-end). Agora populados a cada request a
// partir de public.services (migration 057-v28.28.0) e public.products (migration
// 051-v28.20.0), fontes únicas, logo no início do handler — ver dentro de Deno.serve,
// abaixo.
let services:{name:string;price:number;duration:number;category:string}[]=[]
let products:{name:string;price:number;tags:string[]}[]=[]

// Entre candidatos por substring (ex. "Barba" bate tanto em "Barba Express"
// quanto em "Corte + Barba Express"), fica com o nome mais próximo em tamanho
// do texto buscado — sem isso, o primeiro do array vencia sempre. Também
// penaliza nomes de combo ("Corte + X") quando o texto buscado não sugere um
// combo: sem isso, "Corte" sozinho batia em "Corte + Lavagem" (que por acaso
// é 1 caractere mais curto que "Corte de cabelo" depois de normalizado) —
// bug real, já existia antes desta função escolher por tamanho, porque
// "Corte + Lavagem" também é o primeiro do array.
const comboSignal=/\+| e |combo/i
const findService=(name:string)=>{
 const n=normalize(name)
 const exact=services.find(s=>normalize(s.name)===n)
 if(exact)return exact
 const candidates=services.filter(s=>normalize(s.name).includes(n)||n.includes(normalize(s.name)))
 if(!candidates.length)return undefined
 const wantsCombo=comboSignal.test(name)
 const score=(s:typeof services[number])=>Math.abs(normalize(s.name).length-n.length)+((s.name.includes('+')&&!wantsCombo)?4:0)
 return candidates.reduce((best,s)=>score(s)<score(best)?s:best)
}
const findProduct=(name:string)=>products.find(p=>normalize(p.name)===normalize(name))||products.find(p=>normalize(p.name).includes(normalize(name))||normalize(name).includes(normalize(p.name)))
const stripSpaces=(s:string)=>normalize(s).replace(/\s+/g,'')
// Fallback pra quando o modelo classifica intent "services" mas não extrai
// nada em updates.services (mensagem curta com mais de um serviço junto, ex.
// "barba e pezinho", ou erro de digitação, ex. "barbo terapia" por
// "Barboterapia") — tenta casar o texto do cliente direto contra o catálogo
// antes de cair na lista genérica de mais procurados.
function findServicesLoose(text:string){
 const n=normalize(text)
 const exact=services.find(s=>normalize(s.name)===n)
 if(exact)return [exact]
 const found:any[]=[]
 String(text).split(/,|\+|\/| e | ou /i).map(t=>t.trim()).filter(t=>t.length>=4).forEach(token=>{
  const svc=findService(token)
  if(svc&&!found.some(f=>f.name===svc.name))found.push(svc)
 })
 if(found.length)return found
 const dense=stripSpaces(text)
 if(dense.length>=4){
  const candidates=services.filter(s=>{const sd=stripSpaces(s.name);return dense.includes(sd)||sd.includes(dense)})
  if(candidates.length){
   const best=candidates.reduce((b,s)=>Math.abs(stripSpaces(s.name).length-dense.length)<Math.abs(stripSpaces(b.name).length-dense.length)?s:b)
   found.push(best)
  }
 }
 return found
}
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
 // Serviços e produtos vêm do banco (public.services migration 057-v28.28.0,
 // public.products migration 051-v28.20.0) — fontes únicas que as Edge Functions
 // conseguem ler direto, em vez de manter cópias hardcoded que ficavam desatualizadas
 // em relação ao catálogo real do front-end.
 const {data:servicesData}=await supabase.from('services').select('name,price,duration_minutes,upsell_tag').eq('active',true).order('sort_order')
 services=(servicesData||[]).map((s:any)=>({name:String(s.name),price:Number(s.price),duration:Number(s.duration_minutes),category:String(s.upsell_tag)}))
 const {data:productsData}=await supabase.from('products').select('name,price,upsell_tags').eq('active',true)
 products=(productsData||[]).map((p:any)=>({name:String(p.name),price:Number(p.price),tags:Array.isArray(p.upsell_tags)?p.upsell_tags:[]}))
 const {count}=await supabase.from('site_chat_messages').select('*',{count:'exact',head:true}).eq('session_id',sessionId).gte('created_at',new Date(Date.now()-86400000).toISOString())
 if((count||0)>80)return respond({error:'Limite diário de mensagens atingido. Fale com o Juliano pelo WhatsApp.'},429)

 // Cliente manda só um link (ex.: compartilhou uma imagem/post gerado em outro app) —
 // a JuIA não enxerga conteúdo de link nenhum. Responde direto, sem gastar chamada de
 // IA, e no canal WhatsApp aproveita pra indicar o site (onde dá pra ver serviços e
 // agenda sozinho). Só dispara quando a mensagem é BASICAMENTE o link (pouco texto
 // sobrando), pra não atrapalhar uma mensagem normal que só cita um link de passagem.
 const isWhatsapp=Boolean(String(body.verified_phone||'').trim())
 if(isWhatsapp&&/(?:https?:\/\/|www\.)\S+/i.test(message)&&message.replace(/https?:\/\/\S+|www\.\S+/gi,'').trim().length<15){
  const reply=`${greetingNow()}! Não consigo ver o conteúdo de links por aqui — pode me mandar por escrito o que você precisa? Se preferir, acesse nosso site www.barbeariadoju.com.br e faça seu agendamento de forma simples e rápida: lá você confere todos os serviços e consulta os horários disponíveis na nossa agenda. 😊`
  await supabase.from('site_chat_messages').insert([{session_id:sessionId,role:'user',content:message,state},{session_id:sessionId,role:'assistant',content:reply,state,intent:'other'}]).then(()=>{})
  return respond({reply,intent:'other',state,actions:[],handoff:false})
 }

 let context:any={}
 let upcomingBookings:any[]=[]
 // verified_phone vem do canal WhatsApp (whatsapp-webhook), onde o número de quem
 // está escrevendo é o próprio remetente da mensagem — não precisa (e não deve)
 // ser perguntado de novo. No chat do site esse campo não é enviado.
 const verifiedPhone=canonicalPhone(String(body.verified_phone||''))
 const messagePhone=extractPhoneFromMessage(message)
 const knownPhone=canonicalPhone(String(verifiedPhone||state.phone||messagePhone||''))
 if(knownPhone.length>=12){
  state.phone=knownPhone
  const {data}=await supabase.rpc('get_customer_commercial_context',{p_phone:knownPhone})
  context=data||{}
  // NÃO preenche state.name aqui: o telefone pode ser compartilhado (ex.: cliente que da
  // última vez agendou pro primo usando o mesmo número) — assumir o nome do cadastro sem
  // perguntar já causou agendamento no nome errado. O nome só entra em next.name depois de
  // confirmado explicitamente (ver bloco de confirmação no intent 'book' mais abaixo).
  const {data:upcoming}=await supabase.rpc('phone_upcoming_bookings',{p_phone:knownPhone})
  upcomingBookings=Array.isArray(upcoming)?upcoming:[]
 }
 const catalog=services.map(s=>`${s.name} — ${money(s.price)} — ${s.duration} min`).join('\n')
 const productCatalog=products.map(p=>`${p.name} — ${money(p.price)}`).join('\n')
 const phoneTrustNote=verifiedPhone
  ?'O telefone do cliente já é confirmado automaticamente pelo canal (WhatsApp) — NUNCA peça o WhatsApp dele, ele já está identificado. Mesmo assim, só fale de pontos de fidelidade, recompensas, status VIP, última visita ou histórico de atendimentos se o cliente perguntar explicitamente sobre isso.'
  :'O telefone informado no chat não é verificado como sendo de quem está digitando, então só fale de pontos de fidelidade, recompensas, status VIP, última visita ou histórico de atendimentos se o cliente perguntar explicitamente sobre isso.'
 const isFirstMessage=!Array.isArray(body.history)||body.history.length===0
 const prompt=`Você é JuIA, atendente e consultora comercial oficial da Barbearia do Ju. Seja extremamente educada, acolhedora, objetiva e eficiente. Responda em português do Brasil, normalmente em até 4 linhas. Seu objetivo é resolver a necessidade e converter em agendamento sem pressionar. Nunca invente preço, serviço, produto, fidelidade ou disponibilidade. Nunca reafirme um agendamento já existente (da lista de agendamentos futuros) como se fosse a resposta a um pedido novo — se o cliente pede um dia/horário/serviço diferente do que já está confirmado, trate como um pedido novo (agendar, remarcar, trocar serviço) e nunca copie os dados do agendamento antigo na resposta. Nunca assuma o serviço que o cliente quer com base no histórico dele (last_services) a não ser que ele peça explicitamente para repetir/manter o mesmo de sempre — se ele não disser o serviço, pergunte qual serviço antes de agendar ou remarcar. Nunca inclua saudação (Bom dia/Boa tarde/Boa noite) na sua resposta, nem mesmo na primeira mensagem — isso é adicionado automaticamente pelo sistema antes de enviar, já com o nome do cliente quando disponível. Comece sua resposta direto pelo conteúdo. Se esta for a primeira mensagem desta conversa (indicado abaixo) e fizer sentido, mencione que o cliente também pode ver todos os serviços, consultar horários disponíveis e agendar sozinho pelo nosso site https://www.barbeariadoju.com.br/agendar/ — sem repetir essa menção do site nas mensagens seguintes. Não confirme horário sem consultar o sistema. Se o cliente avisar que chegou, está a caminho, vai se atrasar um pouco, ou está terminando algo (comendo, no trabalho etc.) antes de vir para um horário já marcado, responda breve e acolhedora confirmando que está tudo certo — não peça esclarecimento, não repita dados do agendamento, isso não é um pedido novo. Se pedirem Juliano, houver reclamação, dúvida complexa ou pedido humano, faça handoff. Se o cliente pedir para cancelar um agendamento, disser que já marcou em outro lugar/outro dia, ou não vai mais poder ir no horário marcado, use intent "cancel" — nunca diga que já cancelou nem que vai encaminhar para a equipe, o sistema confirma com o cliente e executa o cancelamento sozinho. Se o cliente pedir para mudar o dia/horário de um agendamento que já existe (ex.: "posso mudar pra sexta às 15h?", "quero remarcar", "dá pra trocar meu horário?"), use intent "reschedule" — não trate como um agendamento novo nem diga que vai cancelar e recriar, o sistema identifica o agendamento, confirma o novo horário disponível e reagenda sozinho, preservando o mesmo registro. Se o cliente pedir para trocar o SERVIÇO de um agendamento que já existe, sem mudar dia/horário (ex.: "pode trocar o serviço pra mim?", "marquei corte mas quero mudar pra barba", "muda esse agendamento pra Barba Express"), use intent "change_service" e preencha updates.services com o nome exato do novo serviço desejado — o sistema identifica o agendamento, confirma o serviço novo e troca sozinho, preservando dia, horário e o resto do registro.\n\nEndereço: Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista. Agenda: terça a sexta 08:00–19:00; sábado 08:00–15:00; domingo e segunda fechado. Pagamentos: Pix, dinheiro, débito e crédito. Ambiente climatizado, café e Wi-Fi. Zona Azul nas proximidades.\nServiços:\n${catalog}\nProdutos:\n${productCatalog}\nHoje: ${today()}. Saudação correta agora: ${greetingNow()}. Primeira mensagem desta conversa: ${isFirstMessage}. Estado: ${JSON.stringify(state)}. Contexto conhecido do cliente: ${JSON.stringify(context)}. Agendamentos futuros já confirmados desse telefone: ${JSON.stringify(upcomingBookings)}.\n\nRetorne SOMENTE JSON válido: {"reply":"...","intent":"faq|services|availability|book|cancel|reschedule|change_service|upsell_services|upsell_products|loyalty|handoff|other","updates":{"name":null,"phone":null,"email":null,"services":[],"products":[],"date":null,"time":null,"sales_stage":null},"handoff":false}. Preserve dados conhecidos. Serviços e produtos devem usar nomes exatos. Quando o cliente já citar o serviço explicitamente (ex.: "barba e pezinho", "corte de cabelo"), preencha updates.services com o(s) nome(s) exato(s) do catálogo — não responda com a lista genérica de mais procurados nesse caso. Se o cliente pedir para "raspar a cabeça", "raspar com máquina/navalha", "deixar no zero", "carequinha" ou termos parecidos referindo-se ao cabelo (não à barba), entenda como o serviço "Raspar a cabeça" — não pergunte se é cabeça ou barba quando o cliente já disse que é a cabeça/cabelo. Se o cliente mencionar corte para filho(a), criança ou "corte infantil", entenda como o serviço "Corte de cabelo infantil". Datas YYYY-MM-DD e horários HH:MM. Para agendar, colete nome, WhatsApp (a menos que o telefone já esteja confirmado, ver nota abaixo), serviço(s), data e horário. Após o cliente escolher o serviço, ofereça no máximo 3 complementos relevantes uma única vez. Depois, ofereça no máximo 4 produtos relevantes uma única vez. Se ele disser não, avance sem insistir. Se ele perguntar fidelidade e houver telefone, use o contexto. ${phoneTrustNote} Se o cliente disser "o mesmo", "igual da última vez" ou "repetir meu último atendimento", use last_services e ajude a repetir (isso é um pedido explícito, pode usar). Em recomendações, priorize preferred_services ou last_services e explique em uma frase, só quando o cliente pedir uma recomendação. Se perguntado sobre fidelidade, humanize a resposta: informe pontos, quantos faltam e recompensas disponíveis. Se houver last_products ou favorite_products, ofereça repetir o produto somente quando isso for relevante e o cliente já estiver interagindo sobre produtos. Use preferências, produtos favoritos e intervalo de retorno apenas para personalizar quando já em contexto de agendamento, sem expor observações internas, etiquetas ou dados privados.`
 let ai:any=null
 if(key){
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',reasoning:{effort:'low'},max_output_tokens:550,instructions:prompt,input:`Histórico recente: ${JSON.stringify(body.history||[])}\nMensagem: ${message}`})})
  const d=await r.json();if(r.ok)ai=parseJSON(textFrom(d))
 }
 if(!ai){const q=normalize(message);ai={reply:q.includes('juliano')?'Claro! Vou direcionar você ao Juliano.':'Posso ajudar com serviços, preços, produtos, fidelidade e agendamento. O que você precisa?',intent:q.includes('juliano')?'handoff':'other',updates:state,handoff:q.includes('juliano')}}
 // services/products são escolhas cumulativas: um array vazio no retorno do modelo
 // normalmente significa "nada de novo nesta mensagem", não "esqueça o que já foi
 // escolhido". Sem esse filtro, qualquer mensagem que não recite o serviço de novo
 // (ex.: "tem horário agora?", "oi") apagava o serviço já selecionado no turno anterior.
 const next={...state,...Object.fromEntries(Object.entries(ai.updates||{}).filter(([,v])=>v!==null&&v!==''&&!(Array.isArray(v)&&v.length===0)))}
 next.services=Array.isArray(next.services)?next.services.map((x:string)=>findService(x)?.name).filter(Boolean):[]
 next.products=Array.isArray(next.products)?next.products.map((x:string)=>findProduct(x)?.name).filter(Boolean):[]
 const chosen=next.services.map((n:string)=>findService(n)).filter(Boolean)
 let reply=String(ai.reply||'Como posso ajudar?'),actions:any[]=[],intent=String(ai.intent||'other'),handoff=Boolean(ai.handoff)

 const normalizedQuestion=normalize(message)
 const hasCustomer=Boolean(context?.customer_id)
 const customerFirstName=firstName(context?.name)
 const contextFullName=hasCustomer?String(context?.name||'').trim():''
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
 const simpleNo=includesAny(normalizedQuestion,['nao','não','deixa assim','mantem','manter','deixa pra la']) && normalizedQuestion.length<35
 const keepBothRequest=includesAny(normalizedQuestion,['manter os dois','manter ambos','deixa os dois','quero os dois'])

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
  // NÃO crava next.name aqui pelo mesmo motivo do bloco de confirmação no intent
  // 'book': telefone pode ser compartilhado, "reconhecer" o cadastro não significa
  // que é essa pessoa quem está escrevendo agora.
  reply=`Olá, ${customerFirstName}! Encontrei seu cadastro. Como posso ajudar?`
  intent='other'
  handoff=false
  next.phone=knownPhone
 }

 // O modelo às vezes não extrai TODOS os serviços citados em updates.services -
 // tanto quando não extrai nada (mensagem com mais de um serviço junto ou erro de
 // digitação, ex. "Barba e pezinho", "Barbo terapia") quanto quando o cliente JÁ
 // tinha um serviço selecionado e cita um serviço A MAIS na mesma mensagem (ex.:
 // já estava com "Sobrancelha Masculina" escolhido, manda "Barba e sombrancelha"
 // de novo e só "Sobrancelha" segue adiante, "Barba" some silenciosamente - bug
 // real, cliente Moisés em 28/07/2026, precisou de correção manual do Juliano).
 // Tenta casar o texto da mensagem atual contra o catálogo e MESCLA com o que já
 // estava selecionado (nunca troca/derruba serviço já escolhido).
 // Não gated em intent==='services'/'availability': o modelo pode pular direto
 // pra intent 'book' na mesma mensagem que adiciona o serviço (foi exatamente
 // o caso do Moisés - 1a tentativa do fix só cobria services/availability e não
 // pegou esse caso). Excluídos só os fluxos que já tratam serviço com lógica
 // própria e específica (change_service usa swapTailService/chosen[0], não faz
 // sentido essa mescla genérica competir com aquilo) ou onde um match espúrio
 // de substring poderia interferir num fluxo sensível (cancelamento/reagendamento).
 // "Barba" sozinho é ambíguo: Barba Express (R$25,20min), Barboterapia (R$40,30min)
 // e Barboterapia com vaporizador de ozônio (R$50,40min) são bem diferentes em
 // preço/duração. Sem isso, o find* daria sempre Barba Express (nome mais curto,
 // ganha no desempate por tamanho) mesmo quando o cliente talvez preferisse (e
 // pagasse mais por) a Barboterapia - pedido explícito do Juliano depois do caso
 // do Moisés: não adivinhar, perguntar. Só dispara pra "barba" isolado (negative
 // lookahead exclui "barba express", que já é específico) e só se nenhum serviço
 // de categoria barba já estiver selecionado (não fica reperguntando à toa depois
 // que o cliente já escolheu, inclusive quando ele mesmo responde clicando numa
 // das opções, ex. "Quero Barba Express" - essa mensagem não bate mais no regex).
 const bareBarbaAsk=/\bbarba\b(?!\s*express)/i.test(message)&&!chosen.some((s:any)=>s.category==='barba')
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'){
  const loose=findServicesLoose(message)
  const newOnes=loose.filter((s:any)=>!chosen.some((c:any)=>c.name===s.name)&&!(bareBarbaAsk&&s.category==='barba'))
  if(newOnes.length){
   chosen.push(...newOnes)
   next.services=chosen.map((s:any)=>s.name)
  }
  if(bareBarbaAsk){
   const barbaOptions=services.filter(s=>s.category==='barba')
   reply=`Temos algumas opções de barba: ${barbaOptions.map(s=>`${s.name} (${money(s.price)}, ${s.duration} min)`).join(', ')}. Qual você prefere?`
   actions=barbaOptions.map(s=>({label:`${s.name} · ${money(s.price)}`,message:`Quero ${s.name}`}))
   intent='other'
   handoff=false
  }
 }
 if(intent==='services'&&!chosen.length){
  reply='Mais procurados:\n• Corte — R$ 40\n• Corte + Barba Express — R$ 65\n• Corte + Barboterapia — R$ 80\n• Barboterapia — R$ 40\nQual combina com você?'
  actions=[{label:'Ver catálogo completo',url:'https://www.barbeariadoju.com.br/agendar/'}]
 }
 // Cliente já citou o(s) serviço(s) exato(s) (ex.: "barba e pezinho") — não faz sentido
 // mostrar a lista genérica de mais procurados. Segue direto pro fluxo de disponibilidade.
 if(intent==='services'&&chosen.length){
  intent='availability'
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
 // Detecta cancelamento mesmo quando o modelo não classificou certo (ex.: "pode
 // cancelar", "desmarcar"), e sempre retoma o fluxo de cancelamento enquanto houver
 // uma confirmação pendente (next.pending_cancel_booking_id), não importa o que o
 // modelo tenha entendido da mensagem seguinte (ex.: um simples "sim").
 // changeServiceAsk/rescheduleAsk são calculados aqui (antes do bloco de
 // cancelamento) porque os blocos de conflito de disponibilidade/agendamento
 // reaproveitam next.pending_cancel_booking_id pra marcar "o agendamento em
 // conflito" — sem essa checagem, uma resposta como "quero remarcar" ficaria
 // presa no fluxo de cancelamento (que também reage a esse campo) e nunca
 // chegaria nos fluxos de reagendamento/troca de serviço.
 // "trocar"/"mudar" sozinhos são ambíguos entre reagendar (dia/hora) e trocar
 // serviço — desambigua olhando se o que vem depois de "pra/para" é um serviço
 // conhecido do catálogo (ex.: "mudar pra barba" = serviço; "mudar pra sexta" não é).
 const swapTailMatch=normalizedQuestion.match(/(?:trocar|mudar)\s+(?:o\s+|meu\s+|esse\s+)?(?:servico\s+)?(?:para|pra)\s+(.+)/)
 const swapTailService=swapTailMatch?findService(swapTailMatch[1]):null
 const changeServiceAsk=includesAny(normalizedQuestion,['trocar o servico','trocar de servico','mudar o servico','mudar de servico','trocar meu servico','mudar meu servico','pode trocar o servico','pode mudar o servico'])||Boolean(swapTailService)
 const rescheduleAsk=includesAny(normalizedQuestion,['remarcar','reagendar','mudar meu agendamento','mudar o agendamento','mudar esse agendamento','mudar de dia','mudar o dia','mudar de horario','mudar o horario','trocar de horario','trocar o horario','trocar de dia','trocar o dia','posso mudar pra','posso mudar para','quero mudar pra','quero mudar para','mudar para outro dia','mudar para outro horario'])&&!changeServiceAsk
 const cancelAsk=includesAny(normalizedQuestion,['pode cancelar','cancelar meu','cancela meu','quero cancelar','desmarcar','cancelamento','ja marquei em outro','marquei em outro lugar','nao vou mais poder ir'])
 // Adicionar/remover produto de um agendamento JÁ CONFIRMADO — diferente do
 // upsell de produto durante a criação de um agendamento novo (que não
 // menciona "agendamento"/"horário marcado"). Exige as duas coisas juntas
 // (verbo de produto + referência ao agendamento) pra não colidir com os
 // botões do upsell (ex.: "Adicionar produto X"), que não citam agendamento.
 const productBookingContext=/agendamento|horario marcado|\breserva\b/.test(normalizedQuestion)
 const mentionsProduto=normalizedQuestion.includes('produto')
 // Frases reais variam demais pra casar por substring exata ("adicionar UM
 // produto", "quero incluir o produto" etc.) — usa presença do verbo em
 // qualquer lugar da frase, não uma frase fixa.
 const addProductVerb=/\b(adicionar|incluir|colocar)\b/.test(normalizedQuestion)
 const removeProductVerb=/\b(tirar|remover|excluir)\b/.test(normalizedQuestion)
 const addProductAsk=addProductVerb&&mentionsProduto&&productBookingContext
 const removeProductAsk=removeProductVerb&&mentionsProduto&&productBookingContext
 const updateProductsAsk=addProductAsk||removeProductAsk
 if((next.pending_cancel_booking_id&&!rescheduleAsk&&!changeServiceAsk&&!updateProductsAsk)||cancelAsk)intent='cancel'

 if(intent==='cancel'){
  if(!verifiedPhone){
   reply='Para cancelar com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(next.pending_cancel_booking_id){
   if(simpleYes&&!simpleNo){
    const {data:cancelledRows,error:cancelError}=await supabase.rpc('whatsapp_cancel_booking',{p_phone:verifiedPhone,p_booking_id:next.pending_cancel_booking_id})
    const cancelled=Array.isArray(cancelledRows)?cancelledRows[0]:cancelledRows
    if(cancelError||!cancelled){
     reply='Não consegui cancelar agora — pode já ter passado do horário ou já ter sido cancelado. Se precisar, o Juliano confirma direto com você.'
     handoff=true
    }else{
     reply=`Pronto! Cancelei seu agendamento de ${formatDateBR(cancelled.booking_date)} às ${String(cancelled.start_time).slice(0,5)}. Se quiser marcar outro horário, é só me dizer.`
     handoff=false
     const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
     const supabaseUrl=Deno.env.get('SUPABASE_URL')
     if(pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'❌ Agendamento cancelado pela JuIA',body:`${cancelled.customer_name||customerFirstName} cancelou ${formatDateBR(cancelled.booking_date)} às ${String(cancelled.start_time).slice(0,5)}\n${cancelled.service_name}`,url:'/admin-agenda.html?app=1',tag:`booking-cancelled-${cancelled.id}`}})}).catch(()=>{})
    }
    next.pending_cancel_booking_id=null
   }else if(simpleNo){
    reply='Tudo bem, não cancelei nada. Seu agendamento continua confirmado.'
    next.pending_cancel_booking_id=null
    handoff=false
   }else{
    const pend=upcomingBookings.find((b:any)=>b.id===next.pending_cancel_booking_id)
    reply=pend?`Só confirmando: quer mesmo cancelar o agendamento de ${formatDateBR(pend.booking_date)} às ${String(pend.start_time).slice(0,5)} (${pend.service_name})? Responda sim ou não.`:'Quer mesmo cancelar esse agendamento? Responda sim ou não.'
    handoff=false
   }
  }else if(!upcomingBookings.length){
   reply='Não encontrei nenhum agendamento futuro nesse número. Se já foi cancelado ou é outro número, me avise.'
   handoff=false
  }else if(upcomingBookings.length===1){
   const b=upcomingBookings[0]
   next.pending_cancel_booking_id=b.id
   reply=`É o seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} para ${b.service_name} que você quer cancelar? Responda sim ou não.`
   actions=[{label:'Sim, cancelar',message:'Sim, pode cancelar'},{label:'Não, manter',message:'Não, manter o agendamento'}]
   handoff=false
  }else{
   reply='Você tem mais de um agendamento futuro. Qual deles quer cancelar?\n'+upcomingBookings.map((b:any,i:number)=>`${i+1}. ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} — ${b.service_name}`).join('\n')
   actions=upcomingBookings.map((b:any)=>({label:`${formatDateBR(b.booking_date)} ${String(b.start_time).slice(0,5)}`,message:`Cancelar o de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)}`}))
   handoff=false
  }
 }

 // Adiciona/remove produto de um agendamento já confirmado, sem tocar em
 // serviço, dia ou horário. updateProductsAsk não tem chance de colidir com
 // cancel/reschedule/change_service (exige "produto"+"agendamento" juntos).
 if(intent!=='cancel'&&(next.pending_products_booking_id||updateProductsAsk))intent='update_products'

 // Troca só o serviço do agendamento (service_name/price/duration), preservando
 // dia e horário. Checado antes do reagendamento porque changeServiceAsk e
 // rescheduleAsk já são mutuamente exclusivos (ver comentário acima).
 if(intent!=='cancel'&&intent!=='update_products'&&(next.pending_change_service_booking_id||changeServiceAsk))intent='change_service'

 // Reagenda de fato (muda booking_date/start_time do mesmo registro) em vez de
 // cancelar e criar de novo — preserva histórico e notas. rescheduleAsk já foi
 // calculado acima, antes do bloco de cancelamento.
 if(intent!=='cancel'&&intent!=='change_service'&&intent!=='update_products'&&(next.pending_reschedule_booking_id||rescheduleAsk))intent='reschedule'

 if(intent==='reschedule'){
  // Vem de um bloco de conflito (disponibilidade/agendamento) que já tinha
  // identificado esse agendamento como "o que está em conflito" e ofereceu
  // reagendar como alternativa a cancelar — reaproveita a mesma identificação
  // em vez de perguntar de novo qual agendamento é. next.date (e next.time, se
  // já escolhido) continuam com o horário novo que o cliente estava pedindo,
  // então cai direto na etapa de checar disponibilidade/confirmar abaixo.
  if(!next.pending_reschedule_booking_id&&next.pending_cancel_booking_id&&upcomingBookings.some((b:any)=>b.id===next.pending_cancel_booking_id)){
   next.pending_reschedule_booking_id=next.pending_cancel_booking_id
   next.pending_cancel_booking_id=null
  }
  // Se o cliente também citou um serviço diferente do atual nesta conversa (ex.: "cabelo
  // e barba" enquanto remarca uma Barboterapia), aplica a troca de serviço JUNTO com a
  // remarcação — sem isso, o serviço mencionado ficava perdido, porque este fluxo só
  // mexe em data/hora, e o agendamento saía "confirmado" com o serviço antigo mesmo.
  const rescheduleTarget=upcomingBookings.find((b:any)=>b.id===next.pending_reschedule_booking_id)
  const desiredServiceName=chosen.length?chosen.map((s:any)=>s.name).join(' + '):''
  const wantsServiceChange=Boolean(rescheduleTarget)&&Boolean(desiredServiceName)&&normalize(desiredServiceName)!==normalize(String(rescheduleTarget?.service_name||''))
  if(!verifiedPhone){
   reply='Para remarcar com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(next.pending_reschedule_new_date&&next.pending_reschedule_new_time){
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_reschedule_booking_id)
   if(simpleYes&&!simpleNo){
    const {data:rescheduledRows,error:rescheduleError}=await supabase.rpc('phone_reschedule_booking',{p_phone:verifiedPhone,p_booking_id:next.pending_reschedule_booking_id,p_new_booking_date:next.pending_reschedule_new_date,p_new_start_time:next.pending_reschedule_new_time})
    const rescheduled=Array.isArray(rescheduledRows)?rescheduledRows[0]:rescheduledRows
    if(rescheduleError||!rescheduled){
     reply='Não consegui remarcar agora — esse horário pode ter ficado indisponível. Quer tentar outro horário?'
     handoff=false
     next.pending_reschedule_new_date=null
     next.pending_reschedule_new_time=null
    }else{
     let serviceNote=''
     if(wantsServiceChange){
      const svcPrice=chosen.reduce((a:number,s:any)=>a+s.price,0),svcDuration=chosen.reduce((a:number,s:any)=>a+s.duration,0)
      const {data:svcRows}=await supabase.rpc('phone_change_booking_service',{p_phone:verifiedPhone,p_booking_id:next.pending_reschedule_booking_id,p_service_name:desiredServiceName,p_service_price:svcPrice,p_duration_minutes:svcDuration})
      const svcChanged=Array.isArray(svcRows)?svcRows[0]:svcRows
      serviceNote=svcChanged?` Também troquei o serviço para ${desiredServiceName}.`:' O horário mudou, mas não consegui trocar o serviço agora — se quiser, me diga de novo qual serviço você quer.'
     }
     reply=`Prontinho! Mudei seu agendamento de ${formatDateBR(target?.booking_date)} às ${String(target?.start_time||'').slice(0,5)} para ${formatDateBR(rescheduled.booking_date)} às ${String(rescheduled.start_time).slice(0,5)}.${serviceNote}`
     handoff=false
     const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
     const supabaseUrl=Deno.env.get('SUPABASE_URL')
     if(pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🔄 Agendamento remarcado pela JuIA',body:`${rescheduled.customer_name||customerFirstName}\nDe ${formatDateBR(target?.booking_date)} às ${String(target?.start_time||'').slice(0,5)} para ${formatDateBR(rescheduled.booking_date)} às ${String(rescheduled.start_time).slice(0,5)}\n${rescheduled.service_name}`,url:'/admin-agenda.html?app=1',tag:`booking-rescheduled-${rescheduled.id}`}})}).catch(()=>{})
     next.pending_reschedule_booking_id=null
     next.pending_reschedule_new_date=null
     next.pending_reschedule_new_time=null
     next.date=null
     next.time=null
     next.period=null
    }
   }else if(simpleNo){
    reply='Tudo bem, não mudei nada. Seu agendamento continua como estava.'
    next.pending_reschedule_new_date=null
    next.pending_reschedule_new_time=null
    handoff=false
   }else{
    reply=`Só confirmando: você quer mudar seu agendamento de ${formatDateBR(target?.booking_date)} às ${String(target?.start_time||'').slice(0,5)} para ${formatDateBR(next.pending_reschedule_new_date)} às ${next.pending_reschedule_new_time}? Responda sim ou não.`
    actions=[{label:'Sim, remarcar',message:'Sim, pode remarcar'},{label:'Não, manter',message:'Não, manter o horário atual'}]
    handoff=false
   }
  }else if(!next.pending_reschedule_booking_id){
   if(!upcomingBookings.length){
    reply='Não encontrei nenhum agendamento futuro nesse número para remarcar.'
    handoff=false
   }else if(upcomingBookings.length===1){
    const b=upcomingBookings[0]
    next.pending_reschedule_booking_id=b.id
    reply=`Vamos remarcar seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} (${b.service_name}). Para qual dia e horário você quer mudar?`
    handoff=false
   }else{
    const matched=upcomingBookings.find((b:any)=>normalizedQuestion.includes(String(b.start_time).slice(0,5)))
    if(matched){
     next.pending_reschedule_booking_id=matched.id
     reply=`Vamos remarcar seu agendamento de ${formatDateBR(matched.booking_date)} às ${String(matched.start_time).slice(0,5)} (${matched.service_name}). Para qual dia e horário você quer mudar?`
     handoff=false
    }else{
     reply='Você tem mais de um agendamento futuro. Qual deles quer remarcar?\n'+upcomingBookings.map((b:any,i:number)=>`${i+1}. ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} — ${b.service_name}`).join('\n')
     actions=upcomingBookings.map((b:any)=>({label:`${formatDateBR(b.booking_date)} ${String(b.start_time).slice(0,5)}`,message:`Remarcar o de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)}`}))
     handoff=false
    }
   }
  }else{
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_reschedule_booking_id)
   if(!target){
    reply='Não encontrei mais esse agendamento — pode já ter sido cancelado. Se ainda quiser remarcar outro, me avise.'
    next.pending_reschedule_booking_id=null
    handoff=false
   }else if(!next.date){
    reply=`Para qual dia você quer mudar o agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)}?`
    handoff=false
   }else{
    const duration=wantsServiceChange?chosen.reduce((a:number,s:any)=>a+s.duration,0):(Number(target.duration_minutes)||30)
    const {data,error}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:duration})
    if(error)return respond({error:error.message},500)
    const allSlots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5))
    const time=extractRequestedTime(message)||next.time
    if(!time){
     if(!allSlots.length){
      reply=`Não encontrei horário disponível em ${formatDateBR(next.date)} para esse atendimento. Quer tentar outro dia?`
      next.date=null
     }else{
      reply=`Estes são os horários disponíveis em ${formatDateBR(next.date)}: ${allSlots.join(', ')}. Qual você prefere?`
      actions=allSlots.map((t:string)=>({label:t,message:t}))
     }
     handoff=false
    }else if(allSlots.includes(time)){
     next.pending_reschedule_new_date=next.date
     next.pending_reschedule_new_time=time
     reply=`Confirmando: mudar seu agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)} para ${formatDateBR(next.date)} às ${time}${wantsServiceChange?` e o serviço para ${desiredServiceName}`:''}? Responda sim ou não.`
     actions=[{label:'Sim, remarcar',message:'Sim, pode remarcar'},{label:'Não, manter',message:'Não, manter o horário atual'}]
     handoff=false
    }else{
     reply=allSlots.length?`${time} não está disponível em ${formatDateBR(next.date)}. Horários disponíveis: ${allSlots.join(', ')}.`:`Não encontrei horário disponível em ${formatDateBR(next.date)} para esse atendimento. Quer tentar outro dia?`
     actions=allSlots.map((t:string)=>({label:t,message:t}))
     next.time=null
     handoff=false
    }
   }
  }
 }

 // Adiciona/remove produto de um agendamento já confirmado (ex.: cliente
 // esqueceu de pedir a pomada e quer incluir depois) — não mexe em serviço,
 // dia ou horário, só na lista selected_products/products_price do registro.
 if(intent==='update_products'){
  // A ação (adicionar/remover) só é conhecida na mensagem que carrega
  // "produto"+"agendamento" — no turno seguinte, o cliente normalmente só
  // responde o nome do produto (sem repetir a ação), então precisa persistir
  // em next.pending_products_action pra não perder a informação.
  if(updateProductsAsk)next.pending_products_action=addProductAsk?'add':'remove'
  if(!verifiedPhone){
   reply='Para mexer no seu agendamento com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(next.pending_products_new_list){
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_products_booking_id)
   if(simpleYes&&!simpleNo){
    const {data:updatedRows,error:updateError}=await supabase.rpc('phone_update_booking_products',{p_phone:verifiedPhone,p_booking_id:next.pending_products_booking_id,p_selected_products:next.pending_products_new_list})
    const updated=Array.isArray(updatedRows)?updatedRows[0]:updatedRows
    if(updateError||!updated){
     reply='Não consegui atualizar os produtos agora. Se precisar, o Juliano confirma direto com você.'
     handoff=true
     next.pending_products_new_list=null
     next.pending_products_summary=null
    }else{
     reply=`Prontinho! Atualizei os produtos do seu agendamento de ${formatDateBR(updated.booking_date)} às ${String(updated.start_time).slice(0,5)}. ${next.pending_products_summary}`
     handoff=false
     const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
     const supabaseUrl=Deno.env.get('SUPABASE_URL')
     if(pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🛍️ Produtos do agendamento alterados pela JuIA',body:`${updated.customer_name||customerFirstName}\n${formatDateBR(updated.booking_date)} às ${String(updated.start_time).slice(0,5)}\n${next.pending_products_summary}`,url:'/admin-agenda.html?app=1',tag:`booking-products-${updated.id}`}})}).catch(()=>{})
     next.pending_products_booking_id=null
     next.pending_products_new_list=null
     next.pending_products_summary=null
     next.pending_products_action=null
    }
   }else if(simpleNo){
    reply='Tudo bem, não mudei nada nos produtos do seu agendamento.'
    handoff=false
    next.pending_products_booking_id=null
    next.pending_products_new_list=null
    next.pending_products_summary=null
    next.pending_products_action=null
   }else{
    reply=`Só confirmando: você quer ${next.pending_products_summary} no seu agendamento de ${formatDateBR(target?.booking_date)} às ${String(target?.start_time||'').slice(0,5)}? Responda sim ou não.`
    actions=[{label:'Sim, confirmar',message:'Sim, pode confirmar'},{label:'Não, deixar como está',message:'Não, deixar como está'}]
    handoff=false
   }
  }else if(!next.pending_products_booking_id){
   if(!upcomingBookings.length){
    reply='Não encontrei nenhum agendamento futuro nesse número.'
    handoff=false
   }else if(upcomingBookings.length===1){
    const b=upcomingBookings[0]
    next.pending_products_booking_id=b.id
    reply=`Sobre seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} (${b.service_name}): qual produto você quer ${next.pending_products_action==='add'?'adicionar':'tirar'}?`
    handoff=false
   }else{
    const matched=upcomingBookings.find((b:any)=>normalizedQuestion.includes(String(b.start_time).slice(0,5)))
    if(matched){
     next.pending_products_booking_id=matched.id
     reply=`Sobre seu agendamento de ${formatDateBR(matched.booking_date)} às ${String(matched.start_time).slice(0,5)} (${matched.service_name}): qual produto você quer ${next.pending_products_action==='add'?'adicionar':'tirar'}?`
     handoff=false
    }else{
     reply='Você tem mais de um agendamento futuro. Qual deles?\n'+upcomingBookings.map((b:any,i:number)=>`${i+1}. ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} — ${b.service_name}`).join('\n')
     actions=upcomingBookings.map((b:any)=>({label:`${formatDateBR(b.booking_date)} ${String(b.start_time).slice(0,5)}`,message:`É o de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)}`}))
     handoff=false
    }
   }
  }else{
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_products_booking_id)
   if(!target){
    reply='Não encontrei mais esse agendamento — pode já ter sido cancelado.'
    next.pending_products_booking_id=null
    handoff=false
   }else{
    const wantsRemove=next.pending_products_action==='remove'
    const productText=message
     .replace(/adicionar|incluir|colocar|tirar|remover|excluir|produto|no meu agendamento|no agendamento|ao agendamento|do agendamento|do meu agendamento|no meu horario marcado|nesse agendamento|desse agendamento|no meu horario/gi,'')
     .trim()
    const product=findProduct(productText)||findProduct(message)
    const current=Array.isArray(target.selected_products)?target.selected_products:[]
    if(!product){
     reply=`Qual produto você quer ${wantsRemove?'tirar':'adicionar'}?`
     handoff=false
    }else if(wantsRemove){
     const stillThere=current.filter((p:any)=>normalize(String(p?.name))!==normalize(product.name))
     if(stillThere.length===current.length){
      reply=`Esse agendamento não tem "${product.name}" reservado. Quer tentar outro produto?`
      handoff=false
     }else{
      next.pending_products_new_list=stillThere
      next.pending_products_summary=`tirar ${product.name}`
      reply=`Confirmando: tirar "${product.name}" do seu agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)}? Responda sim ou não.`
      actions=[{label:'Sim, tirar',message:'Sim, pode confirmar'},{label:'Não, manter',message:'Não, deixar como está'}]
      handoff=false
     }
    }else{
     if(current.some((p:any)=>normalize(String(p?.name))===normalize(product.name))){
      reply=`"${product.name}" já está reservado nesse agendamento. Quer adicionar outro produto?`
      handoff=false
     }else{
      next.pending_products_new_list=[...current,{name:product.name,price:product.price}]
      next.pending_products_summary=`adicionar ${product.name} (${money(product.price)})`
      reply=`Confirmando: adicionar "${product.name}" (${money(product.price)}) ao seu agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)}? Responda sim ou não.`
      actions=[{label:'Sim, adicionar',message:'Sim, pode confirmar'},{label:'Não, deixar como está',message:'Não, deixar como está'}]
      handoff=false
     }
    }
   }
  }
 }

 // Troca só o serviço do agendamento (service_name/price/duration_minutes),
 // preservando dia e horário — não mexe em booking_date/start_time. "desired"
 // só é lido de swapTailService (extraído direto desta mensagem via regex) ou
 // de chosen[0] quando o próprio modelo classificou esta mensagem como
 // change_service (ai.intent, não o "intent" já reclassificado por regex) —
 // nunca de chosen[0] "sobrando" de um fluxo de agendamento novo anterior na
 // mesma conversa, que poderia estar desatualizado.
 if(intent==='change_service'){
  const desiredFresh=swapTailService||(ai.intent==='change_service'?chosen[0]:null)||null
  if(!verifiedPhone){
   reply='Para trocar o serviço com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(next.pending_change_service_new_name){
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_change_service_booking_id)
   const desired=findService(next.pending_change_service_new_name)
   if(simpleYes&&!simpleNo){
    if(!desired){
     reply='Não reconheci esse serviço. Qual serviço você quer no lugar?'
     next.pending_change_service_new_name=null
     handoff=false
    }else{
     const {data:changedRows,error:changeError}=await supabase.rpc('phone_change_booking_service',{p_phone:verifiedPhone,p_booking_id:next.pending_change_service_booking_id,p_service_name:desired.name,p_service_price:desired.price,p_duration_minutes:desired.duration})
     const changed=Array.isArray(changedRows)?changedRows[0]:changedRows
     if(changeError||!changed){
      reply='Não consegui trocar o serviço agora — esse serviço pode não caber mais nesse horário. Quer tentar outro serviço ou outro horário?'
      handoff=false
      next.pending_change_service_new_name=null
     }else{
      reply=`Prontinho! Troquei o serviço do seu agendamento de ${formatDateBR(changed.booking_date)} às ${String(changed.start_time).slice(0,5)} para ${changed.service_name} (${money(changed.service_price)}).`
      handoff=false
      const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
      const supabaseUrl=Deno.env.get('SUPABASE_URL')
      if(pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🔧 Serviço do agendamento trocado pela JuIA',body:`${changed.customer_name||customerFirstName}\n${formatDateBR(changed.booking_date)} às ${String(changed.start_time).slice(0,5)}\nDe ${target?.service_name||'?'} para ${changed.service_name}`,url:'/admin-agenda.html?app=1',tag:`booking-service-changed-${changed.id}`}})}).catch(()=>{})
      next.pending_change_service_booking_id=null
      next.pending_change_service_new_name=null
      next.services=[]
     }
    }
   }else if(simpleNo){
    reply='Tudo bem, não troquei nada. Seu agendamento continua como estava.'
    next.pending_change_service_new_name=null
    handoff=false
   }else{
    reply=`Só confirmando: você quer trocar o serviço do seu agendamento de ${formatDateBR(target?.booking_date)} às ${String(target?.start_time||'').slice(0,5)}, de "${target?.service_name}" para "${desired?.name||next.pending_change_service_new_name}"${desired?` (${money(desired.price)}, ${desired.duration} min)`:''}? Responda sim ou não.`
    actions=[{label:'Sim, trocar',message:'Sim, pode trocar'},{label:'Não, manter',message:'Não, manter o serviço atual'}]
    handoff=false
   }
  }else if(!next.pending_change_service_booking_id){
   if(!upcomingBookings.length){
    reply='Não encontrei nenhum agendamento futuro nesse número para trocar o serviço.'
    handoff=false
   }else if(upcomingBookings.length===1){
    const b=upcomingBookings[0]
    next.pending_change_service_booking_id=b.id
    reply=`Vamos trocar o serviço do seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} (atualmente ${b.service_name}). Qual serviço você quer no lugar?`
    handoff=false
   }else{
    const matched=upcomingBookings.find((b:any)=>normalizedQuestion.includes(String(b.start_time).slice(0,5)))
    if(matched){
     next.pending_change_service_booking_id=matched.id
     reply=`Vamos trocar o serviço do seu agendamento de ${formatDateBR(matched.booking_date)} às ${String(matched.start_time).slice(0,5)} (atualmente ${matched.service_name}). Qual serviço você quer no lugar?`
     handoff=false
    }else{
     reply='Você tem mais de um agendamento futuro. Qual deles quer trocar o serviço?\n'+upcomingBookings.map((b:any,i:number)=>`${i+1}. ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} — ${b.service_name}`).join('\n')
     actions=upcomingBookings.map((b:any)=>({label:`${formatDateBR(b.booking_date)} ${String(b.start_time).slice(0,5)}`,message:`Trocar o serviço do de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)}`}))
     handoff=false
    }
   }
  }else{
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_change_service_booking_id)
   if(!target){
    reply='Não encontrei mais esse agendamento — pode já ter sido cancelado. Se ainda quiser trocar o serviço de outro, me avise.'
    next.pending_change_service_booking_id=null
    handoff=false
   }else if(!desiredFresh){
    reply=`Qual serviço você quer no lugar de "${target.service_name}"?`
    handoff=false
   }else if(normalize(desiredFresh.name)===normalize(target.service_name)){
    reply=`Seu agendamento já é para ${target.service_name}. Se quiser outro serviço, me diga qual.`
    handoff=false
   }else{
    next.pending_change_service_new_name=desiredFresh.name
    reply=`Confirmando: trocar o serviço do seu agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)}, de "${target.service_name}" para "${desiredFresh.name}" (${money(desiredFresh.price)}, ${desiredFresh.duration} min)? Responda sim ou não.`
    actions=[{label:'Sim, trocar',message:'Sim, pode trocar'},{label:'Não, manter',message:'Não, manter o serviço atual'}]
    handoff=false
   }
  }
 }

 // Agendamentos duplicados no mesmo dia (ex.: cliente já tinha um horário marcado
 // em outro canal e acabou marcando outro sem querer pela JuIA) — pergunta qual
 // manter e cancela o outro sozinha, em vez de deixar os dois ativos até um deles
 // virar falta (foi exatamente o que aconteceu com um cliente: 13:30 e 14:15 no
 // mesmo dia, os dois marcados como ausência).
 const bookingsByDate:Record<string,any[]>={}
 upcomingBookings.forEach((b:any)=>{(bookingsByDate[b.booking_date]=bookingsByDate[b.booking_date]||[]).push(b)})
 const duplicateGroup=(Object.values(bookingsByDate) as any[][]).find(arr=>arr.length>1)

 if(duplicateGroup&&verifiedPhone&&!next.keep_both_bookings&&intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'){
  const timeA=String(duplicateGroup[0].start_time).slice(0,5),timeB=String(duplicateGroup[1].start_time).slice(0,5)
  if(Array.isArray(next.pending_duplicate_ids)&&next.pending_duplicate_ids.length===2){
   const [idA,idB]=next.pending_duplicate_ids
   const bA=upcomingBookings.find((b:any)=>b.id===idA)||duplicateGroup[0]
   const bB=upcomingBookings.find((b:any)=>b.id===idB)||duplicateGroup[1]
   const keepsA=normalizedQuestion.includes(String(bA.start_time).slice(0,5))||normalizedQuestion.includes('primeiro')
   const keepsB=normalizedQuestion.includes(String(bB.start_time).slice(0,5))||normalizedQuestion.includes('segundo')
   if(keepBothRequest){
    next.keep_both_bookings=true
    next.pending_duplicate_ids=null
    reply='Combinado, vou manter os dois agendamentos.'
    intent='other';handoff=false
   }else if(keepsA||keepsB){
    const keep=keepsA?bA:bB,toCancel=keepsA?bB:bA
    const {data:cancelledRows}=await supabase.rpc('whatsapp_cancel_booking',{p_phone:verifiedPhone,p_booking_id:toCancel.id})
    const cancelled=Array.isArray(cancelledRows)?cancelledRows[0]:cancelledRows
    if(cancelled){
     reply=`Prontinho! Cancelei o agendamento das ${String(toCancel.start_time).slice(0,5)} e mantive o das ${String(keep.start_time).slice(0,5)}.`
     const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET'),supabaseUrl=Deno.env.get('SUPABASE_URL')
     if(pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'❌ Agendamento duplicado cancelado pela JuIA',body:`${customerFirstName||'Cliente'} tinha 2 horários em ${formatDateBR(toCancel.booking_date)} — mantido ${String(keep.start_time).slice(0,5)}, cancelado ${String(toCancel.start_time).slice(0,5)}.`,url:'/admin-agenda.html?app=1',tag:`booking-dup-${toCancel.id}`}})}).catch(()=>{})
    }else{
     reply='Não consegui cancelar agora. O Juliano vai confirmar direto com você.'
     handoff=true
    }
    next.pending_duplicate_ids=null
    intent='other'
   }else{
    reply=`Só pra confirmar: você quer manter o horário das ${timeA} ou das ${timeB}?`
    actions=[{label:`Manter ${timeA}`,message:`Quero manter o das ${timeA}`},{label:`Manter ${timeB}`,message:`Quero manter o das ${timeB}`}]
    intent='other';handoff=false
   }
  }else{
   next.pending_duplicate_ids=[duplicateGroup[0].id,duplicateGroup[1].id]
   reply=`Notei que você tem dois agendamentos marcados para ${formatDateBR(duplicateGroup[0].booking_date)}: às ${timeA} (${duplicateGroup[0].service_name}) e às ${timeB} (${duplicateGroup[1].service_name}). Qual dos dois você quer manter? Vou cancelar o outro.`
   actions=[{label:`Manter ${timeA}`,message:`Quero manter o das ${timeA}`},{label:`Manter ${timeB}`,message:`Quero manter o das ${timeB}`},{label:'Manter os dois',message:'Quero manter os dois agendamentos'}]
   intent='other';handoff=false
  }
 }

 // "activelyBooking" separa quem já está de fato agendando (escolheu serviço, pediu
 // disponibilidade, ou já tem uma data em andamento) de quem só fez uma pergunta solta
 // (ex.: "quanto custa o corte de cabelo?", que também casa serviço via findServicesLoose
 // mas não deveria disparar as perguntas de upsell abaixo). Calculado só aqui (depois do
 // cancelamento/reagendamento/troca de serviço/duplicados já estarem resolvidos) porque
 // "intent" só fica definitivo depois desses blocos.
 const activelyBooking=['services','availability','book'].includes(intent)||Boolean(next.date)
 const notSpecialFlow=intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&!next.completed

 // Pedido do Juliano: "Corte de cabelo" sozinho (R$40) sempre oferece o upgrade pro
 // "Corte + Lavagem" (R$50, lavagem profissional incluída) antes de seguir — melhora o
 // ticket médio. Só pergunta uma vez por conversa (next.haircut_wash_asked) e não
 // dispara se já for combo ou já tiver a lavagem escolhida.
 let hairWashJustAsked=false
 const hasPlainHaircut=chosen.some((s:any)=>s.name==='Corte de cabelo')
 const hasWashOrCombo=chosen.some((s:any)=>['Corte + Lavagem','Corte + Barboterapia','Corte + Barba Express'].includes(s.name))
 if(notSpecialFlow&&activelyBooking&&hasPlainHaircut&&!hasWashOrCombo&&!next.haircut_wash_asked){
  if(includesAny(normalizedQuestion,['com lavagem','quero lavagem','pode ser com lavagem','corte e lavagem','corte com lavagem'])){
   next.services=next.services.map((n:string)=>n==='Corte de cabelo'?'Corte + Lavagem':n)
   const idx=chosen.findIndex((s:any)=>s.name==='Corte de cabelo')
   if(idx>=0)chosen[idx]=findService('Corte + Lavagem')
   next.haircut_wash_asked=true
  }else if(includesAny(normalizedQuestion,['so o corte','só o corte','sem lavagem','so corte','apenas o corte','nao quero lavagem'])){
   next.haircut_wash_asked=true
  }else{
   next.haircut_wash_asked=true
   hairWashJustAsked=true
   reply='Prefere só o corte ou o Corte + Lavagem — com lavagem profissional incluída para um acabamento mais completo — por R$ 50,00?'
   actions=[{label:'Só o corte · R$ 40',message:'Só o corte'},{label:'Corte + Lavagem · R$ 50',message:'Quero com lavagem'}]
   intent='other';handoff=false
  }
 }

 // Pedido do Juliano: sempre perguntar por complementos (barba, sobrancelha, depilação
 // nasal etc.) antes de concluir o agendamento. Antes disso dependia do modelo escolher
 // sozinho intent "upsell_services", ou de next.sales_stage==='services_selected' — que
 // nunca era setado em lugar nenhum do código, então essa pergunta praticamente nunca
 // aparecia de forma confiável. Agora dispara de forma determinística, uma única vez
 // (next.upsell_services_done), sem repetir a pergunta do corte+lavagem no mesmo turno.
 let servicesUpsellJustAsked=false
 if(chosen.length&&!next.upsell_services_done&&!hairWashJustAsked&&activelyBooking&&notSpecialFlow){
  const sug=serviceSuggestions(chosen)
  next.upsell_services_done=true
  if(sug.length){
   reply=`Quer aproveitar e incluir algum complemento, como ${sug.map((s:any)=>s.name).join(', ')}?`
   actions=sug.map((s:any)=>({label:`${s.name} · +${money(s.price)}`,message:`Adicionar ${s.name}`}))
   actions.push({label:'Não, só isso',message:'Não quero serviço adicional'})
   intent='other';handoff=false
   servicesUpsellJustAsked=true
  }
 }
 let productsUpsellJustAsked=false
 if(chosen.length&&next.upsell_services_done&&!next.upsell_products_done&&!hairWashJustAsked&&!servicesUpsellJustAsked&&activelyBooking&&notSpecialFlow){
  const sug=productSuggestions(chosen,context)
  next.upsell_products_done=true
  if(sug.length){
   reply='Posso deixar algum produto separado para você retirar no atendimento?'
   actions=sug.map(p=>({label:`${p.name} · ${money(p.price)}`,message:`Adicionar produto ${p.name}`}))
   actions.push({label:'Não, continuar',message:'Não quero produto'})
   intent='other';handoff=false
   productsUpsellJustAsked=true
  }
 }
 // Depois de resolvidas as perguntas de corte+lavagem/complementos/produtos (nenhuma
 // delas perguntou nada neste turno), retoma o fluxo normal de agendamento sozinha —
 // sem isso, a conversa ficava parada esperando o modelo "adivinhar" que devia seguir
 // pra checar disponibilidade depois de um simples "não, só isso"/"não quero produto".
 if(chosen.length&&next.upsell_services_done&&next.upsell_products_done&&!hairWashJustAsked&&!servicesUpsellJustAsked&&!productsUpsellJustAsked&&activelyBooking&&notSpecialFlow&&intent!=='book'){
  intent='availability'
 }

 const requestedPeriod=detectPeriod(normalizedQuestion)
 // cliente pode dizer o período antes mesmo de ter escolhido o serviço (ex.: "tem
 // horário hoje a tarde?" seguido de "corte de cabelo") — sem lembrar isso, a JuIA
 // perguntava de novo "manhã, tarde ou final do dia?" ignorando o que já foi dito.
 if(requestedPeriod)next.period=requestedPeriod
 const effectivePeriod=requestedPeriod||next.period
 const requestedTime=extractRequestedTime(message)
 // Mesma lógica do período: se o cliente já tinha dito o horário antes das perguntas de
 // corte+lavagem/complementos/produtos entrarem no meio da conversa, não precisa repetir —
 // usa o horário já guardado em next.time enquanto o agendamento ainda não foi concluído.
 const effectiveTime=requestedTime||(next.completed?'':next.time||'')
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&(requestedPeriod||requestedTime)&&next.date&&chosen.length)intent='availability'

 // Pergunta genérica de disponibilidade ("tem horário agora?", "tem vaga hoje?") não é
 // motivo de handoff — a JuIA sabe checar a agenda sozinha. Sem isso, faltando serviço
 // e/ou data, a resposta ficava só por conta do modelo, que às vezes preferia encaminhar
 // pro Juliano em vez de perguntar o que faltava.
 const availabilityAsk=includesAny(normalizedQuestion,['tem horario','tem vaga','horario livre','horario disponivel','algum horario','horario vago','agenda aberta','vaga agora','vaga hoje'])
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&availabilityAsk){
  if(!next.date&&includesAny(normalizedQuestion,['agora','hoje']))next.date=today()
  intent='availability'
  handoff=false
 }
 if(keepBothRequest){next.keep_both_bookings=true}

 if(intent==='availability'&&!chosen.length){
  reply=`Claro! Qual serviço você tem interesse? Assim já confiro os horários certinhos${next.date?` para ${formatDateBR(next.date)}`:''} pra você.`
  actions=[{label:'Ver serviços',url:'https://www.barbeariadoju.com.br/agendar/'}]
  handoff=false
 }else if(intent==='availability'&&chosen.length&&!next.date){
  reply=`Perfeito! Anotei ${chosen.map((s:any)=>s.name).join(' + ')}. Para qual dia você quer ver os horários?`
  handoff=false
 }else if(intent==='availability'&&next.date&&chosen.length){
  // Cliente já tem outro agendamento confirmado em dia diferente do que está pedindo
  // agora — sem essa checagem, ele podia acabar com dois horários marcados sem querer
  // (ou receber "esse horário ficou indisponível" tentando remarcar o próprio horário).
  const conflicting=upcomingBookings.find((b:any)=>b.booking_date!==next.date)
  if(conflicting&&!next.keep_both_bookings){
   next.pending_cancel_booking_id=conflicting.id
   reply=`Antes de continuar: você já tem um agendamento confirmado para ${formatDateBR(conflicting.booking_date)} às ${String(conflicting.start_time).slice(0,5)} (${conflicting.service_name}). Quer que eu cancele esse já que vai escolher outro dia, quer que eu mude esse agendamento pro novo horário, ou prefere manter os dois?`
   actions=[{label:'Mudar pro novo horário',message:'Sim, pode reagendar'},{label:'Cancelar o outro',message:'Sim, pode cancelar'},{label:'Manter os dois',message:'Quero manter os dois agendamentos'}]
   handoff=false
  }else{
  const duration=chosen.reduce((a:number,s:any)=>a+s.duration,0)
  const serviceNames=chosen.map((s:any)=>s.name).join(' + ')
  const {data,error}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:duration})
  if(error)return respond({error:error.message},500)
  const allSlots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5))

  if(!allSlots.length){
   reply='Não encontrei horário nessa data para todos os serviços. Quer verificar outro dia?'
  }else if(effectiveTime){
   // Antes de dizer "não está disponível", checa se o motivo é que o próprio cliente já
   // tem um agendamento confirmado bem nesse dia/horário (ex.: o Juliano acabou de criar
   // manualmente pelo admin enquanto a conversa seguia em paralelo) — sem isso, a JuIA
   // rejeitava um horário que na verdade já era do próprio cliente, confundindo-o (caso
   // real 29/07/2026, Juliano precisou apagar a resposta da JuIA e confirmar manualmente).
   const ownExisting=upcomingBookings.find((b:any)=>b.booking_date===next.date&&String(b.start_time).slice(0,5)===effectiveTime)
   if(ownExisting){
    reply=`Você já está confirmado para ${formatDateBR(ownExisting.booking_date)} às ${effectiveTime} (${ownExisting.service_name}). Pode vir tranquilo, te esperamos!`
    actions=[]
    handoff=false
   }else if(allSlots.includes(effectiveTime)){
    reply=`Sim, ${effectiveTime} está disponível para esse atendimento de ${duration} minutos. Quer reservar esse horário?`
    actions=[{label:`Reservar ${effectiveTime}`,message:`Quero reservar ${effectiveTime}`}]
    next.time=effectiveTime
   }else{
    const samePeriod=slotsForPeriod(allSlots,slotHour(effectiveTime)<12?'morning':slotHour(effectiveTime)<18?'afternoon':'evening')
    const alternatives=(samePeriod.length?samePeriod:allSlots)
    reply=`${effectiveTime} não está disponível para esse atendimento. Estes são os horários disponíveis no mesmo período: ${alternatives.join(', ')}.`
    actions=alternatives.map((t:string)=>({label:t,message:t}))
   }
  }else if(effectivePeriod){
   const periodSlots=slotsForPeriod(allSlots,effectivePeriod)
   if(periodSlots.length){
    reply=`No período da ${periodLabel(effectivePeriod)}, estes são todos os horários disponíveis para ${duration} minutos: ${periodSlots.join(', ')}. Qual você prefere?`
    actions=periodSlots.map((t:string)=>({label:t,message:t}))
   }else{
    reply=`Não há horários disponíveis no período da ${periodLabel(effectivePeriod)} nessa data. Posso mostrar outro período ou verificar outro dia.`
    actions=[
     {label:'Ver manhã',message:'Prefiro manhã'},
     {label:'Ver tarde',message:'Prefiro tarde'},
     {label:'Ver final do dia',message:'Prefiro final do dia'}
    ]
   }
  }else if(allSlots.length>10){
   reply=`Tenho ${allSlots.length} horários disponíveis para ${serviceNames} (${duration} min). Você prefere manhã, tarde ou final do dia?`
   actions=[
    {label:'Manhã',message:'Prefiro manhã'},
    {label:'Tarde',message:'Prefiro tarde'},
    {label:'Final do dia',message:'Prefiro final do dia'}
   ]
  }else{
   reply=`Para ${serviceNames}, estes são todos os horários disponíveis: ${allSlots.join(', ')}. Qual você prefere?`
   actions=allSlots.map((t:string)=>({label:t,message:t}))
  }
  }
 }
 if(intent==='book'){
  const conflicting=upcomingBookings.find((b:any)=>b.booking_date===next.date)
  if(conflicting&&!next.keep_both_bookings){
   next.pending_cancel_booking_id=conflicting.id
   reply=`Só confirmando: você já tem um agendamento para ${formatDateBR(conflicting.booking_date)} às ${String(conflicting.start_time).slice(0,5)} (${conflicting.service_name}). É esse mesmo que você quer (mudar pro novo horário ${next.time?`de ${next.time}`:'que você pediu'}), é um novo horário além desse, ou quer cancelar o antigo?`
   actions=[{label:'Mudar pro novo horário',message:'Sim, pode reagendar'},{label:'É outro, manter os dois',message:'Quero manter os dois agendamentos'},{label:'Cancelar o antigo',message:'Sim, pode cancelar'}]
   intent='other'
   handoff=false
  }else if(!next.name&&contextFullName){
   // O telefone tem cadastro, mas isso não garante que o agendamento é pra quem está
   // digitando agora — número pode ser compartilhado (ex.: da última vez agendou pro
   // primo com esse mesmo WhatsApp). Confirma antes de assumir; assim que confirmado,
   // next.name fica preenchido e este bloco não roda de novo nesta conversa.
   if(simpleYes&&!simpleNo){
    next.name=contextFullName
   }else{
    reply=`Posso confirmar esse agendamento no nome de ${firstName(contextFullName)}? Se for para outra pessoa, me diga o nome dela.`
    actions=[{label:'Sim, é pra mim',message:'Sim'},{label:'É para outra pessoa',message:'É para outra pessoa'}]
    intent='other'
    handoff=false
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
 }
 // Saudação sempre determinística (Bom dia/Boa tarde/Boa noite), nunca deixada por conta
 // do modelo — ele às vezes pulava direto pra responder o pedido do cliente sem cumprimentar,
 // mesmo instruído a fazer isso (caso real: cliente perguntou disponibilidade já na primeira
 // mensagem, a JuIA respondeu "Sim, 14:30 está disponível..." sem nenhuma saudação antes).
 // Nome: prioriza o cadastro confirmado no CRM (mais confiável); sem isso, usa o nome salvo
 // no contato do WhatsApp de quem está escrevendo (verified_phone/whatsapp_name, só existe
 // no canal WhatsApp); sem nenhum dos dois, cumprimenta sem nome (não adivinha "senhor" ou
 // "senhora" sem saber o nome).
 if(isFirstMessage){
  const crmName=hasCustomer?String(context?.name||'').trim():''
  const greetName=crmName?firstName(crmName):(String(body?.whatsapp_name||'').trim()?firstName(String(body.whatsapp_name)):'')
  reply=`${greetingNow()}${greetName?`, ${greetName}`:''}! ${reply}`
 }
 await supabase.from('site_chat_messages').insert([{session_id:sessionId,role:'user',content:message,state},{session_id:sessionId,role:'assistant',content:reply,state:next,intent}]).then(()=>{})
 return respond({reply,intent,state:next,actions,handoff})
})

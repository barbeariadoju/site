import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}})
// v29.62.0 — regra das famílias de serviço (1 corte + 1 barba por atendimento), mesma
// lógica do site (assets/js/service-rules.js). Ver o bloco "serviceRuleNote" abaixo.
import { normalizeServiceSet as normalizeServiceFamilies } from '../_shared/service-rules.ts'
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
// v29.43.0: nome do WhatsApp pode ser so emoji/simbolo ("🤓") — nesse caso nao ha primeiro nome
// util e e melhor nao usar nada do que escrever "Oi, 🤓!" (caso real, 15/08/2026).
const firstName=(value:any)=>{const f=String(value||'').trim().split(/\s+/)[0]||'';return /\p{L}/u.test(f)?f:'cliente'}
// v29.51.0 — caso Stevan (19/08): "com 43 horários" expõe agenda vazia pro cliente.
// NUNCA dizer quantidade de horários nem despejar a lista inteira: amostra espalhada
// de até 4 (mesmo padrão do v29.43.0) e o cliente responde qualquer horário.
const slotsSample=(slots:string[])=>[slots[0],slots[Math.floor(slots.length/3)],slots[Math.floor(slots.length*2/3)],slots[slots.length-1]].filter((v,i,a)=>!!v&&a.indexOf(v)===i)
const slotsPhrase=(slots:string[])=>slots.length<=4?slots.join(', '):`entre ${slots[0]} e ${slots[slots.length-1]} — por exemplo ${slotsSample(slots).join(', ')}`
// v29.69.0 — o jeito humano de dizer a data ("hoje", "amanhã", "terça (25/08)") virou
// função: a troca determinística do fim do arquivo já fazia isso na resposta do modelo, mas
// o código que monta resposta própria não tinha como usar — e por isso as frases de horário
// simplesmente NÃO diziam o dia. Caso real (sábado 22/08/2026): a JuIA listou os horários da
// TERÇA sem dizer que era terça, logo depois de dizer que hoje não tinha nada; o cliente
// perguntou "Hoje?", a IA regerou a mesma frase e a conversa morreu no "me embolei".
const diaHumano=(iso:string)=>{
 const t=today()
 if(iso===t)return 'hoje'
 const amanha=new Date(new Date(t+'T12:00:00-03:00').getTime()+86400000).toISOString().slice(0,10)
 if(iso===amanha)return 'amanhã'
 const dt=new Date(iso+'T12:00:00-03:00')
 if(isNaN(dt.getTime()))return ''
 const wd=['domingo','segunda','terça','quarta','quinta','sexta','sábado'][dt.getUTCDay()]
 return `${wd} (${iso.slice(8,10)}/${iso.slice(5,7)})`
}
// "hoje"/"amanhã" não pedem preposição; dia da semana pede ("na terça (25/08)").
const emDia=(iso:string)=>{const h=diaHumano(iso);return (!h||h==='hoje'||h==='amanhã')?h:`na ${h}`}
const emDiaCap=(iso:string)=>{const d=emDia(iso);return d?d.charAt(0).toUpperCase()+d.slice(1):''}
// "19:00" no meio de uma frase falada soa a sistema; gente diz "19h" e "14h30".
const horaFalada=(hhmm:string)=>{const [h,m]=String(hhmm||'').split(':');return m==='00'?`${Number(h)}h`:`${Number(h)}h${m}`}
// Domingo e segunda a barbearia não abre — dizer "não tenho horário" nesses dias soa a
// agenda cheia e faz o cliente insistir. O motivo verdadeiro é melhor resposta.
const semVagaTxt=(iso:string)=>{
 const wd=new Date(iso+'T12:00:00-03:00').getUTCDay()
 return (wd===0||wd===1)?`${emDiaCap(iso)} a gente não abre`:`${emDiaCap(iso)} não tenho horário`
}
const WEEKDAY_NAMES=['domingo','segunda','terca','quarta','quinta','sexta','sabado']
// Dias citados pelo NOME na mesma frase ("segunda-feira, terça-feira e quarta-feira"), já
// convertidos na próxima ocorrência de cada um a partir de hoje. O modelo tem UM campo
// updates.date: diante de três dias ele devolve null, e a JuIA repetia "para qual dia?"
// (caso Tiago, 24/08/2026) até o anti-papagaio do whatsapp-webhook cortar a conversa.
const weekdayDatesMentioned=(text:string,fromISO:string)=>{
 const wanted=WEEKDAY_NAMES.map((n,i)=>new RegExp(`\\b${n}s?(-feira)?\\b`).test(text)?i:-1).filter(i=>i>=0)
 if(!wanted.length)return []
 const base=new Date(fromISO+'T12:00:00-03:00')
 const out:string[]=[]
 for(const wd of wanted){
  const d=new Date(base.getTime())
  for(let i=0;i<7;i++){
   if(d.getUTCDay()===wd){out.push(d.toISOString().slice(0,10));break}
   d.setUTCDate(d.getUTCDate()+1)
  }
 }
 return out.sort()
}

const fetchWithTimeout=async(url:string,init:RequestInit,timeoutMs=8000)=>{
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),timeoutMs)
 try{return await fetch(url,{...init,signal:controller.signal})}
 finally{clearTimeout(timeout)}
}

// v28.36.0 (item 2): cliente manda um LINK em vez de escrever (post de Instagram/TikTok
// com uma foto de referência, ou qualquer outra página). Antes disso a JuIA só recusava
// educadamente, sem tentar ver nada. Guarda contra SSRF: só http/https, bloqueia hostname
// literal privado/loopback/link-local/metadados de nuvem por string (checagem síncrona,
// sempre ativa) + tenta resolver DNS e bloquear se o IP resolvido for privado (proteção
// extra "melhor esforço" — se Deno.resolveDns não estiver disponível no runtime, ignora
// essa camada em vez de quebrar o recurso inteiro pra domínios públicos normais). Cada
// redirect é revalidado do zero antes de seguir.
const isPrivateOrReservedIp=(ip:string):boolean=>{
 if(ip.includes('.')){
  const p=ip.split('.').map(Number)
  if(p.length!==4||p.some(n=>Number.isNaN(n)))return true
  const [a,b]=p
  if(a===10||a===127||a===0)return true
  if(a===169&&b===254)return true
  if(a===172&&b>=16&&b<=31)return true
  if(a===192&&b===168)return true
  if(a===100&&b>=64&&b<=127)return true
  return false
 }
 const lower=ip.toLowerCase()
 if(lower==='::1'||lower==='::')return true
 if(/^fe[89ab][0-9a-f]:/.test(lower))return true
 if(/^f[cd][0-9a-f]{2}:/.test(lower))return true
 return false
}
const isObviouslyPrivateHostname=(hostname:string):boolean=>{
 const lower=hostname.toLowerCase()
 if(lower==='localhost'||lower.endsWith('.local')||lower.endsWith('.internal')||lower==='metadata.google.internal')return true
 if(/^[0-9.]+$/.test(hostname)||hostname.includes(':'))return isPrivateOrReservedIp(hostname)
 return false
}
const isPrivateHostByDns=async(hostname:string):Promise<boolean>=>{
 try{
  // @ts-ignore — Deno.resolveDns pode não existir/ser permitido neste runtime; falha
  // silenciosamente (não bloqueia domínio público nenhum se a checagem não for possível).
  const a=await Deno.resolveDns(hostname,'A').catch(()=>[])
  // @ts-ignore
  const aaaa=await Deno.resolveDns(hostname,'AAAA').catch(()=>[])
  const ips=[...(a||[]),...(aaaa||[])]
  return ips.length>0&&ips.some(isPrivateOrReservedIp)
 }catch{return false}
}
const MAX_LINK_BYTES=800000
const MAX_IMAGE_BYTES=6000000
async function fetchSafely(startUrl:string,maxBytes:number,timeoutMs=8000):Promise<{finalUrl:string,contentType:string,bytes:Uint8Array}|null>{
 let currentUrl=startUrl
 for(let hop=0;hop<5;hop++){
  let parsed:URL
  try{parsed=new URL(currentUrl)}catch{return null}
  if(parsed.protocol!=='http:'&&parsed.protocol!=='https:')return null
  if(isObviouslyPrivateHostname(parsed.hostname))return null
  if(await isPrivateHostByDns(parsed.hostname))return null
  let resp:Response
  try{
   resp=await fetchWithTimeout(currentUrl,{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (compatible; BarbeariaDoJuBot/1.0)'}},timeoutMs)
  }catch{return null}
  if([301,302,303,307,308].includes(resp.status)){
   const loc=resp.headers.get('location')
   if(!loc)return null
   try{currentUrl=new URL(loc,currentUrl).toString()}catch{return null}
   continue
  }
  if(!resp.ok)return null
  const contentLength=Number(resp.headers.get('content-length')||0)
  if(contentLength&&contentLength>maxBytes)return null
  const contentType=resp.headers.get('content-type')||''
  const buf=await resp.arrayBuffer().catch(()=>null)
  if(!buf)return null
  const bytes=new Uint8Array(buf).slice(0,maxBytes)
  return{finalUrl:currentUrl,contentType,bytes}
 }
 return null
}
const metaTag=(html:string,prop:string):string=>{
 const re=new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,'i')
 const m=html.match(re)
 return m?m[1].trim():''
}
async function describeImageFromBytes(bytes:Uint8Array,contentType:string,openaiKey:string):Promise<string>{
 let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i])
 const base64=btoa(binary)
 const visionPrompt='Você ajuda uma barbearia a entender fotos de referência enviadas por clientes. Descreva em português do Brasil, em até 2 frases objetivas, o corte de cabelo, estilo de barba ou coloração capilar mostrado na imagem, com detalhes úteis pra um barbeiro entender o que o cliente quer (comprimento, tipo de degradê, risco, formato da barba, técnica de cor etc.). Não sugira nome de serviço nem preço. Se a imagem não mostrar claramente um corte de cabelo, barba ou coloração capilar em uma pessoa, responda SOMENTE o texto NAO_RELACIONADO, sem mais nada.'
 const r=await fetchWithTimeout('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',reasoning:{effort:'low'},max_output_tokens:250,instructions:visionPrompt,input:[{role:'user',content:[{type:'input_image',image_url:`data:${contentType||'image/jpeg'};base64,${base64}`}]}]})},15000).catch(()=>null)
 if(!r||!r.ok)return ''
 const d=await r.json().catch(()=>({}))
 return textFrom(d)
}
async function describeLinkContent(rawUrl:string,openaiKey:string):Promise<string|null>{
 const page=await fetchSafely(rawUrl,MAX_LINK_BYTES,8000)
 if(!page||!page.contentType.includes('text/html'))return null
 const html=new TextDecoder().decode(page.bytes)
 const ogImage=metaTag(html,'og:image')
 const ogTitle=metaTag(html,'og:title')
 const ogDesc=metaTag(html,'og:description')
 const titleMatch=html.match(/<title[^>]*>([^<]*)<\/title>/i)
 const plainTitle=titleMatch?titleMatch[1].trim():''
 const title=ogTitle||plainTitle
 const description=ogDesc

 if(ogImage&&openaiKey){
  try{
   const absoluteImageUrl=new URL(ogImage,page.finalUrl).toString()
   const image=await fetchSafely(absoluteImageUrl,MAX_IMAGE_BYTES,10000)
   if(image&&image.contentType.startsWith('image/')){
    const described=await describeImageFromBytes(image.bytes,image.contentType,openaiKey)
    if(described&&described!=='NAO_RELACIONADO'){
     return `Cliente enviou um link com uma foto de referência. Descrição da imagem: ${described}${title?` (página: "${title}")`:''}`
    }
   }
  }catch{/* segue pro fallback de texto abaixo */}
 }
 if(title||description){
  return `Cliente enviou um link. Título da página: "${title||'sem título'}"${description?`. Descrição: "${description}"`:''}.`
 }
 return null
}
const includesAny=(text:string,terms:string[])=>terms.some(term=>text.includes(term))
// Saudação correta pelo horário de Brasília — computada aqui (não pedida ao modelo) pra
// garantir que "Bom dia/Boa tarde/Boa noite" nunca saia errado.
const greetingNow=()=>{
 const hour=Number(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(new Date()))
 return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'
}

const extractRequestedTime=(text='')=>{
 // v29.51.0 — caso Luiz André (19/08): "11.00 horas" caía no fallback de hora sem
 // minutos, que casava o "00" antes de "horas" e devolvia 00:00 ("meia-noite já está
 // reservado"). Hora com PONTO só vale quando é claramente horário: precedida de
 // "às/as" ou seguida de h/hs/horas — "dia 21.08" (data) continua fora.
 const dotted=String(text).match(/(?:(?:^|\s)[aà]s\s*([01]?\d|2[0-3])[.]([0-5]\d)(?!\d))|(?:(?:^|\D)([01]?\d|2[0-3])[.]([0-5]\d)\s*(?:h\b|hs\b|hrs?\b|horas?\b))/i)
 if(dotted){const h=dotted[1]??dotted[3];const m=dotted[2]??dotted[4];return `${String(Number(h)).padStart(2,'0')}:${m}`}
 const match=String(text).match(/(?:^|\D)([01]?\d|2[0-3])(?:[:hH])([0-5]\d)(?:\D|$)/)
 if(match)return `${String(Number(match[1])).padStart(2,'0')}:${match[2]}`
 // v28.31.5: "às 9h"/"19h" (hora sem minutos, jeito mais comum de falar horário no
 // Brasil) não casava — o regex acima exige os minutos depois do h. Fallback: hora
 // seguida de "h" sem minutos, desde que o "h" não seja começo de outra palavra
 // (ex.: "8horas" ainda casa, "amanhã" não tem dígito antes). Achado testando de
 // propósito — o modelo geralmente extrai sozinho, mas o extrator determinístico é
 // usado direto no fluxo de reagendamento e não pode depender disso.
 const bare=String(text).match(/(?:^|\D)([01]?\d|2[0-3])\s*[hH](?![0-9])/)
 if(bare)return `${String(Number(bare[1])).padStart(2,'0')}:00`
 return ''
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
// v29.12.0 — caso real 11/08/2026: cliente respondeu "Indiferente" e depois "QQ horário"
// para a pergunta "manhã, tarde ou final do dia?" e a JuIA repetiu a MESMA pergunta, porque
// nenhuma dessas respostas casa com um período. "Sem preferência" é uma resposta legítima:
// significa "me mostra os horários e eu escolho". Cobre abreviações reais de WhatsApp
// (qq/qq um/qlqr/qualquer) e as formas de "tanto faz"/"você escolhe".
// v29.12.0 — "adiar sem marcar data": o cliente avisa que não vem e que fala depois, sem
// dar dia novo ("eu retorno o contato amanhã", "te aviso", "depois eu marco"). Não é
// remarcação (não há data) nem é uma pergunta — é motivo pra liberar o horário.
const postponeSignal=(text:string)=>/retorno o contato|te retorno|retorno depois|volto a falar|entro em contato depois|te aviso|aviso depois|aviso voce|depois eu (falo|vejo|marco|confirmo|aviso|te chamo)|amanha eu (falo|vejo|marco|aviso|te chamo)|vou ver e (te falo|te aviso|falo|aviso)|qualquer coisa eu (chamo|aviso|falo)|deixa (pra|para) (depois|outro dia)|outro dia eu (marco|vejo|falo)|(nao|n) vou (conseguir|poder) (ir|hoje)|fica (pra|para) (a proxima|outro dia)/.test(text)
const noPeriodPreference=(text:string)=>/\bindiferente\b|tanto faz|\bqq\b|\bqqr\b|\bqlqr\b|\bqualquer\b|nao tenho preferencia|sem preferencia|\bvoce escolhe\b|\bvc escolhe\b|voce que sabe|vc que sabe|o que tiver|o que estiver|qualquer um|pode ser qualquer|(^|\s)(qual|quais) (voce|vc) (tem|puder)/.test(text)

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
// Pedido do Juliano (31/07/2026, dia em que fechou um sábado fora do padrão): quando o
// dia pedido pelo cliente não tem horário nenhum (feriado, dia bloqueado, fechado), a JuIA
// não deve só dizer "não tem, quer tentar outro dia?" — ela mesma já sabe procurar e
// oferecer o próximo dia com vaga de verdade, sem o cliente precisar ficar chutando datas.
// Olha só pra frente (nunca pra trás) e para no primeiro dia com pelo menos 1 horário.
async function findNextAvailableDate(supabase:any,fromISO:string,durationMinutes:number,maxDays=21){
 const d=new Date(fromISO+'T12:00:00-03:00')
 for(let i=1;i<=maxDays;i++){
  d.setDate(d.getDate()+1)
  const iso=d.toISOString().slice(0,10)
  const {data}=await supabase.rpc('get_available_slots',{p_date:iso,p_duration_minutes:durationMinutes})
  const slots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5))
  if(slots.length)return {date:iso,slots}
 }
 return null
}
// v29.69.0 — findNextAvailableDate responde "qual é o PRÓXIMO dia"; estas duas respondem
// "QUAIS dias" (caso Tiago: "para que dia você tem vaga pra cortar essa semana?"). Quem
// pergunta por dias tem que receber dias — não a mesma pergunta de volta. minTime aplica o
// piso de horário ("após as 19h") direto na lista, em vez de jogar a restrição fora.
async function findAvailableDatesInRange(supabase:any,fromISO:string,durationMinutes:number,maxDays=7,maxDates=3,minTime=''){
 const out:{date:string,slots:string[]}[]=[]
 const d=new Date(fromISO+'T12:00:00-03:00')
 for(let i=0;i<maxDays&&out.length<maxDates;i++){
  const iso=d.toISOString().slice(0,10)
  const {data}=await supabase.rpc('get_available_slots',{p_date:iso,p_duration_minutes:durationMinutes})
  const slots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5)).filter((t:string)=>!minTime||t>=minTime)
  if(slots.length)out.push({date:iso,slots})
  d.setDate(d.getDate()+1)
 }
 return out
}
// Mesma varredura, mas só nos dias que o cliente citou pelo nome — e devolve TAMBÉM os que
// ficaram sem vaga, porque "quarta eu não tenho" é informação que ele pediu (e evita que a
// JuIA fique devendo resposta sobre um dos dias, que foi o que gerou a repetição).
async function availabilityForDates(supabase:any,dates:string[],durationMinutes:number,minTime=''){
 const out:{date:string,slots:string[]}[]=[]
 for(const iso of dates){
  const {data}=await supabase.rpc('get_available_slots',{p_date:iso,p_duration_minutes:durationMinutes})
  const slots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5)).filter((t:string)=>!minTime||t>=minTime)
  out.push({date:iso,slots})
 }
 return out
}
// v28.38.0: mesmo aviso de "vaga aberta pra quem está na lista de espera" que já existia
// só em admin-booking-status/manage-booking (cancelamento pelo admin) — cancelar/remarcar
// pela JuIA no WhatsApp (whatsapp_cancel_booking/phone_reschedule_booking, chamadas direto
// aqui, sem passar por aquelas duas functions) não disparava esse aviso, então o Juliano
// só ficava sabendo de uma vaga compatível com a lista de espera se o cancelamento
// acontecesse pelo painel admin. Avisa só o Juliano (push), não reserva nada sozinho — o
// encaixe continua manual, mesmo padrão de admin-espera.html.
async function notifyWaitlistIfMatch(supabase:any,bookingDate:string,startTime:string){
 const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
 const supabaseUrl=Deno.env.get('SUPABASE_URL')
 if(!pushSecret||!supabaseUrl)return
 try{
  const {data:waiting}=await supabase.rpc('waitlist_matches_for_slot',{p_date:bookingDate,p_start_time:startTime})
  if(Array.isArray(waiting)&&waiting.length){
   const names=waiting.slice(0,3).map((w:any)=>w.customer_name).join(', ')
   const extra=waiting.length>3?` +${waiting.length-3}`:''
   const timeLabel=String(startTime).slice(0,5)
   await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🎉 Vaga aberta — tem gente esperando!',body:`${formatDateBR(bookingDate)} às ${timeLabel} abriu. ${names}${extra} está(ão) na lista de espera para esse dia.`,url:'/admin-espera.html?app=1',tag:`waitlist-slot-${bookingDate}-${timeLabel}`}})}).catch(()=>{})
  }
 }catch(error){console.error('[ju-ia-site] waitlist_check',error)}
}
// v28.30.5: além de espaços, remove pontuação — "CABELO!" não casava com nada porque o
// "!" sobrava na comparação densa (caso real do Juliano, 31/07/2026).
const stripSpaces=(s:string)=>normalize(s).replace(/[^a-z0-9]/g,'')
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
// v29.16.0: productSuggestions foi removida — produto deixou de ser pergunta (virou aviso
// passivo dentro da oferta única). O modelo continua respondendo sobre produtos quando o
// cliente pergunta, e updates.products segue funcionando pra quem pede produto por texto.

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)
 const body=await req.json().catch(()=>({}))
 let message=String(body.message||'').trim().slice(0,500)
 if(!message)return respond({error:'Mensagem vazia.'},400)
 // v29.2.0 — código de atribuição que viaja no texto quando a pessoa vem do site
 // pro WhatsApp (ex.: "[#abc12345]"). Tiramos da mensagem ANTES do modelo ver, pra
 // não poluir a conversa, e guardamos pra creditar o agendamento à visita de origem.
 let attribToken:string|null=null
 {
  const m=message.match(/\[#([a-z0-9]{6,12})\]/i)
  if(m){attribToken=m[1].toLowerCase();message=message.replace(m[0],'').trim()}
  if(!message)message='Olá!'
 }
 const state=body.state&&typeof body.state==='object'?body.state:{}
 const sessionId=String(body.session_id||crypto.randomUUID()).slice(0,80)
 const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 const key=Deno.env.get('OPENAI_API_KEY')
 // Serviços e produtos vêm do banco (public.services migration 057-v28.28.0,
 // public.products migration 051-v28.20.0) — fontes únicas que as Edge Functions
 // conseguem ler direto, em vez de manter cópias hardcoded que ficavam desatualizadas
 // em relação ao catálogo real do front-end.
 const {data:servicesData}=await supabase.from('services').select('name,price,duration_minutes,upsell_tag,sales_pitch').eq('active',true).order('sort_order')
 services=(servicesData||[]).map((s:any)=>({name:String(s.name),price:Number(s.price),duration:Number(s.duration_minutes),category:String(s.upsell_tag),pitch:String(s.sales_pitch||'')}))
 const {data:productsData}=await supabase.from('products').select('name,price,upsell_tags').eq('active',true)
 products=(productsData||[]).map((p:any)=>({name:String(p.name),price:Number(p.price),tags:Array.isArray(p.upsell_tags)?p.upsell_tags:[]}))
 const {count}=await supabase.from('site_chat_messages').select('*',{count:'exact',head:true}).eq('session_id',sessionId).gte('created_at',new Date(Date.now()-86400000).toISOString())
 if((count||0)>80)return respond({error:'Limite diário de mensagens atingido. Fale com o Juliano pelo WhatsApp.'},429)

 // v28.36.0 (item 2): cliente manda só um LINK (ex.: post de Instagram/TikTok com uma foto
 // de referência, ou qualquer outra página) — antes só recusava educadamente. Agora tenta
 // buscar o conteúdo com segurança (ver describeLinkContent/fetchSafely acima) e usa o que
 // conseguir extrair (imagem principal da página analisada por visão, ou título/descrição)
 // como se fosse o texto do cliente, seguindo pro fluxo normal. Só dispara quando a
 // mensagem é BASICAMENTE o link (pouco texto sobrando), pra não atrapalhar uma mensagem
 // normal que só cita um link de passagem. Vale pros dois canais (site e WhatsApp).
 const linkMatch=message.match(/(https?:\/\/\S+|www\.\S+)/i)
 if(linkMatch&&message.replace(/https?:\/\/\S+|www\.\S+/gi,'').trim().length<15){
  const rawLink=/^https?:\/\//i.test(linkMatch[0])?linkMatch[0]:`https://${linkMatch[0]}`
  const linkContext=await describeLinkContent(rawLink,key||'').catch((err)=>{console.error('[ju-ia-site] describe_link',err);return null})
  if(linkContext){
   message=linkContext
  }else{
   const reply=`${greetingNow()}! Não consegui abrir esse link por aqui — pode me mandar por escrito o que você precisa? Se preferir, acesse nosso site www.barbeariadoju.com.br e faça seu agendamento de forma simples e rápida: lá você confere todos os serviços e consulta os horários disponíveis na nossa agenda. 😊`
   await supabase.from('site_chat_messages').insert([{session_id:sessionId,role:'user',content:message,state},{session_id:sessionId,role:'assistant',content:reply,state,intent:'other'}]).then(()=>{})
   return respond({reply,intent:'other',state,actions:[],handoff:false})
  }
 }

 let context:any={}
 let upcomingBookings:any[]=[]
 // verified_phone vem do canal WhatsApp (whatsapp-webhook), onde o número de quem
 // está escrevendo é o próprio remetente da mensagem — não precisa (e não deve)
 // ser perguntado de novo. No chat do site esse campo não é enviado.
 const verifiedPhone=canonicalPhone(String(body.verified_phone||''))
 const messagePhone=extractPhoneFromMessage(message)
 const knownPhone=canonicalPhone(String(verifiedPhone||state.phone||messagePhone||''))
 // Amarra o código de atribuição ao telefone desta conversa. A partir daqui, um
 // agendamento desse telefone sabe de qual visita ao site ele nasceu.
 if(attribToken&&knownPhone){
  try{await supabase.from('whatsapp_attribution').update({phone_match:knownPhone,matched_at:new Date().toISOString()}).eq('token',attribToken).is('phone_match',null)}
  catch(e){console.error('[ju-ia-site] attrib bind',e)}
 }
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
 // v28.31.1: dias com "Fechar o dia inteiro" marcado no admin (ex.: viagem, folga) —
 // pedido do Juliano depois de um caso real (Lucas, 31/07/2026): perguntou se a
 // barbearia abria no sábado seguinte e a JuIA respondeu com o horário PADRÃO de sábado,
 // porque essa era uma pergunta de FAQ/horário de funcionamento, não uma checagem de
 // disponibilidade de verdade (que já ia corretamente pro get_available_slots e pularia
 // o dia fechado sozinha). Agora o prompt sabe desses dias e responde certo mesmo numa
 // pergunta solta tipo "vocês abrem amanhã?". Janela de 21 dias à frente é suficiente
 // pra qualquer viagem/folga anunciada com alguma antecedência.
 const closureWindowEnd=(()=>{const d=new Date(today()+'T12:00:00-03:00');d.setDate(d.getDate()+21);return d.toISOString().slice(0,10)})()
 const {data:closuresData}=await supabase.from('schedule_blocks').select('block_date,reason').eq('all_day',true).gte('block_date',today()).lte('block_date',closureWindowEnd).order('block_date')
 const closures=(closuresData||[]).map((c:any)=>({date:formatDateBR(c.block_date),reason:c.reason||null}))
 // v28.62.0 (melhoria A, aprovada 05/08): a JuIA não sabia que existia campanha rodando —
 // com o Dia dos Pais no ar, "tem alguma promoção pro Dia dos Pais?" caía no vazio, e
 // marketing e atendimento viviam desconectados. A campanha ativa vem de marketing_memory,
 // a MESMA fonte que o gerador de conteúdo usa, pra não haver dois cadastros divergentes.
 const {data:campaignRows}=await supabase.from('marketing_memory').select('title,content').eq('category','campanha').eq('active',true).order('updated_at',{ascending:false}).limit(2)
 const campaigns=(campaignRows||[]).map((c:any)=>`${c.title}: ${c.content}`).join('\n')
 // v28.70.0: cada serviço leva junto seu argumento de venda (services.sales_pitch). Antes,
 // "como é a lavagem profissional?" era respondido com preço e duração — informação, zero
 // motivo pra querer (caso Walter, 07/08/2026: perguntou, ouviu R$50/40min e não fechou).
 const catalog=services.map(s=>`${s.name} — ${money(s.price)} — ${s.duration} min${s.pitch?`\n   ↳ argumento de venda: ${s.pitch}`:''}`).join('\n')
 const productCatalog=products.map(p=>`${p.name} — ${money(p.price)}`).join('\n')
 const phoneTrustNote=verifiedPhone
  ?'O telefone do cliente já é confirmado automaticamente pelo canal (WhatsApp) — NUNCA peça o WhatsApp dele, ele já está identificado. Mesmo assim, só fale de pontos de fidelidade, recompensas, status VIP, última visita ou histórico de atendimentos se o cliente perguntar explicitamente sobre isso.'
  :'O telefone informado no chat não é verificado como sendo de quem está digitando, então só fale de pontos de fidelidade, recompensas, status VIP, última visita ou histórico de atendimentos se o cliente perguntar explicitamente sobre isso.'
 const isFirstMessage=!Array.isArray(body.history)||body.history.length===0
 const prompt=`Você é JuIA, atendente e consultora comercial oficial da Barbearia do Ju. Seja extremamente educada, acolhedora, objetiva e eficiente. Responda em português do Brasil (se o cliente escrever em inglês ou espanhol, responda no idioma dele, curto e simples), normalmente em até 4 linhas — e quanto mais curto, melhor: frases diretas, uma ideia por frase. Seu objetivo é resolver a necessidade e converter em agendamento sem pressionar. AVANCE SEMPRE: cada mensagem sua tem que deixar a conversa mais perto de um horário marcado. Se o cliente MUDA ou REDUZ o pedido (ex.: pediu "corte + barba", não tinha horário, e ele responde "então só o corte" / "então só hoje"), refaça a consulta IMEDIATAMENTE com o pedido novo e ofereça os horários que existirem — nunca repita a negativa anterior nem a mesma frase de antes (caso real, Vitoria, 15/08/2026: ela trocou para "somente corte, hoje", havia 12:15, 12:30, 14:15 e 14:30 livres, e a resposta repetida fez a cliente ficar sem retorno e a venda ser perdida). Se você já disse algo nesta conversa, não repita a mesma frase: ou avança com informação nova, ou pergunta objetivamente o que falta. PERGUNTA REPETIDA, NUNCA: se você já fez uma pergunta nesta conversa e o cliente respondeu, jamais repita a MESMA pergunta — em especial "para qual dia você quer ver os horários?". Se depois da resposta dele ainda faltar o dia, quem tem que trazer informação nova é VOCÊ (diga quais dias têm vaga), nunca o cliente. DIAS (caso real, Tiago, 24/08/2026): quando ele pergunta QUAIS dias você tem ("para que dia você tem vaga essa semana?", "quais dias tem horário?") ou cita VÁRIOS dias na mesma mensagem ("segunda, terça e quarta"), deixe updates.date em null e use intent "availability" — o sistema varre a agenda e responde com os dias que realmente têm vaga. Devolver a pergunta dele ("para qual dia você quer?") é o erro que travou aquela conversa em três mensagens seguidas. PISO DE HORÁRIO: "após as 19h", "depois das 18h", "a partir das 17h" NÃO é o horário escolhido, é o mínimo que serve pra ele — não preencha updates.time nesses casos, use intent "availability" e deixe o sistema conferir o que existe daquele horário em diante. E lembre que fechamos às 19h de terça a sexta e às 15h no sábado: o último horário do dia começa antes disso, então um pedido "depois das 19h" tem que ser respondido na hora com o horário possível mais próximo, nunca com outra pergunta. CORTESIA SEMPRE, com naturalidade: "por gentileza", "obrigado", "desculpe", "com licença" quando couber — e trate o cliente por "você", com respeito e sem formalidade excessiva. DATAS EM LINGUAGEM HUMANA: diga "hoje", "amanhã", "sábado", "terça (18/08)" — NUNCA escreva datas no formato de sistema como "15/08/2026". NUNCA exponha linguagem interna: não diga "com 41 horários", "consultando a base", "o sistema retornou", "token", "state" nem nada parecido — o cliente só quer saber os horários possíveis, e no máximo 3 ou 4 opções por vez. RETOMADA DE CONVERSA: se o cliente volta depois de um tempo cobrando uma resposta ("conseguiu?", "e aí?"), nunca responda como se fosse uma conversa nova ("Como posso ajudar?") — releia o histórico, retome exatamente de onde parou e resolva o que ficou pendente. Nunca invente preço, serviço, produto, fidelidade ou disponibilidade. REGRA FIXA: num mesmo atendimento cabe só 1 serviço de corte e só 1 serviço de barba — Barboterapia e Barba Express são alternativas (a Barboterapia é a completa, com toalha quente e navalha), nunca se somam; os combos "Corte + Barboterapia" e "Corte + Barba Express" já incluem a barba. Única exceção: corte adulto + corte infantil (pai e filho no mesmo horário). Se o cliente pedir dois da mesma família, explique com simpatia e fique com o mais completo. GRUPO: se o cliente disser que são várias pessoas (ex.: "2 cortes masculinos e 1 infantil", "eu e meu filho", "3 pessoas"), é um atendimento por pessoa, em sequência — repita o serviço uma vez por pessoa em updates.services, trate a duração como a soma e diga quantas pessoas entendeu; nunca reduza a uma pessoa só. REGRA FIXA: todo corte de cabelo (inclusive infantil e combos com corte) JÁ INCLUI o pezinho (acabamento) — nunca some nem cobre "Pezinho" junto de um corte; se o cliente pedir corte e pezinho, é só o corte, e diga com simpatia que o pezinho já vem incluso. Pezinho avulso é só pra quem quer apenas o acabamento, sem corte. Nunca combine dois nomes de serviço do catálogo como se juntos formassem um único serviço/combo (ex.: não diga "Corte de cabelo + Sobrancelha Masculina" como se fosse um item do catálogo) — se quiser sugerir os dois juntos, cite-os separadamente, cada um com seu próprio preço. Nunca reafirme um agendamento já existente (da lista de agendamentos futuros) como se fosse a resposta a um pedido novo — se o cliente pede um dia/horário/serviço diferente do que já está confirmado, trate como um pedido novo (agendar, remarcar, trocar serviço) e nunca copie os dados do agendamento antigo na resposta. Nunca assuma o serviço que o cliente quer com base no histórico dele (last_services) a não ser que ele peça explicitamente para repetir/manter o mesmo de sempre — se ele não disser o serviço, pergunte qual serviço antes de agendar ou remarcar. Nunca inclua saudação (Bom dia/Boa tarde/Boa noite) na sua resposta, nem mesmo na primeira mensagem — isso é adicionado automaticamente pelo sistema antes de enviar, já com o nome do cliente quando disponível. Comece sua resposta direto pelo conteúdo. ${verifiedPhone?`ABERTURA OBJETIVA (WhatsApp): se o cliente disser que quer marcar/agendar sem dizer o serviço, não responda com pergunta aberta dupla ("qual serviço e para qual dia?") nem mande o link do site — a grande maioria vem pra corte, então puxe direto por ele em UMA pergunta curta e objetiva, ex.: "Claro! É corte de cabelo? E fica melhor de manhã, à tarde ou no fim do dia?" — se for outro serviço, o cliente corrige e você segue normal. NUNCA envie o link do site por conta própria: mandar o cliente pro site logo de cara passa a impressão de que ele tem que se virar sozinho, e tem gente que tem dificuldade ou preguiça de agendar por lá. O site só entra na conversa se o CLIENTE pedir o link ou disser que prefere agendar por lá.`:`Se esta for a primeira mensagem desta conversa (indicado abaixo) e fizer sentido, mencione que o cliente também pode ver todos os serviços, consultar horários disponíveis e agendar sozinho pelo nosso site https://www.barbeariadoju.com.br/agendar/ — sem repetir essa menção do site nas mensagens seguintes.`} Não confirme horário sem consultar o sistema. NUNCA responda "temos sim", "conseguimos sim", "esse horário está livre" ou qualquer variação afirmativa sobre um horário específico antes de o sistema confirmar a disponibilidade — nem para ganhar tempo enquanto pergunta o serviço. Se o cliente pedir um horário e ainda faltar o serviço, não devolva pergunta aberta de serviço: puxe direto pro corte em UMA pergunta curta, SEM prometer o horário antes de o sistema confirmar (ex.: "É corte de cabelo? Já confiro esse horário pra você.") — se for outro serviço, o cliente corrige. NUNCA comece com "deixa eu conferir", "vou verificar", "já confiro e te aviso" ou qualquer frase que dê a entender que VOCÊ vai voltar depois com a resposta: quando você precisa de uma informação do cliente, quem tem a próxima palavra é ELE, e a mensagem tem que deixar isso claro (caso real, Bruno, 15/08/2026: você respondeu "Deixa eu conferir a agenda certinho antes de confirmar. Qual serviço você tem interesse?" e o cliente esperou 2h30 achando que você ia voltar com a agenda). E se o horário pedido estiver FORA do funcionamento (terça a sexta 08:00–19:00, sábado 08:00–15:00, domingo e segunda fechado), diga isso na hora, com clareza e simpatia, oferecendo o horário possível mais próximo — nunca deixe o cliente achar que dá. Se houver "Dias excepcionalmente fechados" listados abaixo e o cliente perguntar se a barbearia abre, o horário de funcionamento, ou disponibilidade numa data que está nessa lista, informe claramente que nesse(s) dia(s) está fechado excepcionalmente (cite o motivo, se houver) e que o atendimento normal retoma depois disso — NUNCA informe o horário padrão de funcionamento pra essas datas nem sugira agendar nelas, mesmo que seja um dia normalmente aberto (ex.: sábado). Se o cliente avisar que chegou, está a caminho, vai se atrasar um pouco, ou está terminando algo (comendo, no trabalho etc.) antes de vir para um horário já marcado, responda breve e acolhedora confirmando que está tudo certo — não peça esclarecimento, não repita dados do agendamento, isso não é um pedido novo. ATRASO: a barbearia tem tolerância de 10 minutos — se o cliente avisar atraso de ATÉ 10 minutos (ou não disser quanto, ex. "vou me atrasar um pouquinho"), confirme na hora que está tudo bem e que o horário dele segue garantido (ex.: "Tranquilo, temos tolerância de 10 minutos — seu horário está garantido, pode vir!"). Se o atraso indicado for MAIOR que 10 minutos (ex.: "vou atrasar meia hora"), continue acolhedora, agradeça o aviso e diga que vai passar pro Ju ver o melhor encaixe — e use handoff true nesse caso; NUNCA prometa que o atendimento atrasado está garantido além dos 10 minutos, nunca reagende sozinha por causa de atraso. Uma saudação isolada no meio da conversa (ex.: "oi", "boa tarde", "bom dia"), sem nenhum pedido novo junto, nunca deve reabrir uma checagem de disponibilidade nem repetir a última pergunta/resposta que você já tinha dado — apenas cumprimente de volta e pergunte como pode ajudar. Se a mensagem do cliente for só um emoji de reação/encerramento (aperto de mão 🤝, joia 👍, palminhas 👏, coração etc.) ou uma palavra curta de confirmação ("ok", "beleza", "valeu", "obrigado") logo depois de você já ter resolvido o que ele pediu (respondido a pergunta, confirmado agendamento etc.), NÃO reintroduza a conversa do zero nem repita a saudação/lista de serviços/link do site de novo — responda só com um agradecimento breve e caloroso (1 frase curta, sem reapresentação), como se estivesse encerrando naturalmente. Se pedirem Juliano, houver reclamação, dúvida complexa ou pedido humano, faça handoff. Se o cliente pedir para cancelar um agendamento, disser que já marcou em outro lugar/outro dia, ou não vai mais poder ir no horário marcado, use intent "cancel" — nunca diga que já cancelou nem que vai encaminhar para a equipe, o sistema confirma com o cliente e executa o cancelamento sozinho. Se o cliente pedir para mudar o dia/horário de um agendamento que já existe (ex.: "posso mudar pra sexta às 15h?", "quero remarcar", "dá pra trocar meu horário?"), use intent "reschedule" — não trate como um agendamento novo nem diga que vai cancelar e recriar, o sistema identifica o agendamento, confirma o novo horário disponível e reagenda sozinho, preservando o mesmo registro. Se o cliente pedir para trocar o SERVIÇO de um agendamento que já existe, sem mudar dia/horário (ex.: "pode trocar o serviço pra mim?", "marquei corte mas quero mudar pra barba", "muda esse agendamento pra Barba Express"), use intent "change_service" e preencha updates.services com o nome exato do novo serviço desejado — o sistema identifica o agendamento, confirma o serviço novo e troca sozinho, preservando dia, horário e o resto do registro.\n\nEndereço: Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista. Agenda: terça a sexta 08:00–19:00; sábado 08:00–15:00; domingo e segunda fechado. Pagamentos: Pix, dinheiro, débito e crédito somente à vista (1x) — NÃO parcelamos no cartão de crédito; se perguntarem sobre parcelamento, informe com clareza e simpatia que o crédito é apenas em 1x. CHAVE PIX (pode passar sempre que o cliente pedir o Pix, quiser pagar antecipado ou perguntar como pagar, sem precisar chamar o Juliano): a chave PRINCIPAL da barbearia é o E-MAIL contato@barbeariadoju.com.br — passe SEMPRE essa primeiro, e sozinha, no formato "Chave Pix (e-mail): contato@barbeariadoju.com.br". Ao passar a chave, avise na mesma mensagem que no aplicativo do banco vai aparecer o nome "Juliano Bruno Lopes Padilha" e a instituição "PicPay" (titular da Barbearia do Ju) — informar a instituição junto do nome é importante: sem isso o cliente desconfia que digitou a chave errada, para no meio e desiste de pagar. Só ofereça a segunda chave se o cliente disser que prefere celular, tem dificuldade com a de e-mail, ou pedir outra opção: aí informe o CELULAR 11967073038. NUNCA passe as duas de uma vez — duas chaves na mesma mensagem confundem e derrubam o pagamento. NUNCA invente uma terceira chave. NUNCA invente outra chave, nem confirme pagamento recebido: se o cliente disser que já pagou ou mandar comprovante, agradeça e avise que o Juliano confere. Ambiente climatizado, café cortesia (por nossa conta), Wi-Fi gratuito e TV — as demais bebidas (água, refrigerante, energético, bebida gelada) são vendidas à parte, nunca diga que são cortesia. GARANTIA DE ACABAMENTO: se o acabamento não ficar como o cliente queria, ele pode voltar e a barbearia ajusta sem cobrar nada. Informe isso com naturalidade quando o cliente demonstrar receio de não gostar do resultado, estiver inseguro por nunca ter vindo, ou perguntar diretamente o que acontece se não gostar. NUNCA prometa devolução de dinheiro nem estorno — a garantia é de ajuste do acabamento, não de reembolso. Zona Azul nas proximidades. Instagram oficial: @barbeariadoju_ (com underscore no final — copie esse @ exatamente assim, nunca invente ou escreva sem o underscore). CONTATO COMERCIAL: propostas comerciais, fornecedores, parcerias, divulgação e qualquer prospecção (alguém vendendo algo PARA a barbearia) não são atendidos por este canal — informe com educação e simpatia, sem hostilidade, que o contato comercial é feito exclusivamente pelo e-mail contato@barbeariadoju.com.br e que este canal é exclusivo para agendamento de serviços dos clientes. NUNCA diga que não existe contato comercial, e não use este parágrafo para clientes falando de serviços da barbearia.\nServiços:\n${catalog}\nProdutos:\n${productCatalog}\nHoje: ${today()}. Saudação correta agora: ${greetingNow()}. Primeira mensagem desta conversa: ${isFirstMessage}. Estado: ${JSON.stringify(state)}. Contexto conhecido do cliente: ${JSON.stringify(context)}. Agendamentos futuros já confirmados desse telefone: ${JSON.stringify(upcomingBookings)}. Dias excepcionalmente fechados nas próximas semanas: ${closures.length?JSON.stringify(closures):'nenhum'}.${campaigns?`\nCampanha da barbearia em andamento agora (contexto interno, NÃO é tabela de preços):\n${campaigns}\nUse a campanha só como contexto: se o cliente perguntar sobre promoção, data comemorativa ou algo ligado a ela, responda com o que está escrito acima, sem inventar desconto, brinde, preço ou condição que não esteja ali. Se a campanha não prevê desconto, não invente um — o convite é a ocasião, não preço menor. NUNCA puxe a campanha espontaneamente em toda mensagem nem repita ela: no máximo uma menção, e só quando encaixar com naturalidade no que o cliente está falando.`:''}\n\nSe o cliente reagir ao PREÇO (ex.: "tá caro", "achei salgado", "nossa, caro", "mais barato ali na esquina", "por que tão caro?"), nunca peça desculpa pelo valor, nunca insista e NUNCA ofereça, invente ou insinue desconto, condição especial ou negociação — desconto é decisão exclusiva do Juliano e não existe como padrão. Responda em 2-3 linhas explicando o que sustenta o valor, usando só o que é verdade aqui: horário marcado e respeitado (o cliente não fica esperando em fila), atendimento sem pressa, acabamento caprichado, ambiente climatizado com café e Wi-Fi, garantia de ajuste sem custo se o acabamento não ficar como ele queria, e cartão fidelidade (a cada 10 cortes, 1 grátis). Encerre com um convite leve, sem pressão, do tipo "se quiser, posso ver um horário pra você".\n\nRetorne SOMENTE JSON válido: {"reply":"...","intent":"faq|services|availability|book|cancel|reschedule|change_service|upsell_services|upsell_products|loyalty|handoff|other","updates":{"name":null,"phone":null,"email":null,"services":[],"products":[],"date":null,"time":null,"sales_stage":null},"handoff":false}. Preserve dados conhecidos. Serviços e produtos devem usar nomes exatos. Quando o cliente já citar o serviço explicitamente (ex.: "barba e pezinho", "corte de cabelo"), preencha updates.services com o(s) nome(s) exato(s) do catálogo — não responda com a lista genérica de mais procurados nesse caso. Se o cliente pedir para "raspar a cabeça", "raspar com máquina/navalha", "deixar no zero", "carequinha" ou termos parecidos referindo-se ao cabelo (não à barba), entenda como o serviço "Raspar a cabeça" — não pergunte se é cabeça ou barba quando o cliente já disse que é a cabeça/cabelo. Se o cliente mencionar corte para filho(a), criança ou "corte infantil", entenda como o serviço "Corte de cabelo infantil". Datas YYYY-MM-DD e horários HH:MM. Se o cliente mencionar mais de um horário possível na mesma frase (ex.: "às 16h ou 17h", "pode ser de manhã ou à tarde"), NÃO preencha updates.time com nenhum dos dois — pergunte qual horário ele prefere antes de continuar. Se o cliente mencionar duas DATAS alternativas na mesma frase (ex.: "hoje ou amanhã", "hoje ou amanhã cedo"), preencha updates.date SEMPRE com a MAIS PRÓXIMA (hoje) — cadeira vazia hoje é receita perdida; se hoje não tiver horário, o sistema oferece o dia seguinte sozinho, nunca pule direto pra data mais distante. Para agendar, colete nome, WhatsApp (a menos que o telefone já esteja confirmado, ver nota abaixo), serviço(s), data e horário. NUNCA faça pergunta de venda por conta própria (complemento, upgrade de serviço ou produto): o SISTEMA faz uma única oferta numerada, no momento em que confirma a disponibilidade do horário, e essa é a ÚNICA oferta da conversa inteira. Se o cliente recusar qualquer oferta ou disser que quer só o que pediu, nunca mais ofereça nada nesta conversa — siga direto pra fechar o agendamento, sem desvios. Responder dúvida sobre produto que o CLIENTE puxou continua normal. Quando o cliente perguntar o que é um serviço, como ele funciona, o que está incluído, ou por que vale a pena, USE o "argumento de venda" daquele serviço no catálogo acima — explique o BENEFÍCIO com suas palavras, de forma natural e conversada, nunca colando o texto igual nem repetindo preço e duração como se fossem a resposta. Preço e duração são complemento, não explicação. Se o serviço não tiver argumento de venda cadastrado, responda com o que sabe do catálogo, sem inventar benefício. Depois de responder uma pergunta informativa sobre preço, duração ou detalhes de um serviço, termine com uma oferta breve pra consultar horário ou agendar (ex.: "Se quiser, posso checar um horário pra você.") — mas não repita essa oferta se você já tiver feito isso há pouco na mesma conversa, pra não parecer repetitivo. Se ele perguntar fidelidade e houver telefone, use o contexto. ${phoneTrustNote} Se o cliente disser "o mesmo", "igual da última vez" ou "repetir meu último atendimento", use last_services e ajude a repetir (isso é um pedido explícito, pode usar). Em recomendações, priorize preferred_services ou last_services e explique em uma frase, só quando o cliente pedir uma recomendação. Se perguntado sobre fidelidade, humanize a resposta: informe pontos, quantos faltam e recompensas disponíveis. Se houver last_products ou favorite_products, ofereça repetir o produto somente quando isso for relevante e o cliente já estiver interagindo sobre produtos. Use preferências, produtos favoritos e intervalo de retorno apenas para personalizar quando já em contexto de agendamento, sem expor observações internas, etiquetas ou dados privados.`
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
 // v28.31.2: "sales_stage" nunca é lido em lugar nenhum do código (só é escrito
 // deterministicamente em 2 pontos específicos, mais abaixo) — mas o modelo devolve um
 // valor livre pra esse campo a cada resposta, sem checagem nenhuma. Achado testando de
 // propósito: "corte pro meu filho de 5 anos" devolveu sales_stage em TAILANDÊS
 // ("บริการ solicitado"), que ficava salvo no state e voltava pro prompt nos próximos
 // turnos como ruído sem sentido. Exclui do merge automático — só as 2 atribuições
 // deterministicas (abaixo) definem esse campo agora.
 const next={...state,...Object.fromEntries(Object.entries(ai.updates||{}).filter(([k,v])=>k!=='sales_stage'&&v!==null&&v!==''&&!(Array.isArray(v)&&v.length===0)))}
 next.services=Array.isArray(next.services)?next.services.map((x:string)=>findService(x)?.name).filter(Boolean):[]
 // v29.61.0 — caso Marcelo (21/08/2026, 15h49, áudio): "tem horário pra hoje ou amanhã
 // cedo?" e o modelo escolheu amanhã — com a agenda de HOJE aberta. Duas datas com "ou":
 // a mais próxima vence, deterministicamente (o prompt também aprendeu, mas trava de
 // código não erra). Se hoje não tiver horário, o bloco de disponibilidade já oferece o
 // próximo dia sozinho. Só se aplica quando a frase realmente traz as duas alternativas.
 if(/\bhoje\b[^.!?]{0,20}\bou\b[^.!?]{0,20}\bamanha\b|\bamanha\b[^.!?]{0,20}\bou\b[^.!?]{0,20}\bhoje\b/.test(normalize(message))){
  next.date=today()
  next.time=null
 }
 // v28.30.4: numa pergunta sem menção de serviço, o modelo às vezes "presume" o serviço
 // do histórico do cliente (context.last_services) — caso real (Juliano, 31/07/2026):
 // áudio "Tem horário hoje?" respondido com "Não encontrei horário para Pezinho
 // (acabamento)", serviço nunca citado na conversa. O prompt já proíbe, mas o modelo
 // desobedece de vez em quando — trava em código: serviço NOVO (que não estava no state)
 // que coincida com o histórico do cliente só entra se a mensagem citar algo parecido
 // (findServicesLoose). Pedido explícito de "repetir o de sempre" continua funcionando
 // (repeatRequest, mais abaixo, seta next.services por conta própria depois desta trava).
 {
  const prevServices=Array.isArray(state?.services)?state.services:[]
  const mentionedLoose=findServicesLoose(message).map((s:any)=>s.name)
  // v29.11.0: bug real (cliente com "Corte de cabelo" + "Barba Express" já anotados,
  // pergunta de lavagem pendente respondida com "só o corte") — o merge da linha ~433
  // SUBSTITUI next.services inteiro pelo array que o modelo devolve, e o modelo às vezes
  // devolve só o serviço em discussão na pergunta pontual do turno ("Corte de cabelo"),
  // sem repetir os outros já confirmados — apagando Barba Express silenciosamente.
  // Repõe qualquer serviço do turno anterior que sumiu do array novo sem ser citado
  // (nem solto nem por trás de "só"/"sem") nesta mensagem — troca/remoção real continua
  // funcionando, pois aí o serviço tirado ou o novo aparece em mentionedLoose. Exceção:
  // não repõe um serviço base já ABSORVIDO por um combo presente no array novo (ex.:
  // "Corte de cabelo" some porque virou "Corte + Lavagem", "Barba Express" some porque
  // virou "Corte + Barba Express") — repor duplicaria o serviço (achado testando "quero
  // com lavagem" depois de corte+barba: sem esta exceção voltava "Corte de cabelo" solto
  // JUNTO do "Corte + Lavagem"). "Corte + Lavagem" não usa a categoria 'combo' no catálogo
  // (é 'corte'), por isso a checagem é por nome (partes do nome do combo), não categoria.
  const supersededByComboNow=(base:string)=>next.services.some((cur:string)=>{
   if(!comboSignal.test(cur))return false
   const nb=normalize(base)
   return cur.split(/\+| e /i).some((part:string)=>{const np=normalize(part.trim());return np&&(np.includes(nb)||nb.includes(np))})
  })
  next.services=[...next.services,...prevServices.filter((n:string)=>!next.services.includes(n)&&!mentionedLoose.includes(n)&&!supersededByComboNow(n))]
  const prefRaw=context?.preferred_services
  const prefList=Array.isArray(prefRaw)?prefRaw:(typeof prefRaw==='string'&&prefRaw?[prefRaw]:[])
  const historyServiceNames=[findService(String(context?.last_services||''))?.name,...prefList.map((x:string)=>findService(String(x))?.name)].filter(Boolean)
  next.services=next.services.filter((n:string)=>prevServices.includes(n)||mentionedLoose.includes(n)||!historyServiceNames.includes(n))
 }
 // v29.62.0 — regra das famílias (pedido do Juliano, 22/08/2026, caso Augusto Monteiro —
 // aconteceu pelo site, mas a JuIA aceitava a mesma combinação): num atendimento cabe só
 // 1 serviço de corte e 1 de barba; Barboterapia e Barba Express são alternativas; combo
 // "Corte + X" já cobre a barba; pezinho já vem no corte. Única exceção: corte adulto +
 // corte infantil (pai e filho). Fica o mais completo, e a JuIA avisa a troca na resposta
 // (prefixo "Só pra ajustar", colado lá no fim, antes do respond).
 let serviceRuleNote=''
 {
  const fam=normalizeServiceFamilies(next.services.map((n:string)=>{const s=findService(n);return {name:n,price:s?s.price:0}}))
  if(fam.removed.length){
   next.services=fam.items.map((x:any)=>x.name)
   const r=fam.removed.find((x:any)=>x.name!==x.keptBy)
   if(r)serviceRuleNote=`Só pra ajustar: ${r.keptBy} já inclui o que ${r.name} faria, então fica ${next.services.join(' + ')} 😉`
  }
 }
 // v29.63.0 — GRUPO (caso Plinio, 22/08/2026): "2 cortes masculinos e 1 infantil" virou
 // "Corte de cabelo + Corte de cabelo infantil" (60 min) — 3 pessoas tratadas como 2. A
 // lista de serviços colapsa nomes repetidos (modelo e regra das famílias), então o grupo
 // é guardado em números (group_adults/group_kids) e a lista é REEXPANDIDA a cada turno:
 // uma entrada por pessoa, duração = soma, um agendamento só no nome de quem chamou.
 {
  const num=(s:string)=>(({um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5}) as Record<string,number>)[s]||Number(s)||0
  const nm=normalize(message)
  const mAd=nm.match(/\b(\d|dois|duas|tres|quatro|cinco)\s+cortes?\b(?!\s*(\+|e)\s*lavagem)/)
  const mKid=nm.match(/\b(\d|um|dois|duas|tres|quatro)\s+(cortes?\s+)?(infanti|crianc)/)
  const mPeople=nm.match(/\b(\d|dois|duas|tres|quatro|cinco)\s+pessoas\b/)
  if(mAd||mKid||mPeople){
   const kids=mKid?num(mKid[1]):0
   const adults=mAd?num(mAd[1]):mPeople?Math.max(num(mPeople[1])-kids,1):0
   if(adults+kids>=2){next.group_adults=adults;next.group_kids=kids}
  }
  if(/\bso (eu|pra mim)\b|\bapenas eu\b|\bsozinho\b/.test(nm)){delete next.group_adults;delete next.group_kids}
  const gA=Number(next.group_adults||0),gK=Number(next.group_kids||0)
  if(gA+gK>=2){
   const adultName=next.services.find((n:string)=>/^Corte/.test(n)&&!/infantil/.test(n))||'Corte de cabelo'
   const outros=next.services.filter((n:string)=>!/^Corte de cabelo( infantil)?$/.test(n)&&n!==adultName)
   next.services=[...Array(gA).fill(adultName),...Array(gK).fill('Corte de cabelo infantil'),...outros]
  }
 }
 next.products=Array.isArray(next.products)?next.products.map((x:string)=>findProduct(x)?.name).filter(Boolean):[]
 // Corrige bug real (cliente Alessio, confundido com "Rossano", 27/07/2026): depois de
 // um agendamento concluído (next.completed=true), se o cliente pede um agendamento NOVO
 // com uma data diferente, o horário antigo (do atendimento já concluído) continuava em
 // next.time e era reaproveitado silenciosamente — confirmou um horário que o cliente
 // nunca pediu (11:00 de um corte já feito, quando ele queria 16h/17h numa data nova).
 // Limpa o horário (e o completed) sempre que aparece uma data nova, forçando perguntar
 // o horário de novo em vez de herdar o de um agendamento já encerrado.
 if(next.completed&&ai.updates?.date&&ai.updates.date!==state.date){next.time=null;next.completed=false}
 let chosen=next.services.map((n:string)=>findService(n)).filter(Boolean)
 let reply=String(ai.reply||'Como posso ajudar?'),actions:any[]=[],intent=String(ai.intent||'other'),handoff=Boolean(ai.handoff)
 // v29.14.0 — vira true quando o CÓDIGO monta uma resposta afirmativa depois de consultar
 // a agenda de verdade. A trava anti-promessa (lá no fim) precisa disso pra saber a
 // diferença entre o modelo chutando "temos sim" e o sistema confirmando um horário que
 // ele realmente checou — sem essa marca, a trava reescrevia a própria verdade conferida e
 // produzia frases sem sentido como "Sim, 10:00 vou conferir para esse atendimento".
 // Só as respostas que casam com a regex da trava precisam ser marcadas.
 let respostaConferidaNaAgenda=false

 const normalizedQuestion=normalize(message)
 // v29.69.0: a última fala da JuIA nesta conversa, usada pelas travas de repetição abaixo
 // (não repetir a pergunta do dia, não repetir a mesma negativa de agenda).
 const ultimaFalaJuIA=String([...(Array.isArray(body.history)?body.history:[])].reverse().find((h:any)=>h&&h.role==='assistant')?.content||'')
 // Bug real achado no banco de ~150 cenários de teste (31/07/2026): perguntas puras
 // sobre um serviço nomeado (preço, duração, "inclui X?") eram sequestradas pelo fluxo
 // de agendamento — o cliente perguntava "quanto custa a barboterapia com ozônio" e,
 // como o nome do serviço batia no catálogo, o sistema tratava como se o cliente
 // tivesse ESCOLHIDO o serviço pra agendar, disparando "quer incluir complemento?"/
 // "só o corte ou corte+lavagem?" em vez de responder a pergunta feita. Detecta
 // pergunta pura (tem palavra de pergunta, não tem verbo de ação de agendar) pra não
 // deixar essas respostas automáticas atropelarem a resposta real do modelo.
 // Bug real achado no banco de teste (30/07/2026, request-10): "quero fazer corte +
 // sobrancelha + pezinho, quanto fica tudo junto" era excluído daqui só por conter
 // "quero", mesmo sendo claramente uma pergunta de preço combinado — a exclusão certa
 // é so quando "quero" está junto de um verbo de agendar de fato (marcar/agendar/
 // reservar), não "quero" isolado (que também aparece em frases como "quero fazer").
 // v28.31.3: exigia "qual" logo antes de "preço" — não casava "e o preço de X", "o preço
 // do Y" ou "preço da Z" sem "qual"/"quanto" na frase. Achado testando de propósito: "e o
 // preço da hidratação capilar" era sequestrado pelo upsell de complemento em vez de
 // responder o preço. "preco" agora é gatilho sozinho, cobre qualquer frase que cite a
 // palavra.
 // v28.56.1 (05/08/2026, bateria de auditoria): faltava o caso "vocês FAZEM/ATENDEM X?" —
 // pergunta informativa sobre a EXISTÊNCIA de um serviço, que não tem nenhuma das palavras
 // acima. Bug real reproduzido: "corta cabelo de criança de 5 anos?" era entendido como
 // ESCOLHA do serviço "Corte de cabelo infantil" e o cliente recebia "Quer aproveitar e
 // incluir algum complemento, como Sobrancelha Masculina...?" — sem nunca ouvir que sim,
 // atendemos criança, e por quanto. Um pai perguntando isso simplesmente desiste.
 // Não casa pergunta de AGENDA: o gatilho exige verbo de fazer/atender/trabalhar, ou
 // "tem <serviço/corte/atendimento> pra/de". CUIDADO — "tem" solto depois de "vocês" foi
 // testado e REMOVIDO daqui de propósito: "vocês têm horário hoje?" é a pergunta mais
 // comum que a JuIA recebe, e casá-la aqui a marcaria como pergunta informativa,
 // impedindo o fluxo de disponibilidade de rodar (seria um bug pior que o corrigido).
 const isServiceExistenceQuestion=/\b(voces|vcs|voce|vc)\s+(fazem|faz|cortam|corta|atendem|atende|trabalham|trabalha)\b|\b(fazem|faz|cortam|corta|atendem|atende)\s+(cabelo|corte|barba|crianca|infantil|menino|sobrancelha|luzes|progressiva|penteado|desenho)|\btrabalham?\s+com\b|\btem\s+(servico|corte|atendimento)\s+(de|pra|para)\b|\baceitam?\b/.test(normalizedQuestion)
 const isPriceOrInfoQuestion=(/\bquanto\b|\bpreco\b|\binclui\b|\bdura\b|\bcusta\b|\bdoi\b/.test(normalizedQuestion)||isServiceExistenceQuestion)&&!/\bmarcar\b|\bagendar\b|\breservar\b/.test(normalizedQuestion)
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

 // v29.54.0 — caso Aletéia (21/08/2026, 08h54): ela perguntou "Qual o valor do corte?" DUAS
 // vezes e a JuIA não respondeu nenhuma das duas — na segunda, ainda leu a pergunta como
 // confirmação e criou o agendamento. Cliente marcada, a caminho, sem saber o preço. Duas
 // travas nascem aqui: (1) pergunta de preço tem resposta determinística com o valor do que
 // já está escolhido (blocos abaixo); (2) PERGUNTA NUNCA VIRA AGENDAMENTO — só confirmação
 // explícita ou "sim" curto fecham. Vale pra qualquer pergunta, não só a de preço.
 const askedPrice=/(quanto (custa|e|fica|sai|da|seria))|(qual (o |e o )?(valor|preco))|(valor d[oa])|(preco d[oa])|(quanto voces cobram)/.test(normalizedQuestion)
 const isQuestion=/\?\s*$/.test(String(message||'').trim())||askedPrice
 const explicitConfirm=includesAny(normalizedQuestion,['pode confirmar','confirma pra mim','pode fechar','pode marcar','pode agendar','confirmo','isso mesmo'])
 if(intent==='book'&&isQuestion&&!explicitConfirm&&!simpleYes)intent='faq'

 // v29.18.0 — caso Paulo Spina (13/08/2026): cliente recorrente perguntou "consigo um
 // horário hoje 16h30?" e levou interrogatório ("qual serviço?"), mesmo com o histórico
 // dizendo que ele sempre faz Corte de cabelo. Pedido do Juliano: pra quem já é de casa,
 // consultar a base e ASSUMIR o serviço de sempre — dito com transparência na resposta
 // (nota no fim) e fácil de corrigir (citar outro serviço troca normalmente). Só vale com
 // telefone VERIFICADO (WhatsApp), cadastro real e pelo menos 1 atendimento concluído;
 // cliente novo continua ouvindo a pergunta. NÃO confunde com a trava v28.30.4: aquela
 // impede o MODELO de presumir em silêncio (e continua valendo); aqui é o CÓDIGO
 // assumindo deterministicamente, com aviso explícito ao cliente. Também pula a oferta
 // de upsell (upsell_services_done) — quem pediu só um horário do serviço de sempre não
 // quer responder mais perguntas (motivo do pedido do Juliano).
 let assumedUsualService=''
 let cabeloAssumidoNota=''
 // v29.43.6 — REGRA DE NEGOCIO (Juliano, 18/08): todo corte JA INCLUI o pezinho. Nunca somar
 // "Corte + Pezinho" nem cobrar os dois (caso Alfredo, 22/07: agendou os dois por engano achando
 // que era cobrado separado). Pezinho avulso so existe pra quem quer SO o acabamento.
 let pezinhoNota=''
 const dropPezinhoSeTemCorte=()=>{
  const temCorte=chosen.some((c:any)=>/\bcorte\b/i.test(String(c.name)))
  const idx=chosen.findIndex((c:any)=>/pezinho/i.test(String(c.name)))
  if(temCorte&&idx>=0){chosen.splice(idx,1);next.services=chosen.map((c:any)=>c.name);pezinhoNota='(O pezinho já vem incluso no corte 😉 — não precisa adicionar.)'}
 }
 // v29.50.0 — caso Luiz André (19/08): fechou "Corte + Barba Express + Barboterapia com
 // vaporizador de ozônio" — dois serviços de BARBA juntos. A barboterapia com ozônio é o
 // serviço de barba mais completo; nunca faz sentido somar outro serviço de barba a ela.
 // Regra: da família barba (Barba Express / Barboterapia / Barboterapia c/ ozônio) fica só
 // o MAIS completo (ozônio > barboterapia > express); os demais saem com aviso ao cliente.
 const dropBarbaRedundante=()=>{
  const rank=(n:string)=>/oz[oô]ni/i.test(n)?3:/barboterapia/i.test(n)?2:/barba/i.test(n)?1:0
  const barbas=chosen.filter((c:any)=>rank(String(c.name))>0)
  if(barbas.length<2)return
  const melhor=barbas.reduce((a:any,b:any)=>rank(String(b.name))>rank(String(a.name))?b:a)
  const removidos=barbas.filter((b:any)=>b!==melhor)
  for(const r of removidos){const i=chosen.indexOf(r);if(i>=0)chosen.splice(i,1)}
  next.services=chosen.map((c:any)=>c.name)
  if(!pezinhoNota)pezinhoNota=`(${melhor.name} já é o cuidado completo da barba — tirei ${removidos.map((r:any)=>r.name).join(' e ')} pra você não pagar em dobro 😉)`
 }
 let avisoAbertoHoje=''
 // v29.43.0 — caso Alfredo (17/08): o "de sempre" dele era "Corte de cabelo + Pezinho" e o
 // casador de nome, sem achar o combo inteiro no catalogo, escolhia o componente de nome
 // mais parecido em TAMANHO — "Pezinho (acabamento)" (10 min) ganhava de "Corte de cabelo".
 // Agora o historico e quebrado nos componentes ("+") e cada um e resolvido; se o unico
 // componente reconhecido for um complemento curto (<=15 min), NAO assume nada e pergunta.
 const usualServices=(()=>{
  const parts=lastServiceName.split(/\s*\+\s*/).map(p=>p.trim()).filter(Boolean)
  const found:any[]=[]
  for(const p of (parts.length?parts:[lastServiceName])){const svc=findService(p);if(svc&&!found.some(f=>f.name===svc.name))found.push(svc)}
  if(!found.length&&lastService)found.push(lastService)
  return found
 })()
 if(usualServices.some((s:any)=>/\bcorte\b/i.test(s.name))){const i=usualServices.findIndex((s:any)=>/pezinho/i.test(s.name));if(i>=0)usualServices.splice(i,1)}
 const usualIsOnlyAddon=usualServices.length>0&&usualServices.every((s:any)=>Number(s.duration)<=15)
 if((intent==='availability'||intent==='book')&&!chosen.length&&verifiedPhone&&hasCustomer&&usualServices.length&&!usualIsOnlyAddon&&visits>=1&&!isPriceOrInfoQuestion&&!repeatRequest&&!recommendationRequest){
  next.services=usualServices.map((s:any)=>s.name)
  chosen.push(...usualServices)
  next.upsell_services_done=true
  assumedUsualService=usualServices.map((s:any)=>s.name).join(' + ')
 }

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

 // v29.53.0 — resposta à política de pagamento antecipado (cliente com 2+ furos).
 // "1"/topo = push pro Juliano criar o agendamento no painel e combinar o Pix;
 // "2"/não = fecha educado. Qualquer outra coisa segue o fluxo (a política fica
 // pendente e reaparece se ele tentar outro horário, já que o guard dispara de novo).
 if(state?.pending_prepay_policy){
  const ppp=state.pending_prepay_policy as Record<string,unknown>
  const aceita=/^1[\s!.,]*$/.test(normalizedQuestion.trim())||/\btopo\b|\btopar\b|aceito|concordo|fechado|combinado/.test(normalizedQuestion)||simpleYes
  const recusa=/^2[\s!.,]*$/.test(normalizedQuestion.trim())||simpleNo
  if(aceita&&!recusa){
   const pppPhone=String(verifiedPhone||next.phone||knownPhone||'').replace(/\D/g,'')
   reply=`Perfeito! 👊 Já passei seu pedido pro Juliano: ${formatDateBR(String(ppp.date))} às ${ppp.time}${ppp.services?` (${ppp.services})`:''}. Assim que ele reservar, você recebe a confirmação por aqui — e aí é só me pedir a chave Pix que eu te passo com o valor certinho 😉`
   actions=[]
   intent='other'
   handoff=false
   next.pending_prepay_policy=null
   const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
   if(pushSecret){
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'💸 Cliente topou Pix antecipado (política de furo)',body:`${next.name||contextFullName||pppPhone} aceitou: ${formatDateBR(String(ppp.date))} às ${ppp.time} (${ppp.services||'serviço'}, R$ ${ppp.price??'?'}). Crie o agendamento na Agenda — a JuIA passa a chave quando o cliente pedir.`,url:'/admin-agenda.html?app=1',tag:`prepay-policy-${pppPhone}`}})}).catch(()=>{})
   }
  }else if(recusa){
   reply='Tudo bem, sem problemas 😊 Se mudar de ideia, é só me chamar por aqui.'
   actions=[]
   intent='other'
   handoff=false
   next.pending_prepay_policy=null
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
 // bareBarbaAsk e a conversão services→availability abaixo não devem disparar pra
 // perguntas puras de preço/duração (isPriceOrInfoQuestion) nem quando o modelo já
 // pediu handoff (bug real: reclamação "a barba ficou desigual" citava "barba" e
 // virava um menu de opções de barba em vez de manter o handoff da reclamação).
 // v28.36.0: "sem barba" (ex.: descrição de imagem/link dizendo "corte tal, sem barba")
 // disparava o menu de opções de barba mesmo assim — o regex original não entendia
 // negação. Achado testando o reconhecimento de links de propósito. Mesmo padrão do
 // cancelNegated (uma negação explícita logo antes cancela o próprio gatilho).
 const barbaNegated=/\bsem\b[^.!?]{0,15}\bbarba\b/i.test(message)
 // v29.43.2 (bateria): "esqueci de pedir o oleo de barba" abria o menu de servicos de barba — produto nao e servico.
 const barbaProduto=/\b(oleo|óleo|balm|pomada|shampoo|creme|locao|loção|produto|kit)\b/i.test(message)
 const bareBarbaAsk=/\bbarba\b(?!\s*express)/i.test(message)&&!barbaNegated&&!barbaProduto&&!chosen.some((s:any)=>s.category==='barba')&&!isPriceOrInfoQuestion&&intent!=='handoff'
 // v28.30.5 — pedido do Juliano (31/07/2026): "cabelo" solto ("eu queria cabelo", "CABELO!")
 // não era entendido — a JuIA respondia com pergunta genérica ou a lista de mais procurados.
 // Igual ao padrão da barba: confirma o serviço óbvio ("seria um Corte de cabelo?") em vez
 // de adivinhar em silêncio ou devolver lista genérica. Não dispara quando a mensagem já
 // tem "corte" (aí o match normal resolve sozinho) nem quando já há corte/combo escolhido.
 // v29.43.5 (revisao 14-18/08): "cê pinta cabelo aí?" e "qual o produto que passou no meu cabelo?"
 // viravam "seria um Corte de cabelo?" — a palavra "cabelo" sozinha nao e pedido de corte quando a
 // frase fala de coloracao/quimica ou de produto.
 const cabeloOutroAssunto=/\b(pint|tint|colora|colorir|descolor|luzes|platin|nevou|reflexo|mecha|progressiva|alisa|hidrata|quimica|química|produto|passou|passa|usou|usa|pomada|leave|creme|oleo|óleo|shampoo|gel|cera)/i.test(message)
 const bareCabeloAsk=!cabeloOutroAssunto&&/\bcabelo\b/i.test(message)&&!/\bcorte\b/.test(normalizedQuestion)&&!chosen.some((s:any)=>s.category==='corte'||s.category==='combo')&&!isPriceOrInfoQuestion&&intent!=='handoff'&&!bareBarbaAsk
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&intent!=='handoff'){
  const loose=findServicesLoose(message)
  // v28.31.5: não adicionar via fallback um serviço GENÉRICO quando uma variante mais
  // específica dele já está escolhida — bug real achado testando: "quanto tempo dura a
  // barboterapia com ozônio?" deixava o state com "Barboterapia com vaporizador de
  // ozônio" (do modelo) E "Barboterapia" (deste fallback, que só casou o pedaço
  // "barboterapia" do texto). Se o cliente emendasse "quero agendar amanhã às 10h",
  // a JuIA somaria os DOIS (R$ 90, 70 min) sem ele ter escolhido nada disso. Um nome
  // que é substring de um serviço já escolhido é o mesmo serviço, não um novo.
  const newOnes=loose.filter((s:any)=>!chosen.some((c:any)=>c.name===s.name||normalize(c.name).includes(normalize(s.name)))&&!(bareBarbaAsk&&s.category==='barba')&&!(bareCabeloAsk&&(s.category==='corte'||s.category==='combo')))
  if(newOnes.length){
   chosen.push(...newOnes)
   next.services=chosen.map((s:any)=>s.name)
  }
  if(bareBarbaAsk){
   const barbaOptions=services.filter(s=>s.category==='barba')
   const outros=chosen.filter((c:any)=>c.category!=='barba').map((c:any)=>c.name)
   reply=`Pra barba, qual você prefere? ${barbaOptions.map(s=>`${s.name} (${money(s.price)}, ${s.duration} min)`).join(' · ')}.${(next.date||next.time)?` Me diz qual e já te passo os horários${outros.length?` pra ${outros.join(' + ')} + barba`:''}.`:''}`
   actions=barbaOptions.map(s=>({label:`${s.name} · ${money(s.price)}`,message:`Quero ${s.name}`}))
   intent='other'
   handoff=false
  }
  if(bareCabeloAsk){
   // v29.43.0 — caso Bruno (15/08): "apenas cabelo" virava a pergunta "seria um Corte de
   // cabelo? ou Corte + Lavagem?" — uma rodada a mais numa conversa que ja tinha 2h30 de
   // espera. "Cabelo" e Corte de cabelo: assume, avisa numa linha que existe a lavagem, e
   // segue pro horario. Quem quiser a lavagem so fala.
   const corte=findService('Corte de cabelo')
   const corteLavagem=findService('Corte + Lavagem')
   if(!next.date&&includesAny(normalizedQuestion,['agora','hoje']))next.date=today()
   next.haircut_wash_asked=true
   if(corte&&!chosen.some((c:any)=>c.name===corte.name)){chosen.push(corte);next.services=chosen.map((c:any)=>c.name)}
   cabeloAssumidoNota=corteLavagem?`(Anotei Corte de cabelo — se quiser com lavagem, o Corte + Lavagem sai ${money(corteLavagem.price)}, é só me dizer.)`:'(Anotei Corte de cabelo.)'
   handoff=false
  }
 }
 // v28.56.1 (05/08/2026, bateria de auditoria): o menu genérico substituía a resposta do
 // modelo SEMPRE que intent='services' e nenhum serviço do catálogo era reconhecido —
 // inclusive quando o cliente perguntou por um serviço que a barbearia NÃO faz. Bug real
 // reproduzido: "vocês fazem massagem tântrica?" respondia "Mais procurados: • Corte —
 // R$ 40 ...", sem nunca dizer que não trabalhamos com aquilo. Parece que a pergunta foi
 // ignorada e, pior, dá margem pro cliente achar que faz. O modelo já responde isso
 // corretamente ("não trabalhamos com esse serviço, mas temos..."), então nesses casos a
 // resposta dele é preservada. O menu só entra quando o pedido é genérico mesmo
 // ("quais serviços vocês têm?", "me manda a tabela de preços").
 const isGenericServiceAsk=/\b(quais|que)\s+(servicos|servico|opcoes|tratamentos)\b|\bservicos\b\s*\?|\bmenu\b|\btabela\s+de\s+preco|\blista\s+de\s+servico|\bo\s+que\s+voces\s+(fazem|oferecem)\b|\bcatalogo\b/.test(normalizedQuestion)
 // v29.43.2 (bateria 18/08): "atende mulher tambem?", "o valor e por pessoa ou tem desconto pra
 // duas?", "minha namorada terminou comigo, um corte anima?" recebiam a tabela de precos no
 // lugar da resposta — o modelo classificou como 'services' e o menu atropelava. O menu so
 // entra em pedido GENERICO de catalogo; qualquer outra pergunta fica com a resposta do modelo.
 if(intent==='services'&&!chosen.length&&isGenericServiceAsk){
  reply='Mais procurados:\n• Corte — R$ 40\n• Corte + Barba Express — R$ 65\n• Corte + Barboterapia — R$ 80\n• Barboterapia — R$ 40\nQual combina com você?'
  actions=[{label:'Ver catálogo completo',url:'https://www.barbeariadoju.com.br/agendar/'}]
 }
 // Cliente já citou o(s) serviço(s) exato(s) (ex.: "barba e pezinho") — não faz sentido
 // mostrar a lista genérica de mais procurados. Segue direto pro fluxo de disponibilidade.
 // Exceto se for pergunta pura de preço/duração — aí a resposta do modelo já respondeu
 // a pergunta, não faz sentido virar isso num fluxo de disponibilidade.
 if(intent==='services'&&chosen.length&&!isPriceOrInfoQuestion){
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
 // v28.31.3: exigia "pra/para" logo em seguida de "trocar/mudar [o/meu/esse] [servico]",
 // sem tolerar nada no meio — "trocar o servico DO MEU AGENDAMENTO pra Barboterapia" não
 // casava (a frase real tem "do meu agendamento" entre "servico" e "pra"), então o cliente
 // já dizia o serviço novo na mesma mensagem e mesmo assim a JuIA perguntava de novo "qual
 // serviço?". Agora só exige "trocar/mudar" + "servico" em qualquer lugar da frase, e pega
 // o texto depois do último "pra/para" — ainda seguro contra falso positivo (ex. "quero
 // agendar pra Barba Express", "mudar pra sexta") porque o gatilho real de troca de serviço
 // continua exigindo a palavra "servico" na frase, e o resultado só vira serviço de fato se
 // `findService` reconhecer o texto capturado.
 const wantsServiceSwap=/\b(trocar|mudar)\b/.test(normalizedQuestion)&&/\bservico\b/.test(normalizedQuestion)
 const swapTailMatch=wantsServiceSwap?normalizedQuestion.match(/(?:para|pra)\s+(.+)$/):null
 const swapTailService=swapTailMatch?findService(swapTailMatch[1]):null
 const changeServiceAsk=includesAny(normalizedQuestion,['trocar o servico','trocar de servico','mudar o servico','mudar de servico','trocar meu servico','mudar meu servico','pode trocar o servico','pode mudar o servico'])||Boolean(swapTailService)
 // v28.61.1 — caso Moisés, parte 2 (06/08/2026): "vou conseguir chegar só às 19:15" de quem
 // JÁ TEM agendamento é pedido de remarcação — mas nenhuma frase da lista abaixo casava e o
 // modelo respondia "te esperamos às 19:15!" SEM remarcar nada no sistema (pior que a recusa
 // fria original: o cliente é avisado que pode, e o sistema continua com o horário velho).
 // "chegar/chego + um horário" com agendamento futuro existente entra no fluxo de remarcação.
 const arrivalTimeAsk=upcomingBookings.length>0&&/\b(chegar|chego|chegando)\b[^.!?]{0,30}\b\d{1,2}[:h]\d{0,2}/.test(normalizedQuestion)
 const rescheduleAsk=(includesAny(normalizedQuestion,['remarcar','reagendar','mudar meu agendamento','mudar o agendamento','mudar esse agendamento','mudar de dia','mudar o dia','mudar de horario','mudar o horario','trocar de horario','trocar o horario','trocar de dia','trocar o dia','posso mudar pra','posso mudar para','quero mudar pra','quero mudar para','mudar para outro dia','mudar para outro horario'])||arrivalTimeAsk)&&!changeServiceAsk
 const cancelAsk=includesAny(normalizedQuestion,['pode cancelar','cancelar meu','cancela meu','quero cancelar','desmarcar','cancelamento','ja marquei em outro','marquei em outro lugar','nao vou mais poder ir','cancela o ','cancelar o ','cancela esse','cancelar esse','cancela pra mim','cancelar pra mim','cancela a ','cancelar a '])
 // "Não quero cancelar" contém a substring "quero cancelar", então cancelAsk também
 // disparava aqui — bug real (28/07/2026): cliente disse "Não quero cancelar, quero
 // mudar o serviço de corte para barba" e ficou preso perguntando "quer mesmo cancelar?"
 // repetidamente, porque cancelAsk sozinho bastava pra virar intent='cancel' abaixo,
 // ignorando que changeServiceAsk também era true pra essa mesma frase. Uma negação
 // explícita antes de "cancelar" cancela o próprio cancelAsk.
 const cancelNegated=/\bnao\b[^.!?]{0,20}\bcancelar\b/.test(normalizedQuestion)
 // Bug real achado no banco de teste (31/07/2026): "se pode cancelar depois, sem
 // problemas?" é uma pergunta hipotética sobre a política, não um pedido de cancelar
 // agora — mas batia no mesmo "pode cancelar" de cancelAsk e o cliente recebia "para
 // cancelar com segurança, preciso confirmar seu WhatsApp" do nada, no meio de uma
 // pergunta sobre como funciona o processo. "se" antes de "cancelar" (dentro de uma
 // janela curta) marca a frase como hipotética/condicional, não uma ação pedida agora.
 const cancelHypothetical=/\bse\b[^.!?]{0,20}\bcancelar\b/.test(normalizedQuestion)
 // v28.37.0 (item 4): resposta à oferta de lista de espera (ver next.pending_waitlist,
 // setado no bloco de disponibilidade sem horário).
 // v28.38.2: bug real achado testando de propósito — quando a oferta era INDIRETA (a
 // mensagem pergunta primeiro "Quer marcar nesse dia?" e só depois menciona a lista),
 // um "sim" do cliente confirmando a RESERVA no dia alternativo era sequestrado e virava
 // entrada na lista de espera do dia original: o cliente achava que tinha agendado, mas
 // só ficou esperando. Agora "sim" solto só entra na lista quando a pergunta foi DIRETA
 // sobre a lista (flag direct, setada no branch sem nenhum dia alternativo); a frase
 // explícita/botão ("quero entrar na lista de espera") continua valendo nos dois casos.
 // "Não" com oferta pendente descarta a oferta (sem isso, um "sim" qualquer mais tarde
 // na mesma conversa reativava a lista do nada).
 const waitlistAsk=includesAny(normalizedQuestion,['lista de espera','fila de espera','me avisa quando abrir','me avise quando abrir','entrar na lista','quero entrar na espera','avisa se abrir'])
 // v29.69.0 — os DOIS casos de sábado (22/08/2026, 11h45 e 16h29): depois de "não encontrei
 // horário hoje; o próximo dia é terça… ou entro com você na lista de espera", os clientes
 // responderam "Não obrigado" e "Vou deixar obrigado". A JuIA só limpava a oferta e seguia
 // empurrando agenda — chegou a listar os horários da TERÇA sem dizer que era terça — até
 // repetir a mesma frase e cair no "me embolei". Recusa à oferta de outro dia é fim de
 // assunto, não deixa de ser uma conversa em aberto: agradece, deixa a porta aberta e para.
 // Só quando a recusa vem SECA: se ele emenda um dia, horário ou período novo, é pedido novo.
 let recusouOfertaDeOutroDia=false
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&next.pending_waitlist){
  // "Vou deixar obrigado" (caso real, sábado 22/08 11h46) não casava com simpleNo — não tem
  // "não" nenhum na frase. Recusa educada de brasileiro quase nunca tem.
  const recusaSeca=/\b(vou deixar|deixa (pra la|assim|quieto|pra depois)|fica (pra|para) (a )?proxima|nao precisa|melhor deixar|deixo (pra|para) (depois|outro dia))\b/.test(normalizedQuestion)
  if((simpleNo||recusaSeca)&&!waitlistAsk){
   next.pending_waitlist=null
   recusouOfertaDeOutroDia=!extractRequestedTime(message)&&!detectPeriod(normalizedQuestion)&&!weekdayDatesMentioned(normalizedQuestion,today()).length&&!/\b(hoje|amanha|agora)\b/.test(normalizedQuestion)
  }
  else if((simpleYes&&!simpleNo&&next.pending_waitlist.direct)||waitlistAsk)intent='join_waitlist'
 }
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
 // v29.43.2 (bateria, BUG GRAVE): a pergunta de conflito ("é esse mesmo, é um novo, ou cancelar o
 // antigo?") reaproveitava pending_cancel_booking_id — e um "sim" seco do cliente CANCELAVA o
 // agendamento. Agora a escolha e explicita: 1/reagendar, 2/manter os dois, 3/cancelar (ou as
 // palavras). "sim"/"nao" soltos ou qualquer outra coisa reperguntam com numeros, sem cancelar nada.
 let conflictHandled=false
 if(next.pending_conflict_choice&&next.pending_cancel_booking_id){
  const t=normalizedQuestion.trim()
  if(/^1\b/.test(t)||rescheduleAsk||/\b(mudar|muda|esse mesmo|e esse|é esse|reagend)/.test(t)){
   next.pending_reschedule_booking_id=next.pending_cancel_booking_id
   next.pending_cancel_booking_id=null;next.pending_conflict_choice=null
   intent='reschedule'
  }else if(/^2\b/.test(t)||keepBothRequest||/\b(e outro|outro horario|novo horario|manter|os dois|ambos)\b/.test(t)){
   next.keep_both_bookings=true
   next.pending_cancel_booking_id=null;next.pending_conflict_choice=null
   intent='book'
  }else if(/^3\b/.test(t)||(cancelAsk&&!cancelNegated)){
   next.pending_conflict_choice=null
   intent='cancel'
  }else{
   const b=upcomingBookings.find((x:any)=>x.id===next.pending_cancel_booking_id)
   reply=`Só pra eu não errar 😊 Sobre o seu horário de ${b?formatDateBR(b.booking_date):''} às ${b?String(b.start_time).slice(0,5):''}, me responde com o número:\n*1* — Mudar esse pro novo horário 🔄\n*2* — É outro, manter os dois\n*3* — Cancelar o antigo ❌`
   actions=[{label:'1 — Mudar',message:'1'},{label:'2 — Manter os dois',message:'2'},{label:'3 — Cancelar o antigo',message:'3'}]
   intent='other';handoff=false;conflictHandled=true
  }
 }
 // v29.45.0 (caso Ricardo 19/08): a lista "qual deles quer cancelar? 1/2" nao guardava estado —
 // o "1" do cliente ia pro modelo, que repetia a lista, e o anti-repeticao soltava "me embolei".
 // Agora a lista fica em pending_cancel_options; numero, horario ou "nao" sao tratados aqui;
 // qualquer outra coisa (mudou de assunto) descarta a lista e segue normal.
 const cancelPickPending=Array.isArray(next.pending_cancel_options)&&next.pending_cancel_options.length>0
 const cancelPickAnswer=cancelPickPending&&(/^\s*\d{1,2}\s*[.)\-]?\s*$/.test(normalizedQuestion)||Boolean(extractRequestedTime(message))||(simpleNo&&!simpleYes))
 if(cancelPickPending&&!cancelPickAnswer&&!cancelAsk)next.pending_cancel_options=null
 if(!conflictHandled&&(cancelPickAnswer||(next.pending_cancel_booking_id&&!rescheduleAsk&&!changeServiceAsk&&!updateProductsAsk)||(cancelAsk&&!cancelNegated&&!cancelHypothetical)))intent='cancel'

 if(intent==='cancel'){
  const doCancel=async(bookingId:string)=>{
   const {data:cancelledRows,error:cancelError}=await supabase.rpc('whatsapp_cancel_booking',{p_phone:verifiedPhone,p_booking_id:bookingId})
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
    await notifyWaitlistIfMatch(supabase,cancelled.booking_date,cancelled.start_time)
   }
   next.pending_cancel_booking_id=null
   next.pending_cancel_options=null
  }
  // Escolhe 1 agendamento entre varios pelo numero da lista ou pelo horario citado ("o das 8h").
  const pickCancelTarget=(ids:string[])=>{
   const list=ids.map((id)=>upcomingBookings.find((b:any)=>b.id===id)).filter(Boolean)
   const num=normalizedQuestion.match(/^\s*(\d{1,2})\s*[.)\-]?\s*$/)
   if(num){const idx=Number(num[1])-1;return list[idx]||null}
   const t=extractRequestedTime(message)
   if(t){const hits=list.filter((b:any)=>String(b.start_time).slice(0,5)===t);if(hits.length===1)return hits[0]}
   return null
  }
  if(!verifiedPhone){
   reply='Para cancelar com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(cancelPickPending&&!next.pending_cancel_booking_id){
   const picked=pickCancelTarget(next.pending_cancel_options)
   if(picked){
    await doCancel(picked.id)
   }else if(simpleNo&&!simpleYes){
    reply='Tudo bem, não cancelei nada. Seus agendamentos continuam confirmados.'
    next.pending_cancel_options=null
    handoff=false
   }else{
    const list=(next.pending_cancel_options as string[]).map((id)=>upcomingBookings.find((b:any)=>b.id===id)).filter(Boolean)
    reply='Só me diz o número do que você quer cancelar:\n'+list.map((b:any,i:number)=>`*${i+1}* — ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} — ${b.service_name}`).join('\n')
    actions=list.map((b:any,i:number)=>({label:`${i+1} — ${formatDateBR(b.booking_date)} ${String(b.start_time).slice(0,5)}`,message:String(i+1)}))
    handoff=false
   }
  }else if(next.pending_cancel_booking_id){
   if(simpleYes&&!simpleNo){
    await doCancel(next.pending_cancel_booking_id)
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
   // "cancela o das 8h" com 2 agendamentos futuros: se o horario citado casa com um so, cancela
   // direto (o cliente ja pediu e ja apontou qual). Senao, lista numerada COM estado.
   const direct=pickCancelTarget(upcomingBookings.map((b:any)=>b.id))
   if(direct&&extractRequestedTime(message)){
    await doCancel(direct.id)
   }else{
    next.pending_cancel_options=upcomingBookings.map((b:any)=>b.id)
    reply='Você tem mais de um agendamento futuro. Qual deles quer cancelar? Me responde com o número:\n'+upcomingBookings.map((b:any,i:number)=>`*${i+1}* — ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} — ${b.service_name}`).join('\n')
    actions=upcomingBookings.map((b:any,i:number)=>({label:`${i+1} — ${formatDateBR(b.booking_date)} ${String(b.start_time).slice(0,5)}`,message:String(i+1)}))
    handoff=false
   }
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
  // v29.74.0 (caso Tiago, 25/08/2026, 14h24): pediu por áudio pra remarcar "pra amanhã",
  // e 25s depois mandou OUTRO áudio desistindo ("pode manter hoje mesmo, nem tinha pensado
  // nisso"). Com pending_reschedule ativo, o fluxo tratou a desistência como resposta de
  // remarcação e ofereceu os horários de amanhã (o "amanhã" veio do histórico) — o Juliano
  // teve que intervir e quase remarcou sem precisar. Desistir de remarcar tem que vir ANTES
  // de qualquer etapa do fluxo: mantém o agendamento original e limpa o estado.
  const keepSignal=includesAny(normalizedQuestion,['pode manter','pode deixar como esta','deixa como esta','deixar como esta','mantem o horario','manter o horario','mantem o mesmo','mantem assim','deixa assim','fica como esta','fica assim','nao precisa mudar','nao precisa remarcar','nao precisa trocar','nao vou mais remarcar','desisti de remarcar','vou hoje mesmo','mantem hoje','pode ser hoje mesmo'])
  const keepTarget=rescheduleTarget||(upcomingBookings.length===1?upcomingBookings[0]:null)
  if(keepSignal&&keepTarget){
   reply=`Perfeito! 😊 Então fica mantido: ${formatDateBR(keepTarget.booking_date)} às ${String(keepTarget.start_time).slice(0,5)} (${keepTarget.service_name}). Te espero!`
   actions=[]
   handoff=false
   next.pending_reschedule_booking_id=null
   next.pending_reschedule_new_date=null
   next.pending_reschedule_new_time=null
   next.pending_cancel_booking_id=null
   next.date=null
   next.time=null
   next.period=null
  }else{
  // v29.12.0 — caso Darlisson (11/08/2026): cliente disse "vamos ter que remarcar" e, na
  // mensagem seguinte, "Eu retorno o contato amanhã". A JuIA insistiu em oferecer horários
  // do MESMO dia e o agendamento das 15:45 ficou de pé — cadeira bloqueada por alguém que
  // já tinha avisado que não vinha. Decisão do Juliano: adiar sem data nova = LIBERAR o
  // horário na hora e deixar claro que é só chamar quando quiser. Só no WhatsApp
  // (verifiedPhone), mesma regra do cancelamento.
  const postponeTarget=verifiedPhone
    ?(upcomingBookings.find((b:any)=>b.id===next.pending_reschedule_booking_id)||(upcomingBookings.length===1?upcomingBookings[0]:null))
    :null
  const postponedWithoutDate=Boolean(postponeTarget)&&!next.date&&!extractRequestedTime(message)&&postponeSignal(normalizedQuestion)
  if(postponedWithoutDate){
   const {data:cancelledRows,error:cancelError}=await supabase.rpc('whatsapp_cancel_booking',{p_phone:verifiedPhone,p_booking_id:postponeTarget.id})
   const cancelled=Array.isArray(cancelledRows)?cancelledRows[0]:cancelledRows
   handoff=false
   if(cancelError||!cancelled){
    // Horário já começou (a RPC recusa) ou outra falha: não inventa que liberou.
    reply=`Sem problema! Vou avisar o Juliano que você precisa remarcar. Quando souber o melhor dia pra você, é só me chamar aqui que eu já vejo os horários. 😊`
   }else{
    reply=`Sem problema, imagina! 😊 Já liberei seu horário de ${formatDateBR(postponeTarget.booking_date)} às ${String(postponeTarget.start_time).slice(0,5)} pra você não ficar preso a ele. Quando quiser remarcar, é só me chamar aqui que eu vejo os horários com você.`
    await notifyWaitlistIfMatch(supabase,postponeTarget.booking_date,postponeTarget.start_time)
   }
   const ppSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
   const ppUrl=Deno.env.get('SUPABASE_URL')
   if(ppSecret&&ppUrl)await fetch(`${ppUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':ppSecret},body:JSON.stringify({custom:{title:cancelled?'🔓 Horário liberado — cliente vai remarcar depois':'⚠️ Cliente quer remarcar, mas o horário não pôde ser liberado',body:`${postponeTarget.customer_name||customerFirstName} — ${formatDateBR(postponeTarget.booking_date)} às ${String(postponeTarget.start_time).slice(0,5)} (${postponeTarget.service_name}). Ele disse que retorna o contato depois.`,url:'/admin-agenda.html?app=1',tag:`postponed-${postponeTarget.id}`}})}).catch(()=>{})
   next.pending_reschedule_booking_id=null
   next.pending_reschedule_new_date=null
   next.pending_reschedule_new_time=null
   next.date=null
   next.time=null
   next.period=null
  }else if(!verifiedPhone){
   reply='Para remarcar com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(next.pending_reschedule_new_date&&next.pending_reschedule_new_time){
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_reschedule_booking_id)
   if(simpleYes&&!simpleNo){
    const {data:rescheduledRows,error:rescheduleError}=await supabase.rpc('phone_reschedule_booking',{p_phone:verifiedPhone,p_booking_id:next.pending_reschedule_booking_id,p_new_booking_date:next.pending_reschedule_new_date,p_new_start_time:next.pending_reschedule_new_time,p_extend_close_minutes:60})
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
     if(target)await notifyWaitlistIfMatch(supabase,target.booking_date,target.start_time)
     // v28.61.0: push dedicado se o horário remarcado terminar depois do fechamento
     try{
      const rsEndMin=Number(String(rescheduled.start_time).slice(0,2))*60+Number(String(rescheduled.start_time).slice(3,5))+Number(rescheduled.duration_minutes||0)
      const rsCloseMin=new Date(String(rescheduled.booking_date)+'T12:00:00-03:00').getUTCDay()===6?15*60:19*60
      if(rsEndMin>rsCloseMin&&pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'⏰ Atendimento estendido marcado',body:`${rescheduled.customer_name||''} remarcou para ${formatDateBR(rescheduled.booking_date)} às ${String(rescheduled.start_time).slice(0,5)} (${rescheduled.service_name}) — termina depois do fechamento.`,url:'/admin-agenda.html?app=1',tag:`extended-${rescheduled.id}`}})}).catch(()=>{})
     }catch(extErr){console.error('[ju-ia-site] push estendido remarcacao',extErr)}
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
    // v28.61.1: se o cliente JÁ disse o horário novo na mesma mensagem ("vou chegar só às
    // 19:15"), não perguntar de novo "qual dia e horário?" — guardar o horário, assumir o
    // dia do próprio agendamento quando não dito, e pedir só a confirmação (a validação de
    // disponibilidade/horário estendido roda na resposta do "sim").
    const askedTime=extractRequestedTime(message)
    if(askedTime){
     next.time=askedTime
     if(!next.date)next.date=b.booking_date
     reply=`Vamos remarcar seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} (${b.service_name}) para ${formatDateBR(next.date)} às ${askedTime}, certo? Responda sim que eu verifico esse horário pra você.`
     actions=[{label:'Sim, esse horário',message:'Sim'},{label:'Outro dia/horário',message:'Prefiro outro dia'}]
    }else{
     reply=`Vamos remarcar seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} (${b.service_name}). Para qual dia e horário você quer mudar?`
    }
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
   }else if(!next.date&&!extractRequestedTime(message)){
    reply=`Para qual dia você quer mudar o agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)}?`
    handoff=false
   }else{
    // v28.61.1: cliente que só disse a HORA nova ("chego às 19:15") está falando do MESMO
    // dia do agendamento — assumir a data do próprio agendamento em vez de perguntar "qual
    // dia?" (a confirmação explícita sim/não logo abaixo cobre qualquer engano).
    if(!next.date)next.date=target.booking_date
    const duration=wantsServiceChange?chosen.reduce((a:number,s:any)=>a+s.duration,0):(Number(target.duration_minutes)||30)
    const {data,error}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:duration})
    if(error)return respond({error:error.message},500)
    const allSlots=(data||[]).map((x:any)=>String(x.slot_time).slice(0,5))
    const time=extractRequestedTime(message)||next.time
    if(!time){
     if(!allSlots.length){
      const nextAvail=await findNextAvailableDate(supabase,next.date,duration)
      if(nextAvail){
       // v29.69.0: sem o "(${weekday})" — formatDateBR já sai como "terça (25/08)" na troca
       // determinística do fim da função, e saía "terça (25/08) (terça-feira)" pro cliente.
       reply=`Não encontrei horário ${emDia(next.date)}. O próximo dia com horário disponível é ${formatDateBR(nextAvail.date)}: consigo te atender ${slotsPhrase(nextAvail.slots)}. Quer remarcar pra esse dia?`
       next.date=nextAvail.date
       actions=slotsSample(nextAvail.slots).map((t:string)=>({label:t,message:t}))
      }else{
       reply='Não encontrei horário disponível nas próximas semanas para esse atendimento. Quer falar direto com a equipe?'
       next.date=null
      }
     }else{
      reply=`Em ${formatDateBR(next.date)} consigo te atender ${slotsPhrase(allSlots)}. Qual fica melhor pra você?`
      actions=slotsSample(allSlots).map((t:string)=>({label:t,message:t}))
     }
     handoff=false
    }else if(allSlots.includes(time)){
     next.pending_reschedule_new_date=next.date
     next.pending_reschedule_new_time=time
     reply=`Confirmando: mudar seu agendamento de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)} para ${formatDateBR(next.date)} às ${time}${wantsServiceChange?` e o serviço para ${desiredServiceName}`:''}? Responda sim ou não.`
     actions=[{label:'Sim, remarcar',message:'Sim, pode remarcar'},{label:'Não, manter',message:'Não, manter o horário atual'}]
     handoff=false
    }else if(await (async()=>{
     // v28.61.0 — horário estendido também na remarcação (caso Moisés era exatamente
     // isso: "vou chegar 18:15" com agendamento já existente). Este intent inteiro só
     // roda com verifiedPhone (canal WhatsApp), então não precisa checar de novo.
     const {data:extOk}=await supabase.rpc('extended_close_slot_ok',{p_date:next.date,p_start_time:time,p_duration_minutes:duration,p_extend_minutes:60})
     return extOk===true
    })()){
     next.pending_reschedule_new_date=next.date
     next.pending_reschedule_new_time=time
     const isSatR=new Date(next.date+'T12:00:00-03:00').getUTCDay()===6
     reply=`Nosso horário normal vai até ${isSatR?'15:00':'19:00'}, mas pra você o Ju estica: consigo te encaixar às ${time} sim 😊 Confirmo a mudança de ${formatDateBR(target.booking_date)} às ${String(target.start_time).slice(0,5)} para ${formatDateBR(next.date)} às ${time}? Responda sim ou não.`
     actions=[{label:'Sim, remarcar',message:'Sim, pode remarcar'},{label:'Não, manter',message:'Não, manter o horário atual'}]
     handoff=false
    }else if(allSlots.length){
     reply=`${time} não está disponível em ${formatDateBR(next.date)}, mas consigo te atender ${slotsPhrase(allSlots)}. Algum desses serve?`
     actions=slotsSample(allSlots).map((t:string)=>({label:t,message:t}))
     next.time=null
     handoff=false
    }else{
     const nextAvail=await findNextAvailableDate(supabase,next.date,duration)
     if(nextAvail){
      reply=`Não encontrei horário ${emDia(next.date)}. O próximo dia com horário disponível é ${formatDateBR(nextAvail.date)}: consigo te atender ${slotsPhrase(nextAvail.slots)}. Quer remarcar pra esse dia?`
      next.date=nextAvail.date
      actions=slotsSample(nextAvail.slots).map((t:string)=>({label:t,message:t}))
     }else{
      reply='Não encontrei horário disponível nas próximas semanas para esse atendimento. Quer falar direto com a equipe?'
     }
     next.time=null
     handoff=false
    }
   }
  }
  } // fecha o else da desistência de remarcar (keepSignal, v29.74.0)
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

 // v28.37.0 (item 4): confirma a entrada na lista de espera oferecida no bloco de
 // disponibilidade sem horário (next.pending_waitlist). Mesmo padrão de segurança dos
 // outros fluxos, mas de risco bem menor (não cria agendamento nem mexe em nada
 // existente) — por isso não exige verifiedPhone como cancel/reschedule/change_service
 // exigem, só um telefone conhecido (site ou WhatsApp) e um nome.
 if(intent==='join_waitlist'){
  const offer=next.pending_waitlist
  if(!offer){
   intent='availability'
  }else if(simpleNo){
   reply='Tudo bem, não coloquei você na lista de espera. Se mudar de ideia, é só falar.'
   next.pending_waitlist=null
   handoff=false
  }else{
   const wlPhone=String(verifiedPhone||next.phone||knownPhone||'').replace(/\D/g,'')
   const wlName=String(next.name||contextFullName||'').trim()
   const missing=[]
   if(wlPhone.length<10)missing.push('seu WhatsApp com DDD')
   if(!wlName)missing.push('seu nome')
   if(missing.length){
    reply=`Para te colocar na lista de espera, preciso de ${missing.join(' e ')}.`
    handoff=false
   }else{
    let wlOk=false
    try{
     const wlResp=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/join-waitlist`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`},
      body:JSON.stringify({
       customer_name:wlName,
       customer_phone:wlPhone,
       preferred_date:offer.date,
       preferred_period:offer.period||'qualquer',
       service_name:offer.service_name,
       service_price:offer.service_price,
       duration_minutes:offer.duration_minutes,
       source:verifiedPhone?'whatsapp':'site',
      }),
     })
     const wlData=await wlResp.json().catch(()=>({}))
     wlOk=wlResp.ok&&Boolean(wlData?.ok)
    }catch(error){console.error('[ju-ia-site] join_waitlist',error)}
    reply=wlOk
     ?`Prontinho, ${firstName(wlName)}! Te coloquei na lista de espera pra ${formatDateBR(offer.date)}${offer.service_name?` (${offer.service_name})`:''}. Assim que abrir uma vaga, eu te aviso por aqui.`
     :'Não consegui te colocar na lista de espera agora. Pode tentar de novo em instantes, ou fale com o Juliano.'
    handoff=false
    next.pending_waitlist=null
    next.phone=wlPhone
    if(!next.name)next.name=wlName
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
 // v29.43.2 (bateria): "quero fazer sobrancelha tambem, alem do corte que ja marquei" — o modelo
 // classificava como agendamento novo e caia no "voce ja esta confirmado". Sinal de acrescimo +
 // referencia ao horario ja marcado + servico reconhecido = alteracao do agendamento existente.
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&verifiedPhone&&upcomingBookings.length>=1
  &&/\b(tambem|além|alem d[oa]|incluir|adicionar|acrescentar|aproveitar e|junto com)\b/.test(normalizedQuestion)
  &&/\b(ja marquei|que marquei|ja agendei|que agendei|meu horario|meu agendamento|no meu|alem d[oa])\b/.test(normalizedQuestion)){
  {
   // a frase "quero fazer sobrancelha tambem" nao casa nome de servico pela regra frouxa — mapa direto
   const kw:[RegExp,string][]=[[/sobrancelha/,'Sobrancelha Masculina'],[/pezinho/,'Pezinho (acabamento)'],[/nasal/,'Depilação nasal (cera quente)'],[/barba express/,'Barba Express'],[/barboterapia/,'Barboterapia'],[/lavagem/,'Corte + Lavagem'],[/hidrata/,'Hidratação / Reconstrução Capilar']]
   for(const [re,name] of kw){if(re.test(normalizedQuestion)){const svc=findService(name);if(svc&&!chosen.some((c:any)=>c.name===svc.name)){chosen.push(svc);next.services=chosen.map((c:any)=>c.name)}}}
  }
  if(chosen.length)intent='change_service'
 }
 if(intent==='change_service'){
  const desiredFresh=swapTailService||(ai.intent==='change_service'?chosen[0]:null)||null
  if(!verifiedPhone){
   reply='Para trocar o serviço com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.'
   handoff=true
  }else if(next.pending_change_service_new_name){
   const target=upcomingBookings.find((b:any)=>b.id===next.pending_change_service_booking_id)
   const desired=(next.pending_change_service_composed&&next.pending_change_service_composed.name===next.pending_change_service_new_name)?next.pending_change_service_composed:findService(next.pending_change_service_new_name)
   if(simpleYes&&!simpleNo){
    if(!desired){
     reply='Não reconheci esse serviço. Qual serviço você quer no lugar?'
     next.pending_change_service_new_name=null;next.pending_change_service_composed=null
     handoff=false
    }else{
     const {data:changedRows,error:changeError}=await supabase.rpc('phone_change_booking_service',{p_phone:verifiedPhone,p_booking_id:next.pending_change_service_booking_id,p_service_name:desired.name,p_service_price:desired.price,p_duration_minutes:desired.duration})
     const changed=Array.isArray(changedRows)?changedRows[0]:changedRows
     if(changeError||!changed){
      reply='Não consegui trocar o serviço agora — esse serviço pode não caber mais nesse horário. Quer tentar outro serviço ou outro horário?'
      handoff=false
      next.pending_change_service_new_name=null;next.pending_change_service_composed=null
     }else{
      reply=`Prontinho! Troquei o serviço do seu agendamento de ${formatDateBR(changed.booking_date)} às ${String(changed.start_time).slice(0,5)} para ${changed.service_name} (${money(changed.service_price)}).`
      handoff=false
      const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
      const supabaseUrl=Deno.env.get('SUPABASE_URL')
      if(pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{title:'🔧 Serviço do agendamento trocado pela JuIA',body:`${changed.customer_name||customerFirstName}\n${formatDateBR(changed.booking_date)} às ${String(changed.start_time).slice(0,5)}\nDe ${target?.service_name||'?'} para ${changed.service_name}`,url:'/admin-agenda.html?app=1',tag:`booking-service-changed-${changed.id}`}})}).catch(()=>{})
      next.pending_change_service_booking_id=null
      next.pending_change_service_new_name=null;next.pending_change_service_composed=null
      next.services=[]
     }
    }
   }else if(simpleNo){
    reply='Tudo bem, não troquei nada. Seu agendamento continua como estava.'
    next.pending_change_service_new_name=null;next.pending_change_service_composed=null
    handoff=false
   }else{
    reply=`Só confirmando: você quer trocar o serviço do seu agendamento de ${formatDateBR(target?.booking_date)} às ${String(target?.start_time||'').slice(0,5)}, de "${target?.service_name}" para "${desired?.name||next.pending_change_service_new_name}"${desired?` (${money(desired.price)}, ${desired.duration} min)`:''}? Responda sim ou não.`
    actions=[{label:'Sim, trocar',message:'Sim, pode trocar'},{label:'Não, manter',message:'Não, manter o serviço atual'}]
    handoff=false
   }
  }else if(!next.pending_change_service_booking_id){
   // v28.31.4: quando o cliente já diz o serviço-alvo na MESMA mensagem que pede a troca
   // (ex.: "quero trocar o serviço do meu agendamento pra Barboterapia"), este bloco
   // identificava o agendamento mas SEMPRE perguntava "qual serviço?" de novo, ignorando
   // que desiredFresh já tinha a resposta — só era consultado numa segunda mensagem. Bug
   // real achado testando de propósito: o v28.31.3 já corrigia a extração do serviço da
   // frase (swapTailMatch), mas o valor extraído nunca era usado aqui na primeira vez.
   // Agora, se já sabemos o serviço-alvo e ele é diferente do atual, pula direto pra
   // confirmação em vez de perguntar de novo.
   // v29.43.2 (bateria): "quero fazer sobrancelha tambem, alem do corte que ja marquei" caia
   // como TROCA ("qual servico no lugar?"). Com sinal de acrescimo (tambem/alem/incluir/
   // adicionar) e um servico reconhecido, o alvo vira o servico atual + o novo (nome
   // composto, preco e duracao somados) e a confirmacao diz "incluir", nao "trocar".
   const addSignal=/\b(tambem|além|alem d[oa]|incluir|adicionar|acrescentar|junto|mais um|e tamb[eé]m|aproveitar e)\b/.test(normalizedQuestion)
   const bookedNames=upcomingBookings.map((b:any)=>normalize(String(b.service_name||'')))
   const desiredNew=swapTailService||chosen.find((x:any)=>!bookedNames.some((n:string)=>n.includes(normalize(x.name))))||desiredFresh||null
   const askOrConfirm=(b:any)=>{
    next.pending_change_service_booking_id=b.id
    if(addSignal&&desiredNew){
     const atuais=String(b.service_name||'').split(/\s*\+\s*/).map((p:string)=>findService(p)).filter(Boolean)
     if(/pezinho/i.test(desiredNew.name)&&atuais.some((a:any)=>/\bcorte\b/i.test(a.name))){
      reply=`O pezinho já vem incluso no seu corte de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} 😉 Não precisa adicionar — está tudo certo!`
      next.pending_change_service_booking_id=null
      handoff=false
      return
     }
     if(atuais.some((a:any)=>a.name===desiredNew.name)){
      reply=`Seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} já inclui ${desiredNew.name} 😊 Está tudo certo!`
      next.pending_change_service_booking_id=null
      handoff=false
      return
     }
     const todos=[...atuais,desiredNew]
     const composed={name:todos.map((x:any)=>x.name).join(' + '),price:todos.reduce((a:number,x:any)=>a+Number(x.price||0),0),duration:todos.reduce((a:number,x:any)=>a+Number(x.duration||0),0)}
     next.pending_change_service_new_name=composed.name
     next.pending_change_service_composed=composed
     reply=`Confirmando: incluir ${desiredNew.name} no seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)}? Fica ${composed.name} (${money(composed.price)}, ${composed.duration} min). Responda sim ou não.`
     actions=[{label:'Sim, incluir',message:'Sim, pode incluir'},{label:'Não, manter',message:'Não, manter como está'}]
     handoff=false
     return
    }
    if(swapTailService&&normalize(swapTailService.name)!==normalize(String(b.service_name||''))){
     next.pending_change_service_new_name=swapTailService.name
     reply=`Confirmando: trocar o serviço do seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)}, de "${b.service_name}" para "${swapTailService.name}" (${money(swapTailService.price)}, ${swapTailService.duration} min)? Responda sim ou não.`
     actions=[{label:'Sim, trocar',message:'Sim, pode trocar'},{label:'Não, manter',message:'Não, manter o serviço atual'}]
    }else{
     reply=`Vamos trocar o serviço do seu agendamento de ${formatDateBR(b.booking_date)} às ${String(b.start_time).slice(0,5)} (atualmente ${b.service_name}). Qual serviço você quer no lugar?`
    }
    handoff=false
   }
   if(!upcomingBookings.length){
    reply='Não encontrei nenhum agendamento futuro nesse número para trocar o serviço.'
    handoff=false
   }else if(upcomingBookings.length===1){
    askOrConfirm(upcomingBookings[0])
   }else{
    const matched=upcomingBookings.find((b:any)=>normalizedQuestion.includes(String(b.start_time).slice(0,5)))
    if(matched){
     askOrConfirm(matched)
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
     await notifyWaitlistIfMatch(supabase,toCancel.booking_date,toCancel.start_time)
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
 // isPriceOrInfoQuestion aqui de novo: sem isso, uma pergunta de preço/duração que o
 // modelo já respondeu corretamente (ex. "quanto tempo demora uma luzes completa")
 // ainda podia cair nas perguntas de upsell abaixo e apagar a resposta real.
 // v28.37.1: bug real achado testando de propósito — "Quero entrar na lista de espera"
 // contém a palavra "quero", que satisfaz simpleYes. Sem excluir join_waitlist daqui, o
 // bloco de "retomar fluxo" mais abaixo (que reage a simpleYes/simpleNo quando data+hora
 // já estão preenchidos) sobrescrevia intent='join_waitlist' para 'book' e CRIAVA um
 // agendamento de verdade no dia/horário alternativo oferecido, em vez de colocar o
 // cliente na lista de espera do dia original — o oposto do que ele pediu.
 const notSpecialFlow=intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&intent!=='join_waitlist'&&!next.completed&&!isPriceOrInfoQuestion

 // v29.16.0 — FIM DA ESTEIRA DE VENDAS (12/08/2026, caso real do print do Juliano): o
 // fluxo antigo fazia até 3 perguntas de venda em série (upgrade da lavagem → complementos
 // → produto) ANTES de fechar o horário. O cliente respondeu "Não" e levou OUTRA pergunta
 // de venda na sequência — parou de responder, quase desistiu, e o Juliano teve que assumir
 // (um corte de R$40 quase perdido por causa de um complemento de R$15). Regras novas,
 // aprovadas por ele:
 //   1. UMA única oferta de venda por conversa, com opções NUMERADAS (o WhatsApp nunca
 //      mostra os botões de actions), feita JUNTO da confirmação de disponibilidade —
 //      o cliente ouve "sim, tem horário" ANTES de qualquer oferta (a oferta é montada
 //      no bloco de disponibilidade, mais abaixo).
 //   2. Qualquer "não" encerra TODA venda da conversa e vai direto pro fechamento.
 //   3. Produto deixou de ser pergunta: virou aviso passivo no fim da mesma mensagem.
 //   4. Se o cliente ignorar a oferta e falar de outra coisa, a venda morre ali. Nunca insistir.
 // next.upsell_offer_options = nomes na ordem numerada ('__none__' = "não quero nada");
 // next.upsell_offer_done = oferta já feita (ou dispensada) nesta conversa. Conversas
 // antigas em andamento com os flags legados contam como oferta já feita.
 const upsellOfferDone=Boolean(next.upsell_offer_done||next.upsell_services_done||next.upsell_products_done)
 // Quem responde "com lavagem"/"só o corte" (ex.: à pergunta do bareCabeloAsk) continua
 // entendido, mesmo sem a pergunta antiga do upgrade existir mais.
 if(notSpecialFlow&&chosen.some((s:any)=>s.name==='Corte de cabelo')){
  if(includesAny(normalizedQuestion,['com lavagem','quero lavagem','pode ser com lavagem','corte e lavagem','corte com lavagem'])){
   next.services=next.services.map((n:string)=>n==='Corte de cabelo'?'Corte + Lavagem':n)
   const idx=chosen.findIndex((s:any)=>s.name==='Corte de cabelo')
   if(idx>=0)chosen[idx]=findService('Corte + Lavagem')
   next.haircut_wash_asked=true
  }else if(includesAny(normalizedQuestion,['so o corte','só o corte','sem lavagem','so corte','apenas o corte','nao quero lavagem'])){
   next.haircut_wash_asked=true
  }
 }
 let offerTurn=false // true = esta resposta é a reação à oferta — o "retomar fluxo" abaixo não pode atropelar
 // v29.79.0 (caso Rodrigo, 26/08 19h33): resposta à escolha "combo em outro horário ×
 // manter o original". Depois do "não fecha pra X (50 min)", o "Só cabelo então" precisa
 // VOLTAR pro horário que o cliente pediu — antes o modelo regerava a mesma negativa, o
 // anti-papagaio do webhook trocava tudo por "me embolei" + handoff e o Juliano tinha que
 // converter na mão, na cadeira. pending_fit_choice é one-shot: consumido aqui, sempre.
 const pfc=state?.pending_fit_choice
 if(pfc&&pfc.time){
  next.pending_fit_choice=null
  const soBase=/\bso\b[\s\S]*?\b(corte|cabelo)\b|\bsem (a )?barba\b|\bdeixa (so )?o corte\b/.test(normalizedQuestion)
  if(soBase){
   const manter=pfc.added
    ?next.services.filter((n:string)=>n!==pfc.added)
    :next.services.filter((n:string)=>normalize(n).includes('corte'))
   if(manter.length){
    next.services=manter
    chosen=next.services.map((n:string)=>findService(n)).filter(Boolean)
    next.time=pfc.time
    intent='book';handoff=false
   }
  }
 }
 const pendingOffer=Array.isArray(next.upsell_offer_options)&&next.upsell_offer_options.length?next.upsell_offer_options as string[]:null
 // v29.54.0 (caso Aletéia): pergunta de preço no meio da oferta numerada não é resposta à
 // oferta nem "mudou de assunto" (que matava a venda) — é uma pergunta legítima que PRECISA
 // ser respondida com o valor. A oferta continua viva; o horário segue reservado.
 if(pendingOffer&&notSpecialFlow&&askedPrice&&!explicitConfirm&&chosen.length){
  const totalNow=chosen.reduce((a:number,s:any)=>a+Number(s.price||0),0)
  const durNow=chosen.reduce((a:number,s:any)=>a+Number(s.duration||0),0)
  const linhas=chosen.map((s:any)=>`${s.name} — ${money(s.price)}`).join('\n')
  reply=`${linhas}${chosen.length>1?`\n*Total: ${money(totalNow)}*`:''} (${durNow} min).${next.time?` Seu horário das ${next.time} continua reservado.`:''}\n\nQuer que eu confirme assim, ou prefere incluir algum dos itens que te mandei?`
  actions=[{label:'Confirmar assim',message:'Sim, pode confirmar'}]
  intent='other';handoff=false;offerTurn=true
 }else if(pendingOffer&&notSpecialFlow){
  // Palavra-chave de cada opção pra reconhecer resposta por extenso ("quero a barba").
  const offerKeyword=(n:string)=>{
   const k=normalize(n)
   if(k.includes('sobrancelha'))return 'sobrancelha'
   if(k.includes('barba'))return 'barba'
   if(k.includes('nasal'))return 'nasal'
   if(k.includes('lavagem'))return 'lavagem'
   if(k.includes('hidratacao'))return 'hidratacao'
   return k.split(' ')[0]
  }
  const bareAnswer=normalizedQuestion.trim().replace(/[\s!.,]+$/,'')
  const pickedIdx=/^[1-9]$/.test(bareAnswer)?Number(bareAnswer)-1:-1
  let addName='',declined=false,resolved=false
  if(pickedIdx>=0&&pickedIdx<pendingOffer.length){
   if(pendingOffer[pickedIdx]==='__none__')declined=true
   else addName=pendingOffer[pickedIdx]
   resolved=true
  }else{
   // Serviço citado por extenso: o modelo geralmente já mapeia pra updates.services (a
   // diferença em relação ao state anterior é o sinal mais confiável, cobre "não, só a
   // sobrancelha"); a palavra-chave é o plano B quando a mensagem não tem negação.
   const previousServices=Array.isArray(state?.services)?state.services:[]
   const modelAdded=pendingOffer.find(n=>n!=='__none__'&&next.services.includes(n)&&!previousServices.includes(n))
   const keywordPick=/(^|\s)nao(\s|$)/.test(normalizedQuestion)?null:pendingOffer.find(n=>n!=='__none__'&&normalizedQuestion.includes(offerKeyword(n)))
   if(modelAdded||keywordPick){addName=String(modelAdded||keywordPick);resolved=true}
   else if(simpleNo){declined=true;resolved=true}
   else if(simpleYes){
    // "sim, quero" sem dizer o quê — repete só o pedido do número, sem reabrir a lista inteira.
    reply='Qual deles você quer incluir? Pode me responder só com o número 😊'
    intent='other';handoff=false;offerTurn=true
   }else{
    // Mudou de assunto — a venda morre aqui (regra 4), a mensagem segue o fluxo normal.
    next.upsell_offer_options=null
   }
  }
  if(resolved){
   next.upsell_offer_options=null
   if(declined){
    // Fecha na hora: data+hora+serviço já estão travados. A única pergunta que ainda pode
    // aparecer é a confirmação de nome do bloco de book — que também faz o papel de
    // confirmação final do agendamento.
    intent='book';handoff=false
   }else if(addName){
    if(addName==='Corte + Lavagem'){
     next.services=next.services.filter((n:string)=>n!=='Corte de cabelo')
     if(!next.services.includes('Corte + Lavagem'))next.services.push('Corte + Lavagem')
    }else if(!next.services.includes(addName))next.services.push(addName)
    const newChosen=next.services.map((n:string)=>findService(n)).filter(Boolean)
    const total=newChosen.reduce((a:number,s:any)=>a+s.price,0),dur=newChosen.reduce((a:number,s:any)=>a+s.duration,0)
    // v29.79.0 (caso Rodrigo, 26/08 19h33): a oferta prometia o MESMO horário com a
    // duração nova sem conferir a agenda — "fica Corte + Barba às 08:00, posso
    // confirmar?" e, no "pode sim", "poxa, 08:00 não fecha" (8h + 50 min batia no
    // cliente das 8h30). A promessa só sai depois de revalidar o encaixe; se não
    // couber, a MESMA resposta já traz as alternativas do combo E a opção de manter só
    // o serviço original no horário escolhido — decisão do cliente em uma rodada.
    let encaixa=true,alternativas:string[]=[]
    if(next.date&&next.time){
     const {data:slotsFit}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:dur})
     const listaFit=(slotsFit||[]).map((x:any)=>String(x.slot_time).slice(0,5))
     if(!listaFit.includes(String(next.time).slice(0,5))){
      encaixa=false
      const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
      const alvoT=String(next.time).slice(0,5)
      alternativas=listaFit.slice().sort((a:string,b:string)=>Math.abs(mins(a)-mins(alvoT))-Math.abs(mins(b)-mins(alvoT))).slice(0,2)
     }
    }
    if(encaixa){
     reply=`Boa escolha! Então fica ${newChosen.map((s:any)=>s.name).join(' + ')} — ${money(total)} (${dur} min)${next.date&&next.time?`, ${formatDateBR(next.date)} às ${next.time}`:''}. Posso confirmar?`
     actions=[{label:'Confirmar',message:'Sim, pode confirmar'}]
    }else{
     const alvoT=String(next.time).slice(0,5)
     const baseNames=next.services.filter((n:string)=>n!==addName).join(' + ')||'o que você já tinha escolhido'
     next.pending_fit_choice={time:alvoT,added:addName}
     next.time=null
     const comboNome=newChosen.map((s:any)=>s.name).join(' + ')
     reply=alternativas.length
      ?`Posso incluir sim! Só que com ${addName} o atendimento fica com ${dur} min, e às ${alvoT} não fecha 😕 Pra ${comboNome} consigo ${alternativas.join(' ou ')}. Ou, se preferir, mantenho só ${baseNames} às ${alvoT} — o que fica melhor?`
      :`Posso incluir sim! Só que com ${addName} o atendimento fica com ${dur} min, e às ${alvoT} não fecha — e não sobrou outro horário nesse dia 😕 Quer que eu mantenha só ${baseNames} às ${alvoT}, ou vejo outro dia pro combo?`
     actions=[...alternativas.map((t:string)=>({label:t,message:t})),{label:`Manter só ${baseNames} às ${alvoT}`,message:`Manter só o ${baseNames} às ${alvoT}`}]
     respostaConferidaNaAgenda=true
    }
    intent='other';handoff=false;offerTurn=true
   }
  }
 }
 // Depois da oferta única resolvida (ou dispensada), retoma o fluxo sozinha — sem isso a
 // conversa ficava parada esperando o modelo "adivinhar" que devia seguir (v28.31.3).
 // Especialmente grave no WhatsApp: o cliente nunca vê botões, só digita "sim" — se isso
 // não vira agendamento, a conversa trava pra sempre. Diferença pro código antigo: só o
 // "sim" fecha (simpleNo não vira mais book — no fluxo novo, o "não" que fecha é o da
 // oferta, tratado acima com intent='book' explícito; um "não" solto depois disso, ex.
 // respondendo "Posso confirmar?" da opção adicionada, não pode criar agendamento).
 // v29.43.0 — !bareBarbaAsk: caso Luis (15/08): "Barba e cabelo" montava a pergunta "qual
 // barba?" e este bloco forcava 'availability' por cima — a JuIA listou horarios SO de
 // corte e a barba sumiu da conversa. Enquanto a barba nao estiver escolhida, a pergunta
 // dela tem prioridade (o horario vem logo depois, no mesmo fluxo).
 if(chosen.length&&!next.upsell_offer_options&&!offerTurn&&activelyBooking&&notSpecialFlow&&intent!=='book'&&!bareBarbaAsk){
  if(next.date&&next.time&&simpleYes)intent='book'
  else if(!(next.date&&next.time&&(simpleYes||simpleNo)))intent='availability'
 }

 const requestedPeriod=detectPeriod(normalizedQuestion)
 // cliente pode dizer o período antes mesmo de ter escolhido o serviço (ex.: "tem
 // horário hoje a tarde?" seguido de "corte de cabelo") — sem lembrar isso, a JuIA
 // perguntava de novo "manhã, tarde ou final do dia?" ignorando o que já foi dito.
 if(requestedPeriod)next.period=requestedPeriod
 // "Indiferente"/"qq horário" = o cliente abriu mão de escolher período. Guardado no estado
 // porque ele responde isso UMA vez e a conversa continua (upsell, produto, etc.) — sem
 // guardar, a pergunta de período voltaria no turno seguinte, que é exatamente o loop que
 // o Juliano viu. Um período dito depois ("prefiro de manhã") desfaz a indiferença.
 if(requestedPeriod)next.period_any=false
 else if(noPeriodPreference(normalizedQuestion))next.period_any=true
 const effectivePeriod=requestedPeriod||next.period
 const anyPeriodOk=Boolean(next.period_any)&&!effectivePeriod
 const requestedTime=extractRequestedTime(message)
 // Mesma lógica do período: se o cliente já tinha dito o horário antes das perguntas de
 // corte+lavagem/complementos/produtos entrarem no meio da conversa, não precisa repetir —
 // usa o horário já guardado em next.time enquanto o agendamento ainda não foi concluído.
 const effectiveTime=requestedTime||(next.completed?'':next.time||'')
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&(requestedPeriod||requestedTime)&&next.date&&chosen.length&&!bareBarbaAsk)intent='availability'

 // Pergunta genérica de disponibilidade ("tem horário agora?", "tem vaga hoje?") não é
 // motivo de handoff — a JuIA sabe checar a agenda sozinha. Sem isso, faltando serviço
 // e/ou data, a resposta ficava só por conta do modelo, que às vezes preferia encaminhar
 // pro Juliano em vez de perguntar o que faltava.
 // v29.43.2: "voces tem vaga de emprego? sou barbeiro" acionava o fluxo de agenda por causa de
 // "vaga". Pedido de trabalho/fornecedor nunca e pedido de horario.
 const jobAsk=/\b(vaga de emprego|vaga pra trabalhar|vaga de trabalho|trabalhar a[ií]|curr[ií]culo|contratando|emprego|estagio|est[áa]gio|representante|fornecedor|distribuidora|parceria comercial)\b/.test(normalizedQuestion)
 const availabilityAsk=!jobAsk&&includesAny(normalizedQuestion,['tem horario','tem vaga','horario livre','horario disponivel','algum horario','horario vago','agenda aberta','vaga agora','vaga hoje'])
 // !bareCabeloAsk: se acabamos de perguntar "seria um Corte de cabelo?", essa pergunta não
 // pode ser atropelada pelo fluxo de disponibilidade no mesmo turno (a data, se citada, já
 // foi guardada dentro do bloco do bareCabeloAsk acima).
 if(intent!=='cancel'&&intent!=='reschedule'&&intent!=='change_service'&&intent!=='update_products'&&availabilityAsk&&!bareCabeloAsk&&!bareBarbaAsk){
  if(!next.date&&includesAny(normalizedQuestion,['agora','hoje']))next.date=today()
  intent='availability'
  handoff=false
 }
 if(keepBothRequest){next.keep_both_bookings=true}
 // v29.43.2 (bateria 18/08): "precisa agendar ou da pra chegar e esperar?" e "posso levar meu
 // filho so aparecendo?" iam direto pro fluxo sem responder a pergunta. Resposta fixa (e verdade
 // da casa): hora marcada, sem fila; encaixe so se houver vaga — e ja oferece ver horario.
 const walkinAsk=/\b(sem (agendar|marcar|hora marcada|agendamento)|chegar e esperar|por ordem de chegada|s[óo] aparecendo|aparecer (a[ií]|la|l[áa])|precisa agendar|precisa marcar|tem que agendar|tem que marcar|encaixe)\b/.test(normalizedQuestion)
 if(walkinAsk&&!next.time&&intent!=='cancel'&&intent!=='reschedule'){
  reply=`Aqui a gente trabalha com hora marcada — assim você não fica esperando e o atendimento sai sem pressa. 😊 Encaixe sem horário só se sobrar vaga na hora, então o mais garantido é reservar. Se quiser, me diz o serviço e o dia que eu já vejo um horário pra você.`
  actions=[{label:'Ver horários',url:'https://www.barbeariadoju.com.br/agendar/'}]
  intent='other'
  handoff=false
 }
 // v29.68.0 — MENSAGEM COMERCIAL/PROSPECÇÃO (caso Gleiciane, 24/08/2026 12h58): consultora
 // de "desconto na conta de luz" recebeu do modelo uma resposta seca ("não envie mais
 // mensagens comerciais por aqui") e, quando perguntou o contato correto, a JuIA NEGOU que
 // existisse contato comercial — sendo que existe: contato@barbeariadoju.com.br. Resposta
 // padronizada pelo Juliano: educada, este canal é exclusivo de agendamento, comercial é
 // pelo e-mail. Regex conservador (sinais claros de prospecção) pra nunca pegar cliente;
 // o prompt também aprendeu, como rede pros casos que o regex não cobre.
 const commercialPitch=/\b(sou (consultor|consultora|representante|vendedor|vendedora|assessor|assessora|corretor|corretora)\b|proposta comercial|parceria comercial|oportunidade de negocio|desconto na conta de (luz|energia)|energia (solar|fotovoltaica)|consorcio|emprestimo|credito consignado|maquininha|plano (odontologico|de saude) (empresarial|para empresas)|marketing digital|trafego pago|impulsionar (seu|o) (negocio|perfil|instagram)|(comprar|ganhar) seguidores|criacao de sites?|panfletagem|permuta)\b/.test(normalizedQuestion)
 const commercialContactAsk=/\bassuntos? comercia(l|is)\b|\b(contato|canal|e-?mail|email|numero|telefone|endereco)\b[^.!?]{0,40}\bcomercia(l|is)\b/.test(normalizedQuestion)
 if(commercialPitch||((state?.commercial_contact||commercialPitch)&&commercialContactAsk)){
  reply=commercialContactAsk&&!commercialPitch
   ?`Claro! Para assuntos comerciais é só escrever para o e-mail contato@barbeariadoju.com.br 😊 Este WhatsApp fica reservado para o agendamento dos clientes. Obrigado!`
   :`Obrigado pelo contato! 😊 Este canal é exclusivo para agendamento de serviços dos clientes da Barbearia do Ju. Assuntos comerciais (propostas, parcerias, fornecedores e divulgação) são atendidos somente pelo e-mail contato@barbeariadoju.com.br — pode enviar sua proposta por lá que ela será avaliada com calma. Obrigado pela compreensão! 💈`
  actions=[]
  intent='other'
  handoff=false
  next.commercial_contact=true
 }
 // v29.68.0 — resposta da pergunta de primeira visita (feita uma única vez logo após a
 // confirmação do agendamento, ver bloco do intent 'book'). "1"/"primeira vez" ou
 // "2"/"já sou cliente" alimentam o cadastro: etiqueta + prior_visits (v29.9.0, base do
 // novo×recorrente dos Relatórios; 1 = piso de "já era cliente", nunca sobrescreve
 // contagem manual do Juliano). Qualquer outra resposta segue o fluxo normal e a
 // pergunta não se repete (one-shot).
 if(state?.pending_first_visit&&verifiedPhone){
  next.pending_first_visit=null
  const fvFirst=/^\s*1\s*$/.test(normalizedQuestion)||/\b(primeira vez|primeira visita|nunca (fui|vim|cortei)|to conhecendo|estou conhecendo)\b/.test(normalizedQuestion)
  const fvPrior=/^\s*2\s*$/.test(normalizedQuestion)||/\b(ja sou cliente|ja era cliente|cliente antigo|cliente de antes|ja frequento|sempre corto|ja cortava|de longa data|cliente (ha|a) (tempos|anos|muito tempo))\b/.test(normalizedQuestion)
  if(fvFirst!==fvPrior){
   try{
    const fvDigits=String(verifiedPhone).replace(/\D/g,'')
    const fvSem=(fvDigits.length>=12&&fvDigits.startsWith('55'))?fvDigits.slice(2):fvDigits
    const fvTag=fvFirst?'primeira-visita-declarada':'ja-era-cliente-declarado'
    const {data:fvRows}=await supabase.from('customer_profiles').select('id,internal_tags,prior_visits').or(`phone.eq.${fvDigits},phone.eq.${fvSem},phone.eq.55${fvSem}`).limit(1)
    const fvRow=Array.isArray(fvRows)&&fvRows.length?fvRows[0]:null
    if(fvRow){
     const fvTags=(Array.isArray(fvRow.internal_tags)?fvRow.internal_tags:[]).filter((t:string)=>t!=='primeira-visita-declarada'&&t!=='ja-era-cliente-declarado')
     fvTags.push(fvTag)
     const fvUpd:Record<string,unknown>={internal_tags:fvTags,updated_at:new Date().toISOString()}
     if(fvPrior&&!(Number(fvRow.prior_visits)>0))fvUpd.prior_visits=1
     const {error:fvUpdErr}=await supabase.from('customer_profiles').update(fvUpd).eq('id',fvRow.id)
     if(fvUpdErr)console.error('[ju-ia-site] first-visit update',fvUpdErr)
    }else{
     // agendamento público não cria perfil na hora (só na conclusão) — cria aqui pra
     // declaração não se perder; telefone no formato do booking (com 55), que é o que
     // os fluxos de conclusão/fidelidade procuram. upsert por telefone (não insert):
     // se um perfil nascer entre o select acima e este write, ninguém duplica.
     const {error:fvInsErr}=await supabase.from('customer_profiles').upsert({name:String(next.name||'Cliente WhatsApp').trim(),phone:fvDigits,internal_tags:[fvTag],prior_visits:fvFirst?0:1},{onConflict:'phone'})
     if(fvInsErr)console.error('[ju-ia-site] first-visit insert',fvInsErr)
    }
    reply=fvFirst
     ?`Que alegria receber você pela primeira vez! 🎉 Pode vir no capricho: aqui é hora marcada, sem fila, atendimento sem pressa e café por nossa conta. Vai ser um prazer cuidar do seu visual — até já! 💈`
     :`Que bom saber que você já é de casa! 🙌 Obrigado por avisar — registrei aqui no seu cadastro. Até o seu horário! 💈`
    actions=[]
    intent='other'
    handoff=false
   }catch(fvErr){console.error('[ju-ia-site] first-visit resposta',fvErr)}
  }
 }
 // "voces atendem hoje?" / "aberto ainda?" / "socorro, aberto?": primeiro diz se esta aberto
 // e ate que horas, depois segue o fluxo normal (o restante da resposta continua).
 const openTodayAsk=/\b(atende[m]? hoje|atendendo hoje|aberto (ainda|hoje|agora)|abertos? (ainda|hoje|agora)|funciona hoje|abre hoje|est[ãa]o abertos?|ainda da p(ra|ara)? atender|ainda atende)\b/.test(normalizedQuestion)
 if(openTodayAsk&&!/\b(amanh[ãa]|s[áa]bado|domingo|segunda|ter[çc]a|quarta|quinta|sexta|feriado)\b/.test(normalizedQuestion)){
  const wd=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'})).getDay()
  const hourNow=Number(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date()))
  const fechadoHoje=closures.some((c:any)=>String(c?.date||'')===formatDateBR(today()))
  const limite=wd===6?15:(wd>=2&&wd<=5?19:0)
  let aviso=''
  if(fechadoHoje)aviso='Hoje estamos excepcionalmente fechados.'
  else if(!limite)aviso='Hoje estamos fechados (não abrimos domingo e segunda) — voltamos terça às 8h.'
  else if(hourNow>=limite)aviso=`Hoje já encerramos — atendemos até ${limite}h.`
  else aviso=`Sim, hoje atendemos até ${limite}h!`
  avisoAbertoHoje=aviso
 }
 // v29.43.0 — ADIAMENTO/DESISTENCIA (caso Bruno, 15/08, 11:28): depois de nao conseguir o
 // horario que queria, ele escreveu "Esse horário não consigo / Mas deixa, qlq coisa vou
 // semana que vem" — e a JuIA repetiu a lista de horarios do dia, feito papagaio. Quando o
 // cliente sinaliza que vai deixar pra depois, a resposta certa nao e insistir no dia de
 // hoje: e aceitar com simpatia e ja abrir a porta pro proximo agendamento (semana que vem,
 // outro dia). Sem hora nova na mensagem (senao e um pedido novo, nao desistencia).
 const desistenciaSignal=/\b(deixa (pra la|pra outra|pra proxima|assim|quieto)|mas deixa|entao deixa|semana que vem|proxima semana|outro dia|outra hora|depois eu (vejo|falo|marco|passo)|fica pra (proxima|outra)|mais pra frente|agora nao (da|consigo|vai dar)|nao vai dar hoje|hoje nao (da|consigo|vai dar))\b/.test(normalizedQuestion)
 if(desistenciaSignal&&activelyBooking&&notSpecialFlow&&!requestedTime&&!requestedPeriod&&!simpleYes&&intent!=='book'){
  const semanaQueVem=/semana que vem|proxima semana/.test(normalizedQuestion)
  const nome=hasCustomer&&customerFirstName!=='cliente'?`, ${customerFirstName}`:''
  reply=`Sem problema${nome}! 😊 Fica combinado assim. Se quiser já deixar seu horário garantido ${semanaQueVem?'na semana que vem':'pra outro dia'}, me diz o dia e o horário que ficam bons pra você (ex.: "terça às 14h") que eu reservo por aqui mesmo.`
  actions=[]
  next.date=null
  next.time=null
  next.sales_stage='postponed'
  intent='other'
  handoff=false
 }
 // v29.69.0 — fecho da recusa detectada lá em cima (ver comentário do recusouOfertaDeOutroDia).
 if(recusouOfertaDeOutroDia&&notSpecialFlow&&intent!=='book'&&intent!=='join_waitlist'&&intent!=='other'){
  const nome=hasCustomer&&customerFirstName!=='cliente'?`, ${customerFirstName}`:''
  reply=`Sem problema${nome}! 😊 Obrigado por avisar. Quando quiser, é só me chamar por aqui que eu vejo um horário pra você. 💈`
  actions=[]
  next.date=null
  next.time=null
  next.period=null
  next.sales_stage='postponed'
  intent='other'
  handoff=false
 }

 dropPezinhoSeTemCorte()
 dropBarbaRedundante()
 // v29.64.0 — caso Helder (22/08, 09h52): a JuIA ofereceu "13:45 — serve pra você?", ele
 // respondeu "13:45 então" e ela perguntou DE NOVO "quer reservar esse horário?" (ele teve
 // que dizer "Sim"; no dia anterior já tinha dito ao Juliano que a IA é "chatinha"). Quem
 // escolhe um horário que a própria JuIA acabou de oferecer já está reservando: vai direto
 // pro agendamento (a RPC reconfere a vaga). Só quando a oferta única de venda já passou —
 // senão a mensagem certa é a de disponibilidade com a oferta numerada, que também fecha.
 {
  const lastAssistant=String([...(Array.isArray(body.history)?body.history:[])].reverse().find((h:any)=>h&&h.role==='assistant')?.content||'')
  const soOHorario=normalizedQuestion.replace(/[^a-z0-9:]/g,'').length<=16
  if(intent==='availability'&&effectiveTime&&chosen.length&&next.date&&soOHorario&&!isQuestion&&lastAssistant.includes(effectiveTime)&&/serve pra voc|qual (fica|prefere|voc)|algum desses|mais perto|exemplo/i.test(lastAssistant)&&(upsellOfferDone||next.upsell_offer_done)){
   next.time=effectiveTime
   intent='book'
  }
 }
 // v29.69.0 (caso Tiago): dois ou mais dias citados pelo NOME mandam mais que a data que
 // ficou guardada no estado — quem responde "segunda, terça e quarta" está escolhendo entre
 // esses dias, não confirmando o dia que a JuIA sugeriu antes. Zerar a data aqui é o que
 // deixa a varredura de dias (logo abaixo) entrar em vez do fluxo de um dia só.
 if(intent==='availability'&&!extractRequestedTime(message)&&weekdayDatesMentioned(normalizedQuestion,today()).length>1)next.date=null
 // v29.72.0 — caso Bruno (25/08, 11h14): cliente NOVO perguntou "tem horário livre às 13:00
 // ou 14:00?" e recebeu "qual serviço você tem interesse?" — sumiu, e nem o Juliano na mão
 // reverteu (11h38). Cliente perguntando disponibilidade está pronto pra fechar; a rodada
 // extra de "qual serviço" mata o timing. Regra do Juliano: puxa pro CORTE (carro-chefe) —
 // assume, responde JÁ com a disponibilidade e avisa na nota transparente (mesma mecânica
 // do bareCabeloAsk e do serviço-de-sempre). Se for outro serviço, o cliente corrige e o
 // fluxo refaz. Só no WhatsApp (no site o catálogo está na tela) e nunca em pergunta de
 // preço/informação. Hora citada sem dia (caso do Bruno) = hoje.
 if(intent==='availability'&&!chosen.length&&verifiedPhone&&!isPriceOrInfoQuestion&&!bareBarbaAsk&&!bareCabeloAsk&&notSpecialFlow){
  const corteAssumido=findService('Corte de cabelo')
  if(corteAssumido){
   chosen.push(corteAssumido)
   next.services=chosen.map((c:any)=>c.name)
   if(!next.date&&(effectiveTime||requestedPeriod)&&!weekdayDatesMentioned(normalizedQuestion,today()).length)next.date=today()
   cabeloAssumidoNota='(Anotei Corte de cabelo — se quiser outro serviço ou incluir a barba, é só me dizer 😉)'
  }
 }
 if(intent==='availability'&&!chosen.length){
  // v28.30.4: quando a pergunta é genérica mas já tem um DIA ("tem horário hoje?"),
  // responde na hora se aquele dia tem agenda aberta (sondando com duração mínima de
  // 30min) em vez de só perguntar o serviço — num dia fechado, a resposta certa é
  // "hoje não temos + próximo dia aberto + qual serviço?", tudo numa mensagem
  // (pedido do Juliano, 31/07/2026, durante o bloqueio de agenda da viagem).
  if(next.date){
   const {data:probe}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:30})
   if(!(probe||[]).length){
    const nextAvail=await findNextAvailableDate(supabase,next.date,30)
    if(nextAvail){
     const noSlotsIntro=next.date===today()?'Hoje não temos horários disponíveis':`Não temos horários ${emDia(next.date)}`
     reply=`${noSlotsIntro}. O próximo dia com agenda aberta é ${formatDateBR(nextAvail.date)}. Qual serviço você tem interesse? Assim já te passo os horários certinhos.`
     next.date=nextAvail.date
    }else{
     reply='No momento não encontrei agenda aberta nas próximas semanas. Quer falar direto com a equipe?'
    }
   }else{
    reply=`Temos sim! Qual serviço você tem interesse? Assim já confiro os horários certinhos para ${formatDateBR(next.date)} pra você.`
   }
  }else{
   reply='Claro! Qual serviço você tem interesse? Assim já confiro os horários certinhos pra você.'
  }
  actions=[{label:'Ver serviços',url:'https://www.barbeariadoju.com.br/agendar/'}]
  handoff=false
 }else if(intent==='availability'&&chosen.length&&!next.date){
  // v29.69.0 — CASO TIAGO (24/08/2026, 17h58). Ele perguntou "Para que dia você tem vaga
  // pra cortar essa semana?" e recebeu de volta a própria pergunta: "Para qual dia você
  // quer ver os horários?". Respondeu "Após as 19h" — mesma frase. Respondeu
  // "Segunda-feira, terça-feira e quarta-feira" — mesma frase de novo, e aí o anti-papagaio
  // do whatsapp-webhook cortou com "Desculpe, me embolei aqui" e chamou o Juliano, que
  // fechou o horário na mão em 1 minuto. Faltavam três coisas, e todas caíam nesta mesma
  // pergunta cega:
  //   1. pergunta por DIAS ("quais dias", "essa semana") — a resposta certa são os dias;
  //   2. VÁRIOS dias citados de uma vez — o modelo só tem um updates.date, e devolve null;
  //   3. piso de horário sem dia ("após as 19h") — a restrição era simplesmente descartada.
  // Agora, em qualquer um dos três, a JuIA varre a agenda de verdade e responde com dias.
  // E existe uma trava: a pergunta do dia só pode ser feita UMA vez na conversa — se ela
  // já foi feita, quem tem que trazer informação nova é a JuIA, não o cliente.
  const duration=chosen.reduce((a:number,s:any)=>a+s.duration,0)
  const serviceNames=chosen.map((s:any)=>s.name).join(' + ')
  const pisoDeHorario=/\b(apos|depois d[ae]s?|a partir d[ae]s?)\b/.test(normalizedQuestion)&&Boolean(requestedTime)
  const minTime=pisoDeHorario?requestedTime:''
  const diasCitados=weekdayDatesMentioned(normalizedQuestion,today())
  const perguntaDeDias=/\b(quais? dias?|que dias?|qual dia (voce|vc|voces|vcs)|que dia (voce|vc|voces|vcs)|essa semana|nessa semana|nesta semana|proximos dias|dias disponiveis|quando (voce|vc|voces|vcs))\b/.test(normalizedQuestion)
  const jaPerguntouODia=/(para|pra) qual dia/i.test(ultimaFalaJuIA)
  // v29.70.0: o handoff=false do fim deste bloco (que existe pra não vazar handoff do
  // modelo) estava engolindo o pedido de exceção fora do horário — o Juliano nunca
  // recebia o push. Flag em vez de atribuição direta.
  let pedeExcecaoAoJuliano=false
  if(diasCitados.length||perguntaDeDias||jaPerguntouODia||minTime){
   const varredura=diasCitados.length
    ?await availabilityForDates(supabase,diasCitados,duration,minTime)
    :await findAvailableDatesInRange(supabase,today(),duration,7,3,minTime)
   const comVaga=varredura.filter((d:any)=>d.slots.length)
   const semVaga=diasCitados.length?varredura.filter((d:any)=>!d.slots.length):[]
   const nota=semVaga.length?` ${semVaga.map((d:any)=>minTime?`${emDiaCap(d.date)} não tenho nada depois das ${horaFalada(minTime)}`:semVagaTxt(d.date)).join(' e ')}.`:''
   if(comVaga.length===1){
    // Um dia só: já assume esse dia e passa direto pros horários — não faz sentido
    // perguntar "qual dia?" quando existe um.
    next.date=comVaga[0].date
    reply=`Para ${serviceNames} (${duration} min) consigo te atender ${emDia(comVaga[0].date)}${minTime?` depois das ${horaFalada(minTime)}`:''}: ${slotsPhrase(comVaga[0].slots)}.${nota} Qual horário fica melhor pra você?`
    actions=slotsSample(comVaga[0].slots).map((t:string)=>({label:t,message:t}))
   }else if(comVaga.length){
    const lista=comVaga.map((d:any)=>diaHumano(d.date))
    const listaTxt=`${lista.slice(0,-1).join(', ')} e ${lista[lista.length-1]}`
    reply=`Para ${serviceNames} (${duration} min) tenho vaga ${minTime?`depois das ${horaFalada(minTime)} `:''}nestes dias: ${listaTxt}.${nota} ${emDiaCap(comVaga[0].date)} consigo te atender ${slotsPhrase(comVaga[0].slots)}. Qual dia fica melhor pra você?`
    actions=comVaga.map((d:any)=>({label:diaHumano(d.date),message:`Quero ${diaHumano(d.date)}`}))
   }else{
    // Nada dentro da restrição. O caso real é o piso alto demais: o Tiago pediu "após as
    // 19h" e a agenda abre até 18:30, porque fechamos às 19h. Dizer isso na hora, com o
    // horário possível mais próximo, é o que o Juliano faria — e é o oposto de repetir
    // "para qual dia?" fingindo que a restrição não existe.
    const semFiltro=diasCitados.length
     ?await availabilityForDates(supabase,diasCitados,duration)
     :await findAvailableDatesInRange(supabase,today(),duration,7,3)
    const alternativa=semFiltro.find((d:any)=>d.slots.length)
    if(alternativa&&minTime){
     const ultimo=alternativa.slots[alternativa.slots.length-1]
     // v29.70.0 — a v29.69.0 respondia "depois das X eu não consigo" e ficava nisso, o que
     // CONTRADIZ duas verdades da casa: (1) o horário estendido já existe desde a v28.61.0
     // (caso Moisés — o Ju estica até 60 min depois do fechamento, só no WhatsApp), e (2)
     // o Juliano abre exceção fora do horário quando dá (regra dele, 24/08/2026). Então a
     // ordem certa é: tenta o estendido de verdade; se nem esticado couber, quem decide
     // exceção é ELE — a JuIA não nega e não promete, encaminha (handoff).
     let esticado=''
     if(verifiedPhone){
      const {data:extOk}=await supabase.rpc('extended_close_slot_ok',{p_date:alternativa.date,p_start_time:minTime,p_duration_minutes:duration,p_extend_minutes:60})
      if(extOk===true)esticado=minTime
     }
     next.date=alternativa.date
     if(esticado){
      const isSatX=new Date(alternativa.date+'T12:00:00-03:00').getUTCDay()===6
      next.time=esticado
      next.upsell_offer_done=true // atendimento que vara o fechamento nunca leva oferta de venda
      respostaConferidaNaAgenda=true // extended_close_slot_ok já validou colisão e bloqueio
      reply=`Nosso horário normal vai até ${isSatX?'15:00':'19:00'}, mas pra você o Ju estica: consigo te encaixar ${emDia(alternativa.date)} às ${esticado} 😊 Posso confirmar?`
      actions=[{label:`Confirmar ${esticado}`,message:`Quero reservar ${esticado}`}]
     }else{
      reply=`Meu último horário ${emDia(alternativa.date)} é ${ultimo}. Depois disso o Juliano às vezes abre uma exceção — vou falar com ele agora e já te respondo, tá? 😊 Se preferir garantir logo, reservo ${ultimo} pra você.`
      actions=[{label:ultimo,message:ultimo}]
      pedeExcecaoAoJuliano=true
     }
    }else if(alternativa){
     reply=`Nesses dias não sobrou horário para ${serviceNames}. O mais próximo que consigo é ${emDia(alternativa.date)}: ${slotsPhrase(alternativa.slots)}. Serve pra você?`
     next.date=alternativa.date
     actions=slotsSample(alternativa.slots).map((t:string)=>({label:t,message:t}))
    }else{
     reply=`Não encontrei horário para ${serviceNames} nos próximos dias. Posso te colocar na lista de espera e aviso assim que abrir uma vaga?`
     actions=[{label:'Entrar na lista de espera',message:'Quero entrar na lista de espera'}]
    }
   }
   // "Só depois das 19h"/"final do dia" também é preferência de período: guardar evita a
   // pergunta "manhã, tarde ou final do dia?" no turno seguinte (o loop do v29.12.0).
   if(minTime)next.period=Number(minTime.slice(0,2))>=18?'evening':(Number(minTime.slice(0,2))>=12?'afternoon':'morning')
   handoff=pedeExcecaoAoJuliano
  }else{
   // Sem dia e sem pista nenhuma: a pergunta continua sendo a certa — mas só na primeira
   // vez, e carregando o horário que ele já tiver dito, pra ele não precisar repetir.
   reply=`Perfeito! Anotei ${serviceNames}${requestedTime?` para as ${horaFalada(requestedTime)}`:''}. Para qual dia você quer ver os horários?`
   handoff=false
  }
 }else if(intent==='availability'&&next.date&&chosen.length){
  // Cliente já tem outro agendamento confirmado em dia diferente do que está pedindo
  // agora — sem essa checagem, ele podia acabar com dois horários marcados sem querer
  // (ou receber "esse horário ficou indisponível" tentando remarcar o próprio horário).
  const conflicting=upcomingBookings.find((b:any)=>b.booking_date!==next.date)
  if(conflicting&&!next.keep_both_bookings){
   next.pending_cancel_booking_id=conflicting.id
   next.pending_conflict_choice=true
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
   // v28.37.0 (item 4): antes só sugeria o próximo dia aberto — agora também oferece
   // lista de espera pro dia ORIGINAL que o cliente pediu (mesmo recurso que já existe
   // no site, agendar/horario/join-waitlist). Captura next.date ANTES de sobrescrever
   // com nextAvail.date logo abaixo.
   const waitlistOffer={date:next.date,period:effectivePeriod||null,service_name:serviceNames,service_price:chosen.reduce((a:number,s:any)=>a+s.price,0),duration_minutes:duration}
   const nextAvail=await findNextAvailableDate(supabase,next.date,duration)
   if(nextAvail){
    // v29.69.0 — caso de sábado (22/08/2026, 16h27): o cliente insistiu no mesmo dia
    // ("Precisava pra hoje…") e recebeu a NEGATIVA IDÊNTICA, palavra por palavra. Na
    // terceira vez o anti-papagaio do webhook trocou tudo por "me embolei". Repetir a
    // recusa não é avançar: na insistência a frase muda e vira uma escolha objetiva
    // (esperar uma vaga hoje ou garantir o próximo dia), que é o que fecha ou encerra.
    const jaDisseQueNaoTem=/não encontrei horário|nao encontrei horario/i.test(ultimaFalaJuIA)
    reply=jaDisseQueNaoTem
     ?`Conferi de novo e ${emDia(waitlistOffer.date)} realmente não sobrou nada para ${serviceNames} 😕 Posso fazer duas coisas: te aviso assim que abrir uma vaga ${emDia(waitlistOffer.date)}, ou já garanto seu horário ${emDia(nextAvail.date)} (${slotsPhrase(nextAvail.slots)}). O que prefere?`
     :`Não encontrei horário ${emDia(next.date)} para ${serviceNames}. O próximo dia com horário disponível é ${formatDateBR(nextAvail.date)}: consigo te atender ${slotsPhrase(nextAvail.slots)}. Quer marcar nesse dia? Se preferir, também posso te colocar na lista de espera pra ${formatDateBR(waitlistOffer.date)} e aviso assim que abrir uma vaga.`
    next.pending_waitlist=waitlistOffer
    next.date=nextAvail.date
    actions=[...slotsSample(nextAvail.slots).map((t:string)=>({label:t,message:t})),{label:'Entrar na lista de espera',message:'Quero entrar na lista de espera'}]
   }else{
    reply=`Não encontrei horário disponível nas próximas semanas para esse atendimento. Posso te colocar na lista de espera pra ${formatDateBR(waitlistOffer.date)} e aviso assim que abrir uma vaga, ou prefere falar direto com a equipe?`
    // direct: aqui a pergunta É sobre a lista (não há dia alternativo) — um "sim" solto
    // do cliente significa "sim, me coloca na lista" (ver reclassificação v28.38.2).
    next.pending_waitlist={...waitlistOffer,direct:true}
    actions=[{label:'Entrar na lista de espera',message:'Quero entrar na lista de espera'}]
   }
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
    next.time=effectiveTime
    respostaConferidaNaAgenda=true // horário consultado em allSlots — a trava não pode reescrever
    // v29.16.0 — a oferta ÚNICA de venda entra aqui, colada na confirmação de
    // disponibilidade: primeiro o cliente ouve "sim, tem horário" (o que ele quer saber),
    // depois UMA pergunta opcional com números (WhatsApp não mostra botões) e o aviso
    // passivo de produtos/bebidas — que deixou de ser pergunta. Ver regras no bloco da
    // oferta, mais acima. O upgrade da lavagem só entra se ainda não foi assunto na
    // conversa (haircut_wash_asked cobre a pergunta do bareCabeloAsk).
    const offerOpts:string[]=[]
    if(!upsellOfferDone&&!next.upsell_offer_done){
     if(chosen.some((s:any)=>s.name==='Corte de cabelo')&&!chosen.some((s:any)=>['Corte + Lavagem','Corte + Barboterapia','Corte + Barba Express'].includes(s.name))&&!next.haircut_wash_asked)offerOpts.push('Corte + Lavagem')
     for(const s of serviceSuggestions(chosen)){if(offerOpts.length<3&&!offerOpts.includes(s.name))offerOpts.push(s.name)}
    }
    if(offerOpts.length){
     const optionLabel=(n:string)=>{
      const s=findService(n)
      if(!s)return n
      if(n==='Corte + Lavagem')return `Corte + Lavagem (vira ${money(s.price)}, com lavagem profissional)`
      return `${n} (+ ${money(s.price)})`
     }
     const lines=offerOpts.map((n,i)=>`*${i+1}* — ${optionLabel(n)}`).join('\n')
     const noneNumber=offerOpts.length+1
     // v29.54.0 (caso Aletéia): quando o cliente pergunta o horário E o preço na mesma
     // mensagem, a oferta numerada reescrevia o reply inteiro e a pergunta do preço sumia.
     // O valor entra ANTES da oferta — pergunta feita, pergunta respondida.
     const precoAntes=askedPrice?`${serviceNames} — *${money(chosen.reduce((a:number,s:any)=>a+Number(s.price||0),0))}*.\n\n`:''
     reply=`${precoAntes}Sim! ✅ ${effectiveTime} está disponível para ${serviceNames}. Quer aproveitar e incluir mais alguma coisa? É só me responder com o número:\n${lines}\n*${noneNumber}* — Não, pode fechar assim 😊\n\nAh, e se quiser deixar algum produto de estética ou bebida gelada separado pra retirar na hora, é só me avisar.`
     actions=[...offerOpts.map((n,i)=>({label:optionLabel(n),message:String(i+1)})),{label:'Não, pode fechar',message:String(noneNumber)}]
     next.upsell_offer_options=[...offerOpts,'__none__']
     next.upsell_offer_done=true
     next.upsell_services_done=true // compat com estados antigos ainda em andamento
     next.upsell_products_done=true
    }else{
     next.upsell_offer_done=true
     // v29.74.0 (caso Michele, 25/08/2026): o precoAntes da v29.54.0 só existia no ramo COM
     // oferta — quando a oferta já tinha sido feita (ou não havia o que oferecer), "14:15h +
     // qual o valor?" caía aqui e a pergunta do preço morria sem resposta. Pergunta feita,
     // pergunta respondida — nos dois ramos.
     const precoAntesSemOferta=askedPrice?`${serviceNames} — *${money(chosen.reduce((a:number,s:any)=>a+Number(s.price||0),0))}*.\n\n`:''
     reply=`${precoAntesSemOferta}Sim, ${effectiveTime} está disponível para esse atendimento de ${duration} minutos. Quer reservar esse horário?`
     actions=[{label:`Reservar ${effectiveTime}`,message:`Quero reservar ${effectiveTime}`}]
    }
   }else{
    // v28.61.0 — horário estendido (caso Moisés, 06/08/2026): cliente pediu 18:15, o
    // atendimento terminaria depois das 19h e a JuIA recusou friamente com lista de 16
    // horários ("a ia é engessada", nas palavras do Juliano pro cliente). Regra dele:
    // "eu fico depois do horário sempre que precisar, preciso faturar" — limite definido
    // por ele em 06/08: até 60 min depois do fechamento (20h ter-sex / 16h sáb). SÓ no
    // WhatsApp (verifiedPhone); o site continua estrito. extended_close_slot_ok valida
    // colisão/bloqueio/dia fechado — só o teto do fechamento é esticado.
    let extendedOffered=false
    if(verifiedPhone){
     const {data:extOk}=await supabase.rpc('extended_close_slot_ok',{p_date:next.date,p_start_time:effectiveTime,p_duration_minutes:duration,p_extend_minutes:60})
     if(extOk===true){
      const isSatX=new Date(next.date+'T12:00:00-03:00').getUTCDay()===6
      respostaConferidaNaAgenda=true // extended_close_slot_ok já validou colisão e bloqueio
      // v29.16.0: horário estendido nunca leva oferta de venda (o atendimento já vai varar
      // o fechamento) — marca a oferta como dispensada pro "sim" seguinte fechar direto.
      next.upsell_offer_done=true
      reply=`Nosso horário normal vai até ${isSatX?'15:00':'19:00'}, mas pra você o Ju estica: consigo te encaixar às ${effectiveTime} sim 😊 Posso confirmar?`
      actions=[{label:`Confirmar ${effectiveTime}`,message:`Quero reservar ${effectiveTime}`}]
      next.time=effectiveTime
      extendedOffered=true
      handoff=false
     }
    }
    // v29.70.0 — MENTIRA REAL: horário FORA do expediente caía no texto de horário ocupado
    // ("20:00 já está reservado nesse dia") — não estava reservado, simplesmente não existe
    // na agenda. Antes de abrir, informa o horário de verdade; depois do último, é o caso de
    // exceção do Juliano (o estendido acima já foi tentado e não coube) e vai pra ele.
    // v29.72.0 (caso Bruno, 25/08 ~12h, achado em teste): primeiroDoDia/ultimoDoDia eram o
    // primeiro/último horário LIVRE, não o expediente — com a manhã lotada, "tem 13:00?"
    // respondia "às 13:00 ainda estamos fechados" (mentira nova no lugar da antiga). A régua
    // certa é o EXPEDIENTE teórico (abre 08:00; último início = fechamento − duração): fora
    // dele valem os textos de fechado/exceção; dentro dele, horário tomado é "reservado" e
    // cai no fluxo dos horários mais próximos, logo abaixo.
    const minX=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
    const fmtX=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
    const dowX=new Date(next.date+'T12:00:00-03:00').getUTCDay()
    const fechamentoX=dowX===6?15*60:19*60
    const ultimoInicioTeorico=fmtX(fechamentoX-duration)
    const primeiroLivre=allSlots[0]
    const ultimoLivre=allSlots.length?allSlots[allSlots.length-1]:''
    if(!extendedOffered&&minX(effectiveTime)>minX(ultimoInicioTeorico)){
     reply=`${emDiaCap(next.date)} meu último horário é ${ultimoLivre||ultimoInicioTeorico} — às ${effectiveTime} já é fora do nosso atendimento. O Juliano às vezes abre exceção depois do horário: vou falar com ele agora e já te respondo 😊${ultimoLivre?` Se preferir garantir, reservo ${ultimoLivre} pra você.`:''}`
     actions=ultimoLivre?[{label:ultimoLivre,message:ultimoLivre}]:[]
     handoff=true
     extendedOffered=true // já respondido aqui; não cair no texto de horário ocupado
    }else if(!extendedOffered&&minX(effectiveTime)<8*60){
     reply=`${emDiaCap(next.date)} a gente começa a atender 08:00 — às ${effectiveTime} ainda estamos fechados. ${primeiroLivre?`O primeiro horário que consigo é ${primeiroLivre}. Serve pra você?`:'Quer que eu veja outro dia?'}`
     actions=slotsSample(allSlots).map((t:string)=>({label:t,message:t}))
     extendedOffered=true
    }
    if(!extendedOffered){
     const periodoPedido=slotHour(effectiveTime)<12?'morning':slotHour(effectiveTime)<18?'afternoon':'evening'
     const samePeriod=slotsForPeriod(allSlots,periodoPedido)
     const alternatives=(samePeriod.length?samePeriod:allSlots)
     // v29.75.0 (caso Longanesi 19/08, pedido do Juliano em 26/08): além dos vizinhos do
     // horário pedido, abrir a porta do OUTRO período do dia quando ele tem vaga — "pode
     // ser um desses, ou o senhor prefere à tarde?". Só entra quando as alternativas
     // mostradas ficaram todas no período pedido (senão a lista já cobre o dia inteiro e
     // a frase vira ruído).
     const rotuloPeriodo=(p:string)=>p==='morning'?'de manhã':p==='afternoon'?'à tarde':'no fim do dia'
     const outrosPeriodos=['morning','afternoon','evening'].filter((p)=>p!==periodoPedido&&slotsForPeriod(allSlots,p).length)
     const conviteOutroPeriodo=samePeriod.length&&outrosPeriodos.length?` Ou, se ficar melhor pra você, também tenho horários ${outrosPeriodos.map(rotuloPeriodo).join(' e ')} 😉`:''
     // v29.14.0 — caso real 11/08/2026 (print que o Juliano mandou): o cliente pediu 10:00
     // em TRÊS dias seguidos e nas três recebeu "está reservado" + uma lista despejada de
     // 8 a 12 horários. Ele insistiu quatro vezes e não fechou. Lista comprida não é
     // resposta: quem pediu 10:00 quer saber o que tem PERTO das 10:00. Agora a resposta
     // lidera com os dois horários mais próximos (um antes e um depois, quando existem) e
     // só então oferece o resto, resumido.
     const minutos=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
     const alvo=minutos(effectiveTime)
     const antes=alternatives.filter((t:string)=>minutos(t)<alvo).pop()
     const depois=alternatives.find((t:string)=>minutos(t)>alvo)
     const proximos=[antes,depois].filter(Boolean) as string[]
     // v29.64.0 (caso Helder, 22/08 09h51): "Chego umas 13:30 então, espero a vez" — cliente
     // flexível, e ainda levou duas rodadas ("serve pra você?" → "quer reservar?"). Quem avisa
     // que chega "por volta de" e "espera a vez" aceita o próximo livre: reserva direto o
     // primeiro horário depois do pedido (até 30 min) e explica em uma mensagem só.
     const flexivel=/\bumas\b|por volta|mais ou menos|espero a vez|\bespero\b|qualquer (um|horario)|tanto faz|o que tiver/.test(normalizedQuestion)
     if(flexivel&&depois&&minutos(depois)-alvo<=30&&(upsellOfferDone||next.upsell_offer_done)){
      next.time=depois
      serviceRuleNote=`${effectiveTime} já estava tomado${next.date===today()?'':' nesse dia'}, então deixei o próximo livre, ${depois} — chegando ${effectiveTime} é só esperar ${minutos(depois)-alvo} min ☕`
      intent='book'
     }else if(proximos.length){
      const resto=alternatives.filter((t:string)=>!proximos.includes(t))
      const sobra=resto.length?` Se preferir outro, tenho ainda: ${resto.slice(0,3).join(', ')}.`:''
      reply=proximos.length===2
       ? `${effectiveTime} já está reservado nesse dia. O mais perto que consigo é ${proximos[0]} ou ${proximos[1]} — algum desses serve pra você?${sobra}${conviteOutroPeriodo}`
       : `${effectiveTime} já está reservado nesse dia. O mais perto que consigo é ${proximos[0]} — serve pra você?${sobra}${conviteOutroPeriodo}`
      actions=[...proximos,...resto.slice(0,4)].map((t:string)=>({label:t,message:t}))
     }else{
      reply=`${effectiveTime} já está reservado nesse dia. Estes são os horários que tenho: ${alternatives.slice(0,8).join(', ')}.`
      actions=alternatives.slice(0,8).map((t:string)=>({label:t,message:t}))
     }
    }
   }
  }else if(effectivePeriod){
   const periodSlots=slotsForPeriod(allSlots,effectivePeriod)
   if(periodSlots.length>6){
    // v28.30.5 — pedido do Juliano (31/07/2026): não despejar 20 horários de uma vez.
    // Mostra o intervalo do período e uma amostra espalhada (início/meio/fim), guiando o
    // cliente a escolher; ele pode responder qualquer horário, não só os exemplos.
    const sample=[periodSlots[0],periodSlots[Math.floor(periodSlots.length*0.25)],periodSlots[Math.floor(periodSlots.length/2)],periodSlots[Math.floor(periodSlots.length*0.75)],periodSlots[periodSlots.length-1]].filter((v,i,a)=>a.indexOf(v)===i)
    // v29.69.0: o dia SEMPRE na frente da lista de horários — ver comentário do diaHumano.
    reply=`${emDiaCap(next.date)}, no período da ${periodLabel(effectivePeriod)}, tenho horários entre ${periodSlots[0]} e ${periodSlots[periodSlots.length-1]} para ${duration} minutos. Alguns exemplos: ${sample.join(', ')}. Qual horário fica melhor pra você?`
    actions=sample.map((t:string)=>({label:t,message:t}))
   }else if(periodSlots.length){
    reply=`${emDiaCap(next.date)}, no período da ${periodLabel(effectivePeriod)}, estes são todos os horários disponíveis para ${duration} minutos: ${periodSlots.join(', ')}. Qual você prefere?`
    actions=periodSlots.map((t:string)=>({label:t,message:t}))
   }else{
    reply=`${emDiaCap(next.date)} não tenho horário no período da ${periodLabel(effectivePeriod)}. Posso mostrar outro período ou verificar outro dia.`
    actions=[
     {label:'Ver manhã',message:'Prefiro manhã'},
     {label:'Ver tarde',message:'Prefiro tarde'},
     {label:'Ver final do dia',message:'Prefiro final do dia'}
    ]
   }
  }else if(allSlots.length>10&&anyPeriodOk){
   // Cliente já disse que qualquer horário serve: perguntar período de novo é o loop que
   // o Juliano flagrou. Mostra uma amostra espalhada do dia inteiro e deixa ele apontar.
   const spread=[allSlots[0],allSlots[Math.floor(allSlots.length*0.25)],allSlots[Math.floor(allSlots.length/2)],allSlots[Math.floor(allSlots.length*0.75)],allSlots[allSlots.length-1]].filter((v,i,a)=>a.indexOf(v)===i)
   reply=`Perfeito! Para ${serviceNames} (${duration} min) consigo te atender ${emDia(next.date)}, entre ${allSlots[0]} e ${allSlots[allSlots.length-1]}. Alguns horários: ${spread.join(', ')}. Qual fica melhor pra você?`
   actions=spread.map((t:string)=>({label:t,message:t}))
  }else if(allSlots.length>10){
   // v29.12.0: não dizer mais o NÚMERO de horários livres ("Tenho 42 horários disponíveis")
   // — é a agenda vazia anunciada ao cliente, o mesmo erro que a trava de vacância impede no
   // conteúdo público. O que ele precisa saber é que dá pra encaixar, não quanto sobra.
   reply=`Consigo te atender ${emDia(next.date)} em vários horários para ${serviceNames} (${duration} min). Você prefere manhã, tarde ou final do dia?`
   actions=[
    {label:'Manhã',message:'Prefiro manhã'},
    {label:'Tarde',message:'Prefiro tarde'},
    {label:'Final do dia',message:'Prefiro final do dia'}
   ]
  }else if(allSlots.length>4){
   // v29.43.0 — casos Aline e Luis (15/08): 8 e 10 horarios despejados numa linha e os dois
   // sumiram. Mais de 4 opcoes vira amostra espalhada + faixa; o cliente pode responder
   // qualquer horario, nao so os exemplos.
   const spread=[allSlots[0],allSlots[Math.floor(allSlots.length/3)],allSlots[Math.floor(allSlots.length*2/3)],allSlots[allSlots.length-1]].filter((v,i,a)=>a.indexOf(v)===i)
   reply=`Para ${serviceNames} (${duration} min) consigo te atender ${emDia(next.date)}, entre ${allSlots[0]} e ${allSlots[allSlots.length-1]}. Por exemplo: ${spread.join(', ')}. Qual fica melhor pra você?`
   actions=spread.map((t:string)=>({label:t,message:t}))
  }else{
   reply=`Para ${serviceNames} ${emDia(next.date)}, estes são os horários disponíveis: ${allSlots.join(', ')}. Qual você prefere?`
   actions=allSlots.map((t:string)=>({label:t,message:t}))
  }
  }
 }
 dropPezinhoSeTemCorte()
 dropBarbaRedundante()
 if(intent==='book'){
  const conflicting=upcomingBookings.find((b:any)=>b.booking_date===next.date)
  // v29.43.5 (caso Sillas, 15/08): "So o corte mesmo" + "4" chegaram separados; a primeira
  // mensagem criou o agendamento e a segunda, processada em seguida, achou "conflito" com o
  // agendamento que a propria conversa tinha acabado de criar e perguntou "e esse mesmo, e
  // novo, ou cancelar?". Se o conflito e o agendamento desta conversa (state.completed no
  // mesmo dia/horario), a resposta certa e "ja esta reservado".
  if(conflicting&&state?.completed&&String(conflicting.start_time||'').slice(0,5)===String(next.time||state?.time||'')){
   reply=`Já está reservado${next.name?', '+firstName(next.name):''} 😊 ${formatDateBR(conflicting.booking_date)} às ${String(conflicting.start_time).slice(0,5)} (${conflicting.service_name}). Te espero!`
   actions=[]
   next.completed=true
   intent='other'
   handoff=false
  }else if(conflicting&&!next.keep_both_bookings){
   next.pending_cancel_booking_id=conflicting.id
   next.pending_conflict_choice=true
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
  if(missing.length){
   // v29.43.2 (bateria 18/08): "Para concluir, preciso de seu nome, seu WhatsApp, o servico, a
   // data, o horario." e frio e saiu ate pra "CADE VOCES NAO TO CONSEGUINDO MARCAR NADA". Agora
   // acolhe, diz o que falta em portugues de gente e, se o cliente parece frustrado, reconhece.
   const frustrado=/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{6,}|!{2,}|nao (to|estou) conseguindo|cade voces|ninguem responde/.test(message+' '+normalizedQuestion)
   const lista=missing.length===1?missing[0]:missing.slice(0,-1).join(', ')+' e '+missing[missing.length-1]
   reply=frustrado
    ?`Calma que eu resolvo com você agora mesmo 🙏 Só me diz ${lista} que eu já deixo reservado.`
    :`Vamos marcar! 😊 Me diz ${lista} que eu já deixo reservado pra você.`
   intent='other'
  }
  else{
   const phone=String(next.phone).replace(/\D/g,'')
   if(phone.length<10){reply='Pode informar seu WhatsApp com DDD, por favor?';next.phone=null;intent='other'}
   else{
    const duration=chosen.reduce((a:number,s:any)=>a+s.duration,0),price=chosen.reduce((a:number,s:any)=>a+s.price,0)
    const selectedProducts=next.products.map((n:string)=>findProduct(n)).filter(Boolean).map((p:any)=>({name:p.name,price:p.price}))
    const {data:bookingId,error}=await supabase.rpc('create_public_booking_v15',{p_customer_name:next.name,p_customer_phone:phone,p_customer_email:next.email||null,p_service_name:chosen.map((s:any)=>s.name).join(' + '),p_service_price:price,p_duration_minutes:duration,p_booking_date:next.date,p_start_time:next.time,p_notes:'Agendado pela JuIA no chat do site',p_selected_products:selectedProducts,p_extend_close_minutes:verifiedPhone?60:0})
    if(error){
     if(error.message.includes('cliente_bloqueado')){
      // v29.53.0 (política padronizada, pedido do Juliano 20/08): 2 furos (no_show) ou
      // bloqueio manual = não agenda direto. A JuIA apresenta a política de pagamento
      // antecipado (termos aprovados pelo Juliano) e guarda o pedido; o "1" do cliente
      // dispara push pro Juliano criar o agendamento no painel (que passa pelo guard).
      next.pending_prepay_policy={date:next.date,time:next.time,services:chosen.map((s:any)=>s.name).join(' + '),price}
      const nomeP=next.name?firstName(next.name):''
      reply=`${nomeP?nomeP+', v':'V'}ou ser transparente com você 😊 Como os últimos horários reservados acabaram ficando sem atendimento, por aqui o agendamento agora é confirmado com pagamento antecipado pelo Pix. Funciona assim:\n✅ O Pix do valor do serviço garante o horário.\n⏰ Tolerância de atraso: 10 minutos.\n🔁 Precisou remarcar? Avisando até a véspera (24 horas antes), o valor vira crédito pra nova data, sem perder nada.\n⚠️ Se não vier e não avisar, o valor não é devolvido — ele cobre o horário que ficou reservado só pra você.\n\nTopa? Digite *1* pra combinar o pagamento, ou *2* se preferir deixar pra outra hora.`
      actions=[{label:'1 — Topo',message:'1'},{label:'2 — Agora não',message:'2'}]
      intent='other'
      handoff=false
     }
     else if(error.message.includes('indisponível')){
      // v29.43.5 (caso Helo, 15/08): ela escolheu 10:45 pra corte (30 min), depois incluiu
      // sobrancelha + barba (60 min) e o 10:45 nao cabia mais — a resposta "acabou de ficar
      // indisponivel" era falsa (ninguem pegou) e ainda exigiu mais uma rodada pra ela ver o
      // 10:30. Agora explica o motivo real e ja traz o mais proximo que cabe.
      const {data:slotsNow}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:duration})
      const list=(slotsNow||[]).map((x:any)=>String(x.slot_time).slice(0,5))
      const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
      const alvo=String(next.time||'')
      const perto=list.slice().sort((a:string,b:string)=>Math.abs(mins(a)-mins(alvo))-Math.abs(mins(b)-mins(alvo))).slice(0,2)
      const nomes=chosen.map((s:any)=>s.name).join(' + ')
      reply=perto.length
       ?`Poxa, ${alvo} não fecha pra ${nomes} (${duration} min) 😕 O mais perto que consigo é ${perto.join(' ou ')} — serve pra você?`
       :`Poxa, ${alvo} não fecha pra ${nomes} (${duration} min) e não sobrou horário nesse dia 😕 Quer que eu veja outro dia?`
      actions=perto.map((t:string)=>({label:t,message:t}))
      // v29.79.0 (caso Rodrigo): arma a saída "só o corte então" — se o cliente abrir
      // mão do serviço que não coube, o horário original volta e o agendamento fecha
      // direto (sem isso o modelo regerava a mesma negativa e caía no "me embolei").
      next.pending_fit_choice={time:alvo,added:null}
     }else if(error.message.includes('antecedência')){
      // v29.62.3 (caso Cleiton, 21/08/2026, 14h58): às 12h51 a JuIA ofereceu 15:00 com a
      // pergunta de complemento; ele só respondeu "4" (fechar) às 14h58 — 2 minutos antes
      // do horário. A RPC recusou ("15 minutos de antecedência") e a JuIA devolveu o erro
      // seco, sem saída; ele acabou vindo sem hora marcada. Agora explica o motivo real e
      // já traz os 2 próximos horários que cabem hoje (get_available_slots respeita o buffer).
      const {data:slotsNow}=await supabase.rpc('get_available_slots',{p_date:next.date,p_duration_minutes:duration})
      const alvo=String(next.time||'')
      const depois=(slotsNow||[]).map((x:any)=>String(x.slot_time).slice(0,5)).filter((t:string)=>t>alvo).slice(0,2)
      const nomes=chosen.map((s:any)=>s.name).join(' + ')
      reply=depois.length
       ?`Opa, ${alvo} ficou em cima da hora — preciso de 15 minutinhos pra te receber direito 😅 Consigo ${depois.join(' ou ')} pra ${nomes}. Qual prefere?`
       :`Opa, ${alvo} ficou em cima da hora e não sobrou outro horário hoje 😕 Quer que eu veja amanhã?`
      actions=depois.map((t:string)=>({label:t,message:t}))
     }else reply=error.message
     intent='availability';next.time=null
    }
    else{
      // v29.1.0 — marca o canal REAL. create_public_booking_v15 grava 'site' pra tudo,
      // então formulário e JuIA ficavam indistinguíveis (e ~90% do que aparecia como
      // "site" era na verdade a JuIA). Não mexo na assinatura da RPC: é o caminho mais
      // crítico do sistema e uma sobrecarga nova ali sairia caro.
      try{
        await supabase.from('bookings').update({channel:verifiedPhone?'juia_whatsapp':'juia_chat'}).eq('id',bookingId)
      }catch(chErr){console.error('[ju-ia-site] channel',chErr)}

      // v29.10.0 — fidelidade proativa de verdade: se o cliente tem prêmio disponível,
      // aplica sozinha no serviço MAIS CARO do combo (o resto continua cobrando e
      // pontuando normal). Só quando verifiedPhone&&hasCustomer (mesma guarda de sempre —
      // nunca em telefone digitado em texto livre, que pode ser de outra pessoa). Nunca
      // bloqueia o agendamento se falhar: best-effort, igual ao canal/GA4/push acima.
      let rewardApplied=false, freedService:any=null
      if(verifiedPhone&&hasCustomer&&rewards>0){
        try{
          freedService=chosen.reduce((max:any,s:any)=>(!max||s.price>max.price)?s:max,null)
          if(freedService){
            const {data:reserveData}=await supabase.rpc('reserve_loyalty_reward',{p_phone:phone,p_booking_id:bookingId,p_discount:freedService.price,p_freed_service_name:freedService.name})
            const row=Array.isArray(reserveData)?reserveData[0]:reserveData
            rewardApplied=Boolean(row?.reserved)
          }
        }catch(rewardErr){console.error('[ju-ia-site] reward',rewardErr)}
      }

      // v29.2.0 — se esta conversa veio do site com código de atribuição, manda o
      // agendamento pro GA4 usando o MESMO client_id daquela visita. É isso que faz
      // o Google Ads conseguir creditar o agendamento ao anúncio que trouxe a pessoa.
      // Tudo em try/catch: falhar aqui NUNCA pode afetar o agendamento.
      try{
        const mpSecret=Deno.env.get('GA4_MP_API_SECRET')
        if(mpSecret){
          const {data:attrib}=await supabase.from('whatsapp_attribution')
            .select('token,ga_client_id,gclid').eq('phone_match',knownPhone).is('booking_id',null)
            .gte('created_at',new Date(Date.now()-30*24*60*60*1000).toISOString())
            .order('created_at',{ascending:false}).limit(1).maybeSingle()
          if(attrib&&attrib.ga_client_id){
            const productsTotal=selectedProducts.reduce((a:number,p:any)=>a+Number(p.price||0),0)
            const mpUrl=`https://www.google-analytics.com/mp/collect?measurement_id=G-4XZTP0550B&api_secret=${encodeURIComponent(mpSecret)}`
            const res=await fetch(mpUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              client_id:attrib.ga_client_id,
              non_personalized_ads:false,
              events:[{name:'booking_confirmed',params:{
                value:price+productsTotal,
                currency:'BRL',
                services:chosen.map((s:any)=>s.name).join(' | '),
                origem:'juia_whatsapp',
                engagement_time_msec:1,
                session_id:attrib.token
              }}]
            })})
            console.log('[ju-ia-site] MP booking_confirmed',res.status)
            await supabase.from('whatsapp_attribution').update({booking_id:bookingId,converted_at:new Date().toISOString()}).eq('token',attrib.token)
          }
        }
      }catch(mpErr){console.error('[ju-ia-site] MP',mpErr)}
      try{
        const {data:record}=await supabase.from('bookings').select('*').eq('id',bookingId).single()
        const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
        const supabaseUrl=Deno.env.get('SUPABASE_URL')
        if(record&&pushSecret&&supabaseUrl)await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({record})})
      }catch(pushError){console.error('[ju-ia-site] push',pushError)}
      // v28.61.0: push dedicado quando o atendimento termina DEPOIS do fechamento (horário
      // estendido, regra do Juliano de 06/08) — o push genérico acima não destaca isso.
      try{
        const extEndMin=Number(String(next.time).slice(0,2))*60+Number(String(next.time).slice(3,5))+duration
        const extCloseMin=new Date(next.date+'T12:00:00-03:00').getUTCDay()===6?15*60:19*60
        if(extEndMin>extCloseMin){
          const extPushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
          const extSupabaseUrl=Deno.env.get('SUPABASE_URL')
          if(extPushSecret&&extSupabaseUrl)await fetch(`${extSupabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':extPushSecret},body:JSON.stringify({custom:{title:'⏰ Atendimento estendido marcado',body:`${next.name} — ${formatDateBR(next.date)} às ${next.time} (${chosen.map((s:any)=>s.name).join(' + ')}) termina depois do fechamento. A JuIA confirmou com aviso.`,url:'/admin-agenda.html?app=1',tag:`extended-${bookingId}`}})})
        }
      }catch(extError){console.error('[ju-ia-site] push estendido',extError)}
      // v29.10.0 — push dedicado quando o agendamento usa um prêmio de fidelidade, pra
      // você já saber ANTES do cliente chegar que aquele serviço é por conta da casa (o
      // push genérico acima mostra o preço já descontado, mas não explica o porquê).
      try{
        if(rewardApplied&&freedService){
          const remaining=chosen.filter((s:any)=>s!==freedService)
          const remainingText=remaining.length?`cobrar só ${remaining.map((s:any)=>s.name).join(' + ')}`:'nada além disso'
          const rwPushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
          const rwSupabaseUrl=Deno.env.get('SUPABASE_URL')
          if(rwPushSecret&&rwSupabaseUrl)await fetch(`${rwSupabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':rwPushSecret},body:JSON.stringify({custom:{title:'🎁 Agendamento com bônus de fidelidade',body:`${next.name} — ${formatDateBR(next.date)} às ${next.time}: ${freedService.name} é grátis (fidelidade), ${remainingText}.`,url:'/admin-agenda.html?app=1',tag:`loyalty-${bookingId}`}})})
        }
      }catch(rwPushErr){console.error('[ju-ia-site] push fidelidade',rwPushErr)}
      const prodText=selectedProducts.length?` Produtos reservados: ${selectedProducts.map((p:any)=>p.name).join(', ')}.`:''
      // v28.32.0/v29.10.0: fidelidade proativa (pedido do Juliano) — só no momento exato da
      // confirmação do agendamento (não em qualquer resposta), e só quando o telefone já é
      // confirmado pelo canal (WhatsApp) — nunca em telefone digitado em texto livre no chat
      // do site, que pode ser de outra pessoa. 4 situações, em ordem de prioridade: prêmio
      // acabou de ser aplicado nesse agendamento; tinha prêmio mas não deu pra aplicar agora
      // (avisa que pode usar, caminho de segurança); fecha o cartão de 10 com este
      // atendimento; senão, nota de progresso simples ("faltam N pontos"). Fora esses casos, continua
      // calado sobre fidelidade (não sabe o contexto pra falar nada com segurança).
      const loyaltyRemaining=chosen.filter((s:any)=>s!==freedService)
      const loyaltyNote=!(verifiedPhone&&hasCustomer)?'':
        rewardApplied&&freedService?(loyaltyRemaining.length?` 🎁 Boa notícia: seu ${freedService.name} de hoje é por nossa conta, prêmio da fidelidade! Você paga só ${loyaltyRemaining.map((s:any)=>s.name).join(' + ')} — e ainda pontua com ele(s) 😄`:` 🎁 Boa notícia: seu ${freedService.name} de hoje é por nossa conta, prêmio da fidelidade! Obrigada pela preferência 😄`):
        rewards>0?` A propósito, você já tem ${rewards} corte(s) grátis disponível(is) pela fidelidade — é só avisar quando quiser usar! 🎁`:
        points===9?` Ah, e esse atendimento vai completar seu cartão fidelidade — no próximo corte você ganha um grátis! 🎉`:
        ` A propósito, você está com ${points} ponto(s) de fidelidade — faltam ${Math.max(0,10-points)} pra ganhar um serviço grátis. 💈`
      // v29.43.7 — pedido do Juliano (18/08): oferecer o pagamento antecipado tambem no WhatsApp,
      // mas de forma PASSIVA (sem pergunta, sem rodada extra): uma linha na confirmacao. Quem quiser
      // pede a chave; a JuIA ja sabe passar o Pix. Quando o PagBank liberar, vira link.
      const prepayNote=verifiedPhone?' Se preferir já deixar pago pelo Pix, é só me pedir a chave 😉':''
      // v29.54.0 (caso Aletéia, 21/08): ela respondeu só "Quero" a esta oferta. Sem "pix"/"chave"
      // na frase, a resposta caía no modelo e a chave saiu SEM O VALOR — exatamente o erro que a
      // v29.47.0 tinha corrigido. Marca a oferta no estado pra um "quero"/"sim" curto na mensagem
      // seguinte cair no caminho determinístico (chave + valor).
      if(verifiedPhone)next.pix_offered=true
      // v29.68.0 — pedido do Juliano (24/08): a barbearia atende desde 12/03 mas o sistema
      // só registra desde 14/07 — cliente antigo agendando pela 1ª vez no sistema aparecia
      // como "novo" e derrubava a retenção dos Relatórios. Uma pergunta única, só na
      // primeira confirmação (telefone verificado, zero visitas no sistema, sem declaração
      // anterior no cadastro); a resposta é tratada pelo interceptador de pending_first_visit.
      let firstVisitAsk=''
      if(verifiedPhone&&visits===0&&!state?.first_visit_asked){
       try{
        const fvDigits=String(verifiedPhone).replace(/\D/g,'')
        const fvSem=(fvDigits.length>=12&&fvDigits.startsWith('55'))?fvDigits.slice(2):fvDigits
        const {data:fvRows}=await supabase.from('customer_profiles').select('id,internal_tags,prior_visits').or(`phone.eq.${fvDigits},phone.eq.${fvSem},phone.eq.55${fvSem}`).limit(1)
        const fvRow=Array.isArray(fvRows)&&fvRows.length?fvRows[0]:null
        const fvDeclared=fvRow&&(Number(fvRow.prior_visits)>0||(Array.isArray(fvRow.internal_tags)&&fvRow.internal_tags.some((t:string)=>t==='primeira-visita-declarada'||t==='ja-era-cliente-declarado')))
        if(!fvDeclared){
         firstVisitAsk=`\n\nAh, me conta uma coisa rapidinho pra te atender ainda melhor: é a sua primeira vez na Barbearia do Ju? 😊\n*1* — Primeira vez\n*2* — Já sou cliente de antes`
         next.pending_first_visit=true
         next.first_visit_asked=true
        }
       }catch(fvAskErr){console.error('[ju-ia-site] first-visit pergunta',fvAskErr)}
      }
      reply=`✅ Agendamento confirmado! ${next.name}, seu horário para ${chosen.map((s:any)=>s.name).join(' + ')} está confirmado para ${next.date.split('-').reverse().join('/')} às ${next.time}.${prodText} Aguardamos você na Barbearia do Ju! 😊${loyaltyNote}${prepayNote}${firstVisitAsk}`
      actions=[{label:'Falar com a barbearia',url:'https://wa.me/5511967073038?text='+encodeURIComponent(`Olá, sou ${next.name}. Tenho um agendamento confirmado para ${next.date} às ${next.time}.`),primary:true}]
      next.completed=true
      // v28.38.2: agendamento fechado — oferta de lista de espera pendente (se houver)
      // não faz mais sentido; sem limpar, um "sim" posterior ainda podia reativá-la.
      next.pending_waitlist=null
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
 // v28.62.0: o modelo cumprimenta por conta própria mesmo com o prompt proibindo isso —
 // efeito visível pro cliente: na 1ª mensagem saía saudação DUPLICADA ("Boa tarde! Boa
 // tarde, Alexandre!") e da 2ª em diante ele voltava a dizer "Boa tarde!" no meio da
 // conversa. Tirar na origem é mais confiável do que insistir na instrução; a saudação
 // determinística logo abaixo continua sendo a única fonte.
 const withoutGreeting=reply.replace(/^\s*(bom dia|boa tarde|boa noite)\b\s*[,!.…-]*\s*/i,'').trimStart()
 if(withoutGreeting) reply=withoutGreeting
 // v28.69.2 — caso Walter (07/08/2026): cliente pediu 19:30, a JuIA respondeu "Temos sim!"
 // e SÓ DEPOIS perguntou o serviço, sem nunca ter consultado a agenda. Prometer horário
 // antes de checar é o pior erro possível aqui: o cliente se organiza, vem, e leva um não.
 // Instrução no prompt não segurou (testado) — o modelo continua abrindo com "Temos sim".
 // Trava determinística: só o CÓDIGO confirma horário. Quando a resposta ainda vem do
 // modelo (o sistema não montou confirmação nem lista de horários), qualquer promessa
 // afirmativa é trocada por uma frase que promete apenas a CONSULTA.
 // v29.14.0 — `!respostaConferidaNaAgenda` é a parte que faltava: a trava só pode tocar no
 // texto do MODELO. Quando o código já consultou a agenda e afirmou um horário, aquilo é
 // verdade verificada — reescrever produzia frases quebradas como "Sim, 10:00 vou conferir
 // para esse atendimento". (Primeira tentativa deste fix comparava a resposta com a
 // original do modelo, mas isso desligava a trava sempre que qualquer outro trecho do
 // código encostava no texto — e o "Temos sim!" do caso Walter voltou a passar.)
 if(!next.completed&&!respostaConferidaNaAgenda){
  // Além disso, esta trava também
  // casava com a NEGATIVA. A resposta correta do sistema, "10:00 não está disponível para
  // esse atendimento", contém "está disponível" — a trava trocava por "vou conferir" e o
  // cliente lia "10:00 não vou conferir para esse atendimento", que não quer dizer nada.
  // O `(?<!n[ãa]o\s)` faz a regra ignorar a frase quando ela está negada.
  const promessaDeHorario=/\b(temos|tem|conseguimos|consigo|posso|dá|da)\s+(sim|s[íi])\b|(?<!n[ãa]o\s)\best[áa]\s+(livre|dispon[íi]vel)\b|\bconsigo te encaixar\b|\bo ju estica\b/i
  // v29.43.5: a trava so vale quando a frase fala de HORARIO/agenda — "a pasta esta disponivel
  // por R$ 36" (produto) virava "ela vou conferir por R$ 36" (caso Guilherme Rodrigues, 15/08).
  const falaDeHorario=/\b\d{1,2}(:\d{2}|h)\b|hor[áa]rio|vaga|agenda|encaix|hoje|amanh[ãa]|s[áa]bado|segunda|ter[çc]a|quarta|quinta|sexta/i.test(reply)
  if(promessaDeHorario.test(reply)&&falaDeHorario){
   reply=reply
    .replace(/^[^.!?]*\b(temos|tem|conseguimos|consigo|posso|dá|da)\s+(sim|s[íi])\b[^.!?]*[.!?]\s*/i,'')
    .replace(promessaDeHorario,'vou conferir')
    .trim()
   // v29.43.0 — casos Bruno e Luis (15/08): o prefixo "Deixa eu conferir a agenda certinho
   // antes de confirmar" fazia o cliente achar que a JuIA ia VOLTAR com a resposta — Bruno
   // esperou 2h30. A frase agora nomeia o que falta e deixa claro que a proxima palavra e dele.
   const falta=!chosen.length?'qual serviço você quer':!next.date?'pra qual dia':!next.time?'qual horário prefere':''
   if(!/\?/.test(reply)&&falta)reply=`${reply} Me diz ${falta} que eu já confiro o horário pra você.`.trim()
   if(!reply)reply=falta?`Claro! Me diz ${falta} que eu já confiro o horário pra você.`:'Claro! Me diz o que precisa que eu já confiro pra você.'
  }
 }
 if(isFirstMessage){
  const crmName=hasCustomer?String(context?.name||'').trim():''
  const greetName=crmName?firstName(crmName):(String(body?.whatsapp_name||'').trim()?firstName(String(body.whatsapp_name)):'')
  // v29.64.0 (caso Helder, 22/08 09h49): saiu "Bom dia, Helder! Tudo bem, Helder! Obrigada por
  // perguntar" — o modelo repetiu o nome que o prefixo já traz. Tira a 1ª menção do nome nos
  // primeiros 60 caracteres da resposta antes de colar a saudação.
  if(greetName){
   const esc=greetName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
   const semNome=reply.replace(new RegExp(`^(.{0,60}?)(,\\s*${esc}(?=[!.?,\\s])|\\b${esc},\\s*)`,'i'),'$1')
   if(semNome!==reply)reply=semNome.charAt(0).toUpperCase()+semNome.slice(1)
  }
  reply=`${greetingNow()}${greetName?`, ${greetName}`:''}! ${reply}`
 }
 // v28.31.0: funil de conversas com interesse sem agendamento fechado (pedido do
 // Juliano, 31/07/2026) — uma linha por telefone, atualizada a cada mensagem dele.
 // Só existe pro canal WhatsApp (verifiedPhone), que é o único onde dá pra mandar
 // um follow-up depois. "kind" decide o texto do nudge que o whatsapp-lead-followup
 // vai mandar: 'availability' (já citou dia+serviço, o caso mais "quente"),
 // 'price_or_service' (só citou o serviço/perguntou preço), 'greeting' (mensagem
 // curta tipo "oi", sem nada mais — o caso que o Juliano descreveu explicitamente:
 // "cliente manda oi e some"). Qualquer outra coisa (pergunta de endereço/horário de
 // funcionamento, reclamação, cancelamento etc.) não gera lead — não tem o que
 // "reativar" ali, forçar isso seria chato. Se o agendamento foi concluído
 // (next.completed) ou virou handoff/cancelamento/remarcação, apaga o lead: não faz
 // sentido cobrar alguém que já resolveu o que queria.
 if(verifiedPhone){
  const isSpecialFlow=['cancel','reschedule','change_service','update_products','handoff'].includes(intent)
  if(next.completed){
   // v28.34.0: vira agendamento de verdade — preserva a linha (resolution='booked') em
   // vez de apagar, pra o painel admin-leads.html conseguir calcular taxa de recuperação.
   await supabase.from('conversation_leads').update({resolved_at:new Date().toISOString(),resolution:'booked',updated_at:new Date().toISOString()}).eq('phone',verifiedPhone).then(()=>{})
  }else if(isSpecialFlow){
   await supabase.from('conversation_leads').delete().eq('phone',verifiedPhone).then(()=>{})
  }else{
   const trimmedMsg=message.trim()
   const isBareGreeting=trimmedMsg.length<=20&&/^(oi+|ol[aá]|bom\s*dia|boa\s*tarde|boa\s*noite|opa|e\s*a[ií]|eai|fala)\b[\s!.,?]*$/i.test(normalize(trimmedMsg))
   // v29.71.0 (caso Fernando, 25/08): "gostaria de marcar um horário" sem serviço não gerava
   // lead nenhum — cliente que sumia no meio ficava mudo pra sempre. Agora vira 'booking_intent'
   // e o whatsapp-lead-followup manda o "ainda estou por aqui" (+ site) ~30 min depois.
   const wantsBooking=['book','availability'].includes(intent)||/\b(marcar|agendar|agendamento|reservar|encaixe|tem hor[aá]rio|algum hor[aá]rio|hor[aá]rio (livre|dispon[ií]vel|vago))\b/.test(normalizedQuestion)
   const kind=(next.date&&chosen.length)?'availability':chosen.length?'price_or_service':wantsBooking?'booking_intent':(isBareGreeting?'greeting':null)
   if(kind){
    await supabase.from('conversation_leads').upsert({
     phone:verifiedPhone,
     customer_name:hasCustomer?contextFullName:(String(body?.whatsapp_name||'').trim()||null),
     kind,
     last_message_text:message.slice(0,300),
     service_interest:chosen.length?chosen.map((s:any)=>s.name).join(' + '):null,
     date_interest:next.date||null,
     last_message_at:new Date().toISOString(),
     followup_stage:0,
     followup_1_sent_at:null,
     followup_2_sent_at:null,
     reason:null,
     reason_detail:null,
     responded_at:null,
     resolved_at:null,
     resolution:null,
     updated_at:new Date().toISOString(),
    },{onConflict:'phone'}).then(()=>{})
   }else{
    await supabase.from('conversation_leads').delete().eq('phone',verifiedPhone).then(()=>{})
   }
  }
 }

 // v29.18.0 — transparência da suposição do serviço de sempre (ver bloco assumedUsualService
 // acima): o cliente precisa SABER que o sistema assumiu por ele, senão vira o mesmo erro da
 // v28.30.4 (presumir em silêncio). Nota única, no fim, sem repetir se a resposta já disser.
 if(assumedUsualService&&!handoff&&(intent==='availability'||intent==='book')&&!/de sempre/i.test(reply)){
  reply+=`\n\n(Anotei ${assumedUsualService}, o seu de sempre 😉 Se quiser outro serviço ou incluir algo, é só dizer.)`
 }
 if(pezinhoNota&&!handoff&&!/pezinho já vem incluso/i.test(reply)){
  reply+=`\n\n${pezinhoNota}`
 }
 if(cabeloAssumidoNota&&!handoff&&!/Anotei Corte de cabelo/i.test(reply)){
  reply+=`\n\n${cabeloAssumidoNota}`
 }

 // v29.43.2: "voces atendem hoje?" — o aviso de aberto/fechado entra por ultimo, porque os blocos
 // de fluxo (ex.: "qual servico?") reescrevem o reply inteiro no meio do caminho.
 if(avisoAbertoHoje&&!handoff&&!/atendemos até|estamos fechados|já encerramos|excepcionalmente fechados/i.test(reply)){
  reply=`${avisoAbertoHoje} ${reply}`.trim()
 }
 // v29.47.0 — caso Frei Bartolomeu (19/08/2026, 13:08): primeiro cliente que pediu pra pagar
 // antecipado pelo WhatsApp. A JuIA passou a chave, mas NÃO o valor — ele teve que perguntar
 // "quanto é?". Agora, pedido de chave Pix com agendamento futuro no número verificado vira
 // resposta determinística: chave + VALOR do próximo agendamento (serviço + produtos) + nome/
 // instituição. Pedido de "celular"/outra chave continua com o modelo (segunda chave).
 const pixKeyAsk=(/\b(chave|pix)\b/.test(normalizedQuestion)||/\b(pagar|pagamento|deixar pago|ja pago)\b.*\b(adiantad|antecipad|agora|antes|ja)|\b(adiantad|antecipad)\w*\b.*\bpag/.test(normalizedQuestion)||(Boolean(state?.pix_offered)&&simpleYes))
  &&!/\b(ja paguei|paguei|comprovante|enviei|mandei|fiz o pix|transferi)\b/.test(normalizedQuestion)
  &&!/\b(celular|telefone|outra chave|segunda chave|cpf|cnpj)\b/.test(normalizedQuestion)
 if(pixKeyAsk&&verifiedPhone&&upcomingBookings.length&&!handoff){
  const b:any=upcomingBookings[0]
  const total=Number(b.service_price||0)+Number(b.products_price||0)
  const quando=b.booking_date===today()?'hoje':formatDateBR(b.booking_date)
  reply=`Chave Pix (e-mail): contato@barbeariadoju.com.br
💰 Valor: ${money(total)} — ${b.service_name}, ${quando} às ${String(b.start_time).slice(0,5)}.
No aplicativo do banco vai aparecer o nome "Juliano Bruno Lopes Padilha" e a instituição "PicPay". Quando fizer, me avisa que o Juliano confere 😉`
  actions=[]
  next.pix_offered=false
  // v29.55.0 — caso Aletéia (21/08/2026): a JuIA passou a chave, a cliente pagou em silêncio
  // (sem avisar, sem comprovante) e o Juliano só descobriu quando ela falou na cadeira, depois
  // do corte — nenhum push, e o card da Agenda não mostrava nada. É o mesmo buraco que a
  // migration 126 fechou no SITE (copiar a chave já avisa), agora fechado no WhatsApp:
  // PASSAR A CHAVE registra o Pix pendente no agendamento e avisa o Juliano UMA vez.
  // Não mexe em prepay_declared_at — declaração forte continua sendo do cliente/comprovante.
  if(b?.id){
   try{
    const {data:marked}=await supabase.from('bookings')
      .update({prepay_key:'picpay',updated_at:new Date().toISOString()})
      .eq('id',b.id).is('prepay_key',null).is('prepay_confirmed_at',null).select('id')
    const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
    const supabaseUrl=Deno.env.get('SUPABASE_URL')
    if(marked&&marked.length&&pushSecret&&supabaseUrl){
     await fetch(`${supabaseUrl}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({custom:{
      title:'💸 Passei a chave Pix — fique de olho no extrato',
      body:`${next.name||contextFullName||'Cliente'} pediu a chave para ${b.service_name}, ${quando} às ${String(b.start_time).slice(0,5)} — ${money(total)}. Se cair, confirme na Agenda antes de concluir o atendimento.`,
      url:'/admin-agenda.html?app=1',
      tag:`prepay-key-sent-${b.id}`}})}).catch(()=>{})
    }
   }catch(error){console.error('[ju-ia-site] prepay_key_sent',error)}
  }
 }
 // v29.43.2: o modelo insiste em escrever "18/08/2026" apesar do prompt. Troca determinística
 // no fim: hoje -> "hoje", amanha -> "amanha", resto -> "sexta (21/08)". Nunca mexe em horario.
 reply=reply.replace(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/g,(m,d,mo,y)=>{
  const iso=`${y}-${mo}-${d}`
  const t=today()
  const amanha=new Date(new Date(t+'T12:00:00-03:00').getTime()+86400000).toISOString().slice(0,10)
  if(iso===t)return 'hoje'
  if(iso===amanha)return 'amanhã'
  const dt=new Date(iso+'T12:00:00-03:00')
  if(isNaN(dt.getTime()))return m
  const wdName=['domingo','segunda','terça','quarta','quinta','sexta','sábado'][dt.getDay()]
  return `${wdName} (${d}/${mo})`
 })
 await supabase.from('site_chat_messages').insert([{session_id:sessionId,role:'user',content:message,state},{session_id:sessionId,role:'assistant',content:reply,state:next,intent}]).then(()=>{})
 // v29.64.0 — caso Helder (21/08, 10h10): "Bom trabalho e ótimo dia" → "Muito obrigado,
 // Helder! Desejo um ótimo dia..." → "Obrigado senhor Juliano" → "Eu que agradeço, Helder!"
 // — quatro despedidas em cadeia; no dia seguinte ele disse ao Juliano que "desconfiou que
 // era a IA". Regra de gente: despedida se responde UMA vez. Se a última fala da JuIA já foi
 // um fechamento e o cliente só devolveu outra gentileza, fica em silêncio (o webhook não
 // envia resposta vazia; o estado é salvo normalmente).
 {
  const lastAssistant=normalize(String([...(Array.isArray(body.history)?body.history:[])].reverse().find((h:any)=>h&&h.role==='assistant')?.content||''))
  // Começa com agradecimento/despedida, é curta e não traz pedido nenhum. "Bom dia/boa
  // tarde/boa noite" ficam de fora de propósito: são aberturas de conversa, não fechamento.
  const q=normalizedQuestion.trim()
  const pedidoNaFala=/\?|quer|queria|gostaria|marc|agend|horari|pode|consig|tem |teria|preciso|cancel|remarc|quanto|qual|como|onde|quando|vaga|amanha|hoje/.test(q)
  const despedidaPura=q.length<=60&&!pedidoNaFala&&/^(muito |ok |beleza |show |top )?(obrigad|valeu|brigad|grat[oa]|bom trabalho|otimo dia|otima tarde|boa semana|bom (fds|final de semana|descanso)|um abraco|abraco|abracos|ate (mais|logo|breve|a proxima)|tchau|tmj|fique com deus|deus abencoe|excelente (dia|fds|final de semana))/.test(q)
  const jaFechou=/agradec|obrigad|otimo dia|bom descanso|abraco|ate (mais|logo|breve)|desejo/.test(lastAssistant)
  if(despedidaPura&&jaFechou&&!isQuestion&&intent!=='book'&&intent!=='cancel'&&intent!=='reschedule'){reply='';actions=[];handoff=false;intent='other'}
 }
 // v29.62.0 — aviso da regra das famílias (só quando o código tirou algo da lista). Cede a
 // vez quando a resposta já traz o aviso específico antigo de barba (29.50.0, "não pagar em
 // dobro") ou de pezinho (29.43.6) — testado ao vivo em 22/08: sem isso saíam os dois.
 if(serviceRuleNote&&!/Só pra ajustar|pagar em dobro|já vem incluso/.test(reply))reply=`${serviceRuleNote}\n\n${reply}`
 return respond({reply,intent,state:next,actions,handoff})
})

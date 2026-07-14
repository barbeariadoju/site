import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = new Set(['https://www.barbeariadoju.com.br','https://barbeariadoju.com.br'])
const cors = (origin:string) => ({
  'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://www.barbeariadoju.com.br',
  'Vary':'Origin',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
})
const respond=(origin:string,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8'}})
const text=(v:unknown,max:number)=>String(v??'').trim().slice(0,max)
const phone=(v:unknown)=>String(v??'').replace(/\D/g,'').slice(0,13)
const html=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')

Deno.serve(async req=>{
 const origin=req.headers.get('origin')||''
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)})
 if(req.method!=='POST')return respond(origin,{error:'Método não permitido.'},405)
 if(origin&&!allowedOrigins.has(origin))return respond(origin,{error:'Origem não autorizada.'},403)
 const body=await req.json().catch(()=>({}))
 const name=text(body.name,80),customerPhone=phone(body.phone),message=text(body.message,1000),website=text(body.website,120)
 const pageUrl=text(body.page_url,500),userAgent=text(body.user_agent||req.headers.get('user-agent'),500)
 if(website)return respond(origin,{ok:true,email_sent:false})
 if(name.length<2)return respond(origin,{error:'Nome inválido.'},400)
 if(customerPhone.length<10)return respond(origin,{error:'WhatsApp inválido.'},400)
 if(message.length<10)return respond(origin,{error:'Mensagem muito curta.'},400)
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 const since=new Date(Date.now()-60*60*1000).toISOString()
 const {count}=await admin.from('contact_messages').select('*',{count:'exact',head:true}).eq('phone',customerPhone).gte('created_at',since)
 if((count||0)>=5)return respond(origin,{error:'Muitas mensagens em pouco tempo. Fale diretamente pelo WhatsApp.'},429)
 const resendKey=Deno.env.get('RESEND_API_KEY')
 const {data:saved,error:saveError}=await admin.from('contact_messages').insert({name,phone:customerPhone,message,page_url:pageUrl||null,user_agent:userAgent||null,email_status:resendKey?'pending':'disabled'}).select('id').single()
 if(saveError)return respond(origin,{error:'Não foi possível registrar a mensagem.'},500)
 if(!resendKey)return respond(origin,{ok:true,email_sent:false})
 const to=Deno.env.get('CONTACT_TO_EMAIL')||'contato@barbeariadoju.com.br'
 const from=Deno.env.get('CONTACT_FROM_EMAIL')||'Barbearia do Ju <contato@barbeariadoju.com.br>'
 const er=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:`Nova mensagem do site — ${name}`,html:`<h2>Nova mensagem pelo site</h2><p><b>Nome:</b> ${html(name)}</p><p><b>WhatsApp:</b> ${html(customerPhone)}</p><p><b>Mensagem:</b></p><p style="white-space:pre-wrap">${html(message)}</p>${pageUrl?`<p><small>Página: ${html(pageUrl)}</small></p>`:''}`})})
 const ed=await er.json().catch(()=>({}))
 if(!er.ok){await admin.from('contact_messages').update({email_status:'failed',email_error:text(ed?.message||'Falha no envio',500)}).eq('id',saved.id);return respond(origin,{ok:true,email_sent:false})}
 await admin.from('contact_messages').update({email_status:'sent',email_error:null}).eq('id',saved.id)
 return respond(origin,{ok:true,email_sent:true})
})

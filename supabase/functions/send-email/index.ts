import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, x-webhook-secret','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'}
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
const emailOk = (v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

Deno.serve(async(req:Request)=>{
  let queueId:string|null=null
  if(req.method==='OPTIONS')return new Response('ok',{headers})
  if(req.method!=='POST')return json({error:'Método não permitido.'},405)
  const expected=Deno.env.get('EMAIL_WEBHOOK_SECRET')||''
  if(!expected||req.headers.get('x-webhook-secret')!==expected)return json({error:'Não autorizado.'},401)
  try{
    const body=await req.json()
    const to=String(body?.to||'').trim().toLowerCase()
    const subject=String(body?.subject||'').trim()
    const html=String(body?.html||'')
    if(!emailOk(to)||!subject||!html)return json({error:'Destinatário, assunto ou conteúdo inválido.'},400)

    const supabaseUrl=Deno.env.get('SUPABASE_URL')!
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:row,error:insertError}=await admin.from('email_queue').insert({
      booking_id:body.booking_id||null,event_type:body.event_type||'test',recipient_type:body.recipient_type||'test',recipient_email:to,recipient_name:body.recipient_name||null,subject,html_content:html,status:'sending',attempts:1
    }).select('*').single()
    if(insertError)return json({error:insertError.message},500)
    queueId=row.id

    const clientId=Deno.env.get('ZOHO_CLIENT_ID')!, clientSecret=Deno.env.get('ZOHO_CLIENT_SECRET')!, refreshToken=Deno.env.get('ZOHO_REFRESH_TOKEN')!
    const accountId=Deno.env.get('ZOHO_ACCOUNT_ID')!, fromAddress=Deno.env.get('ZOHO_FROM_ADDRESS')||'contato@barbeariadoju.com.br'
    const accountsBase=Deno.env.get('ZOHO_ACCOUNTS_BASE_URL')||'https://accounts.zoho.com'
    const mailBase=Deno.env.get('ZOHO_MAIL_BASE_URL')||'https://mail.zoho.com'
    if(!clientId||!clientSecret||!refreshToken||!accountId)throw new Error('Secrets do Zoho incompletos.')

    const tokenUrl=new URL(`${accountsBase}/oauth/v2/token`)
    tokenUrl.searchParams.set('refresh_token',refreshToken);tokenUrl.searchParams.set('grant_type','refresh_token');tokenUrl.searchParams.set('client_id',clientId);tokenUrl.searchParams.set('client_secret',clientSecret)
    const tokenRes=await fetch(tokenUrl,{method:'POST',headers:{Accept:'application/json'}})
    const tokenData=await tokenRes.json().catch(()=>({}))
    if(!tokenRes.ok||!tokenData.access_token)throw new Error(`Zoho OAuth: ${JSON.stringify(tokenData)}`)

    const sendRes=await fetch(`${mailBase}/api/accounts/${encodeURIComponent(accountId)}/messages`,{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Zoho-oauthtoken ${tokenData.access_token}`},
      body:JSON.stringify({fromAddress,toAddress:to,subject,content:html,mailFormat:'html',encoding:'UTF-8',askReceipt:'no'})
    })
    const sendData=await sendRes.json().catch(()=>({}))
    if(!sendRes.ok||Number(sendData?.status?.code||sendRes.status)>=400)throw new Error(`Zoho Mail: ${JSON.stringify(sendData)}`)
    const messageId=String(sendData?.data?.messageId||sendData?.data?.mailId||'')||null
    await admin.from('email_queue').update({status:'sent',sent_at:new Date().toISOString(),updated_at:new Date().toISOString(),zoho_message_id:messageId,last_error:null}).eq('id',row.id)
    return json({ok:true,id:row.id,message_id:messageId})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    console.error('[send-email]',message)
    if(queueId){
      try{
        const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        await admin.from('email_queue').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',queueId)
      }catch(updateError){console.error('[send-email] queue update',updateError)}
    }
    return json({error:message,queue_id:queueId},500)
  }
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders})
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('')
const code=()=>`BJ-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Método não permitido.'},405)

  try{
    const body=await req.json()
    const required=['customer_name','customer_phone','service_name','service_price','duration_minutes','booking_date','start_time']
    for(const key of required){
      if(body?.[key]===undefined||body?.[key]===null||body?.[key]===''){
        return json({error:`Campo obrigatório ausente: ${key}`},400)
      }
    }

    const url=Deno.env.get('SUPABASE_URL')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
    const emailSecret=Deno.env.get('EMAIL_WEBHOOK_SECRET')
    const admin=createClient(url,service)

    const {data:id,error:createError}=await admin.rpc('create_public_booking_v15',{
      p_customer_name:String(body.customer_name).trim(),
      p_customer_phone:String(body.customer_phone).replace(/\D/g,''),
      p_customer_email:body.customer_email?String(body.customer_email).trim().toLowerCase():null,
      p_service_name:String(body.service_name),
      p_service_price:Number(body.service_price),
      p_duration_minutes:Number(body.duration_minutes),
      p_booking_date:String(body.booking_date),
      p_start_time:String(body.start_time),
      p_notes:body.notes?String(body.notes).trim():null,
      p_selected_products:Array.isArray(body.selected_products)?body.selected_products:[]
    })
    if(createError)return json({error:createError.message},400)

    const managementToken=token()
    const tokenHash=await hash(managementToken)
    let bookingCode=''
    let record:any=null
    let lastError:any=null

    for(let attempt=0;attempt<5;attempt++){
      bookingCode=code()
      const {data,error}=await admin.rpc('attach_booking_management_v25',{
        p_booking_id:id,
        p_booking_code:bookingCode,
        p_management_token_hash:tokenHash
      })
      if(!error&&data){record=data;break}
      lastError=error
      console.error('[create-public-booking] attach attempt',attempt+1,error)
      if(!String(error?.message||'').toLowerCase().includes('duplicate'))break
    }

    if(!record){
      console.error('[create-public-booking] management link not persisted',lastError)
      return json({error:'O agendamento foi criado, mas não foi possível gerar o link de gerenciamento. Entre em contato com a Barbearia do Ju.',booking_id:id},500)
    }

    const {error:actionError}=await admin.from('booking_customer_actions').insert({booking_id:id,action:'created_link'})
    if(actionError)console.error('[create-public-booking] action log',actionError)

    // Coleta opcional da data de nascimento para a mensagem de aniversário.
    const birthDate=String(body.birth_date||'').trim()
    if(/^\d{4}-\d{2}-\d{2}$/.test(birthDate)){
      try{
        await admin.rpc('upsert_customer_birthday',{p_phone:String(body.customer_phone).replace(/\D/g,''),p_name:String(body.customer_name).trim(),p_birth_date:birthDate})
      }catch(birthError){console.error('[create-public-booking] birthday',birthError)}
    }

    let push={sent:0,failed:0}
    if(pushSecret){
      try{
        const response=await fetch(`${url}/functions/v1/send-push`,{
          method:'POST',
          headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},
          body:JSON.stringify({record})
        })
        const result=await response.json().catch(()=>({}))
        push={sent:Number(result.sent||0),failed:Number(result.failed||0)}
        if(!response.ok)console.error('[create-public-booking] push',response.status,result)
      }catch(error){console.error('[create-public-booking] push exception',error)}
    }

    let email={requested:false,ok:false}
    if(emailSecret){
      email.requested=true
      try{
        const response=await fetch(`${url}/functions/v1/booking-email`,{
          method:'POST',
          headers:{'Content-Type':'application/json','x-webhook-secret':emailSecret},
          body:JSON.stringify({booking_id:id,event_type:'booking_confirmed',management_token:managementToken})
        })
        email.ok=response.ok
        if(!response.ok)console.error('[create-public-booking] email',response.status,await response.text())
      }catch(error){console.error('[create-public-booking] email exception',error)}
    }

    return json({
      ok:true,
      id,
      record,
      push,
      email,
      booking_code:record.booking_code,
      management_token:managementToken,
      manage_url:`/meu-agendamento.html?code=${encodeURIComponent(record.booking_code)}&token=${encodeURIComponent(managementToken)}`
    })
  }catch(error){
    console.error('[create-public-booking]',error)
    return json({error:'Não foi possível concluir o agendamento.'},500)
  }
})

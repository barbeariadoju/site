import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders})

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Método não permitido.'},405)

  try{
    const body=await req.json()
    const required=['customer_name','customer_phone','service_name','service_price','duration_minutes','booking_date','start_time']
    for(const key of required){if(body?.[key]===undefined||body?.[key]===null||body?.[key]==='')return json({error:`Campo obrigatório ausente: ${key}`},400)}

    const url=Deno.env.get('SUPABASE_URL')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
    const admin=createClient(url,service)

    const {data:id,error}=await admin.rpc('create_public_booking_v15',{
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
    if(error)return json({error:error.message},400)

    const {data:record}=await admin.from('bookings').select('*').eq('id',id).single()
    let push={sent:0,failed:0}
    if(record&&pushSecret){
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

    return json({ok:true,id,record,push})
  }catch(error){
    console.error('[create-public-booking]',error)
    return json({error:'Não foi possível concluir o agendamento.'},500)
  }
})

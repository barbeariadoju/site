import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'}
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers})
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('')
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('')
const code=()=>`BJ-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`
const SERVICES=[
['Corte + Lavagem',50,40],['Corte de cabelo',40,30],['Corte + Barboterapia',80,60],['Corte + Barba Express',65,50],['Barboterapia com vaporizador de ozônio',50,40],['Barboterapia',40,30],['Barba Express',25,20],['Pezinho (acabamento)',15,10],['Sobrancelha Masculina',15,10],['Depilação nasal (cera quente)',25,20],['Depilação orelhas',25,20],['Freestyle (risquinho)',15,10],['Nevou / Platinado',150,120],['Luzes',120,90],['Alisamento / Relaxamento',70,45],['Pigmentação Capilar (Tintura)',50,30],['Hidratação / Reconstrução Capilar',40,20],['Pigmentação de Barba',35,20],['Pigmentação de Sobrancelha',20,20]
] as const
const PRODUCTS=new Map([['Pasta Matte 150g',34],['Gel Cola Black Shark Barber',16],['Óleo Para Barba 30mL',36],['Balm Para Barba 150g',35],['Shampoo Para Barba 240mL',35],['Pomada em pó',35]])
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'Método não permitido.'},405)
 try{
  const b=await req.json(),codeValue=String(b?.code||'').trim().toUpperCase(),rebookToken=String(b?.token||'').trim()
  if(!codeValue||!rebookToken)return json({error:'Link de reagendamento inválido.'},400)
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,emailSecret=Deno.env.get('EMAIL_WEBHOOK_SECRET'),pushSecret=Deno.env.get('PUSH_WEBHOOK_SECRET')
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:source,error:sourceError}=await admin.from('bookings').select('*').eq('booking_code',codeValue).maybeSingle()
  if(sourceError||!source)return json({error:'Agendamento original não encontrado.'},404)
  if(!source.rebooking_token_hash||await hash(rebookToken)!==source.rebooking_token_hash)return json({error:'Link inválido ou expirado.'},403)
  if(source.rebooking_expires_at&&new Date(source.rebooking_expires_at)<new Date())return json({error:'Este link expirou.'},410)
  if(source.status!=='cancelled'||source.rebooked_to_booking_id)return json({error:'Este reagendamento não está mais disponível.'},409)
  const requested=Array.isArray(b.services)?b.services.map(String):[]
  const selected=SERVICES.filter(s=>requested.includes(s[0]))
  if(!selected.length)return json({error:'Escolha pelo menos um serviço.'},400)
  const serviceName=selected.map(s=>s[0]).join(' + '),servicePrice=selected.reduce((a,s)=>a+s[1],0),duration=selected.reduce((a,s)=>a+s[2],0)
  const products=(Array.isArray(b.selected_products)?b.selected_products:[]).map((x:any)=>({name:String(x?.name||''),price:Number(PRODUCTS.get(String(x?.name||''))||0)})).filter((x:any)=>x.price>0)
  const date=String(b.booking_date||''),start=String(b.start_time||'')
  if(!date||!start)return json({error:'Escolha a nova data e o novo horário.'},400)
  const {data:id,error:createError}=await admin.rpc('create_public_booking_v15',{p_customer_name:source.customer_name,p_customer_phone:source.customer_phone,p_customer_email:source.customer_email||null,p_service_name:serviceName,p_service_price:servicePrice,p_duration_minutes:duration,p_booking_date:date,p_start_time:start,p_notes:String(b.notes||source.notes||'').trim()||null,p_selected_products:products})
  if(createError)return json({error:createError.message},400)
  const managementToken=token(),managementHash=await hash(managementToken);let record:any=null
  for(let i=0;i<5;i++){const bookingCode=code();const {data,error}=await admin.rpc('attach_booking_management_v25',{p_booking_id:id,p_booking_code:bookingCode,p_management_token_hash:managementHash});if(!error&&data){record=data;break}}
  if(!record)return json({error:'Novo horário criado, mas houve falha ao gerar o link de gerenciamento.'},500)
  await admin.from('bookings').update({rebooked_from_booking_id:source.id}).eq('id',id)
  await admin.from('bookings').update({rebooked_to_booking_id:id,rebooking_token_hash:null,rebooking_expires_at:null}).eq('id',source.id)
  const { error: actionError } = await admin.from('booking_customer_actions').insert({booking_id:id,action:'rebooked_after_admin_cancellation'})
  if (actionError) console.error('[create-rebooking] action log', actionError)
  if(emailSecret)await fetch(`${url}/functions/v1/booking-email`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':emailSecret},body:JSON.stringify({booking_id:id,event_type:'booking_confirmed',management_token:managementToken})}).catch(()=>{})
  if(pushSecret)await fetch(`${url}/functions/v1/send-push`,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':pushSecret},body:JSON.stringify({record,custom:{title:'🔁 Cliente escolheu novo horário',body:`${source.customer_name} reagendou para ${date.split('-').reverse().join('/')} às ${start.slice(0,5)}`,url:'/admin-agenda.html?app=1',tag:`rebooking-${id}`}})}).catch(()=>{})
  return json({ok:true,booking:record,manage_url:`/meu-agendamento.html?code=${encodeURIComponent(record.booking_code)}&token=${encodeURIComponent(managementToken)}`})
 }catch(e){console.error('[create-rebooking]',e);return json({error:'Não foi possível concluir o novo agendamento.'},500)}
})

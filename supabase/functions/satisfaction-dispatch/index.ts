import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { montarMensagemComprovante, ehVendaSoDeProduto } from '../_shared/comprovante.ts'

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

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers})
  if(req.method!=='POST') return json({error:'Método não permitido.'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')?.trim()||''
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()||''
  const emailSecret=Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim()||''
  const provided=req.headers.get('x-webhook-secret')||''
  if(!supabaseUrl||!serviceRole||!emailSecret) return json({error:'Secrets obrigatórios ausentes.'},500)

  // v29.121.0 — segundo caminho de autenticação: sessão de ADMIN logado, mesmo padrão do
  // send-walkin-welcome. Existe por causa do Balcão: o walk-in é criado por RPC direto do
  // navegador (admin_register_walkin_visit) e nunca passava por function nenhuma, então o
  // comprovante dependia só do cron de 15 min — e, depois das 20h, do dia seguinte. Agora a
  // tela do Balcão chama esta function na hora, com a sessão do Juliano.
  let autorizado=provided===emailSecret
  const authorization=req.headers.get('Authorization')||''
  if(!autorizado&&authorization.startsWith('Bearer ')){
    const anonKey=Deno.env.get('SUPABASE_ANON_KEY')?.trim()||''
    if(anonKey){
      const authClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
      const {data:{user}}=await authClient.auth.getUser()
      if(user){
        const {data:isAdmin}=await authClient.rpc('is_admin')
        autorizado=isAdmin===true
      }
    }
  }
  if(!autorizado) return json({error:'Não autorizado.'},401)

  // v29.121.0 — EXCEÇÃO ao horário de silêncio, pedida pelo Juliano em 03/09/2026: o
  // comprovante da conclusão sai na hora, mesmo depois das 20h.
  //
  // A regra das 20h existe pra não incomodar quem já está em casa com mensagem de marketing
  // (lembrete, aniversário, reativação). O comprovante não é isso: é o documento do que o
  // cliente ACABOU de pagar, e ele ainda está na porta da barbearia. Segurar até as 8h do dia
  // seguinte foi exatamente o que deixou o Wellington sair sem a conta na mão (02/09) e o que
  // fez o "1" do Walter cair na pergunta errada no dia seguinte (29/08, v29.90.0).
  //
  // A exceção é estreita de propósito: só a chamada direta da conclusão (admin-booking-status
  // manda {immediate:true, booking_id}), só aquele atendimento, só se for do dia, e nunca de
  // madrugada. O cron continua respeitando o silêncio integralmente.
  const payload=await req.json().catch(()=>({}))as Record<string,unknown>
  const bookingIdImediato=String(payload?.booking_id||'').trim()
  const imediato=payload?.immediate===true&&Boolean(bookingIdImediato)

  // v29.21.0 / v29.26.0 - guarda local de horario (20h-8h). A JANELA COMPLETA de contato
  // (domingo e feriado nunca; sabado ate 15h; demais dias 8h-20h) e aplicada no AGENDADOR,
  // pela migration 110: o cron so chama esta function quando public.juia_quiet_now() e falso.
  // Regra em um lugar so; isto aqui e apenas rede de seguranca para disparo manual.
  const emSP=(d:Date,opts:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',...opts}).format(d)
  const quietHour=Number(emSP(new Date(),{hour:'2-digit',hourCycle:'h23'}))
  const hojeSP=emSP(new Date(),{year:'numeric',month:'2-digit',day:'2-digit'})
  const emSilencio=quietHour>=20||quietHour<8
  // Das 8h à meia-noite: o expediente pode furar as 20h, madrugada nunca.
  if(emSilencio&&!(imediato&&quietHour>=8)) return json({ok:true,quiet_hours:true})

  const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const evolutionApiUrl=Deno.env.get('EVOLUTION_API_URL')?.trim()||''
  const evolutionApiKey=Deno.env.get('EVOLUTION_API_KEY')?.trim()||''
  const evolutionInstance=Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim()||''

  let query=admin
    .from('experience_requests')
    .select('id,token,booking_id,bookings(customer_name,customer_email,customer_phone,booking_date,start_time,service_name,service_price,products_price,selected_products,payment_method,products_payment_method,loyalty_discount,tip_amount,courtesy,courtesy_reason,channel,prepay_confirmed_at)')
    .in('status',['pending','failed'])
    .lte('scheduled_for',new Date().toISOString())
  // v29.121.0 — no modo imediato processa SÓ o atendimento recém-concluído. Sem isso, uma
  // conclusão às 21h arrastaria junto todo comprovante represado do dia, de outros clientes,
  // fora da hora — a exceção vale pra quem acabou de sair da cadeira, não pra fila inteira.
  if(imediato) query=query.eq('booking_id',bookingIdImediato)
  const {data:rows,error}=await query.limit(50)
  if(error) return json({error:error.message},500)

  let sentWhatsapp=0,sentEmail=0,failed=0,skipped=0
  for(const row of rows||[]){
    const booking=Array.isArray(row.bookings)?row.bookings[0]:row.bookings
    const first=String(booking?.customer_name||'Cliente').trim().split(/\s+/)[0]
    const phone=canonicalPhone(String(booking?.customer_phone||''))
    const email=String(booking?.customer_email||'').trim().toLowerCase()

    let whatsappOk=false
    let fecharSemPesquisa=false // v29.81.0 — venda só de produto: comprovante sem pesquisa 1/2

    // v29.121.0 — a exceção do silêncio é do atendimento de HOJE. Concluir às 21h um
    // atendimento de ontem (acerto de agenda atrasado) não autoriza mensagem fora de hora:
    // o registro fica pendente e o cron manda às 8h, como sempre.
    if(emSilencio&&String(booking?.booking_date||'')!==hojeSP){
      console.log('[satisfaction-dispatch] silêncio: atendimento não é de hoje, adiado',row.booking_id)
      skipped++
      continue
    }
    // v29.43.0 — fila unica de perguntas numeradas: se este telefone ja tem outra pergunta
    // sem resposta (convite, confirmacao, follow-up), a pesquisa espera o proximo cron
    // (roda a cada 15 min). Sem isso o "1" do cliente responde a pergunta errada.
    if(phone.length>=12){
      const {data:pendente}=await admin.rpc('juia_pending_numeric_question',{p_phone:phone})
      if(pendente&&pendente!=='survey'){
        console.log('[satisfaction-dispatch] fila unica: adiado, ja existe pergunta pendente',pendente,phone)
        skipped++
        continue
      }
    }
    if(phone.length>=12 && evolutionApiUrl && evolutionApiKey && evolutionInstance){
      // v29.30.0 — a pesquisa virou COMPROVANTE + pesquisa numa mensagem só (pedido do
      // Juliano, 16/08/2026). Duas razões, e a segunda vale mais que a primeira:
      //   1. o cliente ganha um recibo de verdade do que pagou — capricho que passa confiança;
      //   2. vira auditoria automática do walk-in: atendimento não registrado = cliente sem
      //      comprovante = alguém percebe. Com a placa no balcão ("todo atendimento gera
      //      comprovante; não recebeu? avise"), é o próprio cliente quem fecha essa brecha —
      //      sem vigilância, sem câmera, sem constranger ninguém.
      //
      // v29.121.0 — o texto virou um CUPOM NÃO FISCAL de verdade (número do documento, itens,
      // subtotal, desconto, total, forma de pagamento, caixinha, aviso de que não tem valor
      // fiscal) e mudou de casa: está em _shared/comprovante.ts, com teste unitário. O que
      // motivou foi o Wellington questionar os valores depois do atendimento (02/09/2026) — a
      // conta aberta na mão do cliente é a resposta, e ela precisa ser conferível linha a linha.
      const produtosBrutos=Array.isArray(booking?.selected_products)?booking.selected_products:[]
      const dados={
        bookingId:String(row.booking_id||''),
        clienteNome:String(booking?.customer_name||'Cliente'),
        data:String(booking?.booking_date||''),
        // v29.90.0 (caso Walter, 29/08) — comprovante segurado pelo horário de silêncio saía
        // "hoje às 19:30" na manhã SEGUINTE. O dia certo vem do booking_date contra hoje em SP.
        hoje:hojeSP,
        hora:String(booking?.start_time||'').slice(0,5),
        servicoNome:String(booking?.service_name||'Atendimento'),
        servicoValor:Number(booking?.service_price||0),
        produtos:produtosBrutos.map((p:Record<string,unknown>)=>({nome:String(p?.name||'Produto'),valor:Number(p?.price||0)})),
        descontoFidelidade:Number(booking?.loyalty_discount||0),
        caixinha:Number(booking?.tip_amount||0),
        cortesia:booking?.courtesy===true,
        cortesiaMotivo:String(booking?.courtesy_reason||''),
        pagamentoServico:String(booking?.payment_method||''),
        pagamentoProdutos:String(booking?.products_payment_method||''),
        // v29.56.0 (caso Aletéia, 21/08): quem pagou antecipado por Pix e teve o pagamento
        // confirmado pelo Juliano recebia um comprovante sem NENHUMA linha de pagamento quando
        // a forma não tinha sido preenchida na conclusão — e lê isso como "não registraram meu
        // Pix". O pagamento antecipado confirmado vale como forma de pagamento por si só.
        pagamentoAntecipado:Boolean(booking?.prepay_confirmed_at),
        // v29.45.0 — walk-in (balcão): o convite "da próxima vez agende por aqui" que era uma
        // mensagem separada (send-walkin-welcome, 9 min antes desta) é uma linha do comprovante.
        balcao:String(booking?.channel||'')==='balcao',
      }
      // v29.81.0 (caso Eduardo, 27/08) — venda SÓ de produto ganha mensagem própria e NÃO faz a
      // pesquisa 1/2. O registro em experience_requests é fechado logo após o envio pra um "1"
      // solto nunca ser lido como resposta de pesquisa.
      fecharSemPesquisa=ehVendaSoDeProduto(dados)
      const waText=montarMensagemComprovante(dados)
      try{
        const sendResponse=await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`,{
          method:'POST',
          headers:{'Content-Type':'application/json',apikey:evolutionApiKey},
          body:JSON.stringify({number:phone,text:semEmoji(waText)}),
        })
        whatsappOk=sendResponse.ok
        if(whatsappOk){
          const sendData=await sendResponse.json().catch(()=>({}))
          const sentMessageId=String(sendData?.key?.id||'')||null
          await admin.from('whatsapp_messages').insert({phone,direction:'out',body:waText,sent_by:'bot',evolution_message_id:sentMessageId})
          await admin.from('whatsapp_conversations').upsert({phone,human_takeover:false,last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'phone'})
        }
      }catch(sendError){
        console.error('[satisfaction-dispatch] whatsapp',sendError)
        whatsappOk=false
      }
    }

    if(whatsappOk){
      sentWhatsapp++
      // v29.81.0 — venda só de produto: fecha o registro na hora ('expired' fica fora do
      // find_pending_experience_by_phone), senão um "1" solto do cliente viraria resposta
      // de uma pesquisa que nunca foi feita.
      await admin.from('experience_requests').update(fecharSemPesquisa
        ?{status:'expired',sent_at:new Date().toISOString(),last_error:'Venda só de produto — comprovante enviado sem pesquisa.',updated_at:new Date().toISOString()}
        :{status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id)
      continue
    }

    if(!email){
      skipped++
      await admin.from('experience_requests').update({status:'expired',last_error:'Sem WhatsApp nem e-mail disponível.',updated_at:new Date().toISOString()}).eq('id',row.id)
      continue
    }

    const link=`https://www.barbeariadoju.com.br/avaliacao.html?token=${encodeURIComponent(row.token)}`
    const html=`<!doctype html><html><body style="margin:0;background:#0c0c0c;color:#f7f3e8;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px"><table width="100%" style="max-width:620px;background:#171717;border:1px solid #3a321c;border-radius:22px;overflow:hidden"><tr><td style="padding:34px"><p style="color:#d4af37;font-weight:bold;margin:0 0 12px">BARBEARIA DO JU</p><h1 style="font-size:28px;margin:0 0 18px">Como foi sua experiência?</h1><p style="font-size:17px;line-height:1.6;color:#d7d2c6">Olá, ${first}! Muito obrigado por confiar no meu trabalho.</p><p style="font-size:17px;line-height:1.6;color:#d7d2c6">Sua opinião é muito importante para que eu continue melhorando cada atendimento.</p><p style="text-align:center;margin:30px 0"><a href="${link}" style="display:inline-block;background:#d4af37;color:#111;text-decoration:none;font-weight:bold;padding:15px 26px;border-radius:999px">Compartilhar minha experiência</a></p><p style="font-size:13px;color:#8f8a7d">A resposta leva menos de um minuto.</p></td></tr></table></td></tr></table></body></html>`
    try{
      const response=await fetch(`${supabaseUrl}/functions/v1/send-email`,{
        method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':emailSecret},
        body:JSON.stringify({booking_id:row.booking_id,event_type:'experience_request',recipient_type:'customer',recipient_email:email,recipient_name:booking?.customer_name,to:email,subject:'Como foi sua experiência na Barbearia do Ju?',html})
      })
      const result=await response.json().catch(()=>({}))
      if(!response.ok||result?.error) throw new Error(String(result?.error||`Falha ${response.status}`))
      sentEmail++
      await admin.from('experience_requests').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id)
    }catch(err){
      failed++
      await admin.from('experience_requests').update({status:'failed',last_error:String(err).slice(0,2000),updated_at:new Date().toISOString()}).eq('id',row.id)
    }
  }
  return json({ok:true,processed:(rows||[]).length,sent_whatsapp:sentWhatsapp,sent_email:sentEmail,failed,skipped})
})

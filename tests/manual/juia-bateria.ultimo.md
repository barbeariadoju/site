# Bateria JuIA — 2026-09-06T00:10:11.251Z — dia de teste 2026-09-10

## S1 site: saudação
  > oi
  < Boa noite! Espero que esteja tudo bem com você! Como posso te ajudar hoje?
  PASS — responde e pergunta como ajudar

## S2 site: preço do corte
  > quanto custa o corte de cabelo?
  < Boa noite! O corte de cabelo custa R$ 40,00. É feito com hora marcada, sem fila, e inclui o pezinho. Se quiser, posso consultar um horário para você.
  PASS — diz R$ 40,00

## S3 site: horário livre NÃO reserva sozinho
  > tem corte de cabelo quinta (10/09) às 14h?
  < Boa noite! Sim! na quinta (10/09) às 14:00 está livre para Corte de cabelo. Quer incluir mais alguma coisa? Responda só o número:
    *1* — Corte + Lavagem (vira R$ 50,00, com lavagem profissional)
    *2* — Sobrancelha Masculina (+ R$ 15,00)
    *3* — Barba Express (+ R$ 25,00)
    *4* — Não, pode fechar assim
    
    Ah, e se quiser deixar algum produto de estética ou bebida gelada separado pra retirar na hora, é só me avisar.
  PASS — confirma que está livre (Boa noite! Sim! na quinta (10/09) às 14:00 está livre para Corte de cabelo. Quer)
  PASS — não reserva sem nome/telefone

## S4 segurança: anon + verified_phone é ignorado
  > quero cancelar meu horário
  < Boa noite! Para cancelar com segurança, preciso confirmar pelo seu WhatsApp cadastrado. Pode chamar a gente direto pelo número da barbearia, ou aguarde que o Juliano confirma com você.
  PASS — não trata como telefone verificado (Boa noite! Para cancelar com segurança, preciso confirmar pelo seu WhatsApp cada)

## W1 reserva primeiro, oferece depois
  > quero marcar corte de cabelo quinta às 14h
  < Boa noite, Teste! Reservado! na quinta (10/09) às 14:00: Corte de cabelo (R$ 40,00). Te espero na Barbearia do Ju. A propósito, você está com 0 ponto(s) de fidelidade — faltam 10 pra ganhar um serviço grátis. Se preferir já deixar pago pelo Pix, é só me pedir a chave
    
    Quer aproveitar e incluir a lavagem profissional (Corte + Lavagem, vira R$ 50,00)? Digite *1* para sim ou *2* para não.
  PASS — reservou na hora (Boa noite, Teste! Reservado! na quinta (10/09) às 14:00: Corte de cabelo (R$ 40,00). Te es)
  PASS — agendamento existe no banco às 14:00 (Corte de cabelo 40min)
  PASS — oferta 1/2 depois da reserva
  > 1
  < Incluído. Fica Corte + Lavagem — R$ 50,00 (50 min), na quinta (10/09) às 14:00.
  PASS — "1" inclui o complemento (Incluído. Fica Corte + Lavagem — R$ 50,00 (50 min), na quinta (10/09) às 14:00.)
  PASS — serviço no banco virou combo (Corte + Lavagem)

## W2 elogio depois da reserva não reabre agenda
  > Vc é top demais, parabéns e que Deus te abençoe
  < Muito obrigado pelas palavras e pela bênção. Que Deus abençoe você também!
  PASS — não responde com horário/reserva (Muito obrigado pelas palavras e pela bênção. Que Deus abençoe você também!)

## W3 remarcar: o "sim" NÃO vira chave Pix
  > muda para 15:00 tem como?
  < Na quinta (10/09) às 15:00 está livre. Mudo seu agendamento de quinta (10/09) às 14:00 (Corte + Lavagem) para esse horário? Responda sim ou não.
  PASS — pergunta confirmação da remarcação (uma só) (Na quinta (10/09) às 15:00 está livre. Mudo seu agendamento de quinta (10/09) às 14:00 (Co)
  > sim
  < Prontinho! Mudei seu agendamento de quinta (10/09) às 14:00 para quinta (10/09) às 15:00.
  PASS — não manda chave Pix (Prontinho! Mudei seu agendamento de quinta (10/09) às 14:00 para quinta (10/09) às 15:00.)
  PASS — banco: horário mudou para 15:00 (15:00:00)

## W4 "15:30 não tem?" não é um "não"
  > 15:30 não tem?
  < Vamos remarcar seu agendamento de quinta (10/09) às 15:00 (Corte + Lavagem) para quinta (10/09) às 15:30, certo? Responda sim que eu verifico esse horário pra você.
  PASS — não responde "não mudei nada" (Vamos remarcar seu agendamento de quinta (10/09) às 15:00 (Corte + Lavagem) para quinta (1)

## W5 duas coisas na mesma mensagem ("sim, e quanto custa…")
  > muda pra 14:30
  < Confirmando: mudar seu agendamento de quinta (10/09) às 15:00 para quinta (10/09) às 14:30? Responda sim ou não.
  > sim, e quanto custa a barba express?
  < Prontinho! Mudei seu agendamento de quinta (10/09) às 15:00 para quinta (10/09) às 14:30.
    
    A Barba Express (só na máquina) custa R$ 25,00 e leva aproximadamente 30 minutos. Se quiser, posso consultar um horário para você.
  PASS — remarcou (primeira parte) (Prontinho! Mudei seu agendamento de quinta (10/09) às 15:00 para quinta (10/09) )
  PASS — respondeu o preço (segunda parte)
  PASS — banco: 14:30 (14:30:00)

## W6 pedido de gente = handoff
  > quero falar com o Juliano
  < Claro. Vou avisar o Juliano agora mesmo; ele está atendendo na cadeira e te responde por aqui assim que puder. 🙏
  PASS — handoff true (intent=handoff)
  PASS — sem agenda na resposta (Claro. Vou avisar o Juliano agora mesmo; ele está atendendo na cadeira e te resp)

## W7 Pix pedido de verdade: chave + valor
  > me passa o pix pra eu já deixar pago
  < Chave Pix (e-mail): contato@barbeariadoju.com.br
     Valor: R$ 50,00 — Corte + Lavagem, quinta (10/09) às 14:30.
    No aplicativo do banco vai aparecer o nome "Juliano Bruno Lopes Padilha" e a instituição "PicPay". Quando fizer, me avisa que o Juliano confere
  PASS — chave e valor (Chave Pix (e-mail): contato@barbeariadoju.com.br
 Valor: R$ 50,00 — Corte + Lava)

## W8 cancelar e perguntar de novo (bug conhecido do "undefined")
  > quero cancelar meu horário de quinta
  < Boa noite, Teste! É o seu agendamento de quinta (10/09) às 14:30 para Corte + Lavagem que você quer cancelar? Responda sim ou não.
  > sim
  < Pronto! Cancelei seu agendamento de quinta (10/09) às 14:30. Se quiser marcar outro horário, é só me dizer.
  PASS — cancelou (Pronto! Cancelei seu agendamento de quinta (10/09) às 14:30. Se quiser marcar ou)
  > quais horários tem para barba express quinta?
  < Consigo te atender na quinta (10/09) sim! Ainda tenho alguns horários para Barba Express + Corte + Lavagem (80 min). Você prefere manhã, tarde ou final do dia?
  PASS — sem "undefined" na resposta (Consigo te atender na quinta (10/09) sim! Ainda tenho alguns horários para Barba Express +)
  PASS — lista horários ou pergunta o período

## W9 serviço de sempre: confirma antes de reservar
  > tem 14h quinta?
  < Boa noite, Teste! Na quinta (10/09) às 14:00 está livre. Reservo Corte + Barba Express, como da última vez? Digite *1* para sim ou *2* se quiser outro serviço.
  PASS — pergunta "como da última vez? 1/2" (Boa noite, Teste! Na quinta (10/09) às 14:00 está livre. Reservo Corte + Barba Express, como da última vez? Di)
  > 2
  < Sem problema. Qual serviço você quer na quinta (10/09) às 14:00? Por exemplo: corte, barba, corte + barba.
  PASS — "2" pergunta qual serviço (Sem problema. Qual serviço você quer na quinta (10/09) às 14:00? Por exemplo: co)
  > só o corte
  < Reservado! Teste, na quinta (10/09) às 14:00: Corte de cabelo (R$ 40,00). Te espero na Barbearia do Ju. A propósito, você está com 1 ponto(s) de fidelidade — faltam 9 pra ganhar um serviço grátis. Se preferir já deixar pago pelo Pix, é só me pedir a chave
  PASS — reservou só o corte (Reservado! Teste, na quinta (10/09) às 14:00: Corte de cabelo (R$ 40,00). Te espero na Barbearia do )

## W10 serviço de sempre: "1" reserva o combo
  > tem 15h sexta?
  < Boa noite, Teste! Na sexta (11/09) às 15:00 está livre. Reservo Corte + Barba Express, como da última vez? Digite *1* para sim ou *2* se quiser outro serviço.
  PASS — pergunta 1/2 (Boa noite, Teste! Na sexta (11/09) às 15:00 está livre. Reservo Corte + Barba Express, como da últim)
  > 1
  < Reservado! Teste, na sexta (11/09) às 15:00: Corte + Barba Express (R$ 65,00). Te espero na Barbearia do Ju. A propósito, você está com 1 ponto(s) de fidelidade — faltam 9 pra ganhar um serviço grátis. Se preferir já deixar pago pelo Pix, é só me pedir a chave
  PASS — reservou o combo (Reservado! Teste, na sexta (11/09) às 15:00: Corte + Barba Express (R$ 65,00). Te espero na Barbeari)

## W11 horário que não cabe: alternativas curtas
  > corte de cabelo quinta às 15:30
  < Boa noite, Teste! Na quinta (10/09) às 15:30 já está ocupado. O mais próximo que tenho é 15:15 ou 16:45. Serve pra você? Se preferir outro, tenho ainda: 12:00, 12:15, 12:30.
  PASS — diz que não cabe/ocupado e dá alternativa (Boa noite, Teste! Na quinta (10/09) às 15:30 já está ocupado. O mais próximo que tenho é 15:15 ou 16:45. Serve)
  PASS — sem texto longo (< 220 chars) (173 chars)

## W12 "vou ver e te aviso" não repete a pergunta
  > tem horário quinta de manhã?
  < Boa noite, Teste! Na quinta (10/09), no período da manhã, tenho horários entre 08:00 e 11:45 para 60 minutos. Alguns exemplos: 08:00, 09:00, 10:00, 11:00, 11:45. Qual horário fica melhor pra você?
    
    (Anotei Corte + Barba Express, o seu de sempre Se quiser outro serviço ou incluir algo, é só dizer.)
  > Beleza vou ver e te aviso
  < Combinado, fico no aguardo. Quando decidir, é só me chamar por aqui que eu reservo.
  PASS — responde "combinado, fico no aguardo" (Combinado, fico no aguardo. Quando decidir, é só me chamar por aqui que eu reser)

## W13 visagismo: não fazemos, oferece o que existe
  > vocês fazem visagismo? queria um corte pensado pro formato do meu rosto
  < Boa noite, Teste! Aqui o Juliano não faz visagismo ou consultoria de imagem. Ele faz cortes como Old Money, degradê e social, pensando junto com você na cadeira e observando o formato do seu rosto. Se quiser, posso consultar um horário para o seu corte.
  PASS — diz que não faz visagismo (Boa noite, Teste! Aqui o Juliano não faz visagismo ou consultoria de imagem. Ele faz cortes como Old)
  PASS — não diz "vamos marcar" sem explicar

## W14 prospecção comercial
  > Olá! Sou da agência LevelUp, temos um sistema de agendamento pra barbearias, posso te mostrar uma demo?
  < Boa noite, Teste! Obrigado pelo contato e pelo interesse! Aqui na Barbearia do Ju, propostas comerciais são recebidas exclusivamente pelo e-mail contato@barbeariadoju.com.br. Este WhatsApp é exclusivo para agendamento de serviços dos clientes. Sucesso no seu trabalho!
  PASS — encaminha pro e-mail (Boa noite, Teste! Obrigado pelo contato e pelo interesse! Aqui na Barbearia do J)

## W15 "só corte infantil" substitui o serviço assumido
  > tem 10h sexta?
  < Boa noite, Teste! Na sexta (11/09) às 10:00 está livre. Reservo Corte + Barba Express, como da última vez? Digite *1* para sim ou *2* se quiser outro serviço.
  > só corte de cabelo de criança
  < Reservado! Teste, na sexta (11/09) às 10:00: Corte de cabelo infantil (R$ 40,00). Te espero na Barbearia do Ju. A propósito, você está com 1 ponto(s) de fidelidade — faltam 9 pra ganhar um serviço grátis. Se preferir já deixar pago pelo Pix, é só me pedir a chave
  PASS — reservou só o infantil (Reservado! Teste, na sexta (11/09) às 10:00: Corte de cabelo infantil (R$ 40,00). Te espero na Barbearia do Ju)

## limpeza
  bookings apagados: 5
  whatsapp_conversations: REST 403 whatsapp_conversations?phone=like.*999990001: {"code":"42501","details"
  site_chat_messages: REST 403 site_chat_messages?session_id=like.bateria-*: {"code":"42501","details"
  loyalty_rewards: REST 403 loyalty_rewards?customer_id=in.(70f931a2-29b2-4e1c-b880-3ba9fc66119d): 
  customer_profiles: REST 403 customer_profiles?id=in.(70f931a2-29b2-4e1c-b880-3ba9fc66119d): {"code":"42501","details":null,"hint":"Grant th
  bookings restantes do telefone de teste: 0

## resultado: 36/36 checagens passaram

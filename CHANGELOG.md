## 29.51.0 — Nunca expor agenda vazia + resgate da lista de espera + 4 correções da revisão diária (20/08)

Pedidos do Juliano no plano do dia de 20/08 (caso Stevan, 19/08: "com 43 horários" = "o cara não tem nenhum cliente").
- **ju-ia-site — REGRA NOVA: nunca dizer QUANTIDADE de horários nem despejar lista.** Helpers `slotsSample`/`slotsPhrase`: amostra espalhada de até 4 ("entre 08:00 e 18:30 — por exemplo 09:15, 12:15, 15:30") em TODOS os pontos que listavam ou contavam (remarcação ×2, disponibilidade, horário ocupado, próximo dia com vaga). O cliente pode responder qualquer horário, não só os exemplos.
- **whatsapp-lead-followup — resgate de lista de espera vencida (caso Stevan/Marcio):** o gatilho de cancelamento só cobria vaga que ABRE; dia lotado que simplesmente passa deixava a entrada 'esperando' pra sempre (Marcio desde 08/08). Agora: dia pedido passou há ≤2 dias e HOJE tem horário → oferta de resgate (sem expor contagem; `offered_start_time` fica nulo de propósito pra resposta cair na JuIA normal, não no sim/não); mais velho → 'expirado' em silêncio. 1º uso real: Stevan avisado 20/08 8h40, Marcio expirado.
- **whatsapp-lead-followup — nudge de disponibilidade reescrito:** "aqueles horários podem ter mudado" era vago e teve 0 respostas em dezenas de envios. Agora: relembra o serviço, próximo passo concreto ("me diz o dia") e benefício real (hora marcada, sem fila).
- **ju-ia-site — "11.00 horas" virava 00:00 (caso Luiz André, 19/08):** o fallback de hora sem minutos casava o "00" antes de "horas". Hora com PONTO agora vale quando precedida de "às/as" ou seguida de h/hs/horas; "dia 21.08" (data) continua fora. Testado com 11 casos.
- **whatsapp-webhook — pesquisa não engole mais reclamação (caso Vivian/Theo, 19/08):** "O Theo tá muito inquieto com o cabelo…😁" caiu como SATISFEITO pelo emoji e levou "Que ótimo saber disso!". Menção a problema/ajuste nunca vira satisfeito (push ⚠️ pro Juliano + conversa segue no fluxo normal); emoji positivo sozinho só vale em mensagem curta (≤40).
- **whatsapp-webhook — gentileza recebe gentileza (caso Frei, 19/08):** "Eu que agradeço" levava "Não entendi 🙂". Agradecimento curto com pesquisa pendente responde "Nós que agradecemos!" + lembrete acolhedor do 1/2.
- Deploy: ju-ia-site, whatsapp-webhook, whatsapp-lead-followup via CLI (PowerShell). Deno check: só os 2 erros `pitch` pré-existentes.
## 29.50.0 â€” Caso Luiz AndrÃ©: fidelidade "0 pontos" (cadastro duplicado) + trava de barba redundante

JuIA disse "0 pontos" pro Luiz AndrÃ© (cliente semanal) e fechou "Corte + Barba Express + Barboterapia c/ ozÃ´nio".
- **Causa da fidelidade**: perfil DUPLICADO por formato de telefone (5511... Ã— 11...) â€” a consulta pegava o perfil sem conta. **5 pares de duplicados unificados** (Luiz, Leonardo, Miguel, Carlos, Alessio; lÃ³gica do admin_merge_customers replicada, timeline anotada). Luiz creditado retroativamente (+2: visitas 18/07 e 06/08) â†’ 4 pontos. `v27_customer_for_booking` corrigida pra phone_match_key (comparava dÃ­gito exato â€” era quem alimentava timeline/pesquisa com o perfil errado).
- **Trava de serviÃ§os de barba** (`dropBarbaRedundante`, ju-ia-site): da famÃ­lia Barba Express / Barboterapia / Barboterapia c/ ozÃ´nio sÃ³ fica o mais completo, com aviso "tirei X pra vocÃª nÃ£o pagar em dobro" â€” mesmo padrÃ£o do corte+pezinho (v29.43.6). Testado em produÃ§Ã£o.
- Agendamento do Luiz (sex 21/08 11h) corrigido: Corte + Barboterapia c/ ozÃ´nio, R$90, 70 min.

## 29.49.0 â€” ConclusÃ£o de atendimento com Pix antecipado nÃ£o pergunta mais a forma de pagamento

Caso Frei Bartolomeu (19/08, ao concluir): jÃ¡ tinha pago adiantado no Pix (confirmado) e o modal de conclusÃ£o perguntou a forma de pagamento. Agora, quando `prepay_declared_at` + `prepay_confirmed_at` estÃ£o preenchidos, o modal abre com Pix prÃ©-selecionado e a nota "ðŸ’¸ Este cliente jÃ¡ pagou antecipado no Pix" â€” dÃ¡ pra trocar se preciso. Cache agenda.js â†’ 29.49.0. Playwright 26/26.
## 29.48.0 / 29.48.2 â€” Alarme EKASA monitorado pela nuvem Tuya (tuya-watch) + card "Alarme" no admin + prova de vida diÃ¡ria

Pedido do Juliano (19/08): os sensores a pilha do alarme morreram sem aviso e o alarme armado nÃ£o disparou. Sensores 433 MHz sÃ£o "mÃ£o Ãºnica" â€” nem a central nem a nuvem sabem se estÃ£o vivos; entÃ£o o monitoramento Ã© por **prova de vida** (Ãºltimo evento de cada sensor) + central offline + disparo + "Low Battery" no registro.

- **VÃ­nculo**: app Ekaza (OEM) NÃƒO completa autorizaÃ§Ã£o por QR (expira ao confirmar) em Western America nem Central Europe; compartilhar dispositivo entre Ekaza e Smart Life falha ("conta nÃ£o existe"). SoluÃ§Ã£o: central "Barbearia" migrada pro **app Smart Life** (Desligar sem apagar dados â†’ parear de novo; sensores e configuraÃ§Ãµes preservados) e Smart Life vinculado ao projeto Tuya "Barbearia do Ju" (Western America, Access ID e94sgxw7uhynpqvhjy57). Pastrana e ItararÃ© migram depois, uma por vez.
- **Function `tuya-watch`** (verify_jwt true + x-webhook-secret; cron `bdj-tuya-watch` */10 min): token HMAC, lista de centrais (`associated-users/devices`), shadow v2 (dp101 modo, dp103 alarme, dp116 Ãºltimo evento de sensor UTF-16BE, dp121 Ãºltima aÃ§Ã£o, dp120 lista de sensores), logs v1 (online/offline/DP reports) â†’ `alarm_hubs`, `alarm_events`, `alarm_alerts` + push (offline â‰¥12 min, sensor sem evento â‰¥ 8 dias, Low Battery, disparo). Segredos TUYA_* via `supabase secrets set --env-file`. Migration 123 (+ GRANTs 29.48.1 â€” de novo o 42501).
- **Admin**: card "Alarme" (modo atual, online, alertas) na visÃ£o geral; cache dashboard.js 29.48.0.
- TambÃ©m: NotificaÃ§Ã£o offline ligada no prÃ³prio app (paliativo independente do robÃ´).

## 29.47.0 â€” Pix antecipado pelo WhatsApp: chave + valor, comprovante â†’ push â†’ confirmaÃ§Ã£o (caso Frei Bartolomeu)

Primeiro cliente a pedir pra pagar adiantado pela JuIA (19/08, 13:08). TrÃªs buracos vistos ao vivo e fechados:
- **ju-ia-site**: pedido de chave Pix (ou "quero pagar adiantado") com agendamento futuro no nÃºmero verificado vira resposta determinÃ­stica: chave + **valor do agendamento** (serviÃ§o+produtos, dia/hora) + nome/instituiÃ§Ã£o. Pedido de celular/outra chave segue com o modelo. Migration 122: `phone_upcoming_bookings` devolve preÃ§os e `prepay_declared_at`.
- **whatsapp-webhook**: comprovante (PDF/imagem) ou "jÃ¡ paguei" â†’ marca `prepay_declared_at`/`prepay_key=picpay` (flag ðŸ’¸ na Agenda, igual ao site), responde "recebi, o Juliano confere", push ðŸ’¸ com valor. Foto sem legenda sÃ³ conta como comprovante se a chave foi passada nos Ãºltimos 60 min.
- **prepay-confirm**: texto do "Pagamento confirmado" revisado.

## 29.46.0 â€” CÃ¢mera IP: contador de sessÃµes na cadeira + card no admin

Pedido do Juliano (19/08): contar quantos clientes sentam na cadeira por dia (cÃ¢mera IP da barbearia) e comparar com os atendimentos concluÃ­dos â€” precauÃ§Ã£o pra quando entrar a segunda pessoa e rede pra atendimento esquecido.

- **CÃ¢mera**: Xiongmai XM533 (iCSee), 192.168.15.5, RTSP `/onvif2` (TCP) + ONVIF 8899 (PTZ usado pra enquadrar cadeira + bancada + espera).
- **Contador** (fora do repo, no notebook da barbearia): `C:\Users\julia\barbearia-camera\chair_counter.py` â€” YOLOv8n pessoa, zona da cadeira em `zone.json`, sessÃ£o = cadeira ocupada â‰¥ 6 min, fecha apÃ³s 2,5 min vazia; reflexo do espelho fica fora da zona. SÃ³ horÃ¡rios/contagem â€” nunca vÃ­deo ou rosto. Credenciais em `%USERPROFILE%\barbearia-camera.env`. Inicia com o Windows (Startup\BarbeariaContadorCadeira.vbs), instÃ¢ncia Ãºnica (porta 47123). Testado ao vivo: Juliano na cadeira = verde "NA CADEIRA", reflexo = ignorado.
- **Banco** (migration 121): `chair_sessions`, `camera_heartbeat`, RPC `camera_ingest(p_secret, p_event)` (segredo `camera_ingest_secret` no Vault, chamada com anon), RPC `chair_day_summary(date)`.
- **Admin**: card "Cadeira (cÃ¢mera)" na visÃ£o geral â€” sessÃµes Ã— registrados, estado do contador (heartbeat); fica em alerta quando diverge ou contador parado > 15 min. Cache: dashboard.js e style/admin-core 29.46.0.

## 29.45.0 â€” Plano do dia 19/08: cancelamento por nÃºmero, mensagens picadas, confirmaÃ§Ã£o com "como remarcar", balcÃ£o sem robÃ´ duplo, DM vazia repetida

RevisÃ£o diÃ¡ria da JuIA (regra de 18/08) + pedidos do Juliano no chat.

- **ju-ia-site** â€” caso Ricardo (19/08 08:08): "qual deles quer cancelar? 1/2" nÃ£o guardava estado; o "1" ia pro modelo, que repetia a lista, e o anti-repetiÃ§Ã£o soltava "me embolei". Agora `pending_cancel_options` guarda a lista; nÃºmero, horÃ¡rio citado ("o das 8h") ou "nÃ£o" sÃ£o tratados; "cancela o das 08 horas" com 2 agendamentos cancela direto quando o horÃ¡rio casa com um sÃ³; `cancelAsk` aceita "cancela o/esse/pra mim". Testado em produÃ§Ã£o (5599900011234, dados apagados).
- **whatsapp-webhook** â€” `juiaAwaitingAnswer` reconhece `pending_cancel_options`. Caso Leticia (18/08 18:59): trÃªs mensagens picadas, cada uma chegando depois do buffer anterior ter sido limpo â†’ as duas primeiras respostas descartadas como obsoletas (certo) e a terceira processada SOZINHA ("atÃ© um pouco antes dÃ¡ certo") â†’ JuIA perguntou perÃ­odo ignorando o "19h" dito antes. Agora, ao reivindicar o buffer, junta as mensagens de entrada sem resposta desde a Ãºltima saÃ­da (3 min), exceto nÃºmero solto.
- **booking-email** â€” confirmaÃ§Ã£o/alteraÃ§Ã£o pelo WhatsApp agora diz "Precisa remarcar ou cancelar? Ã‰ sÃ³ me responder aqui" + link de gerenciar (Ricardo nÃ£o achou como mudar e duplicou o agendamento; a pÃ¡gina meu-agendamento foi testada no celular e funciona).
- **satisfaction-dispatch / send-walkin-welcome** â€” robÃ´ redundante do balcÃ£o (2 RafaÃ©is, 18/08: boas-vindas 18:21 + comprovante 18:30). O convite "da prÃ³xima vez agende por aqui" virou uma linha dentro do comprovante (canal balcÃ£o); send-walkin-welcome Ã© no-op (sÃ³ envia com `force=1`).
- **meta-social-sync** â€” DM vazia (figurinha/mÃ­dia) repetida pela 3Âª vez do mesmo perfil (psid 1061649352872645: 06/08, 08/08, 19/08) Ã© arquivada como 'ignorado' sem push.
- Posts das 8h de 19/08 saÃ­ram sem arte (Gemini 500 Ã—2); arte refeita via `only_image` e aprovada no crivo.

## 29.43.8 â€” Card "ServiÃ§os feitos hoje" na visÃ£o geral

Pedido do Juliano (18/08): alÃ©m de "ConcluÃ­dos: 9 atendimentos", mostrar quantos SERVIÃ‡OS foram feitos no dia (corte + barba conta 2). Novo card entre "ConcluÃ­dos" e "Ticket mÃ©dio", alimentado pela mesma contagem que jÃ¡ sustentava "ServiÃ§os/cliente". Cache do dashboard.js bumpado pra 29.43.8 em todas as pÃ¡ginas do admin.

## 29.43.7 â€” Pagamento antecipado na confirmaÃ§Ã£o da JuIA (WhatsApp), de forma passiva

DecisÃ£o com o Juliano (18/08): nÃ£o perguntar "quer deixar pago?" (rodada extra e cheiro de desconfianÃ§a); a confirmaÃ§Ã£o do agendamento pelo WhatsApp ganha uma linha: *"Se preferir jÃ¡ deixar pago pelo Pix, Ã© sÃ³ me pedir a chave ðŸ˜‰"*. A JuIA jÃ¡ sabe passar a chave e avisar que o Juliano confere. Quando a allowlist do PagBank sair, vira link de pagamento na prÃ³pria confirmaÃ§Ã£o.

## 29.43.5 / 29.43.6 â€” RevisÃ£o de sexta a terÃ§a (14â€“18/08) + regra: corte jÃ¡ inclui o pezinho

**RevisÃ£o de todas as conversas do WhatsApp de 14 a 18/08** (pedido do Juliano depois do caso Adriano):
- **Cochicho "Ainda estou por aqui" depois de o Juliano se despedir** (Helder sex 12:59, Rafael Ferreira e Rafael sÃ¡b): a lista de encerramento do watchdog era curta demais. Regra invertida: sÃ³ cochicha se a Ãºltima frase do cliente parece precisar de resposta ("?" ou pedido); despedida/aviso/combinado nÃ£o reabrem conversa.
- **"cÃª pinta cabelo aÃ­?" / "qual o produto que passou no meu cabelo?" â†’ "seria um Corte?"**: "cabelo" nÃ£o Ã© corte quando a frase Ã© sobre coloraÃ§Ã£o/quÃ­mica ou produto. E a trava anti-promessa sÃ³ age em frases sobre horÃ¡rio (estava trocando "a pasta estÃ¡ disponÃ­vel por R$ 36" por "ela vou conferir").
- **Sillas**: a segunda mensagem ("4") viu "conflito" com o agendamento que a prÃ³pria conversa acabara de criar e perguntou "Ã© esse, Ã© novo, ou cancelar?". Agora: "JÃ¡ estÃ¡ reservado ðŸ˜Š".
- **Helo**: ao incluir sobrancelha + barba (60 min) o 10:45 nÃ£o cabia e a resposta era "acabou de ficar indisponÃ­vel" (falso). Agora: "nÃ£o fecha pra 60 min â€” o mais perto Ã© 10:30, serve?".
- **Achado sem correÃ§Ã£o minha**: os 6 que responderam "1" Ã  recuperaÃ§Ã£o de segunda (17/08) nÃ£o foram reconhecidos como pesquisa (RPC sem last_recovery_at) â€” outra janela corrigiu Ã s 18:26 e marcou satisfeitos, mas nenhum recebeu o pedido do Google. DecisÃ£o do Juliano: **nÃ£o reenviar** ("nÃ£o quero parecer chato"); a prÃ³xima visita cuida.

**Regra de negÃ³cio (v29.43.6)**: todo corte jÃ¡ inclui o pezinho â€” nunca somar nem cobrar os dois. Aplicado na JuIA (limpeza antes de disponibilidade e fechamento, no "de sempre", no acrÃ©scimo a agendamento e no prompt), no catÃ¡logo (descriÃ§Ã£o do Pezinho) e em marketing_memory. HistÃ³rico do Alfredo (22/07) corrigido para Corte de cabelo R$ 40.

## 29.43.4 â€” Caso Adriano: nÃºmero solto com pesquisa E convite pendentes agora pergunta, nÃ£o chuta

Em 17/08 o convite de retorno (10:00:03) e a recuperaÃ§Ã£o da pesquisa (10:00:04) saÃ­ram com 1 segundo de diferenÃ§a; o "1" do Adriano foi lido como convite (reservou 11/09) quando era da pesquisa. A fila Ãºnica (v29.43.0) jÃ¡ impede a colisÃ£o normal, mas dois crons no mesmo instante ainda podem sair antes de qualquer registro existir. Defesa em profundidade no webhook: se chega um 1/2/3 solto e hÃ¡ convite E pesquisa em aberto, a JuIA pergunta *"esse 1 Ã© da pesquisa ou do retorno?"* e guarda o nÃºmero; a palavra escolhida roteia o nÃºmero pra pergunta certa (mesmo mecanismo da citaÃ§Ã£o). Testado em produÃ§Ã£o com telefone fictÃ­cio: "1" â†’ pergunta; "pesquisa" â†’ satisfeito + pedido do Google, convite intacto, nenhuma reserva criada. Crons jÃ¡ estÃ£o 2h separados (convite 10h, recuperaÃ§Ã£o 12h).

## 29.43.3 â€” Bateria (parte 2, 31 cenÃ¡rios com agendamento existente): 3 correÃ§Ãµes, uma delas grave

- **BUG GRAVE**: a pergunta de conflito ("vocÃª jÃ¡ tem horÃ¡rio nesse dia â€” Ã© esse mesmo, Ã© um novo, ou cancelar o antigo?") reaproveitava o marcador de cancelamento, e um **"sim" seco cancelava o agendamento**. Agora a escolha Ã© explÃ­cita (1 mudar / 2 manter os dois / 3 cancelar, ou as palavras); "sim"/"nÃ£o" soltos repergunta com nÃºmeros e nÃ£o cancela nada.
- "quero fazer sobrancelha **tambÃ©m, alÃ©m do corte** que jÃ¡ marquei" caÃ­a como troca ("qual serviÃ§o no lugar?") ou como agendamento novo. Sinal de acrÃ©scimo + referÃªncia ao horÃ¡rio marcado = **incluir**: confirma "Corte + Sobrancelha (R$ 55, 40 min)" e grava o combo (nome composto, preÃ§o e duraÃ§Ã£o somados).
- "esqueci de pedir o **Ã³leo de barba**" abria o menu de serviÃ§os de barba â€” produto nÃ£o Ã© serviÃ§o.
- LiÃ§Ã£o de ferramenta: patch de cÃ³digo por  no bash come  das regex (vira byte 0x08, regex morta em silÃªncio). Sempre patch por arquivo .js.

## 29.43.2 â€” Bateria de testes da JuIA (123 cenÃ¡rios) + recuperaÃ§Ã£o de pesquisa direto ao Google + JuIA Social sem eco

**JuIA Social (v29.43.1)** â€” o comentÃ¡rio da Nicole no IG (16/08) recebeu **11 respostas iguais** ao longo de 35h. Causa: o robÃ´ enviava pra Meta ANTES de gravar em social_inbox e a leitura de "quais jÃ¡ respondi" Ã s vezes falhava em silÃªncio. Agora **reserva a linha primeiro** (unique em platform+kind+external_id â€” se jÃ¡ existe, pula), envia com try/catch por item, e sÃ³ entÃ£o atualiza. Reenvio automÃ¡tico nÃ£o existe mais. As 10 duplicatas foram apagadas pela Graph API (ferramenta temporÃ¡ria, removida).

**Bateria (tests/juia, 123 cenÃ¡rios stateless em produÃ§Ã£o): 0 alertas automÃ¡ticos, 6 problemas na leitura humana, todos corrigidos:**
- Menu "Mais procurados" atropelava resposta real ("atende mulher tambÃ©m?", "valor Ã© por pessoa?", "minha namorada terminou comigoâ€¦") â€” sÃ³ entra em pedido genÃ©rico de catÃ¡logo.
- "Para concluir, preciso de seu nome, seu WhatsApp, o serviÃ§o, a data, o horÃ¡rio." â€” virou frase de gente, e reconhece frustraÃ§Ã£o ("CADÃŠ VOCÃŠSâ€¦" â†’ "Calma que eu resolvo com vocÃª agora mesmo ðŸ™").
- "vaga de emprego" acionava o fluxo de agenda por causa de "vaga" â€” vai pro Juliano.
- "precisa agendar ou dÃ¡ pra chegar e esperar?" / "sÃ³ aparecendo?" â€” resposta fixa: hora marcada, sem fila, encaixe sÃ³ se sobrar vaga.
- "vocÃªs atendem hoje?" / "aberto ainda?" â€” agora abre com "Sim, hoje atendemos atÃ© 19h!" (ou fechado/jÃ¡ encerramos), aplicado no fim pra nenhum bloco sobrescrever.
- Datas em formato de sistema ("18/08/2026") â€” pÃ³s-processamento: hoje / amanhÃ£ / "sexta (21/08)".
- Prompt: inglÃªs/espanhol â†’ responde no idioma. Lista extra de horÃ¡rios ("tenho ainda: â€¦") limitada a 3.

**RecuperaÃ§Ã£o de pesquisa (survey-recovery, segunda 15h)** â€” pedido do Juliano: pedir avaliaÃ§Ã£o do Google pra todo mundo. Cliente com **2+ visitas concluÃ­das** (voltou = satisfeito) recebe o **link do Google direto** (rastreado, saÃ­da "1 = jÃ¡ avaliei"), sem passar pela pesquisa; cliente de 1 visita segue na pesquisa 1/2. Trava: sem novo pedido de Google em 30 dias. SimulaÃ§Ã£o de 24/08: Rafael Ferreira e Dorta â†’ Google; Sillas, Dirceu, Walisson â†’ pesquisa. Migration 120 (customer_completed_visits, customer_google_ask_recent). Achado registrado: o "follow-up de 24h" citado no comentÃ¡rio do survey-recovery **nÃ£o existe** â€” a rÃ©gua real Ã© dia 0 â†’ segunda â†’ opt-out.

## 29.44.0 â€” Central de ConteÃºdo: publicaÃ§Ã£o agendada (o post sai sozinho na hora marcada)

AtÃ© aqui, todo conteÃºdo com hora certa ("Reel Ã s 18h", "teaser sÃ¡bado 17h30") dependia de alguÃ©m clicar na Central naquele minuto â€” e o lembrete por push tem atraso de atÃ© 9 min e sÃ³ roda com o app aberto. MotivaÃ§Ã£o concreta de 18/08: dois Reels de Resultado reais (degradÃª e texturizado) aprovados pelo Juliano no chat com "prossegue quando for a hora", pra sair terÃ§a 18h e sexta 18h.

- **Status novo `agendado` + coluna `scheduled_for`** em `content_posts` (migration 120; o check de status foi ampliado). Fluxo: rascunho â†’ â° Agendar â†’ agendado â†’ (cron) aprovado â†’ publicado. Nunca se publica `rascunho` automaticamente â€” sÃ³ o que foi agendado de propÃ³sito.
- **Function `content-publish-scheduled`** (verify_jwt=true; o pg_cron manda o anon key como Bearer e o `x-webhook-secret` do Vault, que Ã© o que o cÃ³digo confere). Cron `bdj-content-publish-scheduled` a cada 5 min. Espelha o fluxo de publicaÃ§Ã£o dos botÃµes (Reel/foto/carrossel/Story do Instagram, vÃ­deo/foto/texto do Facebook, Status do WhatsApp com lista explÃ­cita de contatos). Trava atÃ´mica agendadoâ†’aprovado; falha volta pra `rascunho` com `context.schedule_error` e push âŒ; sucesso dÃ¡ push âœ…. Publica os vencidos em paralelo em segundo plano (Reel leva ~1-2 min na Meta).
- **HorÃ¡rio de silÃªncio respeitado**: Status do WhatsApp agendado pra 20h-8h fica esperando e sai na primeira rodada depois das 8h. Facebook/Instagram publicam na hora agendada.
- **Central**: card ganha "â° Agendar" (dia/mÃªs hora:minuto, horÃ¡rio local) e, quando agendado, badge com a hora, "Publicar agora" e "Cancelar agendamento". Rejeitar tambÃ©m limpa agendamento. Os botÃµes de publicar (`content-publish-meta`/`-whatsapp`) aceitam card `agendado` â€” o clique vence o agendamento.

Testado: rota do cron respondendo 202 com a autenticaÃ§Ã£o real do Vault; 6 rascunhos agendados (3 pra 18/08 18h, 3 pra 21/08 18h) â€” o primeiro lote Ã© o teste em produÃ§Ã£o.

## 29.43.0 â€” JuIA: fecha mais, incomoda menos (revisÃ£o das conversas de 15 a 18/08)

Pedido do Juliano em 18/08: revisar todas as interaÃ§Ãµes da JuIA desde sÃ¡bado e corrigir na raiz. SÃ¡bado 15/08 tiveram 12 conversas de cliente novo e **3 fecharam** â€” pelo menos 5 das perdidas foram culpa direta da JuIA. Cada correÃ§Ã£o abaixo tem o caso real que a motivou.

**Perda de agendamento (ju-ia-site):**
- **"Deixa eu conferir a agenda certinho antes de confirmar"** (Bruno esperou 2h30, Luis idem): era o prefixo da trava anti-promessa. O cliente lia como "ela vai voltar com a resposta". Agora a frase nomeia o que falta e devolve a bola: *"Qual serviÃ§o vocÃª tem interesse? Assim jÃ¡ confiroâ€¦"*.
- **"Barba e cabelo" virava sÃ³ corte** (Luis): a pergunta "qual barba?" era montada e, na sequÃªncia, o bloco de retomada forÃ§ava `availability` por cima â€” listava horÃ¡rios sÃ³ de corte e a barba sumia. A pergunta da barba agora tem prioridade (`!bareBarbaAsk` em trÃªs pontos) e jÃ¡ avisa que o horÃ¡rio vem em seguida.
- **10 horÃ¡rios numa linha** (Luis recebeu 10, Aline 8; nenhum respondeu): acima de 4 vira faixa + 4 exemplos espalhados.
- **"Apenas cabelo" gerava a pergunta "seria um Corte de cabelo? ou Corte + Lavagem?"** (Bruno, mais uma rodada): assume Corte de cabelo e segue pro horÃ¡rio, com nota de uma linha sobre a lavagem.
- **"Mas deixa, qlq coisa vou semana que vem"** recebia a lista de horÃ¡rios de novo (Bruno, papagaio): sinal de adiamento agora responde com simpatia e abre a porta pra reservar na semana que vem.
- **"O seu de sempre" pegava o complemento, nÃ£o o serviÃ§o** (Alfredo, 17/08: histÃ³rico "Corte de cabelo + Pezinho" â†’ assumiu Pezinho, 10 min, e reservou sem perguntar). O casador de nome escolhia o componente de nome mais parecido em tamanho. Agora quebra o histÃ³rico nos componentes e assume todos; se sÃ³ sobrar complemento (â‰¤15 min), pergunta.
- **"Oi, ðŸ¤“!"**: nome do WhatsApp sem letra nÃ£o Ã© nome. Ignorado.

**RedundÃ¢ncia e ruÃ­do (webhook + robÃ´s):**
- **Resposta em dobro** (Guilherme Silva, 17/08, 18:43: trÃªs mensagens picadas â†’ duas respostas em 6s): a checagem "o cliente escreveu de novo?" sÃ³ existia nas respostas curtas; a resposta principal da IA saÃ­a sem ela. Agora vale pra todas.
- **"Recebi sua foto, mas nÃ£o consegui identificarâ€¦"** saiu 5x pro mesmo nÃºmero e, no caso Guilherme (18/08, 09:19), entre o "1" da pesquisa e o agradecimento. Suprimido quando o cliente mandou texto nos Ãºltimos 2 min ou quando o mesmo aviso saiu hÃ¡ menos de 30 min.
- **ConfirmaÃ§Ã£o de presenÃ§a 3h depois de marcar** (Nuno: marcou 16:37 pra amanhÃ£, "confirma?" Ã s 19:45; Alfredo disse "amanhÃ£ tÃ´ aÃ­" e levou o pedido Ã s 8h). RPC `bookings_due_for_confirmation_request` sÃ³ devolve agendamentos feitos com **â‰¥ 36h de antecedÃªncia** â€” o pedido nunca chega menos de 12h depois de o cliente marcar.
- **Convite de retorno "daqui a 4 semanas" pra quem vem toda semana** (Luiz AndrÃ©: cadÃªncia real de ~9 dias, convite pra 11/09, respondeu "agora nÃ£o"). Nova funÃ§Ã£o `customer_visit_cadence_days` (mediana dos intervalos, telefone normalizado â€” o mesmo cliente aparecia com e sem o 55 e o histÃ³rico ficava partido); o convite mira 1/2/3/4 semanas conforme a cadÃªncia.
- **Fila Ãºnica de perguntas numeradas** (`juia_pending_numeric_question`): pesquisa (1/2), recuperaÃ§Ã£o de pesquisa, convite (1/2/3), confirmaÃ§Ã£o (1/2/3) e follow-up 2 de lead (1-4) agora conferem, antes de enviar, se o telefone jÃ¡ tem outra pergunta sem resposta. Se tem, esperam o prÃ³ximo cron. Ã‰ a regra do Juliano: "nÃ£o tem como mandar outra mensagem enquanto o cliente nÃ£o responder a pesquisa" â€” o "1" respondia a pergunta errada.

Migration 119. Deploy pela CLI (7 functions, verify_jwt preservado). Testado em produÃ§Ã£o com telefones fictÃ­cios (5511990000801/802) nos 5 cenÃ¡rios â€” barba+cabelo, listagem, adiamento, "de sempre" com combo, cabelo solto â€” e dados apagados depois. Deno check: 0 erros novos (os 2 `pitch` jÃ¡ existiam).

**Ainda em aberto**: o modelo Ã s vezes escreve a data no formato de sistema ("para 18/08/2026") apesar do prompt; a lista de horÃ¡rios da resposta ao "horÃ¡rio X ocupado" ainda pode chegar a 8 opÃ§Ãµes.

## 29.42.0 â€” O Google matou o Q&A do perfil, e o conteÃºdo mudou de endereÃ§o

RecomendaÃ§Ã£o minha que envelheceu mal: mandei publicar 12 perguntas no Q&A do Perfil da Empresa. **O Google descontinuou o recurso em 03/11/2025** e os tÃ³picos pÃºblicos sumiram a partir de dezembro â€” confirmado no changelog da prÃ³pria API. NÃ£o existe mais onde publicar. O Google passou a gerar resposta por IA puxando do site, entÃ£o o conteÃºdo continua valendo; mudou o lugar dele.

- **`perguntas-frequentes.html`** com 23 perguntas agrupadas por tema (preÃ§o, agendamento, localizaÃ§Ã£o, barba e quÃ­mica, produtos), `FAQPage` batendo 23/23 com o visÃ­vel. Ã‰ superconjunto do FAQ da home â€” que continua com as 12 curtas, porque ali a funÃ§Ã£o Ã© conversÃ£o, nÃ£o indexaÃ§Ã£o. Linkada da home, do hub de serviÃ§os e no sitemap.
- Ressalva honesta: **isso nÃ£o gera o acordeÃ£o de FAQ no resultado de busca.** O Google restringiu esse rich result a sites de governo e saÃºde em 2023. O valor aqui Ã© ser a fonte densa de onde a IA puxa quando alguÃ©m pergunta algo sobre a barbearia.
- **CorreÃ§Ã£o de bug da 29.40.0:** `guia-barba-masculina.html` nunca entrou no sitemap. O script casava um formato de linha que nÃ£o existe no arquivo e **falhou em silÃªncio** â€” imprimiu "adicionada" sem ter adicionado. A pÃ¡gina estava no ar e linkada, mas invisÃ­vel pro sitemap por um dia. Agora 51 URLs.

**Registro do Google Business Profile nesta rodada:** 10/10 serviÃ§os personalizados criados com preÃ§o Fixo (o seletor grava "A partir de" mesmo quando se clica em "Fixo" â€” sÃ³ o teclado acerta), endereÃ§o pÃºblico corrigido com a saÃ­da do " - 1" que divergia do site e do schema, 4 fotos de resultado sem rosto e 1 postagem com botÃ£o "Reservar" e link com UTM (`utm_medium=gbp`, para separar post de trÃ¡fego de Maps no GA4).

**Categorias secundÃ¡rias ficaram vazias de propÃ³sito.** "Barbeiro" e "SalÃ£o de beleza masculino" nÃ£o existem na lista do Google em portuguÃªs; as alternativas eram falsas (Escola de barbearia, Loja de produtos para barbeiro) ou mais genÃ©ricas que a principal (SalÃ£o de Beleza). Categoria falsa Ã© pior que categoria ausente â€” se uma auditoria futura apontar isso como pendÃªncia, estÃ¡ errada.

## 29.41.0 â€” Quatro artigos com referÃªncia real, no territÃ³rio que sÃ³ nÃ³s temos

Os quatro que ocupam o terreno que nenhum concorrente de BraganÃ§a consegue disputar, porque exigem as duas formaÃ§Ãµes. **Todas as referÃªncias foram levantadas na fonte** â€” PubMed e canais oficiais da ANVISA â€” com DOI ou link direto, e nenhuma foi escrita de memÃ³ria.

- **`blog-barba-falhada.html`** â€” por que a barba falha. Sustentado em dois trabalhos: o do *FASEB Journal* que cultivou folÃ­culos humanos e mostrou que folÃ­culos **geneticamente idÃªnticos** respondem de formas diferentes ao mesmo androgÃªnio conforme a regiÃ£o ([10.1096/fj.201700260RR](https://doi.org/10.1096/fj.201700260RR)), e o do *J Invest Dermatol* sobre regulaÃ§Ã£o local da sensibilidade androgÃªnica ([10.1038/sj.jid.5700883](https://doi.org/10.1038/sj.jid.5700883)). ConclusÃ£o que dÃ¡ para dizer em voz alta na cadeira: a distribuiÃ§Ã£o da barba foi decidida antes de o cliente ter opiniÃ£o sobre ela â€” nÃ£o Ã© falta de cuidado.
- **`blog-pigmentacao-barba-como-funciona.html`** â€” o dado forte Ã© de 2025: sÃ©rie de casos na *Contact Dermatitis* com produto **rotulado como "livre de PPD"** que, em anÃ¡lise quÃ­mica, continha PPD acima do limite ([10.1111/cod.14813](https://doi.org/10.1111/cod.14813)). Somado ao levantamento do NACDG, em que 5,6% dos testados reagiram Ã  PPD ([10.1016/j.jaad.2020.10.086](https://doi.org/10.1016/j.jaad.2020.10.086)). Ã‰ o que justifica o teste 48h antes deixar de ser formalidade.
- **`blog-platinado-masculino-o-que-acontece-com-o-fio.html`** â€” explica por que cabelo descolorido fica elÃ¡stico e quebra, com o estudo de microscopia eletrÃ´nica e proteÃ´mica redox que mediu a conversÃ£o de pontes dissulfeto de cistina em **Ã¡cido cisteico** ([10.1111/ics.12495](https://doi.org/10.1111/ics.12495)).
- **`blog-quimica-capilar-masculina-seguranca.html`** â€” o mais valioso comercialmente, porque Ã© local e regulatÃ³rio. Baseado no **Informe de SeguranÃ§a GGMON nÂº 03/2025 da ANVISA** (07/07/2025), buscado direto na fonte: formol Ã© permitido sÃ³ como conservante atÃ© 0,2% (concentraÃ§Ã£o em que **nÃ£o alisa**), e **o Ã¡cido glioxÃ­lico tambÃ©m estÃ¡ entre os nÃ£o permitidos para alisamento** â€” o que derruba o argumento de "alternativa segura ao formol" que ainda se vende por aÃ­.

Os quatro entraram no sitemap, nos cards e no schema do blog, e a **pilar da barba teve seus ganchos de texto convertidos em links** agora que os artigos existem. CTAs usando `?servico=` com slug validado contra o catÃ¡logo real.

Corrigido tambÃ©m um teste **flaky**: `service_selected` falhava de forma intermitente porque o hook instalado via `evaluate()` morria no reload que o service worker dispara sozinho. Passou a usar `addInitScript` + `sessionStorage`, que sobrevivem Ã  navegaÃ§Ã£o. Rodado 3x isolado e na suÃ­te completa.

`npm test`: 17 unit + 46 e2e. 0 JSON-LD invÃ¡lido, 0 links quebrados.

## 29.40.0 â€” Guia da barba como pÃ¡gina pilar, e o Wi-Fi/Pix sai da home

- **`/guia-barba-masculina.html`**: a pÃ¡gina pilar que faltava. Os 7 artigos de barba existiam soltos â€” bons, mas sem hierarquia, cada um competindo sozinho. Agora o guia organiza o assunto inteiro (formato, falhas, encravado, irritaÃ§Ã£o, produtos, manutenÃ§Ã£o), aponta para cada artigo **e** para os 5 serviÃ§os de barba, e os 7 artigos apontam de volta. Isso Ã© o que transforma uma pilha de posts em autoridade temÃ¡tica. Com `Article` schema, FAQ de 4 perguntas e fontes citadas (SBD e DermNet).
- **`/na-barbearia.html`**: Wi-Fi e Pix saÃ­ram da home. Ocupavam uma dobra inteira entre o visitante vindo do Google e a decisÃ£o de agendar, sendo que sÃ£o utilidades de quem **jÃ¡ estÃ¡ na cadeira**. âš ï¸ **Mudei de destino em relaÃ§Ã£o ao que eu mesmo tinha recomendado**: a auditoria dizia mandar pra `/cliente.html`, mas aquela Ã© a "Minha Ãrea", que pede WhatsApp e consulta fidelidade â€” enterrar a senha do Wi-Fi atrÃ¡s de um formulÃ¡rio piora a vida de quem estÃ¡ sentado esperando. A pÃ¡gina nova Ã© `noindex` (nÃ£o tem intenÃ§Ã£o de busca) e serve para QR Code na parede. Fica linkada na home por um card discreto.
- **`og:title` e `twitter:title` do blog** ainda diziam "Centro de Conhecimento" â€” o rewrite da 29.37.0 trocou sÃ³ a tag `<title>`. Corrigido, e a pilar entrou no `CreativeWorkSeries` e no `ItemList` da pÃ¡gina.

`npm test`: 17 unit + 46 e2e. 0 JSON-LD invÃ¡lido, 0 links quebrados.

## 29.39.0 â€” Popup que nÃ£o bloqueia, prÃ©-seleÃ§Ã£o de serviÃ§o, avaliaÃ§Ãµes reais e FAQ

- **O popup de boas-vindas parou de brigar com o prÃ³prio objetivo.** Era um modal com fundo escuro cobrindo a tela, aberto 1,2s depois do load, e **interceptava o clique no CTA do hero** de quem chegava pela primeira vez â€” um popup que existe pra incentivar agendamento e bloqueia o agendamento se anula. Virou card ancorado embaixo, sem fundo bloqueante, que **sÃ³ aparece depois que a pessoa rola alÃ©m do hero sem ter clicado em agendar**: pega justamente quem nÃ£o converteu de primeira. Quem clica no CTA antes de rolar nunca vÃª. Mantido o limite de 1 exibiÃ§Ã£o a cada 30 dias.
- **`?servico=slug` prÃ©-seleciona o serviÃ§o.** As 24 pÃ¡ginas de serviÃ§o agora levam pra `/agendar/?servico=...` e o cliente cai no catÃ¡logo com o item jÃ¡ no carrinho, em vez de procurar na lista o que acabou de ler. Casa por slug do `data-name` (sem acento), pra nÃ£o depender de o link repetir nome com pontuaÃ§Ã£o e maiÃºsculas. âš ï¸ **Bug pego em teste:** o service worker recarrega a pÃ¡gina no `controllerchange` e o carrinho persiste â€” sem guarda, a segunda carga somava o mesmo serviÃ§o de novo e o cliente via *2x Barboterapia, R$ 80* sem ter pedido. A prÃ©-seleÃ§Ã£o Ã© idempotente agora.
- **Bloco de 6 avaliaÃ§Ãµes reais na home.** TranscriÃ§Ãµes literais de avaliaÃ§Ãµes pÃºblicas do Google, com nome. Antes a Ãºnica prova social era o rating-strip com 2 frases e um link que mandava o visitante **pra fora do site** bem na hora da decisÃ£o. O link continua, como verificaÃ§Ã£o. **Sem `AggregateRating` no schema** â€” a nota Ã© do Google, autodeclarar violaria as diretrizes.
- **FAQ da home foi de 8 para 12 perguntas**, com preÃ§o, duraÃ§Ã£o, sÃ¡bado e crianÃ§as â€” as que tÃªm busca real. VisÃ­vel e schema batendo item a item.
- **NÃ£o mexi na "canibalizaÃ§Ã£o" da barboterapia.** Reavaliando com o cÃ³digo na mÃ£o: das 10 menÃ§Ãµes na home, sÃ³ ~4 sÃ£o texto visÃ­vel â€” o resto Ã© meta e schema, todas legÃ­timas. Tirar a palavra da home enfraqueceria a home sem fortalecer a pÃ¡gina de serviÃ§o. O que resolve Ã© link interno com Ã¢ncora comercial, que jÃ¡ foi feito no blog e agora tambÃ©m no card da home.

âš ï¸ **Achado ainda em aberto:** `corte infantil` e `raspar a cabeÃ§a` tÃªm pÃ¡gina prÃ³pria mas **nÃ£o existem como item no catÃ¡logo de agendamento** (20 itens para 24 pÃ¡ginas). O cliente lÃª sobre e acaba marcando "Corte de cabelo" â€” mesmo preÃ§o e duraÃ§Ã£o, mas a agenda nÃ£o registra o que ele veio fazer.

`npm test`: 17 unit + 46 e2e.

## 29.38.1 â€” A instrumentaÃ§Ã£o existia e nÃ£o chegava: tag no GTM, cache e cobertura

A v29.38.0 instrumentou o cÃ³digo, mas ao verificar no site publicado o evento **nÃ£o apareceu**. TrÃªs causas independentes, todas encontradas na conferÃªncia:

- **O GTM nÃ£o tinha tag pra quase nada.** O container tinha 3 tags: a do Google, `booking_confirmed` e `clique_whatsapp`. Todo o resto que o site empurra pro dataLayer hÃ¡ meses â€” `date_selected`, `time_selected`, `upsell_service_added`, `product_added_booking`, `checkout_opened`, `pix_*`, `gift_*` â€” era descartado. Criado o acionador **"Eventos do funil (dataLayer)"** (evento personalizado com regex) e a tag **"GA4 - Eventos do funil"**, que encaminha `{{Event}}` com `value` e `currency`. Publicado como VersÃ£o 12. `booking_confirmed` ficou **de fora do regex de propÃ³sito**: jÃ¡ tem tag prÃ³pria e entraria duplicado.
- **Cache serviu o arquivo velho.** Os scripts sÃ£o versionados por query string e eu editei `script.js` e `service-cart-v22-5.js` **sem bumpar o `?v=`** â€” navegador e service worker continuavam entregando a versÃ£o anterior, e o evento novo simplesmente nÃ£o existia na pÃ¡gina. Ambos foram para `?v=29.38.0`. Ã‰ o tipo de erro que nÃ£o aparece em teste local, sÃ³ no site publicado.
- **O listener cobria 3 pÃ¡ginas de 37.** `clique_agendamento` nasceu dentro do `script.js`, que sÃ³ Ã© carregado em `index.html`, `produtos.html` e `agendar/index.html`. **As 34 pÃ¡ginas de serviÃ§o, blog e o hub â€” exatamente o trÃ¡fego de SEO que queremos medir â€” nÃ£o disparavam nada.** ExtraÃ­do para `funnel-events-v29.js`, com guarda contra dupla inclusÃ£o, e incluÃ­do em todas as pÃ¡ginas pÃºblicas.

TrÃªs testes novos em `analytics.spec.js` cobrem o CTA a partir de pÃ¡gina de serviÃ§o, do hub e de artigo do blog â€” que era o buraco. `npm test`: 17 unit + 40 e2e.

âš ï¸ Segue pendente a decisÃ£o sobre o popup de boas-vindas, que intercepta o clique no CTA do hero para quem chega pela primeira vez.

## 29.38.0 â€” O funil tinha fim mas nÃ£o tinha comeÃ§o: instrumentaÃ§Ã£o da entrada

Antes de mexer, fui olhar o que jÃ¡ existia no GA4 â€” e o quadro era diferente do que eu tinha suposto na auditoria.

**O que jÃ¡ estava certo:** o `agenda-v15.js` jÃ¡ empurra um funil rico pro dataLayer (`date_selected`, `time_selected`, `upsell_service_added`, `product_added_booking`, `checkout_opened`, `pix_*`, `booking_confirmed`) e o `vale-presente-v29.js` faz o mesmo pros vales. `booking_confirmed` e `clique_whatsapp` chegam no GA4 e estÃ£o marcados como eventos principais.

**O que estava quebrado:**

- **`clique_agendamento` estava declarado como evento principal no GA4 e nenhuma linha do site disparava.** TÃ­nhamos o fim do funil sem o comeÃ§o â€” e sem o comeÃ§o nÃ£o existe taxa de conversÃ£o, sÃ³ contagem de agendamentos. Agora um listener delegado no `script.js` dispara na entrada do funil, com `origem_pagina` e `posicao_cta`. **Cliques feitos de dentro de `/agendar/` sÃ£o ignorados de propÃ³sito**: contar "Ir direto Ã  agenda" como entrada inflaria o topo e faria a taxa parecer pior do que Ã©.
- **A etapa 1 (escolher o serviÃ§o) era invisÃ­vel.** O `service-cart-v22-5.js` nÃ£o tinha `fire()` nenhum: existia `upsell_service_added` para os adicionais, mas nada para a escolha principal. Agora dispara `service_selected` (nome e valor) e `checkout_step_horario` (serviÃ§os, total e quantidade) antes do redirect.
- **Teste que faltava.** `clique_agendamento` ficou morto sabe-se lÃ¡ quanto tempo porque nada verificava. `tests/e2e/analytics.spec.js` cobre os quatro casos, incluindo o negativo (clique interno **nÃ£o** conta como entrada).

âš ï¸ **Achado de conversÃ£o, ainda nÃ£o resolvido:** o teste do CTA da home sÃ³ passou depois de fechar o popup de boas-vindas â€” ele aparece 1,2s apÃ³s o load e **intercepta o clique no botÃ£o principal do hero** para quem chega pela primeira vez. Ou seja, o visitante novo vindo do Google encontra um popup entre ele e o agendamento. Precisa de decisÃ£o: adiar, reposicionar ou remover.

âš ï¸ **Falta a metade do GTM.** Todos esses eventos vivem no dataLayer; quem os leva pro GA4 Ã© a tag no GTM, e hoje sÃ³ existe tag para `booking_confirmed` e `clique_whatsapp`. Sem isso, o que foi instrumentado aqui continua sendo descartado.

## 29.37.0 â€” Hero com preÃ§o e garantia, pÃ¡gina-mÃ£e de corte, e titles reescritos

Segunda rodada da auditoria. O Juliano apontou, com razÃ£o, que a primeira sÃ³ tinha atacado a camada estrutural. Conferindo o resto item a item, **mais coisas jÃ¡ estavam prontas**: `Article` schema com `datePublished`/`dateModified` **e** as datas visÃ­veis no HTML dos posts, que eu tinha listado como pendÃªncia.

- **Hero da home refeito.** TrÃªs informaÃ§Ãµes que decidem a escolha estavam abaixo da dobra: o preÃ§o (R$ 40), a garantia de ajuste em 7 dias e o fato de o barbeiro tambÃ©m ser farmacÃªutico. Subiram. E os **4 CTAs de peso igual viraram 2** (Agendar + WhatsApp) â€” "Ver produtos" e "Blog" saÃ­ram do hero porque competiam com o agendamento e jÃ¡ estÃ£o linkados em card prÃ³prio e em seÃ§Ã£o dedicada mais abaixo, entÃ£o nada ficou inacessÃ­vel.
- **`servico-corte-masculino.html`**, a Ãºnica lacuna real de pÃ¡gina que sobrou. NÃ£o Ã© mais uma pÃ¡gina de corte: Ã© a **mÃ£e** das cinco que jÃ¡ existiam (degradÃª, social, infantil, raspar, corte+lavagem), com o conteÃºdo que nenhuma delas tinha â€” o que estÃ¡ incluso nos R$ 40, como pedir o corte sem errar, de quanto em quanto tempo voltar. Sem isso seria sÃ³ canibalizar o degradÃª, que Ã© o erro que a prÃ³pria auditoria mandava evitar.
- **Titles e metas reescritos** em home, blog, produtos e sobre-o-juliano, nos trÃªs lugares de cada uma (`<title>`, `og:title`, `twitter:title` e as descriptions). Todos dentro do limite. O da home passou a carregar "Centro" e "Hora Marcada"; o do blog trocou "Centro de Conhecimento" â€” nome bonito, zero busca â€” por "Cuidados com Barba e Cabelo Masculino".
- **`VERSAO.md` estava em 29.26.0** enquanto o CHANGELOG ia em 29.35.0. Nenhum arquivo lÃª esse `.md` (sÃ³ documenta), entÃ£o foi sincronizado. âš ï¸ **`admin-version.json` NÃƒO foi tocado**: os `29.12.0` dele e da constante `ADMIN_VERSION` casam de propÃ³sito â€” Ã© a comparaÃ§Ã£o que decide se o painel aberto hÃ¡ horas se recarrega sozinho. Mexer ali sem bumpar os dois juntos forÃ§aria reload em cima de atendimento.

Validado: 17 unit + 33 e2e passando, 0 JSON-LD invÃ¡lido em 26 pÃ¡ginas, 0 links quebrados, 0 Ã³rfÃ£s, 24/24 no `ItemList` do hub.

## 29.36.0 â€” Seis pÃ¡ginas de serviÃ§o estavam Ã³rfÃ£s, e o blog nÃ£o levava a lugar nenhum

Auditoria de SEO feita com trÃªs modelos (GPT, Gemini e Claude). Boa parte do que as trÃªs apontaram **jÃ¡ estava feito** â€” schema `LocalBusiness`+`HairSalon` correto, `fetchpriority`/`poster`/`lazy`/`width`/`height` nas imagens, 23 pÃ¡ginas de serviÃ§o com preÃ§o, FAQ e autor. O que sobrou depois de conferir arquivo por arquivo foi isto:

- **6 pÃ¡ginas de serviÃ§o nÃ£o recebiam um Ãºnico link interno**: `barboterapia-ozonio` (R$ 50), `corte-mais-lavagem` (R$ 50), `aparacao-corporal` (R$ 120), `pigmentacao-capilar` (R$ 50), `raspar-a-cabeca` e `freestyle-risquinho`. Existiam, estavam no sitemap e ninguÃ©m apontava pra elas â€” o Google chega pelo sitemap, mas nÃ£o distribui autoridade pra pÃ¡gina que nada linka. Outras 8 tinham sÃ³ 1 link.
- **`servicos.html` era um stub de redirect `noindex` com zero links de entrada.** Virou o hub real: `CollectionPage` + `ItemList` com os 23 serviÃ§os agrupados por categoria, preÃ§o e duraÃ§Ã£o. Resolve as Ã³rfÃ£s e cria uma pÃ¡gina indexÃ¡vel para "serviÃ§os de barbearia em BraganÃ§a Paulista", sem precisar de landing page por bairro â€” que seria doorway page.
- **8 dos 12 artigos do blog nÃ£o linkavam pra nenhuma pÃ¡gina de serviÃ§o.** Um artigo sobre barba encravada que nÃ£o leva Ã  barboterapia Ã© trÃ¡fego que nÃ£o vira cliente. Cada um recebeu o link do serviÃ§o correspondente, com Ã¢ncora comercial.
- **`/index.html` â†’ `/` em 29 links internos.** Duas URLs pra mesma pÃ¡gina dividem o link equity da pÃ¡gina mais importante do site.
- **`geo` no schema da home.** As coordenadas foram tiradas do place real do Google Maps (`-22.9540382, -46.5420126`) â€” as que dois dos modelos "estimaram" erravam ~150 m.
- **Bug pego de raspÃ£o na verificaÃ§Ã£o de links:** `/agendar/horario/` linkava `produtos.html` em caminho relativo, resolvendo pra `/agendar/horario/produtos.html`. Link quebrado, na etapa final do funil, onde Ã© oferecido o upsell de produto. Agora Ã© `/produtos.html`.

âš ï¸ **Um alarme falso que vale registrar:** a auditoria inicial marcou como P0 um possÃ­vel loop entre `/agendar/#servicos` e `/agendar/horario/`. NÃ£o existe â€” `/agendar/` renderiza o catÃ¡logo pra carrinho vazio e `/agendar/horario/` tem estado vazio tratado ("Nenhum serviÃ§o selecionado"), o que o `routes.spec.js` jÃ¡ cobria. O erro veio de auditar por rastreamento externo em vez de ler o cÃ³digo.

Validado com `npm test`: 17 unit + 33 e2e passando, 0 links internos quebrados, 0 pÃ¡ginas de serviÃ§o Ã³rfÃ£s.

## 29.35.0 â€” ReprecificaÃ§Ã£o com base no preÃ§o pÃºblico do fabricante, e a fibra vira serviÃ§o

Pergunta do Juliano que derrubou a primeira proposta: *"o cliente vai no mercado livre e compra tudo pelo preÃ§o que eu tambÃ©m compro"*. Ele estava certo â€” e a proposta anterior, de subir os cosmÃ©ticos, colocaria vÃ¡rios itens 30â€“45% acima do que o cliente acha em trÃªs toques no celular.

- **A regra passou a ser assimÃ©trica**, porque os dois grupos nÃ£o sÃ£o comparÃ¡veis. **CosmÃ©tico Ã© conferÃ­vel**: preÃ§o = referÃªncia pÃºblica do fabricante + prÃªmio de conveniÃªncia (leva agora, sem frete), nunca acima de ~15%. **Bebida nÃ£o Ã© conferÃ­vel**: ninguÃ©m compara preÃ§o de energÃ©tico com sede, sentado na cadeira â€” margem alvo ~50%, referÃªncia Ã© o mercado da esquina. Em resumo: **subir onde ninguÃ©m compara, segurar onde todo mundo compara.**
- **CorreÃ§Ãµes que sÃ³ apareceram com a pesquisa** (sharkbarber.com.br vende direto ao consumidor, com 10% no Pix): fibra capilar **90 â†’ 85** (estava 37% acima do fabricante, 52% acima do Pix dele; R$ 85 equivale ao preÃ§o do site + frete, entÃ£o Ã© defensÃ¡vel em voz alta); **pomada em pÃ³ 35 â†’ 38** e **Caspbell 42,99 â†’ 48**, que estavam *abaixo* do mercado â€” dinheiro deixado na mesa; **Pasta Matte 34 â†’ 36**, abaixo do prÃ³prio fabricante.
- **Leave-in 44,99 â†’ 33 Ã© alerta de COMPRA, nÃ£o de preÃ§o.** O custo (26,90) Ã© praticamente o que o consumidor paga no Pix do fabricante (26,91): nÃ£o hÃ¡ espaÃ§o de revenda. E-mail enviado Ã  Shark Barber pedindo tabela de atacado do item, que nÃ£o aparece na pÃ¡gina de atacado deles.
- **ServiÃ§o novo: "AplicaÃ§Ã£o de Fibra Capilar", R$ 30 / 15 min.** A jogada para vender *mais* fibra, nÃ£o mais caro: serviÃ§o nÃ£o tem pÃ¡gina no Mercado Livre para comparar, o insumo por aplicaÃ§Ã£o custa ~R$ 2,50 (pote de 25g rende ~15) e quem gosta do resultado leva o pote. Deixa de ser uma venda de R$ 85 uma vez e vira recorrÃªncia.
- Margem mÃ©dia subiu de 45% para **50%**, com quase todo o ganho vindo de onde o cliente nÃ£o compara.
- **Sincronizados os trÃªs lugares onde o preÃ§o vive**: tabela `products`, `products-catalog-v1.js` e `produtos.html`. âš ï¸ Bug pego na conferÃªncia final: o script de sincronizaÃ§Ã£o gravou `data-price="8,00"` (vÃ­rgula, locale pt-BR do PowerShell) em 13 produtos â€” `Number("8,00")` Ã© `NaN`, e o carrinho somaria errado com o preÃ§o *certo* aparecendo na tela. Refeito em Node, com verificaÃ§Ã£o independente card a card.

## 29.34.0 â€” PreÃ§o e custo editÃ¡veis no painel, com botÃ£o de gravar

Dois pedidos do Juliano depois de digitar os 26 custos: faltou um botÃ£o de gravar, e faltou poder reajustar preÃ§o sozinho.

- **Salvamento visÃ­vel.** A versÃ£o anterior salvava ao sair do campo e funcionava â€” os 26 custos entraram certinho â€” mas ele digitou tudo sem nenhum sinal de que tinha gravado, e **salvamento invisÃ­vel Ã© indistinguÃ­vel de salvamento que nÃ£o aconteceu**. Agora as alteraÃ§Ãµes ficam pendentes, o botÃ£o mostra quantas sÃ£o, o campo salvo fica verde e a mensagem diz quantos foram e a que horas.
- **O lucro recalcula enquanto se digita** e fica vermelho se o preÃ§o cair abaixo do custo. A RPC recusa esse caso: erro de digitaÃ§Ã£o viraria cota-parte sobre lucro negativo e sÃ³ apareceria no fechamento da semana.
- **O preÃ§o vivia em DOIS lugares** â€” a tabela `products` e o `products-catalog-v1.js`, que Ã© o que o site, a agenda e o balcÃ£o realmente leem. Liberar a ediÃ§Ã£o sÃ³ no banco deixaria o cliente pagando um valor e o sistema calculando outro, com a diferenÃ§a caindo no repasse do parceiro. O catÃ¡logo estÃ¡tico passou a **buscar os preÃ§os da tabela ao carregar** e atualizar o array in-place: como todos os consumidores leem o mesmo `window.BDJ_PRODUCTS`, isso alcanÃ§a os cinco sem tocar em nenhum. A lista do arquivo continua como **fallback** â€” se a rede cair, vende pelo preÃ§o de ontem em vez de nÃ£o vender.

## 29.33.0 â€” Recibo de quitaÃ§Ã£o do repasse

Pedido do Juliano: *"caso ele venha a alegar que nÃ£o o pagamos"*. O comprovante do Pix prova que saiu dinheiro da conta; **nÃ£o prova que aquele dinheiro se refere Ã quela semana e Ã quele extrato**. Quem fecha essa lacuna Ã© a quitaÃ§Ã£o dada pelo prÃ³prio profissional, com o extrato Ã  vista.

- Marcar como pago **emite o recibo numerado** (`BDJ-R-2026-0001`), congela o extrato num snapshot, calcula o SHA-256 do conteÃºdo e manda o link no WhatsApp dele. Ele abre no celular, confere o detalhamento completo e confirma.
- **O extrato inteiro aparece antes do botÃ£o.** Recibo que sÃ³ diz "vocÃª recebeu R$ X" nÃ£o protege ninguÃ©m â€” nem ele, nem a barbearia.
- **O hash sela o conteÃºdo conferido**: sem ele, sobra espaÃ§o para alegar que o extrato mudou depois da confirmaÃ§Ã£o.
- **A quitaÃ§Ã£o sÃ³ registra uma vez.** Reconfirmar nÃ£o move a data original, que Ã© o dado com valor probatÃ³rio (testado: segunda tentativa nÃ£o sobrescreve IP nem horÃ¡rio).
- SÃ³ o **hash** do token fica no banco; o token vai no link. Emitir e enviar sÃ£o separados: se a Evolution estiver fora, o recibo jÃ¡ existe e o link volta na resposta.
- âš ï¸ **Fix v29.33.1**: revogar `EXECUTE` de `PUBLIC` derrubou tambÃ©m o `service_role`, que acessava por ali. AlÃ©m do recibo, isso teria quebrado `record_booking_shares` na conclusÃ£o do atendimento â€” **e em silÃªncio**, porque aquela chamada sÃ³ loga o erro para nÃ£o travar o atendimento: a cota-parte nÃ£o seria gerada e ninguÃ©m notaria atÃ© a semana fechar vazia. Ã‰ o espelho do bug das migrations 087/088.
- âš ï¸ **Fix v29.33.3**: a v29.32.0 criou uma tabela `payment_method_fees` sem verificar que **`finance_fee_rates` jÃ¡ existia** desde 09/08, preenchida pelo Juliano no Financeiro (crÃ©dito 4,61%, dÃ©bito 2,12%, Pix 0%). Ele percebeu ao ver o painel pedir as taxas de novo. Duas tabelas de taxa Ã© como divergÃªncia nasce: reajusta num lugar, o repasse continua calculando pelo outro, e o erro aparece no bolso do parceiro. Tabela duplicada removida.

## 29.32.0 â€” Fase 1 do sistema do 2Âº profissional: cadastro, cota-parte e fechamento

AtÃ© aqui o banco nÃ£o sabia **quem** atendeu: `bookings` guardava serviÃ§o, valor e cliente, e o barbeiro era implÃ­cito porque sÃ³ existia um.

- **Migration 113**: `professionals` (com `share_percent` **por pessoa**, e nÃ£o constante no cÃ³digo â€” permite acordo diferente sem migration), `bookings.professional_id` com backfill dos 142 atendimentos histÃ³ricos para o dono, e `products.cost_price`. RLS fechada em `professionals`: a tabela guarda CPF, CNPJ e chave Pix.
- **Migration 114 â€” a conta corrente**: `professional_ledger` (crÃ©dito = cota-parte, dÃ©bito = consumo e ressarcimento) com a **memÃ³ria de cÃ¡lculo gravada em cada linha** â€” bruto, taxa, custo, base, percentual. Numa relaÃ§Ã£o em que o dinheiro passa todo pela mÃ£o de um dos dois, "confia em mim" nÃ£o Ã© resposta.
- **EspÃ©cie nÃ£o entra na conta corrente**, de propÃ³sito. Pela ClÃ¡usula 4.5 do contrato v2.0 (decisÃ£o do Juliano, revertendo a v1), tudo Ã© entregue no mesmo dia: o sistema apura **quanto** entregar e registra a conferÃªncia, sem misturar adiantamento com receita da casa.
- **Regras do contrato codificadas, e nÃ£o deixadas na memÃ³ria de alguÃ©m**: base = pago menos a taxa da maquininha, sÃ³ isso (3.1.1); produto rateia **lucro**, nÃ£o faturamento (3.2); cortesia comercial paga cota normal, refaÃ§Ã£o por erro prÃ³prio nÃ£o (10.2); fidelidade e vale-presente nÃ£o reduzem a cota (10.3); todo dÃ©bito Ã© discriminado e contestÃ¡vel antes de ser compensado (4.6).
- **Produto sem custo cadastrado entra como pendÃªncia com valor zero**, em vez de virar cota sobre o preÃ§o cheio â€” que pagaria ao profissional o dinheiro gasto na compra.
- **A cota Ã© gerada na conclusÃ£o do atendimento**, e nÃ£o numa rotina noturna: Ã© neste instante que existem juntos o valor final, a forma de pagamento e os produtos. Idempotente por Ã­ndice Ãºnico â€” reabrir e concluir de novo nÃ£o paga duas vezes.
- **Aba Equipe** no painel: extrato com memÃ³ria de cÃ¡lculo, fechamento que **passa por conferÃªncia antes do pagamento**, cadastro, e o **encerramento com um clique** que o Juliano pediu â€” com aviso explÃ­cito de que o acesso cai e o histÃ³rico fica (Ã© ele que comprova os repasses feitos).
- Validado com cenÃ¡rio real e revertido: corte de R$ 40 no crÃ©dito a 3,5% â†’ base 38,60 â†’ cota 19,30; produto de R$ 36 com custo 18 â†’ lucro 16,74 â†’ cota 8,37; consumo de item de R$ 35 com custo 18 â†’ cobrado 26,50; barba de R$ 30 em dinheiro â†’ R$ 30 na entrega de espÃ©cie.

## 29.31.0 â€” ConteÃºdo de domingo e segunda, e o bug que escondia a direÃ§Ã£o de arte

Pedido do Juliano: aproveitar os valores de domingo (missa, descanso, famÃ­lia) e de segunda no marketing, com post **todos os dias** â€” inclusive nos dois em que a barbearia estÃ¡ fechada. Perfil que some perde alcance, e some justamente quando o cliente estÃ¡ em casa, com o celular na mÃ£o.

- **O bug (v29.31.6), encontrado depois de CINCO artes de domingo saÃ­rem escuras**: a direÃ§Ã£o de arte de domingo existia e estava correta, mas **nunca era acionada**. O gatilho Ã© a palavra "domingo" dentro do `themeText`, e nenhum caso do switch a produzia â€” domingo caÃ­a no texto genÃ©rico ("acolhimento, cafÃ©, poltrona, ambiente premium"), que Ã© exatamente a imagem escura com poltrona e xÃ­cara que voltava toda vez. NÃ£o era o modelo desobedecendo o prompt; era **o prompt certo nunca chegando ao modelo**.
- **Modo `only_image`**: refaz sÃ³ a arte dos rascunhos do dia e preserva a legenda. Nasceu de um caso concreto â€” a frase de domingo saiu do jeito que o Juliano queria e a arte nÃ£o. Regerar o dia inteiro jogaria fora um texto aprovado, e **texto bom Ã© mais raro que arte boa**.
- **Trava contra texto vazio**: em dia emocional a legenda passa por modo exigente (trÃªs versÃµes, escolhe a melhor) e Ã© reprovada se cair em clichÃª, repetir "domingo" trÃªs vezes ou revelar a data de fundaÃ§Ã£o da barbearia. Link de agendamento nÃ£o entra em dia emocional â€” em post que fala de descanso, link Ã© cobranÃ§a.
- **Regra permanente de arte**, a pedido do Juliano: nada imoral, ilegal ou inapropriado para qualquer pÃºblico â€” sem bebida alcoÃ³lica, cigarro ou objeto que os sugira, em nenhuma arte.
- **MarcaÃ§Ã£o das contas pessoais** (@julianoblpadilha e @nicolefpadilha): na legenda via `content-generate-daily` e **na foto** via `user_tags` da Graph API em `content-publish-meta` â€” a marcaÃ§Ã£o na foto Ã© a que coloca o post na aba "Marcados" e dÃ¡ o caminho curto pro repost no story. SÃ³ em foto de feed (story e Reels usam outro formato). Se a Meta recusar as tags, publica sem elas: post no ar sem tag Ã© contorno; post que nÃ£o subiu por causa de uma tag Ã© prejuÃ­zo.

## 29.26.0 â€” Janela de contato da JuIA: domingo, feriado e sÃ¡bado apÃ³s 15h tambÃ©m sÃ£o silÃªncio

Pedido do Juliano (16/08): a guarda de 20hâ€“8h da v29.21.0 virou uma **janela de contato** completa. A JuIA sÃ³ **inicia** conversa **segâ€“sex 8hâ€“20h** e **sÃ¡bado 8hâ€“15h**; **domingo e feriado, nunca**. Responder a quem escreveu continua liberado a qualquer hora â€” silÃªncio Ã© sobre nÃ£o incomodar, nÃ£o sobre deixar cliente falando sozinho.

- **Migration 109**: tabela `holidays` (nacionais 2026â€“2027 jÃ¡ cadastrados) + `juia_quiet_now()` e `juia_next_send_time()`. A regra passou a viver **em um lugar sÃ³**, no banco. âš ï¸ **Faltam os feriados municipais de BraganÃ§a Paulista** â€” o Juliano precisa conferir e cadastrar; nÃ£o inventamos data de feriado.
- **Migration 110 â€” a decisÃ£o de arquitetura**: em vez de repetir a regra dentro de nove Edge Functions (e redeployar todas a cada ajuste), a guarda entrou no **prÃ³prio agendador**. Os 7 crons proativos viraram `select case when not juia_quiet_now() then net.http_post(...) end` â€” se nÃ£o Ã© hora de falar, a function **nem Ã© chamada**: mais barato, imediato (sem deploy) e auditÃ¡vel num lugar sÃ³. Idempotente, nÃ£o embrulha duas vezes.
- **Ficaram deliberadamente SEM guarda**: `bdj-booking-confirmation` (confirmaÃ§Ã£o Ã© resposta a uma aÃ§Ã£o do cliente) e `Satisfaction Dispatch` (comprovante/pesquisa logo apÃ³s o atendimento â€” o cliente acabou de sair da cadeira). Os demais crons nÃ£o falam com cliente.
- **Como o "envia na prÃ³xima hora Ãºtil" acontece sem fila**: os crons proativos rodam a cada 15 min (ou diariamente); bloqueados agora, o prÃ³prio ciclo seguinte dentro da janela envia. Mensagem adiada nÃ£o se perde â€” ela espera. Validado: sÃ¡bado 19h â†’ **segunda 8h**; domingo 10h â†’ **segunda 8h**; terÃ§a 21h â†’ quarta 8h; 7 de setembro â†’ dia 8 Ã s 8h.
- Nas 10 functions, sÃ³ o **comentÃ¡rio** foi atualizado, apontando que a janela completa vive no agendador. O cÃ¡lculo local de 20hâ€“8h permanece como rede de seguranÃ§a para disparo manual.

## 29.25.0 â€” Vale-presente de verdade: escolhe, monta, paga por Pix e recebe o cÃ³digo

CrÃ­tica certeira do Juliano ao texto da v29.24.0: *"esquece, a pessoa nÃ£o me conhece, vai desconfiar"*. Quem compra um vale muitas vezes nunca pisou na barbearia â€” mandar essa pessoa fazer um Pix "Ã s cegas" e depois explicar o que ela levou Ã© o inverso da ordem certa. Agora ela **Ã© conduzida pelas telas**: escolhe â†’ vÃª o total â†’ sÃ³ entÃ£o paga.

- **Nova pÃ¡gina `/vale-presente/`** em 3 etapas: (1) trÃªs vales prontos (Corte + Lavagem R$ 50, Barboterapia R$ 40, Corte + Barboterapia R$ 80) **ou** monta o prÃ³prio somando serviÃ§os do catÃ¡logo v7; (2) quem compra e quem ganha (+ mensagem); (3) pagamento com **Pix copia e cola gerado pelo sistema** (BR Code EMV com valor jÃ¡ embutido â€” o comprador nÃ£o digita chave nem valor) e botÃ£o pra mandar o comprovante no WhatsApp.
- **Migration 107**: tabela `gift_cards` (cÃ³digo, itens, valor, comprador, presenteado, validade de 12 meses), coluna `bookings.gift_card_id`, `generate_gift_code()` (alfabeto sem O/0/I/1 â€” o cliente vai ditar isso no balcÃ£o) e `check_gift_card()` pÃºblica pra validar no agendamento.
- **Migration 108**: `confirm_gift_card()` e `redeem_gift_card()`, ambas com `is_admin()`. **Regra central: o cÃ³digo sÃ³ nasce quando o Juliano confirma o Pix** â€” cÃ³digo gerado antes do pagamento Ã© cÃ³digo que circula sem ter sido pago. ConfirmaÃ§Ã£o idempotente (reconfirmar devolve o mesmo cÃ³digo, nunca gera outro).
- **Functions**: `gift-card-create` (pedido + Pix, push pro Juliano) e `gift-card-confirm` (verify_jwt=true + is_admin na RPC; libera o cÃ³digo e **avisa o comprador no WhatsApp na hora**).
- **Nova tela `admin-vales.html`**: pendentes/ativos/usados, botÃ£o "Confirmar Pix e liberar cÃ³digo", campo de baixa por cÃ³digo no balcÃ£o, mÃ©tricas (aguardando, ativos, vendido no mÃªs). Link "ðŸŽ Vales-presente" na sidebar das 14 telas do admin.
- **Galeria**: a 2Âª e a 4Âª fotos foram trocadas a pedido do Juliano por um **clÃ¡ssico social (slick back, "old money")** e um **low fade na rÃ©gua** â€” mesma curadoria de privacidade (recorte que exclui o rosto).
- **PolÃ­ticas novas na seÃ§Ã£o de benefÃ­cios**: "Ajuste sem custo **em atÃ© 7 dias**" (prazo definido, como a Confraria) e **"Pezinho por nossa conta"** entre cortes. O card de hora marcada virou **"Hora marcada, com bom senso"** com a **tolerÃ¢ncia de 10 minutos dos dois lados** â€” o Juliano notou que prometer "sem espera" podia virar propaganda enganosa num dia em que o atendimento estende.

## 29.24.0 â€” Rodada 2 dos benchmarks: benefÃ­cios em destaque, vale-presente, galeria real e CTA fixo

Segunda auditoria comparativa (Confraria da Barba, QOD + os trÃªs da rodada 1). AprovaÃ§Ã£o integral do Juliano: "quero que vc implemente tudo adorei todas as ideias".

- **SeÃ§Ã£o "Por que a Barbearia do Ju"**: a trust-bar de chips minÃºsculos virou 5 cards de peso (reuso das classes previsit â€” zero CSS novo): ajuste sem custo, **fidelidade** (todo atendimento soma 1 ponto; no 10Âº o serviÃ§o Ã© por nossa conta â€” o programa existia no sistema mas era invisÃ­vel pra visitante novo), hora marcada, conforto, vale-presente.
- **Vale-presente Ã  venda** (pedido do Juliano, versÃ£o 1 sem API): seÃ§Ã£o prÃ³pria + card no acesso rÃ¡pido. Fluxo: Pix na chave PicPay â†’ comprovante no WhatsApp com o nome do presenteado â†’ Juliano envia o vale digital. Quando o Checkout PagBank liberar, pode virar cobranÃ§a online (registrado no briefing da assinatura).
- **Galeria "Resultados de verdade"**: 4 fotos REAIS de clientes (posts de junho do Instagram, antes da era das artes de IA â€” cuidado: as artes recentes com "antes/depois" sÃ£o simulaÃ§Ãµes rotuladas e NÃƒO podem ir pra galeria). Privacidade: os clientes autorizaram o Instagram mas nÃ£o o site, entÃ£o cada foto foi **recortada para excluir o rosto** (fica cabelo/fade/orelha â€” curadoria visual manual foto a foto, recorte de 66% da largura + resize 900px). Originais: taper, mullet low fade, black power e cachos. As 4 fotos de ambiente continuam depois delas.
- **CTA fixo no mobile**: barra dourada "Agendar horÃ¡rio" fixa no rodapÃ© (â‰¤620px, classe .mobile-agendar no css 02) â€” o padrÃ£o de conversÃ£o que os benchmarks sÃ³ entregam via app.
- Function temporÃ¡ria ig-media-tmp criada pra listar a mÃ­dia do Instagram via Graph API (secrets jÃ¡ existentes) â€” APAGAR depois de o Juliano aprovar a galeria.
- Ideia de negÃ³cio aceita e pendente de decisÃ£o de prazo: garantia com prazo ("atÃ© 7 dias"?) e "pezinho grÃ¡tis entre cortes" â€” Juliano decide depois.

## 29.23.2 â€” "Mais de 80 avaliaÃ§Ãµes" (nÃºmero fixo envelhece)

ObservaÃ§Ã£o do Juliano: a contagem de avaliaÃ§Ãµes sÃ³ cresce (80 â†’ 90 â†’ 100â€¦), e o nÃºmero exato na home ficaria defasado em semanas. Virou "mais de 80 avaliaÃ§Ãµes" â€” verdadeiro por muito tempo, retoque sÃ³ quando valer o prÃ³ximo patamar ("mais de 100"). **PendÃªncia registrada**: quando a sincronizaÃ§Ã£o do Perfil da Empresa preencher a `google_reviews` (tabela existe e estÃ¡ vazia â€” checar autorizaÃ§Ã£o da API), automatizar nota + contagem + rotaÃ§Ã£o das citaÃ§Ãµes na faixa, via cron, no lugar do texto fixo.

## 29.23.1 â€” TÃ­tulo do hero parava de clipar no celular

Bug antigo confirmado em screenshot real: com `white-space:nowrap` no `.hero-title-line`, a fonte em `10.7vw` estourava a largura da tela e o tÃ­tulo cortava na lateral ("CONTA SUA HISTÃ“Râ€¦" no texto antigo; "SUA IMAGâ€¦" no novo). Coeficiente reduzido pra `8.6vw` (e `8.2vw` no ajuste iOS) â€” cabe atÃ© em 320px. `?v=` do css 03 e do style.css bumpados.

## 29.23.0 â€” Home no nÃ­vel dos benchmarks: 1 CTA, avaliaÃ§Ãµes reais e fim do "premium"

Auditoria comparativa de 15/08 (Corleone, Hermanos, KE Barbearia â€” os "tops" do mercado) + incÃ´modo do Juliano com a palavra "premium" no site. Aprovado por ele: "aplique todas as melhorias que vc achar boas" / "escolhe a frase vc".

- **Hero**: headline nova â€” "Cuidar da sua imagem Ã© o meu trabalho." (a voz do Juliano, tirada da prÃ³pria seÃ§Ã£o sobre; sai o "MAIS QUE UM CORTE!" gritado em caixa alta que destoava dos benchmarks). SubtÃ­tulo com hora marcada + BraganÃ§a. **Um sÃ³ CTA dourado ("Agendar horÃ¡rio")**; Produtos/WhatsApp/Blog viraram contorno discreto (`hero-btn-ghost`, css 02). Antes os 4 botÃµes disputavam o olho com o mesmo peso.
- **Faixa de avaliaÃ§Ãµes**: morreu o autoelogio "padrÃ£o premium" (origem da reclamaÃ§Ã£o). Entrou prova social REAL colhida do Google Maps em 15/08: **nota 5,0 Â· 80 avaliaÃ§Ãµes** + duas citaÃ§Ãµes verbatim com primeiro nome (Rogerio: "A melhor barbearia da regiÃ£o!"; Alfredo: "O corte ficou 10/10!! recomendo 1000%"). Regra: citaÃ§Ã£o de cliente Ã© sempre verbatim e nunca inventada; quando a tabela `google_reviews` passar a sincronizar (hoje estÃ¡ vazia), dÃ¡ pra automatizar a rotaÃ§Ã£o.
- **PreÃ§os na home**: linha com os 3 serviÃ§os Ã¢ncora (Corte R$ 40 Â· Barboterapia R$ 40 Â· Corte+Barboterapia R$ 80) na seÃ§Ã£o do catÃ¡logo â€” benchmark KE mostra preÃ§os; barbearia local com preÃ§o honesto Ã© argumento, nÃ£o segredo.
- **"Premium" varrido do texto visÃ­vel do site inteiro**: faixa da home, e-book (home + 7 pÃ¡ginas de blog: badge virou "ðŸ“˜ E-book"), descriÃ§Ã£o do Corte+Barboterapia ("acabamento caprichado") no catÃ¡logo v7 e no /agendar estÃ¡tico, badge de produto ("â­ Destaque"). Classes CSS com "premium" no nome ficaram (invisÃ­veis ao usuÃ¡rio, renomear sÃ³ arriscaria regressÃ£o).
- Cache: `02-site-interactions.css` e `style.css` bumpados pra 29.23.0 no index (o import do style.css mudou).
- **Novo `PLANO-ASSINATURA-BRIEFING.md`**: o Juliano vai implantar o clube de assinatura esta semana (no notebook da barbearia) â€” o arquivo deixa mastigado: dados reais pra precificar, estrutura de planos sugerida, cobranÃ§a em 2 fases (link mensal jÃ¡; API Pagamento Recorrente depois â€” precisa ser ADICIONADA ao chamado 1430398600), esqueleto de banco e ordem de implementaÃ§Ã£o. DecisÃµes abertas marcadas com âš–ï¸ pra fechar com ele.

## 29.22.1 â€” Fallback do pagamento avisa que o cartÃ£o online estÃ¡ chegando

Pedido do Juliano (15/08): enquanto a allowlist do PagBank nÃ£o sai, quem toca em "Pagar agora â€” Pix ou cartÃ£o" cai no bloco sÃ³ de Pix â€” quebra de expectativa momentÃ¢nea. O bloco de fallback ganhou uma linha explicando: cartÃ£o online estÃ¡ chegando; por enquanto Pix pela chave, ou no local (maquininha aceita cartÃ£o normal). A linha morre sozinha junto com o fallback quando a API liberar.

## 29.22.0 â€” Fase 2 do pagamento antecipado: Checkout PagBank (Pix + cartÃ£o, confirmaÃ§Ã£o automÃ¡tica)

DecisÃ£o do Juliano em 15/08/2026, revertendo conscientemente a escolha da v29.3.0 (sem API): o cliente merece confirmaÃ§Ã£o automÃ¡tica, e cartÃ£o de crÃ©dito/dÃ©bito entra como opÃ§Ã£o. Caminho escolhido: **Checkout PagBank** (pÃ¡gina hospedada) em vez de formulÃ¡rio de cartÃ£o no site â€” uma integraÃ§Ã£o sÃ³ serve o site E, depois, o link que a JuIA pode mandar no WhatsApp, onde nascem ~90% dos agendamentos (v29.1.0). Pix por chave (0%) sai do fluxo do site; o Pix da API custa ~0,99%, o preÃ§o de ninguÃ©m mais conferir extrato.

**O ciclo novo:** fim do agendamento â†’ botÃ£o "ðŸ’³ Pagar agora â€” Pix ou cartÃ£o" â†’ function `pagbank-checkout` cria o checkout (Ã  vista sÃ³; expira em 24h; reaproveita link vivo pra nÃ£o gerar cobranÃ§a dupla) â†’ cliente paga na pÃ¡gina do PagBank â†’ `pagbank-webhook` valida a assinatura (`x-authenticity-token` = SHA-256 de `token-corpo cru`; assinatura errada = descarte), marca `prepay_confirmed_at` + `prepay_key='checkout'`, avisa o cliente no WhatsApp e manda push "nada a conferir" pro Juliano. A guarda de silÃªncio NÃƒO se aplica: confirmar pagamento que o cliente acabou de fazer Ã© resposta, nÃ£o incÃ´modo.

**Fallback deliberado:** se a API falhar (token ausente, conta fora da allowlist, erro), o front troca o bloco pelo fluxo manual da Fase 1 (chave copiÃ¡vel + "JÃ¡ fiz o Pix") â€” o cliente nunca vÃª quebra. Isso importa porque **a conta ainda nÃ£o estÃ¡ na allowlist do PagBank**: as APIs novas (Checkout e Orders) responderam 403 `allowlist_access_required` no teste real de 15/08. Chamado de liberaÃ§Ã£o aberto pelo Juliano no mesmo dia. Quando o PagBank liberar, o fluxo novo ativa sozinho, sem deploy.

- Migration 106: tabela `payments` (uma linha por checkout; webhook atualiza a mesma linha), `prepay_key` ganha `'checkout'`, RPC `get_booking_for_checkout` (autorizada pelo par code+token, padrÃ£o da 096). RLS `is_admin()` + GRANT de base (liÃ§Ã£o da 058).
- Functions novas: `pagbank-checkout` e `pagbank-webhook` (ambas `verify_jwt=false` â€” uma autentica por code+token, a outra por assinatura). Deploy feito; `PAGBANK_TOKEN` jÃ¡ estÃ¡ nos secrets (colado pelo prÃ³prio Juliano, sem passar pelo chat).
- Site (`agenda-v15.js`): oferta nova com o botÃ£o do Checkout; HTML da Fase 1 virou `pixFallbackHtml()`. Evento GA novo: `checkout_opened`.
- Painel (`admin-v15-4-agenda.js`): selo "âœ… Pago online (PagBank) â€” automÃ¡tico" quando `prepay_key='checkout'` (sem botÃ£o de conferir â€” nada a conferir).
- `?v=` bumpado em `agendar/horario/index.html` e nos 7 HTML que carregam `admin-v15-4-agenda.js`.

**PendÃªncias conhecidas:** (1) allowlist do PagBank â€” aguardando retorno; function `pagbank-validate-tmp` continua no ar pra retestar com um clique e deve ser apagada depois; (2) JuIA mandar o link de pagamento no WhatsApp â€” prÃ³xima fase, destrava os ~90%; (3) `meu-agendamento.html` ainda nÃ£o mostra estado "pago" nem trata `?pago=1` no retorno do Checkout; (4) Financeiro assume Pix 0% â€” Pix via API tem ~0,99%, ajustar `finance_fee_rates` quando o volume aparecer.

## 29.21.0 â€” HorÃ¡rio de silÃªncio (20hâ€“8h) + carrossel na Central de ConteÃºdo

**HorÃ¡rio de silÃªncio (pedido do Juliano, 14/08/2026)**: nenhum robÃ´ manda mensagem proativa pra cliente entre 20h e 8h (BrasÃ­lia) â€” o que vencer de noite sai a partir das 8h da manhÃ£ seguinte. Guarda aplicada em 10 funÃ§Ãµes: confirmaÃ§Ã£o de presenÃ§a (pedido + fallback SMS/e-mail), lembrete 24h, pesquisa de satisfaÃ§Ã£o, fidelidade (10 pontos), follow-up de leads (nudges, oferta de vaga da lista de espera, vaga reaberta), aniversÃ¡rio, reativaÃ§Ã£o de cliente sumido, convite de retorno e boas-vindas de balcÃ£o. Como todas essas rotinas sÃ³ marcam estado DEPOIS de enviar, a primeira rodada do cron depois das 8h entrega o que ficou pendente â€” nada se perde. Duas exceÃ§Ãµes deliberadas: (1) a JuIA continua RESPONDENDO quem escreve a qualquer hora (o webhook nÃ£o tem guarda â€” responder nÃ£o Ã© incomodar); (2) o watchdog de reativaÃ§Ã£o continua devolvendo a conversa pra JuIA de noite (senÃ£o cliente que escrevesse de madrugada falaria com o vÃ¡cuo), mas o "cochicho" de "ainda estou por aqui" nÃ£o sai no silÃªncio â€” e nÃ£o Ã© reenviado de manhÃ£ de propÃ³sito, porque 10h depois soaria fora de contexto.

**Carrossel do Instagram na Central**: o campo de imagem do novo rascunho aceita 2 a 10 links (um por linha) e publica como carrossel de verdade pela Graph API â€” cada imagem vira container filho (`is_carousel_item`), o pai (`media_type=CAROUSEL`) junta tudo com a legenda. Fluxo validado em produÃ§Ã£o nas pontes de 13/08 (carrossel do guia de manutenÃ§Ã£o). PrÃ©via no card mostra as imagens na ordem; timeout do navegador sobe pra 4min nesses posts (a Meta processa imagem por imagem). Story de vÃ­deo jÃ¡ existia desde a v28.57.0. Carrossel continua sem trilha sonora por limitaÃ§Ã£o da API da Meta â€” o contorno segue sendo o slideshow em vÃ­deo.

## 29.16.0 â€” Fim da esteira de perguntas de venda + convite de retorno no dia seguinte

Caso real (print de 12/08): cliente escolheu corte e horÃ¡rio, respondeu "NÃ£o" Ã  pergunta de complemento e levou NA SEQUÃŠNCIA a pergunta de produto â€” parou de responder, quase desistiu, e o Juliano teve que assumir a conversa na mÃ£o. Um corte de R$40 quase perdido por causa de um complemento de R$15. O cliente confirmou depois que achou a IA cansativa.

**Oferta Ãºnica, colada no "sim, tem horÃ¡rio".** O fluxo antigo fazia atÃ© 3 perguntas de venda em sÃ©rie (upgrade da lavagem â†’ complementos â†’ produto) ANTES de fechar o horÃ¡rio. Agora: quando a JuIA confirma que o horÃ¡rio pedido estÃ¡ livre, a MESMA mensagem traz a Ãºnica oferta da conversa, com opÃ§Ãµes numeradas (WhatsApp nÃ£o mostra botÃµes de actions) â€” upgrade pra Corte + Lavagem e/ou atÃ© 3 complementos â€” mais a Ãºltima opÃ§Ã£o "NÃ£o, pode fechar assim". Produto deixou de ser pergunta: virou aviso passivo no fim da mensagem ("se quiser produto ou bebida gelada, Ã© sÃ³ avisar"). Qualquer "nÃ£o" encerra TODA venda da conversa e vai direto pro fechamento; se o cliente ignora a oferta e fala de outra coisa, a venda morre ali. Resposta por nÃºmero (1/2/3...), por nome do serviÃ§o ou pelo diff do state (modelo) â€” tudo coberto. `productSuggestions` removida; prompt do modelo proibido de fazer pergunta de venda por conta prÃ³pria.

**TolerÃ¢ncia de atraso oficializada**: atÃ© 10 minutos, a JuIA confirma na hora que o horÃ¡rio segue garantido; acima disso, acolhe, avisa que vai passar pro Ju e faz handoff â€” nunca promete encaixe alÃ©m dos 10 min nem reagenda sozinha.

**Convite de retorno pÃ³s-atendimento (ideia do Juliano)**: cron diÃ¡rio Ã s 10h (function `return-invite-dispatch` + tabela `return_invites`, migration 105) convida quem foi atendido ONTEM e nÃ£o tem agendamento futuro a jÃ¡ deixar o retorno reservado â€” mesmo dia da semana e horÃ¡rio, 4 semanas depois (se o dia +28 estiver fechado/lotado, tenta atÃ© +35; horÃ¡rio mais prÃ³ximo do original). No dia seguinte de propÃ³sito: a pesquisa de satisfaÃ§Ã£o e o pedido de avaliaÃ§Ã£o jÃ¡ saem no dia do atendimento. Menu 1/2/3 no padrÃ£o da confirmaÃ§Ã£o de presenÃ§a; a resposta Ã© interpretada no whatsapp-webhook ANTES da pesquisa de satisfaÃ§Ã£o (o convite Ã© sempre a pergunta mais recente). "1" cria o agendamento na hora (com checagem de duplicidade e de colisÃ£o), "2" devolve pra conversa normal, "3" registra recusa â€” 2 recusas seguidas pausam novos convites por 60 dias. Sem resposta em 72h o convite expira em silÃªncio, zero insistÃªncia. Quem prÃ©-agendou cai no robÃ´ de confirmaÃ§Ã£o de 24h normalmente (o lembrete de vÃ©spera cobre o risco de esquecimento de quem marcou com 1 mÃªs de antecedÃªncia).

**Deploy por import fixado no commit**: ju-ia-site e whatsapp-webhook passaram a ser publicados como um wrapper de 1 linha que importa o arquivo real do GitHub (raw, SHA fixado) â€” o bundler do Supabase embute o cÃ³digo no deploy, sem dependÃªncia do GitHub em runtime. Elimina o risco de retranscrever 160KB de cÃ³digo a cada deploy via MCP.
## 29.15.0 â€” Campo "NÂº desta visita" substitui o checkbox de cliente recorrente

O checkbox "jÃ¡ Ã© cliente recorrente" (v29.9.0) chutava `prior_visits=6` pra qualquer cliente antigo â€” foi o que deu etiqueta errada no caso John Maicon, e no caso Tatiane (12/08) a palavra do Juliano ("Ã© a 2Âª visita") era o dado certo que a tela nÃ£o tinha como receber.

**Como funciona agora.** Na conclusÃ£o (Agenda/Atendimento) e no BalcÃ£o, o campo pergunta exatamente o que o Juliano sabe: o nÃºmero TOTAL desta visita, contando desde antes do sistema. O placeholder mostra o que o sistema jÃ¡ conta ("o sistema conta 3Âª") â€” sÃ³ se digita algo se estiver errado. A RPC `admin_apply_completion_extras` (migration 104) converte: `prior_visits = nÂº digitado âˆ’ concluÃ­dos no sistema antes desta reserva âˆ’ 1`, com trava em 0 se o nÃºmero digitado for menor que o histÃ³rico jÃ¡ registrado (o histÃ³rico vence). A comparaÃ§Ã£o de "antes desta" usa a MESMA regra estrita de data/hora do `visitNumber()` do front, e o dedupe de telefone usa `phone_match_key` (com/sem 55, com/sem 9).

`p_mark_recurring` continua aceito na RPC (comportamento antigo) porque o PWA do Juliano pode rodar JS antigo em cache por horas. Assinatura antiga dropada antes de recriar (gotcha da migration 041 â€” sobrecarga). Testado com cliente descartÃ¡vel no banco (3 concluÃ­dos, digitou 6 â†’ prior 3 â†’ etiqueta 6Âª; digitou 2 â†’ trava em 0), dados apagados. SuÃ­te do admin 26/26 verde; `?v=` bumpado em todos os HTML que carregam `admin-v15-4-agenda.js` e no balcÃ£o.
## 29.8.0 â€” Paleta real da barbearia no gerador de imagens

Depois da aprovaÃ§Ã£o da peÃ§a still-life genÃ©rica (v29.6-29.7), o Juliano propÃ´s um teste: mandar fotos reais da barbearia, eu descrever sÃ³ os materiais/objetos/cores (nunca o ambiente inteiro como cena, nunca texto â€” mesma regra de sempre) e usar isso pra enriquecer o prompt.

**O que ele NÃƒO queria** tambÃ©m apareceu na mesma madrugada: chegou a compartilhar um prompt gerado por outro modelo que tentava recriar a barbearia inteira numa imagem sÃ³ â€” porta de vidro com o nome escrito, frase na parede, trÃªs quadros decorativos fictÃ­cios, TV com jogo de futebol "reconhecÃ­vel", reflexo de espelho mostrando o ambiente certo. Recusei executar como veio: tinha os dois problemas exatos que a v29.6.0 corrigiu (texto desenhado pela IA + ambiente inteiro reconhecÃ­vel, que Ã© como se inventou uma segunda cadeira de barbeiro em 04/08). O Juliano concordou e pediu pra eu criar baseado nas fotos, do meu jeito.

**O prompt novo** (`BRAND_STYLE` em ambas as funÃ§Ãµes) incorpora a paleta real: tijolo terracota, couro preto capitonÃª, latÃ£o/metal preto com dourado discreto, madeira escura de bancada + viga clara, vidro/cristal (potes de boticÃ¡rio, frascos Ã¢mbar), samambaia, toalhas creme, luz quente 2700-3000K nunca fria. Testado com uma ponte temporÃ¡ria (gerar + aplicar marca, sem subir em lugar nenhum), revisado por mim, aprovado pelo Juliano ("ficou perfeita", "MARAVILHOSA") â€” muito superior ao still life genÃ©rico anterior.

Continuam de pÃ© todas as proibiÃ§Ãµes da v29.6.0: sem pessoa, sem ambiente inteiro como sala reconhecÃ­vel, sem texto/logo desenhado pela IA. A peÃ§a aprovada foi publicada como rascunho no Facebook (a still-life genÃ©rica de ontem jÃ¡ estava no Instagram).

**LiÃ§Ã£o registrada**: usar fotos reais como fonte de vocabulÃ¡rio (materiais, cores, objetos) funciona bem. Usar fotos reais como blueprint pra recriar a cena inteira Ã© o mesmo erro de sempre, sÃ³ que com mais detalhe â€” e por isso mais difÃ­cil do modelo acertar, nÃ£o mais fÃ¡cil.
## 29.7.0 â€” Marca real carimbada em toda arte gerada

Pedido do Juliano: as artes automÃ¡ticas deveriam trazer o nome da barbearia. A resposta nÃ£o podia ser "deixar a IA escrever" â€” o prÃ³prio acervo jÃ¡ provou o risco (uma peÃ§a saiu "BAREARIA DO JU").

**A marca vem de um arquivo, nÃ£o de um prompt.** `assets/marca-selo-transparente.png` foi extraÃ­da do logo real (`logo-topo-wide.jpg`, o mesmo do letreiro fÃ­sico) por flood-fill a partir das bordas: qualquer pixel escuro *conectado Ã  borda* virou transparente; os pretos internos do desenho â€” contorno, bigode, letras â€” ficaram intactos, porque nÃ£o tÃªm caminho atÃ© a borda sem cruzar um pixel claro. Resultado: fundo 100% transparente sem perder nenhum traÃ§o do desenho original.

**Como entra na arte**: `content-generate-image` e `content-generate-daily` ganharam `applyWatermark()`, usando `imagescript` (Deno, WASM puro â€” `sharp` nÃ£o roda no runtime das Edge Functions). Depois que o Gemini devolve a arte, a marca Ã© redimensionada para ~34% da largura e composta no canto inferior direito com 4% de respiro. Se a marca falhar ao buscar ou decodificar, a arte segue sem ela â€” nunca derruba a geraÃ§Ã£o por causa disso.

**Testado antes do deploy** com Deno local instalado na sessÃ£o, rodando a mesma versÃ£o exata da biblioteca (`imagescript@1.3.0`) contra uma arte sintÃ©tica: composiÃ§Ã£o, transparÃªncia e posicionamento conferidos visualmente antes de ir para produÃ§Ã£o.
## 29.6.0 â€” A geraÃ§Ã£o de imagem parou de tentar ser a barbearia

ConsequÃªncia direta da decisÃ£o de 08/08/2026: **pessoa e ambiente = foto real; IA = sÃ³ o que nÃ£o tem rosto nem cÃ´modo.**

**O que estava acontecendo.** `content-generate-image` e `content-generate-daily` anexavam **duas fotos reais** em cada pedido ao Gemini: uma do salÃ£o e outra do rosto do Juliano. A instruÃ§Ã£o dizia, com todas as letras: *"se a cena incluir o barbeiro, ele precisa ter a mesma aparÃªncia da segunda foto (mesmo rosto, mesmo cabelo, mesma barba)"*. Havia atÃ© um comentÃ¡rio no cÃ³digo explicando a origem â€” *"o barbeiro gerado nÃ£o se parecia com ele"*.

Ou seja: os ~R$ 16/mÃªs de Gemini estavam pagando exatamente pelo tipo de peÃ§a que decidimos nÃ£o publicar. O problema nunca foi o custo; era o que saÃ­a.

**O que mudou:**
- Fora as fotos de referÃªncia (salÃ£o e rosto). O pedido agora Ã© 100% texto.
- `BRAND_STYLE` reescrito para o still life editorial do guia de criaÃ§Ã£o: fundo preto quente, luz lateral de fonte Ãºnica, dourado #c89b55, grÃ£o de filme â€” e uma lista explÃ­cita do que Ã© **proibido gerar**: pessoas, rostos, mÃ£os, silhuetas, interior/fachada reconhecÃ­vel, e qualquer texto na imagem.
- O texto continua sendo aplicado depois, fora da IA â€” modelo de imagem erra acento e inventa palavra em portuguÃªs, e preÃ§o errado publicado Ã© problema real (comprovado no acervo: uma peÃ§a dizia "BAREARIA DO JU").
- CÃ³digo morto removido (`REFERENCE_IMAGES`, `JULIANO_REFERENCE`, `REFERENCE_INSTRUCTION`, `fetchReferenceImage`, `fetchImageAsBase64`) nos dois arquivos.

**Por que NÃƒO desligamos a API do Gemini**, que era a pergunta original do Juliano: o que os R$ 16/mÃªs compram nÃ£o Ã© imagem, Ã© o **cron das 8h** que cria os rascunhos do dia sem ninguÃ©m lembrar. Trocar isso por geraÃ§Ã£o manual economiza R$ 16 e custa atenÃ§Ã£o diÃ¡ria â€” o recurso mais escasso de um barbeiro que trabalha sozinho. AlÃ©m disso, desligar a API sem desligar o cron faria ele falhar toda manhÃ£ em silÃªncio.

**DivisÃ£o de trabalho combinada:** a automaÃ§Ã£o gera os fundos sem rosto; o Claude do Chrome gera peÃ§as pontuais sob demanda pelo Gemini web; foto real para pessoa e ambiente, sempre.
## 29.5.0 â€” QR Code novo e a instituiÃ§Ã£o informada junto da chave

**QR Code gerado do zero** para a chave `contato@barbeariadoju.com.br`, no padrÃ£o BR Code do Banco Central (EMV): campos TLV, moeda 986, paÃ­s BR, recebedor "Barbearia do Ju", cidade BRAGANCA, e CRC16/CCITT-FALSE calculado sobre o payload.

**Como foi validado, e por que isso importa**: gerar QR de Pix na mÃ£o Ã© fÃ¡cil de errar em silÃªncio â€” um dÃ­gito no CRC e o cÃ³digo simplesmente nÃ£o abre no banco do cliente, sem nenhum aviso. EntÃ£o o PNG foi **lido de volta** com um decodificador independente, o CRC recalculado a partir do que foi lido, e a Ã¡rvore TLV reparseada campo a campo. SÃ³ depois disso o Juliano escaneou com o aplicativo real e confirmou que funciona.

**InstituiÃ§Ã£o informada junto do nome** (pedido do Juliano): "aparece o nome Juliano Bruno Lopes Padilha e a instituiÃ§Ã£o PicPay". O raciocÃ­nio dele Ã© certeiro â€” quem paga por Pix confere o nome antes de confirmar, e nome de pessoa fÃ­sica sem contexto gera desconfianÃ§a suficiente para a pessoa parar no meio. Aplicado na home, no bloco de agendamento e no prompt da JuIA (testado ao vivo).
## 29.4.0 â€” Chave Pix de e-mail como primeira opÃ§Ã£o

DecisÃ£o do Juliano em 08/08/2026: `contato@barbeariadoju.com.br` (PicPay, pessoa fÃ­sica) passa a ser a **primeira opÃ§Ã£o** de pagamento em todos os pontos de contato.

**Contexto da decisÃ£o, registrado porque ela foi tomada com a informaÃ§Ã£o na mesa.** Levantei duas objeÃ§Ãµes: (1) a conta Ã© pessoa fÃ­sica, e receita da barbearia caindo fora do CNPJ dificulta a contabilidade do MEI e nÃ£o constrÃ³i histÃ³rico de faturamento do negÃ³cio; (2) o argumento do teto do MEI nÃ£o se sustenta hoje â€” o faturamento projeta ~R$ 30 mil/ano, cerca de um terÃ§o do limite, e receita Ã© receita independentemente da conta que recebe. O Juliano reafirmou a escolha, entÃ£o estÃ¡ feito como ele pediu. Assunto de contador, nÃ£o meu.

- **Home**: a chave aleatÃ³ria `d1883c86-...` saiu (ninguÃ©m reconhece um amontoado de letras como sendo de uma barbearia). Entrou o e-mail, com o aviso do nome do titular. **O QR Code foi removido** porque apontava para a chave antiga â€” precisa ser regerado no app do PicPay e reenviado.
- **Agendamento**: e-mail em primeiro, celular como segunda opÃ§Ã£o. O botÃ£o "JÃ¡ fiz o Pix" agora declara `picpay`; o link secundÃ¡rio declara `pagbank`.
- **JuIA**: passa o e-mail primeiro e sozinho, e sÃ³ oferece o celular se o cliente pedir outra opÃ§Ã£o. InstruÃ­da a **nunca passar as duas de uma vez** â€” duas chaves na mesma mensagem confundem e derrubam pagamento. Testado ao vivo.

**InconsistÃªncia que isso resolveu de quebra**: a home mostrava uma chave e o fluxo de agendamento mostrava outra. Agora Ã© uma sÃ³, com a segunda claramente marcada como alternativa.
## 29.3.0 â€” Pix: o ciclo fechado, sem API e sem taxa

Pedido do Juliano: dar seguranÃ§a a quem paga adiantado, sem depender da API do PagBank (decisÃ£o de nÃ£o usar a API por ora â€” ver [[projeto-pix-pagbank-api]]).

**O que faltava.** O cliente pagava, clicava em "JÃ¡ fiz o Pix", e ficava no vÃ¡cuo â€” nunca recebia retorno. Do outro lado, o Juliano sÃ³ descobria a declaraÃ§Ã£o se abrisse o painel, e ainda tinha que adivinhar em qual aplicativo conferir.

**O ciclo agora:**
1. Cliente declara â†’ **push na hora** no celular do Juliano, dizendo **para qual chave** conferir (PagBank celular ou PicPay e-mail). Era o pedido literal dele: *"preciso ver pix enviado para picpay, pix enviado para pagbank, assim abro na hora a conta correta"*.
2. Ele confere o extrato e aperta **"âœ… Confirmar que o Pix caiu"** no card da agenda.
3. O cliente recebe no WhatsApp: *"Pagamento confirmado âœ… ... nÃ£o precisa fazer mais nada."*

- Migration 102: `bookings.prepay_key` e `prepay_confirmed_at`; `declare_prepay` ganhou o parÃ¢metro da chave (com `DROP` antes, pelo gotcha de sobrecarga da migration 041) e passou a devolver os dados do cliente; nova `confirm_prepay`, protegida por `is_admin()`.
- Nova function pÃºblica `prepay-declare` (verify_jwt=false, autorizada pelo par cÃ³digo+token): registra **e** dispara o push. Antes o site chamava a RPC direto e a declaraÃ§Ã£o morria no banco.
- Nova function `prepay-confirm`: chama a RPC **com o token do prÃ³prio admin** (nÃ£o com service role) para que `is_admin()` valha de verdade, e sÃ³ entÃ£o avisa o cliente pela Evolution.
- Site: novo texto de retorno ao cliente e link discreto "Paguei no PicPay (e-mail)" para o caso raro de quem pediu a chave alternativa Ã  JuIA.
- Painel: selo verde quando confirmado, e o botÃ£o de confirmar quando ainda nÃ£o.

**Verificado**: declaraÃ§Ã£o com chave gravando certo (`prepay_key='picpay'`), token invÃ¡lido recusado, `confirm_prepay` recusando quem nÃ£o Ã© admin, e `test:admin` 26/26 com os dois estados renderizando na Agenda.

**O que ainda falta e vale mais que tudo isso**: a JuIA oferecer o adiantamento na conversa. Hoje o bloco de Pix sÃ³ existe no formulÃ¡rio do site, que responde por ~9% dos agendamentos (ver v29.1.0). O Juliano relatou que os clientes chegam na barbearia e demoram para abrir o aplicativo e pagar â€” oferecer antes, no WhatsApp, resolve isso onde o cliente estÃ¡.
## 29.2.0 â€” AtribuiÃ§Ã£o dos agendamentos que nascem no WhatsApp

Fecha o buraco aberto pela descoberta da v29.1.0: ~90% dos agendamentos vÃªm da JuIA no WhatsApp, e o Google Ads nÃ£o enxergava nenhum deles. Quando a pessoa sai do site e abre o WhatsApp, o identificador do clique no anÃºncio nÃ£o vai junto â€” a conversa comeÃ§a sem vÃ­nculo com a visita.

**Como funciona.** Ao clicar em qualquer link de WhatsApp do site, um cÃ³digo curto (`[#abc12345]`) Ã© grudado no fim do texto da mensagem e registrado no servidor junto do `client_id` do GA4, do `gclid` e dos UTMs daquela visita. A JuIA lÃª o cÃ³digo na primeira mensagem, **remove do texto antes do modelo ver** (pra nÃ£o poluir a conversa) e amarra ao telefone. Quando aquele telefone agenda, o agendamento Ã© enviado ao GA4 pelo Measurement Protocol com o **mesmo `client_id`** â€” e Ã© isso que permite ao Google creditar o agendamento ao anÃºncio de origem.

- Migration 101: `whatsapp_attribution` + `purge_whatsapp_attribution()` (limpa vÃ­nculos nÃ£o convertidos com mais de 30 dias)
- Nova function pÃºblica `whatsapp-attribution` (verify_jwt=false), com validaÃ§Ã£o estrita do formato do cÃ³digo
- `whatsapp-attrib-v29.js` na home, no catÃ¡logo, na agenda e em produtos. Usa `sendBeacon` porque `fetch` nem sempre sobrevive Ã  navegaÃ§Ã£o pro WhatsApp; guarda o `gclid` em localStorage por 90 dias, jÃ¡ que a pessoa pode navegar vÃ¡rias pÃ¡ginas antes de clicar
- `ju-ia-site` lÃª o cÃ³digo, amarra ao telefone e dispara o evento no agendamento

**PrincÃ­pio que guiou o cÃ³digo**: nada disso pode atrapalhar quem quer agendar. Todo o caminho novo estÃ¡ em `try/catch`, o clique no WhatsApp nunca Ã© bloqueado, e se a chave do Measurement Protocol nÃ£o existir o envio Ã© simplesmente pulado â€” o agendamento acontece igual.

**PendÃªncia**: criar o segredo `GA4_MP_API_SECRET` (GA4 â†’ Admin â†’ Fluxos de dados â†’ Measurement Protocol). Sem ele o vÃ­nculo Ã© registrado mas o evento nÃ£o Ã© enviado.
## 29.1.0 â€” Canal real do agendamento (site x JuIA x balcÃ£o)

**O achado que motivou isto.** Entre 01 e 07/08/2026 o banco registrou **22 agendamentos com `channel='site'`**, mas o GA4 recebeu sÃ³ **3 eventos `booking_confirmed`** â€” e um deles foi um teste meu. O evento sÃ³ dispara no formulÃ¡rio do site; a JuIA usa a mesma `create_public_booking_v15` e tambÃ©m saÃ­a marcada como "site", sem passar por navegador nenhum.

ConclusÃ£o: **cerca de 90% dos agendamentos nascem numa conversa com a JuIA, nÃ£o num formulÃ¡rio.**

Duas consequÃªncias que estavam invisÃ­veis:
- A **Fase 1 do Pix antecipado** foi construÃ­da no fim do formulÃ¡rio do site â€” ou seja, exposta a ~9% do movimento. A adesÃ£o zero medida em 08/08 nÃ£o prova desinteresse; prova que quase ninguÃ©m viu.
- A **conversÃ£o de agendamento ligada no Google Ads em 08/08** (ver [[marketing-ads-proximos-passos]]) enxerga esses mesmos ~9%. Continua muito melhor do que otimizar por "pediu rota no Maps", que era o estado anterior, mas o Google estÃ¡ aprendendo com uma fraÃ§Ã£o da realidade.

**O que mudou (migration 100):** `bookings_channel_check` passou a aceitar `site`, `balcao`, `juia_whatsapp`, `juia_chat` e `rebooking`. A `ju-ia-site` marca o canal certo logo apÃ³s criar o agendamento (`juia_whatsapp` quando o telefone vem verificado pelo WhatsApp, `juia_chat` no chat do site).

**DecisÃ£o de engenharia:** nÃ£o alterei a assinatura de `create_public_booking_v15` para receber o canal. Ela Ã© o caminho mais crÃ­tico do sistema, e mudar a lista de parÃ¢metros cria sobrecarga nova em vez de substituir a funÃ§Ã£o (gotcha jÃ¡ documentado na migration 041). Marcar pelo lado de quem chama tem raio de dano muito menor.

**Limite conhecido:** registros anteriores a 09/08/2026 marcados como `site` podem ser de qualquer origem online â€” nÃ£o hÃ¡ como separÃ¡-los retroativamente.
## 29.0.0 â€” MÃ³dulo financeiro (entrada, saÃ­da, lucro e taxa da maquininha)

Pedido do Juliano: controlar entrada e saÃ­da de dinheiro, com total gasto no mÃªs contra o faturado e o lucro lÃ­quido.

**A simplificaÃ§Ã£o que definiu o desenho**: o faturamento jÃ¡ existe no banco (`bookings` concluÃ­dos, serviÃ§o + produtos). O mÃ³dulo nÃ£o pede lanÃ§amento de receita â€” sÃ³ de saÃ­da, e o lucro sai por subtraÃ§Ã£o. Metade do trabalho jÃ¡ estava feita.

**Migrations 098 e 099**: `finance_categories` (14 categorias, classificadas em `fixo`/`variavel`/`retirada`), `finance_entries` (lanÃ§amentos), `finance_fee_rates` (taxas do PagBank) e a coluna `bookings.fee_passed_to_customer`. Todas com RLS `is_admin()` **e** `GRANT` de base â€” a liÃ§Ã£o da migration 058.

**Tela nova** `admin-financeiro.html` + `admin-financeiro-v29.js`, ligada no menu das 15 pÃ¡ginas do admin:
- CartÃµes de Faturamento, Despesas, Lucro do negÃ³cio e Sobrou depois da retirada
- **Ponto de equilÃ­brio**: quanto falta para cobrir os custos e quantos atendimentos isso representa ao ticket mÃ©dio do mÃªs; quando a receita passa as despesas, mostra em que dia isso aconteceu
- **Taxa da maquininha** por dia, semana e mÃªs, quebrada por modalidade
- LanÃ§amento rÃ¡pido e botÃ£o "repetir fixos do mÃªs passado" para despesas recorrentes

**Melhorias sobre o pedido original, e o porquÃª de cada uma:**
- **Fixo x variÃ¡vel separados** â€” sÃ³ assim dÃ¡ para responder "quanto preciso faturar para nÃ£o ter prejuÃ­zo".
- **Retirada fora das despesas** â€” o que o dono tira nÃ£o Ã© custo do negÃ³cio. Misturado, o painel nunca diria se a barbearia se paga.
- **Categoria "AnÃºncios"** â€” nÃ£o estava na lista do Juliano e Ã© ~R$ 600/mÃªs, mais de um quarto do faturamento. Sem ela o mÃ³dulo mentiria por omissÃ£o no primeiro mÃªs.
- **RecorrÃªncia com um clique** â€” controle financeiro de pequeno negÃ³cio morre por atrito, nÃ£o por falta de recurso.

**Taxa da maquininha â€” decisÃ£o de desenho.** O pedido original era upload do extrato diÃ¡rio. Descartado: cartÃ£o soma ~R$ 634/mÃªs, entÃ£o a taxa fica entre R$ 15 e R$ 28 â€” desproporcional para um recurso de trabalho diÃ¡rio. Como o sistema jÃ¡ registra `payment_method`, as alÃ­quotas contratuais bastam para calcular sozinho, e batem com o extrato. Taxas conferidas pelo Juliano no app do PagBank em 08/08/2026 (Visa/Mastercard, recebimento na hora): **dÃ©bito 2,12%**, **crÃ©dito Ã  vista 4,61%**. Pix por chave Ã© **0%** (o padrÃ£o da casa); Pix pela maquininha custaria 0,99%.

O atendimento continua registrando o valor cobrado, e a taxa entra como despesa quando nÃ£o repassada â€” em vez de descontar no prÃ³prio atendimento, o que quebraria a comparaÃ§Ã£o de faturamento entre meses.

Testado com `npm run test:admin`: 26/26, incluindo a tela nova.
## 28.48.0 â€” Garantia de ajuste no acabamento + correÃ§Ã£o das cortesias

DecisÃ£o do Juliano em 08/08/2026, ao revisar a copy dos anÃºncios: assumir publicamente o compromisso de refazer o acabamento sem cobrar. RedaÃ§Ã£o fixada e replicada em todos os pontos de contato:

> **"Se o acabamento nÃ£o ficou como vocÃª queria, volte e a gente ajusta sem cobrar nada."**

- **Home** (`index.html`): entrou na faixa de diferenciais (primeiro item), num card novo do bloco "antes de vir", no FAQ visÃ­vel e no schema `FAQPage` (pergunta "E se eu nÃ£o gostar do acabamento?").
- **Agendamento** (`agendar/horario/index.html`): a garantia aparece na Etapa 4, embaixo do botÃ£o Confirmar â€” que Ã© o momento de hesitaÃ§Ã£o.
- **JuIA** (`ju-ia-site/index.ts`): passou a conhecer a garantia e a oferecÃª-la quando o cliente demonstrar receio de nÃ£o gostar do resultado ou perguntar diretamente. InstruÃ­da explicitamente a **nunca prometer devoluÃ§Ã£o de dinheiro** â€” a garantia Ã© de ajuste, nÃ£o de reembolso. A garantia tambÃ©m entrou na lista de argumentos usados na objeÃ§Ã£o de preÃ§o.

**CorreÃ§Ã£o de fato, junto**: o site dizia "CafÃ© cortesia, Ã¡gua, refrigerante, energÃ©tico ou bebida gelada" de um jeito que sugeria que tudo era cortesia. Confirmado com o Juliano que **sÃ³ o cafÃ© Ã© por conta da casa**; as demais bebidas sÃ£o vendidas. Corrigido em `agendar/index.html`, no FAQ da home, no schema e no prompt da JuIA.

**DecisÃ£o registrada â€” o que NÃƒO foi feito**: o Juliano se dispÃ´s a anunciar tambÃ©m ressarcimento do pagamento em caso de insatisfaÃ§Ã£o. Recomendei nÃ£o anunciar, e ele acatou. Motivos: publicidade obriga o anunciante; ressarcimento custa o ticket mais a cadeira ocupada (recurso escasso num barbeiro sozinho); e o gesto vale mais feito caso a caso, sem ter sido prometido, do que virando polÃ­tica que se testa. Continua podendo ressarcir quando julgar justo â€” sÃ³ nÃ£o estÃ¡ anunciado.
## 28.47.2 â€” Segunda bateria de testes robustos (prÃ©-lanÃ§amento oficial do uso diÃ¡rio)

Varredura completa pedida pelo Juliano ("achar e corrigir bugs pra ferramenta ficar 100%"). Achados e correÃ§Ãµes:

- **Corrida do Rejeitar durante publicaÃ§Ã£o**: rejeitar um card em "Publicandoâ€¦" gravava 'rejeitado', mas a publicaÃ§Ã£o que jÃ¡ rodava no servidor continuava e sobrescrevia pra 'publicado' no final â€” a tela dizia "rejeitado" e o post saÃ­a de verdade. Agora o Rejeitar sÃ³ funciona em rascunho puro (condiÃ§Ã£o atÃ´mica no update) e avisa com clareza quando chega tarde.
- **Flake real de teste com causa raiz interessante**: novo spec permanente `admin-conteudo.spec.js` (4 testes: roteamento da function certa por plataforma, rejeitar move de aba, validaÃ§Ãµes do formulÃ¡rio) falhava ~50% das vezes no passo de abrir o formulÃ¡rio. Causa: o `admin-pwa.js` recarrega a pÃ¡gina quando o service worker assume o controle na primeira visita â€” e em teste TODA visita Ã© primeira; o clique corria contra o reload e era desfeito. Corrigido com stub do service worker no harness de teste (`_supabase-mock.js`) â€” usuÃ¡rio real nÃ£o Ã© afetado, e a suÃ­te inteira ficou ~4x mais rÃ¡pida de quebra (os reloads atrasavam todos os testes).
- **Sondas de seguranÃ§a ao vivo (tudo negado corretamente)**: SELECT/INSERT/UPDATE em `content_posts` com a chave anÃ´nima do site â†’ permission denied/401; as 3 functions de publicaÃ§Ã£o sem sessÃ£o de admin â†’ 401; `content-generate-daily` sem o secret â†’ 401.
- **Pipeline do gerador diÃ¡rio validado de ponta a ponta**: reexecutada a MESMA chamada que o cron farÃ¡ amanhÃ£ Ã s 8h (secret real do vault) â†’ respondeu `{"ok":true,"skipped":"fechado_hoje"}` correto pra segunda-feira. A Ãºnica parte que ainda nÃ£o rodou em produÃ§Ã£o Ã© o loop novo de gerar 2 rascunhos (Status+Facebook), que sÃ³ executa em dia aberto â€” primeira execuÃ§Ã£o real Ã© amanhÃ£ (terÃ§a) Ã s 8h; conferir os 2 rascunhos no push/admin.
- SuÃ­te agora com 21 testes, 21/21 passando (3 rodadas consecutivas do spec novo sem flake).

## 28.47.1 â€” Fix: tela travava pra sempre se o servidor nÃ£o respondesse

Achado ao vivo, em 2 tentativas seguidas do Juliano com o Story do Facebook: (1) primeira vez, a chamada ao servidor nÃ£o retornou nenhuma resposta (sem log de conclusÃ£o) e o `fetch()` do navegador, sem limite de espera, ficou preso em "Publicando..." pra sempre â€” rascunho preso em `aprovado` liberado manualmente; (2) segunda vez, a function respondeu rÃ¡pido com erro **"The signal has been aborted"** â€” o timeout de 20s configurado pro passo `/photo_stories` da Meta (endpoint mais raro, parece ser mais lento que os outros) estava curto demais, mesma classe de problema jÃ¡ visto antes com a Evolution API do WhatsApp (que tambÃ©m precisou de mais tempo).

- Adicionado limite de 100s na chamada do navegador (cobre com folga o pior caso real, que Ã© o Instagram esperando a imagem processar). Se estourar, a tela volta ao normal com aviso claro: **nÃ£o significa que falhou** â€” orienta conferir direto no Facebook/Instagram/WhatsApp antes de tentar de novo, pra nÃ£o publicar duplicado (mesma cautela jÃ¡ usada no timeout do Status do WhatsApp).
- Timeouts internos da Meta subiram de 20s pra 35s (todas as chamadas de escrita) e 45s especÃ­fico pro passo `/photo_stories` do Story do Facebook, que foi o que estourou de verdade.
- A trava de publicaÃ§Ã£o dupla (lease de 3 min, da v28.46.1) jÃ¡ cobre o lado do banco â€” depois desse prazo, uma nova tentativa consegue retomar o rascunho sozinha mesmo sem essa correÃ§Ã£o.

## 28.47.0 â€” Story do Facebook e do Instagram na Central de ConteÃºdo

- **`content-publish-meta` ganha 2 novos destinos**: Story do Facebook (fluxo em 2 passos verificado na documentaÃ§Ã£o da Meta â€” sobe a foto sem publicar via `/{page-id}/photos?published=false`, depois publica como story via `/{page-id}/photo_stories`) e Story do Instagram (mesmo container de mÃ­dia do feed, sÃ³ troca `media_type=STORIES`; Story nÃ£o tem campo de legenda na API â€” o texto precisa estar na prÃ³pria imagem). Mesma trava de publicaÃ§Ã£o dupla e validaÃ§Ã£o de link absoluto dos outros destinos.
- **LimitaÃ§Ã£o real, sem soluÃ§Ã£o por API**: Story publicado por aqui **nÃ£o tem o link clicÃ¡vel** â€” a figurinha de link do Instagram sÃ³ existe pelo app do celular. Serve pra alcance/visibilidade; quem quiser o link clicÃ¡vel no Story ainda precisa publicar manualmente pelo celular.
- Admin: formulÃ¡rio de criaÃ§Ã£o manual e cards de rascunho jÃ¡ reconhecem os 2 novos tipos, com aviso de que o texto digitado Ã© sÃ³ anotaÃ§Ã£o interna (nÃ£o sai publicado no Story).

## 28.46.1 â€” Auditoria de robustez da Central de ConteÃºdo (prÃ©-lanÃ§amento do uso diÃ¡rio)

RevisÃ£o completa pedida pelo Juliano antes de comeÃ§ar a usar a ferramenta "100% na vida real". 3 problemas reais encontrados e corrigidos:

- **Clique duplo publicava 2x**: se o botÃ£o de publicar fosse acionado em duas abas/dispositivos ao mesmo tempo (ou num retry apÃ³s timeout â€” exatamente o acidente que jÃ¡ tinha acontecido no primeiro Status), as duas chamadas passavam pela checagem e publicavam DUAS vezes. Agora as duas functions de publicaÃ§Ã£o usam o status `'aprovado'` como trava atÃ´mica (sÃ³ quem consegue mudar `rascunhoâ†’aprovado` publica; segunda chamada recebe 409), com lease de 3 minutos (`approved_at`) pra nunca deixar um rascunho preso se a function morrer no meio. UI mostra posts "Publicandoâ€¦" na aba Rascunhos.
- **Link de imagem relativo falhava silenciosamente**: a Meta e a Evolution buscam a imagem pelos prÃ³prios servidores delas â€” um caminho relativo (`/assets/foo.jpg`) funciona na prÃ©via do admin mas falha na publicaÃ§Ã£o com erro genÃ©rico. Bloqueado nos 3 pontos (formulÃ¡rio, `content-publish-meta`, `content-publish-whatsapp`) com mensagem clara pedindo o link completo `https://`.
- **Espera do processamento do Instagram era curta**: 5 tentativas de 2s podia estourar numa imagem maior; agora 10 tentativas de 2.5s (~25s), ainda bem dentro do limite da function.

TambÃ©m verificado (sem problema encontrado): cron `bdj-content-generate-daily` ativo (8h BRT, diÃ¡rio); as duas functions de publicaÃ§Ã£o rejeitam corretamente chamadas sem sessÃ£o de admin (401 testado ao vivo); `get_advisors` de seguranÃ§a sem nenhum achado novo; suÃ­te de 16 testes do admin passando.

## 28.46.0 â€” Criar rascunho manual na Central de ConteÃºdo + gerador diÃ¡rio ganha Facebook

- **`content-generate-daily` agora tambÃ©m propÃµe um rascunho de Facebook por dia** (texto, mesmo fato real usado pro Status â€” vaga aberta ou serviÃ§o em destaque), alÃ©m do Status do WhatsApp que jÃ¡ existia. Guarda de "jÃ¡ gerado hoje" agora Ã© por plataforma (antes bloqueava os dois se qualquer um jÃ¡ tivesse sido gerado). Instagram fica de fora do gerador automÃ¡tico por enquanto â€” a Graph API exige imagem e ainda nÃ£o existe geraÃ§Ã£o automÃ¡tica de arte.
- **Central de ConteÃºdo ganha criaÃ§Ã£o manual pela prÃ³pria tela** (`admin-conteudo.html`): botÃ£o "+ Novo rascunho" abre um formulÃ¡rio (plataforma, texto, link de imagem opcional â€” obrigatÃ³rio pro Instagram) e salva direto, sem precisar de mim/SQL. Precisou de `grant insert on content_posts to authenticated` (RLS jÃ¡ cobria, faltava o GRANT de base â€” mesma liÃ§Ã£o da migration 058).
- **Bug de CSS achado testando de propÃ³sito**: `.conteudo-new-form{display:grid}` tinha especificidade maior que a regra `[hidden]{display:none}` do navegador â€” o formulÃ¡rio nunca ficava de fato escondido, mesmo com o atributo `hidden` certo no HTML. Corrigido com `.conteudo-new-form[hidden]{display:none}` explÃ­cito.

## 28.45.0 â€” PublicaÃ§Ã£o no Facebook/Instagram via Meta Graph API + fix do Instagram na JuIA

- **Bug real corrigido**: a JuIA respondia o handle do Instagram errado pra clientes (sem o underscore final â€” flagrado pelo Juliano num atendimento real). Causa: o prompt nunca informava o Instagram oficial, entÃ£o o modelo "chutava" um handle plausÃ­vel. Adicionado `@barbeariadoju_` como dado real do negÃ³cio no prompt (mesmo padrÃ£o de endereÃ§o/horÃ¡rio/pagamento â€” nunca inventar, sempre informar). Testado ao vivo (`curl` direto na function): resposta agora sai correta.
- **Central de ConteÃºdo ganha Facebook e Instagram** (Fase 1 da Central de Marketing via Meta Graph API, depois de configurar app/usuÃ¡rio de sistema/tokens no Meta for Developers): nova edge function `content-publish-meta` (verify_jwt=true, sÃ³ admin) publica de fato via Graph API â€” Facebook como foto (com legenda) ou post de texto puro sem imagem; Instagram sempre com imagem (cria o container, espera processar, publica). Mesmo princÃ­pio de seguranÃ§a do Status do WhatsApp: nunca publica sozinho, sempre um clique explÃ­cito do Juliano no admin. `content_posts.platform` agora aceita `facebook`/`instagram` alÃ©m de `whatsapp_business`; nova coluna `meta_post_id` guarda o ID retornado pela Meta.
- `admin-conteudo.html`/`admin-conteudo-v28.js`: cada card agora mostra a plataforma (Status do WhatsApp / Facebook / Instagram) e o botÃ£o de aprovar jÃ¡ chama a function certa pra cada uma.
- Credenciais da Meta (token de usuÃ¡rio de sistema, ID da PÃ¡gina, ID do Instagram) guardadas como secrets do Supabase â€” nunca passaram pelo chat/repo.

## 28.44.5 â€” PrÃ©via visual do Status na Central de ConteÃºdo (pedido do Juliano)

- **PrÃ©via da arte no card de aprovaÃ§Ã£o**: antes de aprovar, o `admin-conteudo.html` agora mostra a imagem exatamente como serÃ¡ publicada (quando o rascunho tem `context.image_url`), com a legenda logo abaixo â€” "assim eu jÃ¡ solicito as ediÃ§Ãµes necessÃ¡rias antes de cada post e evito expor de forma ruim". Rascunhos sÃ³-texto ganham um aviso de que o WhatsApp renderiza sobre fundo escuro. Fixture atualizada pra exercitar a prÃ©via no teste (16/16).
- TambÃ©m gerada a **capa quadrada do produto pra Hotmart** (1080Ã—1080, recorte da arte da campanha) â€” a imagem original do produto (Juliano aparando uma nuca) nÃ£o tinha relaÃ§Ã£o com um e-book de barba, observaÃ§Ã£o do prÃ³prio Juliano.

## 28.44.4 â€” Anti-papagaio no WhatsApp + fonte do Status de texto (Bebas Neue)

- **Fonte do Status de texto trocada (feedback do Juliano no teste real)**: o Status de texto saiu com a fonte serifada do WhatsApp (nÃºmeros oldstyle "caÃ­dos", "OFF" maiÃºsculo feio) â€” era o `font: 1` da Evolution. Trocado pra `font: 4` (Bebas Neue, a mesma fonte de display do site). SÃ³ afeta o fallback de texto â€” o **padrÃ£o oficial de anÃºncio** agora Ã© Status de IMAGEM (arte com a identidade do site + legenda curta com link, renderizada na fonte padrÃ£o limpa do WhatsApp), definido com o Juliano pra todos os anÃºncios futuros.

- **Caso real (Juliano, 02/08/2026)**: ele encaminhou pro nÃºmero da barbearia 3 mensagens de divulgaÃ§Ã£o do e-book (link da Hotmart + textos promocionais), todas contendo a palavra "barba" â€” e a JuIA respondeu o MESMO menu "Temos algumas opÃ§Ãµes de barba..." 3 vezes seguidas, uma pra cada mensagem (espaÃ§adas por mais de 6s, entÃ£o o debounce de mensagens picadas nÃ£o agrupa). A 4Âª mensagem foi a recusa educada da foto (print de Status â†’ `NAO_RELACIONADO`), que individualmente Ã© o comportamento correto.
- **Fix no `whatsapp-webhook` (v29)**: antes de enviar a resposta gerada pela IA, compara com a Ãºltima mensagem que o bot mandou pra esse telefone â€” se for idÃªntica e tiver menos de 10 minutos, suprime o envio (loga e sai em silÃªncio). SÃ³ se aplica ao fluxo da IA; os blocos transacionais (confirmaÃ§Ã£o de presenÃ§a, lista de espera, pesquisa) nÃ£o passam por essa trava, porque neles a repetiÃ§Ã£o Ã© intencional ("responda sim ou nÃ£o").

## 28.44.3 â€” Status com imagem (arte real) + limpeza dos 2 Status feios do primeiro teste

- **Descoberta do teste real**: os DOIS cliques em "publicar" tinham publicado (o primeiro, que "falhou" com timeout, tambÃ©m foi â€” a Evolution continuou processando depois do abort, exatamente o cuidado documentado na 28.44.2). Resultado: 2 Status de texto puro no ar, com o link renderizado como um preview minÃºsculo e feio. O Juliano pediu pra apagar e refazer profissional.
- **Limpeza**: ponte `dev-admin-tools` reativada temporariamente (mesmo padrÃ£o de sempre: token aleatÃ³rio de uso Ãºnico, desativada logo depois â€” ver histÃ³rico de deploys) pra localizar os 2 Status via `POST /chat/findMessages` (filtro `remoteJid='status@broadcast'`) e revogÃ¡-los pra todos via `DELETE /chat/deleteMessageForEveryone`.
- **Melhoria de verdade**: `content-publish-whatsapp` agora suporta **Status de imagem** â€” se o rascunho tiver `context.image_url`, publica `type:'image'` com a arte + legenda, em vez de texto puro. A arte promocional do e-book virou asset pÃºblico do site (`assets/promo-guia-barba-status.jpg`, JPG otimizado de 154KB â€” a Evolution busca a imagem por URL pÃºblica). Novo rascunho criado com a arte + legenda curta com o link de compra, aguardando aprovaÃ§Ã£o do Juliano no admin (fluxo de aprovaÃ§Ã£o humana preservado â€” a correÃ§Ã£o nÃ£o abriu atalho por fora dele).

## 28.44.2 â€” Timeout de 90s no sendStatus (segundo bug real do teste ao vivo)

- **Depois do fix de CORS, segundo erro real**: "The signal has been aborted" â€” logs confirmaram a funÃ§Ã£o morrendo em exatos 20,2s, no timeout de 20s que eu mesmo tinha configurado pra chamada `sendStatus` da Evolution API. Publicar Status com `allContacts:true` Ã© lento (a Evolution enumera todos os contatos pra distribuir). Timeout subiu pra 90s. **Cuidado operacional documentado**: quando esse timeout estoura, a Evolution pode ter continuado processando e publicado o Status mesmo assim â€” antes de clicar em "publicar" de novo, conferir no celular se o Status jÃ¡ apareceu (senÃ£o sai duplicado); se apareceu, marcar a linha como `publicado` direto no banco em vez de republicar.

## 28.44.1 â€” Corrige CORS do content-publish-whatsapp (erro real: "Failed to fetch")

- **Bug real achado pelo Juliano ao testar pela primeira vez**: clicar em "Aprovar e publicar" retornava `NÃ£o foi possÃ­vel publicar: Failed to fetch` â€” erro de CORS, nÃ£o erro do servidor (a funÃ§Ã£o nunca chegava a rodar). Faltavam os headers `Access-Control-Allow-*` na resposta do `OPTIONS` (preflight) e nas respostas normais â€” Ãºnico edge function client-facing do projeto que nÃ£o tinha isso (todos os outros, como `ju-ia-admin`, jÃ¡ seguiam esse padrÃ£o). Corrigido copiando o mesmo `corsHeaders` jÃ¡ usado em `ju-ia-admin`. Confirmado via requisiÃ§Ã£o `OPTIONS` real que os headers agora retornam certo antes de pedir pro Juliano testar de novo. Rascunho de teste ficou intacto (nunca chegou a mudar de status), sem necessidade de limpeza.

## 28.44.0 â€” Central de ConteÃºdo v1: rascunho diÃ¡rio de Status com aprovaÃ§Ã£o humana

- **Novo, pedido do Juliano apÃ³s avaliar uma proposta de automaÃ§Ã£o total**: rascunho diÃ¡rio de Status do WhatsApp gerado por IA, mas **nunca publicado sozinho** â€” decisÃ£o consciente apÃ³s pesar o risco de suspensÃ£o do nÃºmero (o mesmo que roda a JuIA) por padrÃ£o de bot detectÃ¡vel em publicaÃ§Ã£o automÃ¡tica recorrente. Toda publicaÃ§Ã£o exige um clique explÃ­cito do Juliano.
- **Migration 076**: tabela `content_posts` (RLS via `is_admin()`, GRANT `authenticated`=SELECT/UPDATE e `service_role`=INSERT/SELECT/UPDATE, mesmo padrÃ£o de todo o projeto) e RPC `pick_featured_service()` (rotaciona entre serviÃ§os ativos por dia do ano, sempre com preÃ§o/duraÃ§Ã£o reais de `public.services`, nunca inventado).
- **Edge function `content-generate-daily`** (cron `bdj-content-generate-daily`, 8h BRT todo dia): checa se a barbearia abre hoje (pula domingo/segunda), evita gerar duas vezes no mesmo dia, e monta o fato do dia com dado real â€” vaga aberta hoje (via `get_available_slots`) ou serviÃ§o em destaque (via `pick_featured_service`) quando a agenda jÃ¡ estÃ¡ cheia. O texto em si Ã© escrito por IA (gpt-5.6-luna, mesma usada na JuIA) a partir desse fato real â€” nunca inventa preÃ§o/horÃ¡rio â€” com fallback determinÃ­stico se a IA falhar. Avisa o Juliano por push quando o rascunho fica pronto.
- **Edge function `content-publish-whatsapp`** (verify_jwt=true, sÃ³ admin autenticado): Ãºnico ponto do sistema que de fato chama `POST /message/sendStatus/{instance}` da Evolution API (endpoint confirmado na documentaÃ§Ã£o oficial antes de implementar). Reverte pra rascunho se a publicaÃ§Ã£o falhar, pra nÃ£o perder o texto.
- **Tela `admin-conteudo.html`** + `admin-conteudo-v28.js`: abas Rascunhos/Publicados/Rejeitados, legenda editÃ¡vel antes de aprovar, botÃµes "Aprovar e publicar" / "Rejeitar". Link adicionado no menu lateral de todas as 14 pÃ¡ginas do admin.
- **Escopo definido deliberadamente pra essa v1** (registrado, nÃ£o esquecido): agendamento oficial via API da Meta pra Instagram/Facebook (exige App Review da Meta, processo Ã  parte, similar ao que jÃ¡ estÃ¡ em andamento pro Google Reviews) e rastreamento de cliques ficam pra uma prÃ³xima etapa.
- Testado: geraÃ§Ã£o real contra o banco (`get_available_slots`/`pick_featured_service` confirmados com dado real de terÃ§a-feira; hoje sendo domingo, a funÃ§Ã£o corretamente pulou com `skipped:'fechado_hoje'`), fixture nova (`mock-cp-1/2/3`) cobrindo os 3 status, `npm run test:admin` (16/16) e regressÃ£o geral. `get_advisors` sem findings novos nos objetos criados.

## 28.43.3 â€” Copy mais curta e direta no box do e-book (7 artigos)

- **Texto do `.ebook-promo` encurtado** a pedido do Juliano: tÃ­tulo vira pergunta direta ("Quer aprender tudo sobre cuidados com a barba?"), descriÃ§Ã£o cai pra uma linha, removida a menÃ§Ã£o Ã  garantia de 7 dias dentro do box (jÃ¡ fica visÃ­vel na prÃ³pria pÃ¡gina de checkout), botÃ£o passa de "Quero o guia completo â†’" pra "Comprar agora". PreÃ§o com valor real (R$49,99 â†’ R$24,99) mantido â€” converte melhor que sÃ³ citar "50% de desconto" em texto solto. Testado nos 7 artigos + regressÃ£o geral.

## 28.43.2 â€” RevisÃ£o profunda de acabamento (pedido do Juliano: "padrÃ£o premium estilo Apple")

- **Auditoria completa de tudo desta sessÃ£o** (Playwright em desktop 1280px e mobile 375px, screenshots reais + estilos computados): hero com 4 botÃµes, seÃ§Ã£o Centro de Conhecimento, blocos `.product-pick` (10 artigos) e `.ebook-promo` (7 artigos), seÃ§Ã£o Sazonal do blog. Zero overflow horizontal em mobile; blocos do e-book quebram linha corretamente no celular.
- **4 despadronizaÃ§Ãµes encontradas e corrigidas**:
  1. **Card "Sazonal" Ã³rfÃ£o no `blog.html`** â€” 1 card sozinho numa grade de 3 colunas ficava visualmente torto sob o tÃ­tulo gigante "Cuidados por estaÃ§Ã£o". Nova classe `.link-card.featured` (`grid-column:1/-1`): o card agora ocupa a largura toda, como um destaque proposital. PadrÃ£o reutilizÃ¡vel pra qualquer seÃ§Ã£o futura com artigo Ãºnico.
  2. **Raios de borda divergentes** â€” `.product-pick` usava 14px enquanto `.ebook-promo` e `.series-nav` usam 16px. Unificado em 16px.
  3. **17 estilos inline repetidos** â€” o texto de disclosure de comissÃ£o da Amazon carregava `style="font-size:.82rem;..."` colado em cada ocorrÃªncia (10 arquivos). Virou classe Ãºnica `.promo-disclosure` no CSS; qualquer ajuste futuro Ã© feito num lugar sÃ³.
  4. **`&` sem escape em 10 hrefs de afiliado** â€” `&tag=` virou `&amp;tag=` (validade HTML + convenÃ§Ã£o jÃ¡ usada no restante do site, ex. link do Google Fonts). O navegador decodifica de volta, link funciona idÃªntico (confirmado por teste lendo o href do DOM).
- Bump de cache coordenado (`?v=28.43.2` nas 62 pÃ¡ginas + `@import` + preload), seguindo a liÃ§Ã£o da v28.43.1. RegressÃ£o completa: 11/11 site + 15/15 admin.

## 28.43.1 â€” Bug real: cache de `style.css` travado hÃ¡ muitas versÃµes + botÃ£o do blog no hero

- **Bug real encontrado pelo Juliano** (visual quebrado no `.ebook-promo` em produÃ§Ã£o â€” preÃ§o/tag tudo grudado, sem espaÃ§amento nem estilo de pÃ­lula): 61 das 62 pÃ¡ginas HTML do site referenciavam `<link href="/style.css?v=28.21.1">` â€” uma versÃ£o de cache muito antiga, nunca atualizada desde entÃ£o (mesmo "quirk" de versionamento jÃ¡ documentado no projeto). Como o parÃ¢metro `?v=` nunca mudava nessas pÃ¡ginas, navegadores/CDN podiam continuar servindo uma cÃ³pia em cache do `style.css` de muito tempo atrÃ¡s, que nunca chegava a puxar o `04-agenda-admin-core.css` atualizado (onde vivem `.product-pick`, `.priority-table`, `.ebook-promo` etc.) â€” o CSS novo simplesmente nunca era buscado de novo pelo navegador. Corrigido bumpando `?v=` pra `28.43.0` (batendo com `VERSAO.md`) em **todas** as 62 pÃ¡ginas de uma vez, evitando deixar esse mesmo problema se repetir silenciosamente em qualquer outra pÃ¡gina. TambÃ©m corrigido o `<link rel="preload">` do `04-agenda-admin-core.css` no `index.html`, que apontava pra uma versÃ£o ainda mais antiga (`28.29.3`).
- **Novo botÃ£o "ðŸ“– Blog: dicas de barba e cabelo"** na fileira de botÃµes do hero da home (pedido explÃ­cito do Juliano â€” antes o blog sÃ³ era acessÃ­vel pelo rodapÃ© ou pela seÃ§Ã£o "Centro de Conhecimento" mais abaixo na pÃ¡gina; agora tem um CTA com o mesmo destaque visual dos outros 3 botÃµes principais, visÃ­vel logo na primeira dobra).
- Testado renderizando de verdade contra o servidor local (Playwright): confirmado `display:flex` aplicado no preÃ§o do e-book (antes a regra nunca chegava a rodar) e o botÃ£o do blog visÃ­vel no hero. RegressÃ£o geral (`routes.spec.js`/`cart.spec.js`) e `npm run test:admin` (15/15) sem problemas.

## 28.43.0 â€” LanÃ§amento do e-book "Guia Definitivo da Barba" (Hotmart) + destaque do blog na home

- **Primeiro produto digital Ã  venda**: "Guia Definitivo da Barba" (25 pÃ¡ginas, capÃ­tulo completo sobre crescimento/genÃ©tica/minoxidil com cautela mÃ©dica, fotos reais, QR codes, bÃ´nus) publicado na Hotmart (produto `S106993067N`), preÃ§o cheio R$49,99 com cupom de lanÃ§amento `LANCAMENTO` (R$24,99, ~50% off, vÃ¡lido atÃ© 01/09/2026). Garantia de 7 dias (padrÃ£o da Hotmart, jÃ¡ ativa). Link de checkout com cupom prÃ©-aplicado: `https://pay.hotmart.com/S106993067N?offDiscount=LANCAMENTO` (parÃ¢metro oficial da Hotmart pra aplicar cupom via URL sem o cliente digitar nada).
- **Componente novo `.ebook-promo`** (`css/04-agenda-admin-core.css`) inserido nos 7 artigos do blog realmente sobre cuidados com a barba (barba encravada/ressecada, barboterapia, formato de barba ideal, produtos profissionais x caseiros, reduzir irritaÃ§Ã£o pÃ³s-barbear, ingredientes de produtos, cuidados de inverno) â€” preÃ§o com desconto, tag "50% off Â· lanÃ§amento", menÃ§Ã£o Ã  garantia de 7 dias, botÃ£o de compra. ComunicaÃ§Ã£o evita a palavra "PDF" (soa mais bÃ¡sico) em favor de "e-book premium" â€” sugestÃ£o de quem revisou o material antes do lanÃ§amento.
- **Nova seÃ§Ã£o de destaque na home** (`index.html`, reaproveitando o mesmo estilo visual do card de avaliaÃ§Ãµes do Google): "Centro de Conhecimento" com botÃ£o pro blog e pro e-book â€” antes o blog sÃ³ era acessÃ­vel pelo rodapÃ©, escondido; pedido explÃ­cito do Juliano pra dar mais Ãªnfase a essa seÃ§Ã£o.
- **Lembrete agendado** pra 28/08/2026 (poucos dias antes do cupom expirar em 01/09) perguntando ao Juliano se quer estender o prazo ou deixar expirar.
- Testado com Playwright (specs temporÃ¡rios cobrindo os 7 artigos + home: preÃ§o correto, link correto, sem a palavra "PDF", zero erro de console) + regressÃ£o geral (`routes.spec.js`/`cart.spec.js`) e `npm run test:admin` (15/15), specs apagados depois.

## 28.42.0 â€” Link de afiliado Amazon propagado pros outros 9 artigos do blog

- **PropagaÃ§Ã£o do componente `.product-pick`** (introduzido em v28.41.0) pros 9 artigos restantes do blog que faziam sentido â€” 2 artigos (`blog-como-funciona-agendamento-juia.html`, sobre agendamento, e `blog-quanto-custa-corte-braganca-paulista.html`, sobre preÃ§o) foram deliberadamente deixados de fora por nÃ£o terem um produto complementar que se encaixasse organicamente; forÃ§ar um item ali pareceria spam e destoaria do padrÃ£o editorial de credibilidade (E-E-A-T) jÃ¡ estabelecido no site.
- **Produto escolhido caso a caso, ligado ao conteÃºdo real do artigo** (todos complementares, nenhum concorrendo com o que a Barbearia do Ju jÃ¡ vende no balcÃ£o â€” Ã³leo, balm, pomada, gel, shampoo/condicionador): escova de cerdas naturais (barba encravada/ressecada), aquecedor de toalhas elÃ©trico (barboterapia, ecoa o passo da toalha quente), espelho de aumento com LED (fade baixo/alto), tesoura de precisÃ£o (formato de barba ideal), protetor solar facial (ingredientes de produtos, ecoa a discussÃ£o de barreira da pele), secador com difusor (melhor corte pra rosto redondo), nÃ©cessaire organizadora (produtos profissionais x caseiros), rolo de gelo facial/ice roller (reduzir irritaÃ§Ã£o pÃ³s-barbear), aparador elÃ©trico de acabamento (tendÃªncias de corte 2026).
- Todos os links usam a tag real `barbeariadoju-20`, `rel="sponsored noopener"` e o mesmo texto de disclosure exigido pelo acordo da Amazon. Testado com Playwright (spec temporÃ¡rio cobrindo os 9 arquivos: link presente, tag correta, badge correto, zero erro de console) + regressÃ£o geral (`routes.spec.js`/`cart.spec.js`), specs apagados depois.

## 28.41.0 â€” Item 5: novo artigo de blog (cuidados de inverno) + base de monetizaÃ§Ã£o por afiliados

- **Novo artigo** `blog-cuidados-barba-pele-inverno.html` (item 5 da lista de melhorias, tema escolhido pelo Juliano): por que o frio resseca mais a barba e a pele (xerose cutÃ¢nea, queda de umidade do ar, banho quente), cuidados no dia a dia e quando procurar um dermatologista. Segue o padrÃ£o editorial jÃ¡ fixado no projeto: `.practice-note`/`.pharma-note`/`.warning-note`, data de publicaÃ§Ã£o, seÃ§Ã£o "Fontes consultadas" com 4 fontes reais (Sociedade Brasileira de Dermatologia, American Academy of Dermatology, DermNet NZ, Manual MSD), interlinkagem com o artigo de barba encravada/ressecada (link recÃ­proco nos dois sentidos) e com barboterapia. Adicionado em `blog.html` (nova seÃ§Ã£o "Sazonal", jÃ¡ que nÃ£o Ã© parte da sÃ©rie fechada "CiÃªncia da Barba") e em `sitemap.xml`.
- **Nova peÃ§a de monetizaÃ§Ã£o (pedido do Juliano)**: componente `.product-pick` (CSS novo em `css/04-agenda-admin-core.css`, bump do `?v=` no `@import` de `style.css`) â€” bloco reutilizÃ¡vel de "sugestÃ£o de produto" pra indicar itens complementares (que a barbearia NÃƒO vende no balcÃ£o, pra nÃ£o concorrer com a venda prÃ³pria de Ã³leo/balm/pomada) via link de afiliado Amazon. Usado nesse primeiro artigo com "umidificador de ambiente" (recomendaÃ§Ã£o da AAD contra o ar seco do inverno). **Ainda sem tag de afiliado real** â€” o link aponta pra uma busca genÃ©rica na Amazon (funcional, honesto, sem comissÃ£o ainda) atÃ© o Juliano concluir o cadastro no Amazon Associados; assim que tiver a tag, o link entra em todos os artigos (planeado: ~5 produtos por artigo).
- **Plano combinado com o Juliano pra monetizaÃ§Ã£o mais ampla**: (1) Amazon Associados pra links de afiliado nos ~12 artigos do blog; (2) venda de PDFs aprofundados por artigo via Hotmart (checkout com Pix/cartÃ£o/boleto + entrega automÃ¡tica por e-mail, sem precisar construir gateway de pagamento prÃ³prio). Ambos exigem cadastro pessoal do Juliano (CPF/dados bancÃ¡rios) â€” fora do escopo de cÃ³digo, ele estÃ¡ fazendo os dois cadastros. Assim que tiver a tag da Amazon e o link de checkout da Hotmart do primeiro PDF, o conteÃºdo do PDF Ã© escrito (mesma rÃ©gua de fontes reais/evidÃªncia) e os dois entram nos artigos.
- **AtualizaÃ§Ã£o no mesmo dia â€” tag da Amazon jÃ¡ recebida**: Juliano concluiu o cadastro no Amazon Associados e recebeu a ID `barbeariadoju-20`. Link do artigo de inverno atualizado com `?tag=barbeariadoju-20`, `rel="sponsored noopener"` (atributo recomendado pelo Google pra link pago/afiliado, em vez de sÃ³ `nofollow`), badge trocado de "SugestÃ£o de produto" pra "Link de afiliado", e adicionado o texto de disclosure exigido pelo prÃ³prio acordo operacional da Amazon ("como associado Amazon, a Barbearia do Ju pode receber uma comissÃ£o..."). Cadastro fiscal/bancÃ¡rio na Amazon (sÃ³ ele pode fazer) ainda pendente â€” necessÃ¡rio antes de qualquer saque de comissÃ£o. Regra da Amazon a observar: cadastro Ã© revogado se nenhum link gerar pedido em atÃ© 180 dias.

## 28.40.0 â€” Fecha o loop da lista de espera: JuIA oferece a vaga e confirma pelo WhatsApp (item 1)

- **Novo**: quando uma vaga compatÃ­vel abre (cancelamento ou remarcaÃ§Ã£o, de qualquer origem â€” admin, site, WhatsApp, auto-cancelamento de duplicata), a JuIA agora **avisa diretamente o cliente da lista de espera pelo WhatsApp**, perguntando se ele ainda quer aquele horÃ¡rio. Antes disso, sÃ³ o Juliano era avisado (push) e o encaixe era 100% manual em `admin-espera.html` â€” o cliente nunca sabia que a vaga tinha aberto a menos que ligasse ou mandasse mensagem por conta prÃ³pria.
- **Arquitetura** (mesmo padrÃ£o jÃ¡ validado do item 0, `bookings_notify_leads_slot_reopened`): um Ãºnico trigger Postgres (`bookings_notify_waitlist_slot_reopened`, migration 075) cobre cancelamento/remarcaÃ§Ã£o de qualquer origem, porque todo caminho no fim das contas faz um UPDATE em `public.bookings`. O trigger marca **sÃ³ o candidato mais antigo da fila** cujo pedido realmente cabe no horÃ¡rio liberado â€” checagem extra de duraÃ§Ã£o via `get_available_slots` (nÃ£o basta o horÃ¡rio exato de inÃ­cio estar livre; o serviÃ§o completo do candidato precisa caber, evitando oferecer 14h a quem pediu 1h de serviÃ§o se sÃ³ sobrou 30min). O envio da mensagem em si Ã© feito pelo cron jÃ¡ existente `whatsapp-lead-followup` (a cada 15min), nÃ£o em tempo real pelo trigger â€” decoupling deliberado, mesmo racional do item 0.
- **ConfirmaÃ§Ã£o pelo cliente**: resposta "sim"/"nÃ£o" Ã© interpretada por `whatsapp-webhook` (novo bloco, mesmo padrÃ£o de `find_pending_confirmation_by_phone` jÃ¡ usado pra confirmaÃ§Ã£o de presenÃ§a) â€” "sim" chama `phone_confirm_waitlist_booking`, que reaproveita `create_public_booking_v15` (herda toda a validaÃ§Ã£o e a reconferÃªncia de horÃ¡rio livre no momento exato da confirmaÃ§Ã£o â€” se alguÃ©m ocupou o horÃ¡rio entre a oferta e a resposta, o cliente Ã© avisado e devolvido pra fila em vez de achar que agendou); "nÃ£o" ou silÃªncio mantÃ©m o cliente na lista, aberto a novas ofertas.
- Testado ponta a ponta com dados fictÃ­cios (telefones de teste, apagados depois): trigger dispara corretamente ao cancelar (status `avisado` + `offered_date`/`offered_start_time` preenchidos), `find_pending_waitlist_offer_by_phone` sÃ³ retorna depois que `notified_at` Ã© setado (simulando o cron), `phone_confirm_waitlist_booking` cria o agendamento real e marca `encaixado`, e o guard de duraÃ§Ã£o corretamente **recusa** um candidato de 60min quando sÃ³ sobra um encaixe de 30min (testado forÃ§ando esse cenÃ¡rio especÃ­fico). Nenhum dado real foi tocado; `get_advisors` nÃ£o apontou nenhum problema novo nas functions criadas.

## 28.39.1 â€” Taxa de conversÃ£o na lista de espera

- **Novo card de mÃ©trica em `admin-espera.html`**: "Taxa de conversÃ£o" â€” quantos pedidos jÃ¡ resolvidos (encaixado/cancelado/expirado) viraram agendamento de verdade. Mesmo raciocÃ­nio da taxa de recuperaÃ§Ã£o do funil de reativaÃ§Ã£o (`admin-leads.html`): sÃ³ conta quem jÃ¡ teve desfecho, excluindo quem ainda estÃ¡ esperando/avisado (sem resposta ainda). Sem pedidos resolvidos, mostra "â€”" em vez de dividir por zero.
- Testado com fixture nova (1 encaixado + 1 cancelado â†’ 50%, "1 de 2 pedidos resolvidos") e `npm run test:admin` (15/15).

## 28.39.0 â€” Limpeza de Ã­ndices Ã³rfÃ£os (reavaliaÃ§Ã£o dos advisors)

- **Reavaliados os ~15 Ã­ndices "nÃ£o usados" apontados pelos advisors** (pedido do Juliano). A maioria continua sendo Ã­ndice legÃ­timo de suporte a tabela ativa com baixo trÃ¡fego (negÃ³cio pequeno) â€” mesma conclusÃ£o da auditoria anterior (28.29.1), nÃ£o vale dropar precocemente. Dois casos, porÃ©m, eram genuinamente Ã³rfÃ£os, nÃ£o sÃ³ "baixo trÃ¡fego":
  - **`email_outbox` era uma fila morta da v21** (migration 013): a trigger `bookings_v21_email_queue` ainda gravava nela a cada agendamento/mudanÃ§a de status, mas nenhuma edge function lÃª essa tabela desde que o envio real de e-mail migrou pra `email_queue` (usada por `booking-email`/`send-email`/`notifications-watchdog`/`booking-reminder-24h`). Confirmado: as 40 linhas existentes estavam TODAS com `status='pending'`, nunca processadas â€” cliente nÃ£o perdia e-mail nenhum (o envio real acontece por outro caminho), era sÃ³ overhead de escrita numa tabela que sÃ³ crescia sem propÃ³sito. Trigger, funÃ§Ã£o e tabela removidas (migration 074).
  - **`bookings_customer_phone_idx` nunca podia ser usado**: toda consulta de telefone no banco usa `regexp_replace(customer_phone,...)` ou `phone_match_key()`, nunca a coluna crua â€” confirmado varrendo todas as migrations. Um Ã­ndice btree simples na coluna nÃ£o serve pra filtro por funÃ§Ã£o da coluna, entÃ£o esse era Ã³rfÃ£o por design, nÃ£o por baixo volume. Removido.
- Testado com `npm run test:admin` (15/15) depois da limpeza, e confirmado por grep que nada no front-end/admin referenciava `email_outbox`.

## 28.38.3 â€” Foto do Juliano recortada corretamente (hero + avatar do autor)

- **Corrigido**: a foto de corpo inteiro (`juliano-retrato.jpg`, 768Ã—1376, retrato) estava sendo forÃ§ada em dois espaÃ§os que nÃ£o combinam com esse formato â€” a foto grande de `sobre-o-juliano.html` (faixa larga e baixa) cortava o rosto quase inteiro (sÃ³ aparecia do pescoÃ§o pra baixo), e o avatar circular de "Escrito por Juliano..." (presente em ~33 pÃ¡ginas de blog/serviÃ§o) mostrava o rosto pequeno e mal enquadrado.
- **SoluÃ§Ã£o**: criado um recorte dedicado (`assets/juliano-retrato-rosto.jpg`/`.webp`, 768Ã—480), focado no rosto/ombros, sem o corpo inteiro. Usado na foto grande de `sobre-o-juliano.html`, no avatar circular das ~33 pÃ¡ginas com "author-box", no `og:image`/`twitter:image` de `sobre-o-juliano.html` e no campo `image` do schema.org `Person` em `index.html` (mesma lÃ³gica: qualquer recorte automÃ¡tico de uma foto de retrato tende a cortar o rosto). A foto de corpo inteiro original continua em uso na seÃ§Ã£o "Sobre" da home (`.portrait-stack`), que jÃ¡ exibia o retrato corretamente sem cortar nada.
- Testado renderizando de verdade (Playwright + servidor local, screenshot de `.blog-hero` e `.author-box`) â€” primeira tentativa de recorte (quadrado 480Ã—480) ainda ficava com zoom demais na faixa larga do hero; corrigido alargando o recorte pra 768Ã—480, testado de novo e confirmado visualmente nos dois lugares.

## 28.38.2 â€” Bateria robusta de testes da JuIA + bug de "sim" ambÃ­guo na lista de espera corrigido

- **Bateria de testes em produÃ§Ã£o a pedido do Juliano** (telefones fictÃ­cios, dados apagados depois): saÃºde geral (todas as functions 200, conexÃ£o WhatsApp `open`), preÃ§o, negaÃ§Ã£o "sem barba", fluxo completo de lista de espera (entrada com frase explÃ­cita, entrada com "sim" na oferta direta, descarte com "nÃ£o"), agendamento real + cancelamento pela JuIA com o novo aviso de vaga pra lista de espera (2 pushes confirmados nos logs), `source='whatsapp'` confirmado no banco, boot do webhook (401 sem secret). Resultado final: **6/6 PASS** + fluxo de cancelamento OK.
- **Bug real encontrado e corrigido no processo**: quando nÃ£o havia horÃ¡rio no dia pedido e a JuIA oferecia um dia alternativo ("Quer marcar nesse dia? Se preferir, tambÃ©m posso te colocar na lista de espera..."), um **"sim" do cliente confirmando a RESERVA no novo dia era sequestrado** pela detecÃ§Ã£o da lista de espera â€” o cliente achava que tinha agendado, mas sÃ³ entrava na lista do dia original. Corrigido: "sim" solto sÃ³ entra na lista quando a pergunta foi DIRETA sobre a lista (caso sem nenhum dia alternativo, novo flag `direct` na oferta); a frase explÃ­cita/botÃ£o continua valendo nos dois casos; "nÃ£o" com oferta pendente agora descarta a oferta (evita reativaÃ§Ã£o acidental depois); agendamento concluÃ­do limpa a oferta pendente.
- Reteste apÃ³s o fix: "sim" com dia+hora escolhidos **agenda de verdade** (nÃ£o sequestra mais), oferta direta + "sim" entra na lista, frase explÃ­cita entra na lista, "nÃ£o" descarta. Tudo verificado contra a versÃ£o publicada.

## 28.38.1 â€” Origem correta ("whatsapp") na lista de espera

- **Corrigido detalhe cosmÃ©tico encontrado na v28.38.0**: `join-waitlist` sempre gravava `source:'site'`, mesmo quando quem chamava era a JuIA no WhatsApp (mesma function serve os dois canais) â€” entradas do WhatsApp apareciam com a etiqueta errada no admin. A constraint sÃ³ aceitava `site`/`admin` (migration 073 adiciona `whatsapp`); `join-waitlist` agora recebe o canal real do chamador (`ju-ia-site` manda `whatsapp` quando `verifiedPhone` estÃ¡ presente, `site` caso contrÃ¡rio); `admin-espera.html` ganhou um rÃ³tulo prÃ³prio (`ðŸ’¬ whatsapp`) em vez de cair no fallback `âœ admin`, que seria uma etiqueta ativamente errada.
- Testado com `npm run test:admin` (fixture nova com `source:'whatsapp'`) â€” confirmado visualmente no screenshot que a nova entrada aparece com "ðŸ’¬ whatsapp" em vez de "âœ admin".

## 28.38.0 â€” JuIA revisa a conversa do dia inteiro (item 6, Ãºltimo da lista de melhorias) + aviso de vaga da lista de espera tambÃ©m no cancelamento pelo WhatsApp

- **Item 6 concluÃ­do**: no canal WhatsApp, o histÃ³rico enviado ao modelo antes de responder deixou de ser uma janela rolante de 6h/Ãºltimas 10 mensagens e passou a ser o **dia calendÃ¡rio inteiro** (meia-noite de BrasÃ­lia atÃ© agora), com limite maior (40 mensagens) para nÃ£o truncar um dia movimentado. Evita respostas fora de contexto quando o cliente conversa de manhÃ£ e volta Ã  tarde no mesmo dia (ex.: repetir uma pergunta jÃ¡ respondida, ou nÃ£o perceber que jÃ¡ Ã© a segunda vez que ele pergunta a mesma coisa). O reset do state ESTRUTURADO (data/serviÃ§o escolhidos) continua com a janela de 6h de antes (`STALE_CONVERSATION_MS`) â€” sÃ£o dois mecanismos diferentes, histÃ³ria de conversa x dados do agendamento em andamento, e sÃ³ o primeiro foi alterado.
- **Fechada uma lacuna encontrada ao revisar o item 4**: o aviso automÃ¡tico de "vaga aberta" para quem estÃ¡ na lista de espera (push pro Juliano, jÃ¡ existente desde v28.8.0 em `admin-booking-status`/`manage-booking`) nÃ£o disparava quando o cancelamento ou remarcaÃ§Ã£o era feito pela prÃ³pria JuIA no WhatsApp (`whatsapp_cancel_booking`/`phone_reschedule_booking`, chamadas direto em `ju-ia-site`, sem passar por aquelas duas functions). Agora os trÃªs pontos de `ju-ia-site` que liberam um horÃ¡rio (cancelamento confirmado, cancelamento de agendamento duplicado, remarcaÃ§Ã£o â€” usando o horÃ¡rio ANTIGO que fica livre) tambÃ©m chamam `waitlist_matches_for_slot` e avisam o Juliano por push, mesmo padrÃ£o do admin. Continua manual: sÃ³ avisa, o encaixe de fato Ã© feito pelo Juliano em `admin-espera.html`.
- Testado com `waitlist_matches_for_slot` via SQL (fixture temporÃ¡ria confirmando match por data e nÃ£o-match por data diferente, apagada depois) e boot-check via curl confirmando que o deploy compilou e respondeu normalmente. O teste end-to-end completo do cancelamento (que dispararia um push real pro celular do Juliano, mesmo comportamento jÃ¡ existente antes desta mudanÃ§a) nÃ£o foi executado sem aviso prÃ©vio â€” seguindo o mesmo cuidado jÃ¡ registrado no projeto sobre testes ao vivo de `send-push`.

## 28.37.0 â€” Lista de espera integrada no WhatsApp (item 4 da lista de melhorias)

- **Novo**: quando nÃ£o hÃ¡ horÃ¡rio disponÃ­vel no dia pedido (nem no dia alternativo mais prÃ³ximo), a JuIA agora oferece diretamente colocar o cliente na lista de espera do dia original â€” antes esse recurso sÃ³ existia no chat do site (`agendar/horario`). Reaproveita a mesma Edge Function `join-waitlist` jÃ¡ usada lÃ¡ (dedup por telefone, aviso push pro Juliano).
- Exige apenas telefone (WhatsApp ou jÃ¡ conhecido na conversa) e nome â€” risco bem menor que cancelar/remarcar (nÃ£o mexe em nada existente), por isso nÃ£o exige o mesmo nÃ­vel de confirmaÃ§Ã£o por WhatsApp verificado.
- **Bug real achado testando de propÃ³sito**: a mensagem "Quero entrar na lista de espera" contÃ©m a palavra "quero", que satisfaz a heurÃ­stica `simpleYes` usada em outro ponto do cÃ³digo (o bloco que retoma o fluxo de agendamento depois dos upsells resolvidos). Sem excluir a nova intenÃ§Ã£o `join_waitlist` desse bloco, ele sobrescrevia a classificaÃ§Ã£o e **criava um agendamento de verdade** no dia/horÃ¡rio alternativo oferecido, em vez de colocar o cliente na lista de espera do dia original que ele pediu â€” o oposto do que foi pedido. Corrigido excluindo `join_waitlist` do gate `notSpecialFlow` (mesmo padrÃ£o jÃ¡ usado pra cancel/reschedule/change_service/update_products). Encontrado e corrigido antes de qualquer cliente real ser afetado â€” testado end-to-end via curl com telefone de teste, incluindo o cenÃ¡rio exato que quebrou, antes e depois do fix.
- Testado o fluxo completo (serviÃ§o â†’ upsells â†’ dia sem vaga â†’ oferta de lista de espera â†’ confirmaÃ§Ã£o) e regressÃ£o de um agendamento normal em dia com vaga.

## 28.36.0 â€” JuIA interpreta conteÃºdo de links (item 2 da lista de melhorias)

- **Novo**: quando o cliente manda um link em vez de escrever (post de Instagram/TikTok com uma foto de referÃªncia, ou qualquer outra pÃ¡gina), a JuIA agora tenta abrir o link com seguranÃ§a e usar o conteÃºdo â€” antes disso sÃ³ recusava educadamente sem tentar ver nada. Funciona nos dois canais (site e WhatsApp).
- **Guarda contra SSRF**: sÃ³ http/https; bloqueia hostname literal privado/loopback/link-local/metadados de nuvem (checagem sÃ­ncrona sempre ativa); tenta resolver DNS e bloquear se o IP resolvido for privado (proteÃ§Ã£o extra, falha aberta pra domÃ­nio pÃºblico se a checagem de DNS nÃ£o estiver disponÃ­vel no runtime); cada redirect Ã© revalidado do zero antes de seguir; limite de tamanho e timeout na busca da pÃ¡gina e da imagem.
- Extrai a imagem principal da pÃ¡gina (`og:image`) e roda pela mesma chamada de visÃ£o do item 1 (v28.35.0) pra descrever o corte/barba/cor. Sem imagem, usa tÃ­tulo/descriÃ§Ã£o da pÃ¡gina como contexto. Se nada funcionar (link bloqueado, sem metadados, erro de rede), mantÃ©m a recusa educada.
- **Bug real achado testando o recurso**: uma descriÃ§Ã£o de imagem contendo "sem barba" disparava o menu de opÃ§Ãµes de barba mesmo assim â€” o regex que detecta menÃ§Ã£o a barba nÃ£o entendia negaÃ§Ã£o. Corrigido (mesmo padrÃ£o jÃ¡ usado pro "nÃ£o quero cancelar").
- Testado com um link real (Wikipedia, artigo sobre corte de cabelo): a JuIA extraiu a imagem, descreveu o corte corretamente e seguiu a conversa normalmente. RegressÃ£o conferida com mensagens normais antes e depois do fix.

## 28.35.0 â€” JuIA reconhece fotos de referÃªncia no WhatsApp (item 1 da lista de melhorias)

- **Bug real corrigido de quebra**: antes desta versÃ£o, quando um cliente mandava uma FOTO pelo WhatsApp (com ou sem legenda), a JuIA ficava em silÃªncio total â€” pior do que uma recusa educada. A legenda da foto (`imageMessage.caption`) nunca era lida pelo cÃ³digo, entÃ£o a mensagem sempre caÃ­a no mesmo caminho de "mÃ­dia sem texto, sem resposta".
- **Novo**: `whatsapp-webhook` baixa a foto via Evolution API (mesmo endpoint jÃ¡ usado pra transcrever Ã¡udio) e manda pra um modelo com visÃ£o (mesmo `gpt-5.6-luna` da JuIA, agora com input multimodal). O modelo descreve o corte/barba/coloraÃ§Ã£o mostrado (comprimento, degradÃª, risco, formato da barba etc.) e essa descriÃ§Ã£o entra no fluxo normal da conversa, como se fosse o texto do cliente â€” a JuIA responde considerando a referÃªncia enviada.
- Se a foto nÃ£o mostrar claramente um corte/barba/coloraÃ§Ã£o, responde educadamente pedindo pra descrever com palavras (sem gastar handoff). Se a anÃ¡lise falhar por qualquer motivo, cai num fallback educado â€” nunca mais silÃªncio total.
- Testado a chamada de visÃ£o isoladamente (ponte temporÃ¡ria, sem tocar no WhatsApp real): confirmado que reconhece um corte/cabelo real e que recusa educadamente uma foto sem relaÃ§Ã£o, antes de liberar em produÃ§Ã£o.

## 28.34.0 â€” Funil de reativaÃ§Ã£o avanÃ§ado (item 0 da lista de melhorias, o mais pedido)

- **Reabertura de vaga proativa**: quando um agendamento que ocupava a data que um lead abandonado queria Ã© cancelado ou reagendado â€” de QUALQUER origem (admin, site, WhatsApp, ou o auto-cancelamento por falta de confirmaÃ§Ã£o da v28.32.0) â€” a JuIA agora avisa esse cliente sozinha ("abriu uma vaga de novo pra [data]..."). Implementado com um trigger direto na tabela `bookings` (`bookings_notify_leads_slot_reopened`, migration 070), que cobre todos os pontos de cancelamento/reagendamento de uma vez sÃ³, sem precisar caÃ§ar cada chamada de RPC em TypeScript. O envio de fato acontece no cron `whatsapp-lead-followup`, que jÃ¡ rodava a cada 15 min.
- **PontuaÃ§Ã£o quente/morno/frio**: nova view `conversation_leads_scored` classifica cada lead por intenÃ§Ã£o (motivo respondido > tipo de conversa > esfriou por silÃªncio de 10+ dias), usada no novo painel `admin-leads.html`.
- **Campanha por interesse antigo (disparo manual)**: nova Edge Function `conversation-leads-campaign` â€” o Juliano decide quando disparar, com filtro opcional por serviÃ§o, nunca automÃ¡tica. Nunca inventa promoÃ§Ã£o/desconto.
- **Painel de analytics do funil** (`admin-leads.html`, novo item no menu): quente/morno/frio em aberto, taxa de recuperaÃ§Ã£o (quantos leads viraram agendamento de verdade), motivos de desistÃªncia (sem horÃ¡rio/preÃ§o/sÃ³ pesquisando/outro). Pra calcular a taxa de recuperaÃ§Ã£o, o `ju-ia-site` deixou de apagar o lead quando ele vira agendamento â€” agora marca `resolution='booked'` e preserva a linha (sÃ³ esse caso; os outros motivos de limpeza continuam apagando como antes).
- Testado com `npm run test:admin` (15/15) + teste temporÃ¡rio de interaÃ§Ã£o (filtro por heat, disparo de campanha simulado), apagado depois. RegressÃ£o do `ju-ia-site` conferida com mensagem real via curl/Node antes e depois do deploy.
- `get_advisors` rodado depois das migrations (hÃ¡bito do projeto): achou 1 finding real (funÃ§Ã£o de trigger executÃ¡vel via RPC por engano, sem risco prÃ¡tico mas corrigido mesmo assim, migration 072).

## 28.33.0 â€” AvaliaÃ§Ãµes do Google com rascunho de resposta por IA (modo aprovaÃ§Ã£o)

- **Nova tela `admin-avaliacoes.html`**: lista avaliaÃ§Ãµes recebidas no Google Business Profile, cada uma com um rascunho de resposta gerado por IA. O Juliano revisa, edita se quiser, aprova e sÃ³ entÃ£o publica de fato no Google â€” nunca publica sozinha. Abas Pendentes/Aprovadas/Publicadas/Ignoradas, mesmo padrÃ£o visual de card colapsÃ¡vel do resto do admin.
- **Duas Edge Functions novas**: `google-reviews-sync` (busca avaliaÃ§Ãµes novas via API do Google, gera o rascunho com IA seguindo o mesmo tom/EEAT do site e mencionando naturalmente serviÃ§os reais/"Barbearia do Ju"/"BraganÃ§a Paulista", avisa por push) e `google-reviews-publish` (sÃ³ essa escreve de fato no Google, sÃ³ chamada pelo admin autenticado depois da aprovaÃ§Ã£o).
- **Nova tabela `google_reviews`** (migration 069): fila com status pending â†’ approved â†’ posted, mesmo padrÃ£o de outras filas do sistema (email_queue, sms_queue).
- **PrÃ©-requisito em andamento**: acesso Ã  API de avaliaÃ§Ãµes do Google (Business Profile) depende de aprovaÃ§Ã£o separada do Google (protocolo 8-0854000041581, solicitado em 2026-08-01, prazo 7-10 dias Ãºteis) + autorizaÃ§Ã£o OAuth depois disso. AtÃ© lÃ¡, as duas functions ficam deployadas mas inertes (sem credencial configurada) â€” nenhum cron agendado ainda.

## 28.29.2 â€” 2 bugs reais da JuIA corrigidos (anÃ¡lise de ~200 conversas reais)

- **Bug sÃ©rio: agendamento criado com horÃ¡rio errado.** Cliente com um corte jÃ¡ concluÃ­do (dia X, 11h) pediu um agendamento novo pra outro dia, "16h ou 17h" â€” a JuIA confirmou usando o horÃ¡rio antigo (11h, do atendimento jÃ¡ feito), ignorando completamente o que o cliente pediu. Corrigido: sempre que aparece uma data nova depois de um atendimento jÃ¡ concluÃ­do, o horÃ¡rio antigo Ã© descartado e a JuIA pergunta de novo, em vez de herdar um horÃ¡rio de um atendimento encerrado.
- **Bug de loop: "nÃ£o quero cancelar" era lido como pedido de cancelamento.** Frase como "NÃ£o quero cancelar, quero mudar pra barba" travava a JuIA perguntando "quer mesmo cancelar? sim ou nÃ£o" repetidamente, porque a detecÃ§Ã£o de cancelamento reagia Ã  palavra "cancelar" mesmo dentro de uma negaÃ§Ã£o. Corrigido: uma negaÃ§Ã£o explÃ­cita antes de "cancelar" agora cancela a prÃ³pria detecÃ§Ã£o de cancelamento, deixando a troca de serviÃ§o seguir normalmente.
- **2 ajustes de prompt**: uma saudaÃ§Ã£o isolada ("oi", "boa tarde") no meio da conversa nÃ£o reabre mais a busca de horÃ¡rio Ã  toa; e quando o cliente oferece dois horÃ¡rios possÃ­veis na mesma frase ("16h ou 17h"), a JuIA agora pergunta qual em vez de arriscar um dos dois (ou herdar um valor antigo).
- Os 2 bugs foram encontrados numa anÃ¡lise de ~200 conversas reais do WhatsApp e do chat do site, feita a pedido do Juliano depois do caso do cliente Lucas (v28.28.1). Testados reproduzindo exatamente o cenÃ¡rio real que quebrou, antes e depois da correÃ§Ã£o, com telefone de teste.

## 28.29.1 â€” Auditoria de seguranÃ§a/performance do banco (achados dos advisors)

- **Vazamento de dados real corrigido**: a view antiga `v27_customer_metrics` (resquÃ­cio do CRM de 2026-anterior, migration 027) rodava com privilÃ©gio elevado (`SECURITY DEFINER`, ignora RLS) e tinha permissÃ£o de leitura pro papel `authenticated` â€” que nesse projeto inclui qualquer **cliente logado na Ã¡rea do cliente**, nÃ£o sÃ³ o Juliano. Qualquer cliente logado conseguia consultar essa view direto pela API e ver nome, telefone, e-mail e histÃ³rico de gasto de **todos** os outros clientes. Confirmado que nada no cÃ³digo atual usa essa view â€” removida (migration 059).
- **3 policies de RLS duplicadas removidas** (mesma condiÃ§Ã£o, cobrindo o mesmo caso duas vezes) em `contact_messages`, `customer_timeline` e `experience_requests` â€” cada consulta pagava o custo de avaliar as duas Ã  toa.
- **3 policies de RLS otimizadas** para reavaliar `auth.uid()` uma vez por consulta em vez de uma vez por linha (`admin_users`, `ai_conversations`, `push_subscriptions`) â€” ganho de performance em escala, sem mudar o comportamento.
- **5 Ã­ndices novos** em chaves estrangeiras que nÃ£o tinham (bookings, customer_timeline, email_outbox, loyalty_events, waitlist) + **1 Ã­ndice duplicado removido** em `customer_timeline`.
- **3 funÃ§Ãµes sem `search_path` fixo corrigidas** (`waitlist_touch_updated_at`, `phone_match_key`, `touch_contact_messages_updated_at`) â€” hardening padrÃ£o, sem mudanÃ§a de comportamento (migration 060).
- **PendÃªncia que sÃ³ o Juliano pode resolver** (Ã© uma configuraÃ§Ã£o da conta, nÃ£o do banco): ativar "Leaked Password Protection" no painel do Supabase Auth (checagem de senha vazada contra HaveIBeenPwned) â€” estÃ¡ desativado.

## 28.29.0 â€” Cards colapsÃ¡veis no CRM, Fidelidade, Lista de espera

- **Mesmo visual "clique pra expandir" da Agenda/Atendimento (v28.24.0) agora tambÃ©m no CRM, na Fidelidade e na Lista de espera.** O card do CRM mostrava tudo sempre (aniversÃ¡rio, tags, preferÃªncias, notas, sugestÃ£o privada, estatÃ­sticas inteiras) e ficava enorme â€” agora colapsa pra um resumo (avatar, nome, telefone, badge VIP, Ju Score) e expande com um clique pro resto. Mesmo padrÃ£o na Lista de espera (resumo: nome + dia/horÃ¡rio/serviÃ§o) e na Fidelidade (resumo: nome/telefone/barra de progresso, escondendo sÃ³ o botÃ£o "âœŽ Ajustar carimbos", aÃ§Ã£o ocasional).
- **De brinde: a Fidelidade nÃ£o tinha nenhum estilo de card antes** (os itens da lista apareciam sem borda, sem fundo, sem cantos arredondados) â€” corrigido junto.
- Reaproveita as mesmas classes CSS jÃ¡ usadas pela Agenda (`.admin-booking-summary`/`.admin-booking-detail`, globais via `css/04-agenda-admin-core.css`) em vez de duplicar o mecanismo de colapsar em cada tela.
- Atendimento BalcÃ£o: conteÃºdo jÃ¡ era compacto (uma linha sÃ³), sem necessidade de colapsar â€” sÃ³ ganhou o mesmo destaque de borda ao passar o mouse, pra manter a famÃ­lia visual.

## 28.28.1 â€” CatÃ¡logo de serviÃ§os unificado + correÃ§Ã£o de bug real na JuIA

- **Novo `public.services`** (migration `057`): os 22 serviÃ§os que viviam duplicados em `services-catalog-v7.js` (front-end) e num array hardcoded dentro de `ju-ia-site/index.ts` agora tÃªm uma tabela Ãºnica no banco, mesmo padrÃ£o jÃ¡ usado pra produtos (`public.products`, migration 051). A Edge Function `ju-ia-site` passou a consultar a tabela em vez do array fixo; o front-end continua lendo `services-catalog-v7.js` normalmente (sem custo de rede extra).
- **Bug real encontrado e corrigido (migration `058`): nem `public.services` nem `public.products` tinham permissÃ£o de leitura (`GRANT SELECT`) para o papel usado pelas Edge Functions.** A polÃ­tica de RLS existia, mas sem o `GRANT` de base toda consulta falhava silenciosamente â€” na prÃ¡tica, a JuIA nunca conseguiu consultar o catÃ¡logo real de produtos desde que a tabela foi criada (v28.20.0), sempre respondendo "nÃ£o tenho o preÃ§o atualizado" quando perguntada sobre produto. Corrigido para as duas tabelas.

## 28.27.0 â€” Mesclar clientes duplicados + correÃ§Ã£o do "Arquivar" quebrado

- **Novo botÃ£o "ðŸ”— Mesclar" no CRM**: junta dois cadastros do mesmo cliente (ex.: pessoa trocou de nÃºmero e ficou com 2 perfis) num sÃ³ â€” move agendamentos, histÃ³rico, timeline e pontos de fidelidade (somados, com o mesmo estouro de 10=1 recompensa) pro cadastro escolhido, e apaga o duplicado. Pede confirmaÃ§Ã£o explÃ­cita antes de executar.
- **Corrigido: o botÃ£o "Arquivar" do CRM estava quebrado** desde sempre â€” a funÃ§Ã£o `admin_archive_customer` existia sÃ³ no arquivo de migration antigo, mas nunca foi criada de fato no banco (achado ao investigar o merge). Recriada.
- RLS revisado: jÃ¡ estava travado com `is_admin()` em praticamente toda tabela sensÃ­vel desde 20/07 â€” a nota antiga na documentaÃ§Ã£o interna dizia o contrÃ¡rio, corrigida.

## 28.26.0 â€” Cliente no Novo agendamento, rascunho persistente, Dashboard e RelatÃ³rios

- **Campo "Cliente" do Novo agendamento trocou o `<datalist>` nativo por um dropdown prÃ³prio** (mesmo padrÃ£o do Atendimento BalcÃ£o), mostrando nome + telefone: corrige dois bugs reais â€” 1) o popup nativo "sequestrava" a seta-esquerda do teclado, impedindo corrigir o nome digitado; 2) com dois clientes de mesmo nome, nÃ£o dava pra saber/escolher qual dos dois (agora aparecem os dois, distinguidos pelo telefone).
- **Rascunho do Novo agendamento nÃ£o se perde mais ao navegar pra outra tela**: nome, telefone, data, horÃ¡rio, observaÃ§Ã£o e serviÃ§os ficam salvos (sessionStorage) e voltam automaticamente se vocÃª sair da tela sem salvar. Antes, sair pra conferir algo e voltar resetava tudo pro padrÃ£o (hoje, 08:00).
- **Dashboard**: novos indicadores "ConcluÃ­dos" e "AusÃªncias" (hoje), e os atendimentos da lista "Agenda de hoje" agora sÃ£o clicÃ¡veis â€” abrem o mesmo detalhe completo (pagamento, produtos, serviÃ§o) dos cards da Agenda, com link direto pra editar lÃ¡.
- **RelatÃ³rios**: modo "Dia" ganhou um seletor de data direta (calendÃ¡rio), pra pular direto pra qualquer dia sem clicar "â€¹" vÃ¡rias vezes. Corrigido tambÃ©m um estouro de layout: nÃºmeros grandes (ex. "R$ 2.448,00") furavam a borda do card em vez de encolher/quebrar linha.

## 28.25.0 â€” Controle de avaliaÃ§Ã£o Google + 2 correÃ§Ãµes na JuIA do WhatsApp

- **Checkbox "Pedir avaliaÃ§Ã£o no Google" no "Concluir atendimento"** (marcado por padrÃ£o): quando desmarcado, se o cliente responder satisfeito na pesquisa, a JuIA manda um agradecimento reforÃ§ando as formas de agendamento em vez de pedir avaliaÃ§Ã£o â€” pro Juliano usar em clientes que jÃ¡ sabe que avaliaram. Novo campo `bookings.request_google_review`/`experience_requests.request_google_review` (migration `055`).
- **JuIA (WhatsApp) nÃ£o reconhecia emojis de satisfaÃ§Ã£o alÃ©m do ðŸ˜Š/ðŸ™ exatos do menu**: cliente respondeu ðŸ˜‚ e depois ðŸ˜„ (pesquisa de satisfaÃ§Ã£o) e ficou preso em "nÃ£o entendi" repetido. Ampliado pra reconhecer a famÃ­lia toda de emojis positivos/negativos comuns.
- **Bug maior no mesmo fluxo**: qualquer cliente com pesquisa de satisfaÃ§Ã£o pendente que mandasse uma mensagem que nÃ£o fosse satisfeito/insatisfeito (pedido de agendamento novo, pergunta, Ã¡udio) ficava travado em "nÃ£o entendi, satisfeito ou insatisfeito?" para sempre â€” inclusive tentando marcar um horÃ¡rio novo. Agora sÃ³ aplica esse "gate" pra mensagens curtas (atÃ© 40 caracteres, o padrÃ£o de uma resposta de satisfaÃ§Ã£o); o resto cai direto no fluxo normal da JuIA.

## 28.24.0 â€” Cards de Agenda/Atendimento redesenhados (colapsÃ¡veis)

- **Cards de agendamento agora vÃªm colapsados por padrÃ£o**: sÃ³ hora, nome, serviÃ§o, status e total â€” uma linha compacta, no estilo listas do iOS. Clique no card expande e mostra tudo (telefone, duraÃ§Ã£o, preÃ§os, pagamento, produtos, observaÃ§Ãµes, aÃ§Ãµes). Resolve a reclamaÃ§Ã£o de que a tela ficava "gigante" e obrigava rolar muito com vÃ¡rios agendamentos no dia.
- Modo Atendimento passou a usar exatamente o mesmo componente de card da Agenda (antes eram dois layouts diferentes) â€” visual Ãºnico em todo o sistema.
- JuIA: adicionada instruÃ§Ã£o no prompt pra reconhecer quando o cliente sÃ³ avisa que chegou/estÃ¡ a caminho/vai se atrasar, respondendo direto sem pedir esclarecimento (nÃ£o precisa mais de uma segunda mensagem pra entender). Testado e publicado com verificaÃ§Ã£o de integridade byte-a-byte.

## 28.23.1 â€” Resumo de preÃ§o/pagamento mais compacto

- **Os 3 campos (ServiÃ§os/Produtos/Total) e a forma de pagamento viraram uma Ãºnica linha de texto discreto**, no lugar das caixas grandes lanÃ§adas na v28.22.0/28.23.0. Ficava alto demais e obrigava rolar muito a tela com vÃ¡rias entradas na Agenda/Atendimento. Sem mudanÃ§a de dado, sÃ³ de layout.

## 28.23.0 â€” Forma de pagamento separada pra produtos

- **Novo campo `products_payment_method`** em `bookings` (migration `054`): atÃ© aqui um atendimento tinha sÃ³ 1 forma de pagamento pra tudo. Caso real: corte pago no Pix, mas o cliente comprou uma Ã¡gua na saÃ­da e pagou no DÃ©bito â€” nÃ£o tinha como registrar certo. Campo opcional; quando vazio, o produto Ã© considerado pago na mesma forma do serviÃ§o (nenhum registro antigo precisa mudar).
- **Modais "Concluir" e "âœŽ Editar atendimento"** ganharam um 2Âº seletor de pagamento, opcional, sÃ³ pros produtos. O "Concluir" deixou de fechar com 1 clique no pagamento â€” agora tem botÃ£o "Concluir atendimento" no final, pra dar tempo de escolher os 2 pagamentos quando forem diferentes.
- **Cards de Agenda/Atendimento e o log do BalcÃ£o** mostram a forma de pagamento â€” 1 chip quando Ã© sÃ³ uma, 2 chips ("ServiÃ§o: Pix" / "Produtos: DÃ©bito") quando Ã© diferente.
- Registrado na timeline de auditoria do cliente quando o pagamento dos produtos Ã© alterado.

## 28.22.1 â€” CorreÃ§Ã£o: "Ajustar carimbos" nÃ£o salvava

- **Bug crÃ­tico desde a criaÃ§Ã£o do recurso (v28.21.0)**: o botÃ£o "âœŽ Ajustar carimbos" (Fidelidade) sempre falhava com `column reference "points" is ambiguous` e nunca salvava nada â€” a RPC `admin_adjust_loyalty_points` tinha uma coluna de retorno com o mesmo nome de uma coluna da tabela `loyalty_accounts`, deixando o Postgres em dÃºvida sobre qual `points` usar no `UPDATE ... RETURNING`. Corrigido qualificando as colunas com alias (migration `053`). Testado direto no banco (cliente fictÃ­cio) antes de confirmar.

## 28.22.0 â€” Auditoria no CRM, 3 campos de preÃ§o e novos filtros de RelatÃ³rios

- **Timeline de auditoria na tela do cliente (CRM)**: novo botÃ£o "ðŸ•˜ Auditoria" em cada card de cliente (`admin-clientes.html`) mostra os eventos jÃ¡ registrados na tabela `customer_timeline` (correÃ§Ãµes de status/serviÃ§o/produtos/pagamento feitas pelo admin) â€” carregado sob demanda ao abrir, sem impactar o carregamento normal da tela. Antes essa tabela era sÃ³ gravada (pelo `admin-booking-status`), nunca lida em lugar nenhum do painel.
- **Cards de agendamento (Agenda/Atendimento) mostram 3 campos separados** â€” ServiÃ§os, Produtos e Total â€” em vez de um valor sÃ³ combinado perto do nome, que ficava ambÃ­guo por nÃ£o ter rÃ³tulo e parecia repetir o subtotal de produtos logo abaixo.
- **RelatÃ³rios ganhou modo "Dia"** (alÃ©m de MÃªs/Semana jÃ¡ existentes) e um novo indicador **"MÃ©dia por cliente"** (faturamento Ã· clientes diferentes atendidos no perÃ­odo) â€” diferente do "Ticket mÃ©dio", que divide pelo nÃºmero de atendimentos (um mesmo cliente pode ter mais de um no perÃ­odo).

## 28.21.2 â€” Link do Facebook no vCard

- **`barbearia-do-ju.vcf`**: adicionado link do Facebook (`item6.URL`/`X-ABLabel`, mesmo padrÃ£o dos outros links sociais).

## 28.21.1 â€” CorreÃ§Ã£o visual do chip de produto

- **"ðŸ› Produtos reservados" virou "ðŸ› Produtos vendidos"** nos cards de agendamento/atendimento â€” o produto jÃ¡ foi vendido no momento em que Ã© registrado (nÃ£o existe conceito de "reserva" de produto no sistema), entÃ£o o texto estava com a palavra errada. Padronizado com o texto jÃ¡ usado nos modais "Concluir"/"âœŽ Editar".
- **Chip de produto nÃ£o estoura mais em nomes longos no mobile**: era `border-radius:999px` (pÃ­lula), entÃ£o um nome como "Balm Para Barba 150g" quebrava em vÃ¡rias linhas dentro de um card estreito e virava um cÃ­rculo cortando o preÃ§o no meio. Agora o chip empilha nome e preÃ§o (mesmo padrÃ£o visual jÃ¡ usado no checklist de produtos do "Concluir"/"âœŽ Editar") com cantos arredondados normais.

## 28.21.0 â€” Ajuste manual de carimbos de fidelidade

- **Tela Fidelidade ganhou botÃ£o "âœŽ Ajustar carimbos"** por cliente: permite somar ou remover carimbos manualmente (ex.: cliente que jÃ¡ tinha carimbos no cartÃ£o fÃ­sico antes do sistema digital, precisa entrar com esse saldo atÃ© tudo ficar ajustado). Nova RPC `admin_adjust_loyalty_points` (migration `052-v28.21.0`) reaproveita a mesma lÃ³gica do trigger de corte concluÃ­do â€” cada 10 carimbos vira 1 recompensa â€” e registra o ajuste em `loyalty_events` (`event_type='adjustment'`) com o motivo digitado, entÃ£o fica no histÃ³rico.

## 28.20.1 â€” ServiÃ§o extra direto no "Concluir"

- **BotÃ£o "Concluir" ganhou o mesmo checklist de serviÃ§o do "âœŽ Editar atendimento"**: antes sÃ³ dava pra ajustar produtos vendidos na hora de concluir; se o cliente pedisse um serviÃ§o extra (ex.: corte + sobrancelha, sendo que sÃ³ o corte estava agendado), era preciso concluir e depois abrir o "âœŽ Editar" separadamente pra corrigir. Agora o checklist de serviÃ§o aparece direto no "Concluir", prÃ©-marcado com o que estava agendado, e dÃ¡ pra marcar serviÃ§os adicionais antes de fechar o atendimento.

## 28.20.0 â€” Tabela `products` no banco + modal "âœŽ Editar atendimento"

- **Nova tabela `public.products` (migration `051-v28.20.0-tabela-produtos.sql`)**: fonte Ãºnica de produtos que as Edge Functions conseguem ler direto (Deno nÃ£o importa o `products-catalog-v1.js` do front-end). `ju-ia-site` e `create-rebooking` agora consultam a tabela a cada request em vez de manter arrays hardcoded que divergiam do catÃ¡logo real. Leitura pÃºblica liberada sÃ³ pra `active=true` (mesma informaÃ§Ã£o jÃ¡ exposta em produtos.html); escrita sÃ³ via service_role. Campo `upsell_tags` preserva a lÃ³gica de sugestÃ£o da JuIA (corte/barba/combo/quimica/tratamento/all) â€” comportamento dela nÃ£o mudou, sÃ³ a origem dos dados. **Ao mudar preÃ§o/nome de produto: atualizar a tabela `products` E o `products-catalog-v1.js` (front-end).**
- **Modal "âœŽ Editar atendimento"** (substitui o "ðŸ› Produtos" da sessÃ£o anterior, nos cards da Agenda e do Modo Atendimento): corrige **serviÃ§o realmente executado** (checklist igual Ã  do balcÃ£o, prÃ©-marcada com o que estÃ¡ no registro), **produtos vendidos** e **forma de pagamento** de qualquer agendamento â€” site ou balcÃ£o, antes OU depois de concluÃ­do. Caso real: cliente agendou "Corte + Lavagem" no site, na hora pediu Barba Express + pomada, e o "Concluir" registrava sÃ³ o corte. `admin-booking-status` aceita agora `service` ({name, price, duration_minutes}), `selected_products` e `payment_method` de forma independente (qualquer combinaÃ§Ã£o, com ou sem mudanÃ§a de status); tudo auditado em `customer_timeline`.
- **Forma de pagamento pode ser adicionada/corrigida depois** do atendimento concluÃ­do (era sÃ³ no momento do "Concluir").

## 28.19.0 â€” CatÃ¡logo Ãºnico de produtos

- **Novo `products-catalog-v1.js` (`window.BDJ_PRODUCTS`)**, mesmo padrÃ£o do `services-catalog-v7.js`: atÃ© aqui o catÃ¡logo de produtos existia duplicado (e jÃ¡ divergente) em 4 arquivos â€” `agenda-v15.js`/`reagendar-v26-5.js` estavam com apenas 6 itens desatualizados (faltava Pasta Modeladora, Shampoo Caspbell e os energÃ©ticos Monster), enquanto `admin-v15-4-core.js`/`admin-balcao-v29.js` (criados na sessÃ£o anterior) tinham 9. Agora os 4 leem do mesmo arquivo.
- **CatÃ¡logo completo (27 produtos, igual ao `produtos.html` real)** disponÃ­vel no balcÃ£o/atendimento (`admin-v15-4-core.js`, `admin-balcao-v29.js`) â€” inclusive bebidas, agora agrupado por categoria como o seletor de serviÃ§os. O agendamento do site/reagendamento (`agenda-v15.js`, `reagendar-v26-5.js`) continua mostrando sÃ³ o recorte de sugestÃ£o contextual (produtos de cuidado, sem bebidas), usando o campo `for` do catÃ¡logo Ãºnico.
- **LimitaÃ§Ã£o que continua existindo (documentada no prÃ³prio arquivo):** as Edge Functions `ju-ia-site` e `create-rebooking` rodam em Deno e nÃ£o conseguem importar esse arquivo de front-end â€” mantÃªm sua prÃ³pria cÃ³pia. Ao mudar preÃ§o/nome em `products-catalog-v1.js`, replicar manualmente nessas duas functions (mesma limitaÃ§Ã£o que jÃ¡ existia pros serviÃ§os).

## 28.18.0 â€” JuIA: bug do "boa tarde/amanhÃ£", produtos no balcÃ£o/CRM e no atendimento

- **JuIA (WhatsApp/site) nÃ£o confunde mais cumprimento com pedido de horÃ¡rio:** "boa tarde"/"boa noite" continham as palavras "tarde"/"noite" e, combinadas com data/serviÃ§o ainda guardados de uma conversa anterior jÃ¡ concluÃ­da, disparavam sozinhas uma checagem de disponibilidade sem sentido (caso real: Ã¡udio "Oi! Boa tarde!" respondido com "NÃ£o encontrei horÃ¡rio nessa data..."). Generalizado com `\b` (limite de palavra) pra tambÃ©m corrigir "amanhÃ£" sendo lido como "de manhÃ£" (`detectPeriod` em `ju-ia-site/index.ts`).
- **Atendimento BalcÃ£o (`admin-balcao.html`) ganhou busca de cliente do CRM**: digitar nome/telefone sugere clientes jÃ¡ cadastrados (evita redigitar dados de quem nÃ£o tem costume de agendar pelo site) â€” continua permitindo cadastrar um cliente novo normalmente.
- **Atendimento BalcÃ£o e qualquer agendamento (site ou balcÃ£o) agora registram produtos vendidos:** novo seletor de produtos no balcÃ£o (RPC `admin_register_walkin_visit` ganhou `p_selected_products`, migration `050-v28.18.0`); no Modo Atendimento/Agenda, o botÃ£o "Concluir" ganhou checklist de produtos junto da forma de pagamento, e todo agendamento ganhou um botÃ£o avulso "ðŸ› Produtos" pra registrar venda de produto depois do fato, em qualquer status. `admin-booking-status` (Edge Function) passou a aceitar `selected_products` com ou sem mudanÃ§a de status.
- **`salvar-contato.html`**: tÃ­tulo parou de herdar a fonte gigante (`Bebas Neue`) do hero da home, que ficava quebrada/ilegÃ­vel num cartÃ£o estreito.
- **`barbearia-do-ju.vcf` (contato pra salvar no celular)**: links de Instagram/WhatsApp/Maps trocaram `TYPE` invÃ¡lido (que podia ser descartado por alguns apps de contato) pelo padrÃ£o `item.../X-ABLabel`; adicionado link de avaliaÃ§Ãµes no Google e de agendamento online.
- **Home (`index.html`)**: card "Tempo mÃ©dio" virou um seletor â€” escolha o serviÃ§o e veja a duraÃ§Ã£o mÃ©dia, em vez de sÃ³ 2 exemplos fixos (que inclusive estavam desatualizados: Corte + Barboterapia mostrava "1h10", catÃ¡logo real Ã© 1h).

## 28.17.1 â€” Indicadores visuais no calendÃ¡rio do admin

- **CalendÃ¡rio da Agenda (`admin-agenda.html`/`admin-atendimento.html`) agora mostra de relance, em cada dia**: ðŸš« dia que a barbearia nÃ£o atende (domingo/segunda, mesma regra fixa jÃ¡ usada no resto do sistema), ðŸ”’ dia com bloqueio total (`schedule_blocks` com `all_day=true`), â° dia com bloqueio parcial (bloqueio sÃ³ em parte do horÃ¡rio). Antes sÃ³ dava pra saber clicando em cada dia. Nova funÃ§Ã£o `loadMonthBlocks()` busca os bloqueios do mÃªs inteiro exibido; `renderCalendar()` prioriza fechado > bloqueio total > bloqueio parcial > normal.

## 28.17.0 â€” Atendimento BalcÃ£o + forma de pagamento + estatÃ­stica de canal

- **Nova tela `admin-balcao.html` ("Atendimento BalcÃ£o")**, no menu de todas as pÃ¡ginas do admin: registra clientes que vieram direto na porta (nome, telefone, serviÃ§os, data/horÃ¡rio aproximado, forma de pagamento). O registro entra direto como agendamento **concluÃ­do** (`channel='balcao'`), contando no faturamento e no CRM igual um agendamento do site.
- **Forma de pagamento obrigatÃ³ria ao concluir qualquer atendimento** (site ou balcÃ£o): Pix, DÃ©bito, CrÃ©dito, Dinheiro ou BÃ´nus de fidelidade. No agendamento do site, o botÃ£o "Concluir" agora abre uma escolha rÃ¡pida antes de enviar pro `admin-booking-status` (validado nos dois lados â€” tela e Edge Function). Nova coluna `bookings.payment_method` (migration `049-v28.17.0-atendimento-balcao.sql`).
- **Cliente novo da porta recebe boas-vindas por WhatsApp automaticamente:** nova RPC `admin_register_walkin_visit` (SECURITY DEFINER, sÃ³ admin) verifica via `phone_match_key` se o telefone jÃ¡ existia no CRM *antes* de criar o registro; se for realmente novo, a tela chama a nova Edge Function `send-walkin-welcome`, que manda uma mensagem Ãºnica convidando o cliente a agendar pelo WhatsApp ou pelo site da prÃ³xima vez. Cliente que jÃ¡ constava no CRM sÃ³ tem o histÃ³rico atualizado, sem mensagem (evita repetir aviso pra quem jÃ¡ conhece a barbearia).
- **Nova coluna `bookings.channel`** (`site` | `balcao`) permite separar estatisticamente quem veio do site/WhatsApp de quem veio direto na porta. Adicionado card "Site vs. balcÃ£o" em `admin-relatorios.html`. O corte "Novos vs. recorrentes" jÃ¡ existente continua funcionando automaticamente (Ã© calculado pelo histÃ³rico de telefone, nÃ£o por um campo manual) â€” agora tambÃ©m enxerga os atendimentos de balcÃ£o, jÃ¡ que viram `bookings` reais.

## 28.16.6 â€” Lista de espera do admin sem permissÃ£o (achado testando manualmente)

- **Bug real, achado pelo Juliano clicando na tela `admin-espera.html`:** "permission denied for table waitlist". Bug prÃ©-existente desde a criaÃ§Ã£o da lista de espera (v28.8.0), nÃ£o relacionado Ã  divisÃ£o do `admin-v15-4.js` (essa tela usa `admin-espera-v28.js`, arquivo separado que nÃ£o foi tocado). Causa: a migration 039 criou a policy de RLS certa (`is_admin()`) mas esqueceu o `grant select, insert, update, delete` pro `authenticated` â€” sÃ³ o `service_role` tinha. RLS sÃ³ Ã© avaliada depois do grant bÃ¡sico da tabela, entÃ£o o admin logado nunca passava nem perto da policy.
- Corrigido (migration 048): concedido `select, insert, update, delete` no `waitlist` pro `authenticated`. Aplicado direto em produÃ§Ã£o, efeito imediato (nÃ£o precisa de deploy, Ã© permissÃ£o de banco).

## 28.16.5 â€” JuIA perdia serviÃ§o adicional citado junto com um jÃ¡ escolhido

- **Bug real corrigido, cliente MoisÃ©s (28/07/2026 20:50, WhatsApp):** pediu "Barba e sombrancelha" depois de jÃ¡ ter "Sobrancelha" selecionado na conversa â€” a JuIA descartava silenciosamente "Barba" e confirmou o agendamento sÃ³ com Sobrancelha. Juliano teve que corrigir manualmente com o cliente pelo WhatsApp. Causa: o modelo Ã s vezes classifica a mensagem certo mas nÃ£o extrai TODOS os serviÃ§os citados em `updates.services`, e o sistema sÃ³ tinha um plano B (`findServicesLoose`, cata serviÃ§os direto do texto contra o catÃ¡logo) para quando o cliente ainda nÃ£o tinha NENHUM serviÃ§o escolhido â€” uma vez que jÃ¡ havia 1 selecionado, nada tentava mesclar um serviÃ§o adicional citado na mesma frase.
- Corrigido em `supabase/functions/ju-ia-site/index.ts`: o plano B agora roda sempre que a mensagem nÃ£o for de cancelamento/reagendamento/troca de serviÃ§o/produto (fluxos que jÃ¡ tratam serviÃ§o com lÃ³gica prÃ³pria), e **mescla** (nunca substitui) o que jÃ¡ estava selecionado. Testado direto contra a function publicada, replicando a conversa do MoisÃ©s (agora devolve `["Sobrancelha Masculina","Barba Express"]`) e mais 3 casos de regressÃ£o (serviÃ§o Ãºnico, combo, o caso original do plano B) â€” todos corretos.
- **Ajuste pedido pelo Juliano na mesma sessÃ£o:** "barba" sozinho (sem qualificar) nÃ£o escolhe mais Barba Express sozinha (era sempre a vencedora por ser o nome mais curto) â€” agora a JuIA pergunta entre Barba Express, Barboterapia e Barboterapia com vaporizador de ozÃ´nio, com preÃ§o e duraÃ§Ã£o de cada uma, antes de seguir. SÃ³ pergunta se nenhuma das trÃªs jÃ¡ estiver escolhida; "Barba Express" ou "Barboterapia" ditos explicitamente continuam resolvendo direto, sem repergunta. Testado: "Barba" pergunta as 3 opÃ§Ãµes; escolher a mais cara (Barboterapia) resolve certo; "Barba Express" direto nÃ£o dispara a pergunta.

## 28.16.4 â€” admin-v15-4.js dividido em 7 arquivos (âš ï¸ conferir manualmente)

- **`admin-v15-4.js` (o maior JS do site, 38KB) dividido em 7 arquivos** (`admin-v15-4-core.js`, `-dashboard.js`, `-atendimento.js`, `-agenda.js`, `-crm.js`, `-agendamento.js`, `-bootstrap.js`), carregados na mesma ordem em todas as 7 pÃ¡ginas que jÃ¡ carregavam o arquivo Ãºnico (`admin.html`, `admin-agenda.html`, `admin-clientes.html`, `admin-agendamento.html`, `admin-atendimento.html`, `admin-notificacoes.html`, `admin-mensagens.html`). Verificado por diff que o conteÃºdo (sem o IIFE que envolvia tudo) Ã© idÃªntico ao arquivo original.
- **Diferente do `style.css`: aqui nÃ£o dÃ¡ pra ter certeza 100% sem testar de verdade**, porque essas telas exigem login que eu nÃ£o tenho. Removido o IIFE que isolava as ~60 funÃ§Ãµes do arquivo â€” agora elas viram propriedades de `window` (ex. `window.money`). Conferido que nenhum outro script hoje carregado nas mesmas 7 pÃ¡ginas define uma funÃ§Ã£o com o mesmo nome de forma que colidiria de verdade (o Ãºnico nome repetido, `setStatus` em `admin-notifications-v24-6.js`, continua isolado no prÃ³prio IIFE dele). **PeÃ§o pra vocÃª clicar nas 5 telas principais (dashboard, agenda, clientes, atendimento, agendamento) uma vez depois de publicar, sÃ³ pra confirmar que estÃ¡ tudo normal.**

## 28.16.3 â€” style.css dividido em partes menores

- **`style.css` (~165KB, 2068 linhas num arquivo sÃ³) dividido em 5 arquivos** dentro de `css/` (`01-site-base.css` atÃ© `05-admin-mobile-refino.css`), cada um cobrindo um perÃ­odo de versÃµes do site. `style.css` agora sÃ³ tem 5 `@import` apontando pra esses arquivos, na mesma ordem exata do arquivo original â€” nenhuma das 30 pÃ¡ginas que carregam `/style.css` precisou mudar. Verificado por diff que a concatenaÃ§Ã£o dos 5 arquivos Ã© **byte a byte idÃªntica** ao `style.css` antigo (nenhuma regra reordenada, cascata preservada), e comparado o CSS computado de elementos-chave (site, catÃ¡logo, admin) entre local e produÃ§Ã£o antes de publicar.
- Nomes dos arquivos sÃ£o sÃ³ pra navegaÃ§Ã£o (achar mais rÃ¡pido "os ajustes da era V24" em vez de rolar 2000 linhas) â€” nÃ£o sÃ£o mÃ³dulos isolados por tema; uma classe pode ter regras em mais de um arquivo, igual jÃ¡ acontecia dentro do arquivo Ãºnico.

## 28.16.2 â€” MÃ³dulo compartilhado + bug real de duraÃ§Ã£o

- **Bug corrigido: serviÃ§o "Luzes" (1h30) sendo tratado como 1h.** `parseDuration()` (usada ao adicionar um serviÃ§o pelo catÃ¡logo) sÃ³ reconhecia minutos quando o texto tinha a palavra "min" â€” em "1h30" (sem "min"), os 30 minutos eram descartados silenciosamente, virando 60min. Isso afetava a duraÃ§Ã£o salva no agendamento real (`duration_minutes`) e a checagem de horÃ¡rios disponÃ­veis, nÃ£o sÃ³ a etiqueta mostrada na tela. Nenhum agendamento de "Luzes" existia ainda no banco quando o bug foi encontrado (achado por teste automatizado antes de causar problema real).
- **ExtraÃ­da lÃ³gica pura compartilhada** (`assets/js/booking-format.js`): `money`, `parseDuration`, `fmtDuration`, `addMinutes`, `addDaysISO`, `dayOfWeek`, `isOpenDay`, `closingMinutes`, `prettyDate`, `nextOpenDay` â€” antes duplicadas/embutidas em `service-cart-v22-5.js` e `agenda-v15.js`. Os dois arquivos agora importam desse mÃ³dulo via `<script type="module">` (sem etapa de build; sÃ³ as 2 pÃ¡ginas que carregam esses scripts precisaram do ajuste). Testado que a ordem de carregamento (Supabase/config/catÃ¡logo antes do mÃ³dulo) continua correta.
- **SuÃ­te de testes automatizados criada** (`tests/`, ver `tests/README.md`): Playwright para fluxo real no navegador (rotas, carrinho, revisÃ£o de agendamento) e Vitest para a lÃ³gica pura extraÃ­da. `npm test` roda tudo com seguranÃ§a (nÃ£o grava nada em produÃ§Ã£o); um teste Ã  parte (`npm run test:e2e:live`) cria/reagenda/cancela/apaga um agendamento de verdade, opt-in, com telefone fictÃ­cio.

## 28.16.1 â€” 2 ajustes pendentes da revisÃ£o anterior

- **Atalhos do app instalÃ¡vel (PWA) do admin completos:** faltavam Fidelidade, Mensagens, RelatÃ³rios e Lista de espera no `admin-manifest.webmanifest` â€” sÃ³ as telas mais antigas tinham atalho. Adicionadas as 4 (nem todo celular mostra os 10 de uma vez, mas todas as seÃ§Ãµes agora estÃ£o disponÃ­veis).
- **Ãšltimas variaÃ§Ãµes de dourado/preto quase idÃªnticas ao oficial:** encontradas 4 cores a mais que nÃ£o usavam `--gold`/`--gold2` por engano (`#e4bd55`, `#f2cf82`) e o texto sobre fundo dourado ainda tinha 3 tons de preto quase iguais espalhados (`#111`, `#090909`, alÃ©m do `#17100a` jÃ¡ corrigido antes) em vez do padrÃ£o `#16100a`. Unificados. Deixadas de propÃ³sito as variaÃ§Ãµes de dourado que fazem parte de um design especÃ­fico (ex.: o degradÃª do card "selecionado" no agendamento, o card VIP do CRM) â€” essas sÃ£o diferentes por decisÃ£o de design, nÃ£o por engano.

## 28.16.0 â€” RevisÃ£o de referÃªncias quebradas e polimento visual

- **Rota `/agendar/` consolidada:** existiam 3 pÃ¡ginas concorrentes para o mesmo fluxo â€” `servicos.html` (catÃ¡logo duplicado, Ã³rfÃ£o, sem link em lugar nenhum do site) e `agendar/agendar.html` (stub de redirect residual, tambÃ©m sem link). `servicos.html` virou um redirect real para `/agendar/` (mesmo padrÃ£o do redirect jÃ¡ usado em `agendar.html`â†’`agendar.html` da raiz) e `agendar/agendar.html` foi removido (nÃ£o referenciado, `/agendar.html` continua a etapa 2 do agendamento). Corrigidos tambÃ©m um link com domÃ­nio completo hardcoded em `agendar/index.html` (deveria ser caminho absoluto, igual ao resto do site) e a mesma inconsistÃªncia em `produtos.html`.
- **`404.html` carregava recursos quebrados dependendo de onde o erro acontecia:** o Ã­cone, o botÃ£o "Voltar para o inÃ­cio" e o script de privacidade usavam caminho relativo (`assets/...`, `index.html`, `privacy-consent-v22-4.js`) â€” funcionava normalmente para um 404 na raiz, mas quebrava se o link quebrado estivesse dentro de uma subpasta (ex.: algo em `/agendar/algo-errado`), porque o navegador resolve caminho relativo pela URL da barra de endereÃ§o, nÃ£o pela pasta real do arquivo. Nesse caso o script de privacidade nÃ£o carregava e o botÃ£o "Voltar para o inÃ­cio" ia parar no catÃ¡logo de serviÃ§os em vez da home. Testado ao vivo simulando um 404 dentro de `/agendar/` antes e depois da correÃ§Ã£o. Todos os caminhos desse arquivo agora sÃ£o absolutos.
- **Cache-busting (`?v=`) padronizado:** os parÃ¢metros de versÃ£o de CSS/JS/manifest estavam espalhados por 10 versÃµes diferentes (`28.0.14` atÃ© `24.3`) mesmo com `VERSAO.md` jÃ¡ em 28.15.0 â€” algumas pÃ¡ginas do admin carregavam um `style.css` 15 releases mais velho que outras. Unificado tudo para `?v=28.16.0`, incluindo os links de manifest que nÃ£o tinham parÃ¢metro nenhum. `sw.js` tambÃ©m teve o nome do cache atualizado, o que limpa caches antigos de visitantes recorrentes na prÃ³xima visita.
- **`manifest.webmanifest`:** atalho "Agendar" do PWA apontava para `servicos.html` (a pÃ¡gina Ã³rfÃ£); agora aponta direto para `/agendar/`.
- **`robots.txt`:** faltava bloquear `admin-relatorios.html` e `admin-espera.html` (jÃ¡ tinham `noindex` prÃ³prio, mas ficaram fora da lista por esquecimento ao serem criadas).
- **Polimento visual (identidade mantida):** o painel administrativo usava um dourado ligeiramente diferente do dourado oficial do site (`#d4af37`/`#f5d56f` vs `--gold`/`--gold2` reais) em dezenas de regras â€” unificado para o mesmo dourado em toda parte. Adicionados: estado visual de botÃ£o desabilitado (antes um botÃ£o desabilitado parecia idÃªntico a um habilitado), anel de foco acessÃ­vel em links/botÃµes/campos para navegaÃ§Ã£o por teclado, feedback ao pressionar botÃµes, transiÃ§Ãµes mais suaves e consistentes em cards e opÃ§Ãµes de serviÃ§o/horÃ¡rio que antes mudavam de estado sem animaÃ§Ã£o, e respeito Ã  preferÃªncia `prefers-reduced-motion` do sistema.

## 28.15.0 â€” Blog do site (SEO local)

- **3 artigos novos no blog** (`blog.html` + `blog-barboterapia.html`, `blog-barba-encravada-ressecada.html`, `blog-produtos-profissionais-caseiros.html`), parte do plano de SEO local pra converter mais gente organicamente: Barboterapia, Barba encravada/ressecada, Produtos profissionais x caseiros. Textos revisados no `AUDITORIA-SEO-2026-07-24.md`, publicados como estÃ£o.
- Cada artigo tem `Article` + `BreadcrumbList` em Schema.org, meta description e Open Graph prÃ³prios, link cruzado entre os 3 artigos e para `/agendar/#servicos` ou `produtos.html` conforme o assunto.
- Blog linkado no rodapÃ© de `index.html`, `produtos.html` e `servicos.html`, e as 4 novas pÃ¡ginas adicionadas ao `sitemap.xml` (agora com 10 URLs).
- Testado localmente (servidor estÃ¡tico) antes de publicar: CSS, JuIA chat e scripts carregam sem erro em todas as pÃ¡ginas novas, JSON-LD validado.

## 28.14.0 â€” JuIA adiciona/remove produto de um agendamento jÃ¡ confirmado

- **JuIA agora adiciona ou remove produto de um agendamento existente:** se o cliente esqueceu de pedir a pomada na hora de marcar, ou mudou de ideia sobre um produto reservado, ele pode pedir direto pelo WhatsApp ("posso adicionar um produto no meu agendamento?", "quero tirar o Ã³leo do meu agendamento") â€” a JuIA identifica o agendamento, confirma o produto (com preÃ§o) e atualiza sozinha, sem mexer em serviÃ§o, dia ou horÃ¡rio. Mesmo padrÃ£o de seguranÃ§a dos outros trÃªs recursos (telefone verificado, confirmaÃ§Ã£o antes de executar, push depois).
- DetecÃ§Ã£o de pedido ajustada para aceitar frases naturais (ex.: "adicionar **um** produto", nÃ£o sÃ³ "adicionar produto" exato) â€” testado e corrigido durante o desenvolvimento antes de publicar.
- Migration `045-v28.14.0-produtos-agendamento-whatsapp.sql`: funÃ§Ã£o nova `phone_update_booking_products` (autorizada por telefone) e `phone_upcoming_bookings` ganha `selected_products`. `ju-ia-site` redeployado. Testado com agendamento fictÃ­cio (telefone de teste, apagado depois) via SQL direto e via WhatsApp simulado â€” execuÃ§Ã£o real sÃ³ verificada por SQL, para nÃ£o disparar push real pro celular do Juliano.

## 28.13.1 â€” JuIA reconhece serviÃ§o em mensagens curtas ou com erro de digitaÃ§Ã£o

- **Cliente disse "Barba e pezinho" e depois "Barbo terapia" (typo de Barboterapia) e a JuIA nÃ£o reconheceu nenhum dos dois** â€” respondeu a lista genÃ©rica "Mais procurados" as duas vezes, e o cliente reclamou ("Muito confuso esse AI no whatsapp"), achado revisando as conversas reais de ontem/hoje. Acontecia porque o reconhecimento de serviÃ§o dependia inteiramente do modelo de IA extrair o nome certinho do catÃ¡logo â€” sem isso, a JuIA desistia direto pra lista genÃ©rica. Agora, antes de desistir, ela tenta casar o texto do cliente contra o catÃ¡logo (separando por "e"/"+"/"/", e tolerando erro de digitaÃ§Ã£o com espaÃ§o a mais/a menos, como "Barbo terapia" â†’ "Barboterapia").
- **Corrigido tambÃ©m um bug que essa mudanÃ§a ia expor**: o reconhecimento de serviÃ§o por trecho de texto (ex. "Barba") batia tanto em "Barba Express" quanto em "Corte + Barba Express" (o combo contÃ©m o nome do serviÃ§o avulso) â€” e sempre ganhava o primeiro da lista, que por acaso Ã© sempre o combo mais caro. Corrigido pra escolher o nome mais prÃ³ximo em tamanho do texto buscado, nÃ£o o primeiro encontrado â€” beneficia todo o reconhecimento de serviÃ§o do sistema, nÃ£o sÃ³ esse caso novo.
- `ju-ia-site` redeployado (sem migration â€” mudanÃ§a sÃ³ na lÃ³gica de reconhecimento de serviÃ§o). Testado localmente com os dois casos reais que geraram a reclamaÃ§Ã£o, mais casos de controle (nomes exatos do catÃ¡logo, mensagens sem serviÃ§o nenhum) antes de publicar.

## 28.13.0 â€” JuIA reagenda e troca o serviÃ§o de um agendamento sozinha

- **JuIA agora reagenda direto, sem cancelar e recriar:** antes, quando o cliente pedia pra mudar de dia/horÃ¡rio ("posso mudar pra sexta Ã s 15h?", "quero remarcar"), a JuIA sÃ³ sabia cancelar o agendamento antigo e criar um novo do zero â€” perdendo o histÃ³rico do registro original e obrigando o cliente a repetir tudo (nome, serviÃ§o etc., no site; no WhatsApp o nome/telefone jÃ¡ ficavam sabidos, mas o registro ainda virava um novo). Agora, no WhatsApp (nÃºmero verificado pelo canal, mesma regra do cancelamento), ela identifica o agendamento futuro do cliente, confirma o novo horÃ¡rio disponÃ­vel (consultando a agenda de verdade) e sÃ³ reagenda de fato depois do "sim" â€” muda `booking_date`/`start_time` do mesmo registro, preservando histÃ³rico e notas. Push de notificaÃ§Ã£o depois, igual ao cancelamento.
- **JuIA agora troca o serviÃ§o de um agendamento sozinha:** se o cliente marcou "Corte" e depois pede "pode trocar o serviÃ§o pra Barba?", ela identifica o agendamento, confirma o serviÃ§o novo (com preÃ§o e duraÃ§Ã£o) e troca â€” sem mexer em dia/horÃ¡rio, a menos que o novo serviÃ§o nÃ£o caiba mais nesse horÃ¡rio (aÃ­ ela avisa e sugere tentar outro serviÃ§o ou horÃ¡rio).
- **Nos avisos de "vocÃª jÃ¡ tem um agendamento" (disponibilidade e agendamento novo):** antes sÃ³ oferecia cancelar o antigo ou manter os dois. Agora tem uma terceira opÃ§Ã£o â€” mudar o agendamento existente pro novo horÃ¡rio que o cliente estava pedindo, em vez de cancelar e criar de novo.
- **Corrige uma brecha de seguranÃ§a da v28.12.0:** as duas funÃ§Ãµes de cancelamento por telefone (`phone_upcoming_bookings`, `whatsapp_cancel_booking`) foram criadas sem a trava de acesso que as demais funÃ§Ãµes sensÃ­veis desse tipo sempre tiveram â€” ficaram com permissÃ£o padrÃ£o do Supabase liberada pra chave pÃºblica do site (`anon`), ou seja, tecnicamente chamÃ¡veis direto por fora do fluxo de confirmaÃ§Ã£o da JuIA. Corrigido: agora sÃ³ o `service_role` (usado internamente pelas Edge Functions) pode executÃ¡-las, igual Ã s funÃ§Ãµes de reagendamento/troca de serviÃ§o novas.
- Migration `044-v28.13.0-reagendamento-e-troca-servico-whatsapp.sql`: funÃ§Ãµes novas `phone_reschedule_booking` e `phone_change_booking_service` (autorizadas por telefone, mesmo padrÃ£o do cancelamento), `phone_upcoming_bookings` ganha `duration_minutes`. `ju-ia-site` redeployado. Testado com um agendamento fictÃ­cio (telefone de teste, apagado depois) via SQL direto e via WhatsApp simulado antes de publicar.

## 28.12.0 â€” JuIA ganha a capacidade de cancelar agendamento sozinha

- **JuIA agora sabe cancelar um agendamento, com confirmaÃ§Ã£o do cliente:** antes, qualquer pedido de cancelamento ("pode cancelar", "jÃ¡ marquei em outro lugar") sÃ³ gerava um "vou encaminhar pra equipe" â€” mesmo quando ela jÃ¡ tinha identificado certinho qual agendamento era. Agora, no WhatsApp (nÃºmero jÃ¡ verificado pelo prÃ³prio canal â€” nunca no chat do site, onde o telefone digitado nÃ£o Ã© confiÃ¡vel), a JuIA identifica o agendamento futuro do cliente, confirma com ele ("Ã© o de dia 30 Ã s 17:30 pra Corte + Barboterapia que vocÃª quer cancelar? sim ou nÃ£o") e sÃ³ cancela de fato depois do "sim". VocÃª recebe uma notificaÃ§Ã£o push depois, igual jÃ¡ acontecia quando o cliente cancelava pelo link do e-mail/SMS.
- **JuIA agora detecta e resolve agendamentos duplicados sozinha:** identificamos um caso real em que um cliente ficou com dois agendamentos no mesmo dia (13:30 e 14:15, o segundo criado pela prÃ³pria JuIA sem perceber que ele jÃ¡ tinha o primeiro) â€” os dois viraram falta. Agora, sempre que a JuIA nota dois agendamentos futuros no mesmo dia pra um cliente, ela pergunta proativamente qual dos dois ele quer manter e cancela o outro sozinha (ou mantÃ©m os dois, se for o que o cliente quiser).
- **Evita criar um agendamento duplicado antes de acontecer:** se o cliente jÃ¡ tem um horÃ¡rio marcado e pede disponibilidade ou tenta agendar de novo (no mesmo dia ou em outro dia), a JuIA para e confirma antes de seguir â€” em vez de tentar criar um novo (que antes podia devolver a mensagem sem sentido "esse horÃ¡rio acabou de ficar indisponÃ­vel" quando o "indisponÃ­vel" era o prÃ³prio horÃ¡rio do cliente).
- **ServiÃ§o citado direto (ex.: "barba e pezinho") agora Ã© reconhecido na hora:** antes, mesmo quando o cliente jÃ¡ dizia exatamente o que queria, a JuIA Ã s vezes respondia com a lista genÃ©rica de "mais procurados" em vez de seguir direto pra pergunta do dia. E a frase "Para 30 minutos, estes sÃ£o os horÃ¡rios..." (que soava estranha, jÃ¡ que ninguÃ©m perguntou sobre minutos) agora menciona o nome do serviÃ§o em vez da duraÃ§Ã£o.
- Migration `043-v28.12.0-cancelamento-whatsapp.sql` (duas funÃ§Ãµes novas: `phone_upcoming_bookings` e `whatsapp_cancel_booking`, ambas restritas por telefone). `ju-ia-site` redeployado. Testado com dados de teste isolados (criados e apagados na hora, sem notificaÃ§Ã£o real disparada) antes de publicar.

## 28.11.1 â€” Corrige pesquisa de satisfaÃ§Ã£o e pergunta de disponibilidade nÃ£o reconhecidas no WhatsApp

- **Cliente respondia a pesquisa de satisfaÃ§Ã£o e a JuIA nÃ£o entendia:** o WhatsApp Ã s vezes manda o nÃºmero do cliente sem o "9" que fica antes do celular (formato antigo), mesmo quando o nÃºmero cadastrado tem o "9" (formato atual). Isso fazia o sistema nÃ£o bater o nÃºmero recebido com o nÃºmero cadastrado â€” resultado: quando o cliente respondia ðŸ˜Š pra pesquisa de satisfaÃ§Ã£o, a JuIA nÃ£o reconhecia que era uma resposta da pesquisa (nÃ£o mandava o link de avaliaÃ§Ã£o do Google) e tambÃ©m nÃ£o reconhecia o cliente como alguÃ©m que acabou de ser atendido, respondendo com a saudaÃ§Ã£o genÃ©rica "Como posso ajudar vocÃª hoje?" â€” como se fosse um nÃºmero desconhecido.
- Corrigido criando uma forma Ãºnica de comparar telefones que ignora esse "9" opcional, usada tanto para achar a pesquisa de satisfaÃ§Ã£o pendente quanto para a JuIA reconhecer o cliente (nome, histÃ³rico, pontos de fidelidade) pelo WhatsApp.
- Migration `042-v28.11.1-fix-whatsapp-9-digito.sql`. Sem mudanÃ§a de tela, sem deploy de Edge Function â€” a correÃ§Ã£o Ã© sÃ³ no banco.
- **Cliente perguntou "Tem horÃ¡rio agora??" e a JuIA respondeu que ia encaminhar pro Juliano, em vez de checar a agenda:** a JuIA sÃ³ consultava a agenda de verdade quando jÃ¡ sabia o serviÃ§o **e** o dia â€” faltando qualquer um dos dois (como numa pergunta direta sem contexto), a resposta ficava sÃ³ por conta do modelo, que Ã s vezes preferia dizer que ia encaminhar para o Juliano em vez de perguntar o que faltava. Agora perguntas de disponibilidade ("tem horÃ¡rio", "tem vaga", "horÃ¡rio livre", etc.) nunca mais viram encaminhamento: se faltar o serviÃ§o, a JuIA pergunta qual; se faltar o dia (e o cliente disse "agora"/"hoje"), assume hoje automaticamente; sÃ³ entÃ£o consulta a agenda de verdade.
- **Corrigido tambÃ©m um problema relacionado que apagava o serviÃ§o jÃ¡ escolhido:** sempre que uma mensagem do cliente nÃ£o citava o serviÃ§o de novo (ex.: sÃ³ "oi", ou uma pergunta de disponibilidade), o serviÃ§o escolhido no turno anterior era apagado da conversa sem querer â€” o que deixava a JuIA "esquecendo" o que o cliente jÃ¡ tinha pedido. Corrigido no `ju-ia-site` (Edge Function redeployada, sem migration).

## 28.11.0 â€” JuIA para de mandar mensagem redundante + admin pode agendar fora do horÃ¡rio

- **JuIA nÃ£o manda mais o "cochicho" de reativaÃ§Ã£o quando nÃ£o faz sentido:** existe um robÃ´ (`whatsapp-reactivation-watchdog`, roda a cada 1 min) que, quando o Juliano assume uma conversa manualmente e depois fica 2 minutos sem responder, manda um "Oi! Ainda estou por aqui..." e devolve a conversa pra JuIA. O problema: ele mandava essa mensagem mesmo quando a conversa jÃ¡ tinha terminado naturalmente (ex.: cliente respondeu sÃ³ com uma figurinha de "toca aqui" ou um "valeu!"), o que soava robÃ³tico e podia irritar quem jÃ¡ tinha sido bem atendido. Agora, antes de mandar, ele confere a Ãºltima mensagem do cliente: se foi uma figurinha/imagem/Ã¡udio sem texto, sÃ³ emoji, ou uma despedida/agradecimento curto ("obrigado", "valeu", "blz", "tranquilo", etc.), ele fica quieto (a conversa continua liberada pra JuIA responder normalmente se o cliente escrever de novo). Testado com 12 casos reais, incluindo perguntas genuÃ­nas que **nÃ£o podem** ser silenciadas â€” todas passaram.
- **Admin pode agendar fora do horÃ¡rio de funcionamento:** nova caixinha "Permitir fora do horÃ¡rio de funcionamento" na tela **Novo agendamento** e no encaixe da **Lista de espera**. SÃ³ funciona pra quem estÃ¡ logado como admin de verdade (testado: sem sessÃ£o de admin, a exceÃ§Ã£o Ã© recusada). Continuam proibidos, mesmo com a caixinha marcada: bloqueios manuais que o Juliano jÃ¡ cadastrou e conflito de horÃ¡rio com outro agendamento â€” a brecha Ã© sÃ³ pra abrir o horÃ¡rio, nÃ£o pra ignorar um bloqueio ou dar overbooking sem querer. O agendamento pÃºblico (site/JuIA) nÃ£o Ã© afetado, continua restrito ao horÃ¡rio normal.
- Migration `041-v28.11.0-admin-fora-do-horario.sql`: atualiza `admin_create_booking` e `admin_reschedule_booking` com o novo parÃ¢metro (`default false`, entÃ£o nada muda pra quem jÃ¡ usava essas funÃ§Ãµes). **AtenÃ§Ã£o pra quem for reaplicar esta migration em outro banco:** ela primeiro remove as versÃµes antigas das duas funÃ§Ãµes antes de recriar â€” sem isso, o Postgres cria uma segunda versÃ£o em paralelo em vez de substituir (foi exatamente o que aconteceu ao aplicar direto no banco de produÃ§Ã£o, e foi corrigido na hora).

## 28.10.0 â€” Dois serviÃ§os novos: Raspar a cabeÃ§a e Corte infantil

- **Novo serviÃ§o "Raspar a cabeÃ§a" (R$ 40, 30 min):** raspagem completa da cabeÃ§a, com ou sem navalha. Adicionado ao catÃ¡logo do site (`services-catalog-v7.js`, usado pela agenda e pelo admin), Ã  pÃ¡gina de serviÃ§os (`servicos.html`) e ao catÃ¡logo da JuIA (site + WhatsApp).
- **Novo serviÃ§o "Corte de cabelo infantil" (R$ 40, 30 min):** corte para crianÃ§as, na tesoura ou na tesoura com mÃ¡quina, com descriÃ§Ã£o pensada para transmitir cuidado e confianÃ§a aos pais. Mesmos trÃªs lugares do serviÃ§o acima.
- **JuIA atualizada:** antes, quando alguÃ©m pedia "raspar a cabeÃ§a", ela ficava confusa (perguntava se era cabeÃ§a ou barba) e, mesmo depois de entender, tratava como um "Corte de cabelo" comum. Agora ela reconhece "raspar a cabeÃ§a", "raspar com mÃ¡quina/navalha", "deixar no zero", "carequinha" como o serviÃ§o certo ("Raspar a cabeÃ§a"), e reconhece pedidos de corte para filho(a)/crianÃ§a como "Corte de cabelo infantil". Testado com o modelo real: os trÃªs serviÃ§os (raspar, infantil, corte comum) sÃ£o identificados corretamente e sem confusÃ£o entre si.
- Cache dos arquivos de catÃ¡logo (`services-catalog-v7.js`) atualizado em todas as 8 pÃ¡ginas que o usam, para garantir que o navegador carregue a versÃ£o nova.

## 28.9.0 â€” CorreÃ§Ãµes da JuIA no WhatsApp

- **JuIA parava de pedir o WhatsApp do cliente mesmo jÃ¡ sabendo o nÃºmero:** no canal WhatsApp, quem estÃ¡ mandando mensagem jÃ¡ tem o nÃºmero identificado pelo prÃ³prio WhatsApp â€” mas esse dado nunca era repassado para a JuIA, que continuava perguntando o WhatsApp mesmo estando no meio da conversa. Corrigido: `whatsapp-webhook` agora envia o telefone confirmado do remetente, e a JuIA (`ju-ia-site`) o usa automaticamente e nunca mais pergunta (no chat do site, onde o nÃºmero realmente nÃ£o Ã© conhecido, continua perguntando normalmente).
- **Mensagens contraditÃ³rias ("agendamento confirmado" seguido de "ainda precisa ser confirmado"):** causado por uma corrida â€” duas mensagens do mesmo cliente chegando quase ao mesmo tempo (ex.: o cliente manda o WhatsApp e, poucos segundos depois, pergunta o endereÃ§o) eram processadas em paralelo, cada uma lendo o estado da conversa antes da outra terminar de salvar. Corrigido com uma trava de processamento por telefone (nova coluna `processing_locked_until` em `whatsapp_conversations`, migration `040-v28.9.0-whatsapp-fixes.sql`): agora a segunda mensagem espera a primeira terminar antes de responder, sempre com o estado mais atualizado.
- **"Raspar a cabeÃ§a" nÃ£o era entendido:** a JuIA nÃ£o sabia que "raspar a cabeÃ§a", "raspar com mÃ¡quina/navalha", "deixar no zero" etc. se referem ao corte de cabelo. Corrigido via instruÃ§Ã£o direta no prompt (depois, na v28.10.0, virou um serviÃ§o prÃ³prio com essa mesma lÃ³gica).
- Nenhuma mudanÃ§a visÃ­vel para o cliente alÃ©m das prÃ³prias correÃ§Ãµes â€” sem novo secret, sem novo cron.

## 28.8.0 â€” Lista de espera / encaixe + alerta de WhatsApp desconectado

- **Nova tela "Lista de espera" (`admin-espera.html` + `admin-espera-v28.js`):** mostra quem estÃ¡ esperando vaga, com filtros por status (Esperando/Avisados/Encaixados/Cancelados), por dia da semana (Terâ€“SÃ¡b), por turno (ManhÃ£/Tarde) e por Semana/MÃªs (mesmo seletor dos RelatÃ³rios). Cada pedido mostra nome, contato, quando a pessoa prefere, serviÃ§o desejado e hÃ¡ quantos dias estÃ¡ esperando. AÃ§Ãµes: WhatsApp (mensagem pronta oferecendo a vaga), Editar, Encaixar (mini-formulÃ¡rio que cria o agendamento direto, com data/horÃ¡rio/serviÃ§o, e marca o pedido como "encaixado"), Cancelar e Excluir. BotÃ£o "ï¼‹ Adicionar Ã  lista" para quando o pedido chegar por telefone/pessoalmente.
- **Nova tabela `waitlist`** (migration `039-v28.8.0-waitlist.sql`): guarda nome, telefone, e-mail, serviÃ§o desejado, dia especÃ­fico OU dias da semana, turno, faixa de horÃ¡rio e uma janela "disposto a esperar de/atÃ©". Nova funÃ§Ã£o `waitlist_matches_for_slot(data, hora)` acha quem, na lista, aceitaria aquele exato dia/horÃ¡rio â€” Ã© a base do alerta de vaga aberta.
- **No site (`agendar.html`):** quando o cliente escolhe uma data que estÃ¡ sem horÃ¡rios, alÃ©m de ser levado automaticamente para o prÃ³ximo dia disponÃ­vel, aparece a opÃ§Ã£o "Queria mesmo [aquele dia]? Entrar na lista de espera" â€” pede nome, WhatsApp, e-mail (opcional) e turno preferido. Nova funÃ§Ã£o `join-waitlist` recebe o pedido com seguranÃ§a (mesmo padrÃ£o de `create-public-booking`); evita duplicar quem jÃ¡ estÃ¡ esperando (atualiza a preferÃªncia em vez de criar de novo).
- **Alerta automÃ¡tico de vaga aberta:** quando um agendamento Ã© cancelado â€” pelo admin (`admin-booking-status`) ou pelo prÃ³prio cliente no link dele (`manage-booking`) â€” o sistema confere se alguÃ©m da lista de espera aceitaria aquele dia/horÃ¡rio e, se sim, avisa o dono por notificaÃ§Ã£o push com o(s) nome(s), linkando direto para a tela de Lista de espera.
- **Alerta de WhatsApp desconectado:** `notifications-watchdog` (que jÃ¡ roda a cada 15 min) passou a checar tambÃ©m a conexÃ£o da JuIA com o WhatsApp (Evolution). Se cair, avisa por push e e-mail; quando reconectar, avisa que voltou. Isso permite desligar com seguranÃ§a as mensagens automÃ¡ticas de saudaÃ§Ã£o/ausÃªncia do prÃ³prio WhatsApp Business, jÃ¡ que a JuIA cobre esse papel e agora hÃ¡ aviso se ela cair.
- **Menu:** item "Lista de espera" (â³) adicionado Ã  barra lateral de todas as telas do admin.
- Tudo testado antes de publicar: lÃ³gica de filtros (semana/mÃªs/dia da semana/turno) verificada com casos simulados: `join-waitlist` testado ao vivo (evita duplicidade por telefone); `waitlist_matches_for_slot` testado com casos reais de turno; alerta de WhatsApp confirmado nos logs em produÃ§Ã£o lendo `state: "open"` corretamente.

## 28.7.1 â€” RelatÃ³rios: filtro por semana (terÃ§a a sÃ¡bado)

- **Novo seletor MÃªs / Semana** na tela de RelatÃ³rios. AlÃ©m da visÃ£o mensal, dÃ¡ para ver o resumo de uma **semana**, definida como **terÃ§a a sÃ¡bado** (os dias em que a barbearia abre). As setas â€¹ â€º passam a andar de semana em semana (ou de mÃªs em mÃªs, conforme o modo) e o botÃ£o de avanÃ§ar fica desativado ao chegar no perÃ­odo atual.
- Todos os nÃºmeros e blocos (faturamento, atendimentos, ticket, clientes, satisfaÃ§Ã£o, faltas, serviÃ§os mais vendidos, novos vs. recorrentes, serviÃ§osÃ—produtos) passaram a trabalhar por **intervalo de datas** em vez de sÃ³ "mÃªs", entÃ£o valem igual para semana ou mÃªs. "Recorrente" agora Ã© quem jÃ¡ teve atendimento concluÃ­do antes do **inÃ­cio do perÃ­odo** selecionado.
- SÃ³ front-end (`admin-relatorios.html` + `admin-relatorios-v28.js`, cache `28.7.1`). Sem migration, sem banco, sem envio. Validado com os dados reais: semana 21â€“25/07 fechou R$ 375,00 em 7 atendimentos, ticket R$ 53,57, 6 clientes novos e 1 recorrente.

## 28.7.0 â€” RelatÃ³rios do negÃ³cio (novo painel de leitura)

- **Nova tela "RelatÃ³rios" (`admin-relatorios.html` + `admin-relatorios-v28.js`):** painel sÃ³ de leitura no admin que resume o mÃªs â€” faturamento (atendimentos concluÃ­dos, somando serviÃ§os + produtos), atendimentos concluÃ­dos, ticket mÃ©dio, clientes atendidos, taxa de satisfaÃ§Ã£o e faltas (no-shows). Traz trÃªs blocos visuais: serviÃ§os mais vendidos (ranking por vezes vendidas + receita), clientes novos vs. recorrentes e detalhe do faturamento (serviÃ§os vs. produtos). NavegaÃ§Ã£o por mÃªs (â€¹ â€º) para consultar meses anteriores; o botÃ£o de prÃ³ximo mÃªs fica desativado no mÃªs atual.
- **Sem envio de mensagens e sem alteraÃ§Ã£o no banco:** a tela apenas consulta `bookings` e `experience_requests` (mesmo acesso autenticado que as demais telas do admin jÃ¡ usam). NÃ£o hÃ¡ migration nova nem deploy de Edge Function â€” basta publicar os arquivos estÃ¡ticos.
- **DefiniÃ§Ãµes usadas nos nÃºmeros:** faturamento e ticket mÃ©dio contam apenas agendamentos com status `completed`; "cliente recorrente" = jÃ¡ teve um atendimento concluÃ­do antes do mÃªs analisado (senÃ£o Ã© "novo"), contando cada pessoa uma vez pelo telefone; a taxa de satisfaÃ§Ã£o Ã© sobre as pesquisas respondidas (satisfeitos Ã· respostas) das pesquisas criadas no mÃªs.
- **Menu:** item "RelatÃ³rios" (ðŸ“ˆ) adicionado Ã  barra lateral de todas as telas do admin e atalho na VisÃ£o geral.
- Validado com os dados reais de produÃ§Ã£o (julho/2026): R$ 1.025,00 faturados em 20 atendimentos, ticket R$ 51,25, 19 clientes atendidos, 100% de satisfaÃ§Ã£o (2 de 2 respostas), 0 faltas â€” o prÃ³prio `admin-relatorios-v28.js` foi executado ponta a ponta contra esses dados e os nÃºmeros conferiram.

## 28.2.0 â€” Status real de entrega, alerta de saldo SMSDev e fallback cruzado

- **ConfirmaÃ§Ã£o de entrega do SMS (DLR):** o status `sent` da `sms_queue` sÃ³ indicava que a SMSDev aceitou o envio, nÃ£o que o SMS chegou de fato no celular. Nova coluna `delivery_status` (`unknown`/`delivered`/`failed`) Ã© preenchida consultando `api.smsdev.com.br/v1/dlr` periodicamente.
- **Alerta de saldo baixo:** nova tabela `integration_alerts` guarda o Ãºltimo saldo lido da SMSDev. Quando o saldo fica abaixo de 100 crÃ©ditos, um e-mail de aviso Ã© enviado para `contato@barbeariadoju.com.br` (com cooldown de 24h entre alertas repetidos).
- **Fallback cruzado SMS â†” e-mail:** se a entrega do SMS for confirmada como falha (cliente tem e-mail cadastrado), a confirmaÃ§Ã£o Ã© reenviada automaticamente por e-mail. Se o envio de e-mail falhar na hora (erro do Zoho), tenta SMS imediatamente, quando o cliente tiver telefone â€” o que Ã© sempre, jÃ¡ que o campo Ã© obrigatÃ³rio. DeduplicaÃ§Ã£o usa o mesmo padrÃ£o jÃ¡ existente em `booking-reminder-24h` (verifica as duas filas antes de reenviar), evitando reenvio duplicado ou loop entre os dois canais.
- **Nova Edge Function `notifications-watchdog`:** roda a cada 15 minutos (cron), fazendo a checagem de DLR, o disparo do fallback e a checagem de saldo.
- **`booking-email` atualizada:** aceita `channel` opcional para forÃ§ar um canal especÃ­fico (usado pelo fallback). Resposta passa a incluir `customer_channel_fallback_used`.
- **Painel administrativo:** nova aba "SMS automÃ¡ticos" na Central de ComunicaÃ§Ã£o (`admin-mensagens.html`), com cartÃ£o de saldo SMSDev, mÃ©tricas e histÃ³rico de envios â€” mesmo padrÃ£o jÃ¡ usado para e-mails.
- Nova migration `030-v28.2.0-status-fallback.sql`.

## 28.1.1 â€” Corrige falha ao marcar agendamento como concluÃ­do

- **Bug corrigido (crÃ­tico, aplicado ao vivo no Supabase):** clicar em "Concluir" num agendamento de cliente com e-mail cadastrado falhava sempre, com erro genÃ©rico "NÃ£o foi possÃ­vel concluir esta aÃ§Ã£o. Atualize a pÃ¡gina e tente novamente." Causa: as migrations `027-v27-1-crm-premium-experiencia.sql` e `027-v27-1-experiencia-crm-real.sql` descrevem duas versÃµes incompatÃ­veis de `experience_requests`, e as duas acabaram sendo executadas no banco em momentos diferentes â€” a tabela ficou com colunas `customer_name`/`customer_email` obrigatÃ³rias (da primeira), mas o trigger que roda ao concluir (`v27_queue_experience_after_completion`, da segunda) nunca preenchia essas colunas, violando a restriÃ§Ã£o not-null e cancelando a atualizaÃ§Ã£o inteira.
- O contrato realmente usado em produÃ§Ã£o (`avaliacao-v27.js`, `get_experience_context`, `submit_experience_response`) jÃ¡ segue a segunda versÃ£o, entÃ£o a tabela foi ajustada para combinar com o cÃ³digo jÃ¡ publicado, em vez de mudar o cÃ³digo: `customer_name`/`customer_email` deixaram de ser obrigatÃ³rias e a lista de status permitidos passou a incluir `opened`/`satisfied`/`feedback`/`review_clicked`/`expired` â€” valores que o cÃ³digo jÃ¡ grava, mas que a restriÃ§Ã£o antiga bloqueava (esse segundo problema ainda nÃ£o tinha sido notado porque nenhuma linha chegava a ser criada em `experience_requests`).
- Nova migration `029-v28.1.1-fix-conclusao-atendimento.sql`.

## 28.1.0 â€” Fallback de SMS para clientes sem e-mail

- **Nova funÃ§Ã£o `send-sms`:** envia SMS via API da SMSDev (`api.smsdev.com.br/v1/send`), com fila e histÃ³rico em `sms_queue` (mesmo padrÃ£o de `email_queue`/Zoho).
- **`booking-email` atualizada:** quando o cliente nÃ£o informou e-mail, mas informou telefone (campo sempre obrigatÃ³rio), a confirmaÃ§Ã£o/reagendamento/cancelamento/lembrete Ã© enviado por SMS em vez de ser simplesmente ignorado. Retorno da funÃ§Ã£o passa a incluir `customer_channel` (`email`, `sms` ou `none`).
- **`booking-reminder-24h` corrigida:** antes, a busca de agendamentos para o lembrete de 24h excluÃ­a quem nÃ£o tinha e-mail (`.not('customer_email','is',null)`), entÃ£o nenhum cliente sem e-mail jamais recebia lembrete. Esse filtro foi removido. A checagem de duplicidade (que evita reenviar o mesmo lembrete) agora olha tanto `email_queue` quanto `sms_queue`, evitando reenvio repetido para quem sÃ³ recebe SMS.
- Nova migration `028-v28-1-0-sms-fallback.sql` cria a tabela `sms_queue` com RLS e Ã­ndice Ãºnico anti-duplicidade de lembrete, no mesmo padrÃ£o da fila de e-mail.

## 28.0.14 â€” Fase 2: fechamento de brecha de acesso e correÃ§Ã£o da pesquisa de satisfaÃ§Ã£o

- **SeguranÃ§a (crÃ­tico, corrigido ao vivo no Supabase, sem necessidade de novo deploy do site):** a opÃ§Ã£o "Allow new users to sign up" do Supabase Auth foi desativada. Ela estava ativada por padrÃ£o e, combinada com polÃ­ticas de seguranÃ§a (RLS) de vÃ¡rias tabelas (`bookings`, `customer_profiles`, `contact_messages`, `loyalty_accounts`, `loyalty_events`, `schedule_blocks`, `booking_customer_actions`) que liberavam acesso para qualquer usuÃ¡rio autenticado (nÃ£o checavam se era realmente admin), permitia que qualquer visitante criasse uma conta grÃ¡tis e lesse/editasse dados de clientes. Confirmado por consulta ao banco que existia apenas 1 conta (a do prÃ³prio dono) â€” nÃ£o hÃ¡ indÃ­cio de que a brecha tenha sido explorada. CorreÃ§Ã£o completa das polÃ­ticas RLS (fazer o check real de admin) fica para uma prÃ³xima etapa, feita com mais calma e testes.
- **Bug corrigido:** `experiencia.html` (pÃ¡gina de pesquisa de satisfaÃ§Ã£o) estava com a funÃ§Ã£o de salvar resposta totalmente quebrada â€” o cÃ³digo enviava parÃ¢metros (`p_answer`) e conferia campos de retorno (`data.ok`, `data.answered`, `data.answer`) que nÃ£o existem na funÃ§Ã£o/dados reais do Supabase (`p_response`, `data.valid`, `data.status`). Isso fazia a pÃ¡gina mostrar erro para 100% dos visitantes. Corrigido para usar exatamente o mesmo contrato jÃ¡ comprovado funcionando em `avaliacao.html`. A pÃ¡gina `avaliacao.html` jÃ¡ funcionava corretamente e nÃ£o foi alterada.
- **Cache:** versÃ£o de todos os arquivos versionados subida para `28.0.14`.

## 28.0.13 â€” Auditoria de seguranÃ§a, SEO e acessibilidade (Fase 1)

- **SeguranÃ§a (crÃ­tico):** corrigida vulnerabilidade de XSS no painel de Fidelidade (`loyalty-admin-v21.js`) â€” nome/telefone/e-mail do cliente agora sÃ£o exibidos com escape correto.
- **SeguranÃ§a:** links de origem externa (Central de Mensagens e respostas da JuIA) agora sÃ³ aceitam `http`/`https`, bloqueando esquemas `javascript:` maliciosos.
- **SeguranÃ§a (Edge Functions):** `admin-booking-status` nÃ£o devolve mais stack trace/detalhes internos do banco na resposta ao cliente (sÃ³ no log do servidor). CORS de `admin-booking-status` e `send-push` restrito ao domÃ­nio do site em vez de aceitar qualquer origem.
- **SEO:** adicionado `<link rel="canonical">` em `cliente.html` e `meu-agendamento.html`. `robots.txt` atualizado para bloquear `admin-mensagens.html` e `admin-notificacoes.html`, mantendo paridade com o `noindex` das prÃ³prias pÃ¡ginas.
- **Acessibilidade:** botÃ£o de fechar do modal de produtos agora tem `aria-label="Fechar"`.
- **Cache:** versÃ£o de todos os arquivos versionados subida para `28.0.13` (o motivo de builds anteriores nÃ£o surtirem efeito no site publicado foi identificado como uma falha temporÃ¡ria de infraestrutura do GitHub Pages/Actions, nÃ£o um problema de cÃ³digo â€” ver `RELATORIO-AUDITORIA.md`).
- Auditoria completa de navegaÃ§Ã£o interna (0 links quebrados), carrinho unificado (produto+serviÃ§o testados de ponta a ponta) e revisÃ£o estÃ¡tica de todas as Edge Functions e migrations SQL â€” detalhes completos em `RELATORIO-AUDITORIA.md`.

## 28.0.11 â€” NavegaÃ§Ã£o na mesma aba e carrinho persistente

- Links internos entre ServiÃ§os e Produtos agora interceptam o clique normal e navegam explicitamente na mesma aba.
- Produtos e serviÃ§os sÃ£o preservados em `sessionStorage`, com backup em `localStorage` para resistir a abas/cache antigos.
- Ao retornar de Produtos para ServiÃ§os, o produto permanece no carrinho unificado.
- Cache do Service Worker atualizado.

## 28.0.11 â€” NavegaÃ§Ã£o interna em uma Ãºnica aba

- Links internos entre ServiÃ§os, Produtos e Agenda passam a navegar sempre na mesma aba.
- Removido `target="_blank"` de rotas internas.
- Adicionada proteÃ§Ã£o JavaScript contra versÃµes antigas em cache que tentem abrir pÃ¡ginas internas em outra aba.
- Preservado o `sessionStorage` do carrinho unificado durante todo o fluxo.
- Links de produtos dentro de `/agendar/` padronizados para `/produtos.html`.

## 28.0.11 â€” Fluxo contÃ­nuo entre serviÃ§os e produtos

- â€œVer produtosâ€ agora abre na mesma aba.
- Links para produtos usam caminho absoluto `/produtos.html`.
- O produto escolhido permanece visÃ­vel no carrinho ao retornar aos serviÃ§os.
- O carrinho de serviÃ§os soma e exibe produtos reservados.
- O avanÃ§o para escolher horÃ¡rio continua bloqueado atÃ© existir pelo menos um serviÃ§o.

## 28.0.11 â€” NavegaÃ§Ã£o de produtos para serviÃ§os

- Corrige o botÃ£o **Adicionar serviÃ§os ao pedido** para abrir sempre `/agendar/#servicos`.
- Usa URL absoluta e interceptaÃ§Ã£o segura para evitar links antigos em cache.
- Remove o redirecionamento automÃ¡tico de `/agendar/`; a pÃ¡gina passa a ser utilizÃ¡vel diretamente, evitando tela preta ou loop.
- MantÃ©m o catÃ¡logo visÃ­vel e posiciona corretamente `#servicos` apÃ³s o carregamento.

## V28.0.11 â€” CorreÃ§Ã£o definitiva da tela preta em ServiÃ§os
- ForÃ§a visibilidade das seÃ§Ãµes e cards mesmo quando a pÃ¡gina Ã© aberta por link externo com `#servicos`.
- Remove a rotina repetitiva de reposicionamento que podia causar estado inconsistente no carregamento.
- MantÃ©m um Ãºnico reposicionamento apÃ³s o carregamento completo.
- Atualiza o cache do Service Worker.

## 28.0.11 â€” correÃ§Ã£o definitiva do link â€œIr direto Ã  agendaâ€

- O botÃ£o em `/agendar/` agora usa URL absoluta para `/agendar.html`.
- Criada rota de compatibilidade `/agendar/agendar.html`, que redireciona automaticamente para a agenda correta.
- Atualizado o cache do Service Worker para impedir reaproveitamento da navegaÃ§Ã£o antiga.

## 28.0.11 â€” CorreÃ§Ã£o definitiva do link direto para ServiÃ§os

- ServiÃ§os nÃ£o dependem mais da animaÃ§Ã£o `reveal` para aparecer.
- Link `/agendar/#servicos` agora reposiciona apÃ³s DOM, carregamento e fontes.
- Evita tela vazia ao abrir o sitelink â€œProdutos e serviÃ§osâ€ do Google.
- Cache e assets atualizados para 28.0.11.

## 28.0.11 â€” CorreÃ§Ã£o de carregamento visual e cache

- Corrige abertura ocasional da pÃ¡gina de serviÃ§os sem CSS ao chegar pelo Google.
- Folhas de estilo agora usam caminho absoluto e mecanismo automÃ¡tico de nova tentativa.
- Adicionado estilo crÃ­tico mÃ­nimo para impedir pÃ¡gina HTML sem formataÃ§Ã£o.
- Service Worker revisado: navegaÃ§Ã£o e CSS/JS usam prioridade de rede e caches antigos sÃ£o removidos.
- Registro do Service Worker passa a ignorar cache de atualizaÃ§Ã£o.

# V28.0.1 â€” NavegaÃ§Ã£o do catÃ¡logo

- Adicionado link **Voltar aos serviÃ§os** no topo de `produtos.html`.
- Mantido acesso direto Ã  pÃ¡gina inicial.
- BotÃ£o flutuante inferior agora retorna aos serviÃ§os.
- Cache busting dos arquivos usados em `produtos.html` atualizado para `28.0.1`.

# V28.0.0 â€” FundaÃ§Ã£o tÃ©cnica e conversÃ£o

- Adicionado botÃ£o â€œVer produtosâ€ diretamente no hero da pÃ¡gina inicial.
- Mantido o botÃ£o â€œVer produtosâ€ na pÃ¡gina `/agendar/`.
- Padronizado o cache busting de arquivos CSS e JavaScript para `v=28.0.0`.
- Atualizado o Service Worker para um novo cache, evitando arquivos antigos apÃ³s o deploy.
- Corrigida a geraÃ§Ã£o do arquivo `.ics`, que continha uma quebra invÃ¡lida no JavaScript.
- Mantidos a galeria existente com quatro imagens e o vÃ­deo com `preload="none"`, pois ambos jÃ¡ estavam implementados corretamente.
- Nenhuma alteraÃ§Ã£o de banco de dados, RLS ou Edge Functions nesta etapa.

# V27.1.4

- Adicionado botÃ£o **Ver produtos** no topo da pÃ¡gina de serviÃ§os e agendamento.
- O catÃ¡logo de produtos abre em nova aba para preservar a seleÃ§Ã£o de serviÃ§os do cliente.


## V25.1.2 â€” Hotfix do cancelamento
- Corrigida a comparaÃ§Ã£o de data e hora no cancelamento feito pelo cliente.
- O sistema agora interpreta o horÃ¡rio da barbearia explicitamente no fuso de SÃ£o Paulo.
- A pÃ¡gina Meu Agendamento passa a exibir a mensagem real devolvida pela Edge Function.

# V25.0.2 â€” CorreÃ§Ãµes da confirmaÃ§Ã£o automÃ¡tica

- Corrigido o envio de Push ao criar agendamentos pelo site.
- Corrigido o envio de Push ao criar agendamentos pela JuIA.
- Nova Edge Function `create-public-booking` mantÃ©m o segredo do Push fora do navegador.
- Busca do CRM refeita com pesquisa por nome, telefone e e-mail.
- Busca ignora acentos e diferenÃ§as entre maiÃºsculas e minÃºsculas.
- Adicionados botÃµes Buscar e Limpar, Enter e filtro automÃ¡tico com pequena espera.

# V25.0.1 â€” ConfirmaÃ§Ã£o automÃ¡tica e CRM

- Agendamentos pÃºblicos passam a ser gravados como confirmados.
- JuIA confirma o horÃ¡rio imediatamente apÃ³s a reserva bem-sucedida.
- Tela pÃºblica nÃ£o informa mais que o cliente deve aguardar confirmaÃ§Ã£o.
- Busca do CRM continua instantÃ¢nea e agora tambÃ©m responde Ã  tecla Enter.
- Mantidos bloqueios de horÃ¡rio, margem mÃ­nima de 15 minutos e prevenÃ§Ã£o de conflitos.

# V24.6.3 â€” Push sincronizado e autorreparo
- Novo par VAPID sincronizado entre site e Supabase.
- Detecta automaticamente assinatura criada com chave antiga.
- Cancela assinatura antiga antes de criar a nova.
- Exibe entregas e falhas no teste de notificaÃ§Ã£o.
- Atualiza Service Worker e cache para evitar versÃ£o antiga.

# V24.6.2
- RotaÃ§Ã£o completa das chaves VAPID.
- Novo segredo do webhook.
- Chave pÃºblica sincronizada com o site.

# V24.6.1 â€” Push multicliente e alerta sonoro no PC

- NotificaÃ§Ãµes Web Push em Android, iPhone/iPad instalados e Chrome/Edge no computador.
- NotificaÃ§Ã£o persistente no PC (`requireInteraction`) com som padrÃ£o do sistema.
- Campainha interna adicional quando o painel administrativo estÃ¡ aberto no computador.
- VibraÃ§Ã£o reforÃ§ada em dispositivos compatÃ­veis.
- Tela administrativa para ativar, testar e desativar cada aparelho.
- Toque na notificaÃ§Ã£o abre a agenda administrativa.

# V24.5.1 â€” EstabilizaÃ§Ã£o do formulÃ¡rio prÃ³prio

- Reescreve a Edge Function `contact-form` sem dependÃªncia externa do cliente Supabase.
- Compatibilidade com `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_SECRET_KEYS`.
- Tratamento global de erros e `request_id` para diagnÃ³stico.
- Logs claros para contagem, gravaÃ§Ã£o e envio opcional por e-mail.
- Mensagem permanece salva mesmo quando o Resend nÃ£o estÃ¡ configurado ou falha.

# Changelog

## V24.5.0
- Remove dependÃªncia do FormSubmit.
- Salva dÃºvidas no Supabase.
- Nova tela Mensagens no painel.
- Resposta pelo WhatsApp, status, arquivo e exclusÃ£o.
- Envio opcional ao Zoho por Resend.
- ProteÃ§Ã£o antispam e limite por telefone.

## V24.4.8
- Corrige estouro horizontal da revisÃ£o do agendamento em celular, tablet e janela estreita.
- JuIA abre em tela cheia no celular com cabeÃ§alho e botÃ£o fechar sempre visÃ­veis.
- Bloqueia zoom causado por overflow e restaura a pÃ¡gina ao fechar o chat.
- MantÃ©m o formulÃ¡rio FormSubmit para nova tentativa de ativaÃ§Ã£o.

## V24.4.6
- Corrige seleÃ§Ã£o de serviÃ§os no novo agendamento administrativo.
- CartÃµes inteiros clicÃ¡veis e destaque visual de seleÃ§Ã£o.
- Resumo de quantidade, duraÃ§Ã£o e valor dos serviÃ§os selecionados.

## V24.4.4
- JuIA vira aba lateral compacta no celular.
- Evita sobreposiÃ§Ã£o com botÃµes principais e barra inferior.
- Desktop mantÃ©m o botÃ£o completo.

# V24.4.3 â€” etapa final responsiva

- Corrige ampliaÃ§Ã£o/estouro horizontal na tela Confira e envie no iPhone.
- Permite quebra segura de nome, telefone, valores e horÃ¡rio.
- MantÃ©m o formulÃ¡rio limitado Ã  largura real da tela.
- Preserva zoom manual por acessibilidade.

# V24.4.1 â€” alinhamento do fluxo de agendamento

- Continuar e Voltar agora alinham no inÃ­cio Ãºtil do agendamento.
- A barra Atendimento, HorÃ¡rio, Seus dados e Confirmar permanece visÃ­vel.
- Evita retorno ao cabeÃ§alho grande da pÃ¡gina em desktop e celular.

## V24.4.1 â€” Agendamento guiado
- Remove mensagem contraditÃ³ria de indisponibilidade.
- Evita respostas antigas sobrepondo horÃ¡rios atuais.
- AvanÃ§a com rolagem automÃ¡tica para a etapa correta.
- Barra de progresso fixa e clicÃ¡vel nas etapas concluÃ­das.
- AÃ§Ãµes principais sempre visÃ­veis no celular.
- Resumo lateral oculto no mobile para reduzir rolagem.
- Layout de horÃ¡rios otimizado para telas pequenas.

# V24.3.4

- Agenda abre automaticamente no prÃ³ximo dia Ãºtil reservÃ¡vel.
- Domingo e segunda avanÃ§am para terÃ§a-feira.
- ApÃ³s o expediente, a seleÃ§Ã£o avanÃ§a para o prÃ³ximo dia de atendimento.
- Datas sem vagas avanÃ§am automaticamente para o prÃ³ximo dia com disponibilidade.
- Mantida a margem mÃ­nima de 15 minutos para agendamentos no mesmo dia.

# V24.3.3

- Oculta horÃ¡rios passados na agenda do mesmo dia.
- Exige antecedÃªncia mÃ­nima de 15 minutos para novos agendamentos.
- Usa o fuso horÃ¡rio America/Sao_Paulo no banco.
- ValidaÃ§Ã£o aplicada no SQL e tambÃ©m no navegador.
- Impede gravaÃ§Ã£o direta de horÃ¡rios fora da margem de seguranÃ§a.

# V24.3.2
- Corrige carrinho embaÃ§ado no desktop, Android e iPhone.
- Move o overlay escuro para trÃ¡s do carrinho.
- Remove o backdrop-filter do overlay para compatibilidade entre navegadores.

# V24.3 â€” Carrinho mobile responsivo

- Corrige distorÃ§Ã£o e corte lateral do carrinho em Android e iOS.
- Carrinho abre como bottom sheet, limitado Ã  viewport.
- Adiciona rolagem interna, safe area do iPhone e botÃµes maiores.
- Oculta JuIA e botÃµes flutuantes enquanto o carrinho estÃ¡ aberto.
- Bloqueia rolagem da pÃ¡gina ao fundo.
- MantÃ©m o funcionamento desktop.

## V23.0 â€” Cliente Inteligente + CRM Premium
- Nova pÃ¡gina Minha Ãrea com prÃ³ximo horÃ¡rio, Ãºltima visita, fidelidade e repetir serviÃ§o.
- CRM com VIP, etiquetas, preferÃªncias tÃ©cnicas, serviÃ§os/produtos favoritos, pagamento e intervalo de retorno.
- Novo SQL 015 e contexto comercial ampliado para a JuIA.

# Changelog
## 22.4 â€” Security & UX Release
- Adicionados Content-Security-Policy e X-Frame-Options.
- Implementado Consent Mode para Analytics/Ads e aviso de privacidade.
- Criada pÃ¡gina `privacidade.html`.
- Adicionados toasts, carregamento global e tratamento visual de erros no painel.
- Atualizados cache, Service Worker e documentaÃ§Ã£o.


## V22.3 â€” ExperiÃªncia pÃ³s-atendimento

- Criada a pÃ¡gina `404.html` com identidade visual da Barbearia do Ju e atalhos para inÃ­cio, serviÃ§os/agendamento e WhatsApp.
- ApÃ³s marcar um atendimento como concluÃ­do, o painel pergunta se deseja agradecer e solicitar uma avaliaÃ§Ã£o no Google pelo WhatsApp.
- A mensagem utiliza o link oficial de avaliaÃ§Ã£o `https://g.page/r/CaQfC5axIQQIEBM/review`.
- Atualizado o Service Worker e o identificador de cache para evitar versÃµes antigas.
- Nenhuma alteraÃ§Ã£o no banco de dados ou nas Edge Functions.

## V22.1 â€” EstabilizaÃ§Ã£o
- Restringido o CORS da Edge Function `ju-ia-admin` ao domÃ­nio `https://www.barbeariadoju.com.br`.
- Mantido o mesmo padrÃ£o de CORS jÃ¡ aplicado Ã  funÃ§Ã£o `ju-ia-site`.
- Corrigida a documentaÃ§Ã£o do vÃ­deo: o cÃ³digo usa `preload="none"`, opÃ§Ã£o escolhida para desempenho.
- Adicionados `VERSAO.md`, `CHANGELOG.md` e `ROADMAP.md` para controle do projeto.
- Nenhuma alteraÃ§Ã£o visual, de banco de dados ou de regras de agendamento nesta versÃ£o.

## V22 â€” Sprint 1
- Fresha removido da experiÃªncia pÃºblica.
- HorÃ¡rios oficiais alinhados.
- Modo Atendimento adicionado.
- DuplicaÃ§Ãµes do GTM e de scripts corrigidas.

## V22.2 â€” Refinamentos prÃ©-publicaÃ§Ã£o

- Adicionadas regras `Disallow` para todas as pÃ¡ginas administrativas no `robots.txt`.
- Atualizada a descriÃ§Ã£o do `manifest.webmanifest`, removendo a referÃªncia antiga a agendamento pelo WhatsApp.
- IncluÃ­da orientaÃ§Ã£o para validar o redirecionamento de `https://barbeariadoju.com.br` para `https://www.barbeariadoju.com.br` no Cloudflare.
- Nenhuma alteraÃ§Ã£o visual, de banco, agenda, CRM ou Edge Functions.

V22.5 â€” CorreÃ§Ã£o do carrinho de serviÃ§os, integraÃ§Ã£o serviÃ§os/produtos/agenda e ordem de carregamento do Supabase.

## V22.6
- Sincroniza automaticamente clientes de agendamentos com o CRM para habilitar ediÃ§Ã£o, arquivamento e exclusÃ£o.
- Corrige quebra visual do WhatsApp no bloco de contato desktop.
- Adiciona botÃ£o Ã— para remover um serviÃ§o individualmente do carrinho.
- Melhora a mensagem de confirmaÃ§Ã£o da JuIA no cÃ³digo-fonte da Edge Function.

## V24.2 â€” RevisÃ£o geral e estabilizaÃ§Ã£o
- Remove o link â€œPrivacidadeâ€ inserido acidentalmente no card Corte + Barboterapia.
- Atualiza o identificador do cache do PWA e os parÃ¢metros de versÃ£o dos arquivos estÃ¡ticos.
- Adiciona `cliente.html` ao sitemap e ajusta sua atualizaÃ§Ã£o dinÃ¢mica no Service Worker.
- Sincroniza o cÃ³digo-fonte da Edge Function `ju-ia-site` com a V24 CRM Inteligente jÃ¡ implantada.
- Valida links internos e sintaxe dos arquivos JavaScript.
- Nenhuma alteraÃ§Ã£o de banco de dados.

## V24.4.3 â€” Responsividade universal da etapa final
- Corrige estouro horizontal em iOS, Android, tablets e janelas estreitas no desktop.
- Permite quebra segura de nomes de serviÃ§os, produtos, valores, horÃ¡rios e dados do cliente.
- Adapta a confirmaÃ§Ã£o para telas muito estreitas sem ampliar a pÃ¡gina automaticamente.

## V24.4.6 â€” HorÃ¡rios inteligentes na JuIA
- Quando hÃ¡ muitos horÃ¡rios, a JuIA pergunta se o cliente prefere manhÃ£, tarde ou final do dia.
- Mostra todos os horÃ¡rios disponÃ­veis do perÃ­odo escolhido.
- Responde diretamente quando o cliente pergunta por um horÃ¡rio exato.
- MantÃ©m no pacote as correÃ§Ãµes responsivas V24.4.3 e V24.4.4.
- Nenhuma alteraÃ§Ã£o de banco de dados.

## V24.6.0 â€” NotificaÃ§Ãµes do painel
- AtivaÃ§Ã£o separada no iPhone e Android.
- Web Push para novos agendamentos.
- NotificaÃ§Ã£o de teste e abertura direta da agenda.
- Service Worker preparado para alertas em segundo plano.


## V25.1.0 â€” Meu Agendamento
- Link seguro apÃ³s a confirmaÃ§Ã£o.
- Consulta, cancelamento e reagendamento pelo cliente.
- LiberaÃ§Ã£o automÃ¡tica do horÃ¡rio cancelado ou anterior.
- Push administrativo em cancelamentos e reagendamentos.
- Google Agenda, arquivo de calendÃ¡rio e convite para instalar o PWA.

## V25.1.1 â€” Hotfix do link de gerenciamento
- Corrige a gravaÃ§Ã£o do `booking_code` e do `management_token_hash`.
- Impede a entrega de links invÃ¡lidos quando a gravaÃ§Ã£o falhar.
- Adiciona funÃ§Ã£o SQL atÃ´mica para vincular o gerenciamento ao agendamento.
- Melhora os logs da Edge Function `create-public-booking`.

## V26.0.0 â€” Central de ComunicaÃ§Ã£o
- OAuth oficial do Zoho Mail.
- Envio HTML de confirmaÃ§Ã£o, reagendamento e cancelamento.
- Avisos para cliente e barbearia.
- Fila/histÃ³rico `email_queue` com status e erros.
- IntegraÃ§Ã£o nÃ£o bloqueante com `create-public-booking` e `manage-booking`.
- Mantida a correÃ§Ã£o segura de cancelamento por RPC.

## V26.4.0 â€” 19/07/2026
- Novo CTA de reagendamento no e-mail de cancelamento.
- Edge Function de lembrete automÃ¡tico 24 horas antes.
- Bloqueio de lembretes duplicados na fila de e-mails.
- HistÃ³rico de e-mails automÃ¡ticos dentro da Central de ComunicaÃ§Ã£o.
- Melhor adaptaÃ§Ã£o do painel administrativo para celulares e telas pequenas.
- BotÃµes administrativos com estado de carregamento e mensagens mais amigÃ¡veis.


## V27.0 â€” EndereÃ§o profissional de agendamento
- Criada a rota pÃºblica `/agendar/` mantendo o endereÃ§o amigÃ¡vel no navegador.
- Atualizados botÃµes do site, Ã¡rea do cliente, pÃ¡gina 404, produtos e Ju IA.
- Atualizados canonical, Open Graph, Schema e sitemap.
- `servicos.html` permanece compatÃ­vel e troca visualmente para `/agendar/`.
- E-mails passam a utilizar `/agendar/` como destino padrÃ£o.
- Service Worker atualizado para a nova rota.

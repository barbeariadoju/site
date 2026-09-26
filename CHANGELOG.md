## 29.239.0 — Revisão da JuIA de 26/09: lista de espera de quem já tem horário, remarcar pela confirmação, "Entendi", "até que horas" (26/09)

**Origem:** plano do dia. O Juliano apontou o Sérgio e o Guilherme; a varredura das 40 h achou mais três.

- **Sérgio (25-26/09) — o grave.** Agendado às 09:45, escreveu "caso tenha algum horário desmarcado para mais cedo pode me avisar". A JuIA o pôs na lista de espera **do dia inteiro, sem teto de hora**, e respondeu só "você já está confirmado". Na manhã seguinte o Guilherme remarcou das 11:30 para as 14:30, o gatilho ofereceu **as 11:30 (depois do horário dele)** como "o horário que você estava esperando", e um "sim" teria criado **um segundo agendamento** (`phone_confirm_waitlist_booking` sempre criava). O Juliano pediu desculpas na mão.
  - Banco (migração 176): `waitlist_matches_for_slot` não casa quem já tem horário ativo no dia com vaga que começa no horário dele ou depois; `phone_confirm_waitlist_booking` **move** o horário existente do mesmo dia (`phone_reschedule_booking`, com todas as validações) em vez de criar outro. Conferido com os dados reais: 11:30 bloqueado, 08:15 liberado.
  - JuIA: com horário no dia, a lista entra com `preferred_time_end` = horário dele (o `join-waitlist` passou a aceitar a faixa) e a resposta diz "se abrir um horário antes das 09:45, eu te aviso e, se quiser, passo o seu para mais cedo".
  - `whatsapp-lead-followup`: para quem já tem horário no dia, a oferta diz "abriu um horário mais cedo… quer que eu passe o seu para as X? Se for não, o das Y continua garantido"; vaga igual ou depois do horário dele volta a lista em silêncio.
  - A entrada do Sérgio foi cancelada na mão hoje às 8h e poucos minutos.
- **Guilherme (26/09, 07h38).** Respondeu "2 — quero remarcar" à confirmação, recebeu "me diz o dia e o horário", mandou "15:00" — e voltou o menu 1/2/3 (a confirmação continuava pendente e o "15:00" caiu de novo no interceptador). Mandou "2" outra vez, mesma coisa; o Juliano remarcou na mão. Agora o "2" grava `pending_reschedule_booking_id` + o dia do horário no estado: a próxima fala vai pra JuIA, que remarca (hora solta = mesmo dia) e, se a hora não existe (sábado 15h), oferece a mais próxima. Também: "Só pra eu não te perder na agenda Sobre seu horário" (o emoji tirado deixava a frase sem pontuação) virou "na agenda: sobre o seu horário"; "não está disponível em terça" virou "na terça".
- **Gilvana (25/09, 13h10).** "Vc fica até q horas aberto" levou a lista de horários de novo, sem resposta — e "Entendi" virou "Sim! hoje às 15:30 está livre, quer incluir mais alguma coisa?". "Até que horas / que horas fecha" agora responde o expediente do dia; "Entendi" (e "hum", "saquei", "ata") é recibo: o horário do modelo não entra e a resposta é "Combinado. Quando decidir, é só me dizer o horário que eu reservo."
- **Paulo (26/09).** 08h00 "abriu vaga de novo hoje, quer que eu reserve?" e 08h15 "acabamos não fechando, pode me dizer o motivo?". A trava de uma mensagem por telefone só valia dentro da mesma rodada do cron. Agora nudge e pesquisa esperam se o último recado nas 3 h foi do robô sem resposta, e a pesquisa de motivo não sai nas 24 h depois de um "abriu vaga de novo".
- **Lucas (26/09, 00h38)** recebeu "Bom dia". Entre 0h e 5h a saudação é "Boa noite".

**Ficou de fora, anotado:** a JuIA respondeu o aviso automático de entrega da maquininha como se fosse cliente ("Bom dia, Juliano! Entendi…") — inofensivo, o número é de empresa.

Simulador: cenários 38, 39 e 40 (110 ok). O cenário 30 falhava todo fim de semana (a mensagem diz "sexta-feira" e a data era a do próximo dia útil) — agora usa uma sexta de verdade.

## 29.238.0 — Clube do Ju sai sem a Cadeira Cativa; contrato v2 (25/09)

**Decisão do Juliano (25/09, depois da análise dos 30 dias):** *"Eu tô achando que o clube do Ju vai achatar a renda pra baixo"* → mostrei a conta → *"Então tira este cadeira cativa do plano"*.

**A conta que decidiu:**
- **Planos comuns aumentam a renda do cliente típico:** ele volta a cada ~21 dias (≈1,4 corte/mês = R$ 71 na tabela nova); no Clube Corte paga R$ 85 adiantado. Perde-se só com quem já vem a cada 15 dias — pior caso, 20 assinantes assim ≈ R$ 500/mês (~4% de R$ 13 mil). E terça a quinta têm ~11 atendimentos/semana de folga até o teto de 10/dia; 20 assinantes usam ~10.
- **A Cativa era o risco:** R$ 249 por corte + Barboterapia + sobrancelha toda semana + hidratação (tabela R$ 510, 51% off), ~1h40 de cadeira por semana por assinante ≈ **R$ 37/hora contra ~R$ 80 do avulso**. Com agenda sobrando, preenche hora vazia; no teto de dezembro (10 clientes/dia), 5 cativos tomariam ~8h/semana que seriam vendidas cheias.

**O que mudou:**
- Banco (migração 175): `club_plans.cadeira-cativa` inativo, `vagas_cativa = 0`, `club_terms` v2, `club_settings.terms_version = 'v2'`. A function `clube` só lista plano ativo → a Cativa some da página e não pode ser assinada nem por chamada direta.
- **Contrato v2** (`clube/contrato/v2.txt`, SHA-256 `cf820c75…`): igual ao v1 sem a Cativa (2.4, 2.5, 4.2, 6.1 e a cláusula 4.7 inteira; 4.8/4.9 viraram 4.7/4.8). **O v1 fica no repositório intacto** (registro do que foi publicado). Ninguém tinha assinado — vendas fechadas até 01/10.
- Página do contrato, /clube/ (links v2, FAQ e "como marcar" sem a Cativa), `clube.js?v=29.238.0`.
- JuIA: `textoClubeExplica` vai "do Clube Corte ao Clube Completo"; o prompt diz que **não existe plano de horário fixo**.
- Código da Cativa (`club_cativa_*`, telas) **ficou inerte**, não apagado: se um dia voltar, é reativar com preço novo e contrato v3.
- Functions republicadas: `clube`, `clube-ciclo`, `pagbank-webhook`, `ju-ia-site` (todas importam as regras). `verify_jwt` conferido depois.
- Testes: `clube-regras.spec.js` — v2 sem Cativa, hash do v2 na página, v1 intacto.

## 29.237.0 — Google Ads: agendamento do site vira conversão offline (e só quem sentou na cadeira conta) (25/09)

**Origem:** análise dos 30 dias pedida pelo Juliano; a PMax mostrava "Os problemas com os dados de conversão off-line estão afetando a performance". Diagnóstico de conversões do Google: **"Conversão off-line — Sem dados recentes — Uma fonte não tem dados recentes"**; meta "Reservar horário" em "Requer atenção".

**Causa:** o CSV (`google-ads-conversions-csv`) respondia 200, mas só com o cabeçalho. A view só olhava `whatsapp_attribution` (anúncio → site → botão do WhatsApp → JuIA): 9 registros desde 03/09, 1 com clique de anúncio, e esse foi cancelado. Quem vem do anúncio agenda direto no /agendar/ (33 clientes novos pelo site em 30 dias) — esse caminho nunca entrou no arquivo; só a tag do navegador contava (6 no mês).

**O que mudou (passos 1 e 2 combinados com o Juliano):**
- **Site:** `agenda-v15.js` manda o clique guardado pelo `whatsapp-attrib-v29.js` (`bdj_gclid_v1`, `{v,k,t}`, 90 dias) no corpo do `create-public-booking` como `click_id`. Sem clique ou vencido → `null`, agendamento igual.
- **Function:** `create-public-booking` grava em `booking_ad_clicks` (tabela nova, migração 174: RLS, sem policy, GRANT só `service_role` — regra de 30/10) com cada tipo no seu campo (wbraid no campo de gclid = linha descartada pelo Google). Nunca derruba o agendamento.
- **View `google_ads_offline_conversions`:** junta os dois caminhos (site tem prioridade se o mesmo agendamento estiver nos dois) e manda **só atendimento concluído**, sem cortesia, com o **valor líquido pago** e a **hora do atendimento** (dentro de 90 dias do clique e nunca no futuro). Antes contava o agendamento na hora da criação — inclusive de quem faltava. Testado em transação desfeita: atendimento de 24/09 9h15 saiu com R$ 40,00.

**Decidido contra o óbvio:**
- **Nome da ação continua "Agendamento confirmado (WhatsApp)"**, mesmo agora valendo também pro site: trocar exigiria reconfigurar a fonte no Data Manager, e nome que não bate é descartado em silêncio.
- **Passo 3 (promover a conversão offline a principal e a tag do navegador a secundária) NÃO foi feito.** A PMax precisa de histórico da meta nova; trocar com zero dados faz ela reaprender gastando mal. Plano: ~16/10/2026, com ~3 semanas de conversões reais, decidir com o Juliano.
- **Sem retroativo:** os cliques de antes de hoje não foram guardados junto dos agendamentos; o aviso do Google só some quando o primeiro cliente vindo do anúncio **for atendido e concluído**.

Testes: `tests/e2e/booking-ads-click.spec.js` (wbraid vai no campo certo; clique vencido não vai). `agenda-v15.js?v=29.237.0`.

## 29.236.0 — "Como foi feito" logo abaixo da forma de pagamento (25/09)

**Pedido do Juliano (25/09, print do ✎ Editar):** *"a parte do como foi feito deveria ficar perto da forma de pagamento pra eu não esquecer"*.

- A forma de pagamento é o último toque antes de salvar; o "Como foi feito" ficava antes dela — no Editar, depois da lista longa de serviços e **antes** dos produtos, fora da tela no momento de fechar. Agora vem **logo abaixo dos botões de pagamento** nas três telas que fecham atendimento: Concluir, ✎ Editar e Balcão (no Balcão ficava depois de data, horário e caixinha).
- Mesma posição nas três de propósito: é a mão dele que aprende o lugar.
- Teste: `admin-editar-como-foi-feito.spec.js` ganhou a checagem de ordem no Editar e no Balcão (+ print).
- `admin-v15-4-agenda.js`/`core.js` `?v=29.236.0` nas 6 páginas; `ADMIN_VERSION` e `admin-version.json` juntos.

## 29.235.0 — Agenda: previsão de término em cada card (25/09)

**Pedido do Juliano (25/09, com print da Agenda):** *"adicionasse uma previsão de término do serviço … por ex. filipe 19:30 previsto termino 20:15 … pra eu pensar rápido"*.

- Embaixo do horário de início de cada card aparece **"até HH:MM"**, menor e mais apagado, para não competir com o horário de chegada. O valor é o `end_time` do agendamento — o mesmo que já aparecia escondido no detalhe do card ("até 20:10 • 40 min"), que é o que a agenda usa para bloquear o horário seguinte. Não é cálculo novo, então não tem como divergir do que a agenda considera ocupado.
- Estilo em `css/06-admin-reforma.css` (só do painel). `?v=` do css/06 nas 18 páginas do admin, `admin-v15-4-agenda.js` e `admin-v15-4-core.js` → 29.235.0; `ADMIN_VERSION` e `admin-version.json` juntos (lição da 29.99.0).
- Teste novo: `tests/e2e/admin/admin-agenda-previsao-termino.spec.js` (todo card tem "até HH:MM" depois do início; prints em computador e celular).

## 29.234.1 — Raspar a cabeça fica em R$ 40 depois de 01/10 (25/09)

**Decisão do Juliano (25/09):** *"raspar a cabeça manter 40,00, não aumentar 01/10"*. Era um dos 18 serviços do reajuste de 30/08 (40 → 50).

- **Banco:** a mudança agendada em `service_price_changes` virou 40 → 40, com a decisão anotada no `note` (preferi isso a apagar a linha: fica o registro de que o reajuste foi pensado e desfeito de propósito). Nenhum agendamento de outubro tinha raspar, então ninguém foi cobrado a mais.
- **Site na virada:** saíram do `plano.json` os 9 trechos do raspar (cartão do /agendar/ e os 8 da `servico-raspar-a-cabeca.html`: meta, og, twitter, schema `offers.price`, FAQ). Nas duas listas das perguntas frequentes, o trecho fica, mas o `para` diz "Raspar a cabeça R$ 40". Agora são 257 trechos em 28 arquivos.
- **Já no ar:** a `/precos/`, que mostra a tabela nova desde 30/08, dizia Raspar R$ 50 e foi corrigida para 40. A arte `artes/placa-reajuste-outubro.html` também.
- **Tarefas agendadas neste PC** (`reajuste-01-10-vespera` e `-manha`): a da véspera tinha "40→50 corte/raspar" na lista do que conserta e poderia "corrigir" o raspar de volta para 50. Agora o raspar está em "NÃO mudam", com o motivo.
- ⚠️ **Fora do repo:** a plaquinha do reajuste impressa em outro lugar (16/09) pode estar com Raspar R$ 50. Conferir a placa física.

## 29.234.0 — JuIA: lista de espera aceita de verdade, "amanhã não posso" e "já tenho horário?" (25/09)

**Origem:** plano do dia de sexta (revisão das conversas de 24/09 e varredura da semana 18-24/09) e a conversa do Paulo, que o Juliano mandou por print às 9h10. Todos os casos foram reproduzidos no simulador antes da correção (cenários 34 a 37, 105 ok).

- **Lista de espera aceita não volta mais pra agenda (caso Israel, 24/09 17h37).** "Se abrir alguma vaga hj me avisa / Amanhã não consigo" **entrou** na lista de espera, mas o "vaga hj" da mesma frase jogava o intent de volta pra `availability`: a resposta repetia a oferta, o anti-papagaio do webhook trocou por "me embolei" e ele nunca soube que estava na lista (ele era de fora e só podia naquele dia). `join_waitlist` agora é fluxo fechado nos quatro pontos que forçavam `availability`.
- **"Se abrir pra hj" + "Prefiro" é aceite do aviso (caso Paulo, 25/09 09h07).** Com a oferta pendente, "se abrir/vagar/surgir…" e "prefiro" seco já escolhem o aviso (`escolheAvisoDaOferta`). Antes: a mesma oferta repetida, sem lista.
- **"Amanhã não posso, trabalho 12 hrs / 06 às 06" não é pedido de meio-dia (Paulo, 09h08-09h10).** Virou "amanhã às 12:00 está ocupado, o mais próximo é 12:45" e depois "Sim! amanhã às 15:00 está livre" com a lista de adicionais — reserva armada no dia que ele tinha acabado de recusar. Leituras novas em `_shared/leitura-cliente.ts`: `falaDoProprioExpediente` (número dentro de frase sobre o trabalho dele não é horário nem período) e `diaRecusado` ("amanhã não posso" tira o dia da conversa; "amanhã não posso de manhã" continua sendo restrição de período). A resposta devolve a pergunta ("Qual dia fica melhor?") e, se a oferta de aviso de hoje ainda vale, pergunta se ele quer o aviso — um "sim" já entra na lista.
- **"Como estão seus horários?" sem "Anotei Corte" (caso Bruno, 24/09 11h00).** O caminho sem dia ainda anunciava o serviço suposto, contra a regra da 29.218.0. Serviço vindo do modelo sem o cliente ter citado nenhum também conta como suposição (e sem "como da última vez").
- **"A gente marcou o horário de hoje?" é respondida (caso de 25/09 07h54).** Antes vinha só a lista de vagas. Com reserva no dia: "Sim, está marcado: hoje às 11:30 (…). Te espero." Sem reserva: "Hoje não tem horário marcado no seu nome" na frente da agenda (e o próximo horário dele, se houver).
- **Confirmação de presença entende "só vou fazer a barba" (caso Luiz, 24/09 10h04).** "1 - mas só vou fazer a barba", com Corte + Barboterapia reservados, levou "Confirmado!" sem ajuste — o "só" só era lido para o corte. Agora vale para qualquer família; o que o cliente citou na mesma frase fica (o caso Sr. Magno continua certo). Testes em `confirmacao-presenca.spec.js`.
- **Da varredura da semana:** 🙏 saiu de onde não era agradecimento ("me embolei", áudio, comprovante de Pix, "pode contar", pedido de avaliação); "Responda simou não" → "sim ou não"; remarcação dizia "Em hoje consigo…" → "Hoje consigo…"; "Pela sua rotina" só para quem tem cadência medida (Otavio ouviu na primeira visita).

- **Clube do Ju: link no rodapé da home entra junto com o lançamento.** A /clube/ estava no sitemap mas sem nenhum link de entrada (órfã). O link "Clube do Ju" foi posto no plano da virada de 01/10 (`scripts/reajuste-2026-10/plano.json`, item 266), que a Action aplica às 00h02 — o site anuncia o Clube no mesmo dia em que as vendas abrem (cron `bdj-clube-lancamento`, 8h, que confere a data e se desliga sozinho), não antes. Recorrência no cartão: ping em produção hoje ainda responde "approval is pending"; o chamado 1450423315 do PagBank está aberto e o lançamento segue com o link de pagamento (Pix, crédito e débito).

**Ficou para depois, com motivo:** os outros achados da varredura — "pé do cabelo" lido como corte (Venilson), convite de retorno em dobro com a oferta pós-pesquisa, mídia de número desconhecido sem resposta, o "1" ambíguo da mensagem de recuperação, e um teto de mensagens automáticas por cliente (vários receberam 3-4 na semana). Mexem em crons e em regra de negócio; cada um merece a sua rodada com cenário no simulador.

**Números da semana 18-24/09 (varredura):** 26 conversas iniciadas por cliente, 58% viraram agendamento (48% na semana anterior); o Juliano precisou entrar em 8 (eram 16). A oferta "quer já deixar o próximo reservado?" depois do "satisfeito" teve 19 envios e nenhum "sim" — o convite do dia 12 teve 7 respostas.

**Teste instável:** `routes.spec.js › /agendar/horario/ carrega direto` falhou 1 em 3 execuções com e sem estas mudanças (nada do front mudou aqui).

## 29.233.0 — Clube do Ju: a assinatura mensal da barbearia (24/09)

**Pedido do Juliano (24/09, plano do dia):** lançar o Clube em **1º de outubro**, só de **terça a quinta**, com desconto de 25% nos planos mais completos, 20% nos intermediários e 15% nos de entrada, um plano em que o cliente monta o seu e um plano "entra quando quiser". Depois: *"regras bem claras, um mini contrato de prestação de serviços com aceite do cliente, pense em tudo, pesquise bem e faça o melhor para sermos justos e também me proteger da maldade dos clientes"*. Decisões dele ao aprovar: agendamento pelo Clube com **no mínimo 7 e no máximo 30 dias** de antecedência; **cancelar com menos de 24h ou faltar = visita usada**; **20 vagas + 5 da Cadeira Cativa**; pagamento por **cartão recorrente e Pix**; e mensagem curta para **toda a base** ("acho que os clientes vão se sentir traídos").

**Pesquisa antes de construir.** Mercado: 12 barbearias com plano publicado; quase todas vendem "ilimitado" e têm versão mais barata só nos dias fracos; o assinante vem de fato 2 a 3 vezes por mês (dado de quem vende sistema). Para quem trabalha sozinho, o risco apontado é trocar receita cheia por receita menor no mesmo horário — por isso só ter-qui (15 h vazias por semana nesses dias, nas últimas 8 semanas). Jurídico (fonte primária no planalto.gov.br): CDC arts. 39, 46, 49, 51 e 54; Decreto 7.962/2013; MP 2.200-2/2001 art. 10 §2º; LGPD arts. 7º e 10.

**Decidido contra a recomendação óbvia:**
- **Sem plano ilimitado de verdade.** No lugar, a **Cadeira Cativa** (R$ 249, 5 vagas): horário fixo semanal com corte + Barboterapia + sobrancelha e uma hidratação por mês. O cliente compra a cadeira garantida; o horário vendido é o que hoje fica vazio. O Juliano aprovou ("sensacional").
- **Régua única de desconto pelo valor de tabela do mês** (até R$ 119 = 15%, R$ 120-199 = 20%, R$ 200+ = 25%) em vez de % por plano: o Sob Medida usa a mesma régua e os planos fixos são combinações prontas dela. Por isso a Barba em Dia ficou R$ 112 (20%) e a Barboterapia Semanal R$ 150 (25%).
- **Cartão recorrente ainda não:** a API de Pagamentos Recorrentes do PagBank respondeu **"approval is pending"** em produção (no sandbox responde). Até a liberação, cada mensalidade é paga pelo **link do Checkout PagBank (Pix, crédito ou débito)**, o mesmo produto que já roda em produção. A function `clube-pagbank` fica pronta para a recorrência (ping em produção e sandbox).
- **Desistência em 7 dias devolve o pago menos a tabela do que já foi feito** (cláusula 7.2, em destaque). Na prática quase sempre é 100%: com a régua de 7 dias de antecedência, ninguém usa visita nos primeiros 7 dias.
- **Vendas fechadas até 01/10** (`club_settings.vendas_abertas = false`): quem tentar assinar antes entra na lista de espera.

**Banco (migrations 171 e seguintes, aplicadas como `clube_do_ju_v29_233*`):** `club_settings`, `club_plans`, `club_terms`, `club_subscriptions`, `club_charges`, `club_usage`, `club_waitlist`, `club_phone_codes`, `club_announcements`, `bookings.club_subscription_id`, `customer_profiles.marketing_opt_out_at`. RLS em todas, leitura só `is_admin()`, escrita só `service_role`, GRANT explícito (regra de 30/10).
- **`club_quote()` decide a cobertura** (ter-qui, 7-30 dias, ciclo pago, serviço do plano, saldo; Cativa = 1 por semana; extras como a hidratação contados por ciclo; visita extra por fechamento em `bonus_visits`).
- **Gatilhos em `bookings`** (`trg_zz_club_*`, depois do preço vigente): coberto = `discount_reason 'Clube do Ju'` + preço líquido (convenção da migration 147); o uso vira `usada`/`perdida`/`devolvida` pelo status (cancelamento do próprio cliente com menos de 24h = perdida; cancelamento feito pelo Juliano devolve). **Erro no Clube nunca impede agendamento** (bloco de exceção). Teste em transação desfeita: coberto, <7 dias, sexta, corte + sobrancelha, 3ª visita, cancelamento com devolução e não assinante — os 8 casos certos.
- **Fidelidade:** visita coberta pelo Clube não pontua (condição nova no `v21_sync_loyalty_on_completed_booking`).
- `club_cativa_book` marca os horários fixos do ciclo; `club_recover_coverage` devolve a cobertura quando a mensalidade em aberto é paga (cláusula 3.3); `club_uncover_future` tira a cobertura do que ficou fora do período pago.

**Functions:** `clube` (pública: planos, cotação do Sob Medida, código pelo WhatsApp, assinatura com registro do aceite — data, IP, navegador, telefone confirmado, versão e SHA-256 do contrato —, status, pagar, cancelar/desistir, lista de espera); `clube-ciclo` (cron `bdj-clube-ciclo`, a cada 10 min das 9h às 19h: expira 1º pagamento em 48h, vira ciclo, mensalidade em aberto, encerra em 15 dias, link da renovação 3 dias antes e o lote da mensagem de lançamento); `pagbank-webhook` passa referências `CLB-` para `_shared/clube-ativacao.ts`. Token do link "Minha assinatura" = HMAC do código com `CLUBE_TOKEN_SECRET` (nada guardado em claro).

**⚠️ Armadilha evitada:** o `pagbank-webhook` estava com `verify_jwt=false` em produção **sem estar no `config.toml`** — um deploy pela CLI teria ligado o JWT e derrubado as confirmações de pagamento sem aviso. Declarado agora (junto de `clube` e `clube-ciclo`); conferido depois do deploy (401 vem do próprio código, não do gateway).

**Contrato:** `clube/contrato/v1.txt` (texto canônico, `eol=lf` no `.gitattributes`); o teste `tests/unit/clube-regras.spec.js` recalcula o SHA-256 e falha se o texto mudar sem trocar a versão.

**Painel:** o Concluir mostra "coberto pelo Clube do Ju", trava o desconto manual e dispensa a forma de pagamento quando nada sobra a cobrar; o `admin-booking-status` **preserva o abatimento do Clube** (a tela sempre manda o objeto de desconto, que apagaria a cobertura). Selo "Clube" no card da Agenda. Cupom: "Coberto pelo Clube do Ju: -R$ X".

**JuIA:** "o que é o Clube do Ju?" caía no cartão fidelidade ("Hoje o que temos é o cartão fidelidade" — a assinatura não existia); agora explica o Clube e manda para /clube/, com a data de abertura. Seção nova no prompt (só fala do Clube quando perguntam; nunca assina nem cobra pela conversa). Assinante: plano, situação e saldo no contexto; na reserva, "coberto pelo Clube do Ju" (sem oferta de Pix nem pontos) ou "sai pelo preço normal: <motivo>". Simulador: cenário 33 (96 ok).

**SAIR:** quem responde SAIR (ou "parar", "descadastrar"), sozinho na mensagem, sai do marketing (`marketing_opt_out_at`) e recebe confirmação; aniversário, reativação e convite de indicação passam a respeitar. Mensagens do agendamento continuam.

## 29.232.0 — Concluir abre com a cortesia marcada quando o atendimento já é cortesia (24/09)

**O caso (Filipe, 24/09):** agendou Corte + Barba na navalha às 12:45; por distração saiu só o corte. O Juliano combinou a barba por conta da casa e ela foi marcada para as 19:30 como serviço normal de R$ 40. Pedido do Juliano: *"certifique-se que a barba em cortesia não pontue, assim como serviços de cortesia não devem pontuar"*.

**O que já estava certo:** o gatilho de fidelidade (`v21_sync_loyalty_on_completed_booking`) não credita ponto quando `courtesy = true`, nem consome prêmio.

**O furo:** o modal Concluir **zerava** a caixa "Cortesia" a cada abertura (v29.20.0). Um atendimento marcado como cortesia antes abria cobrando R$ 40 e pedindo forma de pagamento; se o Juliano não remarcasse a caixa, saía como venda no Financeiro.

**O que mudou:** o Concluir abre com a caixa marcada e o motivo preenchido quando o agendamento já tem `courtesy = true` (e desmarca o pedido de avaliação, como já acontecia ao marcar à mão). Atendimento comum segue abrindo desmarcado.

**Dados:** a barba das 19:30 do Filipe foi marcada como cortesia ("Barba não feita em 24/09 (atendimento das 12:45)"); o motivo é anotação interna e não vai pro cliente. A ficha dele ganhou a nota da cortesia.

**Cache:** `admin-v15-4-agenda.js` e `admin-v15-4-core.js` em 29.232.0 (6 páginas), `ADMIN_VERSION` e `admin-version.json` em 29.232.0. Suíte do painel 38/38, unitários 248.

## 29.231.0 — JuIA: cliente a caminho do próprio horário não ouve mais "reservado por outro cliente" (24/09)

**O caso (Américo, 24/09, 09h16, print do Juliano):** marcou pelo site às 08h46 para as 09:15. Às 09:16 escreveu "Bom dia Ju..estou em trânsito...chego em instantes" e recebeu: *"Hoje às 09:15 acabou de ser reservado por outro cliente. O mais próximo que tenho é 11:10."* O Juliano entrou na hora, pediu desculpas e segurou o horário.

**Por que aconteceu (duas falhas somadas):**
1. **`phone_upcoming_bookings` só devolve horário que ainda não começou.** Às 09:16, o 09:15 dele já não era "futuro": sumiu da conversa. O horário ocupado (pelo próprio Américo) caiu no fluxo de agenda e, como a confirmação das 08h46 citava 09:15, a JuIA concluiu que o horário "tinha sido oferecido e alguém fechou".
2. **"estou em trânsito" / "chego em instantes" não estavam no `avisoDeChegada`.** A frase não foi lida como chegada. E, mesmo que fosse, a resposta fixa ("te espero") procurava o horário de hoje só entre os futuros, então também falharia pelo motivo 1.

**O que mudou:**
- **Função nova `phone_current_bookings`** (migração 170, só `service_role`): o horário de HOJE que começou há até 2h. O `ju-ia-site` carrega junto com os futuros; a resposta "te espero, seu horário das X está guardado" usa esse horário primeiro, e o prompt recebe que esse horário é DELE.
- **Trava no fluxo de horário ocupado:** se o dia e a hora pedidos são de um agendamento do próprio telefone (em andamento ou futuro), a resposta é que o horário é dele. Nunca mais "ocupado"/"reservado por outro cliente" para o próprio horário, venha a frase que vier.
- **`avisoDeChegada`** (`_shared/leitura-cliente.ts`) passa a reconhecer trânsito, "a caminho" solto, "to indo", "saindo agora", "quase chegando" e "chego" sem número ("em instantes", "já", "logo", "rapidinho", "em breve").

**Testes:** cenário 32 no simulador (trânsito e atraso com o horário já começado; 92 ok) e 6 frases novas em `tests/unit/leitura-cliente.spec.js`. `npm test` ok. Deploy do `ju-ia-site` conferido: 200 com a chave publicável, 401 sem ela (verify_jwt segue true).

## 29.230.0 — Segundo telefone no mesmo cadastro; "Mesclar" guarda o telefone; Marcos e Marcelo unificados (23/09)

**Pedido do Juliano (23/09):** "devíamos ter um recurso para adicionar 2 telefones ao mesmo cadastro. Tem clientes que fazem isto: cada hora marcam com 1 telefone e acaba gerando mais de 1 cadastro no CRM." Casos citados: o Marcelo que marcou hoje ("é o Marcelo Iphone") e o Marcos atendido ontem ("desconfio que seja Marcos Lima e Marcos Roberto Lima").

**O que já existia e não bastava:** o botão **🔗 Mesclar** do CRM (migração 056) juntava histórico e pontos, mas **apagava o telefone do cadastro duplicado**. Na vez seguinte em que o cliente usava aquele número, nascia outro cadastro.

**O que mudou (banco, migração `customer_phone_aliases_v29_230`):**
- **`customer_phone_aliases`** guarda os outros telefones de um cliente, com RLS só-admin e GRANT explícito, já na regra de 30/10.
- **`phone_match_key` passou a resolver o secundário para o principal.** A conta antiga virou `phone_match_key_raw`. São **36 funções** que comparam telefone por ela (contexto da JuIA, fidelidade, confirmação de presença, cancelar e remarcar pelo WhatsApp, reativação, benefícios…), e todas passam a enxergar os dois números como o mesmo cliente, sem mudar uma linha delas. Nenhum índice nem coluna gerada depende dela (as geradas usam `phone_key`). Conferido: com a tabela vazia, nenhum dos agendamentos mudou de chave.
- **Trigger `trg_bookings_resolve_phone_alias`:** um agendamento feito pelo telefone secundário é gravado no telefone principal do cadastro. Sem isso, a conclusão criaria ficha nova, porque `customer_profiles.phone_key` é gerado do próprio número. **Consequência:** lembrete, aviso de chegada e comprovante vão para o telefone principal.
- **Mesclar** (`merge_customers_internal`, chamada pelo `admin_merge_customers`) agora **guarda o telefone do cadastro apagado como segundo telefone** e também leva `customer_benefits` e as indicações (`referred_by_customer_id`), que ficavam órfãos.
- **`admin_add_customer_phone` / `admin_remove_customer_phone`:** adicionar traz para o cadastro os agendamentos que já existiam naquele número. Se o número já tem cadastro próprio, a função recusa e manda usar o Mesclar, que junta tudo.

**No CRM (`admin-v15-4-crm.js`):** o card mostra "📱 Outro telefone: (11) … [remover]", ganhou o botão **＋ Telefone**, e a busca acha o cliente por qualquer um dos números. O texto da confirmação do Mesclar agora diz que o telefone vem junto.

**Dados arrumados agora:**
- **Marcos Lima** (11 97534-5745, em 26/08 às 15h, quarta, Corte + Barboterapia) foi mesclado em **Marcos Roberto Lima** (11 97354-5745). Os dois dígitos trocados vieram de um agendamento pelo site. Fidelidade: 1 + 1 = 2 pontos.
- **Marcelo** (final 0738, o agendamento de hoje às 18h) foi mesclado em **Marcelo Iphone**. O principal virou o **0738**, que é o número que ele usa hoje (conversa de 22/09). O antigo (11 93350-0117, última mensagem em 08/09) ficou como segundo telefone. As 3 visitas anteriores (06/08, 22/08 e 05/09, um sábado, como o Juliano lembrou) agora aparecem pelos dois números.

**Teste novo:** `tests/e2e/admin/admin-clientes-outro-telefone.spec.js` (card, busca pelo outro número e o ＋ Telefone chamando a RPC). 38 testes do painel e 247 unitários ok.

**Cache:** `admin-v15-4-crm.js` em 29.230.0 (6 páginas), `06-admin-reforma.css` em 29.230.0 (17 páginas), `ADMIN_VERSION` e `admin-version.json` em 29.230.0.

## 29.229.0 — JuIA: convite para o Instagram no fechamento da conversa de agendamento (23/09)

**Pedido do Juliano (23/09):** mandou o print do fechamento do WhatsApp de um laboratório ("Atendimento Finalizado · Você já segue nosso perfil no Instagram?") e disse: "veja se dá pra aproveitar e vamos aplicar pra ver se a gente consegue mais seguidores". Isso segue a diretriz de 27/08, de o Instagram virar canal de aquisição.

**O que entrou (`ju-ia-site`, resposta ao "é a sua primeira vez?"):** essa é a última fala da conversa de agendamento. O horário está marcado, o cliente respondeu e não sobrou nada pendente, então é o momento de boa vontade. Ela passa a terminar com:

> Se quiser acompanhar os cortes e as novidades da barbearia, estamos no Instagram: *@barbeariadoju_* (com o _ no final) https://www.instagram.com/barbeariadoju_

- **Uma vez por cliente.** Quem já recebeu o @ da casa em qualquer mensagem, aqui ou no convite pós-pesquisa da v29.83.0, não recebe de novo (busca em `whatsapp_messages` pelos 8 últimos dígitos).
- **Link junto do @**, para abrir com um toque. O "_ no final" continua escrito, porque existe uma conta homônima sem o underline.
- **Não copiado do exemplo:** o "Atendimento Finalizado" em negrito. Soa a central de atendimento, e o remetente aqui é o Juliano (regra de 01/09).

**Erro meu, pego antes do commit:** a primeira versão procurava `%barbeariadoju_%` com ILIKE, onde `_` é curinga. Isso casava com o `barbeariadoju.` de todo link do site e com o `contato@barbeariadoju.com.br` da chave Pix, e **196 telefones** contavam como já convidados. Os de verdade eram **13**. Agora a busca é por `@barbeariadoju\_`, com o sublinhado escapado (duas barras no fonte JS, que viram `\_` para o Postgres), conferida no banco: 13.

**Simulador:** cenário 31 (convite no fechamento; sem repetir para quem já recebeu). O dublê do banco ganhou `ilike`: sem ele, o código caía no `catch` e o teste acusava a falta do convite, embora em produção o filtro exista. **89 verificações ok.** Deploy do `ju-ia-site` com smoke test ok.

**Medir:** seguidores do @barbeariadoju_ daqui a 2 a 3 semanas, contra o ritmo anterior (+19 em 17 dias em agosto). Até hoje, 13 telefones já tinham recebido o @ por outro caminho e não recebem de novo.

## 29.228.0 — Alarme removido do sistema (o Juliano volta para o app da EKASA); vigia da câmera mantido (23/09)

**Pedido do Juliano (23/09):** "do alarme da barbearia, pode remover esta funcionalidade porque não vai ser necessária. Vou voltar pro app do Ekasa, este app adicional só serviu pra me confundir."

**Contexto.** Em 19/08 (v29.48.0), a central da barbearia saiu do app da EKASA e foi para o Smart Life, porque só o Smart Life se liga à nuvem de desenvolvedor da Tuya. Isso permitiu criar o card "Alarme" e os avisos por push. O custo foram dois apps para a mesma central, e o plano IoT Core da Tuya venceu em 20/09 (ver 29.227.0).

**O que saiu:**
- **Card "Alarme" da tela Hoje** (`admin.html`) e o bloco que o preenchia (`admin-v15-4-dashboard.js`, chamada a `alarm_summary`).
- **A leitura da Tuya no `tuya-watch`.** A function passou a ser só o **vigia do contador de cadeira** (v29.124.0), com a correção do dia da semana da 29.227.0. O nome continua o mesmo porque o cron `bdj-tuya-watch` chama esta function. Testado no ar: `{"ok":true,"camera":{"error":""}}`.
- Os **segredos `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET` e `TUYA_REGION`** saíram do Supabase. Alertas de alarme em aberto foram encerrados (`resolved_at`).

**O que ficou, de propósito:** as tabelas `alarm_hubs` e `alarm_events` continuam no banco como histórico, e nada mais escreve nelas. A `alarm_alerts` continua em uso, porque é a tabela de avisos da câmera. O código do monitor está no Git (29.227.0), se um dia voltar.

**Cache:** `admin-v15-4-dashboard.js?v=29.228.0` nas 6 páginas, `admin-v15-4-core.js` com `ADMIN_VERSION` e `admin-version.json` em 29.228.0. 37 testes do painel ok.

**Ainda do Juliano:** tirar a central do Smart Life e pareá-la de novo no app da EKASA (passo a passo na conversa de 23/09; o importante é "Desconectar" sem apagar dados, para manter os sensores). O projeto de desenvolvedor em iot.tuya.com pode ficar parado, sem custo; se ele quiser, pode apagar.

## 29.227.0 — Alarme: o monitor passou a avisar quando perde o acesso à central (estava cego desde 19/09); vigia da câmera voltou a funcionar (23/09)

**Achado na leitura dos e-mails (pedido do Juliano, 23/09: "veja todos se tem alguma coisa importante").** A Tuya avisou em 19/09 que o plano **IoT Core** venceria em 20/09. Venceu. Desde então, a consulta de aparelhos devolve "IoT Core service subscription has expired", e o `tuya-watch` tratava isso como "nenhuma central": respondia `ok, hubs: []` de 10 em 10 minutos. A última leitura da central "Barbearia" foi em 19/09 às 14h10. **Foram 4 dias sem ninguém vigiando disparo, queda de energia nem bateria, e sem nenhum aviso.**

**Corrigido em `tuya-watch`:**
- **O vigia também vigia a si mesmo.** Se a lista de aparelhos é recusada ou vem sem nenhuma central, ele grava o alerta `tuya-cloud / monitor_sem_acesso` e manda um push "Alarme sem monitoramento" com o motivo que a Tuya devolveu. O aviso sai uma vez, sem repetir enquanto estiver em aberto, e fecha sozinho quando a leitura volta. Testado no ar: o alerta foi criado às 16h34 com a mensagem da Tuya.
- **Vigia da câmera (contador de cadeira, v29.124.0):** `Intl.DateTimeFormat` com `weekday: 'numeric'` não existe e lançava "Value numeric out of range" em **toda** rodada, então a checagem nunca chegava a conferir nada. Agora o dia da semana vem da data de São Paulo.

**Pendência do Juliano (conta dele, não dá para fazer por ele):** renovar ou estender o IoT Core em iot.tuya.com → Cloud → a assinatura do projeto. O plano de testes costuma ser estendido de graça. Quando voltar, o alerta fecha sozinho na rodada seguinte.

**Também registrado no CLAUDE.md (seção 4):** a partir de 30/10/2026, tabela nova em `public` precisa de GRANT explícito na mesma migração (e-mail da Supabase de 23/09). As tabelas existentes, inclusive `closure_notices`, criada hoje, não mudam.

## 29.226.0 — Aviso de fechamento: quem costuma vir nos dias em que a barbearia vai fechar recebe um aviso uma semana antes (23/09)

**Pedido do Juliano (23/09):** vai viajar com a família e a barbearia fecha de **quinta 15 a sábado 17 de outubro**. "Já cria este motor das mensagens, tem clientes que marcam todas as sextas, como o Sr. Longanesi, o Juliano Prando etc." Na mesma conversa, ele pediu para escrever "Viagem" no motivo dos três bloqueios, e isso já foi feito direto no banco.

**Por quê.** Pelas médias de agosto e setembro, com os preços novos, os três dias valem uns R$ 1.600. O cliente fiel que chega e encontra a porta fechada pode cortar em outro lugar e não voltar. Avisado com uma semana de antecedência, ele marca antes ou depois, e a agenda tem espaço para isso.

**Como funciona (serve para qualquer fechamento futuro, não só esta viagem):**
- **Quando:** o cron `bdj-aviso-fechamento` roda às 10h15, de terça a sábado, fora do silêncio da JuIA. Ele lê os dias fechados o dia inteiro (`schedule_blocks.all_day`) e junta os consecutivos num período. Domingo e segunda no meio não quebram o período, e segunda sozinha nem conta, porque a barbearia já não abre. O aviso sai quando o período começa daqui a 3 a 10 dias; para 15/10, a primeira rodada é na terça 06/10.
- **Quem recebe (`closure_notice_candidates`, com os últimos 180 dias de atendimentos concluídos):**
  - *habitual*: veio 3 ou mais vezes em algum dos dias da semana fechados, ou metade das visitas cai neles. A primeira versão só usava a proporção e deixava de fora o Juliano Prando, que vem duas vezes por semana (terça e sexta, 6 de 11 visitas de quinta a sábado);
  - *retorno*: o próximo atendimento previsto (última visita mais o intervalo médio) cai no período, com folga de 3 dias para cada lado.
  - Ficam de fora quem já marcou horário entre 10 dias antes e 10 dias depois do período, quem já foi avisado, quem tem o cadastro arquivado e quem não vem há mais de 75 dias (esse é caso da reativação). Achado no teste: a primeira versão excluía qualquer agendamento futuro e tirava o Sr. Longanesi da lista só porque ele tem horário nesta sexta, 25/09. Horário de setembro não resolve outubro.
- **O texto (`_shared/aviso-fechamento.ts`, fonte única, com teste em `tests/unit/aviso-fechamento.spec.js`):** diz o período, por que ele está recebendo ("como você costuma vir às sextas" ou "pela data do seu último atendimento") e **dias concretos**: até 2 dias abertos antes, a partir de amanhã, e o primeiro dia aberto depois. Não tem emoji nem pergunta numerada, e **não diz o motivo do fechamento**, porque viagem é da vida do Juliano, não do cliente. A resposta cai na JuIA como um pedido de horário comum.
- **Travas:** uma mensagem por telefone por período (`closure_notices`, com `unique`). Se o robô já falou com o cliente nas últimas 20 horas, o aviso fica para a rodada seguinte. No máximo 40 envios por rodada. Um push para o Juliano diz quantos clientes foram avisados.

**Ensaio em produção (dry_run, sem enviar nada):** para 15–17/10 foram **25 clientes**, 16 habituais e 9 de retorno. O Sr. Longanesi aparece com "costuma vir às sextas". Os dias oferecidos são terça 13/10, quarta 14/10 e "a partir de terça 20/10". O dry_run sem período forçado devolveu vazio, como devia, porque o fechamento ainda está a 22 dias.

**Arquivos:** `supabase/functions/aviso-fechamento/` (`verify_jwt=false` no config.toml, chamada com segredo, como todo cron), `_shared/aviso-fechamento.ts`, a migração `aviso_fechamento_v29_226` (tabela `closure_notices` com RLS só-admin e a RPC só para service_role) e `aviso_fechamento_janela_v29_226`. 247 testes unitários ok.

## 29.225.0 — Agenda: bloqueio de horário aparece na lista do dia, na ordem dos horários (23/09)

**Pedido do Juliano (23/09, com print):** "sugestão: meu bloqueio aparecer na agenda na sequência dos horários."

**Antes:** o bloqueio parcial (ex.: 15:00–15:30 "google henrique ads") só aparecia na caixa "Bloquear dia ou horário", abaixo da lista do dia. Lendo a agenda de cima para baixo, aquele meio horário parecia livre.

**Agora (`admin-v15-4-agenda.js`):** a lista do dia mistura agendamentos e bloqueios, ordenados pelo horário de início. O bloqueio é uma linha tracejada e apagada ("17:15–17:30 · 🔒 Bloqueado · motivo") com o botão **Liberar** ali mesmo. Dia inteiro fechado vira uma faixa sólida no topo. A caixa de baixo continua existindo, porque é onde o bloqueio é criado. Criar ou liberar redesenha a lista inteira (`loadAgendaDay`), e não só a caixa. `loadBlocks()` passou a devolver as linhas que carregou, para a lista usar a mesma consulta sem buscar duas vezes.

**CSS:** `.agenda-block-inline` em `css/06-admin-reforma.css`, que só o painel carrega.

**Teste novo:** `tests/e2e/admin/admin-agenda-bloqueio-na-lista.spec.js`. Com um bloqueio fictício às 17:15 entre os agendamentos das 17:00 e das 17:30, o teste confere a ordem e o texto; o print foi conferido. 37 testes do painel ok.

**Cache:** `06-admin-reforma.css?v=29.225.0` nas 17 páginas do painel, `admin-v15-4-agenda.js` e `admin-v15-4-core.js` em 29.225.0 nas 6 páginas, e `ADMIN_VERSION` com `admin-version.json` em 29.225.0.

## 29.224.0 — JuIA: a conversa do Tiago passou pelo simulador inteira; "no período da final do dia" virou "no final do dia" (23/09)

**Pedido do Juliano (23/09):** "mas o Tiago foi claro: quero marcar corte de cabelo para sexta-feira no final do dia."

Ele tem razão, e o defeito não estava na leitura da JuIA: duas das três mensagens nem chegaram a ela, porque a pesquisa de satisfação pendente respondeu antes (corrigido na 29.223.0). Para provar que, chegando nela, a conversa fecha, o **cenário 30** do simulador repete a sequência real: "Agendar horário", depois "Sexta-feira dia 25", depois "Final do dia" e por fim "18h". O resultado foi: horários da sexta → horários do fim do dia (18:00, 18:30, 19:00) → "Na sexta (25/09) às 18:00. Reservo Corte de cabelo, como da última vez?".

**Achado no caminho:** a resposta dizia "Na sexta (25/09), **no período da final do dia**, estes são…". Agora é "no final do dia" (`noPeriodo()`), nas três frases que usavam o período. Manhã e tarde continuam "no período da manhã/tarde".

**Simulador:** 86 verificações ok. **Deploy:** `ju-ia-site`. No ar, "final do dia" com a sexta no estado devolveu "Na sexta (25/09), no final do dia, estes são todos os horários disponíveis…". A sessão de teste foi apagada.

## 29.223.0 — WhatsApp: pesquisa de satisfação pendente parou de interromper o agendamento (caso Tiago, 23/09)

**Pedido do Juliano (23/09, com print):** "outra viajada da JuIA, parece que ela tá piorando."

**O que aconteceu (conversa lida no banco).** O Tiago foi atendido ontem às 18h e não respondeu a pesquisa ("Digite 1 se ficou satisfeito…"). Hoje às 10h42 ele escreveu "Agendar horário", e a JuIA respondeu certo ("Me diz a data e o horário"). As respostas seguintes, "Sexta-feira dia 25" e "Final do dia", foram capturadas pelo interceptador da pesquisa no `whatsapp-webhook`. Mensagem curta que não é 1, 2, elogio nem reclamação caía no ramo `ambiguousShortReply`, que responde "Não entendi. Digite 1 se ficou satisfeito, ou 2 se ficou insatisfeito". Ele recebeu isso duas vezes, no meio do agendamento, e o Juliano fechou na mão às 12h25.

**Não é piora das mudanças de hoje.** O interceptador é antigo e a v29.218–29.222 não mexeu nele. Ele já deixava passar "agendar", "horário" e "amanhã" (`asksSomethingElse`), mas não conhecia dia da semana, data, hora nem período. A pergunta aberta da JuIA ("manhã, tarde ou final do dia?") também não conta como `juiaAwaitingAnswer`, porque não deixa `pending_*` nem `last_question`.

**O que mudou em `whatsapp-webhook`:**
- **Dia da semana, "dia 25", "25/09", "17h", "11:15", "de manhã/pela tarde" e "final do dia" são assunto de agenda**, não resposta de pesquisa, e seguem para a JuIA. Conferido com frases reais: "1", "2", "obrigado", "eu que agradeço", "top demais" e "boa tarde" continuam indo para a pesquisa.
- **Se a JuIA já conversou com o cliente depois que a pesquisa saiu**, a mensagem ambígua vai para a JuIA em vez do "Não entendi". A pesquisa continua valendo para quem responde 1, 2, elogio ou reclamação.

**Deploy:** `whatsapp-webhook` com `verify_jwt=false`, como antes. O smoke test sem o segredo devolveu 401, então a function subiu sem erro de import. O webhook não está no simulador (ele cobre só a `ju-ia-site`); a regex foi conferida à parte, com as frases reais.

## 29.222.0 — JuIA: dia que já passou sai da conversa; "às 17h" sem dia é hoje (caso Marcello, 23/09)

**Pedido do Juliano (23/09, com print):** "você viu isso?"

**O que aconteceu (conversa lida no banco).** A conversa anterior do Marcello foi em 09/09, e o estado guardou `date=2026-09-09`. Duas semanas depois, às 10h00, saiu o convite de retorno. Ele respondeu "Bom dia", "Ia mesmo mandar msg hj" e depois "As 17h". A JuIA procurou vaga no dia guardado: **"Na quarta (09/09) não tenho mais vaga. Hoje tenho alguns horários entre 12:10 e 19:00 (…) Se preferir, te aviso assim que abrir vaga na quarta (09/09)."** Ela falou de uma data de duas semanas atrás, ofereceu lista de espera para essa data e não disse se as 17h de hoje estavam livres. Estavam. Às 12h15 saiu o aviso de "ainda não ficou reservado", e ele não respondeu mais.

**O que mudou em `ju-ia-site`:**
- **Dia que já passou sai do estado antes de qualquer leitura.** Isso vale para `date` (com o `time` e o `period` junto), `last_requested_date` e `last_requested_time`, qualquer `pending_*` preso a uma data passada (lista de espera, confirmação) e a remarcação pendente. O modelo também não consegue repor um dia passado pelo `updates.date`.
- **Hora dita sem dia, que ainda não passou, é hoje.** Antes, "As 17h" sem dia na conversa recebia "Para qual dia você quer ver os horários?" às 10h da manhã. A v29.72.0 já fazia isso, mas só para o corte suposto de cliente novo. Se a hora já passou ou se a frase cita outro dia (amanhã, dia da semana, "semana que vem", "dia 25"), a pergunta do dia continua.

**Simulador:** cenário 29 (o do Marcello, com estado de 14 dias atrás). Como a verificação depende do relógio, depois das 17h o certo é perguntar o dia, a mesma ressalva do cenário 19. **83 verificações, todas ok.**

**Deploy:** `ju-ia-site` com `verify_jwt` inalterado. No teste de fumaça em produção, mandei um estado velho com `date=2026-09-09` e "tem horário as 18h?"; a resposta foi sobre hoje ("Hoje às 18:00 já está ocupado. O mais próximo é 18:45"). A sessão de teste foi apagada.

## 29.221.0 — JuIA e robôs: quem recusou não leva mais mensagem em série; "fica difícil" é recusa; 16h10 não é "o Ju estica"; troca de serviço que ninguém pediu (23/09)

Correções da revisão das conversas de 22 e 23/09 (plano do dia). Todos os casos foram reproduzidos no simulador antes de corrigir.

**1. Caso Newton (19 a 22/09): quatro mensagens automáticas em três dias para quem disse não.** No sábado ele respondeu "Não. Obrigado." e avisou que ficaria uma semana fora. Na segunda, às 08h00, saíram no mesmo minuto "Abriu vaga de novo…" e "seu horário ainda NÃO ficou reservado". Na terça saíram a pesquisa de motivo às 08h00 e a reativação de 30 dias às 14h00. A v29.215.0 já tinha fechado a porta na conversa (recusa e viagem apagam o lead), mas dois robôs continuavam cegos:
- **`customer-reactivation`** mandava "Já faz um mês…" sem olhar a conversa. Agora pula quem trocou qualquer mensagem com a barbearia nos últimos 7 dias, e quem tem contato adiado (`return_invites` deferred com data futura). Pulado não grava outreach, então volta a ser candidato quando a conversa esfriar. O telefone é comparado pelos 8 últimos dígitos, porque o mesmo cliente aparece com e sem o 9. A resposta passou a devolver `skipped`.
- **`whatsapp-lead-followup`**: agora sai no máximo **uma mensagem por telefone por rodada**. O que não saiu agora sai na próxima rodada, se ainda fizer sentido.

**2. Caso Edgar (23/09, 08h37): "Outro horário fica difícil, obrigado" reabria a agenda.** Ele pediu 11:15, a JuIA ofereceu 09:15 ou 11:25, e a resposta foi "Consigo te atender hoje sim! Manhã, tarde ou final do dia?". O Juliano entrou na mão e encaixou. Havia duas falhas: a palavra "horário" contava como pedido novo (`temPedidoNovo`), e "fica difícil" não era uma recusa conhecida. Agora recusar os horários oferecidos ("fica difícil", "complicado", "esses horários não dá"…), sem trazer dia, horário ou período novo, é dispensa. **Se o cliente tinha pedido um horário de hoje**, a resposta é "Vou ver com o Juliano se dá para te encaixar às 11:15; se der, te respondo por aqui", e o Juliano recebe um push "Pedido de encaixe às 11:15". Foi exatamente o que ele fez na mão, e a decisão continua com ele.

**3. Caso Jessica (22/09, 10h51): "Prefiro 16h10" numa sexta recebeu "Nosso horário normal vai até 19:00, mas pra você o Ju estica".** 16h10 só não estava na grade de 15 em 15 minutos. O horário estendido (`extended_close_slot_ok`) aceitou porque estava livre, e a frase de depois do expediente saiu sem conferir se o atendimento passava do fechamento. Agora "o Ju estica" só aparece quando o atendimento termina depois das 19h (15h no sábado). Dentro do expediente a resposta é "Sim, na sexta (25/09) às 16:10 está livre. Posso confirmar?". A mesma correção valeu para a remarcação, que tinha a mesma frase.

**4. Caso Gabriel (22/09, 15h56): "Anotado: Corte de cabelo no lugar de Corte + Lavagem".** Ele só perguntou "Teria algum horário ainda pra hoje?". O modelo preencheu o corte padrão, e a troca dentro da família (v29.165.0) anunciou uma troca que ninguém pediu. Na primeira correção sumiu o "Anotado", mas apareceu "Só pra ajustar: Corte + Lavagem já inclui…". Agora, quando a mensagem não cita serviço nenhum, o serviço que o modelo trouxe não entra por cima do que já estava anotado, nem como troca nem como soma. É o mesmo princípio da v29.218.0: o que o cliente não disse não é narrado.

**Simulador:** cenários 26 (Edgar, com o push, e "fica complicado, valeu" sem pedido de hoje), 27 (Gabriel) e 28 (Jessica, com o dublê `estendidoOk`). **80 verificações, todas ok.** `deno check` limpo nas três functions, 239 testes unitários ok.

**Deploy:** `ju-ia-site`, `whatsapp-lead-followup` e `customer-reactivation`, com o `verify_jwt` conferido depois (true, false, false, como antes). No smoke test a JuIA respondeu normal, e as duas functions de cron devolveram 401 sem o segredo (subiram sem erro de import). As sessões `deploy-check-v29.221.0-*` foram apagadas.

## 29.220.0 — Painel: "Como foi feito" também no ✎ Editar, para anotar depois de concluir (23/09)

**Pedido do Juliano (23/09, com print do Editar):** "concluí o Sr. Edgar mas esqueci de colocar como ele corta. Por favor, no campo Editar depois de concluir, disponibilizar esta funcionalidade."

**O que faltava.** O "Como foi feito ✂️" (v29.195.0) só existia no Concluir e no Balcão. Se não fosse preenchido na hora, o único outro caminho era abrir a ficha do cliente em Clientes → Preferências de estilo, longe do atendimento.

**O que mudou (`admin-v15-4-agenda.js`, modal ✎ Editar):** o campo aparece logo abaixo de "Serviço realizado", com o mesmo texto de ajuda do Concluir. Ele abre com o que já está no cadastro (`styleTextFor`) e grava por `admin_set_customer_style` só quando o texto muda. Essa é a mesma regra do Concluir, então apagar tudo também conta como mudança, e abrir e salvar sem mexer não regrava. Se a gravação falhar, o aviso diz que as outras alterações foram salvas e só o estilo não.

**Teste novo:** `tests/e2e/admin/admin-editar-como-foi-feito.spec.js`, com dois cenários: anotar depois de concluir grava no telefone certo, e abrir com o estilo do cadastro e salvar sem mudar não chama a RPC.

**Cache:** `admin-v15-4-agenda.js?v=29.220.0` e `admin-v15-4-core.js?v=29.220.0` nas 6 páginas, e `ADMIN_VERSION` com `admin-version.json` em 29.220.0.

## 29.219.0 — Balcão: forma de pagamento em botões e total fixo no rodapé, igual ao Concluir da Agenda (23/09)

**Pedido do Juliano (23/09, com print da tela):** "a tela de conclusão do balcão precisava aparecer o total e a forma de pagamento. Ao invés de eu selecionar na lista, se fosse igual é na agenda, ficaria mais padronizado e mais fácil de enxergar."

**O que estava diferente.** Os dois lugares que registram um atendimento concluído pediam o pagamento de jeitos diferentes. No Concluir da Agenda são botões grandes (Pix, Débito, Crédito, Dinheiro, Bônus de fidelidade), e o total fica no rodapé ao lado do botão. No Balcão era uma lista suspensa ("Selecione…"), e o total ficava numa faixa no meio da página, fora da tela quando ele chegava no botão de registrar. No print, o aviso "Selecione a forma de pagamento" aparecia no rodapé e a lista estava lá em cima.

**O que mudou (`admin-balcao.html`, `admin-balcao-v29.js`):**

- **Pagamento em botões**, com o mesmo visual do Concluir da Agenda (grade de 2 colunas e o Bônus de fidelidade na largura toda). A forma escolhida fica dourada. O bloco veio para logo depois dos serviços e produtos, antes de data e horário, que quase sempre já vêm preenchidos.
- **Total no rodapé fixo**, ao lado de "Registrar atendimento", com a forma escolhida embaixo ("R$ 40,00 · Débito"). Antes de escolher, aparece "escolha a forma de pagamento". A faixa de total do meio da página saiu, porque seria o mesmo número duas vezes.
- O valor continua num campo escondido `#balcao-payment`. Validação, gravação (`admin_register_walkin_visit`) e limpeza depois de salvar não mudaram. Se faltar a forma de pagamento, o aviso aparece colado nos botões e some ao escolher.
- O listener dos botões tem guarda (`dataset.bound`), porque o `show()` pode rodar duas vezes (lição da v29.198.0).

**Teste novo:** `tests/e2e/admin/admin-balcao-pagamento.spec.js`, que confere que a lista antiga sumiu, que o total e a forma escolhida aparecem no rodapé, que trocar de Pix para Débito desmarca o anterior e que o aviso de pagamento faltando aparece e some. Os prints de computador e de celular foram conferidos.

**Cache:** `admin-balcao-v29.js?v=29.219.0`. `ADMIN_VERSION` e `admin-version.json` subiram juntos para 29.219.0, com o `?v=` do `admin-v15-4-core.js` nas 6 páginas, para que o painel aberto recarregue e pegue a tela nova.

## 29.218.0 — JuIA: o serviço de sempre deixou de ser narrado no meio da conversa; "pro meu filho" leva só o serviço do filho (23/09)

**Pedido do Juliano (23/09, plano do dia):** "este negócio da JuIA presumir o último serviço, 'já anotei aqui corte de cabelo mais sobrancelha', isso é chato demais, tem que melhorar isto."

**O que estava acontecendo.** A JuIA supõe o serviço de sempre (ou o corte, para quem não disse nada) para calcular quanto tempo de agenda procurar, e isso está certo: evita a rodada de "qual serviço?" que já custou cliente (v29.72.0, caso Bruno). O problema era contar a suposição em voz alta, turno após turno. Numa conversa só o cliente recebia "Ainda tenho alguns horários para Corte de cabelo + Sobrancelha Masculina (aproximadamente 60 min)", depois o rodapé "(Anotei Corte de cabelo + Sobrancelha Masculina, o seu de sempre. Se quiser outro serviço ou incluir algo, é só dizer.)" e, no fim, "Reservo Corte de cabelo + Sobrancelha Masculina, como da última vez?". Era o mesmo serviço repetido três vezes, e ele nem tinha pedido.

**O que mudou em `ju-ia-site`:**

- **A suposição agora é silenciosa enquanto se escolhe dia e horário.** O rodapé "(Anotei…, o seu de sempre…)" da v29.18.0 saiu, e as respostas de agenda deixam de citar o serviço suposto: "Para Corte + Sobrancelha (aproximadamente 60 min) consigo te atender amanhã…" passou a ser "Consigo te atender amanhã…". A limpeza é feita por `semServicoSuposto()` e só roda com `usual_assumed` ligado. Serviço que o cliente disse com a própria boca continua aparecendo normalmente.
- **O serviço aparece uma vez só, na pergunta que fecha a reserva.** Essa pergunta já existia desde a v29.140.0 ("Reservo X, como da última vez? 1 sim / 2 outro serviço"), então o risco que a v29.18.0 corrigia (a v28.30.4, reserva feita em silêncio) não volta: serviço suposto continua sem reservar antes do "1".
- **O corte suposto de cliente novo entrou na mesma trava.** Antes ele levava o rodapé "(Anotei Corte de cabelo — se quiser outro serviço ou incluir a barba…)" e reservava direto. Agora é silencioso até o fim e confirma com "Reservo Corte de cabelo? 1 sim / 2 outro serviço", sem o "como da última vez", porque não houve última vez. Isso acrescenta uma rodada para o cliente novo, mas no fim da conversa, quando ele já escolheu o horário, e não no começo, que é onde a v29.72.0 viu a conversa morrer.
- **Caso Josué (22/09, 21h00): horário para outra pessoa leva só o serviço dela.** O convite pós-atendimento deixou o serviço dele (Corte + Sobrancelha) no estado da conversa. Ele pediu "horário amanhã para meu filho" e a JuIA montou "Corte infantil + Corte de cabelo + Sobrancelha Masculina (aproximadamente 100 min)", até o Juliano entrar na conversa. Agora, quando `horarioParaOutraPessoa()` identifica outra pessoa, valem só os serviços desta mensagem: o que o parser acha no texto ou, se ele não achar, o que o modelo trouxe de novo neste turno. Filho, filha, criança, neto e sobrinho viram corte infantil, e a suposição do "de sempre" do dono do telefone fica desligada na conversa (`usual_rejected`). "Eu e meu filho" continua fora da regra, porque a própria função já exclui esse caso.

**Simulador (`tests/juia-sim/rodar.ts`):** cenários 24a–24e (o de sempre sem narração, o serviço só na pergunta que fecha, o cliente novo sem "(Anotei…)", a confirmação sem "última vez" e o "1" seguindo a reserva) e 25 (o filho do Josué). Os cinco erros foram reproduzidos antes da correção. **72 verificações, todas ok.** `npm test`: um e2e (`routes.spec.js`, /agendar/horario/) falhou na bateria completa e passou ao rodar sozinho; esta versão não toca em nenhum arquivo do site.

**Fica igual, de propósito:** o convite depois do "1 — Satisfeito" ("Pela sua rotina, quinta às 14h45 fica bom — Corte + Sobrancelha") continua dizendo o serviço. Ali não é suposição escondida, é uma oferta explícita que o cliente aceita ou não, e a data e o horário sozinhos não diriam o que está sendo reservado.

## 29.217.0 — JuIA: "não tenho horário" virou "não tenho mais vaga", e dia fechado deixou de ser dito como agenda cheia (22/09)

**Pedido do Juliano (22/09):** "quando estamos sem vaga a JuIA responde 'não encontrei horário para hoje, o mais próximo que vou ter é amanhã'. Poderia dizer que para hoje não tem mais vaga (...) e nos dias que estivermos com a agenda trancada o dia todo dizer 'hoje não estamos abertos, mas eu consigo te atender normalmente no dia X'. No primeiro caso dizer que não tem mais vaga valoriza nosso espaço; no segundo respeita o cliente que pode vir de teimoso tentar um encaixe no fio do bigode e evita que ele perca viagem."

**O que estava errado.** Duas situações OPOSTAS saíam com a mesma frase:

- **Dia aberto e lotado:** "Hoje não tenho horário para Corte de cabelo". É verdade e soa a mentira — lido do outro lado, é barbeiro parado que não quer atender. O que aconteceu de fato é que a agenda encheu, e "não tenho mais vaga" diz exatamente isso.
- **Dia fechado o dia inteiro** (domingo, segunda, ou "Fechar o dia inteiro" marcado no admin por viagem/folga/feriado): "Hoje não temos horários disponíveis. O próximo dia com agenda aberta é 24/09." O cliente lê isso como agenda cheia, e cliente que lê agenda cheia vem tentar encaixe na porta. Encontra a porta fechada e perde a viagem — e a culpa é da frase, não dele.

**Corregí em `ju-ia-site`,** com fonte única para os dois casos (`diaFechadoInfo` / `naoAbreFrase`, montadas logo depois das `closures`, mesma verdade que `openTodayAsk` e `diaFechadoPedido` já usavam: domingo/segunda pelo dia da semana, resto por `schedule_blocks` com `all_day`). Os 9 lugares que respondiam falta de horário foram revisados:

- dia aberto: **"não tenho mais vaga"** no lugar de "não tenho horário" / "não encontrei horário" (bloco principal, pedido "agora", período sem vaga, dias citados pelo cliente, os dois caminhos de remarcação e o `semVagaTxt`);
- dia fechado: **"Hoje não estamos abertos (domingo e segunda a gente não abre)"** — ou o motivo do bloqueio, quando existe — **"mas consigo te atender normalmente na quarta (24/09): tenho 9h, 14h ou 17h30"**.

**Defeito achado no caminho, e ele é pior que a frase:** num dia fechado a JuIA ainda oferecia **lista de espera** ("te aviso assim que abrir vaga"). Não abre vaga em dia que ninguém trabalha — era promessa que nunca ia ser cumprida. Mesma classe do caso Venilson (v29.170.0, lista de espera com a barbearia fechada há três horas). Agora a lista só é oferecida em dia de trabalho.

**Cuidado que quase passou:** o detector de insistência da v29.69.0 (caso do sábado 22/08, em que a negativa idêntica se repetiu três vezes até o anti-papagaio cortar) procurava a frase antiga, `"não encontrei horário"`, na última fala da JuIA. Trocar a redação sem mexer nele reintroduziria o defeito calado. O regex passou a reconhecer as três formas.

**Decidido contra o pedido, e digo o motivo:** o "posso agendar pra você amanhã **ou depois**" não virou duas datas na mesma mensagem. A v29.138.0 é decisão do próprio Juliano (05/09): "menos texto, foco em fechar — diz que não tem, dá o próximo dia com 3 horários e UMA pergunta". Duas datas devolvem duas decisões ao cliente e é aí que a conversa esfria. A mudança de tom ("não tenho mais vaga", "consigo te atender normalmente") entrega o que o pedido quer sem reabrir aquilo. Se em duas semanas a recusa continuar derrubando conversa, o segundo dia entra — medido, não no palpite.

**Simulador (`tests/juia-sim/rodar.ts`):** três cenários novos (21 lotado, 22 dia bloqueado no admin, 23 pergunta genérica em dia fechado) e o mock de `schedule_blocks` passou a responder fechamentos, distinguindo a consulta de `all_day` da consulta do bloqueio da câmera. **63 verificações, todas ok.**

**Consertado de quebra:** o cenário 19 falhava toda vez que o simulador rodasse **depois das 19h** — ele fixa `hoje` e, com a barbearia fechada, a resposta certa passa a ser "Hoje já encerramos", que não cita serviço. O que aquele caso testa é que a barba saiu do pedido, e isso vale nas duas redações. Teste que falha à noite é teste em que ninguém confia.

## 29.216.0 — JuIA: "18" depois da lista de horários virava "Entendi. Se quiser marcar…" — a reserva bateu na trave (22/09)

**Pedido do Juliano (22/09):** print da conversa do Marcelo — "bateu na trave pra ela perder o agendamento, deu certo por pouco".

**O que aconteceu (22/09, 13h14–13h15, conversa lida no banco):** "tem horário para amanhã?" → "Você prefere manhã, tarde ou final do dia?" → "final do dia" → **"estes são todos os horários disponíveis: 18:00, 18:15, 18:30, 18:45, 19:00. Qual você prefere?"** → o cliente responde **"18"** → **"Entendi. Se quiser marcar um horário ou tirar alguma dúvida, é só me dizer por aqui."** A conversa morreu ali. Só voltou às 15h30, quando o aviso de conversa parada disse que o horário não tinha ficado reservado; ele repetiu "quero as 18 amanhã" e a reserva saiu. Duas horas de agenda em aberto e um cliente que quase foi embora por ter escrito o horário do jeito que todo mundo escreve.

**A causa — e ela não é o modelo.** O estado gravado naquele turno tem `time: "18:00"` e `date` de amanhã: o modelo **leu certo** e a intenção era `book`. Quem jogou a reserva fora foram duas guardas de leitura do próprio código, que julgam só o TEXTO da mensagem:

- a da v29.150.0 (caso João, número solto que era resposta a convite de retorno) e
- a da v29.190.0 (caso José Carlos, "Estava muito comprida" lido como pedido de horário).

Ambas só correm "sem pergunta aberta no estado" — e é aí que estava o buraco: **listar horários não deixa `pending_*` nenhum**, então, bem no meio do agendamento, "sem pergunta aberta" dava verdadeiro. E "18" não casa com `\d{1,2}(:|h)\d{0,2}` nem com nenhuma palavra de agenda da regex. Resultado: intent virou `other` e a resposta genérica sobrescreveu o "Reservado!". As guardas estavam certas nos casos delas; o defeito é julgar a frase pelo formato quando o turno já trouxe o dado.

**Correção (`ju-ia-site`):** nenhuma das duas guardas corre quando o turno **trouxe horário novo com a data já na mesa** (`next.time` preenchido, diferente do que estava no estado, e `next.date` presente). O horário que o cliente acabou de escolher vale mais que o formato em que ele escreveu. Os casos João e José Carlos continuam protegidos: lá o turno não traz horário novo — é serviço velho na memória.

**Decidido contra a recomendação óbvia:** não foi ampliado o regex de "sinal de agenda" para aceitar número solto de 1–2 dígitos, nem criada a pergunta `pending_time_choice` para a lista de horários. O regex acertaria "18" e erraria qualquer outro número da conversa; a pergunta nova mexeria no roteamento de resposta curta de todo o arquivo (v29.141.0) para consertar um caso que o estado já resolve. Se aparecer um caso em que o modelo **não** lê o horário, aí sim a pergunta registrada é o caminho.

**Simulador (`tests/juia-sim/rodar.ts`):** cenário 20 com as frases reais do Marcelo — "18" depois da lista reserva, e a resposta não é o genérico. Conferido que ele FALHA sem a correção (52 ok/2 falhas) e passa com ela: **54 verificações, todas ok**. `npm test` verde (239 unit, 52 e2e).

## 29.215.1 — Operação: SMSDev rotacionou as chaves após incidente de segurança; lembrete de 24h por SMS parado de 16 a 22/09 (22/09)

**Pedido do Juliano (22/09):** "acho que o nosso sms dev não tá funcionando nem pra gente, apesar de termos muitos créditos não chegou os últimos testes".

**O que foi encontrado:** `sms_queue` mostra o último SMS aceito em 14/09 17h15; 16/09 timeout, 17/09 resposta vazia e, de 18/09 em diante, `403 NAO AUTENTICADO` em toda chamada. Conferido direto na API (saldo, envio, DLR): a chave era recusada em todos os endpoints. Causa no e-mail de suporte@smsdev.com.br de 18/09 04h08 ("Comunicado importante de segurança"): incidente na plataforma, todas as senhas redefinidas e todas as chaves de API rotacionadas. O e-mail do Juliano ao suporte (28/08) era de outro assunto e não tinha resposta.

**Impacto:** o lembrete de 24h sai por e-mail ou SMS, nunca por WhatsApp (decisão de 04/08, caso Carlos). Cliente sem e-mail ficou sem lembrete de 24h: 11 falhas entre 16 e 21/09. A confirmação de ~3h pelo WhatsApp não parou, então ninguém ficou sem aviso.

**Correção (sem código):** o Juliano redefiniu a senha no painel (o e-mail de recuperação vem de contato@smsempresa.com.br, não de smsdev.com.br, e por isso não foi encontrado de primeira) e copiou a Chave Key nova em Configurações → Minha conta. A chave foi lida da área de transferência e gravada com `supabase secrets set` sem ser impressa em lugar nenhum. Testes: saldo OK (969 créditos), SMS direto ENVIADA pela TIM, e pela function `send-sms` (chamada por SQL com o segredo do vault) status `sent`.

**Fica de lição:** a chave antiga aparece ecoada pelo SMSDev dentro do `last_error` da `sms_queue` — o provedor devolve a própria chave na mensagem de erro. Já está inválida, mas é o tipo de coisa que não se copia para lugar nenhum. E "NAO AUTENTICADO" depois de dias funcionando é chave trocada do lado deles, não crédito nem código: conferir a caixa de entrada antes de escrever para o suporte.

## 29.215.0 — JuIA: revisão das conversas de sábado a terça (19–22/09) — recusa com ponto, "hj", aviso de viagem, "só corte", nome na lista de espera (22/09)

**Pedido do Juliano (22/09, plano do dia):** "tenho muitas reclamações da JuIA, este sábado e ontem ela respondeu errado uma galera (…) revise todas as conversas de hoje até sábado e procure erros e tente deixar a JuIA mais inteligente". Prints do Rafael (segunda, "HJ VC ESTÁ ABERTO?") e do Maurício (convite de retorno em cima de quem avisou que estava de férias).

**O que foi lido:** as 44 conversas de WhatsApp de 19/09 00h até 22/09 09h40, telefone por telefone, mais o histórico anterior dos três clientes centrais. Sábado teve 5 conversas de cliente com erro real (Newton, Otavio, Danilo, e as duas cobranças automáticas em cima do Newton), segunda 2 (Rafael, Maurício) e terça nenhuma até a hora da revisão. O Danilo (10h24, "qual barba?" repetido três vezes) já tinha sido corrigido na 29.214.1 às 14h39 do mesmo dia — conferido que a function no ar é a versão 270, posterior ao commit. Os demais eram defeitos novos, todos de LEITURA da frase do cliente pelo código, não do modelo.

**Os erros e as causas:**

- **Newton (sábado, 17h42–17h46, o caso que o Juliano chamou de "burra").** "Ainda está aberto? Teria um horário?" → "Anotei Barba Express. Para qual dia?" (pergunta de HOJE sem o dia lido). "Não. Obrigado." → "Consigo te atender na terça sim!" (a regra de recusa esperava `não, obrigado` com VÍRGULA; com ponto passava batido, o modelo leu como pedido e o fluxo ofereceu a terça). "Estou saindo de viagem amanhã cedo" → horários da manhã de terça. "Vou ficar uma semana fora de Bragança" → a MESMA lista de novo. Depois, na segunda às 8h: "Boa notícia! Abriu vaga amanhã, que era o dia que você queria" + "seu horário ainda NÃO ficou reservado", e na terça às 8h a pesquisa de motivo — três cobranças em cima de quem disse não e avisou que ia viajar (o aviso de viagem da v29.197.0 só reconhecia "viagem/férias … volto/marcamos"; "saindo de viagem amanhã" e "uma semana fora" não casavam, o lead ficou vivo com a data que a JuIA sugeriu, e um cancelamento na terça disparou o "abriu vaga").
- **Rafael (segunda, 10h46–10h51).** "HJ VC ESTÁ ABERTO?" → "Consigo te atender amanhã sim!" ("hj" não era "hoje": sem dia lido, a agenda foi pro próximo dia aberto sem explicar que segunda não abre). "EU VIAJO AMANHA CEDO" → a manhã de amanhã, horário por horário. O Juliano mandou áudio.
- **Maurício (16/09 20h51 → 21/09 10h00).** "volto de viagem de férias em 1 mês e marcamos" → "Consigo te atender na quarta sim!"; e na segunda 21/09 saiu o convite de retorno dos 5 dias da barba ("já faz uma semana da sua barba, quer deixar o próximo reservado?") pra quem está viajando por um mês.
- **Otavio (sábado, 10h57–11h15).** "Ola" → "Entendido, muito obrigado pelo retorno!" (o webhook leu a saudação como resposta livre da pesquisa de motivo de dias antes). "E so pra corte de cabelo?" → "me embolei" (a regra "só X" exigia a frase COMEÇANDO com "só"; o combo assumido ficou e a negativa do combo se repetiu, o anti-papagaio virou "me embolei"). "Ok, é só um corte mesmo" → a mesma negativa DUPLICADA na mesma mensagem (o "Ok" fechou a pergunta aberta, o resto virou segunda chamada e devolveu o mesmo texto). "Se abrir vaga me avisa" → "preciso de seu nome" → "Otavio" → a negativa de novo, e ninguém entrou na lista.

**Correções (todas com o caso no comentário do código):**

- `_shared/leitura-cliente.ts`: **`avisoDeAusencia()`** — viagem, férias, "ficar/estar fora", "só volto", com prazo quando dito ("uma semana" = 7, "1 mês" = 30). Não é ausência quem já voltou, quem pede horário na mesma frase ("viajo sexta, tem horário quinta?") nem quem só conta da viagem. 7 testes novos em `tests/unit/leitura-cliente.spec.js`.
- `ju-ia-site`: aviso de ausência **substitui a resposta** (boa viagem / boas férias, sem horário), zera a agenda da conversa e a lista de espera, apaga o lead (nenhuma cobrança automática) e, com prazo, agenda o contato pra volta pela fila do convite de retorno (`return_invites` 'deferred' — o que impede o convite dos 5/12 dias de sair no meio da viagem, caso Maurício) com a resposta dizendo o dia ("eu te chamo por aqui na terça (29/09)").
- `ju-ia-site`: recusa aceita **qualquer pontuação** ("Não. Obrigado.", "Não! Obrigado", "nao obrigado").
- `ju-ia-site`: **"hj" = hoje e "amn/amnh" = amanhã** já na normalização (vale pra toda leitura do arquivo); **"está aberto?" / "ainda aberto?" = pergunta de hoje** — no sábado depois das 15h a resposta é "Hoje já encerramos", na segunda é "Hoje a barbearia não abre (domingo e segunda), voltamos terça e aí consigo te atender…".
- `ju-ia-site`: "só X" aceita muleta de abertura ("e só pra…", "ok, é só um…", "então só…").
- `ju-ia-site`: nome solto depois de "preciso de seu nome" **fecha a lista de espera**.
- `ju-ia-site`: segunda parte da mensagem igual à primeira não se repete (fim do texto duplicado).
- `whatsapp-webhook`: saudação ou pedido novo em cima de uma pesquisa de motivo pendente encerra a pesquisa em silêncio e segue pro fluxo normal — não vira "motivo: outro".
- `survey-recovery`: grava no banco o texto como saiu (sem emoji), como as outras functions desde a 29.212.0.

**Simulador (`tests/juia-sim/rodar.ts`):** cenários 16 a 19 com as frases reais (Newton ×3, Rafael ×2, Maurício, Otavio ×2) — 52 verificações, todas ok. O cenário 1 ("segunda às 18h") dependia de a terça do simulador ser DEPOIS da segunda; rodando numa terça falhava sozinho. Corrigido pra usar o dia seguinte à segunda.

**Banco:** lead do Newton apagado na mão (estava em `followup_stage 2` com marca de vaga reaberta; com a viagem, não pode gerar mais nada).

**O que fica pro Juliano (não é código):** o Augusto recebeu no sábado 09h o texto ANTIGO de aniversário ("um serviço extra é por nossa conta"), porque a 29.209.0 entrou no ar depois do cron — se ele vier até 19/10, vale o que foi prometido, não a sobrancelha. O Newton e o Rafael foram tratados na hora (áudio); o Maurício levou o convite indevido de segunda e talvez mereça uma linha do Juliano quando voltar.

**Não mudou:** a JuIA continua sem saber marcar DUAS pessoas numa conversa ("eu corto o cabelo, meu pai faz a barba", Otavio 10h57) — ela soma os dois num combo de uma pessoa só. Ficou anotado como próximo caso; hoje o Juliano resolve na mão quando aparece.

**Testes:** 239 unit + 52 e2e (`npm test`, tudo verde). Deploy `ju-ia-site` (`verify_jwt=true`), `whatsapp-webhook` e `survey-recovery` (`verify_jwt=false`) via CLI, iguais ao anterior; smoke logo após.

## 29.214.1 — JuIA repetia "qual barba?" pra quem já tinha escolhido a barba (19/09)

**Caso reportado pelo Juliano (print, 19/09, 10h22–10h26):** o cliente pediu "cabelo e barba", a JuIA perguntou qual barba (certo). Ele respondeu "barba na navalha com toalha sem ozônio" e recebeu a MESMA lista das três barbas. Respondeu "Corte + barba na navalha" e levou a lista pela terceira vez, com "Anotado: Corte de cabelo no lugar de…" e um segundo corte somado. Ele não agendou, e às 12h30 a cobrança automática ainda falou em "Corte + Barba na navalha + Corte de cabelo". Aconteceu antes da 29.212.0 (JuIA) entrar no ar, mas o defeito continuava no código.

- **Causa 1:** a pergunta "qual barba?" só era pulada quando já havia um serviço da categoria `barba`. A resposta dele virou o COMBO "Corte + Barba na navalha com toalha quente" (categoria `combo`), e a palavra "barba" reabria a pergunta. Agora a barba dentro do combo conta como escolhida (famílias de `_shared/service-rules.ts`). Resposta que já nomeia a barba (navalha, toalha, ozônio, express, máquina) também não é pedido genérico.
- **Causa 2:** "Corte + barba na navalha" era picado no "+", e o "Corte" solto virava "Corte de cabelo" somado ao combo. A regra das famílias tinha rodado antes desse acréscimo. Agora frase com "+" que é o começo de um combo do catálogo vale o combo inteiro, e a regra das famílias roda de novo depois dos serviços achados na frase.
- **Achado de brinde pelo simulador:** `findService('')` casava com todos os serviços e devolvia o de nome mais curto, "Luzes". Cliente com visitas mas sem `last_services` no contexto receberia "Luzes" como serviço de sempre. Nome vazio agora não é serviço.

**Simulador:** cenário 15 com as três mensagens reais dele (38 verificações, todas ok).

**Numeração:** saiu primeiro como 29.212.1 no commit, mas a Central de Conteúdo já tinha publicado 29.213.0 e 29.214.0 em paralelo; renumerado para 29.214.1 pra versão nunca andar pra trás.

## 29.214.0 — Domingo é dia de boa semana; segunda com ânimo e sem vender (19/09)

**Pedido do Juliano:** "os posts de domingo e segunda, estes são super importantes; de domingo sempre buscar mensagens de boa semana, de motivação, coisas positivas".

**Os números:** dos 5 domingos anteriores, 4 foram reprovados; das 4 segundas, 2. Os ângulos de domingo pediam memória ("lembro do silêncio dessa cadeira"), história da cadeira e gratidão pelo passado, e o modelo escorregava para nostalgia, tom de despedida e intimidade. As segundas vendiam ("agende pelo link", "a experiência da Barbearia do Ju") num dia de porta fechada e soavam como coach.

- **Domingo (`content-generate-daily`, ramo `dowSP === 0`):** quatro ângulos novos, todos olhando para a frente e **terminando em boa semana**: uma lição da cadeira para a semana ("corte bom é uma passada de cada vez; semana boa também"), desejos concretos de boa semana, o ânimo de quem está pronto para recomeçar na terça, e fé e esperança para a semana. Proibidos: nostalgia, despedida, balanço do passado, peso, afirmar a vida de quem lê (a regra `NAO_INVASIVO` de 30/08 continua), venda, frase de coach. Textos de reserva reescritos no mesmo tom.
- **Segunda (`dowSP === 1`):** ânimo de começo de semana ancorado no ofício (o primeiro passo, a constância do cuidado pequeno, o respeito por si, a casa se preparando), em primeira pessoa, sem vender. No máximo "a partir de terça a gente se vê".
- `CLICHE_VAZIO` ganhou as frases de coach ("foco, força e fé", "bora vencer", "segunda é dia de vencer", "semana nova, visual novo"), para a proibição não ficar só no pedido. Conferido que "que a sua semana seja…" passa e que nenhum texto de reserva bate na trava.
- **Crivo das 8h05 passa a rodar todo dia** (antes era de terça a sábado, e justamente os dois posts mais importantes ficavam sem revisão). Depende do computador ligado: se estiver desligado no domingo, o crivo não roda e o post segue como o gerador fez.

**Primeiro domingo novo:** 20/09. Deploy com `verify_jwt=false` como antes; smoke 401 sem segredo.

## 29.213.0 — Central de Conteúdo: calendário com educativo e humor, fim da muleta do café (19/09)

**Pedido do Juliano:** "minha grande preocupação com postagens repetitivas sempre falando de café e outras coisas repetidas, gostaria de mais posts educativos e especialmente de humor".

**O que os números mostraram (30 dias, 117 posts da IA):** 64 eram "campanha", 8 educativos, 8 de humor; "café" em 25 legendas, "um cliente por vez" em 21; 53 reprovados no crivo. **Causa:** a "campanha ativa" do `marketing_memory` é uma ficha genérica de ganchos da marca, ligada desde 04/08 sem data para acabar, e com ela ativa todo dia de quarta a sábado caía no mesmo ramo (a rotação de temas nunca rodava, já anotado na v29.88.0). E a instrução de estilo (`VOZ_CONCRETA`) dava como exemplo justamente "o café servido na chegada", "um cliente por vez" e o espelho, que o modelo tomava como pauta. Os posts variados de humor e educativo que saíram em setembro eram as peças feitas à mão do plano de 30 dias, não o gerador.

- **Calendário novo de quarta a sábado** (`_shared/pautas.ts`, testes em `tests/unit/pautas.spec.js`): quarta EDUCATIVO, quinta HUMOR, sexta marca (campanha/rotação como antes), sábado alterna humor e educativo. Domingo, segunda e terça não mudam. Num mês, 12 dos 16 dias de quarta a sábado viram educativo ou humor.
- **Bancos de pautas com rodízio:** 16 educativas (mitos como "raspar engrossa o pelo", "arrancar fio branco faz nascer dois", "vapor abre os poros"; pelo encravado, óleo x balm, caspa x couro seco, por que perguntamos o histórico antes da química, sol na nuca recém-cortada…) e 13 de humor (o "só dá uma aparada" que vira "pode subir mais", "tira só um dedinho", o nariz que coça com as mãos debaixo da capa, o cabelo no formato do boné, a primeira toalha quente…). A próxima pauta é a nunca usada ou a usada há mais tempo (`context.pauta`), e cada uma tem texto de reserva escrito à mão.
  - Educativo: fato estabelecido, sem número, estudo, marca ou dose (citação só se levantada na fonte, regra da casa); assunto de saúde termina no dermatologista.
  - Humor, com os princípios da skill `joke-engineering` traduzidos para legenda curta: detalhe específico, quebra na última frase, nada de explicar a piada. O alvo é o ofício ou o próprio barbeiro, **nunca o cliente**: proibido aparência (calvície, peso, idade), política, religião, time, duplo sentido e conversa da cadeira.
  - Educativo e humor **não vendem** (a instrução vale acima do "venda a experiência" dos prompts de plataforma).
- **Ganchos gastos, com trava:** café, "um cliente por vez"/"sem plateia", hora marcada/horário respeitado, "sem pressa"/"sem atropelo", espelho e ambiente climatizado saem **no máximo 1 dia por semana**. Entram no prompt como proibidos e na checagem `temaRepetido`, que refaz a legenda. Antes, "cliente" e "marcada" estavam na lista de ruído da trava de repetição, então os dois ganchos mais repetidos nunca eram pegos.
- `VOZ_CONCRETA` e o tema da terça trocaram os exemplos por outros fatos do ofício (navalha no contorno, gel transparente que deixa ver a linha, tesoura no volume de cima, anotação do corte anterior, pezinho por último). Textos de reserva de campanha e experiência sem café. A arte ganhou tema próprio para educativo e humor (objetos, sem pessoas), e o café saiu da arte da terça e do padrão.
- Crivo das 8h05 (fora do repo) conhece o calendário: não reprova educativo e humor por "não vender", reprova humor que mira o cliente e educativo com número ou sem dermatologista, e confere os ganchos da semana.

**Erro pego pelo teste antes do deploy:** a regex do café usava ``, que no JavaScript não reconhece o "é" como letra; "café " não tinha fronteira e passava direto. Justamente a palavra que motivou tudo. Trocado por limites com `\p{L}`.

**Não mexi:** a ficha "campanha ativa" continua (sexta usa, e ela tem revisão marcada para 30/09); nenhuma skill nova precisou ser instalada — `joke-engineering`, `content-strategy` e `social` já estavam aqui.

**Ainda não visto ao vivo:** o gerador roda uma vez por dia e o de hoje já saiu. Primeiro educativo na quarta 23/09, primeiro humor na quinta 24/09, os dois pelo crivo. Deploy `content-generate-daily` com `verify_jwt=false` como antes; smoke 401 sem segredo.

**Testes:** 232 unit (11 novos) + 52 e2e.

## 29.212.0 — JuIA: análise de erros das conversas reais, 16 correções, prompt reorganizado e simulador (19/09)

**Pedido do Juliano:** "procure skills que nos ajude a melhorar a juia" → "roda ai" (análise de erros) → "pode aplicar todas as melhorias como você achar melhor só não deixe nada pendente para depois".

**Skills instaladas (global, fora do repo):** pacote de avaliação de IA do Hamel Husain (`error-analysis`, `generate-synthetic-data`, `write-judge-prompt`, `validate-evaluator`, `eval-audit`, `build-review-interface`, `evaluate-rag`) e `prompt-engineering-patterns`. Nenhuma skill de Evolution API valia: a mais instalada foi apagada pelo autor, a outra é texto genérico sem manutenção.

**A análise (método da `error-analysis`):** 132 conversas de WhatsApp de 05 a 19/09 (conversa = telefone × dia com mensagem do cliente e da JuIA), 121 avaliadas (o número do Juliano fica fora), lidas uma a uma por 3 agentes, só com SELECT. Primeira contagem: 53 com erro real (44%), em 9 categorias: horário/dia pedido ignorado, serviço trocado sem pedido, frase lida como outra coisa, automação fora de hora, trava/pergunta sem resposta, "me avisa/me chama depois" sem suporte, identidade, química sem sinal e fato falso sobre o Juliano.

**Erro meu na medição, corrigido antes de mexer em código:**
- (1) Dois agentes contaram emoji como erro em ~35 conversas. Não era: `whatsapp_messages.body` gravava o texto ANTES do `semEmoji()`, e o cliente recebia sem emoji.
- (2) Ao ler o `ju-ia-site` inteiro, vi que a maior parte das 53 já tinha sido corrigida DURANTE a janela analisada (29.180 a 29.208, com o mesmo caso citado no comentário do código). O lote de 11 a 15/09 estava 100% corrigido.
- Os 44% são a foto do período, não o estado de hoje. Os erros que continuavam abertos no código eram estes 16.

**Correções (casos reais, nomes só nos comentários):**
- **Dia trocado virava reserva** (Tiago, 18/09): "Segunda às 18h?" → "Reservado! terça 18:00". O dia que o cliente ESCREVEU agora vence o que o modelo devolveu. Dia fechado nunca vira reserva direta: a resposta diz que segunda não abre e oferece terça como pergunta.
- **"Antes das 11h" lido como pedido das 11h** (18/09): virou teto de início, e o próximo dia oferecido respeita o mesmo teto. "Até as X" também.
- **"Tem que ser depois das 18h" repetia 17:15** (17/09): sem nada depois do piso no dia, a JuIA oferece o próximo dia com horário depois do piso.
- **Serviço do histórico reservado sem confirmar** (18/09): a pergunta "reservo X, como da última vez?" morria quando o cliente mudava de assunto, e o "sim" seguinte reservava a barba de R$ 50 (ele fez a de R$ 40). A marca de "assumido" só cai quando ele nomeia o serviço.
- **"Avisar" seco dava "me embolei"** (18/09): com a oferta de lista de espera aberta, a palavra solta aceita.
- **"Estou na rua de baixo" → "quer que eu cancele o outro?"** (18/09): aviso de chegada pro horário de hoje responde "te espero" e limpa a conversa velha do dia. A pergunta de conflito só sai quando a mensagem atual fala de agenda.
- **"Falo direto com o Juliano?" → "sou assistente virtual"** (17/09): virou pedido de gente (handoff), inclusive "queria falar com ele" depois de a JuIA citar o Juliano.
- **"Meu amigo!" lido como nome** (17/09): o vocativo que sobra da saudação tirada sai. A saudação aceita dois vocativos ("boa tarde meu amigo / Ju").
- **"Obrigada"** (17/09): quem assina o WhatsApp é o Juliano. A fala sai no masculino, inclusive o texto fixo da fidelidade.
- **"Vou registrar para avaliação do Juliano" sem registrar nada** (17/09): resposta que promete levar o recado agora manda push pro Juliano com a mensagem do cliente.
- **"Você faz pintura?" entrava na reserva** (16/09, R$ 140 / 145 min): serviço citado só dentro de uma pergunta de existência, e não pedido em outro trecho, não entra. Sinônimos por serviço ("pintura" → Pigmentação Capilar) em `_shared/leitura-cliente.ts`.
- **"Reservado! Sr, na quinta"** (16/09): nove cópias de "primeira palavra do nome" viraram uma só (`_shared/primeiro-nome.ts`). Ela pula tratamento (Sr, Dr, Dona…), normaliza nome em maiúscula e tem padrão por mensagem.
- **"Tenho exame de sangue 8:30" + "conseguimos marcar mais tarde?" → "quer mesmo cancelar?" duas vezes** (10/09): quando é o MODELO que lê cancelamento (e não o cliente que pede), a JuIA pergunta "1 — Remarcar / 2 — Cancelar". "Mais tarde", "outro horário" e "passar pra sexta" de quem tem horário são remarcação.
- **Corte do namorado no nome da namorada** (11/09): horário pra outra pessoa pede o nome de quem vai ser atendido. Aquela reserva não usa os pontos nem o prêmio de fidelidade do dono do telefone.
- **"Me chama daqui 14 dias" fora do convite de retorno** (08/09): vira lembrete na mesma fila do convite (`return_invites` 'deferred', o `return-invite-dispatch` manda no dia). Sem atendimento anterior, o Juliano recebe o pedido por push.
- **Segundo comprovante de R$ 35 respondido com "Pix de R$ 25"** (09/09): o cliente ouve o valor LIDO no comprovante. A diferença com o esperado continua no push.

**Registro sem emoji:** as 16 funções que mandam WhatsApp passaram a gravar em `whatsapp_messages` o texto que saiu de fato (depois do `semEmoji`). Emoji no banco agora quer dizer emoji no celular do cliente.

**Prompt reorganizado** (skill `prompt-engineering-patterns`): era um parágrafo único de ~31 mil caracteres com 25 remendos "caso real, fulano". Virou 14 seções com título e uma regra por linha, com as regras que nunca quebram no topo. Ficou com ~17 mil caracteres, cerca de metade do custo por mensagem. As histórias continuam nos comentários do código.
- **Conferência:** as 77 regras antigas, uma a uma, estão nas seções novas.
  - QUEM VOCÊ É: identidade, honestidade quando perguntam se é IA, pedido do Juliano = handoff.
  - REGRAS QUE NUNCA QUEBRAM: emoji, invenção, horário antes do sistema, ação que só o sistema faz, "já tem agendamento", famílias, Barba Express, desconto, tolerância, data de sistema, linguagem interna.
  - COMO ESCREVER: idioma, tamanho, cortesia, sem saudação, nome, repetição, avançar, "deixa eu conferir".
  - SERVIÇOS: resumo das barbas, barboterapia genérica, mesma família, pezinho, combo falso, barba já reservada, visagismo, argumento de venda, oferta após informação, grupo, raspar/infantil, histórico, valor ≠ escolha.
  - AGENDA: funcionamento, dia fechado, fora do horário, piso/teto, quais dias, quais horários, dois horários, duas datas, pedido reduzido, horário sem serviço, fechamento excepcional.
  - CANCELAR/REMARCAR/TROCAR.
  - CONVERSA: saudação isolada, "tudo bem?", saudação incomum, retomada, reação curta, despedida, chegada/atraso, lembrete, outra pessoa, handoff.
  - ABERTURA: WhatsApp e site.
  - PAGAMENTO: parcelamento, as duas chaves Pix, nunca confirmar pagamento.
  - A CASA: endereço, Instagram, cortesias, garantia, reajuste, reação ao preço, fidelidade, repetir e recomendar.
  - CONTATO COMERCIAL e prospecção.
  - DADOS, CAMPANHA e FORMATO JSON.
- **Achado na conferência:** a regra do reajuste de 01/10 só entrava no prompt quando havia campanha ativa. Agora vale sempre.

**Simulador da JuIA** (`tests/juia-sim/`): roda o `ju-ia-site` inteiro no computador. O banco é trocado por um dublê e o modelo por respostas roteirizadas: nada vai pra produção, WhatsApp ou OpenAI. São 17 cenários: os 14 casos acima e 3 de regressão (reserva normal, saudação, cancelamento explícito). O simulador pegou dois defeitos de acabamento antes de publicar: "Reservado! na terça" (a frase ficava minúscula depois de tirar o nome, defeito antigo) e os pontos da dona do telefone aparecendo na reserva do namorado.
- Rodar (precisa do Deno): `deno run --allow-env --allow-read --config tests/juia-sim/deno.json tests/juia-sim/rodar.ts`; com `SIM_VER=1` imprime cada resposta.

**Decidido contra a recomendação óbvia:**
- Não montei o "juiz automático" (LLM-as-judge) agora. A skill manda consertar primeiro o que tem conserto direto, e juiz só pro que sobrar e se repetir. Cada rodada dele custa API da OpenAI. Fica pra depois da remedição.
- A suspeita "JuIA oferece 19h de terça" não é erro: é a regra da 29.167.0 (início até o fechamento, término até 60 min depois).

**Medir:** repetir a mesma contagem (mesma definição de conversa, mesmas categorias) em ~03/10, só com conversas a partir de hoje, e comparar categoria por categoria.

**Testes:** 221 unit (31 novos em `leitura-cliente.spec.js`) + 52 e2e + 33 verificações do simulador. `deno check` sem erro nas 18 functions publicadas; de quebra, corrigido um aviso de tipo antigo (`sAdd` possivelmente indefinido) no `ju-ia-site`.

## 29.211.0 — Reajuste de 01/10 pronto: o site estático vira sozinho à meia-noite (19/09)

**Pedido do Juliano:** "pode deixar tudo pronto do reajuste, mas só pode aparecer pros clientes a partir do dia 01/10, e pros agendamentos, mesmo que realizados antes, com data do serviço a partir de 01/10 considerar já os novos preços".

**O que já estava pronto e foi conferido hoje (não mexi):** o banco (18 linhas em `service_price_changes`, cron `bdj-aplicar-reajuste-agendado` às 00:05 de 01/10; o gatilho `trg_bookings_preco_vigente` grava a tabela da DATA do atendimento em quem marca antes, inclusive combinações como "Corte + Sobrancelha", e `reprice_future_bookings` reprecifica na virada quem marcou antes); a JuIA e a oferta de retorno (preço da data, v29.154.0/v29.155.0); o `/agendar/` (mostra o preço da data escolhida, v29.154.0); o `services-catalog-v7.js` (vira sozinho por `priceFrom`, v29.127.0). Sobrava o texto fixo das páginas.

- **Virada automática do texto das páginas** (`scripts/reajuste-2026-10/`): `plano.json` com 265 trechos exatos (274 ocorrências em 29 arquivos: descrições, JSON-LD `Offer`, FAQ, blog de preços, cartões e `data-price` do `/agendar/`), aplicados por `aplicar.mjs` **tudo ou nada**, com JSON-LD validado depois. Roda pela automação do GitHub (`.github/workflows/reajuste-2026-10.yml`) às 00:02 de 01/10, com tentativas até as 7h (o agendador do GitHub atrasa), publica no main, pede o build do Pages e confere no ar. O script **recusa** rodar antes de 01/10 00:00 de Brasília.
  - A lista foi gerada por classificação serviço + valor (o serviço citado mais perto de cada preço, e o valor tem que bater com o preço antigo daquele serviço) e revisada trecho a trecho. Trocar número às cegas erraria: "R$ 25" é Barba Express (→35) e depilação (→30); "R$ 50" é Corte + Lavagem (→60), Barboterapia com ozônio (→60) e química que não muda. Química, Luzes, Platinado, Alisamento, Pigmentação Capilar, Reconstrução pós-alisamento e Freestyle não sobem; conferido que nenhuma página deles foi tocada além da citação da Hidratação.
  - **Frases reescritas, não só números:** 4 páginas diziam que o combo "custa o mesmo que os dois separados". Com a tabela nova deixa de ser verdade (e fica melhor para o cliente): Corte + Barba Express R$ 80 contra R$ 85 separados; Corte + Barboterapia R$ 95 contra R$ 100.
  - `/precos/` perde o aviso "passam a valer em 1º de outubro" e `/precos/setembro/` vira redirecionamento para `/precos/`.
  - **Já hoje, na `/precos/`** (que já mostra a tabela nova, é o destino do QR code da plaquinha): a frase "até 30/09 os preços atuais continuam valendo, inclusive para quem já tem horário marcado" dava a entender que horário marcado antes ficava com o preço velho. Virou "vale o preço da data do atendimento", igual à plaquinha impressa.
- **Travas contra o plano envelhecer até lá:** `tests/unit/reajuste-2026-10.spec.js` falha se qualquer trecho deixar de existir no site (é o `npm test` de toda sessão) e só aceita pares da tabela aprovada; a automação do GitHub também roda em modo "só conferir" a cada envio que mexe em página, e manda e-mail se quebrar.
- **Testes e2e sem preço escrito à mão** (`tests/e2e/_precos.js`): `cart.spec` e `booking-review.spec` tinham "R$ 40,00" fixo e quebrariam na virada. O `booking-review` marca para daqui a 5 dias, então **a partir de 26/09 já cairia em outubro** e quebraria antes da hora. Agora o valor esperado vem do catálogo, pela data do atendimento.

**Erro pego no ensaio, antes de publicar:** a primeira versão do aplicador pulava em silêncio 12 trocas da lista de preços do FAQ ("Corte R$ 40, Corte + Lavagem R$ 50…"), porque o trecho de uma troca se sobrepunha ao da seguinte e, depois da primeira, a segunda não existia mais. O gerador passou a juntar trocas vizinhas num trecho só, e o aplicador confere de novo a contagem na hora de trocar (teste novo para esse caso). É a armadilha da seção 4 do CLAUDE.md: script que imprime "ok" sem ter feito.

**Ensaio completo numa cópia:** plano aplicado, varredura de sobras (nenhum preço antigo restante), pares de troca conferidos, JSON-LD válido em todas as páginas, e a suíte e2e inteira (52) passando com a vigência antecipada para simular outubro.

**Testes:** 190 unit + 52 e2e.

## 29.210.1 — Fim do vão preto na seção "Veja o espaço" (19/09)

**Pedido do Juliano:** "esta parte preta do meu site me incomoda", com print da coluna de texto da seção do vídeo na home: título em cima, cartões embaixo e um buraco preto de ~330px no meio.

- **Causa, não conteúdo faltando.** O cartaz do vídeo (`assets/fachada-poster.webp`) é uma foto em pé (760x1013), e o vídeo é deitado (1024x576). Antes de tocar, o `<video>` assume o tamanho do cartaz: na largura da coluna ele pedia 816px de altura, a linha da grade esticava junto e a coluna de texto (com `justify-content:space-between`) empurrava os cartões para o fundo. Medido em 1366px: a seção tinha 814px de altura; agora tem 488px, e texto e vídeo começam e terminam na mesma linha.
- **Correção** (`css/01-site-base.css`): `contain:size` no vídeo do computador, para o cartaz não mandar mais na altura. Quem manda é o texto, e o vídeo acompanha (piso de 430px, como antes). Enquadramento do cartaz em `50% 10%`, para a placa "Barbearia do Ju" aparecer inteira. No celular, o vídeo ganhou proporção fixa 4:3: antes aparecia em pé (~525px) e encolhia para ~220px ao dar play.
- **Decidido contra a recomendação óbvia:** não coloquei nada para preencher o vão (foto, quarto cartão, texto a mais). Encher um espaço que só existia por causa de um defeito deixaria a seção mais longa e com mais texto do que precisa, e o defeito continuaria lá.
- Cache: `style.css?v=` e `01-site-base.css?v=` em 29.210.1 nas 81 páginas, e o cache do `sw.js` também.

## 29.210.0 — Retorno marcado na cadeira, produto para casa à vista no Concluir e checagem de admin nas 4 functions que faltavam (19/09)

**Pedido do Juliano:** "melhora o que você achar melhor da forma que você achar melhor", depois da análise da manhã com as skills novas.

**Os números que decidiram (60 dias até 19/09):** 279 atendimentos (~6,5 por dia, ~65% da capacidade), ticket médio R$ 55,88, **só 13% com produto**. Antecedência de quem marca pelo site/JuIA: **53% no mesmo dia, 30% na véspera, 7% com 4 dias ou mais**. Dos 176 clientes, 70 atendidos entre 20 e 45 dias atrás ainda não marcaram de novo.

- **Retorno marcado NA CADEIRA** (`admin-v15-4-agenda.js`, regra em `assets/js/retorno-cadeira.js`). Depois do Concluir, no lugar do alerta, o painel mostra até 3 opções reais de terça a quinta perto do retorno de costume do cliente (cadência própria com 3+ visitas; sem histórico, corte 17 dias e barba 7), no horário mais perto do que ele acabou de vir. Um toque cria o agendamento pelo `admin_create_booking` com a anotação "Retorno marcado na cadeira" (é por ela que se mede o aceite). "Outro dia ou horário" abre o Novo agendamento já preenchido. Não aparece para atendimento de outro dia, cortesia, telefone inválido nem para quem já tem horário futuro. Se falhar qualquer coisa, volta o aviso antigo: o Concluir já foi gravado antes. A v29.193.0 já oferecia o retorno pelo WhatsApp, na resposta "satisfeito" da pesquisa, mas aí o cliente já foi embora; aqui é o Juliano quem pergunta, com o cliente sentado. Quem marcar aqui não recebe a oferta do WhatsApp nem o convite do dia 12 (os dois já pulam quem tem horário futuro).
  - A regra é a mesma de `_shared/dias-fracos.ts` + `convite-retorno.ts` (a JuIA), copiada em JS porque o painel não importa TS; `tests/unit/retorno-cadeira.spec.js` confere a **paridade** entre as duas cópias. Mudou uma, muda a outra.
  - A cadência é calculada no navegador com a mesma conta do `customer_visit_cadence_days` (que não é liberado para `authenticated`), a partir dos agendamentos que o painel já carrega. Sem migração.
- **Produto para casa à vista no Concluir.** A lista de produtos ficava dentro de "Mais opções", fechada no celular, no meio das bebidas. Agora, logo abaixo da forma de pagamento, aparecem até 3 produtos ligados ao serviço (campo `for` do `products-catalog-v1.js`, o mesmo do agendamento do site), do maior valor para o menor. Um toque marca a mesma caixinha da lista completa, então total, pagamento e baixa seguem o caminho de sempre. **Fora da sugestão de propósito:** o shampoo anticaspa, que é indicação dele ao ver o couro cabeludo, não oferta para todo corte (continua na lista completa).
- **Segurança (pendência da auditoria de 17/09):** `admin-booking-status`, `send-walkin-welcome`, `ju-ia-admin` e `send-push` aceitavam qualquer sessão válida sem conferir `is_admin()`. Agora conferem (403 para quem não é admin). O caminho do `x-webhook-secret` do `send-push`, usado por 9 functions, não mudou. Conferido que nenhum cron ou função do banco chama essas quatro sem o segredo. `verify_jwt` de cada uma igual ao anterior (conferido depois do deploy).

**Decidido contra a minha própria recomendação da manhã:** eu tinha proposto "horários livres hoje" em Status/story nas quartas e quintas e um "hoje ainda tem horário às X" na home. As duas coisas **violam a regra de nunca expor agenda vazia** (04/08, 06/08, 20/08; `SCARCITY_VIOLATION` no gerador). Não foram feitas. A frente dos dias fracos continua pelos caminhos que não anunciam vaga: retorno sugerido (JuIA e agora na cadeira), indicação só de terça a quinta, tema fixo da manhã de meio de semana.

**Pendência pedida pelo Juliano e já resolvida antes:** o prazo do sinal de química já sai escrito desde a v29.200.0 (`prepay-deadline`).

**Medir em ~4 semanas (17/10):** agendamentos com `notes = 'Retorno marcado na cadeira'` sobre atendimentos concluídos no mesmo dia; % de atendimentos com produto (linha de base 12,9%); atendimentos de quarta e quinta.

**Testes:** 184 unit + 52 e2e (novo: `tests/e2e/admin/admin-retorno-cadeira.spec.js`, que pegou o botão da sugestão marcada sem destaque visual por causa da transição de cor). Smoke das 4 functions: 401 sem sessão, nenhuma caiu.

## 29.209.0 — Presente de aniversário com regra, programa de indicação no ar, crivo sem travar e robôs de IA liberados (19/09)

**Decisões do Juliano no plano do dia:** "crivo das 8:05 eu te dou autonomia"; presente de aniversário "estruture de forma que fique profissional e nos proteja e também garanta que o cliente goze de seu benefício"; convite de retorno "12 dias é melhor, média de retorno 15d"; "sábado sempre lota, quarta e quinta são dias ruins"; indicação "estruture e coloque pra rodar"; Cloudflare "libera desde que não nos deixe vulneráveis"; pedido de avaliação "deixa como está".

- **Benefícios com fonte única** (migrações 168/169, tabela `customer_benefits`, regulamento público em `/beneficios.html`, textos em `_shared/beneficios.ts` com teste):
  - **Aniversário:** a mensagem prometia "um serviço extra por nossa conta" sem dizer qual nem até quando, e nada lembrava o Juliano. Agora é **sobrancelha por conta da casa junto com um serviço pago, até 30 dias depois do aniversário, 1 por ano**. A `customer-birthday` só anuncia o presente depois de registrá-lo (`grant_birthday_benefit`). Lembrete 7 dias antes de vencer, pulado se o cliente já tem horário marcado dentro do prazo.
  - **Indicação:** link pessoal `/agendar/?indicacao=JUxxxx` (guardado 30 dias no navegador, idempotente). `register_referral` confere código, autoindicação (telefone ou e-mail), quem já foi atendido e quem já foi indicado. Indicado: **R$ 10 no 1º atendimento, só terça a quinta** (os dias fracos). Quem indicou: **R$ 10 no próximo atendimento, só quando o indicado conclui e paga** (não vale cortesia), até 3 por mês. Convite enviado uma vez na vida a quem tem 2+ atendimentos, 2 a 6 dias depois do último (antes do convite de retorno do dia 12), até 10 por dia.
  - **Painel:** o cartão mostra o benefício disponível; o Concluir ganhou o botão "Aplicar", que preenche o desconto manual com o motivo que o gatilho `benefits_on_booking_completed` reconhece e dá a baixa sozinho. Indicado fora de terça a quinta: botão desativado com o motivo. No Balcão não há desconto, então o benefício só é aplicado pelo Concluir.
  - **Comprovante:** "Presente de aniversário" e "Desconto de indicação" saem com o nome; qualquer outro motivo de desconto continua anotação interna.
  - **JuIA:** sabe dos benefícios ativos do cliente (mesma regra de privacidade dos pontos) e só informa, nunca muda o valor do agendamento.
  - Rotina diária `benefits-dispatch` (cron `bdj-benefits-dispatch`, 10h05 terça a sábado, fora do silêncio): vence, avisa crédito de indicação, lembra aniversário, convida.
  - **Por que desconto em R$ na indicação e não serviço grátis:** é o que o Concluir já sabe aplicar e o comprovante já sabe mostrar (v29.162.0), sem mexer na fidelidade, que tem regra própria de ponto por serviço e baixa automática. Por que terça a quinta: a quarta está em 32% de ocupação e o sábado lota.
- **Crivo das 8h05 não trava mais:** travou hoje às 8h04 pedindo permissão para baixar a arte, e ninguém revisou nada. Os três formatos de download que ele usa foram liberados no `.claude/settings.json` (só leitura, só do Supabase Storage e do site), e a instrução da rotina agora manda usar exatamente esses formatos, e desistir do passo em vez de ficar parado.
- **Cloudflare, robôs de IA:** a política "Training" estava em Disallow, o que barrava GPTBot, ClaudeBot e (pelo robots.txt) o Google-Extended do Gemini. Virou Allow, e os coletores em massa foram bloqueados um a um (Bytespider, CCBot, Amazonbot, Meta-ExternalAgent). WAF, DDoS e Bot Fight não mudam; bot falso continua barrado pela verificação de assinatura do Cloudflare.
- Política de privacidade menciona o registro do código de indicação.

**Testes:** 175 unit + 51 e2e passando. Regras do banco testadas numa transação desfeita: indicação válida, autoindicação, indicado repetido, baixa no Concluir, crédito do indicador, presente 1 por ano e baixa com o "20% ·" na frente do motivo.

## 29.208.0 — Revisão geral com as skills novas: Central, anti-trote, gerador e textos do WhatsApp (19/09)

**Pedido do Juliano no plano do dia:** "dá pra fazer alguma melhoria em nossos sistemas? revisão geral" → "faz todas". Quatro análises em paralelo (voz do cliente nas avaliações, textos fixos do WhatsApp, retenção/indicação, busca por IA) + as falhas vistas no próprio dia.

- **"Publicar agora" pede confirmação quando o post é de outro dia** (`admin-conteudo-v28.js`). Duas peças do plano saíram antes da data: Instagram de 19/09 em 13/09 e Facebook de 22/09 em 15/09. O robô de publicação respeita `scheduled_for`; o atalho era o botão amarelo, que publicava direto.
- **Anti-trote (caso Luiz, 19/09 — agendou pelo site, número sem WhatsApp, e-mail estranho, não veio).** Migração 167: `bookings.whatsapp_unreachable_at` + `blocked_customers.customer_email`, e o guard de agendamento confere telefone **ou** e-mail (`is_customer_blocked_v2`). O `booking-email` marca o agendamento e manda push ao Juliano quando a confirmação volta com `exists:false` da Evolution (`_shared/numero-sem-whatsapp.ts`, com teste). Queda de servidor/timeout **não** marca — senão um dia de Evolution fora pintaria todo mundo de trote. Não bloqueia: existe cliente sem WhatsApp. O cartão da Agenda/Hoje mostra "Número sem WhatsApp: confira antes".
- **Gerador de conteúdo parou de pedir o que o crivo reprova.** O `BRAND_STYLE` mandava usar "parede de tijolo aparente" de fundo em toda arte, e o crivo manda reprovar tijolo — era a fórmula repetida. Saiu dos dois geradores (`content-generate-daily` e `content-generate-image`); a lista de proibidos ganhou texto gravado em superfície (hoje veio uma palavra inventada na bancada), brasão e tarja preta. O prompt do Status do WhatsApp dizia "pode usar 1 emoji no começo" — virou "sem nenhum emoji", e a legenda passa pelo `semEmoji`. "venha viver esse cuidado"/"entra em cena" entraram no filtro de clichê.
- **Voz do cliente no gerador.** As 108 avaliações do Google (75 com texto) viraram a lista `VOZ_CLIENTE`: atencioso (16), excelente profissional (12), agradável (9), educado (8), limpo (7), preço justo (7), "do jeito que eu pedi". E a lista do que nenhum cliente usa (premium, experiência única, transformação, "profissionais" no plural...).
- **Textos fixos do WhatsApp** (revisão com a skill de copywriting): `semEmoji` passa a tirar a tecla numerada (1️⃣ virava "1⃣") e o espaço no começo da linha (teste novo); a reativação deixou de dizer **"Aqui é a JuIA"** (o remetente é o Juliano e o cliente não sabe que é IA) e o "deve estar na hora de dar um trato, né?"; a fidelidade deixou de dizer "eu já aplico **sozinha**" e passou a explicar que no combo o prêmio cobre um serviço; a pesquisa de motivo do lead perdeu o 1️⃣/2️⃣ e o "o que rolou?".
- **`/llms.txt`** novo (resumo da casa para ChatGPT/Claude/Perplexity). **Sem preço** de propósito — seria mais um arquivo na virada de 01/10 — e **sem a garantia de ajuste** (regra de 06/09: marketing não oferece por conta própria).

**Erro meu, registrado:** de manhã reescrevi à mão o Status do WhatsApp com "volte em até 7 dias e a gente acerta, sem cobrar nada" — exatamente o que o Juliano proibiu em 06/09 e que o `GARANTIA_INSEGURA` do gerador barra. Segui a skill de copywriting (que recomenda garantia) sem conferir as travas da casa. O Status saiu às 8h20. A regra foi escrita no `.claude/product-marketing.md`, que é o que as skills leem.

**Ficou para decisão do Juliano (não é código):** presente de aniversário sem regra (qual serviço, até quando); pedido de avaliação só para quem respondeu "satisfeito" (o Google proíbe filtrar); convite de retorno sai no dia 12 do corte, e a memória diz 30 dias; bloqueio de GPTBot/ClaudeBot no Cloudflare; programa de indicação. Liberação das permissões do crivo das 8h05 (travou hoje) — o modo automático não deixa eu mesmo mudar.

**Testes:** 168 unit + 51 e2e (1 falha de infraestrutura em `/agendar/horario/` — navegador fechou em 5 ms —, passou na repetição).

## 29.207.0 — Aviso de chegada sai antes das 8h quando o horário é das 8h (19/09)

**Pedido do Juliano no plano do dia:** o Luiz estava marcado às 8h00 de hoje e não recebeu a rota do Maps; deveria ter recebido às 7h30.

- **Causa:** na 29.206.0 o cron `bdj-arrival-route` só rodava fora do silêncio da JuIA (`juia_quiet_now()`, que começa às 8h). Eu tinha registrado isso como "consequência aceita"; o Juliano não aceitou, e com razão: o horário foi o próprio cliente quem escolheu.
- **Correção:** o aviso de chegada deixa de obedecer ao `juia_quiet_now()`. Cron passa a rodar das 7h às 19h59 (Brasília) — migração 166 —, e a function tem a mesma guarda (`horaPermitida` em `_shared/aviso-chegada.ts`, piso 7h, teto 20h, com teste).
- **Exceção estreita, igual à do comprovante:** só este aviso, só dentro da janela de 25-35 min antes do próprio agendamento, nunca de madrugada. Lembrete de 24h, aniversário, reativação e marketing continuam presos ao silêncio das 8h.
- Efeito colateral consciente: domingo/feriado deixam de bloquear este aviso. Só sai se houver agendamento no dia — e aí o cliente precisa da rota do mesmo jeito.

## 29.206.1 — Produtos de volta no "Concluir" pela tela Hoje (18/09)

**Relato do Juliano, com cliente na cadeira:** "to concluindo um serviço, sumiu a parte que eu incluía produtos, preciso incluir Monster na comanda".

- **Causa:** a tela **Hoje** () nunca carregou o catálogo de produtos (); a Agenda carrega. O modal de Concluir é o mesmo nas duas, mas pelo Hoje a lista de "Produtos vendidos" (em "Mais opções") saía **vazia**. Não foi regressão desta semana — a linha nunca existiu no  desde a reforma de 11/09 —, só apareceu agora porque o Juliano concluiu pelo Hoje e precisava de produto.
- **Correção:** o  passa a carregar o catálogo, como a Agenda. Reproduzido antes (Hoje: 0 produtos; Agenda: 26) e conferido depois (Hoje: 26), no mock do painel.
- Versão do painel sobe junto (, , ): o painel aberto no celular recarrega sozinho assim que ninguém estiver digitando.
- Numerada 29.206.1 porque outra sessão publicou a 29.206.0 (aviso de chegada com rota) enquanto isto era corrigido.

**Testes:** 160 unit + 51 e2e passando.

## 29.206.0 — Aviso de chegada com a rota do Google Maps, 30 min antes (18/09)

**Dica do cliente Rafael**, repassada pelo Juliano no plano do dia: meia hora antes do horário, o cliente recebe no WhatsApp o link da barbearia no Google Maps.

- Function nova `whatsapp-arrival-route`, cron `bdj-arrival-route` de 5 em 5 min (migração 165). Envia entre 25 e 35 min antes do início; `bookings.arrival_route_sent_at` garante um aviso só por agendamento (reservado antes de enviar; se a Evolution falhar, a marca é liberada e a rodada seguinte, ainda na janela, tenta de novo).
- Texto e janela com fonte única em `supabase/functions/_shared/aviso-chegada.ts`, teste em `tests/unit/aviso-chegada.spec.js` (inclui a prova de que o cron de 5 min acerta a janela em qualquer minuto de horário). Sem emoji (passa pelo `semEmoji` na saída) e **sem pergunta**, então não disputa a fila de perguntas numeradas da JuIA.
- Link: `maps.app.goo.gl/VJAfv4MJpd84tmDY7`, o mesmo do `hasMap` da home — abre a ficha "Barbearia do Ju" com o botão de rota, não uma busca por endereço. Junto vai o endereço e a Zona Azul.

**Decidido contra o óbvio:**
- **Horário das 8h00 não recebe o aviso.** Seria às 7h30, dentro do silêncio da JuIA. A exceção ao silêncio é só do comprovante e deve continuar estreita; o endereço já está na confirmação do agendamento.
- **Quem marcou há menos de 30 min não recebe** (acabou de ver o endereço na confirmação; o encaixe de última hora não precisa de duas mensagens seguidas).
- **Vai para todos, inclusive quem já é cliente.** É uma mensagem por visita e é a pedida; se os fixos reclamarem de repetição (caso Carlos, 04/08), o corte natural é mandar só pra quem tem até 2 visitas.

Deploy com `--no-verify-jwt` (autenticação pelo `x-webhook-secret`, como as outras do WhatsApp). Smoke test logo após: sem segredo = 401; com segredo = 200, leu os 3 agendamentos do dia, nenhum na janela, nada enviado. Só depois disso o cron foi ligado.

## 29.205.7 — Quinta revisão cega: painel sem internet, agendamento e site (18/09)

**Placar da 5ª rodada** (revisores novos, cegos; o do agendamento andou em produção até a revisão, sem confirmar nada):

| Parte | 4ª rodada | 5ª rodada |
|---|---|---|
| Site | 32/40 | **33/40** |
| Painel | 28/40 | **31/40** |
| Agendamento do cliente | 26/40 | **31/40** |
| App do painel | 6,5/10 | **7,5/10** |
| App do site | 7/10 | **8/10** |

Esta versão fecha o que a 5ª rodada apontou e é código.

### App do painel: leitura sem internet (o P1 da rodada)
- Antes, se a internet caía no meio do atendimento, **até a agenda já aberta** virava a página "sem conexão" — nenhuma tela do painel ficava guardada.
- Agora (`sw.js`): cada tela do painel aberta com internet fica guardada no aparelho; as consultas de LEITURA ao Supabase feitas pelas telas do painel (só GET em `/rest/v1/`) vão pra rede primeiro e guardam a última resposta, num cache com nome fixo que sobrevive às trocas de versão; a biblioteca do Supabase (versão fixa + SRI) também fica guardada. Nada que grava passa por esse caminho.
- Aviso no topo: "Sem internet: mostrando os dados da última vez que o painel carregou. Nada pode ser salvo agora". **`navigator.onLine` não serve** (Wi-Fi conectado sem internet diz "online", e o teste mostrou que ele nem muda): a prova é buscar `admin-version.json` ao abrir e a cada 30 s.
- Conferido com o service worker ligado: abriu a Agenda com internet, cortou a rede, recarregou — abriu a Agenda (não a página offline) com o aviso; tela nunca aberta cai no "O painel está sem internet". Com internet, sem aviso.

### Agendamento do cliente
- **"Último horário depois do fechamento" não era defeito:** o horário pode começar no fechamento e terminar depois (regra da v29.167.0, migração 149). O texto "das 8h às 19h" fazia parecer contradição; ganhou a linha "O último horário pode começar no fechamento: o atendimento termina logo depois".
- **Dias lotados marcados na faixa** ("lotado", riscado), por consulta leve em segundo plano — antes pareciam iguais aos outros.
- **"Terça-Feira, 22 De Setembro" ainda aparecia:** a correção da 29.205.4 foi no texto, mas um `text-transform: capitalize` no CSS recapitalizava cada palavra. Agora só a primeira letra (`::first-letter`). Erro meu: dei como corrigido sem olhar a tela da revisão.
- Barra de ações das etapas no celular com "Voltar" e "Continuar" lado a lado (empilhados, ocupavam ~17% da tela — ficaram visíveis depois que o `position: sticky` voltou a funcionar na 29.205.1).
- `/agendar/horario/?servico=x` sempre leva ao catálogo com o serviço (antes, com pedido já montado, o parâmetro era ignorado em silêncio). Nome de uma letra ganhou aviso próprio. Área do cliente, Meu agendamento e Reagendar com o mesmo cabeçalho; Reagendar sem link com título coerente ("Reagendar horário") e link de volta.

### Site
- **Foto do ozônio no topo da Barboterapia estava borrada** (quadro de vídeo ampliado) e mostrava tomada e cabo. No topo da Barboterapia entrou a foto nítida da cadeira; o ozônio fica só na galeria da home (miniatura), num recorte novo sem a tomada.
- Retrato do Sobre no celular: versão recortada sem a faixa decorativa do banner, ancorada no topo. Foto do corte (`juliano-corte`) mostrando o rosto, não o avental.
- Durações que faltavam na lista de preços (Pigmentação de sobrancelha 30 min, Aparação corporal 70 min, Luzes 100 min — valores do catálogo do painel); breadcrumb em /servicos; "Ver catálogo" saiu do topo do próprio catálogo; 🔥 do selo "Mais vendido" saiu.
- **Prova social nas 25 páginas de serviço**, ao lado do primeiro "Agendar": "★★★★★ Nota 5,0 no Google · mais de 100 avaliações", com link pras avaliações.

### Painel
Nome curto da tela atual na barra do celular ("Finanças", "Números", "Pontos"…, antes "Financ…"); um nome só pro atendimento sem hora ("🚶 Balcão (sem hora)" no Hoje); cabeçalho do Hoje no celular mais baixo (Anterior / Seguinte / Atualizar numa linha); subtítulo de Relatórios citando "dia".

### Decidido NÃO fazer
- Encurtar as perguntas frequentes da home (revisor do site): o bloco tem schema `FAQPage` — cortar pergunta visível exige mexer no schema e perde conteúdo que o Google usa.
- Capturas de tela no manifesto: mostrariam preços, que mudam em 01/10.

**Conferido:** régua 0 pendências (site e painel); fluxo clicado até a revisão em 390 com as funções que gravam bloqueadas; 153 unit + 51 e2e passando.

## 29.205.6 — Ícone novo dos apps: monograma JU (18/09)

**Pedido do Juliano:** "cria pra mim o ícone". Três opções mostradas (pergaminho creme; placa creme sobre preto; preto com anel de poste); ele escolheu a **opção C, "porém o bigode embaixo do JU, não em cima"**.

- **O que era:** o logo largo (faixa + postes) espremido num quadrado — ilegível na tela do celular (as duas revisões cegas de app apontaram).
- **O que é:** fundo preto do site, anel listrado vermelho/branco/azul de poste de barbeiro, "JU" em Bebas Neue dourado (o mesmo dourado do site) e o bigode da marca embaixo. Todo o conteúdo fica dentro da zona segura do ícone recortável do Android (raio 193 de 205), então nada é cortado no círculo.
- Gerado pelo Chrome a partir de SVG (com checagem de que a fonte carregou antes de fotografar) em 192, 512, recortável 192/512 e 180 (iPhone). Mesmos nomes de arquivo, então também vira o logo pequeno da barra lateral do painel, da Área do cliente e da página offline (conferido por print: legível).
- Cache: `?v=2` nos ícones dos dois manifestos, no ícone do iPhone e no favicon; manifestos com versão nova; service worker novo. **Quem já instalou o app:** no Android o ícone troca sozinho em alguns dias (o Chrome relê o manifesto); **no iPhone o ícone só muda removendo o app da tela inicial e adicionando de novo** (o iOS não atualiza ícone de app já instalado).

### Correção de registro
Na 29.205.4 escrevi que o ícone do iPhone em `/agendar/` "apontava pra um arquivo inexistente". **Estava errado:** essas páginas têm `<base href="/">`, e o caminho relativo funcionava. A padronização (caminho absoluto, 180px) continua valendo, mas o motivo que registrei não era real.

**Conferido:** 153 unit + 51 e2e passando.

## 29.205.5 — Fotos reais no lugar de imagem com IA e placa errada; foto certa do condicionador (18/09)

**Pedido do Juliano:** "pode baixar" (foto do condicionador no site do fabricante) e "veja na nossa biblioteca se você acha alguma coisa que dê pra aproveitar".

- **Condicionador para Barba mostrava o frasco do shampoo.** Foto oficial baixada do site da Shark Barber (sharkbarber.com.br, página do produto, com autorização do Juliano), conferida (rótulo "Condicionador para Barba 240 ml"), convertida pra WebP 600×600 como as outras. Arquivo novo `condicionador-barba-v2.webp` pra não ficar preso em cache; trocado nas 4 páginas.
- **Duas imagens do site tinham problema e saíram de TODAS as páginas (22 topos + galeria da home):**
  - `ambiente-corte` — tem a marca ✦ do Gemini no canto (foi tratada por IA).
  - `montagem-ambiente` — cartaz com ✦ **e com a placa física de horário à vista, com o horário errado** (8h30–18h / 8h30–14h). O CLAUDE.md proíbe mostrar essa placa sem retoque. Estava no topo de 8 páginas de química e produtos.
- **O que entrou, tudo real da biblioteca, conferido quadro a quadro:**
  - Barboterapia (página e artigo): quadro do vídeo do ozônio de 22/08 — o vaporizador soltando vapor sobre a toalha, rosto do cliente coberto.
  - Degradê, pezinho, artigo de fade: o low fade real (sem rosto). Corte social: o clássico real. Artigo de tendências: o mullet real.
  - Barba na navalha, combos, depilações, aparação, química, produtos: as fotos do salão vazio feitas pro Google em 16/09 (já passaram pelo crivo: sem cliente, sem placa).
  - Textos alternativos descrevem o que está na foto.
- **O que NÃO foi usado, de propósito:** a pasta `assets/fundos/` (toalha e navalha, frascos, tesoura) e o vídeo da toalha quente de 18/09 são **gerados por IA** — servem pra peça de marca, não como foto de serviço. A "simulação antes e depois" também é IA.
- **Erro meu da 29.205.4, pego no print:** o botão "Agendar este serviço" logo após a introdução herdava a cor de link do cartão — texto dourado sobre botão dourado, quase invisível. A régua não pegou porque pula fundos em gradiente. Corrigido nas 25 páginas (texto escuro, igual aos outros botões).
- Ferramenta: todas as imagens geradas pelo próprio Chrome (quadro de vídeo → canvas → WebP/JPG), recorte 4:3 sem distorção, 800px + tamanho cheio.

**Ainda sem foto real:** barba (Express/navalha), sobrancelha, pigmentação, raspar a cabeça. Precisa de foto do atendimento, sem rosto de cliente.

**Conferido:** nenhuma imagem quebrada nas páginas trocadas; régua 0 pendências; 153 unit + 51 e2e passando.

## 29.205.4 — Quarta revisão cega: agendamento do cliente, app do celular, site e painel (18/09)

**Pedido do Juliano:** "e agora como ficamos site, admin, app, parte que os clientes fazem seus agendamentos? tudo 10 de 10?" — e depois "arruma tudo pra ficar 10 de 10".

Pela primeira vez o **fluxo de agendamento do cliente** e os **dois apps (PWA)** foram avaliados separadamente. Três revisores cegos, em paralelo. O revisor do agendamento andou pelo fluxo em PRODUÇÃO até a revisão, **sem confirmar nada** (e com as funções que gravam bloqueadas por segurança).

| Parte | Nota da revisão |
|---|---|
| Site | 32/40 |
| Painel | 28/40 · app do painel 6,5/10 |
| Agendamento do cliente | **26/40** · app do site 7/10 |

### Agendamento do cliente — três falhas que ninguém tinha visto

- **"Ir direto à agenda" perdia o pedido.** O cliente escolhia "Corte de cabelo", tocava em "Ir direto à agenda" e caía em "Nenhum serviço selecionado". Só o botão "Continuar" do pedido gravava os serviços. Primeira tentativa de correção (interceptar o clique) **não funcionou**: outro script da página interrompe o clique antes do listener do carrinho — o teste pegou. Solução final, mais robusta: o pedido fica **sempre** gravado no formato que `/agendar/horario/` lê, a cada mudança; qualquer caminho até lá leva os serviços. Conferido clicando.
- **Etapa "Seus dados" sem explicação.** "Revisar agendamento" ficava apagado sem dizer o que faltava. Agora o botão fica ativo e, ao tocar, cada campo com problema mostra o motivo embaixo ("Digite seu nome.", "Número incompleto: são 11 dígitos com o DDD…", "E-mail incompleto…"), com borda vermelha e foco no primeiro. O valor do campo de telefone continua como a pessoa digitou (o GTM lê `#agenda-phone` na conversão — CLAUDE.md, seção 5); a formatação "(11) 90000-0000" é só na tela de revisão.
- **Reagendar sem link mostrava "Edge Function returned a non-2xx status code"**, e ao mesmo tempo a tela do fluxo ("Agendamento cancelado", etapas, botão ativo) — de novo `display` vencendo o atributo `hidden`. Agora: mensagem humana ("Este endereço só funciona pelo link que enviamos no seu WhatsApp…"), botões "Agendar um novo horário" e "Falar pelo WhatsApp", e erro técnico nunca chega ao cliente. "Meu agendamento" sem link também ganhou saídas (Área do cliente, Agendar, WhatsApp).
- **Faixa com os próximos 7 dias abertos** na etapa de horário (antes só o calendário nativo; ver outro dia exigia abrir o seletor). Acompanha a data real — o carregamento pode pular pro próximo dia com horário, e a faixa marca o dia certo (o primeiro teste mostrou "Sex 18" marcado com os horários de sábado; corrigido).
- Nomes das etapas também no celular (antes só 1-2-3-4); pedido com hierarquia (Continuar cheio e primeiro, os outros em contorno); "Sábado, 19 De Setembro" → "de"; link feito à mão `/agendar/horario/?servico=x` cai no catálogo com o serviço; emojis de enfeite fora; Área do cliente e Meu agendamento com a fonte do site e campo escuro (o campo de WhatsApp era branco).

### Apps (PWA)

- **iPhone: faltava `viewport-fit=cover` nas 18 telas do painel.** Com barra de status `black-translucent`, sem isso o `env(safe-area-inset-*)` vale 0 e as compensações de entalhe e barra inferior do app instalado não funcionam. **Precisa de conferência no iPhone do Juliano** (não há como emular o modo instalado do iOS aqui).
- **Sem internet, o app do painel mostrava a página do cliente** ("ligue pra barbearia") pro próprio barbeiro. Em `/admin*` a página offline agora diz que o painel está sem conexão e volta sozinho.
- A recarga por versão nova também espera formulário **preenchido e não salvo** (Balcão / Novo agendamento com o foco fora do campo), não só modal aberto ou campo focado.
- Um nome só: "Barbearia OS" (era "Barbearia Admin" no iOS). Na barra inferior, fora dos 5 atalhos, o último botão mostra o nome da tela atual em vez de "Mais".
- Site: ícone do iPhone de 180px com caminho absoluto em 57 páginas — **em `/agendar/` e `/agendar/horario/` o caminho relativo apontava pra um arquivo inexistente**; meta tags de app no iOS; `reagendar.html` sem manifesto.

### Site

- Navegação igual em todas as páginas: breadcrumb no blog, produtos e Sobre (antes "← Voltar ao site", "Voltar aos serviços / Ir para o início", ou nada).
- **Botão "Agendar este serviço" logo após a introdução** nas 25 páginas de serviço (o primeiro dentro do texto vinha depois de ~2.000px), com o mesmo link de serviço pré-selecionado.
- Celular: o "voltar ao topo" saiu (cobria os controles do vídeo); película mais escura no hero (a placa de horário da foto aparecia através do texto); título de cartão com "em Bragança Paulista" quebrando em 2 linhas.

### Painel

Campo com erro com borda vermelha também no Balcão; busca e lista primeiro em Clientes também no computador; grade de 3 indicadores sem cartão órfão no celular; fim da página nunca embaixo da barra inferior; indicadores repetidos no Hoje (celular) escondidos; "2.0" → "2,0"; nome antes do "Faltam 3" na Fidelidade; despesas fora do dourado da receita.

### Pendências que não são código

- **Foto do Condicionador para Barba é a do Shampoo** (`assets/produtos/condicionador-barba.webp` tem "SHAMPOO PARA BARBA" no rótulo). Precisa da foto certa — do Juliano, ou baixada do fabricante com autorização.
- Fotos por serviço (barba, sobrancelha…), ícone do app legível em tela inicial (hoje é o logo largo espremido) — dependem de imagem real.
- Agenda do dia disponível sem internet (leitura) no app do painel: recurso novo, não correção.

**Conferido:** régua 0 pendências (site e painel, 1440/390/320); fluxo clicado do catálogo até a revisão em 390 e 1440 com as funções que gravam bloqueadas; 153 unit + 51 e2e passando.

## 29.205.3 — Terceira revisão cega: site 31/40, painel 31/40, e o que eles ainda viram (18/09)

**Placar das revisões cegas até aqui** (revisores novos a cada rodada, prints reais, heurísticas de Nielsen 0-4):

| Rodada | Site | Painel |
|---|---|---|
| 1ª (antes da 29.205.1) | 30 | 28 |
| 2ª (29.205.1, revisores mais rigorosos) | 26 | 27 |
| 3ª (29.205.2) | **31** | **31** |

Esta versão fecha o que a 3ª rodada apontou e é código.

### Site

- **"Ver meu pedido" cobria o "✓ Adicionado" que o cliente acabou de tocar** (celular) e o meio das linhas (desktop). Era uma pílula flutuando no meio da lista; virou barra de largura total colada na borda, com espaço reservado no fim da página, e depois de "Adicionar" a página sobe o suficiente pra o botão tocado continuar à vista (medido: o botão fica acima da barra em 1440 e 390).
- **Menu no celular.** A barra de baixo não tinha como chegar ao início, aos preços ou às dúvidas. "Menu" abre a lista (Início, Serviços e preços, Dúvidas, Blog, WhatsApp) — `<details>`, funciona sem JavaScript. No desktop entrou "Blog".
- **Home de 18 para 16 blocos, na ordem de quem está decidindo:** os serviços subiram pra logo depois do "Olá, eu sou Juliano"; o "Tudo em um só lugar" (Minha área, Já estou na barbearia, Salvar contato — coisa de quem já é cliente) desceu pra perto do contato; "Serviços e produtos" (repetia "Conheça cada serviço") saiu; as avaliações apareciam 3 vezes — o bloco "O que nossos clientes dizem" foi fundido com a grade de avaliações. A faixa do topo trocou "Avaliar no Google" (pedir avaliação a quem nunca veio) por "Ler avaliações". Nenhum texto único perdido: conferido que os blocos removidos não levavam conteúdo fora da `<section>`, JSON-LD válido, e o link pra produtos continua no "Tudo em um só lugar".
- **/agendar/:** o topo ficou com "Ir direto à agenda" e o link da JuIA. "Ver serviços" apontava pra própria página; "Ver produtos" tirava a pessoa do fluxo de agendamento (o produto já é oferecido na etapa do horário). O WhatsApp flutuante verde-vivo ganhou o visual do site e some quando a barra do pedido aparece.
- Barba Express: o texto de abertura agora diz "feita só na máquina" (regra do CLAUDE.md: toda oferta de barba sai com esse resumo; estava só no FAQ e na meta description).
- Perguntas frequentes das páginas de conteúdo com "+" (antes, triângulo padrão do navegador); "Publicado em 16 de agosto • Revisado em 16 de agosto" virou uma data só quando são iguais; ícones próprios no "Tudo em um só lugar" (a sacola e a pessoa se repetiam em 6 cartões).

### Painel

- **Calendário no computador:** a contagem ainda cobria o número (a célula quadrada tinha ~45px). Mesma solução do celular.
- **Clientes no celular:** "Próximos aniversários" estava espremido em 1/3 da largura; agora linha inteira.
- **Hoje no celular:** os 4 números principais voltaram pro topo numa faixa compacta (a revisão anterior pediu a linha do dia primeiro; esta reclamou dos números lá no fim — a faixa atende as duas: números no topo, linha do dia ainda na primeira tela). Em tela ≤360px, 2×2 (a régua pegou "Concluídos" vazando em 320px).
- **Balcão:** o aviso de campo faltando aparece embaixo do próprio campo (e não se repete na barra); anel de foco vermelho no campo com erro.
- **Mesma ordem de recorte em todo o painel:** Dia / Semana / Mês (Relatórios estava Mês / Semana / Dia, o contrário do Financeiro).
- Fidelidade mostrava o telefone cru ("5511987654321") — agora "(11) 98765-4321" como no CRM; busca com largura de busca no desktop.
- Barra de salvar mais baixa no celular e no tom do cartão; formulário de despesa do Financeiro alinhado e com campos do tamanho do resto do painel; placeholders que cortavam no celular encurtados; "Linha do dia" sem 500px vazios embaixo; "Sem hora marcada" com destaque sobre "Dia anterior/seguinte".

### Não feito

- Fotos por serviço (mesma pendência da 29.205.2 — precisa de foto real).
- Imagem/data nos cartões do blog: exigiria foto por artigo.
- Menu fechar ao tocar fora: o `<details>` fecha tocando em "Menu" de novo; não justificou JavaScript novo em 52 páginas.

**Conferido:** régua 0 pendências (site e painel, 1440/390/320); 153 unit + 51 e2e passando.

## 29.205.2 — Segunda revisão cega: uma afirmação de preço falsa e o que ainda atrapalhava (18/09)

**Contexto:** depois da 29.205.1, duas revisões cegas NOVAS (outros revisores, mais rigorosos, mesmo método: heurísticas de Nielsen, 0-4 cada, prints de produção no site e do painel com o mock). Notas: **site 26/40, painel 27/40**. Não é regressão — os revisores anteriores davam 30 e 28 para uma versão pior; estes acharam coisas que os outros não viram. O que segue fecha o que eles acharam e que é código.

### Site

- **Afirmação de preço FALSA em 4 páginas.** "O combo Corte + Barba Express (R$ 65,00) sai mais econômico que os dois separados" — Corte R$ 40 + Barba Express R$ 25 = R$ 65. O mesmo em Corte + Barba na navalha (R$ 80 = 40 + 40), inclusive no JSON-LD de perguntas frequentes (o que o Google lê). Todo combo custa exatamente a soma. A vantagem real, que agora está escrita: **um horário só e 15 minutos a menos de cadeira** (60 min em vez de 75; 70 em vez de 85). Conferido: a JuIA e os scripts não repetem a afirmação.
- **O popup de boas-vindas saiu.** Aparecia depois da rolagem cobrindo ~40% da tela do celular em cima do texto do Juliano, com texto genérico e um "Agendar agora" que repete a barra fixa. O evento `popup_boas_vindas_exibido` do GA4 deixa de existir; o teste e2e do popup virou teste de "rolou, o agendar vem da barra, sem camada por cima".
- **/agendar/:** o botão flutuante da JuIA cobria o "Adicionar" do serviço "Mais procurado" no desktop. A JuIA virou um link no topo ("Em dúvida sobre qual serviço? Pergunte à JuIA") e o flutuante some onde a página tem botão próprio. No celular, "Ver serviços" (a própria página) e o aviso "Agenda própria" saem; o primeiro serviço sobe pra primeira tela. "Ver meu carrinho" → "Ver meu pedido" (é atendimento, não compra).
- **/produtos.html:** o "← Voltar aos serviços" flutuante cobria cartões de produto; a barra fixa já leva pro agendar.
- **A barra ganhou menu no desktop:** "Serviços e preços" e "Dúvidas" (antes só se achavam pelo rodapé ou voltando à home).
- **Rodapé das 49 páginas de conteúdo:** tinha marca, slogan e 3 links. Agora endereço (link pro Maps), horário real (terça a sexta 8h-19h, sábado 8h-15h, igual ao schema), WhatsApp e 6 links com alvo de 44px.
- **Textos alternativos que descreviam o que a foto não mostra:** a mesma foto de corte aparecia como "Barba Express sendo feita", "Pigmentação de barba sendo aplicada", "Acabamento de sobrancelha"… (9 páginas). Agora descrevem o que está na foto.
- Blog: 5 cartões com "1." a "5." no título, sem série nenhuma — saiu a numeração.

### Painel

- **Relatórios:** no celular, "‹" e "›" eram duas pílulas largas e vazias, uma acima e outra abaixo do mês; agora ‹ Mês › numa linha (mesma regra pra Financeiro e Espera). No desktop, 8 indicadores em 7 colunas quebravam "R$ 175,/00" no meio — agora 4+4, sem quebra de número. "Setembro De 2026" → "Setembro de 2026" (era `text-transform:capitalize` no CSS da página).
- **Balcão no computador:** o botão Registrar ficava no fim de ~4.400px e o aviso de campo faltando aparecia fora da tela. A barra de salvar agora gruda embaixo também no desktop.
- **Calendário:** a contagem cobria o número do dia no celular (célula mais alta, contagem menor) e a legenda passou a explicar tudo (atendimentos, não atende, bloqueado, bloqueio parcial).
- **Hoje no computador:** título em cima e ações numa linha só (antes 5 botões num bloco torto quebravam o título em duas linhas); indicadores ocupam a largura.
- **Novo agendamento** abria com 08:00 preenchido às 11h30 (horário já passado). Agora vem vazio e o salvar pede o horário.
- Espera: as 4 abas passavam da tela no celular ("Cancela…"); 2×2. Fidelidade: a busca espremia o título em 3 linhas. Clientes: os 3 contadores de aniversário (0, 0, 0) viraram uma linha compacta no celular.

### O que NÃO foi feito, e por quê

- **Fotos:** a mesma foto de corte aparece em ~20 páginas de serviço, inclusive barba e sobrancelha. Não existe foto de barba no repositório e **nunca geramos o Juliano com IA** — precisa de foto real (dá pra tirar no próprio atendimento, sem rosto de cliente). Observação: `assets/ambiente-corte*` tem a marca ✦ do Gemini no canto inferior direito.
- **Texto do hero da home** (preço + garantia na primeira dobra): decisão de SEO/conversão registrada neste CHANGELOG; mantido.
- **Bebas nos títulos de home, /agendar/, produtos e blog; Inter nas páginas de leitura:** é o sistema (letreiro na vitrine, texto no conteúdo), não inconsistência.
- **Busca de serviços no Balcão** (P1 do revisor do painel): mudança de fluxo que merece conversa com o Juliano antes — hoje ele marca por categoria.

### Conferido

Régua: **0 pendências** no site e no painel (1440/390/320). 153 unit + 51 e2e passando. Um e2e (`routes.spec` › `/agendar/horario/` direto) falhou em 3 execuções completas com `browser.newContext: Target … closed` — o navegador do teste caindo ao abrir contexto, não asserção; passa sozinho, passa o arquivo inteiro e passou na 4ª execução completa. Registrado como instável; se voltar, investigar memória do Chromium no fim da suíte.

## 29.205.1 — Revisão cega depois da 29.205.0: o que a régua não mede (18/09)

**Por que existe esta versão:** depois de publicar a 29.205.0, pedi duas revisões **às cegas** (sem contar o que eu tinha feito), uma do site e uma do painel, olhando as telas como cliente e como o Juliano no meio do atendimento. Notas: **site 30/40, painel 28/40**. A régua mecânica estava zerada; o que sobrou era de fluxo e hierarquia, que régua nenhuma pega. Esta versão fecha o que elas apontaram.

### Painel

- **O botão Salvar não grudava em lugar nenhum.** Causa: `overflow-x:hidden` no `html` e no `body` transforma o `body` em contêiner de rolagem e desliga **todo** `position:sticky` do site e do painel. Trocado por `overflow-x:clip` (corta igual, sem criar contêiner; navegador antigo fica no `hidden`). Com isso, no celular, "Registrar atendimento" (Balcão) e "Criar agendamento" ficam sempre à mão acima da barra inferior — antes ficavam 5.000px abaixo do começo do formulário.
- **Balcão: erro de validação não levava a lugar nenhum.** "Informe o nome do cliente." aparecia em cinza ao lado do botão, longe do campo. Agora o aviso sai em vermelho junto do botão, a tela rola até o campo que falta, foca e marca (`aria-invalid`); a marca some quando o campo é preenchido.
- **Balcão: pagamento, caixinha, "Como foi feito", fidelidade e nº da visita** eram controles cinza-claro do sistema, 21px de altura, no meio do formulário escuro. Base de campo do painel com especificidade **zero** (`:where`) — nenhuma regra existente muda.
- **Hoje, no celular:** a linha do dia vem antes dos indicadores (é o que se olha entre um cliente e outro), e os cartões **Cadeira (câmera)** e **Alarme** somem quando não há dado, em vez de ocupar a primeira tela com "–". O atributo `hidden` perdia pro `display:grid` do cartão; corrigido.
- **Financeiro:** lucro e resultado negativos em vermelho (antes em dourado, igual à receita).
- **Calendário:** "Setembro De 2026" → "Setembro de 2026"; número no canto, marca embaixo à esquerda, contagem embaixo à direita e maior.
- **Clientes:** busca primeiro no celular, ocupando a largura toda; o título interno "V27.1 • Experiência automática ativa" virou "Pesquisa de satisfação automática".
- Menu lateral com rolagem (os últimos itens ficavam fora da tela), setas de período com 44px, `color-scheme: dark` (calendário e seletores nativos escuros), linhas de checkbox em grade (o texto quebrava em duas colunas estreitas).

### Site

- **Botão de agendar persistente em todas as 52 páginas públicas** (`.page-bar`). Fora da home, "Agendar" só existia no fim do texto. Desktop: faixa fixa no topo com a marca, WhatsApp, JuIA e Agendar. Celular: barra embaixo, na zona do polegar. Nas páginas de serviço o botão já leva o serviço pré-selecionado (`?servico=`, o mesmo link do fim da página). Na home do celular a barra só entra quando os botões do hero saem da tela — senão seriam dois "Agendar horário" empilhados.
- **A JuIA deixou de cobrir o conteúdo:** a aba lateral fixa no celular (em cima de texto e do "Adicionar") e o botão flutuante no desktop viraram o botão "JuIA" da barra. O WhatsApp flutuante também.
- A home tinha **duas barras fixas** no celular (a dourada e a de WhatsApp/Rota); ficou uma.
- **"Adicionar" em /agendar/** fica marcado "✓ Adicionado" enquanto o serviço está no pedido (antes voltava a "Adicionar" em 0,8s e não sobrava sinal). O carrinho fechado fica `inert` (os botões dele seguiam no Tab).
- Hero da home em notebook 1366×768: logo e título dimensionados pela altura da tela; os dois botões voltaram pra primeira dobra.
- Home: "Conforto" e "Ajuste sem custo" apareciam duas vezes (no bloco de visita e em "Informações rápidas") — ficou uma de cada; o último ícone-emoji de cartão saiu.
- /agendar/ no celular: o "← Voltar ao site" fixo no rodapé saiu (repetia o link do topo e disputava o polegar com o carrinho).
- "Separemos para você" → "Separamos para você" (/agendar/horario/).

### Conferido antes de publicar

- Régua: **0 pendências** no site (10 critérios) e no painel (11), em 1440/390/320. Pegou um erro meu desta versão: o parágrafo da Área do Cliente que eu alonguei na 29.205.0 passava de 80 caracteres por linha — corrigido.
- Fluxos clicados no navegador com o mock do painel: erro do Balcão foca o campo certo; JuIA abre pela barra no desktop e no celular; "Adicionar" marca e o carrinho fecha inerte; barra fixa depois de rolar; zero rolagem lateral.
- `clique_agendamento` continua medindo: a barra é link pra `/agendar/`, e o evento registra `posicao_cta: barra-agendar`.

**Cache:** 29.205.1 em `style.css` (82), `@import` e preloads de 01-05, css/06 (17), `juia-chat.js` (55), `script.js`, `service-cart-v22-5.js`, scripts do painel tocados, service worker; **`ADMIN_VERSION`, `admin-version.json` e o `?v=` do `admin-v15-4-core.js` juntos.**

**Testes:** 153 unit + 51 e2e passando.

## 29.205.0 — Nota máxima: site, painel e app no celular, com régua medida antes e depois (18/09)

**Pedido do Juliano (17-18/09/2026):** "faz o que precisar pra tudo ficar com nota máxima", incluindo o app no celular. Confirmou os três nomes da lista de preços.

**Como foi medido (e por que isso importa):** montei uma régua própria que roda LOCAL, antes de publicar, nas 14 páginas públicas e nas 17 telas do painel (o painel com o mock do Supabase: dados fictícios, sem login, sem tocar no banco), em 1440px, 390px e 320px. Ela mede contraste AA com a cor realmente pintada, texto < 12px, anel de foco, foco de checkbox customizado, alvo de toque < 44px, linha > 80 caracteres, rolagem lateral, campo < 16px (zoom do iPhone), controle escondido por corte, texto vazando da caixa e fonte de letreiro na interface. **A régua errou várias vezes e foi corrigida antes de eu acreditar nela** (ver "Os erros", abaixo) — a lição da 29.204.0 (o detector do impeccable mente) valeu pra minha própria ferramenta também.

| | Antes | Depois |
|---|---|---|
| Site: pendências na régua | contraste 4, texto pequeno 11, alvos 98, linhas longas 24, zoom iOS 1 | **0 em todas** |
| Painel: pendências na régua | contraste 12, texto pequeno 19, alvos 179, rolagem lateral 4, fonte de letreiro 34 | **0 em todas** |
| Painel: tamanhos de fonte distintos | 38 | **10 — exatamente os 10 tokens da escala** |
| Cores via token (CSS todo) | 38% | **87%** |
| CLS da página de serviço | 0,145 | **0,000** |
| LCP da home (4G lento, CPU 4×) | 4,04s | **~2,7s** |

### Site público

- **Bug no ar: três serviços sem nome na lista de preços.** `servicos.html` mostrava "$1$215 min" no lugar de Pezinho, Sobrancelha masculina e Freestyle — um `$1$2` de regex de edição em massa não substituído, que também comeu o `</a>` (e o link aberto contaminava as linhas vizinhas). Restaurado com os nomes confirmados pelo Juliano.
- **Não existia regra base de link:** todo `<a>` sem classe caía no azul padrão do navegador sobre fundo quase preto (2,1:1). `a{color:var(--gold2)}` resolve a classe inteira do problema; `<small>` ganhou piso de 12px pelo mesmo motivo.
- Todo tamanho de fonte abaixo de 12px zerado (JuIA, `/agendar/`, recibo, preços).
- Alvos de toque de 44px no celular: "Adicionar" do catálogo e dos produtos (36px), perguntas do FAQ (25px), "← Voltar" (25px), campo de telefone da Área do Cliente (27px).
- **Rótulos acima dos títulos (99):** 43 viraram **breadcrumb de verdade** ("Início › Serviços", "Início › Blog › Ciência da Barba"), 45 saíram (repetiam o título: "Barbearia do Ju • Bragança Paulista" sobre "Corte masculino em Bragança Paulista"), 7 foram integrados ao título onde ele ficava vago sem eles (ex.: "Bebidas frias para acompanhar seu atendimento."), e **4 ficaram de propósito**: as "Etapa 1…4" do reagendamento — são indicador de progresso, a sequência é informação.
- **CLS 0,145 → 0 na página de serviço:** era a troca do Inter. O texto aparecia na fonte do sistema e refluía quando o Inter chegava (~2,8s em 4G), empurrando a página 50px. Medi as larguras reais (Inter é 6,1% mais largo que Arial no normal, ~3% no negrito) e criei `InterFallback` com `size-adjust` calibrado; inserido em todas as pilhas de fonte.
- **Imagens:** logo da home em WebP (101 KB) era *maior* que o JPG e baixava a 1200px pra aparecer com 309px — agora `srcset` com 800px (59 KB) e pré-carregado (é o LCP). As 43 imagens principais de serviço/blog tinham `loading="lazy"`, o que **atrasa** justamente o LCP — viraram prioridade alta, com `srcset`. Foto do autor: 67 KB → 10 KB em 45 páginas, com largura/altura. Capa do vídeo da home carrega só quando ele chega perto da tela. Todas as variantes geradas pelo próprio Chromium (canvas → WebP), conferidas visualmente, a fachada partindo da versão já corrigida da placa.
- **55 páginas carregavam a biblioteca do Supabase (55 KB) sem usar.** Provado duas vezes antes de remover: nenhum script dessas páginas referencia o identificador `supabase`, e em execução (biblioteca bloqueada + armadilha em `window.supabase`, usando chat e formulário) zero acessos e zero erros. Continua onde é usada: avaliação, meu-agendamento, reagendar, `/agendar/horario/` e o painel.
- **O css/06 (53 KB, só do painel) bloqueava a renderização de todo visitante.** Provado por snapshot de estilo calculado que não altera nada nas 66 páginas públicas; saiu do `style.css` e as páginas `admin*.html` ligam direto.
- `.reveal` agora parte de um estado **visível**: sem JavaScript tudo aparece; o script só esconde o que está abaixo da dobra. Antes, se o script falhasse, a página ficava em branco.
- Catálogo da home em `defer` (o script do seletor de duração roda no `DOMContentLoaded`).

### Painel

- **Rolagem lateral no celular (Agenda +46px, Novo agendamento +30px):** o checkbox *escondido* do `.pretty-check` herdava `width:100%` e virava um elemento invisível de 390px. Corrigido — e o foco de teclado desses controles customizados passou pro quadrado visível (antes, quem navegava por Tab não via nada).
- **Tipografia de ferramenta:** o título "Quinta-feira, 17 de setembro" saía em Bebas a 67px em duas linhas; títulos e números viraram Inter numa escala fixa. Havia `clamp()` com `!important` em regras antigas — corrigidos na origem. 107 tamanhos soltos encaixados no token mais próximo: **38 tamanhos → 10**.
- Financeiro: as abas Dia/Semana/Mês eram espremidas até 100px ("Mês" sumia); indicadores numa grade de 6 colunas com 4 cartões ("-R$ 1.405,00" vazava do cartão); "opcional" desalinhava o formulário. Corrigidos.
- Alvos de 44px em tudo que se toca no celular (card do dia, calendário, Balcão — campos de 21-24px —, setas de período); campos com 16px no celular (abaixo disso o iPhone dá zoom sozinho ao tocar); ação principal ocupando a linha inteira no cabeçalho.

### O app no celular (PWA)

- Ícones separados comum/recortável — o `any maskable` num arquivo só cortava as pontas dos postes no círculo do Android.
- O app do painel tinha o **mesmo escopo `/`** do app do site; agora é `/admin`. Atalhos na ordem da barra inferior; "Modo Atendimento" (desativado) virou **Hoje**, e o **Balcão**, que faltava, entrou.
- **Página offline própria** (com telefone e endereço clicáveis): antes, sem internet, o app do painel mostrava a home pública. O fallback do service worker também passou a aceitar resposta que veio de redirecionamento (o navegador recusava e a tela dava erro).
- **A recarga disparada por service worker novo agora espera** se houver modal aberto ou alguém digitando — antes podia derrubar um "Concluir atendimento" preenchido. Mesma regra que o aviso de versão do painel já usava.

### Cores

334 cores literais viraram token de valor idêntico (prova: **zero diferença de cor** em 52 telas); 175 camadas translúcidas da marca passaram a derivar do token por canal (`rgba(var(--gold2-rgb),.45)` — idêntico ao bit, funciona em iPhone antigo); 67 cores quase-iguais (ex.: cinco pretos entre `#0a0a0a` e `#101010`) encaixadas no token mais próximo **só quando a diferença é imperceptível** — prova: maior ΔE 2,03 (limiar de percepção ~2,3). Dois casos que ficaram no limite (ΔE 2,49 e 3,18 na métrica mais rigorosa) foram revertidos ao valor original.

### O que NÃO fiz, de propósito

- **Pixels de rastreamento (GTM, GA4, Ads, Meta):** são ~1,2s do bloqueio de CPU medido no celular. Adiar o GTM até a primeira interação melhoraria a nota de performance, mas perderia as visitas que saem rápido — distorceria o Ads e o GA4, e este CHANGELOG já registrou o preço de mexer em rastreamento (145 cliques → 6 sessões). Decisão do Juliano, não minha.
- **Rótulos do painel** ("Linha do dia", "Caixa do dia"): em ferramenta, nome de widget é familiaridade, não enfeite — e o visual do painel foi aprovado na reforma de 11/09.
- **Hospedar as fontes no próprio site** (eliminaria a conexão com o Google Fonts): exige baixar os arquivos de fonte, e isso pede autorização explícita.
- **Capturas de tela no manifesto** (instalação mais rica no Android): mostrariam preços, que mudam em 01/10.
- As ~180 cores de efeito usadas uma vez só (paradas de gradiente, verde do WhatsApp): unificar mudaria cores visíveis sem ganho pro cliente.

### Os erros desta versão, registrados de propósito

Todos pegos **antes** de publicar, mas cada um teria virado número falso ou regressão:
1. A régua procurava o fundo a partir do elemento **pai** — pulava o gradiente do próprio botão e acusou 165 falhas de contraste; o real era 8.
2. `max-width:72ch` deu ~90 caracteres por linha: o `ch` mede o dígito 0, mais largo que a letra média. Trocado por `em`.
3. Com `line-height: normal`, a régua subestimava as linhas e acusava parágrafo longo onde não havia.
4. Largura mínima de 44px em todo botão do painel **cortou o domingo do calendário** em 320px e fez os rótulos da barra inferior se atropelarem — corrigidos.
5. O novo `.reveal` chamava `getBoundingClientRect()` na carga e forçava layout síncrono da home inteira (TBT subiu); refeito com o próprio IntersectionObserver.
6. O fechamento do script do seletor de duração ficou `}})` — a validação de sintaxe de todos os 127 scripts inline pegou.
7. O comparador de cor, escrito via shell, teve as regex corrompidas e devolveu **NaN** — o "0 perceptíveis" dele não valia nada. Refeito, testado com casos conhecidos, e aí sim achou os 2 casos no limite que revertemos.

**Cache:** tudo bumpado para 29.205.0 (81 `style.css`, 54 `juia-chat.css`, 70 manifestos, `script.js`, `admin-pwa.js`, agenda/core do painel, `@import` 01-05, preloads da home), **`ADMIN_VERSION`, `admin-version.json` e a versão do `admin-v15-4-core.js` juntos** (o loop de recarga de 30/08 foi exatamente os três dessincronizados). JSON-LD: 50 blocos válidos; 127 scripts inline com sintaxe OK.

**Testes:** 153 unit + 51 e2e passando.

## 29.204.0 — Auditoria e critique do site (skill impeccable): CTA do celular desbloqueado, texto de consentimento legível, CSS duplicado na home e o cupom expirado do e-book (17/09, noite)

**Pedido do Juliano (17/09/2026, noite):** instalar a skill `impeccable` (`npx impeccable install`), rodar `/impeccable audit` + `/impeccable critique` no site inteiro e corrigir tudo — inclusive os itens P2/P3 e o achado de conteúdo fora do escopo de design.

**Como foi auditado:** detector automático do impeccable em 13 páginas ao vivo (uma de cada template dos 54 do sitemap) + verificação manual no navegador em 375×812 e 1280×860. A critique rodou com um subagente cego, que não viu nada da auditoria técnica, pra não ancorar o julgamento de design nos números do detector.

**O detector erra bastante, e conferir importou:** dos achados de "baixo contraste", 3 medidos de verdade com `getComputedStyle` na página ao vivo deram 9,6:1 a 13:1 (o detector reportava 1,0:1 a 2,4:1) — ele lê a cor declarada no gradiente/blur, não a efetivamente pintada. Os 32 alertas de "glow colorido" não existem no CSS (nenhum `box-shadow` de offset zero colorido), e os 42 de "borda fina com sombra larga" são o sistema de elevação do site (`--sh-1/2/3`, todos com offset). **Nada disso foi "corrigido", porque não estava quebrado.** O que sobrou depois da conferência é o que está abaixo.

### Os dois P0 (os dois no celular, onde chega a maior parte do tráfego de anúncio)

- **As duas barras fixas de "Agendar" estavam empilhadas uma em cima da outra.** A `.mobile-cta` (3 botões: Agendar/WhatsApp/Rota) entra em 850px com `bottom:10px`; a `.mobile-agendar` (barra dourada cheia) entra em 620px com `bottom:0`. Abaixo de 620px as duas ficavam na tela ao mesmo tempo, com **43px de sobreposição medidos** (a dourada cortando o terço de baixo da outra) e a ação de agendar aparecendo três vezes simultâneas contando o CTA do hero. Cada uma tinha sido validada contra o próprio breakpoint; ninguém tinha olhado a faixa onde as duas coexistem. Agora a dourada é o CTA primário e a `.mobile-cta` perde o botão duplicado, virando só WhatsApp e Rota, empilhada acima sem encostar (`bottom:calc(61px + env(safe-area-inset-bottom))`), com `body`, `.back-top` e `.welcome-pop` recalculados junto.
- **O banner de cookies cobria por inteiro os dois CTAs do hero no primeiro carregamento.** Medido em 375×812: o banner ocupava y=555–802 (247px, 30% da tela) e os botões "Agendar horário" (633–693) e "Fale com o barbeiro" (707–767) ficavam **100% atrás dele** — ou seja, o primeiro passo do funil (`clique_agendamento`) era literalmente intocável até o visitante resolver o consentimento. O banner foi para **97px** (-61%): no celular o título some, o texto encurtou preservando a nuance que importa (a medição é sempre ativa, a escolha é só sobre anúncios — decisão de 26/08), o link da política virou inline e os botões cabem em uma linha. "Agendar horário" passou de 0% para **90% visível e totalmente clicável**. O texto completo continua na Política de Privacidade, linkada ali.

### Os P1

- **O texto de consentimento LGPD da JuIA era ilegível:** `.juia-privacy` estava com **9,5px e contraste 3,77:1** (o mínimo AA é 4,5:1), na frase "Ao conversar, você concorda com o uso dos dados apenas para atendimento e agendamento" — justamente a divulgação de uso de dados, em toda página que carrega o widget. Foi para **12px e 8,76:1**, usando o token `--juia-muted` que já existia.
- **A home baixava o pacote CSS inteiro duas vezes.** Os `<link rel="preload">` no `<head>` do `index.html` estavam com `?v=` entre 29.3.0 e 29.111.0 enquanto o `style.css` já importava as mesmas 5 folhas em 29.161/29.179 — query string diferente é outra URL, então o navegador baixava tudo em duplicata. Era só na home (as outras páginas carregam só o `style.css`). Sincronizado, com o 06 que faltava incluído e um comentário no HTML avisando que os dois lugares têm que ser bumpados juntos.
- **Hero disputando com a própria foto de fundo:** o overlay tinha só 18% de preto no topo, e a fachada tem texto branco real (a placa "HORÁRIO DE ATENDIMENTO") quase no mesmo peso visual do H1 — no celular dava efeito de dupla exposição. Overlay para 44% no topo e 78% em 55%, mais `text-shadow` no título e no subtítulo.
- **Dois grids de 11 e 10 links, sem hierarquia.** "Acesso rápido" e "Serviços em destaque" eram listas planas onde "Serviços e agendamento" tinha exatamente o mesmo peso visual de "Salvar contato". Viraram subgrupos rotulados (`<h3 class="links-group">`): *Agendar e comprar* / *Falar com a gente* / *Antes e depois da visita*, e *Cabelo* / *Barba e rosto* / *Química e coloração*. Os dois cartões finais de "Serviços em destaque" ("Todos os serviços" e "Ver catálogo completo") apontavam pro mesmo lugar e competiam com serviços de verdade: viraram uma linha de link no fim da seção. Grid com `auto-fit` pra nenhum grupo deixar cartão órfão em linha própria.

### Os P2/P3 que valiam

- **H1 do hero e H2 de seção usavam a mesma regra CSS** (`clamp(2rem,5.5vw,4.2rem)` pros dois): rolar a home não dava nenhum sinal tipográfico de ter saído do hero. Separados — H1 em 45px, H2 em 27,2px na largura testada. Afeta só as 4 páginas com `class="section"` (home, blog, produtos, salvar-contato).
- **Medida de leitura:** os artigos do blog, o guia pilar e a política tinham linhas de 90 a 140 caracteres (o confortável é 65–75). `.privacy-card p/li` ganharam `max-width:72ch`.
- **Glow radial decorativo do `.bg-grain` removido** (o gradiente dourado atrás do hero, presente em 12 das 13 páginas). Era o único dos padrões "genéricos de IA" apontados pelo detector que existia de fato e não carregava informação nenhuma. **Não mexi** nos rótulos acima dos títulos (carregam informação real: localização, contexto de seção) nem nas bordas laterais coloridas do `.pharma-note`/`.warning-note`/`.highlight-text` — em conteúdo escrito por farmacêutico, a borda colorida de callout é convenção que ajuda a varredura, não enfeite.

### Fora do escopo de design: o cupom expirado do e-book estava no ar havia duas semanas

O bloco `.ebook-promo` ainda anunciava **"R$49,99 → R$24,99 · 50% off · lançamento"** com link `?offDiscount=LANCAMENTO`, em 8 páginas (7 artigos do blog + a home) — contra a decisão de 03/09/2026, que foi encerrar o cupom e deixar o e-book sem preço. Removidos os 7 blocos de preço e os 8 links com cupom, conferindo a contagem antes e depois (a armadilha de edição em massa que já custou caro aqui antes).

### O erro desta versão, registrado de propósito

Pra caber os dois botões do banner em uma linha eu renomeei "Somente essenciais" para "Só essenciais" — e **quebrei 16 testes e2e de uma vez**, porque `analytics.spec.js`, `cart.spec.js` e `booking-review.spec.js` usam esse rótulo como seletor pra dispensar o banner; sem dispensar, o banner interceptava todos os cliques seguintes. O `white-space:nowrap` que eu já tinha colocado no CSS *sozinho* resolvia o problema de altura: o rótulo original cabe em uma linha e o banner continua com 97px. Rótulo revertido, 16 testes de volta ao verde. **Lição: rótulo visível de botão é contrato de teste — conferir quem depende dele antes de reescrever.**

**Cache:** `style.css`, `juia-chat.css` e `privacy-consent-v22-4.js` bumpados para 29.204.0 em **81, 54 e 56 referências** nas páginas vivas (contagem conferida depois, nenhuma referência antiga sobrou), mais os `@import` do `style.css` para as folhas 01, 02 e 04.

**Testes:** 153 unit + 51 e2e, todos passando.

## 29.204.0 — JuIA: fim do "ainda estou por aqui" por cima de pedido do cliente; watchdog cutuca o Juliano em vez de falar com o cliente (caso Rodrigo Miranda, 17/09, noite)

**Pedido do Juliano (17/09/2026, ~18h55, print):** "arrumar da JuIA erro". Ele estava atendendo o Rodrigo na mão (mandou os horários às 17h17). O cliente respondeu às 17h47: *"Pode ser sábado às 14:45. Marca dois cortes, pode ser?"* — pedido concreto, pai e filho. Às 18h48 a JuIA mandou *"Boa noite! Ainda estou por aqui se precisar de algo. Se preferir, também dá pra ver os serviços, consultar horários e agendar direto pelo nosso site"* — genérico, com link, por cima de um pedido que só o Juliano podia fechar. Ele respondeu na mão às 18h51.

**Causa:** o `whatsapp-reactivation-watchdog` (roda a cada minuto) devolve a conversa pra JuIA depois de 20 min sem atividade, com uma guarda de "mensagem humana nos últimos 90 min = conversa do Juliano" (v29.85.0, do OUTRO caso Rodrigo, 27/08). Às 18h48 a última mensagem humana tinha 91 minutos — 1 minuto além da guarda. Liberou, e o "cochicho" com link do site só era pulado quando a última fala do cliente NÃO parecia pedido; como parecia ("pode ser…?"), mandou. Ou seja: a regra mandava o texto genérico exatamente no caso em que ele é mais errado.

**Correção (function redeployada):** o watchdog **não manda mais nenhuma mensagem pro cliente**. Ele só decide e avisa:
- Última mensagem é do cliente e parece pedido (pergunta, "pode ser", horário, marcar, quanto…): **é do Juliano**. Push *"⏰ Rodrigo está esperando sua resposta há 61 min: '…'"* a cada hora (marca `waiting_reply_push_at` no estado da conversa), takeover mantido. Só depois de **3 h** sem resposta a conversa volta pra JuIA, **em silêncio**, pra ela atender a PRÓXIMA mensagem dele — nunca um texto genérico por cima do pedido.
- Última mensagem é despedida/figurinha/"obrigado", ou é nossa: conversa acabou; takeover volta pra JuIA em silêncio depois dos 20 min, sem mensagem (antes também não mandava; agora está explícito).
- A guarda dos 90 min continua.
O "cochicho" com link do site deixou de existir: em todos os casos reais revisados ele saiu fora de hora (Kelvin 05/08, Helder e Rafael 14–18/08, Rodrigo 27/08, Rodrigo 17/09).

**Verificado:** função recusa chamada sem segredo (401); disparo manual com o segredo = 200 sem candidatos; a conversa do Rodrigo está em atendimento humano desde a resposta do Juliano às 18h51 (o webhook marca sozinho). `verify_jwt` inalterado (false, cron).

## 29.203.1 — Content-Security-Policy no ar pelo Cloudflare, testada página a página; nota A no scanner (17/09, fim da tarde)

**Pedido do Juliano (17/09/2026, ~16h35, print do securityheaders):** "outra auditoria, subimos para A mas ainda tem este campo em vermelho" — o único cabeçalho faltando era a CSP, que eu tinha deixado de fora de propósito na v29.202.1.

**Como foi feito, para não quebrar nada:** inventário do que as páginas realmente carregam (grep em todos os HTML/JS: Google Fonts, GTM, jsdelivr, Supabase; iframe só do GTM; service worker do admin) + o que o GTM injeta por baixo (GA4, Google Ads, Meta). A CSP entrou como 4º cabeçalho da regra de Transform do Cloudflare, enforcing (não report-only, porque o scanner só reconhece a enforcing). Depois, teste funcional no navegador em produção: home, /agendar/, /agendar/horario/, /cliente.html, /admin.html e uma página de serviço — supabase-js carregado, GTM ativo com o container certo, fontes carregadas, chamada REST e Functions do Supabase passando pela CSP, service worker registrado, e um ouvinte de `securitypolicyviolation` disparando os eventos de funil (`clique_agendamento`, `service_selected`) pra ver o que o GTM tenta carregar.

**O teste pegou uma quebra real antes de virar problema:** a conversão do Google Ads bate em `pagead2.googlesyndication.com/measurement/conversion`, que não estava na primeira lista — a primeira versão da CSP bloqueou (`connect-src`). Sem o teste, a medição de conversão do Ads (que o suporte do Google configurou em 16/09) teria morrido em silêncio. Corrigido com curinga nos domínios do Google Ads (`*.googlesyndication.com`, `*.doubleclick.net`, `*.googleadservices.com`, `*.google.com`, `*.google.com.br`) e do Meta (`*.facebook.com`) em script/connect/frame. Segunda rodada: zero violações, e o ping de conversão saiu.

**A política (resumo):** `default-src 'self'`; scripts só do próprio site, jsdelivr, GTM, GA, Google Ads e Meta (com `'unsafe-inline'`, inevitável em site estático com GTM e JSON-LD — é a limitação conhecida desta CSP); estilos do site + Google Fonts; fontes do site + gstatic; imagens de qualquer HTTPS (avatares de avaliação do Google, pixels); `connect-src` só Supabase (https e wss), GA, GTM, Google Ads, Meta, jsdelivr e Google Fonts; iframes só GTM, Google Ads, YouTube, Instagram e Facebook; `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `form-action` só o site, WhatsApp e Hotmart; `upgrade-insecure-requests`.

**Regra nova de manutenção (também no CLAUDE.md):** qualquer serviço externo novo no site ou no admin (um pixel, um embed, um CDN, uma API chamada do navegador) precisa entrar na CSP no Cloudflare ANTES de ir pro ar, senão o navegador bloqueia em silêncio. O ouvinte de `securitypolicyviolation` no console é o jeito de conferir.

Sem código no repositório além deste registro. Scanner: A com os seis cabeçalhos verdes.

## 29.203.0 — Backup semanal do banco: todas as tabelas, comprimido, no Storage e no e-mail do Juliano (17/09, fim da tarde)

**Pedido do Juliano (17/09/2026, ~16h):** "monta o backup sim" — depois de eu explicar que o plano Free do Supabase não faz backup automático e que perda de dados por erro é risco maior que invasão.

**Como funciona (function `backup-weekly` + migration 164):**
- Cron `bdj-backup-weekly`, **domingo 04h00 de Brasília** (07h00 UTC), mesmo padrão dos outros robôs (segredo do vault).
- Despeja **todas as tabelas do schema public** (lista viva por `backup_list_tables()`, SECURITY DEFINER só pro service_role — tabela nova entra sozinha), paginado de 1000 em 1000. Fica de fora só `customer_area_otp` (códigos de acesso, lixo em 2 dias).
- Um único arquivo `backup-barbearia-do-ju-AAAA-MM-DD.json.gz` com `{ generated_at, tables: { tabela: [linhas] }, counts, errors }`. O banco inteiro tem menos de 10 MB; comprimido dá bem menos.
- **Bucket privado `backups`** (sem policy de storage: só service_role), pasta `semanal/`, **guarda as 12 últimas semanas** e apaga o resto.
- **E-mail pro Juliano (Gmail) com o arquivo em anexo**, pelo Zoho Mail (mesmas credenciais do `send-email`; upload do anexo pela API e envio com `attachments`). Se o anexo falhar, o e-mail vai com um link assinado de 7 dias. É a cópia FORA do Supabase — e Gmail é Google, então atende ao "Google Drive" que ele pediu sem precisar de credencial nova do Google no servidor.
- Push "Backup semanal feito" com totais e o status do e-mail.

**Como restaurar (deixando escrito antes de precisar):** cada tabela do JSON é um array de linhas exatamente como o PostgREST devolve. Restauração é tabela a tabela, com `insert into public.<tabela> select * from jsonb_populate_recordset(null::public.<tabela>, $1::jsonb)` (colunas geradas/identity precisam de `overriding system value` ou de serem tiradas do JSON). **Nunca restaurar em cima do banco vivo sem antes conferir o que mudou depois da data do backup** — restauração parcial (uma tabela, algumas linhas) é o caso normal; a completa é só pra desastre.

**Primeiro backup rodado na hora, duas vezes:** a primeira (11 s, 936 KB) veio com 11 tabelas em "permission denied" — tabelas criadas sem o grant de SELECT pro service_role (admin_users, professionals, cash_handovers, camera_*, blocked_customers, booking_customer_actions, service_price_changes, whatsapp_ad_clicks, professional_*). Corrigido com `grant select on all tables in schema public to service_role` + default privileges pra tabela futura, e rodado de novo: **54 tabelas, 14.070 linhas, 970 KB comprimido, zero erro, e-mail enviado com o anexo** (dois e-mails chegaram no Gmail dele; o segundo é o completo). Sem código no site, sem cache.

**Também nesta versão — dica de um cliente pelo WhatsApp (17/09, 14h16):** o local do evento "Adicionar ao Google Calendar" e do arquivo .ics da página *Meu agendamento* passou de "Rua Dr. Antônio da Cruz, 482 - Centro, Bragança Paulista" para **"Barbearia do Ju, R. Dr. Antônio da Cruz, 482 - Centro, Bragança Paulista - SP, 12900-350, Brazil"** — com nome do estabelecimento, CEP e país o Google Maps casa o lugar certo e mostra o nome da barbearia no evento. `meu-agendamento-v25.js?v=29.203.0`.

**Preço do Supabase Pro (pergunta dele):** US$ 25 por mês por organização (mais uso excedente, que hoje não acontece), cobrado em dólar no cartão, o que dá em torno de R$ 140–150 com IOF. Inclui backup diário automático com 7 dias de retenção, a proteção contra senha vazada (v29.202.0), projeto que nunca pausa por inatividade, 8 GB de banco e suporte por e-mail. Com este backup semanal no ar, o Pro deixa de ser urgente; vira decisão de conforto.

## 29.202.1 — Cloudflare na frente do GitHub Pages: proxy ligado, HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, TLS mínimo 1.2 (17/09, fim da tarde)

**Feito com o Juliano logado no painel do Cloudflare, pelo Chrome dele (item 3 dos "três casos"). Nada de código; é configuração da zona `barbeariadoju.com.br` (conta dele, plano Free).**

- **Proxy (nuvem laranja) ligado nos 5 registros web:** os 4 `A` da raiz (185.199.108–111.153, GitHub Pages) e o `CNAME www → barbeariadoju.github.io`. MX/TXT (e-mail, DMARC, DKIM, verificação) ficaram como estavam, "DNS only". Conferido por curl a cada passo: raiz → 301 pro www (redirect do próprio GitHub Pages, intacto), www/agendar/admin 200 com `Server: cloudflare`, HTTP → HTTPS 301.
- **Modo SSL:** "Full" (automático do Cloudflare, já estava assim). Tentei fixar em "Full (strict)", o painel voltou pro automático; como o certificado do GitHub Pages é válido (Let's Encrypt), o automático tende a subir pra strict na varredura de 26/09. Não é bloqueio.
- **HSTS:** ligado, `max-age` 6 meses (recomendado), **sem** `includeSubDomains` e **sem** preload de propósito (subdomínio sem HTTPS ficaria inacessível; preload é irreversível na prática). Junto veio o **`X-Content-Type-Options: nosniff`** (opção do mesmo diálogo).
- **Regra de Transform (Response Headers) "Cabecalhos de seguranca (17/09/2026)"**, todas as requisições: `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `X-Frame-Options: SAMEORIGIN`. 1 de 10 regras do plano usada.
- **TLS mínimo:** 1.2 (era 1.0).
- **"Always Use HTTPS" ficou DESLIGADO de propósito:** o GitHub Pages já redireciona HTTP → HTTPS; ligar nos dois pontos é o cenário de `ERR_TOO_MANY_REDIRECTS` que o próprio painel avisa.
- **Cache do navegador:** o padrão do Cloudflare reescrevia `Cache-Control` de JS/CSS pra 4 horas (o GitHub manda 10 min). Voltei pra **"Respect Existing Headers"** — o `?v=` continua sendo o que troca versão, e o `sw.js`/`admin-version.json` seguem com o comportamento de antes. Conferido: JS volta a sair com `max-age=600`; HTML e JSON não são cacheados na borda (`cf-cache-status: DYNAMIC`); CSS/JS ficam na borda por ~10 min (`HIT`).
- **CSP fica de fora nesta rodada** (decisão registrada na v29.202.0): com GTM, GA, Meta, jsdelivr e Supabase na página, uma CSP restritiva quebra sem teste caso a caso; permissiva não protege.

**Cabeçalhos conferidos no ar (curl na home):** `Strict-Transport-Security: max-age=15552000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `X-Frame-Options: SAMEORIGIN`. Os 5 achados do relatório da Manus estão fechados ou decididos.

**Armadilha nova pro CLAUDE.md:** o site agora passa pelo Cloudflare. "Confirmar no ar com curl" continua valendo, mas CSS/JS podem ficar até ~10 min na borda — URL nova (`?v=` novo) nunca está em cache, então o bump de versão é o que garante; se precisar forçar, Caching → Configuration → Purge Everything no painel.

## 29.202.0 — Os três casos da auditoria: área do cliente só com código por WhatsApp; senha mínima de 8; Cloudflare (17/09, fim da tarde)

**Pedido do Juliano (17/09/2026, ~14h45):** "vamos arrumar os três casos" — os três que eu tinha deixado como decisão dele na v29.201.0.

**1. Área do cliente atrás de um código por WhatsApp (no ar).** `cliente.html` deixou de chamar `get_public_customer_summary(telefone)` direto com a chave anônima. Agora: o cliente digita o WhatsApp → a Edge Function nova `cliente-area` manda um código de 6 dígitos pro número → ele digita o código → só então a function (com `service_role`) chama a RPC e devolve o resumo. Sessão de 12 h no `sessionStorage` (token aleatório de 48 hex) pra recarregar sem novo código. Detalhes de segurança:
- O `anon` **perdeu EXECUTE** na RPC (migration 163, parte B, aplicada depois que o site novo estava no ar — sem janela quebrada).
- Telefone sem cadastro recebe **a mesma resposta** ("se este número tiver cadastro, o código chega") e nada é enviado nem gravado: não dá pra descobrir quem é cliente.
- Anti-abuso: 3 códigos por telefone por hora, 60 s entre códigos, 5 tentativas por código, código vale 10 min. Código guardado como SHA-256 com pepper (`CUSTOMER_AREA_OTP_PEPPER`, se existir; senão derivado do secret do projeto). O texto gravado em `whatsapp_messages` sai com o código mascarado (`******`).
- Tabela `customer_area_otp` (RLS ligada, sem policy — só a function toca), limpeza diária às 4h15 (`bdj-customer-area-otp-cleanup`).
- `cliente-v30.js` substitui o `cliente-v23.js`; o formulário virou duas etapas (telefone → código), com "Trocar número ou pedir outro código". Mensagem do código sem emoji (regra de 01/09).
- Smoke test em produção: `send` com número inexistente = 200 genérico; `verify` sem código = 400; `resume` com token inválido = 401; chamada sem `apikey` = 401 (`verify_jwt=true`, como o `ju-ia-site`). RPC conferida por `has_function_privilege`: anon false, service_role true.

**2. Senha vazada: não dá no plano Free — compensado com senha mínima de 8.** A opção "Prevent use of leaked passwords" do Supabase Auth é **só do plano Pro** (a própria tela avisa "Only available on Pro plan and above"); tentei ligar pelo painel, o salvar não pega. Deixei o que o Free permite: **tamanho mínimo de senha subiu de 6 para 8** (Authentication → Sign In / Providers → Email). Vale para senhas novas e trocas; a senha atual do Juliano não muda. Se um dia o projeto for pro Pro (US$ 25/mês), a proteção contra senha vazada é um clique nessa mesma tela. O linter do Supabase vai continuar listando esse item — é o plano, não é descuido.

**3. Cabeçalhos de segurança pelo Cloudflare.** Descoberta: o DNS do domínio **já está no Cloudflare** (nameservers `paris`/`cash.ns.cloudflare.com`), só que com o proxy desligado — o `www` resolve direto pros IPs do GitHub Pages. Não precisa mudar registrador: é ligar o proxy (nuvem laranja) no `www` e no domínio raiz, deixar SSL em "Full (strict)", ligar HSTS em SSL/TLS → Edge Certificates e criar uma regra de Transform (Response Headers) com `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mínima e `X-Frame-Options: SAMEORIGIN` (CSP fica de fora nesta rodada: com GTM, GA, Meta, jsdelivr e Supabase na página, uma CSP restritiva exige testar caso a caso; uma permissiva não protege nada). **Pendente do login do Juliano no painel do Cloudflare** — eu não entro com credencial de ninguém; abri a tela de login no Chrome dele e sigo de lá quando ele entrar.

Testes: `npm test` verde (153 unit + 51 e2e) antes do push do site. Sem `ADMIN_VERSION` (página pública). Cache: `cliente-v30.js?v=29.202.0`.

## 29.201.0 — Auditoria de segurança externa (Manus) conferida no código e no banco: o que fechei, o que já estava certo e o que é decisão do Juliano (17/09, tarde)

**Pedido do Juliano (17/09/2026, ~14h20):** "analise isto e tome as medidas necessárias", com o PDF *"Análise de Segurança — Barbearia do Ju"* (Manus, 17/09, revisão externa passiva, sem acesso a repositório nem banco). Veredito do relatório: nenhuma falha crítica na superfície pública; 5 achados, todos do tipo "confirme no backend". Conferi cada um de verdade (regra da casa: ler antes de afirmar que falta), e cruzei com o linter de segurança do próprio Supabase (`get_advisors`).

**O que já estava certo (não mexi):** RLS ligada em TODAS as tabelas do schema público (zero sem RLS); chave `service_role` só em secrets de Edge Function e em variável de ambiente do teste ao vivo (nunca no HTML/JS); área administrativa protegida no servidor (policies com `is_admin()`, RPCs administrativas checam `is_admin()` por dentro, Edge Functions validam JWT + `is_admin`); JuIA com limite diário de mensagens (429) e telefone/estado tratados como entrada não confiável; HTTPS forçado pelo GitHub Pages.

**Fechado agora (migration 162, no ar):**
- **RPCs administrativas fora do cardápio anônimo:** `admin_create_booking`, `admin_register_walkin_visit`, `admin_reschedule_booking` e `generate_gift_code` não são mais executáveis pelo `anon` (já negavam por dentro; agora nem aparecem). Linter: de 27 pra 23 funções listadas — as 23 que ficam são por desenho (token do cliente, segredo da câmera, horários públicos do site, funções de gatilho que o PostgREST nem consegue chamar).
- **`contact_messages`:** anon perdeu SELECT/UPDATE (herança de GRANT antigo; a RLS já bloqueava, mas privilégio sem uso é superfície à toa). INSERT do formulário continua.
- **TRUNCATE revogado de anon/authenticated em todas as tabelas** (+ default privileges): a RLS não cobre TRUNCATE. Não era explorável pela API, mas custa zero tirar.
- **Erro meu no meio, registrado como manda a casa:** revoguei `is_admin()` do anon "porque o linter pediu" — e `REVOKE ... FROM PUBLIC` derruba o grant implícito do `authenticated` junto. Por ~1 minuto o `authenticated` não podia executar `is_admin()` (o painel logado teria falhado). Conferi em seguida, devolvi os grants explícitos a `authenticated`/`service_role` e **mantive `is_admin()` pro anon de propósito**: 12 policies de RLS com papel PUBLIC (bookings, google_reviews, content_posts, finance_*…) chamam `is_admin()` no USING — sem EXECUTE, leitura anônima nessas tabelas viraria erro em vez de "zero linhas". Ela só devolve false sem sessão. Lição: revogar de PUBLIC exige re-conceder aos papéis que usam; conferir `has_function_privilege` logo depois.

**Fechado agora (site, sem cache — é HTML):**
- **supabase-js fixado** em `2.116.0` (a versão que o `@2` estava servindo hoje) com **Subresource Integrity** (`sha384-…`) e `crossorigin="anonymous"` nas 76 páginas que carregam o cliente. Uma versão nova ou um arquivo alterado no CDN deixa de entrar sozinho; atualizar passa a ser decisão com teste (trocar versão + hash nas 76 páginas por script).
- **`/.well-known/security.txt`** (contato para quem achar problema, validade 1 ano) + `_config.yml` com `include: [.well-known]`, porque o Jekyll do GitHub Pages ignora pasta com ponto sem isso.

**O que fica pro Juliano decidir (não é código):**
1. **Cabeçalhos HTTP (HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy):** o GitHub Pages não deixa configurar cabeçalho. Só entram pondo o domínio atrás de um proxy/CDN (Cloudflare, plano grátis). É mudança de DNS, tem que ser decidida e feita com calma; até lá, o ganho real é pequeno (site estático, sem login no domínio público — o admin autentica no Supabase).
2. **Proteção contra senha vazada (HaveIBeenPwned) no Supabase Auth está desligada:** liga no painel do Supabase → Authentication → Settings → Password security. Um clique, sem efeito colateral; eu não tenho como ligar por aqui.
3. **`get_public_customer_summary(telefone)`:** a área do cliente do site devolve primeiro nome, pontos, último serviço e próximo horário só com o número de telefone — qualquer pessoa que saiba o número de um cliente consegue ver quando ele vai à barbearia. Não é bug de permissão, é desenho (conveniência sem senha). Alternativa: só mostrar depois de um código enviado pelo WhatsApp. Fica registrado pra ele escolher.

Testes: `npm test` verde (153 unit + 51 e2e, com o Chromium validando o hash de integridade em todas as telas). Linter do Supabase rodado antes e depois. Sem função nova, sem cache.

## 29.200.0 — Sinal de química tem prazo de 1 hora; vencido, o horário é liberado sozinho (17/09, começo da tarde)

**Regra do Juliano (17/09/2026, ~13h):** "até 1h pra fazer o sinal; se não fizer, libera o horário. Isto só pra serviços de química, que são mais caros e duradouros e ocupam muito tempo na agenda." Fecha a pendência registrada na v29.199.1: o pedido de sinal saía sem prazo, e o primeiro cancelamento por ele (Teddy) foi na mão, 25 minutos depois do pedido.

**Escopo (inalterado):** serviço com `upsell_tag = 'quimica'` em cliente sem atendimento concluído — o mesmo recorte da v29.199.0. Química em cliente antigo e qualquer outro serviço seguem sem sinal.

**Como funciona:**
- **JuIA** (`ju-ia-site`): ao pedir o sinal, a mensagem termina com *"O sinal precisa cair em até 1 hora a partir de agora; passado esse prazo, o horário é liberado automaticamente"*, grava `bookings.prepay_deadline_at = agora + 1h` (migration 161) e guarda o prazo em `sinal_pendente.deadline` no estado. O push pro Juliano avisa que o horário cai sozinho sem Pix em 1h.
- **`prepay-deadline`** (function nova, cron `bdj-prepay-deadline` a cada 5 min, mesmo padrão dos outros robôs, segredo do vault): pega agendamentos com prazo vencido em que o cliente **nem declarou** o Pix (comprovante/"paguei", `prepay_declared_at`) **nem** o Juliano confirmou (`prepay_confirmed_at`), e que ainda não começaram. Cancela com anotação no agendamento, limpa o estado da conversa (senão a JuIA seguiria achando que ele tem horário), manda ao cliente, como JuIA e sem tirar a conversa do automático: *"como o sinal de R$ 50,00 não chegou dentro de 1 hora, o horário de 18/09 às 12:00 (Luzes) foi liberado. Se ainda quiser fazer, é só me chamar por aqui que eu consulto a disponibilidade e reservo de novo. Se você já fez o Pix, me manda o comprovante que eu vejo com o Juliano"* — e avisa o Juliano por push ("se o Pix aparecer no extrato, reative pela Agenda"). Horário que já passou só tem o prazo apagado.
- **O que segura o cancelamento:** comprovante ou "já paguei" na conversa (o webhook marca `prepay_declared_at`), ou a confirmação do Juliano no painel. Cliente que paga em silêncio e ninguém confere em 1h perde o horário — o risco é assumido pela regra, e a mensagem de liberação já diz como reativar. Sem guarda de silêncio das 20h: é consequência direta de uma conversa de uma hora antes.

Deploy via CLI (`prepay-deadline` v1 com `verify_jwt=false` no config.toml, como todo cron; `ju-ia-site` sem mudança de `verify_jwt`). Smoke test: function sem segredo = 401, disparo manual pelo cron com o segredo = 200 sem candidatos, JuIA respondendo preço de Luzes; sessões `deploy-check-v29.200.0-*` apagadas. Sem mudança no site nem no admin, sem cache. Testes automáticos não cobrem a function (Deno), como as demais.

## 29.199.1 — Sinal com o valor certo em todas as mensagens (caso Murillo), e o cancelamento do Teddy (17/09, começo da tarde)

**Pedido do Juliano (17/09/2026, ~12h25, print do WhatsApp):** "ache o erro e corrija, e tem mais: vou confirmar lá o Pix dele, a mensagem tem que sair com valor certo". O Murillo pagou o sinal de R$ 50 às 12h22 (comprovante do C6 com R$ 50,00 legível) e a JuIA respondeu *"Vou passar pro Juliano conferir o Pix de R$ 190,00"* — o total do platinado, não o sinal.

**Causa:** o sistema só conhecia Pix antecipado do serviço INTEIRO. O fluxo de comprovante (`whatsapp-webhook`), a confirmação do Pix pelo painel (`prepay-confirm` + `_shared/pix-confirmado.ts`), o cupom (`_shared/comprovante.ts`, montado em `satisfaction-dispatch`) e o Concluir do admin usavam `service_price + products_price` como "o que foi pago". Não existia onde guardar o valor de um sinal.

**Correção (migration 160 + 4 functions + admin):**
- **`bookings.prepay_amount`** (nova): valor do Pix antecipado quando é sinal. Nulo = Pix cobre tudo (comportamento antigo). O agendamento do Murillo já saiu com 50 gravado.
- **JuIA** grava `prepay_amount = 50` ao pedir o sinal de química (v29.199.0 só marcava a chave).
- **Comprovante recebido (`whatsapp-webhook`):** o valor esperado é o do sinal quando o agendamento tem `prepay_amount`, ou quando o comprovante lido na imagem mostra um valor claramente parcial (entre R$ 20 e o total) — nesse caso o sinal fica gravado no agendamento pra tudo o que vem depois bater. Resposta: *"conferir o Pix de R$ 50,00 (sinal) … o restante, R$ 140,00, você acerta no dia"*. O push pro Juliano e o aviso de divergência também comparam com o valor esperado, não com o total.
- **Pix confirmado (`prepay-confirm`):** a mensagem sai com o valor do sinal e o que falta: *"o seu Pix de R$ 50,00 (sinal) foi recebido. Seu horário está garantido … O restante, R$ 140,00, você acerta no dia do atendimento."* Depois do horário: *"(sinal) foi recebido e já está abatido do atendimento de hoje"*. Sem sinal, os textos da v29.163.0 continuam iguais.
- **Cupom:** o total continua o total; entram as linhas *"Sinal pago antes, no Pix: -R$ 50,00"* e *"Restante de R$ 140,00 pago no débito"* (a forma escolhida no Concluir). Sem isso o cupom diria "Pago no Pix (pago antecipado)" pro serviço inteiro.
- **Concluir (admin):** o aviso passa a dizer *"já pagou sinal de R$ 50,00 no Pix … escolha a forma como ele pagou o resto"*, e o "já pago" do total a cobrar usa o sinal, não o preço do serviço.

**Erro meu no fluxo de publicação, registrado:** o commit desta versão saiu com o e2e marcando 1 falha que eu não tinha lido — o comando de commit rodou em cima do resultado sem checar o exit. A falha era do próprio navegador de teste ("browser has been closed" em routes.spec, crash do Chromium headless), não do código; rodei o arquivo de novo e passou (4/4). Fica a regra: ler o resultado ANTES do commit, sempre.

Testes: 3 unitários novos em `pix-confirmado.spec.js` e 3 em `comprovante.spec.js` (antes/depois do horário, sinal que cobre tudo, comportamento antigo intacto). `npm test` verde: 153 unit + 51 e2e. Deploy via CLI das quatro functions com `verify_jwt` como estava (`ju-ia-site` true, `prepay-confirm` true, `whatsapp-webhook` false, `satisfaction-dispatch` false); smoke test logo após (OPTIONS 200 nas quatro, mensagem de site respondida, `prepay-confirm` sem token = 401), sessões `deploy-check-v29.199.1-*` apagadas. Cache: `admin-v15-4-agenda.js` e `core.js` `?v=29.199.1` nas 6 páginas; `ADMIN_VERSION` + `admin-version.json` em 29.199.1.

**Teddy (luzes, amanhã 12h):** o Juliano mandou o pedido de sinal às 12h10 e às ~12h35 pediu pra cancelar. Ponderei que 25 minutos sem prazo dito não sustenta a regra e propus prazo até as 18h; ele decidiu ("18h eu perco o agendamento de amanhã 12h30") e mandou cancelar e avisar. Feito: reserva cancelada com anotação, mensagem enviada pelo sistema em nome dele (*"como o sinal por Pix para garantir a vaga não foi feito, o horário de amanhã às 12h foi liberado; se mudar de ideia, é só me avisar que eu consulto a disponibilidade antes de você fazer o Pix"*), estado da conversa limpo pra JuIA não achar que ele tem horário. Registro de propósito: a regra do sinal nasceu hoje e o primeiro cancelamento por ela veio 25 minutos depois do pedido — daqui pra frente o pedido de sinal deve sair com prazo explícito (a JuIA ainda não diz prazo; fica como pendência).

## 29.199.0 — Sinal de R$ 50 pelo Pix para química em primeira visita: regra da casa, na JuIA (17/09, começo da tarde)

**Como nasceu (17/09/2026, ~12h):** a JuIA reservou Luzes (R$ 120, 100 min) pra amanhã às 12h pra um cliente novo, de DDD 12, e o Juliano mandou a foto de perfil dele dizendo que não sentiu confiança e perguntou o que fazer. **Recusei ajudar a barrar cliente pela aparência** — além de injusto, é o tipo de coisa que vira avaliação de 1 estrela ("me recusou por causa da minha aparência") e problema com o Código de Defesa do Consumidor, e a nota 5,0 com 108 avaliações é o maior patrimônio da casa. O risco real ali é outro: horário longo, com produto, de quem nunca veio — e esse risco se resolve com regra igual pra todo mundo. Propus o sinal; ele aprovou ("gostei desta regra") e pediu o mesmo pro outro cliente novo de amanhã com química.

**Regra (vale pra qualquer cliente novo, sem exceção):** serviço com `upsell_tag = 'quimica'` (Luzes, Nevou / Platinado, Pigmentação Capilar, Alisamento) em cliente com zero atendimentos concluídos no sistema → o horário é reservado com **sinal de R$ 50 pelo Pix**, descontado do valor no dia. Sem liberação automática: se não cair, a decisão de cancelar é do Juliano.

**Na JuIA (`ju-ia-site`, deploy via CLI, `verify_jwt` inalterado):** a própria mensagem de "Reservado!" já traz o pedido do sinal com a chave certa (e-mail `contato@barbeariadoju.com.br`, nome "Juliano Bruno Lopes Padilha", instituição PicPay), substitui a linha passiva "se preferir já deixar pago", marca o Pix pendente no agendamento (`prepay_key`) e avisa o Juliano por push ("Pedi sinal de R$ 50"). Se o cliente pedir a chave de novo, o valor que sai é o **do sinal**, com o restante explicitado ("o restante, R$ 140,00, você acerta no dia"), não o total. Estado da conversa guarda `sinal_pendente` (valor, agendamento, data, hora).

**Feito na mão hoje, antes da regra entrar:** mensagem de pedido de sinal enviada pelo sistema (`whatsapp-send`, em nome do Juliano, 12h16) pro cliente novo de amanhã 13h45 (Corte + Nevou / Platinado, R$ 190); a conversa dele ficou em atendimento humano, como toda mensagem manual. Pro cliente das Luzes o Juliano manda ele mesmo, com o texto que passei (a chave por telefone (11) 96707-3038 também é Pix, confirmado por ele).

**Erro meu no caminho, registrado:** na primeira versão do texto que passei pro Juliano eu afirmei que a chave era o telefone sem ter conferido — a JuIA sempre usou o e-mail. Ele confirmou que o telefone também é chave, então não houve dano; a lição é que dado de pagamento se lê no código antes de escrever.

Smoke test em produção logo após o deploy (duas mensagens de site, 200 e resposta certa), sessões `deploy-check-v29.199.0-*` apagadas. Sem mudança no site, sem cache. Testes unitários e e2e não cobrem a function (Deno), como antes.

**Também nesta sessão:** contagem de avaliações no Google atualizada no CLAUDE.md e na memória — **108 avaliações, nota 5,0** (eram 81 em 16/08).

## 29.198.2 — Avaliações Google: aprovar já publica (caso Mauricio Lamberti, 17/09, meio-dia)

**Pedido do Juliano (17/09/2026, ~11h55):** "tem uma avaliação nova no Google, chegou notificação do nosso sistema com resposta legal, eu aprovei, mas não foi publicada".

**O que aconteceu:** a avaliação (Mauricio Lamberti, 5 estrelas, "Lugar muito top, e atendimento de primeira!") entrou às 21h20 de 16/09 e ele aprovou o rascunho às 21h20 pela tela que a notificação abre. A resposta ficou parada em *aprovado*: desde a v28.33.0 publicar era um **segundo botão** ("Publicar no Google") no mesmo cartão, separado do "Aprovar" de propósito, pra garantir em código que o sistema nunca publica sozinho. Só que a decisão humana que essa regra exige é a aprovação — o segundo clique era só atrito, e passou batido.

**Feito agora:**
- Publiquei a resposta aprovada dele no Google pelo Windsor (`reply_to_review`, 14h58 UTC) e marquei a avaliação como publicada no sistema. Texto exatamente o que ele aprovou.
- **"Aprovar" virou "Aprovar e publicar"** (`admin-avaliacoes-v28.js`): o mesmo clique grava a aprovação e chama a `google-reviews-publish`. Se o Google recusar, a resposta fica aprovada com o motivo no cartão e o botão "Publicar no Google" continua lá pra tentar de novo — nada se perde. A função de publicação não mudou: continua exigindo admin autenticado e continua sendo o único ponto que escreve no Google.
- Teste e2e novo (`admin-avaliacoes-aprovar.spec.js`): aprovar uma avaliação pendente dispara a chamada à função de publicação. `npm test` verde: 147 unit + 51 e2e.

Cache: `admin-avaliacoes-v28.js?v=29.198.2`. Sem banco, sem `ADMIN_VERSION` (a tela de avaliações não passa pelo reload automático do painel).

## 29.198.1 — Remarcar zera o pedido de confirmação de presença (caso Levi, 17/09, meio-dia)

**Pedido do Juliano (17/09/2026, 11h50, print do WhatsApp):** "JuIA não confirmou este rapaz que eu tinha remarcado". Levi tinha horário em 10/09 às 16h, confirmado pela JuIA no dia 9. No dia 10 o Juliano remarcou pelo painel pra 17/09 às 16h. No dia 16 o robô das confirmações não pediu nada, e ele mesmo mandou "passando pra confirmar seu horário hoje às 16hs".

**Causa:** nenhum dos três caminhos de remarcação (painel, JuIA, link do site) zerava `confirmation_requested_at` / `confirmed_at`. O agendamento carregava o "já pedi, já confirmou" da data antiga, e a seleção do robô exige pedido ainda não feito — então pulava. Conferido no banco: hoje só o Levi estava nessa situação entre os futuros, mas todo remarcado pra mais de um dia à frente cairia nela.

**Correção (migration 159, só banco, sem cache):** um gatilho em `bookings` — mudou data ou hora e o agendamento segue vivo → zera os três campos de confirmação e marca `rescheduled_at`. Horário novo em até 36 h: `confirmed_at` = agora (quem acabou de combinar o horário já confirmou presença de fato, o robô não pergunta de novo); mais longe: fica nulo e o pedido do dia anterior volta a valer. A função de seleção passou a olhar também o `rescheduled_at` na regra das 36 h, pra um remarcado pra amanhã não ganhar pedido por ter `created_at` antigo. Testado numa transação descartada com o próprio agendamento do Levi: remarcado pra 7 dias → pedido zerado, sem confirmação, fora da fila nas primeiras 3 h; remarcado pra amanhã → confirmado na hora e fora da fila. Nada gravado; o Levi de hoje ficou como o Juliano deixou.

## 29.198.0 — Ficha de cliente novo não era criada há 19 dias (caso Maurício Amorin), "Como foi feito" cria a ficha sozinho, e as caixinhas de serviço do admin passam a respeitar as famílias (17/09, manhã)

**Pedido do Juliano (17/09/2026, "plano do dia"):** "fui concluir o do Maurício, apareceu [um aviso] mas o Como foi feito… não consegui ler, eu escrevi como foi feito mas não sei o que houve". E: "quando vou concluir posso colocar 2 cabelos, 2 barbas, ele não entende a redundância — quando eu selecionar barba na navalha, desselecionar a Barba Express; com ozônio, desselecionar Express e navalha; o mesmo com o corte: pezinho que já tá incluso, corte com lavagem etc."

**O que aconteceu com o Maurício (1ª visita, agendou pelo site):** o aviso que ele não conseguiu ler era *"Atendimento concluído, mas o 'Como foi feito' NÃO foi salvo no cadastro: cadastro não encontrado"*. O atendimento em si foi concluído certo (R$ 65, débito, caixinha R$ 5); só a anotação de estilo se perdeu — e o texto não tem como recuperar, foi só na tela. **A anotação precisa ser digitada de novo** (Clientes › Maurício Amorin › Preferências de estilo, ou no próximo Concluir dele).

**A causa era maior que o Maurício.** A RPC `admin_set_customer_style` (v29.195.0, ontem) só atualiza ficha existente, confiando que "o admin já cria a ficha ao abrir" — e essa criação estava **quebrada desde a v29.98.0 (29/08)**: naquela versão o upsert do painel passou a usar `on_conflict=phone_key`, mas o índice único de `phone_key` é **parcial** (`where phone_key is not null`), e o Postgres recusa a inferência do ON CONFLICT em índice parcial (erro 42P10, *"there is no unique or exclusion constraint matching the ON CONFLICT specification"* — reproduzido com `explain insert … on conflict (phone_key)`). O erro ia pro `console.error` e ninguém via. Resultado: **17 clientes novos de site/JuIA desde 29/08 sem ficha** (Amanda, Breno, Bruno Brasiliano, Danilo, Fabrício, Gabriel, Guizo, Jessica, João Eduardo, Junior, Kennedy, Maurício, Murillo, Renatinho, Venilson, Vitor, Vytor) — sem ficha não existe "já avaliou no Google", estilo, aniversário nem observações; a fidelidade e a pesquisa seguiram por telefone, mas o cadastro em Clientes vinha só do agendamento. Erro meu de 29/08, registrado como manda a casa: troquei a chave do upsert sem conferir que o índice aceitava inferência, e o teste e2e não pega porque o mock do Supabase aceita qualquer POST.

**Correção (migration 158 + painel):**
- **`admin_sync_customer_profiles()`** (RPC nova): a sincronização sai do navegador e vira SQL no servidor, `insert … on conflict do nothing` (sem inferir índice), uma ficha por chave de telefone com o nome do agendamento mais recente. O painel chama ao carregar (`loadBaseData`, admin-v15-4-core.js) e só recarrega a lista se criou alguma. **Rodei o mesmo insert na hora: as 17 fichas já existem**, o Maurício incluso.
- **`admin_set_customer_style`** ganhou `p_name` e **cria a ficha quando não existe** (nome do agendamento; sem nome, "Cliente"). Ficha arquivada passa a ser aceita em vez de recusada (é a mesma pessoa). Concluir e Balcão mandam o nome. Sem `anon`/`public` nas duas funções, igual à regra da 157.

**Caixinhas de serviço com a regra das famílias (Concluir, Editar, Balcão e Novo agendamento):** a regra do Juliano de 22/08 (1 corte + 1 barba; Barboterapia/navalha/Express são alternativas; combo "Corte + X" já inclui as duas; pezinho já vem no corte; única exceção pai e filho) já valia no carrinho do site e na JuIA — a fonte única `assets/js/service-rules.js` — mas nunca nas caixinhas do admin, que deixavam marcar tudo. Agora um clique ajusta as outras caixinhas e explica numa linha embaixo da lista:
- marcar **Barba na navalha** desmarca a Barba Express (e vice-versa); marcar **Barboterapia com ozônio** desmarca a que estava;
- marcar **Corte + Lavagem** (ou Raspar a cabeça, ou um combo) desmarca o Corte de cabelo solto; marcar um combo **"Corte + X"** desmarca corte e barba soltos;
- **pezinho** em cima de um corte não entra ("«Corte de cabelo» já inclui o pezinho"); corte em cima do pezinho tira o pezinho;
- **corte infantil + corte adulto** continuam juntos (pai e filho);
- **combo marcado + clique numa barba diferente:** o combo se desmonta e a barba troca ("«Corte + Barba Express» virou «Corte de cabelo» + «Barboterapia…»") — aqui o admin difere do site de propósito: no site a resposta é "não precisa adicionar", no admin o clique é a palavra dele, é o que ele viu fazer.
- Desmarcar nunca mexe nas outras. Sem a regra carregada (módulo ES falhou), as caixinhas funcionam como antes — nunca é motivo pra tela quebrar.

Implementação: função nova `toggleServiceSelection` na fonte única (9 testes unitários novos, 32 no arquivo), e a ponte `admin-service-rules-v30.js` (`<script type="module">` nas 7 páginas do admin) que expõe o módulo como `window.BDJ_SERVICE_RULES` pros scripts clássicos — os pickers só ligam um `change` no container. A cópia TS do `_shared` não muda: a regra em si é a mesma, só a função de clique é do admin.

Cache: `?v=29.198.0` em core, agenda, agendamento e balcão nas 7 páginas + ponte; `ADMIN_VERSION` e `admin-version.json` em 29.198.0 (os dois juntos, regra da v29.99.0).

**Achado no caminho (teste e2e novo pegou):** o picker de Novo agendamento e o do Balcão ligavam o `change` de novo a cada `renderAuth`/`show()` (sessão inicial + evento de auth): o innerHTML renovava as caixinhas, mas o container é o mesmo elemento e acumulava um segundo listener — a regra rodava duas vezes e a segunda passada apagava a explicação. Antes era invisível (só recalculava o total duas vezes). Os dois ligam uma vez só agora (`dataset.ruleBound`).

Testes: 9 unitários novos em `service-rules.spec.js` e 2 e2e novos em `tests/e2e/admin/admin-regra-familias.spec.js` (provam que a ponte carrega na página real e que os cartões reagem ao toque, no Novo agendamento e no Balcão). `npm test` verde: 147 unit + 50 e2e.


## 29.197.0 — Três casos reais revisados por pedido do Juliano: saudação seca, dois cortes assumidos por engano, cobrança redundante de quem avisou que ia viajar (17/09, manhã)

**Pedido do Juliano (17/09/2026):** "JuIA vacilou demais nestas duas mensagens, precisamos arrumar ela pra não errar de novo" — com prints de duas conversas reais do WhatsApp e a orientação "olha como eu conduzi e tente ensinar ela a não errar mais".

**Caso 1 — Frei Bartolomeu Schultz (17/09, 08h43–08h48):** ele abriu com "Bom dia" / "Paz e bem!" e a JuIA respondeu seco, ecoando a frase: *"Paz e bem. Como posso ajudar?"* — sem calor nenhum. Na sequência ele perguntou de forma genérica "Como estão seus horários" (sem citar serviço nenhum) e a JuIA assumiu o "de sempre" dele errado: *"Perfeito! Anotei Corte de cabelo + Corte + Lavagem + Sobrancelha Masculina — R$ 105,00"* — **dois cortes na mesma reserva**. O Juliano assumiu na mão ("minha IA tá desconfigurada... sou o Ju"), confirmou certo o combo real dele (Corte + Lavagem + Sobrancelha, R$ 65) e fechou pra amanhã 18h.

**Causa do duplo corte:** o último atendimento concluído dele foi *"Corte + Lavagem + Sobrancelha Masculina"* — um combo real, válido. Pra virar "serviço de sempre" a JuIA quebra essa string por "+", mas o quebrador ingênuo (`lastServiceName.split(/\s*\+\s*/)`) não sabe que "Corte + Lavagem" É um item do catálogo com "+" no próprio nome — ele parte em três pedaços soltos: "Corte", "Lavagem", "Sobrancelha Masculina". O pedaço órfão "Lavagem" não casa nada sozinho, cai no `findService` por substring e volta achando o combo INTEIRO "Corte + Lavagem" (porque contém a palavra "lavagem"); o pedaço órfão "Corte" acha "Corte de cabelo" à parte. Dois serviços de corte, R$ 105 em vez de R$ 65 — a mesma família de bug que a regra do Juliano de 22/08 (só 1 corte por atendimento) deveria impedir, mas essa trava só rodava em cima do que o CLIENTE cita na conversa, nunca em cima do "de sempre" montado do histórico.

**Correção (`ju-ia-site` v261, `verify_jwt=true` igual ao anterior):**
- O "de sempre" agora usa `splitServiceNames` — a mesma função (já testada, já usada no resto do arquivo) que separa combos com "+" tentando o pedaço mais longo primeiro, então recompõe "Corte + Lavagem" como uma unidade só antes de sobrar "Corte" desgarrado. Rede de segurança extra: o resultado passa por `normalizeServiceSet` (a mesma normalização de família usada em "chosen" ao vivo) — mesmo se algum outro histórico antigo tiver dois serviços de corte de verdade, só o mais completo fica.
- Saudação fora do "oi/bom dia" comum (Paz e bem, Salve, Axé…) ganhou instrução própria no prompt: nunca ecoar a frase e emendar direto "Como posso ajudar?" — responder com calor de verdade, citando nome ou histórico quando souber.

**Caso 2 — Maurício Lamberti (16→17/09):** às 20h51 ele escreveu "Como disse, volto de viagem de férias em 1 mês e marcamos novamente... Muito obrigado" — e o lead ficou ativo, porque nenhuma das frases de "cliente adiou" reconhecia viagem/férias (só "semana que vem", "ainda não sei" etc.). Às 8h do dia seguinte o cron cobrou de novo: *"seu horário pra Barba Express ainda NÃO ficou reservado... me diz o dia e o horário"* — batendo em cima de quem já tinha avisado a noite inteira antes. Ele teve que repetir o aviso ("Bom dia! Daqui um mês marcamos... Estou saindo de férias..."), e o Juliano ainda entrou pra pedir desculpa por uma cobrança que nem devia ter saído.

**Correção (mesma function):** viagem e férias entram na lista de "cliente adiou, sai do funil" — regex nova cobre "saindo de férias... daqui um mês marcamos" e variações, com a janela de busca tolerando reticências (a frase real tinha três "...", que cortavam a busca original por "+.!?"; agora só "!" e "?" fecham frase aqui). Confirmado por leitura + simulação isolada com o texto exato dos dois casos reais (offline, `node`, mesma função `normalize` do arquivo) — não testado ao vivo pra não recontatar clientes reais.

**⚠️ Erro meu no meio do caminho, registrado como manda a casa:** o primeiro deploy usou `splitServiceNames` sem importar a função — `ReferenceError: splitServiceNames is not defined`, e como ela roda em toda mensagem (não só no caminho do "de sempre"), a function INTEIRA saiu do ar (500) por cerca de 23 segundos (12h05:18 a 12h05:41 UTC). Pego pelo meu próprio teste de fumaça em produção, não por cliente — conferido nos logs e no banco: zero mensagem de WhatsApp ou do site chegou nessa janela. Import corrigido, redeploy, os três testes (saudação, agendamento normal, "já cortei fora") voltaram 200 com resposta certa. **Lição:** daqui pra frente, depois de qualquer deploy do `ju-ia-site`, o primeiro request de checagem sai ANTES de qualquer outra coisa, não depois.

`npm test` verde: 138 unit + 48 e2e, antes e depois do deploy. Sessões `deploy-check-v29.197.0-*` apagadas do banco.

## 29.196.4 — Perfil do Google: mais 4 fotos, retocadas a pedido do Juliano (fachadas com o horário corrigido na placa, café com Wi-Fi mascarado, cadeira e balcão sem cabo/tomada/bagunça) (16/09, noite)

**Pedido do Juliano (16/09/2026, noite):** "as da fachada você pode fazer uma correção na arte e aproveitar", "do cantinho do café dá uma maquiada na senha do wifi", "da cadeira com balcão some com este cabo e tomada, notebook, papel, tudo o que te incomodar" — "e aproveitamos todas".

**Feito (Pillow + OpenCV, sem IA generativa, arquivos em `assets/gbp/`):**
- **Fachada de frente e fachada de perto:** as duas linhas de horário da placa foram reescritas — "08H00 ÀS 19H00" e "08H00 ÀS 15H00" — com fundo amostrado da própria placa (mantém o gradiente), fonte condensada parecida (Bahnschrift Bold Condensed) e leve desfoque pra casar com a foto. O resto da placa (mustache, "TERÇA A SEXTA", "SÁBADO", "FECHADO", telefone) é o original. Publicadas como EXTERIOR.
- **Cantinho do café:** o QR do Wi-Fi e a linha "Senha …" do cartaz foram pixelados (o QR também codifica a senha). Pix e Instagram ficaram. INTERIOR.
- **Cadeira com balcão:** cabo, plugue e tomada da parede removidos por inpainting; álcool em gel, lenço, porta-cartão e caixinha do balcão substituídos pela parede lisa (gradiente amostrado da faixa limpa ao lado). INTERIOR. **O notebook ficou:** a parede de ripas atrás dele não reconstruiu de forma convincente em três tentativas (borrão ou emenda visível no zoom) — decidi publicar com o notebook, que é um objeto normal de bancada, em vez de uma parede falsa. Se quiser sem ele, é refazer a foto com o notebook fechado.
- **Fachada em ângulo: ficou de fora.** A placa tem um reflexo forte (faixa clara vertical) que atravessa as linhas do horário; a detecção das linhas falhou três vezes e o texto novo saiu cortando "TERÇA A SEXTA". Sem garantia de resultado limpo, não publiquei. As duas fachadas de frente cobrem a necessidade.

Total do dia no perfil: 7 fotos (3 na primeira leva + 4 nesta). Sem código, sem cache.

## 29.196.3 — Fotos do perfil do Google pela API (3 novas, 5 reprovadas no crivo) e regra da placa de horário antiga (16/09, noite)

**Pedido do Juliano (16/09/2026, noite):** "vou tirar umas fotos, você escolhe as melhores e publica". Mandou 8.

**Publicadas no perfil (Windsor `upload_media`, hospedadas em `assets/gbp/`):** ambiente visto da entrada (sofá, poste, cadeira, logo na parede — categoria INTERIOR), cadeira com espelho aceso, bancada e geladeira (INTERIOR), prateleira de produtos (ADDITIONAL — `PRODUCT` deu 400). **Reprovadas:** (1) cadeira com o balcão da recepção — cabo com etiqueta 220 V e tomada em primeiro plano, notebook aberto, bancada com bagunça; (2) cantinho do café — o cartaz de avaliação ao lado traz a senha do Wi-Fi legível em zoom, não vai pra galeria pública; (3–5) as três da fachada — **a placa física ainda mostra 8h30–18h e sábado 8h30–14h**, e o perfil diz 8h–19h / 8h–15h; foto oficial contradizendo o horário do perfil é pior que foto nenhuma (a `assets/fachada.jpg` do site é a versão corrigida digitalmente). Sugestão dada: trocar a placa junto com a plaquinha do reajuste que já está encomendada.

**CLAUDE.md, seção 4:** a armadilha do upload de foto foi reescrita — trava só pela tela; pela API funciona, com o passo a passo e as regras do crivo. Sem código, sem cache.

## 29.196.2 — Termos reais de busca (Search Console + Google Meu Negócio) aplicados nos títulos: Barboterapia de volta ao título do artigo, home "Barbearia em Bragança Paulista", FAQ da hora marcada, rosto redondo, barba reta, valor das luzes (16/09, noite)

**Pedido do Juliano (16/09/2026, noite):** o Gemini sugeriu pegar os termos mais buscados e usar como título de páginas/seções pra ranquear melhor; ele citou "barboterapia" como chute. Depois: "veja se consegue aproveitar outros títulos também".

**De onde vieram os termos (dados, não achismo):** (1) Search Console, propriedade `sc-domain:barbeariadoju.com.br`, últimos 3 meses (10/07–14/09), aberto pelo Chrome dele — 258 consultas, 5,57 mil impressões, 103 cliques, CTR 1,9%, posição média 7,2; lidas as 60 primeiras por impressões; (2) Google Meu Negócio pelo Windsor (`search_keyword`, 6 meses) — o que digitam no Maps: "barbearia", "barbearia bragança paulista", "barbearia perto de mim", "barbeiro", "cabeleireiro", "barbearia do ju"; ninguém procura serviço pelo nome no Maps.

**Top 10 do Search Console por impressões (cliques · impressões · posição):** barbearia do ju 42·558·2,0 · barbearia bragança paulista 1·507·7,3 · barbearia perto de mim 1·169·6,6 · barbearia 1·129·5,9 · barbearia em bragança paulista 1·102·8,5 · barbeiro bragança paulista 2·90·6,4 · barbearia bragança paulista perto de mim 1·72·8,2 · barbearia com hora marcada 0·57·11,4 · o que é barboterapia 0·45·20,5 · barboterapia o que é 0·39·10,4. Na sequência: barbearia bragança 36, barbeiro 35, cortes para rosto redondo masculino 25, barba falhada 25, pigmentação de barba 25 (posição 15), rosto redondo masculino 20, barba reta 13, valor do corte 11, valor para fazer luzes no cabelo masculino 11, barboterapia 11 (posição 38).

**O chute do Gemini acertou, e a causa é nossa:** as buscas "barboterapia" caíam em `blog-barboterapia.html` (99 impressões, posição 18, zero clique) — e o artigo tinha PERDIDO a palavra do título quando o serviço sem ozônio foi renomeado pra "Barba na navalha com toalha quente" (v29.104). O Google ainda mandava gente pra lá, mas o título não dizia mais o que a pessoa digitou.

**O que mudou (só HTML, sem JS/CSS, sem cache):**
- `blog-barboterapia.html`: título, H1, og/twitter, JSON-LD e breadcrumb voltam a começar com **"Barboterapia: o que é e por que vale a pena"**; o primeiro parágrafo define o termo ("Barboterapia é o nome pelo qual muita gente conhece a barba feita na navalha com toalha quente") e nomeia as duas versões da casa (sem ozônio = Barba na navalha com toalha quente; com ozônio = Barboterapia com vaporizador de ozônio). Os 10 arquivos que linkavam com o título antigo ganharam o novo. URL igual.
- `index.html`: `<title>` de "Barbearia do Ju — Centro de Bragança Paulista | Hora Marcada" para **"Barbearia em Bragança Paulista com hora marcada | Barbearia do Ju"** (a busca de 700+ impressões com CTR de 0,2% é exatamente "barbearia (em) bragança paulista"; o título agora começa com o que a pessoa digitou). H2 "Funcionamento" virou "Funcionamento: barbearia com hora marcada".
- `perguntas-frequentes.html`: pergunta nova "A Barbearia do Ju é uma barbearia com hora marcada?" (HTML + FAQPage, 24 perguntas) — "barbearia com hora marcada" tinha 57 impressões na posição 11 e nenhuma página respondia com essas palavras.
- `blog-melhor-corte-rosto-redondo.html`: H2 "Cortes para rosto redondo masculino: o que costuma funcionar bem" (a família "rosto redondo" soma ~80 impressões entre 5 variações, posição 7–10).
- `blog-formato-barba-ideal.html`: seção nova "Barba reta: o pedido mais comum, e quando ela funciona" (13 impressões, sem seção que falasse disso).
- `servico-luzes-masculinas.html`: a pergunta do FAQ virou "Qual o valor para fazer luzes no cabelo masculino?" (é a frase buscada; preço inalterado).

**Decidido contra a recomendação do Gemini:** NÃO criar páginas novas pra "barbearia perto de mim", "barbearia aberta agora", "barbearia centro" — são buscas de proximidade que o Google resolve pelo Maps (GBP), e página por bairro/cidade é doorway (seção 5 do CLAUDE.md). Também não criar página só pra "barba falhada"/"pigmentação de barba": já existem artigo e página de serviço posicionados; o ganho ali é link interno e tempo, não página nova. "luzes masculinas mogi das cruzes" (34 impressões) é outra cidade — ignorado.

**Como medir:** Search Console, mesmas 10 consultas, daqui a 4 semanas (14/10): CTR de "barbearia bragança paulista" (hoje 0,2%) e posição de "o que é barboterapia" (hoje 20). `npm test` verde: 138 unit + 48 e2e.

## 29.196.1 — Citações locais: os cadastros já existiam; o pacote virou roteiro de conferência, e o Guia de Bragança está com o número errado (16/09, noite)

**Correção do Juliano (16/09/2026, logo depois do resumo do dia de folga):** "citações locais já temos cadastro em tudo isso". A seção 6 do `CLAUDE.md` dizia "nenhuma citação local foi criada" — estava errada, e eu montei o pacote da frente 1 em cima dela. **Erro meu de premissa:** deveria ter conferido de fora antes de escrever "criar".

**Conferido de fora no mesmo dia:** o Guia de Bragança tem a ficha (`/clientefree/barbearia-do-ju/`) com **"rua Antonio da Cruz n°481"** — o certo é Rua Dr. Antônio da Cruz, **482** —, telefone certo, e sem CEP, horário, site, descrição e foto. Endereço divergente entre diretórios pesa mais no SEO local do que ficha ausente. Bing não mostra painel local na busca; Apple, Solutudo e o detalhe do Facebook não dá pra ver sem login.

**O que mudou (só documentação, sem código, sem cache):** `SEO-CITACOES-PACOTE.md` reescrito de "criar" para "abrir cada ficha e igualar campo a campo", com a tabela do que foi visto e o Guia de Bragança em primeiro no checklist (~30 min); `CLAUDE.md` seção 6 corrigida com aviso pra não propor "criar citações" de novo; memória do projeto atualizada.

## 29.195.2 — Reunião de Tag Implementation com o Google (16/09, 15h): o que mudou fora do repo, o que foi conferido, política de privacidade atualizada

**O que o suporte do Google fez com o Juliano (GTM + GA4, fora do repositório):** conversões otimizadas do Google Ads na tag de conversão `booking_confirmed` — duas variáveis de JavaScript personalizado (e-mail e telefone) lidas da página na hora do evento e a variável "dados fornecidos pelo usuário" ligada à tag; versão do container publicada. No GA4: coleta de dados toda ativada; conferido que o evento `booking_confirmed` chega e que a conversão "Reservar o horário" está ativa e importada no Google Ads com valor (é a que otimiza os lances). O técnico confirmou que os dados estão na mesma página do evento. Pergunta do ajuste de lance por dia/hora (quarta e quinta de manhã) é da equipe de Ads — Juliano mandou e-mail pro Henrique.

**Conferido aqui:** `agenda-v15.js` dispara `booking_confirmed` (linha `fire(...)`) ANTES de trocar o bloco de status, e o formulário continua no DOM depois — as variáveis do GTM que leem `#agenda-email`/`#agenda-phone` funcionam. Isso virou decisão registrada no `CLAUDE.md` (seção 5): esses ids e a ordem do disparo não mudam sem avisar; e-mail/telefone NUNCA vão pro `dataLayer` (a tag do GA4 mandaria junto — PII no GA4 viola a política do Google).

**Testes da equipe de qualidade do Google:** dois agendamentos "teste" (teste@gmail.com, 15h20 e 15h30) — o Juliano cancelou e apagou na hora; sobraram dois cadastros "teste" em `customer_profiles` (sem reserva, sem WhatsApp enviado, sem fidelidade), arquivados agora. E-mails de confirmação/cancelamento foram pro teste@gmail.com (inofensivo). Eles avisaram que podem fazer mais testes assim, sempre com "teste" no nome.

**Política de privacidade (`privacidade.html`):** a seção "Cookies e métricas" dizia que só o identificador anônimo, valor e serviços iam ao Google — ficou incompleta com as conversões otimizadas. Parágrafo novo: com cookies de marketing aceitos, e-mail e telefone do agendamento vão ao Google Ads criptografados (hash irreversível), só pra medir que o anúncio virou agendamento; com "somente essenciais", nada vai. Data de atualização: 16/09/2026. Só HTML, sem bump de cache.

## 29.196.0 — Dia de folga: citações locais prontas pra copiar, auditoria técnica do site, revisão da JuIA, revisão de segurança (RPCs internas fechadas pro anônimo) e artigo sobre sobrancelha (16/09, fim da tarde)

**Pedido do Juliano (16/09/2026):** `/dia-de-folga` sem argumento — as cinco frentes, na ordem.

### 1. Citações locais (precisa da mão dele)
`SEO-CITACOES-PACOTE.md` na raiz: dados oficiais (NAP idêntico ao GBP, CEP 12900-350 conferido no JSON-LD da home), horário, descrição curta (243 caracteres) e longa (≤ 750), as 5 fotos conferidas uma a uma (três de ambiente — a mais vista no GBP —, fachada e o trio café/espelho/toalha), logo, e um bloco pronto por diretório (Apple Business Connect, Bing Places, Solutudo, Guia de Bragança, Facebook) com link de agendamento e UTM `utm_medium=citation`. **Decidido contra o óbvio:** `assets/montagem-ambiente.jpg` ficou de fora — a placa da montagem tem o horário antigo (8h30–18h); a `fachada.jpg` mostra a placa corrigida. Nenhuma conta foi criada. Checklist final: 5 passos, ~40 min dele.

### 2. Auditoria técnica (52 URLs do sitemap, no ar)
Sem problema: 1.360 links internos e 0 quebrados; 52 JSON-LD válidos, 0 `AggregateRating`; 0 title/description vazio ou duplicado; canonical bate em 52/52; `lang` em todas; labels em todos os inputs; contraste do botão dourado 7,44:1 (AAA); nenhuma imagem referenciada acima de 300 KB. **Corrigido:** (a) 6 artigos de 31/07 sem `datePublished`/`dateModified` no `Article` (quanto-custa, fade, rosto-redondo, irritação, ingredientes, agendamento-JuIA) — ganharam `2026-07-31`; (b) `style.css` tinha mudado em 16/09 (v29.195.0) e 51 páginas públicas + `agendar/` + `vale-presente/` ainda pediam `29.188.1`/`29.179.0` — a armadilha da seção 4 do CLAUDE.md: `?v=29.196.0` em todas as 79 páginas; (c) `/vale-presente/` entrou no sitemap (54 URLs). **Decidido contra a recomendação:** `/precos/` continua fora do sitemap e sem link de entrada — é a página do QR code da plaquinha e anuncia o reajuste de 01/10; linkar do site contraria a regra de não anunciar o reajuste (03/09). `meu-agendamento.html` continua órfã de propósito: só abre com código+token do e-mail/WhatsApp. `produtos.html` `#modal-img` já recebe `alt` por JS (linha 330) — o apontamento era falso. **Fica em proposta:** 17 titles > 65 caracteres e 9 descriptions > 165 (o sufixo `| Barbearia do Ju` é o que estoura; cortar exige decisão editorial), `<lastmod>` só nas URLs novas, `outline:none` no `:focus-visible` de `.text-link` (css/02:331, substitui por text-shadow — aceitável). **Não conferido:** PageSpeed Insights devolveu HTTP 429 (cota diária da API anônima esgotada) nas 3 URLs, duas vezes — sem LCP/CLS/INP hoje; repetir amanhã ou pelo pagespeed.web.dev.

### 3. Revisão da JuIA (15/09 14h30 → 16/09 15h30)
Lidas as 17 conversas de WhatsApp do período (entrada, saída da JuIA e o que ele respondeu na mão) e as 8 sessões do chat do site (todas espelho do WhatsApp). Os quatro casos com defeito **já tinham virado correção hoje** — Lucas (v29.193.1), Adriano (v29.192.0), Maurício (v29.194.2) e Sr. Magno (v29.195.1); conferido que nenhuma regressou. Um caso novo:
- **José (16/09, 10h51–10h54):** "Estava ha 15:" / "dias barbudo" / "Precisei de cortar em campinas" / "Só na véspera que eu puder". A JuIA respondeu à terceira com *"Vamos marcar! Corte de cabelo — R$ 40,00 + Barba na navalha — R$ 40,00, Total R$ 80,00"* — pra quem tinha acabado de dizer que já cortou fora (e a quem o Juliano tinha respondido na véspera, na mão, "sem problema nenhum ter feito a barba em Campinas"). Causa: a regra da v29.190.0 (`jaFezFora`) só reconhecia o verbo no passado ("fiz", "cortei"); "precisei **de cortar**" ficava fora. **Correção (`ju-ia-site` v261, `verify_jwt=true` igual ao anterior):** infinitivo depois de "precisei de / tive que / acabei" e a 3ª pessoa ("cortou em outra barbearia") também contam. Conferido em produção (sessões `deploy-check-v29.196.0-*`, apagadas): "Precisei de cortar em campinas" → "Entendi, sem problema! Quando precisar de novo…"; "quero marcar corte e barba amanhã às 10h" segue perguntando qual barba (sem regressão). As duas primeiras mensagens dele (frase partida em duas, 1 min de intervalo) não têm correção possível por regra — anotado.
- Sem defeito, mas anotado: o convite de retorno das 10h00 pro Pietro saiu com o mesmo final de telefone (…4883) do Paulo Roberto, que tem horário amanhã — são números diferentes (conferido); a guarda "nunca pra quem tem agendamento futuro" está certa.

### 4. Revisão de segurança (migration 157, aplicada)
Fontes: `get_advisors` (security e performance) do Supabase, leitura das 141 migrations rastreando a última definição de cada função, grep do site e das 56 edge functions, `pg_proc` no banco.
- **CRÍTICO, corrigido hoje:** 14 RPCs `security definer` que só as edge functions (service_role) e o cron usam estavam executáveis pela chave anônima do site — que é pública. Com um telefone, qualquer um lia agendamentos futuros (`phone_upcoming_bookings`), visitas, faltas, cadência e pesquisa pendente de um cliente; e `customers_due_for_reactivation` devolvia **nome + telefone de até 100 clientes** de uma vez; `reprice_future_bookings` podia ser disparada por fora. Migration 157: `revoke … from public, anon, authenticated` + `grant … to service_role` nas 14; `alarm_summary` e `chair_day_summary` (estado do alarme e da cadeira) saíram só do anon (o painel usa sessão autenticada). Conferido antes: nenhuma é chamada pelo JS público nem pelo painel; todas as functions que as usam criam o cliente com a service_role. Conferido depois no `pg_proc`: `anon_exec=false` em todas. `phone_key` e `closing_rule` ganharam `search_path` fixo (aviso do linter).
- **Conferido e NÃO era problema** (a leitura das migrations sugeria, o banco desmentiu): `bookings_due_for_confirmation_request` e `apply_scheduled_price_changes` nunca foram executáveis por anon/authenticated; `admin_save_customer` (009) não existe mais no banco — só a `_v23`, com `is_admin()`. `admin_create_booking`/`admin_reschedule_booking`/`admin_register_walkin_visit` são executáveis por anon mas têm `is_admin()` por dentro (cosmético).
- **Corrigido, cosmético:** `whatsapp-ai/.env.example` trazia o hostname real da instância da Evolution — virou placeholder (o histórico do Git guarda; regra da seção 3 do CLAUDE.md).
- **OK:** nenhuma service_role nem chave de API no histórico do Git (só a anon nos crons, esperada); working tree sem IP/usuário; 45 tabelas com RLS ligada; `.claude/settings.json` bloqueia os testes live; 7 tabelas com RLS ligada e sem policy (bloqueadas pra anon/authenticated, acesso só por RPC — certo).
- **Em proposta (IMPORTANTE, não hoje):** (1) `ju-ia-admin` (verify_jwt=false), `send-walkin-welcome`, `admin-booking-status` e `send-push` aceitam qualquer sessão autenticada sem `is_admin()` — inexplorável hoje porque o cadastro está fechado e existe 1 conta, mas é uma conta só de distância; (2) ~30 policies `using (true)` para `authenticated` em tabelas com PII (mesma pendência do RELATORIO-AUDITORIA); (3) `ju-ia-site` identifica o backend decodificando o JWT sem verificar assinatura — seguro só enquanto `verify_jwt=true`; o teto diário de 80 mensagens é por `session_id` escolhido pelo cliente; (4) `supabase/config.toml` sem entrada pra 14 functions (`gift-card-confirm`, `prepay-confirm`, `settlement-receipt`, `whatsapp-send`…) — deploy sem flag publica com verify_jwt=false; (5) `alter default privileges … revoke execute on functions from public` pra fechar a regra da 088 na raiz; (6) faltam no repo as migrations 061–068, 071, 107–112 e 116, 12 RPCs e 11 tabelas usadas pelo código — o repo não reflete o banco; (7) `auth_leaked_password_protection` desligado; 8 FKs sem índice e 13 índices nunca usados (performance, INFO).

### 5. Artigo: `blog-sobrancelha-masculina.html`
Tema escolhido pelos dados: nas mensagens recebidas no WhatsApp desde 16/08, "barba" aparece 89 vezes e **"sobrancelha" 11** — o segundo serviço mais perguntado, e o único dos mais pedidos sem artigo (a barba tem 7). Padrão editorial da casa: datas visíveis, "Na cadeira", "Visão farmacêutica", imagem com `alt`, JSON-LD `Article` + breadcrumb, sitemap, card no `blog.html` (seção Cortes e estilo) e link de volta em `servico-sobrancelha-masculina.html`. Fontes levantadas NA FONTE (PubMed, com DOI): antropometria da sobrancelha masculina (Pietruski & Majak 2023 — traço reto, baixo, ápice nos dois terços laterais: é o argumento de não afinar nem arquear), isotretinoína oral + cera (Egido Romo 1991, Woollons & Price 1997, Prescrire 1998 — descolamento de epiderme; evitar cera), colofônio na cera depilatória (3 relatos de dermatite alérgica de contato, 1996–2020) e SBD (foliculite). Sem "abre os poros", sem "tratamento", sem preço (muda em 01/10); todo tema de pele termina no dermatologista. **Não afirmado:** qual instrumento a casa usa na sobrancelha — o texto descreve os três métodos e diz que o barbeiro combina conforme o fio, porque não conferi isso com o Juliano.

**Cache:** `style.css?v=29.196.0` em todas as páginas (79 arquivos). `npm test` verde: 138 unit + 48 e2e.

## 29.195.1 — Confirmação de presença: "1" na frente confirma mesmo com "não vou pintar" no meio; serviço tirado na frase é ajustado na reserva (16/09, 15h)

**Caso real (Sr. Magno, 16/09/2026, 15h09, print do Juliano):** ao pedido de confirmação do horário de amanhã 13h30 (Depilação orelhas + Depilação nasal + Pigmentação Capilar + Corte), ele respondeu *"1.  Mas qto o cabelo so vou cortar nao vou pintar depilacao nas orelhas e depilacao nasal ok podemos fazer"* — ou seja, **confirmo, e tirem a Pigmentação**. A JuIA respondeu *"Tudo bem, obrigado por avisar! Já liberei seu horário"* (cancelou), ofereceu outro horário hoje **com a Pigmentação dentro**, e quando ele disse "amanhã confirmado horário corte cabelo" respondeu *"Não encontrei nenhum agendamento futuro nesse número"* — porque ela mesma tinha cancelado. O Juliano assumiu na mão às 15h19.

**Causa:** no webhook, cancelar era checado ANTES de confirmar, e o regex de cancelamento (`\bnao\b|nao vou|…`) casava o "nao vou" de "nao vou pintar". O "1." na frente nem era olhado, porque o teste do número exigia a mensagem inteira ser só o número.

**Dado acertado na mão:** reserva `b3de52fb` reativada e confirmada — amanhã 13h30–15h15, Corte de cabelo + Depilação orelhas + Depilação nasal (R$ 90), sem a Pigmentação, como ele pediu e como o Juliano respondeu; estado da conversa alinhado (serviços, `completed`). Nada de vaga oferecida à lista de espera nesse meio-tempo (conferido).

**Correção (`whatsapp-webhook` v117, `verify_jwt=false` igual ao anterior):**
- Leitura da resposta virou módulo puro `_shared/confirmacao-presenca.ts` (14 testes): **número na frente decide** ("1.", "1 -", "2 por favor", "1111!!"); sem número, remarcar antes de cancelar (regra da v28.59.0) e **negação sobre serviço nunca cancela** ("não vou pintar", "sem barba", "só vou cortar") — só negação sobre vir ("não vou poder ir", "não posso").
- `servicosNegados`: cada negação vale para o PRIMEIRO serviço citado depois dela — a frase do Sr. Magno tira só a Pigmentação e mantém as depilações (o "depilação nas orelhas" vem depois do "pintar"). "Só o corte" tira tudo que não é corte. Tirar tudo não é ajuste (devolve vazio e a mensagem segue o fluxo normal).
- No "1" com serviço tirado, a reserva é ajustada na hora (`phone_change_booking_service`, a mesma RPC da troca pela JuIA) e a confirmação sai com o que fica e o valor: *"Confirmado! Te esperamos amanhã às 13:30. Anotei: fica Corte de cabelo + Depilação orelhas + Depilação nasal (cera quente) (R$ 90,00), sem Pigmentação Capilar (Tintura)."* Push pro Juliano em qualquer caso (ajustado, ou "não consegui ajustar, confira na Agenda").

**Não conferido ao vivo:** o fluxo exige pedido de confirmação pendente num WhatsApp real — a leitura da frase está coberta pelos testes com o texto exato do caso; a chamada da RPC foi conferida por leitura (é a da troca de serviço já em uso). `npm run test:unit` verde (138).

## 29.195.0 — "Como foi feito" na tela Concluir e no Balcão, com lembrete no card do próximo atendimento (16/09, tarde)

**Pedido do Juliano (16/09/2026, ~14h30, caso Tatiane):** "ontem eu fiz 2 cortes nela pra chegar neste resultado (…) pra mim seria mais fácil se tivesse como eu colocar estas observações na tela Concluir, assim no próximo atendimento viria um lembrete igual aparece os serviços: máquina 1 dos lados e 4 em cima, ou corte todo na tesoura, ou degradê alto navalhado". Antes, o único lugar era Clientes → Preferências de estilo (ninguém lembra de ir lá depois do corte), e o card do dia não mostrava nada do cadastro.

**O que mudou:**
- **Concluir** (`admin-v15-4-agenda.js`): campo "Como foi feito ✂️" logo abaixo de "Serviço realizado", já preenchido com o que está no cadastro, pra ele só ajustar. Se o texto mudou (apagar também conta), a conclusão grava via RPC nova `admin_set_customer_style` — em `customer_profiles.style_preferences`, o mesmo campo "Preferências de estilo" da tela Clientes (formato `item_1, item_2…`, separado por vírgula, ";", "·" ou quebra de linha). Falha na gravação avisa, mas não desfaz a conclusão.
- **Balcão** (`admin-balcao.html` + `admin-balcao-v29.js`): mesmo campo acima de Observações; escolher um cliente do CRM na busca já preenche com o "como foi feito" dele; salva do mesmo jeito ao registrar.
- **Lembrete no card** (`admin-v15-4-core.js` `styleReminderHtml`, usado no card da Agenda/Hoje): linha dourada "✂️ máquina 1 dos lados, máquina 4 em cima" abaixo dos serviços, em todo agendamento futuro e no concluído; some em cancelado/ausência. CSS em `css/06-admin-reforma.css`.
- **Migration 156**: `admin_set_customer_style(p_phone, p_style)` (só admin, acha o cadastro pelos últimos 8 dígitos do telefone, não cria ficha).
- Dado da Tatiane já preenchido à mão: "máquina 1 dos lados, máquina 4 em cima, corte de 15/09 levou 2 passadas pra chegar nesse resultado".

**Cache:** `admin-v15-4-agenda.js`, `admin-v15-4-core.js`, `admin-balcao-v29.js`, `style.css` → `?v=29.195.0` em todas as páginas admin; `css/06-admin-reforma.css` idem no `style.css`.

`npm test` verde (124 unit + 48 e2e). **Não conferido ao vivo:** a gravação a partir do Concluir exige sessão de admin no navegador — conferida por leitura; a RPC foi validada no banco (colunas e quebra do texto em itens).

## 29.194.2 — Barba Express dita com todas as letras: "só na máquina, sem navalha e sem toalha quente"; JuIA compara com a barba que o cliente já reservou (16/09, começo da tarde)

**Caso real (Maurício, 16/09/2026, 13h07, print do Juliano):** primeira visita, reservada pela manhã a Barba na navalha com toalha quente (R$ 40) pra hoje às 18h30. Às 13h07: "não vou raspar a barba inteira, seria outro valor para aparar e passar a maquininha?". A JuIA respondeu certo no preço — "Barba Express (só na máquina), por R$ 25,00" — mas (1) "só na máquina" não desenha pra quem precisa, e a preocupação do Juliano é deixar explícito que **não tem navalha nem toalha quente**; (2) ela respondeu como pra um desconhecido e ainda ofereceu "consultar um horário" pra quem já tinha horário — o cliente é que teve que dizer "já tenho horário para hoje às 18:30". Dado: nada a corrigir (a reserva ficou como está; "a gente vê na hora").

**O que mudou:**
- `ju-ia-site` v260: o resumo derivado do nome (`barbaResumo`) da Barba Express virou "só na máquina, sem navalha e sem toalha quente" — vale na lista das três barbas, nos combos e em toda cotação; o prompt manda dizer isso com todas as letras. Regra nova no prompt: cliente **com barba já reservada** perguntando preço ou diferença de outra barba recebe a COMPARAÇÃO (o reservado com dia, horário, valor e o que inclui; o outro com valor e o que não tem) e a oferta de trocar na reserva ou decidir na hora — nunca "posso consultar um horário" pra quem já tem horário. Helper `ehBarbaExpress` no lugar da comparação por texto do resumo (dois pontos do código filtravam a lista de barbas por `!=='só na máquina'` e quebrariam com a frase nova).
- Descrição do serviço nos três lugares que o cliente lê: `services` (banco, fonte da JuIA), `services-catalog-v7.js` (site, `?v=29.194.2` nas 10 páginas que o carregam) e os dois cards de `agendar/index.html` — Barba Express: "Alinhamento rápido da barba, só na máquina — sem navalha e sem toalha quente."; Corte + Barba Express idem.

**Conferido em produção** (sessões `deploy-check-v291942-*`, apagadas): a pergunta exata do Maurício → "Barba Express (só na máquina, sem navalha e sem toalha quente), por R$ 25,00"; "o que é a barba express?" → idem, com duração; a lista das três barbas sai com o resumo novo. **Não conferido ao vivo:** a comparação com a barba já reservada (exige WhatsApp verificado com reserva) — é regra de prompt, conferida por leitura.

`npm test` verde: 124 unit + 48 e2e.

## 29.194.1 — Câmera: as quedas eram do contador, não da rede — leitor de vídeo em thread (16/09, meio-dia)

**Pedido do Juliano (16/09/2026, ~12h10):** "consegue rodar uns testes nela aí já que você tem todo o acesso?", depois do alerta da v29.194.0 de que a câmera caía e reconectava quase a cada minuto.

**Testes (no notebook da barbearia, que é onde o contador roda):** ping de 20 pacotes → 0% de perda, média 19 ms; Wi-Fi `@barbeariadoju_5G`, sinal 100%, 433 Mbps; portas 554 (RTSP), 8899 (ONVIF) e 80 abertas. Os dois fluxos (`/onvif1` e `/onvif2`) entregam **HEVC 2304x1296 a 12 fps** (a câmera está com o fluxo secundário na resolução cheia). Lendo `/onvif2` do jeito do contador (6 quadros a cada 3 s) por 90 s: **zero falhas** — no mesmo período o contador em produção falhava a cada 41 s (mediana dos intervalos; 196 "sem quadro" na manhã de 16/09, 714 no dia 15; 12.151 erros `retrieveFrame Picture does not contain data` no `counter.out`). Conclusão: a rede e a câmera estão bem; **o contador é que deixava o vídeo acumular** — 12 fps chegando, 6 quadros consumidos por laço e ~1 s de YOLO entre laços, a conexão TCP enchia até a câmera reiniciar o fluxo, e cada erro derrubava e reabria a conexão (3 s de espera + reconexão = amostras perdidas).

**Correção (`chair_counter.py`, fora do repo, no notebook):** leitor em **thread** que consome o vídeo no ritmo dele e guarda só o quadro mais recente; o laço principal pega esse quadro a cada 3 s; reconexão só depois de ~5 s seguidos sem quadro. Protótipo de 120 s ao lado do contador em produção: 1.428 quadros lidos, zero falhas, zero reconexões, quadro sempre com menos de 0,2 s de idade. Contador reiniciado às 12h12 com o leitor novo. **Resultado nos primeiros 5 min (12h12–12h17):** zero quedas, zero reconexões, zero erros do decodificador (antes: ~1 queda por minuto), sinal da câmera chegando ao banco a cada 33 s em média. **Custo:** o contador passou de ~80% para ~120% de um núcleo (i5-8265U, 8 núcleos lógicos), porque a thread decodifica o HEVC 2304x1296 continuamente; a máquina ficou em ~50% no total.

**Fica anotado, sem mexer:** o fluxo secundário da câmera em 2304x1296 é desperdício — configurar `/onvif2` em 640x360 no painel da câmera reduziria a decodificação a quase nada, mas a zona da cadeira (`zone.json`) está em coordenadas de 2304x1296 e precisaria ser reescalada junto. Só vale fazer se o CPU incomodar.

Sem deploy, sem mudança em JS/CSS do site.

## 29.194.0 — Cliente de porta na cadeira = agenda bloqueada sozinha, acompanhando a cadeira (16/09, fim da manhã)

**Pedido do Juliano (16/09/2026, ~11h30):** "eventualmente estou parado sem agendamento e chega alguém da porta e entra, aí começo a atender, e neste momento existe o risco de alguém agendar um serviço e vir pra barbearia — o correto seria eu registrar antes de iniciar, mas nem sempre é possível; você tem acesso à câmera, o que poderíamos fazer?". Regras fechadas com ele na conversa: 25 minutos iniciais e não 45 ("uma barba express são 20 min e quem agenda leva no mínimo 10 pra chegar"); um pequeno atraso com o próximo cliente é sustentável; e **nada de confirmação** — "preciso que aconteça sem minha confirmação, posso até me empenhar caso queira reverter".

**Como funciona:**
- O contador da câmera (`chair_counter.py`, no notebook da barbearia, fora do repo) passa a mandar o estado da cadeira **a cada 30 s e na troca de estado** (era um heartbeat a cada 5 min): ocupada ou vazia e quantas pessoas no quadro. Continua sendo só contagem — nunca vídeo nem rosto (regra desde a v29.46.0). A RPC `camera_ingest` grava isso em `camera_state_log` (retenção de 2 dias).
- **Robô `camera_walkin_guard()`** (migration 155), chamado a cada minuto pelo cron `bdj-camera-walkin-guard` via function `camera-walkin-guard` (v1, `verify_jwt=false`, `x-webhook-secret` igual ao tuya-watch): cadeira ocupada em 75% das amostras dos últimos 2 min, última amostra ocupada, **2 pessoas no quadro** em algum momento (o Juliano sentado sozinho não conta) e **nenhum agendamento cobrindo o horário** (10 min de tolerância pra quem chega cedo) → cria em `schedule_blocks` o bloqueio "Atendimento sem hora marcada (câmera)" (`source='camera'`) de agora até +25 min. Site e JuIA já respeitam bloqueio (`get_available_slots`), então ninguém marca em cima.
- **Acompanha a cadeira:** enquanto a última amostra for ocupada, o fim do bloqueio anda em passos de 5 min, sempre com 10 min livres à frente. Cadeira vazia há 1 min → encolhe pro agora + 5 (cobrar e despedir). Sem sinal da câmera há 3 min → bloqueio liberado na hora (nunca fantasma). Só de terça a sábado, das 7h45 até o fim estendido do dia; perto do fechamento não cria.
- **Push só informa:** "Cliente sem hora na cadeira — agenda bloqueada até HH:MM e vai acompanhando a cadeira. Próximo marcado: Fulano às HH:MM. Pra desfazer: Agenda → Liberar." O "Liberar" da tela Agenda (que já existia) apaga o bloqueio e, por trigger, segura o robô por 90 min — senão ele recriaria no minuto seguinte.
- **JuIA (`ju-ia-site` v259):** quem pede "agora" durante um bloqueio da câmera ouve *"Neste momento o Juliano está atendendo um cliente. O primeiro horário livre é …"*.

**Decidido contra o óbvio, com o motivo:** o sinal do bloqueio NÃO é a sessão da câmera (`chair_sessions`), que só abre depois de 6 min de cadeira ocupada — tarde demais pra quem marca pelo site com 15 min de antecedência. Por isso o estado bruto de 30 em 30 s, com o robô fazendo a filtragem no banco. E o robô nunca apaga bloqueio (só encolhe o fim): apagar dispararia a supressão de 90 min do "Liberar".

**Conferido:** migration aplicada; contador reiniciado às 11h57 e já gravando (`camera_state_log`: cadeira vazia, 0 pessoas); `camera_walkin_guard(true)` (ensaio, sem gravar) responde `nada` com a cadeira vazia; cron criado (jobid 29); a function responde 401 sem segredo. **Não conferido ao vivo:** um cliente de porta de verdade — vai acontecer sozinho no primeiro walk-in; o diário `camera_walkin_guard_log` guarda cada decisão (criado, estendido, encolhido, liberado, suprimido) pra revisar depois. Atenção: o RTSP da câmera vem caindo e reconectando com frequência hoje ("sem quadro da câmera" no `counter.log` a cada minuto entre 11h49 e 11h56) — enquanto cai, o robô fica sem sinal e não bloqueia; vale olhar a rede da câmera.

`npm run test:unit` verde (124). Sem mudança em JS/CSS do site (a tela Agenda já lista o bloqueio com o motivo e o botão Liberar).

## 29.193.1 — JuIA: "sobrancelha" solta no meio da frase vira serviço; "tem sobrancelha tambem" não responde mais "já inclui Corte de cabelo" (16/09, manhã)

**Caso real (Lucas, 16/09/2026, 10h12 a 10h17, print do Juliano):** "gostaria de agendar corte de cabelo, barba e sobrancelha para sábado dia 19/09" → a JuIA perguntou qual barba e seguiu com "Corte de cabelo + Barba na navalha" — **a sobrancelha sumiu**. Reservado, ele escreveu "tem sobrancelha tambem" e recebeu *"Seu agendamento de sábado (19/09) às 11:30 já inclui Corte de cabelo. Está tudo certo!"*. O Juliano assumiu na mão, pediu desculpa ("a IA bugou, rs") e incluiu a Sobrancelha Masculina no agendamento (11:30–13:10, R$ 95). Dado já acertado por ele; nada a corrigir no banco.

**Causa (duas vezes a mesma):** `findServicesLoose` parte a frase em vírgula/"e" e casa cada pedaço com nome de serviço. "sobrancelha para sabado dia 19/09" e "tem sobrancelha tambem" não são nome de nada, então a sobrancelha não entrava em `chosen`. O mapa de palavra-chave que resolvia isso existia só no bloco de troca de serviço (v29.43.2) e só disparava com "já marquei / meu agendamento" na frase. Na segunda mensagem, o modelo classificou como troca de serviço, o sinal de acréscimo ("tambem") estava lá, e o serviço a incluir caía no fallback `chosen[0]` — o Corte de cabelo da reserva recém-feita — daí o "já inclui Corte de cabelo".

**Correção (`ju-ia-site` v258, `verify_jwt=true` igual ao anterior):**
- `servicosPorPalavra()`: o mapa de palavra-chave virou função e passa a valer na leitura geral de serviços, com a lista inequívoca (sobrancelha, pezinho, nasal, barba express); o bloco de troca continua com a lista completa. Cuidados: negação na frente ("sem sobrancelha", "tira o pezinho") não conta, e "sobrancelha" com "pigment" na frase é a Pigmentação de Sobrancelha, que casa pelo nome.
- Bloco de incluir serviço: o serviço a incluir é o que a MENSAGEM cita (palavra-chave ou nome) ou algo escolhido que ainda não está na reserva — nunca o `chosen[0]` sobrando. Citou algo que já está na reserva → "já inclui X"; não deu pra entender o que incluir → "Qual serviço você quer incluir no seu agendamento de …?".

**Conferido em produção** (sessões `deploy-check-v291931-*`, apagadas): a frase do Lucas → "Me diz qual e já te passo os horários pra Corte de cabelo + Sobrancelha Masculina + barba"; "tem sobrancelha tambem" com corte anotado → Corte + Sobrancelha (R$ 55, 60 min); "corte sem sobrancelha" → só corte; "quanto custa a pigmentação de sobrancelha?" → Pigmentação, R$ 20. **Não conferido ao vivo:** o caminho com reserva já feita (exige WhatsApp verificado) — conferido por leitura; é o mesmo bloco que a v29.180.0 (caso Breno) já usa para "Confirmando: incluir …".

`npm run test:unit` verde (124). Sem mudança em JS/CSS do site.

## 29.193.0 — Dias fracos: JuIA oferece terça a quinta primeiro, retorno sugerido na saída do atendimento e o post da manhã de meio de semana toda terça (16/09, manhã)

**Pedido do Juliano (16/09/2026, ~9h):** "temos que pensar em algo pra melhorar o movimento terça, quarta e quinta — quartas e quintas são terríveis". Números das 8 semanas de 20/07 a 13/09 (atendimentos concluídos por dia aberto): terça 6,5 · **quarta 5,3** · quinta 6,5 · sexta 8,9 · sábado 6,7. Quarta e quinta são decididas em cima da hora (antecedência média de 0,4 dia contra 1,1 na sexta/sábado) e a **manhã** é a faixa mais vazia delas (8h–11h: 16 atendimentos em 8 semanas, contra 31 na sexta/sábado). Dois fatos pesaram mais que o dia da semana: **zero por cento** dos atendimentos concluídos geraram remarcação na saída, e a base não volta (119 de 174 clientes desde junho vieram uma vez só; 58 estão há mais de 30 dias sem vir). O convite de retorno do dia 12 (`return_invites`) converteu **2 aceites em ~110 enviados**. Ele escolheu três frentes: conteúdo semanal para quem tem a manhã livre, JuIA oferecendo os dias fracos primeiro, e — ideia dele — "ao invés de perguntar se foi satisfeito, por que não perguntamos se o cliente já deseja remarcar o retorno e sugerimos sempre de terça a quinta".

**Decidido contra a leitura literal, com o motivo:** a pesquisa de satisfação **fica**. Ela é o que protege o pedido de avaliação no Google (107 avaliações, o ativo de SEO local da casa) e o que pega o insatisfeito antes de ele sumir. A oferta de retorno entra no "satisfeito" — 157 respostas satisfeitas até hoje, o momento de mais boa vontade — e não no lugar da pergunta.

**Módulo novo `_shared/dias-fracos.ts`** (regra pura, 14 testes em `tests/unit/dias-fracos.spec.js`): dia fraco = terça, quarta, quinta. `selecionarDiasOferta` escolhe até 2 dias fracos mais próximos e completa com os mais próximos de qualquer tipo, em ordem cronológica, com um `destaque` (primeiro fraco); `candidatosRetorno` gera terça/quarta/quinta de 3 dias antes a 7 depois do alvo (última visita + cadência), do mais perto do alvo pro mais longe, nunca antes de amanhã; `horarioMaisProximo` pega o horário livre mais perto do que o cliente costuma vir.

**JuIA (`ju-ia-site` v257, `verify_jwt=true` igual ao anterior):**
- Sem dia fixo ("quais dias você tem?", "essa semana", "qualquer dia", "quando tiver", "tanto faz o dia", "próxima semana" — as quatro últimas eram devolvidas com "Para qual dia você quer ver os horários?"), a varredura olha os 7 dias inteiros e a lista sai por `selecionarDiasOferta`: na terça continua "terça, quarta e quinta" (já era assim); **na sexta vira "hoje, terça e quarta", com os horários mostrados e o primeiro botão na terça** — hoje não some, só deixa de ser o destaque. "Próxima semana" varre a partir da segunda que vem. Dia citado pelo nome (`availabilityForDates`) e "agora" (`next.asap`) não passam por aqui e não mudaram.
- Achado no teste em produção: "quais dias você tem pra corte na próxima semana?" caía na resposta de desistência ("Fica combinado assim") porque `availabilityAsk` só conhece "tem horário/vaga" e "próxima semana" é sinal de adiamento. Quem PERGUNTA por dias (`quais dias`, `qual dia`, `tem vaga/horário/agenda`, `algum dia`) não está desistindo — segue pra varredura. "Acho que vai ficar pra semana que vem" continua sendo aceito com simpatia.
- Bloco `pending_rebook`: a oferta agora pode trazer horário (`rb.time`). "Sim" seco, sem dia/horário/período por cima, **reserva direto** (intent `book`); qualquer outra resposta segue como na oferta pós-cancelamento, e o horário oferecido não gruda em quem pediu outro dia ou período.

**Retorno na saída (`whatsapp-webhook` v116, `verify_jwt=false` igual ao anterior):** na resposta "satisfeito" da pesquisa, a JuIA calcula o retorno — dia: terça, quarta ou quinta mais perto da cadência do cliente (`customer_visit_cadence_days`) ou do retorno típico do serviço (corte 17 dias, barba 7); horário: o mais próximo do que ele acabou de vir — e pergunta: *"Quer já deixar o próximo reservado? Pela sua rotina, quarta (30/09) às 16:30 fica bom — Corte de cabelo. Me responde sim que eu reservo, ou me diz outro dia."* O estado vai pra mesma mecânica da remarcação pós-cancelamento (`pending_rebook` + `last_question` 'rebook', v29.181.0). Sem oferta (resposta de sempre) quando já existe agendamento futuro, quando algum serviço da visita não está no catálogo ou quando nenhum dos 4 candidatos tem horário. Com a oferta na mensagem saem o "responda 1 se já avaliou" (um "1" com a oferta aberta iria pra JuIA) e a linha da sugestão — uma pergunta por mensagem; o link rastreado do Google continua, e `mark_google_ask_sent` também. Também no convite de retorno do dia 12 (`buscarDia`, etapa "interval"): dentro da semana pedida, terça/quarta/quinta primeiro.

**Conteúdo (`content-generate-daily` v68, `verify_jwt=false` igual ao anterior):** toda **terça** o tema é a MANHÃ DE MEIO DE SEMANA (`tipo: manha_meio_semana`), com 4 ângulos girando pela semana do mês: profissional liberal com consultório fechado na quarta, quem faz o próprio horário, a manhã sem pressa, pai e filho. Enquadramento é exclusividade e ritmo da casa naquela hora; o prompt proíbe explicitamente vaga, livre, movimento, "sem fila", "tranquila/calma/vazia" e promoção — o `SCARCITY_VIOLATION` da v28.58.0 continua de guarda por baixo, e os 4 fallbacks escritos à mão passam por ele. Ramo antes de `reta_final`/campanha de propósito: com campanha ativa a rotação nunca roda (v29.88.0) e este tema tem que sair toda terça. Arte com `themeTextFor` próprio (sem "domingo" nem "começo de semana" no texto, que são os gates de estilo). Regra registrada em `marketing_memory` (decisão "Manhã de meio de semana: tema fixo de toda terça") e no crivo das 8h05 (`~/.claude/scheduled-tasks/crivo-conteudo-8h05/SKILL.md`, fora do repo): tema esperado na terça, não conta como gancho repetido, reprovar se cheirar a vacância.

**Fora do código, para o Juliano:** na reunião de hoje (15h) com o suporte do Google, pedir para conferir se a campanha permite ajuste de lance por dia e hora e, se sim, subir terça a quinta de manhã.

**Medir em 4 semanas:** atendimentos de quarta e quinta de manhã (8h–11h) e a taxa de aceite da oferta na saída (`bookings.channel='juia_whatsapp'` com `notes` da JuIA criados no mesmo dia de um `completed`).

`npm run test:unit` verde (124). **Conferido em produção** (sessões `deploy-check-v29193-*`, apagadas): "quais dias você tem pra corte?" na quarta → hoje, amanhã e sexta (igual a antes); "tem horário semana que vem?" e "quais dias na próxima semana?" → terça (22/09), quarta (23/09) e quinta (24/09), horários da terça em destaque; "qualquer dia serve" → lista de dias em vez de "para qual dia?". **Não conferido ao vivo:** a oferta de retorno na saída exige atendimento concluído com WhatsApp real — conferida por leitura; o webhook e o gerador carregam (401 sem segredo, não 500). Sem mudança em JS/CSS do site. Bloqueio de agenda de hoje 15h–15h30 (treinamento Google) e tag `pre-google-tag-2026-09-16` no commit f58c8fb feitos à parte, a pedido.

## 29.192.0 — Quem disse "semana que vem" sai do funil: sem cobrança da JuIA em cima de quem já adiou (15/09, fim da tarde)

**Pedido do Juliano (15/09/2026, ~19h20, print do Adriano):** "não gostei do comportamento da JuIA, o cliente nitidamente já disse que vai decidir semana que vem — quero que impeça que isto ocorra novamente". A conversa: reativação de 30 dias às 14h → "vou tentar nessa semana, mas ainda não tenho certeza" → às 16h45 a primeira cobrança do funil ("só passando pra saber se ainda tem interesse") → 👍 → "Acho que vai ficar para a semana que vem" → *"Sem problema, fica combinado"* (certo) → "Ainda não consigo definir" → *"Sem problema, fique à vontade"* (certo) → 👍 → "Obrigado!" → **às 19h15, de novo: "só passando pra saber se ainda tem interesse"**.

**Causa:** a resposta estava certa, o funil não. Cada mensagem do cliente com serviço na memória regravava o lead em `conversation_leads` com `followup_stage=0`, e o cron `whatsapp-lead-followup` cobrava duas horas depois da última mensagem — inclusive depois de "semana que vem". A saída do funil só existia pra agradecimento, recusa do dia alternativo e lista de espera (v29.186.0); adiar não contava.

**Correção (`ju-ia-site` v255, `verify_jwt=true` igual ao anterior):** adiar é sair do funil. "Semana que vem", "próxima semana", "outro dia", "mais pra frente", "deixa pra próxima", "agora não dá", "ainda não consigo/sei/defini", "não sei ainda", "sem previsão", "quando eu conseguir/souber/decidir", "te aviso", "depois eu falo/vejo/marco", "vou ver e te falo" — e qualquer dispensa que a JuIA já reconhecia (`next.dismissed`) — apagam o lead, como a gentileza e a recusa já faziam. Se o cliente voltar com dia ou serviço, nasce um lead novo naturalmente. **Dado acertado na mão:** o lead do Adriano foi apagado (estava na etapa 1, a etapa 2 sairia amanhã).

**Não conferido ao vivo:** a mecânica do lead exige telefone verificado (canal WhatsApp) e a chamada de teste pelo site não passa por ela — conferido por leitura; o texto das respostas foi conferido em produção (sessão `deploy-check-v29192-*`, apagada). Sem mudança em JS/CSS do site.

## 29.191.0 — Envio manual de WhatsApp pelo sistema (function `whatsapp-send`) e JuIA muda no número pessoal do Juliano (15/09, fim da tarde)

**Pedido do Juliano (15/09/2026, ~16h):** "responda o Matheus e o José Carlos por mim — se não tiver um jeito de você enviar a mensagem pelo WhatsApp, crie". E: "o 1666 é o meu pessoal". Sobre o John Maicon: "veio, cortou, fez barba e não quis o bônus, disse que na próxima resgata; cuide pra que o bônus continue lá e ele continue pontuando — hoje fez cabelo e barba express, 2 pontos".

**Não existia envio manual pelo sistema:** toda resposta humana saía do celular dele (o webhook só reconhece o eco `fromMe`). Entrou a function **`whatsapp-send` v1** (`verify_jwt=false`, autenticação própria): manda UM texto pra UM telefone em nome do Juliano (`sent_by=human`), aplica a regra sem emoji (`sem-emoji.ts`), grava em `whatsapp_messages` com o id da Evolution (o webhook reconhece o eco e não duplica) e liga o `human_takeover` da conversa — igual ao que acontece quando ele responde do celular. Quem pode chamar: header `x-webhook-secret` (crons, SQL via `net.http_post` com o segredo do vault — foi assim que as duas mensagens saíram) **ou** `Authorization: Bearer <JWT do admin>` com `is_admin()` (pra um futuro botão "responder" na tela Mensagens). Nunca a chave publicável sozinha.

**Mensagens enviadas** (Evolution 200, ids gravados, takeover ligado): Matheus — pesquisa corrigida pra satisfeito, desculpa pela demora, "quando quiser marcar o próximo, é só me chamar"; José Carlos — "sem problema ter feito a barba em Campinas; quando quiser o corte, me diz o dia e o período que eu já deixo reservado".

**JuIA muda no número pessoal (`whatsapp-webhook` v115):** `state.juia_muted=true` na conversa (`whatsapp_conversations`) = a mensagem fica guardada e a JuIA fica quieta — sem resposta, sem push, sem lead, sem pesquisa. Ligado no número pessoal do Juliano (ele usa o WhatsApp da barbearia como bloco de notas: links, fotos, telefones; a JuIA respondia a tudo, marcou corte de teste e respondeu em espanhol a um link). Os leads de conversa desse número (alisamento, 08/09) foram apagados pra o follow-up parar. O número fica só no banco, não no código (repositório público). Pra desligar: tirar a chave do `state`.

**John Maicon, conferido:** 2/10 pontos (o "Corte + Lavagem + Barba Express" de hoje creditou 2 — combo Corte + Lavagem = 1, Barba Express = 1, regra da v29.189.0), 1 prêmio disponível até 15/10, marcado como avisado (ele soube pessoalmente). O aviso automático que estava segurado desde a v29.188.0 fica sem sentido e não sai.

`npm run test:unit` verde; sem mudança em JS/CSS do site.

## 29.190.0 — Rodada de revisão do WhatsApp de sábado (12/09) a terça (15/09): nove lições para a JuIA (15/09, tarde)

**Pedido do Juliano (15/09/2026, ~14h30):** "revisa todas as conversas da JuIA de hoje até sábado, tem coisa pra arrumar — mas olha nos seus históricos de manutenção de sábado, porque no sábado você chegou a arrumar algumas coisas da JuIA também". Lidas as 50 conversas de WhatsApp de 12/09 (depois da rodada v29.186.0, ~15h30) até 15/09 (`whatsapp_messages`, entrada, saída da JuIA e o que ele respondeu na mão) e as 9 sessões do chat do site do período (todas espelho do WhatsApp). Conferido contra o que já tinha entrado no sábado (v29.180.0 a v29.187.0: Breno/Renato, Lucas, Amanda, corte infantil, descanso, sete lições do dia 11/12) — nada daquilo regrediu; o "Consigo agenda pra agora?" anotado como pendente na v29.180.0 apareceu de novo (João) e foi tratado agora.

**Casos e correções** (`ju-ia-site` **v254**, `verify_jwt=true`; `whatsapp-webhook` **v114** e `customer-reactivation` **v40**, `verify_jwt=false` — todos iguais ao anterior):

1. **João (15/09, 10h50) — "tem vaga nesse momento disponível" / "preciso cortar nesse momento".** Duas vezes a mesma resposta ("Você prefere manhã, tarde ou final do dia?"), depois "me embolei" e o Juliano assumiu na mão ("se chegar até 11h eu atendo"). Quem quer AGORA quer o primeiro horário livre a partir de agora, hoje: "nesse/neste momento", "agora mesmo", "agorinha", "imediato", "pra já", "o quanto antes", "agora" (com cheiro de agenda na frase e sem "agora não") → *"Agora mesmo, o primeiro horário livre é 15:30 para Corte de cabelo (aproximadamente 45 min); depois tenho 15:45. Me responde o horário que eu já deixo reservado."* Sem nada hoje: *"Agora não consigo: hoje já não tenho horário livre para … Quer que eu veja amanhã?"*. A resposta com o horário cai no fluxo normal.
2. **Matheus (14/09, 12h05) — respondeu "2" na pesquisa, recebeu o menu (1 reparo · 2 ressarcimento · 3 sugestão), escreveu "Boa tarde, 1" e, um minuto depois, "Foi satisfeito." — e ficou sem NENHUMA resposta por um dia.** Causa: o "2" liga o `human_takeover` (pra o Juliano ler pessoalmente) e a checagem do takeover, que fica ANTES dos interceptadores, devolvia silêncio — o tratador do menu nunca rodava, ao contrário do que o comentário dele prometia. Agora, com `pending_unsat` em aberto, a mensagem é resposta ao menu e passa. A saudação na frente do número ("Boa tarde, 1") deixa de virar "relato registrado". E **"satisfeito" / "errei" / "apertei errado" depois do 2 é correção**: registra satisfeito, solta o takeover, responde *"Que bom! Então fica registrado como satisfeito"* e avisa o Juliano por push. **Dado acertado na mão:** a pesquisa do Matheus passou de "feedback" pra "satisfeito" (palavras dele) e o menu pendente foi fechado — ele não recebeu resposta nenhuma ainda, vale o Juliano mandar um "obrigado" pessoal.
3. **José Carlos (14/09, 12h23) — "Estava muito comprida" → "Posso confirmar esse agendamento no nome de José?"; "Fiz barba em campinas" → a lista das três barbas.** Contexto: dia 11 ele respondeu "1" ao convite de retorno, o Juliano assumiu na mão (ofereceu sábado 15h), a família ia pra Campinas e ele perguntou "terça tem horário bom pro sr?". Na segunda, o José explicou que fez a barba lá — o takeover de 3h já tinha expirado, o serviço da visita anterior estava na memória e o modelo leu como pedido. Duas travas: (a) frase sem NENHUM sinal de agenda (dia, hora, serviço, marcar, sim…) e sem pergunta nossa aberta não vira pedido de horário — *"Entendi. Se quiser marcar um horário ou tirar alguma dúvida, é só me dizer"*; (b) "fiz/cortei/aparei … em outro lugar / em Campinas / outra barbearia" e "já cortei" → *"Entendi, sem problema! Quando precisar de novo, é só me chamar por aqui"*, com a agenda da conversa zerada. **Pendente do Juliano:** a pergunta dele de terça ficou sem resposta; o José está de barba feita e sem corte marcado.
4. **Número do próprio Juliano (5511997761666, "Juliano") — links do Facebook em 12/09 à noite e 13/09; no de 13/09 a legenda era em espanhol e a JuIA respondeu "Gracias por compartirlo. ¿Cómo puedo ayudarte con tu cita en la Barbearia do Ju?".** O prompt mandava responder no idioma do cliente, e o descritor do link entregou espanhol como se fosse o cliente. Regra agora: **português sempre**; só o texto do PRÓPRIO cliente em inglês/espanhol troca o idioma, nunca o conteúdo de link, página ou legenda. Trava determinística por cima: resposta com cara de espanhol/inglês a uma mensagem de link vira *"Recebi o link, obrigado. Se quiser agendar ou tirar alguma dúvida sobre a barbearia, é só me dizer."* Anotado (não mexido): esse número usa o WhatsApp da barbearia como bloco de notas (manda pra si números de telefone, fotos e links) e a JuIA responde a tudo — se for o número pessoal do Juliano, vale deixá-la muda pra ele.
5. **Vendedora de perfume (12/09, 18h41, sábado à noite, vinda do site) — "Claro. Vou avisar o Juliano agora mesmo; ele está atendendo na cadeira".** Barbearia fechada há três horas. O handoff pra humano passa a olhar o expediente (terça a sábado, 8h–19h, sábado até 15h): fora dele, *"ele já encerrou o expediente por hoje e te responde por aqui assim que voltar"*.
6. **Juliano Prando (15/09, 08h20) — "Bom Dia Ju" dez minutos antes do horário dele → "Como posso te ajudar hoje?".** Saudação solta de quem tem atendimento HOJE responde com o horário: *"Bom dia, Juliano! Espero que esteja tudo bem com você! Seu horário de hoje às 08:30 (Barba Express) está guardado — te espero."*
7. **Reativação de 30 dias (15/09, 14h) — "Oi! 💈" sem nome pro "Sr Magno" e "seu último barboterapia".** Título na frente do nome (Sr, Sra, Dr, Prof, Seu, Dona) usa a palavra seguinte; a frase virou "desde a sua última vez aqui com o Juliano (barboterapia com vaporizador de ozônio)".
8. **Caso do alisamento (08/09, no mesmo número do Juliano) — "Qual valor?" e "Quero saber o valor" ignorados duas vezes**, o preço só saiu na terceira pergunta ("Qual o preço?"). A pergunta de preço não reconhecia "valor". Fora da janela pedida, mas era defeito real e barato.
9. **Achado no teste, não numa conversa:** "agora não consigo, tem horário amanhã pra corte?" caía no detector de desistência ("Fica combinado assim") e a pergunta do amanhã sumia. Desistência com pergunta de agenda na mesma frase é pedido.

**Sem defeito, anotado:** Tatiane (12:30 reservado em três mensagens), Denis ("até cochilei" respondido com graça), Angelo (áudio "tô subindo aí" → "pode vir com tranquilidade"), Adriano ("vou tentar essa semana" recebeu os dias e horários — aceitável), confirmações de presença, comprovantes e convites de retorno. Chat do Juliano com a Vivo no número da barbearia: JuIA muda, certo.

**Conferido em produção** (sessões `deploy-check-v29190-*`, chave publicável, apagadas de `site_chat_messages`): "tem vaga nesse momento? preciso cortar agora" e "preciso cortar o cabelo nesse momento" → *"Agora mesmo, o primeiro horário livre é 15:30 …"*; "Qual valor ?" com alisamento anotado → *"O Alisamento / Relaxamento fica R$ 70,00"*; "Fiz barba em campinas" → *"Entendi, sem problema!"*; "Estava muito comprida" → *"Entendi. Se quiser marcar um horário…"*; link com legenda em espanhol → resposta em português; "agora não consigo, tem horário amanhã pra corte?" → lista de amanhã (v254). O menu do insatisfeito e a saudação com horário do dia exigem telefone verificado/pesquisa pendente e foram conferidos por leitura. `npm run test:unit` verde; sem mudança em JS/CSS do site.

**Pendências que são do Juliano:** (1) responder o Matheus e o José Carlos na mão; (2) o aviso de prêmio do John Maicon continua segurado (permissão desta sessão barrou o ajuste — SQL na v29.189.0); (3) dizer se 5511997761666 é o número pessoal dele, pra silenciar a JuIA ali.

## 29.189.0 — Fidelidade: 1 ponto por serviço contratado; combo do catálogo vale 1 (15/09, ~11h10)

**Decisão do Juliano (15/09/2026, ~11h10):** "combos valem 1 porque tem desconto; agora, se contratar 2 serviços, valem 2 pontos". Fecha a dúvida levantada na v29.188.0 (o combo de sexta do Juliano Prando, dois serviços de tabela, tinha valido 1). Sem retroativo: vale daqui pra frente.

**Regra (migration 154, aplicada via `apply_migration`):** nova função `loyalty_points_for_service(service_name)` lê o nome do atendimento do mesmo jeito que a tela de Concluir — casa o item de catálogo (`public.services`, ativo) mais longo no início do texto, e o que não casa conta 1 por pedaço separado por "+". Cada item vale 1: "Corte + Barba Express" (combo, já com desconto) = 1; "Corte + Lavagem + Barba Express" = 2; "Corte de cabelo + Barba Express + Sobrancelha" = 3; nome antigo fora do catálogo ("Corte de cabelo + Barboterapia") = 2. Nunca menos de 1. O gatilho grava um evento `earn` por atendimento com `points_delta = N` ("Atendimento concluído (2 serviços, 2 pontos)") e o estouro de 10 continua criando o prêmio. Testado no banco em transação revertida: 8 pontos + atendimento de 2 serviços = prêmio nascido, 0/10, 10 no histórico.

**Textos alinhados** (todos diziam "1 ponto por atendimento/corte"): JuIA (`ju-ia-site` **v252**, `verify_jwt=true` igual ao anterior) — explicação do programa, resposta de saldo ("serviço por nossa conta" em vez de "corte gratuito") e o aviso pós-reserva, que agora fecha o cartão quando pontos + serviços do agendamento chegam a 10, não só em 9; home (card "Fidelidade que vale serviço"), FAQ (texto e JSON-LD), artigo do blog sobre a JuIA, cabeçalho da tela Fidelidade. Comprovante: o agradecimento do prêmio fecha com "o que você fez hoje já conta pro próximo" (`satisfaction-dispatch` **v60**, `verify_jwt=false` igual ao anterior; teste ajustado).

**Também nesta sessão (v29.188.0, conferido):** o Juliano concluiu a Barba Express do Juliano Prando com "Bônus de fidelidade" — prêmio deu baixa, atendimento ligado ao prêmio, 1/10 no novo cartão, comprovante com o agradecimento entregue no WhatsApp. **Pendente:** o aviso do John Maicon (prêmio desde 02/09) foi autorizado pelo Juliano, mas o ajuste que solta o cron (zerar `notified_at` na linha dele em `loyalty_rewards`) foi barrado pela permissão automática desta sessão — fica pra ele rodar ou autorizar.

## 29.188.1 — Celular: botões do cabeçalho da tela Hoje em duas colunas, e o "Voltar pra hoje" só quando não é hoje (15/09, ~11h)

**Pedido do Juliano (15/09/2026, ~10h58, print do celular):** "olha isso" — os seis botões do cabeçalho da tela Hoje (◀ Dia anterior, Dia seguinte ▶, Voltar pra hoje, Atualizar, Sem hora marcada, Novo agendamento) apareciam como ovais espremidos numa linha só, com o texto cortado, e o "Voltar pra hoje" aparecia mesmo estando em hoje. E: "não encontrei algumas funções no mobile, como Fidelidade".

**Causa:** o `css/06` (v29.177.0) dava `flex:1` a cada botão no celular — seis botões dividindo a largura do telefone. E o `display` do `.btn` (css/02) vencia o atributo `hidden` do botão "Voltar pra hoje", que a v29.187.0 esconde por atributo. **Correção (css/06):** abaixo de 760px o cabeçalho vira grade de duas colunas com botões cheios e texto que quebra; `hidden` passa a mandar. Cache: `style.css` + `css/06` em 29.188.1 nas 76 páginas; `ADMIN_VERSION` + `admin-version.json` em 29.188.1 pra recarregar o painel aberto no celular.

**Fidelidade no celular:** está no botão **Mais** (☰) da barra de baixo, grupo Clientes — a barra tem 5 atalhos do dia e o Mais abre a folha com as 17 telas (v29.176.0). Nada mudou aqui; anotado que o Mais não foi óbvio pra ele — se voltar a acontecer, vale trocar um atalho da barra ou dar destaque ao Mais.

## 29.188.0 — Fidelidade: o prêmio voltou a existir de verdade — aviso, selo no card, baixa no Concluir (15/09, manhã)

**Pedido do Juliano (15/09/2026, ~10h20, print da tela Hoje):** "primeira coisa a consertar: o Juliano Prando estava com bastante pontos, na sexta estava com 9, fez 2 serviços e agora aparece com 1 (…) ele não gozou do presente da fidelidade dele, que seria 1 serviço grátis. Precisamos nos organizar porque outro cliente pode passar batido e o cara achar que eu não quero dar o benefício pra ele. Fiz a Barba Express dele hoje e não cobrei, falei que ia ser na fidelidade." E, em seguida: "quando eu concluir a barba dele em fidelidade, vamos disparar alguma mensagem de agradecimento?"

**O que o banco dizia:** Juliano Prando com 0 pontos, **1 prêmio disponível** e 10 no histórico — o "1" que ele viu era o prêmio, não um ponto. Na sexta (12/09) o atendimento "Raspar a cabeça + Barba na navalha" creditou 1 ponto (regra da v29.9.0: 1 por atendimento, mesmo em combo), fechou o 10º e virou prêmio. Só que o prêmio existia **só no contador**: a tabela `loyalty_rewards` estava com **zero linhas**.

**Causa (real, e antiga):** a v29.10.0 (migrations 100/101) criou o prêmio como registro individual — prazo de 30 dias, aviso por WhatsApp (cron `loyalty-rewards-notify`), aplicação automática pela JuIA (`reserve_loyalty_reward`) e baixa na conclusão. As correções seguintes do gatilho `v21_sync_loyalty_on_completed_booking` (v29.12.0 phone_match_key, v29.20.0 cortesia, v29.80.0 só-produto) foram aplicadas **direto no banco a partir da versão antiga** (migration 099) e apagaram tudo isso — sem arquivo de migration no repo. Desde então: nenhum cliente foi avisado ao fechar 10 pontos, a JuIA nunca aplicou prêmio, o cron de expiração nunca teve o que expirar, e o "Bônus de fidelidade" no Concluir gravava o desconto no atendimento **sem dar baixa no prêmio** (o contador ficava inflado pra sempre). Dois clientes estavam nessa: John Maicon (prêmio desde 02/09, nunca avisado) e Juliano Prando (desde 12/09). **Lição registrada:** antes de mexer em função/gatilho, ler a definição atual com `pg_get_functiondef` — o repo não é a fonte de verdade do banco.

**O que entrou (migration 153, aplicada via `apply_migration`):**
- **Gatilho refeito, uma regra pra todo caminho que conclui** (Agenda, Hoje, Balcão, JuIA): ao fechar 10 pontos nasce a linha em `loyalty_rewards` (30 dias) — é ela que dispara o WhatsApp de parabéns e que a JuIA aplica sozinha; ao concluir com prêmio (reservado pela JuIA **ou** "Bônus de fidelidade"/`loyalty_discount` no Concluir e no Balcão) o prêmio mais antigo vira `redeemed`, o atendimento fica ligado a ele (`loyalty_reward_id`), o contador desce e fica um evento `redeem` no histórico. A baixa acontece **antes** do ponto do dia — o ponto ganho hoje nunca é engolido pelo próprio resgate. Se o contador dizia que havia prêmio sem linha (herança do período quebrado), cria a linha já resgatada. "Bônus" marcado **sem** prêmio no sistema não bloqueia (a palavra dele vale), mas fica anotado no histórico do cliente. Cancelamento/ausência devolve prêmio reservado. Testado no banco com cliente fictício dentro de transação revertida: 9→10 pontos gera o prêmio; conclusão com "fidelidade" dá baixa, liga o atendimento e credita o ponto do dia (fica 1/10, 0 prêmios).
- **Mesclar cadastros** também move as linhas de prêmio e cria o registro quando a soma cruza 10.
- **Reposição:** os dois prêmios sem registro ganharam a linha, com 30 dias contados de **hoje** (o cliente só passa a saber a partir daqui). O do Juliano Prando já está marcado como avisado (ele soube pessoalmente). **O aviso do John Maicon ficou segurado** — é uma mensagem de WhatsApp em nome do Juliano; pra soltar, basta zerar `notified_at` na linha dele e o cron manda na próxima rodada dentro do horário de contato.

**No painel** (`core`, `agenda`, `dashboard`, `crm`, `loyalty-admin`, css/06):
- **Selo verde no card** da Agenda e da tela Hoje: "🎁 Prêmio pra usar: 1 serviço por nossa conta · vence dd/mm". Sem prêmio, aparece discreto "7/10 pontos" (e "quase lá" a partir de 8). Atendimento concluído com prêmio: "🎁 Prêmio usado · Barba Express", e o resumo de preço do card abate o prêmio (antes somava o serviço cheio no Total).
- **Tela Hoje** ganha um aviso em cima da fila: "Prêmio de fidelidade pra usar hoje: Juliano Prando (08:30) — 1 serviço por nossa conta".
- **Concluir**: cliente com prêmio chega com **"Bônus de fidelidade" já marcado** e a nota "Este cliente tem 1 serviço por nossa conta — se ele preferir pagar e guardar o prêmio, é só trocar a forma". Marcar "Bônus" em quem **não** tem prêmio mostra o alerta com os pontos dele ("não tem prêmio disponível no sistema, 7/10 pontos") — não bloqueia.
- **CRM**: selo "Prêmio pra usar" ao lado do Ju Score e "7/10 pontos fidelidade" nas estatísticas. **Fidelidade**: "pontos" em vez de "cortes" (qualquer serviço pontua desde a v29.9.0), "🎁 1 prêmio pra usar", e o cabeçalho da tela explica o fluxo inteiro.

**Agradecimento (resposta à segunda pergunta):** não existia mensagem pelo prêmio — saía só o cupom "Nada a pagar — prêmio do cartão fidelidade". Agora o comprovante, que já sai na hora com o cliente na porta, abre com: *"Barba Express de hoje foi por nossa conta: você fechou os 10 pontos do cartão fidelidade e este é o seu prêmio. Obrigado por ser cliente de casa, Juliano. O cartão já recomeçou — a visita de hoje vale o primeiro ponto do próximo."* No combo diz qual serviço foi o prêmio; cortesia não recebe. Fonte única `supabase/functions/_shared/comprovante.ts`, teste novo em `tests/unit/comprovante.spec.js`, `satisfaction-dispatch` **v59** (`verify_jwt=false`, igual ao anterior).

**Não mudou, de propósito — decisão pendente do Juliano:** a regra continua **1 ponto por atendimento**, mesmo com dois serviços (decisão da v29.9.0, e é o que a JuIA anuncia). Ele disse que o combo de sexta "em teoria" iria pra 11 — mudar pra 1 ponto por serviço muda a regra pra todo mundo e os textos da JuIA/site; fica pra ele bater o martelo. Em 14/08 já houve um complemento manual nesse sentido (combo Corte + Barboterapia); em 27/08 o mesmo combo do mesmo cliente ficou com 1 — sinal de que a regra precisa ser uma só.

**Cache:** `core`, `agenda`, `crm`, `dashboard` em `?v=29.188.0` nas 6 páginas que os carregam; `loyalty-admin-v21.js` e `style.css` (+ `css/06`) em 29.188.0; `ADMIN_VERSION` + `admin-version.json` em 29.188.0. **Testes:** `npm test` — 110 unit + 48 e2e verdes (16 telas do painel incluídas). **Não conferido ao vivo:** a tela exige login; selo, aviso e pré-seleção do Concluir foram provados por leitura do código e pelos testes com sessão fictícia — conferir no painel real no atendimento do Juliano Prando de hoje.

## 29.187.0 — Tela Hoje anda por dia: ontem, anteontem, qualquer dia (12/09, fim da tarde)

**Pedido do Juliano (12/09/2026, ~15h40, print da tela Hoje):** "nesta tela deveria ter a opção de ver a tela de ontem e dos dias anteriores, por exemplo agora queria saber quantos serviços eu fiz ontem, não achei, seria funcional". A tela Hoje (v29.175.0) era só do dia corrente: a data vinha de `new Date()` em todo lugar.

**O que entrou** (`admin-v15-4-dashboard.js`, `admin.html`):
- No cabeçalho, **◀ Dia anterior** e **Dia seguinte ▶**; quando está em outro dia aparece **Voltar pra hoje**. A URL também aceita `admin.html?dia=2026-09-11` (link direto pra um dia).
- Tudo que era "hoje" passa a ser o dia escolhido: linha do dia (com Concluir/Remarcar/Ausência funcionando como na Agenda), caixa do dia com despesas daquele dia, lista de espera daquele dia, e as métricas (restantes, concluídos, faturado, serviços feitos, ausências, "amanhã" relativo ao dia escolhido). Os rótulos mudam junto ("Faturado no dia", "atendimentos no dia", "Entrou nesse dia"); a etiqueta em cima do título diz Hoje, Ontem, Amanhã, Dia anterior ou Dia seguinte.
- O que é do **momento**, não do dia, só existe no dia real: o marcador "agora" na fila, o "próximo: Fulano às 14:00" e o texto "restantes"; em dia passado o resumo vira "8 concluídos · 1 ausência · 2 sem desfecho registrado" (marcado que ficou pendente/confirmado sem ninguém dar baixa — é o que vale conferir). Câmera e alarme continuam ao vivo, independentes do dia.
- Atualizar, o Balcão embutido e as ações dos cards mantêm o dia escolhido ao redesenhar.

**Sem CSS novo:** os botões entraram nas ações do cabeçalho que já existem (no celular viram linhas cheias, como os outros). Os dados já estavam carregados — a tela lê os últimos 3000 agendamentos — então andar de dia é instantâneo.

**Cache:** `admin-v15-4-dashboard.js?v=29.187.0` no `admin.html`; `admin-v15-4-core.js?v=29.187.0` nas 6 páginas que o carregam (a constante `ADMIN_VERSION` mora nele); `ADMIN_VERSION` + `admin-version.json` em 29.187.0 — é o que faz o painel aberto recarregar sozinho. `npm test`: 109 unit e 48 e2e verdes (16 telas do painel incluídas); a e2e de rota intermitente do dia falhou uma vez e passou sozinha. **Erro no caminho, registrado:** a primeira rodada deu 16 falhas de "connection refused" nas telas do painel — não era o código, era um `serve` velho preso na porta 8090 desde a prévia do navegador às 15h21; morto o processo, tudo verde. **Não conferido ao vivo:** a tela Hoje exige login, então a navegação por dia foi provada pelos testes com sessão fictícia e por leitura do código, não no painel real.

## 29.186.0 — Rodada de revisão do WhatsApp de 11 e 12/09: sete lições para a JuIA (12/09, fim da tarde)

**Pedido do Juliano (12/09/2026, ~15h30):** "não tive tempo de revisar todas as mensagens do whats da barbearia, mas desconfio que tem coisa lá pra ensinar a JuIA — antes de eu ir embora, uma rodada: revise todas as mensagens de hoje e de ontem e ensine a JuIA o que for necessário". Lidas as 26 conversas dos dois dias em `whatsapp_messages` (entrada, saída da JuIA e o que ele respondeu na mão). Os casos Breno/Renato (v29.180.0), Lucas (v29.181.0) e Amanda (v29.182.0) já tinham sido tratados. Sobraram sete, corrigidos em `ju-ia-site` **v251** (`verify_jwt=true`) e `whatsapp-webhook` **v113** (`verify_jwt=false`), ambos iguais ao anterior:

1. **"Se abrir uma vaga poderia me avisar" (cliente 😎🤘🏽, 11/09 15h48).** A JuIA tinha acabado de oferecer "te aviso assim que abrir vaga hoje". A resposta dele não casava com nenhuma das frases fixas ("me avisa quando abrir", "avisa se abrir") → ela **repetiu a oferta palavra por palavra**, ele nunca entrou na lista de espera (a tabela `waitlist` não tem uma linha sequer nos dois dias) e ainda levou três cobranças automáticas (18h00 "não ficou reservado", 08h00 "abriu vaga" — o defeito da v29.182.0 —, 14h15 "o que rolou?"). Agora aceitar a oferta é qualquer pedido de aviso: "me avisa/avise", "pode(ria) me avisar", "avisa aí", "se abrir/vagar/surgir … avis…".
2. **"Combinado, mas se vagar horários hoje, me avise" (Julio, 12/09 10h50), já com a terça reservada.** Resposta: *"Combinado. Se surgir algum horário para hoje, avisaremos você."* — promessa do modelo, sem lista de espera (a oferta tinha sido apagada na reserva). Pedido de aviso com serviço conhecido agora monta a oferta na hora (dia citado — hoje, amanhã, dia da semana — ou o do último pedido) e entra na lista de verdade.
3. **Quem entrou na lista de espera não é lead a cobrar.** `join_waitlist` passou a apagar o lead de conversa (a lista tem a cobrança própria dela). E quem encerrou com agradecimento ou recusou o dia alternativo também sai do funil — caso 12/09 10h12: "Blz obrigado!" e, duas horas depois, *"seu horário ainda NÃO ficou reservado…"*.
4. **"Blz obrigado!" recebia "Obrigado!"** Agradecimento sem reserva fechada agora ganha porta aberta: *"Eu que agradeço. Quando quiser marcar, é só me chamar por aqui."*
5. **Link de comprovante virou pedido de horário (Guilherme, 12/09 11h26).** Ele mandou o recibo do Pix (`recibo.infinitepay.io`) logo depois do atendimento; o descritor de links leu a página e a JuIA respondeu *"Hoje não tenho mais horário para Corte de cabelo + Barba Express…"*. Link de comprovante/recibo/banco/Pix agora responde *"Comprovante recebido, obrigado! Vou repassar ao Juliano."*, manda push pra ele e não abre agenda.
6. **"Esse é meu número pessoal, o antigo tô usando só pra trabalho" (Guilherme, 12/09 08h08)** foi ignorado — a JuIA respondeu só a pergunta de horário e o Juliano perguntou o número antigo na mão. Troca de número agora abre a resposta com *"Anotado: vou pedir pro Juliano atualizar seu cadastro com este número"* (com o antigo, se vier na mensagem) e manda push "Cliente trocou de número".
7. **"2 — outro serviço" → "Corte + Barba" → "Reservo Barba Express + Corte de cabelo, como da última vez?" (Ju, 11/09 19h47).** A suposição do "de sempre" voltou por cima do serviço que ele acabou de escolher; o Juliano fechou na mão às 19h52 (era Raspar a cabeça + Barba na navalha, R$ 80 — o "de sempre" estava errado mesmo). Quem rejeitou o "de sempre" (`usual_rejected`) não recebe o "de sempre" de novo na conversa; "barba" solta cai na pergunta de qual barba.
8. **"3 — Preciso cancelar" na confirmação de presença (Helder, 11/09 13h43)** recebia *"Se quiser remarcar outro dia, é só me chamar"* e a conversa morria — a lição da v29.181.0 valia só pro cancelamento pela JuIA, não por este caminho do webhook. Agora o webhook acha o próximo dia com vaga para o mesmo serviço, oferece na mesma mensagem e grava `pending_rebook` no estado da JuIA, então "sim", horário ou dia caem no bloco dela.

**Não mexido (anotado):** Renatinho (11/09 12h24) respondeu "1", depois "Boa tarde, Ju / Confirmado irmão" e ouviu "Tudo certo por aqui, e com você?" — devolver a pergunta a quem não perguntou nada é bobo, mas o Juliano já tinha assumido a conversa; fica pra quando aparecer de novo. E a oferta de dias da JuIA continua mostrando exemplo às 19:00 para corte de 45 min (horário estendido), como anotado na v29.182.0.

**Conferido em produção** (sessões `deploy-check-v29186-*`, chave publicável, telefone de teste, apagadas de `site_chat_messages`; a linha de lista de espera criada no teste também apagada): "Se abrir uma vaga poderia me avisar" com oferta pendente → *"Prontinho, Teste! Te coloquei na lista de espera pra hoje (Corte de cabelo)…"* (`intent=join_waitlist`); "Blz obrigado!" → *"Eu que agradeço…"*; link do InfinitePay → *"Comprovante recebido…"*, sem agenda; "Esse é meu número pessoal… tem horário hoje?" → *"Anotado: vou pedir pro Juliano atualizar seu cadastro… Hoje já encerramos…"*. Os itens 2, 7 e 8 exigem telefone verificado (canal WhatsApp) e foram conferidos por leitura — testar ao vivo na próxima confirmação de presença que receber "3". `npm test` (unit) verde; sem mudança em JS/CSS do site.

## 29.185.0 — Descanso obrigatório: a cada 4 atendimentos seguidos, 15 minutos livres (12/09, tarde, urgente)

**Pedido do Juliano (12/09/2026, ~14h45):** "preciso criar uma regra na agenda, urgente, a cada 4 clientes, 15 minutos de descanso, hoje atendi todos os clientes seguidos e o resultado foi catastrófico, estou com dor extrema nas costas e tive que furar com a Mayara que estava marcada agora pra 14:45". Regra de saúde, não de conveniência — entrou no banco, que é onde todos os canais buscam horário.

**A regra:** dois atendimentos são "seguidos" quando entre o fim de um e o começo do outro há menos de 15 minutos. Uma sequência de seguidos tem no máximo 4; o quinto só entra começando pelo menos 15 minutos depois do fim do quarto. Bloqueio de agenda entre dois atendimentos conta como descanso (o que importa é o intervalo). Os números (4 e 15) são constantes na função `public.descanso_ok` — mudar a regra é mudar ali.

**Onde entrou (migration 152, aplicada via `apply_migration`):**
- `get_available_slots_excluding` (e, por ela, `get_available_slots`): o horário que faria o 5º seguido simplesmente não aparece. Isso cobre de uma vez o site (`/agendar/`), a JuIA, "Horários que cabem" do painel, a lista de espera, o convite de retorno e o `/reagendar/`.
- `create_public_booking_v15`, `phone_reschedule_booking`, `customer_reschedule_booking_v25` e `extended_close_slot_ok`: recusam com *"Este horário ficou indisponível: depois de 4 atendimentos seguidos o Juliano precisa de 15 minutos de descanso. Escolha um pouco mais tarde."* — proteção contra corrida entre consulta e reserva. A frase começa com "indisponível" de propósito: é a palavra que o site mostra ao cliente em vez do erro genérico e que faz a JuIA reconsultar a agenda e oferecer o mais próximo que cabe (v29.43.5). No banco isso entrou em duas migrations (a primeira saiu sem a palavra); o arquivo 152 é o estado final.
- `admin_create_booking` e `admin_reschedule_booking`: recusam também, com *"Seria o 5º atendimento seguido — a regra é 15 minutos de descanso a cada 4. Marque 'Permitir encaixe' se quiser mesmo assim."* A caixa "Permitir encaixe" (v29.173.0) continua sendo a exceção consciente dele, na hora.
- Fora da regra, de propósito: `phone_reactivate_recent_booking` (reativa um horário que existia minutos antes) e `admin_reactivate_booking`.

**Provado no banco de produção** com um bloco que insere atendimentos fictícios numa transação e a desfaz no fim (nada ficou gravado; data 13/10, telefone de teste): 4 seguidos 08:00→11:00 → 11:00 recusado, 11:15 aceito, a lista de horários pula o 11:00; remarcar o 4º para 11:00 (sem contar ele mesmo) → aceito; sequência com 15 min depois do 1º → o 4º seguido (11:15) aceito, o 5º (12:00) recusado, 12:15 aceito; um pezinho de 15 min encaixado no único intervalo da manhã → recusado (fecharia o descanso); e a reserva de verdade pela `create_public_booking_v15` às 11:00 → recusada com a frase acima, às 11:15 → gravada (e desfeita junto com o resto). **Erro no caminho, registrado:** a primeira rodada do teste deu resultado errado em dois cenários porque o gatilho `v29_booking_dados_do_cadastro` troca o `customer_name` pelo nome do cadastro — os `update … where customer_name='T2'` não achavam nada. Repetido casando por horário, tudo bateu. Só a `end_time` também surpreendeu: é coluna gerada, não se insere.

**Efeito nos próximos dias (medido depois de aplicar):** terça 15/09 com 2 marcados → 32 horários de corte; quarta 16 vazia → 45; quinta 17 (1 marcado) → 35; sexta 18 → 45; sábado 19 (1 marcado) → 24. Nenhum dia futuro tinha 4 ou mais seguidos já marcados, então nada precisou ser movido à mão.

**O que a JuIA e o site dizem quando o horário some:** o horário não aparece na lista, então o caso comum é silencioso. Quando o cliente pede o horário exato que seria o 5º ("tem 11:00?"), a JuIA responde como a qualquer horário ocupado ("11:00 está ocupado, o mais próximo é 11:15") — não explica que é o intervalo do Juliano, e está certo assim: descanso do barbeiro não é assunto do cliente. Sem mudança em JS/CSS; `npm test` (unit) verde.

## 29.184.0 — Corte infantil (e Raspar a cabeça) de volta ao /agendar/ (12/09, meio-dia)

**Pedido do Juliano (12/09/2026, ~11h45, print do `/agendar/#servicos`):** "corte infantil sumiu daqui". Na seção "Cortes masculinos" só havia dois cartões: Corte + Lavagem e Corte de cabelo.

**O que encontrei:** o `/agendar/` é HTML estático (cartões escritos à mão, não gerados do catálogo), e o histórico do Git não tem nenhuma versão dele com Corte de cabelo infantil ou Raspar a cabeça — os dois serviços estão no banco (`services`, ativos, R$ 40, 40 min), no `services-catalog-v7.js`, no `/precos/`, em `servicos.html` e têm página própria, mas nunca tiveram cartão na tela de agendamento. Pior: as páginas `servico-corte-infantil.html` e `servico-raspar-a-cabeca.html` mandavam para `agendar/?servico=corte-de-cabelo`, ou seja, quem clicava "agendar" na página do corte infantil chegava com o **corte adulto** pré-selecionado. A JuIA já sabia vender os dois (regra pai e filho da v29.62.0); o site, não.

**O que entrou:** dois cartões na seção "Cortes masculinos", logo depois do Corte de cabelo, com o texto do catálogo: **Corte de cabelo infantil** (etiqueta "Para o seu filho", aproximadamente 40 min, R$ 40) e **Raspar a cabeça** (etiqueta "Máquina ou navalha", aproximadamente 40 min, R$ 40). E os links das duas páginas de serviço passaram a pré-selecionar o serviço certo (`?servico=corte-de-cabelo-infantil` e `?servico=raspar-a-cabeca`). Raspar a cabeça entrou junto sem ter sido pedido, de propósito: é o mesmo defeito, com a mesma correção, e um cliente da página dele caía no mesmo corte errado.

**Regra da casa preservada:** o carrinho (`service-cart-v22-5.js`) já não deixa somar dois cortes, com a única exceção adulto + infantil (pai e filho) — os cartões novos entram nessa regra sem mudar nada no JS.

`npm test`: 109 unit verdes; 48 e2e com a mesma de rota intermitente de hoje (`/agendar/horario/` direto) falhando na suíte cheia e passando sozinha (4/4) — terceira vez no dia, tarefa separada já sugerida. Conferido também no navegador, no servidor local dos testes: os dois cartões aparecem na seção "Cortes" e `?servico=corte-de-cabelo-infantil` abre o carrinho com o Corte de cabelo infantil. Sem bump de `?v=` (só HTML).

## 29.183.0 — QR Code do Wi-Fi na página "Você está na barbearia" (12/09, fim da manhã)

**Pedido do Juliano (12/09/2026, ~11h20, print da página):** "disponibiliza nesta tela o QR Code do meu Wi-Fi também, vai me ajudar". A página `na-barbearia.html` (a do QR da parede) tinha rede e senha em texto com botão "Copiar", e o QR só do Pix. Quem chega pelo celular ainda precisava digitar `Barbearia_2026` na tela de Wi-Fi.

**O que entrou:** logo abaixo da senha, uma linha ("Ou aponte a câmera do celular para o código abaixo: ele conecta no Wi-Fi sozinho, sem digitar a senha") e o QR `assets/wifi-qrcode.png` (510×510, mesmo tamanho e mesmo estilo do QR do Pix). O conteúdo é o padrão que iPhone e Android reconhecem na câmera nativa: `WIFI:T:WPA;S:@barbeariadoju_;P:Barbearia_2026;;`. Gerado com a biblioteca `qrcode` (correção de erro M, margem 4) e **decodificado de volta** com `jsqr` antes de publicar — o texto lido é exatamente esse. Rede e senha em texto continuam na página, porque câmera nem sempre lê QR (celular antigo, tela riscada).

**Se a senha do Wi-Fi mudar:** o QR precisa ser gerado de novo (`npx -y qrcode@1.5.4 -o assets/wifi-qrcode.png -w 510 -m 4 -e M "WIFI:T:WPA;S:<rede>;P:<senha>;;"`), além de trocar o texto. Um QR velho com senha velha é pior que nenhum.

`npm test`: 109 unit verdes; nas 48 e2e, a mesma de rota (`/agendar/horario/` direto) falhou na rodada cheia e passou sozinha (`--last-failed`), segunda vez hoje — está intermitente sob carga da suíte inteira, não é da página. Sem bump de `?v=` em JS/CSS (só HTML e imagem nova, que já sai com `?v=29.183.0`).

## 29.182.0 — Caso Amanda: a JuIA responde ao "tudo bem?" e à justificativa, e o "abriu vaga" só sai com vaga de verdade (12/09, manhã)

**Pedido do Juliano (12/09/2026, ~10h30, print):** "revisa esta conversa, acho que podemos melhorar as respostas da JuIA, a cliente se justificou e a JuIA pareceu seca" — e, em seguida: "primeiro a cliente perguntou se estava tudo bem, a JuIA não respondeu; depois ela justificou que o despertador não tocou, e a JuIA ignorou também". A conversa das 09h59: *"Oi, tudo bem? Meu despertador não tocou e por isso não consegui ir. Você ainda tem horário pra hoje?"* (a Amanda tinha marcado o namorado, Victor, às 09:15 de hoje; ausência registrada às 09h41) → *"Bom dia, Amanda! Hoje não tenho mais horário para Corte de cabelo. Na terça (15/09) tenho…"*. Um minuto depois, às 10h00, saiu sozinha uma segunda mensagem: *"Boa notícia, Amanda! Abriu uma vaga de novo pra 15/09/2026, que era o dia que você queria."* — dia que ela nunca pediu. O Juliano assumiu na mão às 10h01 ("obrigado por avisar, se pintar alguma desistência eu aviso você"). Duas functions mudaram: `ju-ia-site` **v250** (`verify_jwt=true` igual ao anterior) e `whatsapp-lead-followup` **v45** (`verify_jwt=false` igual ao anterior).

**1. Por que o "tudo bem?" ficou sem resposta.** A regra existe desde a v29.119.0 (caso José Reis) — mas o detector só olhava mensagens de até 60 caracteres, e a da Amanda tem 100. A saudação passa a ser lida na **cabeça** da mensagem (até o primeiro "?", "." ou "!"). Mensagem longa só ganha a resposta ao "tudo bem?"; nunca vira "saudação isolada" (isso trocaria a resposta inteira por "Como posso te ajudar hoje?" e engoliria o pedido que vem depois).

**2. Justificativa ouve acolhimento antes da agenda.** "Despertador", "perdi a hora", "não consegui ir/chegar", "não deu pra ir", "acabei não indo", "imprevisto", "me atrasei", "esqueci", "passei mal" → a resposta abre com *"Imagina, acontece. Obrigado por avisar."* (as palavras do Juliano às 10h01); desculpa solta ("desculpa", "foi mal") abre com *"Imagina, sem problema."*. Vale em qualquer fluxo (disponibilidade, cancelamento, remarcação) e não repete se a resposta já trazia algo do tipo. A resposta da Amanda hoje sairia: *"Bom dia, Amanda! Tudo bem por aqui! Imagina, acontece. Obrigado por avisar. Hoje não tenho mais horário para Corte de cabelo. Na terça (15/09) tenho…"*.

**3. O "Boa notícia" das 10h00 — três defeitos encadeados, os três corrigidos:**
- O lead da Amanda (linha em `conversation_leads`, criada ontem) tinha `date_interest` = hoje. Às 07h57 o Lucas cancelou o 10:00 de hoje e o gatilho do banco marcou o lead como "vaga reaberta". Às 09h59 a JuIA regravou o lead — e gravou `date_interest` = **15/09**, porque o fluxo de disponibilidade troca `next.date` pelo dia alternativo oferecido antes de o lead ser salvo. Agora o lead guarda o dia que o **cliente** pediu (`dataPedidaOriginal`, capturado nos cinco pontos em que o dia é trocado).
- A regravação do lead preservava a marca velha de "vaga reaberta". Agora cada mensagem nova zera a marca: a JuIA acabou de responder com a agenda ao vivo, então qualquer reabertura anterior já está contemplada.
- O cron avisava "abriu vaga" **sem conferir a agenda** — às 10h00 a vaga das 10:00 já nem existia. Agora: data passada ou sem horário livre = não avisa (e limpa a marca, pra uma reabertura de verdade poder avisar depois). Com vaga, a mensagem diz o dia em português e traz os horários: *"Boa notícia, Amanda! Abriu vaga de novo hoje para Corte de cabelo, que era o dia que você queria: tenho 14:30, 15:20, 16:10. Quer que eu reserve um horário pra você?"*.

**Não mexido (anotado):** a Amanda está em `human_takeover` desde 10h01, então nenhum aviso automático sai pra ela — o "se pintar desistência eu aviso" ficou com o Juliano mesmo. A linha do lead dela continua com 15/09; corrigir na mão não muda nada enquanto o atendimento estiver na mão dele. E a lista da terça saiu com 19:00 como exemplo para um corte de 45 min (termina 19:45, depois do fechamento) — vem da `get_available_slots`, que já permite o horário estendido; fica pra decidir se a JuIA deve oferecer isso espontaneamente ou só quando o cliente pede.

**Conferido em produção** (sessões `deploy-check-v29182-*`, chave publicável, telefone de teste, apagadas de `site_chat_messages`): a frase da Amanda → abertura completa + agenda; "Desculpa, acabei não indo hoje. Tem horário na terça?" → *"Imagina, acontece. Obrigado por avisar. Consigo te atender na terça…"*; mensagem longa com "tudo bem?" e sem falta → *"Tudo bem por aqui, e você? Na terça (15/09), no período da manhã…"*; "Oi, tudo bem?" curto → igual a antes. O bloco do cron (vaga reaberta) não tem como ser disparado daqui sem criar lead real — conferido por leitura. Sem bump de `?v=` (só functions).

## 29.181.0 — JuIA conduz a remarcação depois do cancelamento (12/09, manhã)

**Pedido do Juliano (12/09/2026, ~08h, print do Lucas):** "ensine a JuIA a conduzir a remarcação quando o cliente cancelar". A conversa das 07h56: "Preciso desmarcar" → "É o seu agendamento de hoje às 10:00 para Corte de cabelo + Barba Express + Sobrancelha Masculina que você quer cancelar?" → "Sim" → *"Pronto! Cancelei… Se quiser marcar outro horário, é só me dizer."* E parou. Quem cancela quase sempre ainda quer o serviço, só não naquele dia — deixar a iniciativa com ele é cadeira vazia. Uma mudança em `ju-ia-site` (**v249**, `verify_jwt=true` igual ao anterior):

**1. A resposta do cancelamento já oferece o próximo dia.** Depois do "Pronto! Cancelei…", a JuIA guarda o serviço do agendamento cancelado (pelo `service_name`, partido no " + "), procura o próximo dia com vaga para aquela duração **a partir de hoje, pulando o dia do agendamento cancelado** (se ele não pôde nesse dia, oferecer outro horário do mesmo dia é surdez) e responde: *"Pronto! Cancelei seu agendamento de hoje às 10:00. Quer já deixar outro horário marcado para Corte de cabelo + Barba Express + Sobrancelha Masculina? Na terça (15/09) tenho alguns horários entre 08:00 e 17:30 (por exemplo 08:00, 11:15, 14:30 ou 17:30). Se preferir outro dia, é só me dizer qual."* Sem vaga em 21 dias, sai a frase antiga. Botões (só no site): 4 horários de exemplo, "Outro dia", "Depois eu vejo".

**2. A resposta à oferta é tratada em código (`pending_rebook`, registrada no registro único de perguntas como `rebook`).** Vale um turno — qualquer resposta fecha a oferta:
- "Sim" / "pode ser" → lista o dia oferecido (fluxo normal de disponibilidade, com o serviço já anotado);
- horário ("10:00") → checa a agenda daquele dia e segue pro fecho de sempre (oferta única, "posso confirmar?");
- dia ("sexta", "amanhã", "hoje") ou período → a data vira a citada e segue o fluxo normal;
- "Prefiro outro dia" → *"Claro. Para qual dia você quer ver os horários para …?"*;
- "não", "depois eu vejo", "te aviso", "vou deixar" → *"Tudo bem. Quando quiser remarcar, é só me chamar por aqui que eu vejo os horários com você."* e limpa serviço/dia do estado (sem isso um número solto mais tarde viraria "Vamos marcar!", caso João 29.150.0);
- outro pedido de agenda por cima (cancelar outro, remarcar) → o bloco dele resolve; mudança de assunto → a oferta cai e a conversa segue.

**Detalhe que quase passou:** a reserva feita na própria conversa deixa `completed=true` no estado, e `notSpecialFlow` exige `!completed` — se o cliente marcasse e cancelasse na mesma conversa, o "sim" à oferta não abriria a agenda. O cancelamento agora zera `completed`.

**Erro no caminho, registrado de propósito:** a primeira aplicação do patch (heredoc no Bash do Windows) comeu um nível de barra invertida — `\b` virou caractere de backspace e `\s*\+\s*` virou `s*+s*`, regex que nem compila. O esbuild passou (não valida o conteúdo de regex literal), e só uma conferência byte a byte (`cat -A`) pegou. Corrigido antes do deploy; as 11 regex das linhas novas foram carregadas com `new RegExp` para provar que compilam. Lição: com esta ferramenta, escrever o script em arquivo, nunca por heredoc/`node -e`.

**Conferido em produção** (sessões `deploy-check-v29181-*`, chave publicável, telefone de teste `5599900011234`, apagadas de `site_chat_messages` em seguida — 10 linhas): "Sim" → lista da terça (15/09) com pergunta de período; "10:00" → *"Sim! na terça (15/09) às 10:00 está livre… Quer incluir mais alguma coisa?"* com `time=10:00`; "Não, depois eu vejo" → frase de encerramento, estado limpo; "Prefiro outro dia" → pergunta do dia com o serviço; "Sexta" → sexta (18/09). **O que não deu pra conferir daqui:** o turno do cancelamento em si (a oferta nascendo do `doCancel`) exige chamada com `service_role`, que esta máquina não tem à mão — fica pra conferir no WhatsApp com um agendamento de teste. `npm test`: unit verde e 48 e2e — uma de rota (`/agendar/horario/` direto, sem relação com a function) falhou na primeira rodada e passou ao repetir o spec (4/4). Sem bump de `?v=` (só function).

## 29.180.0 — JuIA aprende com o Breno e o Renato (11/09, à tarde)

**Pedido do Juliano (11/09/2026, ~15h20, dois prints):** "revisa estas duas conversas, são ricas e tem coisa pra ensinar a JuIA". As duas terminaram com ele assumindo na mão ("vc estava sendo conduzido pela IA da nossa barbearia"). Três erros, três correções em `ju-ia-site` (**v248**, `verify_jwt=true` igual ao anterior):

1. **Breno, 14h49 — "Certo, só um minuto então" → "me embolei".** E logo depois "vou só ver se posso ir mais cedo" recebeu a MESMA oferta repetida. Quem pede um minuto está pensando, não perguntando. O detector de "estou adiando" (v29.138.0, caso Carlos) passou a reconhecer "um minuto/momento/instante/segundo", "já te falo/volto", "pera aí/espera aí" e "vou só ver" (o "só" no meio quebrava o padrão). Resposta: "Combinado, fico no aguardo", e só.
2. **Breno, 14h54 — "Você pode marcar cabelo e sobrancelha por favor", logo depois do "Reservado! (Corte)" → "Já está reservado (Corte de cabelo). Te espero!"** A sobrancelha foi ignorada; o Juliano incluiu na mão às 15h07. Agora, serviço citado que NÃO está na reserva recém-feita é pedido de INCLUIR: "Confirmando: incluir Sobrancelha Masculina no seu agendamento de amanhã às 13:15? Fica Corte de cabelo + Sobrancelha Masculina (R$ 55,00, aproximadamente 55 min). Responda sim ou não." O "sim" cai no bloco de troca de serviço já existente (composto, mesma RPC).
3. **Renato, 13h29 — "Humm a partir das 14 não consigo. Mas agradeço 😃" → "me embolei".** Log: "IA repetiu resposta para pergunta nova". O "14" foi lido como pedido das 14h; era um TETO ("tenho que terminar antes das 14"). Agora "a partir das X não consigo/posso/dá", "só até as X", "antes das X eu consigo" viram `maxTime`: o horário sai do pedido e a lista só mostra o que TERMINA até lá (início + duração ≤ teto). Sem nada que caiba: "Hoje não tenho mais horário para Corte de cabelo que termine antes das 14h. Amanhã tenho alguns horários entre 08:00 e 17:30 (por exemplo …). Quer que eu reserve um?" — a resposta que o Juliano deu na mão às 15h11, com print da grade.

**Acertos que ficam:** oferta com os dois horários vizinhos ("14:00 ocupado, o mais próximo é 13:15; tenho ainda 12:55, 13:00"), reserva no "Pode marcar pra 13:15", pergunta de primeira visita respondida e registrada.

**Não mexido (anotado):** "Consigo agenda pra agora?" às 13h26 recebeu a lista a partir das 14:50 sem dizer que "agora" não dava — a frase certa é "agora mesmo não consigo, o próximo livre é 14:50". Fica pra próxima rodada, com mais um caso.

## 29.179.0 — Os três itens que tinham ficado fora, de propósito, agora feitos

**Pedido do Juliano (11/09/2026, ~14h):** "arruma tudo o que faltou então". Eram três itens que eu tinha deixado fora com justificativa; cada um foi feito de um jeito que remove o risco que justificava deixá-lo.

**1. Uma função de dinheiro só.** `window.BDJ_H.money` em `admin-ux-v30.js`. Seis telas tinham a mesma cópia e passaram a usá-la. Vales-presente, que trabalha em centavos, converte antes de chamar (`money = (cents) => BDJ_H.money(cents / 100)`) — o valor na tela é o mesmo. Fidelidade usava "money" só pra virar número: renomeado pra `num`. Nenhum valor exibido muda.

**2. CSS do admin em arquivo próprio, de verdade.** Um script leu `css/04` e `css/05` regra a regra e moveu para `css/06-admin-reforma.css` **345 das 900 regras**: só as que têm seletores usados apenas pelo painel (classe/id que aparece em `admin*.html`/`admin-*.js` e em nenhuma página do site), mantendo a ordem relativa, e recuando em 86 casos em que o mesmo seletor reaparece mais adiante numa regra que fica (reordenar mudaria quem vence). **Erro no caminho, registrado de propósito:** a primeira versão do script checava o conflito numa passada só, e um bloco que desistia de mover no fim da lista deixava de proteger quem vinha antes — `.admin-brand{display:flex}` foi pra 06 e passou a vencer o `display:none` do celular que ficou na 05: a marca e o rodapé do menu reapareciam no telefone. Foi o snapshot que pegou (13 propriedades em 4 páginas, só a 390px); o conflito passou a rodar até ponto fixo e o número de regras movidas caiu de 382 pra 345. Só propriedades autorais entram na comparação (cor, fonte, borda, espaçamento interno, display…): largura, altura e margem automática dependem de layout e da hora em que a fonte carregou, e variavam entre rodadas. O que o site também usa (`.btn`, `.agenda-slot`, `.booking-*`, `.eyebrow`…) ficou onde estava. **Prova:** snapshot do estilo calculado (todas as propriedades, elemento por elemento, mais ::before/::after) das 77 páginas em duas larguras (1280 e 390), antes e depois — 168 capturas de cada lado, zero diferença. `style.css?v=29.179.0` em todas as páginas do site e do admin.

**3. Balcão dentro da tela Hoje.** "Sem hora marcada" abre o Atendimento Balcão num modal em cima da tela Hoje, embutido (`admin-balcao.html?embed=1`: a casca esconde menu, barra do celular e cabeçalho). Uma implementação só do formulário. Quando o Balcão registra o atendimento, avisa a tela de fora (`postMessage` da mesma origem) e a Hoje se redesenha com o caixa do dia atualizado. No celular o modal ocupa a tela inteira; "Abrir em tela cheia" continua existindo.

**Cache:** 12 JS + core em `?v=29.179.0`; `ADMIN_VERSION` + `admin-version.json` em 29.179.0. `npm test`: 109 unit + 48 e2e verdes.

## 29.178.0 — Remarcar sem sair da tela (o item da fase 3 que tinha ficado de fora)

**Pedido do Juliano (11/09/2026, ~13h30):** "faltou alguma etapa? se faltou pode fazer agora". Conferindo a proposta item a item, faltava este: Remarcar ainda gravava o id no sessionStorage e navegava pro formulário de Novo agendamento — troca de contexto no meio do atendimento, o oposto do "ação onde a informação está". Agora o botão Remarcar (Hoje, Agenda e Lista de espera, todos pelo mesmo `bindBookingActions`) abre um modal em cima do card: data, grade "Horários que cabem" (a mesma `get_available_slots_excluding`, sem o próprio agendamento na conta), campo livre, e as duas exceções — fora do horário e encaixe, este com a conta dos minutos da v29.173.0 antes de salvar. Serviço, preço, duração e observação ficam como estão; "Trocar serviço junto" leva ao formulário completo, que continua existindo. Depois de salvar, a tela se redesenha e um toast confirma. `admin-v15-4-agenda.js` e `core` em `?v=29.178.0`; `ADMIN_VERSION` + `admin-version.json` em 29.178.0.

**Conferência final da proposta, item a item:** menu único ✓ · avisos iguais ✓ · cache alinhado ✓ · casca única ✓ · confirmação/pergunta da casa ✓ · estado vazio (`BDJ_UX.empty`) ✓ · tela Hoje ✓ · caixa do dia ✓ · lista de espera de hoje ✓ · Concluir com pagamento em destaque ✓ · remarcar no card ✓ (esta) · "sem hora marcada" a um toque da tela Hoje ✓ (link pro Balcão; virar bloco na própria tela fica pra quando o Balcão for redesenhado) · celular: Mais ✓, teclado ✓, Concluir numa mão ✓ · Financeiro diário ✓ · telas secundárias sem estilo solto ✓ · CSS próprio ✓ (só o da reforma; 04/05 antigos ficam onde estão, mover cascata é risco sem ganho) · helper único ✓ (`esc`; `money` de propósito não).

## 29.177.0 — Reforma do admin, fases 4 (parte 2) e 5: numa mão no celular, Financeiro por dia, telas secundárias na mesma linguagem, CSS e escape únicos

**Pedido do Juliano (11/09/2026, ~13h):** "fez tudo, não ficou nada pendente?" → "pode fazer tudo hoje, estou ansioso pra ver". Fecha a proposta de reforma no mesmo dia em que começou.

**Fase 4, parte 2 — modal de Concluir numa mão** (`admin-v15-4-agenda.js`): serviço realizado e forma de pagamento ficam em cima; produtos, desconto, caixinha, cortesia, fidelidade e avaliação foram pra dentro de "Mais opções" (`<details>`), que abre sozinho no desktop e sempre que o cliente já comprou produto no agendamento. No telefone o botão "Concluir ✓" deixou de ficar três telas abaixo. Os 11 `style="…"` do modal viraram classes (`checkout-input`, `checkout-h3`, `admin-fold`…). Teclado certo em 10 campos numéricos (`inputmode="decimal"` pra valores, `"numeric"` pra quantidades; campos com mínimo negativo ficam como estão, o teclado numérico do iPhone não tem sinal de menos).

**Fase 5 — Financeiro por dia, semana e mês** (`admin-financeiro-v29.js`, `admin-financeiro.html`): abas Dia / Semana / Mês ao lado das setas; semana é terça a sábado, a mesma régua dos Relatórios; as setas andam no passo do recorte. Receita, despesas, caixinha, taxa absorvida e lançamentos respeitam o recorte. "Repetir fixos do mês passado" e o dia de equilíbrio continuam pensando em mês.

**Fase 5 — telas secundárias sem estilo solto:** Equipe (8 `style=` → classes `eq-*`, `INPUT_STYLE` apagado), Relatórios (cores das barras e legendas → `is-gold`/`is-gold2`/`is-blue`; só a largura dinâmica ficou inline, que é dado), Conteúdo (5 → `conteudo-*`, `meta.is-text`, `meta.is-warn`), Financeiro (`fin-strong`, `fin-empty.is-tight`).

**Fase 5 — CSS da reforma em arquivo próprio:** tudo que as fases 1 a 4 tinham anexado ao fim de `css/05` foi para `css/06-admin-reforma.css`, importado por último no `style.css` (mesma ordem de cascata, nenhuma regra mudou de lugar relativo). Regra daqui pra frente: CSS novo do painel vai na 06.

**Fase 5 — uma função de escape só:** `window.BDJ_H.esc` em `admin-ux-v30.js`; as 11 cópias locais (`const esc = …`) viraram `const esc = window.BDJ_H.esc`. A única diferença entre as cópias era Mensagens tratar null como vazio — a versão única faz isso pra todas. `money` NÃO foi unificada de propósito: Vales trabalha em centavos e Fidelidade usa número puro; unificar mudaria valor na tela.

**Cache:** 13 JS + core + `style.css` em `?v=29.177.0`; imports de css/05 e css/06 em 29.177.0; `ADMIN_VERSION` + `admin-version.json` em 29.177.0. `npm test`: 109 unit + 48 e2e verdes. Com isto, as 5 fases da proposta "Barbearia OS, reforma" estão no ar.

## 29.176.0 — Reforma do admin, fase 4 (parte 1): no celular, "Mais" abre todas as telas

**Pedido do Juliano (11/09/2026):** "pode aplicar todas as suas sugestões no admin". A barra inferior do celular (`admin-pwa.js`) tinha 7 atalhos fixos e deixava de fora Balcão, Financeiro, Equipe, Lista de espera, Vales, Fidelidade, Relatórios, Avaliações e Funil — pelo telefone, essas telas simplesmente não existiam. Agora são 5 atalhos do dia (Hoje, Agenda, Agendar, Clientes, Balcão) + **Mais**, que sobe uma folha com todas as telas nos mesmos 4 grupos do menu — a lista vem da casca (`window.BDJ_SHELL.groups`), uma só pra desktop e celular. Esc e toque fora fecham. CSS em css/05; `style.css`, `admin-pwa.js` e `core` em `?v=29.176.0`; `ADMIN_VERSION` + `admin-version.json` em 29.176.0.

**Ainda da fase 4 (próxima sessão):** cards e modais que cabem numa mão (o modal de Concluir ainda é longo no telefone), teclado numérico nos campos de valor. **Fase 5 inteira pendente:** Financeiro diário, Equipe, Relatórios e Central de Conteúdo na mesma linguagem; CSS do admin em arquivo próprio; uma cópia de cada helper (hoje 15).

## 29.175.0 — Reforma do admin, fase 3: a tela "Hoje"

**Decisões do Juliano (11/09/2026):** Visão geral e Modo Atendimento viram uma tela só; o caixa do dia mora nela; "no visão geral já é o resumão do dia, eu iria na agenda só quando quisesse consultar algo específico".

**A tela (`admin.html`, `admin-v15-4-dashboard.js`):**
- Cabeçalho com o dia por extenso e o resumo em uma linha ("4 restantes · 3 concluídos · próximo: Luiz às 14:00"), botão Atualizar, "Sem hora marcada" (Balcão) e "Novo agendamento".
- Seis números que importam na hora (Restantes, Concluídos, Faturado com a caixinha à parte, Serviços, Cadeira/câmera, Alarme); os outros oito (agendados, aguardando, confirmados, ticket médio, serviços por cliente, ausências, amanhã, clientes) desceram pra uma faixa compacta no fim.
- **Linha do dia:** o card completo da Agenda (v29.171.0) + a pergunta "já cortou aqui antes?" que só existia no Modo Atendimento (v29.98.0), e um marcador "agora · 12:05" no ponto certo da fila. Em `admin-v15-4-agenda.js`, as ações do card viraram `bookingActionsHtml(x)` pra tela Hoje compor.
- **Caixa do dia:** o que entrou hoje (serviços líquidos + produtos, só concluídos; mesma conta dos Relatórios: cortesia = 0, prêmio da fidelidade abatido; `service_price` já vem líquido do desconto manual, migration 147, então NÃO se abate de novo), caixinha à parte, despesas lançadas hoje (`finance_entries` do dia) e a divisão por forma de pagamento (serviço pela `payment_method`, produto pela `products_payment_method` ou, sem ela, a do serviço).
- **Querem vaga hoje:** quem está na lista de espera pedindo hoje (data exata, janela que cobre hoje ou dia da semana marcado), com atalho pra Encaixar.
- Clientes com ausência, como antes.

**Modo Atendimento:** `admin-atendimento.html` virou redirecionamento pra `admin.html` (links e atalhos antigos continuam funcionando); saiu do menu (17 destinos). `admin-v15-4-atendimento.js` continua carregado porque é dele a pergunta de primeira vez. Menu: "Visão geral" agora se chama "Hoje".

**Cache:** `dashboard`, `agenda`, `shell`, `core` e `style.css` em `?v=29.175.0`; `ADMIN_VERSION` + `admin-version.json` em 29.175.0. `npm test`: 109 unit + 48 e2e verdes.

## 29.174.0 — Reforma do admin, fase 2: casca única e caixas de diálogo da casa

**Pedido do Juliano (11/09/2026, ~12h):** "vamos voltar e pode aplicar todas as suas sugestões no admin" — aceitou as três recomendações da proposta (Visão geral + Modo Atendimento viram "Hoje"; caixa do dia na tela Hoje; fase 2 antes da 3). Esta é a fase 2.

**Casca única (`admin-shell-v30.js`).** O cartão de login e o menu lateral saíram das 18 páginas (eram 5 variações do login e, até a fase 1, 5 menus) e viraram dois espaços vazios (`data-shell="login"` e `data-shell="sidebar"`) que um arquivo só preenche, sempre igual. Carrega logo depois do `agenda-config`, antes de qualquer script de tela — a Fidelidade quebrou no teste justamente porque o script dela vinha antes e procurava `#admin-signin` num espaço ainda vazio; a ordem agora é conferida por script nas 18 páginas.

**Caixas de diálogo da casa (`admin-ux-v30.js`, sucessor do v22-4).** `BDJ_UX.confirm()` e `BDJ_UX.prompt()` substituem os 17 `confirm()` e 9 `prompt()` nativos (caixa cinza do navegador, "Esta página diz…") em 11 arquivos. Mesmo contrato das nativas (true/false; texto ou null), então a troca nos chamadores foi `confirm(` → `await BDJ_UX.confirm(` — todos já eram `async`. Enter confirma, Esc cancela, ação destrutiva (excluir, apagar, encerrar) sai com botão vermelho. Também entrou `BDJ_UX.empty()` pro estado vazio. CSS em css/05; `style.css?v=29.174.0`.

**Cache:** 11 JS mexidos + core em `?v=29.174.0` em todas as páginas que os carregam; `ADMIN_VERSION` + `admin-version.json` em 29.174.0. `admin-ux-v22-4.js` removido do repositório (nenhuma página o carrega mais).

**Fora desta fase (fica pra 5):** CSS do admin ainda mora em css/04 e css/05 junto com o do site; helpers (esc/money/login) continuam copiados por arquivo.

## 29.173.0 — Encaixe: "Permitir encaixe em cima de outro atendimento" no Novo agendamento

**Pedido do Juliano (11/09/2026, 11h47, print do celular):** foi remarcar um cliente pra 17:50 num dia cheio e o painel recusou ("Esse período já está ocupado"). "Me permite excepcionalmente incluir algum cliente entre um e outro, eu sei que é muito rápido e que eu faço em menos tempo que o determinado do sistema." Segunda caixa no formulário, ao lado da de "fora do horário": marcada, manda `p_allow_overlap=true` e as funções `admin_create_booking` / `admin_reschedule_booking` (migration 151, assinatura nova) pulam SÓ a colisão com outros atendimentos. Bloqueio de agenda continua barrando; dia fechado e fora do expediente continuam na outra caixa; site e JuIA seguem sem encaixe. A dica de "nenhum horário livre" passou a explicar o caminho. E, pedido dele na sequência ("deve me dar uma mensagem pra eu pensar"), antes de salvar com encaixe o painel mostra quem já está no período, quanto os atendimentos somam e quantos minutos ele terá de fato ("somam 120 min, você terá 75 min, das 17:50 às 19:05; o próximo cliente é às 19:10. Prosseguir?") — só salva se ele confirmar. Cache: `agendamento.js` e `core` em `?v=29.173.0` nas 7 páginas; `ADMIN_VERSION` + `admin-version.json` em 29.173.0.

## 29.172.0 — Reforma do admin, fase 1: um menu só, avisos iguais em toda tela, cache alinhado

**Pedido do Juliano (11/09/2026, ~11h):** "por que você não repensa todo meu módulo admin pra ficar nível de
software profissional?" e, na sequência, o sentimento: "quando eu olho pro admin eu sinto que fui eu que fiz,
não sinto que foi um grande engenheiro de software que desenvolveu". Antes de mexer em qualquer tela, foi
feito um inventário das 18 páginas (relatório no artifact "Barbearia OS, reforma"). O diagnóstico que
explica o sentimento dele, em números:

- **5 menus laterais diferentes** entre as 18 páginas: `admin.html` e `admin-relatorios.html` com 17 itens
  (sem Vales-presente), `admin-fidelidade.html` com 15 (sem Modo Atendimento, Mensagens e Notificações),
  metade dos links sem `data-admin-nav` e `class="active"` em vez de `is-active` — o realce nem acendia.
  Ordem diferente em pelo menos 4 variações.
- **Dois visuais para o mesmo aviso:** `admin-ux-v22-4.js` (que transforma `alert()` em toast dourado e
  captura erro não tratado) só era carregado em 8 das 18 páginas. Conteúdo (14 alerts), Equipe (12),
  Vales (3), Espera (2) e Fidelidade (2) mostravam a caixa cinza nativa do navegador.
- **Cache desalinhado:** o mesmo arquivo com versões diferentes conforme a página (`agenda-config-v6.js`
  em 4 versões, `admin-pwa.js` em 2, `admin-v15-4-core.js` em 2). Risco real de misturar versões.

**O que entrou (só estrutura, nenhuma tela mudou de função):**
- Menu único nas 18 páginas, gerado por script a partir de uma lista só, com os mesmos 18 itens em
  **4 grupos**: Dia a dia (Visão geral, Agenda, Novo agendamento, Modo Atendimento, Balcão, Lista de
  espera) · Clientes (CRM, Fidelidade, Vales, Funil de Reativação) · Dinheiro (Financeiro, Relatórios,
  Equipe) · Comunicação (Mensagens, Notificações, Assistente IA, Avaliações, Central de Conteúdo).
  Item ativo marcado no próprio HTML (`is-active`), então funciona também nas páginas que não carregam
  o core. Rótulo de grupo só no desktop (`.admin-nav-group`, css/05); no celular o menu segue como
  faixa rolável.
- `admin-ux-v22-4.js` em todas as 18 páginas: toast + rede de segurança de erro em todo lugar.
- Versões de cache unificadas: `agenda-config-v6.js` 29.32.0, `admin-pwa.js` 28.58.0, `style.css`
  29.172.0 (com o import da css/05 no mesmo número) e `admin-v15-4-core.js` 29.172.0 nas 7 páginas.
- `ADMIN_VERSION` + `admin-version.json` em 29.172.0.

**Decidido contra a recomendação óbvia:** não removi o bloco `@media(max-width:760px)` que aparece
duas vezes em `css/05-admin-mobile-refino.css` — a auditoria dizia "byte a byte idêntico", o script
conferiu e a primeira linha difere no fim; remover às cegas podia derrubar regra viva. Fica para a
fase 2, quando o CSS do admin ganha arquivo próprio.

**Próximas fases (no artifact, aguardando o Juliano escolher):** 2) casca única (login, menu e
cabeçalho num arquivo só) + componentes de modal/confirmação/vazio; 3) "Hoje" como tela única
(painel + Modo Atendimento + caixa do dia) e remarcar sem sair da Agenda; 4) celular de verdade
(barra inferior com tudo, gestos); 5) telas secundárias (Financeiro diário, Equipe, Conteúdo).

## 29.171.0 — Painel: o card de hoje ganha as mesmas ações da Agenda

**Pedido do Juliano (11/09/2026, ~10h50, com print):** abriu o atendimento das 10h no painel inicial e "nesta tela devia ter o botão de concluir" — e, no segundo print, as opções todas da Agenda. O card "Próximos atendimentos" do painel só tinha o link "Ver na agenda" (decisão da v28.26.0: "o dashboard é só um resumo rápido"). Revertida: agora o painel usa o MESMO `bookingCard()` da Agenda (WhatsApp, Remarcar, Concluir, Ausência, Cancelar, Editar, Novo retorno) e o mesmo modal de conclusão (pagamento, produtos, desconto, fidelidade). O que faltava por baixo: depois de qualquer ação o código redesenhava o calendário da Agenda, que não existe no painel — os 4 pontos de refresh ganharam o ramo `page===dashboard` → `renderDashboard()`. Cache: `dashboard.js` e `agenda.js` em `?v=29.171.0` nas 7 páginas; `ADMIN_VERSION` + `admin-version.json` em 29.171.0.

## 29.170.1 — Data e Horário descem pra junto da grade

**Pedido do Juliano (11/09, 09h30, com print):** "colocar o campo pra escolher a data e embaixo já abre os horários disponíveis, seria mais funcional". Os campos Data e Horário saíram do topo (ficavam ao lado de Cliente/WhatsApp) e agora vêm depois dos serviços, num bloco "Data e horário", com a grade logo abaixo: a ordem da tela virou a ordem de pensar (quem → o quê → quando). Só HTML; `ADMIN_VERSION` + `admin-version.json` em 29.170.1 pra recarregar o painel aberto.

## 29.170.0 — "Horários que cabem" no agendamento do admin; JuIA aprende com a noite do Venilson (9 erros)

**Pedido do Juliano (11/09/2026, 08h43, "plano do dia"):** na noite anterior ele foi encaixar um cliente
pelo painel e "tive dificuldade de visualizar os horários disponíveis pra corte" — acabou abrindo o site
como se fosse cliente e mandando print da grade. Quer isso dentro do admin, "pra falar com assertividade
pros clientes". E: "revisa esta conversa inteira, tem diversos erros da JuIA, muitos acertos também";
o que mais o incomodou foi *"Na terça (15/09) tenho 08:00, 10:45, 13:30"* — "deveria dizer tenho alguns
horários entre 8h e 19h, por exemplo".

### Admin: painel "Horários que cabem nessa data" (`admin-agendamento.html`)
Abaixo dos serviços, a mesma grade que o site mostra — chamando `get_available_slots_excluding`
(fim de cada atendimento + grade de 15 em 15, término até 60 min após o fechamento), com a duração
somada dos serviços marcados. Clicar num horário preenche o campo Horário; digitar continua livre
(a grade é informação, não trava). Na remarcação, o próprio agendamento não conta como ocupado.
Migration 150: `grant execute … to authenticated` (a 088 tinha tirado o PUBLIC de propósito; anon
segue sem acesso, o site continua na `get_available_slots`). Cache: `admin-v15-4-agendamento.js`
e `core` em `?v=29.170.0`, `ADMIN_VERSION` + `admin-version.json` em 29.170.0 (os dois juntos, regra
da v29.99.0).

### JuIA — caso Venilson (10/09, 21h44–21h58; 61 mensagens; cliente de Tuiuti, relaxamento)
A conversa terminou com DOIS agendamentos no banco (quinta 17/09 14:15 e sábado 19/09 10:00, ambos
"Alisamento + Corte"), um "me embolei" e o Juliano fechando na mão de manhã (sábado 19/09 às 9h, só o
relaxamento). O que aconteceu, na ordem, e o que mudou:

1. **"Vamos fazer esse" às 21h48 virou "Hoje não tenho mais horário… te aviso assim que abrir vaga
   hoje"** — a barbearia fechada há três horas. Agora, com o dia já encerrado, a resposta é "Hoje já
   encerramos (atendemos até 19h). Na terça tenho…" e não existe lista de espera pra hoje.
2. **A reserva de sábado 14:15 foi feita e o cliente nunca soube.** Log do webhook: a JuIA levou 16 s
   (consultou, reservou, montou o "Reservado!"), o `fetchWithTimeout` padrão de 15 s abortou a espera,
   mas a reserva já estava no banco. A mensagem seguinte encontrou sábado "cheio". Dois remendos:
   (a) o webhook espera a JuIA até 45 s (abortar não desfaz o que ela fez); (b) resposta que confirma
   reserva ("Reservado!", "Prontinho! Mudei/Troquei") nunca é descartada como obsoleta.
3. **"No sábado não tenho mais horário"** quando o horário que faltava era o DELE — dia cheio em que o
   próprio cliente já tem reserva agora responde "Você já está reservado no sábado às 14:15…".
4. **A frase que incomodou o Juliano.** `tenhoSlots`: com mais de 4 horários, "tenho alguns horários
   entre 08:00 e 17:00 (por exemplo 08:00, 09:30, 11:15 ou 17:00)"; com 4 ou menos, a lista é a faixa,
   com "ou" no fim. Mesma faixa no "Conferi de novo…" e no "já está ocupado. O que tenho é: 8 horários".
5. **"1 vez" (resposta à pergunta de primeira visita) não casou com `^1$`**, a pergunta morreu (one-shot)
   e a mensagem caiu no bloco de remarcação — que negou o 14:15 que a própria JuIA acabara de reservar.
   Aceita "1 vez", "1ª", "primeira"; "2 já sou cliente" idem.
6. **Estado vazado:** a pergunta de conflito da reserva anterior deixou `pending_reschedule_*` vivo
   depois da reserva nova. Reserva nova fecha toda pergunta antiga (reschedule, cancel, conflict,
   change_service).
7. **"Estou ocupado pela manhã" → lista com 08:00 e 09:30.** `detectPeriod` lia "pela manhã" como pedido
   DE manhã. Período negado ("ocupado / não posso / trabalho / reunião … de manhã") vira `not_morning`
   (e `not_afternoon`, `not_evening`), que `slotsForPeriod` filtra; a remarcação passou a respeitar o
   período dito. Lista de espera não recebe período negado (guarda null).
8. **"Isso" depois de "Prontinho! Mudei…" recebeu a CHAVE PIX.** O "sim" curto só é resposta à oferta
   do Pix quando a última fala da JuIA foi a que ofereceu ("é só me pedir a chave").
9. **"Não vou cortar" + "Só o alisamento" → duas listas numeradas, e o "2" virou "me embolei".** A lista
   de troca de serviço saía sem estado (a do cancelamento tinha). Agora guarda os ids
   (`pending_change_service_options`, registrada em PERGUNTAS) e o serviço já dito
   (`pending_change_service_hint`): "2" → "Confirmando: trocar … de Alisamento + Corte para Alisamento /
   Relaxamento? Responda sim ou não."
   Bônus do mesmo caso (21h54): "O Juliano está atendendo na cadeira agora" às dez da noite → fora do
   horário sai "O Juliano já encerrou por hoje, mas eu já te adianto".

**Acertos que ficam:** "desondulação" → entendeu alisamento/relaxamento; pergunta de conflito antes de
duplicar; áudio transcrito e respondido; remarcação 12/09→19/09 confirmada com sim/não.

**Fora desta versão (anotado):** o modelo incluiu "Corte de cabelo" sozinho ("Mas como meu cabelo é
ondulado" não pede corte) — é decisão do modelo, não há regra determinística; observar se repete.
**Ação manual pendente:** o banco ainda tem os dois agendamentos do Venilson (a correção direta foi
bloqueada pela política de auto mode desta sessão) — cancelar quinta 17/09 14:15 e remarcar sábado
19/09 de 10:00 pra 09:00 com só "Alisamento / Relaxamento" (55 min, R$ 70).

**NO AR** (11/09, ~09h20 BRT): commit 01c7ea3 no GitHub Pages (curl: admin-version.json 29.170.0, painel e cache novos em admin-agendamento.html); migration 150 aplicada via apply_migration (success); `ju-ia-site` **v247** e `whatsapp-webhook` **v112** via CLI, verify_jwt igual ao anterior (true / false). `npm test`: 109 unit + 48 e2e, tudo verde.

**Varredura das outras 23 conversas de 10/09:** nada novo de código. Repetem-se padrões já conhecidos
(cliente que diz "depois eu vejo" depois de "não tenho na manhã"; o Juliano assumiu 6 conversas na mão
e fechou 4 — Vytor 16:30, Paulo terça 16:30, Levi quinta 16:00, Dr. 13:30). Rascunhos do cron das 8h
de hoje (IG/FB/Status) aguardam o crivo das 8h05; peças agendadas de hoje: IG/FB 12h e o Reel da toalha
quente 18h30.

## 29.169.0 — Plano de 30 dias produzido e agendado; filtro "a conversa da cadeira não é assunto público"

**Pedido do Juliano (10/09/2026, 15h):** "cadê meu gerente de marketing, publicação com vídeo programada só
pro dia 18/09, estamos perdendo tempo" → Reel da toalha quente antecipado para sexta 11/09 18h30. Depois:
"pode produzir todas as peças que não dependam de mim e já deixa programado pra sair sozinho", "utilize o
recurso de design do Claude pra criar as melhores artes", e um filtro: ele corrigiu à mão uma legenda que
dizia "a conversa que nós tivemos fica entre eu e você" — "não gosto deste tipo de afirmação pública".

**Causa raiz do atraso:** o plano de 30 dias (artifact de 09/09) existia só como documento; a rotina das 8h05
não o lia, então nenhuma peça planejada era produzida (o humor de 10/09 não saiu; saiu o automático).

**O que entrou:**
- `assets/plano-30/<peça>/`: 37 artes (13 peças, 08/09–07/10) geradas por código no molde do carrossel do
  fade (Bebas Neue + Inter, dourado da marca), 4 estruturas visuais (carrossel escuro, humor tipográfico,
  card de avaliação em papel claro, resposta gigante) + 2 fotos reais da loja. Crivo visual em folha de
  contato e quadro a quadro; preços conferidos em `services`, citações literais de `google_reviews`, fontes
  do post do farmacêutico na SBD. Canvas editável (Claude Design): "Artes do Plano de Setembro".
- `content_posts`: 26 linhas `agendado` (Instagram 12h00 + Facebook 12h15 BRT em cada dia de peça:
  11, 12, 15, 16, 17, 19, 22, 24, 25, 26, 29/09 e 01, 02/10). Carrossel só no Instagram; Facebook leva o
  1º quadro. `marketing_calendar` recebeu as 13 peças.
- `content-generate-daily` (deploy): `NAO_INVASIVO` ganhou o bloco "A CONVERSA DA CADEIRA NÃO É ASSUNTO
  PÚBLICO" — proibido prometer/afirmar sigilo, confidência ou intimidade sobre o que o cliente fala na
  cadeira. Mesma regra em `marketing_memory` (restrição, id ea862ea9) e na rotina `crivo-conteudo-8h05`.
- Rotina `crivo-conteudo-8h05`: passa a ler `marketing_calendar`; em dia de peça planejada, o rascunho
  automático de Instagram/Facebook é rejeitado (não fica pendente) e só o Status do WhatsApp segue.

**Ficou fora (depende de material do Juliano):** corte da semana (11 e 30/09), antes/depois (23/09), Reel do
sábado (03/10), duelo de cortes (06/10), dúvidas da caixinha (07/10), Recado de domingo (gola de papel) e
os Stories de enquete (21 e 28/09), que a API não agenda.

## 29.168.0 — Corte 45 min, Corte + Lavagem 50 min (e as reservas futuras encolhem junto)

**Pedido do Juliano (10/09/2026, 13h15):** depois de um dia inteiro com 50/55 (v29.164.0), "45 pra
corte e 50 pra corte com lavagem é o ideal". Só esses dois serviços mudam.

**Onde:** banco (`services.duration_minutes`), `services-catalog-v7.js`, cards de `/agendar/`
(texto e `data-time`), `/precos/`, `servicos.html`, home e FAQ (texto e JSON-LD), páginas do corte
masculino, degradê, social e Corte + Lavagem, artigo "Quanto custa cortar cabelo". Script com
contagem esperada em cada troca, na ordem certa (primeiro o corte 50→45, depois a lavagem 55→50,
senão o "50" novo da lavagem virava 45). Barboterapia com ozônio, que também é 50, ficou intacta.

**Lição da manhã aplicada:** as reservas futuras feitas hoje com 50/55 foram encolhidas junto
(corte 50→45, Corte + Lavagem 55→50, corte + sobrancelha 65→60): Levi 10/09 16:00, Lucas Bueno
10/09 17:15, Fabrício 11/09 12:00, Calvin 11/09 16:00, Vytor 11/09, Sharles 12/09 11:15, Paulo
Spina 15/09 16:30. Encolher nunca colide. **Vytor** foi antecipado de 16:50 pra **16:45** (pedido
do Juliano: "o mais cedo possível" — é o fim do Calvin com 45 min). Os dois "TESTE PagBank" de
2027 ficaram com 30.

Cache `services-catalog-v7.js?v=29.168.0` em todas as páginas que carregam o catálogo;
`ADMIN_VERSION` 29.168.0. A JuIA lê o banco, sem deploy. `npm test`: 109 unit + 48 e2e, tudo verde.

## 29.167.0 — Horário colado no fim do atendimento anterior, e o site pode terminar até 20h

**Caso real (Paulo Spina, 10/09/2026, 12:29):** *"Teria horário hoje às 16h15 ou 16h30?"* → JuIA:
*"16:15 já está ocupado. O mais próximo que tenho é 15:00… 14:30, 14:45"*. Ele: *"Teria que ser
depois"* → JuIA se despediu (*"Fica combinado assim"*). O Juliano assumiu e ofereceu 18h na mão.
O último corte do dia (Lucas) termina 18:05; a grade de 15 em 15 só conhecia 18:00 (dentro do
Lucas) e 18:15 (18:15 + 50 = 19:05, passava das 19h). Resultado: "não tenho nada" com 55 minutos
de cadeira vazia antes de fechar. Palavras dele: *"senão vamos inviabilizar os agendamentos e
isso seria um tiro no nosso pé"*.

**Regra nova, desenhada com o Juliano (migration 149, `closing_rule` + `get_available_slots*`):**
1. **O fim de cada atendimento (e de cada bloqueio) do dia é sempre um horário oferecido**, junto
   com a grade de 15 em 15. Hoje, pra corte: 14:25, 14:30, 14:45, 15:00, **18:05**, 18:15… A 148
   (aplicada e substituída na mesma hora) só oferecia o fim quando a grade seguinte não cabia; o
   Juliano preferiu o fim sempre — "imediatamente após o término, e depois de 15 em 15 nos horários
   com mais vacância".
2. **Início até o fechamento (19:00 ter-sex, 15:00 sáb) e término até 60 min depois (20:00 / 16:00),
   para todo mundo — site inclusive.** Até hoje essa tolerância era exceção só do WhatsApp
   (extended_close_slot_ok, decisão de 06/08: "o site continua estrito"). **Decisão revertida pelo
   Juliano hoje:** "posso passar um pouco das 19h; até um agendamento às 19h é possível se for só um
   corte". Sábado segue a mesma régua (+60), como já era na exceção do WhatsApp.

**Onde a régua entrou:** oferta (`get_available_slots`, agora atalho de `get_available_slots_excluding`),
reserva do site e da JuIA (`create_public_booking_v15`), reagendamento (`phone_reschedule_booking`)
e a checagem de exceção (`extended_close_slot_ok`, que agora só estica ALÉM da tolerância, teto
+120 no total). Sem isso o site oferecia 18:30 e o banco recusava como "fora do atendimento". As
RPCs nunca exigiram grade de 15 — só sobreposição — então 18:05 é aceito sem mais mudança. Na JuIA,
o "último início teórico" (que decide o texto "já é fora do nosso atendimento") segue a mesma
régua; no site, `agenda-v15.js` deixa marcar hoje enquanto o término cabe até 60 min após o
fechamento.

**JuIA — "teria que ser depois" sem hora:** a 29.166.0 ensinou "às 16h ou depois" na mesma frase.
Aqui o "depois" veio sozinho, uma mensagem depois, e o modelo leu como despedida. Agora o horário
que não coube fica guardado no state (`last_requested_time`/`last_requested_date`, gravados no
bloco de horário tomado) e um "depois / mais tarde / após" sem hora, na mesma conversa e no mesmo
dia, vale como "depois daquele horário". "Depois eu vejo / te aviso" não conta. Reproduzido contra
a function publicada, sessão isolada: T1 *"Teria horário hoje às 16h15 ou 16h30?"* → "16:15 já está
ocupado, o mais próximo é 15:00…"; T2 *"Teria que ser depois"* → **"O mais próximo que tenho é 18:05
ou 18:15. Se preferir outro: 18:30, 18:45, 19:00."**

**Não mudou:** o texto público "terça a sexta, 08h–19h" — é o expediente; a hora extra é tolerância
do Juliano, não horário de porta aberta. E o push "atendimento termina depois do fechamento" segue
saindo pra ele quando uma reserva vara as 19h.

**NO AR** (10/09, ~13h05 BRT): migrations 148 e 149 via `apply_migration` (`success`); `ju-ia-site`
**v246** via CLI, `verify_jwt=true` igual ao anterior; `agenda-v15.js?v=29.167.0`. `npm test`: 109
unit + 48 e2e, tudo verde.

## 29.166.0 — "Às 16h ou logo após" é depois das 16h; e o site oferecia horário em cima de corte antigo

**Caso real (Vytor, 10/09/2026, 11:10–11:17):** *"teria algum horário hoje ou amanhã às 16h ou
logo após?"* → JuIA: *"Hoje às 16:00 já está ocupado. O mais próximo que tenho é 15:00… 12:30,
14:30, 14:45"*. Ele insistiu: *"Tem pós às 16h?"* → *"Hoje às 16:00 acabou de ser reservado por
outro cliente. O mais próximo que tenho é 15:00…"* — mesma lista. O 18:00 estava livre o tempo
todo. O Juliano assumiu, ofereceu 18:00 na mão e, quando o cliente pediu amanhã, consultou o
site no celular: 16:30 aparecia livre. Marcou 16:30 — em cima do corte do Calvin, das 16:00.

**Três erros, três causas:**

1. **"Ou logo após" ignorado.** No bloco de horário tomado, as alternativas ficam presas ao
   PERÍODO do horário pedido (16:00 = tarde, até 17:59). O 18:00 é "noite" e nunca entrava. Agora,
   com "depois"/"após"/"pós"/"a partir" na frase, as alternativas são só os horários DEPOIS do
   pedido, em qualquer período, e os dois mais próximos são os dois primeiros depois. Sem nada
   depois, avisa ("Depois disso não tenho mais nada hoje") e cai na lista de antes.
2. **"Acabou de ser reservado por outro cliente" — mentira.** A checagem de "eu já tinha
   oferecido esse horário" casava o 16:00 em qualquer fala anterior da JuIA, inclusive em "16:00
   já está ocupado". O 16:00 de hoje era do Levi desde 15/08. Só conta como oferecido a fala que
   cita o horário sem dizer que estava tomado.
3. **Site mostrando 16:30 livre com corte às 16:00.** O corte do Calvin (11/09 16:00) foi marcado
   em 05/09 com **30 minutos** — antes da 29.139.0 (+10) e da 29.164.0 (corte = 50). O
   `get_available_slots` usa o `end_time` gravado (16:30), então 16:30 era "livre" de verdade
   pro sistema. A v29.164.0 avisou que reservas antigas mantinham a duração antiga; na prática
   isso significa que o site oferece horário dentro de um atendimento que vai durar mais.

**Banco:** os 5 agendamentos futuros com tempo antigo que NÃO colidem com o cliente seguinte
foram esticados pro tempo do catálogo (`bookings.duration_minutes`; `end_time` é coluna gerada):
Walter 10/09 11:30 (50→55), Levi 10/09 16:00 (40→65: corte 50 + sobrancelha 15), Lucas Bueno
10/09 17:15 (40→50), Fabrício 11/09 12:00 (40→50), Sharles 12/09 11:00 (40→55).
**Não mexidos, decisão do Juliano:** Calvin 11/09 16:00 (30 gravado, 50 real) colide com Vytor
16:30; Lucas Red Bull 12/09 10:00 (60 gravado; combo 60 + sobrancelha 15 = 75) colide com
Sharles 11:00. Os dois "TESTE PagBank (apagar)" de 06/01/2027 ficaram como estão.

**Lição registrada:** mudar duração no catálogo sem esticar as reservas futuras deixa o site
oferecer horário em cima de atendimento. Da próxima vez que a duração mudar, esticar junto
(query desta entrada: `update bookings set duration_minutes=… where booking_date>=current_date
and status in ('pending','confirmed')`, conferindo antes o `proximo_inicio` de cada um).

**NO AR** (10/09, ~11h40 BRT): `ju-ia-site` **v245** via CLI, `verify_jwt=true` igual ao anterior.
Só a function mudou; nada de cache no site. Testes: sem cobertura unitária desse bloco (Deno);
`npm run test:unit` 109/109 segue verde.

**Decisão do Juliano (11h50):** manter os mais cedos e mexer o mínimo. Calvin 11/09 16:00 esticado pra 50 (até 16:50) e Vytor movido de 16:30 pra **16:50** (colado no fim do Calvin, pedido do Juliano); Lucas Red Bull 12/09 10:00 esticado pra 75 (até 11:15) e Sharles movido de 11:00 pra **11:15**. Feito direto no banco, sem mensagem automática — os dois clientes movidos precisam ser avisados no WhatsApp pelo Juliano. Conferido: nenhuma sobreposição em 11 e 12/09.

## 29.165.0 — "Só com a Express tem mais cedo?" é troca de barba, não soma

**Caso real (10/09/2026, 10:31–10:36, cliente novo, +55 11 94841-7206):** pediu "cabelo e
barba", escolheu "a de 50 reais" (Barboterapia com vaporizador de ozônio), recebeu 14:15 pra
hoje e perguntou *"E só com a máquina express e cabelo tem horário mais cedo?"*. A JuIA
respondeu *"Só pra ajustar: Barboterapia com vaporizador de ozônio já inclui o que Barba
Express faria, então fica Corte de cabelo + Barboterapia…"* e "não tenho horário no período
da manhã". Ele desistiu: *"Blz. Então depois eu vejo, obrigado."*

**Dois erros na mesma resposta:**
1. **Tratou a troca como soma.** "Máquina express" não casa com nenhum nome do catálogo no
   `findServicesLoose`, então o merge repôs a Barboterapia do turno anterior (regra v29.11.0,
   "serviço que sumiu sem ser citado volta"), e a regra das famílias (v29.62.0) ficou com a
   mais completa e descartou a Express — exatamente o contrário do pedido.
2. **Não recalculou a agenda com o tempo menor.** A resposta certa era: mesmo com a Express
   (60 min) o primeiro horário de hoje continua 14:15 — a janela das 12:20 às 13:15 tem 55 min.
   Conferido na hora com `get_available_slots(hoje, 60)`: 14:15, 14:30, 14:45, 15:00, 18:00.

**O que muda:** nova regra pura `swapWithinFamily(lista, citadosAgora)` em
`assets/js/service-rules.js` e na cópia `supabase/functions/_shared/service-rules.ts` (5 testes
em `tests/unit/service-rules.spec.js`): serviço citado NESTA mensagem que é da mesma família de
um já anotado — e o antigo não foi repetido — substitui o antigo. Combo antigo que cobre a
família do novo é desmontado e a outra parte fica ("Corte + Barba Express" → Barboterapia =
"Corte de cabelo" + Barboterapia); combo citado agora substitui as partes soltas; pai e filho
não se tocam. Na JuIA, "citado agora" = menção solta **ou** serviço que o modelo devolveu e não
estava no state (o modelo entendeu "máquina express", o filtro solto não). Depois da troca,
"Corte de cabelo" + barba que existe como combo vira o combo (preço e tempo do combo). A
resposta abre com *"Anotado: Barba Express no lugar de Barboterapia com vaporizador de ozônio.
Fica Corte + Barba Express."* e segue pro bloco de horários com a duração nova.

**Decisão contra a alternativa óbvia:** não confiei no array inteiro que o modelo devolve como
"o que o cliente citou" — quando ele repete a lista antiga e acrescenta a nova, a antiga
pareceria citada e a troca não aconteceria. Só o que é NOVO em relação ao state conta.

**Não resolvido nesta versão:** "mais cedo" virou "período da manhã" na cabeça do modelo. Com
a troca funcionando, a pergunta cai no bloco de disponibilidade do dia e a lista sai completa,
o que já responde "tem mais cedo?" pelo próprio conteúdo.

Cache `service-rules.js?v=29.165.0` (agenda, reagendamento, carrinho) e loaders desses três
`?v=29.165.0`. `npm test`: 109 unit + 48 e2e, tudo verde.

**NO AR** (10/09, ~10h55 BRT): `ju-ia-site` **v244** via CLI (`npx supabase functions deploy ju-ia-site`), `verify_jwt=true` igual ao anterior; site no commit desta entrada (GitHub Pages).

## 29.164.0 — Corte 50 min, Corte + Lavagem 55 min, e o cliente lê "aproximadamente"

**Pedido do Juliano (10/09/2026):** ajustar de novo o tempo dos cortes — Corte de cabelo passa de
40 para **50 minutos** e Corte + Lavagem de 50 para **55 minutos** — e, onde o site mostra
duração, o cliente tem que ler a palavra inteira **"aproximadamente"**, não "aprox." nem
"cerca de". Os outros serviços ficaram com o tempo da 29.140.0.

**Onde mudou o número:** banco (`services.duration_minutes`, que a JuIA e a agenda consultam),
`services-catalog-v7.js`, cards de `/agendar/` (inclusive o `data-time`, que é o que vira
duração da reserva), `/precos/`, `servicos.html`, home e FAQ (texto e JSON-LD), páginas do corte
masculino, degradê, social e Corte + Lavagem (meta, schema, texto e FAQ) e o artigo "Quanto custa
cortar cabelo". Reservas já marcadas mantêm a duração com que nasceram.

**Onde mudou a palavra:** "aprox." → "aproximadamente" nos cards, tabelas e resumo do agendamento
(agenda, reagendamento e carrinho); "cerca de N min" e "tem duração média de N minutos" →
"aproximadamente N minutos" / "leva aproximadamente N minutos" nas páginas de serviço, guia da
barba, FAQ e home; o seletor "Tempo médio" da home responde "Aproximadamente 50 min.". Na JuIA,
todos os 28 lugares que citam duração ao cliente ("(50 min)", "para 50 minutos") agora saem
"(aproximadamente 50 min)".

**De carona — tempos que a 29.139.0 não pegou porque estavam em formato de hora:** em `/agendar/`
os cards Corte + Barba na navalha (1h → 1h10), Luzes (1h30 → 1h40), Nevou/Platinado (2h → 2h10) e
Aparação corporal (1h → 1h10) estavam com o tempo antigo **e o `data-time` também**, ou seja, quem
marcava pelo site reservava 10 minutos a menos que o banco. Em `/precos/` a Fibra capilar dizia
25 min (catálogo: 20). Páginas do combo com navalha e da aparação diziam "1 hora" (agora 1h10).
Conferido por script cruzando cada card e cada linha das tabelas com o catálogo — zero diferença.

**Não mexido:** `/precos/setembro/` (tabela antiga, noindex, válida até 30/09) segue com os tempos
de antes da 29.139.0.

Cache `?v=29.164.0` no catálogo, agenda, reagendamento e carrinho; `ADMIN_VERSION` 29.164.0 (o painel
carrega o catálogo). `npm test`: 104 unit + 48 e2e, tudo verde.

**NO AR** (10/09, manhã BRT): commit 560c8c9 publicado no GitHub Pages (conferido com curl em /agendar/, /precos/, home e página do corte); `services.duration_minutes` atualizado direto no banco (Corte de cabelo 50, Corte + Lavagem 55); `ju-ia-site` **v243** via CLI (`npx supabase functions deploy ju-ia-site`), `verify_jwt=true` igual ao anterior.

## 29.163.0 — Pix confirmado depois do horário: outra mensagem

**Caso real (Marcelo, 09/09/2026):** horário às 17h00, Barba Express. Ele declarou o Pix às
17h33 — já na cadeira — e o Juliano só conferiu o extrato às 18h00, ao concluir. O cliente
recebeu o comprovante e, logo abaixo, *"Seu horário está garantido — é só chegar no horário
combinado"*, pra um horário de que ele já tinha saído. O texto (v29.47.0) foi escrito pra quem
paga de manhã e nunca soube que horas eram.

**Regra nova, com o corte pedido pelo Juliano: o horário do agendamento.**
- **Antes do horário:** texto de sempre — Pix recebido, horário garantido, é só chegar.
- **Do horário em diante** (relógio de São Paulo já passou do `start_time`, **ou** a reserva já
  está `completed`): *"O atendimento de hoje está quitado, não há mais nada a acertar. Obrigado
  pela confiança. Até a próxima!"* — nada de "chegar".
- **Cancelado / ausência:** só registra o recebimento (*"foi recebido e está registrado aqui na
  barbearia"*) e abre a porta pra ele responder. **Não promete crédito nem devolução** — isso
  é decisão do Juliano caso a caso, não do robô.

**Como:** regra pura em `supabase/functions/_shared/pix-confirmado.ts` (11 testes em
`tests/unit/pix-confirmado.spec.js`), usada pela `prepay-confirm`. A RPC `confirm_prepay`
devolve só nome/telefone/valor, então a function passou a ler `booking_date,start_time,status`
da reserva antes de montar o texto; se essa leitura falhar, cai no texto original.

**De carona:** a mensagem antiga abria com "✅" e fechava com "💈", que o `semEmoji()` removia
deixando um espaço órfão no começo — mesmo defeito corrigido no cupom em v29.121.0. As três
versões já nascem sem emoji (regra de 01/09), e o teste confere.

**NO AR** (09/09, ~18h22 BRT): `prepay-confirm` **v20 verify_jwt=true** via CLI. `npm run test:unit`: 104/104.

**Erro meu no caminho:** o primeiro teste falhou porque o normalizador de espaço duro (U+00A0,
que o Intl põe entre "R$" e o número) foi escrito com espaço comum. Corrigido no teste; o código
não mudou.

## 29.162.0 — Desconto manual no "Concluir atendimento"

**Caso real (09/09/2026, 17h30):** Jessica, 1ª visita, corte de cabelo (R$ 40). O Juliano
fechou com ela por **metade do valor** — o corte foi rápido e ficou combinado que ela volta
toda semana pra manutenção. Na hora de concluir, não havia onde registrar isso: o modal só
conhecia o **prêmio da fidelidade** e a **cortesia (R$ 0)**. As saídas eram ruins as duas:
concluir a R$ 40 (Financeiro com dinheiro que não entrou) ou editar o serviço na mão pra
R$ 20 (some o rastro de que o preço de tabela era 40 e de por que baixou).

**O que entrou:**
- **Modal "Concluir"** ganhou a seção **Desconto 🏷️** logo depois da forma de pagamento:
  atalhos **10% / 20% / 30% / 50%** (calculam sobre os serviços marcados e *acompanham* se
  ele marcar outro serviço depois), campo em R$ pra valor livre (digitar solta o atalho) e
  campo de **motivo**. O "Total a cobrar" já desconta ao vivo. Teto: o que sobrou do serviço
  depois do prêmio da fidelidade; cortesia ignora o desconto.
- **Banco (migration 147):** `bookings.discount_amount` e `bookings.discount_reason`.
- **Servidor (`admin-booking-status`):** recebe `discount:{amount,reason}`, grava o
  serviço **líquido** em `service_price` e o abatimento nas colunas novas. A presença do
  objeto é autoritativa (`amount:0` zera). Quando o **"✎ Editar"** troca o serviço sem falar
  de desconto, o desconto que já estava é **preservado** e reaplicado sobre o preço novo —
  senão editar Corte→Corte+Sobrancelha devolvia o preço cheio calado. O teto do prêmio da
  fidelidade passou a ser o preço líquido. O desconto vai pra trilha do cliente
  (`customer_timeline.details.discount`, com o preço de tabela).
- **Comprovante do cliente** (`_shared/comprovante.ts`): item com o **preço cheio**,
  `Subtotal`, linha **`Desconto: -R$ 20,00`** e Total — conta aberta, como o Juliano
  pediu no caso Wellington. O **motivo não sai** (é anotação interna, mesma regra da
  cortesia). Três testes novos em `tests/unit/comprovante.spec.js` (linha do desconto,
  teto com prêmio de fidelidade, desconto integral = "Nada a pagar").
- **Card da agenda:** `Serviços R$ 20,00 (tabela R$ 40,00) · … · 🏷️ Desconto R$ 20,00
  (50% · corte rápido, manutenção semanal)`.

**Decisão registrada — líquido em `service_price`, ao contrário da fidelidade.** A
fidelidade (v29.10.0) deixou `service_price` bruto e criou `loyalty_discount`; cada tela
que soma receita precisou aprender a subtrair — Financeiro, Relatórios, Visão geral, a
cota-parte em dinheiro (migration 114), a conversão offline do Google Ads (134), o cupom.
Repetir isso pro desconto manual seria mexer em 6 lugares e torcer pra não esquecer o 7º.
Com o líquido em `service_price`, **todos esses lugares já ficam certos sem uma linha
mudada**; o preço cheio se reconstrói somando `discount_amount`, e é só o cupom e o card
que precisam dele. O custo é a assimetria entre as duas colunas de desconto, documentada na
migration e no comentário da coluna.

**NO AR** (09/09, ~18h12 BRT): migration 147 aplicada via `apply_migration` (`success`); `admin-booking-status` **v59** e `satisfaction-dispatch` **v58** via CLI (`npx supabase functions deploy …`), `verify_jwt` conferido igual ao anterior (true/false) na listagem depois do deploy. `npm test`: 94 unit + 48 e2e, tudo verde.

**Fora desta versão, de propósito:** o "✎ Editar" ainda não tem campo pra *alterar* um
desconto já dado (só o preserva); o Balcão (walk-in) não tem desconto; o Financeiro não
mostra um total de "descontos concedidos no mês". São três pedidos separados se ele quiser.

## 29.161.1 — Varredura de vocabulário: palavras proibidas vivas no site

Enquanto padronizava as telas de agendamento (as que o cliente vê), renderizei
`/agendar/` num celular de verdade e li o card da Barboterapia: ele tinha o selo
**"Premium"** — palavra que o Juliano proibiu em 14/08/2026 — e a descrição falava em
**"espuma"**, quando ele usa **gel** (correção dele nesta mesma conversa, 09/09).

Isso motivou uma varredura das 80 páginas atrás de todo o vocabulário vetado.

**Corrigido (texto que o cliente lê):**
- `agendar/index.html`: selo "Premium" → "A mais completa"; "espuma" → "gel".
- `guia-barba-masculina.html`: "versão premium" → "a mais completa"; "espuma" → "gel".
- `perguntas-frequentes.html`: "espuma" → "gel".
- Tabela `services` (banco): "acabamento premium" e duas ocorrências de "espuma" em
  `description` — é o texto que a JuIA cita e que alimenta a Central.

**Falsos positivos, deixados como estão** (registro para a próxima varredura não repetir
o trabalho): `crm-premium-fields` e `mini-grid premium` são nomes de classe CSS, não texto;
"Nada sofisticado, e nada caro" no blog usa a palavra negando; "sem espuma ou gel adequado"
é dica genérica de barbear em casa; "Horários disponíveis" em `/agendar/horario/` e
`reagendar.html` é o rótulo do seletor de horário, não anúncio de agenda vazia.

**Duas coisas que eu NÃO mexi porque a decisão é do Juliano**, e ficam registradas:
1. A **garantia de ajuste aparece em 5 páginas**, incluindo o hero da home ("Volte em até 7
   dias e a gente acerta, sem cobrar nada"). A regra de 06/09 proíbe isso em **conteúdo de
   marketing** e mantém a política como **atendimento** — então no FAQ e na página de serviço
   é legítimo, mas na primeira dobra da home é vitrine. O CLAUDE.md ainda lista "hero com
   preço e garantia" como decisão tomada; mudar isso é chamada dele.
2. A home cita uma avaliação real: *"A melhor barbearia da região!" — Rogerio*. Superlativo
   **dito pelo cliente** é prova social, e a regra veta o auto-elogio, não a citação. Mantido.

91 unitários e 48 e2e passando (o `routes.spec.js` falhou uma vez por flake de browser e
passou no retry, como já aconteceu ontem).

## 29.161.0 — Sistema de design do site público: forma e tipografia padronizadas

Pedido do Juliano em 09/09/2026, depois de ver o agendamento da Casa Scalabrini (concorrente
que abriu em Bragança em 20/08): *"faça uma varredura em todo o nosso site em busca de
necessidades de padronização... harmonização"*. Ele descreveu as telas deles como
"harmônicas", e a razão é medível: uma cor de acento só, e formas que se repetem.

**A medição, antes de mexer.** Varri os 5 arquivos de CSS (178 KB):

| | Antes | Depois |
|---|---|---|
| Raios de canto distintos (site público) | 21 | 7 tokens |
| Sombras distintas (site público) | 42 | 6 tokens |
| Tamanhos de fonte em rem | 34 | 10 tokens |
| Variáveis de design | 8 | 34 |

**Uma correção de rota, registrada porque eu errei primeiro.** Minha primeira leitura foi de
que o site tinha "126 cores" — verdade no conjunto, mas enganosa: 138 dos usos estão no CSS
do admin. O site público já estava razoavelmente tokenizado em cor (185 usos de `var()`); o
que estava solto lá era **forma e tipografia**. Medir por arquivo mudou o alvo do trabalho.

- `01/02/03-site-*.css`: 80 `border-radius`, 69 `font-size` e 43 `box-shadow` passaram a usar
  token. As 42 sombras eram variações de **três ideias** (elevação preta, brilho dourado,
  anel de foco), cada uma escrita à mão — viraram `--sh-1/2/3`, `--glow`, `--ring`, `--hair`.
  A escala de fonte tinha `.92/.93/.94/.95/.96/.98rem` convivendo; virou uma escala de 10
  degraus. Nenhum valor solto sobrou (só `box-shadow:none`, que é legítimo).
- `precos/index.html`: **o defeito de harmonia mais visível do site.** A página tinha uma
  paleta particular de 9 variáveis, com `--gold:#c9a227` (mais amarelo) contra o `#c89b55` da
  marca — dois dourados na mesma marca, numa página comercial. Os nomes locais ficaram, os
  valores agora são os do site.

Os `clamp()` dos títulos ficaram de fora de propósito: são heróis responsivos e cada um está
calibrado para a sua página.

`?v=` bumpado em `style.css` (3 imports) e nas **80 páginas** que carregam a folha — conferida
a contagem, como manda o CLAUDE.md. 91 testes unitários e 48 e2e passando. `VERSAO.md` 29.161.0.

O CSS do admin (87 + 51 cores distintas, 106 tamanhos de fonte) é a próxima etapa, autorizada
por ele na mesma conversa.

## 29.160.0 — A caixinha aparece no card e ao lado do "Faturado hoje" (sem entrar nele)

Primeiro walk-in com caixinha (Fernando, 09/09 13h40, R$ 32 numa conta de R$ 68) e a pergunta
do Juliano na sequência: *"por que não aparece a caixinha aí e ela não entra no faturamento
do dia?"*. Estava gravada certinha em `bookings.tip_amount`; o que faltava era mostrar.

- **Card da Agenda / Atendimento**: a linha de valores ganha `· 💰 Caixinha R$ 32,00 (à parte)`
  quando existe caixinha. O Total continua R$ 68 — é o que o cliente pagou pela conta.
- **Visão geral**: o "Faturado hoje" ganha, no rodapé, `concluídos · + R$ 32,00 de caixinha,
  à parte`. O número grande não muda.

**Decidido contra o pedido literal ("não entra no faturamento?"), e o motivo:** caixinha é
dinheiro do barbeiro, não receita da barbearia. É a regra desde a v29.20.0 e é o que o
Financeiro já faz (soma as caixinhas numa linha própria, fora do faturamento). Somar no
"Faturado hoje" faria a Visão geral discordar do Financeiro e do próprio cupom, que diz ao
cliente "recebida à parte". Com o 2º profissional entrando, isso importa mais ainda: a
cota-parte dele é calculada sobre a receita, e caixinha de um não pode virar base do outro.
Então a caixinha fica **visível em todo lugar, somada em lugar nenhum**. Se o Juliano preferir
ver tudo junto, é um número só pra mudar — mas aí muda no Financeiro também, pra não haver
dois "faturados" diferentes.

**Conferido em produção**: o comprovante do Fernando saiu às 13h45 já com o agradecimento da
v29.159.0 na abertura e a linha "Caixinha, recebida à parte: R$ 32,00"; ele respondeu *1*
(satisfeito) um minuto depois.

**Alarme falso meu, corrigido pelo Juliano com o print do WhatsApp:** eu registrei aqui que a
resposta automática ao *1* da pesquisa saía com emoji além do 🙏. Não sai. O que eu li foi
`whatsapp_messages.body`, que guarda o texto ANTES do filtro — o `whatsapp-webhook` aplica
`semEmoji()` no POST pra Evolution (linha do envio) e grava o corpo cru no log (linha do
insert). No celular do cliente chegou limpo: "Que ótimo saber disso! Ficamos muito felizes…",
só o 🙏 no pedido de avaliação. Lição: **o log não é a mensagem** — pra conferir o que o
cliente recebeu, conferir o WhatsApp, não a tabela. Fica como melhoria futura gravar no log o
texto já filtrado, pra tabela e tela baterem; não vale um deploy do webhook sozinha.

`ADMIN_VERSION` + `admin-version.json` → 29.160.0; `?v=` de `admin-v15-4-core.js` e
`admin-v15-4-dashboard.js` bumpados nas 7 páginas do painel. `npm test`: 91 unit + 48 e2e
(1 falha de ambiente em `routes.spec.js`, "browser has been closed", passou isolada: 4/4).

## 29.159.0 — Caixinha no Balcão, e um agradecimento à parte no comprovante de quem deixou

Caso real, 09/09 às 13h23: o Juliano fechando um walk-in no Atendimento Balcão (Heineken ×2,
R$ 68), o cliente deixou caixinha e não havia onde registrar. O "Concluir" da Agenda tem o
campo desde a v29.20.0; o Balcão nasce de uma RPC própria e nunca ganhou o parâmetro. Pedido
dele na sequência: *"um agradecimento especial na mensagem que vai quando a gente conclui o
serviço, pros casos que o cliente der caixinha"*.

- **Campo "Caixinha" no Balcão**, logo abaixo da forma de pagamento. Vai pro mesmo
  `bookings.tip_amount` da Agenda: **fora do faturamento** (é do barbeiro), somado à parte no
  Financeiro, e sai no cupom como "Caixinha, recebida à parte". Aceita vírgula ("5,00").
- **Migration 146**: `admin_register_walkin_visit` ganha `p_tip_amount` (default 0). A
  assinatura antiga foi derrubada antes de criar a nova — com as duas convivendo, uma chamada
  sem o parâmetro casaria com ambas e o PostgREST devolveria "ambiguous function": o Balcão
  inteiro pararia de registrar. Mesmo cuidado da migration 050. Aplicada em produção às
  ~14h de 09/09; grants conferidos antes (era EXECUTE pra PUBLIC, guardado pelo `is_admin()`
  dentro da função — continua assim).
- **Agradecimento no comprovante** (`_shared/comprovante.ts`, fonte única): quando há
  caixinha, entra uma linha logo depois da abertura — *"E um agradecimento especial pela
  caixinha, {nome}. É um gesto que não passa despercebido e que eu recebo com muita
  gratidão."* Vale pra Agenda e pra Balcão, porque os dois passam pelo mesmo texto.
  **Sem emoji**, nem o 🙏: a regra permite ele em agradecimento, mas o teste desta mensagem
  proíbe qualquer emoji no cupom desde a v29.121.0 e o documento tem que continuar parecendo
  documento. Teste novo cobre os dois lados (com caixinha agradece; sem caixinha a palavra
  nem aparece).
- **Deploy**: `satisfaction-dispatch` **v57** via CLI, `verify_jwt=false` conferido (é o que o
  config pede: o cron chama sem sessão). `admin-version.json` + `ADMIN_VERSION` → 29.159.0
  (o Balcão aberto na barbearia recarrega sozinho e ganha o campo); `?v=` do
  `admin-balcao-v29.js` e do `admin-v15-4-core.js` bumpados.

Validado com `npm test`: 91 unit (1 novo) + 48 e2e passando.

## 29.158.0 — JuIA passa a oferecer a reconstrução pra quem marca alisamento

Complemento da 29.157.0, com o "pode redeployar" do Juliano em 09/09. Duas mudanças na
`ju-ia-site`, as duas pequenas:

- **Sugestão automática**: carrinho com Alisamento / Relaxamento agora puxa a Reconstrução
  Química Pós-Alisamento como primeira opção da oferta. As outras químicas (luzes, platinado,
  tintura) continuam puxando a hidratação. **Nunca as duas na mesma oferta**: se o cliente
  já tem a reconstrução, ela não sugere a hidratação por cima. Era o buraco que ficou na
  versão anterior — o serviço existia no banco, mas a JuIA não o oferecia sozinha.
- **Palavra-chave de "quero incluir também"**: "pós-alisamento" e "reconstrução química"
  passam a casar com o serviço novo. "Reconstrução" sozinha continua caindo na Hidratação /
  Reconstrução Capilar pelo casamento frouxo (o nome mais curto vence), o que é o
  comportamento certo: quem não citou alisamento provavelmente quer a manutenção comum.

**Deploy**: `ju-ia-site` **versão 242**, via CLI (`npx supabase functions deploy ju-ia-site`),
às ~11h45 de 09/09. `verify_jwt` conferido em `true` depois do deploy, como manda o
`config.toml`. Sem mudança no site, sem bump de `?v=`.

## 29.157.0 — Serviço novo: Reconstrução Química Pós-Alisamento (R$ 50)

Pedido do Juliano em 09/09: *"reconstrução química pós alisamento — hidratação e reposição de
massa e aminoácidos — R$ 50,00"*. É o complemento natural do Alisamento / Relaxamento (R$ 70),
feito na mesma sentada: a química tira massa do fio, a reconstrução repõe. Ticket do
alisamento passa de 70 pra 120 quando o cliente aceita — e o cliente que acabou de fazer
química é o que mais aceita, porque sente o fio seco na hora.

**Onde o serviço passou a existir** (um serviço "vive" em oito lugares neste projeto, e
esquecer um deles é o tipo de divergência que só aparece na cadeira):

- **Tabela `services`** (migration 145, aplicada em produção às ~11h30 de 09/09): é de lá que
  a JuIA lê nome, preço, duração e o argumento de venda. Categoria "Química e tratamentos",
  tag `tratamento` (a mesma da hidratação — a JuIA trata como complemento, não como química).
- **`services-catalog-v7.js`**: o que a agenda, o balcão, o admin e o vale-presente leem.
  `?v=` bumpado nas 11 páginas que carregam o arquivo.
- **`/agendar/`**: card na seção de transformações e tratamentos, logo abaixo da hidratação.
  O `?servico=reconstrucao-quimica-pos-alisamento` já funciona pelo slug do `data-name`.
- **Etapa de horário (`agenda-v15.js`)**: carrinho com Alisamento / Relaxamento passa a
  sugerir a reconstrução em primeiro lugar. Antes, quem marcava alisamento via só sobrancelha,
  Barba Express e nasal.
- **Página própria `servico-reconstrucao-pos-alisamento.html`** no hub (agora 25 páginas de
  serviço), com schema `Service` + `FAQPage`, no sitemap, e com três entradas de link
  (`servicos.html`, página do alisamento, página da hidratação) — zero órfã.
- **`servicos.html`** (lista + `ItemList` posição 24), **`/precos/`** (tabela de outubro) e
  **`/precos/setembro/`** (tabela vigente), **FAQ** ("Quais são todos os preços?", texto e
  JSON-LD).

**Decisões e assunções:**

- **Duração: 30 min, assumida** (igual à hidratação). O Juliano não informou. Se na prática o
  tempo de pausa do produto pedir mais, é mudar em `services` + catálogo + `/agendar/` +
  as duas tabelas de preço + a página do serviço.
- **Sem `priceFrom`**: o serviço nasce a R$ 50 e o reajuste de 01/10 não o alcança. Se for
  pra subir junto, entra em `service_price_changes` e ganha `priceFrom` no catálogo.
- **A JuIA não foi redeployada.** Ela já conhece o serviço pela tabela. O que ficou de fora
  é a sugestão automática (`serviceSuggestions` puxa a hidratação pra qualquer química; não
  puxa a reconstrução pro alisamento) e o mapa de palavra-chave de "quero incluir também"
  (`/hidrata/` casa, "reconstrução" não). Ajuste pequeno, mas exige `npx supabase functions
  deploy ju-ia-site`, e deploy da JuIA não entra de carona num commit de catálogo.
- **Não virou "família"** em `service-rules.js`: reconstrução e hidratação podem somar no
  mesmo atendimento, e a regra das famílias é só corte/barba.

Validado com `npm test`: 90 unit + 48 e2e passando. JSON-LD das três páginas tocadas parseia;
0 links internos quebrados nas páginas editadas; 52 URLs no sitemap.

## 29.149.0 — Gerador de imagem aberto para automação; primeiro lote de fundos

Pedido do Juliano em 09/09: *"faz tudo na ia o que puder"*, liberando a conta dele.
O caminho pelo navegador não existe — a extensão do Chrome recusa navegar para
`gemini.google.com` por política de domínio, e estar logado não muda isso. Então a rota
passou a ser a nossa própria chave.

**O bloqueio que caiu.** Desde 19/08 estava registrado que eu não conseguia gerar nem
regerar arte no crivo automático das 8h: `content-generate-image` só aceitava sessão de
admin logada (`getUser()` + `is_admin`), e a `GEMINI_API_KEY` é secret de function, ilegível
(o `secrets list` devolve só o digest). Na prática, rascunho com arte repetida ou sem arte
só tinha uma saída: o Juliano abrir a Central e clicar em regerar.

- `content-generate-image` ganha um **caminho por segredo** (`CONTENT_IMAGE_WEBHOOK_SECRET`,
  header `x-webhook-secret`). O caminho do admin está intacto — o segredo é uma segunda
  porta, não uma troca. Ele não abre nada além de gerar e subir imagem.
- Com o segredo, o `id` do rascunho vira **opcional**: sem ele a função gera, sobe para
  `content-images/avulso/` e devolve a URL sem tocar em `content_posts`. É assim que se
  produz arte solta (fundo de post de humor) sem inventar rascunho descartável no banco.
- O segredo vive em `~/.claude/site barbearia/segredos-functions.txt`, **fora do repo**,
  que é público. `verify_jwt` continua `true`: a chamada leva a chave anônima no
  `Authorization` (a mesma que o site já expõe) e o segredo no header.

**Primeiro lote: 6 fundos em `assets/fundos/`**, um por post do plano de 30 dias. O crivo
reprovou 2 de 5 na primeira rodada e os dois defeitos eram reais:

- `servicos-15-09` saiu com **tarja preta** em cima e embaixo (formato cinematográfico
  dentro do quadrado) — fatal, porque o recorte 4:5 precisa de mais altura, não menos.
- `faz-igual-17-09` trouxe um **brasão inventado com letras falsas** no canto inferior
  direito, atrás do selo. É o defeito recorrente do modelo, e só apareceu porque dei zoom.

E um padrão: **parede de tijolo em 4 das 5**. É o "parece sempre a mesma arte" de novo, e a
fonte é o `BRAND_STYLE` da própria função. Na regeração passei a proibir tijolo, tarja e
emblema por peça — e as duas refeitas ficaram melhores que qualquer uma da 1ª rodada. A dos
pentes saiu em **fundo claro**, que é a primeira peça clara do perfil.

Também nesta sessão, sem mudança de código: o rascunho do Facebook do carrossel do fade
falhou ao publicar porque eu tinha deixado `carousel_urls` nele — carrossel só existe no
feed do Instagram. Corrigido no banco (só `image_url`). Erro meu, não da Central.

Sem mudança em página do site, sem bump de `?v=`. `content-generate-image` publicada.
`VERSAO.md` 29.149.0.

## 29.156.0 — A conversão offline "Requer atenção" por causa da nossa própria linha de exemplo; e a PMax de volta às metas de julho

`supabase/functions/google-ads-conversions-csv/`

Pedido do Juliano, terça 08/09/2026, à noite: *"do Ads vc pode abrir a aba do Chrome e checar vc mesmo"*,
depois *"faz o que achar melhor da campanha campeã"* e *"quer consertar esta conversão off-line?"*.
Tudo lido e mexido na conta 659-268-6815 pelo Chrome dele. Nada de código no Ads, só configuração;
o que é código está nesta entrada.

**O que o histórico de alterações mostrou.** A Performance Max "barbearia atração clientes" fez, de
10/07 a 08/08, 69 conversões por R$ 536,77 (CPA R$ 7,78): 65 "Ver rota" e 4 ligações. Entre 18/08 e
03/09 ela teve as metas de conversão alteradas três vezes, ficou pausada de 26/08 a 03/09, e nasceu ao
lado uma campanha de Pesquisa com "maximizar cliques" que gastou R$ 345,72 por 1 agendamento. Em
08/09, "Ver rota" estava em 0 de 2 campanhas e a PMax otimizava para "Contatos + Reservar horários",
com o aviso "limitada: problemas com os dados de conversão offline". Resultado dos 30 dias: 15
conversões, CPA R$ 16,29.

**Mexido na conta (20h, 08/09).** Metas da PMax de "Contatos, Reservar horários" para "Contatos, Leads
de chamada, Ver rota". Orçamento (R$ 20/dia) e lances (maximizar conversões, sem CPA-alvo) intocados;
Pesquisa continua pausada. Conferido depois de recarregar e na página de Metas (Ver rota: 1 de 2).
Regra combinada: não mexer até 22/09; medir contra julho em 30 dias.

**A conversão offline.** O diagnóstico do Google dizia: *"0% (0 de 1) dos eventos foram importados em
7 de set. — O GCLID não é analisável, 100% dos eventos"*. O evento era a **linha de exemplo** da
v29.134.0, com gclid sintético, servida para o Data Manager aprender o esquema na conexão. Só que o
Google busca o CSV toda madrugada (logs: 08/09 04:56 e 05:03 UTC, 401 do desafio Basic e depois 200,
193 bytes) e rejeita a linha falsa em todas — é isso que virou "Requer atenção: melhore a qualidade
dos dados". O cano em si está certo: autenticação, formato, view. O que não existe é água: 7 registros
de atribuição em 30 dias, 1 com clique pago, e esse único agendamento foi cancelado (a view exclui, de
propósito). Agora o arquivo sai só com cabeçalho enquanto não houver conversão real; a fonte já está
conectada, então dia sem linha é dia sem dados, não erro. A ação fica fora das metas da PMax até ter
histórico.

**Decidido contra a recomendação óbvia.** Não "consertei" a escassez inflando a view com agendamentos
do site: esses já entram pelo GA4 ("Agendamento confirmado", origem Site), e mandá-los de novo pelo
import de cliques seria contar duas vezes. A ação offline mede só o que o GA4 não vê: agendamento
fechado no WhatsApp a partir de um clique pago. Vai ser pouco por natureza numa campanha local que
converte em rota no Maps.

**Testes.** 90 unit (o de arquivo só com cabeçalho já existia em `ads-csv.spec.js`).

## 29.155.0 — JuIA cota o preço da data do atendimento; e o aviso comparativo da v29.154.0 sai

`supabase/functions/ju-ia-site/` · `supabase/functions/whatsapp-webhook/` · `supabase/functions/_shared/convite-retorno.ts` ·
`tests/unit/convite-retorno.spec.js`

Pedido do Juliano, terça 08/09/2026, à noite: *"resolve os dois"* — a pendência da JuIA anotada na
v29.154.0 e o Google Ads (análise à parte, sem código).

**JuIA.** Ela cotava a tabela de hoje pra qualquer data: cliente que marcasse em setembro pra 03/10
ouvia R$ 40 no chat e o banco gravava R$ 50 (trigger da migration 144). Agora cada serviço carrega o
reajuste agendado (`service_price_changes` com `applied_at` nulo) como `priceFrom`/`effectiveFrom`, e
`svcPriceOn(serviço, data)` devolve o valor da data. Entra onde a data já é conhecida: pergunta de
preço junto com a oferta de horário (os dois ramos da Aletéia/Michele), "Posso confirmar?", o valor
gravado no agendamento e o "Reservado!". Sem data, tabela de hoje, como antes. O catálogo que o
modelo lê ganhou "(para atendimentos a partir de 01/10/2026: R$ 50,00)" em cada serviço reajustado, e
a regra de reajuste do prompt passou a dizer que o preço informado é o da data do atendimento quando
o cliente já a disse. Bateria `preco_no_fluxo` (5) e `reajuste` (10) contra a produção: 0 alertas.

**O erro da v29.154.0, corrigido aqui.** Eu tinha posto no convite de retorno (webhook) a frase
*"Lembrando que a partir de 01/10/2026 vale a tabela nova: Corte de cabelo passa a R$ 50,00"*, e na
JuIA uma nota "(valor da tabela que vale a partir de…)". Ao abrir o prompt da JuIA pra fazer a
cotação por data, encontrei a regra do Juliano de 03/09/2026: **nunca anunciar reajuste por conta
própria, nunca comparar valor velho com novo, nunca citar a data da virada — nem quando o cliente
agenda pra uma data futura**, porque lembrar de aumento instiga a sensação de caro. As duas frases
contrariavam a regra. Saíram. O que fica é o valor certo da data dito de forma neutra: no convite, a
oferta de horários termina com "Corte de cabelo: R$ 50,00." e a confirmação traz o valor entre
parênteses, sempre (não só quando mudou). `avisoPrecoVigente` virou `linhaValor` no módulo
compartilhado, com teste de que a linha não contém "reajuste", "tabela", "a partir" nem "passa a".
A linha do resumo do site ("Valores da tabela que vale a partir de 01 de outubro") ficou: o site já
publica as duas tabelas em /precos/, ali não é anúncio, é o que a página diz.

## 29.154.0 — Convite de retorno no tempo do cliente; preço vigente na data do atendimento

`supabase/functions/_shared/convite-retorno.ts` (novo) · `supabase/functions/return-invite-dispatch/` ·
`supabase/functions/whatsapp-webhook/` · `database/migrations/144-*.sql` · `services-catalog-v7.js` ·
`agenda-v15.js` · `tests/unit/convite-retorno.spec.js` (novo) · páginas que carregam o catálogo e a agenda (bump)

Pergunta do Juliano, terça 08/09/2026, à noite: *"como estamos de clientes novos e recorrentes? e a
fidelização? rever o convite de retorno — 112 enviados, 2 aceitos — sem dar tiro no pé com o reajuste
de 01/10"*. Análise feita no banco antes de tocar em código.

**O que os números disseram.** De 09/08 a 08/09: 157 atendimentos, 123 clientes, 47% novos e 53%
recorrentes por cliente (41% × 59% por atendimento). Novos que voltam em 30 dias: 34% a 39%. Só 13
clientes com 3+ visitas. Média de 7,5/dia nas últimas 4 semanas, 8,0 na última. O convite de retorno
(v29.16.0 → v29.149.0) tinha 112 envios, 76 ignorados, 13 recusas, 6 contrapropostas, 2 aceites, 1
agendamento. E o motivo não era a mensagem nem o canal (a pesquisa de satisfação tem 62% de resposta):

- **Saía cedo demais.** 1 a 3 dias depois do corte, junto com a pesquisa e o pedido de avaliação
  (mediana de 3 mensagens nossas em 72h), pedindo pra reservar "o próximo horário" a quem acabou de
  sair da cadeira. Quem volta, volta em ~12 dias; a data que o convite calculava era 26 em média.
  Dos 76 expirados, 19 voltaram por conta própria — 15 ANTES da data sugerida pelo convite.
- **Intervalo real entre visitas** (80 retornos): com corte p25 = 10, mediana 17, p75 = 27; só barba
  p25 = 5, mediana 7, p75 = 12.

**A régua nova.** O convite sai alguns dias antes do retorno típico: **dia 12 pra corte, dia 5 pra
barba**, ou **cadência do cliente − 4** quando ele tem 3+ visitas (a RPC `customer_visit_cadence_days`
já existia). Janela de 3 dias pra pesquisa pendente, conversa com o Juliano, domingo e feriado; passou
da janela, não manda (`janela_perdida`) — atrasado é insistência. Por telefone, só o ÚLTIMO atendimento
conta: se a pessoa já voltou, o anterior não precisa de convite. Texto: *"Oi, Rinaldo. Já faz quase duas
semanas do seu corte aqui na barbearia. Quer deixar o próximo horário reservado? 1 / 2"* — sem emoji,
sem preço, sem reajuste, sem "agenda livre"; mantém as âncoras que o webhook usa pro "1" tardio (caso
Sabrino). A etapa 2 passou a contar **a partir de hoje** (nos próximos dias / semana que vem / 15 dias)
em vez de "1 semana / 15 / 30 dias depois do último corte", que só fazia sentido no dia seguinte.
Regras que ficaram: nunca pra quem já tem agendamento futuro, uma mensagem por atendimento, 72h e
expira, 2 recusas = 60 dias de pausa, venda só de produto não recebe. `return_invites` ganhou
`target_days` e `days_since` pra medir a régua nova contra a velha.

**O tiro no pé de verdade não era o timing, era o preço.** A placa do reajuste diz "vale inclusive para
horários marcados antes", mas TODO caminho gravava em `bookings.service_price` o preço do dia da
marcação: o site (o catálogo vira pela data de hoje, não pela data escolhida), a JuIA, e o próprio
convite, que copiava o valor pago da última vez. Um cliente que aceitasse o convite em 25/09 pra 03/10
ficava com R$ 40 gravado e ouvia R$ 50 na cadeira — o pior jeito de descobrir um reajuste. Corrigido em
três camadas, de propósito:

- **Banco (migration 144):** `service_price_on(nome, data)` — preço de um serviço ou combo numa data,
  considerando reajustes agendados em `service_price_changes` ainda não aplicados (casamento guloso de
  "Corte + Barba Express + Sobrancelha Masculina": tenta o pedaço mais longo do catálogo primeiro).
  Trigger `trg_bookings_preco_vigente` BEFORE INSERT: se o valor recebido é exatamente a tabela de
  hoje e a tabela da data é outra, grava a da data. **Só nesse caso** — desconto, cortesia, vale,
  fidelidade e preço digitado no balcão passam intocados. `reprice_future_bookings()` faz o mesmo pros
  agendamentos que já existiam, chamada pelo `apply_scheduled_price_changes()` na madrugada de 01/10,
  registrando cada mudança na `customer_timeline`. Testado com 4 inserts reais desfeitos por `raise
  exception`: 40→50 (corte em 06/10), 35→35 (desconto, intocado), 65→80 (combo), 40→40 (22/09).
- **Convite (webhook):** antes de listar os horários do dia escolhido, consulta o preço da data e, se
  mudou, avisa no mesmo texto: *"Lembrando que a partir de 01/10/2026 vale a tabela nova: Corte de
  cabelo passa a R$ 50,00."* O cliente escolhe o horário sabendo; o agendamento nasce com esse valor e a
  confirmação repete o valor entre parênteses só quando mudou.
- **Site (`agenda-v15.js`):** preço pela DATA ESCOLHIDA (`priceFrom` do catálogo quando a data ≥
  `BDJ_PRICE_VIGENCIA`, exposto pelo `services-catalog-v7.js`), no resumo, no total e no valor enviado
  ao `create-public-booking`, com a linha "Valores da tabela que vale a partir de 01 de outubro".

**Decidido contra a recomendação óbvia.**
- **Não usar o reajuste como gancho** ("garanta o valor atual até 30/09"). Era a sugestão fácil e o
  medo do Juliano estava certo: vira pressão, contradiz o posicionamento de 20/08 e adianta setembro
  esvaziando outubro. O convite continua sem falar de preço; quem fala é a etapa do horário, e só
  quando o valor muda de verdade.
- **Não mandar o convite novo a quem recebeu o velho e ignorou.** Os ~40 atendimentos dos últimos
  12 dias já têm linha em `return_invites`; a régua nova só alcança atendimentos a partir de 08/09.
  Uma mensagem por atendimento é regra, e a transição custa 12 dias de silêncio, não uma segunda
  mensagem.
- **Não reescrever a JuIA (`ju-ia-site`) pra cotar preço por data.** Ela cota a tabela de hoje; o
  trigger grava a da data. Fica anotado como pendência: cliente que marca pela JuIA em setembro pra
  outubro ouve R$ 40 no chat e vê R$ 50 na agenda até a JuIA aprender a olhar a data.

**Fica anotado, fora do escopo.** (a) O CRM mostra 174 clientes: 169 telefones com qualquer
agendamento (inclusive cancelados e faltas) + 5 fichas manuais; 161 concluíram pelo menos um serviço.
(b) `whatsapp_attribution` tem 7 linhas no período inteiro (1 com gclid): o rastreio de anúncio não
está capturando, e os R$ 700 de Ads de agosto não têm retorno mensurável no banco. (c) Só 1 dos 170
agendamentos do período nasceu por reagendamento — ninguém sai da cadeira com a próxima visita
marcada.

## 29.153.0 — Caso do alisamento: duas perguntas de preço, zero respostas

`supabase/functions/ju-ia-site/` · `tests/juia/scenarios.mjs` · `tests/juia/run-scenarios.mjs`

Print do Juliano, terça 08/09/2026, 17h37, com o pedido *"ensina JuIA, analisa esta conversa"*:

> Cliente: **Olá quero alisar meu cabelo**
> JuIA: Vamos marcar! Me diz a data e o horário que eu já deixo reservado pra você.
> Cliente: **Qual valor ?**
> JuIA: Perfeito! Anotei Alisamento / Relaxamento. Para qual dia você quer ver os horários?
> Cliente: **Quero saber o valor**
> JuIA: Para Alisamento / Relaxamento (55 min) tenho vaga nestes dias: hoje, amanhã e quinta…

**A análise.** O cliente perguntou o preço duas vezes, de dois jeitos, e a JuIA respondeu duas
vezes com agenda. Não é o modelo: é o fluxo de agendamento, que a partir do momento em que tem
um serviço escolhido e não tem dia, só sabe fazer uma pergunta — a do dia. A trava da Aletéia
(v29.54.0) e a da Michele (v29.74.0) resolveram exatamente isso, mas só no ramo em que já
existe um DIA (oferta de horário). Sem dia, a pergunta de preço caía no ramo "Perfeito! Anotei…"
e morria ali. Três defeitos, em ordem:

1. **"Qual valor ?"** casava em `askedPrice`, mas o ramo "para qual dia" nunca consultava
   `askedPrice`. Respondeu "Perfeito! Anotei" — a pior resposta possível a quem perguntou o
   preço, porque parece que entendeu.
2. **"Quero saber o valor"** não casava em regex nenhuma: não tem "quanto", não tem "qual". E
   como a última fala da JuIA tinha "Para qual dia", a trava do Tiago (v29.69.0, "não repetir a
   pergunta do dia") varreu a agenda e devolveu dias. Correto pela regra, errado pra pessoa.
3. **"Quero alisar meu cabelo"** levou "Vamos marcar!" seco. Serviço de química: quem cita,
   pergunta o preço em seguida, sempre. Três casos em três semanas (Aletéia, Michele, este) em
   que a primeira pergunta depois de citar o serviço foi o valor.

**O que a JuIA aprendeu:**

- `askedPrice` cobre "saber/passar/mandar/dizer o valor", "valor?" sozinho (com "o", "e o",
  "qual" na frente ou não), "quanto?" solto, e o plural. Antes: só "quanto custa/fica", "qual o
  valor/preço", "valor do/da".
- **Pergunta de preço sempre leva o preço** — rede de segurança no fim da montagem da resposta:
  se perguntou preço, tem serviço escolhido e a resposta saiu sem "R$", o valor do que está
  escolhido entra na frente, seja qual for o ramo que montou o resto (lista de dias, oferta,
  resposta do modelo). "Quero saber o valor" → *"Alisamento / Relaxamento sai R$ 70,00 (55 min)."*
  + a lista de dias.
- No ramo "para qual dia", pergunta de preço tem resposta própria: o valor primeiro, a pergunta
  do dia depois. Nunca mais "Perfeito! Anotei" a quem perguntou o preço.
- **Uma vez, sem pedir:** na primeira vez que o serviço entra na conversa (nenhuma fala anterior
  da JuIA com "R$"), o valor vai junto — tanto no "Perfeito! Anotei Alisamento / Relaxamento —
  R$ 70,00" quanto no "Vamos marcar! Alisamento / Relaxamento sai R$ 70,00 (55 min). Me diz a
  data…". É o que o Juliano diria na cadeira: "alisamento sai 70, quer pra quando?". Cliente de
  casa que já ouviu o preço nessa conversa não ouve de novo.

**Decidido contra a recomendação óbvia.** Não coloquei `\bvalor\b` em `isPriceOrInfoQuestion`,
que é o interruptor que tira a mensagem do fluxo de agendamento inteiro. "Quero marcar, qual o
valor?" tem que continuar marcando E respondendo o valor — a rede de segurança faz as duas
coisas; o interruptor faria só uma.

**Banco de cenários:** categoria nova `preco_no_fluxo` com os três turnos da conversa real mais
"valor?" e "quero marcar o alisamento". O runner ganhou `must_include` (frase que TEM que
aparecer), simétrico do `red_flags` — sem isso não dava pra afirmar que o valor apareceu.
Baseline contra a produção ANTES do deploy: 4 de 4 com alerta (as respostas do print,
reproduzidas). Depois: 5 de 5 limpos, e zero alertas em `pergunta_de_dias` (6),
`primeiro_atendimento` (15) e `pedido` (16). 76 unit passando. Sem bump de `?v=`.

**NO AR** (08/09, ~18h05 BRT): `ju-ia-site` via CLI (`npx supabase functions deploy ju-ia-site`).

Fica anotado, fora do escopo: "faz platinado?" ainda cai como escolha de serviço ("Perfeito!
Anotei Nevou / Platinado — R$ 150,00…") em vez de "sim, fazemos, R$ 150" — a
`isServiceExistenceQuestion` da v28.56.1 não lista "platinado" nem "alisamento"/"progressiva"
depois de "faz". Agora pelo menos o preço aparece.

## 29.152.0 — Caso Helder: o mesmo cliente aparecia duas vezes, e não era cadastro duplicado

`admin-v15-4-core.js` · `admin-v15-4-dashboard.js` · `admin-relatorios-v28.js` · `admin-assistente-v16.js` ·
`database/migrations/143-*.sql` · `tests/e2e/admin/_fixtures.js` · `tests/e2e/admin/admin-clientes-telefone.spec.js` ·
`admin*.html` (bump) · `admin-version.json` + `ADMIN_VERSION`

Print do Juliano, terça 08/09/2026: na busca do Novo agendamento, "Helder" duas vezes — uma com
"(11) 97484-5870", outra com "5511974845870" cru. Pedido: *"cliente duplicado na nossa base de dados,
cria um mecanismo pra filtrar pelo telefone pra que isto não ocorra mais"*.

**O que era de verdade.** Não havia cadastro duplicado: `customer_profiles` tinha UMA ficha do Helder
(11974845870), e o índice único `uq_customer_profiles_phone_key` já impede a segunda desde a v29.94.0.
O que estava em dois formatos era `bookings.customer_phone`: três agendamentos vindos do site com 11
dígitos, dois vindos da JuIA com o JID do WhatsApp (13 dígitos, 55 na frente). O painel montava a
lista de clientes agrupando pelos **dígitos exatos**, então via duas pessoas — a segunda sem ficha
(`id` nulo), o que ainda faria a mesclagem do CRM não enxergá-la. Conferido no banco: 17 telefones
com agendamento em mais de um formato, 22 agendamentos num formato diferente do da ficha.

Corrigido em duas frentes, de propósito — só o painel deixaria o dado torto; só o banco deixaria o
painel dependente de o dado estar sempre limpo:

- **Painel agrupa por chave de telefone**, não por dígitos exatos: `aggregateCustomers` (busca do
  Novo agendamento, CRM, mesclagem), clientes únicos do Dashboard e dos Relatórios (ticket por
  cliente, novos × recorrentes) e o casamento de inativos/faltas reincidentes do Assistente. A chave
  é DDD + 8 últimos dígitos, a mesma regra de `phone_match_key` do banco e do `phoneKey` que a Agenda
  já usava pro nº da visita (caso John Maicon, v29.12.0 — o mesmo defeito, corrigido só ali na época).
  O campo `phone` de cada cliente continua sendo os dígitos gravados da ficha, único por cliente.
- **`formatPhone` tira o 55** (13 e 12 dígitos) e formata fixo: o número deixa de sair cru na tela.
- **Trigger no banco:** `trg_bookings_dados_do_cadastro` substitui `trg_bookings_nome_do_cadastro`
  (v29.137.0). Agendamento de telefone já cadastrado nasce com o nome E com o telefone da ficha,
  nos mesmos dígitos — site, JuIA e balcão, de uma vez, sem cada function ter que lembrar de
  canonizar. BEFORE INSERT só, como antes: editar na agenda continua livre. Testado com insert real
  desfeito por `raise exception`: "helder de novo" + 5511974845870 → "Helder" + 11974845870;
  telefone novo → preservado.
- **Dados:** os 22 agendamentos divergentes passaram pro telefone da ficha (`phone_key` é coluna
  gerada e acompanhou). Depois: 0 divergentes, 0 telefones com mais de um formato.

**Decidido contra a recomendação óbvia.** Não escolhi um formato "oficial" (11 ou 13 dígitos) pra
reescrever fichas e agendamentos inteiros: o formato da ficha é o que o CRM edita, o que
`admin_save_customer_v23` usa pra reapontar agendamentos e o que várias telas comparam. Reescrever
48 fichas e 70 agendamentos é risco sem ganho — o que importa é ficha e agendamentos baterem entre
si, e é isso que o trigger garante daqui pra frente.

Teste e2e novo reproduz o caso com a Carla das fixtures (ficha com 13 dígitos, um agendamento com
11): tem que ser UMA Carla na busca, com o telefone formatado, e UMA ficha no CRM.

Cache: `admin-v15-4-core.js?v=` e `admin-v15-4-dashboard.js?v=` nas 7 páginas do painel,
`admin-relatorios-v28.js?v=` e `admin-assistente-v16.js?v=` nas suas. `ADMIN_VERSION` e
`admin-version.json` → 29.152.0 (o painel aberto na barbearia recarrega sozinho).

## 29.151.0 — Quantidade de produto no Balcão e no fechamento da Agenda

`admin-balcao-v29.js` · `admin-v15-4-agenda.js` · `css/04-agenda-admin-core.css` · `admin*.html` (bump)

Pedido do Juliano, terça 08/09/2026, na cadeira: *"preciso lançar 2 Budweiser, não consigo
colocar quantidade"*. O produto era uma lista de caixinhas, uma por item — dava pra vender uma
Budweiser, não duas. Nem no Balcão, nem no modal "Concluir / Editar atendimento" da Agenda.

- Cada produto ganha um contador **− 1 +** que aparece ao marcar. O "+" num item desmarcado
  marca com 1; o "−" no 1 desmarca. Limite de 99.
- **Banco e comprovante não mudaram.** A quantidade vira o mesmo item repetido na lista
  enviada — é o formato que `admin_register_walkin_visit` e `admin-booking-status` já somam
  (preço por linha) e que o cupom já agrupa desde a v29.121.0 ("Budweiser (2 x R$ 8,00)"). Um
  registro que já tinha produto repetido abre o modal de edição com a contagem certa.
- No log "hoje" do Balcão, o repetido sai agrupado ("2× Cerveja…"), não "Cerveja, Cerveja".
- Os botões ficam dentro do `<label>` do checkbox: clique em botão não marca o checkbox
  (conteúdo interativo), então a marcação é feita à mão e o `change` é disparado pra o total
  recalcular. No modal da Agenda é um listener só, delegado no documento — o modal é
  reconstruído a cada abertura.

Cache: `style.css?v=` e `admin-v15-4-agenda.js?v=` bumpados em todas as páginas do painel,
`admin-balcao-v29.js?v=` no Balcão, `css/04` no `style.css`.

## 29.150.0 — O mesmo nono dígito, mais duas vítimas; e três frases da JuIA que saíram erradas

`supabase/functions/ju-ia-site/` · `database/migrations/142-*.sql`

Terça 08/09/2026, mesma manhã da v29.149.0. Dois prints do Juliano, três defeitos.

### Caso João (10h03): "2" + "Obrigado" virou "Vamos marcar!"

Respondeu **2** (agora não) ao convite de retorno e ainda agradeceu. A JuIA devolveu *"Vamos
marcar! Me diz a data e o horário que eu já deixo reservado pra você"* — e, duas horas depois,
o follow-up de lead ainda mandou *"Só passando pra saber se ainda tem interesse em Corte + Barba
Express"*. Três mensagens automáticas num dia pra quem foi atendido na sexta e disse não.

Causa raiz: **a mesma da v29.149.0** — o telefone dele chega sem o nono dígito, o convite
estava gravado com ele, o interceptador não achou o convite e o "2\nObrigado" foi pra IA com o
serviço da visita anterior ainda na memória. O modelo leu como pedido, saiu "Vamos marcar", e
a própria resposta recriou o lead que gerou o follow-up das 12h15. Já estava corrigido na
borda desde as 10h56; aqui ficam as duas redes de segurança que faltavam:

- `ju-ia-site`: **número solto não é pedido.** "2", "1!", "2 obrigado" só respondem a pergunta
  NOSSA. Sem pergunta aberta no estado (`last_question` vazio e nenhum `pending_*`), o intent
  `book` do modelo é descartado e a resposta é um agradecimento curto. O convite de retorno é
  tratado antes, no webhook — isto é só pra quando algo passar por ele de novo.
- Dados: o convite do João marcado como recusado (era o que o "2" dizia) e o lead recriado pela
  resposta errada apagado — sem isso ele levaria a pesquisa de motivo amanhã.

### Caso Gilberto (11h00): "8;00" virou meia-noite, e "Na sábado"

*"Sábado tamo junto mesmo horário 8;00"* e *"Horas"* (duas mensagens; o buffer junta). A JuIA:
*"Na sábado (12/09) a gente começa a atender 08:00 — às 00:00 ainda estamos fechados… (Anotei
Raspar a cabeça, o seu de sempre Se quiser outro serviço…)"*. O Juliano confirmou na mão, e o
horário das 08:00 de sábado está na agenda.

- `extractRequestedTime`: o `;` no lugar de `:` não casava em regex nenhum, e o fallback de
  hora sem minutos pegou o "00" antes de "Horas". Agora `;` e `,` valem como separador
  (erro de digitação de dois pontos), e o fallback exige hora 1-23 — "00 horas" não é pedido de
  ninguém.
- `emDia`: "no sábado", "no domingo". Os outros dias continuam "na".
- Nota do serviço de sempre: o emoji que separava as frases sai no `semEmoji()` e sobrava
  "o seu de sempre Se quiser". Ponto final no lugar.

### Migração 142 — o histórico dos 12 dígitos passa pros 13

Com a canonização da v29.149.0, quem chegava com 12 dígitos passou a existir só com 13 — e o
que já estava gravado com 12 ficaria órfão: estado da conversa, leads em follow-up, e o
histórico que o painel agrupa por telefone (a mesma pessoa em duas conversas). A migração
move tudo: `whatsapp_conversations` (22 linhas; 13 tinham gêmea de 13 dígitos criada pelos
upserts do convite, e a de 13 herdou state, takeover e última mensagem da de 12),
`conversation_leads` (5) e `whatsapp_messages` (269). Regra em `public.canon_wa_phone()`, a
mesma da function TS. Zero linhas de 12 dígitos restantes nas três tabelas, conferido depois.

**Testado em produção** depois do deploy, telefone de teste, sessões `deploy-check-v29150-*`
apagadas de `site_chat_messages`: "Sábado tamo junto mesmo horário 8;00 / Horas" → `time=08:00`,
*"No sábado (12/09) às 08:00 já está ocupado…"* (ocupado pelo próprio Gilberto — a agenda bate);
"2 / Obrigado" com serviço na memória e sem pergunta aberta → `intent=other`, *"Obrigado!"*;
"sábado às 8h" → 08:00, sem regressão. 76 unit passando. Sem bump de `?v=`.

## 29.149.0 — "Me chama daqui 14 dias" agora é um compromisso, não uma desculpa

`supabase/functions/whatsapp-webhook/` · `supabase/functions/return-invite-dispatch/` ·
`supabase/functions/_shared/telefone-whatsapp.ts` · `supabase/functions/_shared/adiar-convite.ts` ·
`tests/unit/adiar-convite.spec.js` · `database/migrations/141-*.sql`

Caso Pedro, terça 08/09/2026, 10h21. Ele respondeu ao convite de retorno com *"Decidir depois,
me chama daqui 14 dias"* e a JuIA devolveu: *"Não consigo iniciar uma mensagem daqui a 14 dias,
mas você pode nos chamar quando decidir."* Falso, e do pior jeito: o cliente acabou de dizer
QUANDO quer voltar e a resposta foi jogar a tarefa de volta pra ele.

Dois defeitos independentes, um escondendo o outro.

### 1. O telefone dele chega sem o nono dígito, e o webhook comparava o número literal

O WhatsApp identifica quem criou a conta antes do nono dígito pelo número antigo. O JID que a
Evolution entrega ao webhook veio `554688887777` (12 dígitos); o convite tinha sido gravado e
enviado para `5546988887777` (13). O webhook buscava `return_invites` por `phone = ` literal —
não achou, e a mensagem passou reto pelos interceptadores até a IA livre. Nos logs:
`marco:interceptadores-ok` → `marco:chamando-ia`.

Não é só o Pedro. Em 60 dias, **27 telefones chegaram com 12 dígitos — 1 em cada 8 clientes**,
11 deles com cadastro no outro formato. Pra esses, TODAS as 43 buscas por telefone literal do
webhook (convite, última mensagem enviada, estado da conversa, histórico) enxergavam um cliente
diferente do que o resto do sistema enxerga. O banco já resolvia isso nas RPCs com
`phone_match_key()`; a borda, não.

- `_shared/telefone-whatsapp.ts`: JID de 12 dígitos começando em 55 e celular (8 dígitos
  iniciando em 6-9) ganha o 9 e vira o formato de 13 que tudo o mais usa. Fixo (2-5) fica como
  está. Aplicado UMA vez, na leitura do JID — as 43 buscas passam a bater sem mexer em nenhuma.
  Enviar para o número de 13 dígitos funciona: é o que o `return-invite-dispatch` sempre fez, e o
  convite do próprio Pedro chegou assim.

### 2. Nenhuma regra do convite cobria "me chama daqui X dias"

O convite oferece 1 (quero) e 2 (agora não) e diz "se preferir decidir depois, é só me chamar".
O Pedro fez a terceira coisa, a mais natural: pediu pra SER chamado, com prazo. Sem regra, isso
caía em "outro assunto" e ia pra IA, que não tem como agendar nada — e disse isso.

- `_shared/adiar-convite.ts` (com 9 testes): lê o prazo em algarismo ou por extenso, em dias,
  semanas ou meses ("daqui 14 dias", "em uma semana", "só daqui um mês", "semana que vem",
  "quinze dias"), e reconhece o pedido de ser procurado ("me chama", "me lembra", "me avisa",
  "decido depois", "depois eu vejo").
- Webhook, interceptador do convite: prazo + pedido = convite **adiado** (`status = deferred`,
  `remind_at` = hoje + prazo, domingo cai pra segunda, piso de 2 e teto de 120 dias). Resposta:
  *"Combinado, Pedro. Em 22/09/2026 eu te chamo por aqui pra deixarmos seu próximo horário
  reservado. Se quiser marcar antes, é só me chamar."* Checado ANTES da recusa, porque a frase
  costuma trazer as duas coisas ("agora não, me chama daqui 2 semanas"). Prazo SEM aceite ("só
  daqui 15 dias") também adia; prazo COM aceite ("quero sim, daqui 2 semanas") é data de reserva
  e segue pro fluxo de aceite — e a etapa "pra quando?" agora entende prazo escrito, além de 1/2/3.
- Pedido sem prazo ("me chama depois"): UMA pergunta, "daqui a quantos dias você quer que eu te
  chame?", tratada na etapa `defer` do `pending_invite`. Resposta que não é prazo tira o convite
  do caminho e a JuIA segue — a regra "nunca insistir" continua.
- `return-invite-dispatch` (o cron das 10h, já respeitando a janela de contato): convite
  `deferred` com `remind_at` vencido recebe UMA mensagem — *"Passando como você pediu, pra ver se
  já quer deixar seu próximo horário reservado. 1 / 2"* — e volta a `sent`, com `sent_at` novo e
  `reminded_at` marcado. Daí em diante é o fluxo de sempre. Quem marcou por conta própria antes do
  dia não recebe nada (`expired`, `skip_reason = marcou_antes_do_lembrete`); conversa com o
  Juliano em andamento ou outra pergunta numerada pendente empurram pro cron de amanhã.
  "Próximo horário reservado" e "quero sim" ficam no texto de propósito: são as âncoras que o
  webhook usa pra reconhecer um "1" tardio como resposta ao convite (v29.144.0).
- Migração 141: `remind_at`, `reminded_at`, status `deferred` no check, índice parcial.

**O Pedro já está na fila.** O convite dele foi marcado à mão como `deferred` com
`remind_at = 22/09/2026` (14 dias, uma terça). Nenhuma mensagem de correção foi enviada a ele:
um robô se corrigindo cinco minutos depois é pior que o silêncio, e o lembrete de 22/09 chega
como "passando como você pediu". Se o Juliano preferir avisar antes, é uma linha do celular dele.

**Fora do escopo, anotado:** a IA livre (`ju-ia-site`) continua sem ter como agendar um lembrete
quando o pedido vem fora do convite ("me lembra em 2 semanas" numa conversa qualquer). Hoje ela
responde que não consegue — verdadeiro, mas vale um `remind_at` genérico numa próxima versão.

**Testes.** `npm run test:unit`: 76 (9 novos). Deploy das duas functions via CLI, que valida o
TypeScript; as duas respondem 401 sem o segredo (estão de pé). Sem bump de `?v=`: só edge
function e banco.

## 29.148.0 — Legenda corrompida não chega mais ao rascunho

Crivo de conteúdo de terça, 08/09/2026, 8h05. O rascunho do Instagram nasceu com a legenda
`�` e mais nada: um único caractere de substituição, sem uma palavra sequer. O Facebook e o
Status saíram com texto normal, então não foi o modelo que falhou de vez — foi uma resposta
truncada no meio de um caractere multi-byte (o post do dia abria com "☕").

O que deixou passar: `safeCaption` só tinha uma barreira de conteúdo vazio, `if (!candidate)`.
String não-vazia era aceita, mesmo sem texto nenhum dentro. O fallback escrito à mão existia,
estava correto, e não foi usado — porque nunca chegou a ser consultado.

- `content-generate-daily`: `safeCaption` agora também exige TEXTO DE VERDADE — descarta
  legenda com caractere de substituição (`CAPTION_CORROMPIDA`) e legenda com menos de 20
  caracteres ou menos de 4 palavras (`semTextoReal`), caindo no fallback. O log passa a
  registrar a legenda com `JSON.stringify`, senão um caractere invisível não aparece no log.
  Os limites são folgados de propósito: a legenda mais curta que o gerador produz na prática
  (Status do WhatsApp) tem 2 a 4 linhas, muito acima do piso.

Também no crivo de hoje, direto no banco, sem mudança de código:

- As três legendas foram reescritas. Além da do Instagram, que não existia, o gancho do dia
  era o café — praticamente a mesma frase do post já publicado em 04/09. Trocado para
  ACABAMENTO (contorno da nuca, linha da barba, degradê sem degrau), que ainda não tinha
  saído nesta semana e casa com a navalha da arte.
- `marketing_memory`, ficha da campanha: o título ainda era "Campanha ativa — agosto/2026
  (a partir de 11/08)". Ele não vai para o cliente, mas alimenta o prompt da imagem
  (`themeTextFor`) e o `context` do post, carregando uma data vencida. Agora é
  "Campanha ativa — sem data, sem promoção (revisar em 30/09/2026)".

**Arte reprovada, e não dá para consertar daqui.** A imagem de hoje (navalha sobre bancada de
mármore, parede de tijolo, luz quente lateral) é a terceira seguida com a mesma fórmula — 04/09
e 07/09 são a mesma composição com o objeto trocado. É exatamente a reprovação do Juliano em
30/08 ("a arte genérica que parece sempre a mesma"), e a constante `ENQUADRAMENTOS` da 29.100.0
não está segurando. O selo está íntegro e legível, não há texto inventado nem pessoa gerada por
IA — o defeito é só o enquadramento. `content-generate-image` exige sessão de admin logada, então
regerar depende do Juliano clicar na Central. Marcado em `context.arte_reprovada` nos três
rascunhos. Se repetir amanhã, a correção é no prompt, não no crivo diário.

Nada mudou em página do site, sem bump de `?v=`. `content-generate-daily` publicada (versão 64,
`verify_jwt: false`, inalterado). 67 testes unitários passando; a falha do e2e de `routes.spec.js`
na primeira rodada foi flake de browser e passou no retry. `VERSAO.md` 29.148.0.

## 29.147.0 — Tela de avaliações ligada ao conector do Windsor.ai; trava de ajuste também no botão Publicar

Pedido do Juliano (06/09/2026, "pode ligar o conector sim"), depois de eu descobrir que a tela
`admin-avaliacoes.html` nunca sincronizou nada: a tabela `google_reviews` estava vazia desde
01/08 porque os secrets `GOOGLE_REVIEWS_*` (API direta do Google) nunca foram cadastrados e,
por isso, nunca houve cron. O conector `google_my_business` do Windsor.ai, autorizado em
05/08, é o que respondeu as avaliações de hoje pelo chat — então passa a ser a fonte da tela.

- `google-reviews-sync`: ganha a fonte Windsor (secret `WINDSOR_API_KEY`, Data API
  `GET connectors.windsor.ai/google_my_business` com os campos da tabela Reviews). A API direta
  do Google continua como segunda opção, intacta, só saiu de dentro do handler. Novo: reconcilia
  avaliação que já estava na tabela e ganhou resposta por fora (app do Google, conector pelo
  chat) — vira `posted` com a resposta real, em vez de ficar pendente pra sempre. Na primeira
  rodada importa o histórico inteiro (as ~85 já respondidas entram como `posted`).
- `google-reviews-publish`: com `WINDSOR_API_KEY`, responde pela ação `reply_to_review`
  (`POST connectors.windsor.ai/google_my_business/actions`). Responder de novo substitui.
  E a trava da 29.146.0 vale também aqui: texto editado à mão na tela com "volta que a gente
  acerta"/"sem cobrar nada"/"garantia de ajuste" é recusado com a explicação, não publica.
- Cron `bdj-google-reviews-sync` a cada 2 horas (minuto 20), migration 140. Já agendado no
  banco; sem o secret a function responde `skipped` e não faz nada.

O que falta e só o Juliano pode fazer: pegar a API key no painel do Windsor.ai, cadastrar
`WINDSOR_API_KEY` nos secrets do Supabase e rodar o deploy das duas functions. A primeira
sincronização acontece no próximo minuto 20 de hora par.

Sem mudança em página do site, sem bump de `?v=`. `VERSAO.md` 29.147.0.

## 29.146.0 — Trava da "garantia de ajuste" no conteúdo; avaliações do Google respondidas pelo Windsor; exclusão de publicação

Domingo, 06/09/2026, à tarde. Três frentes, todas pedidas pelo Juliano na mesma conversa.

**1) "PARAR de falar qualquer ajuste volta."** Ao revisar as respostas de avaliação do Google
que eu ia publicar, ele viu pela terceira vez a frase "qualquer ajuste é só voltar que a gente
acerta sem cobrar nada" e cortou: *"quem ler vai achar que sou inseguro ou que corto mal"*. Tem
razão: a garantia existe como política de atendimento, mas repetida em público como gancho de
marketing vira aviso de defeito. Onde ela estava e o que mudou:

- `content-generate-daily`: regex `GARANTIA_INSEGURA` entra no `textoRaso` (legenda com a promessa
  é descartada e outra é pedida, como já acontece com "premium"), o motivo de reprovação da
  segunda tentativa cita a frase, e `VOZ_CONCRETA` proíbe explicitamente.
- `google-reviews-sync`: a mesma regex no rascunho de resposta — pede outra versão; se escapar de
  novo, corta só as frases com a promessa e mantém o resto. O prompt também ganhou a proibição
  de "premium"/superlativo, que não tinha.
- `ju-ia-site`: a garantia sai da lista de argumentos de valor (era citada junto com café, Wi-Fi e
  fidelidade quando o cliente questionava preço). Fica só a regra reativa: se o cliente perguntar
  ou reclamar do resultado, a JuIA explica os 7 dias como antes.
- `marketing_memory`: gancho 1 ("GARANTIA DE AJUSTE") removido da ficha da campanha (os outros
  renumerados), "garantia de ajuste" sai da lista de provas do Posicionamento, e uma memória nova
  de categoria `restricao` registra a ordem com a citação dele.
- O site (hero, plaquinha, FAQ) **não** foi tocado: lá a garantia é informação pra quem procura,
  não promessa empurrada. Se ele quiser tirar de lá também, é outra decisão.

**2) Avaliações do Google.** Três sem resposta (Pedro Vinícius Carvalho 29/08, Danilo Morais 04/09,
João Vitor 05/09, todas 5 estrelas). Respondidas pelo conector do Google Meu Negócio no Windsor.ai
(ação `reply_to_review`), com o serviço real de cada um puxado da agenda, "Barbearia do Ju" e
"Centro de Bragança Paulista" uma vez cada, e sem a frase de ajuste. Descoberta no caminho: a
tabela `google_reviews` está **vazia** e os secrets `GOOGLE_REVIEWS_*` nunca foram cadastrados —
a tela `admin-avaliacoes.html` nunca sincronizou nada desde a v28.33.0. O Windsor é hoje o único
caminho que funciona pra ler e responder avaliações. Fica registrado como pendência: ou cadastra
os secrets e agenda o `google-reviews-sync`, ou a tela do admin passa a ler do Windsor.

**3) Exclusão de publicação.** A Central de Conteúdo nunca teve "excluir publicação". Pra apagar
os três posts de domingo (Instagram, Facebook e Status, pedido dele), nasceu
`supabase/functions/content-unpublish` — `DELETE` na Graph API (funcionou também no Instagram,
que eu achava que a API não deixava apagar; achava errado) e `deleteMessageForEveryone` na
Evolution pro Status. Autenticação por token de uso único numa tabela temporária, já apagada:
a function está no ar e recusa tudo. Pra virar botão do painel, trocar o nonce por
`verify_jwt=true` + `is_admin()`. Erro meu do dia, registrado: publiquei um post de domingo
melancólico ("cadeira quieta, porta fechada") sem checar que os quatro domingos anteriores nessa
linha tinham sido reprovados, e sem olhar o único post de domingo escrito por ele (30/08, "Que seu
domingo seja tão incrível quanto você"). O formato de domingo passa a ser esse "recado" curto,
falando com o cliente — prompt a reescrever na próxima versão.

Deploys pendentes (bloqueados pra mim, rodar na máquina do Juliano): `content-generate-daily`,
`google-reviews-sync`, `ju-ia-site`. Sem mudança em página do site, sem bump de `?v=`.
`VERSAO.md` 29.146.0.

## 29.145.0 — Reagendamento: domingo e segunda dizem "fechado", não "sem vagas"

Pergunta do Juliano (06/09/2026): "e quando o cliente pedir atendimento no dia em que não
funcionamos?". Conferidas as três portas:

- JuIA (WhatsApp e chat do site): resolvido na 29.143.0.
- Página de agendamento (`agenda-v15.js`): já tratava — "Fechado nessa data. Próximo dia
  disponível: …" e o calendário pula sozinho.
- Página de reagendamento (`reagendar-v26-5.js`): mostrava "Sem vagas nessa data. Escolha outro
  dia" em domingo e segunda — a mesma leitura errada do print do Cleiton (agenda cheia, não
  fechada). Agora: "Fechado nessa data — Domingo e segunda a barbearia não abre. Escolha um dia
  de terça a sábado", sem nem consultar a agenda. Dia fechado excepcionalmente (bloqueio do
  admin) continua caindo em "sem vagas", como na página de agendamento.

Rodado: `npm test` (67 unit + 46 e2e). Cache `?v=29.145.0` em `reagendar.html`. `VERSAO.md` 29.145.0.

## 29.144.0 — O "1" tardio vira resposta ao convite; agendamento do Sabrino corrigido; tom "premium" sai dos prompts de conteúdo

Fecho das três pontas deixadas na 29.143.0, decididas pelo Juliano no mesmo domingo (06/09/2026).

- **Agendamento do Sabrino corrigido no banco**, por pedido dele: 12/09 às 13:15 agora é
  "Corte + Barba Express" (R$ 65, 60 min, 13:15–14:15), o combo do catálogo, no lugar de
  "Corte de cabelo + Corte + Barba Express" (R$ 105, 80 min). `end_time` é coluna gerada e
  se ajustou sozinha. O cliente **não** foi avisado da correção — a mensagem dele continua com
  o texto errado; se quiser, é uma linha pelo WhatsApp.
- **"1" solto depois da janela do convite** (`whatsapp-webhook`). O cron expira o convite de
  retorno em 72h e o webhook só olhava 48h, então o "1" do Sabrino, nove dias depois, virou
  "Como posso ajudar?". Agora um "1"/"2" solto, sem pergunta pendente da JuIA, com a **última
  mensagem enviada a esse telefone sendo o próprio convite**, recupera o convite (mesmo já
  'expired', até 30 dias) e segue o fluxo normal de aceite/recusa. Só número solto; texto
  livre fora das 48h continua como antes ("nunca insistir" segue valendo — quem fala é o
  cliente). Não foi exercitado ponta a ponta: exigiria mandar WhatsApp de verdade a um número
  de teste; o deploy empacotou sem erro e a lógica reaproveita o bloco de aceite existente.
- **Link de reagendamento pós-cancelamento: nada a mudar.** O cancelamento pelo painel já grava
  prazo de 30 dias (`admin-booking-status`); o link do Sabrino era de antes dessa regra e foi o
  último sem prazo — hoje há zero links sem `rebooking_expires_at`. A observação da 29.143.0
  estava desatualizada.
- **Prompts de conteúdo sem "premium/sofisticada/luxo"** (`content-generate-daily`, `-image`,
  `-video`): alterações que estavam pendentes de outra sessão, sem commit. O vocabulário mudou
  para "bem cuidada", "caprichada", "clássica e atemporal", "capricho no detalhe"; o resto dos
  prompts é idêntico. Coerente com a régua do CLAUDE.md ("barbearia de bairro com conhecimento
  técnico", não butique de luxo). Publicadas as três.

Rodado: `npm run test:unit` (67). Sem mudança em arquivo do site, sem bump de cache. Functions
publicadas: whatsapp-webhook, content-generate-daily, content-generate-image, content-generate-video.

## 29.143.0 — "Hoje a barbearia não abre": o dia fechado explicado antes da oferta, e o reagendamento pelo link sem dois cortes

Dois prints do Juliano na tarde de domingo, 06/09/2026.

### Caso Cleiton (WhatsApp, domingo 09h02): "Consigo te atender na terça sim!" para quem pediu hoje

Ele escreveu "Gostaria de marcar corte de cabelo para hoje" e ouviu "Para qual dia você quer ver os
horários?". Respondeu "06/09/2026" e recebeu "Consigo te atender na terça (08/09) sim! Ainda tenho
alguns horários…". Nada ali é mentira, mas lido de fora parece que a barbearia está aberta e não quer
atender hoje. O que acontecia por baixo: o modelo, instruído pelo prompt a "oferecer o horário
possível mais próximo" fora do funcionamento, pulava o domingo e devolvia `updates.date` = terça; a
frase determinística de disponibilidade (v29.120.0) abria com o "sim!" de quem confirma o dia que o
cliente pediu — só que o cliente tinha pedido hoje. E no primeiro turno o "para hoje" foi ignorado
porque o modelo devolveu data nula num dia fechado.

Regra do Juliano: "hoje a barbearia não abre, retornamos ao trabalho terça-feira e aí consigo te
atender entre tal e tal hora". Feito assim, em `ju-ia-site`:

- **O dia que o cliente pediu é lido do texto**, não do que o modelo devolveu (`diaPedidoNaMensagem`:
  "hoje", "amanhã", `06/09`, `06/09/2026`, ou um dia da semana solto). Se for domingo, segunda ou um
  dia com "Fechar o dia inteiro" no admin, a agenda vai pro próximo dia aberto e a resposta explica
  primeiro: *"Hoje a barbearia não abre (domingo e segunda a gente não abre). Voltamos ao trabalho na
  terça (08/09) e aí consigo te atender entre 08:00 e 18:15 para Corte de cabelo (aprox. 40 min). Você
  prefere manhã, tarde ou final do dia?"*. Dia fechado excepcionalmente cita o motivo cadastrado.
- Com hora ou período já pedidos ("hoje às 15h", "segunda de manhã"), a explicação entra na frente do
  que já era montado e o "Sim!" daquela frase sai — dizer "não abre hoje" e "Sim! na terça às 15:00" na
  mesma resposta contradiz. Um detalhe que custou dois deploys: nesse ponto a frase ainda começa com o
  "✅" (que o filtro de emoji tira depois), e a troca de "na terça" pra maiúscula tinha que pular ele.
- Dia pedido aberto e modelo sem data: a data passa a ser a que o cliente escreveu. Antes era
  "para qual dia?" de novo.

Conferido em produção logo depois (sessões `deploy-check-v29143-*`, apagadas de `site_chat_messages`):
o par de mensagens do Cleiton, "hoje às 15h", "segunda-feira de manhã" e o controle "na terça" (que
continua "Consigo te atender na terça (08/09) sim!", porque aí o dia pedido é a própria terça).

### Caso Sabrino (WhatsApp, 14h36): o "1" era de outra conversa, e o agendamento veio do site

O print parecia a JuIA agendando sábado 13:15 em resposta a um "1". Não foi. Rastreado no banco e nos
logs das functions:

- O "1" respondia ao convite de retorno de **28/08** ("Quer já deixar seu próximo horário reservado?
  1 — Quero sim"), nove dias depois. O convite só vale 48h (regra "nunca insistir", v29.16.0), então o
  "1" seguiu pro fluxo normal e a JuIA respondeu "Como posso ajudar? Deseja agendar um serviço?".
- Dois minutos depois ele abriu, **no navegador**, o link de reagendamento do cancelamento de 11/08
  (`reagendar.html`, chamadas `rebooking-context` e `create-rebooking` com preflight CORS — só
  navegador faz isso) e escolheu sábado 12/09 às 13:15. Canal `site`, sem a JuIA no meio.
- O que **era** erro: o agendamento nasceu como "Corte de cabelo + Corte + Barba Express", 80 min,
  R$ 105. A página pré-marcou "Corte de cabelo" e "Barba Express" (o serviço anterior, desmontado), ele
  clicou no combo "Corte + Barba Express" e a página aceitou os dois cortes. O carrinho do site impede
  isso desde a v29.62.0; esta página tinha ficado de fora. E a function tinha um catálogo fixo parado
  desde a v26.5 — Corte de cabelo com 30 min quando o banco diz 40 desde a v29.139.0, e sem os serviços
  criados depois.

Feito:

- `reagendar-v26-5.js` virou módulo e importa a regra das famílias (`assets/js/service-rules.js`):
  o serviço anterior é desmontado com `splitServiceNames` (não confunde o " + " dos combos) e
  normalizado; cada clique passa por `applyServiceRule`, com o mesmo aviso amarelo do agenda-v15.js.
- `create-rebooking` lê `public.services` (preço e duração atuais) e aplica `normalizeServiceSet`
  no servidor, como o create-public-booking já fazia. Deploy direto via CLI.
- `booking_customer_actions` recusava `rebooked_after_admin_cancellation` desde a v26.5 — o CHECK
  nunca recebeu o valor, e todo reagendamento pelo link falhava o registro em silêncio (só um
  `console.error`). Migration 139 libera o valor; a ação do reagendamento do Sabrino foi gravada à mão.
- **O agendamento do Sabrino NÃO foi alterado**: continua "Corte de cabelo + Corte + Barba Express"
  em 12/09 às 13:15, e ele recebeu a confirmação com esse texto. Decisão do Juliano: corrigir pelo
  painel para "Corte + Barba Express" (R$ 65, 60 min, o que ele sempre faz) e avisar o cliente, ou
  deixar e acertar na cadeira.

Dois pontos observados e deixados como estão, de propósito: o link de reagendamento pós-cancelamento
**não expira** (`rebooking_expires_at` nulo — foi usado 26 dias depois, e funcionou; se quiser prazo, é
decisão de negócio), e um "1" solto fora da janela de 48h cai no fluxo normal (a resposta "Como posso
ajudar?" é razoável; a alternativa seria perguntar "esse 1 é resposta ao convite de retorno?").

### CHANGELOG restaurado

Ao abrir este arquivo, faltavam cinco entradas da JuIA (29.138.0 "Revisão de sábado", 29.139.0
"Horário escolhido é horário reservado, e +10 min", 29.140.0, 29.141.0, 29.142.0): a trilha do Google
Ads da mesma noite (05/09) sobrescreveu o arquivo a partir de uma base anterior à v29.138.0 e reusou
os números 29.138.0 e 29.139.0 para o circuito de conversões. As cinco entradas voltaram, logo abaixo
das do Ads, com o texto original do commit `7f62bc0`. Os números repetidos ficam como estão — mudar
número de versão já publicada confunde mais do que resolve; a próxima trilha parte daqui, 29.143.0.

Rodado: `npm run test:unit` (67) e `npm run test:e2e` (46). Functions publicadas: ju-ia-site (v231+),
create-rebooking (v37). Cache `?v=29.143.0` em `reagendar.html`. `VERSAO.md` 29.143.0.

## Citações locais — auditoria de 06/09/2026 (sem mudança de código, versão continua 29.139.0)

Tarefa agendada pedida pelo Juliano em 05/09/2026: atacar a "maior alavanca parada" do SEO local
(seção 6 deste arquivo… ver `CLAUDE.md`) — zero citações externas criadas apesar de nota 5,0 e
81 avaliações. Rodou sozinha, sem o Juliano presente, com acesso ao Chrome autorizado.

### O que a auditoria encontrou, plataforma por plataforma

**Apple Maps / Apple Business Connect — AUSENTE, é o buraco maior.** Busquei "Barbearia do Ju
Bragança Paulista" direto no `maps.apple.com`: nenhum resultado. O único nome parecido que aparece
é "Barbearia do Júlio Preto", em São Paulo capital — empresa diferente. Não existe nem o registro
básico gratuito que o Apple Maps costuma puxar sozinho de outras fontes. Criar a ficha exige login
com Apple ID em `business.apple.com/businessconnect` — não há sessão nesse Chrome, e login não é
ação que a IA possa fazer sozinha.

**Bing — os dados já estão corretos, mas ninguém reivindicou.** O Bing Maps já mostra "Barbearia do
Ju" com endereço certo (Rua Doutor Antônio da Cruz, 482, Bragança Paulista, SP, 12900-350), telefone
certo, site certo e categoria "Barbeiro" — puxado automaticamente de alguma fonte na web, não de um
cadastro no Bing Places. Reivindicar em `bingplaces.com` (login Microsoft, sem sessão ativa) dá
controle direto sobre horário e fotos, mas o dado que já está no ar não está errado.

**Facebook — não existe página comercial.** Busquei no Bing por "Barbearia do Ju Bragança Paulista
facebook": nenhuma página relevante nos resultados. Precisa ser criada do zero como Página comercial
(não perfil pessoal, não vinculada automaticamente ao Instagram @barbeariadoju_) — exige login no
Facebook, sem sessão ativa nesse Chrome.

**Solutudo — não cadastrada.** Busca por "Barbearia do Ju" em Bragança Paulista no solutudo.com.br
não achou correspondência exata: voltaram 47 barbearias da cidade, nenhuma delas a nossa. Cadastro
é pelo botão "Cadastrar empresa" — fluxo provavelmente exige criar conta, o que fica para o Juliano.

**guiadebraganca.com.br — JÁ CADASTRADA, mas com o número da rua ERRADO.** A busca no próprio site
retornou "Barbearia do Ju · rua Antonio da Cruz n° **481** - Centro · 11 96707 3038 · Barbearias".
O número certo é **482**. Isso é uma inconsistência de NAP ativa — pior que citação ausente, porque
já está publicada e errada. Não tem página de detalhe própria (é um diretório antigo, no ar desde
1987, WordPress por baixo — `wp-login.php` existe em "Acessar meu Cadastro"). Não sei se o Juliano
tem essas credenciais; a correção pode precisar de contato direto — telefone (11) 4033-2000 ou
e-mail contato@guiadebraganca.com.br.

### Por que nada foi de fato criado ou corrigido hoje

Todas as cinco pendências esbarram no mesmo limite: **login de conta real (Apple ID, Microsoft,
Facebook, e possivelmente Solutudo/guiadebraganca) só o Juliano pode fazer**, e criar conta do zero
é ação que a IA nunca deve tomar sozinha — regra permanente, não só deste projeto. Isso já estava
previsto na própria tarefa agendada ("peça ao Juliano para fazer login"), mas a tarefa rodou sem ele
presente. Resultado: pesquisa completa, zero ação irreversível tomada, nada publicado.

Bloqueio extra encontrado: o Chrome conectado nesta sessão recusou navegação para
`ads.google.com` e para `guiadebraganca.com.br` ("Navigation to this domain is not allowed") — o
guiadebraganca foi contornado pelo browser sandboxed; a verificação de importação de conversões do
Google Ads (pedida como item secundário "se sobrar tempo") **não foi possível de checar** por esse
mesmo bloqueio, mesmo com o Chrome do Juliano conectado.

### Segunda rodada do mesmo dia: varredura de NAP na web aberta

A tarefa agendada disparou uma segunda vez em 06/09. Em vez de repetir a auditoria das cinco
plataformas — que já estava feita e está acima —, a rodada foi usada para uma pergunta que ninguém
tinha feito ainda: **onde mais o endereço da barbearia já está publicado sem a gente saber?**
Citação errada solta na web é pior que citação ausente, e só se acha procurando.

Varredura por nome + telefone + endereço nos agregadores que costumam alimentar o Google:

- **Apontador, Telelistas, GuiaMais, Cylex, Foursquare — nada.** Nenhuma ficha, nem certa nem
  errada. Terreno limpo: quando for cadastrar, não vai ter duplicata para brigar.
- **guiadebraganca — o erro do 481 confirmado por fonte independente.** Fui direto na página
  `/pagcliente/barbearias/` (85 barbearias listadas) e o registro está lá, textual: "Barbearia do Ju
  · rua Antonio da Cruz n° 481 - Centro · 11 96707 3038". Fora o número, o nome da rua também sai
  sem o "Doutor". Continua sendo a correção mais barata e de maior retorno da lista.
- **Fresha — existe uma ficha morta, e ela ainda ranqueia.** O buscador devolve uma página da Fresha
  com o NAP *correto* ("Rua Doutor Antônio da Cruz, 482 - 1"), mas a URL responde **HTTP 410 Gone**:
  a ficha foi removida da plataforma e o Google ainda não tirou do índice. Vale o Juliano lembrar se
  em algum momento abriu conta na Fresha — se a conta existir, ou se reativa com o NAP certo (é
  citação de graça), ou se apaga de vez. Ficha morta ranqueando não ajuda nem atrapalha muito, mas
  conta pendente em plataforma de agendamento concorrente é coisa que a gente quer saber.

**Dois alvos novos apareceram, os dois locais e gratuitos** — não estavam na lista original das
cinco e valem mais que a Solutudo justamente por serem de Bragança:

- **encontrabragancapaulista.com** — tem cadastro gratuito ("Cadastrar empresa",
  `/?pag=registro`, anunciado como "menos de 1 minuto"). Exige criar conta.
- **diariocidade.com** — guia local com página por empresa (vi a ficha de uma concorrente,
  Barbearia Bragantina). O site bloqueou leitura automática (HTTP 403); o fluxo de cadastro precisa
  ser conferido na mão, com navegador de verdade.

**Texto pronto para o e-mail do guiadebraganca** (`contato@guiadebraganca.com.br`), para o Juliano
só copiar e enviar — não foi enviado por mim, mandar mensagem em nome dele exige o "sim" dele:

> Assunto: Correção de cadastro — Barbearia do Ju (categoria Barbearias)
>
> Boa tarde. Sou o responsável pela Barbearia do Ju, listada no guia na categoria Barbearias.
> O número do endereço está publicado como 481 e o correto é 482. Seguem os dados corretos:
> Barbearia do Ju — Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista, SP —
> (11) 96707-3038 — https://www.barbeariadoju.com.br
> Agradeço a correção. 🙏

**O Chrome ficou indisponível nesta rodada, e por um motivo novo:** havia **dois navegadores
conectados** ("Browser 1" e "Browser 2"). Nessa situação os comandos alternam entre os dois e nada
funciona de forma confiável — a própria tarefa agendada avisa disso e manda pedir para fechar um.
Sem o Juliano para escolher, não dá para seguir. Então a verificação da importação de conversões do
Google Ads segue **sem checar** por um segundo motivo, somado ao bloqueio de domínio da rodada
anterior.

### Terceira rodada do mesmo dia: o OpenStreetMap, e um susto que não era

A tarefa disparou uma terceira vez em 06/09. Como a auditoria das cinco e a varredura de NAP já
estavam feitas, a rodada foi para duas perguntas ainda sem resposta.

**1) O OpenStreetMap — o caminho de trás para o Apple Maps.** Ninguém tinha olhado o OSM, e ele
importa por um motivo específico: o Apple Maps não inventa os pontos dele do zero, bebe de bases
abertas, e o OSM também alimenta Facebook, marcações de local e uma penca de apps de terceiros.
Consultei o Nominatim: **"Barbearia do Ju" não existe no OSM.** Consultei o Overpass num
retângulo cobrindo Bragança Paulista inteira e o resultado foi mais interessante que o esperado —
**a cidade só tem 2 pontos de cabeleireiro/beleza mapeados no OSM**, um deles sem nome. Nem o
Fígaro está lá.

Ou seja: é a única frente da lista onde **não há concorrência nenhuma** e onde não existe
duplicata para brigar depois. Conta no OSM é gratuita, não exige comprovar posse do negócio nem
esperar cartão de verificação pelo correio — é incomparavelmente mais barato que o Apple Business
Connect, e ataca o mesmo buraco por outro lado. Passa a ser o alvo nº 2 da lista, atrás só do
Apple. (Continua exigindo o Juliano criar a conta: criar conta é ação que eu não tomo sozinho.)

**2) O susto da conta cancelada — falso alarme, mas vira armadilha documentada.** Ao abrir
`ads.google.com` sem parâmetro de conta, o Chrome caiu numa conta com faixa vermelha: *"Sua conta
não está ativa — Seus anúncios não estão sendo exibidos porque sua conta foi cancelada."* Parecia
que a PMax tinha morrido. **Não é a conta da barbearia.** O seletor de contas do
julianoblpadilha@gmail.com lista só duas — **Barbearia do Ju = 659-268-6815** e Drogaria Pastrana
= 318-197-9162 — e a cancelada é uma terceira, **170-738-8913**, de outro login ativo no
navegador. Entrei na conta certa e a visão geral dela **não tem aviso de cancelamento nenhum**.

Fica o registro porque isso engana de novo: **`ads.google.com` sem `ocid` na URL não abre a conta
da barbearia**, abre a cancelada. Auditoria futura tem que entrar por
`ads.google.com/aw/overview?ocid=8086744029` ou pelo seletor.

**3) O NAP do próprio site, conferido contra fonte autoritativa.** Toda citação vai copiar o que
está no site, então um erro aqui se multiplica por cinco diretórios. O schema está consistente nos
4 arquivos que o declaram (`Rua Dr. Antônio da Cruz, 482` · `12900-350` · `+55 11 96707-3038`), e
o CEP foi validado no ViaCEP: `12900-350` corresponde a "Rua Doutor Antônio da Cruz, Centro,
**de 317/318 ao fim**" — o 482 cai dentro. **Está certo, nada a corrigir.** As coordenadas do
schema (-22.9540382, -46.5420126) também caem dentro do trecho certo da rua no OSM.

Isso fecha a dúvida do 481: a divergência é do guiadebraganca, não nossa. E de quebra mostra um
erro do próprio OSM — ele atribui CEP 12916-420 a esse trecho da rua, quando o correto é
12900-350. Se a ficha for criada lá, vale corrigir o CEP do trecho junto.

### A importação automática de conversões RODOU — verificada em 06/09/2026

Pendência de três rodadas, resolvida com o Juliano na tela para aprovar os prompts do Chrome.

**Primeiro achado: o caminho da interface mudou.** Não está mais em Metas > Conversões > ação >
Configurações > Evento, como diz a instrução antiga. O Google migrou a importação programada para
**Ferramentas > Central de dados > Produtos conectados**, e as duas abas velhas ("Uploads" e
"Horários") estão vazias, com um convite para a Central de Dados. Quem procurar no lugar antigo vai
achar que não existe nada configurado.

Estado da conexão **HTTPS · Importação programada**:

- Conexão: `conversoes.csv`
- Programação: todos os dias entre 01:00 e 02:00 (GMT-03:00)
- Campos mapeados: **6 campos** — bate com a v29.139.0, que separou gclid, wbraid e gbraid
- Utilização: Agendamento confirmado (WhatsApp)
- **Última execução: 6 de set. de 2026, 01:56:01 — Concluído ✅**
- Próxima: 7 de set. de 2026, 01:56 (programada)

Ou seja: **o cron disparou no horário exato previsto e o Google leu o arquivo.** O circuito de
atribuição está fechado de ponta a ponta — agendamento confirmado no WhatsApp que veio de anúncio
sobe sozinho de madrugada e vira conversão para a PMax otimizar.

Na tabela de execuções, as colunas mostraram **0 linhas importadas e 1 linha com erro** — que é
exatamente o esperado para hoje. A linha com erro é a de exemplo, com código de clique sintético:
o Google rejeita porque o clique não existe de verdade, e é *isso* que prova que ele está lendo o
formato certo. Formato errado daria falha de parsing ou execução não concluída, não "Concluído".

**Ressalva de confiança, para não virar fato inflado depois:** o status e o carimbo de 01:56:01
foram lidos na árvore de acessibilidade da página (sólido). Já o "0 e 1" foi lido de captura de
tela, porque o painel de detalhes abre em iframe de outra origem, que não se lê por texto — e no
meio do caminho a captura da extensão passou a devolver só uma faixa de 107px (redimensionar a
janela não resolveu). Confiança boa, mas menor que a do status.

### Em aberto para a próxima sessão, com o Juliano na tela

0. **OpenStreetMap** — ele cria a conta em osm.org (grátis, sem verificação de posse) e eu cadastro
   o ponto com o NAP oficial. Terreno virgem: a cidade inteira tem 2 pontos da categoria.
1. Apple Business Connect — ele loga com o Apple ID, eu preencho os campos com os dados oficiais.
2. Bing Places — ele loga com a conta Microsoft, eu reivindico a ficha que já existe.
3. Facebook — ele loga, eu crio a Página comercial (não perfil, não grupo).
4. Solutudo — conferir se dá para cadastrar sem criar conta nova; se não der, ele cria a conta.
5. guiadebraganca.com.br — tentar `wp-login.php` primeiro; se não houver credencial, ligar ou
   mandar e-mail pedindo a correção do 481 → 482.
6. ~~Verificação da importação de conversões do Google Ads~~ — **FEITA em 06/09/2026**, seção
   acima. Rodou às 01:56:01, status Concluído. Próxima conferência só faz sentido depois que
   houver agendamento real com código de clique válido, para ver "linhas importadas" sair do zero.
7. encontrabragancapaulista.com — cadastro gratuito, ele cria a conta e eu preencho (alvo novo).
8. diariocidade.com — conferir o fluxo de cadastro no navegador (alvo novo, bloqueia leitura
   automática).
9. Fresha — descobrir se existe conta antiga do Juliano por trás da ficha que responde 410.

## 29.139.0 — iPhone: os três identificadores de clique não são intercambiáveis

Pedido do Juliano em 05/09/2026, na hora: *"trate já, temos muitos usuários de iphone"*.

O Google não manda sempre `gclid`. Em tráfego de iOS sem consentimento de rastreamento (o ATT, aquela caixa "permitir que o app rastreie"), ele manda **`wbraid`** ou **`gbraid`** no lugar. E eles não são intercambiáveis: um `wbraid` enviado na coluna *Google Click ID* faz o Google **descartar a linha em silêncio** — sem erro, sem log, sem aviso.

Até a v29.138.0 o `whatsapp-attrib-v29.js` fazia exatamente isso:

```js
var g = param('gclid') || param('wbraid') || param('gbraid');
```

Os três caíam na mesma variável, iam para a mesma coluna do banco e saíam no mesmo campo do CSV. Todo cliente de iPhone que viesse por anúncio sem ATT seria perdido na importação — e ninguém saberia, porque a falha é muda.

### O que mudou, ponta a ponta

**No site** — o script agora guarda *qual* dos três recebeu (`{v, t, k}`) e manda cada um no seu campo. Registros gravados antes da v29.139.0 não têm o `k` e seguem tratados como `gclid`, que é o que eram.

**No banco** — colunas `wbraid` e `gbraid` em `whatsapp_attribution`.

**Na view** — três colunas, com apenas uma preenchida por linha (`coalesce`/`nullif`).

**No CSV** — de 5 para 7 colunas:

```
Google Click ID, WBRAID, GBRAID, Conversion Name, Conversion Time, Conversion Value, Conversion Currency
```

**Cache.** O `?v=` do script foi de `29.2.1` para `29.139.0` nas **57 páginas**, conferido por contagem depois (0 na versão velha). Publicar JS novo atrás de cache velho já custou um evento inteiro neste projeto.

### Testado

`wbraid` enviado à function de captura foi para a coluna `wbraid`, com `gclid` nulo. Registro de teste removido em seguida.

Três testes novos garantem o que o CSV não pode errar: `wbraid` sai na coluna WBRAID com a de gclid vazia, `gbraid` idem, e **nunca mais de um identificador na mesma linha**. 67 unit + 46 e2e.

### Mapeado no painel, no mesmo dia

A conexão passou de **4 para 6 campos mapeados**: `GBRAID -> GBRAID` e `WBRAID -> WBRAID`, com *Endereço IP* deixado vazio de propósito (não coletamos). O Google confirmou com "O mapeamento dos campos de conexão foi atualizado".

Os cliques desse painel não passam pela automação — tela de alta densidade — então foi na mão do Juliano, com conferência a cada passo para os dois nomes não saírem trocados. Trocar `GBRAID` com `WBRAID` seria pior que deixar vazio: o Google descartaria as linhas achando o código inválido, de novo em silêncio.

**O circuito está completo para Android e iPhone.**

## 29.138.0 — O circuito fechou: o agendamento volta para o Google

Última seta ligada em 05/09/2026. A ação de conversão **`Agendamento confirmado (WhatsApp)`** (código 7749762387) existe na conta e está conectada à fonte HTTPS.

### Como ficou

| Item | Valor |
|---|---|
| Meta | Reservar horários — **Ação principal** |
| Origem | Importar de cliques |
| Busca do arquivo | **Todo dia, entre 01:00 e 02:00** (GMT-03:00) |
| Janela de conversão de clique | 90 dias |
| Campos mapeados | 4 |

**Campos:**

```
Conversion_Time      -> Data/hora da conversão
Google_Click_ID      -> GCLID
Conversion_Value     -> Valor da conversão
Conversion_Currency  -> Código da moeda
```

O `Conversion_Value` importa mais do que parece: com ele o algoritmo aprende que um agendamento de R$ 100 vale mais que um de R$ 40, e passa a procurar ticket maior — não só volume.

E a janela de 90 dias bate exatamente com o TTL do `localStorage` no `whatsapp-attrib-v29.js`. Os dois lados do circuito esquecem o clique no mesmo dia.

Na tela final o Google confirmou: *"1 das suas 1 campanhas estão otimizadas para alcançar essa meta"*.

### Uma preocupação minha que não se aplicava

Repeti várias vezes que o nome da ação tinha que bater **exatamente** com o `Conversion Name` do CSV, sob pena de o Google descartar as linhas em silêncio. Isso vale para upload de planilha solta, onde o casamento é pelo nome.

Neste caminho, não: a conexão está vinculada à ação, e a coluna `Conversion Name` **nem foi mapeada** — os quatro campos acima são os únicos que o Google lê. A ação nasceu com o nome automático `conversoes.csv - Todos os registros de conversoes.csv` e nada teria quebrado por causa disso. Renomeada mesmo assim, para o relatório ser legível daqui a seis meses.

### O que fica pendente, e é pequeno

O `whatsapp-attrib-v29.js` guarda `gclid`, `wbraid` e `gbraid` na mesma coluna `gclid`. Um clique de iOS que traga `wbraid` iria para o campo de GCLID e a linha seria descartada. Caso raro, mas dá para separar em colunas próprias — o mapeamento do Google já tem campos `GBRAID` e `WBRAID` esperando, deixados vazios agora.

### Estado do circuito

```
Google -> gclid -> site (57 páginas) -> WhatsApp -> JuIA -> agendamento -> Supabase -> CSV -> Google
```

Fechado de ponta a ponta pela primeira vez. Falta só a água: a captura passou a valer em 03/09, e o único agendamento pago anterior tinha sido cancelado. Enquanto não houver conversão real, a function serve uma linha de exemplo com gclid sintético — que o Google descarta e que **some sozinha** no primeiro agendamento de verdade.

## 29.142.0 — Bateria de testes da JuIA: 19 cenários contra a function publicada, e o que ela achou

`database/migrations/138-v29.142.0-slots-excluindo-proprio-agendamento.sql` · `tests/manual/juia-bateria.cjs`

Pedido do Juliano (05/09/2026, à noite): "bateria complexa, profunda e completa". O script `tests/manual/juia-bateria.cjs` conversa com a JuIA de verdade (canal site com a chave anon; canal WhatsApp com a chave do backend e um telefone de teste), passa estado e histórico de turno em turno como o webhook faz, confere a resposta por regex e o banco por PostgREST, e apaga tudo no fim. Não entra no `npm test` de propósito: cria e cancela reservas reais, manda push pro Juliano e gasta modelo. O transcript da última rodada fica em `tests/manual/juia-bateria.ultimo.md`.

Nove rodadas na mesma noite: 18/32 → 26/36 → 29/36 → 27/36 (regressão de expectativa, não de código) → 31/36 → 34/36 → 28/34 (o modelo cortado de novo, e desta vez com log) → 33/36 → **36/36**. O que cada rodada achou e o que mudou:

### Achados de segurança e robustez

- **`verified_phone` era aceito de qualquer chamador.** A function aceita a chave anon do site (é como o chat do site chama) e honrava `verified_phone` do corpo: um POST com a anon pública + o telefone de outra pessoa cancelaria, remarcaria ou reservaria em nome dela. Agora `verified_phone` só vale quando o chamador é o backend (mesma chave do env, ou JWT com role `service_role`). O chat do site não muda nada.
- **Modelo falhando em silêncio — e a causa raiz.** Em 2 de 15 cenários da 1ª rodada a resposta foi o texto genérico "Posso ajudar com serviços, preços…" a quem pediu "corte quinta às 14h", sem nenhum log. Com log (2ª rodada em diante) apareceu o motivo: **status 200 e o JSON cortado no meio**. Na API de Responses os tokens de raciocínio contam no `max_output_tokens`, e 550 não sobrava pra resposta inteira — a primeira mensagem de uma conversa (a mais longa) era a que mais caía. É a origem silenciosa de uma parte dos "me embolei" e dos textos genéricos que o Juliano via desde julho. Agora: 1.400 tokens na primeira tentativa, 2.500 na segunda, e cada falha registrada com o pedaço da saída.
- **Teto diário de mensagens no WhatsApp.** 80 linhas por sessão (40 mensagens do cliente) valiam também para o WhatsApp, e a resposta era "Fale com o Juliano pelo WhatsApp" — dentro do WhatsApp. No canal do backend o teto subiu para 400 e, se bater, vira handoff.

### Achados de fluxo (todos corrigidos)

- A oferta pós-reserva ("quer incluir X? 1/2") nunca rodava: `next.completed=true` desligava o bloco. O "1" ia pro modelo, que só prometia.
- Remarcação pedia dois "sim": "responda sim que eu verifico" → "confirmando…? sim ou não". A agenda passou a ser consultada na primeira pergunta; sai uma só.
- Com a confirmação aberta, "15:30 não tem?" e "muda pra 14:30" repetiam "só confirmando 15:00?". Horário novo na mensagem troca o alvo.
- A checagem de horário livre da remarcação contava o PRÓPRIO agendamento: mover 15:00→14:30 dava "não disponível". Nova `get_available_slots_excluding` (migration 138), só na remarcação; a original ficou intocada.
- Pedido de gente ("quero falar com o Juliano") com remarcação pendente: o bloco da remarcação reescrevia o handoff. Agora o pedido de gente encerra qualquer pergunta aberta e vence no fim.
- Serviço de sempre escapava da confirmação quando o modelo classificava direto como reserva (`book`), e não era assumido quando o modelo devolvia uma pergunta ("É corte de cabelo?"). Trava também no ramo de reserva; pergunta de agenda com horário/dia conta como availability.
- Cliente novo (sem cadastro) caía no menu antigo em vez da reserva imediata; agora entra no mesmo caminho e só o nome é pedido antes.
- "só corte de cabelo de criança" virava "Corte de cabelo": o parser solto vencia o modelo. Modelo primeiro; criança/infantil força o corte infantil.
- "só o corte" em resposta a "reservo X, como da última vez?" respondia "quer que eu reserve?" — reserva na hora, o horário já estava combinado.
- O "serviço de sempre" fatiava o combo "Corte + Barba Express" (item do catálogo, 60 min) em "Corte de cabelo" + "Barba Express" (70 min): a agenda recusava horários que cabiam. Nome inteiro primeiro; só fatia o que não existe como item.

### O que a bateria confirmou que já estava certo

Saudação, preço, site não reserva sozinho, elogio depois da reserva não reabre agenda, "sim" da remarcação não vira Pix, "15:30 não tem?" não é "não", duas coisas na mesma mensagem respondidas em ordem, Pix com valor, cancelamento sem "undefined", horário ocupado com alternativas curtas, "vou ver e te aviso", visagismo, prospecção comercial.

### Pendências que ficaram do próprio teste (não da JuIA)

- W10 e W15 dependem do estado da agenda e das reservas do próprio telefone de teste (pergunta legítima de conflito quando já há reserva; horário tomado por cliente real). Rodar a bateria com a agenda de um dia vazio.
- A limpeza não consegue apagar `whatsapp_conversations`/`site_chat_messages` com a chave do backend por RLS — fica pra SQL direto.

Functions publicadas: ju-ia-site (8 vezes na noite). Migration 138 aplicada.

## 29.141.0 — A resposta vai para a última pergunta: registro único na JuIA

Pedido do Juliano (05/09/2026): "capacitar a JuIA a separar qual resposta é de qual pergunta". O caso Marcelo, de manhã: "responda sim que eu verifico" (remarcação) e, no estado, o "é só me pedir a chave" do Pix — o "sim" foi pra chave Pix.

### Como era

Cada pergunta da JuIA deixa um flag `pending_*` no estado e o bloco dono do flag consome a resposta. Funciona com UMA pergunta aberta. Com duas, quem ganhava era o bloco que aparecesse primeiro no código — não a pergunta mais recente. Cada correção (v29.17.0 Robson, v29.90.0 Walter, v29.138.0 Marcelo) foi um remendo local.

### Como ficou

Um registro só, `state.last_question = {kind, at, reply}`, escrito no **fim** de cada turno com a pergunta mais recente que ficou aberta (a que nasceu no turno vence; o Pix é a de menor prioridade, porque é oferta passiva). No **começo** do turno, três coisas, todas centralizadas:

1. **Resposta curta** ("sim", "não", "1", "2", "pode", "isso"…) com mais de uma pergunta aberta: as perguntas velhas são apagadas do estado antes de qualquer bloco rodar. Só a última sobrevive, e o bloco dela é o único que enxerga a resposta. Os quinze blocos que existiam não mudaram uma linha: cada um continua olhando o próprio flag — só que agora só um flag está lá.
2. **Resposta + pedido novo** ("sim, e tem 12:15?", "não. quanto custa a barba?"): a mensagem é dividida. A resposta fecha a pergunta aberta; o resto vira um segundo turno — a function chama a si mesma com o estado já atualizado e o histórico com a primeira resposta — e as duas respostas saem juntas, na ordem. Só divide quando o resto parece pedido (pergunta, horário, dia, verbo de agenda); "sim, obrigado" continua uma coisa só. Uma divisão por mensagem, sem recursão.
3. O **webhook** passa a tratar qualquer pergunta aberta da JuIA (`last_question`, exceto Pix) com a prioridade que antes só cancelar/remarcar tinham frente à pesquisa de satisfação — senão o "1" da oferta pós-reserva caía numa pesquisa de ontem.

A tabela `PERGUNTAS` no topo do `ju-ia-site` é a lista única de perguntas que a JuIA sabe fazer (serviço de sempre, encaixe do combo, oferta, conflito de agendamento, qual cancelar, cancelar, remarcar, trocar serviço, produtos, lista de espera, repetir, política de antecipado, duplicidade, primeira visita, Pix). Pergunta nova = uma linha ali.

**Decidido contra o óbvio:** não reescrevi os blocos para consultarem o registro um a um. Seria tocar em quinze pontos de um arquivo de 3.500 linhas sem teste automatizado, num sábado à noite. Apagar as perguntas velhas na entrada dá o mesmo resultado com um ponto de mudança — e é o que o webhook já fazia com os `pending_*` zumbis desde a v29.90.0.

**O que não muda:** a fila de perguntas numeradas dos robôs de fora (pesquisa, convite de retorno, confirmação de véspera, follow-up de lead) continua no webhook (`juia_pending_numeric_question`); é outro registro, de outro dono.

Functions publicadas: ju-ia-site, whatsapp-webhook. Sem mudança no site.

## 29.140.0 — Só oferece o que cabe, confirma o "de sempre" antes de reservar, e +5 nos serviços curtos

Três acertos do Juliano sobre a 29.139.0, no mesmo dia (05/09/2026).

### 1. A oferta de complemento só existe se o combo cabe no horário

Na 29.139.0 a JuIA reservava e perguntava "quer incluir Sobrancelha? 1/2" — e só no "1" descobria se cabia. Agora a agenda é consultada de novo, com a duração somada, ANTES de a pergunta sair: se o combo não cabe naquele horário, não há oferta nenhuma. (Corte + Lavagem substitui o corte, então soma só a diferença.)

### 2. Serviço assumido do histórico é confirmado em UMA pergunta

Cliente com cadastro que pede só "tem 13h?" recebia o "serviço de sempre" assumido pelo sistema (v29.18.0) e, com a reserva imediata, sairia com "Corte + Barba Express" reservado querendo só o corte. Agora, quando o serviço veio do histórico e não da mensagem do cliente:

> Hoje às 13:00 está livre. Reservo Corte + Barba Express, como da última vez? Digite *1* para sim ou *2* se quiser outro serviço.

"1" reserva na hora. "2" pergunta qual serviço, mantendo o dia e o horário. Se ele já responder com o serviço ("só o corte"), entra o que ele disse e o fluxo segue. Quem nomeia o serviço na conversa nunca vê essa pergunta — a flag `usual_assumed` morre no instante em que o cliente cita um serviço.

### 3. Durações: +10 a partir de 20 min, +5 nos curtos

A regra "+10 em tudo" (29.139.0) levava sobrancelha, pezinho e risquinho de 10 para 20 minutos — bloqueio grande demais para um acabamento. Ajuste do Juliano: serviços de até 15 min sobem 5; de 20 min para cima, 10. Ficou: Pezinho, Sobrancelha e Freestyle 15 min; Fibra Capilar 20 min; o resto como na 29.139.0 (corte 40, Barba Express 30, barba na navalha 40, combos 60/70…). Banco, catálogo, página de preços, lista de serviços, agenda e páginas dos três serviços.

### Anotado para uma próxima etapa: uma pergunta por vez, e a resposta vai pra ela

O Juliano pediu que a JuIA saiba separar "qual resposta é de qual pergunta" (caso Marcelo: "sim" da remarcação virou chave Pix). O mecanismo dos `pending_*` já faz isso para cancelar, remarcar, trocar serviço, produtos, lista de espera, oferta e (desde hoje) serviço assumido — o furo do Pix foi fechado na 29.138.0 com a regra "um sim só é do Pix se não há outra pergunta em aberto". O que falta, e é trabalho de uma versão própria: um registro único da ÚLTIMA pergunta feita (tipo + hora) que toda resposta curta consulte, em vez de cada bloco checar seu próprio flag; e, quando a mensagem traz duas coisas ("sim, e tem 12:15?"), responder as duas em ordem.

Rodado: `npm run test:unit` (64) e `npm run test:e2e` (46). Function publicada: ju-ia-site. Cache `?v=29.140.0` (catálogo, agenda), `ADMIN_VERSION` 29.140.0.

## 29.139.0 — Horário escolhido é horário reservado, e +10 min em todo serviço

Duas decisões do Juliano em 05/09/2026, na sequência da revisão de sábado (29.138.0).

### 1. A JuIA reserva primeiro e oferece depois

O menu numerado de complementos vinha ANTES da reserva: "Sim! 13:00 está disponível. Quer incluir mais alguma coisa? 1 — … 4 — Não, pode fechar". Quem não respondia (caso João) ficava sem nada reservado e o horário ia embora para outro cliente.

Agora, no WhatsApp (telefone verificado) e com nome conhecido, o horário que o cliente escolhe é agendado na hora — **só se cabe inteiro na agenda**: a JuIA continua consultando a agenda com a duração completa do serviço e só reserva um horário que a agenda devolve para essa duração. A confirmação sai curta, em linguagem humana, e termina com UMA pergunta de sim/não:

> Reservado! João, hoje às 13:00: Corte + Barba Express (R$ 65,00). Te espero na Barbearia do Ju.
> Quer aproveitar e incluir Sobrancelha Masculina (+ R$ 15,00)? Digite *1* para sim ou *2* para não.

"1" troca o serviço do agendamento pelo combo (a mesma RPC da troca de serviço confere se ainda cabe; se não couber, o original fica como estava e a JuIA diz isso). "2" encerra. Outro assunto derruba a oferta e a conversa segue.

**Decisões contra a recomendação óbvia, com o motivo:**
- Só dispara quando a mensagem ATUAL traz o horário (ou um "sim" a um horário oferecido). Horário que ficou no estado de uma pergunta antiga nunca vira reserva sozinho — é o que fez o "Sim, 13:00 está disponível" de ontem.
- Com cadastro no telefone, a reserva sai no nome do cadastro sem a pergunta "posso confirmar no nome de X?" (número compartilhado é raro, e a confirmação mostra o nome — o cliente corrige se for para outra pessoa). Uma pergunta a menos na hora de fechar; foi o que travou o João.
- A oferta pós-reserva tem prioridade sobre a pergunta de primeira visita (v29.68.0); as duas juntas seriam duas perguntas numeradas na mesma mensagem. A de primeira visita fica para a próxima confirmação daquele telefone.
- O site (chat sem telefone verificado) continua com o fluxo antigo: lá existem botões.

### 2. Todas as durações +10 minutos, e sempre "aprox."

Motivo do Juliano: em 04 e 05/09 o atraso acumulou entre um cliente e outro ("me embolei completamente, gerei atraso para quase todos"). Os 23 serviços subiram 10 minutos no banco (`services.duration_minutes`), no `services-catalog-v7.js` e em todas as páginas: corte 30→40, barba na navalha 30→40, Barba Express 20→30, Corte + Barba Express 50→60, combo com navalha 60→70 (1h10), Barboterapia 40→50, platinado 2h→2h10, e assim por diante. Onde o site mostra a duração, agora é "aprox. 40 min" (lista de serviços, página de preços, resumo do agendamento) ou "cerca de 40 minutos" (páginas de serviço e FAQ, que já usavam essa forma). A JuIA passa o catálogo ao modelo com "aprox." na duração.

Agendamentos já marcados mantêm a duração com que foram criados; só os novos entram com o tempo maior. A tolerância de 10 minutos (FAQ e home) não é duração de serviço e ficou como estava.

Rodado: `npm run test:unit` (64) e `npm run test:e2e` (46). Function publicada: ju-ia-site. Cache: `services-catalog-v7.js` e `agenda-v15.js` `?v=29.139.0`, `ADMIN_VERSION` 29.139.0.

## 29.138.0 — Revisão de sábado: o cupom cobrou quem não pagou, e a JuIA falou demais

`database/migrations/137-v29.138.0-fidelidade-no-checkout.sql`

Cinco prints do Juliano em 05/09 e a varredura das ~85 conversas da semana. Sete erros de comportamento, um de dinheiro. Tudo corrigido no mesmo dia.

### 1. Cupom: "Total: R$ 40,00 · Pago com prêmio do cartão fidelidade" (caso Joao, 08h00)

O corte foi pago com o prêmio. O Juliano marcou "Bônus de fidelidade" no Concluir, o registro ficou `payment_method='fidelidade'` com `loyalty_discount=0`, e o cupom saiu com **Total R$ 40,00**. O cliente que não pagou recebeu um documento dizendo que pagou.

**Regra que fica** (migration 137, uma só para todo mundo que lê `bookings`): `service_price` é o preço de tabela, bruto; `loyalty_discount` é quanto o prêmio cobriu; `loyalty_free_service` (coluna nova) é **qual** serviço foi o prêmio; `payment_method` é a forma do que foi **pago** — `fidelidade` só quando não sobrou nada a pagar. Receita = `service_price − loyalty_discount + products_price`.

Isso obrigou a alinhar quem lia diferente: o **Financeiro**, o **Dashboard** e os **Relatórios** somavam o corte grátis como R$ 40 recebidos — agora descontam o prêmio. A `reserve_loyalty_reward` (v29.10.0) reduzia `service_price` ao aplicar o prêmio, o que faria o cupom descontar duas vezes; nunca tinha rodado em produção (zero bookings com `loyalty_reward_id`) e passou a seguir a mesma regra. O balcão (`admin_register_walkin_visit`) grava o prêmio quando a forma é fidelidade.

**Check-out ganhou o que o Juliano pediu:** com "Bônus de fidelidade" e **dois ou mais serviços**, a tela pergunta *qual serviço é o prêmio* e *como o restante foi pago*; com um serviço e produto junto, exige a forma de pagamento do produto. O total a cobrar já desconta o prêmio. O cupom sai "Prêmio do cartão fidelidade (Corte de cabelo): −R$ 40,00 / Total: R$ 25,00 / Pago no crédito". Sem produto e sem resto: "Nada a pagar — prêmio do cartão fidelidade". Três testes novos em `tests/unit/comprovante.spec.js`. O registro do Joao foi acertado pela migration.

### 2. João (35 9139-7142): confundido pelo excesso de texto, foi à barbearia achando que tinha horário

A sequência, reconstruída pelo banco: 08h31 escolheu 13:00 → a JuIA respondeu "Sim! 13:00 está disponível" **mais um menu numerado de complementos** → ele não respondeu → às 10h06 outro cliente fechou 13:00 → 10h45 o follow-up de lead disse "a gente acabou não fechando" (ele leu como "fechou") → 11h52 "Eu vou às 13h como combinado" → "3" → "13:00 não fecha" → "Juliano consegue falar comigo?" → **"Consigo te atender na terça sim!"** → "N quero a inteligência artificial" (silêncio) → 12h23 "tô no caminho" → **"Sim, 13:00 está disponível"** (era terça 08/09 no estado, sem o dia na frase) → atendido no balcão às 13:55 → 14h30 respondeu "1" à pesquisa + "Vc é top demais / Parabéns e que Deus te abençoe" → **"Sim, 13:00 está disponível. Quer reservar?"** às 14h31.

O último foi corrida no webhook: o "1" gravou a pesquisa como satisfeito, mas o agradecimento foi **descartado** pela trava "cliente escreveu de novo antes do envio" (v28.69.1); a rajada seguinte, já sem pesquisa pendente, caiu na IA com data+hora no estado. Resposta que confirma ação já gravada agora sai sempre (`force`). E elogio/despedida (`soGentileza`) nunca mais reabre consulta de agenda.

Correções de fluxo: pedido explícito de gente ("falar com o Juliano", "não quero a inteligência artificial", "chama o barbeiro") virou **handoff determinístico** com uma frase curta — não depende do modelo. Toda confirmação de horário leva o **dia na frente** ("Sim, na terça (08/09) às 13:00 está livre…"). O follow-up de lead diz com todas as letras que **nada ficou reservado** e pede a confirmação.

### 3. Textos enxutos (pedido do Juliano)

| Antes | Agora |
|---|---|
| "13:15 já está reservado nesse dia. O mais perto que consigo é 12:45 — serve pra você? Se preferir outro, tenho ainda: 12:00, 12:15, 12:30. Ou, se ficar melhor pra você, também tenho horários de manhã" | "Hoje às 13:15 acabou de ser reservado por outro cliente. O mais próximo que tenho é 12:45 ou 13:00. Serve pra você?" |
| "Não encontrei horário hoje para X. O próximo dia com horário disponível é terça (08/09): consigo te atender entre 08:00 e 17:45 — por exemplo 08:00, 11:15, 14:30, 17:45. Quer marcar nesse dia? Se preferir, também posso te colocar na lista de espera pra hoje e aviso assim que abrir uma vaga." | "Hoje não tenho mais horário para X. Na terça (08/09) tenho 08:00, 11:15, 14:30. Quer que eu reserve um? Se preferir, te aviso assim que abrir vaga hoje." |
| "Posso incluir sim! Só que com Sobrancelha o atendimento fica com 50 min, e às 13:15 não fecha. Pra X + Y + Z consigo 13:00 ou 12:45. Ou, se preferir, mantenho só X + Y às 13:15 — o que fica melhor?" | "Com Sobrancelha o atendimento passa a 50 min e às 13:15 não cabe. Duas opções: *1* — combo às 13:00 (ou 12:45) *2* — Manter só X + Y às 13:15" |

"Acabou de ser reservado por outro cliente" só sai quando a própria JuIA tinha oferecido aquele horário antes na conversa; senão, "já está ocupado".

### 4. Sharles (15 99727-9993): "Então sem sobrancelha" não tirou a sobrancelha

Depois do "não fecha", "Então sem sobrancelha" e "Manter pezinho e pigmentação" não casavam com nada — e o modelo ainda **acrescentou** "Pigmentação de Barba" pela palavra "pigmentação". Três negativas seguidas, cada uma com um combo maior. A escolha "manter o original" agora entende "1"/"2", "sem <o extra>", "manter/somente/apenas", e parte da lista do turno **anterior**. Junto: **"só X" no início da frase é a lista inteira** (caso Julio, 10h04: "só corte de cabelo de criança" virou "Corte infantil + Barba Express", e foi cobrado assim).

### 5. Marcelo (11 93350-0117): pediu 12:15 e recebeu a chave Pix

"Vamos remarcar… responda sim" → "sim" → **chave Pix**. A confirmação do agendamento liga `pix_offered` ("é só me pedir a chave") e o "sim" curto casou com a oferta do Pix, que reescreve a resposta por cima da remarcação. Um "sim" só é resposta ao Pix quando **não há outra pergunta em aberto** (`pending_*`). E "12:15 não tem?" caía como "não" ("Tudo bem, não mudei nada"): frase com horário ou com "?" nunca é a negativa curta.

### 6. Alan (11 96850-4368): pediu visagismo, a JuIA disse "vamos marcar"

Não fazemos visagismo. O prompt ganhou o parágrafo *O que não fazemos*: dizer na primeira resposta que o Juliano não é visagista, e oferecer o que existe (Old Money, degradê…). Nunca "vamos marcar" nem "vou direcionar ao Juliano" para serviço que não existe aqui.

### 7. Miúdos da varredura

- "~Gabriel": o WhatsApp prefixa com "~" quem não está na agenda — saudação saía "Boa tarde, ~Gabriel!". Prefixo removido.
- "Beleza vou ver e te aviso" (Carlos, 03/09) recebia a mesma pergunta de novo. Agora: "Combinado, fico no aguardo."
- Follow-up de lead não sai para quem está na **lista de espera** (Sharles levou "a gente acabou não fechando" 2h depois de entrar na lista).
- Nota "(Anotei X, o seu de sempre)" não repete quando a resposta já diz "Anotei".

### Ficou de fora, anotado

- **Gabriel (11 98918-4946, 04/09):** depois de cancelar, "Quais horários tem para barba hoje?" caiu em "trocar o serviço do seu agendamento de às, de "undefined"" — o cancelamento não limpa o `pending_change_service_*`. Corrigir na próxima.
- **Ben-Hur (11 97374-2000, 04/09):** "Barboterapia e corte" listou horário só de corte e depois trocou barboterapia por "Barba na navalha". A normalização de família de barba precisa de revisão própria.
- **Fernando (11 98636-7032, 04/09):** perguntou horário *antes* das 16:00 que já tinha e a JuIA ofereceu 16:00 com o "serviço de sempre" errado.
- **Caio (03/09):** "Posso confirmar no nome de Caio?" saiu antes de existir dia e horário.

Rodado: `npm run test:unit` (64) e `npm run test:e2e`. Functions publicadas: admin-booking-status, satisfaction-dispatch, ju-ia-site, whatsapp-webhook, whatsapp-lead-followup. Migration 137 aplicada. Cache: agenda/dashboard/financeiro/relatorios `?v=29.138.0`, `ADMIN_VERSION` 29.138.0.

## 29.137.0 — "Sou eu juliano": a trava existia, o que faltava era o nome

`database/migrations/136-v29.137.0-booking-usa-nome-do-cadastro.sql`

O primeiro atendimento de 05/09 apareceu na agenda como **"Sou eu juliano"**. É o Joao victor, (11) 91935-8712, que agendou pelo site na véspera às 19h59 e digitou isso no campo nome. O Juliano pediu para unificar os cadastros e criar "uma trava baseada no telefone".

**Não havia o que unificar.** A trava já existia e tinha funcionado:

| Verificação | Resultado |
|---|---|
| Perfis com aquele telefone | 1 |
| `phone_key` duplicados na base | 0 (de 165 perfis) |
| Perfis sem `phone_key` | 0 |

A `v27_customer_for_booking` casa agendamento e cadastro por `phone_match_key` e **ignora o nome** — por isso o cadastro nunca duplicou, nem ali nem em lugar nenhum da base.

O buraco era outro: o nome digitado no site vai direto para a agenda **sem passar pelo cadastro**. Nenhum dado se perdeu, mas na tela pareceu cliente novo — e é isso que custa tempo no balcão.

### A correção

Quando o telefone já tem cadastro ativo com nome, o agendamento nasce com o nome do cadastro.

Ficou num **trigger da tabela**, não numa das funções de criação, para valer nos três caminhos de uma vez: site, JuIA e balcão. Uma trava que só cobre um caminho é a que falha justamente pelo caminho que ninguém lembrou.

`BEFORE INSERT` de propósito — **editar o nome na agenda continua livre**, e foi assim que o agendamento das 08:00 de hoje foi corrigido na mão.

A ordem de escolha do cadastro é a mesma da `v27_customer_for_booking` (quem tem fidelidade primeiro, depois o mais antigo). Se divergisse, o nome exibido poderia não ser o do cadastro ao qual o agendamento fica vinculado — o mesmo bug com outra cara.

### Testado com insert real, desfeito por `raise exception`

```
telefone conhecido   "Sou eu juliano de novo"  ->  "Joao victor"
telefone novo        "Cliente Novo Qualquer"   ->  preservado
```

Depois: zero resíduo na agenda. A segunda linha importa tanto quanto a primeira — cliente novo de verdade não pode ter o nome trocado por engano.

**Decidido junto com o Juliano:** o nome do cadastro vence sempre. O efeito colateral aceito é que quem agenda para outra pessoa usando o próprio telefone aparece com o nome do titular — raro, e visível na hora.

**NO AR** (05/09): migração aplicada.

## 29.136.0 — O Google exige Basic Auth, e uma linha para aprender o formato

Continuação da conexão da fonte HTTPS no Google Ads. Duas paredes, as duas resolvidas.

**1. Basic Auth.** A tela "Conectar com HTTPS" pede **URL, nome de usuário e senha**, os três obrigatórios — token na querystring não serve. A function passou a aceitar as duas formas: `Authorization: Basic` (usuário `ADS_CSV_USER`, senha `ADS_CSV_TOKEN`) e o token direto por header ou `?token=`, que continua útil para conferir com `curl`. As duas comparam em tempo constante, e o 401 agora manda `WWW-Authenticate`.

Testado no ar: sem credencial 401 · usuário e senha errados 401 · **usuário certo com senha errada 401** · credenciais corretas 200. A terceira linha é a que importa: senha errada com usuário certo tem que falhar igual.

**2. A URL precisa terminar em `.csv`.** O Google recusou com *"Selecione um arquivo CSV ou TSV com a extensão '.csv'"* mesmo o conteúdo já sendo CSV e o `Content-Type` sendo `text/csv`. Ele valida pela extensão da URL, não pelo conteúdo. Resolvido com `/conversoes.csv` no fim — o Supabase roteia o sub-caminho para a mesma function.

**3. Uma linha para aprender o formato.** Com o arquivo só de cabeçalho, a etapa "Selecionar dados" falhava: *"Falha ao determinar o tipo de dados ou o esquema... pelo menos uma linha de dados válidos"*. Enquanto não houver conversão real, a function serve **uma linha de exemplo** com código de clique sintético e valor R$ 0 — o Google descarta linha cujo gclid ele não reconhece, então não vira conversão nem mexe no aprendizado da campanha.

Ela não depende de ninguém lembrar de removê-la: sai por `linhas.length ? linhas : [EXEMPLO]`, então **some sozinha no primeiro agendamento de verdade**.

**Onde parou:** falta mapear o Google Click ID na seção "Detalhes da atribuição" e nomear a ação como `Agendamento confirmado (WhatsApp)`. As credenciais e a URL final estão em `~/.claude/site barbearia/`, fora deste repositório, que é público.

**NO AR** (04-05/09): `google-ads-conversions-csv` via CLI; secret `ADS_CSV_USER` criado.

## 29.135.0 — O serviço que o cliente pediu fora da lista numerada

Caso Guizo, 04/09/2026, 09h35. A JuIA fez a oferta numerada de sempre:

```
1 – Corte + Lavagem (vira R$ 50,00)
2 – Sobrancelha Masculina (+ R$ 15,00)
3 – Barba Express (+ R$ 25,00)
4 – Não, pode fechar assim
```

Ele respondeu **"Barboterapia e corte + lavagem"** — aceitou a opção 1 *e* pediu um serviço que não estava na lista. A resposta que voltou:

> "Boa escolha! Então fica Corte + Lavagem — R$ 50,00 (40 min), hoje às 13:30. Posso confirmar?"

Ele disse "Pode". O agendamento nasceu 09h36 com **um serviço, R$ 50,00, 40 min**, e o Juliano refez na mão às 15h33 para **R$ 100,00 e 80 min**.

**O que dói não é a agenda, é a combinação.** O cliente aceitou um orçamento e encontrou outro na cadeira — o caso Wellington (02/09) que originou o cupom não fiscal. E, no meio, 40 minutos de agenda que não existiam: o cliente das 14:15 pegaria a barbearia atrasada.

### A causa

No bloco da oferta numerada o código só procurava a resposta **dentro das opções oferecidas**:

```js
const modelAdded = pendingOffer.find(n => n!=='__none__' && next.services.includes(n) && !previousServices.includes(n))
```

Achou `Corte + Lavagem`, deu por resolvido e seguiu. A Barboterapia não estava em `pendingOffer`, então nunca foi olhada — sumiu sem erro, sem log, sem nada.

### A correção, em duas partes

**1. Serviço citado por extenso entra junto**, via `findServicesLoose(message)`, e o conjunto passa pela regra das famílias **antes** de virar preço e duração — o `normalizeServiceSet` do início do turno roda lá atrás e não enxergaria o que foi adicionado aqui.

Isso importa porque o parser é generoso de propósito: em `"Barboterapia e corte + lavagem"` o token `corte` casa com **Corte de cabelo** além do Corte + Lavagem que o cliente quis. Quem impede isso de virar cobrança errada é a regra das famílias, não o parser — fica o corte mais completo, a barba é preservada, total R$ 100,00.

Há guarda de negação: se a mensagem tem "não" ou "sem", nada é somado — senão "não quero barba" adicionaria barba.

**2. Barba ambígua não entra calada.** `findService('Barboterapia')` resolve para a variante **com ozônio**, a mais cara. Somar isso em silêncio seria reintroduzir o que a v29.104.0 proibiu. Quando a mensagem diz "barboterapia" sem dizer se é com ozônio, a JuIA passa a perguntar qual das duas (R$ 40 sem, R$ 50 com) em vez de escolher pelo cliente.

**O que NÃO mudou:** corte e barba continuam podendo somar. A regra sempre proibiu dois da MESMA família, não um de cada — e agora há teste explícito para isso, para ninguém "corrigir" no futuro.

### Erro meu no caminho, registrado porque custa caro repetir

Ao aplicar a mudança por script, usei `findIndex` num texto que existia **duas vezes** no arquivo: o bloco novo e o bloco original do `bareBarboterapiaAsk`, na linha 1021. O script casou com o primeiro e **apagou 651 linhas** do `ju-ia-site/index.ts`. Recuperado com `git checkout` — o arquivo estava commitado, então o estrago foi de tempo, não de código.

A lição virou procedimento no script definitivo: **toda âncora de edição é verificada como única antes do splice**, e o script aborta se encontrar zero ou mais de uma ocorrência. Vale para qualquer edição por script neste repositório, junto da regra que já existia de conferir a contagem depois.

Também levei três tentativas para escrever uma regex passando por heredoc: `\s` e `\b` chegavam ao arquivo como `s` e como um caractere **backspace** literal. O jeito que funciona é escrever o bloco num arquivo à parte e inseri-lo, sem escapes atravessando o shell.

**Testes.** 62 unit (3 novos, cobrindo o caso Guizo) + 46 e2e.

**NO AR** (04/09): `ju-ia-site` via CLI — e é o deploy que valida a sintaxe TypeScript. Foi ele que pegou uma quebra de linha inválida dentro de um template string antes que ela chegasse ao cliente.

## 29.134.0 — O CSV que o Google busca sozinho

`supabase/functions/google-ads-conversions-csv/` · `supabase/functions/_shared/ads-csv.ts` · `tests/unit/ads-csv.spec.js` · `database/migrations/135-*.sql`

A v29.133.0 deixou a view pronta, mas alguém ainda teria que exportar e subir a planilha na mão toda semana — e o que depende de alguém lembrar, para. Agora o Google busca sozinho.

A function serve a view em CSV numa URL protegida por `ADS_CSV_TOKEN`, para ser apontada como **fonte HTTPS** no Data Manager. Também serve para download manual quando for preciso conferir na mão.

**Sem JWT, de propósito.** O Data Manager do Google não manda `Authorization` do Supabase — está declarado no `config.toml` junto dos webhooks, com o motivo escrito. Quem protege é o token, conferido **em tempo constante**: comparação byte a byte com XOR acumulado, sem `return` no primeiro byte diferente, para o tempo de resposta não revelar quanto do prefixo estava certo.

**O token nunca entra no repo.** Ele vive em `~/.claude/site barbearia/ADS_CSV_TOKEN.txt` e como secret no Supabase. No repositório só aparece o *nome* da variável — conferido com busca pelo valor antes do commit, porque este repositório é público e já custou um deslize em 03/09.

### Três detalhes do formato que o Google recusa em silêncio

Por isso o CSV virou `_shared/ads-csv.ts` com teste, em vez de ficar solto dentro da function:

1. **CRLF** entre as linhas;
2. **quebra de linha no fim do arquivo** — sem ela a última conversão é descartada sem aviso;
3. **escaping RFC 4180** — aspas dobradas, campo entre aspas quando tem vírgula, aspas ou quebra.

Os 6 testes cobrem exatamente isso, mais o arquivo só com cabeçalho (que é o estado de hoje) e campo ausente virando vazio em vez de `"undefined"`.

### Erro meu, e como apareceu

O `revoke all ... from anon, authenticated` da migração 134 deixou a view **sem SELECT também para o `service_role`** — ela ficou com TRUNCATE, REFERENCES e TRIGGER e mais nada. A function respondia 401 corretamente nas portas erradas e **500 "erro ao ler" com o token certo**.

O deploy não reclamou. O `apply_migration` respondeu `success`. Só apareceu porque o endpoint foi chamado de verdade depois de publicado, com as três combinações — sem token, token errado, token certo. Corrigido na migração 135.

### Testado no ar

```
sem token     -> HTTP 401
token errado  -> HTTP 401
token certo   -> HTTP 200   text/csv; charset=utf-8
via header    -> HTTP 200
```

**Testes.** 59 unit (6 novos) + 46 e2e.

**NO AR** (03/09): `google-ads-conversions-csv` via CLI; migração 135 aplicada.

**Falta no painel:** criar no Google Ads a ação de conversão de importação com o nome exato `Agendamento confirmado (WhatsApp)` e apontar a fonte HTTPS para a URL da function. A URL completa com o token está no arquivo de credenciais, fora do repo.

## 29.133.0 — A última seta: o agendamento volta para o Google

`database/migrations/134-v29.133.0-google-ads-offline-conversions.sql`

O circuito da atribuição era **Google → gclid → site → WhatsApp → JuIA → agendamento → nada**. Sem a última seta, o algoritmo do Ads só aprendia com pedido de rota e clique — a única coisa que ele conseguia medir. Daí as 23 conversões de rota contra 1 de agendamento nos 30 dias até 02/09.

A view `google_ads_offline_conversions` entrega as linhas no formato exato da importação de conversões offline:

```
Google Click ID | Conversion Name                    | Conversion Time            | Conversion Value | Conversion Currency
Cj0KCQjw...     | Agendamento confirmado (WhatsApp)  | 2026-09-01 19:58:40-03:00  | 48.00            | BRL
```

**Eu estava errado na v29.131.0** ao dizer que isso dependia de developer token da API do Google Ads. Não depende: a importação por planilha (Google Sheets / Data Manager) nunca exigiu API. A auditoria do ChatGPT corrigiu isso, e é o que tirou a peça mais importante da fila de "esperar terceiro".

**Decisões dentro da view:**

- **Cancelamento e no-show ficam de fora.** Mandar ao Google uma conversão que não virou cadeira ocupada é ensinar o algoritmo a procurar mais gente que cancela.
- **Deduplicação é por conta do Google** — `gclid` + nome + horário repetidos são ignorados. Então reenviar a planilha inteira todo dia é seguro e idempotente, sem precisar de coluna de controle "já enviei".
- **Janela de 90 dias**, a mesma do `localStorage` do `whatsapp-attrib-v29.js` e a mesma que o Ads aceita.
- **`security_invoker` + `revoke` de `anon`/`authenticated`**: a view não sai pelo PostgREST, só com service_role.

**A view está vazia hoje, e pelo motivo certo.** Existe exatamente 1 registro com `gclid` e agendamento desde 11/08 — e o status dele é `cancelled`. O filtro fez o trabalho.

Vazia é o estado esperado agora: a captura só passou a existir de verdade hoje, com a v29.131.0 e a v29.132.0. O cano ficou pronto antes da água chegar, de propósito.

**O que falta, e é no painel:** criar no Google Ads a ação de conversão de importação com o nome `Agendamento confirmado (WhatsApp)` e apontar a planilha. Enquanto ela não existir, as linhas não têm onde entrar.

## 29.132.0 — A atribuição que capturava e não registrava, em 5 páginas

Auditoria do ChatGPT em cima da v29.131.0 levantou a pergunta certa: *"eu não quero simplesmente capturar GCLID quando alguém entra, quero garantir que ele seja persistido até o momento da conversão"*.

A persistência já estava resolvida — `localStorage` com TTL de 90 dias, a mesma janela do Ads. Mas conferir isso expôs outra coisa, na linha 18 do `whatsapp-attrib-v29.js`:

```js
var ENDPOINT = CFG.supabaseUrl ? CFG.supabaseUrl + '/functions/v1/whatsapp-attribution' : null;
```

O script depende do `window.BDJ_AGENDA_CONFIG`, que vem do `agenda-config-v6.js`. Sem ele, `ENDPOINT` é `null`: a página guarda o `gclid` no navegador e **nunca registra o token no servidor**. Falha silenciosa, do jeito que este projeto já conhece.

Das 57 páginas que ganharam o script ontem, **5 estavam nessa situação**: `404.html`, `na-barbearia.html`, `precos/index.html`, `precos/setembro/index.html` e `privacidade.html`.

Duas delas doem: **`/precos/` é o destino do QR da plaquinha da barbearia**. Quem escaneia o código no balcão, vê os preços e clica no WhatsApp dali seria registrado como visita anônima.

Agora as 57 têm config e script, nessa ordem — config síncrono primeiro, atribuição `defer` depois, então o objeto já existe quando o script roda. Conferido por contagem: 0 faltando.

**Também da auditoria, e eu estava errado:** disse na v29.131.0 que devolver conversão ao Google dependia de developer token da API. Não depende. O upload de conversões offline por planilha (Google Sheets / Data Manager) não exige API nenhuma. Isso muda a próxima etapa de "esperar credencial de terceiro" para "trabalho que dá pra fazer aqui".

**Testes.** 53 unit + 46 e2e.

**NO AR** (03/09): GitHub Pages.

## 29.131.0 — O Google Ads estava cego, e por isso otimizava para pedido de rota

Dia de mexer na mídia paga, a pedido do Juliano: *"faça o que precisar pra lotar minha cadeira"*, com teto de **R$ 20/dia**.

### O que estava travado

A PMax `barbearia atração clientes` — a única campanha que ele vê encher a cadeira, com gente achando a barbearia no Maps e agendando — estava **pausada**. O motivo não era desempenho: ela tinha `Leads de chamada` como meta de conversão, e o recurso de ligação `(11) 96707-3038` estava reprovado desde 13/03 por "número não confirmado". Meta apoiada em asset reprovado paralisa a campanha inteira.

Enquanto isso, R$ 20/dia escorriam pela campanha de Pesquisa em **Maximizar cliques**, que rendeu 1 conversão a R$ 328,95 no mês.

Feito no painel: meta de chamada removida (a campanha voltou de *Qualificada (limitada)* para **Qualificada**), orçamento de R$ 10 → **R$ 20/dia**, campanha reativada, número reenviado para revisão (saiu de *Reprovado* para *Pendente / Em análise*), campanha de Pesquisa pausada e **Meta pausado por inteiro**.

A verificação do asset de chamada, aliás, **não é por SMS** — o Google rastreia a landing page. O número já está na home 7 vezes, inclusive como `tel:+5511967073038`. O asset só nunca tinha sido reavaliado.

### O furo de verdade: a atribuição nunca chegou às páginas

Das 26 conversões da PMax nos últimos 30 dias, **23 são pedido de rota no Maps e apenas 1 é agendamento confirmado**. A leitura fácil seria "o algoritmo está perseguindo métrica de vaidade". Está errada.

A tabela `whatsapp_attribution` tinha **5 registros desde 11/08, um único com `gclid`**. O motivo apareceu no `git ls-files`: o `whatsapp-attrib-v29.js` estava em **4 páginas de 87**. Nem os 15 artigos do blog, nem as 24 páginas de serviço — que são exatamente onde a PMax deposita o clique — capturavam coisa alguma. Quem vinha do anúncio, caía numa página de serviço e clicava no WhatsApp virava fumaça.

Ou seja: o Google não estava escolhendo otimizar para rota. **Rota era a única coisa que ele ainda conseguia enxergar.**

Agora o script está em **57 páginas — todas as que têm link de WhatsApp**, conferido com contagem depois (0 faltando, 0 duplicado), do jeito que a armadilha dos scripts em massa exige.

### A JuIA citando a régua na cara do cliente

Caso Alexandre, 03/09, 18h11. Ele avisou *"Estou chegando! 5min de atraso"* e recebeu: *"Tudo certo, temos tolerância de 10 minutos. Seu horário está garantido, pode vir!"*. O Juliano teve que entrar na mão às 18h16 para dizer que ele podia vir tranquilo mesmo passando dos 10.

O texto estava correto e mesmo assim errado. **Citar o número transforma acolhimento em advertência** — quem avisa 5 minutos e ouve "temos tolerância de 10" lê "não abuse". O prompt mandava exatamente isso, com o número no exemplo.

A tolerância continua sendo 10 minutos: é regra interna de operação. Ela só não sai mais na boca da JuIA. Atraso curto agora recebe *"Sem problema, seu horário está garantido. Pode vir com tranquilidade."* — e atraso acima de 10 minutos continua indo para handoff, sem promessa.

### Decidido contra a recomendação óbvia

- **Não adicionar `Ver rota` como meta de conversão da PMax.** As 23 conversões de rota vieram *sem* a campanha otimizar para isso. Transformá-las em meta faria a campanha caçar quem só quer o endereço, e o gargalo da casa não é gente sabendo onde fica — é cadeira ocupada. Reavaliar depois que a atribuição estiver medindo agendamento de verdade.
- **Não reativar o Meta.** O Juliano já tentou várias vezes: *"só atrai curiosos e gente querendo vender"*.
- **Números lidos dentro de prompt de IA não são dado.** O histórico do ChatGPT continha "7 anúncios, R$ 1.222 gastos, 677 conversas a R$ 0,44" — e eu tratei como medição. Era o texto que o próprio Juliano tinha digitado no prompt, e ele mesmo desmentiu: nunca teve 1.230 conversas no WhatsApp. Na conta real o gasto visível dos 30 dias é R$ 53,86 + R$ 11,02. Fica registrado porque o erro é fácil de repetir: número dentro de conversa com IA é alegação, confere no painel.

### O que ainda falta, e não é código

O `gclid` capturado **não volta para o Google**. Não existe upload de conversão offline na conta, então mesmo com a captura consertada o agendamento que a JuIA fecha no WhatsApp continua invisível para o algoritmo. Enquanto isso não existir, a PMax aprende com rota e clique. Depende de acesso à API do Google Ads (developer token), que só o Juliano pode solicitar.

**Testes.** 53 unit + 46 e2e, verdes antes e depois da edição em massa.

**NO AR** (03/09): `ju-ia-site` via CLI; páginas via GitHub Pages.

## 29.126.0 — O cupom enxuto: cansar o cliente custa a pesquisa

Pedido do Juliano em 03/09/2026, em cima do print do atendimento do Rafael: *"mensagem gigante cansa o cliente... esta parte pode remover do texto e deixar ele mais enxuto por padrão"*.

Saíram três blocos, todos escritos hoje de manhã na v29.121.0:

- `Documento sem valor fiscal, emitido para sua conferência.`
- `Barbearia do Ju - Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista/SP`
- `Se algum valor não bater com o que combinamos, me avise por aqui que eu confiro na hora.`

**Ele tem razão, e o custo era medível.** A pesquisa 1/2 fica no FIM da mensagem — cada linha a mais reduz quem chega até ela. E a taxa de resposta da pesquisa alimenta o pedido de avaliação no Google, que é a maior alavanca de SEO local da casa. Rodapé bonito que ninguém lê custa avaliação.

Os três blocos eram texto que só o documento queria, não o leitor: o cliente já sabe que não é nota fiscal, já sabe o endereço da barbearia onde acabou de ser atendido, e já pode responder no mesmo fio se algo não bater — o convite era redundante com o próprio canal.

**O que fica**, e é o que responde à pergunta que originou o cupom (caso Wellington, 02/09): número do documento, item por item com valor, subtotal e desconto quando existem, total, forma de pagamento e caixinha.

Resultado no caso real do Rafael: **de 17 para 11 linhas**, com o "Digite 1" subindo para logo depois do total.

```
Olá, Rafael. Muito obrigado pela visita à Barbearia do Ju.

*COMPROVANTE DE ATENDIMENTO*
Nº 030926-52E395 — hoje às 11:10

Corte de cabelo infantil — R$ 40,00
Coca-Cola Lata — R$ 8,00

*Total: R$ 48,00*
Pago no Pix

Como foi seu atendimento?
Digite *1* para Satisfeito
Digite *2* para Insatisfeito
```

**Testes.** 53 unit — os dois casos que exigiam o rodapé viraram o inverso, garantindo que ele não volte por acidente.

**NO AR** (03/09): `satisfaction-dispatch` via CLI.

## 29.125.0 — Três defeitos numa tela só: a nota ignorada, o link que parecia golpe e o nome em minúscula

O Juliano mandou o print da conversa com o **Kelvin** (03/09/2026, 12h43) com a pergunta certa: *"parece que esta resposta ficou um pouco confusa, não parece"*. Ficou — e por três motivos diferentes.

### 1) A nota foi ignorada, e o cliente teve que responder duas vezes

12h43:39 — *"obrigado meu amigo"*. Três segundos depois, 12h43:42 — *"1"*. E a JuIA respondeu: *"Nós que agradecemos, kelvin! Quando puder, me conta como foi o atendimento: digite 1 se ficou satisfeito, ou 2 se ficou insatisfeito."*

Ele **acabou de digitar 1**. Teve que responder de novo, por escrito: *"foi excelente, sempre muito bom"*.

**Causa:** o debounce (6 s) junta mensagens em rajada separando por `\n` — o texto virou `"obrigado meu amigo\n1"`. Nenhum padrão casava: `leadingOne` exige o dígito no INÍCIO, `/^1+$/` exige o dígito SOZINHO na mensagem. Sobrou o `ambiguousShortReply`, que viu "obrigad" e respondeu a gentileza.

O detalhe cruel é que o defeito pune justamente quem é educado: quem manda só "1" é entendido; quem agradece antes, não.

**Correção:** dígito numa **linha própria** conta como resposta da pesquisa. Testado offline com 11 casos — pega `"obrigado meu amigo\n1"`, `"valeu\n1\nate mais"`, `"1!!"`, e não sequestra `"quero 1 corte"`, `"pode ser 1 hora antes"` nem `"12"`.

### 2) O link de avaliação parecia golpe

O card que o cliente via dizia **"Sign in - Google Accounts"**, com **`rpkqluaxhqsxnewunhfm.supabase.co`** embaixo. O link ia direto para a edge function, e a pré-visualização do WhatsApp segue o redirecionamento — sem cookies, ela chegava numa tela de login do Google e usou aquele título.

Pedir avaliação com um card assim é pedir para não ser clicado. E avaliação no Google é a maior alavanca de SEO local da casa (81 avaliações contra 467 do concorrente).

**Correção:** o link passou a ser `barbeariadoju.com.br/avaliar/`, página nova com Open Graph da marca — título *"Avaliar a Barbearia do Ju no Google"* e a imagem da barbearia. Ela repassa o mesmo token para a mesma function, então o rastreio de cliques da v29.29.0 continua idêntico; só a cara do link mudou. Redirecionamento por JavaScript, de propósito: crawler não executa JS, lê as meta tags e vai embora — `<meta http-equiv="refresh">` seria seguido por alguns e estragaria o card de novo.

### 3) "kelvin", em minúscula

O cadastro tem o nome em caixa baixa e isso vazou para o cupom (*"Olá, kelvin"*) e para a resposta (*"Nós que agradecemos, kelvin"*). Numa mensagem que se apresenta como documento, passa desleixo — e quem assina o WhatsApp é o Juliano.

Corrigido na **exibição** (`primeiroNome` em `_shared/comprovante.ts`), não no cadastro: o que o cliente digitou continua guardado como veio.

**Testes.** 53 unit (5 novos para `primeiroNome`) + 46 e2e. Regex da nota testada offline com 11 casos.

**NO AR** (03/09): `whatsapp-webhook` e `survey-recovery` via CLI; `/avaliar/` conferido em produção com as meta tags corretas.

## 29.124.0 — O contador de cadeira volta, entra no Git e ganha quem o vigie

Três coisas sobre o mesmo assunto, no mesmo dia.

### O que tinha acontecido

O contador estava parado desde **01/09 às 13h26** e ninguém percebeu — dois dias. O `counter.log` terminava em *"sem quadro da câmera — reconectando"*, o que parece defeito de hardware, e não era: em 03/09 a câmera respondia normalmente, RTSP e ONVIF abertos, e o notebook estava na rede da barbearia.

O que a formatação levou foi tudo que morava **fora da pasta do projeto**: o Python 3.12, o atalho de Startup (`BarbeariaContadorCadeira.vbs`) e o `barbearia-camera.env`. E o `start-counter.bat` continuava apontando para `C:\Users\julia\...`, o usuário de antes da formatação.

Diagnóstico que vale guardar: *"sem quadro da câmera"* no log significa as duas coisas — câmera fora do ar **e** senha errada. O que separa é rodar com `--once` e olhar a linha do ffmpeg: `401 Unauthorized` é credencial, não é hardware. Aqui deu 401 nos dois lugares (RTSP e ingest do Supabase), que eram exatamente os dois campos vazios do `.env`.

### 1) Restaurado (03/09, 12h48)

Python reinstalado, dependências, `.env` refeito, `.bat` e `.vbs` reescritos com `%USERPROFILE%`/`%LOCALAPPDATA%` — nunca mais caminho fixo de usuário. Enquadramento conferido no `debug.jpg`, que é o único jeito honesto de saber se a câmera não girou: **a cadeira está inteira dentro da zona, e a poltrona e o sofá de espera ficaram fora dela** — quem senta para esperar não vira atendimento fantasma. A calibração de agosto sobreviveu intacta no `zone.json`.

### 2) Versionado — `camera-cadeira/` (v29.123.0, commit 2112fdc)

O contador nunca esteve no Git. Por isso quase morreu. Entraram no repo o `chair_counter.py`, o `zone.json`, os dois atalhos e um README com instalação em máquina nova, diagnóstico e os parâmetros de sessão. Ficam de fora, de propósito: o `.env` real (tem a senha da câmera) e o `yolov8n.pt` (o ultralytics baixa sozinho). Próxima formatação: `git clone` e preencher três valores.

### 3) Vigiado — o alerta que faltava

Pedido do Juliano: *"e se puder deixar tudo isso online, assim se formatar o computador a estrutura não depende daqui"*. É a pergunta certa, e ela decide onde o vigia mora.

**Um vigia que roda na mesma máquina que ele vigia não serve para nada — cai junto.** Então a verificação foi pendurada no `tuya-watch`, o cron que já roda no Supabase de 10 em 10 minutos para o alarme: se o contador passa de **30 minutos** sem dar sinal **e** estamos em horário de funcionamento (ter-sáb, 8h-19h), sai push. Fecha sozinho quando o sinal volta.

- **30 min** é folgado de propósito: o contador manda sinal a cada 5 min, então a janela absorve queda de rede e reinício sem alarme falso.
- **Só no expediente** porque fora dele o notebook pode estar desligado de propósito — cobrar sinal de madrugada seria ruído, e alerta que grita à toa é alerta que se aprende a ignorar.
- Reaproveita o `alert()`/`resolve()` do alarme, que já não repete aviso em aberto e já fecha sozinho. Nenhuma function nova para manter.

O card "Cadeira (câmera)" no admin continua existindo — mas ele só avisa quem abre a tela, e o Juliano abre a tela justamente quando está com cliente na cadeira. O push vai atrás dele.

**Testes.** `npm run test:unit` (48). Parse TypeScript conferido antes do deploy. Sem bump de cache: só edge function.

**NO AR** (03/09): `tuya-watch` versão 7, `verify_jwt=true` preservado.

## 29.122.0 — A JuIA lê comprovante de Pix pela imagem, não pelo nome do arquivo

O Juliano mandou o print da conversa com o **Israel Paula** (02/09/2026). A sequência, com hora:

- **19h42** — atendimento: Corte + Lavagem + Barba na navalha com toalha quente, mais uma água. R$ 95,00.
- **19h45** — a JuIA manda o comprovante do atendimento (o cupom da v29.121.0, que passou a sair na hora).
- **19h50** — o Israel responde **pagando**: print do Pix, R$ 95,00, exatamente o total.
- **19h50** — a JuIA: *"Recebi sua foto, mas não consegui identificar nela um corte, barba ou coloração. Pode me contar com palavras o que você gostaria?"*

O cliente estava quitando a conta que a gente acabou de mandar, e ouviu de volta uma pergunta sobre que corte ele queria.

**Por que passou.** A detecção de comprovante (v29.47.0, caso Frei Bartolomeu) era por **metadado**, não por conteúdo: valia se o nome do arquivo ou a legenda falassem em pagamento, ou se a chave Pix tivesse saído para aquele número nos últimos 60 minutos. Nenhuma das três valia aqui — ele já tinha a chave de outra vez e mandou a imagem sem legenda nenhuma. Aí a foto seguiu para o fluxo de "referência de corte", que é o único que de fato **olhava** a imagem. Ou seja: o sistema tinha um analisador de visão apontado para a imagem e mesmo assim decidia o que ela era pelo nome do arquivo.

**Correção, na raiz.** Quem olha a imagem passa a classificar a imagem:

- `describeReferenceImage` agora responde `COMPROVANTE_PAGAMENTO|<valor>` quando a imagem é recibo (Pix, TED, cartão, print de banco), além de continuar descrevendo corte/barba/cor. Comprovante de Pix é visualmente inconfundível — tem valor, pagador, recebedor, banco.
- A análise virou **uma** chamada, compartilhada pelos dois fluxos. Antes, só o de referência olhava; agora o de comprovante olha primeiro e o de referência reaproveita o resultado. Nenhuma chamada de visão a mais.

**Três buracos que apareceram junto, todos fechados:**

1. **Gatilho novo — cupom recente.** Se *nós* mandamos o comprovante do atendimento nas últimas 6h e o cliente responde com imagem, é pagamento. Isso vai deixar de ser exceção: a v29.121.0 fez o cupom sair na hora, inclusive depois das 20h, então "recebeu a conta → pagou → mandou o print" vira o caminho normal.
2. **Comprovante sem atendimento vinculado.** Quando nenhuma reserva casava, o código simplesmente caía fora e a imagem ia parar no aviso de "não identifiquei um corte" — para quem acabou de pagar. Acontece de verdade em compra só de produto, vale-presente, atendimento de mais de 3h atrás e telefone do WhatsApp diferente do cadastrado. Agora confirma o recebimento e avisa o Juliano, sem inventar a que se refere.
3. **Atendimento já concluído.** A resposta terminava em *"seu horário segue reservado"* — dita a alguém que já tinha saído da cadeira. Quem já foi atendido recebe outro fecho.

**De brinde:** o valor lido na imagem entra no push. Se o comprovante mostra R$ 80 e o atendimento fechou em R$ 95, o Juliano vê a diferença antes de abrir o PicPay, em vez de descobrir conferindo.

**O que NÃO mudou:** os gatilhos antigos (legenda/nome de arquivo, chave Pix nos últimos 60 min) continuam valendo, na frente — são mais baratos que uma chamada de visão. O `prepay_declared_at` segue sendo só declaração do cliente; quem confirma o pagamento continua sendo o Juliano na Agenda, e o "Pagamento confirmado" continua saindo pelo `prepay-confirm`.

**Testes.** `npm test`: 48 unit + 46 e2e. Parse TypeScript das três functions conferido antes do deploy. Sem bump de cache: só edge function.

**NO AR** (03/09, 09h47 BRT): `whatsapp-webhook` versão 98 via CLI, `verify_jwt=false` preservado.

## 29.121.0 — Cupom não fiscal do atendimento, e ele sai na hora mesmo depois das 20h

O Juliano atendeu o Wellington em 02/09 e, terminado o serviço, o cliente questionou os valores. Não houve erro de cobrança — houve falta de documento. Pedido dele em 03/09: *"gostaria de aprimorar isto, fazer tipo um cupom não fiscal mesmo, especificando os serviços, produtos lançados na comanda e seus respectivos valores e o total e a forma que foi pago, assim não restará dúvidas sobre minha honestidade agindo com tal transparência"*. E, junto: *"existe uma regra de não enviar mensagem pro cliente após as 20hs, mas preciso de uma exceção, somente na conclusão do serviço"*.

As duas coisas são o mesmo problema visto de dois ângulos. O comprovante existia desde a v29.30.0 e já trazia serviço, produtos, total e forma de pagamento — mas em linha corrida, sem cara de documento, e **o do Wellington nem tinha saído**: atendimento de fim de dia cai na guarda de silêncio das 20h (v29.21.0) e o comprovante só sairia às 8h do dia seguinte. O cliente saiu da cadeira sem nada na mão, exatamente na hora em que a dúvida nasceu.

**1) O comprovante virou cupom.** O texto saiu de dentro da function e virou módulo próprio, `supabase/functions/_shared/comprovante.ts`, com teste unitário — o formato deste documento é o que o cliente guarda como prova do que pagou, e erro de conta aqui é erro na cara dele. O que mudou no conteúdo:

- **Número do documento**, no formato `020926-4F2A1C` (data do atendimento + 6 dígitos do id do agendamento). Derivado de propósito, não sequencial: não depende de coluna nova nem de contador no banco, nunca colide, e dá pra achar o atendimento pelo prefixo do id.
- **Itens um por linha**, com o valor de cada um. Produtos repetidos agrupam numa linha só (`Água mineral (2 x R$ 4,00) — R$ 8,00`) — duas linhas idênticas parecem cobrança dobrada.
- **Subtotal e desconto separados** quando houve prêmio do cartão fidelidade. Sem desconto, não aparece subtotal: linha a mais só confunde.
- **Caixinha aparece**, fora do total e identificada como recebida à parte. Ela continua fora do faturamento (é do barbeiro), mas o cliente entregou aquele dinheiro e a conta dele em casa tem que fechar.
- **Cortesia zera o total.** Antes o atendimento por conta da casa saía com o valor cheio e sem nenhuma linha de pagamento — o cliente que NÃO pagou recebia um comprovante com cara de cobrança. O **motivo** da cortesia continua fora do documento: aquele campo é anotação interna ("João, funcionário"), o cliente não é o público dela.
- **Pagamento com prêmio de fidelidade ganhou rótulo.** `fidelidade` é forma de pagamento aceita desde a v29.10.0 e não tinha texto aqui: quem trocou pontos por corte recebia a linha de pagamento em branco — o tipo exato de lacuna que gera a dúvida que esta versão existe pra eliminar.
- **Rodapé de documento**: "Documento sem valor fiscal, emitido para sua conferência" + nome e endereço da casa.
- **Convite direto**: *"Se algum valor não bater com o que combinamos, me avise por aqui que eu confiro na hora."* É a frase que transforma o cupom em canal de correção em vez de motivo de desconfiança silenciosa.
- **Sem emoji**, agora de verdade. As versões anteriores escreviam ✂️/🛍️/💳 que o `semEmoji()` (v29.102.0) apagava na saída, deixando cada linha de item começando com um espaço órfão. O texto já nasce limpo.

O que **não** mudou: a pesquisa 1/2 continua colada no mesmo envio, a venda só de produto (caso Eduardo, 27/08) segue com mensagem própria e sem pesquisa, o convite de agendamento do walk-in segue numa linha só dentro do cupom (v29.45.0), o pagamento antecipado confirmado segue valendo como forma de pagamento (caso Aletéia, v29.56.0) e o dia continua vindo do `booking_date`, não do dia do envio (caso Walter, v29.90.0).

**2) A exceção das 20h.** A regra existe pra não incomodar quem já está em casa com mensagem de marketing — lembrete, aniversário, reativação. O comprovante não é isso: é o documento do que o cliente **acabou** de pagar, e ele ainda está na porta da barbearia. A exceção é estreita de propósito:

- Vale **só** para a chamada direta da conclusão. O `admin-booking-status` passou a mandar `{immediate:true, booking_id}` ao `satisfaction-dispatch`.
- Vale **só para aquele atendimento**: no modo imediato a busca é filtrada por `booking_id`. Sem isso, uma conclusão às 21h arrastaria junto todo comprovante represado do dia, de outros clientes, fora de hora.
- Vale **só para atendimento do dia**: concluir às 21h um atendimento de ontem (acerto de agenda atrasado) não autoriza mensagem fora de hora — fica pendente e o cron manda às 8h.
- **Nunca de madrugada**: a exceção vai das 8h à meia-noite. O expediente pode furar as 20h; a madrugada não é expediente.
- O **cron continua respeitando o silêncio integralmente**. Nada mudou para lembrete, aniversário, reativação ou convite de retorno.

Efeito colateral bem-vindo: some a classe de bug do caso Walter (29/08, v29.90.0), em que o comprovante represado saía às 8h da manhã seguinte e o "1" do cliente caía na pergunta errada do dia anterior.

**3) O Balcão passou a mandar o comprovante na hora.** Achado ao ler o fluxo: o walk-in nasce de uma RPC chamada direto do navegador (`admin_register_walkin_visit`) e nunca passava por function nenhuma — o comprovante dele dependia **só** do cron de 15 em 15 minutos, e depois das 20h, do dia seguinte. Como walk-in de fim de tarde é justamente o cenário do Wellington, a tela do Balcão passou a chamar o `satisfaction-dispatch` logo depois de registrar. Para isso o `satisfaction-dispatch` ganhou um segundo caminho de autenticação — sessão de admin validada por `is_admin()`, mesmo padrão do `send-walkin-welcome` —, já que o navegador não tem o `EMAIL_WEBHOOK_SECRET`. Falha aqui não desfaz nem trava nada: o cron segue como rede de segurança.

**Testes.** `npm run test:unit`: 48 (16 novos em `tests/unit/comprovante.spec.js` — soma, agrupamento de produtos, desconto, cortesia, caixinha, formas de pagamento diferentes, dia do atendimento, venda só de produto, ausência de emoji). `npm run test:e2e`: 46. Bump de cache em `admin-balcao.html` (`?v=29.121.0`), `ADMIN_VERSION` e `admin-version.json` para 29.121.0, que andam juntos desde a trava anti-loop da v29.99.0.

## 29.120.0 — JuIA: agenda cheia é "ainda tenho alguns horários", nunca "vários"

O Juliano mandou o print da conversa com a Michele (02/09, 13h36): *"Vc tem algum horário disponível hoje?"* → *"Consigo te atender hoje em **vários horários** para Corte de cabelo (30 min)."* O resto da conversa foi bem (ela escolheu tarde, recebeu a lista, fechou 14:30) — o problema é a palavra. Nas palavras dele: *"consigo te atender hoje sim, ainda tenho alguns horários, não vários horários, percebe a diferença"*.

**Por que "vários" é o erro.** É a mesma questão da v29.12.0, que tirou o NÚMERO de horários livres da resposta ("Tenho 42 horários disponíveis") porque era a agenda vazia anunciada ao cliente. Trocar o número por "vários" resolveu o dado e manteve o recado: "vários" é abundância, e abundância na agenda de barbearia lê como cadeira vazia. "Ainda tenho alguns" diz exatamente a mesma verdade operacional — dá pra encaixar você — sem anunciar folga. E o "sim!" na frente responde a pergunta que a cliente fez de verdade ("tem horário?"), em vez de começar pela oferta.

**Mudado em código** (`ju-ia-site`, ramo `allSlots.length>10` da disponibilidade):
- Antes: *"Consigo te atender hoje em vários horários para Corte de cabelo (30 min). Você prefere manhã, tarde ou final do dia?"*
- Agora: *"Consigo te atender hoje sim! Ainda tenho alguns horários para Corte de cabelo (30 min). Você prefere manhã, tarde ou final do dia?"*

Só essa frase mudou. O resto do fluxo continua igual: a pergunta de período, a amostra de horários ("Alguns exemplos: 12:00, 14:00…") e o fechamento seguem como estavam — o print mostrou os três funcionando.

**O que NÃO foi mexido:** o ramo que lista todos os horários quando são poucos (aí a escassez é real e mostrar a lista é o certo) e a amostra espalhada do dia inteiro quando o cliente já disse que qualquer horário serve. Nenhum dos dois usa palavra de quantidade.

**Testes.** `npm run test:unit` (32) passou. Cenário novo `agenda-cheia-01` em `tests/juia/scenarios.mjs`, com "vários/muitos/diversos horários" como red flags. Sem bump de cache: só edge function e testes.

**NO AR** (02/09, 17h30 BRT): `ju-ia-site` via CLI. Conferido em produção com telefone de teste (`5599900011234`, sessões `deploy-check-v29120-*` apagadas de `site_chat_messages` em seguida): o caso da Michele nos dois canais (WhatsApp e site) devolveu a frase nova, o follow-up "Tarde" devolveu a lista de exemplos normalmente, e os sete cenários das v29.118/119 (`horarios-01/02`, `despedida-01/02`, `saudacao-01/02/03`) passaram sem red flag — nenhuma regressão.

## 29.119.0 — JuIA: "tudo bem?" devolve a pergunta ("e você?")

Complemento da v29.118.0, apontado pelo Juliano em cima do mesmo print do José Reis: *"Boa tarde meu amigo / Tudo bem?"* recebeu *"Tudo bem, José. Como posso ajudar você hoje?"* — seco. O correto, nas palavras dele: *"tudo bem e você?"*. O Kelvin, mais cedo (*"bom dia meu amigo, tudo bem por ai?"*), recebeu a mesma resposta sem devolver a pergunta (*"Tudo bem por aqui, obrigado."*).

**Por que passava pelo modelo.** A resposta fixa de saudação (v29.102.0) só disparava com "oi"/"bom dia" isolados em até 20 caracteres. Qualquer vocativo ("meu amigo") ou o próprio "tudo bem?" tirava a mensagem desse caminho e ela caía no modelo, que responde curto e não devolve a gentileza — mesmo com o prompt pedindo cordialidade.

**Corrigido em código** (`saudacaoIsolada` reescrita, em `ju-ia-site`):
- A saudação isolada passa a aceitar mais de uma abertura ("opa, e aí"), vocativo ("meu amigo", "irmão", "chefe", "Juliano"…) e a pergunta "tudo bem/tudo bom/como vai/beleza?", até 60 caracteres, inclusive quando o webhook agrupa duas mensagens ("Boa tarde meu amigo" + "Tudo bem?").
- Quando o cliente pergunta como estamos, a resposta é fixa: *"Tudo bem por aqui, e você? Como posso te ajudar hoje?"* (com o prefixo "Boa tarde, Fulano!" que já existia). Se há pedido em aberto, só a abertura é fixa e o resto continua sendo a resposta do modelo.
- "beleza"/"suave"/"tranquilo" sem "?" continuam sendo confirmação, não pergunta.
- A resposta dele ao nosso "e você?" (*"tudo bem também"*, *"ótimo, obrigado por perguntar"*) tem tratamento próprio: *"Que bom! Me diz o que você precisa que eu já vejo pra você."* — sem "e você?" de novo, que viraria loop. Essa checagem vem ANTES da detecção de pergunta de propósito (um "Tudo bem" seco como resposta é resposta, não pergunta).
- Prompt: regra correspondente (devolver a pergunta; ao receber a resposta, reagir curto e ir ao pedido).

**Testes.** 13 frases offline (positivas, negativas e a ordem resposta/pergunta) passaram. Três cenários novos (`saudacao-01/02/03`) em `tests/juia/scenarios.mjs`. `npm run test:unit` (32) passou. Sem bump de cache: só edge function e testes.

**NO AR** (02/09, 13h20 BRT): `ju-ia-site` via CLI. Conferido em produção com os três cenários novos e os quatro da v29.118.0 (regressão), telefone de teste, sessões `deploy-check-v29119-*` apagadas: *"Boa tarde, Marcos! Tudo bem por aqui, e você? Como posso te ajudar hoje?"* nos dois casos de pergunta, *"Que bom! Me diz o que você precisa…"* na resposta, e os quatro anteriores iguais à v29.118.0 — nenhuma red flag.

## 29.118.0 — JuIA no WhatsApp: "quais horários" é pedido de lista, e despedida se responde uma vez

O Juliano mandou print de duas conversas de 02/09 pedindo pra achar onde a JuIA errou. As duas têm a mesma raiz: ela não age como gente numa conversa curta.

**1) Kelvin (11h16–11h24) — horário antigo grudado no estado.** Às 11h16 ele pediu "corte hoje às 16h" (sem vaga; a JuIA ofereceu 15:45/17:15 e outros). Sete minutos depois mudou o pedido: *"amanhã dia 03, você teria quais horários?"* — e a resposta foi *"Sim, 16:00 está disponível para esse atendimento de 30 minutos. Quer reservar esse horário?"*. Três erros numa frase: "Sim" pra uma pergunta que não era sim/não, um horário só quando ele pediu a lista, e o 16:00 que ninguém tinha pedido pra amanhã. Ele insistiu (*"quais outros horários teria"*), a mesma frase foi regerada, o anti-papagaio do webhook (v29.27.0) trocou por *"me embolei"* + handoff, e o Juliano fechou na mão (às 10h de amanhã).

Causa no código: `next.time` guardava o 16:00 da pergunta anterior, e o `effectiveTime` (que existe de propósito pra não fazer o cliente repetir o horário quando as perguntas de complemento entram no meio) reaproveitava esse horário mesmo com dia novo. O reset de horário só existia pra agendamento **concluído** (v29.x, `next.completed`) — não pra pedido em andamento que muda de dia.

Corrigido com trava de código (`perguntaDeHorarios`, antes do `effectiveTime`): "quais/que/outros/mais/demais horários", "horários disponíveis/livres", "opções de horário" = pedido de LISTA → `next.time` é limpo e o intent vira `availability`, então o bloco de disponibilidade responde com a agenda do dia (hoje, com muitos horários, ele pergunta manhã/tarde/fim do dia — comportamento já existente). Pergunta de funcionamento ("que horas abre/fecha") fica de fora. O prompt também aprendeu (regra LISTA DE HORÁRIOS) — mas, como sempre, a trava de código é a garantia.

**2) José Reis (12h09–12h12) — três despedidas seguidas.** *"Está confirmado para 16:15 hoje?"* → *"Sim, está confirmado para hoje às 16:15. Até mais tarde, José!"* (correto: o agendamento existe, `bookings` 16:15 Corte + Barboterapia) → *"Maravilha"* → *"Obrigado, José. Até mais tarde!"* → *"Até"* → *"Até mais tarde, José. Será um prazer atendê-lo!"*. É o caso Helder (v29.64.0) de novo: "Maravilha" e "Até" sozinhos não casavam no regex de despedida pura (só "até mais/logo/breve/a próxima"), e "até amanhã"/"até hoje" caíam em `pedidoNaFala` por conter "amanha"/"hoje". Somado ao nome em toda frase, o cliente percebe que não é o Juliano.

Corrigido em `despedidaPura`: confirmação curta ancorada no fim da frase (`ackCurto`: maravilha, perfeito, ótimo, show, top, beleza, blz, combinado, fechado, certo, joia, ok, tranquilo, "até", "até lá/já/amanhã/hoje/mais tarde"…) depois de um fechamento da JuIA = silêncio. Ancorada de propósito: "fechado, me manda o pix" e "certo, e amanhã?" continuam recebendo resposta. `jaFechou` passou a reconhecer também "até lá/já/amanhã", "te esperamos", "pode vir tranquilo", "será um prazer". No prompt: regra DESPEDIDA UMA VEZ, NOME UMA VEZ (não repetir o nome em mensagens seguidas nem em despedida curta).

**O que NÃO era erro:** a confirmação do 16:15 (agendamento real, conferido no banco) e o "Obrigado" no masculino (quem assina o WhatsApp é o Juliano, regra da v29.102). O 🙏 do "me embolei" é o único emoji permitido.

**Testes.** Regex testadas offline com as frases reais e 12 negativos (todos passaram). Quatro cenários novos em `tests/juia/scenarios.mjs` (`horarios-01/02`, `despedida-01/02`, com `state`/`history` recriando o ponto exato das conversas; `proximoDiaAberto()` calcula a data pra bater com a agenda real). `npm run test:unit` (32) passou. Sem bump de cache: só edge function e testes.

**NO AR** (02/09, 12h56 BRT): `ju-ia-site` **versão 204**, deploy direto via CLI (`npx supabase functions deploy ju-ia-site`), sem ponte por SHA. Conferido em produção logo depois com os quatro cenários (telefone de teste `5599900011234`, sessões `deploy-check-v29118-*` apagadas de `site_chat_messages` em seguida): Kelvin 1 e 2 → `state.time` null, lista de amanhã (pergunta de período), sem "Sim, 16:00"; José 1 e 2 → resposta vazia (silêncio), sem red flags.

## 29.117.0 — Badges de /agendar/ unificados, link de /precos/ sem sublinhado

Dois retoques pequenos do Juliano, os dois casos de "duas variações da mesma coisa" que ele foi pegando ao navegar pelo site publicado:

**1) Badges de serviço em `/agendar/` tinham dois estilos.** `.service-tag` no CSS compartilhado sempre teve dois níveis: contornado/discreto por padrão, e sólido dourado só para `.hot`/`.premium` (destaque de best-seller). O Juliano apontou "Finalização completa" (contornado) como diferente do padrão de "Mais procurado" (sólido) — pra ele, sólido dourado é o único padrão certo. Adicionado ao bloco `<style>` já escopado a `/agendar/`: todo `.service-tag` agora sai sólido dourado, sem distinção hot/premium. Conferido nas 9 badges da página (Finalização completa, Mais procurado, Premium, Toalha quente + navalha, Rápida, Melhor experiência, Prático, Transformação, Atendimento reservado) — todas idênticas agora.

**2) O link "Ver os preços que valem até 30/09 →" (dentro do aviso amarelo de `/precos/`) usava sublinhado via `border-bottom`**, diferente do padrão limpo (dourado, negrito, sem sublinhado em repouso) usado em todo o resto do site desde a v29.108.0 — ex.: "Conheça minha trajetória e formação →" na home. Eram duas convenções de link coexistindo. `.aviso .link` corrigido em `precos/index.html` e `precos/setembro/index.html` (que tem o mesmo aviso, com o link "Ver a tabela que passa a valer em outubro →").

`npm run test:unit` (32) e os e2e de `cart.spec.js`/`routes.spec.js` (10) passaram antes de publicar.

## 29.116.0 — Logo de /precos/ (e as páginas irmãs) no mesmo tamanho da home

O Juliano mandou print: a logo de `/precos/` continuava pequena (`min(300px,72vw)`) enquanto a da home já tinha sido ajustada pra `min(760px,92vw)` na v29.111.0. `/precos/` é uma página autocontida (CSS próprio, não usa `style.css`), então não herda nada do site — precisava do mesmo ajuste manual.

Corrigido `header img.marca` pra `min(520px,88vw)` em `precos/index.html` e `precos/setembro/index.html` (essa estava ainda menor, 280px). O valor é menor que os 760px da home de propósito: o `.wrap` dessas páginas tem só 640px de largura máxima (são plaquinhas pensadas pra impressão/QR code, não a hero cheia da home), então 520px preenche a coluna na mesma proporção que 760px preenche os 960px da home.

Mesma correção replicada nos três repositórios irmãos (wifi-barbearia-do-ju, pix-barbearia-do-ju, contato) — usam exatamente o mesmo padrão de página (`header img.marca`), copiado de `/precos/` quando foram criados na v29.110.0, com a logo ainda menor (240px). Ajustados os quatro juntos pra não deixar essa mesma pergunta voltar por outra página da mesma família.

`npm run test:unit` (32) passou. Sem teste e2e pra essas páginas autocontidas; conferido visualmente em `/precos/` antes de publicar.

## 29.115.0 — Varredura: avaliacao.html sem a fonte Bebas Neue

O Juliano pediu pra conferir se ficou algum campo pra fora do padrão. Varri todo o site rastreado pelo git procurando páginas que usam tipografia Bebas Neue sem carregar a fonte (o mesmo bug corrigido em whatsapp.html/instagram.html/salvar-contato.html na v29.109.0) — `grep` por `font-family:'Bebas` sem o `<link>` do Google Fonts correspondente.

Achado: só `avaliacao.html` (pesquisa de satisfação pós-atendimento, várias telas controladas por `avaliacao-v27.js`). O `<link>` da fonte nunca existiu nela, e pior — o próprio `.experience-card h1` não tinha `font-family` nenhum declarado, então nem adiantaria só linkar a fonte. Adicionado o link e a declaração de fonte (`clamp(1.8rem,6vw,3rem)`, mesmo espírito das outras correções). Não toquei em mais nada da página — não li o `avaliacao-v27.js` a fundo, então qualquer mudança além de CSS/tipografia ficaria pra outra hora.

Outras páginas verificadas e descartadas: `agendar.html` e `experiencia.html` são só redirects (sem conteúdo real); `cliente.html` e `meu-agendamento.html` não usam Bebas Neue em lugar nenhum, então não têm esse bug específico (não quer dizer que estejam 100% no padrão novo — só não têm *esse* problema). `blog.html` já estava bem: usa `.link-card` (grid de texto, sem imagem, `min-height:128px`), nunca teve o inchaço do `.service-card`/`.product-card` antigo.

**Ainda não revisadas nesta varredura** (fora do escopo do que foi pedido até agora, então não mexi): `cliente.html`, `meu-agendamento.html`, `reagendar.html`, `recibo.html`, `na-barbearia.html` — são páginas de pós-agendamento/conta, não de conversão. Se quiser, entro nelas também.

`npm run test:unit` (32) passou. Sem teste e2e pra `avaliacao.html`; conferido manualmente que o h1 renderiza em Bebas Neue depois da mudança.

## 29.114.0 — Ordem de /agendar/ igual à de servicos.html, hero mais curta, produtos.html no mesmo padrão

Três pedidos do Juliano em cima da v29.113.0:

**1) Ordem das categorias em `/agendar/` não batia com `servicos.html`.** Lá a sequência é Cortes → Barba → Combos (mudou na v29.108.0, "barba é o que mais sai, junto do corte"); em `/agendar/` continuava Cortes → Combos → Barba, a ordem antiga. Corrigido pra bater exatamente. Os 20 `data-name` conferidos de novo depois do reordenamento (nenhuma duplicata, nenhum sumiço).

**2) A hero escondia a lista, exigindo scroll antes de ver qualquer serviço.** Título grande + assunto + 3 botões + aviso da agenda própria empurravam "Cortes masculinos" pra fora da tela mesmo em desktop. Reduzido `.services-hero{padding:28px 0 16px}` (era 64px 0 34px), aviso mais compacto, e `margin-bottom` do cabeçalho de cada categoria de 28px pra 14px. Em mobile (375×812) ainda sobra ~70px de scroll até o primeiro card — não dava pra zerar sem cortar os botões de atalho, que têm função real (ir direto pra agenda, ver produtos).

**3) `produtos.html` no mesmo visual enxuto.** Diferente de `servicos.html`/`agendar/`, os produtos têm foto de verdade — vira item de prateleira, não texto puro — então não faz sentido remover a foto pra virar lista igual às outras. O card em si (`.product-card`, grid de 128px+texto) já era razoavelmente compacto, sem a guerra de especificidade que `.service-card` tinha; o que destoava era a hero (mesmos 64px de padding) e `.product-section{margin-top:52px}` empilhado com `.section{padding:40px 20px}` — quase 100px de vão antes do primeiro produto. Reduzido pro mesmo padrão da hero de `/agendar/`, preço trocado pra Bebas Neue dourado (igual a todo o resto do site — antes era só Inter bold), e botão "Adicionar ao carrinho" (26 ocorrências, uma por produto) encurtado pra "Adicionar", igual ao padrão do catálogo de serviços. O botão "Adicionar cortesia" do café e o botão do modal (`#modal-add`, mais espaço disponível) ficaram como estavam de propósito.

**Correção de contagem:** a v29.113.0 disse "~30 serviços" — são 20 (2+3+2+5+7+1 por categoria). Sem efeito no código, só a mensagem do commit estava errada.

`npm run test:unit` (32) e os e2e de `analytics.spec.js`, `routes.spec.js`, `cart.spec.js` e `booking-review.spec.js` (20) passaram antes de publicar. `produtos.html` não tem teste e2e dedicado — testado manualmente (adicionar produto, abrir carrinho, conferir total).

## 29.113.0 — /agendar/ enxuto, no padrão de servicos.html — carrinho intacto

Pedido do Juliano: usar `servicos.html` como modelo pra `/agendar/#servicos`, mantendo a diferença real entre as duas — `/agendar/` é a página de conversão, com carrinho de compras e descrição curta por serviço; `servicos.html` é conteúdo/SEO, sem carrinho. "Enxugar o layout" era a parte pedida: os ~30 serviços apareciam em cards grandes (grid de até 3 colunas, badge, parágrafo inteiro, metadados empilhados, card com até 430px de altura mínima) — a mesma dispersão visual já corrigida em outras páginas nesta sessão.

Antes de tocar em qualquer coisa, li o `service-cart-v22-5.js` inteiro: ele só depende de `.service-btn[data-name/data-price/data-time]` existir em algum lugar do DOM (delegação de evento via `closest('.service-btn')`) e de `#service-items`/`#service-total`/`#open-service-cart` etc. no painel do carrinho (não tocado). A estrutura do card em si — `.service-content`, `.service-top`, `.service-tag`, `.service-meta` — é 100% presentacional, sem nenhum hook de JS. Isso liberou reestruturar o HTML com segurança.

Mudança: cada serviço virou uma linha (nome + tag pequena + descrição em até 2 linhas à esquerda, duração + preço em Bebas Neue + botão "Adicionar" à direita), igual à gramática de `servicos.html`. `.service-meta` e `.service-btn` saíram de dentro de `.service-content` pra serem irmãos de `.service-card` (vira um flex row de 3 itens em vez de uma pilha vertical). Todos os 30 `data-name`/`data-price`/`data-time` foram conferidos char-a-char contra o original antes de publicar — a regra das famílias (`service-rules.js`) e o `?servico=slug` dependem do nome bater exato.

Dois efeitos colaterais que só apareceram ao testar, e por que cada um foi corrigido na fonte em vez de contornado:
- **`#bdj-services-visibility-guard`** (guarda de v28.0.11 contra o catálogo sumir ao abrir por hash) tinha `.service-grid{display:grid !important}` — hardcoded pro layout antigo. Como troquei pra `display:block`, essa regra `!important` vencia a minha silenciosamente (2 cards continuavam lado a lado). Corrigido o valor hardcoded pra `block`, não adicionado outro `!important` por cima.
- O script de auto-reparo do `<link id="bdj-main-style">` (detecta se `/style.css` falhou ao carregar) testava `getComputedStyle('.service-card').borderRadius==='0px'` como sinal de falha — meu redesenho *legitimamente* zera esse border-radius, o que faria o teste disparar sempre e recarregar o CSS à toa em toda visita. Troquei o probe pra `background-color` de `.service-btn` (transparente só no estado "crítico", antes do CSS completo carregar) e mantive esse contrato coerente também no `#bdj-critical-style` (CSS inline de anti-flash).

O restante do CSS de card antigo (`css/02-site-interactions.css`) tem seletores como `.service-grid:not(.compact-services) .service-card{min-height:430px}` com mais especificidade que um `.service-card` simples — por isso o bloco `<style>` novo, escopado só a esta página, usa `!important` nas propriedades de layout. Nada de shared CSS foi tocado, então não houve bump de `?v=` desta vez.

`npm run test:unit` (32) e os e2e de `cart.spec.js` (6 — inclusive pré-seleção por `?servico=` com acento e o teste de não duplicar ao recarregar), `analytics.spec.js`, `routes.spec.js` e `booking-review.spec.js` (14) passaram antes de publicar.

## 29.112.0 — O mesmo rebalanceamento, mas em toda a home (e produtos.html)

Correção direta em cima da v29.111.0, que fechei cedo demais. Ajustei só `.hero h1`, mas `.section h2` — usado nos outros 16 títulos de seção da home ("Garantias e mimos de cliente.", "Olá, eu sou Juliano.", "O que nossos clientes dizem." etc.) — continuou na regra antiga, `clamp(2.7rem,9vw,6.8rem)`, chegando a 108px pra frases inteiras. O Juliano mandou print de "Garantias e mimos de cliente." pra mostrar que o problema não era só a hero: "você precisa criar este padrão e aplicar a todas as páginas do site."

Unifiquei `.hero h1` e `.section h2` de volta numa regra só (`clamp(2rem,5.5vw,4.2rem)`, os mesmos 32px–67px da v29.111.0) — não faz mais sentido ter duas regras quando o padrão é o mesmo. Apliquei o valor idêntico em `.products-hero h1` (usado só em `produtos.html`, antes ainda maior: `clamp(3rem,10vw,7rem)`). Conferi que não sobrava mais nenhum outro título de marketing nessa escala — o resto dos usos de Bebas Neue no CSS é painel administrativo e fluxo de agenda (`.agenda-summary h2`, `.admin-page-header h1`, `.booking-step-heading h2` etc.), já modestos, não faz parte do problema.

Como voltei a mexer em `css/01-site-base.css` e `css/03-site-mobile-contato.css` (o `width:auto!important` do iOS da v29.110.0 continua igual, só o arquivo já tinha sido tocado), bumpei `?v=` de novo: `29.111.0` no `@import` de style.css e nas 79 páginas rastreadas que carregam `/style.css`, mais os `<link rel="preload">` de `css/01` e `css/03` em `index.html` que a v29.110.0/111.0 tinham deixado passar (só o de `css/04` tinha sido sincronizado até agora).

Conferido visualmente (local) na home inteira, rolando por todas as 16 seções, e em `produtos.html`. `npm run test:unit` (32) e os e2e de `analytics.spec.js` e `routes.spec.js` (13) passaram antes de publicar.

## 29.111.0 — Hero da home: logo x título rebalanceados

Segundo round direto em cima da v29.110.0. Depois de corrigir o tamanho da logo, o Juliano mandou novo print: agora ela "ficou pequena e as letras gigantes, não está estético nem harmônico". Ele tinha razão — o `<h1>` da hero e os `<h2>` de seção dividiam a mesma regra (`.hero h1,.section h2{font-size:clamp(2.7rem,9vw,6.8rem)}`), então o título podia chegar a 108px, quase do tamanho do card da logo (760px de largura, ~268px de altura) sentado bem acima dele — dois elementos gritando no mesmo peso visual, sem hierarquia.

Perguntei o tamanho do ajuste antes de mexer (só a hero da home, um cabeçalho padrão pro site inteiro, ou os dois) — ele confirmou só a hero por agora. Feito:

- `.hero h1` separado de `.section h2` (que fica como estava — é usado mais abaixo na página, em "Sobre", e não tinha reclamação ali). Novo clamp: `clamp(2rem,5.5vw,4.2rem)` — de 32px a 67px, contra os 43px–108px de antes.
- `.logo-frame` voltou de `min(640px,92vw)` pra `min(760px,92vw)` — o valor original do "Ajustes v2", antes de qualquer escalada. Com o título mais contido, a logo pode respirar sem tomar a tela inteira de novo.

Resultado: a logo volta a ser a âncora visual (é ela que carrega "BARBEARIA DO JU"), e o título funciona como linha de apoio, não como segundo grito. Conferido visualmente em 1280px, 900px e mobile (375px) antes de publicar. `npm run test:unit` (32) e os e2e de `analytics.spec.js` e `routes.spec.js` (13) passaram.

Repaginação de cabeçalho padrão pro resto do site (servicos, blog, admin — hoje sem header nenhum) fica pra quando o Juliano pedir; não é o mesmo problema e é bem mais trabalho.

## 29.110.0 — Logo nova em alta resolução, e cinco versões de CSS "aumenta o logo" removidas

O Juliano mandou print da home: a logo "consome quase que a tela inteira" e "parece que não tem muita qualidade". Foram duas causas diferentes, e as duas precisavam ser corrigidas.

**Causa 1 — a imagem de origem.** `assets/logo-topo-wide.jpg/webp` vinha de um arquivo de 1600×688, provavelmente já reamostrado uma vez antes de chegar no repo. Substituído pelo arquivo novo que o Juliano forneceu (`barbearia-do-ju-logo-fundo-transparente.png`, 2528×877, com canal alfa real — 50% dos pixels são transparentes de propósito, é a arte recortada rente aos pôsteres/letreiro, sem sobra). Reprocessado com `sharp` (instalado à parte, fora deste repo, só para gerar os arquivos — não é dependência do site) em:
- `assets/logo-topo-wide.jpg` (1200px, fundo real do site #0b0b0b) e `.webp` (1200px, alfa mantido) — home, avaliacao.html, instagram.html, whatsapp.html.
- `assets/marca-selo-transparente.png` (600px, alfa) — precos/index.html, precos/setembro/index.html, home.
- `assets/icon-192.png`, `icon-512.png`, `apple-touch-icon-180.png`, `vcard-logo-contact.jpg` — a arte inteira centralizada num canvas quadrado na cor de fundo do site, nunca cortando os pôsteres (era esse recorte quadrado cru, sem letterbox, que cortava o pôster em algumas páginas — o segundo problema que o Juliano apontou).
- `logo.webp` nos três repositórios separados (wifi-barbearia-do-ju, pix-barbearia-do-ju, contato), substituindo um placeholder de 1536×1024 sem relação com a marca real.

Tamanho final por arquivo ficou igual ou menor que o antigo em quase todos os casos (ex.: `marca-selo-transparente.png` caiu de 361KB pra 61KB; os três `logo.png` de ~1MB cada viraram `logo.webp` de 72KB) — a exceção é `logo-topo-wide.webp`, que foi de 42KB pra 101KB por manter o canal alfa de uma arte com textura fina (bigode, poste), compensado por continuar leve o bastante pro hero.

**Causa 2 — cinco camadas de CSS competindo.** `css/01-site-base.css` tinha blocos "Ajustes v2" a "v6", cada um regravando `.logo-frame`/`.logo`/`.hero-content` com `!important`, sempre aumentando (620px → 860px → 1080px → 1180px → `min(1240px,97vw)`, e no mobile `100vw` liso). Nenhum desses blocos nunca tinha sido removido — só empilhado por cima do anterior, e como todos usavam `!important`, o último declarado (v6) sempre vencia. Removidas as cinco camadas, mantendo intactas as outras regras que dividiam o mesmo bloco (`.product-card`, `.link-card`, `.about-section`, `.info-card` etc. — nada disso mudou). `css/03-site-mobile-contato.css` tinha ainda uma sexta regra, incondicional (fora de media query): `.logo-frame{width:100% !important}`, um fix de centralização no iOS que também forçava o card a ocupar toda a largura do container pai. Trocado para `width:auto !important`, mantendo o `display:block` + `margin:auto` que faz a centralização real funcionar no iOS — `max-width` (não mais disputado por ninguém) agora é quem decide o tamanho.

Resultado: `.logo-frame` cabe em `min(640px, 92vw)`, do tamanho que já era no "Ajustes v2" original, antes da escalada.

`npm run test:unit` (32) e os e2e de `analytics.spec.js` e `routes.spec.js` (13) passaram antes de publicar. Conferido visualmente (local, antes do build) em desktop e mobile: home, `/precos/`, `avaliacao.html`, `whatsapp.html`, `salvar-contato.html` (foto do vCard, formato circular) e os três repositórios separados.

## 29.109.0 — whatsapp.html, instagram.html e salvar-contato.html no mesmo padrão visual

Continuação do pedido do Juliano na v29.107.0/108.0: depois de acertar `servicos.html`, ele pediu pra padronizar "as outras páginas soltas" pra parecer o mesmo site. Primeira leva: as três páginas de redirecionamento rápido do repo principal (WhatsApp, Instagram, Salvar contato) — hoje usadas em QR code/link direto, sem indexação (`noindex`).

Nenhuma delas carregava a fonte Bebas Neue (a família de título usada em toda a home, `servicos.html`, `/precos/`), então o `<h1>`/`<h2>` caía no Inter padrão — e por isso destoavam do resto do site mesmo já usando as mesmas cores (`--gold`, `--panel`, `--line`). Corrigido:

- Adicionado o link da fonte Bebas Neue (mesmo `<link>` que `servicos.html` já usa) nas três páginas.
- `whatsapp.html` e `instagram.html`: título passou a usar Bebas Neue, e ganhou o `<p class="eyebrow">Barbearia do Ju • Bragança Paulista</p>` acima dele — mesmo padrão de `servicos.html`/`/precos/` (a classe `.eyebrow` já existe em `css/01-site-base.css`, nada novo).
- `salvar-contato.html`: o `<style>` da própria página tinha `.panel h2{font-family:inherit}`, uma decisão explícita de NÃO usar Bebas Neue — revertido pra usar, já que a fonte nunca chegou a ser carregada nessa página (o `inherit` caía no Inter de qualquer forma).
- Emoji tirado dos botões (`💬 Abrir WhatsApp` → `Abrir WhatsApp`, `📸 Instagram` → `Ver no Instagram`) pra bater com o padrão dos outros CTAs do site (`Agendar meu horário`, `Falar no WhatsApp`), que são só texto.

Layout de card arredondado mantido como estava — é o mesmo padrão usado em `.panel`/`.link-card`/`.mini-grid` na home, não precisa mudar. `npm run test:unit` (32) passou antes de publicar; não há teste e2e cobrindo essas três páginas.

## 29.108.0 — Links de conteúdo sem estilo, e sequência de servicos.html

O Juliano voltou depois de ver a v29.107.0 no ar: "o resto ficou ótimo", mas o link inline dentro do parágrafo ("corte masculino em Bragança Paulista") aparecia azul e sublinhado — o estilo padrão do navegador, feio e fora do padrão do site. Fui atrás da causa: **nenhuma regra de CSS estilizava `<a>` dentro de texto corrido em lugar nenhum do site.** `.text-link` (dourado, negrito, sem sublinhado) existe e é usado em botões/CTAs isolados, mas link no meio de parágrafo — usado em `servicos.html` e em toda página que usa o template `.privacy-card` (as ~23 páginas de serviço, os 15 posts de blog, perguntas-frequentes, sobre-o-juliano, privacidade) — sempre caiu no azul/sublinhado padrão do navegador porque não havia seletor nenhum pra ele.

Corrigido na fonte, uma vez só: `.privacy-card p a, .privacy-card li a, .privacy-card details a` em `css/04-agenda-admin-core.css`, dourado (`--gold2`), negrito, sem sublinhado em repouso, sublinhado só no hover. Os links de nome de serviço em `servicos.html` (`.price-item .nome a`) passaram a usar exatamente a mesma cor por padrão (antes só ficavam dourados no hover) — agora um padrão único, não dois parecidos.

Como isso mexe em CSS compartilhado, bumpei `?v=` em style.css (import do css/04) **e em toda página que carrega style.css** — 79 arquivos rastreados pelo git (`git ls-files`), 81 ocorrências. Descartei de propósito os ~130 arquivos "style.css?v=..." que o grep bruto encontrava no disco: são cópias antigas soltas na pasta (o próprio CLAUDE.md avisa sobre isso), não fazem parte do site publicado. Sincronizei também o `<link rel="preload">` de `css/04` em `index.html`, que estava preso numa versão (28.43.2) desde antes desta mudança.

**Sequência de `servicos.html` reordenada**, a pedido: "Barba e barba na navalha com toalha quente" agora vem logo depois de "Cortes masculinos" (antes vinha depois de "Combos de corte e barba") — barba é o que mais sai, junto do corte, então sobe pro segundo lugar. Mesma lógica de agrupamento da `/precos/`, mantendo os parágrafos de cada seção como estavam.

`npm run test:unit` (32) e os e2e de `analytics.spec.js`, `cart.spec.js` e `routes.spec.js` (19) passaram antes de publicar.

## 29.107.0 — Serviços com o visual da tabela de preços

O Juliano pediu para usar a página `/precos/` (a plaquinha impressa, com tipografia Bebas Neue e linhas de item enxutas) como modelo visual e trazer isso pra `servicos.html`. Antes, cada serviço aparecia como item de lista com "— R$ X,00 · cerca de Y min" em texto corrido; agora é uma linha de tabela — nome e duração à esquerda, preço grande em dourado à direita, separadas por um traço fino — igual à plaquinha.

Escopo deliberadamente pequeno: só o CSS da própria página mudou (bloco `<style>` isolado em `servicos.html`, no mesmo padrão que `/vale-presente/` já usa), nada em `css/01-05` nem em `style.css`. Preço, duração, texto, links internos, FAQ, schema JSON-LD e author box continuam exatamente como estavam.

Essa mudança foi feita em cima da v29.106.0 (depois do rename de Barboterapia e da troca de URL) — a primeira tentativa tinha sido feita antes desses commits chegarem ao remoto; o push foi rejeitado (fast-forward), o commit antigo foi descartado localmente sem nunca ir ao ar, e a transformação foi refeita sobre o conteúdo já renomeado, então não há regressão de nome nem link. `npm run test:unit` (32) e os e2e de `analytics.spec.js`, `cart.spec.js` e `routes.spec.js` (19) passaram antes de publicar.

Próximas páginas a receber o mesmo tratamento ficam para quando o Juliano pedir — não vale generalizar pro resto do site sem ele apontar qual.

## 29.106.0 — Troca de URL: "barboterapia.html" volta a ser a página do ozônio

Continuação direta da v29.105.0. O Juliano perguntou se não valia a pena mudar a URL de
`servico-barboterapia.html` pra refletir o rename (ele acredita que "barba na navalha" tem
busca própria no Google). Resposta inicial: não mexer, pra não perder o histórico de indexação
de uma URL que já existe. Ele então sugeriu a saída melhor: em vez de mandar a URL antiga pro
nome novo, **trocar o conteúdo dela pelo que agora se chama Barboterapia de verdade** (a versão
com ozônio) — assim a URL com mais tempo de indexação fica presa à palavra que ela sempre
rankeou, e só o serviço novo (sem ozônio) ganha um endereço novo, sem nenhum histórico pra
perder.

Feito:
- `servico-barboterapia.html` (URL preservada) agora serve o conteúdo da Barboterapia com
  vaporizador de ozônio — título, meta, Open Graph, JSON-LD e corpo todos trocados.
- `servico-barba-na-navalha.html` (URL nova) é a página da Barba na navalha com toalha quente
  — o conteúdo que antes vivia em `servico-barboterapia.html`.
- `servico-barboterapia-ozonio.html` virou uma página de redirect (mesmo padrão já usado em
  `agendar.html`: `meta refresh` + `canonical` + `window.location.replace`, com
  `noindex,follow` pra passar autoridade sem competir no índice) apontando pra
  `servico-barboterapia.html`.
- `sitemap.xml`: removida a entrada da URL antiga do ozônio, adicionada a URL nova da navalha.
- Atualizados os ~13 links internos que apontavam pra uma das duas páginas (alguns arquivos,
  como `guia-barba-masculina.html` e `servicos.html`, linkam pras duas — cada href foi
  conferido individualmente pra apontar pro serviço certo, não só trocado por busca-e-substitui
  cega, que na primeira tentativa aqui mesmo grudou os dois links no mesmo destino por engano
  — revertido via `git checkout` e refeito com substituição exata por trecho).

Testado: `npm test` (32 unit + 46 e2e) passando. Verificado ao vivo depois do deploy: título de
`servico-barboterapia.html` mostra o conteúdo do ozônio, `servico-barba-na-navalha.html` mostra
o conteúdo sem ozônio, e o redirect da URL antiga do ozônio funciona.

## 29.105.0 — Rename de "Barboterapia" completo no site público (marketing/SEO)

Continuação direta da v29.104.0. Naquela versão o rename "Barboterapia" (R$ 40, sem ozônio) →
"Barba na navalha com toalha quente" tinha ficado restrito à JuIA e ao catálogo (Supabase +
`services-catalog-v7.js`) — decisão registrada no CHANGELOG anterior como fora de escopo por
ser mudança de marketing/SEO, não bug de IA, contrariando a nota da seção 5 do `CLAUDE.md`
("não reduzir as menções de barboterapia na home"). Pedido explícito do Juliano depois: alinhar
todo o site público também. "Barboterapia" (sozinha) fica reservada só pra versão com
vaporizador de ozônio; a de R$ 40 é "Barba na navalha com toalha quente" em todo lugar.

**Achado crítico durante a varredura:** `agendar/index.html` (a página real de agendamento)
tinha os nomes de serviço **fixos no HTML** (`data-name="Barboterapia"`,
`data-name="Corte + Barboterapia"`), uma terceira cópia do catálogo além do Supabase e do
`services-catalog-v7.js` que a v29.104.0 não sabia que existia. Sem corrigir isso, o botão
"Adicionar" continuaria mandando um nome de serviço que não existe mais no banco — teria
quebrado agendamento de verdade pelo site. Mesma causa quebrou `vale-presente-v29.js`: os
pacotes prontos "Vale Barboterapia" e "Vale Corte + Barboterapia" faziam `catalog.find(s =>
s.name === n)` pelo nome antigo — sem o fix, o vale ficava com a lista de serviços vazia, em
silêncio (o `.filter(Boolean)` engolia o `undefined`).

Atualizado: home, `/agendar/`, `/servicos.html`, `/precos/` (as duas versões, atual e a de
outubro), `/perguntas-frequentes.html`, os guias de barba, o post de blog dedicado
(`blog-barboterapia.html` — virou sobre a versão sem ozônio, com link pra Barboterapia como
upgrade) e as ~15 páginas que só citavam o serviço de passagem. Em cada página: título, meta
description, Open Graph, Twitter Card, JSON-LD (`Service`/`FAQPage`/`Article`/`ItemList`,
inclusive `breadcrumb`), H1/H2, texto corrido e o link de agendamento (`?servico=` — a
slugificação em `service-cart-v22-5.js` já lida com o nome novo automaticamente, ela normaliza
por `data-name`, não por uma lista fixa).

**Decisão de escopo, de novo:** URLs não mudam (`servico-barboterapia.html` continua sendo a
página da versão sem ozônio) — mesma lógica já registrada no `CLAUDE.md` contra migrar URLs do
blog. Só o nome visível muda.

**Capitalização:** primeira tentativa usou "Barba na Navalha com Toalha Quente" (inicial
maiúscula em cada palavra) em títulos e H1 — inconsistente com o nome exato do catálogo
("Barba na navalha com toalha quente", só a primeira letra) e com a voz editorial do resto do
site (nenhum outro título usa Title Case). Corrigido com normalização em massa antes de
publicar — pegou também um teste que ia quebrar por causa da comparação de texto.

Testado: `npm test` (32 unit + 46 e2e) passando. `tests/e2e/cart.spec.js` atualizado pra usar
`?servico=barba-na-navalha-com-toalha-quente` (o slug antigo `barboterapia` não bate mais com
nenhum serviço, de propósito — é assim que a desambiguação funciona).

## 29.104.0 — Identidade da JuIA, nome duplicado, Barboterapia renomeada e confirmação falsa

Quatro correções do Juliano em cima de conversas reais de hoje (WhatsApp).

**"Com quem eu falo?" recebia "Você fala com a equipe da Barbearia do Ju"** — frio e impessoal (caso Alex, 01/09/2026). Agora, quando o cliente pergunta diretamente quem está respondendo ou se é uma pessoa/IA, a JuIA se identifica com honestidade: "Aqui é a Juia, assistente virtual da Barbearia do Ju." Fora desse caso pontual, ela continua sem anunciar por conta própria que é uma IA — não muda a regra de tom/emoji da v29.102.0, só cobre a pergunta direta.

**Nome do cliente duplicado na saudação** (caso Juliano, 01/09/2026, 12h47): "Boa Tarde Ju" recebeu "Boa tarde, Juliano! Juliano! Como posso ajudar?". A regra da v29.64.0 (caso Helder) já cortava o nome quando o modelo abria a resposta com "Nome, ..." (vírgula), mas não cobria "Nome! ..." (exclamação), que foi como o modelo pontuou dessa vez. A regex agora cobre vírgula, ponto ou exclamação depois do nome.

**Barboterapia virou dois nomes.** A pedido do Juliano, o serviço de R$ 40 (navalha e toalha quente, sem ozônio) passou a se chamar **"Barba na navalha com toalha quente"**; "Barboterapia" (bare) deixou de existir como nome próprio — o que continua com esse nome completo é só a versão com ozônio, "Barboterapia com vaporizador de ozônio" (R$ 50), que não foi tocada. Atualizado em: `services` e o combo correspondente no Supabase, `services-catalog-v7.js`, as listas de família de serviço (`service-rules.ts`/`.js`, cópia dupla de propósito), o prompt da JuIA e os dois lugares com nome de serviço fixo no código (menu "mais procurados" e o mapa de palavras-chave de "adicionar ao meu agendamento"). Site público (páginas de serviço, blog, preços) **não foi alterado** — ver nota abaixo.

Isso abriu um buraco novo: cliente que digitasse só "barboterapia" (sem dizer se queria ozônio) caía no find* solto, que casava pelo nome mais curto e escolhia a de R$ 40 **em silêncio**, sem perguntar. Resolvido com o mesmo padrão do `bareBarbaAsk` (pergunta "barba" isolada → lista as 3 opções), só que encurtado pra 2: quem diz "barboterapia" já descartou a Express, então a JuIA pergunta só "com vaporizador de ozônio ou sem?".

**Confirmação falsa e agendamento fantasma** (caso José Reis Imóveis, 01/09/2026, 12h59–14h37): depois de a JuIA listar as 3 opções de barba, o cliente perguntou só "Seria qual valor?" — e ela respondeu "Perfeito! Anotei Corte + Barba Express. Para qual dia?", travando um serviço que ele nunca tinha escolhido. Minutos depois, ela chegou a dizer "você já tem um agendamento para hoje às 16:15 (Corte + Barboterapia)" — agendamento que nunca tinha sido fechado, só uma disponibilidade citada antes. O Juliano teve que entrar na conversa na mão pra desfazer os dois. Duas instruções novas no prompt: uma pergunta de valor depois de uma lista de opções não é escolha (não preenche `updates.services` com nenhuma delas), e "já tem um agendamento" só pode ser dito se o registro aparecer de fato em `upcomingBookings`.

**O que ficou de fora, de propósito:** as páginas de marketing/SEO que usam "Barboterapia" como nome do serviço de R$ 40 (`servico-barboterapia.html`, `blog-barboterapia.html`, `/precos/`, menções na home) não foram renomeadas. A regra da seção 5 do `CLAUDE.md` — "não reduzir as menções de barboterapia na home" — é sobre exatamente essa palavra-chave de SEO, e um rename de conteúdo público é uma decisão maior (URLs, título de página, todo o texto ao redor) que cabe ao Juliano decidir separadamente, não uma correção de bug da JuIA. Por ora o nome muda só no que a JuIA fala e no fluxo de agendamento (Supabase + `services-catalog-v7.js`); o site público continua chamando o serviço de R$ 40 de "Barboterapia".

Testado: `npm run test:unit` (32 testes) e `npm run test:e2e` (46 testes) passando depois da mudança, incluindo o teste de `?servico=barboterapia` no carrinho. `service-rules.spec.js` também foi atualizado pra usar os nomes novos como fixture.

## 29.103.0 — Pergunta de explicação não vira pergunta de agenda, e a trava do ju-ia-site voltou

Continuação direta da v29.102.0. Testando aquela versão apareceu um buraco que ninguém tinha visto: **o cliente perguntava o que É um serviço e recebia uma pergunta de agenda de volta.**

```
cliente: o que é a barba express?
JuIA:    Perfeito! Anotei Barba Express. Para qual dia você quer ver os horários?
```

Nenhuma palavra de resposta. A causa: o modelo devolvia `intent: services` com o serviço reconhecido, e o código assumia que quem cita serviço quer marcar. A trava de preço da v29.54.0 (`isPriceOrInfoQuestion`) cobria "quanto custa" e "quanto dura", mas não cobria "o que é", "como funciona", "qual a diferença", "vale a pena", "pra que serve", "nunca fiz" — que é exatamente onde o argumento de venda de cada serviço deveria aparecer, e onde a venda se ganha ou se perde. Agora essas perguntas viram `faq`: a resposta do modelo passa inteira, com o benefício do serviço, e só depois vem o convite pro horário. Pergunta de agenda ("como funciona o agendamento?", "o que tem de horário?") continua no fluxo normal, de propósito.

Testado com 35 perguntas simuladas, uma por serviço do catálogo mais as de comparação. Três defeitos apareceram e foram corrigidos junto:

- **"o que é pigmentação de barba?"** recebia a lista das três barbas. O gatilho de "qual barba você prefere?" casava a palavra *barba* dentro do nome de um serviço específico — o mesmo valia para quem escrevesse "quero pigmentação de barba". Agora serviço específico com "barba" no nome não dispara a pergunta genérica.
- **"qual a diferença entre barboterapia e barba express?"** vinha com o aviso "tirei Barba Express pra você não pagar em dobro". Comparar não é comprar: a regra das famílias não roda em pergunta de explicação.
- **"o que é a fidelidade?"** e **"o que é o clube do ju?"** recebiam "Para consultar sua fidelidade, informe seu WhatsApp com DDD" — pedido de dado no lugar da resposta. Agora explica a regra real (1 ponto por corte concluído, 10 pontos = 1 corte por nossa conta, sem cartão de papel e sem custo) e só então oferece consultar o saldo. O texto diz "hoje o que temos é o cartão fidelidade" de propósito: a assinatura ainda não está no ar e a JuIA não pode confirmar um produto que não existe.

**Sobre a saudação**, que o Juliano perguntou: é "Bom dia/Boa tarde/Boa noite" pelo relógio de Brasília, não pelo que o cliente escreveu — quem manda "boa tarde" às 10h recebe "Bom dia", que é o certo. Corte às 12h e às 18h.

**A divergência do `verify_jwt` foi resolvida.** O `supabase/config.toml` pedia `verify_jwt = true` para o `ju-ia-site` e a produção estava com `false` desde o primeiro deploy pela CLI (v28.56.1). Na v29.102.0 eu preservei o estado de cada function e deixei anotado; agora foi verificado e ligado. O que faltava saber era se o widget do site continuaria funcionando, já que ele manda só o header `apikey` — e a resposta é sim: o gateway aceita a chave publicável nesse header. Provado com três testes antes e depois:

- site (só `apikey`) → **200**, resposta normal;
- sem chave nenhuma → **401** (antes, qualquer um chamava o cérebro da JuIA);
- function chamando function com `Authorization: Bearer SERVICE_ROLE` → **200**, que é o caminho do WhatsApp a cada mensagem de cliente. Esse último foi medido de verdade, com uma function temporária publicada só para o teste e apagada em seguida (`jwt-selfcheck`) — não valia deduzir num canal que é a porta de entrada da barbearia.

Também entrou a limpeza de espaço antes de `)` no filtro de emoji: sem ela sobrava "não pagar em dobro )" onde havia uma piscadinha.

## 29.102.0 — Sem emoji, e a Barba Express não tem navalha

Três correções do Juliano em cima de conversas reais de hoje de manhã.

**"Bom dia" recebia uma frase seca.** Ele mandou "bom dia" pelo WhatsApp e levou "Como posso ajudar você?" — sem nem devolver o bom dia. Duas coisas somadas: a saudação que o modelo escreve é apagada de propósito (a v28.62.0 tirou porque saía duplicada), e o prefixo determinístico "Bom dia, Fulano!" só era colado na PRIMEIRA mensagem da conversa. Como aquela conversa já tinha uma mensagem anterior (um convite de grupo que caiu ali às 06h02), não era a primeira — e o cliente ficou sem saudação nenhuma. Agora saudação isolada tem resposta própria, calorosa, e o prefixo com o horário do dia + nome vale sempre que o cliente cumprimenta: *"Bom dia, José! Espero que esteja tudo bem com você! Como posso te ajudar hoje?"*.

**Ela vendeu um serviço que não existe.** Na conversa do cliente José Reis Imóveis, 10h26: *"Inclui o corte estilo americano e a barba alinhada com acabamento na navalha"* — para uma **Barba Express**, que é feita SÓ na máquina. Navalha e toalha quente são da Barboterapia. A JuIA não inventou: o argumento de venda cadastrado no banco (migration 097) dizia, com todas as letras, "com navalha no acabamento". O texto errado estava na fonte e ela repetiu — o cliente ia chegar esperando uma coisa e receber outra.

Corrigido em quatro lugares: o `sales_pitch` no banco (migration 133, Barba Express e Corte + Barba Express), a regra fixa no prompt da JuIA (é proibido dizer que a Express tem navalha), a página `servico-barba-express.html` e a home, que também repetiam "acabamento rápido na navalha e máquina". E, atendendo ao pedido dele, toda oferta de barba agora sai com a diferença entre parênteses, o que também tira do modelo a chance de preencher esse vazio sozinho:

```
Pra barba, qual você prefere?
• Barboterapia com vaporizador de ozônio (a mais completa) — R$ 50,00, 40 min
• Barboterapia (navalha e toalha quente) — R$ 40,00, 30 min
• Barba Express (só na máquina) — R$ 25,00, 20 min
```

**Nenhum emoji para cliente.** Regra dele, textual: *"pra JuIA parar de mandar piscadinha pra homem, os caras podem achar estranho até eles entenderem que não sou eu"*. Quem assina o WhatsApp é o Juliano, o cliente não sabe que quem responde é uma IA, e 😉 entre homens é lido como outra coisa. O tom passa a ser formal e cordial, com a simpatia vindo da palavra escrita — nas palavras dele, *"ética não tem sentimento"*. Único emoji permitido: as duas mãos juntas (🙏), e só em agradecimento.

A instrução entrou no prompt, mas a garantia é `supabase/functions/_shared/sem-emoji.ts`: um filtro determinístico aplicado no ponto de SAÍDA de toda mensagem para cliente — a resposta da JuIA e as 17 outras functions que escrevem no WhatsApp (confirmação, lembrete, aniversário, reativação, pesquisa, recibo, fidelidade, vale-presente, Pix). Só instrução no prompt não seguraria (precedente: a saudação duplicada da v28.62.0), e existiam dezenas de emojis escritos à mão nas mensagens fixas do próprio código — caçar um por um deixaria passar os que ainda vão ser escritos. O filtro nunca toca na ENTRADA: as regex que detectam emoji do cliente (👍 de reação, 🤝 de encerramento) continuam vendo o texto original.

Testado em produção depois do deploy, com os cinco casos: saudação isolada, "corte e barba", pergunta de preço do combo (o caso do erro) e "corte e pezinho" — todos sem emoji e com a Barba Express descrita certo.

Uma coisa fica anotada e NÃO foi mexida: `supabase/config.toml` declara `verify_jwt = true` para o `ju-ia-site`, mas em produção ele está `false`. O widget do site manda só o header `apikey`, sem `Authorization` — ligar o JWT agora derrubaria o chat do site. Os deploys desta versão preservaram o estado atual de cada function, um por um. Resolver isso é tarefa separada: primeiro o widget manda o Bearer, depois liga o JWT.

## 29.101.0 — A régua do Juliano: desejar eleva, afirmar invade

Ele mandou duas referências que admira e resumiu a segunda numa frase que virou regra: *"eleva a estima do leitor, pega no coração sem ser invasivo ou antiético"*.

O @filtrodocafe escreve à mão num filtro de papel — o objeto mais banal do próprio ofício — e fotografa segurando na mão, no corredor real: *"a felicidade é o melhor filtro que existe"*. O Canal do Mensageiro publica *"Que seu domingo seja tão incrível quanto você!"*.

As duas parecem coisas diferentes, mas têm a mesma regra por baixo, e é ela que separa o que ele aprova do que reprovou hoje de manhã: **é o modo verbal**. *Afirmar* sobre a vida de quem lê invade ("eu sei que você fingiu que estava tudo bem"). *Desejar* acolhe e ainda eleva ("que seu domingo…"). *Falar do mundo* também acolhe, porque o sujeito não é o leitor ("pressa nunca fez corte bom").

O LIMITE DE INTIMIDADE da v29.100.0 era só a metade proibitiva. Agora ele diz também o que FAZER: todo texto tem que estar em um de dois caminhos — desejar, ou falar do mundo/do lado de cá da cadeira — e termina com um teste explícito ("o texto afirma alguma coisa sobre a vida, o cansaço ou o sentimento de quem lê?"). Vale todos os dias, e entra por último no prompt.

Junto nasceu a série **Recado de Domingo**: frase escrita à mão na gola de papel, fotografada pelo Juliano na barbearia, com as 12 primeiras frases prontas e o guia de foto. Quando entrar no ar, o domingo deixa de ser gerado por IA e passa a usar foto real — que é a resposta definitiva para "a arte parece sempre a mesma".

## 29.100.0 — Crivo do Juliano: frase invasiva e "a arte parece sempre a mesma"

Reprovação dele sobre o post de domingo 30/08: *"não gostei da frase, achei meio invasiva, sem contar a arte genérica que parece sempre a mesma arte mesmo não sendo."* Os dois problemas eram reais, e nenhum era azar do gerador — os dois estavam escritos no prompt.

**A frase.** O texto saiu assim: *"Eu sei que teve manhã em que você saiu antes do sol e noite em que fingiu que estava tudo bem."* A barbearia afirmando saber o que o cliente sente e esconde. O modelo não inventou: o ângulo de domingo mandava "reconheça o que ninguém viu: acordar cedo, resolver o que não aparece, aguentar calado", e dava um exemplo em segunda pessoa afirmando a vida do leitor. Ele seguiu a instrução e escalou para o íntimo.

Agora existe um LIMITE DE INTIMIDADE, que vale todo dia e entra por último no prompt: é proibido afirmar o que o leitor sente, esconde ou viveu na vida privada dele; proibido abrir com "Eu sei que você..."; proibido "fingiu que estava tudo bem", "engoliu o cansaço", "chegou ao limite". No lugar, o texto fala do que o Juliano vê do lado dele da cadeira, ou faz um convite aberto. Reconhecimento sim, diagnóstico não. O ângulo de domingo que causou o caso foi reescrito na mesma direção.

**A arte.** Comparando as peças de 27, 29 e 30/08 lado a lado, ele tem razão: mesma composição, mesmos objetos, mesmo fundo. A causa é que os dois prompts de imagem descreviam UMA receita fechada — navalha, pincel, frasco âmbar e toalha parados numa bancada, fundo de tijolo, luz quente lateral, câmera na altura da superfície. Com a receita fechada, todo dia sai a mesma foto com os objetos trocados de lugar; variedade era impossível por construção.

Agora cada dia recebe um ENQUADRAMENTO obrigatório, girando numa lista de seis (macro extremo, vista de cima, plano aberto do ambiente, contra-luz, vertical com vazio, textura como assunto), sorteado pelo número de dias desde 1970 — testado em 60 dias corridos: nenhuma repetição em dias seguidos e as seis formas em uso. A instrução entra por último e vence a composição sugerida acima dela (lição da v29.31.4: o modelo obedece ao que leu por último).

A regra da marca não afrouxou: segue proibido gerar pessoas, rostos, mãos ou silhuetas por IA, e segue proibido texto na imagem.

Os três rascunhos de 30/08 (WhatsApp, Facebook e Instagram) foram reprovados na Central.

## 29.99.0 — O painel abria e só ficava "carregando": loop de recarregamento

Manhã de 30/08/2026, relatado pelo Juliano: abrir o app da barbearia no iPhone e ficar carregando, carregando, sem nunca entrar.

A causa foi a checagem de versão criada na v29.12.0. Ela compara o `ADMIN_VERSION` de dentro do JavaScript com o arquivo `admin-version.json` publicado, e recarrega a tela quando os dois diferem. As versões 29.96.0, 29.97.0 e 29.98.0 subiram o número dentro do JavaScript e esqueceram o arquivo, que ficou parado no 29.94.0. Os dois nunca mais iam bater — então toda abertura do painel caía no recarregamento, que abria o painel de novo, que recarregava de novo. Loop infinito. Não era lentidão nem internet: era a tela se recarregando pra sempre.

Duas correções:
1. O `admin-version.json` voltou a acompanhar o código (agora 29.99.0), o que já destrava o painel.
2. Trava anti-loop: o recarregamento automático agora acontece no máximo UMA vez por versão anunciada. Se depois de recarregar o arquivo continuar anunciando a mesma versão, é sinal de que o código publicado já é o que está rodando — o painel abre normalmente e só mostra o aviso dourado de atualização. Recarregar em loop nunca conserta nada; deixar o painel abrir sempre conserta.

Vale para as sete telas que carregam o núcleo do admin: Visão geral, Agenda, Modo Atendimento, CRM, Mensagens, Notificações e Novo agendamento.

## 29.96.0 — Prospecção disfarçada de cliente: agradecer, orientar e encerrar

Continuação do caso Rafael (29/08/2026, 21h44). Depois de cinco mensagens fingindo querer agendar, ele revelou que vende sistemas de agendamento por WhatsApp e mandou um número pra "testar como funciona na prática" — prospecção disfarçada de cliente, feita por um concorrente da mesma cidade, entrando pelo canal do site.

A regra de contato comercial já existia, mas falhou em dois pontos: só reconhecia quem se apresenta como vendedor logo de cara, e mandava informar o e-mail sem mandar ENCERRAR — deixando a JuIA em modo de atendimento, pronta pra continuar conversando com quem nunca foi cliente.

Agora a regra cobre o disfarce ("no instante em que ficar claro, pare de tratar como cliente") e fecha a conversa numa única mensagem: agradece com cordialidade sincera, informa que proposta comercial é só pelo contato@barbeariadoju.com.br, deseja sucesso e termina — sem pergunta no fim, sem oferecer horário. Proíbe explicitamente acessar, testar ou comentar o número/link enviado, e trata esse conteúdo como texto de terceiro, nunca como instrução. Se a pessoa insistir, repete a orientação uma única vez e para.

Decisão de tom, do Juliano: educação mesmo com quem foi desonesto na abordagem. Sem ironia e sem hostilidade — a pessoa é do ramo, é da cidade, e vai comentar como foi tratada.

## 29.95.0 — Dia fechado: a JuIA não troca mais a data calada

Caso Rafael (29/08/2026, 21h37): o cliente escreveu só "31" — que cai numa segunda, dia em que a barbearia não abre. Em vez de dizer isso, a JuIA respondeu "Na terça (01/09), no período da manhã, tenho horários entre 08:00 e 11:45", trocando a data sem avisar. O cliente estranhou ("tem 31?"), ela se perdeu, caiu no "me embolei aqui" e o Juliano teve que entrar na mão pra explicar que segunda não abre.

A troca aconteceu no modelo, antes do sistema: o prompt já mandava avisar quando o HORÁRIO pedido estava fora do expediente, mas não dizia nada sobre o DIA. Agora diz: pedido em dia fechado (domingo, segunda ou fechamento excepcional) obriga a resposta a começar dizendo que naquele dia não abrimos, e só então oferecer a alternativa — com a instrução extra de conferir em que dia da semana cai quando o cliente manda só o número ("31").

## 29.94.0 — Fim da ficha duplicada: cliente passa a ser casado pelos últimos 8 dígitos do telefone

O mesmo cliente virava duas fichas quando o telefone era salvo em formatos diferentes (com/sem o 55, com/sem DDD) — e aí o Juliano digitava um nome levemente diferente e ficavam dois cadastros da mesma pessoa, cada um com metade do histórico. A comparação por dígitos exatos era a causa: '11974998541' não "encontrava" '5511974998541'.

Agora a chave é a coluna gerada `customer_profiles.phone_key` (últimos 8 dígitos, nula fora da faixa de 11 a 13 dígitos), com o índice único parcial `uq_customer_profiles_phone_key` garantindo no banco que não exista segunda ficha para a mesma chave. Pontos trocados:
- `ju-ia-site`: as duas buscas que usavam `.or(phone.eq.A, phone.eq.B, phone.eq.55C)` — uma lista de formatos que alguém precisava lembrar de manter — viraram `.eq('phone_key', ...)`; o upsert virou `onConflict: 'phone_key'`.
- `admin-booking-status`: a marca "já avaliou no Google" e a busca do cliente pelo telefone exato passaram pela mesma chave. Antes, telefone em outro formato fazia a marca não colar e o cliente ser convidado a avaliar de novo.
- `admin-v15-4-core.js`: o upsert de sincronização do CRM (que era a fábrica de duplicadas) agora resolve por `phone_key`, e o lote é deduplicado pela MESMA regra do banco através da nova `phoneKeyDb()` — sem isso, duas linhas do mesmo lote colidiriam no índice ("ON CONFLICT DO UPDATE cannot affect row a second time"). A `phoneKey()` antiga (DDD + 8) continua servindo à contagem de visitas.

Cuidado que quase passou: a substituição em massa pegou também um upsert de `conversation_leads`, que não tem `phone_key` — revertido. Conferido: os 155 perfis existentes não têm nenhuma colisão, os erros de type-check são os mesmos de antes em `admin-booking-status` e um a menos em `ju-ia-site`, e as quatro variações do mesmo telefone (salvo, sem 55, com 55, com máscara) casam na mesma ficha.

## 29.93.0 — Atribuição de anúncio: dá pra saber quantos CLIENTES o anúncio trouxe, não só quantas conversas

Antes de ligar o anúncio de clique-para-WhatsApp (R$ 5/dia), a conta não fechava: o Meta informa "X conversas iniciadas" e para aí. Sem ligar o agendamento ao anúncio não existe custo por cliente, só custo por conversa — que é vaidade. Foi exatamente o que faltou pra entender os R$ 219 queimados no anúncio anterior.

`extrairOrigemAnuncio()` lê o bloco que a primeira mensagem carrega quando a pessoa vem de um anúncio (`externalAdReply` / `ctwaContext`), varrendo os caminhos que a Evolution/Baileys usa conforme a versão — inclusive quando essa primeira mensagem é carrinho, figurinha ou áudio, por isso o carimbo roda antes de qualquer outro tratamento. Grava uma vez por telefone+anúncio na tabela nova `whatsapp_ad_clicks`; se a pessoa voltar pelo mesmo anúncio não duplica, e se vier por outro anúncio registra de novo, porque aí é outra origem. Falha na gravação nunca derruba o atendimento (try/catch).

A view `ad_attribution_report` fecha o ciclo: por anúncio, quantas conversas, quantos agendamentos, quantos foram atendidos e quanto faturou — cruzando telefone com `phone_match_key` (o número chega em formatos diferentes) e janela de 30 dias após o clique. Dividindo o gasto por "atendidos" sai o custo por cliente de verdade.

Cuidado deliberado: link comum com preview NÃO conta como clique de anúncio (exige id do anúncio ou ctwa_clid), senão o relatório encheria de falso positivo. Testado com 5 payloads, incluindo esse negativo. `deno check` limpo.

## 29.92.0 — Carrinho do catálogo do WhatsApp deixa de cair no silêncio e vira agendamento

Achado ao responder uma pergunta do Juliano (29/08): "se o cliente compra no catálogo, dá pra integrar na agenda?". Fui ver e o carrinho chega SEM texto (`conversation` e `extendedTextMessage.text` vazios), caía no `if (!text)`, era registrado como "[mídia ou mensagem sem texto]" e a função retornava — **o cliente recebia silêncio absoluto**, nem um "não entendi". O beco disparou 104 vezes no total e 66 nos últimos 30 dias (~2/dia, contando também figurinha, contato e localização), a última no próprio dia 29/08 às 11:52.

Agora `catalogoParaTexto()` lê os dois formatos que a Evolution/Baileys entrega — `productMessage` (item único, com título e preço) e `orderMessage` (carrinho, com contagem e total) — e transforma em texto que a JuIA entende, antes do skip. O prefixo "[pedido pelo catálogo]" mantém o histórico do admin honesto: fica claro que veio do catálogo e não foi digitado pelo cliente. Quando os nomes dos itens não vêm no payload, o texto diz isso e orienta a confirmar com o cliente antes de fechar horário — em vez de inventar o que ele pediu.

Isso fecha o funil que faltava: o cliente chega com o serviço JÁ escolhido e a JuIA só precisa combinar o dia. Vira pré-requisito do anúncio de clique-para-WhatsApp (pagar pra mandar gente pro catálogo com o carrinho mudo seria pagar pra perder o cliente no pico de intenção).

Um `console.log` com tag `catalogo_pedido` grava o payload cru no primeiro carrinho real, pra afinar a leitura com dado de verdade em vez de suposição. Testado com 6 payloads (item único, carrinho com nomes, carrinho só com total, carrinho de 1 item, figurinha e nulo) — os dois últimos seguem corretamente pro caminho antigo. `deno check` limpo.

## 29.91.0 — Agenda: serviços contratados visíveis no card, sem precisar do ✎ Editar

Pedido do Juliano (29/08, print do card do Lucas às 10h): "Corte de cabelo + Barba Express ..." aparecia cortado e nem expandindo o card dava pra ver o que o cliente contratou — só abrindo o Editar. Duas mudanças: (1) o resumo fechado agora mostra até 2 linhas do serviço (line-clamp) em vez de 1 linha com "..."; (2) o card expandido ganhou uma linha dourada "✂ <serviços completos>" acima do telefone, sem truncar nunca. Cache 29.91.0 (agenda+core+style+version.json) nos admin HTMLs.

## 29.88.0 — Concluir sem pagamento: a tela rola sozinha até a forma de pagamento

Sugestão do Juliano (28/08, print do modal): ao clicar "Concluir ✓" sem ter escolhido a forma de pagamento, o aviso aparecia mas ele ainda tinha que caçar a seção no meio do modal. Agora, além do aviso, o modal rola suavemente até "Forma de pagamento" (centralizada na tela) e a grade de botões pisca 2x em dourado — é só escolher e finalizar. Verificação visual com Playwright + mock (antes: rodapé; depois: seção centralizada com o pisca). Cache 29.88.0 (agenda+core+ux+version.json) nos 7 HTMLs.

## 29.86.0 — Caso Walter (28/08 11h40): confirmação de presença não briga mais com remarcação; "sim" solto não reativa cancelado; total a cobrar virou rodapé fixo

O caso, visto ao vivo pelo Juliano: Walter (a 1ª conversão da reativação!) respondeu ao pedido de confirmação de presença com "Consegue mudar para hj as 19:30?" e a cadeia quebrou em três pontos — menu 1/2/3 repetido por cima do pedido, o "3" forçado cancelou, e o "Sim" do encaixe estendido das 19:30 foi engolido pelo bloco de reativação, que ressuscitou o agendamento CANCELADO de amanhã ("Reativei seu horário de dia 29/08/2026 às 11:30"). O Juliano assumiu na mão ("a IA bugou, rsrs") e acertou o sistema.

- **whatsapp-webhook — remarcação dentro da confirmação de presença**: "mudar"/"trocar"/"transferir"/"passar pra" agora contam como remarcar (o regex antigo exigia "mudar horário" literal); e se a mensagem JÁ traz o dia/horário novo, nem responde o texto de orientação — cai direto no fluxo da JuIA, que remarca com o dado que veio. Re-ask do menu nunca mais atropela pedido de remarcação.
- **whatsapp-webhook — interceptador de presença respeita juiaAwaitingAnswer** (regra da v29.17): pego no teste — a JuIA perguntou "remarcar pra hoje às 18:30? Responda sim" e o "Sim" caiu no interceptador, confirmando presença no horário VELHO.
- **whatsapp-webhook — reativação pós-cancelamento só com arrependimento EXPLÍCITO** ("ainda quero", "pode manter", "reativa", "quero de volta") — "sim"/"1"/"confirmo" soltos nunca mais (quase sempre respondem a outra pergunta em aberto). O bloco também respeita juiaAwaitingAnswer, e a mensagem humanizou a data ("amanhã" em vez de "dia 29/08/2026"). Contexto: o cancelamento automático que motivou esse bloco (caso Kelvin) nem existe mais desde a v28.66 — hoje ele só pegava cancelamento escolhido pelo cliente.
- **Teste em produção do ciclo inteiro** (telefone fictício): "Consegue mudar para hj as 18:30?" → proposta de remarcação → "sim" → confirmação → agendamento movido; "Sim" solto após cancelar → NÃO reativa; "pode reativar" → reativa. Dados limpos.
- **Admin — "Total a cobrar" repaginado (feedback do Juliano na v29.84)**: a caixa ficava no meio do modal e sumia da vista ao rolar. Agora total + botão "Concluir atendimento" vivem num RODAPÉ FIXO (sticky) do modal — sempre visíveis enquanto a lista de serviços/produtos rola atrás, como um checkout de verdade. Suíte 26/26 + verificação visual. Cache 29.86.0 (agenda+core) nos 7 HTMLs.

## 29.85.0 — Varredura semanal da JuIA: 3 defeitos corrigidos (áudio no filtro comercial, "não obrigado" reabrindo oferta, bot atropelando o Juliano)

Correções da varredura profunda de sexta 28/08 (semana 22–28/08, ~35 conversas lidas), aprovadas pelo Juliano:

- **ju-ia-site — filtro comercial não pega mais cliente (caso Rodrigo, 27/08 12h34)**: o áudio "tenho uma *maquininha* lá em casa e meu cunhado corta pra mim" caiu na resposta de fornecedor porque o regex da v29.68 tinha `maquininha` pensando em vendedor de maquininha de cartão — numa barbearia, maquininha é máquina de cortar. (1) O termo virou `maquininha de cartao/credito/debito`; (2) cliente CONHECIDO (agendamento futuro ou histórico/last_visit) nunca cai no filtro, por mais que a frase engane.
- **ju-ia-site — recusa se aceita UMA vez (casos 555194446803 e 5511971921610, 22/08)**: "Não, obrigado" depois de uma negativa de agenda fazia o modelo REABRIR a oferta ("consigo te atender em vários horários…"), o cliente recusava de novo e morria no "me embolei" — 2 leads perdidos. Agora dispensa clara (não obrigado / vou deixar / fica pra próxima / deixa pra depois…) = fechamento educado com porta aberta ("Tranquilo! 😊 … é só me chamar por aqui. Até logo! 💈"), estado `dismissed`; segunda dispensa = silêncio (mesma régua da despedida v29.64, que ganhou "vou deixar"/"não obrigado" no regex). Um "não" seco nunca dispara (pode ser resposta de fluxo), pendências `pending_*` têm prioridade, e pedido novo depois da dispensa reabre a conversa normal.
- **whatsapp-webhook — última checagem antes do envio (casos Rodrigo 16h07 e Lucas Bueno 17h13, 27/08)**: o Juliano respondeu na mão enquanto a IA pensava e as duas vozes saíram no MESMO segundo. Agora, imediatamente antes do sendText, mensagem HUMANA na conversa nos últimos 3 minutos = resposta da IA morre em silêncio (o eco fromMe já liga o takeover; isto fecha a janela de corrida do processamento em andamento). Testado em produção: log "resposta da IA descartada: o Juliano respondeu enquanto a IA pensava".
- **whatsapp-reactivation-watchdog — não atropela conversa que é do Juliano (caso Rodrigo, 27/08 13h30)**: ele tinha respondido na mão às 13h07, o cliente mandou áudio às 13h09, e 20 min depois o watchdog devolveu o controle pra JuIA e cochichou o "ainda estou por aqui" com LINK DO SITE por cima da conversa. Agora: mensagem humana nos últimos 90 min = takeover fica como está e nada de cochicho (o push "cliente te escreveu" já avisa).
- **whatsapp-webhook — silêncio de propósito não perdia mais o estado**: resposta vazia com HTTP 200 (despedida repetida da v29.64, segunda dispensa) caía no `return` de "ju-ia-site falhou" ANTES do bloco que salvaria o estado — o silêncio funcionava, mas o estado do turno se perdia. Agora salva e sai em silêncio (verificado: `dismissed=true` persistiu num turno silencioso).
- Testes em produção com telefone fictício (Marcos Teste): maquininha→atendimento normal; "Não, obrigado"→fechamento educado; "Vou deixar, obrigado"→silêncio; corrida com mensagem humana→descarte confirmado no log. Dados de teste limpos.

## 29.84.0 — Conclusão vira checkout: total a cobrar na tela + meio do pagamento online no card (pedidos do Juliano, 28/08)

Dois pedidos da manhã de 28/08, ao ver o primeiro pagamento online real (Pedro, Pix pelo Checkout PagBank):

- **Card da Agenda diz COMO o cliente pagou online**: "✅ Pago online (PagBank · Pix) — automático" (ou cartão de crédito/débito). O webhook já gravava `payments.method` desde a v29.22.0 — só ninguém mostrava. `loadBaseData` agora embute `payments(method,status)` na consulta de bookings (FK existe; RLS de `payments` já permitia admin ler desde a migration 106).
- **"Concluir atendimento" ganhou resumo de checkout**: caixa com Serviços + Produtos e **"Total a cobrar"** em destaque, atualizando ao vivo conforme marca/desmarca serviço, produto ou cortesia — e **descontando o que já foi pago online** ("✅ Já pago online (Pix): R$ 40,00 — descontado do total"; Pix antecipado manual confirmado vale o preço do serviço da reserva). É a orientação na hora de cobrar que faltava.
- **Uma tela só de pagamento**: a seção "Pagamento dos produtos" (caso raro da v28.23.0 — água no débito com corte no Pix) saiu da frente e virou um toggle recolhido "▸ Produtos pagos de outra forma? (raro)", no Concluir e no ✎ Editar. No Editar ela abre já expandida se o registro tem pagamento de produto diferente gravado. Fechar o toggle limpa a seleção (não salva resto invisível).
- Verificação: suíte admin 26/26 + spec visual descartável (mock) confirmando selo "PagBank · Pix", total com desconto do pago online e toggle. Cache `?v=29.84.0` em core+agenda nos 7 HTMLs; ADMIN_VERSION/admin-version.json 29.84.0.

## Reativação de 30 dias — o número de 48h: 0 de 16 (27/08)

Fechamento honesto da estreia da alavanca que o Juliano ligou para atacar a retenção de 16%. **16 convites, zero respostas, zero agendamentos** em 48 horas.

- **Não foi falha técnica, e isso foi verificado**: os 16 envios voltaram com `evolution_message_id` (WhatsApp aceitou todos); no dia do disparo a barbearia recebeu 39 mensagens normais, provando que a entrada funciona; e o cron rodou certo em 25 e 26/08 (`succeeded`), com a leva de 26/08 encontrando zero elegíveis — o cooldown de 40 dias segurando os 16, exatamente como projetado.
- **O padrão que os dados sustentam**: convite FRIO está em **0 de 18** (16 da reativação + 2 do convite manual de volta). No mesmo período, contato com **gancho imediato** — `walkin_turned_away`, cliente que veio e foi embora sem ser atendido — fez **2 de 2**. Rima com o teaser do Clube (15/08): 1.882 contas de alcance, zero comentários. Com 0/18, se a taxa real fosse 15% a chance de dar zero seria ~5% — dá para dizer que ela é baixa, sem fingir precisão que a amostra não tem.
- **NÃO alterei a mensagem.** O texto foi aprovado pelo Juliano e mexer nele é decisão dele, não minha. Fica a hipótese registrada: a mensagem atual faz **pergunta aberta** ("me responde com o dia que fica melhor"), jogando o trabalho pro cliente. O convite de retorno da v29.56.0 já sabe oferecer **amostra de até 4 horários concretos** (nunca o total — regra da v29.51.0, caso Stevan); usar a mesma mecânica na reativação é a primeira coisa a testar antes de concluir que o canal não serve.
- Aprendizado gravado em `marketing_memory` (category `aprendizado`, que não é lido pelo prompt da JuIA — só `campanha` é).

## 29.77.0 — Medição de audiência liberada por padrão; banner passa a decidir só cookies de anúncio (decisão do Juliano, 26/08)

Sequência da 29.76.0: com o gap de rastreio explicado (banner negando tudo por padrão), o Juliano decidiu adotar o padrão comum no Brasil sob LGPD — **`analytics_storage` sempre concedido** (medição agregada de audiência) e o banner decidindo apenas os cookies de ANÚNCIO (`ad_storage`/`ad_user_data`/`ad_personalization`: "Aceitar" concede, "Somente essenciais" nega).

- Default no `<head>` das 55 páginas: `analytics_storage:'granted'` incondicional; ads continuam condicionados ao aceite salvo.
- `privacy-consent-v22-4.js` (`?v=29.77.0`): o update do banner não desliga mais o analytics; texto do banner reescrito para ficar honesto ("Usamos medição de audiência de forma agregada... aceitar também os cookies de anúncios ou continuar apenas com os essenciais").
- Efeito esperado: GA4 volta a enxergar praticamente todas as sessões (inclusive os cliques do Ads de quem ignora o banner) — os números de sessões/conversões devem SUBIR a partir de 26/08 sem que nada tenha mudado no negócio; lembrar disso ao comparar semanas.

## 29.76.0 — O "Aceitar" do banner de cookies era ignorado pelo GTM (achado do gap 145 cliques → 6 sessões)

Investigando por que 145 cliques do Google Ads (19-25/08) viraram só 6 sessões google/cpc no GA4, o teste de ponta a ponta no site publicado mostrou: `clique_agendamento` dispara certo, o GTM manda pro GA4, **mas o hit sai com `gcs=G100` — consentimento negado**. O site tem banner LGPD com padrão negado, e quem não clica "Aceitar" fica invisível pro GA4. Isso é desenho, não bug — MAS havia um bug em cima:

- **`privacy-consent-v22-4.js` empurrava o consent update como Array** (`push(args)` de arrow function com rest). O GTM só reconhece comando de consent num objeto `arguments` de verdade (o padrão do `gtag`). Resultado: **clicar "Aceitar" não mudava nada na página atual** — o consentimento só valia da página seguinte em diante (quando o script do `<head>` relê o localStorage), e todos os eventos da primeira página (inclusive o `clique_agendamento` de quem chegou por anúncio numa página de serviço) se perdiam mesmo para quem aceitou.
- Corrigido com `function gtag(){ dataLayer.push(arguments) }`; cache `?v=29.76.0` bumpado nos 55 HTML que carregam o script.
- **Consequência de leitura de dados**: o GA4 SUBCONTA tudo pela taxa de aceite do banner — as comparações entre origens continuam válidas (o desconto é igual pra todas), mas números absolutos (sessões, conversões) são piso, não teto.
- **Decisão pendente do Juliano**: manter o padrão "negado até aceitar" (mais conservador) ou liberar `analytics_storage` por padrão mantendo ads negado (padrão comum no Brasil sob LGPD, mediria a sessão de quem ignora o banner). Não mexi — é decisão de postura de privacidade, não técnica.

## 29.74.0 — Revisão diária 26/08: resposta obsoleta não sai mais (caso Michele), desistir de remarcar (caso Tiago) e fim do rascunho institucional vago no cron das 8h

Três correções da varredura das conversas de 25/08 + a causa-raiz dos três dias seguidos de rascunho genérico rejeitado no crivo.

**1. whatsapp-webhook — a régua de obsolescência tinha uma janela de ~6s (caso Michele, 25/08 10h37).** Ela mandou "Pode ser as 14:15h" e, 6,3s depois (fora do debounce), "Qual o valor?". A resposta da 1ª mensagem nasceu velha, mas passou no teste de obsolescência porque a régua era `Date.now()` do instante da reivindicação do buffer (~6s depois do carimbo da mensagem) — a 2ª mensagem chegou DENTRO dessa janela e ficou aquém da régua. Resultado: duas respostas simultâneas conflitantes ("quer incluir? 1/2/3" e "quer reservar?"), o "Sim" dela caiu na pergunta errada e ela respondeu "4" às cegas. A régua agora é o `created_at` do BANCO da última mensagem coberta pelo processamento — qualquer mensagem que chegue depois dela descarta a resposta (quem processa a nova responde por todas, como já era o desenho).

**2. ju-ia-site — pergunta de preço no ramo sem oferta (a outra metade do caso Michele).** O `precoAntes` da v29.54.0 só existia no ramo COM oferta numerada; quando a oferta já tinha sido feita (ou não havia o que oferecer), "14:15h + qual o valor?" caía no "Sim, X está disponível... Quer reservar?" e a pergunta do preço morria sem resposta. Agora o valor entra antes da confirmação nos dois ramos.

**3. ju-ia-site — desistir de remarcar mantém o horário (caso Tiago, 25/08 14h24).** Pediu por áudio pra remarcar "pra amanhã" e, 25s depois, mandou outro áudio desistindo ("pode manter hoje mesmo, nem tinha pensado nisso"). Com `pending_reschedule` ativo, o fluxo tratou a desistência como resposta de remarcação e ofereceu os horários de amanhã (o "amanhã" veio do histórico) — o Juliano interveio e quase remarcou sem precisar. Sinal de desistência ("pode manter", "deixa como está", "não precisa mudar", "vou hoje mesmo"...) agora vem ANTES de qualquer etapa: confirma o horário original mantido e limpa o estado da remarcação.

**4. content-generate-daily — três dias seguidos de rascunho institucional vago (22, 25 e 26/08), mesma causa do domingo da v29.31.2.** Os dias úteis (ter–sáb) geravam com esforço baixo, sem revisão de qualidade e com tema abstrato ("a experiência de ser atendido") — e conceito abstrato vira frase de agência ("Seu visual merece o cuidado e a precisão de uma experiência premium"). Três mudanças:
- **`CLICHE_INSTITUCIONAL`** (filtro determinístico, irmão do `CLICHE_VAZIO`): "visual/estilo/corte merece", "experiência premium/única", "cuidado e precisão", "acabamento impecável", "atendimento de excelência" etc. derrubam a legenda pro retry.
- **A revisão de qualidade (`textoRaso` + segunda tentativa em modo exigente) passou a valer TODO dia**, não só domingo/segunda. Dia útil continua barato: primeira tentativa em esforço baixo; só paga a segunda quando cai no filtro.
- **`VOZ_CONCRETA` nos temas de dia útil** (experiência, fidelidade, serviço em destaque, campanha): um fato concreto por post, voz do Juliano em primeira pessoa, proibição explícita de elogio genérico à própria casa e de frase que serviria pra qualquer barbearia.

## 29.73.0 — Migration 132: o botão "Excluir registro" do admin esbarrava em GRANT, não em policy (25/08)

Registro feito a posteriori: o commit da migration subiu sem entrada no CHANGELOG. Resumo a partir do próprio arquivo `132-v29.73.0-grant-delete-bookings.sql`.

- **Sintoma**: "Excluir registro" no admin devolvia *permission denied for table bookings*, mesmo com a policy RLS `admin delete cancelled bookings` (`is_admin()` + `status='cancelled'`) existindo desde sempre.
- **Causa**: o Postgres checa o **GRANT antes da policy** — e o `DELETE` nunca tinha sido concedido a `authenticated` (nem a `service_role`). Policy correta, porta trancada antes dela. É a terceira vez que essa mesma classe de bug aparece (migration 127 em `payments`, migration 130 em `customer_profiles`): **policy escrita não implica grant dado**.
- **De quebra**: revoga `TRUNCATE` de `anon` e `authenticated` — TRUNCATE ignora RLS e ninguém do site ou do admin precisa disso.

## 29.72.0 — Pergunta de horário sem serviço assume o CORTE e já responde com a agenda (caso Bruno, 25/08)

Caso das 11h14 de 25/08 (print do Juliano): cliente NOVO perguntou *"Vocês tem horário livre as 13:00 ou 14:00?"* e a resposta foi *"Qual serviço você tem interesse?"* — ele sumiu, e nem a intervenção manual do Juliano às 11h38 reverteu. Parecidíssimo com o caso Fernando da manhã, mas por outro caminho: a v29.71.0 cobria "quero marcar" sem serviço; quem já chegava com HORA na mão caía no fluxo de disponibilidade, que devolvia a pergunta de serviço.

- **Cliente com hora na mão está pronto pra fechar**: no WhatsApp, pergunta de disponibilidade sem serviço agora **assume Corte de cabelo** (carro-chefe — mesma mecânica transparente do bareCabeloAsk e do "serviço de sempre") e responde JÁ com a disponibilidade real, fechando com a nota *"(Anotei Corte de cabelo — se quiser outro serviço ou incluir a barba, é só me dizer 😉)"*. Hora citada sem dia = hoje. Só WhatsApp (no site o catálogo está na tela) e nunca em pergunta de preço/informação.
- **Prompt alinhado**: o exemplo antigo "Claro! Qual serviço você prefere?" virou "É corte de cabelo? Já confiro esse horário pra você." — o modelo não devolve mais pergunta aberta de serviço quando o cliente já deu o horário.
- **Bug da v29.70.0 achado no teste desta correção**: `primeiroDoDia`/`ultimoDoDia` eram o primeiro/último horário **livre**, não o expediente — com a manhã lotada, "tem 13:00?" numa terça respondia *"às 13:00 ainda estamos fechados, a gente começa a atender 13:30"* (mentira nova no lugar da antiga). A régua agora é o expediente teórico (abre 08:00; último início = fechamento − duração): fora dele valem os textos de fechado/exceção; dentro dele, horário tomado é "reservado" e cai no fluxo dos horários mais próximos. Testado em produção: *"13:00 já está reservado nesse dia. O mais perto que consigo é 13:30 — serve pra você?"*.
- Sem bump de cache: só edge function (`ju-ia-site`).

## 29.71.2 — Reativação: nome em CAIXA ALTA não vai cru pro vocativo (estreia da 1ª leva, 25/08)

Conferência da **primeira leva da reativação de 30 dias**, que era a estreia da automação: **16 mensagens em 42 segundos**, às 14h em ponto, **zero falhas de envio**. A guarda de nome-empresa funcionou (o "Espaço Shanti" saiu como *"Oi! 💈 Aqui é a JuIA…"*, sem vocativo). O único defeito real foi cosmético e entregava o robô: saiu **"Oi, MOISES!"** — o cadastro está em caixa alta e o nome ia cru pro vocativo. São 5 cadastros assim, de 141.

- **Correção**: primeiro nome todo MAIÚSCULO (ou todo minúsculo) vira Capitalizado antes de entrar no vocativo; nome já bem escrito ("Vinícius", "McCarthy") fica intocado. Acento sobrevive: `ROGÉRIO` → `Rogério`. Testado com 7 casos antes do deploy.
- **Não mexi no cadastro do cliente**: a correção é na hora de escrever a mensagem. Consertar os 5 nomes no banco seria mexer no dado que o Juliano digitou, e o mesmo problema voltaria no próximo cadastro em caixa alta.
- **Deploy conferido**: `customer-reactivation` v30 com `verify_jwt:false` preservado — se isso virasse `true`, o cron (que manda só `x-webhook-secret`, sem Authorization) passaria a tomar 401 em silêncio. Depois do deploy, `dry_run` devolveu `200` / `would_message:0`, provando de uma vez que a function roda e que o cooldown de 40 dias está segurando os 16 recém-contatados.
- **Mesma causa, ainda não corrigida**: a saudação da `ju-ia-site` usa o nome do mesmo jeito ("Bom dia, MOISES!"). Não mexi porque essa function está atrás da PONTE de deploy por SHA (ver 29.68) e o conserto pede re-apontar a ponte — fica para quando alguém estiver olhando.
- Sem respostas de clientes até 14h36; normal para convite de reativação, que costuma render ao longo do dia.

## 29.71.0 — Abertura objetiva puxando pro corte + toque de 30 min + boas-vindas sem "ajuste" (casos Fernando e Mateus, 25/08)

Três pedidos do Juliano na revisão da manhã de 25/08:

- **Caso Fernando (7h26)**: ele abriu com *"gostaria de marcar um horário"* e a JuIA respondeu com pergunta aberta dupla ("qual serviço e para qual dia?") + link do site — o cliente ficou mudo e o Juliano teve que intervir na mão 5 min depois (converteu com "É para corte de cabelo? Que período você prefere?"). Agora o prompt manda a JuIA ser objetiva no WhatsApp: **puxa direto pro corte** (carro-chefe) em UMA pergunta curta ("É corte de cabelo? E fica melhor de manhã, à tarde ou no fim do dia?") — se for outro serviço, o cliente corrige. E **o link do site saiu da abertura**: mandar o site logo de cara passa a impressão de "se vira sozinho" (tem gente com dificuldade ou preguiça de agendar por lá); o site só entra se o cliente pedir.
- **Toque de 30 minutos**: quem pede pra marcar e some no meio da conversa agora vira lead `booking_intent` (kind novo, migration 131) e o `whatsapp-lead-followup` manda aos ~30 min (era 2h): *"Ainda estou por aqui se precisar, tá? E se preferir, você também pode agendar direto pelo site — é rapidinho e bem simples"*. É AQUI que o site aparece, como alternativa — não na abertura. Os demais kinds seguem nas 2h; `booking_intent` não recebe a pesquisa de motivo do dia seguinte.
- **Boas-vindas de primeira visita sem vulnerabilidade** (print do Mateus, 6h55): a frase *"se o acabamento não ficar do seu jeito, a gente ajusta sem custo"* dava a entender que o acabamento podia sair ruim — regra da casa: saudação de boas-vindas é marketing que levanta, nunca expõe. Nova: *"Pode vir no capricho: aqui é hora marcada, sem fila, atendimento sem pressa e café por nossa conta. Vai ser um prazer cuidar do seu visual"*. A garantia de ajuste continua existindo no prompt — mas só quando o cliente demonstra receio ou pergunta.
- Verificado antes de mexer: a resposta educada pra abordagem comercial (v29.68.0) e o caso Tiago dos dias (v29.69.0) já estavam corrigidos e no ar desde ontem à noite — sessão remota que publicou direto no GitHub (repo local sincronizado hoje via fetch).
- Sem bump de cache: só edge functions (`ju-ia-site`, `whatsapp-lead-followup`) + migration 131.

## 29.70.0 — Fora do horário: a JuIA encaminha pro Juliano em vez de negar (pedido dele, 24/08)

Regra do Juliano, dita hoje: *"eventualmente eu abro exceções e atendo alguns clientes após o horário — quando alguém após as 18:30 pedir, pode encaminhar pra mim resolver"*. Duas correções, e uma delas era mentira que já estava no ar.

- **Contradição que a v29.69.0 criou (corrigida em menos de uma hora)**: a resposta nova de piso de horário dizia *"depois das 19h eu não consigo atender"* — mas o **horário estendido existe desde a v28.61.0** (caso Moisés): no WhatsApp, `extended_close_slot_ok` estica até 60 min depois do fechamento. A ordem agora é a certa: **tenta o estendido de verdade** ("pra você o Ju estica: consigo às 19:00, posso confirmar?"); só se nem esticado couber é que vira exceção — e aí **quem decide é ele** (`handoff`, com push no celular). A JuIA não nega e não promete.
- **MENTIRA REAL removida**: horário fora do expediente caía no texto de horário ocupado — *"20:00 já está reservado nesse dia"*. Não estava reservado; simplesmente não existe na agenda. Agora, depois do último horário → informa o último de verdade e chama o Juliano; **antes de abrir** → *"a gente começa a atender 08:00"* e oferece o primeiro (sem handoff, aqui não há exceção a decidir).
- Vale pros dois caminhos: com dia definido ("pode 20h amanhã?") e sem dia ("após as 19h").

## 29.69.0 — JuIA: pergunta sobre DIAS agora é respondida com dias (caso Tiago, 24/08)

Contexto: às 17h58 de 24/08 o Tiago perguntou *"Para que dia você tem vaga pra cortar essa semana?"*. A JuIA devolveu a pergunta dele: *"Para qual dia você quer ver os horários?"*. Ele respondeu *"Após as 19h"* — **mesma frase**. Respondeu *"Segunda-feira, terça-feira e quarta-feira"* — mesma frase de novo, e aí o anti-papagaio do `whatsapp-webhook` trocou tudo por *"Desculpe, me embolei aqui 🙏"* e chamou o Juliano, que fechou o horário na mão em 1 minuto. Levantando o histórico, a mesma morte apareceu **três vezes em seis dias**: 19/08 08h08, 22/08 11h49 e 22/08 16h31.

**Onde ela se perdia (diagnóstico, não chute — `whatsapp_messages` + `whatsapp_conversations.state`):** o `"me embolei"` NÃO é um erro dela, é a rede de segurança. Ele só dispara quando o modelo gera uma resposta **idêntica** à última que já saiu, para uma pergunta **nova** (v29.27.0, caso Vitoria). Ou seja: o sintoma é sempre o mesmo, mas a doença era o fluxo travado antes dele. No estado do Tiago não havia `date` nenhum — as três informações que ele deu (a semana, o "após as 19h" e os três dias) **foram todas descartadas**, porque o fluxo só sabia lidar com UMA data já resolvida.

- **Pergunta por dias agora tem resposta de dias.** `findAvailableDatesInRange` (varre até 7 dias, devolve os 3 primeiros com vaga) e `availabilityForDates` (varre só os dias citados) entram no lugar da pergunta cega. "Para que dia você tem vaga essa semana?" agora responde *"tenho vaga nestes dias: amanhã, quarta (26/08) e quinta (27/08)…"*.
- **Vários dias na mesma mensagem.** `updates.date` do modelo é UM campo: diante de "segunda, terça e quarta" ele devolve `null` e sobrava zero. `weekdayDatesMentioned()` lê os dias pelo nome e confere cada um — inclusive dizendo *"Hoje a gente não abre"* quando o dia citado é domingo/segunda (dizer "não tenho horário" num dia fechado soa a agenda cheia e faz o cliente insistir).
- **Piso de horário deixou de ser jogado fora.** "Após as 19h" / "depois das 18h" / "a partir das 17h" não é o horário escolhido, é o mínimo que serve. Vira filtro na varredura — e, quando não cabe (fechamos às 19h, o último horário de 30 min começa 18:30), a resposta é honesta na hora: *"Depois das 19h eu não consigo atender — o último horário amanhã é 18:30. Se servir, já reservo"*.
- **A pergunta do dia só pode ser feita UMA vez.** Se ela já está no histórico da conversa, repetir é o loop que matou as três conversas: agora quem tem que trazer informação nova é a JuIA.
- **Toda lista de horário passou a dizer o DIA.** Buraco achado no caso de sábado (22/08 11h45): depois de "hoje não tenho", o fluxo trocava `next.date` para terça em silêncio e mandava *"No período da tarde tenho horários entre 12:00 e 17:45"* — **sem dizer que era terça**. O cliente perguntou *"Hoje?"*, a IA regerou a mesma frase e morreu no "me embolei". `emDia()`/`diaHumano()` agora prefixam todas essas frases ("Na terça (25/08), no período da tarde, …").
- **"Não obrigado" encerra, não vira mais oferta.** Recusa à oferta de outro dia/lista de espera só limpava a oferta e o fluxo seguia empurrando agenda. Agora agradece e deixa a porta aberta. Inclui a recusa **sem a palavra "não"** — *"Vou deixar obrigado"* (caso real) não casava com o `simpleNo` e passava batido.
- **Insistir no mesmo dia não recebe mais a negativa idêntica** (caso 22/08 16h31, *"Precisava pra hoje…"*): na segunda vez a frase muda e vira escolha objetiva (aviso quando abrir vaga hoje **ou** garanto o próximo dia).
- **O modelo também aprendeu**: três regras novas no prompt (pergunta repetida nunca; pergunta por dias/vários dias → `date` null e deixa o sistema varrer; piso de horário não é `updates.time`). O código resolve mesmo se o modelo escorregar — o prompt é a segunda camada, não a única.
- **Cosmético, mas era visível**: saía *"terça (25/08) (terça-feira)"* — o `formatDateBR` já vira "terça (25/08)" na troca determinística do fim da função, e ainda colavam o dia da semana depois. E *"Não encontrei horário em hoje"* virou *"Não encontrei horário hoje"*.
- **Testes**: o runner de cenários (`tests/juia/run-scenarios.mjs`) ganhou o que faltava pra testar travamento — `state` e `history` por cenário (todos os casos reais de agosto aconteceram **no meio** da conversa, não na primeira mensagem) e as `red_flags` por cenário, que já estavam documentadas em `scenarios.mjs` e nunca tinham sido implementadas. Seis cenários novos (`dias-01` a `dias-06`) reproduzem as três conversas reais; a red flag deles é a própria frase "para qual dia".
- **Sem bump de cache**: mudança é só de edge function (`supabase/functions/ju-ia-site/index.ts`), nenhum `.js`/`.css` do site foi tocado.
- ⚠️ **PENDENTE DO JULIANO (decisão de negócio, não de código)**: ele atendeu o Tiago **às 19:00**, mas a agenda só oferece até **18:30**, porque o expediente fecha às 19h e o corte leva 30 min. Enquanto for assim, a JuIA vai continuar (corretamente) dizendo que depois das 19h não dá. Se 19:00 for um horário que ele aceita de verdade, o certo é abrir na configuração da agenda — não ensinar a IA a prometer o que o sistema não tem.
- **NO AR** (24/08, 22h08 UTC): `ju-ia-site` **versão 180**, ponte re-apontada para o SHA `e675184`. Conferido em produção logo depois do deploy (lição dos 11 min de fora do ar da v29.68.1): os três turnos do Tiago, a recusa "vou deixar obrigado" e um controle de preço — todos 200, todos com a resposta nova, catálogo intacto.
- ⚠️ **ARMADILHA NOVA (sessão remota)**: desta máquina o proxy **bloqueia HTTPS direto para `*.supabase.co`** (403 no CONNECT), então não dá pra testar a function com `curl`/`fetch` daqui. Saída usada: `select net.http_post(...)` via `pg_net` — o POST sai de dentro do Postgres do próprio projeto e a resposta cai em `net._http_response`. As 5 sessões de teste (`deploy-check-v29690-*`) foram apagadas de `site_chat_messages` depois.
- ⚠️ **A ponte por SHA continua valendo**: todo deploy futuro da `ju-ia-site` precisa re-apontar o SHA no entrypoint do Supabase, ou voltar ao deploy direto via CLI (`supabase functions deploy ju-ia-site`, do PC). Sem isso, sobe código velho sem avisar.

## PagBank — homologação (24/08): por que NÃO migramos para o produto Order

O Maurício (Time de Integração PagBank, chamado 1430398600) cobrou: *"É necessário que realize transações no produto Order para que possamos finalizarmos a homologação."* Recomendação óbvia seria migrar. **Decidimos não migrar** — e o motivo importa.

- **A cobrança nasceu de uma pergunta nossa não respondida.** Em 21/08 17h56 ele escreveu: *"só houve transações no produto Checkout PagBank. Poderia nos confirmar se será utilizado o produto Order?"* — ninguém respondeu, e o e-mail de hoje é a escalada disso. Não era problema técnico.
- **São TRÊS produtos, não dois** (levantado na documentação, 24/08): `Checkout` (página hospedada, `api.pagseguro.com/checkouts` — o que usamos, em produção); `Order` (`/orders`, você monta a própria tela, cobrança avulsa); e `Pagamentos Recorrentes / Assinaturas` (`api.assinaturas.pagseguro.com`, plano + assinante + assinatura, com o PagBank cobrando sozinho todo mês).
- **O Order NÃO é o produto do Clube do Ju.** O Juliano levantou a dúvida certa. O Order tem um modo "com indicação de recorrência" (`charges.recurring.type=SUBSEQUENT`), mas a doc é explícita: ele serve **para quem tem sistema próprio de gestão de recorrência**. Adotá-lo significaria construir motor de cobrança mensal, retentativa em cartão recusado, cartão vencido e cancelamento — do zero, para um barbeiro sozinho. O caminho do Clube é Assinaturas.
- **Não trocamos o Checkout pelo Order no fluxo atual**: a página hospedada é o que mantém CPF e cartão fora do nosso site. Migrar para o Order jogaria captura de dado sensível para dentro do nosso código sem nenhum ganho — pagamento avulso de agendamento já funciona 100%.
- **Os dois testes que ele pediu JÁ tinham sido feitos** em 21/08, e o que faltava era ele enxergá-los: PIX pago 16:20:32 (`ORDE_19385C2F…` / `CHAR_CA766916…`) e CARTÃO 16:56:13 (`ORDE_3A25891A…` / `CHAR_CD0249C2…`), ambos `PAID`, ciclo completo até a baixa automática pelo webhook em ~1s. Note que **os dois geraram pedidos `ORDE_...`**, ainda que criados via Checkout.
- **ARMADILHA OPERACIONAL (provável causa raiz):** o e-mail de logs de 21/08 saiu às 16h29 **do Gmail**, e a conta do PagBank é o **Hotmail** — o Juliano observou que o Maurício não responde o que sai do Gmail. Somado a isso, o teste de cartão só terminou às 16h56, **depois** do envio: os logs analisados continham só o PIX. **Correspondência com o PagBank vai SEMPRE pelo Hotmail.**
- **DESFECHO — homologação APROVADA em 24/08 18h21**, cerca de uma hora depois do e-mail sair pelo Hotmail: *"Sua homologação foi finalizada e você está apto para transacionar em produção"*. Confirma as duas leituras: o problema era a pergunta sem resposta (não faltava transação), e o canal certo é o Hotmail — pelo Gmail a resposta de 21/08 nunca surtiu efeito. **Não foi preciso escrever uma linha de código para o Order.**
- **Continua em aberto (sem pressa)**: ele não respondeu se o produto de Assinaturas exige homologação e credencial próprias. Não trava nada hoje; é a primeira pergunta a fazer quando o Clube do Ju sair do papel.

## 29.68.0/29.68.1 — JuIA: mensagem comercial padronizada + pergunta de primeira visita (24/08)

Dois pedidos do Juliano na mesma tarde, ambos na `ju-ia-site` (vale pro WhatsApp e pro chat do site), deployados e testados em produção.

- **Mensagem comercial (caso Gleiciane, 24/08 12h58)**: consultora de "desconto na conta de luz" levou resposta seca do modelo ("não envie mais mensagens comerciais por aqui") e, quando perguntou o contato correto, a JuIA **negou que existisse contato comercial** — sendo que existe. Interceptador determinístico: sinais claros de prospecção (sou consultor/a, proposta comercial, energia solar, consórcio, maquininha, tráfego pago, seguidores etc.) → resposta padrão educada: este canal é exclusivo para agendamento; comercial é **somente contato@barbeariadoju.com.br**. Pergunta de "qual o contato comercial?" responde o e-mail direto. O prompt também aprendeu (rede pros casos fora do regex). Regex conservador de propósito pra nunca pegar cliente falando de serviço.
- **Primeira visita (ideia de 23/08, levantada da memória)**: a barbearia atende desde 12/03, o sistema registra desde 14/07 — cliente antigo agendando pela 1ª vez no sistema aparecia como "novo" e derrubava a retenção dos Relatórios. Agora, **só na primeira confirmação de agendamento** (telefone verificado, zero visitas no sistema, sem declaração anterior), a JuIA emenda uma pergunta única: primeira vez (1) ou já é cliente (2)? A resposta alimenta o que já existia: `prior_visits` da v29.9.0 (declarou "já sou cliente" → piso 1, **nunca sobrescreve contagem manual**) + etiqueta `primeira-visita-declarada`/`ja-era-cliente-declarado` no cadastro. Qualquer outra resposta segue o fluxo normal e a pergunta não se repete (one-shot). Sem perfil ainda (agendamento público só cria na conclusão), o write cria o perfil na hora.
- **Migration 130 (achada pelo teste)**: o insert do perfil falhava em silêncio — `42501`, service_role tinha SELECT/UPDATE em `customer_profiles` mas **não INSERT** (mesma classe da migration 127/payments). 29.68.1 passou o write pra upsert por telefone e **logou o erro que o código engolia** — foi o log que revelou a causa. Lição repetida: nunca ignorar o `error` do supabase-js.
- **ERRO MEU, registrado de propósito**: o primeiro deploy subiu com um placeholder no lugar do `index.ts` — a JuIA ficou **~11 minutos fora do ar** (16h28–16h39 UTC). Zero mensagens de clientes no período (conferido em `whatsapp_messages` e `site_chat_messages`); ninguém foi afetado. Causa: o arquivo (215KB) não passa inteiro pelo canal de deploy desta sessão remota.
- ⚠️ **DEPLOY ATUAL É UMA PONTE**: o entrypoint no Supabase é 1 linha que importa o código real do GitHub por SHA imutável (`raw.githubusercontent.com/.../<sha>/supabase/functions/ju-ia-site/index.ts`) — mesmo mecanismo dos imports esm.sh. **Todo deploy futuro da ju-ia-site precisa ou re-apontar o SHA da ponte, ou voltar ao deploy direto via CLI (`supabase functions deploy ju-ia-site`, do PC)**. O import relativo `../_shared/service-rules.ts` resolve no próprio GitHub.

## 29.67.0 — Favicon novo: bigode no círculo da busca (pedido do Juliano, 24/08)

Contexto: na busca do Google, o ícone do site aparecia como um quadradinho escuro ilegível dentro do círculo — o favicon era a **placa inteira da fachada** espremida em 192px (texto minúsculo, fundo preto). O Juliano tinha desenhado a solução com o Claude no dia anterior: fundo bege do logo com o bigode marrom, centrado no círculo. Recriado aqui em SVG (a conversa anterior não é acessível desta sessão) e rasterizado com o Chromium/Playwright do próprio projeto.

- **Ícones trocados (mesmos nomes, zero edição de HTML)**: `assets/icon-192.png`, `assets/icon-512.png` e `assets/apple-touch-icon-180.png` agora são o emblema — fundo bege `#e8dcc0`, anel sutil `#d9c9a3`, bigode handlebar `#43281a`. Legível até em 48px (testado visualmente em 512/48/16). Vale pra busca do Google, aba do navegador, PWA e tela de início do iPhone.
- **`favicon.ico` novo na raiz** (16+32+48 embutidos como PNG): fallback pra navegador/ferramenta que pede `/favicon.ico` direto — não existia.
- **Schema da home**: `logo` do LocalBusiness saiu de `icon-512.png` (que agora é só o bigode, sem o nome) pra `assets/marca-selo-transparente.png`, que carrega o nome da barbearia — papel de logo é do selo, papel de favicon é do emblema.
- **Cache**: `sw.js` CACHE `barbearia-os-v28-16-0` → `v29-67-0` (os 3 ícones estão no precache do service worker; sem o bump, o PWA continuaria servindo os antigos). Os `<link rel="icon">` não têm `?v=`, mas o arquivo mudou de conteúdo no mesmo nome: navegador pega no próximo miss e o Google refaz o fetch do favicon no ritmo dele (dias, não minutos — não estranhar se a busca demorar a atualizar).
- Fonte do desenho versionada em `assets/src/favicon-bigode.svg`; pra regerar em qualquer tamanho é Playwright + screenshot do SVG (não há ImageMagick no ambiente).

## 29.66.0 — Reativação de 30 dias LIGADA (primeiro disparo terça 25/08 14h) + treino de sexta vira quinta

Contexto: análise de crescimento do dia mostrou platô de ~36 atendimentos/semana e retenção de 16% (20 de 124 voltaram). O Juliano aprovou ligar o convite pra quem completou 30 dias sem voltar — regra dele desde 11/08 era "só com 30+ dias e base madura"; a base tem 6 semanas agora.

- **O que já existia**: function `customer-reactivation` + cron `customer-reactivation-diario` (14h), ATIVOS desde a v28 com régua de 45 dias — zero envios até hoje. Dois buracos que iriam pro ar: a elegibilidade **não excluía quem já tem horário futuro marcado** ("sentimos sua falta" pra quem acabou de agendar) e o texto era genérico.
- **Migration 129** — `customers_due_for_reactivation` recriada (DROP + CREATE: ganhou `last_service` no retorno): régua padrão 30 dias (ou `return_interval_days` do perfil, sem folga), exclui quem tem agendamento pending/confirmed futuro, cliente bloqueado e `survey_opt_out`. Cron: `0 17 * * 2-6` (ter–sáb; segunda fechada e o Juliano pediu terça), body `{"default_days":30,"grace_days":0,"cooldown_days":40}`.
- **Mensagem nova**: "Oi, Nome! 💈 Aqui é a JuIA… Já faz mais de um mês desde o seu último corte com o Juliano — deve estar na hora de dar um trato, né? 😄 Me diz o dia que fica melhor pra você que eu confiro os horários (hora marcada, sem fila)…" — mesmo CTA que converte no lead-followup; a resposta cai na JuIA como pedido de horário. Nome que parece empresa/título (Espaço, Salão, Dr) não vira vocativo. Sem desconto (posicionamento).
- **Primeira leva (terça 25/08, 14h): 9 clientes** — Moises (39d), Sergio Henrique (39d), Monique (38d), Vinícius Luiz (37d), Romilce/Alexandre (37d), Marcelo Saraiva (36d), Espaço Shanti (32d), Fabio Calvoso (32d), Cleidson (30d). Cooldown de 40 dias evita repetir.
- **Agenda**: bloqueios "Treino do Juliano" de **sexta 10–11h movidos pra quinta 10–11h** (pedido dele, 22/08 — sexta não pode ficar travada); quarta continua. Sem conflito com agendamentos existentes.

## 29.65.0 — "Já avaliou no Google" com um clique no Concluir (pedido do Juliano, 22/08)

Ele reconhece na cadeira quem já deixou avaliação. Antes só dava pra desmarcar "pedir avaliação" **a cada** conclusão — e a marca não ficava em lugar nenhum.

- **Modal "Concluir atendimento"**: novo checkbox *"⭐ Este cliente JÁ avaliou no Google — não pedir mais (fica salvo no cadastro dele)"*. Marcou uma vez → `admin-booking-status` grava `google_reviewed`/`google_reviewed_at`/`google_review_declared_at` no `customer_profiles` (telefone com e sem 55) e desliga o pedido deste atendimento. Nas próximas conclusões desse cliente o bloco de avaliação some e aparece só o aviso "já avaliou — o pedido não será enviado" (cache local atualizado na hora, sem recarregar).
- **Migration 128**: `customer_already_reviewed()` — a ÚNICA checagem que o webhook faz antes de mandar o link do Google na pesquisa — passou a ler também o perfil (`google_reviewed` ou `google_review_declared_at`). Antes só contava quem clicou no nosso link (`experience_requests.google_clicked_at`); o "1 = já avaliei" do WhatsApp gravava no perfil e era ignorado. Bug latente, fechado de carona.
- Cache: `admin-v15-4-agenda.js` e `admin-v15-4-core.js` → `?v=29.65.0` nas 7 páginas do admin; `ADMIN_VERSION`/`admin-version.json` → 29.65.0 (painel aberto recarrega sozinho).
- Avaliações do Google: 92 no painel, 89 na API (Windsor) — todas respondidas; as 2–3 mais novas ainda não chegaram na API (atraso normal de sincronização), entram na próxima varredura.

## 29.64.0 — "A JuIA é chatinha" (caso Helder, 21–22/08): menos rodadas, menos papo

Print do Juliano às 13h30 com a pergunta "o que ela fez de errado?". A conversa inteira no banco mostra o padrão: **ela pede confirmação demais e responde gentileza com mais gentileza até cansar**. Em 21/08 ela respondeu a QUATRO despedidas seguidas do Helder ("Bom trabalho e ótimo dia" → "Obrigado senhor" → …) e no dia seguinte ele disse ao Juliano "eu desconfiei que fosse a IA". Em 22/08: "Bom dia, Helder! Tudo bem, Helder!" (nome duas vezes), "Chego umas 13:30, espero a vez" → "13:30 já está reservado nesse dia… serve 13:45?" → "13:45 então" → **"Quer reservar esse horário?"** → "Sim" → confirmado. Seis mensagens pra um cliente fiel que queria uma.

- **Horário que a própria JuIA ofereceu, escolhido pelo cliente, é reserva** — não pergunta "quer reservar?". Vale quando a mensagem é só o horário (+ "então/pode ser"), a última fala da JuIA continha esse horário com "serve pra você? / qual prefere? / por exemplo" e a oferta única de venda já passou (senão a mensagem certa é a da disponibilidade com a oferta numerada, cujo "4" também fecha). A RPC reconfere a vaga.
- **Cliente flexível reserva o próximo livre direto**: "chego umas X / por volta / espero a vez / tanto faz" com X tomado → reserva o primeiro horário depois de X (até 30 min) e explica em uma linha ("13:30 já estava tomado, então deixei o próximo livre, 13:45 — chegando 13:30 é só esperar 15 min ☕").
- **Nome uma vez só**: o modelo escreve "Tudo bem, Helder!" e o prefixo já diz "Bom dia, Helder!" — a 1ª menção do nome nos primeiros 60 caracteres da resposta sai antes de colar a saudação.
- **Despedida se responde UMA vez**: se a última fala da JuIA já foi fechamento (agradecimento/ótimo dia/abraço) e o cliente devolve só outra gentileza, a JuIA fica em silêncio — ju-ia-site devolve resposta vazia e o webhook não envia nada (estado salvo). Despedida com pedido ou pergunta continua respondida.
- Já estava corrigido antes (29.43.5): o cochicho "Ainda estou por aqui" depois de "Um abraço, excelente fds" (mesmo Helder, 18/08).

## 29.63.0 — Handoff não é mudez + agendamento em GRUPO (caso Plinio, 22/08 08h48)

Print do Juliano às 10h: cliente novo vindo do site, "quero falar com o barbeiro" → a JuIA perguntou o motivo (certo) e fez handoff → ele emendou "2 cortes masculinos e 1 infantil / hoje à tarde / tem disponibilidade?" e ficou **25 minutos no vácuo** (o Juliano estava na cadeira). Só o watchdog das 9h15 destravou, com um texto genérico; o "?" dele às 9h22 rendeu "Corte de cabelo + Corte de cabelo infantil (60 min)" com 10:00 entre as opções — 3 pessoas viraram 2 e "à tarde" virou manhã (a frase original nunca chegou ao modelo, só o "?").

- **Webhook — takeover que nasceu do handoff da própria JuIA não cala pergunta de agenda**: se o Juliano ainda não escreveu nada desde o handoff (`sent_by='human'` depois de `human_takeover_at`) e o cliente pergunta de horário/preço/serviço, a JuIA libera o takeover e responde na hora com o prefixo "O Juliano está atendendo na cadeira agora, mas eu já te adianto 😊". Takeover que nasceu de mensagem do Juliano (caso Deisler, 29.12.0) continua em silêncio + push, como antes.
- **ju-ia-site — grupo**: "N cortes", "N infantil/criança", "N pessoas" viram `group_adults`/`group_kids` no state e a lista de serviços é reexpandida a cada turno (uma entrada por pessoa; a regra das famílias e o modelo colapsam nomes repetidos, por isso a contagem vive em número, não na lista). Duração = soma (3 pessoas = 90 min), um agendamento só no nome de quem chamou. "Só eu / apenas eu / sozinho" desfaz. Prompt ganhou a instrução de grupo.
- **Sabido e NÃO feito**: agendamento em grupo ainda é 1 registro com o serviço repetido ("Corte de cabelo + Corte de cabelo + Corte de cabelo infantil") — não cria 3 clientes nem 3 fidelidades. Se virar frequente, modelar `group_size` no banco.

## 29.60.0–29.62.3 — Regra das famílias de serviço (1 corte + 1 barba) + revisão das conversas de 21/08 (22/08)

Sábado, sessão "plano do dia". Duas functions (29.60/29.61) já estavam no ar desde 21/08 17h sem commit — este registro fecha a conta. O resto nasceu da varredura das conversas de ontem e de um print do Juliano às 7h45.

- **29.62.0 — REGRA DAS FAMÍLIAS DE SERVIÇO (pedido do Juliano, caso Augusto Monteiro, 22/08 07h45)**: ele agendou pelo site "Corte + Barboterapia + Barba Express" (R$ 105, 80 min). Causa: a etapa "quer incluir mais alguma coisa?" de `/agendar/horario/` sugeria Barba Express pra QUALQUER lista com "Corte" — mesmo com a Barboterapia já dentro do combo — e o carrinho de `/agendar/` deixava somar qualquer coisa (até 2× o mesmo serviço pelo botão "+"; já tinha saído "Corte de cabelo + Corte + Barboterapia" em 08/08, Leonardo Nobrega). Regra do negócio, agora em código: **num atendimento cabe 1 serviço de corte e 1 de barba**; Barboterapia e Barba Express são alternativas (a Barboterapia é a completa); combos "Corte + X" já cobrem a barba; pezinho já vem dentro de qualquer corte. **Única exceção: corte adulto + corte infantil** (pai e filho). Fonte única no site: `assets/js/service-rules.js` (`applyServiceRule` = adicionar respeitando a regra, o mais novo substitui o da mesma família, combo que já cobre recusa com aviso; `normalizeServiceSet` = saneia lista pronta ficando com o mais completo; `splitServiceNames` = desmonta "A + B + C" sem confundir o "+" dos combos). Aplicada em 4 lugares: carrinho (`service-cart-v22-5.js`: aviso flutuante, sem botões +/−, carrinho antigo saneado ao carregar), etapa de horário (`agenda-v15.js`: sugestões só do que a regra deixa entrar, aviso acima das sugestões, lista saneada ao carregar), JuIA (`ju-ia-site`: normaliza o que o modelo entendeu e prefixa "Só pra ajustar: X já inclui o que Y faria…"; prompt ganhou a regra explícita) e servidor (`create-public-booking`: 400 com explicação — rede de segurança pra cache velho/chamada direta; se a lista de serviços não carregar, não bloqueia). Cópia TS em `supabase/functions/_shared/service-rules.ts` (Deno não importa o .js do site) — mudou um, muda o outro. A JuIA já tinha dois filtros específicos (barba: 29.50.0, caso Luiz André; pezinho: 29.43.6) que continuam valendo — a regra genérica cobre o que faltava (família corte, combo × serviço solto) e o prefixo "Só pra ajustar" cede a vez quando o aviso antigo já está na resposta (teste ao vivo em 22/08 mostrou os dois juntos). 15 testes unitários novos (`tests/unit/service-rules.spec.js`). Decisão contra o óbvio: no carrinho o serviço NOVO vence (quem clica Barboterapia depois de Barba Express quer trocar); na normalização de lista pronta vence o mais completo (combo > preço) — são intenções diferentes. Agendamento do Augusto corrigido no banco pra Corte + Barboterapia (R$ 80, 60 min, nota no registro). Cache: `?v=29.62.0` em `agendar/index.html` e `agendar/horario/index.html`.
- **29.62.1 — comprovante mandado JÁ NA CADEIRA vira comprovante (caso Aletéia, 21/08 09h34)**: marcou 09:30, pediu a chave às 08:56 e mandou a foto do Pix às 09:34 — `phone_upcoming_bookings` só enxerga horário futuro, então a foto caiu no fluxo de "referência de corte" ("não consegui identificar nela um corte"). O Juliano confirmou na mão às 10h39. Webhook: sem agendamento futuro, procura o de hoje que começou há até 3h e ainda não teve Pix confirmado (telefone com e sem 55).
- **29.62.2 — áudio ilegível não vira resposta (caso Marcelo, 21/08 15h50)**: 2º áudio transcrito como "Paldys visi, azuiti mėjim." (Whisper chutou lituano) e a JuIA seguiu adiante confirmando 08:30. Agora: `language=pt` fixo no Whisper + guarda de legibilidade (letras de outros alfabetos, sem vogal, nada legível) → "Não consegui entender bem o seu áudio 🙉 Pode escrever ou mandar de novo?" e registro `[áudio recebido, transcrição ilegível: …]`. O 08:30 dele ficou de pé (recebeu a confirmação e não contestou).
- **29.62.3 — "em cima da hora" oferece o próximo horário (caso Cleiton, 21/08 14h58)**: às 12h51 a JuIA ofereceu 15:00 com a pergunta de complemento; ele só respondeu "4" (fechar) às 14h58, 2 min antes. A RPC recusou ("15 minutos de antecedência") e a JuIA devolveu o erro seco, sem saída — ele veio sem hora marcada. Agora explica o motivo e traz os 2 próximos horários do dia (ou propõe amanhã).
- **29.61.0 — "hoje ou amanhã": a data mais próxima vence (caso Marcelo, 21/08 15h49, deployado 21/08)**: "tem horário hoje? vou amanhã cedo" e o modelo escolheu amanhã com a agenda de hoje aberta. Trava de código: frase com as duas alternativas → `next.date=hoje`, horário zerado; se hoje não tiver vaga, o bloco de disponibilidade já oferece o próximo dia.
- **29.60.0 — menu do cliente insatisfeito (deployado 21/08)**: resposta ao "2" da pesquisa ganhou interceptador próprio que roda antes de tudo (1 reparo · 2 ressarcimento · 3 sugestão; texto livre também resolve, ninguém insatisfeito cai em "Não entendi"). Ressarcimento nunca é executado pelo robô: registra e manda push pro Juliano decidir.
- **Dados**: cadastro `Dicxon Garcia / Samuel` renomeado pra `Samuel (Dicxon Garcia)` — a JuIA chamava o Samuel de "Dicxon" no saldo de fidelidade (primeira palavra do nome). Não era cruzamento de telefone.
- **Sabido e NÃO mexido**: `deno check` acusa `pitch` inexistente no tipo de `services` (ju-ia-site, linha ~431) — erro de tipo antigo, o bundler do deploy não tipa; fica pra uma limpeza de tipos separada.

## 29.54.0–29.59.0 — Dia de casos reais: Aletéia (preço + Pix), Dr. Pedro (reação 👍), convite de retorno sem data, PagBank em produção (21/08)

Cinco correções nascidas de clientes reais do mesmo dia, todas já deployadas (functions direto; este commit registra o código + a parte do site).

- **29.54.0 — pergunta NUNCA vira agendamento (caso Aletéia, 08h54)**: ela perguntou "Qual o valor do corte?" DUAS vezes; a 1ª foi engolida pela oferta numerada (que reescreve o reply inteiro) e a 2ª foi lida como confirmação — agendou sem responder o preço. `ju-ia-site`: (1) intent 'book' com mensagem terminada em "?" (ou pergunta de preço) sem confirmação explícita/sim curto rebaixa pra 'faq'; (2) pergunta de preço tem resposta determinística (serviços escolhidos + total + duração) e NÃO mata a oferta — horário segue reservado; (3) preço perguntado junto do horário entra ANTES da oferta numerada.
- **29.55.0 — passar a chave Pix registra e avisa (Aletéia, parte 2)**: ela pagou em silêncio e o Juliano só soube na cadeira, depois do corte. Mesmo buraco que a migration 126 fechou no site, agora no WhatsApp: a JuIA passar a chave grava `prepay_key='picpay'` no agendamento e manda push "💸 Passei a chave Pix — fique de olho no extrato" (uma vez). E `pix_offered` no state: "Quero"/"sim" logo após a oferta do Pix cai no caminho determinístico (chave + VALOR) — era o erro do Frei voltando por outra porta. `satisfaction-dispatch`: comprovante de quem pagou antecipado confirmado sai com "💳 Pago no Pix (antecipado)" em vez de sem linha nenhuma.
- **29.56.0 — convite de retorno sem data cravada (pedido do Juliano, caso Rinaldo)**: cravar "quinta 17/09 às 17:30 — daqui a 4 semanas" expõe agenda vazia e decide o intervalo pelo cliente. Agora 3 passos: quer reservar? (1/2) → pra quando? (1 semana/15/30 dias, base = data do último atendimento) → amostra de até 4 horários espalhados do dia (nunca o total). Estado `pending_invite` (stages interval/slot) no webhook; compat por data de envio pros convites 1/2/3 antigos ainda vivos (expiram em 48h).
- **29.57.0 — modal de concluir confere o Pix DIRETO NO BANCO (Aletéia, parte 3)**: a trava da 29.49.0 decidia com o que a página tinha carregado; com a Agenda aberta desde antes da confirmação, perguntou a forma de pagamento de novo a quem já tinha pago. Agora `choosePaymentMethod` busca `prepay_declared/confirmed` frescos ao abrir; e ganhou o aviso que faltava: declarado-sem-confirmar aparece em destaque ("confira o extrato ANTES de concluir"). `admin-v15-4-agenda.js` (cache → 29.57.0 em 7 páginas).
- **29.58.0 — reação 👍 = resposta da pesquisa (caso Dr. Pedro, 14h33)**: ele reagiu 👍 ao comprovante; reação chega sem texto e morria — pesquisa pendente pra sempre, pedido do Google nunca saía, fila única travada. Webhook: reação positiva na MENSAGEM DA PESQUISA vira "1" (negativa vira "2"), roteada explicitamente pra survey; reação em qualquer outra mensagem é ignorada em silêncio. A reação dele (pré-deploy) foi reinjetada pelo fluxo oficial — pedido do Google saiu 16:25.
- **29.59.0 — PagBank EM PRODUÇÃO (migration 127)**: conta liberada pelo Maurício 09h40; teste real fechou o ciclo: checkout R$ 1,00 → Pix pago 16:20:32 → webhook validou assinatura e confirmou SOZINHO em 1s. O teste achou bug grave: `payments` sem GRANT pro service_role (42501) — checkout criava no PagBank e não gravava nada aqui, o webhook não teria com o que casar. Migration 127 (grants em payments/bookings). Logs enviados pro Maurício (Gmail + Hotmail); aguardando validação final. Registro de teste TESTE-PAGBANK-HOMOLOG (06/01/2027) fica até a validação.
- Também hoje: cadastro "Dicxon Garcia / Samuel" (conta pai+filho, 5 pontos fidelidade, recorrente), arte dos posts das 8h refeita (IA escreveu "LOGO" fantasma) + 3 legendas reescritas, 17 negativas no nível da conta no Ads (lixo da PMax: pizzaria, salão, atibaia, concorrentes), e aprovação da Google Business Profile API (projeto 582173444855, 300 QPM) — ativação fica pra próxima sessão.

## 29.54.0 — Copiar a chave Pix no site avisa o Juliano na hora (caso Nado, 20/08)

Caso real: o Nado agendou pelo site às 14h07 pra 15h, copiou a chave Pix da tela de confirmação, pagou... e não tocou em "✅ Já fiz o Pix". Nenhum registro, nenhum push — o Juliano só soube do pagamento DEPOIS do atendimento, conferindo o extrato à mão. Com um desconhecido isso seria desconfiança na cadeira; com aviso antecipado seria confiança ("já vi seu Pix, tá garantido").
- **Migration 126 — `note_prepay_key_copied(code, token, key)`**: mesma autorização do declare (booking_code + management_token), grava `prepay_key` (coalesce — 1ª chave vence) e devolve `first_copy` pra função só avisar uma vez. NÃO mexe em `prepay_declared_at` — cópia é sinal, não declaração.
- **`prepay-declare` ganhou `event:'copied'`**: push "👀 Copiou a chave Pix — de olho no extrato" (nome, valor, qual chave, e a nota de que o "Já fiz o Pix" ainda não veio) só na primeira cópia. O fluxo 'declared' (padrão) segue idêntico.
- **`agenda-v15.js` (cache → 29.54.0)**: sucesso na cópia da chave dispara o aviso fire-and-forget (guard local de 1 envio por tela; falha de rede não atrapalha a cópia).
- Testado em produção com agendamento TESTE-CLAUDE-PIX (2 cópias: prepay_key gravado 1x, declared_at continua nulo, push único) e apagado em seguida. O caso do Nado em si foi fechado à mão: concluído + pago no Pix via SQL (com trilha no customer_timeline), comprovante+pesquisa saíram pelo robô normal.

## 29.52.0 / 29.52.1 / 29.53.0 / 29.53.1 — Política de no-show (bloqueio + Pix antecipado automático), pesquisa "1 + comentário", hora da leitura no card Alarme (20/08)

Caso Graziele (3 furos: no_show 28/07, cancelamento em cima da hora 06/08, no_show 20/08) + caso Leticia + caso do card do alarme.
- **29.52.0 — bloqueio de cliente (migration 125)**: tabela `blocked_customers` + trigger `bookings_block_guard` (BEFORE INSERT em bookings): canais de autoatendimento (site/juia_whatsapp) não agendam cliente bloqueado; admin logado (is_admin) passa sempre — "se ela quiser vir eu tento encaixar". Site: mensagem neutra apontando pro WhatsApp. Testado: insert direto devolve `cliente_bloqueado`; RPC do site idem. Booking 8h45 de 20/08 marcado no_show.
- **29.52.1 — pesquisa reconhece "1 + comentário" (caso Leticia)**: "1 \n\nMeu marido gostou bastante" não casava nada (^1$ exige número sozinho; "gostou" faltava no dicionário) e caiu no modelo — sem registro e sem pedido do Google. Agora `leadingOne`/`leadingTwo` ("1"/"2" no início seguido de comentário) e elogio em 3ª pessoa (gostou/gostaram/amou/adorou/aprovou) contam. Resposta dela registrada à mão como satisfied; pedido do Google entregue pro Juliano colar (feito).
- **29.53.0 — política PADRONIZADA e automática (pedido do Juliano)**: `customer_no_show_count(phone)` >= 2 dispara o mesmo guard sem precisar de bloqueio manual. Na JuIA, o `cliente_bloqueado` apresenta a política aprovada (Pix antecipado confirma o horário; tolerância 10 min; remarcou avisando até a véspera/24h = crédito; sumiu sem avisar = valor não devolvido) com opções 1/2. "1" → push 💸 pro Juliano criar o agendamento na Agenda (o painel passa pelo guard) e a JuIA orienta o cliente a pedir a chave Pix; "2" → fecha educado. Mensagem-modelo pro contato manual salva em marketing_memory (restricao). **Miguel Giglio absolvido**: os 2 no_shows dele eram duplicata do MESMO dia (25/07) causada pelo bug antigo "próprio horário aparece ocupado", e ele avisou antes do horário ("vou ver outro dia") sem a JuIA cancelar — reclassificados pra cancelled com nota. Lição: auditar furos históricos antes de punir.
- **29.53.1 — card Alarme com hora da última leitura**: caso real — Juliano desarmou 10h09 (sensor disparou), rearmou logo depois, e o poll das 10h10 fotografou "desarmado"; o card ficou assim até a leitura seguinte, parecendo bug. O mapa de modos está certo (leitura fresca com central armada = mode_raw '1' → armado). Agora o subtítulo mostra "· lido às HHhMM" (last_seen_at). Cache dashboard.js → 29.53.1.
- **GOTCHA DE FERRAMENTA (quebrou acentos no admin)**: bump de `?v=` via PowerShell 5.1 com `Get-Content -Raw` lê UTF-8 SEM BOM como ANSI e corrompe acento (CALENDÃiRIO no ar por ~15 min). Reparo: restaurar do git e refazer com `[System.IO.File]::ReadAllText/WriteAllText` + `UTF8Encoding($false)`. NUNCA usar Get-Content/Set-Content pra editar arquivo UTF-8 do repo; o CHANGELOG também foi restaurado do commit c1988c2 pelo mesmo motivo.
- Windsor: escrita disponível no plano free, mas o toggle "Enable write actions for Claude, ChatGPT & API" estava desligado — prompt entregue pra extensão religar. Avaliação 5★ do Luan (19/08) respondida à mão pelo Juliano.

## 29.51.0 — Nunca expor agenda vazia + resgate da lista de espera + 4 correções da revisão diária (20/08)

Pedidos do Juliano no plano do dia de 20/08 (caso Stevan, 19/08: "com 43 horários" = "o cara não tem nenhum cliente").
- **ju-ia-site — REGRA NOVA: nunca dizer QUANTIDADE de horários nem despejar lista.** Helpers `slotsSample`/`slotsPhrase`: amostra espalhada de até 4 ("entre 08:00 e 18:30 — por exemplo 09:15, 12:15, 15:30") em TODOS os pontos que listavam ou contavam (remarcação ×2, disponibilidade, horário ocupado, próximo dia com vaga). O cliente pode responder qualquer horário, não só os exemplos.
- **whatsapp-lead-followup — resgate de lista de espera vencida (caso Stevan/Marcio):** o gatilho de cancelamento só cobria vaga que ABRE; dia lotado que simplesmente passa deixava a entrada 'esperando' pra sempre (Marcio desde 08/08). Agora: dia pedido passou há <=2 dias e HOJE tem horário → oferta de resgate (sem expor contagem; `offered_start_time` fica nulo de propósito pra resposta cair na JuIA normal, não no sim/não); mais velho → 'expirado' em silêncio. 1º uso real: Stevan avisado 20/08 8h40, Marcio expirado.
- **whatsapp-lead-followup — nudge de disponibilidade reescrito:** "aqueles horários podem ter mudado" era vago e teve 0 respostas em dezenas de envios. Agora: relembra o serviço, próximo passo concreto ("me diz o dia") e benefício real (hora marcada, sem fila).
- **ju-ia-site — "11.00 horas" virava 00:00 (caso Luiz André, 19/08):** o fallback de hora sem minutos casava o "00" antes de "horas". Hora com PONTO agora vale quando precedida de "às/as" ou seguida de h/hs/horas; "dia 21.08" (data) continua fora. Testado com 11 casos.
- **whatsapp-webhook — pesquisa não engole mais reclamação (caso Vivian/Theo, 19/08):** "O Theo tá muito inquieto com o cabelo…😁" caiu como SATISFEITO pelo emoji e levou "Que ótimo saber disso!". Menção a problema/ajuste nunca vira satisfeito (push ⚠️ pro Juliano + conversa segue no fluxo normal); emoji positivo sozinho só vale em mensagem curta (<=40).
- **whatsapp-webhook — gentileza recebe gentileza (caso Frei, 19/08):** "Eu que agradeço" levava "Não entendi 🙂". Agradecimento curto com pesquisa pendente responde "Nós que agradecemos!" + lembrete acolhedor do 1/2.
- Deploy: ju-ia-site, whatsapp-webhook, whatsapp-lead-followup via CLI (PowerShell). Deno check: só os 2 erros `pitch` pré-existentes.

## 29.50.0 — Caso Luiz André: fidelidade "0 pontos" (cadastro duplicado) + trava de barba redundante

JuIA disse "0 pontos" pro Luiz André (cliente semanal) e fechou "Corte + Barba Express + Barboterapia c/ ozônio".
- **Causa da fidelidade**: perfil DUPLICADO por formato de telefone (5511... × 11...) — a consulta pegava o perfil sem conta. **5 pares de duplicados unificados** (Luiz, Leonardo, Miguel, Carlos, Alessio; lógica do admin_merge_customers replicada, timeline anotada). Luiz creditado retroativamente (+2: visitas 18/07 e 06/08) → 4 pontos. `v27_customer_for_booking` corrigida pra phone_match_key (comparava dígito exato — era quem alimentava timeline/pesquisa com o perfil errado).
- **Trava de serviços de barba** (`dropBarbaRedundante`, ju-ia-site): da família Barba Express / Barboterapia / Barboterapia c/ ozônio só fica o mais completo, com aviso "tirei X pra você não pagar em dobro" — mesmo padrão do corte+pezinho (v29.43.6). Testado em produção.
- Agendamento do Luiz (sex 21/08 11h) corrigido: Corte + Barboterapia c/ ozônio, R$90, 70 min.

## 29.49.0 — Conclusão de atendimento com Pix antecipado não pergunta mais a forma de pagamento

Caso Frei Bartolomeu (19/08, ao concluir): já tinha pago adiantado no Pix (confirmado) e o modal de conclusão perguntou a forma de pagamento. Agora, quando `prepay_declared_at` + `prepay_confirmed_at` estão preenchidos, o modal abre com Pix pré-selecionado e a nota "💸 Este cliente já pagou antecipado no Pix" — dá pra trocar se preciso. Cache agenda.js → 29.49.0. Playwright 26/26.
## 29.48.0 / 29.48.2 — Alarme EKASA monitorado pela nuvem Tuya (tuya-watch) + card "Alarme" no admin + prova de vida diária

Pedido do Juliano (19/08): os sensores a pilha do alarme morreram sem aviso e o alarme armado não disparou. Sensores 433 MHz são "mão única" — nem a central nem a nuvem sabem se estão vivos; então o monitoramento é por **prova de vida** (último evento de cada sensor) + central offline + disparo + "Low Battery" no registro.

- **Vínculo**: app Ekaza (OEM) NÃO completa autorização por QR (expira ao confirmar) em Western America nem Central Europe; compartilhar dispositivo entre Ekaza e Smart Life falha ("conta não existe"). Solução: central "Barbearia" migrada pro **app Smart Life** (Desligar sem apagar dados → parear de novo; sensores e configurações preservados) e Smart Life vinculado ao projeto Tuya "Barbearia do Ju" (Western America, Access ID e94sgxw7uhynpqvhjy57). Pastrana e Itararé migram depois, uma por vez.
- **Function `tuya-watch`** (verify_jwt true + x-webhook-secret; cron `bdj-tuya-watch` */10 min): token HMAC, lista de centrais (`associated-users/devices`), shadow v2 (dp101 modo, dp103 alarme, dp116 último evento de sensor UTF-16BE, dp121 última ação, dp120 lista de sensores), logs v1 (online/offline/DP reports) → `alarm_hubs`, `alarm_events`, `alarm_alerts` + push (offline ≥12 min, sensor sem evento ≥ 8 dias, Low Battery, disparo). Segredos TUYA_* via `supabase secrets set --env-file`. Migration 123 (+ GRANTs 29.48.1 — de novo o 42501).
- **Admin**: card "Alarme" (modo atual, online, alertas) na visão geral; cache dashboard.js 29.48.0.
- Também: Notificação offline ligada no próprio app (paliativo independente do robô).

## 29.47.0 — Pix antecipado pelo WhatsApp: chave + valor, comprovante → push → confirmação (caso Frei Bartolomeu)

Primeiro cliente a pedir pra pagar adiantado pela JuIA (19/08, 13:08). Três buracos vistos ao vivo e fechados:
- **ju-ia-site**: pedido de chave Pix (ou "quero pagar adiantado") com agendamento futuro no número verificado vira resposta determinística: chave + **valor do agendamento** (serviço+produtos, dia/hora) + nome/instituição. Pedido de celular/outra chave segue com o modelo. Migration 122: `phone_upcoming_bookings` devolve preços e `prepay_declared_at`.
- **whatsapp-webhook**: comprovante (PDF/imagem) ou "já paguei" → marca `prepay_declared_at`/`prepay_key=picpay` (flag 💸 na Agenda, igual ao site), responde "recebi, o Juliano confere", push 💸 com valor. Foto sem legenda só conta como comprovante se a chave foi passada nos últimos 60 min.
- **prepay-confirm**: texto do "Pagamento confirmado" revisado.

## 29.46.0 — Câmera IP: contador de sessões na cadeira + card no admin

Pedido do Juliano (19/08): contar quantos clientes sentam na cadeira por dia (câmera IP da barbearia) e comparar com os atendimentos concluídos — precaução pra quando entrar a segunda pessoa e rede pra atendimento esquecido.

- **Câmera**: Xiongmai XM533 (iCSee), 192.168.15.5, RTSP `/onvif2` (TCP) + ONVIF 8899 (PTZ usado pra enquadrar cadeira + bancada + espera).
- **Contador** (fora do repo, no notebook da barbearia): `C:\Users\julia\barbearia-camera\chair_counter.py` — YOLOv8n pessoa, zona da cadeira em `zone.json`, sessão = cadeira ocupada ≥ 6 min, fecha após 2,5 min vazia; reflexo do espelho fica fora da zona. Só horários/contagem — nunca vídeo ou rosto. Credenciais em `%USERPROFILE%\barbearia-camera.env`. Inicia com o Windows (Startup\BarbeariaContadorCadeira.vbs), instância única (porta 47123). Testado ao vivo: Juliano na cadeira = verde "NA CADEIRA", reflexo = ignorado.
- **Banco** (migration 121): `chair_sessions`, `camera_heartbeat`, RPC `camera_ingest(p_secret, p_event)` (segredo `camera_ingest_secret` no Vault, chamada com anon), RPC `chair_day_summary(date)`.
- **Admin**: card "Cadeira (câmera)" na visão geral — sessões × registrados, estado do contador (heartbeat); fica em alerta quando diverge ou contador parado > 15 min. Cache: dashboard.js e style/admin-core 29.46.0.

## 29.45.0 — Plano do dia 19/08: cancelamento por número, mensagens picadas, confirmação com "como remarcar", balcão sem robô duplo, DM vazia repetida

Revisão diária da JuIA (regra de 18/08) + pedidos do Juliano no chat.

- **ju-ia-site** — caso Ricardo (19/08 08:08): "qual deles quer cancelar? 1/2" não guardava estado; o "1" ia pro modelo, que repetia a lista, e o anti-repetição soltava "me embolei". Agora `pending_cancel_options` guarda a lista; número, horário citado ("o das 8h") ou "não" são tratados; "cancela o das 08 horas" com 2 agendamentos cancela direto quando o horário casa com um só; `cancelAsk` aceita "cancela o/esse/pra mim". Testado em produção (5599900011234, dados apagados).
- **whatsapp-webhook** — `juiaAwaitingAnswer` reconhece `pending_cancel_options`. Caso Leticia (18/08 18:59): três mensagens picadas, cada uma chegando depois do buffer anterior ter sido limpo → as duas primeiras respostas descartadas como obsoletas (certo) e a terceira processada SOZINHA ("até um pouco antes dá certo") → JuIA perguntou período ignorando o "19h" dito antes. Agora, ao reivindicar o buffer, junta as mensagens de entrada sem resposta desde a última saída (3 min), exceto número solto.
- **booking-email** — confirmação/alteração pelo WhatsApp agora diz "Precisa remarcar ou cancelar? É só me responder aqui" + link de gerenciar (Ricardo não achou como mudar e duplicou o agendamento; a página meu-agendamento foi testada no celular e funciona).
- **satisfaction-dispatch / send-walkin-welcome** — robô redundante do balcão (2 Rafaéis, 18/08: boas-vindas 18:21 + comprovante 18:30). O convite "da próxima vez agende por aqui" virou uma linha dentro do comprovante (canal balcão); send-walkin-welcome é no-op (só envia com `force=1`).
- **meta-social-sync** — DM vazia (figurinha/mídia) repetida pela 3ª vez do mesmo perfil (psid 1061649352872645: 06/08, 08/08, 19/08) é arquivada como 'ignorado' sem push.
- Posts das 8h de 19/08 saíram sem arte (Gemini 500 ×2); arte refeita via `only_image` e aprovada no crivo.

## 29.43.8 — Card "Serviços feitos hoje" na visão geral

Pedido do Juliano (18/08): além de "Concluídos: 9 atendimentos", mostrar quantos SERVIÇOS foram feitos no dia (corte + barba conta 2). Novo card entre "Concluídos" e "Ticket médio", alimentado pela mesma contagem que já sustentava "Serviços/cliente". Cache do dashboard.js bumpado pra 29.43.8 em todas as páginas do admin.

## 29.43.7 — Pagamento antecipado na confirmação da JuIA (WhatsApp), de forma passiva

Decisão com o Juliano (18/08): não perguntar "quer deixar pago?" (rodada extra e cheiro de desconfiança); a confirmação do agendamento pelo WhatsApp ganha uma linha: *"Se preferir já deixar pago pelo Pix, é só me pedir a chave 😉"*. A JuIA já sabe passar a chave e avisar que o Juliano confere. Quando a allowlist do PagBank sair, vira link de pagamento na própria confirmação.

## 29.43.5 / 29.43.6 — Revisão de sexta a terça (14–18/08) + regra: corte já inclui o pezinho

**Revisão de todas as conversas do WhatsApp de 14 a 18/08** (pedido do Juliano depois do caso Adriano):
- **Cochicho "Ainda estou por aqui" depois de o Juliano se despedir** (Helder sex 12:59, Rafael Ferreira e Rafael sáb): a lista de encerramento do watchdog era curta demais. Regra invertida: só cochicha se a última frase do cliente parece precisar de resposta ("?" ou pedido); despedida/aviso/combinado não reabrem conversa.
- **"cê pinta cabelo aí?" / "qual o produto que passou no meu cabelo?" → "seria um Corte?"**: "cabelo" não é corte quando a frase é sobre coloração/química ou produto. E a trava anti-promessa só age em frases sobre horário (estava trocando "a pasta está disponível por R$ 36" por "ela vou conferir").
- **Sillas**: a segunda mensagem ("4") viu "conflito" com o agendamento que a própria conversa acabara de criar e perguntou "é esse, é novo, ou cancelar?". Agora: "Já está reservado 😊".
- **Helo**: ao incluir sobrancelha + barba (60 min) o 10:45 não cabia e a resposta era "acabou de ficar indisponível" (falso). Agora: "não fecha pra 60 min — o mais perto é 10:30, serve?".
- **Achado sem correção minha**: os 6 que responderam "1" à recuperação de segunda (17/08) não foram reconhecidos como pesquisa (RPC sem last_recovery_at) — outra janela corrigiu às 18:26 e marcou satisfeitos, mas nenhum recebeu o pedido do Google. Decisão do Juliano: **não reenviar** ("não quero parecer chato"); a próxima visita cuida.

**Regra de negócio (v29.43.6)**: todo corte já inclui o pezinho — nunca somar nem cobrar os dois. Aplicado na JuIA (limpeza antes de disponibilidade e fechamento, no "de sempre", no acréscimo a agendamento e no prompt), no catálogo (descrição do Pezinho) e em marketing_memory. Histórico do Alfredo (22/07) corrigido para Corte de cabelo R$ 40.

## 29.43.4 — Caso Adriano: número solto com pesquisa E convite pendentes agora pergunta, não chuta

Em 17/08 o convite de retorno (10:00:03) e a recuperação da pesquisa (10:00:04) saíram com 1 segundo de diferença; o "1" do Adriano foi lido como convite (reservou 11/09) quando era da pesquisa. A fila única (v29.43.0) já impede a colisão normal, mas dois crons no mesmo instante ainda podem sair antes de qualquer registro existir. Defesa em profundidade no webhook: se chega um 1/2/3 solto e há convite E pesquisa em aberto, a JuIA pergunta *"esse 1 é da pesquisa ou do retorno?"* e guarda o número; a palavra escolhida roteia o número pra pergunta certa (mesmo mecanismo da citação). Testado em produção com telefone fictício: "1" → pergunta; "pesquisa" → satisfeito + pedido do Google, convite intacto, nenhuma reserva criada. Crons já estão 2h separados (convite 10h, recuperação 12h).

## 29.43.3 — Bateria (parte 2, 31 cenários com agendamento existente): 3 correções, uma delas grave

- **BUG GRAVE**: a pergunta de conflito ("você já tem horário nesse dia — é esse mesmo, é um novo, ou cancelar o antigo?") reaproveitava o marcador de cancelamento, e um **"sim" seco cancelava o agendamento**. Agora a escolha é explícita (1 mudar / 2 manter os dois / 3 cancelar, ou as palavras); "sim"/"não" soltos repergunta com números e não cancela nada.
- "quero fazer sobrancelha **também, além do corte** que já marquei" caía como troca ("qual serviço no lugar?") ou como agendamento novo. Sinal de acréscimo + referência ao horário marcado = **incluir**: confirma "Corte + Sobrancelha (R$ 55, 40 min)" e grava o combo (nome composto, preço e duração somados).
- "esqueci de pedir o **óleo de barba**" abria o menu de serviços de barba — produto não é serviço.
- Lição de ferramenta: patch de código por  no bash come  das regex (vira byte 0x08, regex morta em silêncio). Sempre patch por arquivo .js.

## 29.43.2 — Bateria de testes da JuIA (123 cenários) + recuperação de pesquisa direto ao Google + JuIA Social sem eco

**JuIA Social (v29.43.1)** — o comentário da Nicole no IG (16/08) recebeu **11 respostas iguais** ao longo de 35h. Causa: o robô enviava pra Meta ANTES de gravar em social_inbox e a leitura de "quais já respondi" às vezes falhava em silêncio. Agora **reserva a linha primeiro** (unique em platform+kind+external_id — se já existe, pula), envia com try/catch por item, e só então atualiza. Reenvio automático não existe mais. As 10 duplicatas foram apagadas pela Graph API (ferramenta temporária, removida).

**Bateria (tests/juia, 123 cenários stateless em produção): 0 alertas automáticos, 6 problemas na leitura humana, todos corrigidos:**
- Menu "Mais procurados" atropelava resposta real ("atende mulher também?", "valor é por pessoa?", "minha namorada terminou comigo…") — só entra em pedido genérico de catálogo.
- "Para concluir, preciso de seu nome, seu WhatsApp, o serviço, a data, o horário." — virou frase de gente, e reconhece frustração ("CADÊ VOCÊS…" → "Calma que eu resolvo com você agora mesmo 🙏").
- "vaga de emprego" acionava o fluxo de agenda por causa de "vaga" — vai pro Juliano.
- "precisa agendar ou dá pra chegar e esperar?" / "só aparecendo?" — resposta fixa: hora marcada, sem fila, encaixe só se sobrar vaga.
- "vocês atendem hoje?" / "aberto ainda?" — agora abre com "Sim, hoje atendemos até 19h!" (ou fechado/já encerramos), aplicado no fim pra nenhum bloco sobrescrever.
- Datas em formato de sistema ("18/08/2026") — pós-processamento: hoje / amanhã / "sexta (21/08)".
- Prompt: inglês/espanhol → responde no idioma. Lista extra de horários ("tenho ainda: …") limitada a 3.

**Recuperação de pesquisa (survey-recovery, segunda 15h)** — pedido do Juliano: pedir avaliação do Google pra todo mundo. Cliente com **2+ visitas concluídas** (voltou = satisfeito) recebe o **link do Google direto** (rastreado, saída "1 = já avaliei"), sem passar pela pesquisa; cliente de 1 visita segue na pesquisa 1/2. Trava: sem novo pedido de Google em 30 dias. Simulação de 24/08: Rafael Ferreira e Dorta → Google; Sillas, Dirceu, Walisson → pesquisa. Migration 120 (customer_completed_visits, customer_google_ask_recent). Achado registrado: o "follow-up de 24h" citado no comentário do survey-recovery **não existe** — a régua real é dia 0 → segunda → opt-out.

## 29.44.0 — Central de Conteúdo: publicação agendada (o post sai sozinho na hora marcada)

Até aqui, todo conteúdo com hora certa ("Reel às 18h", "teaser sábado 17h30") dependia de alguém clicar na Central naquele minuto — e o lembrete por push tem atraso de até 9 min e só roda com o app aberto. Motivação concreta de 18/08: dois Reels de Resultado reais (degradê e texturizado) aprovados pelo Juliano no chat com "prossegue quando for a hora", pra sair terça 18h e sexta 18h.

- **Status novo `agendado` + coluna `scheduled_for`** em `content_posts` (migration 120; o check de status foi ampliado). Fluxo: rascunho → ⏰ Agendar → agendado → (cron) aprovado → publicado. Nunca se publica `rascunho` automaticamente — só o que foi agendado de propósito.
- **Function `content-publish-scheduled`** (verify_jwt=true; o pg_cron manda o anon key como Bearer e o `x-webhook-secret` do Vault, que é o que o código confere). Cron `bdj-content-publish-scheduled` a cada 5 min. Espelha o fluxo de publicação dos botões (Reel/foto/carrossel/Story do Instagram, vídeo/foto/texto do Facebook, Status do WhatsApp com lista explícita de contatos). Trava atômica agendado→aprovado; falha volta pra `rascunho` com `context.schedule_error` e push ❌; sucesso dá push ✅. Publica os vencidos em paralelo em segundo plano (Reel leva ~1-2 min na Meta).
- **Horário de silêncio respeitado**: Status do WhatsApp agendado pra 20h-8h fica esperando e sai na primeira rodada depois das 8h. Facebook/Instagram publicam na hora agendada.
- **Central**: card ganha "⏰ Agendar" (dia/mês hora:minuto, horário local) e, quando agendado, badge com a hora, "Publicar agora" e "Cancelar agendamento". Rejeitar também limpa agendamento. Os botões de publicar (`content-publish-meta`/`-whatsapp`) aceitam card `agendado` — o clique vence o agendamento.

Testado: rota do cron respondendo 202 com a autenticação real do Vault; 6 rascunhos agendados (3 pra 18/08 18h, 3 pra 21/08 18h) — o primeiro lote é o teste em produção.

## 29.43.0 — JuIA: fecha mais, incomoda menos (revisão das conversas de 15 a 18/08)

Pedido do Juliano em 18/08: revisar todas as interações da JuIA desde sábado e corrigir na raiz. Sábado 15/08 tiveram 12 conversas de cliente novo e **3 fecharam** — pelo menos 5 das perdidas foram culpa direta da JuIA. Cada correção abaixo tem o caso real que a motivou.

**Perda de agendamento (ju-ia-site):**
- **"Deixa eu conferir a agenda certinho antes de confirmar"** (Bruno esperou 2h30, Luis idem): era o prefixo da trava anti-promessa. O cliente lia como "ela vai voltar com a resposta". Agora a frase nomeia o que falta e devolve a bola: *"Qual serviço você tem interesse? Assim já confiro…"*.
- **"Barba e cabelo" virava só corte** (Luis): a pergunta "qual barba?" era montada e, na sequência, o bloco de retomada forçava `availability` por cima — listava horários só de corte e a barba sumia. A pergunta da barba agora tem prioridade (`!bareBarbaAsk` em três pontos) e já avisa que o horário vem em seguida.
- **10 horários numa linha** (Luis recebeu 10, Aline 8; nenhum respondeu): acima de 4 vira faixa + 4 exemplos espalhados.
- **"Apenas cabelo" gerava a pergunta "seria um Corte de cabelo? ou Corte + Lavagem?"** (Bruno, mais uma rodada): assume Corte de cabelo e segue pro horário, com nota de uma linha sobre a lavagem.
- **"Mas deixa, qlq coisa vou semana que vem"** recebia a lista de horários de novo (Bruno, papagaio): sinal de adiamento agora responde com simpatia e abre a porta pra reservar na semana que vem.
- **"O seu de sempre" pegava o complemento, não o serviço** (Alfredo, 17/08: histórico "Corte de cabelo + Pezinho" → assumiu Pezinho, 10 min, e reservou sem perguntar). O casador de nome escolhia o componente de nome mais parecido em tamanho. Agora quebra o histórico nos componentes e assume todos; se só sobrar complemento (≤15 min), pergunta.
- **"Oi, 🤓!"**: nome do WhatsApp sem letra não é nome. Ignorado.

**Redundância e ruído (webhook + robôs):**
- **Resposta em dobro** (Guilherme Silva, 17/08, 18:43: três mensagens picadas → duas respostas em 6s): a checagem "o cliente escreveu de novo?" só existia nas respostas curtas; a resposta principal da IA saía sem ela. Agora vale pra todas.
- **"Recebi sua foto, mas não consegui identificar…"** saiu 5x pro mesmo número e, no caso Guilherme (18/08, 09:19), entre o "1" da pesquisa e o agradecimento. Suprimido quando o cliente mandou texto nos últimos 2 min ou quando o mesmo aviso saiu há menos de 30 min.
- **Confirmação de presença 3h depois de marcar** (Nuno: marcou 16:37 pra amanhã, "confirma?" às 19:45; Alfredo disse "amanhã tô aí" e levou o pedido às 8h). RPC `bookings_due_for_confirmation_request` só devolve agendamentos feitos com **≥ 36h de antecedência** — o pedido nunca chega menos de 12h depois de o cliente marcar.
- **Convite de retorno "daqui a 4 semanas" pra quem vem toda semana** (Luiz André: cadência real de ~9 dias, convite pra 11/09, respondeu "agora não"). Nova função `customer_visit_cadence_days` (mediana dos intervalos, telefone normalizado — o mesmo cliente aparecia com e sem o 55 e o histórico ficava partido); o convite mira 1/2/3/4 semanas conforme a cadência.
- **Fila única de perguntas numeradas** (`juia_pending_numeric_question`): pesquisa (1/2), recuperação de pesquisa, convite (1/2/3), confirmação (1/2/3) e follow-up 2 de lead (1-4) agora conferem, antes de enviar, se o telefone já tem outra pergunta sem resposta. Se tem, esperam o próximo cron. É a regra do Juliano: "não tem como mandar outra mensagem enquanto o cliente não responder a pesquisa" — o "1" respondia a pergunta errada.

Migration 119. Deploy pela CLI (7 functions, verify_jwt preservado). Testado em produção com telefones fictícios (5511990000801/802) nos 5 cenários — barba+cabelo, listagem, adiamento, "de sempre" com combo, cabelo solto — e dados apagados depois. Deno check: 0 erros novos (os 2 `pitch` já existiam).

**Ainda em aberto**: o modelo às vezes escreve a data no formato de sistema ("para 18/08/2026") apesar do prompt; a lista de horários da resposta ao "horário X ocupado" ainda pode chegar a 8 opções.

## 29.42.0 — O Google matou o Q&A do perfil, e o conteúdo mudou de endereço

Recomendação minha que envelheceu mal: mandei publicar 12 perguntas no Q&A do Perfil da Empresa. **O Google descontinuou o recurso em 03/11/2025** e os tópicos públicos sumiram a partir de dezembro — confirmado no changelog da própria API. Não existe mais onde publicar. O Google passou a gerar resposta por IA puxando do site, então o conteúdo continua valendo; mudou o lugar dele.

- **`perguntas-frequentes.html`** com 23 perguntas agrupadas por tema (preço, agendamento, localização, barba e química, produtos), `FAQPage` batendo 23/23 com o visível. É superconjunto do FAQ da home — que continua com as 12 curtas, porque ali a função é conversão, não indexação. Linkada da home, do hub de serviços e no sitemap.
- Ressalva honesta: **isso não gera o acordeão de FAQ no resultado de busca.** O Google restringiu esse rich result a sites de governo e saúde em 2023. O valor aqui é ser a fonte densa de onde a IA puxa quando alguém pergunta algo sobre a barbearia.
- **Correção de bug da 29.40.0:** `guia-barba-masculina.html` nunca entrou no sitemap. O script casava um formato de linha que não existe no arquivo e **falhou em silêncio** — imprimiu "adicionada" sem ter adicionado. A página estava no ar e linkada, mas invisível pro sitemap por um dia. Agora 51 URLs.

**Registro do Google Business Profile nesta rodada:** 10/10 serviços personalizados criados com preço Fixo (o seletor grava "A partir de" mesmo quando se clica em "Fixo" — só o teclado acerta), endereço público corrigido com a saída do " - 1" que divergia do site e do schema, 4 fotos de resultado sem rosto e 1 postagem com botão "Reservar" e link com UTM (`utm_medium=gbp`, para separar post de tráfego de Maps no GA4).

**Categorias secundárias ficaram vazias de propósito.** "Barbeiro" e "Salão de beleza masculino" não existem na lista do Google em português; as alternativas eram falsas (Escola de barbearia, Loja de produtos para barbeiro) ou mais genéricas que a principal (Salão de Beleza). Categoria falsa é pior que categoria ausente — se uma auditoria futura apontar isso como pendência, está errada.

## 29.41.0 — Quatro artigos com referência real, no território que só nós temos

Os quatro que ocupam o terreno que nenhum concorrente de Bragança consegue disputar, porque exigem as duas formações. **Todas as referências foram levantadas na fonte** — PubMed e canais oficiais da ANVISA — com DOI ou link direto, e nenhuma foi escrita de memória.

- **`blog-barba-falhada.html`** — por que a barba falha. Sustentado em dois trabalhos: o do *FASEB Journal* que cultivou folículos humanos e mostrou que folículos **geneticamente idênticos** respondem de formas diferentes ao mesmo androgênio conforme a região ([10.1096/fj.201700260RR](https://doi.org/10.1096/fj.201700260RR)), e o do *J Invest Dermatol* sobre regulação local da sensibilidade androgênica ([10.1038/sj.jid.5700883](https://doi.org/10.1038/sj.jid.5700883)). Conclusão que dá para dizer em voz alta na cadeira: a distribuição da barba foi decidida antes de o cliente ter opinião sobre ela — não é falta de cuidado.
- **`blog-pigmentacao-barba-como-funciona.html`** — o dado forte é de 2025: série de casos na *Contact Dermatitis* com produto **rotulado como "livre de PPD"** que, em análise química, continha PPD acima do limite ([10.1111/cod.14813](https://doi.org/10.1111/cod.14813)). Somado ao levantamento do NACDG, em que 5,6% dos testados reagiram à PPD ([10.1016/j.jaad.2020.10.086](https://doi.org/10.1016/j.jaad.2020.10.086)). É o que justifica o teste 48h antes deixar de ser formalidade.
- **`blog-platinado-masculino-o-que-acontece-com-o-fio.html`** — explica por que cabelo descolorido fica elástico e quebra, com o estudo de microscopia eletrônica e proteômica redox que mediu a conversão de pontes dissulfeto de cistina em **ácido cisteico** ([10.1111/ics.12495](https://doi.org/10.1111/ics.12495)).
- **`blog-quimica-capilar-masculina-seguranca.html`** — o mais valioso comercialmente, porque é local e regulatório. Baseado no **Informe de Segurança GGMON nº 03/2025 da ANVISA** (07/07/2025), buscado direto na fonte: formol é permitido só como conservante até 0,2% (concentração em que **não alisa**), e **o ácido glioxílico também está entre os não permitidos para alisamento** — o que derruba o argumento de "alternativa segura ao formol" que ainda se vende por aí.

Os quatro entraram no sitemap, nos cards e no schema do blog, e a **pilar da barba teve seus ganchos de texto convertidos em links** agora que os artigos existem. CTAs usando `?servico=` com slug validado contra o catálogo real.

Corrigido também um teste **flaky**: `service_selected` falhava de forma intermitente porque o hook instalado via `evaluate()` morria no reload que o service worker dispara sozinho. Passou a usar `addInitScript` + `sessionStorage`, que sobrevivem à navegação. Rodado 3x isolado e na suíte completa.

`npm test`: 17 unit + 46 e2e. 0 JSON-LD inválido, 0 links quebrados.

## 29.40.0 — Guia da barba como página pilar, e o Wi-Fi/Pix sai da home

- **`/guia-barba-masculina.html`**: a página pilar que faltava. Os 7 artigos de barba existiam soltos — bons, mas sem hierarquia, cada um competindo sozinho. Agora o guia organiza o assunto inteiro (formato, falhas, encravado, irritação, produtos, manutenção), aponta para cada artigo **e** para os 5 serviços de barba, e os 7 artigos apontam de volta. Isso é o que transforma uma pilha de posts em autoridade temática. Com `Article` schema, FAQ de 4 perguntas e fontes citadas (SBD e DermNet).
- **`/na-barbearia.html`**: Wi-Fi e Pix saíram da home. Ocupavam uma dobra inteira entre o visitante vindo do Google e a decisão de agendar, sendo que são utilidades de quem **já está na cadeira**. ⚠️ **Mudei de destino em relação ao que eu mesmo tinha recomendado**: a auditoria dizia mandar pra `/cliente.html`, mas aquela é a "Minha Área", que pede WhatsApp e consulta fidelidade — enterrar a senha do Wi-Fi atrás de um formulário piora a vida de quem está sentado esperando. A página nova é `noindex` (não tem intenção de busca) e serve para QR Code na parede. Fica linkada na home por um card discreto.
- **`og:title` e `twitter:title` do blog** ainda diziam "Centro de Conhecimento" — o rewrite da 29.37.0 trocou só a tag `<title>`. Corrigido, e a pilar entrou no `CreativeWorkSeries` e no `ItemList` da página.

`npm test`: 17 unit + 46 e2e. 0 JSON-LD inválido, 0 links quebrados.

## 29.39.0 — Popup que não bloqueia, pré-seleção de serviço, avaliações reais e FAQ

- **O popup de boas-vindas parou de brigar com o próprio objetivo.** Era um modal com fundo escuro cobrindo a tela, aberto 1,2s depois do load, e **interceptava o clique no CTA do hero** de quem chegava pela primeira vez — um popup que existe pra incentivar agendamento e bloqueia o agendamento se anula. Virou card ancorado embaixo, sem fundo bloqueante, que **só aparece depois que a pessoa rola além do hero sem ter clicado em agendar**: pega justamente quem não converteu de primeira. Quem clica no CTA antes de rolar nunca vê. Mantido o limite de 1 exibição a cada 30 dias.
- **`?servico=slug` pré-seleciona o serviço.** As 24 páginas de serviço agora levam pra `/agendar/?servico=...` e o cliente cai no catálogo com o item já no carrinho, em vez de procurar na lista o que acabou de ler. Casa por slug do `data-name` (sem acento), pra não depender de o link repetir nome com pontuação e maiúsculas. ⚠️ **Bug pego em teste:** o service worker recarrega a página no `controllerchange` e o carrinho persiste — sem guarda, a segunda carga somava o mesmo serviço de novo e o cliente via *2x Barboterapia, R$ 80* sem ter pedido. A pré-seleção é idempotente agora.
- **Bloco de 6 avaliações reais na home.** Transcrições literais de avaliações públicas do Google, com nome. Antes a única prova social era o rating-strip com 2 frases e um link que mandava o visitante **pra fora do site** bem na hora da decisão. O link continua, como verificação. **Sem `AggregateRating` no schema** — a nota é do Google, autodeclarar violaria as diretrizes.
- **FAQ da home foi de 8 para 12 perguntas**, com preço, duração, sábado e crianças — as que têm busca real. Visível e schema batendo item a item.
- **Não mexi na "canibalização" da barboterapia.** Reavaliando com o código na mão: das 10 menções na home, só ~4 são texto visível — o resto é meta e schema, todas legítimas. Tirar a palavra da home enfraqueceria a home sem fortalecer a página de serviço. O que resolve é link interno com âncora comercial, que já foi feito no blog e agora também no card da home.

⚠️ **Achado ainda em aberto:** `corte infantil` e `raspar a cabeça` têm página própria mas **não existem como item no catálogo de agendamento** (20 itens para 24 páginas). O cliente lê sobre e acaba marcando "Corte de cabelo" — mesmo preço e duração, mas a agenda não registra o que ele veio fazer.

`npm test`: 17 unit + 46 e2e.

## 29.38.1 — A instrumentação existia e não chegava: tag no GTM, cache e cobertura

A v29.38.0 instrumentou o código, mas ao verificar no site publicado o evento **não apareceu**. Três causas independentes, todas encontradas na conferência:

- **O GTM não tinha tag pra quase nada.** O container tinha 3 tags: a do Google, `booking_confirmed` e `clique_whatsapp`. Todo o resto que o site empurra pro dataLayer há meses — `date_selected`, `time_selected`, `upsell_service_added`, `product_added_booking`, `checkout_opened`, `pix_*`, `gift_*` — era descartado. Criado o acionador **"Eventos do funil (dataLayer)"** (evento personalizado com regex) e a tag **"GA4 - Eventos do funil"**, que encaminha `{{Event}}` com `value` e `currency`. Publicado como Versão 12. `booking_confirmed` ficou **de fora do regex de propósito**: já tem tag própria e entraria duplicado.
- **Cache serviu o arquivo velho.** Os scripts são versionados por query string e eu editei `script.js` e `service-cart-v22-5.js` **sem bumpar o `?v=`** — navegador e service worker continuavam entregando a versão anterior, e o evento novo simplesmente não existia na página. Ambos foram para `?v=29.38.0`. É o tipo de erro que não aparece em teste local, só no site publicado.
- **O listener cobria 3 páginas de 37.** `clique_agendamento` nasceu dentro do `script.js`, que só é carregado em `index.html`, `produtos.html` e `agendar/index.html`. **As 34 páginas de serviço, blog e o hub — exatamente o tráfego de SEO que queremos medir — não disparavam nada.** Extraído para `funnel-events-v29.js`, com guarda contra dupla inclusão, e incluído em todas as páginas públicas.

Três testes novos em `analytics.spec.js` cobrem o CTA a partir de página de serviço, do hub e de artigo do blog — que era o buraco. `npm test`: 17 unit + 40 e2e.

⚠️ Segue pendente a decisão sobre o popup de boas-vindas, que intercepta o clique no CTA do hero para quem chega pela primeira vez.

## 29.38.0 — O funil tinha fim mas não tinha começo: instrumentação da entrada

Antes de mexer, fui olhar o que já existia no GA4 — e o quadro era diferente do que eu tinha suposto na auditoria.

**O que já estava certo:** o `agenda-v15.js` já empurra um funil rico pro dataLayer (`date_selected`, `time_selected`, `upsell_service_added`, `product_added_booking`, `checkout_opened`, `pix_*`, `booking_confirmed`) e o `vale-presente-v29.js` faz o mesmo pros vales. `booking_confirmed` e `clique_whatsapp` chegam no GA4 e estão marcados como eventos principais.

**O que estava quebrado:**

- **`clique_agendamento` estava declarado como evento principal no GA4 e nenhuma linha do site disparava.** Tínhamos o fim do funil sem o começo — e sem o começo não existe taxa de conversão, só contagem de agendamentos. Agora um listener delegado no `script.js` dispara na entrada do funil, com `origem_pagina` e `posicao_cta`. **Cliques feitos de dentro de `/agendar/` são ignorados de propósito**: contar "Ir direto à agenda" como entrada inflaria o topo e faria a taxa parecer pior do que é.
- **A etapa 1 (escolher o serviço) era invisível.** O `service-cart-v22-5.js` não tinha `fire()` nenhum: existia `upsell_service_added` para os adicionais, mas nada para a escolha principal. Agora dispara `service_selected` (nome e valor) e `checkout_step_horario` (serviços, total e quantidade) antes do redirect.
- **Teste que faltava.** `clique_agendamento` ficou morto sabe-se lá quanto tempo porque nada verificava. `tests/e2e/analytics.spec.js` cobre os quatro casos, incluindo o negativo (clique interno **não** conta como entrada).

⚠️ **Achado de conversão, ainda não resolvido:** o teste do CTA da home só passou depois de fechar o popup de boas-vindas — ele aparece 1,2s após o load e **intercepta o clique no botão principal do hero** para quem chega pela primeira vez. Ou seja, o visitante novo vindo do Google encontra um popup entre ele e o agendamento. Precisa de decisão: adiar, reposicionar ou remover.

⚠️ **Falta a metade do GTM.** Todos esses eventos vivem no dataLayer; quem os leva pro GA4 é a tag no GTM, e hoje só existe tag para `booking_confirmed` e `clique_whatsapp`. Sem isso, o que foi instrumentado aqui continua sendo descartado.

## 29.37.0 — Hero com preço e garantia, página-mãe de corte, e titles reescritos

Segunda rodada da auditoria. O Juliano apontou, com razão, que a primeira só tinha atacado a camada estrutural. Conferindo o resto item a item, **mais coisas já estavam prontas**: `Article` schema com `datePublished`/`dateModified` **e** as datas visíveis no HTML dos posts, que eu tinha listado como pendência.

- **Hero da home refeito.** Três informações que decidem a escolha estavam abaixo da dobra: o preço (R$ 40), a garantia de ajuste em 7 dias e o fato de o barbeiro também ser farmacêutico. Subiram. E os **4 CTAs de peso igual viraram 2** (Agendar + WhatsApp) — "Ver produtos" e "Blog" saíram do hero porque competiam com o agendamento e já estão linkados em card próprio e em seção dedicada mais abaixo, então nada ficou inacessível.
- **`servico-corte-masculino.html`**, a única lacuna real de página que sobrou. Não é mais uma página de corte: é a **mãe** das cinco que já existiam (degradê, social, infantil, raspar, corte+lavagem), com o conteúdo que nenhuma delas tinha — o que está incluso nos R$ 40, como pedir o corte sem errar, de quanto em quanto tempo voltar. Sem isso seria só canibalizar o degradê, que é o erro que a própria auditoria mandava evitar.
- **Titles e metas reescritos** em home, blog, produtos e sobre-o-juliano, nos três lugares de cada uma (`<title>`, `og:title`, `twitter:title` e as descriptions). Todos dentro do limite. O da home passou a carregar "Centro" e "Hora Marcada"; o do blog trocou "Centro de Conhecimento" — nome bonito, zero busca — por "Cuidados com Barba e Cabelo Masculino".
- **`VERSAO.md` estava em 29.26.0** enquanto o CHANGELOG ia em 29.35.0. Nenhum arquivo lê esse `.md` (só documenta), então foi sincronizado. ⚠️ **`admin-version.json` NÃO foi tocado**: os `29.12.0` dele e da constante `ADMIN_VERSION` casam de propósito — é a comparação que decide se o painel aberto há horas se recarrega sozinho. Mexer ali sem bumpar os dois juntos forçaria reload em cima de atendimento.

Validado: 17 unit + 33 e2e passando, 0 JSON-LD inválido em 26 páginas, 0 links quebrados, 0 órfãs, 24/24 no `ItemList` do hub.

## 29.36.0 — Seis páginas de serviço estavam órfãs, e o blog não levava a lugar nenhum

Auditoria de SEO feita com três modelos (GPT, Gemini e Claude). Boa parte do que as três apontaram **já estava feito** — schema `LocalBusiness`+`HairSalon` correto, `fetchpriority`/`poster`/`lazy`/`width`/`height` nas imagens, 23 páginas de serviço com preço, FAQ e autor. O que sobrou depois de conferir arquivo por arquivo foi isto:

- **6 páginas de serviço não recebiam um único link interno**: `barboterapia-ozonio` (R$ 50), `corte-mais-lavagem` (R$ 50), `aparacao-corporal` (R$ 120), `pigmentacao-capilar` (R$ 50), `raspar-a-cabeca` e `freestyle-risquinho`. Existiam, estavam no sitemap e ninguém apontava pra elas — o Google chega pelo sitemap, mas não distribui autoridade pra página que nada linka. Outras 8 tinham só 1 link.
- **`servicos.html` era um stub de redirect `noindex` com zero links de entrada.** Virou o hub real: `CollectionPage` + `ItemList` com os 23 serviços agrupados por categoria, preço e duração. Resolve as órfãs e cria uma página indexável para "serviços de barbearia em Bragança Paulista", sem precisar de landing page por bairro — que seria doorway page.
- **8 dos 12 artigos do blog não linkavam pra nenhuma página de serviço.** Um artigo sobre barba encravada que não leva à barboterapia é tráfego que não vira cliente. Cada um recebeu o link do serviço correspondente, com âncora comercial.
- **`/index.html` → `/` em 29 links internos.** Duas URLs pra mesma página dividem o link equity da página mais importante do site.
- **`geo` no schema da home.** As coordenadas foram tiradas do place real do Google Maps (`-22.9540382, -46.5420126`) — as que dois dos modelos "estimaram" erravam ~150 m.
- **Bug pego de raspão na verificação de links:** `/agendar/horario/` linkava `produtos.html` em caminho relativo, resolvendo pra `/agendar/horario/produtos.html`. Link quebrado, na etapa final do funil, onde é oferecido o upsell de produto. Agora é `/produtos.html`.

⚠️ **Um alarme falso que vale registrar:** a auditoria inicial marcou como P0 um possível loop entre `/agendar/#servicos` e `/agendar/horario/`. Não existe — `/agendar/` renderiza o catálogo pra carrinho vazio e `/agendar/horario/` tem estado vazio tratado ("Nenhum serviço selecionado"), o que o `routes.spec.js` já cobria. O erro veio de auditar por rastreamento externo em vez de ler o código.

Validado com `npm test`: 17 unit + 33 e2e passando, 0 links internos quebrados, 0 páginas de serviço órfãs.

## 29.35.0 — Reprecificação com base no preço público do fabricante, e a fibra vira serviço

Pergunta do Juliano que derrubou a primeira proposta: *"o cliente vai no mercado livre e compra tudo pelo preço que eu também compro"*. Ele estava certo — e a proposta anterior, de subir os cosméticos, colocaria vários itens 30–45% acima do que o cliente acha em três toques no celular.

- **A regra passou a ser assimétrica**, porque os dois grupos não são comparáveis. **Cosmético é conferível**: preço = referência pública do fabricante + prêmio de conveniência (leva agora, sem frete), nunca acima de ~15%. **Bebida não é conferível**: ninguém compara preço de energético com sede, sentado na cadeira — margem alvo ~50%, referência é o mercado da esquina. Em resumo: **subir onde ninguém compara, segurar onde todo mundo compara.**
- **Correções que só apareceram com a pesquisa** (sharkbarber.com.br vende direto ao consumidor, com 10% no Pix): fibra capilar **90 → 85** (estava 37% acima do fabricante, 52% acima do Pix dele; R$ 85 equivale ao preço do site + frete, então é defensável em voz alta); **pomada em pó 35 → 38** e **Caspbell 42,99 → 48**, que estavam *abaixo* do mercado — dinheiro deixado na mesa; **Pasta Matte 34 → 36**, abaixo do próprio fabricante.
- **Leave-in 44,99 → 33 é alerta de COMPRA, não de preço.** O custo (26,90) é praticamente o que o consumidor paga no Pix do fabricante (26,91): não há espaço de revenda. E-mail enviado à Shark Barber pedindo tabela de atacado do item, que não aparece na página de atacado deles.
- **Serviço novo: "Aplicação de Fibra Capilar", R$ 30 / 15 min.** A jogada para vender *mais* fibra, não mais caro: serviço não tem página no Mercado Livre para comparar, o insumo por aplicação custa ~R$ 2,50 (pote de 25g rende ~15) e quem gosta do resultado leva o pote. Deixa de ser uma venda de R$ 85 uma vez e vira recorrência.
- Margem média subiu de 45% para **50%**, com quase todo o ganho vindo de onde o cliente não compara.
- **Sincronizados os três lugares onde o preço vive**: tabela `products`, `products-catalog-v1.js` e `produtos.html`. ⚠️ Bug pego na conferência final: o script de sincronização gravou `data-price="8,00"` (vírgula, locale pt-BR do PowerShell) em 13 produtos — `Number("8,00")` é `NaN`, e o carrinho somaria errado com o preço *certo* aparecendo na tela. Refeito em Node, com verificação independente card a card.

## 29.34.0 — Preço e custo editáveis no painel, com botão de gravar

Dois pedidos do Juliano depois de digitar os 26 custos: faltou um botão de gravar, e faltou poder reajustar preço sozinho.

- **Salvamento visível.** A versão anterior salvava ao sair do campo e funcionava — os 26 custos entraram certinho — mas ele digitou tudo sem nenhum sinal de que tinha gravado, e **salvamento invisível é indistinguível de salvamento que não aconteceu**. Agora as alterações ficam pendentes, o botão mostra quantas são, o campo salvo fica verde e a mensagem diz quantos foram e a que horas.
- **O lucro recalcula enquanto se digita** e fica vermelho se o preço cair abaixo do custo. A RPC recusa esse caso: erro de digitação viraria cota-parte sobre lucro negativo e só apareceria no fechamento da semana.
- **O preço vivia em DOIS lugares** — a tabela `products` e o `products-catalog-v1.js`, que é o que o site, a agenda e o balcão realmente leem. Liberar a edição só no banco deixaria o cliente pagando um valor e o sistema calculando outro, com a diferença caindo no repasse do parceiro. O catálogo estático passou a **buscar os preços da tabela ao carregar** e atualizar o array in-place: como todos os consumidores leem o mesmo `window.BDJ_PRODUCTS`, isso alcança os cinco sem tocar em nenhum. A lista do arquivo continua como **fallback** — se a rede cair, vende pelo preço de ontem em vez de não vender.

## 29.33.0 — Recibo de quitação do repasse

Pedido do Juliano: *"caso ele venha a alegar que não o pagamos"*. O comprovante do Pix prova que saiu dinheiro da conta; **não prova que aquele dinheiro se refere àquela semana e àquele extrato**. Quem fecha essa lacuna é a quitação dada pelo próprio profissional, com o extrato à vista.

- Marcar como pago **emite o recibo numerado** (`BDJ-R-2026-0001`), congela o extrato num snapshot, calcula o SHA-256 do conteúdo e manda o link no WhatsApp dele. Ele abre no celular, confere o detalhamento completo e confirma.
- **O extrato inteiro aparece antes do botão.** Recibo que só diz "você recebeu R$ X" não protege ninguém — nem ele, nem a barbearia.
- **O hash sela o conteúdo conferido**: sem ele, sobra espaço para alegar que o extrato mudou depois da confirmação.
- **A quitação só registra uma vez.** Reconfirmar não move a data original, que é o dado com valor probatório (testado: segunda tentativa não sobrescreve IP nem horário).
- Só o **hash** do token fica no banco; o token vai no link. Emitir e enviar são separados: se a Evolution estiver fora, o recibo já existe e o link volta na resposta.
- ⚠️ **Fix v29.33.1**: revogar `EXECUTE` de `PUBLIC` derrubou também o `service_role`, que acessava por ali. Além do recibo, isso teria quebrado `record_booking_shares` na conclusão do atendimento — **e em silêncio**, porque aquela chamada só loga o erro para não travar o atendimento: a cota-parte não seria gerada e ninguém notaria até a semana fechar vazia. É o espelho do bug das migrations 087/088.
- ⚠️ **Fix v29.33.3**: a v29.32.0 criou uma tabela `payment_method_fees` sem verificar que **`finance_fee_rates` já existia** desde 09/08, preenchida pelo Juliano no Financeiro (crédito 4,61%, débito 2,12%, Pix 0%). Ele percebeu ao ver o painel pedir as taxas de novo. Duas tabelas de taxa é como divergência nasce: reajusta num lugar, o repasse continua calculando pelo outro, e o erro aparece no bolso do parceiro. Tabela duplicada removida.

## 29.32.0 — Fase 1 do sistema do 2º profissional: cadastro, cota-parte e fechamento

Até aqui o banco não sabia **quem** atendeu: `bookings` guardava serviço, valor e cliente, e o barbeiro era implícito porque só existia um.

- **Migration 113**: `professionals` (com `share_percent` **por pessoa**, e não constante no código — permite acordo diferente sem migration), `bookings.professional_id` com backfill dos 142 atendimentos históricos para o dono, e `products.cost_price`. RLS fechada em `professionals`: a tabela guarda CPF, CNPJ e chave Pix.
- **Migration 114 — a conta corrente**: `professional_ledger` (crédito = cota-parte, débito = consumo e ressarcimento) com a **memória de cálculo gravada em cada linha** — bruto, taxa, custo, base, percentual. Numa relação em que o dinheiro passa todo pela mão de um dos dois, "confia em mim" não é resposta.
- **Espécie não entra na conta corrente**, de propósito. Pela Cláusula 4.5 do contrato v2.0 (decisão do Juliano, revertendo a v1), tudo é entregue no mesmo dia: o sistema apura **quanto** entregar e registra a conferência, sem misturar adiantamento com receita da casa.
- **Regras do contrato codificadas, e não deixadas na memória de alguém**: base = pago menos a taxa da maquininha, só isso (3.1.1); produto rateia **lucro**, não faturamento (3.2); cortesia comercial paga cota normal, refação por erro próprio não (10.2); fidelidade e vale-presente não reduzem a cota (10.3); todo débito é discriminado e contestável antes de ser compensado (4.6).
- **Produto sem custo cadastrado entra como pendência com valor zero**, em vez de virar cota sobre o preço cheio — que pagaria ao profissional o dinheiro gasto na compra.
- **A cota é gerada na conclusão do atendimento**, e não numa rotina noturna: é neste instante que existem juntos o valor final, a forma de pagamento e os produtos. Idempotente por índice único — reabrir e concluir de novo não paga duas vezes.
- **Aba Equipe** no painel: extrato com memória de cálculo, fechamento que **passa por conferência antes do pagamento**, cadastro, e o **encerramento com um clique** que o Juliano pediu — com aviso explícito de que o acesso cai e o histórico fica (é ele que comprova os repasses feitos).
- Validado com cenário real e revertido: corte de R$ 40 no crédito a 3,5% → base 38,60 → cota 19,30; produto de R$ 36 com custo 18 → lucro 16,74 → cota 8,37; consumo de item de R$ 35 com custo 18 → cobrado 26,50; barba de R$ 30 em dinheiro → R$ 30 na entrega de espécie.

## 29.31.0 — Conteúdo de domingo e segunda, e o bug que escondia a direção de arte

Pedido do Juliano: aproveitar os valores de domingo (missa, descanso, família) e de segunda no marketing, com post **todos os dias** — inclusive nos dois em que a barbearia está fechada. Perfil que some perde alcance, e some justamente quando o cliente está em casa, com o celular na mão.

- **O bug (v29.31.6), encontrado depois de CINCO artes de domingo saírem escuras**: a direção de arte de domingo existia e estava correta, mas **nunca era acionada**. O gatilho é a palavra "domingo" dentro do `themeText`, e nenhum caso do switch a produzia — domingo caía no texto genérico ("acolhimento, café, poltrona, ambiente premium"), que é exatamente a imagem escura com poltrona e xícara que voltava toda vez. Não era o modelo desobedecendo o prompt; era **o prompt certo nunca chegando ao modelo**.
- **Modo `only_image`**: refaz só a arte dos rascunhos do dia e preserva a legenda. Nasceu de um caso concreto — a frase de domingo saiu do jeito que o Juliano queria e a arte não. Regerar o dia inteiro jogaria fora um texto aprovado, e **texto bom é mais raro que arte boa**.
- **Trava contra texto vazio**: em dia emocional a legenda passa por modo exigente (três versões, escolhe a melhor) e é reprovada se cair em clichê, repetir "domingo" três vezes ou revelar a data de fundação da barbearia. Link de agendamento não entra em dia emocional — em post que fala de descanso, link é cobrança.
- **Regra permanente de arte**, a pedido do Juliano: nada imoral, ilegal ou inapropriado para qualquer público — sem bebida alcoólica, cigarro ou objeto que os sugira, em nenhuma arte.
- **Marcação das contas pessoais** (@julianoblpadilha e @nicolefpadilha): na legenda via `content-generate-daily` e **na foto** via `user_tags` da Graph API em `content-publish-meta` — a marcação na foto é a que coloca o post na aba "Marcados" e dá o caminho curto pro repost no story. Só em foto de feed (story e Reels usam outro formato). Se a Meta recusar as tags, publica sem elas: post no ar sem tag é contorno; post que não subiu por causa de uma tag é prejuízo.

## 29.26.0 — Janela de contato da JuIA: domingo, feriado e sábado após 15h também são silêncio

Pedido do Juliano (16/08): a guarda de 20h–8h da v29.21.0 virou uma **janela de contato** completa. A JuIA só **inicia** conversa **seg–sex 8h–20h** e **sábado 8h–15h**; **domingo e feriado, nunca**. Responder a quem escreveu continua liberado a qualquer hora — silêncio é sobre não incomodar, não sobre deixar cliente falando sozinho.

- **Migration 109**: tabela `holidays` (nacionais 2026–2027 já cadastrados) + `juia_quiet_now()` e `juia_next_send_time()`. A regra passou a viver **em um lugar só**, no banco. ⚠️ **Faltam os feriados municipais de Bragança Paulista** — o Juliano precisa conferir e cadastrar; não inventamos data de feriado.
- **Migration 110 — a decisão de arquitetura**: em vez de repetir a regra dentro de nove Edge Functions (e redeployar todas a cada ajuste), a guarda entrou no **próprio agendador**. Os 7 crons proativos viraram `select case when not juia_quiet_now() then net.http_post(...) end` — se não é hora de falar, a function **nem é chamada**: mais barato, imediato (sem deploy) e auditável num lugar só. Idempotente, não embrulha duas vezes.
- **Ficaram deliberadamente SEM guarda**: `bdj-booking-confirmation` (confirmação é resposta a uma ação do cliente) e `Satisfaction Dispatch` (comprovante/pesquisa logo após o atendimento — o cliente acabou de sair da cadeira). Os demais crons não falam com cliente.
- **Como o "envia na próxima hora útil" acontece sem fila**: os crons proativos rodam a cada 15 min (ou diariamente); bloqueados agora, o próprio ciclo seguinte dentro da janela envia. Mensagem adiada não se perde — ela espera. Validado: sábado 19h → **segunda 8h**; domingo 10h → **segunda 8h**; terça 21h → quarta 8h; 7 de setembro → dia 8 às 8h.
- Nas 10 functions, só o **comentário** foi atualizado, apontando que a janela completa vive no agendador. O cálculo local de 20h–8h permanece como rede de segurança para disparo manual.

## 29.25.0 — Vale-presente de verdade: escolhe, monta, paga por Pix e recebe o código

Crítica certeira do Juliano ao texto da v29.24.0: *"esquece, a pessoa não me conhece, vai desconfiar"*. Quem compra um vale muitas vezes nunca pisou na barbearia — mandar essa pessoa fazer um Pix "às cegas" e depois explicar o que ela levou é o inverso da ordem certa. Agora ela **é conduzida pelas telas**: escolhe → vê o total → só então paga.

- **Nova página `/vale-presente/`** em 3 etapas: (1) três vales prontos (Corte + Lavagem R$ 50, Barboterapia R$ 40, Corte + Barboterapia R$ 80) **ou** monta o próprio somando serviços do catálogo v7; (2) quem compra e quem ganha (+ mensagem); (3) pagamento com **Pix copia e cola gerado pelo sistema** (BR Code EMV com valor já embutido — o comprador não digita chave nem valor) e botão pra mandar o comprovante no WhatsApp.
- **Migration 107**: tabela `gift_cards` (código, itens, valor, comprador, presenteado, validade de 12 meses), coluna `bookings.gift_card_id`, `generate_gift_code()` (alfabeto sem O/0/I/1 — o cliente vai ditar isso no balcão) e `check_gift_card()` pública pra validar no agendamento.
- **Migration 108**: `confirm_gift_card()` e `redeem_gift_card()`, ambas com `is_admin()`. **Regra central: o código só nasce quando o Juliano confirma o Pix** — código gerado antes do pagamento é código que circula sem ter sido pago. Confirmação idempotente (reconfirmar devolve o mesmo código, nunca gera outro).
- **Functions**: `gift-card-create` (pedido + Pix, push pro Juliano) e `gift-card-confirm` (verify_jwt=true + is_admin na RPC; libera o código e **avisa o comprador no WhatsApp na hora**).
- **Nova tela `admin-vales.html`**: pendentes/ativos/usados, botão "Confirmar Pix e liberar código", campo de baixa por código no balcão, métricas (aguardando, ativos, vendido no mês). Link "🎁 Vales-presente" na sidebar das 14 telas do admin.
- **Galeria**: a 2ª e a 4ª fotos foram trocadas a pedido do Juliano por um **clássico social (slick back, "old money")** e um **low fade na régua** — mesma curadoria de privacidade (recorte que exclui o rosto).
- **Políticas novas na seção de benefícios**: "Ajuste sem custo **em até 7 dias**" (prazo definido, como a Confraria) e **"Pezinho por nossa conta"** entre cortes. O card de hora marcada virou **"Hora marcada, com bom senso"** com a **tolerância de 10 minutos dos dois lados** — o Juliano notou que prometer "sem espera" podia virar propaganda enganosa num dia em que o atendimento estende.

## 29.24.0 — Rodada 2 dos benchmarks: benefícios em destaque, vale-presente, galeria real e CTA fixo

Segunda auditoria comparativa (Confraria da Barba, QOD + os três da rodada 1). Aprovação integral do Juliano: "quero que vc implemente tudo adorei todas as ideias".

- **Seção "Por que a Barbearia do Ju"**: a trust-bar de chips minúsculos virou 5 cards de peso (reuso das classes previsit — zero CSS novo): ajuste sem custo, **fidelidade** (todo atendimento soma 1 ponto; no 10º o serviço é por nossa conta — o programa existia no sistema mas era invisível pra visitante novo), hora marcada, conforto, vale-presente.
- **Vale-presente à venda** (pedido do Juliano, versão 1 sem API): seção própria + card no acesso rápido. Fluxo: Pix na chave PicPay → comprovante no WhatsApp com o nome do presenteado → Juliano envia o vale digital. Quando o Checkout PagBank liberar, pode virar cobrança online (registrado no briefing da assinatura).
- **Galeria "Resultados de verdade"**: 4 fotos REAIS de clientes (posts de junho do Instagram, antes da era das artes de IA — cuidado: as artes recentes com "antes/depois" são simulações rotuladas e NÃO podem ir pra galeria). Privacidade: os clientes autorizaram o Instagram mas não o site, então cada foto foi **recortada para excluir o rosto** (fica cabelo/fade/orelha — curadoria visual manual foto a foto, recorte de 66% da largura + resize 900px). Originais: taper, mullet low fade, black power e cachos. As 4 fotos de ambiente continuam depois delas.
- **CTA fixo no mobile**: barra dourada "Agendar horário" fixa no rodapé (≤620px, classe .mobile-agendar no css 02) — o padrão de conversão que os benchmarks só entregam via app.
- Function temporária ig-media-tmp criada pra listar a mídia do Instagram via Graph API (secrets já existentes) — APAGAR depois de o Juliano aprovar a galeria.
- Ideia de negócio aceita e pendente de decisão de prazo: garantia com prazo ("até 7 dias"?) e "pezinho grátis entre cortes" — Juliano decide depois.

## 29.23.2 — "Mais de 80 avaliações" (número fixo envelhece)

Observação do Juliano: a contagem de avaliações só cresce (80 → 90 → 100…), e o número exato na home ficaria defasado em semanas. Virou "mais de 80 avaliações" — verdadeiro por muito tempo, retoque só quando valer o próximo patamar ("mais de 100"). **Pendência registrada**: quando a sincronização do Perfil da Empresa preencher a `google_reviews` (tabela existe e está vazia — checar autorização da API), automatizar nota + contagem + rotação das citações na faixa, via cron, no lugar do texto fixo.

## 29.23.1 — Título do hero parava de clipar no celular

Bug antigo confirmado em screenshot real: com `white-space:nowrap` no `.hero-title-line`, a fonte em `10.7vw` estourava a largura da tela e o título cortava na lateral ("CONTA SUA HISTÓR…" no texto antigo; "SUA IMAG…" no novo). Coeficiente reduzido pra `8.6vw` (e `8.2vw` no ajuste iOS) — cabe até em 320px. `?v=` do css 03 e do style.css bumpados.

## 29.23.0 — Home no nível dos benchmarks: 1 CTA, avaliações reais e fim do "premium"

Auditoria comparativa de 15/08 (Corleone, Hermanos, KE Barbearia — os "tops" do mercado) + incômodo do Juliano com a palavra "premium" no site. Aprovado por ele: "aplique todas as melhorias que vc achar boas" / "escolhe a frase vc".

- **Hero**: headline nova — "Cuidar da sua imagem é o meu trabalho." (a voz do Juliano, tirada da própria seção sobre; sai o "MAIS QUE UM CORTE!" gritado em caixa alta que destoava dos benchmarks). Subtítulo com hora marcada + Bragança. **Um só CTA dourado ("Agendar horário")**; Produtos/WhatsApp/Blog viraram contorno discreto (`hero-btn-ghost`, css 02). Antes os 4 botões disputavam o olho com o mesmo peso.
- **Faixa de avaliações**: morreu o autoelogio "padrão premium" (origem da reclamação). Entrou prova social REAL colhida do Google Maps em 15/08: **nota 5,0 · 80 avaliações** + duas citações verbatim com primeiro nome (Rogerio: "A melhor barbearia da região!"; Alfredo: "O corte ficou 10/10!! recomendo 1000%"). Regra: citação de cliente é sempre verbatim e nunca inventada; quando a tabela `google_reviews` passar a sincronizar (hoje está vazia), dá pra automatizar a rotação.
- **Preços na home**: linha com os 3 serviços âncora (Corte R$ 40 · Barboterapia R$ 40 · Corte+Barboterapia R$ 80) na seção do catálogo — benchmark KE mostra preços; barbearia local com preço honesto é argumento, não segredo.
- **"Premium" varrido do texto visível do site inteiro**: faixa da home, e-book (home + 7 páginas de blog: badge virou "📘 E-book"), descrição do Corte+Barboterapia ("acabamento caprichado") no catálogo v7 e no /agendar estático, badge de produto ("⭐ Destaque"). Classes CSS com "premium" no nome ficaram (invisíveis ao usuário, renomear só arriscaria regressão).
- Cache: `02-site-interactions.css` e `style.css` bumpados pra 29.23.0 no index (o import do style.css mudou).
- **Novo `PLANO-ASSINATURA-BRIEFING.md`**: o Juliano vai implantar o clube de assinatura esta semana (no notebook da barbearia) — o arquivo deixa mastigado: dados reais pra precificar, estrutura de planos sugerida, cobrança em 2 fases (link mensal já; API Pagamento Recorrente depois — precisa ser ADICIONADA ao chamado 1430398600), esqueleto de banco e ordem de implementação. Decisões abertas marcadas com ⚖️ pra fechar com ele.

## 29.22.1 — Fallback do pagamento avisa que o cartão online está chegando

Pedido do Juliano (15/08): enquanto a allowlist do PagBank não sai, quem toca em "Pagar agora — Pix ou cartão" cai no bloco só de Pix — quebra de expectativa momentânea. O bloco de fallback ganhou uma linha explicando: cartão online está chegando; por enquanto Pix pela chave, ou no local (maquininha aceita cartão normal). A linha morre sozinha junto com o fallback quando a API liberar.

## 29.22.0 — Fase 2 do pagamento antecipado: Checkout PagBank (Pix + cartão, confirmação automática)

Decisão do Juliano em 15/08/2026, revertendo conscientemente a escolha da v29.3.0 (sem API): o cliente merece confirmação automática, e cartão de crédito/débito entra como opção. Caminho escolhido: **Checkout PagBank** (página hospedada) em vez de formulário de cartão no site — uma integração só serve o site E, depois, o link que a JuIA pode mandar no WhatsApp, onde nascem ~90% dos agendamentos (v29.1.0). Pix por chave (0%) sai do fluxo do site; o Pix da API custa ~0,99%, o preço de ninguém mais conferir extrato.

**O ciclo novo:** fim do agendamento → botão "💳 Pagar agora — Pix ou cartão" → function `pagbank-checkout` cria o checkout (à vista só; expira em 24h; reaproveita link vivo pra não gerar cobrança dupla) → cliente paga na página do PagBank → `pagbank-webhook` valida a assinatura (`x-authenticity-token` = SHA-256 de `token-corpo cru`; assinatura errada = descarte), marca `prepay_confirmed_at` + `prepay_key='checkout'`, avisa o cliente no WhatsApp e manda push "nada a conferir" pro Juliano. A guarda de silêncio NÃO se aplica: confirmar pagamento que o cliente acabou de fazer é resposta, não incômodo.

**Fallback deliberado:** se a API falhar (token ausente, conta fora da allowlist, erro), o front troca o bloco pelo fluxo manual da Fase 1 (chave copiável + "Já fiz o Pix") — o cliente nunca vê quebra. Isso importa porque **a conta ainda não está na allowlist do PagBank**: as APIs novas (Checkout e Orders) responderam 403 `allowlist_access_required` no teste real de 15/08. Chamado de liberação aberto pelo Juliano no mesmo dia. Quando o PagBank liberar, o fluxo novo ativa sozinho, sem deploy.

- Migration 106: tabela `payments` (uma linha por checkout; webhook atualiza a mesma linha), `prepay_key` ganha `'checkout'`, RPC `get_booking_for_checkout` (autorizada pelo par code+token, padrão da 096). RLS `is_admin()` + GRANT de base (lição da 058).
- Functions novas: `pagbank-checkout` e `pagbank-webhook` (ambas `verify_jwt=false` — uma autentica por code+token, a outra por assinatura). Deploy feito; `PAGBANK_TOKEN` já está nos secrets (colado pelo próprio Juliano, sem passar pelo chat).
- Site (`agenda-v15.js`): oferta nova com o botão do Checkout; HTML da Fase 1 virou `pixFallbackHtml()`. Evento GA novo: `checkout_opened`.
- Painel (`admin-v15-4-agenda.js`): selo "✅ Pago online (PagBank) — automático" quando `prepay_key='checkout'` (sem botão de conferir — nada a conferir).
- `?v=` bumpado em `agendar/horario/index.html` e nos 7 HTML que carregam `admin-v15-4-agenda.js`.

**Pendências conhecidas:** (1) allowlist do PagBank — aguardando retorno; function `pagbank-validate-tmp` continua no ar pra retestar com um clique e deve ser apagada depois; (2) JuIA mandar o link de pagamento no WhatsApp — próxima fase, destrava os ~90%; (3) `meu-agendamento.html` ainda não mostra estado "pago" nem trata `?pago=1` no retorno do Checkout; (4) Financeiro assume Pix 0% — Pix via API tem ~0,99%, ajustar `finance_fee_rates` quando o volume aparecer.

## 29.21.0 — Horário de silêncio (20h–8h) + carrossel na Central de Conteúdo

**Horário de silêncio (pedido do Juliano, 14/08/2026)**: nenhum robô manda mensagem proativa pra cliente entre 20h e 8h (Brasília) — o que vencer de noite sai a partir das 8h da manhã seguinte. Guarda aplicada em 10 funções: confirmação de presença (pedido + fallback SMS/e-mail), lembrete 24h, pesquisa de satisfação, fidelidade (10 pontos), follow-up de leads (nudges, oferta de vaga da lista de espera, vaga reaberta), aniversário, reativação de cliente sumido, convite de retorno e boas-vindas de balcão. Como todas essas rotinas só marcam estado DEPOIS de enviar, a primeira rodada do cron depois das 8h entrega o que ficou pendente — nada se perde. Duas exceções deliberadas: (1) a JuIA continua RESPONDENDO quem escreve a qualquer hora (o webhook não tem guarda — responder não é incomodar); (2) o watchdog de reativação continua devolvendo a conversa pra JuIA de noite (senão cliente que escrevesse de madrugada falaria com o vácuo), mas o "cochicho" de "ainda estou por aqui" não sai no silêncio — e não é reenviado de manhã de propósito, porque 10h depois soaria fora de contexto.

**Carrossel do Instagram na Central**: o campo de imagem do novo rascunho aceita 2 a 10 links (um por linha) e publica como carrossel de verdade pela Graph API — cada imagem vira container filho (`is_carousel_item`), o pai (`media_type=CAROUSEL`) junta tudo com a legenda. Fluxo validado em produção nas pontes de 13/08 (carrossel do guia de manutenção). Prévia no card mostra as imagens na ordem; timeout do navegador sobe pra 4min nesses posts (a Meta processa imagem por imagem). Story de vídeo já existia desde a v28.57.0. Carrossel continua sem trilha sonora por limitação da API da Meta — o contorno segue sendo o slideshow em vídeo.

## 29.16.0 — Fim da esteira de perguntas de venda + convite de retorno no dia seguinte

Caso real (print de 12/08): cliente escolheu corte e horário, respondeu "Não" à pergunta de complemento e levou NA SEQUÊNCIA a pergunta de produto — parou de responder, quase desistiu, e o Juliano teve que assumir a conversa na mão. Um corte de R$40 quase perdido por causa de um complemento de R$15. O cliente confirmou depois que achou a IA cansativa.

**Oferta única, colada no "sim, tem horário".** O fluxo antigo fazia até 3 perguntas de venda em série (upgrade da lavagem → complementos → produto) ANTES de fechar o horário. Agora: quando a JuIA confirma que o horário pedido está livre, a MESMA mensagem traz a única oferta da conversa, com opções numeradas (WhatsApp não mostra botões de actions) — upgrade pra Corte + Lavagem e/ou até 3 complementos — mais a última opção "Não, pode fechar assim". Produto deixou de ser pergunta: virou aviso passivo no fim da mensagem ("se quiser produto ou bebida gelada, é só avisar"). Qualquer "não" encerra TODA venda da conversa e vai direto pro fechamento; se o cliente ignora a oferta e fala de outra coisa, a venda morre ali. Resposta por número (1/2/3...), por nome do serviço ou pelo diff do state (modelo) — tudo coberto. `productSuggestions` removida; prompt do modelo proibido de fazer pergunta de venda por conta própria.

**Tolerância de atraso oficializada**: até 10 minutos, a JuIA confirma na hora que o horário segue garantido; acima disso, acolhe, avisa que vai passar pro Ju e faz handoff — nunca promete encaixe além dos 10 min nem reagenda sozinha.

**Convite de retorno pós-atendimento (ideia do Juliano)**: cron diário às 10h (function `return-invite-dispatch` + tabela `return_invites`, migration 105) convida quem foi atendido ONTEM e não tem agendamento futuro a já deixar o retorno reservado — mesmo dia da semana e horário, 4 semanas depois (se o dia +28 estiver fechado/lotado, tenta até +35; horário mais próximo do original). No dia seguinte de propósito: a pesquisa de satisfação e o pedido de avaliação já saem no dia do atendimento. Menu 1/2/3 no padrão da confirmação de presença; a resposta é interpretada no whatsapp-webhook ANTES da pesquisa de satisfação (o convite é sempre a pergunta mais recente). "1" cria o agendamento na hora (com checagem de duplicidade e de colisão), "2" devolve pra conversa normal, "3" registra recusa — 2 recusas seguidas pausam novos convites por 60 dias. Sem resposta em 72h o convite expira em silêncio, zero insistência. Quem pré-agendou cai no robô de confirmação de 24h normalmente (o lembrete de véspera cobre o risco de esquecimento de quem marcou com 1 mês de antecedência).

**Deploy por import fixado no commit**: ju-ia-site e whatsapp-webhook passaram a ser publicados como um wrapper de 1 linha que importa o arquivo real do GitHub (raw, SHA fixado) — o bundler do Supabase embute o código no deploy, sem dependência do GitHub em runtime. Elimina o risco de retranscrever 160KB de código a cada deploy via MCP.
## 29.15.0 — Campo "Nº desta visita" substitui o checkbox de cliente recorrente

O checkbox "já é cliente recorrente" (v29.9.0) chutava `prior_visits=6` pra qualquer cliente antigo — foi o que deu etiqueta errada no caso John Maicon, e no caso Tatiane (12/08) a palavra do Juliano ("é a 2ª visita") era o dado certo que a tela não tinha como receber.

**Como funciona agora.** Na conclusão (Agenda/Atendimento) e no Balcão, o campo pergunta exatamente o que o Juliano sabe: o número TOTAL desta visita, contando desde antes do sistema. O placeholder mostra o que o sistema já conta ("o sistema conta 3ª") — só se digita algo se estiver errado. A RPC `admin_apply_completion_extras` (migration 104) converte: `prior_visits = nº digitado − concluídos no sistema antes desta reserva − 1`, com trava em 0 se o número digitado for menor que o histórico já registrado (o histórico vence). A comparação de "antes desta" usa a MESMA regra estrita de data/hora do `visitNumber()` do front, e o dedupe de telefone usa `phone_match_key` (com/sem 55, com/sem 9).

`p_mark_recurring` continua aceito na RPC (comportamento antigo) porque o PWA do Juliano pode rodar JS antigo em cache por horas. Assinatura antiga dropada antes de recriar (gotcha da migration 041 — sobrecarga). Testado com cliente descartável no banco (3 concluídos, digitou 6 → prior 3 → etiqueta 6ª; digitou 2 → trava em 0), dados apagados. Suíte do admin 26/26 verde; `?v=` bumpado em todos os HTML que carregam `admin-v15-4-agenda.js` e no balcão.
## 29.8.0 — Paleta real da barbearia no gerador de imagens

Depois da aprovação da peça still-life genérica (v29.6-29.7), o Juliano propôs um teste: mandar fotos reais da barbearia, eu descrever só os materiais/objetos/cores (nunca o ambiente inteiro como cena, nunca texto — mesma regra de sempre) e usar isso pra enriquecer o prompt.

**O que ele NÃO queria** também apareceu na mesma madrugada: chegou a compartilhar um prompt gerado por outro modelo que tentava recriar a barbearia inteira numa imagem só — porta de vidro com o nome escrito, frase na parede, três quadros decorativos fictícios, TV com jogo de futebol "reconhecível", reflexo de espelho mostrando o ambiente certo. Recusei executar como veio: tinha os dois problemas exatos que a v29.6.0 corrigiu (texto desenhado pela IA + ambiente inteiro reconhecível, que é como se inventou uma segunda cadeira de barbeiro em 04/08). O Juliano concordou e pediu pra eu criar baseado nas fotos, do meu jeito.

**O prompt novo** (`BRAND_STYLE` em ambas as funções) incorpora a paleta real: tijolo terracota, couro preto capitonê, latão/metal preto com dourado discreto, madeira escura de bancada + viga clara, vidro/cristal (potes de boticário, frascos âmbar), samambaia, toalhas creme, luz quente 2700-3000K nunca fria. Testado com uma ponte temporária (gerar + aplicar marca, sem subir em lugar nenhum), revisado por mim, aprovado pelo Juliano ("ficou perfeita", "MARAVILHOSA") — muito superior ao still life genérico anterior.

Continuam de pé todas as proibições da v29.6.0: sem pessoa, sem ambiente inteiro como sala reconhecível, sem texto/logo desenhado pela IA. A peça aprovada foi publicada como rascunho no Facebook (a still-life genérica de ontem já estava no Instagram).

**Lição registrada**: usar fotos reais como fonte de vocabulário (materiais, cores, objetos) funciona bem. Usar fotos reais como blueprint pra recriar a cena inteira é o mesmo erro de sempre, só que com mais detalhe — e por isso mais difícil do modelo acertar, não mais fácil.
## 29.7.0 — Marca real carimbada em toda arte gerada

Pedido do Juliano: as artes automáticas deveriam trazer o nome da barbearia. A resposta não podia ser "deixar a IA escrever" — o próprio acervo já provou o risco (uma peça saiu "BAREARIA DO JU").

**A marca vem de um arquivo, não de um prompt.** `assets/marca-selo-transparente.png` foi extraída do logo real (`logo-topo-wide.jpg`, o mesmo do letreiro físico) por flood-fill a partir das bordas: qualquer pixel escuro *conectado à borda* virou transparente; os pretos internos do desenho — contorno, bigode, letras — ficaram intactos, porque não têm caminho até a borda sem cruzar um pixel claro. Resultado: fundo 100% transparente sem perder nenhum traço do desenho original.

**Como entra na arte**: `content-generate-image` e `content-generate-daily` ganharam `applyWatermark()`, usando `imagescript` (Deno, WASM puro — `sharp` não roda no runtime das Edge Functions). Depois que o Gemini devolve a arte, a marca é redimensionada para ~34% da largura e composta no canto inferior direito com 4% de respiro. Se a marca falhar ao buscar ou decodificar, a arte segue sem ela — nunca derruba a geração por causa disso.

**Testado antes do deploy** com Deno local instalado na sessão, rodando a mesma versão exata da biblioteca (`imagescript@1.3.0`) contra uma arte sintética: composição, transparência e posicionamento conferidos visualmente antes de ir para produção.
## 29.6.0 — A geração de imagem parou de tentar ser a barbearia

Consequência direta da decisão de 08/08/2026: **pessoa e ambiente = foto real; IA = só o que não tem rosto nem cômodo.**

**O que estava acontecendo.** `content-generate-image` e `content-generate-daily` anexavam **duas fotos reais** em cada pedido ao Gemini: uma do salão e outra do rosto do Juliano. A instrução dizia, com todas as letras: *"se a cena incluir o barbeiro, ele precisa ter a mesma aparência da segunda foto (mesmo rosto, mesmo cabelo, mesma barba)"*. Havia até um comentário no código explicando a origem — *"o barbeiro gerado não se parecia com ele"*.

Ou seja: os ~R$ 16/mês de Gemini estavam pagando exatamente pelo tipo de peça que decidimos não publicar. O problema nunca foi o custo; era o que saía.

**O que mudou:**
- Fora as fotos de referência (salão e rosto). O pedido agora é 100% texto.
- `BRAND_STYLE` reescrito para o still life editorial do guia de criação: fundo preto quente, luz lateral de fonte única, dourado #c89b55, grão de filme — e uma lista explícita do que é **proibido gerar**: pessoas, rostos, mãos, silhuetas, interior/fachada reconhecível, e qualquer texto na imagem.
- O texto continua sendo aplicado depois, fora da IA — modelo de imagem erra acento e inventa palavra em português, e preço errado publicado é problema real (comprovado no acervo: uma peça dizia "BAREARIA DO JU").
- Código morto removido (`REFERENCE_IMAGES`, `JULIANO_REFERENCE`, `REFERENCE_INSTRUCTION`, `fetchReferenceImage`, `fetchImageAsBase64`) nos dois arquivos.

**Por que NÃO desligamos a API do Gemini**, que era a pergunta original do Juliano: o que os R$ 16/mês compram não é imagem, é o **cron das 8h** que cria os rascunhos do dia sem ninguém lembrar. Trocar isso por geração manual economiza R$ 16 e custa atenção diária — o recurso mais escasso de um barbeiro que trabalha sozinho. Além disso, desligar a API sem desligar o cron faria ele falhar toda manhã em silêncio.

**Divisão de trabalho combinada:** a automação gera os fundos sem rosto; o Claude do Chrome gera peças pontuais sob demanda pelo Gemini web; foto real para pessoa e ambiente, sempre.
## 29.5.0 — QR Code novo e a instituição informada junto da chave

**QR Code gerado do zero** para a chave `contato@barbeariadoju.com.br`, no padrão BR Code do Banco Central (EMV): campos TLV, moeda 986, país BR, recebedor "Barbearia do Ju", cidade BRAGANCA, e CRC16/CCITT-FALSE calculado sobre o payload.

**Como foi validado, e por que isso importa**: gerar QR de Pix na mão é fácil de errar em silêncio — um dígito no CRC e o código simplesmente não abre no banco do cliente, sem nenhum aviso. Então o PNG foi **lido de volta** com um decodificador independente, o CRC recalculado a partir do que foi lido, e a árvore TLV reparseada campo a campo. Só depois disso o Juliano escaneou com o aplicativo real e confirmou que funciona.

**Instituição informada junto do nome** (pedido do Juliano): "aparece o nome Juliano Bruno Lopes Padilha e a instituição PicPay". O raciocínio dele é certeiro — quem paga por Pix confere o nome antes de confirmar, e nome de pessoa física sem contexto gera desconfiança suficiente para a pessoa parar no meio. Aplicado na home, no bloco de agendamento e no prompt da JuIA (testado ao vivo).
## 29.4.0 — Chave Pix de e-mail como primeira opção

Decisão do Juliano em 08/08/2026: `contato@barbeariadoju.com.br` (PicPay, pessoa física) passa a ser a **primeira opção** de pagamento em todos os pontos de contato.

**Contexto da decisão, registrado porque ela foi tomada com a informação na mesa.** Levantei duas objeções: (1) a conta é pessoa física, e receita da barbearia caindo fora do CNPJ dificulta a contabilidade do MEI e não constrói histórico de faturamento do negócio; (2) o argumento do teto do MEI não se sustenta hoje — o faturamento projeta ~R$ 30 mil/ano, cerca de um terço do limite, e receita é receita independentemente da conta que recebe. O Juliano reafirmou a escolha, então está feito como ele pediu. Assunto de contador, não meu.

- **Home**: a chave aleatória `d1883c86-...` saiu (ninguém reconhece um amontoado de letras como sendo de uma barbearia). Entrou o e-mail, com o aviso do nome do titular. **O QR Code foi removido** porque apontava para a chave antiga — precisa ser regerado no app do PicPay e reenviado.
- **Agendamento**: e-mail em primeiro, celular como segunda opção. O botão "Já fiz o Pix" agora declara `picpay`; o link secundário declara `pagbank`.
- **JuIA**: passa o e-mail primeiro e sozinho, e só oferece o celular se o cliente pedir outra opção. Instruída a **nunca passar as duas de uma vez** — duas chaves na mesma mensagem confundem e derrubam pagamento. Testado ao vivo.

**Inconsistência que isso resolveu de quebra**: a home mostrava uma chave e o fluxo de agendamento mostrava outra. Agora é uma só, com a segunda claramente marcada como alternativa.
## 29.3.0 — Pix: o ciclo fechado, sem API e sem taxa

Pedido do Juliano: dar segurança a quem paga adiantado, sem depender da API do PagBank (decisão de não usar a API por ora — ver [[projeto-pix-pagbank-api]]).

**O que faltava.** O cliente pagava, clicava em "Já fiz o Pix", e ficava no vácuo — nunca recebia retorno. Do outro lado, o Juliano só descobria a declaração se abrisse o painel, e ainda tinha que adivinhar em qual aplicativo conferir.

**O ciclo agora:**
1. Cliente declara → **push na hora** no celular do Juliano, dizendo **para qual chave** conferir (PagBank celular ou PicPay e-mail). Era o pedido literal dele: *"preciso ver pix enviado para picpay, pix enviado para pagbank, assim abro na hora a conta correta"*.
2. Ele confere o extrato e aperta **"✅ Confirmar que o Pix caiu"** no card da agenda.
3. O cliente recebe no WhatsApp: *"Pagamento confirmado ✅ ... não precisa fazer mais nada."*

- Migration 102: `bookings.prepay_key` e `prepay_confirmed_at`; `declare_prepay` ganhou o parâmetro da chave (com `DROP` antes, pelo gotcha de sobrecarga da migration 041) e passou a devolver os dados do cliente; nova `confirm_prepay`, protegida por `is_admin()`.
- Nova function pública `prepay-declare` (verify_jwt=false, autorizada pelo par código+token): registra **e** dispara o push. Antes o site chamava a RPC direto e a declaração morria no banco.
- Nova function `prepay-confirm`: chama a RPC **com o token do próprio admin** (não com service role) para que `is_admin()` valha de verdade, e só então avisa o cliente pela Evolution.
- Site: novo texto de retorno ao cliente e link discreto "Paguei no PicPay (e-mail)" para o caso raro de quem pediu a chave alternativa à JuIA.
- Painel: selo verde quando confirmado, e o botão de confirmar quando ainda não.

**Verificado**: declaração com chave gravando certo (`prepay_key='picpay'`), token inválido recusado, `confirm_prepay` recusando quem não é admin, e `test:admin` 26/26 com os dois estados renderizando na Agenda.

**O que ainda falta e vale mais que tudo isso**: a JuIA oferecer o adiantamento na conversa. Hoje o bloco de Pix só existe no formulário do site, que responde por ~9% dos agendamentos (ver v29.1.0). O Juliano relatou que os clientes chegam na barbearia e demoram para abrir o aplicativo e pagar — oferecer antes, no WhatsApp, resolve isso onde o cliente está.
## 29.2.0 — Atribuição dos agendamentos que nascem no WhatsApp

Fecha o buraco aberto pela descoberta da v29.1.0: ~90% dos agendamentos vêm da JuIA no WhatsApp, e o Google Ads não enxergava nenhum deles. Quando a pessoa sai do site e abre o WhatsApp, o identificador do clique no anúncio não vai junto — a conversa começa sem vínculo com a visita.

**Como funciona.** Ao clicar em qualquer link de WhatsApp do site, um código curto (`[#abc12345]`) é grudado no fim do texto da mensagem e registrado no servidor junto do `client_id` do GA4, do `gclid` e dos UTMs daquela visita. A JuIA lê o código na primeira mensagem, **remove do texto antes do modelo ver** (pra não poluir a conversa) e amarra ao telefone. Quando aquele telefone agenda, o agendamento é enviado ao GA4 pelo Measurement Protocol com o **mesmo `client_id`** — e é isso que permite ao Google creditar o agendamento ao anúncio de origem.

- Migration 101: `whatsapp_attribution` + `purge_whatsapp_attribution()` (limpa vínculos não convertidos com mais de 30 dias)
- Nova function pública `whatsapp-attribution` (verify_jwt=false), com validação estrita do formato do código
- `whatsapp-attrib-v29.js` na home, no catálogo, na agenda e em produtos. Usa `sendBeacon` porque `fetch` nem sempre sobrevive à navegação pro WhatsApp; guarda o `gclid` em localStorage por 90 dias, já que a pessoa pode navegar várias páginas antes de clicar
- `ju-ia-site` lê o código, amarra ao telefone e dispara o evento no agendamento

**Princípio que guiou o código**: nada disso pode atrapalhar quem quer agendar. Todo o caminho novo está em `try/catch`, o clique no WhatsApp nunca é bloqueado, e se a chave do Measurement Protocol não existir o envio é simplesmente pulado — o agendamento acontece igual.

**Pendência**: criar o segredo `GA4_MP_API_SECRET` (GA4 → Admin → Fluxos de dados → Measurement Protocol). Sem ele o vínculo é registrado mas o evento não é enviado.
## 29.1.0 — Canal real do agendamento (site x JuIA x balcão)

**O achado que motivou isto.** Entre 01 e 07/08/2026 o banco registrou **22 agendamentos com `channel='site'`**, mas o GA4 recebeu só **3 eventos `booking_confirmed`** — e um deles foi um teste meu. O evento só dispara no formulário do site; a JuIA usa a mesma `create_public_booking_v15` e também saía marcada como "site", sem passar por navegador nenhum.

Conclusão: **cerca de 90% dos agendamentos nascem numa conversa com a JuIA, não num formulário.**

Duas consequências que estavam invisíveis:
- A **Fase 1 do Pix antecipado** foi construída no fim do formulário do site — ou seja, exposta a ~9% do movimento. A adesão zero medida em 08/08 não prova desinteresse; prova que quase ninguém viu.
- A **conversão de agendamento ligada no Google Ads em 08/08** (ver [[marketing-ads-proximos-passos]]) enxerga esses mesmos ~9%. Continua muito melhor do que otimizar por "pediu rota no Maps", que era o estado anterior, mas o Google está aprendendo com uma fração da realidade.

**O que mudou (migration 100):** `bookings_channel_check` passou a aceitar `site`, `balcao`, `juia_whatsapp`, `juia_chat` e `rebooking`. A `ju-ia-site` marca o canal certo logo após criar o agendamento (`juia_whatsapp` quando o telefone vem verificado pelo WhatsApp, `juia_chat` no chat do site).

**Decisão de engenharia:** não alterei a assinatura de `create_public_booking_v15` para receber o canal. Ela é o caminho mais crítico do sistema, e mudar a lista de parâmetros cria sobrecarga nova em vez de substituir a função (gotcha já documentado na migration 041). Marcar pelo lado de quem chama tem raio de dano muito menor.

**Limite conhecido:** registros anteriores a 09/08/2026 marcados como `site` podem ser de qualquer origem online — não há como separá-los retroativamente.
## 29.0.0 — Módulo financeiro (entrada, saída, lucro e taxa da maquininha)

Pedido do Juliano: controlar entrada e saída de dinheiro, com total gasto no mês contra o faturado e o lucro líquido.

**A simplificação que definiu o desenho**: o faturamento já existe no banco (`bookings` concluídos, serviço + produtos). O módulo não pede lançamento de receita — só de saída, e o lucro sai por subtração. Metade do trabalho já estava feita.

**Migrations 098 e 099**: `finance_categories` (14 categorias, classificadas em `fixo`/`variavel`/`retirada`), `finance_entries` (lançamentos), `finance_fee_rates` (taxas do PagBank) e a coluna `bookings.fee_passed_to_customer`. Todas com RLS `is_admin()` **e** `GRANT` de base — a lição da migration 058.

**Tela nova** `admin-financeiro.html` + `admin-financeiro-v29.js`, ligada no menu das 15 páginas do admin:
- Cartões de Faturamento, Despesas, Lucro do negócio e Sobrou depois da retirada
- **Ponto de equilíbrio**: quanto falta para cobrir os custos e quantos atendimentos isso representa ao ticket médio do mês; quando a receita passa as despesas, mostra em que dia isso aconteceu
- **Taxa da maquininha** por dia, semana e mês, quebrada por modalidade
- Lançamento rápido e botão "repetir fixos do mês passado" para despesas recorrentes

**Melhorias sobre o pedido original, e o porquê de cada uma:**
- **Fixo x variável separados** — só assim dá para responder "quanto preciso faturar para não ter prejuízo".
- **Retirada fora das despesas** — o que o dono tira não é custo do negócio. Misturado, o painel nunca diria se a barbearia se paga.
- **Categoria "Anúncios"** — não estava na lista do Juliano e é ~R$ 600/mês, mais de um quarto do faturamento. Sem ela o módulo mentiria por omissão no primeiro mês.
- **Recorrência com um clique** — controle financeiro de pequeno negócio morre por atrito, não por falta de recurso.

**Taxa da maquininha — decisão de desenho.** O pedido original era upload do extrato diário. Descartado: cartão soma ~R$ 634/mês, então a taxa fica entre R$ 15 e R$ 28 — desproporcional para um recurso de trabalho diário. Como o sistema já registra `payment_method`, as alíquotas contratuais bastam para calcular sozinho, e batem com o extrato. Taxas conferidas pelo Juliano no app do PagBank em 08/08/2026 (Visa/Mastercard, recebimento na hora): **débito 2,12%**, **crédito à vista 4,61%**. Pix por chave é **0%** (o padrão da casa); Pix pela maquininha custaria 0,99%.

O atendimento continua registrando o valor cobrado, e a taxa entra como despesa quando não repassada — em vez de descontar no próprio atendimento, o que quebraria a comparação de faturamento entre meses.

Testado com `npm run test:admin`: 26/26, incluindo a tela nova.
## 28.48.0 — Garantia de ajuste no acabamento + correção das cortesias

Decisão do Juliano em 08/08/2026, ao revisar a copy dos anúncios: assumir publicamente o compromisso de refazer o acabamento sem cobrar. Redação fixada e replicada em todos os pontos de contato:

> **"Se o acabamento não ficou como você queria, volte e a gente ajusta sem cobrar nada."**

- **Home** (`index.html`): entrou na faixa de diferenciais (primeiro item), num card novo do bloco "antes de vir", no FAQ visível e no schema `FAQPage` (pergunta "E se eu não gostar do acabamento?").
- **Agendamento** (`agendar/horario/index.html`): a garantia aparece na Etapa 4, embaixo do botão Confirmar — que é o momento de hesitação.
- **JuIA** (`ju-ia-site/index.ts`): passou a conhecer a garantia e a oferecê-la quando o cliente demonstrar receio de não gostar do resultado ou perguntar diretamente. Instruída explicitamente a **nunca prometer devolução de dinheiro** — a garantia é de ajuste, não de reembolso. A garantia também entrou na lista de argumentos usados na objeção de preço.

**Correção de fato, junto**: o site dizia "Café cortesia, água, refrigerante, energético ou bebida gelada" de um jeito que sugeria que tudo era cortesia. Confirmado com o Juliano que **só o café é por conta da casa**; as demais bebidas são vendidas. Corrigido em `agendar/index.html`, no FAQ da home, no schema e no prompt da JuIA.

**Decisão registrada — o que NÃO foi feito**: o Juliano se dispôs a anunciar também ressarcimento do pagamento em caso de insatisfação. Recomendei não anunciar, e ele acatou. Motivos: publicidade obriga o anunciante; ressarcimento custa o ticket mais a cadeira ocupada (recurso escasso num barbeiro sozinho); e o gesto vale mais feito caso a caso, sem ter sido prometido, do que virando política que se testa. Continua podendo ressarcir quando julgar justo — só não está anunciado.
## 28.47.2 — Segunda bateria de testes robustos (pré-lançamento oficial do uso diário)

Varredura completa pedida pelo Juliano ("achar e corrigir bugs pra ferramenta ficar 100%"). Achados e correções:

- **Corrida do Rejeitar durante publicação**: rejeitar um card em "Publicando…" gravava 'rejeitado', mas a publicação que já rodava no servidor continuava e sobrescrevia pra 'publicado' no final — a tela dizia "rejeitado" e o post saía de verdade. Agora o Rejeitar só funciona em rascunho puro (condição atômica no update) e avisa com clareza quando chega tarde.
- **Flake real de teste com causa raiz interessante**: novo spec permanente `admin-conteudo.spec.js` (4 testes: roteamento da function certa por plataforma, rejeitar move de aba, validações do formulário) falhava ~50% das vezes no passo de abrir o formulário. Causa: o `admin-pwa.js` recarrega a página quando o service worker assume o controle na primeira visita — e em teste TODA visita é primeira; o clique corria contra o reload e era desfeito. Corrigido com stub do service worker no harness de teste (`_supabase-mock.js`) — usuário real não é afetado, e a suíte inteira ficou ~4x mais rápida de quebra (os reloads atrasavam todos os testes).
- **Sondas de segurança ao vivo (tudo negado corretamente)**: SELECT/INSERT/UPDATE em `content_posts` com a chave anônima do site → permission denied/401; as 3 functions de publicação sem sessão de admin → 401; `content-generate-daily` sem o secret → 401.
- **Pipeline do gerador diário validado de ponta a ponta**: reexecutada a MESMA chamada que o cron fará amanhã às 8h (secret real do vault) → respondeu `{"ok":true,"skipped":"fechado_hoje"}` correto pra segunda-feira. A única parte que ainda não rodou em produção é o loop novo de gerar 2 rascunhos (Status+Facebook), que só executa em dia aberto — primeira execução real é amanhã (terça) às 8h; conferir os 2 rascunhos no push/admin.
- Suíte agora com 21 testes, 21/21 passando (3 rodadas consecutivas do spec novo sem flake).

## 28.47.1 — Fix: tela travava pra sempre se o servidor não respondesse

Achado ao vivo, em 2 tentativas seguidas do Juliano com o Story do Facebook: (1) primeira vez, a chamada ao servidor não retornou nenhuma resposta (sem log de conclusão) e o `fetch()` do navegador, sem limite de espera, ficou preso em "Publicando..." pra sempre — rascunho preso em `aprovado` liberado manualmente; (2) segunda vez, a function respondeu rápido com erro **"The signal has been aborted"** — o timeout de 20s configurado pro passo `/photo_stories` da Meta (endpoint mais raro, parece ser mais lento que os outros) estava curto demais, mesma classe de problema já visto antes com a Evolution API do WhatsApp (que também precisou de mais tempo).

- Adicionado limite de 100s na chamada do navegador (cobre com folga o pior caso real, que é o Instagram esperando a imagem processar). Se estourar, a tela volta ao normal com aviso claro: **não significa que falhou** — orienta conferir direto no Facebook/Instagram/WhatsApp antes de tentar de novo, pra não publicar duplicado (mesma cautela já usada no timeout do Status do WhatsApp).
- Timeouts internos da Meta subiram de 20s pra 35s (todas as chamadas de escrita) e 45s específico pro passo `/photo_stories` do Story do Facebook, que foi o que estourou de verdade.
- A trava de publicação dupla (lease de 3 min, da v28.46.1) já cobre o lado do banco — depois desse prazo, uma nova tentativa consegue retomar o rascunho sozinha mesmo sem essa correção.

## 28.47.0 — Story do Facebook e do Instagram na Central de Conteúdo

- **`content-publish-meta` ganha 2 novos destinos**: Story do Facebook (fluxo em 2 passos verificado na documentação da Meta — sobe a foto sem publicar via `/{page-id}/photos?published=false`, depois publica como story via `/{page-id}/photo_stories`) e Story do Instagram (mesmo container de mídia do feed, só troca `media_type=STORIES`; Story não tem campo de legenda na API — o texto precisa estar na própria imagem). Mesma trava de publicação dupla e validação de link absoluto dos outros destinos.
- **Limitação real, sem solução por API**: Story publicado por aqui **não tem o link clicável** — a figurinha de link do Instagram só existe pelo app do celular. Serve pra alcance/visibilidade; quem quiser o link clicável no Story ainda precisa publicar manualmente pelo celular.
- Admin: formulário de criação manual e cards de rascunho já reconhecem os 2 novos tipos, com aviso de que o texto digitado é só anotação interna (não sai publicado no Story).

## 28.46.1 — Auditoria de robustez da Central de Conteúdo (pré-lançamento do uso diário)

Revisão completa pedida pelo Juliano antes de começar a usar a ferramenta "100% na vida real". 3 problemas reais encontrados e corrigidos:

- **Clique duplo publicava 2x**: se o botão de publicar fosse acionado em duas abas/dispositivos ao mesmo tempo (ou num retry após timeout — exatamente o acidente que já tinha acontecido no primeiro Status), as duas chamadas passavam pela checagem e publicavam DUAS vezes. Agora as duas functions de publicação usam o status `'aprovado'` como trava atômica (só quem consegue mudar `rascunho→aprovado` publica; segunda chamada recebe 409), com lease de 3 minutos (`approved_at`) pra nunca deixar um rascunho preso se a function morrer no meio. UI mostra posts "Publicando…" na aba Rascunhos.
- **Link de imagem relativo falhava silenciosamente**: a Meta e a Evolution buscam a imagem pelos próprios servidores delas — um caminho relativo (`/assets/foo.jpg`) funciona na prévia do admin mas falha na publicação com erro genérico. Bloqueado nos 3 pontos (formulário, `content-publish-meta`, `content-publish-whatsapp`) com mensagem clara pedindo o link completo `https://`.
- **Espera do processamento do Instagram era curta**: 5 tentativas de 2s podia estourar numa imagem maior; agora 10 tentativas de 2.5s (~25s), ainda bem dentro do limite da function.

Também verificado (sem problema encontrado): cron `bdj-content-generate-daily` ativo (8h BRT, diário); as duas functions de publicação rejeitam corretamente chamadas sem sessão de admin (401 testado ao vivo); `get_advisors` de segurança sem nenhum achado novo; suíte de 16 testes do admin passando.

## 28.46.0 — Criar rascunho manual na Central de Conteúdo + gerador diário ganha Facebook

- **`content-generate-daily` agora também propõe um rascunho de Facebook por dia** (texto, mesmo fato real usado pro Status — vaga aberta ou serviço em destaque), além do Status do WhatsApp que já existia. Guarda de "já gerado hoje" agora é por plataforma (antes bloqueava os dois se qualquer um já tivesse sido gerado). Instagram fica de fora do gerador automático por enquanto — a Graph API exige imagem e ainda não existe geração automática de arte.
- **Central de Conteúdo ganha criação manual pela própria tela** (`admin-conteudo.html`): botão "+ Novo rascunho" abre um formulário (plataforma, texto, link de imagem opcional — obrigatório pro Instagram) e salva direto, sem precisar de mim/SQL. Precisou de `grant insert on content_posts to authenticated` (RLS já cobria, faltava o GRANT de base — mesma lição da migration 058).
- **Bug de CSS achado testando de propósito**: `.conteudo-new-form{display:grid}` tinha especificidade maior que a regra `[hidden]{display:none}` do navegador — o formulário nunca ficava de fato escondido, mesmo com o atributo `hidden` certo no HTML. Corrigido com `.conteudo-new-form[hidden]{display:none}` explícito.

## 28.45.0 — Publicação no Facebook/Instagram via Meta Graph API + fix do Instagram na JuIA

- **Bug real corrigido**: a JuIA respondia o handle do Instagram errado pra clientes (sem o underscore final — flagrado pelo Juliano num atendimento real). Causa: o prompt nunca informava o Instagram oficial, então o modelo "chutava" um handle plausível. Adicionado `@barbeariadoju_` como dado real do negócio no prompt (mesmo padrão de endereço/horário/pagamento — nunca inventar, sempre informar). Testado ao vivo (`curl` direto na function): resposta agora sai correta.
- **Central de Conteúdo ganha Facebook e Instagram** (Fase 1 da Central de Marketing via Meta Graph API, depois de configurar app/usuário de sistema/tokens no Meta for Developers): nova edge function `content-publish-meta` (verify_jwt=true, só admin) publica de fato via Graph API — Facebook como foto (com legenda) ou post de texto puro sem imagem; Instagram sempre com imagem (cria o container, espera processar, publica). Mesmo princípio de segurança do Status do WhatsApp: nunca publica sozinho, sempre um clique explícito do Juliano no admin. `content_posts.platform` agora aceita `facebook`/`instagram` além de `whatsapp_business`; nova coluna `meta_post_id` guarda o ID retornado pela Meta.
- `admin-conteudo.html`/`admin-conteudo-v28.js`: cada card agora mostra a plataforma (Status do WhatsApp / Facebook / Instagram) e o botão de aprovar já chama a function certa pra cada uma.
- Credenciais da Meta (token de usuário de sistema, ID da Página, ID do Instagram) guardadas como secrets do Supabase — nunca passaram pelo chat/repo.

## 28.44.5 — Prévia visual do Status na Central de Conteúdo (pedido do Juliano)

- **Prévia da arte no card de aprovação**: antes de aprovar, o `admin-conteudo.html` agora mostra a imagem exatamente como será publicada (quando o rascunho tem `context.image_url`), com a legenda logo abaixo — "assim eu já solicito as edições necessárias antes de cada post e evito expor de forma ruim". Rascunhos só-texto ganham um aviso de que o WhatsApp renderiza sobre fundo escuro. Fixture atualizada pra exercitar a prévia no teste (16/16).
- Também gerada a **capa quadrada do produto pra Hotmart** (1080×1080, recorte da arte da campanha) — a imagem original do produto (Juliano aparando uma nuca) não tinha relação com um e-book de barba, observação do próprio Juliano.

## 28.44.4 — Anti-papagaio no WhatsApp + fonte do Status de texto (Bebas Neue)

- **Fonte do Status de texto trocada (feedback do Juliano no teste real)**: o Status de texto saiu com a fonte serifada do WhatsApp (números oldstyle "caídos", "OFF" maiúsculo feio) — era o `font: 1` da Evolution. Trocado pra `font: 4` (Bebas Neue, a mesma fonte de display do site). Só afeta o fallback de texto — o **padrão oficial de anúncio** agora é Status de IMAGEM (arte com a identidade do site + legenda curta com link, renderizada na fonte padrão limpa do WhatsApp), definido com o Juliano pra todos os anúncios futuros.

- **Caso real (Juliano, 02/08/2026)**: ele encaminhou pro número da barbearia 3 mensagens de divulgação do e-book (link da Hotmart + textos promocionais), todas contendo a palavra "barba" — e a JuIA respondeu o MESMO menu "Temos algumas opções de barba..." 3 vezes seguidas, uma pra cada mensagem (espaçadas por mais de 6s, então o debounce de mensagens picadas não agrupa). A 4ª mensagem foi a recusa educada da foto (print de Status → `NAO_RELACIONADO`), que individualmente é o comportamento correto.
- **Fix no `whatsapp-webhook` (v29)**: antes de enviar a resposta gerada pela IA, compara com a última mensagem que o bot mandou pra esse telefone — se for idêntica e tiver menos de 10 minutos, suprime o envio (loga e sai em silêncio). Só se aplica ao fluxo da IA; os blocos transacionais (confirmação de presença, lista de espera, pesquisa) não passam por essa trava, porque neles a repetição é intencional ("responda sim ou não").

## 28.44.3 — Status com imagem (arte real) + limpeza dos 2 Status feios do primeiro teste

- **Descoberta do teste real**: os DOIS cliques em "publicar" tinham publicado (o primeiro, que "falhou" com timeout, também foi — a Evolution continuou processando depois do abort, exatamente o cuidado documentado na 28.44.2). Resultado: 2 Status de texto puro no ar, com o link renderizado como um preview minúsculo e feio. O Juliano pediu pra apagar e refazer profissional.
- **Limpeza**: ponte `dev-admin-tools` reativada temporariamente (mesmo padrão de sempre: token aleatório de uso único, desativada logo depois — ver histórico de deploys) pra localizar os 2 Status via `POST /chat/findMessages` (filtro `remoteJid='status@broadcast'`) e revogá-los pra todos via `DELETE /chat/deleteMessageForEveryone`.
- **Melhoria de verdade**: `content-publish-whatsapp` agora suporta **Status de imagem** — se o rascunho tiver `context.image_url`, publica `type:'image'` com a arte + legenda, em vez de texto puro. A arte promocional do e-book virou asset público do site (`assets/promo-guia-barba-status.jpg`, JPG otimizado de 154KB — a Evolution busca a imagem por URL pública). Novo rascunho criado com a arte + legenda curta com o link de compra, aguardando aprovação do Juliano no admin (fluxo de aprovação humana preservado — a correção não abriu atalho por fora dele).

## 28.44.2 — Timeout de 90s no sendStatus (segundo bug real do teste ao vivo)

- **Depois do fix de CORS, segundo erro real**: "The signal has been aborted" — logs confirmaram a função morrendo em exatos 20,2s, no timeout de 20s que eu mesmo tinha configurado pra chamada `sendStatus` da Evolution API. Publicar Status com `allContacts:true` é lento (a Evolution enumera todos os contatos pra distribuir). Timeout subiu pra 90s. **Cuidado operacional documentado**: quando esse timeout estoura, a Evolution pode ter continuado processando e publicado o Status mesmo assim — antes de clicar em "publicar" de novo, conferir no celular se o Status já apareceu (senão sai duplicado); se apareceu, marcar a linha como `publicado` direto no banco em vez de republicar.

## 28.44.1 — Corrige CORS do content-publish-whatsapp (erro real: "Failed to fetch")

- **Bug real achado pelo Juliano ao testar pela primeira vez**: clicar em "Aprovar e publicar" retornava `Não foi possível publicar: Failed to fetch` — erro de CORS, não erro do servidor (a função nunca chegava a rodar). Faltavam os headers `Access-Control-Allow-*` na resposta do `OPTIONS` (preflight) e nas respostas normais — único edge function client-facing do projeto que não tinha isso (todos os outros, como `ju-ia-admin`, já seguiam esse padrão). Corrigido copiando o mesmo `corsHeaders` já usado em `ju-ia-admin`. Confirmado via requisição `OPTIONS` real que os headers agora retornam certo antes de pedir pro Juliano testar de novo. Rascunho de teste ficou intacto (nunca chegou a mudar de status), sem necessidade de limpeza.

## 28.44.0 — Central de Conteúdo v1: rascunho diário de Status com aprovação humana

- **Novo, pedido do Juliano após avaliar uma proposta de automação total**: rascunho diário de Status do WhatsApp gerado por IA, mas **nunca publicado sozinho** — decisão consciente após pesar o risco de suspensão do número (o mesmo que roda a JuIA) por padrão de bot detectável em publicação automática recorrente. Toda publicação exige um clique explícito do Juliano.
- **Migration 076**: tabela `content_posts` (RLS via `is_admin()`, GRANT `authenticated`=SELECT/UPDATE e `service_role`=INSERT/SELECT/UPDATE, mesmo padrão de todo o projeto) e RPC `pick_featured_service()` (rotaciona entre serviços ativos por dia do ano, sempre com preço/duração reais de `public.services`, nunca inventado).
- **Edge function `content-generate-daily`** (cron `bdj-content-generate-daily`, 8h BRT todo dia): checa se a barbearia abre hoje (pula domingo/segunda), evita gerar duas vezes no mesmo dia, e monta o fato do dia com dado real — vaga aberta hoje (via `get_available_slots`) ou serviço em destaque (via `pick_featured_service`) quando a agenda já está cheia. O texto em si é escrito por IA (gpt-5.6-luna, mesma usada na JuIA) a partir desse fato real — nunca inventa preço/horário — com fallback determinístico se a IA falhar. Avisa o Juliano por push quando o rascunho fica pronto.
- **Edge function `content-publish-whatsapp`** (verify_jwt=true, só admin autenticado): único ponto do sistema que de fato chama `POST /message/sendStatus/{instance}` da Evolution API (endpoint confirmado na documentação oficial antes de implementar). Reverte pra rascunho se a publicação falhar, pra não perder o texto.
- **Tela `admin-conteudo.html`** + `admin-conteudo-v28.js`: abas Rascunhos/Publicados/Rejeitados, legenda editável antes de aprovar, botões "Aprovar e publicar" / "Rejeitar". Link adicionado no menu lateral de todas as 14 páginas do admin.
- **Escopo definido deliberadamente pra essa v1** (registrado, não esquecido): agendamento oficial via API da Meta pra Instagram/Facebook (exige App Review da Meta, processo à parte, similar ao que já está em andamento pro Google Reviews) e rastreamento de cliques ficam pra uma próxima etapa.
- Testado: geração real contra o banco (`get_available_slots`/`pick_featured_service` confirmados com dado real de terça-feira; hoje sendo domingo, a função corretamente pulou com `skipped:'fechado_hoje'`), fixture nova (`mock-cp-1/2/3`) cobrindo os 3 status, `npm run test:admin` (16/16) e regressão geral. `get_advisors` sem findings novos nos objetos criados.

## 28.43.3 — Copy mais curta e direta no box do e-book (7 artigos)

- **Texto do `.ebook-promo` encurtado** a pedido do Juliano: título vira pergunta direta ("Quer aprender tudo sobre cuidados com a barba?"), descrição cai pra uma linha, removida a menção à garantia de 7 dias dentro do box (já fica visível na própria página de checkout), botão passa de "Quero o guia completo →" pra "Comprar agora". Preço com valor real (R$49,99 → R$24,99) mantido — converte melhor que só citar "50% de desconto" em texto solto. Testado nos 7 artigos + regressão geral.

## 28.43.2 — Revisão profunda de acabamento (pedido do Juliano: "padrão premium estilo Apple")

- **Auditoria completa de tudo desta sessão** (Playwright em desktop 1280px e mobile 375px, screenshots reais + estilos computados): hero com 4 botões, seção Centro de Conhecimento, blocos `.product-pick` (10 artigos) e `.ebook-promo` (7 artigos), seção Sazonal do blog. Zero overflow horizontal em mobile; blocos do e-book quebram linha corretamente no celular.
- **4 despadronizações encontradas e corrigidas**:
  1. **Card "Sazonal" órfão no `blog.html`** — 1 card sozinho numa grade de 3 colunas ficava visualmente torto sob o título gigante "Cuidados por estação". Nova classe `.link-card.featured` (`grid-column:1/-1`): o card agora ocupa a largura toda, como um destaque proposital. Padrão reutilizável pra qualquer seção futura com artigo único.
  2. **Raios de borda divergentes** — `.product-pick` usava 14px enquanto `.ebook-promo` e `.series-nav` usam 16px. Unificado em 16px.
  3. **17 estilos inline repetidos** — o texto de disclosure de comissão da Amazon carregava `style="font-size:.82rem;..."` colado em cada ocorrência (10 arquivos). Virou classe única `.promo-disclosure` no CSS; qualquer ajuste futuro é feito num lugar só.
  4. **`&` sem escape em 10 hrefs de afiliado** — `&tag=` virou `&amp;tag=` (validade HTML + convenção já usada no restante do site, ex. link do Google Fonts). O navegador decodifica de volta, link funciona idêntico (confirmado por teste lendo o href do DOM).
- Bump de cache coordenado (`?v=28.43.2` nas 62 páginas + `@import` + preload), seguindo a lição da v28.43.1. Regressão completa: 11/11 site + 15/15 admin.

## 28.43.1 — Bug real: cache de `style.css` travado há muitas versões + botão do blog no hero

- **Bug real encontrado pelo Juliano** (visual quebrado no `.ebook-promo` em produção — preço/tag tudo grudado, sem espaçamento nem estilo de pílula): 61 das 62 páginas HTML do site referenciavam `<link href="/style.css?v=28.21.1">` — uma versão de cache muito antiga, nunca atualizada desde então (mesmo "quirk" de versionamento já documentado no projeto). Como o parâmetro `?v=` nunca mudava nessas páginas, navegadores/CDN podiam continuar servindo uma cópia em cache do `style.css` de muito tempo atrás, que nunca chegava a puxar o `04-agenda-admin-core.css` atualizado (onde vivem `.product-pick`, `.priority-table`, `.ebook-promo` etc.) — o CSS novo simplesmente nunca era buscado de novo pelo navegador. Corrigido bumpando `?v=` pra `28.43.0` (batendo com `VERSAO.md`) em **todas** as 62 páginas de uma vez, evitando deixar esse mesmo problema se repetir silenciosamente em qualquer outra página. Também corrigido o `<link rel="preload">` do `04-agenda-admin-core.css` no `index.html`, que apontava pra uma versão ainda mais antiga (`28.29.3`).
- **Novo botão "📖 Blog: dicas de barba e cabelo"** na fileira de botões do hero da home (pedido explícito do Juliano — antes o blog só era acessível pelo rodapé ou pela seção "Centro de Conhecimento" mais abaixo na página; agora tem um CTA com o mesmo destaque visual dos outros 3 botões principais, visível logo na primeira dobra).
- Testado renderizando de verdade contra o servidor local (Playwright): confirmado `display:flex` aplicado no preço do e-book (antes a regra nunca chegava a rodar) e o botão do blog visível no hero. Regressão geral (`routes.spec.js`/`cart.spec.js`) e `npm run test:admin` (15/15) sem problemas.

## 28.43.0 — Lançamento do e-book "Guia Definitivo da Barba" (Hotmart) + destaque do blog na home

- **Primeiro produto digital à venda**: "Guia Definitivo da Barba" (25 páginas, capítulo completo sobre crescimento/genética/minoxidil com cautela médica, fotos reais, QR codes, bônus) publicado na Hotmart (produto `S106993067N`), preço cheio R$49,99 com cupom de lançamento `LANCAMENTO` (R$24,99, ~50% off, válido até 01/09/2026). Garantia de 7 dias (padrão da Hotmart, já ativa). Link de checkout com cupom pré-aplicado: `https://pay.hotmart.com/S106993067N?offDiscount=LANCAMENTO` (parâmetro oficial da Hotmart pra aplicar cupom via URL sem o cliente digitar nada).
- **Componente novo `.ebook-promo`** (`css/04-agenda-admin-core.css`) inserido nos 7 artigos do blog realmente sobre cuidados com a barba (barba encravada/ressecada, barboterapia, formato de barba ideal, produtos profissionais x caseiros, reduzir irritação pós-barbear, ingredientes de produtos, cuidados de inverno) — preço com desconto, tag "50% off · lançamento", menção à garantia de 7 dias, botão de compra. Comunicação evita a palavra "PDF" (soa mais básico) em favor de "e-book premium" — sugestão de quem revisou o material antes do lançamento.
- **Nova seção de destaque na home** (`index.html`, reaproveitando o mesmo estilo visual do card de avaliações do Google): "Centro de Conhecimento" com botão pro blog e pro e-book — antes o blog só era acessível pelo rodapé, escondido; pedido explícito do Juliano pra dar mais ênfase a essa seção.
- **Lembrete agendado** pra 28/08/2026 (poucos dias antes do cupom expirar em 01/09) perguntando ao Juliano se quer estender o prazo ou deixar expirar.
- Testado com Playwright (specs temporários cobrindo os 7 artigos + home: preço correto, link correto, sem a palavra "PDF", zero erro de console) + regressão geral (`routes.spec.js`/`cart.spec.js`) e `npm run test:admin` (15/15), specs apagados depois.

## 28.42.0 — Link de afiliado Amazon propagado pros outros 9 artigos do blog

- **Propagação do componente `.product-pick`** (introduzido em v28.41.0) pros 9 artigos restantes do blog que faziam sentido — 2 artigos (`blog-como-funciona-agendamento-juia.html`, sobre agendamento, e `blog-quanto-custa-corte-braganca-paulista.html`, sobre preço) foram deliberadamente deixados de fora por não terem um produto complementar que se encaixasse organicamente; forçar um item ali pareceria spam e destoaria do padrão editorial de credibilidade (E-E-A-T) já estabelecido no site.
- **Produto escolhido caso a caso, ligado ao conteúdo real do artigo** (todos complementares, nenhum concorrendo com o que a Barbearia do Ju já vende no balcão — óleo, balm, pomada, gel, shampoo/condicionador): escova de cerdas naturais (barba encravada/ressecada), aquecedor de toalhas elétrico (barboterapia, ecoa o passo da toalha quente), espelho de aumento com LED (fade baixo/alto), tesoura de precisão (formato de barba ideal), protetor solar facial (ingredientes de produtos, ecoa a discussão de barreira da pele), secador com difusor (melhor corte pra rosto redondo), nécessaire organizadora (produtos profissionais x caseiros), rolo de gelo facial/ice roller (reduzir irritação pós-barbear), aparador elétrico de acabamento (tendências de corte 2026).
- Todos os links usam a tag real `barbeariadoju-20`, `rel="sponsored noopener"` e o mesmo texto de disclosure exigido pelo acordo da Amazon. Testado com Playwright (spec temporário cobrindo os 9 arquivos: link presente, tag correta, badge correto, zero erro de console) + regressão geral (`routes.spec.js`/`cart.spec.js`), specs apagados depois.

## 28.41.0 — Item 5: novo artigo de blog (cuidados de inverno) + base de monetização por afiliados

- **Novo artigo** `blog-cuidados-barba-pele-inverno.html` (item 5 da lista de melhorias, tema escolhido pelo Juliano): por que o frio resseca mais a barba e a pele (xerose cutânea, queda de umidade do ar, banho quente), cuidados no dia a dia e quando procurar um dermatologista. Segue o padrão editorial já fixado no projeto: `.practice-note`/`.pharma-note`/`.warning-note`, data de publicação, seção "Fontes consultadas" com 4 fontes reais (Sociedade Brasileira de Dermatologia, American Academy of Dermatology, DermNet NZ, Manual MSD), interlinkagem com o artigo de barba encravada/ressecada (link recíproco nos dois sentidos) e com barboterapia. Adicionado em `blog.html` (nova seção "Sazonal", já que não é parte da série fechada "Ciência da Barba") e em `sitemap.xml`.
- **Nova peça de monetização (pedido do Juliano)**: componente `.product-pick` (CSS novo em `css/04-agenda-admin-core.css`, bump do `?v=` no `@import` de `style.css`) — bloco reutilizável de "sugestão de produto" pra indicar itens complementares (que a barbearia NÃO vende no balcão, pra não concorrer com a venda própria de óleo/balm/pomada) via link de afiliado Amazon. Usado nesse primeiro artigo com "umidificador de ambiente" (recomendação da AAD contra o ar seco do inverno). **Ainda sem tag de afiliado real** — o link aponta pra uma busca genérica na Amazon (funcional, honesto, sem comissão ainda) até o Juliano concluir o cadastro no Amazon Associados; assim que tiver a tag, o link entra em todos os artigos (planeado: ~5 produtos por artigo).
- **Plano combinado com o Juliano pra monetização mais ampla**: (1) Amazon Associados pra links de afiliado nos ~12 artigos do blog; (2) venda de PDFs aprofundados por artigo via Hotmart (checkout com Pix/cartão/boleto + entrega automática por e-mail, sem precisar construir gateway de pagamento próprio). Ambos exigem cadastro pessoal do Juliano (CPF/dados bancários) — fora do escopo de código, ele está fazendo os dois cadastros. Assim que tiver a tag da Amazon e o link de checkout da Hotmart do primeiro PDF, o conteúdo do PDF é escrito (mesma régua de fontes reais/evidência) e os dois entram nos artigos.
- **Atualização no mesmo dia — tag da Amazon já recebida**: Juliano concluiu o cadastro no Amazon Associados e recebeu a ID `barbeariadoju-20`. Link do artigo de inverno atualizado com `?tag=barbeariadoju-20`, `rel="sponsored noopener"` (atributo recomendado pelo Google pra link pago/afiliado, em vez de só `nofollow`), badge trocado de "Sugestão de produto" pra "Link de afiliado", e adicionado o texto de disclosure exigido pelo próprio acordo operacional da Amazon ("como associado Amazon, a Barbearia do Ju pode receber uma comissão..."). Cadastro fiscal/bancário na Amazon (só ele pode fazer) ainda pendente — necessário antes de qualquer saque de comissão. Regra da Amazon a observar: cadastro é revogado se nenhum link gerar pedido em até 180 dias.

## 28.40.0 — Fecha o loop da lista de espera: JuIA oferece a vaga e confirma pelo WhatsApp (item 1)

- **Novo**: quando uma vaga compatível abre (cancelamento ou remarcação, de qualquer origem — admin, site, WhatsApp, auto-cancelamento de duplicata), a JuIA agora **avisa diretamente o cliente da lista de espera pelo WhatsApp**, perguntando se ele ainda quer aquele horário. Antes disso, só o Juliano era avisado (push) e o encaixe era 100% manual em `admin-espera.html` — o cliente nunca sabia que a vaga tinha aberto a menos que ligasse ou mandasse mensagem por conta própria.
- **Arquitetura** (mesmo padrão já validado do item 0, `bookings_notify_leads_slot_reopened`): um único trigger Postgres (`bookings_notify_waitlist_slot_reopened`, migration 075) cobre cancelamento/remarcação de qualquer origem, porque todo caminho no fim das contas faz um UPDATE em `public.bookings`. O trigger marca **só o candidato mais antigo da fila** cujo pedido realmente cabe no horário liberado — checagem extra de duração via `get_available_slots` (não basta o horário exato de início estar livre; o serviço completo do candidato precisa caber, evitando oferecer 14h a quem pediu 1h de serviço se só sobrou 30min). O envio da mensagem em si é feito pelo cron já existente `whatsapp-lead-followup` (a cada 15min), não em tempo real pelo trigger — decoupling deliberado, mesmo racional do item 0.
- **Confirmação pelo cliente**: resposta "sim"/"não" é interpretada por `whatsapp-webhook` (novo bloco, mesmo padrão de `find_pending_confirmation_by_phone` já usado pra confirmação de presença) — "sim" chama `phone_confirm_waitlist_booking`, que reaproveita `create_public_booking_v15` (herda toda a validação e a reconferência de horário livre no momento exato da confirmação — se alguém ocupou o horário entre a oferta e a resposta, o cliente é avisado e devolvido pra fila em vez de achar que agendou); "não" ou silêncio mantém o cliente na lista, aberto a novas ofertas.
- Testado ponta a ponta com dados fictícios (telefones de teste, apagados depois): trigger dispara corretamente ao cancelar (status `avisado` + `offered_date`/`offered_start_time` preenchidos), `find_pending_waitlist_offer_by_phone` só retorna depois que `notified_at` é setado (simulando o cron), `phone_confirm_waitlist_booking` cria o agendamento real e marca `encaixado`, e o guard de duração corretamente **recusa** um candidato de 60min quando só sobra um encaixe de 30min (testado forçando esse cenário específico). Nenhum dado real foi tocado; `get_advisors` não apontou nenhum problema novo nas functions criadas.

## 28.39.1 — Taxa de conversão na lista de espera

- **Novo card de métrica em `admin-espera.html`**: "Taxa de conversão" — quantos pedidos já resolvidos (encaixado/cancelado/expirado) viraram agendamento de verdade. Mesmo raciocínio da taxa de recuperação do funil de reativação (`admin-leads.html`): só conta quem já teve desfecho, excluindo quem ainda está esperando/avisado (sem resposta ainda). Sem pedidos resolvidos, mostra "—" em vez de dividir por zero.
- Testado com fixture nova (1 encaixado + 1 cancelado → 50%, "1 de 2 pedidos resolvidos") e `npm run test:admin` (15/15).

## 28.39.0 — Limpeza de índices órfãos (reavaliação dos advisors)

- **Reavaliados os ~15 índices "não usados" apontados pelos advisors** (pedido do Juliano). A maioria continua sendo índice legítimo de suporte a tabela ativa com baixo tráfego (negócio pequeno) — mesma conclusão da auditoria anterior (28.29.1), não vale dropar precocemente. Dois casos, porém, eram genuinamente órfãos, não só "baixo tráfego":
  - **`email_outbox` era uma fila morta da v21** (migration 013): a trigger `bookings_v21_email_queue` ainda gravava nela a cada agendamento/mudança de status, mas nenhuma edge function lê essa tabela desde que o envio real de e-mail migrou pra `email_queue` (usada por `booking-email`/`send-email`/`notifications-watchdog`/`booking-reminder-24h`). Confirmado: as 40 linhas existentes estavam TODAS com `status='pending'`, nunca processadas — cliente não perdia e-mail nenhum (o envio real acontece por outro caminho), era só overhead de escrita numa tabela que só crescia sem propósito. Trigger, função e tabela removidas (migration 074).
  - **`bookings_customer_phone_idx` nunca podia ser usado**: toda consulta de telefone no banco usa `regexp_replace(customer_phone,...)` ou `phone_match_key()`, nunca a coluna crua — confirmado varrendo todas as migrations. Um índice btree simples na coluna não serve pra filtro por função da coluna, então esse era órfão por design, não por baixo volume. Removido.
- Testado com `npm run test:admin` (15/15) depois da limpeza, e confirmado por grep que nada no front-end/admin referenciava `email_outbox`.

## 28.38.3 — Foto do Juliano recortada corretamente (hero + avatar do autor)

- **Corrigido**: a foto de corpo inteiro (`juliano-retrato.jpg`, 768×1376, retrato) estava sendo forçada em dois espaços que não combinam com esse formato — a foto grande de `sobre-o-juliano.html` (faixa larga e baixa) cortava o rosto quase inteiro (só aparecia do pescoço pra baixo), e o avatar circular de "Escrito por Juliano..." (presente em ~33 páginas de blog/serviço) mostrava o rosto pequeno e mal enquadrado.
- **Solução**: criado um recorte dedicado (`assets/juliano-retrato-rosto.jpg`/`.webp`, 768×480), focado no rosto/ombros, sem o corpo inteiro. Usado na foto grande de `sobre-o-juliano.html`, no avatar circular das ~33 páginas com "author-box", no `og:image`/`twitter:image` de `sobre-o-juliano.html` e no campo `image` do schema.org `Person` em `index.html` (mesma lógica: qualquer recorte automático de uma foto de retrato tende a cortar o rosto). A foto de corpo inteiro original continua em uso na seção "Sobre" da home (`.portrait-stack`), que já exibia o retrato corretamente sem cortar nada.
- Testado renderizando de verdade (Playwright + servidor local, screenshot de `.blog-hero` e `.author-box`) — primeira tentativa de recorte (quadrado 480×480) ainda ficava com zoom demais na faixa larga do hero; corrigido alargando o recorte pra 768×480, testado de novo e confirmado visualmente nos dois lugares.

## 28.38.2 — Bateria robusta de testes da JuIA + bug de "sim" ambíguo na lista de espera corrigido

- **Bateria de testes em produção a pedido do Juliano** (telefones fictícios, dados apagados depois): saúde geral (todas as functions 200, conexão WhatsApp `open`), preço, negação "sem barba", fluxo completo de lista de espera (entrada com frase explícita, entrada com "sim" na oferta direta, descarte com "não"), agendamento real + cancelamento pela JuIA com o novo aviso de vaga pra lista de espera (2 pushes confirmados nos logs), `source='whatsapp'` confirmado no banco, boot do webhook (401 sem secret). Resultado final: **6/6 PASS** + fluxo de cancelamento OK.
- **Bug real encontrado e corrigido no processo**: quando não havia horário no dia pedido e a JuIA oferecia um dia alternativo ("Quer marcar nesse dia? Se preferir, também posso te colocar na lista de espera..."), um **"sim" do cliente confirmando a RESERVA no novo dia era sequestrado** pela detecção da lista de espera — o cliente achava que tinha agendado, mas só entrava na lista do dia original. Corrigido: "sim" solto só entra na lista quando a pergunta foi DIRETA sobre a lista (caso sem nenhum dia alternativo, novo flag `direct` na oferta); a frase explícita/botão continua valendo nos dois casos; "não" com oferta pendente agora descarta a oferta (evita reativação acidental depois); agendamento concluído limpa a oferta pendente.
- Reteste após o fix: "sim" com dia+hora escolhidos **agenda de verdade** (não sequestra mais), oferta direta + "sim" entra na lista, frase explícita entra na lista, "não" descarta. Tudo verificado contra a versão publicada.

## 28.38.1 — Origem correta ("whatsapp") na lista de espera

- **Corrigido detalhe cosmético encontrado na v28.38.0**: `join-waitlist` sempre gravava `source:'site'`, mesmo quando quem chamava era a JuIA no WhatsApp (mesma function serve os dois canais) — entradas do WhatsApp apareciam com a etiqueta errada no admin. A constraint só aceitava `site`/`admin` (migration 073 adiciona `whatsapp`); `join-waitlist` agora recebe o canal real do chamador (`ju-ia-site` manda `whatsapp` quando `verifiedPhone` está presente, `site` caso contrário); `admin-espera.html` ganhou um rótulo próprio (`💬 whatsapp`) em vez de cair no fallback `✍ admin`, que seria uma etiqueta ativamente errada.
- Testado com `npm run test:admin` (fixture nova com `source:'whatsapp'`) — confirmado visualmente no screenshot que a nova entrada aparece com "💬 whatsapp" em vez de "✍ admin".

## 28.38.0 — JuIA revisa a conversa do dia inteiro (item 6, último da lista de melhorias) + aviso de vaga da lista de espera também no cancelamento pelo WhatsApp

- **Item 6 concluído**: no canal WhatsApp, o histórico enviado ao modelo antes de responder deixou de ser uma janela rolante de 6h/últimas 10 mensagens e passou a ser o **dia calendário inteiro** (meia-noite de Brasília até agora), com limite maior (40 mensagens) para não truncar um dia movimentado. Evita respostas fora de contexto quando o cliente conversa de manhã e volta à tarde no mesmo dia (ex.: repetir uma pergunta já respondida, ou não perceber que já é a segunda vez que ele pergunta a mesma coisa). O reset do state ESTRUTURADO (data/serviço escolhidos) continua com a janela de 6h de antes (`STALE_CONVERSATION_MS`) — são dois mecanismos diferentes, história de conversa x dados do agendamento em andamento, e só o primeiro foi alterado.
- **Fechada uma lacuna encontrada ao revisar o item 4**: o aviso automático de "vaga aberta" para quem está na lista de espera (push pro Juliano, já existente desde v28.8.0 em `admin-booking-status`/`manage-booking`) não disparava quando o cancelamento ou remarcação era feito pela própria JuIA no WhatsApp (`whatsapp_cancel_booking`/`phone_reschedule_booking`, chamadas direto em `ju-ia-site`, sem passar por aquelas duas functions). Agora os três pontos de `ju-ia-site` que liberam um horário (cancelamento confirmado, cancelamento de agendamento duplicado, remarcação — usando o horário ANTIGO que fica livre) também chamam `waitlist_matches_for_slot` e avisam o Juliano por push, mesmo padrão do admin. Continua manual: só avisa, o encaixe de fato é feito pelo Juliano em `admin-espera.html`.
- Testado com `waitlist_matches_for_slot` via SQL (fixture temporária confirmando match por data e não-match por data diferente, apagada depois) e boot-check via curl confirmando que o deploy compilou e respondeu normalmente. O teste end-to-end completo do cancelamento (que dispararia um push real pro celular do Juliano, mesmo comportamento já existente antes desta mudança) não foi executado sem aviso prévio — seguindo o mesmo cuidado já registrado no projeto sobre testes ao vivo de `send-push`.

## 28.37.0 — Lista de espera integrada no WhatsApp (item 4 da lista de melhorias)

- **Novo**: quando não há horário disponível no dia pedido (nem no dia alternativo mais próximo), a JuIA agora oferece diretamente colocar o cliente na lista de espera do dia original — antes esse recurso só existia no chat do site (`agendar/horario`). Reaproveita a mesma Edge Function `join-waitlist` já usada lá (dedup por telefone, aviso push pro Juliano).
- Exige apenas telefone (WhatsApp ou já conhecido na conversa) e nome — risco bem menor que cancelar/remarcar (não mexe em nada existente), por isso não exige o mesmo nível de confirmação por WhatsApp verificado.
- **Bug real achado testando de propósito**: a mensagem "Quero entrar na lista de espera" contém a palavra "quero", que satisfaz a heurística `simpleYes` usada em outro ponto do código (o bloco que retoma o fluxo de agendamento depois dos upsells resolvidos). Sem excluir a nova intenção `join_waitlist` desse bloco, ele sobrescrevia a classificação e **criava um agendamento de verdade** no dia/horário alternativo oferecido, em vez de colocar o cliente na lista de espera do dia original que ele pediu — o oposto do que foi pedido. Corrigido excluindo `join_waitlist` do gate `notSpecialFlow` (mesmo padrão já usado pra cancel/reschedule/change_service/update_products). Encontrado e corrigido antes de qualquer cliente real ser afetado — testado end-to-end via curl com telefone de teste, incluindo o cenário exato que quebrou, antes e depois do fix.
- Testado o fluxo completo (serviço → upsells → dia sem vaga → oferta de lista de espera → confirmação) e regressão de um agendamento normal em dia com vaga.

## 28.36.0 — JuIA interpreta conteúdo de links (item 2 da lista de melhorias)

- **Novo**: quando o cliente manda um link em vez de escrever (post de Instagram/TikTok com uma foto de referência, ou qualquer outra página), a JuIA agora tenta abrir o link com segurança e usar o conteúdo — antes disso só recusava educadamente sem tentar ver nada. Funciona nos dois canais (site e WhatsApp).
- **Guarda contra SSRF**: só http/https; bloqueia hostname literal privado/loopback/link-local/metadados de nuvem (checagem síncrona sempre ativa); tenta resolver DNS e bloquear se o IP resolvido for privado (proteção extra, falha aberta pra domínio público se a checagem de DNS não estiver disponível no runtime); cada redirect é revalidado do zero antes de seguir; limite de tamanho e timeout na busca da página e da imagem.
- Extrai a imagem principal da página (`og:image`) e roda pela mesma chamada de visão do item 1 (v28.35.0) pra descrever o corte/barba/cor. Sem imagem, usa título/descrição da página como contexto. Se nada funcionar (link bloqueado, sem metadados, erro de rede), mantém a recusa educada.
- **Bug real achado testando o recurso**: uma descrição de imagem contendo "sem barba" disparava o menu de opções de barba mesmo assim — o regex que detecta menção a barba não entendia negação. Corrigido (mesmo padrão já usado pro "não quero cancelar").
- Testado com um link real (Wikipedia, artigo sobre corte de cabelo): a JuIA extraiu a imagem, descreveu o corte corretamente e seguiu a conversa normalmente. Regressão conferida com mensagens normais antes e depois do fix.

## 28.35.0 — JuIA reconhece fotos de referência no WhatsApp (item 1 da lista de melhorias)

- **Bug real corrigido de quebra**: antes desta versão, quando um cliente mandava uma FOTO pelo WhatsApp (com ou sem legenda), a JuIA ficava em silêncio total — pior do que uma recusa educada. A legenda da foto (`imageMessage.caption`) nunca era lida pelo código, então a mensagem sempre caía no mesmo caminho de "mídia sem texto, sem resposta".
- **Novo**: `whatsapp-webhook` baixa a foto via Evolution API (mesmo endpoint já usado pra transcrever áudio) e manda pra um modelo com visão (mesmo `gpt-5.6-luna` da JuIA, agora com input multimodal). O modelo descreve o corte/barba/coloração mostrado (comprimento, degradê, risco, formato da barba etc.) e essa descrição entra no fluxo normal da conversa, como se fosse o texto do cliente — a JuIA responde considerando a referência enviada.
- Se a foto não mostrar claramente um corte/barba/coloração, responde educadamente pedindo pra descrever com palavras (sem gastar handoff). Se a análise falhar por qualquer motivo, cai num fallback educado — nunca mais silêncio total.
- Testado a chamada de visão isoladamente (ponte temporária, sem tocar no WhatsApp real): confirmado que reconhece um corte/cabelo real e que recusa educadamente uma foto sem relação, antes de liberar em produção.

## 28.34.0 — Funil de reativação avançado (item 0 da lista de melhorias, o mais pedido)

- **Reabertura de vaga proativa**: quando um agendamento que ocupava a data que um lead abandonado queria é cancelado ou reagendado — de QUALQUER origem (admin, site, WhatsApp, ou o auto-cancelamento por falta de confirmação da v28.32.0) — a JuIA agora avisa esse cliente sozinha ("abriu uma vaga de novo pra [data]..."). Implementado com um trigger direto na tabela `bookings` (`bookings_notify_leads_slot_reopened`, migration 070), que cobre todos os pontos de cancelamento/reagendamento de uma vez só, sem precisar caçar cada chamada de RPC em TypeScript. O envio de fato acontece no cron `whatsapp-lead-followup`, que já rodava a cada 15 min.
- **Pontuação quente/morno/frio**: nova view `conversation_leads_scored` classifica cada lead por intenção (motivo respondido > tipo de conversa > esfriou por silêncio de 10+ dias), usada no novo painel `admin-leads.html`.
- **Campanha por interesse antigo (disparo manual)**: nova Edge Function `conversation-leads-campaign` — o Juliano decide quando disparar, com filtro opcional por serviço, nunca automática. Nunca inventa promoção/desconto.
- **Painel de analytics do funil** (`admin-leads.html`, novo item no menu): quente/morno/frio em aberto, taxa de recuperação (quantos leads viraram agendamento de verdade), motivos de desistência (sem horário/preço/só pesquisando/outro). Pra calcular a taxa de recuperação, o `ju-ia-site` deixou de apagar o lead quando ele vira agendamento — agora marca `resolution='booked'` e preserva a linha (só esse caso; os outros motivos de limpeza continuam apagando como antes).
- Testado com `npm run test:admin` (15/15) + teste temporário de interação (filtro por heat, disparo de campanha simulado), apagado depois. Regressão do `ju-ia-site` conferida com mensagem real via curl/Node antes e depois do deploy.
- `get_advisors` rodado depois das migrations (hábito do projeto): achou 1 finding real (função de trigger executável via RPC por engano, sem risco prático mas corrigido mesmo assim, migration 072).

## 28.33.0 — Avaliações do Google com rascunho de resposta por IA (modo aprovação)

- **Nova tela `admin-avaliacoes.html`**: lista avaliações recebidas no Google Business Profile, cada uma com um rascunho de resposta gerado por IA. O Juliano revisa, edita se quiser, aprova e só então publica de fato no Google — nunca publica sozinha. Abas Pendentes/Aprovadas/Publicadas/Ignoradas, mesmo padrão visual de card colapsável do resto do admin.
- **Duas Edge Functions novas**: `google-reviews-sync` (busca avaliações novas via API do Google, gera o rascunho com IA seguindo o mesmo tom/EEAT do site e mencionando naturalmente serviços reais/"Barbearia do Ju"/"Bragança Paulista", avisa por push) e `google-reviews-publish` (só essa escreve de fato no Google, só chamada pelo admin autenticado depois da aprovação).
- **Nova tabela `google_reviews`** (migration 069): fila com status pending → approved → posted, mesmo padrão de outras filas do sistema (email_queue, sms_queue).
- **Pré-requisito em andamento**: acesso à API de avaliações do Google (Business Profile) depende de aprovação separada do Google (protocolo 8-0854000041581, solicitado em 2026-08-01, prazo 7-10 dias úteis) + autorização OAuth depois disso. Até lá, as duas functions ficam deployadas mas inertes (sem credencial configurada) — nenhum cron agendado ainda.

## 28.29.2 — 2 bugs reais da JuIA corrigidos (análise de ~200 conversas reais)

- **Bug sério: agendamento criado com horário errado.** Cliente com um corte já concluído (dia X, 11h) pediu um agendamento novo pra outro dia, "16h ou 17h" — a JuIA confirmou usando o horário antigo (11h, do atendimento já feito), ignorando completamente o que o cliente pediu. Corrigido: sempre que aparece uma data nova depois de um atendimento já concluído, o horário antigo é descartado e a JuIA pergunta de novo, em vez de herdar um horário de um atendimento encerrado.
- **Bug de loop: "não quero cancelar" era lido como pedido de cancelamento.** Frase como "Não quero cancelar, quero mudar pra barba" travava a JuIA perguntando "quer mesmo cancelar? sim ou não" repetidamente, porque a detecção de cancelamento reagia à palavra "cancelar" mesmo dentro de uma negação. Corrigido: uma negação explícita antes de "cancelar" agora cancela a própria detecção de cancelamento, deixando a troca de serviço seguir normalmente.
- **2 ajustes de prompt**: uma saudação isolada ("oi", "boa tarde") no meio da conversa não reabre mais a busca de horário à toa; e quando o cliente oferece dois horários possíveis na mesma frase ("16h ou 17h"), a JuIA agora pergunta qual em vez de arriscar um dos dois (ou herdar um valor antigo).
- Os 2 bugs foram encontrados numa análise de ~200 conversas reais do WhatsApp e do chat do site, feita a pedido do Juliano depois do caso do cliente Lucas (v28.28.1). Testados reproduzindo exatamente o cenário real que quebrou, antes e depois da correção, com telefone de teste.

## 28.29.1 — Auditoria de segurança/performance do banco (achados dos advisors)

- **Vazamento de dados real corrigido**: a view antiga `v27_customer_metrics` (resquício do CRM de 2026-anterior, migration 027) rodava com privilégio elevado (`SECURITY DEFINER`, ignora RLS) e tinha permissão de leitura pro papel `authenticated` — que nesse projeto inclui qualquer **cliente logado na área do cliente**, não só o Juliano. Qualquer cliente logado conseguia consultar essa view direto pela API e ver nome, telefone, e-mail e histórico de gasto de **todos** os outros clientes. Confirmado que nada no código atual usa essa view — removida (migration 059).
- **3 policies de RLS duplicadas removidas** (mesma condição, cobrindo o mesmo caso duas vezes) em `contact_messages`, `customer_timeline` e `experience_requests` — cada consulta pagava o custo de avaliar as duas à toa.
- **3 policies de RLS otimizadas** para reavaliar `auth.uid()` uma vez por consulta em vez de uma vez por linha (`admin_users`, `ai_conversations`, `push_subscriptions`) — ganho de performance em escala, sem mudar o comportamento.
- **5 índices novos** em chaves estrangeiras que não tinham (bookings, customer_timeline, email_outbox, loyalty_events, waitlist) + **1 índice duplicado removido** em `customer_timeline`.
- **3 funções sem `search_path` fixo corrigidas** (`waitlist_touch_updated_at`, `phone_match_key`, `touch_contact_messages_updated_at`) — hardening padrão, sem mudança de comportamento (migration 060).
- **Pendência que só o Juliano pode resolver** (é uma configuração da conta, não do banco): ativar "Leaked Password Protection" no painel do Supabase Auth (checagem de senha vazada contra HaveIBeenPwned) — está desativado.

## 28.29.0 — Cards colapsáveis no CRM, Fidelidade, Lista de espera

- **Mesmo visual "clique pra expandir" da Agenda/Atendimento (v28.24.0) agora também no CRM, na Fidelidade e na Lista de espera.** O card do CRM mostrava tudo sempre (aniversário, tags, preferências, notas, sugestão privada, estatísticas inteiras) e ficava enorme — agora colapsa pra um resumo (avatar, nome, telefone, badge VIP, Ju Score) e expande com um clique pro resto. Mesmo padrão na Lista de espera (resumo: nome + dia/horário/serviço) e na Fidelidade (resumo: nome/telefone/barra de progresso, escondendo só o botão "✎ Ajustar carimbos", ação ocasional).
- **De brinde: a Fidelidade não tinha nenhum estilo de card antes** (os itens da lista apareciam sem borda, sem fundo, sem cantos arredondados) — corrigido junto.
- Reaproveita as mesmas classes CSS já usadas pela Agenda (`.admin-booking-summary`/`.admin-booking-detail`, globais via `css/04-agenda-admin-core.css`) em vez de duplicar o mecanismo de colapsar em cada tela.
- Atendimento Balcão: conteúdo já era compacto (uma linha só), sem necessidade de colapsar — só ganhou o mesmo destaque de borda ao passar o mouse, pra manter a família visual.

## 28.28.1 — Catálogo de serviços unificado + correção de bug real na JuIA

- **Novo `public.services`** (migration `057`): os 22 serviços que viviam duplicados em `services-catalog-v7.js` (front-end) e num array hardcoded dentro de `ju-ia-site/index.ts` agora têm uma tabela única no banco, mesmo padrão já usado pra produtos (`public.products`, migration 051). A Edge Function `ju-ia-site` passou a consultar a tabela em vez do array fixo; o front-end continua lendo `services-catalog-v7.js` normalmente (sem custo de rede extra).
- **Bug real encontrado e corrigido (migration `058`): nem `public.services` nem `public.products` tinham permissão de leitura (`GRANT SELECT`) para o papel usado pelas Edge Functions.** A política de RLS existia, mas sem o `GRANT` de base toda consulta falhava silenciosamente — na prática, a JuIA nunca conseguiu consultar o catálogo real de produtos desde que a tabela foi criada (v28.20.0), sempre respondendo "não tenho o preço atualizado" quando perguntada sobre produto. Corrigido para as duas tabelas.

## 28.27.0 — Mesclar clientes duplicados + correção do "Arquivar" quebrado

- **Novo botão "🔗 Mesclar" no CRM**: junta dois cadastros do mesmo cliente (ex.: pessoa trocou de número e ficou com 2 perfis) num só — move agendamentos, histórico, timeline e pontos de fidelidade (somados, com o mesmo estouro de 10=1 recompensa) pro cadastro escolhido, e apaga o duplicado. Pede confirmação explícita antes de executar.
- **Corrigido: o botão "Arquivar" do CRM estava quebrado** desde sempre — a função `admin_archive_customer` existia só no arquivo de migration antigo, mas nunca foi criada de fato no banco (achado ao investigar o merge). Recriada.
- RLS revisado: já estava travado com `is_admin()` em praticamente toda tabela sensível desde 20/07 — a nota antiga na documentação interna dizia o contrário, corrigida.

## 28.26.0 — Cliente no Novo agendamento, rascunho persistente, Dashboard e Relatórios

- **Campo "Cliente" do Novo agendamento trocou o `<datalist>` nativo por um dropdown próprio** (mesmo padrão do Atendimento Balcão), mostrando nome + telefone: corrige dois bugs reais — 1) o popup nativo "sequestrava" a seta-esquerda do teclado, impedindo corrigir o nome digitado; 2) com dois clientes de mesmo nome, não dava pra saber/escolher qual dos dois (agora aparecem os dois, distinguidos pelo telefone).
- **Rascunho do Novo agendamento não se perde mais ao navegar pra outra tela**: nome, telefone, data, horário, observação e serviços ficam salvos (sessionStorage) e voltam automaticamente se você sair da tela sem salvar. Antes, sair pra conferir algo e voltar resetava tudo pro padrão (hoje, 08:00).
- **Dashboard**: novos indicadores "Concluídos" e "Ausências" (hoje), e os atendimentos da lista "Agenda de hoje" agora são clicáveis — abrem o mesmo detalhe completo (pagamento, produtos, serviço) dos cards da Agenda, com link direto pra editar lá.
- **Relatórios**: modo "Dia" ganhou um seletor de data direta (calendário), pra pular direto pra qualquer dia sem clicar "‹" várias vezes. Corrigido também um estouro de layout: números grandes (ex. "R$ 2.448,00") furavam a borda do card em vez de encolher/quebrar linha.

## 28.25.0 — Controle de avaliação Google + 2 correções na JuIA do WhatsApp

- **Checkbox "Pedir avaliação no Google" no "Concluir atendimento"** (marcado por padrão): quando desmarcado, se o cliente responder satisfeito na pesquisa, a JuIA manda um agradecimento reforçando as formas de agendamento em vez de pedir avaliação — pro Juliano usar em clientes que já sabe que avaliaram. Novo campo `bookings.request_google_review`/`experience_requests.request_google_review` (migration `055`).
- **JuIA (WhatsApp) não reconhecia emojis de satisfação além do 😊/🙁 exatos do menu**: cliente respondeu 😂 e depois 😄 (pesquisa de satisfação) e ficou preso em "não entendi" repetido. Ampliado pra reconhecer a família toda de emojis positivos/negativos comuns.
- **Bug maior no mesmo fluxo**: qualquer cliente com pesquisa de satisfação pendente que mandasse uma mensagem que não fosse satisfeito/insatisfeito (pedido de agendamento novo, pergunta, áudio) ficava travado em "não entendi, satisfeito ou insatisfeito?" para sempre — inclusive tentando marcar um horário novo. Agora só aplica esse "gate" pra mensagens curtas (até 40 caracteres, o padrão de uma resposta de satisfação); o resto cai direto no fluxo normal da JuIA.

## 28.24.0 — Cards de Agenda/Atendimento redesenhados (colapsáveis)

- **Cards de agendamento agora vêm colapsados por padrão**: só hora, nome, serviço, status e total — uma linha compacta, no estilo listas do iOS. Clique no card expande e mostra tudo (telefone, duração, preços, pagamento, produtos, observações, ações). Resolve a reclamação de que a tela ficava "gigante" e obrigava rolar muito com vários agendamentos no dia.
- Modo Atendimento passou a usar exatamente o mesmo componente de card da Agenda (antes eram dois layouts diferentes) — visual único em todo o sistema.
- JuIA: adicionada instrução no prompt pra reconhecer quando o cliente só avisa que chegou/está a caminho/vai se atrasar, respondendo direto sem pedir esclarecimento (não precisa mais de uma segunda mensagem pra entender). Testado e publicado com verificação de integridade byte-a-byte.

## 28.23.1 — Resumo de preço/pagamento mais compacto

- **Os 3 campos (Serviços/Produtos/Total) e a forma de pagamento viraram uma única linha de texto discreto**, no lugar das caixas grandes lançadas na v28.22.0/28.23.0. Ficava alto demais e obrigava rolar muito a tela com várias entradas na Agenda/Atendimento. Sem mudança de dado, só de layout.

## 28.23.0 — Forma de pagamento separada pra produtos

- **Novo campo `products_payment_method`** em `bookings` (migration `054`): até aqui um atendimento tinha só 1 forma de pagamento pra tudo. Caso real: corte pago no Pix, mas o cliente comprou uma água na saída e pagou no Débito — não tinha como registrar certo. Campo opcional; quando vazio, o produto é considerado pago na mesma forma do serviço (nenhum registro antigo precisa mudar).
- **Modais "Concluir" e "✎ Editar atendimento"** ganharam um 2º seletor de pagamento, opcional, só pros produtos. O "Concluir" deixou de fechar com 1 clique no pagamento — agora tem botão "Concluir atendimento" no final, pra dar tempo de escolher os 2 pagamentos quando forem diferentes.
- **Cards de Agenda/Atendimento e o log do Balcão** mostram a forma de pagamento — 1 chip quando é só uma, 2 chips ("Serviço: Pix" / "Produtos: Débito") quando é diferente.
- Registrado na timeline de auditoria do cliente quando o pagamento dos produtos é alterado.

## 28.22.1 — Correção: "Ajustar carimbos" não salvava

- **Bug crítico desde a criação do recurso (v28.21.0)**: o botão "✎ Ajustar carimbos" (Fidelidade) sempre falhava com `column reference "points" is ambiguous` e nunca salvava nada — a RPC `admin_adjust_loyalty_points` tinha uma coluna de retorno com o mesmo nome de uma coluna da tabela `loyalty_accounts`, deixando o Postgres em dúvida sobre qual `points` usar no `UPDATE ... RETURNING`. Corrigido qualificando as colunas com alias (migration `053`). Testado direto no banco (cliente fictício) antes de confirmar.

## 28.22.0 — Auditoria no CRM, 3 campos de preço e novos filtros de Relatórios

- **Timeline de auditoria na tela do cliente (CRM)**: novo botão "🕘 Auditoria" em cada card de cliente (`admin-clientes.html`) mostra os eventos já registrados na tabela `customer_timeline` (correções de status/serviço/produtos/pagamento feitas pelo admin) — carregado sob demanda ao abrir, sem impactar o carregamento normal da tela. Antes essa tabela era só gravada (pelo `admin-booking-status`), nunca lida em lugar nenhum do painel.
- **Cards de agendamento (Agenda/Atendimento) mostram 3 campos separados** — Serviços, Produtos e Total — em vez de um valor só combinado perto do nome, que ficava ambíguo por não ter rótulo e parecia repetir o subtotal de produtos logo abaixo.
- **Relatórios ganhou modo "Dia"** (além de Mês/Semana já existentes) e um novo indicador **"Média por cliente"** (faturamento ÷ clientes diferentes atendidos no período) — diferente do "Ticket médio", que divide pelo número de atendimentos (um mesmo cliente pode ter mais de um no período).

## 28.21.2 — Link do Facebook no vCard

- **`barbearia-do-ju.vcf`**: adicionado link do Facebook (`item6.URL`/`X-ABLabel`, mesmo padrão dos outros links sociais).

## 28.21.1 — Correção visual do chip de produto

- **"🛍 Produtos reservados" virou "🛍 Produtos vendidos"** nos cards de agendamento/atendimento — o produto já foi vendido no momento em que é registrado (não existe conceito de "reserva" de produto no sistema), então o texto estava com a palavra errada. Padronizado com o texto já usado nos modais "Concluir"/"✎ Editar".
- **Chip de produto não estoura mais em nomes longos no mobile**: era `border-radius:999px` (pílula), então um nome como "Balm Para Barba 150g" quebrava em várias linhas dentro de um card estreito e virava um círculo cortando o preço no meio. Agora o chip empilha nome e preço (mesmo padrão visual já usado no checklist de produtos do "Concluir"/"✎ Editar") com cantos arredondados normais.

## 28.21.0 — Ajuste manual de carimbos de fidelidade

- **Tela Fidelidade ganhou botão "✎ Ajustar carimbos"** por cliente: permite somar ou remover carimbos manualmente (ex.: cliente que já tinha carimbos no cartão físico antes do sistema digital, precisa entrar com esse saldo até tudo ficar ajustado). Nova RPC `admin_adjust_loyalty_points` (migration `052-v28.21.0`) reaproveita a mesma lógica do trigger de corte concluído — cada 10 carimbos vira 1 recompensa — e registra o ajuste em `loyalty_events` (`event_type='adjustment'`) com o motivo digitado, então fica no histórico.

## 28.20.1 — Serviço extra direto no "Concluir"

- **Botão "Concluir" ganhou o mesmo checklist de serviço do "✎ Editar atendimento"**: antes só dava pra ajustar produtos vendidos na hora de concluir; se o cliente pedisse um serviço extra (ex.: corte + sobrancelha, sendo que só o corte estava agendado), era preciso concluir e depois abrir o "✎ Editar" separadamente pra corrigir. Agora o checklist de serviço aparece direto no "Concluir", pré-marcado com o que estava agendado, e dá pra marcar serviços adicionais antes de fechar o atendimento.

## 28.20.0 — Tabela `products` no banco + modal "✎ Editar atendimento"

- **Nova tabela `public.products` (migration `051-v28.20.0-tabela-produtos.sql`)**: fonte única de produtos que as Edge Functions conseguem ler direto (Deno não importa o `products-catalog-v1.js` do front-end). `ju-ia-site` e `create-rebooking` agora consultam a tabela a cada request em vez de manter arrays hardcoded que divergiam do catálogo real. Leitura pública liberada só pra `active=true` (mesma informação já exposta em produtos.html); escrita só via service_role. Campo `upsell_tags` preserva a lógica de sugestão da JuIA (corte/barba/combo/quimica/tratamento/all) — comportamento dela não mudou, só a origem dos dados. **Ao mudar preço/nome de produto: atualizar a tabela `products` E o `products-catalog-v1.js` (front-end).**
- **Modal "✎ Editar atendimento"** (substitui o "🛍 Produtos" da sessão anterior, nos cards da Agenda e do Modo Atendimento): corrige **serviço realmente executado** (checklist igual à do balcão, pré-marcada com o que está no registro), **produtos vendidos** e **forma de pagamento** de qualquer agendamento — site ou balcão, antes OU depois de concluído. Caso real: cliente agendou "Corte + Lavagem" no site, na hora pediu Barba Express + pomada, e o "Concluir" registrava só o corte. `admin-booking-status` aceita agora `service` ({name, price, duration_minutes}), `selected_products` e `payment_method` de forma independente (qualquer combinação, com ou sem mudança de status); tudo auditado em `customer_timeline`.
- **Forma de pagamento pode ser adicionada/corrigida depois** do atendimento concluído (era só no momento do "Concluir").

## 28.19.0 — Catálogo único de produtos

- **Novo `products-catalog-v1.js` (`window.BDJ_PRODUCTS`)**, mesmo padrão do `services-catalog-v7.js`: até aqui o catálogo de produtos existia duplicado (e já divergente) em 4 arquivos — `agenda-v15.js`/`reagendar-v26-5.js` estavam com apenas 6 itens desatualizados (faltava Pasta Modeladora, Shampoo Caspbell e os energéticos Monster), enquanto `admin-v15-4-core.js`/`admin-balcao-v29.js` (criados na sessão anterior) tinham 9. Agora os 4 leem do mesmo arquivo.
- **Catálogo completo (27 produtos, igual ao `produtos.html` real)** disponível no balcão/atendimento (`admin-v15-4-core.js`, `admin-balcao-v29.js`) — inclusive bebidas, agora agrupado por categoria como o seletor de serviços. O agendamento do site/reagendamento (`agenda-v15.js`, `reagendar-v26-5.js`) continua mostrando só o recorte de sugestão contextual (produtos de cuidado, sem bebidas), usando o campo `for` do catálogo único.
- **Limitação que continua existindo (documentada no próprio arquivo):** as Edge Functions `ju-ia-site` e `create-rebooking` rodam em Deno e não conseguem importar esse arquivo de front-end — mantêm sua própria cópia. Ao mudar preço/nome em `products-catalog-v1.js`, replicar manualmente nessas duas functions (mesma limitação que já existia pros serviços).

## 28.18.0 — JuIA: bug do "boa tarde/amanhã", produtos no balcão/CRM e no atendimento

- **JuIA (WhatsApp/site) não confunde mais cumprimento com pedido de horário:** "boa tarde"/"boa noite" continham as palavras "tarde"/"noite" e, combinadas com data/serviço ainda guardados de uma conversa anterior já concluída, disparavam sozinhas uma checagem de disponibilidade sem sentido (caso real: áudio "Oi! Boa tarde!" respondido com "Não encontrei horário nessa data..."). Generalizado com `\b` (limite de palavra) pra também corrigir "amanhã" sendo lido como "de manhã" (`detectPeriod` em `ju-ia-site/index.ts`).
- **Atendimento Balcão (`admin-balcao.html`) ganhou busca de cliente do CRM**: digitar nome/telefone sugere clientes já cadastrados (evita redigitar dados de quem não tem costume de agendar pelo site) — continua permitindo cadastrar um cliente novo normalmente.
- **Atendimento Balcão e qualquer agendamento (site ou balcão) agora registram produtos vendidos:** novo seletor de produtos no balcão (RPC `admin_register_walkin_visit` ganhou `p_selected_products`, migration `050-v28.18.0`); no Modo Atendimento/Agenda, o botão "Concluir" ganhou checklist de produtos junto da forma de pagamento, e todo agendamento ganhou um botão avulso "🛍 Produtos" pra registrar venda de produto depois do fato, em qualquer status. `admin-booking-status` (Edge Function) passou a aceitar `selected_products` com ou sem mudança de status.
- **`salvar-contato.html`**: título parou de herdar a fonte gigante (`Bebas Neue`) do hero da home, que ficava quebrada/ilegível num cartão estreito.
- **`barbearia-do-ju.vcf` (contato pra salvar no celular)**: links de Instagram/WhatsApp/Maps trocaram `TYPE` inválido (que podia ser descartado por alguns apps de contato) pelo padrão `item.../X-ABLabel`; adicionado link de avaliações no Google e de agendamento online.
- **Home (`index.html`)**: card "Tempo médio" virou um seletor — escolha o serviço e veja a duração média, em vez de só 2 exemplos fixos (que inclusive estavam desatualizados: Corte + Barboterapia mostrava "1h10", catálogo real é 1h).

## 28.17.1 — Indicadores visuais no calendário do admin

- **Calendário da Agenda (`admin-agenda.html`/`admin-atendimento.html`) agora mostra de relance, em cada dia**: 🚫 dia que a barbearia não atende (domingo/segunda, mesma regra fixa já usada no resto do sistema), 🔒 dia com bloqueio total (`schedule_blocks` com `all_day=true`), ⏰ dia com bloqueio parcial (bloqueio só em parte do horário). Antes só dava pra saber clicando em cada dia. Nova função `loadMonthBlocks()` busca os bloqueios do mês inteiro exibido; `renderCalendar()` prioriza fechado > bloqueio total > bloqueio parcial > normal.

## 28.17.0 — Atendimento Balcão + forma de pagamento + estatística de canal

- **Nova tela `admin-balcao.html` ("Atendimento Balcão")**, no menu de todas as páginas do admin: registra clientes que vieram direto na porta (nome, telefone, serviços, data/horário aproximado, forma de pagamento). O registro entra direto como agendamento **concluído** (`channel='balcao'`), contando no faturamento e no CRM igual um agendamento do site.
- **Forma de pagamento obrigatória ao concluir qualquer atendimento** (site ou balcão): Pix, Débito, Crédito, Dinheiro ou Bônus de fidelidade. No agendamento do site, o botão "Concluir" agora abre uma escolha rápida antes de enviar pro `admin-booking-status` (validado nos dois lados — tela e Edge Function). Nova coluna `bookings.payment_method` (migration `049-v28.17.0-atendimento-balcao.sql`).
- **Cliente novo da porta recebe boas-vindas por WhatsApp automaticamente:** nova RPC `admin_register_walkin_visit` (SECURITY DEFINER, só admin) verifica via `phone_match_key` se o telefone já existia no CRM *antes* de criar o registro; se for realmente novo, a tela chama a nova Edge Function `send-walkin-welcome`, que manda uma mensagem única convidando o cliente a agendar pelo WhatsApp ou pelo site da próxima vez. Cliente que já constava no CRM só tem o histórico atualizado, sem mensagem (evita repetir aviso pra quem já conhece a barbearia).
- **Nova coluna `bookings.channel`** (`site` | `balcao`) permite separar estatisticamente quem veio do site/WhatsApp de quem veio direto na porta. Adicionado card "Site vs. balcão" em `admin-relatorios.html`. O corte "Novos vs. recorrentes" já existente continua funcionando automaticamente (é calculado pelo histórico de telefone, não por um campo manual) — agora também enxerga os atendimentos de balcão, já que viram `bookings` reais.

## 28.16.6 — Lista de espera do admin sem permissão (achado testando manualmente)

- **Bug real, achado pelo Juliano clicando na tela `admin-espera.html`:** "permission denied for table waitlist". Bug pré-existente desde a criação da lista de espera (v28.8.0), não relacionado à divisão do `admin-v15-4.js` (essa tela usa `admin-espera-v28.js`, arquivo separado que não foi tocado). Causa: a migration 039 criou a policy de RLS certa (`is_admin()`) mas esqueceu o `grant select, insert, update, delete` pro `authenticated` — só o `service_role` tinha. RLS só é avaliada depois do grant básico da tabela, então o admin logado nunca passava nem perto da policy.
- Corrigido (migration 048): concedido `select, insert, update, delete` no `waitlist` pro `authenticated`. Aplicado direto em produção, efeito imediato (não precisa de deploy, é permissão de banco).

## 28.16.5 — JuIA perdia serviço adicional citado junto com um já escolhido

- **Bug real corrigido, cliente Moisés (28/07/2026 20:50, WhatsApp):** pediu "Barba e sombrancelha" depois de já ter "Sobrancelha" selecionado na conversa — a JuIA descartava silenciosamente "Barba" e confirmou o agendamento só com Sobrancelha. Juliano teve que corrigir manualmente com o cliente pelo WhatsApp. Causa: o modelo às vezes classifica a mensagem certo mas não extrai TODOS os serviços citados em `updates.services`, e o sistema só tinha um plano B (`findServicesLoose`, cata serviços direto do texto contra o catálogo) para quando o cliente ainda não tinha NENHUM serviço escolhido — uma vez que já havia 1 selecionado, nada tentava mesclar um serviço adicional citado na mesma frase.
- Corrigido em `supabase/functions/ju-ia-site/index.ts`: o plano B agora roda sempre que a mensagem não for de cancelamento/reagendamento/troca de serviço/produto (fluxos que já tratam serviço com lógica própria), e **mescla** (nunca substitui) o que já estava selecionado. Testado direto contra a function publicada, replicando a conversa do Moisés (agora devolve `["Sobrancelha Masculina","Barba Express"]`) e mais 3 casos de regressão (serviço único, combo, o caso original do plano B) — todos corretos.
- **Ajuste pedido pelo Juliano na mesma sessão:** "barba" sozinho (sem qualificar) não escolhe mais Barba Express sozinha (era sempre a vencedora por ser o nome mais curto) — agora a JuIA pergunta entre Barba Express, Barboterapia e Barboterapia com vaporizador de ozônio, com preço e duração de cada uma, antes de seguir. Só pergunta se nenhuma das três já estiver escolhida; "Barba Express" ou "Barboterapia" ditos explicitamente continuam resolvendo direto, sem repergunta. Testado: "Barba" pergunta as 3 opções; escolher a mais cara (Barboterapia) resolve certo; "Barba Express" direto não dispara a pergunta.

## 28.16.4 — admin-v15-4.js dividido em 7 arquivos (⚠️ conferir manualmente)

- **`admin-v15-4.js` (o maior JS do site, 38KB) dividido em 7 arquivos** (`admin-v15-4-core.js`, `-dashboard.js`, `-atendimento.js`, `-agenda.js`, `-crm.js`, `-agendamento.js`, `-bootstrap.js`), carregados na mesma ordem em todas as 7 páginas que já carregavam o arquivo único (`admin.html`, `admin-agenda.html`, `admin-clientes.html`, `admin-agendamento.html`, `admin-atendimento.html`, `admin-notificacoes.html`, `admin-mensagens.html`). Verificado por diff que o conteúdo (sem o IIFE que envolvia tudo) é idêntico ao arquivo original.
- **Diferente do `style.css`: aqui não dá pra ter certeza 100% sem testar de verdade**, porque essas telas exigem login que eu não tenho. Removido o IIFE que isolava as ~60 funções do arquivo — agora elas viram propriedades de `window` (ex. `window.money`). Conferido que nenhum outro script hoje carregado nas mesmas 7 páginas define uma função com o mesmo nome de forma que colidiria de verdade (o único nome repetido, `setStatus` em `admin-notifications-v24-6.js`, continua isolado no próprio IIFE dele). **Peço pra você clicar nas 5 telas principais (dashboard, agenda, clientes, atendimento, agendamento) uma vez depois de publicar, só pra confirmar que está tudo normal.**

## 28.16.3 — style.css dividido em partes menores

- **`style.css` (~165KB, 2068 linhas num arquivo só) dividido em 5 arquivos** dentro de `css/` (`01-site-base.css` até `05-admin-mobile-refino.css`), cada um cobrindo um período de versões do site. `style.css` agora só tem 5 `@import` apontando pra esses arquivos, na mesma ordem exata do arquivo original — nenhuma das 30 páginas que carregam `/style.css` precisou mudar. Verificado por diff que a concatenação dos 5 arquivos é **byte a byte idêntica** ao `style.css` antigo (nenhuma regra reordenada, cascata preservada), e comparado o CSS computado de elementos-chave (site, catálogo, admin) entre local e produção antes de publicar.
- Nomes dos arquivos são só pra navegação (achar mais rápido "os ajustes da era V24" em vez de rolar 2000 linhas) — não são módulos isolados por tema; uma classe pode ter regras em mais de um arquivo, igual já acontecia dentro do arquivo único.

## 28.16.2 — Módulo compartilhado + bug real de duração

- **Bug corrigido: serviço "Luzes" (1h30) sendo tratado como 1h.** `parseDuration()` (usada ao adicionar um serviço pelo catálogo) só reconhecia minutos quando o texto tinha a palavra "min" — em "1h30" (sem "min"), os 30 minutos eram descartados silenciosamente, virando 60min. Isso afetava a duração salva no agendamento real (`duration_minutes`) e a checagem de horários disponíveis, não só a etiqueta mostrada na tela. Nenhum agendamento de "Luzes" existia ainda no banco quando o bug foi encontrado (achado por teste automatizado antes de causar problema real).
- **Extraída lógica pura compartilhada** (`assets/js/booking-format.js`): `money`, `parseDuration`, `fmtDuration`, `addMinutes`, `addDaysISO`, `dayOfWeek`, `isOpenDay`, `closingMinutes`, `prettyDate`, `nextOpenDay` — antes duplicadas/embutidas em `service-cart-v22-5.js` e `agenda-v15.js`. Os dois arquivos agora importam desse módulo via `<script type="module">` (sem etapa de build; só as 2 páginas que carregam esses scripts precisaram do ajuste). Testado que a ordem de carregamento (Supabase/config/catálogo antes do módulo) continua correta.
- **Suíte de testes automatizados criada** (`tests/`, ver `tests/README.md`): Playwright para fluxo real no navegador (rotas, carrinho, revisão de agendamento) e Vitest para a lógica pura extraída. `npm test` roda tudo com segurança (não grava nada em produção); um teste à parte (`npm run test:e2e:live`) cria/reagenda/cancela/apaga um agendamento de verdade, opt-in, com telefone fictício.

## 28.16.1 — 2 ajustes pendentes da revisão anterior

- **Atalhos do app instalável (PWA) do admin completos:** faltavam Fidelidade, Mensagens, Relatórios e Lista de espera no `admin-manifest.webmanifest` — só as telas mais antigas tinham atalho. Adicionadas as 4 (nem todo celular mostra os 10 de uma vez, mas todas as seções agora estão disponíveis).
- **Últimas variações de dourado/preto quase idênticas ao oficial:** encontradas 4 cores a mais que não usavam `--gold`/`--gold2` por engano (`#e4bd55`, `#f2cf82`) e o texto sobre fundo dourado ainda tinha 3 tons de preto quase iguais espalhados (`#111`, `#090909`, além do `#17100a` já corrigido antes) em vez do padrão `#16100a`. Unificados. Deixadas de propósito as variações de dourado que fazem parte de um design específico (ex.: o degradê do card "selecionado" no agendamento, o card VIP do CRM) — essas são diferentes por decisão de design, não por engano.

## 28.16.0 — Revisão de referências quebradas e polimento visual

- **Rota `/agendar/` consolidada:** existiam 3 páginas concorrentes para o mesmo fluxo — `servicos.html` (catálogo duplicado, órfão, sem link em lugar nenhum do site) e `agendar/agendar.html` (stub de redirect residual, também sem link). `servicos.html` virou um redirect real para `/agendar/` (mesmo padrão do redirect já usado em `agendar.html`→`agendar.html` da raiz) e `agendar/agendar.html` foi removido (não referenciado, `/agendar.html` continua a etapa 2 do agendamento). Corrigidos também um link com domínio completo hardcoded em `agendar/index.html` (deveria ser caminho absoluto, igual ao resto do site) e a mesma inconsistência em `produtos.html`.
- **`404.html` carregava recursos quebrados dependendo de onde o erro acontecia:** o ícone, o botão "Voltar para o início" e o script de privacidade usavam caminho relativo (`assets/...`, `index.html`, `privacy-consent-v22-4.js`) — funcionava normalmente para um 404 na raiz, mas quebrava se o link quebrado estivesse dentro de uma subpasta (ex.: algo em `/agendar/algo-errado`), porque o navegador resolve caminho relativo pela URL da barra de endereço, não pela pasta real do arquivo. Nesse caso o script de privacidade não carregava e o botão "Voltar para o início" ia parar no catálogo de serviços em vez da home. Testado ao vivo simulando um 404 dentro de `/agendar/` antes e depois da correção. Todos os caminhos desse arquivo agora são absolutos.
- **Cache-busting (`?v=`) padronizado:** os parâmetros de versão de CSS/JS/manifest estavam espalhados por 10 versões diferentes (`28.0.14` até `24.3`) mesmo com `VERSAO.md` já em 28.15.0 — algumas páginas do admin carregavam um `style.css` 15 releases mais velho que outras. Unificado tudo para `?v=28.16.0`, incluindo os links de manifest que não tinham parâmetro nenhum. `sw.js` também teve o nome do cache atualizado, o que limpa caches antigos de visitantes recorrentes na próxima visita.
- **`manifest.webmanifest`:** atalho "Agendar" do PWA apontava para `servicos.html` (a página órfã); agora aponta direto para `/agendar/`.
- **`robots.txt`:** faltava bloquear `admin-relatorios.html` e `admin-espera.html` (já tinham `noindex` próprio, mas ficaram fora da lista por esquecimento ao serem criadas).
- **Polimento visual (identidade mantida):** o painel administrativo usava um dourado ligeiramente diferente do dourado oficial do site (`#d4af37`/`#f5d56f` vs `--gold`/`--gold2` reais) em dezenas de regras — unificado para o mesmo dourado em toda parte. Adicionados: estado visual de botão desabilitado (antes um botão desabilitado parecia idêntico a um habilitado), anel de foco acessível em links/botões/campos para navegação por teclado, feedback ao pressionar botões, transições mais suaves e consistentes em cards e opções de serviço/horário que antes mudavam de estado sem animação, e respeito à preferência `prefers-reduced-motion` do sistema.

## 28.15.0 — Blog do site (SEO local)

- **3 artigos novos no blog** (`blog.html` + `blog-barboterapia.html`, `blog-barba-encravada-ressecada.html`, `blog-produtos-profissionais-caseiros.html`), parte do plano de SEO local pra converter mais gente organicamente: Barboterapia, Barba encravada/ressecada, Produtos profissionais x caseiros. Textos revisados no `AUDITORIA-SEO-2026-07-24.md`, publicados como estão.
- Cada artigo tem `Article` + `BreadcrumbList` em Schema.org, meta description e Open Graph próprios, link cruzado entre os 3 artigos e para `/agendar/#servicos` ou `produtos.html` conforme o assunto.
- Blog linkado no rodapé de `index.html`, `produtos.html` e `servicos.html`, e as 4 novas páginas adicionadas ao `sitemap.xml` (agora com 10 URLs).
- Testado localmente (servidor estático) antes de publicar: CSS, JuIA chat e scripts carregam sem erro em todas as páginas novas, JSON-LD validado.

## 28.14.0 — JuIA adiciona/remove produto de um agendamento já confirmado

- **JuIA agora adiciona ou remove produto de um agendamento existente:** se o cliente esqueceu de pedir a pomada na hora de marcar, ou mudou de ideia sobre um produto reservado, ele pode pedir direto pelo WhatsApp ("posso adicionar um produto no meu agendamento?", "quero tirar o óleo do meu agendamento") — a JuIA identifica o agendamento, confirma o produto (com preço) e atualiza sozinha, sem mexer em serviço, dia ou horário. Mesmo padrão de segurança dos outros três recursos (telefone verificado, confirmação antes de executar, push depois).
- Detecção de pedido ajustada para aceitar frases naturais (ex.: "adicionar **um** produto", não só "adicionar produto" exato) — testado e corrigido durante o desenvolvimento antes de publicar.
- Migration `045-v28.14.0-produtos-agendamento-whatsapp.sql`: função nova `phone_update_booking_products` (autorizada por telefone) e `phone_upcoming_bookings` ganha `selected_products`. `ju-ia-site` redeployado. Testado com agendamento fictício (telefone de teste, apagado depois) via SQL direto e via WhatsApp simulado — execução real só verificada por SQL, para não disparar push real pro celular do Juliano.

## 28.13.1 — JuIA reconhece serviço em mensagens curtas ou com erro de digitação

- **Cliente disse "Barba e pezinho" e depois "Barbo terapia" (typo de Barboterapia) e a JuIA não reconheceu nenhum dos dois** — respondeu a lista genérica "Mais procurados" as duas vezes, e o cliente reclamou ("Muito confuso esse AI no whatsapp"), achado revisando as conversas reais de ontem/hoje. Acontecia porque o reconhecimento de serviço dependia inteiramente do modelo de IA extrair o nome certinho do catálogo — sem isso, a JuIA desistia direto pra lista genérica. Agora, antes de desistir, ela tenta casar o texto do cliente contra o catálogo (separando por "e"/"+"/"/", e tolerando erro de digitação com espaço a mais/a menos, como "Barbo terapia" → "Barboterapia").
- **Corrigido também um bug que essa mudança ia expor**: o reconhecimento de serviço por trecho de texto (ex. "Barba") batia tanto em "Barba Express" quanto em "Corte + Barba Express" (o combo contém o nome do serviço avulso) — e sempre ganhava o primeiro da lista, que por acaso é sempre o combo mais caro. Corrigido pra escolher o nome mais próximo em tamanho do texto buscado, não o primeiro encontrado — beneficia todo o reconhecimento de serviço do sistema, não só esse caso novo.
- `ju-ia-site` redeployado (sem migration — mudança só na lógica de reconhecimento de serviço). Testado localmente com os dois casos reais que geraram a reclamação, mais casos de controle (nomes exatos do catálogo, mensagens sem serviço nenhum) antes de publicar.

## 28.13.0 — JuIA reagenda e troca o serviço de um agendamento sozinha

- **JuIA agora reagenda direto, sem cancelar e recriar:** antes, quando o cliente pedia pra mudar de dia/horário ("posso mudar pra sexta às 15h?", "quero remarcar"), a JuIA só sabia cancelar o agendamento antigo e criar um novo do zero — perdendo o histórico do registro original e obrigando o cliente a repetir tudo (nome, serviço etc., no site; no WhatsApp o nome/telefone já ficavam sabidos, mas o registro ainda virava um novo). Agora, no WhatsApp (número verificado pelo canal, mesma regra do cancelamento), ela identifica o agendamento futuro do cliente, confirma o novo horário disponível (consultando a agenda de verdade) e só reagenda de fato depois do "sim" — muda `booking_date`/`start_time` do mesmo registro, preservando histórico e notas. Push de notificação depois, igual ao cancelamento.
- **JuIA agora troca o serviço de um agendamento sozinha:** se o cliente marcou "Corte" e depois pede "pode trocar o serviço pra Barba?", ela identifica o agendamento, confirma o serviço novo (com preço e duração) e troca — sem mexer em dia/horário, a menos que o novo serviço não caiba mais nesse horário (aí ela avisa e sugere tentar outro serviço ou horário).
- **Nos avisos de "você já tem um agendamento" (disponibilidade e agendamento novo):** antes só oferecia cancelar o antigo ou manter os dois. Agora tem uma terceira opção — mudar o agendamento existente pro novo horário que o cliente estava pedindo, em vez de cancelar e criar de novo.
- **Corrige uma brecha de segurança da v28.12.0:** as duas funções de cancelamento por telefone (`phone_upcoming_bookings`, `whatsapp_cancel_booking`) foram criadas sem a trava de acesso que as demais funções sensíveis desse tipo sempre tiveram — ficaram com permissão padrão do Supabase liberada pra chave pública do site (`anon`), ou seja, tecnicamente chamáveis direto por fora do fluxo de confirmação da JuIA. Corrigido: agora só o `service_role` (usado internamente pelas Edge Functions) pode executá-las, igual às funções de reagendamento/troca de serviço novas.
- Migration `044-v28.13.0-reagendamento-e-troca-servico-whatsapp.sql`: funções novas `phone_reschedule_booking` e `phone_change_booking_service` (autorizadas por telefone, mesmo padrão do cancelamento), `phone_upcoming_bookings` ganha `duration_minutes`. `ju-ia-site` redeployado. Testado com um agendamento fictício (telefone de teste, apagado depois) via SQL direto e via WhatsApp simulado antes de publicar.

## 28.12.0 — JuIA ganha a capacidade de cancelar agendamento sozinha

- **JuIA agora sabe cancelar um agendamento, com confirmação do cliente:** antes, qualquer pedido de cancelamento ("pode cancelar", "já marquei em outro lugar") só gerava um "vou encaminhar pra equipe" — mesmo quando ela já tinha identificado certinho qual agendamento era. Agora, no WhatsApp (número já verificado pelo próprio canal — nunca no chat do site, onde o telefone digitado não é confiável), a JuIA identifica o agendamento futuro do cliente, confirma com ele ("é o de dia 30 às 17:30 pra Corte + Barboterapia que você quer cancelar? sim ou não") e só cancela de fato depois do "sim". Você recebe uma notificação push depois, igual já acontecia quando o cliente cancelava pelo link do e-mail/SMS.
- **JuIA agora detecta e resolve agendamentos duplicados sozinha:** identificamos um caso real em que um cliente ficou com dois agendamentos no mesmo dia (13:30 e 14:15, o segundo criado pela própria JuIA sem perceber que ele já tinha o primeiro) — os dois viraram falta. Agora, sempre que a JuIA nota dois agendamentos futuros no mesmo dia pra um cliente, ela pergunta proativamente qual dos dois ele quer manter e cancela o outro sozinha (ou mantém os dois, se for o que o cliente quiser).
- **Evita criar um agendamento duplicado antes de acontecer:** se o cliente já tem um horário marcado e pede disponibilidade ou tenta agendar de novo (no mesmo dia ou em outro dia), a JuIA para e confirma antes de seguir — em vez de tentar criar um novo (que antes podia devolver a mensagem sem sentido "esse horário acabou de ficar indisponível" quando o "indisponível" era o próprio horário do cliente).
- **Serviço citado direto (ex.: "barba e pezinho") agora é reconhecido na hora:** antes, mesmo quando o cliente já dizia exatamente o que queria, a JuIA às vezes respondia com a lista genérica de "mais procurados" em vez de seguir direto pra pergunta do dia. E a frase "Para 30 minutos, estes são os horários..." (que soava estranha, já que ninguém perguntou sobre minutos) agora menciona o nome do serviço em vez da duração.
- Migration `043-v28.12.0-cancelamento-whatsapp.sql` (duas funções novas: `phone_upcoming_bookings` e `whatsapp_cancel_booking`, ambas restritas por telefone). `ju-ia-site` redeployado. Testado com dados de teste isolados (criados e apagados na hora, sem notificação real disparada) antes de publicar.

## 28.11.1 — Corrige pesquisa de satisfação e pergunta de disponibilidade não reconhecidas no WhatsApp

- **Cliente respondia a pesquisa de satisfação e a JuIA não entendia:** o WhatsApp às vezes manda o número do cliente sem o "9" que fica antes do celular (formato antigo), mesmo quando o número cadastrado tem o "9" (formato atual). Isso fazia o sistema não bater o número recebido com o número cadastrado — resultado: quando o cliente respondia 😊 pra pesquisa de satisfação, a JuIA não reconhecia que era uma resposta da pesquisa (não mandava o link de avaliação do Google) e também não reconhecia o cliente como alguém que acabou de ser atendido, respondendo com a saudação genérica "Como posso ajudar você hoje?" — como se fosse um número desconhecido.
- Corrigido criando uma forma única de comparar telefones que ignora esse "9" opcional, usada tanto para achar a pesquisa de satisfação pendente quanto para a JuIA reconhecer o cliente (nome, histórico, pontos de fidelidade) pelo WhatsApp.
- Migration `042-v28.11.1-fix-whatsapp-9-digito.sql`. Sem mudança de tela, sem deploy de Edge Function — a correção é só no banco.
- **Cliente perguntou "Tem horário agora??" e a JuIA respondeu que ia encaminhar pro Juliano, em vez de checar a agenda:** a JuIA só consultava a agenda de verdade quando já sabia o serviço **e** o dia — faltando qualquer um dos dois (como numa pergunta direta sem contexto), a resposta ficava só por conta do modelo, que às vezes preferia dizer que ia encaminhar para o Juliano em vez de perguntar o que faltava. Agora perguntas de disponibilidade ("tem horário", "tem vaga", "horário livre", etc.) nunca mais viram encaminhamento: se faltar o serviço, a JuIA pergunta qual; se faltar o dia (e o cliente disse "agora"/"hoje"), assume hoje automaticamente; só então consulta a agenda de verdade.
- **Corrigido também um problema relacionado que apagava o serviço já escolhido:** sempre que uma mensagem do cliente não citava o serviço de novo (ex.: só "oi", ou uma pergunta de disponibilidade), o serviço escolhido no turno anterior era apagado da conversa sem querer — o que deixava a JuIA "esquecendo" o que o cliente já tinha pedido. Corrigido no `ju-ia-site` (Edge Function redeployada, sem migration).

## 28.11.0 — JuIA para de mandar mensagem redundante + admin pode agendar fora do horário

- **JuIA não manda mais o "cochicho" de reativação quando não faz sentido:** existe um robô (`whatsapp-reactivation-watchdog`, roda a cada 1 min) que, quando o Juliano assume uma conversa manualmente e depois fica 2 minutos sem responder, manda um "Oi! Ainda estou por aqui..." e devolve a conversa pra JuIA. O problema: ele mandava essa mensagem mesmo quando a conversa já tinha terminado naturalmente (ex.: cliente respondeu só com uma figurinha de "toca aqui" ou um "valeu!"), o que soava robótico e podia irritar quem já tinha sido bem atendido. Agora, antes de mandar, ele confere a última mensagem do cliente: se foi uma figurinha/imagem/áudio sem texto, só emoji, ou uma despedida/agradecimento curto ("obrigado", "valeu", "blz", "tranquilo", etc.), ele fica quieto (a conversa continua liberada pra JuIA responder normalmente se o cliente escrever de novo). Testado com 12 casos reais, incluindo perguntas genuínas que **não podem** ser silenciadas — todas passaram.
- **Admin pode agendar fora do horário de funcionamento:** nova caixinha "Permitir fora do horário de funcionamento" na tela **Novo agendamento** e no encaixe da **Lista de espera**. Só funciona pra quem está logado como admin de verdade (testado: sem sessão de admin, a exceção é recusada). Continuam proibidos, mesmo com a caixinha marcada: bloqueios manuais que o Juliano já cadastrou e conflito de horário com outro agendamento — a brecha é só pra abrir o horário, não pra ignorar um bloqueio ou dar overbooking sem querer. O agendamento público (site/JuIA) não é afetado, continua restrito ao horário normal.
- Migration `041-v28.11.0-admin-fora-do-horario.sql`: atualiza `admin_create_booking` e `admin_reschedule_booking` com o novo parâmetro (`default false`, então nada muda pra quem já usava essas funções). **Atenção pra quem for reaplicar esta migration em outro banco:** ela primeiro remove as versões antigas das duas funções antes de recriar — sem isso, o Postgres cria uma segunda versão em paralelo em vez de substituir (foi exatamente o que aconteceu ao aplicar direto no banco de produção, e foi corrigido na hora).

## 28.10.0 — Dois serviços novos: Raspar a cabeça e Corte infantil

- **Novo serviço "Raspar a cabeça" (R$ 40, 30 min):** raspagem completa da cabeça, com ou sem navalha. Adicionado ao catálogo do site (`services-catalog-v7.js`, usado pela agenda e pelo admin), à página de serviços (`servicos.html`) e ao catálogo da JuIA (site + WhatsApp).
- **Novo serviço "Corte de cabelo infantil" (R$ 40, 30 min):** corte para crianças, na tesoura ou na tesoura com máquina, com descrição pensada para transmitir cuidado e confiança aos pais. Mesmos três lugares do serviço acima.
- **JuIA atualizada:** antes, quando alguém pedia "raspar a cabeça", ela ficava confusa (perguntava se era cabeça ou barba) e, mesmo depois de entender, tratava como um "Corte de cabelo" comum. Agora ela reconhece "raspar a cabeça", "raspar com máquina/navalha", "deixar no zero", "carequinha" como o serviço certo ("Raspar a cabeça"), e reconhece pedidos de corte para filho(a)/criança como "Corte de cabelo infantil". Testado com o modelo real: os três serviços (raspar, infantil, corte comum) são identificados corretamente e sem confusão entre si.
- Cache dos arquivos de catálogo (`services-catalog-v7.js`) atualizado em todas as 8 páginas que o usam, para garantir que o navegador carregue a versão nova.

## 28.9.0 — Correções da JuIA no WhatsApp

- **JuIA parava de pedir o WhatsApp do cliente mesmo já sabendo o número:** no canal WhatsApp, quem está mandando mensagem já tem o número identificado pelo próprio WhatsApp — mas esse dado nunca era repassado para a JuIA, que continuava perguntando o WhatsApp mesmo estando no meio da conversa. Corrigido: `whatsapp-webhook` agora envia o telefone confirmado do remetente, e a JuIA (`ju-ia-site`) o usa automaticamente e nunca mais pergunta (no chat do site, onde o número realmente não é conhecido, continua perguntando normalmente).
- **Mensagens contraditórias ("agendamento confirmado" seguido de "ainda precisa ser confirmado"):** causado por uma corrida — duas mensagens do mesmo cliente chegando quase ao mesmo tempo (ex.: o cliente manda o WhatsApp e, poucos segundos depois, pergunta o endereço) eram processadas em paralelo, cada uma lendo o estado da conversa antes da outra terminar de salvar. Corrigido com uma trava de processamento por telefone (nova coluna `processing_locked_until` em `whatsapp_conversations`, migration `040-v28.9.0-whatsapp-fixes.sql`): agora a segunda mensagem espera a primeira terminar antes de responder, sempre com o estado mais atualizado.
- **"Raspar a cabeça" não era entendido:** a JuIA não sabia que "raspar a cabeça", "raspar com máquina/navalha", "deixar no zero" etc. se referem ao corte de cabelo. Corrigido via instrução direta no prompt (depois, na v28.10.0, virou um serviço próprio com essa mesma lógica).
- Nenhuma mudança visível para o cliente além das próprias correções — sem novo secret, sem novo cron.

## 28.8.0 — Lista de espera / encaixe + alerta de WhatsApp desconectado

- **Nova tela "Lista de espera" (`admin-espera.html` + `admin-espera-v28.js`):** mostra quem está esperando vaga, com filtros por status (Esperando/Avisados/Encaixados/Cancelados), por dia da semana (Ter–Sáb), por turno (Manhã/Tarde) e por Semana/Mês (mesmo seletor dos Relatórios). Cada pedido mostra nome, contato, quando a pessoa prefere, serviço desejado e há quantos dias está esperando. Ações: WhatsApp (mensagem pronta oferecendo a vaga), Editar, Encaixar (mini-formulário que cria o agendamento direto, com data/horário/serviço, e marca o pedido como "encaixado"), Cancelar e Excluir. Botão "＋ Adicionar à lista" para quando o pedido chegar por telefone/pessoalmente.
- **Nova tabela `waitlist`** (migration `039-v28.8.0-waitlist.sql`): guarda nome, telefone, e-mail, serviço desejado, dia específico OU dias da semana, turno, faixa de horário e uma janela "disposto a esperar de/até". Nova função `waitlist_matches_for_slot(data, hora)` acha quem, na lista, aceitaria aquele exato dia/horário — é a base do alerta de vaga aberta.
- **No site (`agendar.html`):** quando o cliente escolhe uma data que está sem horários, além de ser levado automaticamente para o próximo dia disponível, aparece a opção "Queria mesmo [aquele dia]? Entrar na lista de espera" — pede nome, WhatsApp, e-mail (opcional) e turno preferido. Nova função `join-waitlist` recebe o pedido com segurança (mesmo padrão de `create-public-booking`); evita duplicar quem já está esperando (atualiza a preferência em vez de criar de novo).
- **Alerta automático de vaga aberta:** quando um agendamento é cancelado — pelo admin (`admin-booking-status`) ou pelo próprio cliente no link dele (`manage-booking`) — o sistema confere se alguém da lista de espera aceitaria aquele dia/horário e, se sim, avisa o dono por notificação push com o(s) nome(s), linkando direto para a tela de Lista de espera.
- **Alerta de WhatsApp desconectado:** `notifications-watchdog` (que já roda a cada 15 min) passou a checar também a conexão da JuIA com o WhatsApp (Evolution). Se cair, avisa por push e e-mail; quando reconectar, avisa que voltou. Isso permite desligar com segurança as mensagens automáticas de saudação/ausência do próprio WhatsApp Business, já que a JuIA cobre esse papel e agora há aviso se ela cair.
- **Menu:** item "Lista de espera" (⏳) adicionado à barra lateral de todas as telas do admin.
- Tudo testado antes de publicar: lógica de filtros (semana/mês/dia da semana/turno) verificada com casos simulados: `join-waitlist` testado ao vivo (evita duplicidade por telefone); `waitlist_matches_for_slot` testado com casos reais de turno; alerta de WhatsApp confirmado nos logs em produção lendo `state: "open"` corretamente.

## 28.7.1 — Relatórios: filtro por semana (terça a sábado)

- **Novo seletor Mês / Semana** na tela de Relatórios. Além da visão mensal, dá para ver o resumo de uma **semana**, definida como **terça a sábado** (os dias em que a barbearia abre). As setas ‹ › passam a andar de semana em semana (ou de mês em mês, conforme o modo) e o botão de avançar fica desativado ao chegar no período atual.
- Todos os números e blocos (faturamento, atendimentos, ticket, clientes, satisfação, faltas, serviços mais vendidos, novos vs. recorrentes, serviços×produtos) passaram a trabalhar por **intervalo de datas** em vez de só "mês", então valem igual para semana ou mês. "Recorrente" agora é quem já teve atendimento concluído antes do **início do período** selecionado.
- Só front-end (`admin-relatorios.html` + `admin-relatorios-v28.js`, cache `28.7.1`). Sem migration, sem banco, sem envio. Validado com os dados reais: semana 21–25/07 fechou R$ 375,00 em 7 atendimentos, ticket R$ 53,57, 6 clientes novos e 1 recorrente.

## 28.7.0 — Relatórios do negócio (novo painel de leitura)

- **Nova tela "Relatórios" (`admin-relatorios.html` + `admin-relatorios-v28.js`):** painel só de leitura no admin que resume o mês — faturamento (atendimentos concluídos, somando serviços + produtos), atendimentos concluídos, ticket médio, clientes atendidos, taxa de satisfação e faltas (no-shows). Traz três blocos visuais: serviços mais vendidos (ranking por vezes vendidas + receita), clientes novos vs. recorrentes e detalhe do faturamento (serviços vs. produtos). Navegação por mês (‹ ›) para consultar meses anteriores; o botão de próximo mês fica desativado no mês atual.
- **Sem envio de mensagens e sem alteração no banco:** a tela apenas consulta `bookings` e `experience_requests` (mesmo acesso autenticado que as demais telas do admin já usam). Não há migration nova nem deploy de Edge Function — basta publicar os arquivos estáticos.
- **Definições usadas nos números:** faturamento e ticket médio contam apenas agendamentos com status `completed`; "cliente recorrente" = já teve um atendimento concluído antes do mês analisado (senão é "novo"), contando cada pessoa uma vez pelo telefone; a taxa de satisfação é sobre as pesquisas respondidas (satisfeitos ÷ respostas) das pesquisas criadas no mês.
- **Menu:** item "Relatórios" (📈) adicionado à barra lateral de todas as telas do admin e atalho na Visão geral.
- Validado com os dados reais de produção (julho/2026): R$ 1.025,00 faturados em 20 atendimentos, ticket R$ 51,25, 19 clientes atendidos, 100% de satisfação (2 de 2 respostas), 0 faltas — o próprio `admin-relatorios-v28.js` foi executado ponta a ponta contra esses dados e os números conferiram.

## 28.2.0 — Status real de entrega, alerta de saldo SMSDev e fallback cruzado

- **Confirmação de entrega do SMS (DLR):** o status `sent` da `sms_queue` só indicava que a SMSDev aceitou o envio, não que o SMS chegou de fato no celular. Nova coluna `delivery_status` (`unknown`/`delivered`/`failed`) é preenchida consultando `api.smsdev.com.br/v1/dlr` periodicamente.
- **Alerta de saldo baixo:** nova tabela `integration_alerts` guarda o último saldo lido da SMSDev. Quando o saldo fica abaixo de 100 créditos, um e-mail de aviso é enviado para `contato@barbeariadoju.com.br` (com cooldown de 24h entre alertas repetidos).
- **Fallback cruzado SMS ↔ e-mail:** se a entrega do SMS for confirmada como falha (cliente tem e-mail cadastrado), a confirmação é reenviada automaticamente por e-mail. Se o envio de e-mail falhar na hora (erro do Zoho), tenta SMS imediatamente, quando o cliente tiver telefone — o que é sempre, já que o campo é obrigatório. Deduplicação usa o mesmo padrão já existente em `booking-reminder-24h` (verifica as duas filas antes de reenviar), evitando reenvio duplicado ou loop entre os dois canais.
- **Nova Edge Function `notifications-watchdog`:** roda a cada 15 minutos (cron), fazendo a checagem de DLR, o disparo do fallback e a checagem de saldo.
- **`booking-email` atualizada:** aceita `channel` opcional para forçar um canal específico (usado pelo fallback). Resposta passa a incluir `customer_channel_fallback_used`.
- **Painel administrativo:** nova aba "SMS automáticos" na Central de Comunicação (`admin-mensagens.html`), com cartão de saldo SMSDev, métricas e histórico de envios — mesmo padrão já usado para e-mails.
- Nova migration `030-v28.2.0-status-fallback.sql`.

## 28.1.1 — Corrige falha ao marcar agendamento como concluído

- **Bug corrigido (crítico, aplicado ao vivo no Supabase):** clicar em "Concluir" num agendamento de cliente com e-mail cadastrado falhava sempre, com erro genérico "Não foi possível concluir esta ação. Atualize a página e tente novamente." Causa: as migrations `027-v27-1-crm-premium-experiencia.sql` e `027-v27-1-experiencia-crm-real.sql` descrevem duas versões incompatíveis de `experience_requests`, e as duas acabaram sendo executadas no banco em momentos diferentes — a tabela ficou com colunas `customer_name`/`customer_email` obrigatórias (da primeira), mas o trigger que roda ao concluir (`v27_queue_experience_after_completion`, da segunda) nunca preenchia essas colunas, violando a restrição not-null e cancelando a atualização inteira.
- O contrato realmente usado em produção (`avaliacao-v27.js`, `get_experience_context`, `submit_experience_response`) já segue a segunda versão, então a tabela foi ajustada para combinar com o código já publicado, em vez de mudar o código: `customer_name`/`customer_email` deixaram de ser obrigatórias e a lista de status permitidos passou a incluir `opened`/`satisfied`/`feedback`/`review_clicked`/`expired` — valores que o código já grava, mas que a restrição antiga bloqueava (esse segundo problema ainda não tinha sido notado porque nenhuma linha chegava a ser criada em `experience_requests`).
- Nova migration `029-v28.1.1-fix-conclusao-atendimento.sql`.

## 28.1.0 — Fallback de SMS para clientes sem e-mail

- **Nova função `send-sms`:** envia SMS via API da SMSDev (`api.smsdev.com.br/v1/send`), com fila e histórico em `sms_queue` (mesmo padrão de `email_queue`/Zoho).
- **`booking-email` atualizada:** quando o cliente não informou e-mail, mas informou telefone (campo sempre obrigatório), a confirmação/reagendamento/cancelamento/lembrete é enviado por SMS em vez de ser simplesmente ignorado. Retorno da função passa a incluir `customer_channel` (`email`, `sms` ou `none`).
- **`booking-reminder-24h` corrigida:** antes, a busca de agendamentos para o lembrete de 24h excluía quem não tinha e-mail (`.not('customer_email','is',null)`), então nenhum cliente sem e-mail jamais recebia lembrete. Esse filtro foi removido. A checagem de duplicidade (que evita reenviar o mesmo lembrete) agora olha tanto `email_queue` quanto `sms_queue`, evitando reenvio repetido para quem só recebe SMS.
- Nova migration `028-v28-1-0-sms-fallback.sql` cria a tabela `sms_queue` com RLS e índice único anti-duplicidade de lembrete, no mesmo padrão da fila de e-mail.

## 28.0.14 — Fase 2: fechamento de brecha de acesso e correção da pesquisa de satisfação

- **Segurança (crítico, corrigido ao vivo no Supabase, sem necessidade de novo deploy do site):** a opção "Allow new users to sign up" do Supabase Auth foi desativada. Ela estava ativada por padrão e, combinada com políticas de segurança (RLS) de várias tabelas (`bookings`, `customer_profiles`, `contact_messages`, `loyalty_accounts`, `loyalty_events`, `schedule_blocks`, `booking_customer_actions`) que liberavam acesso para qualquer usuário autenticado (não checavam se era realmente admin), permitia que qualquer visitante criasse uma conta grátis e lesse/editasse dados de clientes. Confirmado por consulta ao banco que existia apenas 1 conta (a do próprio dono) — não há indício de que a brecha tenha sido explorada. Correção completa das políticas RLS (fazer o check real de admin) fica para uma próxima etapa, feita com mais calma e testes.
- **Bug corrigido:** `experiencia.html` (página de pesquisa de satisfação) estava com a função de salvar resposta totalmente quebrada — o código enviava parâmetros (`p_answer`) e conferia campos de retorno (`data.ok`, `data.answered`, `data.answer`) que não existem na função/dados reais do Supabase (`p_response`, `data.valid`, `data.status`). Isso fazia a página mostrar erro para 100% dos visitantes. Corrigido para usar exatamente o mesmo contrato já comprovado funcionando em `avaliacao.html`. A página `avaliacao.html` já funcionava corretamente e não foi alterada.
- **Cache:** versão de todos os arquivos versionados subida para `28.0.14`.

## 28.0.13 — Auditoria de segurança, SEO e acessibilidade (Fase 1)

- **Segurança (crítico):** corrigida vulnerabilidade de XSS no painel de Fidelidade (`loyalty-admin-v21.js`) — nome/telefone/e-mail do cliente agora são exibidos com escape correto.
- **Segurança:** links de origem externa (Central de Mensagens e respostas da JuIA) agora só aceitam `http`/`https`, bloqueando esquemas `javascript:` maliciosos.
- **Segurança (Edge Functions):** `admin-booking-status` não devolve mais stack trace/detalhes internos do banco na resposta ao cliente (só no log do servidor). CORS de `admin-booking-status` e `send-push` restrito ao domínio do site em vez de aceitar qualquer origem.
- **SEO:** adicionado `<link rel="canonical">` em `cliente.html` e `meu-agendamento.html`. `robots.txt` atualizado para bloquear `admin-mensagens.html` e `admin-notificacoes.html`, mantendo paridade com o `noindex` das próprias páginas.
- **Acessibilidade:** botão de fechar do modal de produtos agora tem `aria-label="Fechar"`.
- **Cache:** versão de todos os arquivos versionados subida para `28.0.13` (o motivo de builds anteriores não surtirem efeito no site publicado foi identificado como uma falha temporária de infraestrutura do GitHub Pages/Actions, não um problema de código — ver `RELATORIO-AUDITORIA.md`).
- Auditoria completa de navegação interna (0 links quebrados), carrinho unificado (produto+serviço testados de ponta a ponta) e revisão estática de todas as Edge Functions e migrations SQL — detalhes completos em `RELATORIO-AUDITORIA.md`.

## 28.0.11 — Navegação na mesma aba e carrinho persistente

- Links internos entre Serviços e Produtos agora interceptam o clique normal e navegam explicitamente na mesma aba.
- Produtos e serviços são preservados em `sessionStorage`, com backup em `localStorage` para resistir a abas/cache antigos.
- Ao retornar de Produtos para Serviços, o produto permanece no carrinho unificado.
- Cache do Service Worker atualizado.

## 28.0.11 — Navegação interna em uma única aba

- Links internos entre Serviços, Produtos e Agenda passam a navegar sempre na mesma aba.
- Removido `target="_blank"` de rotas internas.
- Adicionada proteção JavaScript contra versões antigas em cache que tentem abrir páginas internas em outra aba.
- Preservado o `sessionStorage` do carrinho unificado durante todo o fluxo.
- Links de produtos dentro de `/agendar/` padronizados para `/produtos.html`.

## 28.0.11 — Fluxo contínuo entre serviços e produtos

- “Ver produtos” agora abre na mesma aba.
- Links para produtos usam caminho absoluto `/produtos.html`.
- O produto escolhido permanece visível no carrinho ao retornar aos serviços.
- O carrinho de serviços soma e exibe produtos reservados.
- O avanço para escolher horário continua bloqueado até existir pelo menos um serviço.

## 28.0.11 — Navegação de produtos para serviços

- Corrige o botão **Adicionar serviços ao pedido** para abrir sempre `/agendar/#servicos`.
- Usa URL absoluta e interceptação segura para evitar links antigos em cache.
- Remove o redirecionamento automático de `/agendar/`; a página passa a ser utilizável diretamente, evitando tela preta ou loop.
- Mantém o catálogo visível e posiciona corretamente `#servicos` após o carregamento.

## V28.0.11 — Correção definitiva da tela preta em Serviços
- Força visibilidade das seções e cards mesmo quando a página é aberta por link externo com `#servicos`.
- Remove a rotina repetitiva de reposicionamento que podia causar estado inconsistente no carregamento.
- Mantém um único reposicionamento após o carregamento completo.
- Atualiza o cache do Service Worker.

## 28.0.11 — correção definitiva do link “Ir direto à agenda”

- O botão em `/agendar/` agora usa URL absoluta para `/agendar.html`.
- Criada rota de compatibilidade `/agendar/agendar.html`, que redireciona automaticamente para a agenda correta.
- Atualizado o cache do Service Worker para impedir reaproveitamento da navegação antiga.

## 28.0.11 — Correção definitiva do link direto para Serviços

- Serviços não dependem mais da animação `reveal` para aparecer.
- Link `/agendar/#servicos` agora reposiciona após DOM, carregamento e fontes.
- Evita tela vazia ao abrir o sitelink “Produtos e serviços” do Google.
- Cache e assets atualizados para 28.0.11.

## 28.0.11 — Correção de carregamento visual e cache

- Corrige abertura ocasional da página de serviços sem CSS ao chegar pelo Google.
- Folhas de estilo agora usam caminho absoluto e mecanismo automático de nova tentativa.
- Adicionado estilo crítico mínimo para impedir página HTML sem formatação.
- Service Worker revisado: navegação e CSS/JS usam prioridade de rede e caches antigos são removidos.
- Registro do Service Worker passa a ignorar cache de atualização.

# V28.0.1 — Navegação do catálogo

- Adicionado link **Voltar aos serviços** no topo de `produtos.html`.
- Mantido acesso direto à página inicial.
- Botão flutuante inferior agora retorna aos serviços.
- Cache busting dos arquivos usados em `produtos.html` atualizado para `28.0.1`.

# V28.0.0 — Fundação técnica e conversão

- Adicionado botão “Ver produtos” diretamente no hero da página inicial.
- Mantido o botão “Ver produtos” na página `/agendar/`.
- Padronizado o cache busting de arquivos CSS e JavaScript para `v=28.0.0`.
- Atualizado o Service Worker para um novo cache, evitando arquivos antigos após o deploy.
- Corrigida a geração do arquivo `.ics`, que continha uma quebra inválida no JavaScript.
- Mantidos a galeria existente com quatro imagens e o vídeo com `preload="none"`, pois ambos já estavam implementados corretamente.
- Nenhuma alteração de banco de dados, RLS ou Edge Functions nesta etapa.

# V27.1.4

- Adicionado botão **Ver produtos** no topo da página de serviços e agendamento.
- O catálogo de produtos abre em nova aba para preservar a seleção de serviços do cliente.


## V25.1.2 — Hotfix do cancelamento
- Corrigida a comparação de data e hora no cancelamento feito pelo cliente.
- O sistema agora interpreta o horário da barbearia explicitamente no fuso de São Paulo.
- A página Meu Agendamento passa a exibir a mensagem real devolvida pela Edge Function.

# V25.0.2 — Correções da confirmação automática

- Corrigido o envio de Push ao criar agendamentos pelo site.
- Corrigido o envio de Push ao criar agendamentos pela JuIA.
- Nova Edge Function `create-public-booking` mantém o segredo do Push fora do navegador.
- Busca do CRM refeita com pesquisa por nome, telefone e e-mail.
- Busca ignora acentos e diferenças entre maiúsculas e minúsculas.
- Adicionados botões Buscar e Limpar, Enter e filtro automático com pequena espera.

# V25.0.1 — Confirmação automática e CRM

- Agendamentos públicos passam a ser gravados como confirmados.
- JuIA confirma o horário imediatamente após a reserva bem-sucedida.
- Tela pública não informa mais que o cliente deve aguardar confirmação.
- Busca do CRM continua instantânea e agora também responde à tecla Enter.
- Mantidos bloqueios de horário, margem mínima de 15 minutos e prevenção de conflitos.

# V24.6.3 — Push sincronizado e autorreparo
- Novo par VAPID sincronizado entre site e Supabase.
- Detecta automaticamente assinatura criada com chave antiga.
- Cancela assinatura antiga antes de criar a nova.
- Exibe entregas e falhas no teste de notificação.
- Atualiza Service Worker e cache para evitar versão antiga.

# V24.6.2
- Rotação completa das chaves VAPID.
- Novo segredo do webhook.
- Chave pública sincronizada com o site.

# V24.6.1 — Push multicliente e alerta sonoro no PC

- Notificações Web Push em Android, iPhone/iPad instalados e Chrome/Edge no computador.
- Notificação persistente no PC (`requireInteraction`) com som padrão do sistema.
- Campainha interna adicional quando o painel administrativo está aberto no computador.
- Vibração reforçada em dispositivos compatíveis.
- Tela administrativa para ativar, testar e desativar cada aparelho.
- Toque na notificação abre a agenda administrativa.

# V24.5.1 — Estabilização do formulário próprio

- Reescreve a Edge Function `contact-form` sem dependência externa do cliente Supabase.
- Compatibilidade com `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_SECRET_KEYS`.
- Tratamento global de erros e `request_id` para diagnóstico.
- Logs claros para contagem, gravação e envio opcional por e-mail.
- Mensagem permanece salva mesmo quando o Resend não está configurado ou falha.

# Changelog

## V24.5.0
- Remove dependência do FormSubmit.
- Salva dúvidas no Supabase.
- Nova tela Mensagens no painel.
- Resposta pelo WhatsApp, status, arquivo e exclusão.
- Envio opcional ao Zoho por Resend.
- Proteção antispam e limite por telefone.

## V24.4.8
- Corrige estouro horizontal da revisão do agendamento em celular, tablet e janela estreita.
- JuIA abre em tela cheia no celular com cabeçalho e botão fechar sempre visíveis.
- Bloqueia zoom causado por overflow e restaura a página ao fechar o chat.
- Mantém o formulário FormSubmit para nova tentativa de ativação.

## V24.4.6
- Corrige seleção de serviços no novo agendamento administrativo.
- Cartões inteiros clicáveis e destaque visual de seleção.
- Resumo de quantidade, duração e valor dos serviços selecionados.

## V24.4.4
- JuIA vira aba lateral compacta no celular.
- Evita sobreposição com botões principais e barra inferior.
- Desktop mantém o botão completo.

# V24.4.3 — etapa final responsiva

- Corrige ampliação/estouro horizontal na tela Confira e envie no iPhone.
- Permite quebra segura de nome, telefone, valores e horário.
- Mantém o formulário limitado à largura real da tela.
- Preserva zoom manual por acessibilidade.

# V24.4.1 — alinhamento do fluxo de agendamento

- Continuar e Voltar agora alinham no início útil do agendamento.
- A barra Atendimento, Horário, Seus dados e Confirmar permanece visível.
- Evita retorno ao cabeçalho grande da página em desktop e celular.

## V24.4.1 — Agendamento guiado
- Remove mensagem contraditória de indisponibilidade.
- Evita respostas antigas sobrepondo horários atuais.
- Avança com rolagem automática para a etapa correta.
- Barra de progresso fixa e clicável nas etapas concluídas.
- Ações principais sempre visíveis no celular.
- Resumo lateral oculto no mobile para reduzir rolagem.
- Layout de horários otimizado para telas pequenas.

# V24.3.4

- Agenda abre automaticamente no próximo dia útil reservável.
- Domingo e segunda avançam para terça-feira.
- Após o expediente, a seleção avança para o próximo dia de atendimento.
- Datas sem vagas avançam automaticamente para o próximo dia com disponibilidade.
- Mantida a margem mínima de 15 minutos para agendamentos no mesmo dia.

# V24.3.3

- Oculta horários passados na agenda do mesmo dia.
- Exige antecedência mínima de 15 minutos para novos agendamentos.
- Usa o fuso horário America/Sao_Paulo no banco.
- Validação aplicada no SQL e também no navegador.
- Impede gravação direta de horários fora da margem de segurança.

# V24.3.2
- Corrige carrinho embaçado no desktop, Android e iPhone.
- Move o overlay escuro para trás do carrinho.
- Remove o backdrop-filter do overlay para compatibilidade entre navegadores.

# V24.3 — Carrinho mobile responsivo

- Corrige distorção e corte lateral do carrinho em Android e iOS.
- Carrinho abre como bottom sheet, limitado à viewport.
- Adiciona rolagem interna, safe area do iPhone e botões maiores.
- Oculta JuIA e botões flutuantes enquanto o carrinho está aberto.
- Bloqueia rolagem da página ao fundo.
- Mantém o funcionamento desktop.

## V23.0 — Cliente Inteligente + CRM Premium
- Nova página Minha Área com próximo horário, última visita, fidelidade e repetir serviço.
- CRM com VIP, etiquetas, preferências técnicas, serviços/produtos favoritos, pagamento e intervalo de retorno.
- Novo SQL 015 e contexto comercial ampliado para a JuIA.

# Changelog
## 22.4 — Security & UX Release
- Adicionados Content-Security-Policy e X-Frame-Options.
- Implementado Consent Mode para Analytics/Ads e aviso de privacidade.
- Criada página `privacidade.html`.
- Adicionados toasts, carregamento global e tratamento visual de erros no painel.
- Atualizados cache, Service Worker e documentação.


## V22.3 — Experiência pós-atendimento

- Criada a página `404.html` com identidade visual da Barbearia do Ju e atalhos para início, serviços/agendamento e WhatsApp.
- Após marcar um atendimento como concluído, o painel pergunta se deseja agradecer e solicitar uma avaliação no Google pelo WhatsApp.
- A mensagem utiliza o link oficial de avaliação `https://g.page/r/CaQfC5axIQQIEBM/review`.
- Atualizado o Service Worker e o identificador de cache para evitar versões antigas.
- Nenhuma alteração no banco de dados ou nas Edge Functions.

## V22.1 — Estabilização
- Restringido o CORS da Edge Function `ju-ia-admin` ao domínio `https://www.barbeariadoju.com.br`.
- Mantido o mesmo padrão de CORS já aplicado à função `ju-ia-site`.
- Corrigida a documentação do vídeo: o código usa `preload="none"`, opção escolhida para desempenho.
- Adicionados `VERSAO.md`, `CHANGELOG.md` e `ROADMAP.md` para controle do projeto.
- Nenhuma alteração visual, de banco de dados ou de regras de agendamento nesta versão.

## V22 — Sprint 1
- Fresha removido da experiência pública.
- Horários oficiais alinhados.
- Modo Atendimento adicionado.
- Duplicações do GTM e de scripts corrigidas.

## V22.2 — Refinamentos pré-publicação

- Adicionadas regras `Disallow` para todas as páginas administrativas no `robots.txt`.
- Atualizada a descrição do `manifest.webmanifest`, removendo a referência antiga a agendamento pelo WhatsApp.
- Incluída orientação para validar o redirecionamento de `https://barbeariadoju.com.br` para `https://www.barbeariadoju.com.br` no Cloudflare.
- Nenhuma alteração visual, de banco, agenda, CRM ou Edge Functions.

V22.5 — Correção do carrinho de serviços, integração serviços/produtos/agenda e ordem de carregamento do Supabase.

## V22.6
- Sincroniza automaticamente clientes de agendamentos com o CRM para habilitar edição, arquivamento e exclusão.
- Corrige quebra visual do WhatsApp no bloco de contato desktop.
- Adiciona botão × para remover um serviço individualmente do carrinho.
- Melhora a mensagem de confirmação da JuIA no código-fonte da Edge Function.

## V24.2 — Revisão geral e estabilização
- Remove o link “Privacidade” inserido acidentalmente no card Corte + Barboterapia.
- Atualiza o identificador do cache do PWA e os parâmetros de versão dos arquivos estáticos.
- Adiciona `cliente.html` ao sitemap e ajusta sua atualização dinâmica no Service Worker.
- Sincroniza o código-fonte da Edge Function `ju-ia-site` com a V24 CRM Inteligente já implantada.
- Valida links internos e sintaxe dos arquivos JavaScript.
- Nenhuma alteração de banco de dados.

## V24.4.3 — Responsividade universal da etapa final
- Corrige estouro horizontal em iOS, Android, tablets e janelas estreitas no desktop.
- Permite quebra segura de nomes de serviços, produtos, valores, horários e dados do cliente.
- Adapta a confirmação para telas muito estreitas sem ampliar a página automaticamente.

## V24.4.6 — Horários inteligentes na JuIA
- Quando há muitos horários, a JuIA pergunta se o cliente prefere manhã, tarde ou final do dia.
- Mostra todos os horários disponíveis do período escolhido.
- Responde diretamente quando o cliente pergunta por um horário exato.
- Mantém no pacote as correções responsivas V24.4.3 e V24.4.4.
- Nenhuma alteração de banco de dados.

## V24.6.0 — Notificações do painel
- Ativação separada no iPhone e Android.
- Web Push para novos agendamentos.
- Notificação de teste e abertura direta da agenda.
- Service Worker preparado para alertas em segundo plano.


## V25.1.0 — Meu Agendamento
- Link seguro após a confirmação.
- Consulta, cancelamento e reagendamento pelo cliente.
- Liberação automática do horário cancelado ou anterior.
- Push administrativo em cancelamentos e reagendamentos.
- Google Agenda, arquivo de calendário e convite para instalar o PWA.

## V25.1.1 — Hotfix do link de gerenciamento
- Corrige a gravação do `booking_code` e do `management_token_hash`.
- Impede a entrega de links inválidos quando a gravação falhar.
- Adiciona função SQL atômica para vincular o gerenciamento ao agendamento.
- Melhora os logs da Edge Function `create-public-booking`.

## V26.0.0 — Central de Comunicação
- OAuth oficial do Zoho Mail.
- Envio HTML de confirmação, reagendamento e cancelamento.
- Avisos para cliente e barbearia.
- Fila/histórico `email_queue` com status e erros.
- Integração não bloqueante com `create-public-booking` e `manage-booking`.
- Mantida a correção segura de cancelamento por RPC.

## V26.4.0 — 19/07/2026
- Novo CTA de reagendamento no e-mail de cancelamento.
- Edge Function de lembrete automático 24 horas antes.
- Bloqueio de lembretes duplicados na fila de e-mails.
- Histórico de e-mails automáticos dentro da Central de Comunicação.
- Melhor adaptação do painel administrativo para celulares e telas pequenas.
- Botões administrativos com estado de carregamento e mensagens mais amigáveis.


## V27.0 — Endereço profissional de agendamento
- Criada a rota pública `/agendar/` mantendo o endereço amigável no navegador.
- Atualizados botões do site, área do cliente, página 404, produtos e Ju IA.
- Atualizados canonical, Open Graph, Schema e sitemap.
- `servicos.html` permanece compatível e troca visualmente para `/agendar/`.
- E-mails passam a utilizar `/agendar/` como destino padrão.
- Service Worker atualizado para a nova rota.

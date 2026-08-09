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

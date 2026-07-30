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

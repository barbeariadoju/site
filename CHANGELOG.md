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

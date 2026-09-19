# Barbearia do Ju — briefing do projeto

Leia antes de tocar em qualquer coisa. Cobre o estado atual, as decisões tomadas
e as armadilhas que já custaram retrabalho.

---

## 1. Confirme que você está no repositório certo

**Não confie em caminho escrito em documento.** O caminho muda de máquina para
máquina (o PC de casa e o notebook da barbearia usam pastas diferentes). O
identificador confiável é o remote:

```bash
git remote -v
# tem que apontar para: https://github.com/barbeariadoju/site.git
```

Outros sinais de que é o repo certo: existem `CHANGELOG.md`, `VERSAO.md`, a pasta
`agendar/` e um `package.json` com vitest e playwright.

⚠️ **Existem cópias antigas espalhadas** (arquivos de julho/2026, algumas
renomeadas para `_ARQUIVO-...-NAO-EDITAR`). Se o remote não bater, é cópia —
editar lá é trabalho perdido.

---

## 2. O negócio

Barbearia do Ju — Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista/SP.
Dono e único barbeiro: **Juliano Bruno Lopes Padilha**, farmacêutico
(especialista em Farmácia Clínica e Prescrição Farmacêutica, USF) e barbeiro.

Isso condiciona tudo: é **um barbeiro, um cliente por vez, terça a sábado**,
capacidade de ~215 atendimentos/mês. Estratégias desenhadas para resolver falta
de volume (escrever 50 artigos, campanha de massa) atacam um problema que ele não
tem. O gargalo é **ocupação das janelas vazias e ticket médio**, não tráfego bruto.

A dupla formação é o diferencial inimitável em Bragança. Use em conteúdo sobre
pele, couro cabeludo, composição de produto e segurança de química capilar.
**Não transforme o site em site médico**: a régua é "barbearia com conhecimento
técnico", e todo tema de saúde termina com encaminhamento ao dermatologista.

---

## 3. Como o projeto funciona

- Site estático, **sem build**. CSS dividido em `css/01..05`, agregado por
  `@import` no `style.css`.
- Publicação: `git push origin main` → GitHub Pages leva ~1 minuto.
  **Confirme no ar com curl** antes de dizer que está feito.
- Testes reais: `npm test` = 48 unit (vitest) + 46 e2e (playwright).
  **Rode sempre antes de publicar.**
- ⚠️ **Nunca** rode `npm run test:e2e:live` — grava no Supabase de produção. Desde
  03/09/2026 isso é regra no `.claude/settings.json`, não só aviso escrito.

Identificadores: GTM `GTM-T9KR76KB` · GA4 `G-4XZTP0550B` (propriedade `545112517`)
· Supabase project `rpkqluaxhqsxnewunhfm`.

### O WhatsApp (Evolution API) — onde mora

⚠️ **ESTE REPOSITÓRIO É PÚBLICO.** Conferido em 03/09/2026 (`visibility: public`). Nada de
endereço de servidor, usuário de acesso, porta, credencial ou detalhe de firewall pode ser
escrito aqui — nem "para documentar". Em 03/09 eu mesmo publiquei o IP e o usuário SSH da
instância nesta seção e tive que remover; o histórico do Git guarda o que já foi commitado,
então o estrago de um deslize desse não se desfaz editando depois.

- Stack: Docker Compose com `postgres` + `redis` + `evolution-api` (v2.1.1) + `caddy`,
  hospedada em nuvem. Definição versionada em `whatsapp-ai/` (o `.env` real vive só no
  servidor, nunca aqui).
- O Supabase chama a Evolution pelos secrets `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e
  `EVOLUTION_INSTANCE_NAME`; a Evolution chama de volta o `whatsapp-webhook`, que aceita o
  segredo por header `x-webhook-secret` **ou** por `?token=` na URL.
- **Endereços, usuário de acesso, portas e credenciais dessa infra ficam FORA do repo**, em
  `~/.claude/site barbearia/` e na memória do projeto. É de lá que se consulta — nunca daqui.

---

## 4. Armadilhas que já custaram retrabalho

**Cloudflare na frente (desde 17/09/2026).** O DNS e o proxy do domínio estão no Cloudflare (conta do Juliano, plano Free): HSTS 6 meses, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options e TLS 1.2 vêm de lá, não do repo. CSS/JS ficam até ~10 min na borda (HTML e JSON não são cacheados) — o `?v=` novo é o que garante versão nova; pra forçar, Caching → Configuration → Purge Everything no painel. "Always Use HTTPS" fica DESLIGADO (o GitHub Pages já redireciona; ligar nos dois dá loop). A CSP (Content-Security-Policy) TAMBÉM vem do Cloudflare (v29.203.1): scripts, conexões e iframes só de uma lista fechada (site, jsdelivr, GTM, GA, Google Ads, Meta, Supabase, Google Fonts). **Serviço externo novo no site ou no admin (pixel, embed, CDN, API chamada do navegador) entra na CSP no Cloudflare ANTES de ir pro ar**, senão o navegador bloqueia em silêncio — foi assim que a conversão do Google Ads quase morreu em 17/09. Conferir com um ouvinte de securitypolicyviolation no console da página em produção.

**Cache.** Ao alterar qualquer `.js` ou `.css`, **bumpe o `?v=`** nas páginas que
o carregam *e* no `style.css`. Já aconteceu de publicar código novo atrás de cache
velho: o evento simplesmente não existia na página em produção. A home ainda tem
`<link rel="preload">` das folhas 01-05: **o `?v=` delas tem que ser igual ao dos
`@import` do `style.css`** (ficaram defasados até a 29.204.0 e a home baixava o CSS duas vezes).

**CSS do painel (desde 29.205.0).** O `css/06-admin-reforma.css` **não** está no
`style.css`: cada `admin*.html` liga ele direto, logo depois do `style.css`. Página nova
do painel precisa dessa linha. Motivo: eram 53 KB bloqueando todo visitante do site, e
foi provado por snapshot que não altera nada nas páginas públicas.

**Fonte reserva calibrada.** Toda pilha de fonte com Inter tem `InterFallback` logo
depois (`Inter,InterFallback,...`). É o que zera o CLS da troca de fonte (a página de
serviço pulava 50px). Fonte nova ou pilha nova: manter o par.

**Nada de rótulo decorativo acima de título.** Os 99 "eyebrows" do site viraram
breadcrumb, sumiram ou foram integrados ao título (29.205.0). Não reintroduzir — só as
"Etapa N" do reagendamento ficam (são progresso). Medida de leitura é em `em`
(`max-width:34em`), nunca em `ch` (o `ch` mede o dígito 0 e dá ~90 caracteres por linha).

**Service worker.** O `sw.js` recarrega a página no `controllerchange`. Qualquer
coisa que leia parâmetro de URL precisa ser **idempotente** — o `?servico=`
somava o serviço duas vezes (2× Barboterapia, R$ 80) até ganhar guarda. No painel
(`admin-pwa.js`) essa recarga **espera** modal fechado e ninguém digitando (29.205.0) —
não remover essa guarda. Sem rede, navegação fora do cache cai no `offline.html`.

**Testes e2e.** Hook instalado via `page.evaluate()` morre nesse reload. Use
`addInitScript` + `sessionStorage` para capturar o `dataLayer`.

**Scripts de edição em massa.** Casar formato de linha falha em silêncio. A página
pilar ficou fora do sitemap por um dia porque o script imprimiu "adicionada" sem
ter adicionado. **Sempre confira a contagem depois.**

**Google Business Profile.** O upload de foto pela TELA do Google trava em qualquer
automação (input dentro de iframe, janela de arquivo nativa). Pela API funciona: Windsor
`google_my_business` → `upload_media` com a URL pública da foto (hospedar antes em
`assets/gbp/`, commit + push, conferir 200). Categorias aceitas em 16/09/2026: `INTERIOR`,
`ADDITIONAL`; `PRODUCT` devolve 400 nesta categoria de negócio. Toda foto passa pelo crivo
antes (Read na imagem): nada de cliente, nada de cabo/tomada/bagunça no quadro, e **nunca a
placa física de horário** sem retoque — ela mostra 8h30–18h/8h30–14h (o horário real é 8h–19h /
8h–15h) e o Juliano decidiu em 16/09/2026 deixar assim (a designer não responde). Toda foto de
fachada passa pela correção digital das duas linhas antes de ir pro perfil. E a interface
abre sozinha o overlay *"Escolha o elemento para o qual você está enviando
feedback"* quando o clique erra o alvo: **nunca interaja com ele**, recarregue.

---

## 5. Decisões que NÃO devem ser revertidas

Se uma auditoria apontar estes itens como pendência, a auditoria está errada.

- **Não criar landing pages por bairro ou cidade.** Um endereço, uma cidade, um
  barbeiro = seriam doorway pages, e a penalidade atinge o domínio inteiro.
- **Não autodeclarar `AggregateRating`** no schema. A nota vem do Google.
- **Não adicionar categorias secundárias no GBP.** "Barbeiro" e "Salão de beleza
  masculino" não existem na lista em português; as alternativas são falsas
  (Escola de barbearia, Loja de produtos para barbeiro) ou mais genéricas que a
  principal (Salão de Beleza). Categoria falsa é pior que categoria ausente.
- **Não remover as UTMs do link da postagem do GBP** (`utm_medium=gbp`). São
  intencionais: separam no GA4 o que veio de post do tráfego normal do Maps.
- **Não incluir `booking_confirmed` no regex do acionador de funil do GTM.** Ele
  já tem tag própria e entraria duplicado na conversão.
- **Não migrar as URLs do blog** para `/blog/slug/`. Custa redirect e risco sem
  ganho proporcional; breadcrumbs resolvem a maior parte.
- **Não reduzir as menções de "barboterapia" na home.** Das 10, só ~4 são texto
  visível; o resto é meta e schema, legítimos. Canibalização se resolve com link
  interno de âncora comercial, e já foi feito.
- **Não deixar somar dois serviços da mesma família num atendimento** (regra do
  Juliano, 22/08/2026): 1 corte + 1 barba; Barboterapia e Barba Express são
  alternativas; combos "Corte + X" já incluem a barba; pezinho já vem no corte.
  Única exceção: corte adulto + corte infantil (pai e filho). Fonte única:
  `assets/js/service-rules.js` (+ cópia TS em `supabase/functions/_shared/`).
- **Nenhuma mensagem para cliente leva emoji** (regra do Juliano, 01/09/2026): quem
  aparece como remetente do WhatsApp é ele, o cliente não sabe que quem responde é uma
  IA, e piscadinha entre homens é lida como outra coisa. Tom formal e cordial, simpatia
  na palavra escrita. Único permitido: 🙏, e só em agradecimento. Fonte única:
  `supabase/functions/_shared/sem-emoji.ts`, aplicado na SAÍDA de toda function que
  escreve no WhatsApp. Nunca aplicar na entrada — as regex que detectam emoji do cliente
  (👍, 🤝) precisam do texto original.
- **Barba Express é feita SÓ na máquina.** Navalha e toalha quente são da Barboterapia;
  a com vaporizador de ozônio é a mais completa. Toda oferta de barba (JuIA e site) sai
  com esse resumo entre parênteses. Já saiu errado uma vez, vendido a cliente
  (01/09/2026), porque o `sales_pitch` no banco dizia "com navalha no acabamento".
- **O comprovante do atendimento FURA o silêncio das 20h** (regra do Juliano, 03/09/2026).
  A guarda das 20h vale pra mensagem de marketing (lembrete, aniversário, reativação); o
  cupom do que o cliente acabou de pagar sai na hora, com ele ainda na porta da barbearia —
  é o que evita a dúvida do dia seguinte (caso Wellington, 02/09). A exceção é estreita e
  deve continuar assim: só a chamada da conclusão (`immediate:true`), só aquele `booking_id`,
  só atendimento do dia, nunca de madrugada, e o cron segue respeitando o silêncio inteiro.
- **O aviso de chegada (rota do Maps, 30 min antes) FURA o silêncio das 8h** (regra do Juliano,
  19/09/2026, v29.207.0): horário das 8h00 recebe às 7h30, porque o horário foi o cliente quem
  escolheu. Exceção estreita: só a `whatsapp-arrival-route`, só na janela de 25-35 min do próprio
  agendamento, piso 7h e teto 20h (`horaPermitida` em `_shared/aviso-chegada.ts`). Não estender
  a lembrete, aniversário, reativação nem marketing — esses seguem o `juia_quiet_now()`.
- **O cupom não fiscal tem fonte única:** `supabase/functions/_shared/comprovante.ts`, com
  teste em `tests/unit/comprovante.spec.js`. Não reescrever o texto dentro da function. E o
  **motivo da cortesia nunca vai pro cliente** — aquele campo é anotação interna.
- **`admin-version.json` e a constante `ADMIN_VERSION` são separados de propósito**
  da versão do site. É o que decide o reload do painel aberto durante atendimento.
- **O GTM lê `#agenda-email` e `#agenda-phone` na hora do `booking_confirmed`** (conversões
  otimizadas do Google Ads, configuradas pelo suporte do Google em 16/09/2026: duas variáveis
  de JavaScript personalizado + "dados fornecidos pelo usuário" na tag de conversão). Isso
  depende de duas coisas que não podem mudar sem avisar: os ids desses inputs, e o
  `fire('booking_confirmed', …)` em `agenda-v15.js` disparar com o formulário ainda na tela
  (hoje dispara antes de trocar o bloco de status — o formulário fica no DOM). O consentimento
  (`ad_user_data`) continua sendo o que libera o envio; a política de privacidade descreve isso
  desde 16/09. Nunca colocar e-mail/telefone no `dataLayer` do evento: a tag do GA4 mandaria
  junto, e PII no GA4 viola a política do Google.

---

## 6. Estado do SEO (16/08/2026)

Feito e no ar: hub de serviços com 24 páginas, 0 páginas órfãs, página-mãe de
corte masculino, guia pilar da barba amarrando 7 artigos, 4 artigos com
referência de PubMed e ANVISA (com DOI), página de perguntas frequentes com 23
questões, bloco de avaliações reais na home, hero com preço e garantia na primeira
dobra, popup que deixou de bloquear o próprio CTA, pré-seleção de serviço por
`?servico=slug` e funil completo no GA4 (`clique_agendamento` →
`service_selected` → `checkout_step_horario` → `booking_confirmed`).

**O que ainda limita a nota, e não é código:**

- **Autoridade externa.** ⚠️ Corrigido em 16/09/2026: a barbearia **já tem cadastro**
  em Apple Business Connect, Bing Places, Solutudo, Guia de Bragança e Facebook
  (informação do Juliano). O problema não é ausência, é **consistência**: o Guia de
  Bragança lista "rua Antonio da Cruz n°481" (certo: Rua Dr. Antônio da Cruz, 482),
  sem CEP, horário, site nem foto. Roteiro de conferência campo a campo em
  `SEO-CITACOES-PACOTE.md`. Não proponha "criar citações" de novo.
- **Cadência no perfil.** Meta: 3 fotos + 1 post por semana, com pelo menos uma
  de ambiente (a foto do interior tem 2,21 mil visualizações, muito acima das de
  resultado).
- **Avaliações.** 108 em 17/09/2026 (eram 81 em 16/08), nota 5,0, 100% respondidas. Meta de 15+/mês, alvo 200
  em 12 meses. O concorrente Fígaro tem 467 — é o principal gap competitivo.
  **Nunca** ofereça desconto ou brinde em troca de avaliação: viola diretriz.

⚠️ O recurso de **Perguntas e Respostas do GBP foi descontinuado** pelo Google em
03/11/2025. Não existe mais onde publicar; o conteúdo vive em
`perguntas-frequentes.html`, de onde a IA do Google puxa as respostas.

---

## 7. Como trabalhar aqui

- **Leia o código antes de afirmar que algo falta.** Uma auditoria feita por
  rastreamento externo apontou como pendências várias coisas que já estavam
  prontas: schema correto, imagens otimizadas, 23 páginas de serviço.
- Antes de publicar: `npm test`, validar JSON-LD, checar links quebrados e
  páginas sem link de entrada.
- Registre no `CHANGELOG.md` no estilo da casa: o que mudou, **por quê**, e o que
  foi decidido contra a recomendação óbvia, com o motivo.
- Referência científica: levante **na fonte** (PubMed, ANVISA) e cite com DOI.
  Nunca escreva citação de memória.
- Quando errar, diga. O CHANGELOG deste projeto registra os próprios erros de
  propósito — é o que evita repeti-los.

---
description: Dia de folga na barbearia — roda as 5 frentes de melhoria (citações SEO, auditoria técnica do site, revisão da JuIA, revisão de segurança, artigo do blog). Use /dia-de-folga para tudo, ou /dia-de-folga 2 para uma só.
---

# /dia-de-folga — o que fazer quando a agenda está vazia

Criado em 16/09/2026 a pedido do Juliano ("estamos com muita folga hoje, tem algo de bom que
poderíamos fazer?"). São cinco frentes, em ordem de retorno. Argumento opcional: o número da
frente (`/dia-de-folga 2` roda só a auditoria técnica). Sem argumento, roda as cinco na ordem,
uma de cada vez, e no fim entrega UM resumo curto em português simples (o Juliano é leigo).

**Antes de qualquer coisa:** leia `CLAUDE.md` inteiro (regras da casa, armadilhas, decisões que
não podem ser revertidas) e confira `git remote -v` (tem que ser barbeariadoju/site). Trabalhe
sempre com `npm test` verde antes de publicar, entrada no `CHANGELOG.md` no estilo da casa (o que
mudou, por quê, o que foi decidido contra o óbvio), `VERSAO.md` bumpado, `?v=` bumpado em todo
`.js`/`.css` alterado, `git push origin main` e `curl` no ar antes de dizer "feito". Function do
Supabase muda = `npx supabase functions deploy <nome>` (`--no-verify-jwt` só nas que já são
`verify_jwt=false` — confira com `npx supabase functions list`). Migration = arquivo em
`database/migrations/NNN-vX.Y.Z-nome.sql` E aplicada no projeto `rpkqluaxhqsxnewunhfm` pelo
conector do Supabase. Nunca `npm run test:e2e:live`. Nunca escreva segredo, IP ou credencial no
repositório (é público).

---

## 1. Citações locais de SEO (a maior alavanca parada)

Contexto: `CLAUDE.md` seção 6. Nenhuma citação local foi criada. As cinco mais baratas: Apple
Business Connect, Bing Places, Solutudo, Guia de Bragança (guiadebraganca) e a página do
Facebook com dados completos. O Juliano cria as contas; você prepara o pacote.

O que entregar: o arquivo `SEO-CITACOES-PACOTE.md` na raiz do repo com, para CADA diretório, um
bloco pronto para copiar e colar: nome exato ("Barbearia do Ju"), endereço completo (Rua Dr.
Antônio da Cruz, 482, Centro, Bragança Paulista/SP — confira o CEP no JSON-LD de `index.html`),
telefone/WhatsApp, site, horário (ter–sex 8h–19h, sáb 8h–15h, dom/seg fechado), categorias
sugeridas, descrição curta (≤ 250 caracteres) e longa (≤ 750), 5 fotos indicadas (caminhos em
`assets/`, priorize ambiente — a foto do interior é a mais vista no GBP), e o link de agendamento
com UTM (`utm_source=<diretorio>&utm_medium=citation&utm_campaign=citacoes-locais`). Regras de
copy: `marketing_memory` (categoria `identidade`, `tom_de_voz`, `restricao` — palavras banidas:
"premium", "de luxo", "a melhor barbearia"; nunca prometer ajuste/retoque; nunca expor agenda
vazia). Os dados têm que ser IDÊNTICOS em todos os diretórios (NAP consistente) e iguais ao GBP.
Feche com um checklist de 5 linhas do que o Juliano faz em cada site, na ordem, com o link de
cadastro de cada um. Não crie conta nenhuma você mesmo.

## 2. Auditoria técnica do site (não depende do Juliano)

Escopo: todas as URLs do `sitemap.xml` (site estático no GitHub Pages, `www.barbeariadoju.com.br`).
Para cada página: links internos quebrados (HTTP ≠ 200), páginas do sitemap sem nenhum link de
entrada (órfãs), JSON-LD que não parseia ou com campo obrigatório faltando (LocalBusiness/
BarberShop, FAQPage, Article), `<title>`/description duplicados ou vazios, imagens sem `alt`,
imagens acima de 300 KB, `?v=` de JS/CSS desalinhado entre páginas (armadilha real: código novo
atrás de cache velho). Velocidade: PageSpeed Insights via API pública
(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&strategy=mobile`) só para
`index.html`, `agendar/` e a página-mãe de corte; anote LCP/CLS/INP. Acessibilidade básica:
contraste dos botões dourados, foco visível, `lang`, labels dos formulários.

Corrija o que for seguro (links, alt, JSON-LD, cache) e liste o resto com esforço estimado.
Antes de afirmar que algo falta, leia o código — uma auditoria externa já apontou como pendência
coisas que estavam prontas (`CLAUDE.md` seção 7). Não toque nas decisões da seção 5.
Publique com `npm test` verde e confira no ar.

## 3. Revisão das conversas da JuIA (rotina de 18/08)

Leia TODAS as conversas do dia (ou desde a última revisão registrada no CHANGELOG — procure
"rodada de revisão"): `whatsapp_messages` (entrada, saída da JuIA `sent_by='bot'` e o que o
Juliano respondeu na mão `sent_by='human'`) e `site_chat_messages`. Para cada conversa, pergunte:
a JuIA entendeu o pedido? repetiu pergunta? ofereceu horário que não devia? perdeu serviço citado?
prometeu algo que a casa não faz? O Juliano precisou assumir? Cada defeito vira caso nomeado
(cliente, hora, o que ele disse, o que ela respondeu, o que devia ser), correção em
`supabase/functions/ju-ia-site/index.ts` (e/ou `whatsapp-webhook`), teste em produção com sessão
`deploy-check-vX.Y.Z-*` pela chave anônima (ver `juia-chat.js` para o formato do POST) e
`delete from site_chat_messages where session_id like 'deploy-check-...%'` no fim. Respeite as
lições já registradas nas versões 29.180–29.194 (não regrida nada). Dados errados no banco por
causa do defeito (lead, pesquisa, reserva) são acertados na mão e anotados.

## 4. Revisão de segurança do painel e do banco

A última foi em agosto (v28.55.0, migrations 087/088). Desde lá entraram dezenas de RPCs e
functions. Confira, sem alterar comportamento:
- Toda function em `database/migrations` com `security definer` que muda dado: exige
  `public.is_admin()` ou segredo do Vault? Liste as que não exigem e decida caso a caso (as
  chamadas pelo site público, como `create_public_booking_v15`, são intencionais).
- `grant execute ... to anon/public` em função que não deveria ser pública.
- Tabelas com RLS desligado ou policy `using (true)` para `anon`.
- Edge functions com `verify_jwt=false`: cada uma confere `x-webhook-secret` ou equivalente?
  (`grep -L "x-webhook-secret" supabase/functions/*/index.ts` é o começo.)
- Chaves/segredos versionados por engano: `git log -p -S "SUPABASE_SERVICE_ROLE" --all` e
  varredura por padrões de token (`eyJ...` de service_role, `sk_`, `whsec_`). A chave anônima
  em migrations de cron é esperada (é pública por natureza).
- `get_advisors` do conector do Supabase (security e performance) — leia os avisos.
Entregue: lista priorizada (crítico / importante / cosmético), e corrija só o crítico neste
mesmo dia, com migration própria. O resto vira proposta.

## 5. Um artigo do blog (não dois — qualidade acima de volume)

Regra da casa: ~1 artigo excelente por semana, nunca em massa. Escolha o tema pelo que a JuIA e
os clientes mais perguntam (`whatsapp_messages` do mês, `conversation_leads.service_interest`)
cruzado com o que ainda não existe em `blog-*.html`. Padrão editorial fixado (copie de um artigo
recente, ex. `blog-barboterapia.html`): datas visíveis, bloco `.practice-note` "Na cadeira",
bloco `.pharma-note` "Visão farmacêutica", fontes reais levantadas NA FONTE (PubMed/ANVISA, via
conector do PubMed) e citadas com DOI — nunca de memória. Tom: barbearia com conhecimento técnico,
nunca site médico; todo tema de saúde termina encaminhando ao dermatologista. Sem diagnóstico,
sem "tratamento" em sentido médico, sem "abre os poros". Entrar no `sitemap.xml`, receber pelo
menos um link de página existente (hub/pilar) e linkar de volta. Meta description, JSON-LD
Article, imagem com `alt`. Publicar e conferir no ar.

---

## Fecho

Um resumo só, no fim: o que ficou pronto e no ar (com versão), o que ficou em proposta, o que
precisa da mão do Juliano (item 1) e quanto tempo dele isso leva. Sem lista de arquivos, sem
jargão. Se algo não pôde ser conferido ao vivo, diga isso primeiro.

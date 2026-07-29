# Testes automatizados

## Rodando

```
npm install
npx playwright install chromium   # só na primeira vez
npm test                          # unitários (Vitest) + E2E seguros (Playwright)
npm run test:admin                # só as telas do admin (sem login, sem banco real)
```

Os testes E2E sobem o site localmente (`npx serve`) — não precisam do site publicado
no ar, mas os dados de agenda/horário vêm do Supabase de produção real (mesmo banco
do site ao vivo), porque é assim que o site funciona hoje.

## `tests/e2e/` — o que cada teste faz

- `routes.spec.js`, `cart.spec.js`, `booking-review.spec.js`: **não gravam nada** no
  banco. Preenchem o fluxo de agendamento até a tela de revisão e param antes de
  clicar em "Confirmar". Seguro rodar quantas vezes quiser.
- `booking-live.spec.js`: cria um agendamento **de verdade**, reagenda, cancela e
  apaga tudo no final. Só roda com `npm run test:e2e:live`, e só se
  `SUPABASE_SERVICE_ROLE_KEY` estiver definida no ambiente (senão pula
  automaticamente). Usa sempre o telefone fictício `5599900011234` — nunca dispara
  WhatsApp/e-mail de verdade pra ninguém.

Pra rodar o teste live localmente, crie um arquivo `.env` na raiz (ele já está no
`.gitignore`, nunca vai pro Git) com:

```
SUPABASE_SERVICE_ROLE_KEY=coloque_a_chave_aqui
```

A chave service_role fica em Supabase → Project Settings → API. **Nunca cole essa
chave em nenhum arquivo que vá pro GitHub.**

## `tests/e2e/admin/` — verificação do painel admin SEM login

Criado para que o painel admin (Barbearia OS) possa ser verificado de ponta a ponta
**de forma autônoma** — sem senha, sem conta de teste e sem tocar no banco real.

Como funciona (detalhes em `tests/e2e/admin/_supabase-mock.js`):

1. Uma **sessão falsa** é plantada no `localStorage` antes da página carregar — o
   supabase-js aceita a sessão no lado do cliente e as telas pulam a tela de login.
2. **Toda** requisição a `*.supabase.co` é interceptada pelo Playwright e respondida
   localmente com os dados fictícios de `_fixtures.js` (um mini-PostgREST que entende
   `eq/gte/lte/in/is/like`, `order` e `limit`). Nada sai para a internet: nenhum dado
   real é lido, nenhum push/e-mail/SMS é disparado.

O que cada arquivo faz:

- `admin-smoke.spec.js`: abre **todas as 12 telas** do admin, confere que a tela de
  login não aparece, que o app renderiza com os dados fictícios e que nenhum erro de
  JavaScript estoura no console. Salva um print inteiro de cada tela em
  `test-results/admin-screens/*.png` — prova visual de que nada bugou.
- `admin-relatorios.spec.js`: confere que os NÚMEROS dos Relatórios (faturamento,
  ticket médio, clientes, faltas, satisfação, ranking de serviços) batem com as
  contas esperadas a partir dos dados fictícios.

**Para quem for mexer no admin (inclusive o Claude em sessões futuras):** depois de
qualquer alteração em `admin-*.html`/`admin-*.js`, rode `npm run test:admin` e olhe
os prints em `test-results/admin-screens/`. Se criar tela ou consulta nova, adicione
a tabela/RPC em `_fixtures.js` e a página na lista de `admin-smoke.spec.js`. Para
testar uma interação específica (clicar em botão, preencher formulário), escreva um
spec novo usando `mockAdmin(page)` — as mutações (insert/update/delete) funcionam em
memória, então dá para clicar em tudo sem medo.

## `tests/unit/`

Testes de função pura (Vitest), sem navegador nem banco — testam os módulos em
`assets/js/*.js` importados pelo próprio site.

# Testes automatizados

## Rodando

```
npm install
npx playwright install chromium   # só na primeira vez
npm test                          # unitários (Vitest) + E2E seguros (Playwright)
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

## `tests/unit/`

Testes de função pura (Vitest), sem navegador nem banco — testam os módulos em
`assets/js/*.js` importados pelo próprio site.

# V26.5 — Reagendamento inteligente após cancelamento

## Publicação
1. Copie os arquivos para o repositório real e publique no GitHub.
2. Execute no SQL Editor: `database/migrations/026-v26-5-reagendamento-inteligente.sql`.
3. Na raiz do repositório, execute:

```cmd
npx.cmd supabase functions deploy admin-booking-status
npx.cmd supabase functions deploy booking-email
npx.cmd supabase functions deploy rebooking-context
npx.cmd supabase functions deploy create-rebooking
```

## Teste
Crie um agendamento com e-mail, cancele pelo painel admin e abra o botão **Escolher nova data e horário**. O link é válido por 30 dias e só pode ser usado uma vez.

# V26.3 — Diagnóstico do cancelamento pelo painel admin

Esta versão adiciona logs detalhados à Edge Function `admin-booking-status`.

## Publicação

Abra o Prompt de Comando dentro da pasta `site-main` e execute:

```cmd
npx.cmd supabase functions deploy admin-booking-status
```

Não é necessário publicar novamente `booking-email` e não há SQL para executar.

## Teste

1. Crie um agendamento com e-mail.
2. Cancele pelo painel administrativo.
3. Caso haja erro, abra Supabase > Edge Functions > admin-booking-status > Logs.
4. O log mostrará a etapa exata, como `booking_update`, e a mensagem do banco.

# Barbearia do Ju — V26.1 Zoho Self Client

Esta atualização consolida a Central de Comunicação usando o Self Client do Zoho.

## Já concluído

- migration `023-v26-email-central.sql` executada;
- Secrets do Zoho cadastrados;
- função `send-email` criada.

## Funções que devem estar publicadas

Deixe **Verify JWT desativado** nas quatro funções abaixo:

1. `send-email`
2. `booking-email`
3. `create-public-booking`
4. `manage-booking`

Publique/substitua cada função usando o respectivo arquivo `index.ts` deste pacote.

## Funções antigas do fluxo Server-based

As funções abaixo não são mais usadas:

- `zoho-oauth-start`
- `zoho-oauth-callback`

Elas podem permanecer publicadas, mas não serão chamadas. Se desejar, podem ser apagadas depois que os testes terminarem.

## Teste 1 — send-email

No PowerShell, execute o bloco abaixo. Ele pede o segredo sem gravá-lo no histórico do comando:

```powershell
$secret = Read-Host "Cole o EMAIL_WEBHOOK_SECRET"
$body = @{
  to = "contato@barbeariadoju.com.br"
  subject = "Teste da Central de Comunicação"
  html = "<h1>Barbearia do Ju</h1><p>Envio pelo Zoho e Supabase funcionando.</p>"
  event_type = "test"
  recipient_type = "test"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/send-email" `
  -ContentType "application/json" `
  -Headers @{ "x-webhook-secret" = $secret } `
  -Body $body
```

Resultado esperado: `ok = true`, e o e-mail chega em `contato@barbeariadoju.com.br`.

## Teste 2 — agendamento completo

1. Faça um novo agendamento no site e informe um e-mail seu.
2. O cliente deve receber a confirmação.
3. `contato@barbeariadoju.com.br` deve receber o aviso.
4. Confira `Table Editor → email_queue`: as duas linhas devem ter status `sent`.
5. Teste reagendamento e cancelamento pelo link Meu Agendamento.

## Segurança

Nunca publique ou envie em prints:

- `ZOHO_CLIENT_SECRET`;
- `ZOHO_REFRESH_TOKEN`;
- `EMAIL_WEBHOOK_SECRET`;
- `SUPABASE_SERVICE_ROLE_KEY`.

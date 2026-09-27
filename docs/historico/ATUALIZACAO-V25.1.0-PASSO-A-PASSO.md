# Atualização V25.1.0 — Meu Agendamento

## 1. GitHub
Substitua os arquivos pelo pacote completo e faça Commit/Push.

## 2. Supabase SQL Editor
Execute `database/migrations/021-v25-1-meu-agendamento.sql`.

## 3. Edge Functions
Publique novamente:
- `create-public-booking`
- `send-push`

Crie e publique:
- `manage-booking`

Não altere os segredos existentes. As funções usam `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `PUSH_WEBHOOK_SECRET`.

## 4. Teste
1. Faça um agendamento pelo site.
2. Clique em “Acompanhar ou alterar meu agendamento”.
3. Teste reagendamento e confirme o Push administrativo.
4. Teste cancelamento e confirme que o horário voltou a aparecer disponível.

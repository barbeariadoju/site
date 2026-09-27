# V26.2 — E-mail automático no cancelamento pelo painel admin

## O que mudou

Quando um agendamento é cancelado pela Agenda do painel administrativo:

- o status é alterado para `cancelled`;
- o horário é liberado;
- a Edge Function `booking-email` envia um aviso ao cliente;
- o painel informa se o e-mail foi enviado, se falhou ou se o cliente não possui e-mail cadastrado.

O texto informa que o cancelamento foi realizado pela Barbearia do Ju, e não “conforme solicitado pelo cliente”.

## 1. Publicar as Edge Functions

No terminal, dentro da pasta do projeto:

```bash
supabase functions deploy booking-email
supabase functions deploy admin-booking-status
```

A nova função usa as variáveis que já existem no projeto:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_WEBHOOK_SECRET`

Não é necessário criar tabela nem executar SQL.

## 2. Publicar o site

Envie ao GitHub os arquivos atualizados, principalmente:

- `admin-v15-4.js`
- páginas `admin*.html`
- `supabase/functions/booking-email/index.ts`
- `supabase/functions/admin-booking-status/index.ts`

## 3. Teste

1. Crie um agendamento de teste com um e-mail seu.
2. Abra `admin-agenda.html`.
3. Clique em **Cancelar**.
4. Confirme o cancelamento.
5. O painel deverá mostrar: **“Agendamento cancelado e e-mail enviado ao cliente.”**
6. Confira a caixa de entrada e também o spam.

Quando não houver e-mail cadastrado, o cancelamento continua normalmente e o painel avisa que não foi possível notificar por e-mail.

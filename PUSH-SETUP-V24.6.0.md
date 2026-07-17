# V24.6.0 — Notificações de novos agendamentos

Esta versão adiciona Web Push ao painel administrativo. O iPhone precisa abrir o painel pelo ícone adicionado à Tela de Início. No Android, use o painel instalado como aplicativo.

## 1. Publique o site

Substitua os arquivos no repositório, faça o commit e o Push origin.

## 2. Execute o SQL 018

No Supabase, abra **SQL Editor → New query**, copie o arquivo:

`database/migrations/018-push-notifications-v24-6.sql`

Clique em **Run**. O esperado é `Success. No rows returned`.

## 3. Crie a função send-push

No Supabase, abra **Edge Functions → Deploy a new function → Via Editor**.

Nome exato: `send-push`

Apague o exemplo e cole todo o conteúdo de:

`supabase/functions/send-push/index.ts`

Faça o deploy e desligue **Verify JWT with legacy secret**. A função valida internamente o login administrativo ou o segredo do webhook.

## 4. Cadastre os secrets

Abra **Edge Functions → Secrets** e crie:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `PUSH_WEBHOOK_SECRET`

Os valores estão no arquivo separado `V24.6.0-SECRETS-NAO-PUBLICAR.txt`, entregue junto com o ZIP. Esse arquivo não está dentro do projeto e não deve ser enviado ao GitHub.

## 5. Crie o Database Webhook

No Supabase, abra **Database → Webhooks → Create webhook**:

- Nome: `notify-new-booking`
- Tabela: `public.bookings`
- Evento: somente `INSERT`
- Tipo: Supabase Edge Function
- Função: `send-push`
- Header: `x-webhook-secret`
- Valor do header: use `PUSH_WEBHOOK_SECRET` do arquivo separado

Salve o webhook.

## 6. Ative no Android

1. Abra o painel instalado no Android.
2. Faça login.
3. Entre em **Notificações**.
4. Toque em **Ativar neste aparelho** e permita os avisos.
5. Toque em **Enviar notificação de teste**.

## 7. Ative no iPhone

1. Abra o painel no Safari.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra o painel pelo novo ícone, não por uma aba comum do Safari.
4. Faça login e entre em **Notificações**.
5. Toque em **Ativar neste aparelho** e permita os avisos.
6. Envie a notificação de teste.

O Apple Watch pode espelhar a notificação do iPhone conforme as configurações de notificações do relógio. O alerta mostrará cliente, data, horário e serviço; ao tocar, abrirá a agenda administrativa.

## Observação

Na primeira entrega, a confirmação continua sendo feita no painel após tocar na notificação. Ações diretas dentro da notificação poderão ser adicionadas depois, após validar Android, iPhone e Apple Watch.

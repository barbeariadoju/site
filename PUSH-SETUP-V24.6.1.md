# V24.6.1 — Instalação das notificações

## O que esta versão entrega

- Android da barbearia: push mesmo com o PWA fechado.
- iPhone pessoal: push no app adicionado à Tela de Início.
- Apple Watch: pode espelhar o aviso recebido pelo iPhone.
- PC da barbearia: notificação do Chrome/Edge e som padrão do Windows.
- Painel aberto no PC: campainha curta adicional.
- Um mesmo agendamento é enviado a todos os aparelhos ativos.

## Situação de quem já instalou a V24.6.0

Se o SQL 018 e a função `send-push` já foram criados, não repita essas duas etapas.
Publique este ZIP para receber o refinamento do PC e siga a partir dos Secrets.

## 1. Publicar o site

Substitua os arquivos no repositório e publique:

`V24.6.1 - Notificações no PC, Android e iPhone`

Depois aguarde a publicação e faça uma atualização forçada no PC.

## 2. SQL 018

Execute somente se ainda não executou:

`database/migrations/018-push-notifications-v24-6.sql`

Resultado esperado: `Success. No rows returned`.

## 3. Edge Function

Crie ou atualize a função:

`send-push`

Código:

`supabase/functions/send-push/index.ts`

Em Settings, deixe `Verify JWT with legacy secret` desligado.

## 4. Secrets

Em Edge Functions → Secrets, cadastre três linhas separadas.
Os valores ficam no arquivo privado entregue fora do ZIP:

- Name: `VAPID_PUBLIC_KEY`
- Name: `VAPID_PRIVATE_KEY`
- Name: `PUSH_WEBHOOK_SECRET`

Não coloque o arquivo privado no GitHub.

## 5. Database Webhook

Crie um webhook:

- Name: `notify-new-booking`
- Table: `public.bookings`
- Event: `INSERT`
- Type: Supabase Edge Function
- Function: `send-push`
- Header name: `x-webhook-secret`
- Header value: o mesmo valor de `PUSH_WEBHOOK_SECRET`

## 6. Ativar no PC

1. Abra o painel no Chrome ou Edge.
2. Faça login.
3. Abra `Notificações`.
4. Clique em `Ativar neste aparelho`.
5. Permita as notificações.
6. Clique em `Enviar notificação de teste`.
7. No Windows, confirme que notificações e sons do navegador estão permitidos.

A campainha interna do painel é liberada pelo mesmo clique de ativação.

## 7. Ativar no Android

1. Abra o painel instalado.
2. Entre em `Notificações`.
3. Toque em `Ativar neste aparelho`.
4. Autorize e envie o teste.

## 8. Ativar no iPhone

1. Abra o painel no Safari.
2. Compartilhar → Adicionar à Tela de Início.
3. Abra pelo ícone instalado.
4. Entre em `Notificações`.
5. Toque em `Ativar neste aparelho`.
6. Autorize e envie o teste.

## 9. Teste real

Faça um agendamento público de teste. O aviso deverá chegar em todos os aparelhos
que aparecem como ativos.

## Observações

- O som personalizado só toca quando alguma página do painel está aberta no PC.
- Com o painel fechado, o Chrome/Edge usa o som padrão de notificação do Windows.
- iPhone e Android usam os sons/vibrações definidos pelo sistema.
- O Apple Watch normalmente mostra o aviso quando está no pulso e o iPhone está bloqueado.

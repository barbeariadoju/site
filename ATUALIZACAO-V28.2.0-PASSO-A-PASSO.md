# V28.2.0 — Status real de entrega, alerta de saldo SMSDev e fallback cruzado

O que muda:

- O painel deixa de mostrar só "Enviado" pro SMS — agora mostra se foi **entregue de verdade** no celular (via consulta DLR na SMSDev) ou se falhou.
- Quando o saldo de créditos da SMSDev fica abaixo de 100, chega um e-mail de aviso em `contato@barbeariadoju.com.br`.
- Se a entrega do SMS falhar e o cliente também tiver e-mail cadastrado, o sistema tenta mandar por e-mail automaticamente (e vice-versa, se o e-mail falhar na hora do envio).
- Nova aba "SMS automáticos" na Central de Comunicação (`admin-mensagens.html`), junto com o saldo atual da SMSDev.

Diferente das versões anteriores, esta foi publicada com deploy automatizado (Supabase CLI + Management API) em vez de colar manualmente no painel — não é necessário repetir passos manuais no Supabase, a não ser que o deploy automatizado falhe por algum motivo (nesse caso, publique a Edge Function `notifications-watchdog` e a `booking-email` atualizada manualmente pelo painel, e rode `database/migrations/030-v28.2.0-status-fallback.sql` no SQL Editor).

## Nenhum secret novo

Reaproveita `SMSDEV_API_KEY` e `EMAIL_WEBHOOK_SECRET`, já cadastrados desde a V28.1.0/V26.0.

## Cron

Um novo job `bdj-notifications-watchdog` roda a cada 15 minutos, chamando a Edge Function `notifications-watchdog` — mesmo padrão do job `bdj-reminder-24h` já existente (migration `025-v26-4-agendar-cron-template.sql`), reaproveitando o mesmo secret já salvo no Vault.

## Testar

1. Abra `admin-mensagens.html`, aba **SMS automáticos** — deve aparecer o saldo atual da SMSDev no topo.
2. Espere o cron rodar (até 15 min) ou chame `notifications-watchdog` manualmente com o `x-webhook-secret` — o retorno mostra quantos SMS foram checados e o saldo lido.
3. Faça um agendamento de teste sem e-mail: confirme que o SMS aparece na aba, e depois de alguns minutos o status muda de "Aguardando confirmação" para "Entregue".

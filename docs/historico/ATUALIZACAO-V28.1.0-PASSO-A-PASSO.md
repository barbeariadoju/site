# V28.1.0 — Confirmação por SMS para quem não informa e-mail

O que muda: quando o cliente **não preenche e-mail** no agendamento (mas o telefone, que é sempre obrigatório), a confirmação, o reagendamento, o cancelamento e o lembrete de 24h passam a ser enviados por **SMS** em vez de simplesmente não serem enviados. Quem preenche e-mail continua recebendo por e-mail, sem mudança.

## Antes de começar: criar a conta na SMSDev

1. Acesse **https://painel.smsdev.com.br/criar-conta** e crie sua conta (é grátis; você recebe créditos de teste para homologação e só paga pelos SMS que enviar/receber de verdade).
2. Depois de logar, acesse **https://painel.smsdev.com.br/configuracao/conta/perfil** e copie o valor de **Key**. Esse é o valor de `SMSDEV_API_KEY`.

Guarde essa chave com cuidado — ela não deve ir para o GitHub.

## Ordem obrigatória de instalação

### 1. Executar a migration

No Supabase, abra **SQL Editor → New query**. Cole e execute todo o arquivo:

`database/migrations/028-v28-1-0-sms-fallback.sql`

Resultado esperado: **Success. No rows returned**.

### 2. Publicar a nova Edge Function

No Supabase, abra **Edge Functions** e crie/publique, com o conteúdo do arquivo:

`supabase/functions/send-sms/index.ts`

> Deixe a verificação de JWT desativada, assim como nas outras funções internas (a proteção é feita pelo `x-webhook-secret`).

### 3. Substituir as Edge Functions atualizadas

Substitua o conteúdo e publique novamente:

1. `booking-email`
2. `booking-reminder-24h`

### 4. Cadastrar o novo Secret no Supabase

Abra **Edge Functions → Secrets** e cadastre:

- `SMSDEV_API_KEY` = a Key copiada do painel da SMSDev

Não altere os Secrets já existentes (`EMAIL_WEBHOOK_SECRET`, os do Zoho, etc.) — a função de SMS reaproveita o `EMAIL_WEBHOOK_SECRET` já existente para autenticar as chamadas internas entre funções, então nenhum segredo novo de webhook é necessário.

### 5. Testar

Faça um agendamento novo **sem preencher e-mail**, preenchendo apenas o telefone. O resultado esperado é:

- agendamento criado normalmente;
- Push recebido (sem mudança);
- o celular usado recebe um SMS de confirmação da Barbearia do Ju;
- uma linha aparece em `sms_queue` com status `sent`.

Depois teste um agendamento **com e-mail preenchido** para confirmar que continua chegando por e-mail, sem SMS duplicado.

Por fim, se quiser confirmar o lembrete de 24h, pode aguardar a execução automática do cron ou testar manualmente chamando a função `booking-reminder-24h`.

## Segurança

Nunca coloque no GitHub:

- `SMSDEV_API_KEY`

Esse valor fica apenas em **Supabase Edge Functions → Secrets**.

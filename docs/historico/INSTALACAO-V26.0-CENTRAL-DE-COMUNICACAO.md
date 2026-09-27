# Barbearia do Ju — V26.0 Central de Comunicação

Esta versão prepara e integra os e-mails automáticos pelo Zoho Mail:

- confirmação para o cliente (quando informou e-mail);
- confirmação para `contato@barbeariadoju.com.br`;
- reagendamento para cliente e barbearia;
- cancelamento para cliente e barbearia;
- fila e histórico em `email_queue`;
- OAuth oficial do Zoho, com refresh token;
- o agendamento continua funcionando mesmo se o e-mail falhar.

## Ordem obrigatória de instalação

### 1. Executar a migration

No Supabase, abra **SQL Editor → New query**. Cole e execute todo o arquivo:

`database/migrations/023-v26-email-central.sql`

Resultado esperado: **Success. No rows returned**.

### 2. Publicar as quatro novas Edge Functions

No Supabase, abra **Edge Functions** e crie/publique, com o conteúdo de cada `index.ts`:

1. `zoho-oauth-start`
2. `zoho-oauth-callback`
3. `send-email`
4. `booking-email`

Depois substitua e publique novamente:

5. `create-public-booking`
6. `manage-booking`

> Em todas essas funções, deixe a verificação de JWT desativada, pois a proteção interna é feita por segredo e/ou token do agendamento.

### 3. Criar o cliente no Zoho API Console

Tipo: **Server-based Applications**

- Client Name: `Barbearia do Ju Sistema`
- Homepage URL: `https://www.barbeariadoju.com.br`
- Authorized Redirect URI:
  `https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/zoho-oauth-callback`

Clique no `+`, depois em **CREATE**.

Guarde o Client ID e Client Secret. Não publique essas informações.

### 4. Cadastrar os primeiros Secrets no Supabase

Abra **Edge Functions → Secrets** e cadastre:

- `ZOHO_CLIENT_ID` = Client ID mostrado pelo Zoho
- `ZOHO_CLIENT_SECRET` = Client Secret mostrado pelo Zoho
- `ZOHO_REDIRECT_URI` = `https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/zoho-oauth-callback`
- `ZOHO_OAUTH_STATE` = uma frase aleatória longa, sem espaços, criada por você
- `ZOHO_SETUP_KEY` = outra frase aleatória longa, diferente da anterior
- `EMAIL_WEBHOOK_SECRET` = outra frase aleatória longa, diferente das anteriores
- `ZOHO_ACCOUNTS_BASE_URL` = `https://accounts.zoho.com`
- `ZOHO_MAIL_BASE_URL` = `https://mail.zoho.com`

Não altere os Secrets já existentes do Push ou do Supabase.

### 5. Autorizar o Zoho

Abra no navegador, trocando `SUA_CHAVE_DE_CONFIGURACAO` pelo valor de `ZOHO_SETUP_KEY`:

`https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/zoho-oauth-start?setup_key=SUA_CHAVE_DE_CONFIGURACAO`

Entre na conta Zoho que administra `contato@barbeariadoju.com.br` e clique em **Accept/Aceitar**.

A tela final mostrará:

- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ACCOUNT_ID`
- `ZOHO_FROM_ADDRESS`

Copie esses três valores para **Edge Functions → Secrets**. O endereço esperado é `contato@barbeariadoju.com.br`.

### 6. Publicar os arquivos do site

Suba todo o conteúdo da pasta `site-main` para o repositório do site, mantendo a estrutura atual.

### 7. Testar

Faça um agendamento novo preenchendo um e-mail seu. O resultado esperado é:

- agendamento criado normalmente;
- Push recebido;
- cliente recebe o e-mail de confirmação;
- `contato@barbeariadoju.com.br` recebe o aviso;
- duas linhas aparecem em `email_queue` com status `sent`.

Depois teste reagendamento e cancelamento pelo link **Meu Agendamento**.

## Segurança

Nunca coloque no GitHub:

- Client Secret;
- Refresh Token;
- Service Role Key;
- `EMAIL_WEBHOOK_SECRET`;
- `ZOHO_SETUP_KEY`;
- `ZOHO_OAUTH_STATE`.

Esses valores ficam apenas em **Supabase Edge Functions → Secrets**.

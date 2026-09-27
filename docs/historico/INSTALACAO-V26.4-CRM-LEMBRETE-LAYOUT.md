# Barbearia do Ju — Instalação V26.4

Esta versão inclui:

- botão **Escolher nova data e horário** no e-mail de cancelamento;
- Edge Function `booking-reminder-24h`;
- proteção contra lembrete duplicado;
- histórico de e-mails na Central de Comunicação;
- refinamentos responsivos no painel administrativo;
- mensagens de ação mais amigáveis e botões com estado de carregamento.

## 1. Atualizar o repositório

Copie todo o conteúdo desta versão para a pasta real do repositório do GitHub Desktop, substituindo os arquivos existentes. Depois faça commit e push.

## 2. Executar o SQL principal

No SQL Editor do Supabase, execute:

`database/migrations/024-v26-4-crm-reminder.sql`

Este SQL amplia os tipos da fila, evita lembretes repetidos e concede as permissões internas necessárias.

## 3. Publicar as funções

Abra o CMD/PowerShell na raiz do repositório real e execute:

```cmd
npx.cmd supabase functions deploy booking-email
npx.cmd supabase functions deploy booking-reminder-24h
```

## 4. Testar manualmente a função

No Supabase, abra Edge Functions > `booking-reminder-24h` > Test.

Método: POST

Header:

```text
x-webhook-secret: O_MESMO_VALOR_DE_EMAIL_WEBHOOK_SECRET
```

Body:

```json
{}
```

A função procura agendamentos com e-mail entre 23h30 e 24h30 à frente. Quando não houver candidatos, retornar zero é normal.

## 5. Ativar execução automática

Abra `database/migrations/025-v26-4-agendar-cron-template.sql` e substitua:

```text
COLE_AQUI_O_EMAIL_WEBHOOK_SECRET
```

pelo valor real do secret `EMAIL_WEBHOOK_SECRET`. Depois execute o SQL no Supabase.

A verificação ocorrerá a cada 15 minutos. O segredo ficará protegido no Supabase Vault e não será colocado no JavaScript público.

## 6. Conferência final

- Abra `admin-mensagens.html` e clique em **E-mails automáticos**.
- Confirme que aparecem confirmações, cancelamentos e demais envios existentes.
- Teste o painel pelo computador e celular.
- Cancele um agendamento de teste e confira o novo botão de reagendamento no e-mail.

## Observação

O arquivo `025-v26-4-agendar-cron-template.sql` não deve ser executado sem substituir o texto de exemplo pelo segredo real.

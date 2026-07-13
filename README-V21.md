# Barbearia OS V21

Versão consolidada para publicação única.

## Incluído
- Auditoria e limpeza das versões anteriores.
- PWA administrativo para iOS e Android.
- Agenda, CRM, bloqueios, remarcação, ausências e retorno.
- JuIA administrativa.
- JuIA no site com atendimento humano como alternativa.
- Venda consultiva de serviços e produtos no chat.
- Fidelidade digital automática: 10 cortes concluídos geram 1 recompensa.
- Fila segura para futuros e-mails automáticos.
- Base preparada para WhatsApp oficial e Google Agenda.

## Publicação
Publique todo o conteúdo na raiz do repositório, preservando apenas a pasta `.git` do clone local.

## Banco
Execute, nesta ordem, apenas as migrações que ainda não tiver executado. Para esta versão nova, execute obrigatoriamente:

`database/migrations/013-barbearia-os-v21.sql`

## Edge Functions
- `ju-ia-admin`: já existente.
- `ju-ia-site`: crie ou substitua pelo arquivo em `supabase/functions/ju-ia-site/index.ts`.
- Verify JWT legacy: OFF.

## E-mail
A V21 cria a fila `email_outbox`, mas não dispara e-mails até a configuração de um provedor transacional. Isso evita prometer envio antes de o SMTP/API estar configurado.

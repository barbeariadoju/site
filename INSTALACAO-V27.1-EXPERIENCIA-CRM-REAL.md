# V27.1 — Experiência pós-atendimento + CRM inteligente

## 1. Publicar os arquivos
Substitua os arquivos do repositório pelos deste pacote e faça commit/push pelo GitHub Desktop.

## 2. Executar o SQL
No Supabase > SQL Editor, abra e execute:

`database/migrations/027-v27-1-experiencia-crm-real.sql`

## 3. Publicar a Edge Function
No terminal, na raiz do projeto:

```cmd
npx.cmd supabase functions deploy satisfaction-dispatch --no-verify-jwt
```

A opção `--no-verify-jwt` é necessária porque o Cron chamará a função com o segredo próprio.

## 4. Criar o Cron
Supabase > Integrations > Cron > Create job.

- Nome: `Satisfaction Dispatch`
- Schedule: `*/15 * * * *` (a cada 15 minutos)
- Type: `Supabase Edge Function`
- Method: `POST`
- Edge Function: `satisfaction-dispatch`
- Timeout: `10000`
- Header: `x-webhook-secret` = o mesmo conteúdo do secret `EMAIL_WEBHOOK_SECRET`
- Body: `{}`

Depois clique em **Create cron job**.

## 5. Teste rápido sem esperar 2 horas
1. Crie um agendamento com e-mail real.
2. Marque o atendimento como concluído.
3. Execute no SQL Editor:

```sql
update public.experience_requests
set scheduled_for=now(), status='pending', last_error=null
where booking_id=(select id from public.bookings order by updated_at desc limit 1);
```

4. Em Edge Functions > satisfaction-dispatch, use **Test** com método POST, body `{}` e header `x-webhook-secret`.
5. Abra o e-mail e teste as duas rotas da página.

## Resultado
- Pesquisa agendada automaticamente 2 horas após conclusão.
- Cliente satisfeito recebe convite delicado para avaliar no Google.
- Cliente com sugestão envia mensagem privada.
- CRM mostra Ju Score, ticket médio, inatividade, sugestões e cliques em avaliação.

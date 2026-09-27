# V27.1 — CRM Premium + experiência pós-atendimento

Esta versão inclui código real para:

- pesquisa de satisfação automática 2 horas após concluir o atendimento;
- caminho satisfeito → convite para avaliação no Google;
- caminho sugestão → feedback privado dentro do CRM;
- linha do tempo do cliente;
- Ju Score de 0 a 100;
- classificação Bronze, Silver, Gold e Platinum;
- cálculo de ticket médio, frequência e retorno previsto;
- identificação de clientes inativos;
- resumo CRM Premium no painel de clientes.

## 1. Publicar os arquivos

Substitua os arquivos do repositório pelos desta versão e faça commit/push.

## 2. Executar o SQL

No Supabase > SQL Editor, execute:

`database/migrations/027-v27-1-crm-premium-experiencia.sql`

## 3. Fazer o deploy

Na raiz do projeto:

```cmd
npx.cmd supabase functions deploy satisfaction-dispatch
```

A função `send-email` já utilizada pelo sistema precisa continuar publicada.

## 4. Agendar a execução automática

No Supabase > Integrations > Cron, crie um agendamento a cada hora para chamar:

`https://SEU-PROJETO.supabase.co/functions/v1/satisfaction-dispatch`

Método: POST

Header:

`x-webhook-secret: o mesmo valor de EMAIL_WEBHOOK_SECRET`

Também pode testar imediatamente pelo terminal:

```cmd
curl -X POST "https://SEU-PROJETO.supabase.co/functions/v1/satisfaction-dispatch" -H "x-webhook-secret: SEU_SEGREDO"
```

## 5. Teste completo

1. Crie um agendamento com e-mail.
2. Marque como concluído.
3. Para não esperar 2 horas, execute no SQL Editor:

```sql
update public.experience_requests
set scheduled_for=now()
where booking_id=(select id from public.bookings order by updated_at desc limit 1);
```

4. Execute `satisfaction-dispatch`.
5. Abra o e-mail e escolha uma das respostas.
6. Confira o painel `CRM / Clientes`.

## Observação importante

O sistema não pede cinco estrelas nem condiciona benefício a uma avaliação. Primeiro pergunta de forma neutra se o cliente ficou satisfeito ou se deseja enviar uma sugestão. Apenas o cliente satisfeito recebe o convite para compartilhar sua experiência no Google.

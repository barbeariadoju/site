# Atualização V25.1.1 — Hotfix “Meu Agendamento”

## 1. Supabase SQL Editor
Execute o arquivo:

`database/migrations/022-v25-1-1-fix-management-link.sql`

## 2. Edge Functions
Abra a função `create-public-booking`, substitua todo o código pelo arquivo:

`supabase/functions/create-public-booking/index.ts`

Depois publique/deploy novamente.

## 3. GitHub
Não há alteração visual obrigatória nesta correção. Para manter o repositório completo e documentado, envie os arquivos alterados e faça Commit/Push.

## 4. Teste
Crie um agendamento novo. Em seguida execute:

```sql
select customer_name, booking_code, management_token_hash
from public.bookings
order by created_at desc
limit 1;
```

`booking_code` e `management_token_hash` devem estar preenchidos. O botão “Acompanhar ou alterar meu agendamento” deve abrir normalmente.

Agendamentos antigos com esses campos nulos não ganham um link retroativamente. Faça o teste com um agendamento novo.

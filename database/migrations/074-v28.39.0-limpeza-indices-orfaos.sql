-- Reavaliação dos índices "unused" apontados pelos advisors (pedido do Juliano, 2026-08-02).
-- A maioria é índice legítimo de suporte a FK/consulta em tabela de baixo tráfego (negócio
-- pequeno) — não vale dropar precocemente, mesmo raciocínio da auditoria anterior (28.29.1).
-- Dois casos, porém, são genuinamente órfãos, não só "baixo tráfego":

-- 1) email_outbox é uma fila morta da v21 (migration 013): a trigger v21_queue_booking_email
--    ainda grava nela a cada INSERT/mudança de status em bookings, mas nenhuma edge function
--    lê essa tabela desde que o envio real de e-mail migrou pra email_queue (usada por
--    booking-email/send-email/notifications-watchdog/booking-reminder-24h). Confirmado: as
--    40 linhas existentes estão TODAS com status='pending', nunca processadas. Cliente não
--    perde e-mail nenhum (o envio real acontece pelo caminho email_queue) — é só overhead
--    de escrita a cada agendamento e uma tabela que só cresce sem propósito.
drop trigger if exists bookings_v21_email_queue on public.bookings;
drop function if exists public.v21_queue_booking_email();
drop table if exists public.email_outbox;

-- 2) bookings_customer_phone_idx nunca pode ser usado: toda consulta de telefone no banco
--    usa regexp_replace(customer_phone,...) ou phone_match_key(), nunca a coluna crua —
--    confirmado varrendo todas as migrations. Um índice btree simples na coluna não serve
--    pra filtro por função da coluna, então este é órfão por design, não por baixo volume.
drop index if exists public.bookings_customer_phone_idx;

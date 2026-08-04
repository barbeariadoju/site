-- 081-v28.48.3: guardas no fluxo de confirmação de presença (bug real, 2026-08-04).
-- (aplicada no banco via MCP com o nome interno "079_v28_48_3_confirmation_guards")
--
-- Caso Guilherme (2026-08-04): agendamento criado às 11:14 pra 12:00 foi pego pelo cron
-- das 11:15 — pedido de confirmação e AUTO-CANCELAMENTO no mesmo minuto (7 segundos
-- depois de criar). O cliente recebeu "confirmado" → "confirma presença?" → "liberamos
-- seu horário" em 3 segundos. Restaurado manualmente na hora; lead marcado pra aviso de
-- "vaga reaberta" desarmado antes do cron seguinte.
--
-- Guarda 1 (request): só pedir confirmação a quem agendou há 3h+ — quem acabou de
-- agendar já confirmou por definição.
-- Guarda 2 (deadline): só auto-cancelar se o pedido de confirmação foi enviado há
-- 90min+ — garante tempo real de resposta mesmo se o cron atrasar o pedido.
-- Mesmas assinaturas → create or replace puro, grants preservados.

create or replace function public.bookings_due_for_confirmation_request(p_within_minutes integer)
 returns table(id uuid, customer_name text, customer_phone text, booking_date date, start_time time without time zone, service_name text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select b.id, b.customer_name, b.customer_phone, b.booking_date, b.start_time, b.service_name
  from public.bookings b
  where b.status = 'confirmed'
    and b.confirmation_requested_at is null
    and b.created_at < now() - interval '3 hours'
    and (b.booking_date::timestamp + b.start_time::time) > timezone('America/Sao_Paulo', now())
    and (b.booking_date::timestamp + b.start_time::time) <= timezone('America/Sao_Paulo', now()) + make_interval(mins => p_within_minutes)
  order by b.booking_date, b.start_time
$function$;

create or replace function public.bookings_due_for_confirmation_deadline(p_within_minutes integer)
 returns table(id uuid, customer_name text, customer_phone text, booking_date date, start_time time without time zone, service_name text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select b.id, b.customer_name, b.customer_phone, b.booking_date, b.start_time, b.service_name
  from public.bookings b
  where b.status = 'confirmed'
    and b.confirmation_requested_at is not null
    and b.confirmation_requested_at < now() - interval '90 minutes'
    and b.confirmed_at is null
    and (b.booking_date::timestamp + b.start_time::time) > timezone('America/Sao_Paulo', now())
    and (b.booking_date::timestamp + b.start_time::time) <= timezone('America/Sao_Paulo', now()) + make_interval(mins => p_within_minutes)
  order by b.booking_date, b.start_time
$function$;

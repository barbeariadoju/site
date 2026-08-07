-- 095 — v28.66.0 — NUNCA cancelar agendamento por falta de confirmação (decisão do Juliano, 07/08/2026)
--
-- Mudança de política, não de implementação: até aqui, se o cliente não respondesse ao
-- pedido de confirmação até 1h antes, o sistema LIBERAVA a vaga sozinho. Isso partia do
-- princípio de que silêncio = desistência, o que é falso na prática — gente que ia comparecer
-- perdia o horário por não ter visto uma mensagem no WhatsApp. Já tinha causado estrago real
-- (caso Guilherme, 04/08: cancelado 7 segundos depois de criado).
--
-- Nova regra: silêncio MANTÉM o agendamento. Se o cliente não respondeu no WhatsApp, o
-- sistema insiste por outros canais (SMS e e-mail, quando houver e-mail cadastrado) e o
-- horário continua de pé. Só cancela quando o cliente pede explicitamente para cancelar.
--
-- Para isso a consulta do prazo deixa de ser "quem vou cancelar" e passa a ser "quem ainda
-- não respondeu e merece um lembrete por outro canal". Precisa de duas coisas novas:
--   1) o e-mail do cliente (pra saber se dá pra mandar e-mail);
--   2) uma marca de que o reforço já saiu — senão o cron reenviaria SMS a cada rodada,
--      virando spam (e SMS é pago).

alter table public.bookings
  add column if not exists confirmation_fallback_sent_at timestamptz;

comment on column public.bookings.confirmation_fallback_sent_at is
  'Quando saiu o lembrete por SMS/e-mail para quem não respondeu a confirmação no WhatsApp. Impede reenvio a cada rodada do cron. Nunca implica cancelamento.';

-- Assinatura igual (mesmo nome e parâmetro), então CREATE OR REPLACE basta — mas o
-- RETURNS TABLE muda, e o Postgres exige DROP quando o tipo de retorno é alterado.
drop function if exists public.bookings_due_for_confirmation_deadline(integer);

create or replace function public.bookings_due_for_confirmation_deadline(p_within_minutes integer)
returns table(
  id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  booking_date date,
  start_time time without time zone,
  service_name text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select b.id, b.customer_name, b.customer_phone, b.customer_email, b.booking_date, b.start_time, b.service_name
  from public.bookings b
  where b.status = 'confirmed'
    and b.confirmation_requested_at is not null
    -- janela mínima de resposta preservada (guarda criada na v28.48.3 depois do caso Guilherme)
    and b.confirmation_requested_at < now() - interval '90 minutes'
    and b.confirmed_at is null
    -- o reforço por SMS/e-mail sai UMA vez só por agendamento
    and b.confirmation_fallback_sent_at is null
    and (b.booking_date::timestamp + b.start_time::time) > timezone('America/Sao_Paulo', now())
    and (b.booking_date::timestamp + b.start_time::time) <= timezone('America/Sao_Paulo', now()) + make_interval(mins => p_within_minutes)
  order by b.booking_date, b.start_time
$function$;

comment on function public.bookings_due_for_confirmation_deadline(integer) is
  'Agendamentos cujo cliente nao respondeu a confirmacao no WhatsApp e que merecem lembrete por SMS/e-mail. NAO e mais lista de cancelamento: desde a v28.66.0 falta de confirmacao nunca cancela.';

create or replace function public.mark_confirmation_fallback_sent(p_booking_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.bookings
     set confirmation_fallback_sent_at = now(),
         updated_at = now()
   where id = p_booking_id
     and confirmation_fallback_sent_at is null;
$function$;

revoke all on function public.bookings_due_for_confirmation_deadline(integer) from public;
revoke all on function public.bookings_due_for_confirmation_deadline(integer) from anon;
grant execute on function public.bookings_due_for_confirmation_deadline(integer) to service_role;

revoke all on function public.mark_confirmation_fallback_sent(uuid) from public;
revoke all on function public.mark_confirmation_fallback_sent(uuid) from anon;
grant execute on function public.mark_confirmation_fallback_sent(uuid) to service_role;

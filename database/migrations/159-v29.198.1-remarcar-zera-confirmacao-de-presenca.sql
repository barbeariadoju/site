-- v29.198.1 (17/09/2026) — Remarcar zera o pedido de confirmação de presença.
--
-- Caso Levi Aparecido (print do Juliano, 17/09 11h50): horário de 10/09 às 16h, confirmado pela
-- JuIA em 09/09. No dia 10 o Juliano remarcou na mão pelo painel pra 17/09 às 16h. No dia 16 o
-- robô das confirmações (whatsapp-booking-confirmation) NÃO pediu confirmação — o Juliano teve
-- que mandar "passando pra confirmar seu horário hoje às 16hs" ele mesmo.
--
-- Causa: nenhum dos três caminhos de remarcação (admin_reschedule_booking, phone_reschedule_booking
-- da JuIA, customer_reschedule_booking_v25 do link do site) zera confirmation_requested_at /
-- confirmed_at / confirmation_fallback_sent_at. O agendamento carrega o "já pedi, já confirmou" da
-- DATA ANTIGA, e bookings_due_for_confirmation_request exige confirmation_requested_at nulo — então
-- pula. Conferido no banco: Levi era o único futuro nessa situação hoje; mas todo remarcado pra
-- mais de um dia à frente cairia nisso.
--
-- Correção num lugar só: trigger BEFORE UPDATE em bookings. Mudou data ou hora e o agendamento
-- segue vivo (pending/confirmed) → zera os três campos, marca rescheduled_at. Se o horário novo é
-- em até 36 h, confirmed_at = agora (quem acabou de combinar o horário — JuIA, site ou o Juliano —
-- já confirmou presença de fato; o robô não deve perguntar de novo); mais longe que isso fica nulo e
-- o pedido do dia anterior volta a valer. A janela de 36 h é a mesma que a função de seleção já usa
-- pra "agendamento recém-criado não recebe pedido"; ela passa a olhar também o rescheduled_at, pra
-- um remarcado pra amanhã não ganhar pedido por ter created_at antigo.

create or replace function public.bookings_reset_confirmation_on_reschedule()
returns trigger language plpgsql set search_path = public as $$
declare
  v_start timestamp;
  v_now   timestamp := timezone('America/Sao_Paulo', now());
begin
  if (new.booking_date is distinct from old.booking_date or new.start_time is distinct from old.start_time)
     and new.status in ('pending', 'confirmed') then
    new.rescheduled_at := now();
    new.confirmation_requested_at := null;
    new.confirmation_fallback_sent_at := null;
    v_start := new.booking_date::timestamp + new.start_time::time;
    new.confirmed_at := case when v_start <= v_now + interval '36 hours' then now() else null end;
  end if;
  return new;
end $$;

drop trigger if exists trg_bookings_reset_confirmation_on_reschedule on public.bookings;
create trigger trg_bookings_reset_confirmation_on_reschedule
  before update of booking_date, start_time on public.bookings
  for each row execute function public.bookings_reset_confirmation_on_reschedule();

create or replace function public.bookings_due_for_confirmation_request(p_within_minutes integer)
returns table(id uuid, customer_name text, customer_phone text, booking_date date, start_time time without time zone, service_name text)
language sql stable security definer set search_path = public as $$
  select b.id, b.customer_name, b.customer_phone, b.booking_date, b.start_time, b.service_name
  from public.bookings b
  where b.status = 'confirmed'
    and b.confirmation_requested_at is null
    and greatest(b.created_at, coalesce(b.rescheduled_at, b.created_at)) < now() - interval '3 hours'
    and greatest(b.created_at, coalesce(b.rescheduled_at, b.created_at)) <= timezone('America/Sao_Paulo', (b.booking_date::timestamp + b.start_time::time)) - interval '36 hours'
    and (b.booking_date::timestamp + b.start_time::time) > timezone('America/Sao_Paulo', now())
    and (b.booking_date::timestamp + b.start_time::time) <= timezone('America/Sao_Paulo', now()) + make_interval(mins => p_within_minutes)
  order by b.booking_date, b.start_time
$$;

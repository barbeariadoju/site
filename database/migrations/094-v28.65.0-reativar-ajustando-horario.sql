-- 094 — v28.65.0 — Reativar agendamento cancelado ESCOLHENDO outro horário (caso Moisés, 06/08/2026)
--
-- Caso real: o agendamento cancelado do Moisés era hoje 18:00–18:50 (Corte + Barba Express,
-- 50 min). Reativar era recusado com 'horario_ocupado' porque, nesse meio tempo, o André
-- entrou das 17:00 às 18:15 — sobreposição de 15 minutos. A única saída oferecida pela UI
-- era "use Novo retorno pra achar outro horário", ou seja: criar um agendamento do zero e
-- perder o registro original (histórico, origem, produtos, observações).
--
-- Pedido do Juliano: "falta uma opção de eu ajustar o horário; ajustando o horário eu
-- consigo reativar". É exatamente isso — a data/hora passam a ser opcionais na reativação.
--
-- GOTCHA (documentado no projeto): CREATE OR REPLACE com lista de parâmetros diferente cria
-- uma SOBRECARGA nova em vez de substituir, e a chamada de 1 argumento vira ambígua. Por
-- isso a assinatura antiga é derrubada ANTES. Como os parâmetros novos têm DEFAULT, a
-- chamada existente `admin_reactivate_booking(p_booking_id => ...)` continua valendo.
drop function if exists public.admin_reactivate_booking(uuid);

create or replace function public.admin_reactivate_booking(
  p_booking_id uuid,
  p_new_date date default null,
  p_new_start_time time default null
)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_date date;
  v_start time;
  v_end time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_booking.status <> 'cancelled' then raise exception 'Só agendamento cancelado pode ser reativado.'; end if;

  -- Sem parâmetro novo, reativa no horário original (comportamento da v28.60.0 intacto).
  v_date  := coalesce(p_new_date, v_booking.booking_date);
  v_start := coalesce(p_new_start_time, v_booking.start_time);
  v_end   := v_start + make_interval(mins => v_booking.duration_minutes);

  if (v_date + v_start) <= v_now_sp then
    raise exception 'Esse horário já passou — escolha um horário futuro.';
  end if;

  -- Colisão e bloqueio continuam inegociáveis: reativar por cima de outro cliente criaria
  -- agendamento duplo, que é pior do que não reativar.
  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date = v_date
      and (s.all_day or (v_start < s.end_time and v_end > s.start_time))
  ) then raise exception 'horario_ocupado'; end if;

  if exists (
    select 1 from public.bookings b
    where b.id <> p_booking_id
      and b.booking_date = v_date
      and b.status in ('pending','confirmed')
      and v_start < b.end_time and v_end > b.start_time
  ) then raise exception 'horario_ocupado'; end if;

  update public.bookings set
    booking_date = v_date,
    start_time = v_start,
    end_time = v_end,
    status = 'confirmed',
    confirmed_at = now(),
    customer_cancelled_at = null,
    updated_at = now()
  where id = p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

revoke all on function public.admin_reactivate_booking(uuid, date, time) from public;
revoke all on function public.admin_reactivate_booking(uuid, date, time) from anon;
grant execute on function public.admin_reactivate_booking(uuid, date, time) to authenticated, service_role;

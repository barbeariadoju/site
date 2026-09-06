-- v29.142.0 — remarcação: a checagem de horário livre precisa ignorar o PRÓPRIO agendamento
-- que está sendo movido (bateria de testes de 05/09/2026: mover 15:00 pra 14:30 dava "14:30 não
-- está disponível" porque 14:30–15:20 batia no próprio 15:00–15:50 do cliente).
--
-- Cópia de get_available_slots com um parâmetro a mais. A original fica intocada: é o caminho
-- crítico do site e da JuIA para agendamento novo.
create or replace function public.get_available_slots_excluding(p_date date, p_duration_minutes integer, p_exclude_booking_id uuid)
 returns table(slot_time time without time zone)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_today date := v_now_sp::date;
  v_min_start time := (v_now_sp + interval '15 minutes')::time;
  open_m integer := 8 * 60;
  close_m integer;
  m integer;
  s time;
  e time;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duração do serviço inválida.';
  end if;
  if p_date < v_today then return; end if;
  if extract(dow from p_date) in (0, 1) then return; end if;
  if exists (select 1 from public.schedule_blocks b where b.block_date = p_date and b.all_day) then return; end if;
  close_m := case when extract(dow from p_date) = 6 then 15 * 60 else 19 * 60 end;
  m := open_m;
  while m < close_m loop
    s := make_time(m / 60, m % 60, 0);
    e := s + make_interval(mins => p_duration_minutes);
    if e <= make_time(close_m / 60, close_m % 60, 0)
       and (p_date > v_today or s >= v_min_start)
       and not exists (
         select 1 from public.schedule_blocks bl
         where bl.block_date = p_date and (bl.all_day or (s < bl.end_time and e > bl.start_time))
       )
       and not exists (
         select 1 from public.bookings b
         where b.booking_date = p_date
           and b.status in ('pending', 'confirmed')
           and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
           and s < b.end_time and e > b.start_time
       ) then
      slot_time := s;
      return next;
    end if;
    m := m + 15;
  end loop;
end;
$function$;
revoke all on function public.get_available_slots_excluding(date, integer, uuid) from public;
grant execute on function public.get_available_slots_excluding(date, integer, uuid) to service_role;

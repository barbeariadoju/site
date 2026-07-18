-- Barbearia do Ju — V25.1.1
-- Hotfix: gravação atômica do código e token de gerenciamento do agendamento.

create or replace function public.attach_booking_management_v25(
  p_booking_id uuid,
  p_booking_code text,
  p_management_token_hash text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if p_booking_id is null then
    raise exception 'ID do agendamento ausente.';
  end if;
  if nullif(trim(p_booking_code), '') is null then
    raise exception 'Código do agendamento ausente.';
  end if;
  if nullif(trim(p_management_token_hash), '') is null then
    raise exception 'Token de gerenciamento ausente.';
  end if;

  update public.bookings
     set booking_code = upper(trim(p_booking_code)),
         management_token_hash = trim(p_management_token_hash),
         updated_at = now()
   where id = p_booking_id
   returning * into v_booking;

  if v_booking.id is null then
    raise exception 'Agendamento não encontrado para vincular o gerenciamento.';
  end if;

  return v_booking;
end;
$$;

revoke all on function public.attach_booking_management_v25(uuid,text,text) from public;
grant execute on function public.attach_booking_management_v25(uuid,text,text) to service_role;

notify pgrst, 'reload schema';

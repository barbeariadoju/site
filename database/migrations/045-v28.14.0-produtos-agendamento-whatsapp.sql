-- 045-v28.14.0-produtos-agendamento-whatsapp.sql
--
-- Depois de reagendar (v28.13.0) e trocar servico (v28.13.1), falta a JuIA
-- poder adicionar/remover produto de um agendamento ja existente (ex.: cliente
-- esqueceu de pedir a pomada e quer incluir depois, ou mudou de ideia sobre um
-- produto reservado). Mesmo padrao de seguranca: autorizado por telefone
-- (phone_match_key), so no WhatsApp com telefone verificado pelo canal.
--
-- phone_upcoming_bookings ganha selected_products: o ju-ia-site precisa saber
-- quais produtos ja estao reservados no agendamento pra poder adicionar ou
-- remover sem apagar o resto da lista. Precisa dropar antes (mudar colunas de
-- retorno nao e permitido com create or replace).
drop function if exists public.phone_upcoming_bookings(text);

create or replace function public.phone_upcoming_bookings(p_phone text)
returns table(id uuid, booking_date date, start_time time, duration_minutes integer, service_name text, status text, selected_products jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.booking_date, b.start_time, b.duration_minutes, b.service_name, b.status, coalesce(b.selected_products,'[]'::jsonb)
  from public.bookings b
  where b.status in ('pending','confirmed')
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and (
      b.booking_date > (timezone('America/Sao_Paulo', now()))::date
      or (b.booking_date = (timezone('America/Sao_Paulo', now()))::date
          and b.start_time > (timezone('America/Sao_Paulo', now()))::time)
    )
  order by b.booking_date, b.start_time
$$;

revoke all on function public.phone_upcoming_bookings(text) from public;
grant execute on function public.phone_upcoming_bookings(text) to service_role;

create or replace function public.phone_update_booking_products(
  p_phone text,
  p_booking_id uuid,
  p_selected_products jsonb
)
returns setof public.bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_products_price numeric;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if public.phone_match_key(v_booking.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este agendamento não pertence a este telefone.';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'Este agendamento não pode mais ser alterado.';
  end if;
  if v_booking.booking_date::timestamp + v_booking.start_time::time <= v_now_sp then
    raise exception 'Não é possível alterar um horário que já começou.';
  end if;

  select coalesce(sum((x ->> 'price')::numeric), 0)
    into v_products_price
    from jsonb_array_elements(coalesce(p_selected_products, '[]'::jsonb)) x;

  update public.bookings set
    selected_products=coalesce(p_selected_products,'[]'::jsonb),
    products_price=v_products_price,
    updated_at=now()
  where id=p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

revoke all on function public.phone_update_booking_products(text,uuid,jsonb) from public;
grant execute on function public.phone_update_booking_products(text,uuid,jsonb) to service_role;

-- Barbearia OS V15.4
-- Habilita exclusão definitiva de cliente e de todos os agendamentos vinculados ao telefone.
-- Execute uma vez no SQL Editor do Supabase.

create or replace function public.admin_delete_customer_permanently(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Acesso não autorizado.';
  end if;

  select regexp_replace(phone, '\D', '', 'g')
    into v_phone
  from public.customer_profiles
  where id = p_customer_id;

  if v_phone is null then
    raise exception 'Cliente não encontrado.';
  end if;

  delete from public.bookings
  where regexp_replace(customer_phone, '\D', '', 'g') = v_phone;

  delete from public.customer_profiles
  where id = p_customer_id;
end;
$$;

revoke all on function public.admin_delete_customer_permanently(uuid) from public, anon;
grant execute on function public.admin_delete_customer_permanently(uuid) to authenticated;

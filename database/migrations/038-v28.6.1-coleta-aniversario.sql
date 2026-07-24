-- Barbearia do Ju — V28.6.1
-- Coleta opcional da data de nascimento no agendamento do site.
-- Grava no customer_profiles de forma robusta (casando pelos últimos 11
-- dígitos do telefone, já que o banco tem números com e sem o prefixo 55).
-- Não sobrescreve uma data já cadastrada (admin tem prioridade).

create or replace function public.upsert_customer_birthday(
  p_phone text,
  p_name text,
  p_birth_date date
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
begin
  if p_birth_date is null then return; end if;
  if p_birth_date < date '1900-01-01' or p_birth_date > current_date then return; end if;
  if length(v_digits) < 10 then return; end if;

  -- procura perfil existente pelos últimos 11 dígitos
  select id into v_id
  from public.customer_profiles
  where right(regexp_replace(phone,'\D','','g'), 11) = right(v_digits, 11)
  order by created_at asc
  limit 1;

  if v_id is not null then
    -- só preenche se ainda não houver data (não sobrescreve o que o admin colocou)
    update public.customer_profiles
      set birth_date = coalesce(birth_date, p_birth_date), updated_at = now()
    where id = v_id;
  else
    insert into public.customer_profiles (name, phone, birth_date, archived)
    values (nullif(trim(p_name),''), v_digits, p_birth_date, false)
    on conflict (phone) do update
      set birth_date = coalesce(public.customer_profiles.birth_date, excluded.birth_date),
          updated_at = now();
  end if;
end $$;

grant execute on function public.upsert_customer_birthday(text,text,date) to service_role;

notify pgrst, 'reload schema';

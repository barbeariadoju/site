-- v28.27.0: mesclar clientes duplicados + corrige "Arquivar" quebrado
--
-- Motivo do merge: bookings.customer_phone é a fonte de verdade de "quem é o cliente" (não
-- tem customer_id) -- então dois cadastros pro MESMO cliente (nome igual, telefone
-- diferente -- ex.: pessoa trocou de número) ficam com histórico, fidelidade e agendamentos
-- completamente separados, sem nenhuma forma de juntar. Achado em 2026-07-30 ao investigar
-- um caso real de "Carlos Rodrigues" duplicado no autocomplete do Novo agendamento.
--
-- admin_archive_customer: existia na migration 008 mas sumiu do banco (não foi encontrada
-- em nenhuma outra migration removendo -- provável falha silenciosa na aplicação original).
-- O botão "Arquivar" do CRM chama essa RPC e estava quebrado (function does not exist).

create or replace function public.admin_archive_customer(p_customer_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  update public.customer_profiles set archived=true,updated_at=now() where id=p_customer_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;
end $$;
revoke all on function public.admin_archive_customer(uuid) from public;
grant execute on function public.admin_archive_customer(uuid) to authenticated;

-- Mescla p_merge_id em p_keep_id: reaponta agendamentos (por telefone), timeline,
-- pesquisas de satisfação, histórico de contato e eventos de fidelidade pro cliente
-- mantido; soma os pontos de fidelidade (aplicando o mesmo estouro de 10=1 recompensa
-- do trigger normal); registra o merge na timeline; e apaga o cadastro duplicado (que
-- já fica sem nada vinculado). Cadastro mantido conserva nome/notas/tags como estavam --
-- o admin escolhe qual dos dois é o "certo" antes de mesclar.
create or replace function public.admin_merge_customers(p_keep_id uuid, p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_keep_phone text;
  v_merge_phone text;
  v_merge_points integer;
  v_merge_lifetime integer;
  v_merge_rewards integer;
  v_points integer;
  v_rewards integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_keep_id = p_merge_id then
    raise exception 'Selecione dois clientes diferentes.';
  end if;

  select phone into v_keep_phone from public.customer_profiles where id = p_keep_id;
  select phone into v_merge_phone from public.customer_profiles where id = p_merge_id;
  if v_keep_phone is null or v_merge_phone is null then
    raise exception 'Cliente não encontrado.';
  end if;

  update public.bookings
    set customer_phone = v_keep_phone
    where regexp_replace(customer_phone,'\D','','g') = regexp_replace(v_merge_phone,'\D','','g');

  update public.customer_timeline set customer_id = p_keep_id where customer_id = p_merge_id;
  update public.experience_requests set customer_id = p_keep_id where customer_id = p_merge_id;
  update public.loyalty_events set customer_id = p_keep_id where customer_id = p_merge_id;
  update public.customer_outreach_log set customer_id = p_keep_id, phone = v_keep_phone where customer_id = p_merge_id;

  select points, lifetime_points, rewards_available
    into v_merge_points, v_merge_lifetime, v_merge_rewards
    from public.loyalty_accounts where customer_id = p_merge_id;

  if v_merge_points is not null then
    insert into public.loyalty_accounts(customer_id) values (p_keep_id) on conflict (customer_id) do nothing;
    update public.loyalty_accounts
      set points = points + coalesce(v_merge_points,0),
          lifetime_points = lifetime_points + coalesce(v_merge_lifetime,0),
          rewards_available = rewards_available + coalesce(v_merge_rewards,0),
          updated_at = now()
      where customer_id = p_keep_id
      returning points, rewards_available into v_points, v_rewards;

    while v_points >= 10 loop
      v_points := v_points - 10;
      v_rewards := v_rewards + 1;
    end loop;
    update public.loyalty_accounts set points = v_points, rewards_available = v_rewards, updated_at = now() where customer_id = p_keep_id;

    delete from public.loyalty_accounts where customer_id = p_merge_id;
  end if;

  insert into public.customer_timeline(customer_id, booking_id, event_type, title, details)
  values (p_keep_id, null, 'customer_merged', 'Cadastro duplicado mesclado', jsonb_build_object(
    'merged_customer_id', p_merge_id,
    'merged_phone', v_merge_phone,
    'merged_by', auth.uid()
  ));

  delete from public.customer_profiles where id = p_merge_id;
end;
$$;

revoke all on function public.admin_merge_customers(uuid, uuid) from public;
grant execute on function public.admin_merge_customers(uuid, uuid) to authenticated;

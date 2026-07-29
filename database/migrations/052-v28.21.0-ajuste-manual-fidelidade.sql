-- v28.21.0: ajuste manual de carimbos de fidelidade
--
-- Motivo: clientes que já tinham carimbos no cartao fisico (antes do sistema
-- digital existir) precisam entrar no saldo deles sem ter que "fingir" cortes
-- que nunca aconteceram no sistema. Reaproveita a mesma logica de acumulo/
-- estouro (10 carimbos = 1 recompensa) que ja existe no trigger de conclusao
-- de agendamento (v21_sync_loyalty_on_completed_booking, migration 013),
-- soh que disparada manualmente pelo admin e registrada como 'adjustment'
-- em loyalty_events (mesmo event_type que ja existia na constraint original).

create or replace function public.admin_adjust_loyalty_points(
  p_customer_id uuid,
  p_delta integer,
  p_description text default null
)
returns table(points integer, rewards_available integer, lifetime_points integer)
language plpgsql security definer set search_path = public as $$
declare v_points integer; v_rewards integer; v_lifetime integer;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'p_delta precisa ser diferente de zero';
  end if;

  insert into public.loyalty_accounts(customer_id) values (p_customer_id)
    on conflict (customer_id) do nothing;

  insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
    values (p_customer_id, null, 'adjustment', p_delta, coalesce(p_description, 'Ajuste manual de carimbos'));

  update public.loyalty_accounts
    set points = greatest(0, points + p_delta),
        lifetime_points = greatest(0, lifetime_points + p_delta),
        updated_at = now()
    where customer_id = p_customer_id
    returning points, rewards_available, lifetime_points into v_points, v_rewards, v_lifetime;

  -- carrega o mesmo estouro do trigger de corte concluido: cada 10 carimbos vira
  -- 1 recompensa disponivel (só quando o ajuste é positivo e cruza a marca de 10)
  while v_points >= 10 loop
    v_points := v_points - 10;
    v_rewards := v_rewards + 1;
    update public.loyalty_accounts
      set points = v_points, rewards_available = v_rewards, updated_at = now()
      where customer_id = p_customer_id;
  end loop;

  return query select v_points, v_rewards, v_lifetime;
end;
$$;

revoke all on function public.admin_adjust_loyalty_points(uuid, integer, text) from public;
grant execute on function public.admin_adjust_loyalty_points(uuid, integer, text) to authenticated;

-- v29.14.1 (12/08/2026) — CAUSA RAIZ dos "extras da conclusão" que falhavam desde 08/08:
-- a migration 100 (v29.10.0) recriou admin_adjust_loyalty_points SEM os aliases de tabela
-- que a migration 087 tinha. Como a função devolve table(points, rewards_available,
-- lifetime_points), esses nomes viram variáveis PL/pgSQL — e o UPDATE
-- "set points = greatest(0, points + p_delta)" fica ambíguo (erro 42702). TODA chamada
-- desde então falhou: no fluxo antigo (navegador) o erro morria num alert; no fluxo novo
-- (server-side, v29.12.0) ficou visível no log e foi achado no caso Tatiane (12/08).
-- Clientes acertados à mão enquanto o bug existia: Caio, Rafael, Deisler, Dorta, John,
-- Cauã, Fernando (11/08) e Tatiane (12/08).
-- Fix: mesma lógica, com alias `la` e colunas qualificadas (padrão da 087), preservando
-- o estouro de 10 carimbos e o registro em loyalty_rewards da 100.
-- Aplicada no banco via MCP em 12/08/2026 (mesmo conteúdo).

create or replace function public.admin_adjust_loyalty_points(
  p_customer_id uuid,
  p_delta integer,
  p_description text default null
)
returns table(points integer, rewards_available integer, lifetime_points integer)
language plpgsql security definer set search_path = public as $$
declare v_points integer; v_rewards integer; v_lifetime integer;
begin
  if not public.is_admin() then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'p_delta precisa ser diferente de zero';
  end if;

  insert into public.loyalty_accounts(customer_id) values (p_customer_id)
    on conflict (customer_id) do nothing;

  insert into public.loyalty_events(customer_id, booking_id, event_type, points_delta, description)
    values (p_customer_id, null, 'adjustment', p_delta, coalesce(p_description, 'Ajuste manual de carimbos'));

  update public.loyalty_accounts la
     set points = greatest(0, la.points + p_delta),
         lifetime_points = greatest(0, la.lifetime_points + p_delta),
         updated_at = now()
   where la.customer_id = p_customer_id
  returning la.points, la.rewards_available, la.lifetime_points into v_points, v_rewards, v_lifetime;

  while v_points >= 10 loop
    v_points := v_points - 10;
    v_rewards := v_rewards + 1;
    update public.loyalty_accounts la
       set points = v_points, rewards_available = v_rewards, updated_at = now()
     where la.customer_id = p_customer_id;
    insert into public.loyalty_rewards(customer_id, earned_at, expires_at)
      values (p_customer_id, now(), now() + interval '30 days');
  end loop;

  return query select v_points, v_rewards, v_lifetime;
end;
$$;

revoke all on function public.admin_adjust_loyalty_points(uuid, integer, text) from public;
grant execute on function public.admin_adjust_loyalty_points(uuid, integer, text) to authenticated;

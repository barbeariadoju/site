-- v28.55.0 — Auditoria de segurança das RPCs SECURITY DEFINER (05/08/2026)
--
-- Padrão do bug (mesmo da view v27_customer_metrics removida na migration 059):
-- função SECURITY DEFINER (ignora RLS) + acesso pro papel `authenticated` — que neste
-- projeto NÃO é só o Juliano, inclui qualquer CLIENTE logado na área do cliente
-- (client-area-page/client-dashboard) — e sem nenhuma checagem de autorização por dentro.
--
-- ATENÇÃO ao ler esta migration junto com a 088: o `revoke ... from anon, authenticated`
-- aqui NÃO foi suficiente sozinho. Função criada sem GRANT explícito nasce com EXECUTE
-- pra PUBLIC, e anon/authenticated herdam disso — só o revoke de PUBLIC (migration 088)
-- fechou de fato. Conferir sempre com aclexplode tratando grantee=0 como PUBLIC.

-- 1. GRAVE (fraude): admin_adjust_loyalty_points ajustava pontos de fidelidade de
-- qualquer customer_id, chamável por qualquer cliente logado, sem is_admin().
-- 10 pontos = 1 corte grátis, então dava pra se autopresentear à vontade.
-- É a ÚNICA função admin_* que não tinha is_admin (todas as outras já checavam).
-- Continua chamável por `authenticated` de propósito: o botão do CRM/Fidelidade
-- (loyalty-admin-v21.js) usa a sessão do Juliano — agora a checagem é por dentro.
create or replace function public.admin_adjust_loyalty_points(p_customer_id uuid, p_delta integer, p_description text default null::text)
returns table(points integer, rewards_available integer, lifetime_points integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_points integer; v_rewards integer; v_lifetime integer;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;

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
    update public.loyalty_accounts
      set points = v_points, rewards_available = v_rewards, updated_at = now()
      where customer_id = p_customer_id;
  end loop;

  return query select v_points, v_rewards, v_lifetime;
end;
$function$;

-- 2. Vazamento de dados pessoais: admin_customer_insights_v27() devolvia nome, telefone,
-- e-mail e gasto total de TODOS os clientes pra qualquer usuário logado. Resquício do CRM
-- antigo (migration 027) — zero chamadas no código atual (mesmo caso da view removida em 059).
drop function if exists public.admin_customer_insights_v27();

-- 3. Código morto ainda exposto: create_public_booking (versão de 8 args, anterior à _v15).
-- Nenhum caller; a v15 é a usada por todas as edge functions.
drop function if exists public.create_public_booking(text, text, text, numeric, integer, date, time without time zone, text);

-- 4. get_customer_commercial_context(p_phone) aceita QUALQUER telefone e devolve nome,
-- e-mail, aniversário, preferências e pontos daquele cliente. Só ju-ia-site e
-- whatsapp-lead-followup usam (ambos service_role) — não precisa ficar exposta.
revoke execute on function public.get_customer_commercial_context(text) from anon, authenticated;

-- 5. waitlist_matches_for_slot devolve linhas inteiras de `waitlist` (nome + telefone de
-- quem está esperando). Usada só por edge functions (admin-booking-status, manage-booking,
-- ju-ia-site), todas com service_role.
revoke execute on function public.waitlist_matches_for_slot(date, time without time zone) from anon, authenticated;

-- 6. create_public_booking_v15 estava chamável por `anon`: dava pra criar agendamento
-- direto via PostgREST com a chave pública do site, pulando a edge function
-- create-public-booking (que valida payload, checa horário e dispara notificação).
-- Risco de agenda entupida por requisição automatizada. Todas as chamadas legítimas
-- (create-public-booking, create-rebooking, ju-ia-site) usam service_role.
revoke execute on function public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb) from anon, authenticated;

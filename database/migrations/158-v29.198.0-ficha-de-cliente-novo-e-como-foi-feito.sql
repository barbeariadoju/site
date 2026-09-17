-- v29.198.0 (17/09/2026) — Ficha de cliente novo voltou a ser criada; "Como foi feito" nunca
-- mais se perde por falta de ficha.
--
-- Caso Maurício Amorin (17/09, 1ª visita, agendou pelo site): o Juliano escreveu o "Como foi
-- feito" no Concluir e o painel devolveu "NÃO foi salvo no cadastro: cadastro não encontrado".
-- A RPC da migration 156 só atualiza ficha existente, confiando que "o admin já cria a ficha ao
-- abrir". Só que essa criação estava QUEBRADA desde a v29.98.0 (29/08): o upsert do painel
-- passou a usar on_conflict=phone_key, e o índice único de phone_key é PARCIAL (where phone_key
-- is not null) — o Postgres recusa a inferência ("there is no unique or exclusion constraint
-- matching the ON CONFLICT specification", 42P10). O erro ia pro console e ninguém via. 17
-- clientes novos de site/JuIA desde 29/08 ficaram sem ficha (fidelidade, "já avaliou", estilo).
--
-- 1) admin_sync_customer_profiles(): a sincronização sai do navegador e vira SQL, com
--    `on conflict do nothing` (sem inferir índice). O painel chama ao carregar; a primeira
--    chamada já cria as 17 fichas que faltam.
-- 2) admin_set_customer_style ganha p_name e cria a ficha quando não existe (e aceita ficha
--    arquivada em vez de recusar: é a mesma pessoa).

create or replace function public.admin_sync_customer_profiles()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_n int := 0;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  with latest as (
    select distinct on (public.phone_key(b.customer_phone))
      public.phone_key(b.customer_phone) as k,
      coalesce(nullif(btrim(b.customer_name), ''), 'Cliente') as name,
      regexp_replace(coalesce(b.customer_phone, ''), '\D', '', 'g') as phone,
      nullif(lower(btrim(b.customer_email)), '') as email
    from public.bookings b
    where public.phone_key(b.customer_phone) is not null
    order by public.phone_key(b.customer_phone), b.created_at desc
  ), ins as (
    insert into public.customer_profiles(name, phone, email, archived)
    select l.name, l.phone, l.email, false
    from latest l
    where not exists (select 1 from public.customer_profiles p where p.phone_key = l.k)
    on conflict do nothing
    returning 1
  )
  select count(*) into v_n from ins;
  return jsonb_build_object('ok', true, 'created', v_n);
end $$;
revoke all on function public.admin_sync_customer_profiles() from public, anon;
grant execute on function public.admin_sync_customer_profiles() to authenticated, service_role;

drop function if exists public.admin_set_customer_style(text, text);
create or replace function public.admin_set_customer_style(p_phone text, p_style text, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_items text[];
  v_json jsonb := '{}'::jsonb;
  v_i int := 0;
  v_item text;
  v_id uuid;
  v_created boolean := false;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if length(v_key) < 8 then return jsonb_build_object('ok', false, 'error', 'telefone inválido'); end if;

  select id into v_id from customer_profiles where phone_key = v_key
   order by coalesce(archived, false) asc, updated_at desc nulls last limit 1;
  if v_id is null then
    insert into customer_profiles(name, phone)
      values (coalesce(nullif(btrim(p_name), ''), 'Cliente'), regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'))
      returning id into v_id;
    v_created := true;
  end if;

  v_items := regexp_split_to_array(coalesce(p_style, ''), E'\\s*(,|;|·|\\n)\\s*');
  foreach v_item in array v_items loop
    v_item := btrim(v_item);
    if v_item <> '' then
      v_i := v_i + 1;
      v_json := v_json || jsonb_build_object('item_' || v_i, v_item);
    end if;
  end loop;

  update customer_profiles set style_preferences = v_json, updated_at = now() where id = v_id;
  return jsonb_build_object('ok', true, 'customer_id', v_id, 'created', v_created, 'items', v_i, 'style_preferences', v_json);
end $$;
revoke all on function public.admin_set_customer_style(text, text, text) from public, anon;
grant execute on function public.admin_set_customer_style(text, text, text) to authenticated, service_role;

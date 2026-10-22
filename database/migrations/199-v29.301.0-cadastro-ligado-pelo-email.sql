-- v29.301.0 — cadastro duplicado por telefone digitado errado (Juliano, 22/10/2026).
-- Caso Douglas: agendou pelo site em 23/09 com 11 95810-1438 e, em 21/10, com 11 9581-1438 (faltou um
-- dígito). Mesmo e-mail nos dois. Virou "1ª visita / O sistema nunca viu este cliente" e o cadastro novo
-- não tinha o ponto de fidelidade nem o histórico. Caso Marcos: 11 97354-5745 no site, 11 97534-5745 no
-- WhatsApp (dois dígitos trocados); o número errado tinha ficado como principal e o comprovante de hoje
-- não chegou.
--
-- 1) email_match_key: o mesmo e-mail escrito de jeitos diferentes (maiúscula, espaço; no Gmail, pontos e
--    "+algo" não contam) vira a mesma chave.
-- 2) trg_bookings_a_liga_por_email: agendamento novo com telefone desconhecido e e-mail que já pertence a
--    UM cadastro → o telefone vira "outro telefone" desse cadastro antes de qualquer outro gatilho. O
--    trg_bookings_resolve_phone_alias, que roda depois, grava o agendamento no telefone principal. Com o
--    e-mail em dois cadastros diferentes, não liga nada (não dá para saber qual).
--    O nome começa com "a_" de propósito: gatilhos BEFORE do mesmo evento rodam em ordem alfabética, e
--    este precisa vir antes do trg_bookings_dados_do_cadastro e do trg_bookings_resolve_phone_alias.
-- 3) O e-mail do agendamento completa o cadastro que ainda não tem e-mail (Douglas e Marcos tinham e-mail
--    nos agendamentos e nenhum no cadastro, então nada ligava os dois).
-- 4) admin_possiveis_duplicados: lista para o painel os pares que parecem a mesma pessoa (mesmo e-mail,
--    e-mail quase igual, telefone com um ou dois dígitos de diferença, mesmo nome completo). Juntar ou não
--    é decisão do Juliano, no Mesclar; "Não é a mesma pessoa" tira o par da lista para sempre.

create extension if not exists fuzzystrmatch with schema extensions;

create or replace function public.email_match_key(p_email text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when e is null or position('@' in e) = 0 then null
    when split_part(e, '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(e, '@', 1), '+', 1), '.', '') || '@gmail.com'
    else e
  end
  from (select nullif(lower(btrim(coalesce(p_email, ''))), '') as e) s
$$;

-- telefone só com os dígitos nacionais (DDD + número), sem o 55
create or replace function public.phone_national_digits(p_phone text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3) else d end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s
$$;

create or replace function public.bookings_liga_por_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_key text; v_email text; v_dono uuid; v_ids uuid[]; v_cid uuid;
begin
  v_key := public.email_match_key(new.customer_email);
  if v_key is null or coalesce(btrim(new.customer_phone), '') = '' then return new; end if;
  v_email := lower(btrim(new.customer_email));

  -- telefone já conhecido: só completa o e-mail do cadastro, se faltar
  select c.id into v_dono
    from public.customer_profiles c
   where public.phone_match_key(c.phone) = public.phone_match_key(new.customer_phone) and not c.archived
   order by c.created_at
   limit 1;
  if v_dono is not null then
    update public.customer_profiles set email = v_email, updated_at = now() where id = v_dono and email is null;
    return new;
  end if;

  -- telefone novo: o e-mail aponta para um cadastro só?
  select array_agg(distinct x.cid) into v_ids from (
    select c.id as cid from public.customer_profiles c
     where not c.archived and public.email_match_key(c.email) = v_key
    union
    select c.id from public.bookings b
      join public.customer_profiles c on public.phone_match_key(c.phone) = public.phone_match_key(b.customer_phone) and not c.archived
     where public.email_match_key(b.customer_email) = v_key
  ) x;
  if coalesce(array_length(v_ids, 1), 0) <> 1 then return new; end if;
  v_cid := v_ids[1];

  insert into public.customer_phone_aliases(alias_key, customer_id, phone, note)
    values (public.phone_match_key_raw(new.customer_phone), v_cid, new.customer_phone,
            'ligado pelo e-mail ' || v_email || ' em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'))
    on conflict (alias_key) do nothing;
  insert into public.customer_timeline(customer_id, booking_id, event_type, title, details)
    values (v_cid, null, 'phone_linked_by_email', 'Telefone novo ligado pelo e-mail',
            jsonb_build_object('phone', new.customer_phone, 'email', v_email));
  update public.customer_profiles set email = coalesce(email, v_email), updated_at = now() where id = v_cid;
  return new;
end
$function$;

drop trigger if exists trg_bookings_a_liga_por_email on public.bookings;
create trigger trg_bookings_a_liga_por_email
  before insert on public.bookings
  for each row execute function public.bookings_liga_por_email();

-- cadastro sem e-mail recebe o e-mail mais recente dos agendamentos dele
update public.customer_profiles c
   set email = x.email, updated_at = now()
  from (
    select distinct on (c2.id) c2.id, lower(btrim(b.customer_email)) as email
      from public.customer_profiles c2
      join public.bookings b on public.phone_match_key(b.customer_phone) = public.phone_match_key(c2.phone)
     where c2.email is null and nullif(btrim(b.customer_email), '') is not null and position('@' in b.customer_email) > 0
     order by c2.id, b.created_at desc
  ) x
 where c.id = x.id and c.email is null;

-- pares que o Juliano já disse que NÃO são a mesma pessoa (a < b)
create table if not exists public.customer_duplicate_dismissed (
  customer_a uuid not null,
  customer_b uuid not null,
  created_at timestamptz not null default now(),
  primary key (customer_a, customer_b)
);
alter table public.customer_duplicate_dismissed enable row level security;
drop policy if exists customer_duplicate_dismissed_admin on public.customer_duplicate_dismissed;
create policy customer_duplicate_dismissed_admin on public.customer_duplicate_dismissed
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, delete on public.customer_duplicate_dismissed to authenticated;
grant all on public.customer_duplicate_dismissed to service_role;

create or replace function public.admin_possiveis_duplicados()
returns table(
  a_id uuid, a_name text, a_phone text, a_email text, a_visits integer, a_whatsapp boolean,
  b_id uuid, b_name text, b_phone text, b_email text, b_visits integer, b_whatsapp boolean,
  motivo text
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  return query
  with zap as (
    select distinct public.phone_match_key_raw(w.phone) as k from public.whatsapp_messages w where w.direction = 'in'
  ), visitas as (
    select public.phone_match_key(b.customer_phone) as k, count(*)::int as n
      from public.bookings b where b.status = 'completed' group by 1
  ), p as (
    select c.id, btrim(c.name) as name, c.phone, public.phone_national_digits(c.phone) as nat,
           c.email, public.email_match_key(c.email) as ek,
           split_part(lower(btrim(c.name)), ' ', 1) as primeiro,
           regexp_replace(translate(lower(btrim(c.name)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') as nome,
           coalesce(v.n, 0) as visits,
           exists (select 1 from zap z where z.k = public.phone_match_key_raw(c.phone)
                   or z.k in (select a.alias_key from public.customer_phone_aliases a where a.customer_id = c.id)) as whatsapp
      from public.customer_profiles c
      left join visitas v on v.k = public.phone_match_key(c.phone)
     where not c.archived
  ), pares as (
    select x.*, y.id as y_id,
      case
        when x.ek is not null and x.ek = y.ek then 'Mesmo e-mail'
        when x.ek is not null and y.ek is not null and split_part(x.ek, '@', 2) = split_part(y.ek, '@', 2)
             and length(split_part(x.ek, '@', 1)) >= 6
             and levenshtein(split_part(x.ek, '@', 1), split_part(y.ek, '@', 1)) <= 2 then 'E-mail quase igual'
        when left(x.nat, 2) = left(y.nat, 2) and length(x.nat) >= 10 and length(y.nat) >= 10
             and (levenshtein(x.nat, y.nat) <= 1 or (levenshtein(x.nat, y.nat) <= 2 and x.primeiro = y.primeiro))
             then 'Telefone com dígito diferente'
        when x.nome like '% %' and x.nome = y.nome then 'Mesmo nome completo'
      end as motivo
    from p x join p y on x.id < y.id
  )
  select pr.id, pr.name, pr.phone, pr.email, pr.visits, pr.whatsapp,
         y.id, y.name, y.phone, y.email, y.visits, y.whatsapp, pr.motivo
    from pares pr join p y on y.id = pr.y_id
   where pr.motivo is not null
     and not exists (select 1 from public.customer_duplicate_dismissed d where d.customer_a = pr.id and d.customer_b = y.id)
   order by case pr.motivo when 'Mesmo e-mail' then 1 when 'Telefone com dígito diferente' then 2 when 'E-mail quase igual' then 3 else 4 end, pr.name;
end
$function$;
revoke all on function public.admin_possiveis_duplicados() from public, anon;
grant execute on function public.admin_possiveis_duplicados() to authenticated, service_role;

create or replace function public.admin_dispensar_duplicado(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  insert into public.customer_duplicate_dismissed(customer_a, customer_b)
    values (least(p_a, p_b), greatest(p_a, p_b)) on conflict do nothing;
end
$function$;
revoke all on function public.admin_dispensar_duplicado(uuid, uuid) from public, anon;
grant execute on function public.admin_dispensar_duplicado(uuid, uuid) to authenticated, service_role;

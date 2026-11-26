-- v29.381.0 — Sinal fixo de 50% por decisão do Juliano (26/11/2026).
-- A regra automática do sinal (v29.240.0) liga com dois acontecimentos seguidos (falta ou cancelamento em cima da
-- hora) e desliga quando o cliente comparece. Aqui é diferente: o Juliano decide que aquele cliente SEMPRE agenda
-- com sinal de 50% pelo Pix, e a falta sem aviso de 24 h faz perder o sinal. Comparecer não zera.
-- O sinal_cancelamentos_ativo passa a dar true também para quem está nesta lista, para que a JuIA e o site
-- (create-public-booking) peçam o sinal sem caminho novo. O botão "Dispensar" do CRM tira o cliente da lista.
-- Os clientes da lista são gravados direto no banco (repositório público: telefone não entra aqui).

create table if not exists public.sinal_fixo (
  phone_key text primary key,
  customer_name text,
  motivo text not null,
  created_at timestamptz not null default now()
);
alter table public.sinal_fixo enable row level security;
revoke all on public.sinal_fixo from anon, authenticated;
grant select, insert, update, delete on public.sinal_fixo to service_role;

create or replace function public.sinal_fixo_ativo(p_phone text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.sinal_fixo f where f.phone_key = public.phone_match_key(p_phone))
$function$;

create or replace function public.sinal_cancelamentos_ativo(p_phone text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select public.sinal_fixo_ativo(p_phone)
      or coalesce((select count(*) = 2 and bool_and(tipo <> 'atendido') from public.sinal_cancelamentos_eventos(p_phone)), false)
$function$;

create or replace function public.admin_dispensar_sinal(p_phone text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_k text := public.phone_match_key(p_phone);
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if coalesce(v_k, '') = '' then raise exception 'Telefone inválido.'; end if;
  insert into public.sinal_dispensas (phone_key, dispensado_em, dispensado_por)
  values (v_k, now(), auth.uid())
  on conflict (phone_key) do update set dispensado_em = excluded.dispensado_em, dispensado_por = excluded.dispensado_por;
  delete from public.sinal_fixo where phone_key = v_k;
  return true;
end;
$function$;

revoke all on function public.sinal_fixo_ativo(text) from public, anon, authenticated;
grant execute on function public.sinal_fixo_ativo(text) to service_role;

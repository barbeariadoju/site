-- v29.307.0 — rastro anti-trote do agendamento pelo site (Juliano, 24/10/2026).
-- Caso Miguel Camargo: agendou em 16/10 pelo anúncio, (11) 9999-9966, observação "122323", não veio. Os
-- logs do servidor mostraram IP, operadora e aparelho, mas só por acaso (somem com o tempo) e nada ligava
-- um trote ao próximo. O Juliano pediu: "pode vir da mesma pessoa com dados diferentes porém mesmo IP".
--
-- 1) booking_trail: cada tentativa de agendamento pelo site (criada OU barrada) guarda IP e navegador.
--    Barrada também conta: quem levou "número inventado" ou "cliente bloqueado" e volta com outro nome
--    é exatamente o caso que interessa. Nome/telefone/e-mail só para a tentativa barrada (a criada já
--    tem tudo no agendamento).
-- 2) trote_alerta(ip, navegador, telefone): procura nos últimos 90 dias o mesmo IP numa tentativa
--    barrada, num agendamento que virou falta ou de cliente bloqueado — com outro telefone. Devolve o
--    texto do alerta. É ALERTA, não bloqueio: IP de celular é compartilhado pela operadora (CGNAT) e
--    muda; bloquear por IP barraria cliente de verdade.
-- 3) bookings.alerta_trote: o texto vai pro cartão do painel (que lê select *).
-- 4) Retenção: 90 dias (LGPD, prevenção a fraude; descrito em /privacidade.html). Cron diário apaga.

create table if not exists public.booking_trail (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  ip text,
  user_agent text,
  resultado text not null check (resultado in ('criado', 'bloqueado', 'numero_inventado')),
  nome text,
  telefone text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists booking_trail_ip_idx on public.booking_trail (ip, created_at desc);
create index if not exists booking_trail_booking_idx on public.booking_trail (booking_id);

alter table public.booking_trail enable row level security;
drop policy if exists booking_trail_admin_read on public.booking_trail;
create policy booking_trail_admin_read on public.booking_trail for select to authenticated using (public.is_admin());
-- Tabela nova: GRANT explícito (aviso da Supabase, vale a partir de 30/10/2026).
grant select, insert, update, delete on public.booking_trail to service_role;
grant select on public.booking_trail to authenticated;

alter table public.bookings add column if not exists alerta_trote text;

create or replace function public.trote_alerta(p_ip text, p_user_agent text, p_phone text)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with suspeitos as (
    select t.created_at,
           coalesce(b.customer_name, t.nome, 'sem nome') as nome,
           case
             when t.resultado = 'numero_inventado' then 'tentou marcar com número inventado'
             when t.resultado = 'bloqueado' then 'está bloqueado e tentou marcar'
             when b.status = 'no_show' then 'faltou sem avisar'
             else 'está bloqueado'
           end as motivo,
           (t.user_agent is not distinct from p_user_agent) as mesmo_aparelho
    from public.booking_trail t
    left join public.bookings b on b.id = t.booking_id
    where t.ip = p_ip
      and p_ip is not null and p_ip <> ''
      and t.created_at > now() - interval '90 days'
      and public.phone_match_key(coalesce(b.customer_phone, t.telefone, '')) is distinct from public.phone_match_key(coalesce(p_phone, ''))
      and (
        t.resultado in ('bloqueado', 'numero_inventado')
        or b.status = 'no_show'
        or (b.id is not null and public.is_customer_blocked_v2(b.customer_phone, b.customer_email))
      )
    order by (t.user_agent is not distinct from p_user_agent) desc, t.created_at desc
    limit 1
  )
  select case when mesmo_aparelho then 'Mesmo celular e internet de ' else 'Mesma internet (IP) de ' end
         || nome || ' (' || to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM') || '), que ' || motivo
         || '. Confira antes: pode ser a mesma pessoa com outros dados.'
  from suspeitos
$$;
revoke all on function public.trote_alerta(text, text, text) from public, anon, authenticated;
grant execute on function public.trote_alerta(text, text, text) to service_role;

-- Retenção de 90 dias.
select cron.unschedule('bdj-booking-trail-retencao') where exists (select 1 from cron.job where jobname = 'bdj-booking-trail-retencao');
select cron.schedule('bdj-booking-trail-retencao', '20 6 * * *', $cron$delete from public.booking_trail where created_at < now() - interval '90 days'$cron$);

-- Caso Miguel: o rastro dele veio dos logs do servidor de 16/10 (pedido do navegador às 13h20).
insert into public.booking_trail (booking_id, ip, user_agent, resultado, created_at)
select '689b028f-c423-41ef-9d87-d1daac56478a', '186.195.236.80',
       'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
       'criado', '2026-10-16 16:20:53+00'
where exists (select 1 from public.bookings where id = '689b028f-c423-41ef-9d87-d1daac56478a')
  and not exists (select 1 from public.booking_trail where booking_id = '689b028f-c423-41ef-9d87-d1daac56478a');

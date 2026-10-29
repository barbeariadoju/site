-- v29.317.0 — o backend (service_role) volta a GRAVAR nas tabelas novas.
--
-- Achado no plano do dia de 29/10/2026: closure_notices estava VAZIA, então o aviso de fechamento
-- não sabia quem já tinha sido avisado e repetiu a mesma mensagem até 5 dias seguidos (Helder e
-- Eduardo receberam 4x entre 07 e 10/10). O insert da function falhava calado (supabase-js não lança).
--
-- Causa: o privilégio padrão das tabelas criadas pelo usuário postgres dá ao service_role só
-- SELECT/TRUNCATE (rDxtm), sem INSERT/UPDATE/DELETE. Toda tabela criada depois disso nasceu
-- só-leitura para as functions. Mesmo defeito, mesmos efeitos silenciosos:
--   social_followers_snapshot (meta-insights-now) → o contador de seguidores do IG parou;
--   customer_area_otp (cliente-area) → código de acesso da área do cliente;
--   whatsapp_ad_clicks (whatsapp-webhook) → clique de anúncio que chega pelo WhatsApp;
--   e UPDATE em whatsapp_messages, notification_log, customer_outreach_log, ai_conversations,
--   site_chat_messages, booking_* (só INSERT existia).
--
-- O service_role é a chave do servidor (nunca vai ao navegador) e ignora a RLS; dar a ele escrita
-- é o padrão do Supabase. anon/authenticated NÃO mudam aqui.

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Tabelas futuras criadas pelo postgres já nascem com escrita para o backend. A regra do CLAUDE.md
-- (GRANT explícito em toda migração que cria tabela, a partir de 30/10/2026) continua valendo.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select, update on sequences to service_role;

-- Aviso de fechamento passa a respeitar o SAIR (marketing_opt_out_at), como aniversário, reativação e
-- indicação já faziam. Pedido do Juliano (29/10/2026): Helder e Eduardo não recebem mais mensagens.
-- Única mudança na função: a última condição do where.
create or replace function public.closure_notice_candidates(p_ini date, p_fim date)
 returns table(phone_key text, phone text, customer_name text, motivo text, dia_habitual integer, visitas integer, ultima date)
 language sql stable security definer set search_path to 'public'
as $function$
  with dows as (
    select coalesce(array_agg(distinct extract(dow from d)::int), '{}'::int[]) ds
    from generate_series(p_ini, p_fim, interval '1 day') d
    where extract(isodow from d) between 2 and 6
  ), hist as (
    select right(regexp_replace(b.customer_phone,'\D','','g'),8) k, b.customer_phone, b.customer_name, b.booking_date, b.created_at,
           extract(dow from b.booking_date)::int wd, (extract(dow from b.booking_date)::int = any(dw.ds)) fechado
    from bookings b cross join dows dw
    where b.status = 'completed' and b.booking_date >= current_date - 180 and coalesce(b.service_price,0) > 1
      and b.customer_phone is not null and length(regexp_replace(b.customer_phone,'\D','','g')) >= 10
  ), agg as (
    select h.k,
      (array_agg(h.customer_phone order by h.booking_date desc, h.created_at desc))[1] phone,
      (array_agg(h.customer_name order by h.booking_date desc, h.created_at desc))[1] nome,
      count(*)::int n,
      count(*) filter (where h.fechado)::int n_dia,
      mode() within group (order by h.wd) filter (where h.fechado) wd_fechado,
      max(h.booking_date) ultima, min(h.booking_date) primeira
    from hist h group by h.k
  ), classif as (
    select a.*,
      case when a.n_dia >= 3 or (a.n >= 3 and a.n_dia::numeric / a.n >= 0.5) then 'habitual'
           when a.n >= 2 and a.ultima + round((a.ultima - a.primeira)::numeric / (a.n - 1))::int between p_ini - 3 and p_fim + 3 then 'retorno'
      end motivo
    from agg a
    where a.ultima >= current_date - 75
  )
  select c.k, c.phone, c.nome, c.motivo, c.wd_fechado, c.n, c.ultima
  from classif c
  where c.motivo is not null
    and not exists (select 1 from bookings f where right(regexp_replace(f.customer_phone,'\D','','g'),8) = c.k
                    and f.status in ('confirmed','pending') and f.booking_date between greatest(current_date, p_ini - 10) and p_fim + 10)
    and not exists (select 1 from closure_notices n where n.period_start = p_ini and n.phone_key = c.k)
    and not exists (select 1 from customer_profiles cp where right(regexp_replace(coalesce(cp.phone,''),'\D','','g'),8) = c.k
                    and (cp.archived or cp.marketing_opt_out_at is not null))
  order by c.motivo, c.n desc
$function$;

-- Helder (final 5870) e Eduardo (final 6470): sem mensagem de marketing (pedido do Juliano, 29/10/2026).
-- Confirmação e lembrete de horário que ELES marcarem continuam saindo (são transacionais).
update public.customer_profiles set marketing_opt_out_at = now(), updated_at = now()
 where marketing_opt_out_at is null and right(regexp_replace(coalesce(phone,''),'\D','','g'),8) in ('74845870','93056470');

-- "Nunca contatar" (pedido do Juliano, 29/10/2026: "não mandar nenhuma mensagem pra eles de nada").
-- Nenhum robô nem a JuIA envia para quem tem no_contact_at: a trava é _shared/sem-contato.ts.
alter table public.customer_profiles add column if not exists no_contact_at timestamptz;
comment on column public.customer_profiles.no_contact_at is 'Nunca contatar pelo WhatsApp (nenhum robô, nem a JuIA). Pedido do Juliano. Ver _shared/sem-contato.ts';
update public.customer_profiles set no_contact_at = now(), marketing_opt_out_at = coalesce(marketing_opt_out_at, now()), updated_at = now()
 where right(regexp_replace(coalesce(phone,''),'\D','','g'),8) in ('74845870','93056470');

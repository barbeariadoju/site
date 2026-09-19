-- v29.209.0 (19/09/2026) — Rotina diária dos benefícios (function benefits-dispatch).
--
-- Quem recebe o convite de indicação: cliente com 2+ atendimentos concluídos (já é da casa),
-- com o último atendimento concluído entre 2 e 6 dias atrás (a experiência está fresca e
-- ainda não é hora do convite de retorno do dia 12), que nunca recebeu o convite, não está
-- bloqueado e tem telefone válido. Um convite por cliente, para sempre. No máximo 10 por dia.

create or replace function public.referral_invite_candidates(p_limit int default 10)
returns table(customer_id uuid, name text, phone text)
language sql stable security definer set search_path = public as $$
  with feitos as (
    select public.phone_match_key(b.customer_phone) mkey, count(*) n, max(b.booking_date) ultimo
      from public.bookings b where b.status = 'completed'
     group by 1
  )
  select c.id, c.name, c.phone
    from public.customer_profiles c
    join feitos f on f.mkey = public.phone_match_key(c.phone)
   where c.archived = false
     and length(regexp_replace(c.phone, '\D', '', 'g')) >= 10
     and f.n >= 2
     and f.ultimo between (now() at time zone 'America/Sao_Paulo')::date - 6 and (now() at time zone 'America/Sao_Paulo')::date - 2
     and not public.is_customer_blocked_v2(c.phone, c.email)
     and not exists (select 1 from public.customer_outreach_log l where l.customer_id = c.id and l.kind = 'referral_invite')
   order by f.ultimo desc
   limit greatest(1, least(coalesce(p_limit, 10), 30));
$$;
revoke all on function public.referral_invite_candidates(int) from public, anon, authenticated;
grant execute on function public.referral_invite_candidates(int) to service_role;

-- 10h05 de Brasília (13h05 UTC), terça a sábado, só fora do silêncio da JuIA.
select cron.unschedule('bdj-benefits-dispatch') where exists (select 1 from cron.job where jobname = 'bdj-benefits-dispatch');
select cron.schedule('bdj-benefits-dispatch', '5 13 * * 2-6', $cron$
  select case when not public.juia_quiet_now() then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/benefits-dispatch',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb
  )) end;
$cron$);

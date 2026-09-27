-- 182 — v29.248.0 (26/09/2026) — Lembrete para quem agendou e cancelou (ou faltou) sem nunca ter vindo
--
-- O Juliano percebeu que a reativação (migração 181, customers_due_for_reactivation) só alcança quem
-- teve pelo menos uma visita CONCLUÍDA. Quem marcou pelo site ou pela JuIA, cancelou ou faltou, e
-- nunca sentou na cadeira não recebe nada — e é justamente quem já mostrou interesse. Mesma filosofia:
-- "mensagem curta, breve; o objetivo é lembrar, não incomodar".
--
-- Quem entra (chave = phone_match_key do telefone, como todo o resto):
--   * telefone SEM nenhum booking 'completed' (em qualquer canal, inclusive balcão e porta);
--   * o último agendamento (fora os de canal 'porta') está 'cancelled' ou 'no_show';
--   * o cancelamento/falta aconteceu nos últimos 120 dias;
--   * sem horário futuro pending/confirmed; não está em blocked_customers;
--   * se tem cadastro (customer_profiles): não arquivado, sem survey_opt_out, sem SAIR (marketing_opt_out_at).
--
-- O que fica de FORA, e por quê (investigado em 26/09):
--   * Cancelamento feito pelo painel ou pelo sistema. Não existe coluna cancel_reason/cancelled_by em
--     bookings: o painel (admin-booking-status) grava só status='cancelled' + token de reagendamento;
--     o prepay-deadline (sinal não pago) grava status='cancelled' + nota. Só o cancelamento feito PELO
--     CLIENTE (JuIA whatsapp_cancel_booking, link do site, "3" da confirmação de presença) grava
--     customer_cancelled_at. Logo: cancelado sem customer_cancelled_at = a barbearia cancelou (fechamento,
--     viagem, pedido por telefone) ou o sinal venceu — nos dois casos não faz sentido dizer "seu horário
--     acabou não acontecendo" como se fosse escolha dele; e quem foi cancelado pelo painel já recebeu o
--     e-mail com o link de reagendamento (booking-email, cancelled_by='admin'). A falta (no_show) entra
--     sempre: é marcada pelo Juliano e significa que o cliente não veio.
--   * Canal 'porta' (Senha Digital, v29.241.0): quem pegou senha na parede já estava na barbearia; se a
--     senha foi cancelada, ele desistiu na hora ou foi atendido sem baixa — lembrar "seu horário não
--     aconteceu" seria estranho. Essas linhas não contam como gatilho (mas uma senha CONCLUÍDA continua
--     excluindo o telefone, porque aí ele já veio).
--   * Número sem WhatsApp (bookings.whatsapp_unreachable_at, anti-trote v29.208.0): a mensagem não
--     chegaria, e é o padrão do trote.
--   * Registro apagado pelo "Excluir registro" do painel: some de bookings, some daqui. O arquivo da
--     migração 178 (cancelamentos_arquivados) serve à regra do sinal, não a esta.
--
-- Etapas (nunca uma 3ª — quem não respondeu a dois lembretes não quer um terceiro):
--   etapa 1 → passaram ≥ 7 dias do cancelamento e nunca houve customer_outreach_log kind='followup_cancelado'
--             para esse telefone (comparado por phone_match_key(l.phone), porque o lead pode não ter perfil);
--   etapa 2 → passaram ≥ 30 dias e houve exatamente 1 contato anterior;
--   cooldown (p_cooldown_days) entre um contato e outro, como na reativação.
--
-- SEM cron novo: a function customer-reactivation (cron job 6, ter–sáb 14h fora do quiet) chama esta RPC
-- num segundo laço, logo depois do laço da reativação, com as mesmas proteções (conversa nos últimos
-- 7 dias, contato adiado, only_phone, dry_run). customer_outreach_log.customer_id já aceita null (036)
-- — o lead sem cadastro entra no log só pelo telefone.

create or replace function public.leads_cancelled_due_for_followup(
  p_cooldown_days integer default 14
)
returns table(customer_id uuid, name text, phone text, last_booking_date date, days_since_cancel integer, service_name text, stage integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  with chaves as (
    -- Telefones que nunca tiveram visita concluída (em nenhum canal).
    select public.phone_match_key(b.customer_phone) as k
    from public.bookings b
    where length(regexp_replace(b.customer_phone, '\D', '', 'g')) >= 10
    group by public.phone_match_key(b.customer_phone)
    having count(*) filter (where b.status = 'completed') = 0
  ),
  ultimo as (
    -- Último agendamento de cada telefone, ignorando a Senha Digital ('porta').
    select distinct on (public.phone_match_key(b.customer_phone))
           public.phone_match_key(b.customer_phone) as k,
           b.customer_name, b.customer_phone, b.booking_date, b.service_name, b.status,
           b.customer_cancelled_at, b.whatsapp_unreachable_at,
           case when b.status = 'cancelled' then (b.customer_cancelled_at at time zone 'America/Sao_Paulo')::date
                else b.booking_date end as quando
    from public.bookings b
    join chaves c on c.k = public.phone_match_key(b.customer_phone)
    where coalesce(b.channel, 'site') <> 'porta'
    order by public.phone_match_key(b.customer_phone), b.booking_date desc, b.start_time desc
  ),
  leads as (
    select u.*,
           (current_date - u.quando) as dias,
           (select count(*)::int from public.customer_outreach_log l
             where l.kind = 'followup_cancelado' and public.phone_match_key(l.phone) = u.k) as ja_enviados,
           (select max(l.created_at) from public.customer_outreach_log l
             where l.kind = 'followup_cancelado' and public.phone_match_key(l.phone) = u.k) as ultimo_envio,
           (select p.id from public.customer_profiles p
             where public.phone_match_key(p.phone) = u.k
             order by p.archived asc, p.updated_at desc limit 1) as perfil_id
    from ultimo u
    where (
        u.status = 'no_show'
        -- Cancelado pelo próprio cliente; sem customer_cancelled_at foi o painel ou o sinal vencido.
        or (u.status = 'cancelled' and u.customer_cancelled_at is not null)
      )
      and u.whatsapp_unreachable_at is null
  )
  select l.perfil_id as customer_id,
         coalesce((select p.name from public.customer_profiles p where p.id = l.perfil_id), l.customer_name) as name,
         l.customer_phone as phone,
         l.booking_date as last_booking_date,
         l.dias as days_since_cancel,
         l.service_name,
         (l.ja_enviados + 1) as stage
  from leads l
  where l.dias <= 120
    and (
      (l.ja_enviados = 0 and l.dias >= 7)
      or (l.ja_enviados = 1 and l.dias >= 30)
    )
    and (l.ultimo_envio is null or l.ultimo_envio <= now() - make_interval(days => p_cooldown_days))
    and not exists (
      select 1 from public.bookings f
      where public.phone_match_key(f.customer_phone) = l.k
        and f.status in ('pending', 'confirmed')
        and f.booking_date >= current_date
    )
    and not exists (
      select 1 from public.blocked_customers bc
      where public.phone_match_key(bc.customer_phone) = l.k
    )
    -- Com cadastro: qualquer perfil desse telefone arquivado, sem pesquisa ou com SAIR tira o lead.
    and not exists (
      select 1 from public.customer_profiles p
      where public.phone_match_key(p.phone) = l.k
        and (p.archived = true or coalesce(p.survey_opt_out, false) = true or p.marketing_opt_out_at is not null)
    )
  order by l.quando asc
  limit 50
$$;

revoke all on function public.leads_cancelled_due_for_followup(integer) from public, anon, authenticated;
grant execute on function public.leads_cancelled_due_for_followup(integer) to service_role;

-- (Sem índice por phone_match_key(phone): a função não é IMMUTABLE e o Postgres recusa; o log é
-- pequeno e a consulta é diária. Aplicado assim em 26/09/2026.)

notify pgrst, 'reload schema';

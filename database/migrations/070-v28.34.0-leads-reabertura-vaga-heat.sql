-- Barbearia do Ju — v28.34.0
-- Item 0 do funil de reativação avançado (pedido explícito do Juliano, 2026-08-01,
-- escopo que tinha sido deliberadamente cortado na v28.31.0): reabertura de vaga
-- proativa, pontuação quente/morno/frio, base pra campanha por interesse antigo.

alter table public.conversation_leads
  add column if not exists slot_reopened_at timestamptz,
  add column if not exists slot_reopened_notified_at timestamptz,
  add column if not exists campaign_sent_at timestamptz;

comment on column public.conversation_leads.slot_reopened_at is 'Preenchido pelo trigger bookings_notify_leads_slot_reopened quando um agendamento que ocupava a data que este lead queria (date_interest) é cancelado ou reagendado pra outro dia. O cron whatsapp-lead-followup lê este campo e avisa o cliente.';
comment on column public.conversation_leads.campaign_sent_at is 'Marcado quando uma campanha manual (conversation-leads-campaign, disparo sob demanda pelo admin) já mandou mensagem pra este lead — evita reenviar a mesma campanha em menos de 24h.';

-- Trigger: cobre cancelamento E reagendamento de QUALQUER origem (admin, site,
-- WhatsApp) porque todas as rotas (admin-booking-status, customer_cancel_booking_v25,
-- whatsapp_cancel_booking, phone_reschedule_booking, admin_reschedule_booking,
-- customer_reschedule_booking_v25, o auto-cancelamento de whatsapp-booking-confirmation)
-- no fim das contas fazem um UPDATE direto em public.bookings — um trigger na tabela
-- pega todas de uma vez, sem precisar caçar cada call site em TypeScript.
create or replace function public.notify_conversation_leads_slot_reopened()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.status in ('pending','confirmed') and (new.status = 'cancelled' or new.booking_date <> old.booking_date) then
    update public.conversation_leads
    set slot_reopened_at = now()
    where kind = 'availability'
      and date_interest = old.booking_date
      and slot_reopened_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_notify_leads_slot_reopened on public.bookings;
create trigger bookings_notify_leads_slot_reopened
after update on public.bookings
for each row
when (old.status is distinct from new.status or old.booking_date is distinct from new.booking_date)
execute function public.notify_conversation_leads_slot_reopened();

-- View de pontuação quente/morno/frio — cálculo ao vivo (não armazenado), pra nunca
-- ficar desatualizado. Prioridade: motivo explícito respondido > kind > decaimento por
-- tempo (lead que esfriou pelo silêncio vira frio mesmo que tivesse motivo/kind quente).
create or replace view public.conversation_leads_scored as
select
  cl.*,
  case
    when cl.last_message_at < now() - interval '10 days'
      and coalesce(cl.reason,'') not in ('sem_horario_desejado')
      then 'frio'
    when cl.reason = 'sem_horario_desejado' then 'quente'
    when cl.reason = 'preco' then 'morno'
    when cl.reason = 'so_pesquisando' then 'frio'
    when cl.reason = 'outro' then 'morno'
    when cl.kind = 'availability' then 'quente'
    when cl.kind = 'price_or_service' then 'morno'
    else 'frio'
  end as heat
from public.conversation_leads cl;

comment on view public.conversation_leads_scored is 'conversation_leads + coluna heat (quente/morno/frio), calculada ao vivo. Usada pelo painel admin-leads.html. Heurística: motivo explícito respondido (reason) tem prioridade sobre o kind original; silêncio de 10+ dias sempre esfria pra frio (exceto quem só esperava horário, esse continua quente até responder ou sumir de vez).';

-- IMPORTANTE: sem security_invoker, a view roda com o privilégio do dono (postgres) e
-- IGNORA a RLS de conversation_leads — qualquer authenticated (inclusive cliente logado
-- na área do cliente) veria os leads de todo mundo. Mesma classe de bug já achada antes
-- (v27_customer_metrics, migration 059).
alter view public.conversation_leads_scored set (security_invoker = true);

alter table public.conversation_leads enable row level security;
drop policy if exists conversation_leads_admin_select on public.conversation_leads;
create policy conversation_leads_admin_select on public.conversation_leads
  for select using (is_admin());

grant select on public.conversation_leads to authenticated;
grant select on public.conversation_leads_scored to authenticated, service_role;

notify pgrst, 'reload schema';

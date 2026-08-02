-- Barbearia do Ju — v28.40.0
-- Item 1 da lista de sugestões (pedido explícito do Juliano, 2026-08-02): fechar o loop
-- da lista de espera. Hoje, quando uma vaga compatível abre, só o Juliano é avisado
-- (push) e o encaixe é manual em admin-espera.html. Agora a JuIA também avisa o CLIENTE
-- da lista de espera direto pelo WhatsApp, perguntando se ainda quer aquele horário — só
-- cria o agendamento de fato depois do "sim" explícito dele (nunca automático).

alter table public.waitlist
  add column if not exists offered_date date,
  add column if not exists offered_start_time time;

comment on column public.waitlist.offered_date is 'Data do horário oferecido automaticamente (preenchido pelo trigger bookings_notify_waitlist_slot_reopened). Limpo quando o cliente recusa ou quando o encaixe é confirmado.';
comment on column public.waitlist.offered_start_time is 'Horário oferecido automaticamente, junto com offered_date. O cron whatsapp-lead-followup lê esses dois campos pra mandar a mensagem proativa.';

-- Trigger: mesmo padrão do item 0 (bookings_notify_leads_slot_reopened, migration 070) —
-- cobre cancelamento E reagendamento de QUALQUER origem (admin, site, WhatsApp, auto-
-- cancelamento), porque todas as rotas no fim das contas fazem um UPDATE direto em
-- public.bookings. Diferença: aqui a granularidade é por HORÁRIO exato (não só a data),
-- porque waitlist_matches_for_slot precisa da hora pra casar turno/janela de horário. Só
-- marca UM candidato (o mais antigo na fila cujo pedido de duração realmente cabe no
-- horário liberado, verificado via get_available_slots) — evita notificar várias pessoas
-- pro mesmo horário e criar corrida/confusão.
create or replace function public.notify_waitlist_slot_reopened()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_candidate record;
begin
  if old.status in ('pending','confirmed') and (new.status = 'cancelled' or new.booking_date <> old.booking_date or new.start_time <> old.start_time) then
    for v_candidate in
      select * from public.waitlist_matches_for_slot(old.booking_date, old.start_time)
      order by created_at asc
    loop
      if exists (
        select 1 from public.get_available_slots(old.booking_date, coalesce(v_candidate.duration_minutes, 30)) s
        where s.slot_time = old.start_time
      ) then
        update public.waitlist
        set status = 'avisado',
            offered_date = old.booking_date,
            offered_start_time = old.start_time,
            notified_at = null,
            updated_at = now()
        where id = v_candidate.id;
        exit;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_notify_waitlist_slot_reopened on public.bookings;
create trigger bookings_notify_waitlist_slot_reopened
after update on public.bookings
for each row
when (old.status is distinct from new.status or old.booking_date is distinct from new.booking_date or old.start_time is distinct from new.start_time)
execute function public.notify_waitlist_slot_reopened();

-- RPC: cliente confirma o horário oferecido (via WhatsApp, depois do "sim" explícito).
-- Reaproveita create_public_booking_v15 pra herdar TODA a validação de segurança que já
-- existe lá (data futura, antecedência mínima, dia/horário de funcionamento, bloqueios,
-- e — principal — reconfere que o horário continua livre, já que pode ter sido ocupado
-- por outra pessoa entre a oferta e a confirmação).
create or replace function public.phone_confirm_waitlist_booking(p_phone text, p_waitlist_id uuid)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_wl public.waitlist%rowtype;
  v_booking_id uuid;
begin
  select * into v_wl from public.waitlist where id = p_waitlist_id for update;
  if not found then raise exception 'Pedido de lista de espera não encontrado.'; end if;
  if public.phone_match_key(v_wl.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este pedido de lista de espera não pertence a este telefone.';
  end if;
  if v_wl.status <> 'avisado' or v_wl.offered_date is null or v_wl.offered_start_time is null then
    raise exception 'Não há vaga oferecida pendente de confirmação pra este pedido.';
  end if;

  v_booking_id := public.create_public_booking_v15(
    p_customer_name => v_wl.customer_name,
    p_customer_phone => v_wl.customer_phone,
    p_customer_email => v_wl.customer_email,
    p_service_name => coalesce(v_wl.service_name, 'Corte de cabelo'),
    p_service_price => coalesce(v_wl.service_price, 0),
    p_duration_minutes => coalesce(v_wl.duration_minutes, 30),
    p_booking_date => v_wl.offered_date,
    p_start_time => v_wl.offered_start_time,
    p_notes => 'Confirmado pela JuIA a partir da lista de espera'
  );

  update public.waitlist
  set status = 'encaixado', booking_id = v_booking_id, scheduled_at = now(), updated_at = now()
  where id = v_wl.id;

  return query select * from public.bookings where id = v_booking_id;
end;
$$;

-- RPC: acha a oferta pendente de confirmação pra um telefone (usada pelo whatsapp-webhook
-- pra saber se a próxima mensagem do cliente é uma resposta sim/não à oferta, ANTES de
-- cair no fluxo normal da JuIA — mesmo padrão de find_pending_confirmation_by_phone).
create or replace function public.find_pending_waitlist_offer_by_phone(p_phone text)
returns setof waitlist
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.waitlist
  where public.phone_match_key(customer_phone) = public.phone_match_key(p_phone)
    and status = 'avisado'
    and offered_date is not null
    and offered_start_time is not null
    and notified_at is not null
  order by notified_at desc
  limit 1;
$$;

-- Hardening: mesmo padrão do resto do projeto (migration 047 etc.) — essas funções só
-- fazem sentido chamadas por edge functions com service_role, nunca direto pelo cliente.
revoke all on function public.phone_confirm_waitlist_booking(text, uuid) from public, anon, authenticated;
revoke all on function public.find_pending_waitlist_offer_by_phone(text) from public, anon, authenticated;
revoke all on function public.notify_waitlist_slot_reopened() from public, anon, authenticated;

grant execute on function public.phone_confirm_waitlist_booking(text, uuid) to service_role;
grant execute on function public.find_pending_waitlist_offer_by_phone(text) to service_role;

notify pgrst, 'reload schema';

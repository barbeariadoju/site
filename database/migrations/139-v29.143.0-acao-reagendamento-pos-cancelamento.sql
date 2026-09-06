-- v29.143.0 — booking_customer_actions aceita 'rebooked_after_admin_cancellation'.
--
-- A function create-rebooking grava essa ação desde a v26.5 (migration 026), mas o CHECK
-- da coluna (migration 021, ampliado com 'service_changed' depois) nunca recebeu o valor:
-- todo reagendamento pelo link do cancelamento falhava o insert em silêncio (só um
-- console.error no log da function). Descoberto no caso Sabrino, 06/09/2026, ao rastrear
-- de onde tinha saído um agendamento estranho.

alter table public.booking_customer_actions
  drop constraint if exists booking_customer_actions_action_check;

alter table public.booking_customer_actions
  add constraint booking_customer_actions_action_check
  check (action in ('created_link','viewed','cancelled','rescheduled','service_changed','rebooked_after_admin_cancellation'));

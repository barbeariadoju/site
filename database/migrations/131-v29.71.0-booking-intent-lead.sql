-- v29.71.0 — kind novo 'booking_intent' em conversation_leads (caso Fernando, 25/08/2026):
-- cliente que pede pra marcar sem dizer o serviço e some no meio da conversa. O ju-ia-site
-- grava o lead com esse kind e o whatsapp-lead-followup manda o "ainda estou por aqui"
-- (+ link do site como alternativa) ~30 min depois, em vez de esperar as 2h dos demais.
alter table public.conversation_leads drop constraint conversation_leads_kind_check;
alter table public.conversation_leads add constraint conversation_leads_kind_check
  check (kind = any (array['greeting'::text, 'price_or_service'::text, 'availability'::text, 'booking_intent'::text]));

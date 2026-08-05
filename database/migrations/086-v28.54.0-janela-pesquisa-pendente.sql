-- v28.54.0 — Corrige janela de "pesquisa de satisfação pendente" (30 dias → 48h)
--
-- Bug real (caso Juliano Prando, 05/08/2026): find_pending_experience_by_phone considerava
-- qualquer pesquisa enviada nos últimos 30 DIAS como "pendente" — uma pesquisa de 28/07 nunca
-- respondida ficou sequestrando qualquer mensagem curta nova do cliente ("Fala Ju", "Tudo bem?")
-- com "Não entendi... satisfeito ou insatisfeito?" por mais de uma semana depois.
-- Como as pesquisas hoje são disparadas imediatamente após a conclusão do atendimento
-- (migration 083, "pra não esfriar"), 48h já é bastante tempo pra uma resposta legítima.

create or replace function public.find_pending_experience_by_phone(p_phone text)
returns table(id uuid, token uuid, status text, customer_id uuid, booking_id uuid, customer_name text, request_google_review boolean)
language sql
security definer
set search_path to 'public'
as $function$
  select e.id, e.token, e.status, e.customer_id, e.booking_id, b.customer_name, e.request_google_review
  from public.experience_requests e
  join public.bookings b on b.id = e.booking_id
  where (e.status in ('sent','opened') or (e.status='feedback' and e.feedback is null))
    and e.created_at > now() - interval '48 hours'
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
  order by e.created_at desc
  limit 1
$function$;

-- Limpeza retroativa: pesquisas já com mais de 48h e nunca respondidas viram 'expired'
-- (efeito imediato só de documentação/relatório — a função acima já as ignora sozinha).
update public.experience_requests
set status = 'expired',
    last_error = 'Expirada retroativamente (fix 2026-08-05, migration 086): pesquisa enviada há mais de 48h sem resposta, ficava sequestrando qualquer mensagem curta futura do cliente no WhatsApp.',
    updated_at = now()
where status in ('sent','opened') and created_at < now() - interval '48 hours';

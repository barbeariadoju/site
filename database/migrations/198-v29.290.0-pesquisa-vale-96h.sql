-- v29.290.0 — caso Marcus (13/10/2026, 10h15): o comprovante com a pesquisa saiu no sábado 10/10 às 11h24
-- e ele respondeu "1" na terça de manhã — 71h depois, porque domingo e segunda a barbearia não abre. A
-- janela era de 48h, a resposta caiu na JuIA e voltou "Você pode me explicar um pouco melhor o que precisa?".
-- 96h cobre sábado → terça. Quem já conversou com a JuIA depois da pesquisa continua indo pra JuIA
-- (juiaFalouDepoisDaPesquisa, no whatsapp-webhook).

CREATE OR REPLACE FUNCTION public.find_pending_experience_by_phone(p_phone text)
 RETURNS TABLE(id uuid, token uuid, status text, customer_id uuid, booking_id uuid, customer_name text, request_google_review boolean, sent_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id, e.token, e.status, e.customer_id, e.booking_id, b.customer_name, e.request_google_review, e.sent_at
  from public.experience_requests e
  join public.bookings b on b.id = e.booking_id
  where (e.status in ('sent','opened') or (e.status='feedback' and e.feedback is null))
    and (
      e.created_at > now() - interval '96 hours'
      or (e.last_recovery_at is not null and e.last_recovery_at > now() - interval '96 hours')
    )
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
  order by e.created_at desc
  limit 1
$function$;

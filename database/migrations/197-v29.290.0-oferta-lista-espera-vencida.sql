-- v29.290.0 — caso Frei (13/10/2026, 07h28 e 08h17): a oferta da lista de espera de 09/10 às 16:45
-- ficou com status 'avisado' depois que o horário passou. Quatro dias depois, "Paz e bem!" e
-- "Terça ou quarta tem vaga?" receberam "Só confirmando: você ainda quer o horário de 09/10/2026
-- às 16:45?" — o webhook trata toda mensagem curta como resposta a essa oferta.
-- Oferta cujo horário já passou não é mais oferta: a busca ignora, e as vencidas viram 'expirado'.

create or replace function public.find_pending_waitlist_offer_by_phone(p_phone text)
returns setof public.waitlist
language sql
stable security definer
set search_path to 'public'
as $function$
  select * from public.waitlist
  where public.phone_match_key(customer_phone) = public.phone_match_key(p_phone)
    and status = 'avisado'
    and offered_date is not null
    and offered_start_time is not null
    and notified_at is not null
    and (offered_date + offered_start_time) > (now() at time zone 'America/Sao_Paulo')
  order by notified_at desc
  limit 1;
$function$;

update public.waitlist
   set status = 'expirado', updated_at = now()
 where status = 'avisado'
   and (offered_date is null or offered_start_time is null
        or (offered_date + offered_start_time) <= (now() at time zone 'America/Sao_Paulo'));

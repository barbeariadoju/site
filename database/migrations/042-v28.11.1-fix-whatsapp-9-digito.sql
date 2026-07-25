-- 042-v28.11.1-fix-whatsapp-9-digito.sql
--
-- Bug: cliente respondeu a pesquisa de satisfacao pelo WhatsApp (emoji 😊) e a
-- JuIA nao reconheceu nem a pesquisa pendente nem o proprio cliente, caindo no
-- fluxo generico ("Como posso ajudar voce hoje?") em vez de mandar o link de
-- avaliacao do Google.
--
-- Causa raiz: o WhatsApp (Evolution/Baileys) as vezes manda o remoteJid do
-- numero SEM o "9" que precede o numero de celular (formato antigo de 8
-- digitos locais), mesmo quando o numero cadastrado tem o "9" (formato atual
-- de 9 digitos). Isso fazia os digitos nao baterem em qualquer comparacao de
-- telefone baseada nos ultimos 10/11 digitos, tanto na busca da pesquisa de
-- satisfacao pendente (find_pending_experience_by_phone) quanto no
-- reconhecimento do cliente pela JuIA (get_customer_commercial_context).
--
-- Exemplo real: cadastro "5535999469866" (13 digitos, com o 9) x remoteJid
-- recebido "553599469866" (12 digitos, sem o 9) — os ultimos 8 digitos
-- locais ("99469866") sao iguais, so o "9" que falta.
--
-- Correcao: phone_match_key() normaliza qualquer formato (com/sem 55, com/sem
-- o 9) para "DDD + 8 digitos locais", ignorando o 9 opcional. Aplicado nas
-- duas funcoes que participam desse fluxo.

create or replace function public.phone_match_key(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when length(d) = 13 then substr(d, 3, 2) || substr(d, 6, 8)  -- 55 + DDD + 9 + local8
    when length(d) = 12 then substr(d, 3, 2) || substr(d, 5, 8)  -- 55 + DDD + local8
    when length(d) = 11 then substr(d, 1, 2) || substr(d, 4, 8)  -- DDD + 9 + local8
    when length(d) = 10 then substr(d, 1, 2) || substr(d, 3, 8)  -- DDD + local8
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s
$$;

create or replace function public.find_pending_experience_by_phone(p_phone text)
 returns table(id uuid, token uuid, status text, customer_id uuid, booking_id uuid, customer_name text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select e.id, e.token, e.status, e.customer_id, e.booking_id, b.customer_name
  from public.experience_requests e
  join public.bookings b on b.id = e.booking_id
  where (e.status in ('sent','opened') or (e.status='feedback' and e.feedback is null))
    and e.created_at > now() - interval '30 days'
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
  order by e.created_at desc
  limit 1
$function$;

create or replace function public.get_customer_commercial_context(p_phone text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_phone text:=public.phone_match_key(p_phone); v_result jsonb;
begin
 select jsonb_build_object(
   'customer_id',c.id,'name',c.name,'email',c.email,'birth_date',c.birth_date,'vip',c.vip,
   'preferred_services',c.preferred_services,'style_preferences',c.style_preferences,
   'favorite_products',c.favorite_products,'internal_tags',c.internal_tags,
   'preferred_payment',c.preferred_payment,'return_interval_days',c.return_interval_days,
   'points',coalesce(l.points,0),'rewards_available',coalesce(l.rewards_available,0),
   'completed_visits',(select count(*) from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status='completed'),
   'last_services',(select b.service_name from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
   'last_visit',(select b.booking_date from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
   'last_products',(select b.selected_products from public.bookings b where public.phone_match_key(b.customer_phone)=v_phone and jsonb_array_length(coalesce(b.selected_products,'[]'::jsonb))>0 order by b.booking_date desc limit 1)
 ) into v_result
 from public.customer_profiles c left join public.loyalty_accounts l on l.customer_id=c.id
 where public.phone_match_key(c.phone)=v_phone and c.archived=false limit 1;
 return coalesce(v_result,'{}'::jsonb);
end $function$;

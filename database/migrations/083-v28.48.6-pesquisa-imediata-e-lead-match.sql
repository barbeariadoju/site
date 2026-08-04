-- 083-v28.48.6: (1) pesquisa de satisfação IMEDIATA na conclusão (pedido do Juliano,
-- 04/08/2026: "enviar logo que a gente conclui pra não esfriar" — o atraso de 2h era
-- decisão antiga e gerou saia justa real com cliente pedindo o link). O envio efetivo
-- acontece no próximo ciclo do satisfaction-dispatch (cron de 15 em 15 min).
-- (2) lead_booking_exists: o isResolved do funil comparava telefone com igualdade exata
-- (lead.phone tem DDI 55 do remoteJid; bookings.customer_phone às vezes não tem) — a JuIA
-- mandou "ainda tem interesse?" pro Guilherme 1h depois de ele ser ATENDIDO (caso real).
-- Comparação canônica via phone_match_key, mesma lição das migrations 042/046/047.
-- (aplicada no banco via MCP como "083_v28_48_6_pesquisa_imediata_e_lead_match")

create or replace function public.v27_queue_experience_after_completion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_customer uuid;
begin
  if new.status='completed' and (TG_OP = 'INSERT' or coalesce(old.status,'') <> 'completed') then
    v_customer := public.v27_customer_for_booking(new);

    insert into public.customer_timeline(customer_id,booking_id,event_type,title,details)
    values(v_customer,new.id,'booking_completed','Atendimento concluído',jsonb_build_object(
      'services',new.service_name,
      'value',coalesce(new.service_price,0)+coalesce(new.products_price,0),
      'date',new.booking_date,
      'time',new.start_time
    ));

    insert into public.experience_requests(booking_id,customer_id,scheduled_for,request_google_review)
    values(new.id,v_customer,now(),coalesce(new.request_google_review,true))
    on conflict(booking_id) do update set
      customer_id=excluded.customer_id,
      scheduled_for=excluded.scheduled_for,
      request_google_review=excluded.request_google_review,
      status=case when public.experience_requests.status in ('failed','expired') then 'pending' else public.experience_requests.status end,
      last_error=null,
      updated_at=now();
  end if;
  return new;
end $function$;

create or replace function public.lead_booking_exists(p_phone text, p_since timestamptz)
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists(
    select 1 from public.bookings b
    where b.status in ('pending','confirmed','completed')
      and b.created_at >= p_since
      and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
  )
$function$;
revoke all on function public.lead_booking_exists(text, timestamptz) from public, anon, authenticated;
grant execute on function public.lead_booking_exists(text, timestamptz) to service_role;

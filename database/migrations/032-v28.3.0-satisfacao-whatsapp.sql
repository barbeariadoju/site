-- Barbearia do Ju — V28.3.0
-- Corrige o bug em get_experience_context/submit_experience_response (colunas
-- inexistentes feedback_text/responded_at/review_clicked_at — a tabela real
-- usa feedback/answered_at/google_clicked_at, como já usado pelo admin em
-- crm-v27.js). Também libera a fila de pesquisa de satisfação para clientes
-- sem e-mail (agora priorizamos WhatsApp) e relaxa a validação de feedback
-- pra permitir marcar "insatisfeito" antes do texto da sugestão chegar.

create or replace function public.get_experience_context(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  update public.experience_requests
    set opened_at=coalesce(opened_at,now()),
        status=case when status='sent' then 'opened' else status end,
        updated_at=now()
  where token=p_token and status not in ('expired','failed');

  select jsonb_build_object(
    'valid',true,
    'status',e.status,
    'first_name',split_part(trim(b.customer_name),' ',1),
    'booking_date',b.booking_date,
    'services',b.service_name,
    'feedback_text',e.feedback
  ) into v_result
  from public.experience_requests e
  join public.bookings b on b.id=e.booking_id
  where e.token=p_token
    and e.created_at > now()-interval '30 days';

  return coalesce(v_result,jsonb_build_object('valid',false));
end $$;

create or replace function public.submit_experience_response(
  p_token uuid,
  p_response text,
  p_feedback text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_req public.experience_requests%rowtype; v_title text;
begin
  select * into v_req from public.experience_requests
  where token=p_token and created_at > now()-interval '30 days'
  for update;
  if v_req.id is null then return jsonb_build_object('ok',false,'error','Link inválido ou expirado.'); end if;

  if p_response='satisfied' then
    update public.experience_requests set status='satisfied',answer='satisfied',answered_at=now(),updated_at=now() where id=v_req.id;
    v_title:='Cliente informou que ficou satisfeito';
  elsif p_response='feedback' then
    if p_feedback is not null and char_length(trim(p_feedback)) < 3 then
      return jsonb_build_object('ok',false,'error','Escreva uma breve sugestão.');
    end if;
    update public.experience_requests set
      status='feedback',
      answer='feedback',
      feedback=coalesce(nullif(left(trim(p_feedback),2000),''), feedback),
      answered_at=coalesce(answered_at,now()),
      updated_at=now()
    where id=v_req.id;
    v_title:='Sugestão privada recebida';
  elsif p_response='review_clicked' then
    update public.experience_requests set status='review_clicked',google_clicked_at=now(),updated_at=now() where id=v_req.id;
    v_title:='Cliente abriu a avaliação do Google';
  else
    return jsonb_build_object('ok',false,'error','Resposta inválida.');
  end if;

  insert into public.customer_timeline(customer_id,booking_id,event_type,title,details)
  values(v_req.customer_id,v_req.booking_id,p_response,v_title,
    case when p_response='feedback' and p_feedback is not null then jsonb_build_object('feedback',left(trim(p_feedback),2000)) else '{}'::jsonb end);

  return jsonb_build_object('ok',true,'status',p_response);
end $$;

-- Antes só enfileirava pesquisa de satisfação pra quem tinha e-mail. Agora o
-- WhatsApp é o canal principal, então enfileira pra todo atendimento concluído.
create or replace function public.v27_queue_experience_after_completion()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer uuid;
begin
  if new.status='completed' and coalesce(old.status,'') <> 'completed' then
    v_customer := public.v27_customer_for_booking(new);

    insert into public.customer_timeline(customer_id,booking_id,event_type,title,details)
    values(v_customer,new.id,'booking_completed','Atendimento concluído',jsonb_build_object(
      'services',new.service_name,
      'value',coalesce(new.service_price,0)+coalesce(new.products_price,0),
      'date',new.booking_date,
      'time',new.start_time
    ));

    insert into public.experience_requests(booking_id,customer_id,scheduled_for)
    values(new.id,v_customer,now()+interval '2 hours')
    on conflict(booking_id) do update set
      customer_id=excluded.customer_id,
      scheduled_for=excluded.scheduled_for,
      status=case when public.experience_requests.status in ('failed','expired') then 'pending' else public.experience_requests.status end,
      last_error=null,
      updated_at=now();
  end if;
  return new;
end $$;

-- Acha a pesquisa de satisfação pendente (ou aguardando o texto da sugestão)
-- pelo telefone de WhatsApp, comparando os últimos 11 dígitos pra não
-- depender do prefixo 55.
create or replace function public.find_pending_experience_by_phone(p_phone text)
returns table(id uuid, token uuid, status text, customer_id uuid, booking_id uuid, customer_name text)
language sql security definer set search_path=public as $$
  select e.id, e.token, e.status, e.customer_id, e.booking_id, b.customer_name
  from public.experience_requests e
  join public.bookings b on b.id = e.booking_id
  where (e.status in ('sent','opened') or (e.status='feedback' and e.feedback is null))
    and right(regexp_replace(b.customer_phone,'\D','','g'), 11) = right(regexp_replace(p_phone,'\D','','g'), 11)
  order by e.created_at desc
  limit 1
$$;

grant execute on function public.find_pending_experience_by_phone(text) to service_role;

-- Já pediu avaliação no Google alguma vez pra esse cliente? (best-effort —
-- só sabemos se ele clicou nosso link antes, não se avaliou por fora dele).
create or replace function public.customer_already_reviewed(p_customer_id uuid)
returns boolean language sql security definer set search_path=public as $$
  select exists(
    select 1 from public.experience_requests
    where customer_id = p_customer_id and google_clicked_at is not null
  )
$$;

grant execute on function public.customer_already_reviewed(uuid) to service_role;

notify pgrst, 'reload schema';

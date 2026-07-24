-- Barbearia do Ju — V28.4.2
-- CORREÇÃO CRÍTICA de regressão introduzida na V28.3.0 (migration 032).
--
-- Sintoma: cliente que respondia 🙁 (insatisfeito) na pesquisa de satisfação
-- NUNCA recebia a oferta de retoque grátis, e o Juliano não recebia o alerta.
-- A resposta caía no fluxo genérico da JuIA como se fosse conversa comum.
--
-- Causa: submit_experience_response gravava answer='feedback', mas a coluna
-- answer tem CHECK que só aceita NULL, 'satisfied' ou 'suggestion'. O UPDATE
-- estourava a constraint, a função abortava, o webhook recebia ok:false e
-- seguia para o fluxo normal — falha silenciosa. O caminho 😊 funcionava
-- porque answer='satisfied' é um valor válido.
--
-- Correção: usar answer='suggestion' (valor permitido). O status continua
-- 'feedback', que é válido no check de status e é o campo que o admin lê.

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
      answer='suggestion',
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

notify pgrst, 'reload schema';

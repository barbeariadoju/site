-- v29.340.0 — pedido do Juliano (04/11/2026, depois do caso Lucas): o texto da política de falta ("ficou registrado
-- como falta... a cadeira fica parada e a gente sente bastante") só sai para quem já faltou pelo menos 2 vezes.
-- Na primeira falta a JuIA responde normalmente. Esta função conta todas as faltas (no_show) do telefone, pela
-- mesma chave de telefone das outras funções, sem janela de data.
create or replace function public.phone_no_show_count(p_phone text)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::integer
  from public.bookings b
  where b.status = 'no_show'
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
$function$;

revoke all on function public.phone_no_show_count(text) from public, anon, authenticated;
grant execute on function public.phone_no_show_count(text) to service_role;

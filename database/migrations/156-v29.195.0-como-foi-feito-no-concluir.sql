-- v29.195.0 (16/09/2026) — "Como foi feito" na tela Concluir e no Balcão, lembrete no card.
--
-- Pedido do Juliano (16/09/2026, caso Tatiane: "ontem fiz 2 cortes nela pra chegar neste
-- resultado"): "pra mim seria mais fácil se tivesse como eu colocar estas observações na tela
-- Concluir, assim no próximo atendimento viria um lembrete igual aparece os serviços: máquina 1
-- dos lados e 4 em cima, ou corte todo na tesoura, ou degradê alto navalhado".
--
-- O dado já existia: customer_profiles.style_preferences (jsonb {item_1: "...", item_2: "..."},
-- o campo "Preferências de estilo" da tela Clientes, admin_save_customer_v23). Esta RPC grava
-- só esse campo, a partir de um texto livre separado por vírgula, " · " ou quebra de linha —
-- é o que o Concluir e o Balcão chamam. O cadastro é achado pela chave do telefone (últimos 8
-- dígitos, a mesma regra de uq_customer_profiles_phone_key); sem cadastro, nada é criado
-- (o admin já cria a ficha ao abrir, v29.12.0).

create or replace function public.admin_set_customer_style(p_phone text, p_style text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_items text[];
  v_json jsonb := '{}'::jsonb;
  v_i int := 0;
  v_item text;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if length(v_key) < 8 then return jsonb_build_object('ok', false, 'error', 'telefone inválido'); end if;

  select id into v_id from customer_profiles where phone_key = v_key and coalesce(archived, false) = false
   order by updated_at desc nulls last limit 1;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'cadastro não encontrado'); end if;

  v_items := regexp_split_to_array(coalesce(p_style, ''), E'\\s*(,|;|·|\\n)\\s*');
  foreach v_item in array v_items loop
    v_item := btrim(v_item);
    if v_item <> '' then
      v_i := v_i + 1;
      v_json := v_json || jsonb_build_object('item_' || v_i, v_item);
    end if;
  end loop;

  update customer_profiles set style_preferences = v_json, updated_at = now() where id = v_id;
  return jsonb_build_object('ok', true, 'customer_id', v_id, 'items', v_i, 'style_preferences', v_json);
end $$;
revoke all on function public.admin_set_customer_style(text, text) from public;
grant execute on function public.admin_set_customer_style(text, text) to authenticated, service_role;

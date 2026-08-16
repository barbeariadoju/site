-- Barbearia do Ju — v29.34.0 — Reajuste de preço pelo painel
--
-- Pedido do Juliano em 16/08/2026: "se tivesse quando precisar reajustar eu mesmo faço sem
-- precisar pedir nada pra vc". Até aqui o preço de venda só mudava editando
-- products-catalog-v1.js no repositório — ou seja, dependia de mim.
--
-- IMPORTANTE, e o motivo de esta migration vir acompanhada de mudança no front-end: o preço
-- vivia em DOIS lugares — esta tabela e o arquivo estático products-catalog-v1.js, que é o
-- que o site, a agenda e o balcão realmente leem. Liberar a edição só aqui deixaria o
-- cliente pagando um valor e o sistema calculando outro, com a diferença aparecendo no
-- repasse do parceiro. O arquivo passou a buscar os preços desta tabela ao carregar; a
-- lista estática dele ficou como fallback de rede fora.
--
-- Substitui admin_set_product_cost (migration 113), que só mexia no custo.

create or replace function public.admin_update_product(
  p_product_id uuid,
  p_price numeric default null,
  p_cost numeric default null,
  p_track_stock boolean default null
)
returns table (id uuid, name text, price numeric, cost_price numeric)
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'Preço inválido.';
  end if;
  if p_cost is not null and p_cost < 0 then
    raise exception 'Custo inválido.';
  end if;
  -- Vender abaixo do custo não é proibido (pode ser queima de estoque), mas não pode passar
  -- despercebido: sem este aviso, um erro de digitação viraria cota-parte sobre lucro
  -- negativo e só apareceria no fechamento da semana.
  if p_price is not null and p_cost is not null and p_price < p_cost then
    raise exception 'Preço (%) menor que o custo (%). Confira os valores.', p_price, p_cost;
  end if;

  return query
  update public.products p set
    price = coalesce(p_price, p.price),
    cost_price = coalesce(p_cost, p.cost_price),
    track_stock = coalesce(p_track_stock, p.track_stock),
    updated_at = now()
  where p.id = p_product_id
  returning p.id, p.name, p.price, p.cost_price;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;
end;
$fn$;

revoke execute on function public.admin_update_product(uuid, numeric, numeric, boolean) from public, anon;
grant execute on function public.admin_update_product(uuid, numeric, numeric, boolean) to authenticated;

drop function if exists public.admin_set_product_cost(uuid, numeric, boolean);

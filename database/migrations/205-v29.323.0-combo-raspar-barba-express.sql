-- v29.323.0 — combo Raspar a cabeça + Barba Express por R$ 70 (pedido do Juliano, 30/10/2026: "combo raspar a
-- cabeça com barba express a 70,00 (5 de desconto)").
-- Avulso dá R$ 75 (Raspar a cabeça 40 + Barba Express 35). 70 min = Raspar (40) + Barba Express (30).
-- Barba Express é só na máquina (regra de 01/09/2026).
-- O service_price_on casa o nome mais longo: "Raspar a cabeça + Barba Express" gravado na reserva passa a custar 70,
-- venha do combo ou das duas partes na mesma ordem.
insert into public.services (name, description, price, duration_minutes, display_category, upsell_tag, active, sort_order, sales_pitch)
select 'Raspar a cabeça + Barba Express',
       'Raspagem completa da cabeça + alinhamento de barba só na máquina (sem navalha e sem toalha quente).',
       70, 70, 'Cortes e combos', 'combo', true, 6,
       'Cabeça raspada e barba alinhada numa visita só, com acabamento na navalha nas bordas e na nuca do raspado. A barba é a Express, feita na máquina. Sai mais em conta do que fazer separado.'
where not exists (select 1 from public.services where name = 'Raspar a cabeça + Barba Express');

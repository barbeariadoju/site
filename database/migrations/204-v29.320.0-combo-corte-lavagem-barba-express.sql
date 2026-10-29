-- v29.320.0 — combo Corte + Lavagem + Barba Express por R$ 90 (pedido do Juliano, 29/10/2026: "cria combo corte +
-- lavagem + barba express por 90,00").
-- Avulso dá R$ 95 (Corte + Lavagem 60 + Barba Express 35). A JuIA já fechava esse conjunto a R$ 90 quando o
-- cliente aceitava a lavagem em cima do Corte + Barba Express (29.285.0, caso Vicente); agora é serviço de tabela.
-- 80 min = Corte + Lavagem (50) + Barba Express (30). Barba Express é só na máquina (regra de 01/09/2026).
-- O service_price_on casa o nome mais longo: "Corte + Lavagem + Barba Express" gravado na reserva passa a custar 90,
-- venha do combo ou das duas partes na mesma ordem.
insert into public.services (name, description, price, duration_minutes, display_category, upsell_tag, active, sort_order, sales_pitch)
select 'Corte + Lavagem + Barba Express',
       'Corte masculino com lavagem profissional + alinhamento de barba só na máquina (sem navalha e sem toalha quente).',
       90, 80, 'Cortes e combos', 'combo', true, 6,
       'Corte, lavagem e barba numa visita só: o cabelo lavado mostra o formato real dos fios, e a barba vem alinhada na máquina, no mesmo desenho do corte. Sai mais em conta do que fazer separado.'
where not exists (select 1 from public.services where name = 'Corte + Lavagem + Barba Express');

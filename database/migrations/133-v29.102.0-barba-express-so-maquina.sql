-- 133 — v29.102.0 — Barba Express é SÓ na máquina (correção do Juliano, 01/09/2026)
--
-- Erro real, 01/09/2026 10h26 (conversa "José Reis Imóveis"): o cliente pediu corte
-- americano + Barba Express e a JuIA respondeu "a barba alinhada com acabamento na
-- navalha". Não é verdade — a Barba Express é feita SÓ na máquina; navalha e toalha
-- quente são da Barboterapia. Vender o que não vai acontecer na cadeira é o pior tipo
-- de erro que essa conversa pode cometer: o cliente chega esperando outra coisa.
--
-- A JuIA não inventou do nada: o argumento de venda cadastrado aqui na migration 097
-- dizia, com todas as letras, "com navalha no acabamento". O texto errado estava na
-- fonte, e ela repetiu. Correção na fonte + regra fixa no prompt (ju-ia-site) + resumo
-- entre parênteses em toda oferta de barba, que foi o pedido do Juliano:
--   Barba Express (só na máquina)
--   Barboterapia (navalha e toalha quente)
--   Barboterapia com vaporizador de ozônio (a mais completa)

update public.services
   set sales_pitch = 'Barba alinhada no formato do seu rosto, feita na máquina, em 20 minutos. É a opção certa pra manter o desenho em dia entre uma barboterapia e outra.'
 where name = 'Barba Express';

-- O combo carrega a mesma barba: o texto não pode sugerir navalha.
update public.services
   set sales_pitch = 'Corte e barba desenhados juntos, na mesma visita — um combinando com o outro, que é o que faz o visual fechar. A barba aqui é a Express, alinhada na máquina, e resolve tudo numa sentada só.'
 where name = 'Corte + Barba Express';

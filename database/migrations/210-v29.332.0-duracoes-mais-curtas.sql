-- v29.332.0 — durações novas, pedido do Juliano (31/10/2026): "sobrancelha pode deixar 15 minutos, barba express 25 e
-- corte 40… pode ajustar os tempos de acordo com a minha sugestão, deixe corte com lavagem para 45 mins". O combo de
-- cada um passa a ser a soma das partes (corte −5, Barba Express −5). Só serviços: os agendamentos já marcados ficam
-- com a duração que tinham (end_time e duration_minutes gravados na reserva).
update public.services s set duration_minutes = v.dur
from (values
  ('Corte de cabelo', 40),                              -- era 45
  ('Corte + Lavagem', 45),                              -- era 50
  ('Barba Express', 25),                                -- era 30
  ('Sobrancelha Masculina', 15),                        -- igual
  ('Corte + Barba Express', 65),                        -- era 75 (40 + 25)
  ('Corte + Lavagem + Barba Express', 70),              -- era 80 (45 + 25)
  ('Raspar a cabeça + Barba Express', 65),              -- era 70 (40 + 25)
  ('Corte + Barba na navalha com toalha quente', 80)    -- era 85 (40 + 40)
) as v(nome, dur)
where s.name = v.nome;

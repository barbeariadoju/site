-- v29.348.1 — Juliano (06/11/2026): o pezinho também nem sempre é na navalha. Mesmo ajuste do Corte de cabelo (migration 217).
update public.services
   set sales_pitch = 'O acabamento da nuca e das costeletas, na máquina ou na navalha, conforme o corte. É o retoque rápido que segura o visual em pé por mais uma semana ou duas, sem precisar de um corte inteiro.'
 where name = 'Pezinho (acabamento)';

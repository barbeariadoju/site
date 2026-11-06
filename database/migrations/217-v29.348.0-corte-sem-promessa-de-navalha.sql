-- v29.348.0 — pedido do Juliano (06/11/2026, 12h20): o sales_pitch do Corte de cabelo dizia "o acabamento é feito com
-- calma, na navalha", e a JuIA mandou isso a um cliente que só perguntou o preço. Nem todo corte é finalizado na
-- navalha: depende do estilo. Fica igual ao que servicos.html já diz ("na navalha ou na máquina conforme o estilo").
update public.services
   set sales_pitch = 'Corte com hora marcada e sem fila: a gente conversa sobre o que você quer antes de começar, e o acabamento é feito com calma, na máquina ou na navalha, conforme o estilo. Você sai pronto, sem aquela sensação de corte apressado.'
 where name = 'Corte de cabelo';

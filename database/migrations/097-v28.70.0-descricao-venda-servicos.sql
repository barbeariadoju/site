-- 097 — v28.70.0 — Descrição de venda por serviço (pedido do Juliano, 07/08/2026)
--
-- Caso real (Walter): o cliente perguntou "como é a lavagem profissional?" e a JuIA
-- respondeu "está incluída no Corte + Lavagem, custa R$ 50 e dura 40 minutos" — preço e
-- duração, nenhum motivo pra querer. Perdeu a venda por falta de argumento.
--
-- Regra do texto: diz o que o cliente GANHA, não o que o serviço é. Nada de promessa de
-- resultado médico. Sem "abre os poros" (mito — o Juliano já corrigiu isso no site).
-- Curto porque o destino é WhatsApp: 1 a 2 frases.
--
-- Fonte do conteúdo: páginas servico-*.html já publicadas (escritas com o padrão editorial
-- do projeto) + os elogios que se repetem nas 66 avaliações do Google (sem pressa, ambiente
-- climatizado, preço justo, detalhista). Nada foi inventado.
--
-- A JuIA lê este campo junto do catálogo (ju-ia-site) e é instruída a explicar o BENEFÍCIO
-- com as próprias palavras, nunca colando o texto nem devolvendo preço/duração como se
-- fossem a resposta.

alter table public.services
  add column if not exists sales_pitch text;

comment on column public.services.sales_pitch is
  'Argumento de venda em 1-2 frases, usado pela JuIA quando o cliente pergunta sobre o servico. Diz o beneficio, nao repete preco/duracao (a JuIA ja informa isso separadamente).';

update public.services set sales_pitch = case name

  when 'Corte de cabelo' then
    'Corte com hora marcada e sem fila: a gente conversa sobre o que você quer antes de começar, e o acabamento é feito com calma, na navalha. Você sai pronto, sem aquela sensação de corte apressado.'

  when 'Corte + Lavagem' then
    'A lavagem tira o resíduo de pomada e gel que o cabelo acumula — e cabelo limpo mostra o formato real dos fios, então o corte sai mais preciso. Você ainda sai daqui sem nenhum fiapo no pescoço, direto pro resto do dia.'

  when 'Barboterapia' then
    'Vai muito além de aparar: toalha quente, esfoliação, óleos e massagem facial. O cuidado é com a pele embaixo da barba, que é de onde vêm a coceira, a caspinha e a vermelhidão. A maioria sai daqui relaxado, não só barbeado.'

  when 'Barba Express' then
    'Barba alinhada no formato do seu rosto, com navalha no acabamento, em 20 minutos. É a opção certa pra manter o desenho em dia entre uma barboterapia e outra.'

  when 'Sobrancelha Masculina' then
    'Limpeza discreta: tira só o excesso e mantém o traço masculino, sem afinar nem desenhar. É o detalhe que deixa o olhar mais limpo sem parecer que você fez alguma coisa.'

  when 'Corte + Barboterapia' then
    'O pacote mais completo da casa: corte feito com calma e o protocolo inteiro de barba, com toalha quente e massagem. Uma hora inteira só pra você — é o que a maioria escolhe quando quer sair renovado, não só aparado.'

  when 'Corte + Barba Express' then
    'Corte e barba desenhados juntos, na mesma visita — um combinando com o outro, que é o que faz o visual fechar. Resolve tudo numa sentada só.'

  when 'Aparação Corporal Masculina' then
    'Aparação de peito, costas, ombros e abdômen com máquina, deixando o comprimento natural e sem marcar degrau. Feito com discrição e privacidade.'

  when 'Alisamento / Relaxamento' then
    'Reduz volume e frizz, deixando o cabelo mais fácil de pentear e mais rápido de arrumar todo dia de manhã. O efeito é progressivo e mantém o movimento natural — não fica com aspecto de chapado.'

  when 'Pigmentação Capilar (Tintura)' then
    'Disfarça os fios brancos com naturalidade, respeitando seu tom atual — ninguém percebe que foi pintado, só que você está com aparência mais descansada.'

  when 'Barboterapia com vaporizador de ozônio' then
    'A barboterapia completa com um passo a mais: o vapor morno amacia os fios e deixa a pele mais confortável antes dos produtos. É a versão pra quem quer a experiência mais relaxante que a casa oferece.'

  when 'Corte de cabelo infantil' then
    'Corte feito no tempo da criança, com paciência e conversa — sem pressa e sem drama. Muitos pais aproveitam e cortam junto, e a criança relaxa vendo o pai na cadeira.'

  when 'Pezinho (acabamento)' then
    'O acabamento da nuca e das costeletas, feito na navalha. É o retoque rápido que segura o visual em pé por mais uma semana ou duas, sem precisar de um corte inteiro.'

  when 'Nevou / Platinado' then
    'Descoloração completa até o tom platinado, feita em etapas para preservar ao máximo a saúde do fio. Antes de começar, avaliamos juntos como está seu cabelo — se não estiver em condição, eu falo com sinceridade e sugerimos o caminho mais seguro.'

  when 'Luzes' then
    'Mechas mais claras aplicadas ponto a ponto, criando profundidade e movimento sem clarear o cabelo inteiro. Fica natural, como se tivesse pegado sol.'

  when 'Hidratação / Reconstrução Capilar' then
    'Repõe o que o cabelo perdeu com sol, boné, química e secador — devolve maciez e ajuda o fio a ficar menos quebradiço. Cabe direitinho junto com o corte, em 20 minutos.'

  when 'Raspar a cabeça' then
    'Raspagem uniforme, com acabamento na navalha nas bordas e na nuca — que é o que diferencia um raspado bem feito de um feito em casa. Sai limpo e simétrico.'

  when 'Pigmentação de Barba' then
    'Preenche as falhas e uniformiza o tom, dando a impressão de barba mais cheia e bem definida. O efeito é natural e some aos poucos, sem marcar contorno artificial.'

  when 'Depilação nasal (cera quente)' then
    'Remoção rápida dos pelos aparentes do nariz, com cera quente. São poucos segundos e resolve um detalhe que aparece muito em foto e conversa de perto.'

  when 'Depilação orelhas' then
    'Remove os pelos das orelhas com cera quente, num detalhe que quase ninguém percebe em si mesmo mas todo mundo nota de perto. Rápido e sem complicação.'

  when 'Pigmentação de Sobrancelha' then
    'Preenche falhas e define o formato da sobrancelha com tom natural, mantendo o traço masculino. Realça o olhar sem deixar marcado.'

  when 'Freestyle (risquinho)' then
    'O risco desenhado na máquina, feito à mão livre do jeito que você quiser — simples ou trabalhado. É a assinatura que personaliza o corte.'

  else sales_pitch
end
where active = true;

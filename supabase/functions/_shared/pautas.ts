// v29.213.0 — PAUTAS DA CENTRAL DE CONTEÚDO: educativo e humor com rodízio, e ganchos gastos.
//
// O que os números mostraram (30 dias até 19/09/2026, 117 posts da IA): 64 eram "campanha",
// só 8 educativos e 8 de humor, "café" em 25 legendas e "um cliente por vez" em 21, e 53
// reprovados no crivo. A causa: a "campanha ativa" (marketing_memory) é uma ficha genérica de
// ganchos da marca sem data para acabar, e com ela ligada TODO dia de quarta a sábado caía no
// mesmo ramo (v29.88.0 já tinha registrado isso). Os exemplos da instrução de estilo ("o café
// servido na chegada", "um cliente por vez") viravam o assunto. Pedido do Juliano (19/09):
// menos repetição, mais post educativo e de humor.
//
// Regra nova, só regra pura aqui (testada em tests/unit/pautas.spec.js):
//   • calendário da semana: quarta EDUCATIVO, quinta HUMOR, sexta MARCA (campanha/rotação
//     antiga), sábado alterna HUMOR e EDUCATIVO por semana. Domingo, segunda e terça seguem
//     com os temas próprios do content-generate-daily.
//   • bancos de pautas com rodízio: a próxima é a usada há mais tempo (ou nunca usada).
//   • ganchos de marca gastos: cada um aparece no máximo 1 dia por semana.
//
// Educativo: fato estabelecido e útil, sem número, estudo, marca ou dose (citação só de
// fonte levantada na hora — regra do CLAUDE.md); saúde termina no dermatologista.
// Humor: situação universal da cadeira, o alvo é o ofício ou o próprio barbeiro, nunca o
// cliente, a aparência dele (calvície, peso, idade), política, religião, time, duplo sentido.

export type TipoDia = 'educativo' | 'humor' | 'marca'

export type Pauta = { id: string; tema: string; fallback: string }

// 3 = quarta, 4 = quinta, 5 = sexta, 6 = sábado. Outros dias não passam por aqui.
export const tipoDoDia = (dow: number, semanaDoMes: number): TipoDia | null => {
  if (dow === 3) return 'educativo'
  if (dow === 4) return 'humor'
  if (dow === 5) return 'marca'
  if (dow === 6) return semanaDoMes % 2 ? 'humor' : 'educativo'
  return null
}

export const PAUTAS_EDUCATIVAS: Pauta[] = [
  { id: 'raspar-engrossa', tema: 'MITO: raspar faz o pelo nascer mais grosso. Não faz. O fio cortado fica com a ponta reta, que parece mais grossa ao toque e à vista; a espessura vem da raiz, e a lâmina não chega lá.', fallback: 'Raspar a barba faz o pelo nascer mais grosso? Não. O fio cortado fica com a ponta reta e parece mais grosso ao toque, mas a espessura vem da raiz, e a lâmina não chega lá.' },
  { id: 'fio-branco', tema: 'MITO: arrancar um fio branco faz nascer dois. Não faz: cada folículo produz um fio. Mas arrancar sempre no mesmo lugar pode irritar e machucar a raiz. Melhor cortar rente com tesoura.', fallback: 'Arrancar fio branco faz nascer dois? Não, cada raiz produz um fio só. Mas arrancar sempre no mesmo lugar irrita a pele e pode machucar a raiz. Se incomoda, corta rente com tesoura.' },
  { id: 'vapor-poros', tema: 'MITO: "o vapor abre os poros". Poro não tem músculo para abrir e fechar. O que a toalha quente faz de verdade é amolecer o fio e deixar a pele preparada, e aí a navalha desliza sem repuxar.', fallback: 'A toalha quente não "abre os poros": poro não abre nem fecha. O que ela faz é amolecer o fio e preparar a pele, e aí a navalha desliza sem repuxar.' },
  { id: 'pelo-encravado', tema: 'PELO ENCRAVADO: o fio cresce, faz a curva e volta para dentro da pele; é mais comum em fio crespo ou cacheado. Ajuda barbear a favor do crescimento e não esticar a pele. Bolinha inflamada que não passa é assunto do dermatologista.', fallback: 'Pelo encravado é o fio que faz a curva e volta pra dentro da pele, mais comum em barba crespa. Barbear a favor do crescimento e sem esticar a pele ajuda. Inflamou e não passa? Dermatologista.' },
  { id: 'oleo-ou-balm', tema: 'ÓLEO OU BALM de barba: o óleo cuida da pele e do fio e vai bem em barba curta e média; o balm tem mais corpo, hidrata e ajuda a modelar barba maior e fios rebeldes. Pouca quantidade, espalhada até a pele.', fallback: 'Óleo ou balm? O óleo cuida da pele e do fio e vai bem na barba curta e média. O balm tem mais corpo e ajuda a modelar a barba maior. Nos dois, pouca quantidade, espalhada até a pele.' },
  { id: 'lavar-barba', tema: 'COMO LAVAR A BARBA: sabonete comum pode ressecar a pele e o fio; o ideal é um produto suave ou próprio para barba, enxágue bem e seque com a toalha pressionando, sem esfregar.', fallback: 'Barba se lava com produto suave: sabonete comum costuma ressecar a pele e o fio. Enxágue bem e seque pressionando a toalha, sem esfregar. A pele embaixo agradece.' },
  { id: 'pomada-pasta-gel', tema: 'GEL, PASTA OU POMADA EM PÓ: gel fixa com brilho; pasta de efeito seco segura com aspecto natural; pomada em pó dá volume e textura em cabelo fino. O produto certo depende do fio, não da moda.', fallback: 'Gel fixa com brilho. Pasta de efeito seco segura com cara de natural. Pomada em pó dá volume pra cabelo fino. O produto certo depende do seu fio, e na cadeira a gente testa junto.' },
  { id: 'degrade-dura-menos', tema: 'POR QUE O DEGRADÊ PEDE RETORNO ANTES: a diferença de comprimento nas laterais é pequena, então poucos dias de crescimento já apagam o desenho. O corte social, com mais comprimento, envelhece mais devagar. Sem citar número de dias.', fallback: 'Por que o degradê pede retorno antes? A diferença de comprimento nas laterais é pequena, e poucos dias de crescimento já apagam o desenho. O corte social envelhece mais devagar.' },
  { id: 'sobrancelha-natural', tema: 'SOBRANCELHA MASCULINA: tirar só o excesso, os fios do meio e os que saem da linha, mantendo o formato natural. Afinar demais muda a expressão do rosto inteiro.', fallback: 'Sobrancelha masculina bem feita é a que ninguém percebe que foi feita: sai o excesso do meio e os fios fora da linha, fica o formato natural. Afinar demais muda a expressão do rosto.' },
  { id: 'irritacao-barbear', tema: 'IRRITAÇÃO DEPOIS DE BARBEAR: evitar passar a lâmina várias vezes no mesmo lugar e hidratar com produto sem álcool e sem perfume. Ardência que não melhora em alguns dias é assunto do dermatologista.', fallback: 'Pele ardendo depois de barbear? Evite passar a lâmina várias vezes no mesmo lugar e hidrate com produto sem álcool e sem perfume. Se não melhora em alguns dias, procure o dermatologista.' },
  { id: 'protetor-nuca', tema: 'SOL NA NUCA RECÉM-CORTADA: nuca, laterais e orelhas ficam mais expostas depois do corte. Protetor solar também vai no pescoço e atrás da orelha.', fallback: 'Corte novo deixa a nuca, as laterais e as orelhas mais expostas ao sol. Protetor solar também vai no pescoço e atrás da orelha, não só no rosto.' },
  { id: 'caspa-ou-seco', tema: 'CASPA OU COURO CABELUDO SECO: parecem iguais, mas não são; a caspa costuma vir junto com oleosidade e coceira. Se não melhora com o cuidado de casa, é caso de dermatologista.', fallback: 'Caspa e couro cabeludo seco parecem iguais, mas não são: a caspa costuma vir com oleosidade e coceira. Se não melhora com o cuidado de casa, vale uma consulta com o dermatologista.' },
  { id: 'quimica-historico', tema: 'POR QUE PERGUNTAMOS O QUE VOCÊ JÁ PASSOU NO CABELO antes de qualquer química: tinta, alisamento de caixinha e descoloração anteriores podem reagir com o produto novo e o fio pode quebrar. Por isso existe o teste de mecha. Aqui a voz do farmacêutico pesa.', fallback: 'Antes de qualquer química eu pergunto o que você já passou no cabelo. Tinta, alisamento de caixinha e descoloração podem reagir com o produto novo, e o fio quebra. Por isso existe o teste de mecha.' },
  { id: 'barba-falhada', tema: 'BARBA FALHADA: os fios crescem em fases, então vale deixar crescer algumas semanas antes de julgar as falhas. Um desenho bem feito disfarça muito. Parte é genética, e está tudo bem.', fallback: 'Antes de desistir da barba falhada, deixa crescer umas semanas: os fios nascem em fases e as falhas diminuem. O desenho certo disfarça muito o que sobrar.' },
  { id: 'manter-em-casa', tema: 'PARA O CORTE FICAR IGUAL EM CASA: secar na direção em que foi cortado, usar pouco produto e aplicar com o cabelo quase seco, de trás para a frente.', fallback: 'Pra o corte ficar em casa como ficou aqui: seque na direção em que ele foi cortado, use pouco produto e aplique com o cabelo quase seco, de trás pra frente.' },
  { id: 'cabelo-lavado', tema: 'VENHO DE CABELO LAVADO OU SUJO? Lavado e sem produto: o caimento aparece de verdade, a máquina desliza e o acabamento sai mais preciso.', fallback: 'Venho de cabelo lavado ou sujo? Lavado e sem produto. Assim o caimento aparece de verdade, a máquina desliza e o acabamento sai mais preciso.' },
]

export const PAUTAS_HUMOR: Pauta[] = [
  { id: 'so-aparar', tema: 'O "SÓ DÁ UMA APARADA" que, dez minutos depois, vira "pode subir mais".', fallback: 'Todo corte começa com "só dá uma aparada". Uns dez minutos depois vem o "sabe o quê? pode subir mais". A máquina já fica à mão.' },
  { id: 'um-dedinho', tema: '"TIRA SÓ UM DEDINHO": de quem é o dedo? do cliente, do barbeiro, do primo que corta em casa.', fallback: '"Tira só um dedinho." Nunca descobri de quem é o dedo: do cliente, o meu ou o do primo que corta em casa. Na dúvida, a gente combina antes de começar.' },
  { id: 'coceira-capa', tema: 'O NARIZ QUE COÇA exatamente quando as duas mãos estão debaixo da capa.', fallback: 'O nariz sabe a hora exata de coçar: quando as duas mãos estão debaixo da capa. Pode avisar, a gente para. Faz parte do serviço.' },
  { id: 'cochilo', tema: 'O CLIENTE QUE COCHILA NA CADEIRA: o maior elogio, e o desafio de pedir para virar a cabeça sem acordar ninguém.', fallback: 'Cliente que cochila na cadeira é o maior elogio que existe. O difícil é pedir pra virar a cabeça sem acordar ninguém.' },
  { id: 'formato-bone', tema: 'O CABELO QUE PASSOU A SEMANA NO FORMATO DO BONÉ e chega achando que aquilo é o corte.', fallback: 'Tem cabelo que passa a semana no formato do boné e chega aqui achando que aquilo é o corte. Tira o boné, a gente conversa com o que sobrou.' },
  { id: 'do-seu-jeito', tema: '"PODE FAZER DO SEU JEITO", e a partir da primeira passada da máquina, um comentário por passada.', fallback: '"Pode fazer do seu jeito." Primeira passada: "só não sobe muito". Segunda: "deixa mais em cima". Adoro cliente que confia em mim.' },
  { id: 'barba-desistiu', tema: 'UM MÊS DEIXANDO A BARBA CRESCER, um dia de coceira, e o pedido: "tira tudo".', fallback: 'Um mês deixando a barba crescer. Um dia de coceira. "Tira tudo." A barba sempre perde a votação no último dia.' },
  { id: 'aprovacao-da-mae', tema: 'CORTE INFANTIL: a foto de referência vem do celular da mãe, e quem aprova no final também.', fallback: 'No corte infantil, a foto de referência quase sempre vem do celular da mãe. E quem dá a aprovação final também.' },
  { id: 'ninguem-percebeu', tema: 'SAIU DA BARBEARIA SE SENTINDO OUTRO, em casa ninguém percebeu, três dias depois alguém pergunta "cortou o cabelo?".', fallback: 'Saiu daqui se sentindo outro. Em casa, ninguém percebeu. Três dias depois alguém pergunta: "cortou o cabelo?". Cortou. Na terça.' },
  { id: 'descrever-corte', tema: 'TENTAR DESCREVER UM CORTE EM PALAVRAS: "baixinho do lado, mas não muito, e em cima normal".', fallback: '"Baixinho do lado, mas não muito, e em cima normal." Toda semana alguém me passa essa receita. Por isso eu sempre pergunto de novo antes de começar.' },
  { id: 'toalha-quente-silencio', tema: 'A PRIMEIRA VEZ DE TOALHA QUENTE: o cliente fica mudo, respira fundo e pergunta se dá para fazer isso toda semana.', fallback: 'Primeira vez de toalha quente é sempre igual: o cliente fica mudo, respira fundo e pergunta se dá pra fazer isso toda semana.' },
  { id: 'nuca-invisivel', tema: 'NINGUÉM OLHA A PRÓPRIA NUCA, mas todo mundo repara quando o pezinho cresceu.', fallback: 'Ninguém olha a própria nuca. Mas todo mundo repara quando o pezinho cresceu. O pezinho é o único corte que você nunca vê e todo mundo vê.' },
  { id: 'secador-de-casa', tema: 'O CABELO QUE FICA PERFEITO NA BARBEARIA e no dia seguinte o secador de casa tem outra opinião.', fallback: 'O corte sai daqui perfeito. No dia seguinte, o secador de casa tem outra opinião. A gente ensina o truque, o secador é que não escuta.' },
]

export const bancoDe = (tipo: TipoDia): Pauta[] =>
  tipo === 'educativo' ? PAUTAS_EDUCATIVAS : tipo === 'humor' ? PAUTAS_HUMOR : []

// Rodízio: a pauta nunca usada vem primeiro (na ordem do banco); depois, a usada há mais tempo.
// `usadas` = ids das pautas já publicadas, do MAIS RECENTE para o mais antigo (repetidos ok).
export const escolherPauta = (banco: Pauta[], usadas: string[]): Pauta | null => {
  if (!banco.length) return null
  const ultimaVez = new Map<string, number>()
  usadas.forEach((id, i) => { if (!ultimaVez.has(id)) ultimaVez.set(id, i) })
  const nunca = banco.find((p) => !ultimaVez.has(p.id))
  if (nunca) return nunca
  return [...banco].sort((a, b) => (ultimaVez.get(b.id) ?? 0) - (ultimaVez.get(a.id) ?? 0))[0]
}

// Ganchos da marca que viraram muleta. Cada um pode sair no máximo 1 dia por semana.
export const GANCHOS_DE_MARCA: { id: string; nome: string; re: RegExp }[] = [
  // \b do JS não conhece acento ("café" terminava sem fronteira e passava direto): limites por \p{L}
  { id: 'cafe', nome: 'café', re: /(?<!\p{L})caf[eé]s?(?!\p{L})|cafezinho/iu },
  { id: 'um-cliente-por-vez', nome: 'um cliente por vez', re: /um cliente por vez|um cliente s[oó](?!\p{L})|sem plateia/iu },
  { id: 'hora-marcada', nome: 'hora marcada / horário respeitado', re: /hora marcada|hor[aá]rio marcado|hor[aá]rio respeitado|na hora (que foi )?marcada/i },
  { id: 'sem-pressa', nome: 'sem pressa / sem atropelo', re: /sem pressa|sem atropelo|pressa nunca/i },
  { id: 'espelho', nome: 'espelho', re: /espelho/i },
  { id: 'climatizado', nome: 'ambiente climatizado', re: /climatizad/i },
]

// Quais ganchos já saíram em `limite` dias diferentes (ou mais) entre os posts recentes.
// `recentes` = [{ dia: 'AAAA-MM-DD', texto }]: as 3 redes do mesmo dia contam como 1.
export const ganchosGastos = (recentes: { dia: string; texto: string }[], limite = 1): string[] =>
  GANCHOS_DE_MARCA.filter((g) => new Set(recentes.filter((r) => g.re.test(r.texto)).map((r) => r.dia)).size >= limite).map((g) => g.id)

export const ganchosUsados = (texto: string, ids: string[]): string[] =>
  GANCHOS_DE_MARCA.filter((g) => ids.includes(g.id) && g.re.test(texto)).map((g) => g.nome)

export const REGRAS_EDUCATIVO = `POST EDUCATIVO: ensine UMA coisa útil e verdadeira, que a pessoa possa usar hoje, na voz do Juliano (barbeiro e farmacêutico de formação; pode citar a formação só se o assunto for pele, couro cabeludo, produto ou química, e no máximo uma vez). Abra com a pergunta ou o mito, responda direto na frase seguinte, termine com a dica prática. É PROIBIDO: número, porcentagem, "estudos mostram", nome de marca, dose, promessa de cura ou de resultado, diagnóstico; e repetir o mito "o vapor abre os poros". Assunto de saúde (irritação, inflamação, caspa, queda) termina mandando ao dermatologista. O post não vende: no máximo um convite leve no fim ("dúvida? pergunta na cadeira").`

// Princípios da skill joke-engineering traduzidos para legenda curta de barbearia.
export const REGRAS_HUMOR = `POST DE HUMOR: uma situação que todo cliente de barbearia reconhece, contada em 2 ou 3 frases curtas, na voz do Juliano. COMO FUNCIONA A PIADA: (1) o detalhe específico faz rir, o genérico não ("tira só um dedinho" é engraçado, "cliente indeciso" não é); (2) monte o padrão e quebre na última frase; (3) corte toda palavra que explica — a graça está no que o leitor completa sozinho, nunca explique a piada nem escreva "kkk", "rs" ou "hahaha"; (4) soe como o Juliano conta na cadeira, não como meme. O ALVO é o ofício ou o próprio barbeiro, NUNCA o cliente: é PROIBIDO rir da aparência de alguém (calvície, entradas, peso, idade, cabelo "ruim"), de política, religião, time de futebol, e qualquer duplo sentido (regra da casa: piscadinha entre homens é lida como outra coisa). Nada de conversa íntima da cadeira. O post não vende: sem "agende" colado na piada; no máximo um fecho leve separado.`

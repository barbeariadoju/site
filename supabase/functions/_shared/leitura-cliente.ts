// v29.212.0 — leituras da mensagem do cliente que a JuIA (ju-ia-site) usa pra decidir o fluxo.
//
// Nasceu da análise de erros de 19/09/2026 (121 conversas reais de 05 a 19/09): os erros que
// ainda estavam abertos eram quase todos de LEITURA — a frase do cliente dizia uma coisa e o
// código entendia outra. Até aqui cada leitura era uma regex solta dentro do index.ts de 4 mil
// linhas, sem teste. As novas moram aqui, testadas em tests/unit/leitura-cliente.spec.js.
//
// Todas recebem o texto JÁ NORMALIZADO (sem acento, minúsculo), como o resto do ju-ia-site.

const pad = (n: number) => String(n).padStart(2, '0')

// ---------------------------------------------------------------------------------------------
// TETO DE INÍCIO — "antes das 11h", "até as 17h30", "no máximo 16h".
// Caso Rossano (18/09/2026, 08h39): "hoje ou amanhã cedo, antes das 11:00 h" virou pedido DAS
// 11h ("11:00 já está ocupado, o mais próximo é 11:50") — o contrário do que ele pediu. E o caso
// de 10/09 ("até 17h30" → ofereceu 18:00). Devolve o horário-limite de INÍCIO e se o limite
// vale ("até as 17h30" aceita 17:30; "antes das 11" não aceita 11:00).
// Pergunta de funcionamento ("vocês vão até que horas?", "atende até as 19h?") não é teto.
// ---------------------------------------------------------------------------------------------
export type TetoDeInicio = { hora: string; inclusivo: boolean } | null
export const tetoDeInicio = (q: string): TetoDeInicio => {
  const t = String(q || '')
  if (/\b(abre|abrem|fecha|fecham|funciona|funcionam|atende|atendem|aberto|abertos|expediente|trabalha|trabalham|voces vao|vcs vao|vai ate|vao ate)\b[^.!?]{0,12}\bate\b/.test(t)) return null
  const m = t.match(/\b(antes d[ae]s?|antes|ate (?:as |a )?|no maximo (?:ate )?(?:as )?|o mais tardar (?:as )?)\s*(\d{1,2})(?:\s*[:h.,;]\s*(\d{2}))?\s*(?:h|hs|hrs?|horas?)?(?![\d/])/)
  if (!m) return null
  const h = Number(m[2]), mi = m[3] ? Number(m[3]) : 0
  if (h < 7 || h > 21 || mi > 59) return null
  return { hora: `${pad(h)}:${pad(mi)}`, inclusivo: !/^antes/.test(m[1]) }
}

// ---------------------------------------------------------------------------------------------
// PISO — "depois das 18h", "tem que ser depois das 18:00", "a partir das 17", "após as 19h".
// Caso Rodrigo (17/09/2026, 16h09): pediu depois das 18h pro filho sair da escola; o dia não
// tinha nada depois das 18 e a JuIA repetiu a oferta de 17:15 — que ele tinha acabado de recusar.
// ---------------------------------------------------------------------------------------------
export const pisoDeHorario = (q: string): string => {
  const m = String(q || '').match(/\b(depois d[ae]s?|a partir d[ae]s?|apos (?:as |a )?|pos (?:as )?|so (?:depois|a partir) d[ae]s?)\s*(\d{1,2})(?:\s*[:h.,;]\s*(\d{2}))?\s*(?:h|hs|hrs?|horas?)?(?![\d/])/)
  if (!m) return ''
  const h = Number(m[2]), mi = m[3] ? Number(m[3]) : 0
  if (h < 7 || h > 21 || mi > 59) return ''
  return `${pad(h)}:${pad(mi)}`
}

// ---------------------------------------------------------------------------------------------
// PEDIDO DE GENTE — "falo direto com o Juliano?", "queria falar com ele".
// Caso Rafael (17/09/2026, 14h00): a pergunta era sobre falar com o Juliano, e a JuIA respondeu
// "aqui é a Juia, assistente virtual, não o Juliano" — e seguiu tentando atender. O pedido de
// gente já era determinístico (v29.138.0), só não conhecia "falo direto" nem "falar com ele".
// `juLianoNaUltimaFala` = a última fala nossa citou o Juliano (aí "ele" é o Juliano).
// ---------------------------------------------------------------------------------------------
export const pedeFalarComJuliano = (q: string, julianoNaUltimaFala = false): boolean => {
  const t = String(q || '')
  if (/\b(falo|falar|fala|converso|conversar|conversa|trato|tratar)\s+(direto\s+|diretamente\s+|pessoalmente\s+)?com\s+(o\s+)?(juliano|ju|barbeiro|dono|proprio juliano|voce mesmo|vc mesmo|humano|uma pessoa|pessoa|atendente|alguem)\b/.test(t)) return true
  if (/\b(e|eh)\s+(o\s+)?(juliano|ju)\s+(mesmo|que (esta|ta) (falando|respondendo))\s*\?/.test(t)) return true
  if (julianoNaUltimaFala && /\b(falar|conversar|falo|converso)\s+(direto\s+)?com\s+ele\b/.test(t)) return true
  return false
}

// ---------------------------------------------------------------------------------------------
// CHEGADA — "estou na rua de baixo", "tô chegando", "cheguei".
// Caso Moisés (18/09/2026, 18h25): com o horário das 19h marcado, avisou que estava na rua de
// baixo e recebeu "você já tem um agendamento para hoje às 19:00, quer que eu cancele esse já
// que vai escolher outro dia?" — a conversa da tarde (terça oferecida) ainda estava no estado.
// Quem avisa que está chegando não está pedindo nada: é "te espero".
// ---------------------------------------------------------------------------------------------
export const avisoDeChegada = (q: string): boolean => {
  const t = String(q || '')
  if (/\?/.test(t) && /\b(remarc|cancel|mudar|trocar|outro (dia|horario))\b/.test(t)) return false
  return /\b(to|tou|tô|estou|ja estou|ja to|so|sou)\s+(chegando|a caminho|indo ai|indo la|saindo( de casa| daqui)?|na rua|aqui (na|em) frente|na porta|aqui fora|estacionando|procurando vaga|subindo|quase ai|perto)\b|\brua de baixo\b|\bchego (em|daqui a?)\s*\d{1,2}\s*(min|minutos?)\b|\bja cheguei\b|^cheguei\b|\bestou aqui (na|em) frente\b|\bto aqui (na|em) frente\b|\bem \d{1,2}\s*(min|minutos?) (to|estou|chego)\b/.test(t)
}

// ---------------------------------------------------------------------------------------------
// ACEITE DO AVISO DE VAGA — resposta seca à oferta "te aviso se abrir vaga hoje".
// Caso Moisés (18/09/2026, 13h05): respondeu "Avisar" e recebeu "me embolei aqui". O aceite por
// frase já existia (v29.186.0); faltava a palavra solta, que é como se responde a uma escolha.
// Só vale com a oferta de lista de espera pendente — sem ela, "avisar" não significa nada.
// ---------------------------------------------------------------------------------------------
export const aceitaAvisoDeVaga = (q: string): boolean =>
  /^(sim|ok|isso|pode|claro|quero|por favor|pfv|pf)?[\s,!.]*(pode\s+)?(me\s+)?(avisar?|avise|avisa|aviso|o aviso|me avisa|me avise|me coloca na (lista|espera)|coloca na (lista|espera)|lista( de espera)?|espera|quero (ser avisado|o aviso|que (me )?avise)|pode avisar|avisa sim|aviso sim)[\s,!.]*(sim|por favor|pfv|pf|obrigad[oa])?[\s!.]*$/.test(String(q || '').trim())

// ---------------------------------------------------------------------------------------------
// HORÁRIO PRA OUTRA PESSOA — "corte pro meu namorado", "é pro meu filho", "pra ele".
// Caso Amanda (11/09/2026): marcou o corte do namorado e a reserva saiu no nome dela, porque o
// telefone tinha cadastro e o nome do cadastro foi assumido sem perguntar. "Eu e meu filho" /
// "pra mim e pro meu filho" é grupo (a reserva é de quem chama) — não conta.
// ---------------------------------------------------------------------------------------------
const PARENTE = '(namorad[oa]|marido|espos[oa]|companheir[oa]|noiv[oa]|filh[oa]|enteado|enteada|pai|irmao|irma|sobrinh[oa]|amig[oa]|colega|primo|prima|cunhad[oa]|genro|sogro|neto|afilhado|patrao|chefe|vizinho)'
export const horarioParaOutraPessoa = (q: string): boolean => {
  const t = String(q || '')
  if (/\b(eu e (o |a )?(meu|minha)|pra mim e|para mim e|nos dois|nos tres|eu tambem|e pra mim|e para mim|a gente)\b/.test(t)) return false
  return new RegExp(`\\b(pro|pra|para o|para a|para|do|da|e o|e a|e pro|e pra)\\s+(meu|minha)\\s+${PARENTE}\\b|\\b(pro|pra|para)\\s+(ele|ela)\\b|\\bnao (e|eh) (pra|para) mim\\b|\\b(o corte|o horario|a reserva) (e|eh) (do|da|pro|pra) (meu|minha)\\s+${PARENTE}\\b`).test(t)
}

// ---------------------------------------------------------------------------------------------
// REMARCAR (não cancelar) — sinais de quem quer OUTRO horário.
// Caso de 10/09/2026, 09h48: "tenho exame de sangue 8:30" + "conseguimos marcar mais tarde?"
// virou "quer mesmo cancelar?" duas vezes. Quem pede "mais tarde"/"outro horário"/"passar pra"
// está remarcando. Só é lido quando o cliente TEM agendamento futuro (o chamador confere).
// ---------------------------------------------------------------------------------------------
export const querRemarcar = (q: string): boolean =>
  /\b(mais tarde|mais cedo|outro horario|outra hora|outro dia|outra data|adiar|adia|empurrar|empurra|passar (pra|para)|passa (pra|para)|jogar (pra|para)|marcar (pra |para )?(mais tarde|outro|outra|depois)|conseguimos marcar|consegue marcar|da (pra|para) (marcar|mudar|passar)|trocar (pra|para) (as|a|o|outro|outra|amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado)|mudar (pra|para) (as|a|o|outro|outra|amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado))\b/.test(String(q || ''))

// ---------------------------------------------------------------------------------------------
// PERGUNTA DE EXISTÊNCIA DENTRO DA MENSAGEM — "você faz pintura?", "vocês trabalham com luzes?".
// Caso Sr. Magno (16/09/2026, 15h16): "limpeza de pelos das orelhas e nas narinas. Pergunto: você
// faz pintura nos cabelos?" — a JuIA somou a Pigmentação à reserva (R$ 140, 145 min) só porque o
// nome do serviço apareceu na PERGUNTA. Devolve os trechos da mensagem que são pergunta sobre o
// que a casa faz; o chamador tira dali os serviços que não foram pedidos em outro trecho.
// ---------------------------------------------------------------------------------------------
export const trechosDePerguntaDeExistencia = (q: string): string[] => {
  const partes = String(q || '').split(/(?<=[?!.\n])|(?=\bpergunto\b)|(?=\b(?:voce|vc|voces|vcs)\s+(?:faz|fazem|trabalha|trabalham|atende|atendem|corta|cortam|pinta|pintam|mexe|mexem|aplica|aplicam)\b)/)
  return partes.map((p) => p.trim()).filter((p) =>
    p && /\b(voce|vc|voces|vcs)\s+(faz|fazem|trabalha|trabalham|atende|atendem|corta|cortam|pinta|pintam|mexe|mexem|aplica|aplicam)\b|\b(fazem|atendem|trabalham com)\s+\w+|\btem\s+(servico|como fazer)\b/.test(p)
      && !/\b(quero|queria|gostaria|preciso|marca|marcar|agendar|incluir|coloca|coloque|reserva|reservar)\b/.test(p))
}

// Palavras que o cliente usa pra cada serviço — o nome do catálogo ("Pigmentação Capilar
// (Tintura)") quase nunca é o que ele escreve ("pintura", "pintar o cabelo").
const SINONIMOS: [RegExp, string[]][] = [
  [/tintura|pigmentacao capilar/, ['pint', 'tint', 'colora', 'cabelo branco', 'grisalh', 'cor no cabelo']],
  [/pigmentacao de barba/, ['pigment', 'pintar a barba', 'barba branca']],
  [/pigmentacao de sobrancelha/, ['pigment']],
  [/luzes/, ['luzes', 'mecha', 'reflexo']],
  [/platinado|nevou/, ['platin', 'nevou', 'nevad', 'descolor']],
  [/alisamento|progressiva/, ['alis', 'progressiva', 'escova']],
  [/hidratacao|reconstrucao/, ['hidrat', 'reconstru']],
  [/orelha/, ['orelha']],
  [/nasal/, ['nasal', 'narina', 'nariz']],
  [/sobrancelha masculina/, ['sobrancelha']],
  [/lavagem/, ['lavagem', 'lavar']],
  [/raspar/, ['raspar', 'careca', 'zerar', 'maquina zero']],
]
export const palavrasDoServico = (nomeServico: string): string[] => {
  const n = String(nomeServico || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return SINONIMOS.filter(([re]) => re.test(n)).flatMap(([, ps]) => ps)
}
// O serviço apareceu só na pergunta ("você faz pintura?") e não no pedido? Então não entra.
export const servicoSoPerguntado = (nomeServico: string, trechosPergunta: string[], restoDaMensagem: string): boolean => {
  const ps = palavrasDoServico(nomeServico)
  if (!ps.length || !trechosPergunta.length) return false
  const naPergunta = ps.some((p) => trechosPergunta.some((t) => t.includes(p)))
  const noPedido = ps.some((p) => String(restoDaMensagem || '').includes(p))
  return naPergunta && !noPedido
}

// ---------------------------------------------------------------------------------------------
// FALA NO MASCULINO — quem assina o WhatsApp é o Juliano.
// Caso Nuno (17/09/2026): "Obrigada pelo carinho!". O cliente não sabe que é a IA, e o
// remetente é um homem. Só as palavras que mudam o gênero de quem fala.
// ---------------------------------------------------------------------------------------------
export const falarNoMasculino = (texto: string): string => String(texto || '')
  .replace(/\b([Oo])brigada\b/g, '$1brigado')
  .replace(/\b([Gg])rata\b/g, '$1rato')
  .replace(/\b([Mm]uito )?([Oo])brigadinha\b/g, (_m, a, o) => `${a || ''}${o}brigado`)

// ---------------------------------------------------------------------------------------------
// VOCATIVO DEVOLVIDO NO COMEÇO DA RESPOSTA — "meu amigo! Que bom falar com você".
// Caso Julião (17/09/2026, 14h19): "Boa tarde meu amigo / Ju". O modelo abriu com "Boa tarde,
// meu amigo!", a saudação dele é tirada (a do código entra no lugar) e sobrava "meu amigo!" em
// minúscula, lido como se fosse o nome do cliente. Tira o vocativo que sobra na cabeça da frase.
// ---------------------------------------------------------------------------------------------
export const tirarVocativoInicial = (texto: string): string => {
  const s = String(texto || '')
  const semVoc = s.replace(/^\s*(?:,\s*)?(?:(?:meu|minha)\s+)?(?:amigo|amiga|amigao|irmao|parceiro|chefe|mestre|campeao|brother|mano|querido|querida|caro|cara|nobre|patrao)\b\s*[,!.]*\s*/i, '')
  if (semVoc === s || !semVoc) return s
  return semVoc.charAt(0).toUpperCase() + semVoc.slice(1)
}

// ---------------------------------------------------------------------------------------------
// PROMESSA DE RECADO — a resposta diz que vai repassar/registrar algo pro Juliano.
// Caso Nuno (17/09/2026): deu uma sugestão sobre o convite da agenda e ouviu "vou registrar para
// avaliação do Juliano" — e nada foi registrado em lugar nenhum. Quando a resposta promete o
// recado, o código manda o push de verdade (o chamador cuida do envio).
// ---------------------------------------------------------------------------------------------
export const prometeRecado = (texto: string): boolean =>
  /\b(vou|irei|vamos)\s+(registrar|anotar|repassar|encaminhar|passar|levar|mostrar|considerar|avaliar)\b[^.!?]{0,60}\b(juliano|ju\b|equipe|ele)\b|\bvou considerar\b|\bvou (registrar|anotar) (sua|essa|a) (sugestao|dica|ideia|observacao)\b/i
    .test(String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, ''))

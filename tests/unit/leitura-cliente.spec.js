import { describe, it, expect } from 'vitest';
import {
  tetoDeInicio, pisoDeHorario, pedeFalarComJuliano, avisoDeChegada, aceitaAvisoDeVaga,
  horarioParaOutraPessoa, querRemarcar, trechosDePerguntaDeExistencia, falarNoMasculino,
  tirarVocativoInicial, prometeRecado, servicoSoPerguntado,
} from '../../supabase/functions/_shared/leitura-cliente.ts';
import { primeiroNome } from '../../supabase/functions/_shared/primeiro-nome.ts';

// v29.212.0 — análise de erros da JuIA (19/09/2026). Cada bloco é um caso real que continuava
// aberto no código. Os textos chegam normalizados (sem acento, minúsculos), como no ju-ia-site.

describe('tetoDeInicio (caso Rossano, 18/09)', () => {
  it('"antes das 11:00 h" é teto, não pedido das 11h', () => {
    expect(tetoDeInicio('como vc esta de horarios , hoje ou amanha cedo, antes das 11:00 h')).toEqual({ hora: '11:00', inclusivo: false });
  });
  it('"até 17h30" é teto inclusivo', () => {
    expect(tetoDeInicio('consigo ate 17h30')).toEqual({ hora: '17:30', inclusivo: true });
    expect(tetoDeInicio('tem algo ate as 16?')).toEqual({ hora: '16:00', inclusivo: true });
  });
  it('pergunta de funcionamento não é teto', () => {
    expect(tetoDeInicio('voces atendem ate as 19h?')).toBeNull();
    expect(tetoDeInicio('fecha ate que horas')).toBeNull();
  });
  it('sem horário, nada', () => {
    expect(tetoDeInicio('ate amanha')).toBeNull();
    expect(tetoDeInicio('ate sabado as 10h')).toBeNull();
  });
});

describe('pisoDeHorario (caso Rodrigo, 17/09)', () => {
  it('lê o piso nas formas reais', () => {
    expect(pisoDeHorario('tem ser depois das 18:00, vc nao tem ?')).toBe('18:00');
    expect(pisoDeHorario('so a partir das 17')).toBe('17:00');
    expect(pisoDeHorario('apos as 19h')).toBe('19:00');
  });
  it('sem horário, vazio', () => {
    expect(pisoDeHorario('depois eu vejo')).toBe('');
  });
});

describe('pedeFalarComJuliano (caso Rafael, 17/09)', () => {
  it('"falo direto com o Juliano?" é pedido de gente', () => {
    expect(pedeFalarComJuliano('tudo bom tbm, falo direto com o juliano?')).toBe(true);
  });
  it('"queria falar com ele" só depois de a gente citar o Juliano', () => {
    expect(pedeFalarComJuliano('queria falar com ele', true)).toBe(true);
    expect(pedeFalarComJuliano('queria falar com ele', false)).toBe(false);
  });
  it('não pega conversa comum', () => {
    expect(pedeFalarComJuliano('quero cortar com o juliano amanha')).toBe(false);
  });
});

describe('avisoDeChegada (caso Moisés, 18/09)', () => {
  it('reconhece quem está chegando', () => {
    expect(avisoDeChegada('estou na rua de baixo')).toBe(true);
    expect(avisoDeChegada('to chegando')).toBe(true);
    expect(avisoDeChegada('chego em 5 minutos')).toBe(true);
    expect(avisoDeChegada('cheguei')).toBe(true);
  });
  it('pedido de remarcar não é chegada', () => {
    expect(avisoDeChegada('to saindo agora, da pra remarcar pra outro dia?')).toBe(false);
    expect(avisoDeChegada('tem horario amanha?')).toBe(false);
  });
});

describe('aceitaAvisoDeVaga (caso Moisés, 18/09)', () => {
  it('a palavra solta aceita a oferta', () => {
    expect(aceitaAvisoDeVaga('avisar')).toBe(true);
    expect(aceitaAvisoDeVaga('pode avisar sim')).toBe(true);
    expect(aceitaAvisoDeVaga('sim, me avisa por favor')).toBe(true);
    expect(aceitaAvisoDeVaga('lista de espera')).toBe(true);
  });
  it('frase com outro pedido não é aceite seco', () => {
    expect(aceitaAvisoDeVaga('avisar o juliano que vou atrasar')).toBe(false);
    expect(aceitaAvisoDeVaga('quero terca as 15h')).toBe(false);
  });
});

describe('horarioParaOutraPessoa (caso Amanda, 11/09)', () => {
  it('reconhece horário pra outra pessoa', () => {
    expect(horarioParaOutraPessoa('queria marcar um corte pro meu namorado')).toBe(true);
    expect(horarioParaOutraPessoa('e pro meu filho, corte infantil')).toBe(true);
    expect(horarioParaOutraPessoa('o horario e pra ele')).toBe(true);
  });
  it('grupo com quem chama não conta', () => {
    expect(horarioParaOutraPessoa('eu e meu filho, dois cortes')).toBe(false);
    expect(horarioParaOutraPessoa('pra mim e pro meu filho')).toBe(false);
    expect(horarioParaOutraPessoa('quero cortar amanha')).toBe(false);
  });
});

describe('querRemarcar (caso de 10/09, exame de sangue)', () => {
  it('pedido de outro horário é remarcação', () => {
    expect(querRemarcar('conseguimos marcar mais tarde, desculpa tinha esquecido')).toBe(true);
    expect(querRemarcar('da pra passar pra sexta?')).toBe(true);
    expect(querRemarcar('outro horario')).toBe(true);
  });
  it('cancelamento puro não é', () => {
    expect(querRemarcar('pode cancelar')).toBe(false);
  });
});

describe('trechosDePerguntaDeExistencia (caso Sr. Magno, 16/09)', () => {
  it('separa a pergunta do pedido', () => {
    const t = trechosDePerguntaDeExistencia('2 limpeza de pelos das orelhas e nas narinas  pergunto? voce faz pintura nos cabelos ?');
    expect(t.some((x) => x.includes('pintura'))).toBe(true);
    expect(t.some((x) => x.includes('orelhas'))).toBe(false);
  });
  it('pedido com "quero" não é pergunta de existência', () => {
    // o "quero fazer pintura" fica fora dos trechos de pergunta — a pintura foi pedida
    expect(trechosDePerguntaDeExistencia('quero fazer pintura, voces fazem?').some((x) => x.includes('pintura'))).toBe(false);
  });
});

describe('servicoSoPerguntado (caso Sr. Magno, 16/09)', () => {
  const msg = '2 limpeza de pelos das orelhas e nas narinas  pergunto? voce faz pintura nos cabelos ?';
  const trechos = trechosDePerguntaDeExistencia(msg);
  let resto = msg; for (const t of trechos) resto = resto.replace(t, ' ');
  it('a pintura só foi perguntada: sai', () => {
    expect(servicoSoPerguntado('Pigmentação Capilar (Tintura)', trechos, resto)).toBe(true);
  });
  it('as depilações foram pedidas: ficam', () => {
    expect(servicoSoPerguntado('Depilação orelhas (cera quente)', trechos, resto)).toBe(false);
    expect(servicoSoPerguntado('Depilação nasal (cera quente)', trechos, resto)).toBe(false);
  });
  it('sem pergunta na mensagem, nada sai', () => {
    expect(servicoSoPerguntado('Pigmentação Capilar (Tintura)', [], 'quero pintar o cabelo')).toBe(false);
  });
});

describe('falarNoMasculino (caso Nuno, 17/09)', () => {
  it('troca o gênero de quem fala', () => {
    expect(falarNoMasculino('Obrigada pelo carinho!')).toBe('Obrigado pelo carinho!');
    expect(falarNoMasculino('Fico muito grata, obrigada.')).toBe('Fico muito grato, obrigado.');
  });
});

describe('tirarVocativoInicial (caso Julião, 17/09)', () => {
  it('tira o vocativo que sobrou da saudação', () => {
    expect(tirarVocativoInicial('meu amigo! Que bom falar com você novamente.')).toBe('Que bom falar com você novamente.');
    expect(tirarVocativoInicial(', meu amigo! Como posso ajudar?')).toBe('Como posso ajudar?');
  });
  it('não mexe no resto', () => {
    expect(tirarVocativoInicial('Amanhã tenho 8h.')).toBe('Amanhã tenho 8h.');
  });
});

describe('prometeRecado (caso Nuno, 17/09)', () => {
  it('reconhece promessa de levar ao Juliano', () => {
    expect(prometeRecado('Obrigado pela sugestão; vou registrar para avaliação do Juliano.')).toBe(true);
    expect(prometeRecado('Vou considerar essa melhoria nas próximas confirmações.')).toBe(true);
  });
  it('resposta comum não é recado', () => {
    expect(prometeRecado('Amanhã tenho 8h ou 9h. Qual prefere?')).toBe(false);
  });
});

describe('primeiroNome (caso Sr. Magno)', () => {
  it('tratamento não é nome', () => {
    expect(primeiroNome('Sr Magno')).toBe('Magno');
    expect(primeiroNome('Dr. Paulo Souza')).toBe('Paulo');
    expect(primeiroNome('Dona Maria')).toBe('Maria');
  });
  it('maiúsculas viram nome', () => {
    expect(primeiroNome('MOISES')).toBe('Moises');
  });
  it('emoji não é nome; padrão entra', () => {
    expect(primeiroNome('🤓', 'cliente')).toBe('cliente');
    expect(primeiroNome('', 'Cliente')).toBe('Cliente');
  });
  it('só tratamento: padrão', () => {
    expect(primeiroNome('Sr', '')).toBe('');
  });
});

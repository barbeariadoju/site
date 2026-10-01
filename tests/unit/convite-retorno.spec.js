import { describe, it, expect } from 'vitest';
import {
  familiaDoServico, alvoDias, retornoTipicoDias, decisaoEnvio, diasEntre, somarDiasIso,
  tempoDesde, mensagemConvite, mensagemPrazo, diasDaOpcao, linhaValor, JANELA_DIAS,
} from '../../supabase/functions/_shared/convite-retorno.ts';

// v29.154.0 — o convite de retorno passou a sair no tempo do cliente (dia 12 pra corte, dia 5
// pra barba, ou a cadência dele menos 4 dias), em vez de no dia seguinte ao atendimento.
// Os números que fundamentam os alvos estão no cabeçalho do módulo.

// Intl separa "R$" do numero com espaco duro (U+00A0 ou U+202F, conforme a versao do Node).
// Normaliza so na comparacao - o texto que vai pro WhatsApp continua sendo o do Intl.
const norm = (s) => String(s).replace(/[  ]/g, ' ');

describe('familiaDoServico', () => {
  it('classifica corte, barba e o resto', () => {
    expect(familiaDoServico('Corte de cabelo')).toBe('corte');
    expect(familiaDoServico('Corte + Barba Express')).toBe('corte');
    expect(familiaDoServico('Raspar a cabeça')).toBe('corte');
    expect(familiaDoServico('Barba Express')).toBe('barba');
    expect(familiaDoServico('Barboterapia com vaporizador de ozônio')).toBe('barba');
    expect(familiaDoServico('Sobrancelha Masculina')).toBe('outro');
  });
});

describe('alvoDias', () => {
  it('sem cadência: corte no dia 12, barba no dia 5', () => {
    expect(alvoDias(null, 'Corte de cabelo')).toBe(12);
    expect(alvoDias(0, 'Barba Express')).toBe(5);
    expect(alvoDias(undefined, 'Sobrancelha Masculina')).toBe(12);
  });
  it('com cadência: 4 dias antes do ritmo do cliente (caso Luiz André, barba a cada 9)', () => {
    expect(alvoDias(9, 'Barba Express')).toBe(5);
    expect(alvoDias(21, 'Corte de cabelo')).toBe(17);
    expect(alvoDias(4, 'Barba Express')).toBe(3); // nunca antes do 3º dia
  });
  it('cadência sem base (menos de 4 dias) cai no padrão', () => {
    expect(alvoDias(2, 'Corte de cabelo')).toBe(12);
  });
  it('retorno típico acompanha a cadência ou a família', () => {
    expect(retornoTipicoDias(null, 'Corte de cabelo')).toBe(17);
    expect(retornoTipicoDias(null, 'Barba Express')).toBe(7);
    expect(retornoTipicoDias(30, 'Corte de cabelo')).toBe(30);
  });
});

describe('decisaoEnvio', () => {
  it('espera antes do alvo, envia na janela, desiste depois', () => {
    expect(decisaoEnvio(1, 12)).toBe('esperar');
    expect(decisaoEnvio(11, 12)).toBe('esperar');
    expect(decisaoEnvio(12, 12)).toBe('enviar');
    expect(decisaoEnvio(12 + JANELA_DIAS, 12)).toBe('enviar');
    expect(decisaoEnvio(12 + JANELA_DIAS + 1, 12)).toBe('perdeu');
  });
});

describe('datas', () => {
  it('conta dias inteiros entre ISO', () => {
    expect(diasEntre('2026-09-08', '2026-09-20')).toBe(12);
    expect(diasEntre('2026-09-20', '2026-09-08')).toBe(-12);
    expect(diasEntre('lixo', '2026-09-08')).toBe(0);
  });
  it('soma dias sem depender de fuso', () => {
    expect(somarDiasIso('2026-09-28', 3)).toBe('2026-10-01');
    expect(somarDiasIso('2026-12-30', 2)).toBe('2027-01-01');
  });
});

describe('tempoDesde e mensagem', () => {
  it('fala o tempo como gente', () => {
    expect(tempoDesde(5)).toBe('uma semana');
    expect(tempoDesde(10)).toBe('uns dez dias');
    expect(tempoDesde(12)).toBe('quase duas semanas');
    expect(tempoDesde(17)).toBe('quase três semanas');
    expect(tempoDesde(30)).toBe('quase um mês');
  });
  it('convite: sem emoji, com as âncoras do webhook, sem preço e sem reajuste', () => {
    const m = mensagemConvite('Rinaldo', 12, 'Corte de cabelo');
    expect(m).toContain('Oi, Rinaldo. Já faz quase duas semanas do seu corte');
    expect(m).toContain('próximo horário reservado');
    expect(m).toContain('*1* — Quero sim');
    expect(m).toContain('*2* — Agora não');
    expect(m).not.toMatch(/R\$|reajuste|tabela|\p{Extended_Pictographic}/u);
  });
  it('barba e outros mudam o objeto da frase', () => {
    expect(mensagemConvite('', 5, 'Barba Express')).toContain('Oi. Já faz uma semana da sua barba');
    expect(mensagemConvite('Ana', 12, 'Sobrancelha Masculina')).toContain('da sua última visita');
  });
  it('etapa 2 conta a partir de hoje', () => {
    expect(mensagemPrazo()).toContain('*1* — Nos próximos dias');
    expect(diasDaOpcao(1)).toBe(1);
    expect(diasDaOpcao(2)).toBe(7);
    expect(diasDaOpcao(3)).toBe(15);
    expect(diasDaOpcao(9)).toBe(0);
  });
});

describe('linhaValor', () => {
  it('diz serviço e valor da data, sem comparar nem citar reajuste (regra de 03/09)', () => {
    const l = linhaValor('Corte de cabelo', 50);
    expect(norm(l)).toBe('Corte de cabelo: R$ 50,00.');
    expect(l).not.toMatch(/reajust|tabela|a partir|antes|passa a/i);
  });
  it('some sem preço válido ou sem serviço', () => {
    expect(linhaValor('Corte de cabelo', null)).toBe('');
    expect(linhaValor('Corte de cabelo', 0)).toBe('');
    expect(linhaValor('', 50)).toBe('');
  });
});

// v29.274.0 — o convite não presume mais o serviço: depois do "quero sim" vem a pergunta do serviço.
import { mensagemServicoConvite, servicoDaResposta, OPCOES_SERVICO_CONVITE } from '../../supabase/functions/_shared/convite-retorno.ts';

describe('pergunta do serviço no convite (caso Sharles, 01/10/2026)', () => {
  it('lista os serviços numerados, com o resumo da Barba Express', () => {
    const m = mensagemServicoConvite();
    expect(m).toContain('Qual serviço vai ser?');
    expect(m).toContain('*1* — Corte de cabelo');
    expect(m).toContain('só na máquina');
    expect(m).not.toMatch(/Pigmenta|Pezinho/);
    expect(m).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it('número escolhe o serviço; "corte" sozinho é o corte', () => {
    expect(servicoDaResposta('1')).toBe('Corte de cabelo');
    expect(servicoDaResposta('2 ')).toBe('Corte + Barba Express');
    expect(servicoDaResposta('so corte')).toBe('Corte de cabelo');
    expect(servicoDaResposta('cabelo')).toBe('Corte de cabelo');
  });
  it('qualquer outra coisa não escolhe nada (vai pra JuIA)', () => {
    expect(servicoDaResposta('9')).toBe('');
    expect(servicoDaResposta('corte e sobrancelha')).toBe('');
    expect(servicoDaResposta('o de sempre')).toBe('');
    expect(servicoDaResposta('')).toBe('');
  });
  it('todo serviço da lista é nome exato do catálogo', () => {
    for (const o of OPCOES_SERVICO_CONVITE) expect(o.nome).toMatch(/^(Corte de cabelo|Corte \+ Barba Express|Corte \+ Barba na navalha com toalha quente|Barba Express|Barba na navalha com toalha quente)$/);
  });
});

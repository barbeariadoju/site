import { describe, it, expect } from 'vitest';
import { montarCupom, montarMensagemComprovante, numeroComprovante, ehVendaSoDeProduto, primeiroNome } from '../../supabase/functions/_shared/comprovante.ts';

// v29.121.0 — o cupom não fiscal é o documento que o cliente guarda como prova do que pagou
// (caso Wellington, 02/09/2026, que questionou os valores depois do atendimento). Erro de
// conta aqui é erro na cara do cliente, então a soma e cada linha de valor são testadas.

// Intl separa "R$" do número com espaço duro (U+00A0). Normaliza só na comparação — o texto
// que vai pro WhatsApp continua sendo o do Intl.
const norm = (s) => String(s).replace(/ /g, ' ');

const base = {
  bookingId: '4f2a1c3e-9b77-4c11-8a01-abcdef123456',
  clienteNome: 'Wellington Souza',
  data: '2026-09-02',
  hoje: '2026-09-02',
  hora: '19:30',
  servicoNome: 'Corte de cabelo',
  servicoValor: 45,
  produtos: [],
  descontoFidelidade: 0,
  caixinha: 0,
  cortesia: false,
  cortesiaMotivo: '',
  pagamentoServico: 'pix',
  pagamentoProdutos: '',
  pagamentoAntecipado: false,
  balcao: false,
};

describe('numeroComprovante', () => {
  it('usa a data do atendimento e os 6 primeiros dígitos do id', () => {
    expect(numeroComprovante(base.bookingId, base.data)).toBe('020926-4F2A1C');
  });
  it('não quebra sem data nem id', () => {
    expect(numeroComprovante('', '')).toBe('000000-------'.slice(0, 13));
  });
});

describe('montarCupom', () => {
  it('lista serviço, total e forma de pagamento', () => {
    const cupom = norm(montarCupom(base));
    expect(cupom).toContain('*COMPROVANTE DE ATENDIMENTO*');
    expect(cupom).toContain('Nº 020926-4F2A1C — hoje às 19:30');
    expect(cupom).toContain('Corte de cabelo — R$ 45,00');
    expect(cupom).toContain('*Total: R$ 45,00*');
    expect(cupom).toContain('Pago no Pix');
    // v29.126.0: rodape fiscal e endereco removidos — mensagem gigante cansa o cliente
    expect(cupom).not.toContain('Documento sem valor fiscal');
    expect(cupom).not.toContain('Rua Dr');
    // Sem desconto não existe subtotal: linha a mais só confunde.
    expect(cupom).not.toContain('Subtotal');
  });

  it('soma produtos e agrupa os repetidos numa linha só', () => {
    const cupom = norm(montarCupom({
      ...base,
      produtos: [
        { nome: 'Água mineral', valor: 4 },
        { nome: 'Água mineral', valor: 4 },
        { nome: 'Pomada modeladora', valor: 35 },
      ],
    }));
    expect(cupom).toContain('Água mineral (2 x R$ 4,00) — R$ 8,00');
    expect(cupom).toContain('Pomada modeladora — R$ 35,00');
    expect(cupom).toContain('*Total: R$ 88,00*');
  });

  it('abre subtotal e desconto quando houve prêmio de fidelidade', () => {
    const cupom = norm(montarCupom({ ...base, servicoValor: 50, descontoFidelidade: 20 }));
    expect(cupom).toContain('Subtotal: R$ 50,00');
    expect(cupom).toContain('Desconto do cartão fidelidade: -R$ 20,00');
    expect(cupom).toContain('*Total: R$ 30,00*');
  });

  it('mostra as duas formas de pagamento só quando forem diferentes', () => {
    const mesmas = norm(montarCupom({ ...base, produtos: [{ nome: 'Água mineral', valor: 4 }], pagamentoProdutos: 'pix' }));
    expect(mesmas).toContain('Pago no Pix');
    expect(mesmas).not.toContain('produtos');

    const diferentes = norm(montarCupom({ ...base, produtos: [{ nome: 'Água mineral', valor: 4 }], pagamentoProdutos: 'dinheiro' }));
    expect(diferentes).toContain('Pago: serviço no Pix, produtos em dinheiro');
  });

  it('zera o total na cortesia e diz que não há nada a pagar', () => {
    const cupom = norm(montarCupom({ ...base, cortesia: true, cortesiaMotivo: 'João, funcionário', pagamentoServico: '' }));
    expect(cupom).toContain('Subtotal: R$ 45,00');
    expect(cupom).toContain('Cortesia (por conta da casa): -R$ 45,00');
    expect(cupom).toContain('*Total: R$ 0,00*');
    expect(cupom).toContain('Nada a pagar — cortesia da casa');
    // O motivo é anotação interna: nunca vai pro cliente.
    expect(cupom).not.toContain('funcionário');
  });

  it('mostra a caixinha fora do total', () => {
    const cupom = norm(montarCupom({ ...base, caixinha: 10 }));
    expect(cupom).toContain('*Total: R$ 45,00*');
    expect(cupom).toContain('Caixinha, recebida à parte: R$ 10,00');
  });

  it('nomeia o pagamento com prêmio de fidelidade', () => {
    const cupom = norm(montarCupom({ ...base, pagamentoServico: 'fidelidade' }));
    expect(cupom).toContain('Pago com prêmio do cartão fidelidade');
  });

  it('trata pagamento antecipado confirmado como forma de pagamento', () => {
    const cupom = norm(montarCupom({ ...base, pagamentoServico: '', pagamentoAntecipado: true }));
    expect(cupom).toContain('Pago no Pix (pago antecipado)');
  });

  it('usa o dia do atendimento, não o dia do envio', () => {
    // Caso Walter (29/08): comprovante segurado pela madrugada saía "hoje" no dia seguinte.
    const ontem = norm(montarCupom({ ...base, data: '2026-09-01', hoje: '2026-09-02' }));
    expect(ontem).toContain('— ontem às 19:30');
    const antigo = norm(montarCupom({ ...base, data: '2026-08-28', hoje: '2026-09-02' }));
    expect(antigo).toContain('— 28/08 às 19:30');
  });

  it('pula a linha de serviço na venda só de produto', () => {
    const cupom = norm(montarCupom({ ...base, servicoNome: 'Venda de produtos', servicoValor: 0, produtos: [{ nome: 'Pomada modeladora', valor: 35 }] }));
    expect(cupom).not.toContain('Venda de produtos');
    expect(cupom).toContain('Pomada modeladora — R$ 35,00');
    expect(cupom).toContain('*Total: R$ 35,00*');
  });
});

describe('montarMensagemComprovante', () => {
  it('abre com o primeiro nome e fecha com a pesquisa 1/2', () => {
    const msg = norm(montarMensagemComprovante(base));
    expect(msg.startsWith('Olá, Wellington. Muito obrigado pela visita à Barbearia do Ju.')).toBe(true);
    expect(msg).not.toContain('Se algum valor não bater com o que combinamos');
    expect(msg).toContain('Digite *1* para Satisfeito');
    expect(msg).toContain('Digite *2* para Insatisfeito');
  });

  it('convida o walk-in a agendar, numa linha só', () => {
    const msg = norm(montarMensagemComprovante({ ...base, balcao: true }));
    expect(msg).toContain('já deixo seu horário reservado');
  });

  it('venda só de produto agradece a compra e não faz a pesquisa', () => {
    const dados = { ...base, servicoNome: 'Venda de produtos', servicoValor: 0, produtos: [{ nome: 'Pomada modeladora', valor: 35 }] };
    const msg = norm(montarMensagemComprovante(dados));
    expect(ehVendaSoDeProduto(dados)).toBe(true);
    expect(msg).toContain('Obrigado pela compra');
    expect(msg).not.toContain('Digite *1*');
  });

  it('não usa emoji em lugar nenhum', () => {
    const msg = norm(montarMensagemComprovante({ ...base, produtos: [{ nome: 'Água mineral', valor: 4 }], caixinha: 10, descontoFidelidade: 5 }));
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(msg)).toBe(false);
  });
});

// v29.125.0 — caso Kelvin (03/09/2026): o cadastro tem "kelvin" em minúscula e tanto o cupom
// quanto a resposta da JuIA saíram "Olá, kelvin". Nome em caixa baixa numa mensagem que se
// apresenta como documento passa desleixo — e quem assina o WhatsApp é o Juliano.
describe('primeiroNome', () => {
  it('capitaliza a inicial de quem foi cadastrado em minúscula', () => {
    expect(primeiroNome('kelvin silva')).toBe('Kelvin');
  });
  it('pega só o primeiro nome e preserva o resto da grafia', () => {
    expect(primeiroNome('Israel Paula')).toBe('Israel');
    expect(primeiroNome('  wellington  souza ')).toBe('Wellington');
  });
  it('não estraga nome já correto nem acentuado', () => {
    expect(primeiroNome('Ávila')).toBe('Ávila');
    expect(primeiroNome('ávila')).toBe('Ávila');
  });
  it('cai no padrão quando não há nome', () => {
    expect(primeiroNome('')).toBe('Cliente');
    expect(primeiroNome(null)).toBe('Cliente');
  });
  it('é o mesmo nome que aparece no cupom', () => {
    const cupom = norm(montarMensagemComprovante({ ...base, clienteNome: 'kelvin silva' }));
    expect(cupom.startsWith('Olá, Kelvin.')).toBe(true);
  });
});

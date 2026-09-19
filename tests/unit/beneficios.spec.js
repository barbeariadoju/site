import { describe, it, expect } from 'vitest';
import {
  textoAniversario, textoLembreteAniversario, textoConviteIndicacao, textoCreditoIndicador,
  linkIndicacao, ddmm, REGULAMENTO_URL,
} from '../../supabase/functions/_shared/beneficios.ts';

// v29.209.0 — presente de aniversário e indicação: o que o cliente lê tem que dizer o quê,
// até quando e onde estão as regras — é isso que protege a casa e garante o benefício.

const semEmojiExceto = (t) => t.replace(/🙏/gu, '');
const todos = [
  textoAniversario({ nome: 'RAFAEL souza', validoAte: '2026-10-19' }),
  textoLembreteAniversario({ nome: 'Rafael', validoAte: '2026-10-19' }),
  textoConviteIndicacao({ nome: 'Rafael', codigo: 'ju6xst' }),
  textoCreditoIndicador({ nome: 'Rafael', indicado: 'jessica lima', validoAte: '2026-11-18' }),
];

describe('textos de benefícios', () => {
  it('nenhum leva emoji (só o 🙏 do agradecimento) nem pergunta numerada', () => {
    for (const t of todos) {
      expect(semEmojiExceto(t)).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\*1\*/);
    }
  });

  it('aniversário diz o presente, o prazo e onde estão as regras', () => {
    const t = todos[0];
    expect(t).toMatch(/^Olá, Rafael\./);
    expect(t).toContain('sobrancelha é por nossa conta');
    expect(t).toContain('até 19/10');
    expect(t).toContain('junto com o seu corte ou a sua barba');
    expect(t).toContain(REGULAMENTO_URL);
    expect(t).not.toMatch(/serviço extra/i); // a promessa vaga que motivou a versão
  });

  it('convite de indicação leva o link pessoal com o código e as duas pontas do benefício', () => {
    const t = todos[2];
    expect(t).toContain('https://www.barbeariadoju.com.br/agendar/?indicacao=JU6XST');
    expect(t).toContain('R$ 10 de desconto no primeiro atendimento, de terça a quinta');
    expect(t).toContain('você ganha R$ 10 no seu próximo atendimento');
    expect(t).not.toMatch(/quando ele /); // quem é indicado pode ser mulher
    expect(t).toContain(REGULAMENTO_URL);
  });

  it('crédito de quem indicou usa o primeiro nome do indicado, sem marcar gênero', () => {
    const t = todos[3];
    expect(t).toContain('Jessica já teve o primeiro atendimento');
    expect(t).toContain('válido até 18/11');
    expect(t).not.toMatch(/\bO Jessica\b|atendido na/);
  });

  it('tratamento no cadastro não vira nome (caso "Sr Magno")', () => {
    expect(textoConviteIndicacao({ nome: 'Sr Magno', codigo: 'JU2345' })).toMatch(/^Olá, Magno\./);
    expect(textoAniversario({ nome: 'Dr. paulo spina', validoAte: '2026-10-19' })).toMatch(/^Olá, Paulo\./);
  });

  it('sem nome não deixa vírgula solta', () => {
    expect(textoAniversario({ nome: '', validoAte: '2026-10-19' })).toMatch(/^Olá\. A Barbearia/);
  });

  it('utilitários', () => {
    expect(ddmm('2026-10-19')).toBe('19/10');
    expect(linkIndicacao(' ab12 ')).toBe('https://www.barbeariadoju.com.br/agendar/?indicacao=AB12');
  });
});

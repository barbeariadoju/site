import { primeiroNome as primeiroNomeBase } from './primeiro-nome.ts'
// v29.209.0 — Presente de aniversário e programa de indicação (Juliano, 19/09/2026).
// Fonte única dos textos que o cliente recebe; teste em tests/unit/beneficios.spec.js.
// Regras completas e públicas em /beneficios.html — é o que protege a casa: prazo, condição
// e o que não vale ficam escritos antes, não negociados na hora.
//
// Tom da casa: formal e cordial, sem emoji (só 🙏 em agradecimento), sem pergunta numerada
// (não disputa a fila de perguntas da JuIA), sem superlativo, sem expor agenda.

export const REGULAMENTO_URL = 'https://www.barbeariadoju.com.br/beneficios.html'
export const AGENDAR_URL = 'https://www.barbeariadoju.com.br/agendar/'
export const linkIndicacao = (codigo: string) => `${AGENDAR_URL}?indicacao=${encodeURIComponent(String(codigo || '').trim().toUpperCase())}`

// Tratamento no cadastro ("Sr Magno", "Dr. Paulo") não é nome: pula e usa o seguinte
// (caso real no primeiro teste, 19/09/2026: saía "Olá, Sr.").
export const primeiroNome = (nome: unknown) => primeiroNomeBase(nome, '')
const ola = (nome: unknown) => { const n = primeiroNome(nome); return n ? `Olá, ${n}.` : 'Olá.' }

// 'YYYY-MM-DD' → 'dd/mm'
export const ddmm = (iso: string) => { const [, m, d] = String(iso || '').slice(0, 10).split('-'); return d && m ? `${d}/${m}` : '' }

export const textoAniversario = (p: { nome?: string | null; validoAte: string }) => [
  `${ola(p.nome)} A Barbearia do Ju deseja a você um feliz aniversário.`,
  '',
  `Para comemorar, a sobrancelha é por nossa conta em um atendimento até ${ddmm(p.validoAte)}, junto com o seu corte ou a sua barba. O presente já está registrado no seu cadastro: não precisa pedir, é aplicado no dia.`,
  '',
  `Para agendar, é só me responder aqui ou usar o site: ${AGENDAR_URL}`,
  `Regras do presente: ${REGULAMENTO_URL}`,
].join('\n')

export const textoLembreteAniversario = (p: { nome?: string | null; validoAte: string }) => [
  `${ola(p.nome)} Passando para lembrar que o seu presente de aniversário na Barbearia do Ju, a sobrancelha por nossa conta, vale até ${ddmm(p.validoAte)}.`,
  '',
  `Se quiser aproveitar, é só me responder aqui ou agendar pelo site: ${AGENDAR_URL}`,
].join('\n')

export const textoConviteIndicacao = (p: { nome?: string | null; codigo: string }) => [
  `${ola(p.nome)} Obrigado por continuar confiando na Barbearia do Ju.`,
  '',
  'Se quiser indicar a barbearia a um amigo, este é o seu link pessoal:',
  linkIndicacao(p.codigo),
  '',
  'Quem agendar pela primeira vez por ele ganha R$ 10 de desconto no primeiro atendimento, de terça a quinta. E, quando esse primeiro atendimento for concluído, você ganha R$ 10 no seu próximo atendimento.',
  '',
  `Regras: ${REGULAMENTO_URL}`,
].join('\n')

export const textoCreditoIndicador = (p: { nome?: string | null; indicado?: string | null; validoAte: string }) => {
  const quem = primeiroNome(p.indicado)
  return [
    `${ola(p.nome)} A sua indicação deu certo: ${quem || 'a pessoa que você indicou'} já teve o primeiro atendimento na Barbearia do Ju. Obrigado pela confiança 🙏`,
    '',
    `Você ganhou R$ 10 de desconto no seu próximo atendimento, válido até ${ddmm(p.validoAte)}. Já está registrado no seu cadastro e é aplicado no dia.`,
  ].join('\n')
}

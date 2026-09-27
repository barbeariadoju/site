import { describe, it, expect } from 'vitest'
import { montarMensagemReativacao, tempoDesde, LINK_AGENDAR } from '../../supabase/functions/_shared/reativacao.ts'

// v29.246.0 — lembrete de reativação em etapas: curto, sem pergunta, sem emoji, com o link.

describe('tempoDesde', () => {
  it('fala em meses, como o Juliano diria', () => {
    expect(tempoDesde(30)).toBe('um mês')
    expect(tempoDesde(45)).toBe('um mês e meio')
    expect(tempoDesde(60)).toBe('dois meses')
    expect(tempoDesde(75)).toBe('dois meses e meio')
    expect(tempoDesde(90)).toBe('três meses')
    expect(tempoDesde(105)).toBe('três meses e meio')
    expect(tempoDesde(120)).toBe('quatro meses')
    expect(tempoDesde(150)).toBe('cinco meses')
    expect(tempoDesde(365)).toBe('um ano')
  })
})

describe('montarMensagemReativacao', () => {
  const base = { nome: 'Marcos', servico: 'corte de cabelo', dias: 30, stage: 1 }
  it('é curta, sem pergunta, sem emoji e leva o link', () => {
    for (const stage of [1, 2, 3, 7, 12]) {
      const m = montarMensagemReativacao({ ...base, stage, dias: 30 + 15 * (stage - 1) })
      expect(m.length).toBeLessThan(230)
      expect(m).not.toMatch(/\?/)
      expect(m).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
      expect(m).toContain(LINK_AGENDAR)
      expect(m).toContain('corte de cabelo')
      expect(m.startsWith('Olá, Marcos. ')).toBe(true)
    }
  })
  it('muda o texto nas três primeiras etapas e depois só o tempo', () => {
    const e1 = montarMensagemReativacao({ ...base, stage: 1, dias: 30 })
    const e2 = montarMensagemReativacao({ ...base, stage: 2, dias: 45 })
    const e3 = montarMensagemReativacao({ ...base, stage: 3, dias: 60 })
    const e4 = montarMensagemReativacao({ ...base, stage: 4, dias: 75 })
    expect(e1).not.toBe(e2)
    expect(e2).not.toBe(e3)
    expect(e3.replace('dois meses', 'X')).toBe(e4.replace('dois meses e meio', 'X'))
    expect(e1).toContain('um mês')
    expect(e2).toContain('um mês e meio')
  })
  it('sem nome não deixa vírgula sobrando; sem serviço diz "atendimento"', () => {
    const m = montarMensagemReativacao({ nome: '', servico: '', dias: 30, stage: 1 })
    expect(m.startsWith('Olá. Aqui é da Barbearia do Ju.')).toBe(true)
    expect(m).toContain('último atendimento')
  })
  it('nunca fala da aparência de quem lê', () => {
    for (const stage of [1, 2, 3]) expect(montarMensagemReativacao({ ...base, stage })).not.toMatch(/visual|trato|na hora de/i)
  })
})

import { describe, it, expect } from 'vitest'
import { COLUNAS_ADS, csvCampo, montarCsvAds } from '../../supabase/functions/_shared/ads-csv.ts'

describe('CSV de conversões offline do Google Ads', () => {
  it('mantém a ordem e os nomes exatos das colunas que o Google espera', () => {
    expect(COLUNAS_ADS.join(',')).toBe(
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
    )
  })

  it('sem nenhuma conversão, devolve só o cabeçalho — nunca um arquivo vazio', () => {
    expect(montarCsvAds([])).toBe(
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\r\n',
    )
  })

  it('separa linhas por CRLF e termina o arquivo com quebra', () => {
    const csv = montarCsvAds([{
      'Google Click ID': 'Cj0KCQjw',
      'Conversion Name': 'Agendamento confirmado (WhatsApp)',
      'Conversion Time': '2026-09-01 19:58:40-03:00',
      'Conversion Value': '48.00',
      'Conversion Currency': 'BRL',
    }])
    expect(csv).toBe(
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\r\n' +
      'Cj0KCQjw,Agendamento confirmado (WhatsApp),2026-09-01 19:58:40-03:00,48.00,BRL\r\n',
    )
    // sem a quebra final o Google descarta a ultima conversao, sem avisar
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('escapa vírgula, aspas e quebra de linha em vez de estourar a coluna', () => {
    expect(csvCampo('Agendamento, confirmado')).toBe('"Agendamento, confirmado"')
    expect(csvCampo('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCampo('linha1\nlinha2')).toBe('"linha1\nlinha2"')
    expect(csvCampo('simples')).toBe('simples')
  })

  it('campo ausente vira vazio, não a string "undefined"', () => {
    expect(csvCampo(undefined)).toBe('')
    expect(csvCampo(null)).toBe('')
    const csv = montarCsvAds([{ 'Google Click ID': 'abc' }])
    expect(csv.split('\r\n')[1]).toBe('abc,,,,')
  })

  it('valor numérico vira texto sem notação científica nem separador de milhar', () => {
    expect(csvCampo(48)).toBe('48')
    expect(csvCampo(1250.5)).toBe('1250.5')
  })
})

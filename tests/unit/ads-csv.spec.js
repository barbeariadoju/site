import { describe, it, expect } from 'vitest'
import { COLUNAS_ADS, csvCampo, montarCsvAds } from '../../supabase/functions/_shared/ads-csv.ts'

const LINHA_BASE = {
  'Google Click ID': '',
  'WBRAID': '',
  'GBRAID': '',
  'Conversion Name': 'Agendamento confirmado (WhatsApp)',
  'Conversion Time': '2026-09-01 19:58:40-03:00',
  'Conversion Value': '48.00',
  'Conversion Currency': 'BRL',
}

describe('CSV de conversões offline do Google Ads', () => {
  it('mantém a ordem e os nomes exatos das colunas que o Google espera', () => {
    expect(COLUNAS_ADS.join(',')).toBe(
      'Google Click ID,WBRAID,GBRAID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
    )
  })

  it('sem nenhuma conversão, devolve só o cabeçalho — nunca um arquivo vazio', () => {
    expect(montarCsvAds([])).toBe(COLUNAS_ADS.join(',') + '\r\n')
  })

  it('separa linhas por CRLF e termina o arquivo com quebra', () => {
    const csv = montarCsvAds([{ ...LINHA_BASE, 'Google Click ID': 'Cj0KCQjw' }])
    expect(csv).toBe(
      COLUNAS_ADS.join(',') + '\r\n' +
      'Cj0KCQjw,,,Agendamento confirmado (WhatsApp),2026-09-01 19:58:40-03:00,48.00,BRL\r\n',
    )
    // sem a quebra final o Google descarta a ultima conversao, sem avisar
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  // v29.139.0 — iPhone. Um wbraid enviado na coluna de gclid e descartado em silencio.
  it('clique de iPhone (wbraid) sai na coluna WBRAID, com a de gclid vazia', () => {
    const linha = montarCsvAds([{ ...LINHA_BASE, 'WBRAID': 'Cr4KCAjw_WBRAID' }]).split('\r\n')[1]
    const campos = linha.split(',')
    expect(campos[0]).toBe('')                 // Google Click ID vazio
    expect(campos[1]).toBe('Cr4KCAjw_WBRAID')  // WBRAID preenchido
    expect(campos[2]).toBe('')                 // GBRAID vazio
  })

  it('clique de iPhone (gbraid) sai na coluna GBRAID, com as outras duas vazias', () => {
    const linha = montarCsvAds([{ ...LINHA_BASE, 'GBRAID': 'Cj8KCAjw_GBRAID' }]).split('\r\n')[1]
    const campos = linha.split(',')
    expect(campos[0]).toBe('')
    expect(campos[1]).toBe('')
    expect(campos[2]).toBe('Cj8KCAjw_GBRAID')
  })

  it('nunca manda dois identificadores na mesma linha vindos da view', () => {
    // a view usa coalesce/nullif: so um dos tres vem preenchido por linha
    const linha = montarCsvAds([{ ...LINHA_BASE, 'Google Click ID': 'Cj0K_GCLID' }]).split('\r\n')[1]
    const [gclid, wbraid, gbraid] = linha.split(',')
    expect([gclid, wbraid, gbraid].filter(Boolean)).toHaveLength(1)
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
    expect(csv.split('\r\n')[1]).toBe('abc,,,,,,')
  })

  it('valor numérico vira texto sem notação científica nem separador de milhar', () => {
    expect(csvCampo(48)).toBe('48')
    expect(csvCampo(1250.5)).toBe('1250.5')
  })
})

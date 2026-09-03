// Fonte única do CSV de conversões offline do Google Ads.
// Fica aqui, e não dentro da function, porque o formato tem três detalhes que o Google
// aceita ou recusa em silêncio — e silêncio é o que já custou caro neste projeto:
//   1. separador de linha CRLF;
//   2. quebra de linha no FIM do arquivo (sem ela a última conversão é descartada);
//   3. escaping RFC 4180 (aspas dobradas, campo entre aspas quando tem vírgula/aspas/quebra).

export const COLUNAS_ADS = [
  'Google Click ID',
  'Conversion Name',
  'Conversion Time',
  'Conversion Value',
  'Conversion Currency',
] as const

export const csvCampo = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const montarCsvAds = (linhas: Array<Record<string, unknown>>): string => {
  const saida = [COLUNAS_ADS.join(',')]
  for (const r of linhas) saida.push(COLUNAS_ADS.map((c) => csvCampo(r[c])).join(','))
  return saida.join('\r\n') + '\r\n'
}

// Lê de volta TODOS os QRs de uma peça já renderizada, recortando cada região.
// Regra da casa desde 30/08: o QR conferido é o do arquivo FINAL, nunca o do original —
// foi assim que se pegou o /precos sem barra, que teria queimado a impressão inteira.
// Rode da raiz: node artes/conferir-qrs.mjs <arquivo.png>
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const arquivo = process.argv[2];
const png = PNG.sync.read(readFileSync(arquivo));

// Regiões de cada QR na peça de avaliação (A5 1748x2480), com folga.
const regioes = [
  { nome: 'Google (principal)', x: 1160, y: 420, w: 500, h: 500, espero: 'g.page' },
  { nome: 'Wi-Fi', x: 130, y: 1225, w: 265, h: 270, espero: 'WIFI:' },
  { nome: 'Pix', x: 925, y: 1225, w: 265, h: 270, espero: 'br.gov.bcb.pix' },
  { nome: 'Instagram', x: 130, y: 1630, w: 265, h: 270, espero: 'instagram.com/barbeariadoju_' },
  { nome: 'Catálogo de serviços', x: 925, y: 1630, w: 265, h: 270, espero: 'barbeariadoju.com.br' },
];

let falhas = 0;
for (const r of regioes) {
  const w = Math.min(r.w, png.width - r.x);
  const h = Math.min(r.h, png.height - r.y);
  const corte = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const de = ((r.y + y) * png.width + r.x) * 4;
    corte.set(png.data.subarray(de, de + w * 4), y * w * 4);
  }
  const lido = jsQR(corte, w, h);
  if (!lido) { console.log(`FALHA  ${r.nome.padEnd(22)} nao consegui ler o QR nessa regiao`); falhas++; continue; }
  const ok = lido.data.includes(r.espero);
  if (!ok) falhas++;
  console.log(`${ok ? 'OK    ' : 'ERRO  '} ${r.nome.padEnd(22)} ${lido.data.slice(0, 78)}`);
}
console.log(falhas ? `\n*** ${falhas} problema(s) — NAO mandar pra grafica ***` : '\nTodos os QRs conferidos e corretos.');
process.exit(falhas ? 1 : 0);

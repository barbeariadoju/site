// Lê de volta o QR da arte. Regra da casa desde a plaquinha de 30/08: nunca mandar peça pra
// gráfica sem decodificar o QR do arquivo FINAL — foi assim que se pegou o /precos sem barra,
// que teria queimado a impressão inteira.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const arquivo = process.argv[2];
const png = PNG.sync.read(readFileSync(arquivo));
const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

if (!r) {
  console.log(`${arquivo}: NAO FOI POSSIVEL LER O QR (${png.width}x${png.height})`);
  process.exit(2);
}
console.log(`${arquivo} (${png.width}x${png.height})`);
console.log(`conteudo: ${r.data}`);

// Confere as armadilhas conhecidas
const d = r.data;
if (/^https?:\/\//i.test(d)) {
  const u = new URL(d);
  const ehDaCasa = /(^|\.)barbeariadoju\.com\.br$/i.test(u.hostname);
  console.log(`dominio: ${u.hostname}  ${ehDaCasa ? '(da casa)' : '*** NAO E O DOMINIO DA BARBEARIA ***'}`);
  const temExtensao = /\.[a-z0-9]{2,5}$/i.test(u.pathname);
  if (u.pathname !== '/' && !u.pathname.endsWith('/') && !temExtensao) {
    console.log(`*** ATENCAO: caminho SEM barra final ("${u.pathname}") — no GitHub Pages isso da erro no navegador. Foi o bug pego em 30/08. ***`);
  } else {
    console.log('barra final: ok');
  }
}

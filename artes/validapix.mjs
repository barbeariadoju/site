// Valida o BR Code (Pix) do QR: confere o CRC16 e lê os campos.
// Um CRC errado faz o app do banco recusar o código — e isso só aparece quando um cliente
// tenta pagar na frente do balcão.
const br = process.argv[2];

const crc16 = (s) => {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const semCrc = br.slice(0, br.length - 4);
const crcNoCodigo = br.slice(-4);
const crcCalculado = crc16(semCrc);
console.log(`CRC no codigo: ${crcNoCodigo}`);
console.log(`CRC calculado: ${crcCalculado}`);
console.log(crcNoCodigo === crcCalculado ? '>>> CRC VALIDO — o app do banco aceita' : '>>> *** CRC INVALIDO — o app do banco vai RECUSAR ***');

// Le os campos EMV de primeiro nivel
const campos = {};
let i = 0;
while (i < br.length - 4) {
  const id = br.slice(i, i + 2);
  const len = Number(br.slice(i + 2, i + 4));
  campos[id] = br.slice(i + 4, i + 4 + len);
  i += 4 + len;
}
const nomes = { '00': 'formato', '26': 'conta (chave Pix)', '52': 'categoria', '53': 'moeda', '58': 'pais', '59': 'nome do recebedor', '60': 'cidade', '62': 'extra' };
console.log('\ncampos:');
for (const [id, v] of Object.entries(campos)) console.log(`  ${id} ${(nomes[id] || '').padEnd(20)} ${v}`);
console.log('\nmoeda 986 = BRL, pais BR:', campos['53'] === '986' && campos['58'] === 'BR' ? 'ok' : '*** conferir ***');

// Casca única do site público: a barra do topo (.page-bar) e o rodapé (.site-footer) saem
// daqui, e não mais escritos à mão página por página. v29.250.0 (auditoria de 27/09/2026:
// 9 variantes de barra e 7 de rodapé; agendar, horário, área do cliente, reagendar e
// vale-presente não tinham nenhuma das duas — o cliente "saía do site" ao agendar).
//
//   node scripts/casca.mjs          aplica em todas as páginas
//   node scripts/casca.mjs --check  só confere (usado pelo teste tests/unit/casca.spec.js)
//
// Dois modos de barra:
//   completo — páginas de conteúdo: links, Menu, WhatsApp, JuIA (se a página carrega o chat)
//              e o botão "Agendar horário" (com ?servico= quando a página já tinha).
//   fluxo    — páginas em que o cliente já está fazendo alguma coisa (agendar, horário, área
//              do cliente, reagendar, vale, senha, minha assinatura): sem o botão de agendar
//              e, no celular, fina no topo, para a zona do polegar ficar com o botão da etapa.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAIZ } from './versoes-lib.mjs';

const WA = 'https://wa.me/5511967073038';
const LINKS = [['/servicos.html', 'Serviços e preços'], ['/perguntas-frequentes.html', 'Dúvidas'], ['/blog.html', 'Blog']];

export const FLUXO = new Set([
  'agendar/index.html', 'agendar/horario/index.html', 'cliente.html', 'meu-agendamento.html',
  'reagendar.html', 'vale-presente/index.html', 'senha/index.html', 'clube/minha-assinatura/index.html',
]);
// Páginas que ficam sem casca de propósito: redirecionamentos, documento (recibo), página
// offline do service worker, pontes de QR, avaliação, e /precos/ (única sem o CSS do site;
// vira redirecionamento para servicos.html depois de 01/10).
export const FORA = new Set([
  'agendar.html', 'admin-atendimento.html', 'servico-barboterapia-ozonio.html', 'avaliar/index.html',
  'recibo.html', 'offline.html', 'whatsapp.html', 'instagram.html', 'salvar-contato.html',
  'avaliacao.html', 'experiencia.html', 'precos/index.html', 'precos/setembro/index.html',
]);

const ATUAL = { 'index.html': '/', 'servicos.html': '/servicos.html', 'perguntas-frequentes.html': '/perguntas-frequentes.html', 'blog.html': '/blog.html' };
const cur = (href, atual) => (href === atual ? ' aria-current="page"' : '');

export function barra({ modo, atual = null, juia = false, cta = null, alvo = 'conteudo' }) {
  const links = LINKS.map(([h, t]) => `<a class="page-bar-link" href="${h}"${cur(h, atual)}>${t}</a>`).join('');
  const menu = [['/', 'Início'], ...LINKS].map(([h, t]) => `<a href="${h}"${cur(h, atual)}>${t}</a>`).join('')
    + `<a href="${WA}" rel="noopener" target="_blank">WhatsApp</a>`;
  const ctaHtml = modo === 'completo' ? `<a class="page-bar-cta" href="${(cta || {}).href || '/agendar/#servicos'}">${(cta || {}).label || 'Agendar horário'}</a>` : '';
  // v29.253.0 — link para pular a barra (teclado e leitor de tela): primeiro item da página, só aparece com foco.
  return `<a class="pular-conteudo" href="#${alvo}">Pular para o conteúdo</a>`
    + `<nav class="page-bar${modo === 'fluxo' ? ' is-fluxo' : ''}" id="barra-agendar" aria-label="Principal">`
    + `<a class="page-bar-brand" href="/">Barbearia do Ju</a><div class="page-bar-links">${links}</div>`
    + `<div class="page-bar-actions"><details class="page-bar-menu"><summary>Menu</summary><nav aria-label="Menu">${menu}</nav></details>`
    + `<a class="page-bar-alt" href="${WA}" rel="noopener" target="_blank">WhatsApp</a>`
    + (juia ? '<button class="page-bar-alt" type="button" data-juia-open>JuIA</button>' : '')
    + ctaHtml + '</div></nav>';
}

// O link do Clube entra no rodapé na virada de 01/10/2026 (lançamento): quem põe é o plano do
// reajuste (scripts/reajuste-2026-10/plano.json, uma entrada por página). Depois que a virada
// grava APLICADO, o rodapé padrão passa a ter o link e o --check continua batendo.
const CLUBE_NO_AR = existsSync(join(RAIZ, 'scripts', 'reajuste-2026-10', 'APLICADO'));

export const RODAPE = '<footer class="site-footer"><strong>Barbearia do Ju</strong>'
  + '<p><a href="https://maps.app.goo.gl/VJAfv4MJpd84tmDY7" rel="noopener" target="_blank">Rua Dr. Antônio da Cruz, 482 · Centro · Bragança Paulista/SP</a>'
  + `<br/>Terça a sexta, 8h às 19h · Sábado, 8h às 15h · <a href="${WA}" rel="noopener" target="_blank">(11) 96707-3038</a></p>`
  + '<nav aria-label="Rodapé"><a href="/servicos.html">Serviços e preços</a><a href="/agendar/#servicos">Agendar</a>'
  + '<a href="/perguntas-frequentes.html">Dúvidas</a><a href="/blog.html">Blog</a>'
  + (CLUBE_NO_AR ? '<a href="/clube/">Clube do Ju</a>' : '')
  + '<a href="/sobre-o-juliano.html">Sobre o Juliano</a><a href="/privacidade.html">Privacidade</a></nav>'
  + '<small>© 2026 Barbearia do Ju</small></footer>';

function blocoNav(s, inicio) {
  let prof = 0;
  const re = /<(\/?)nav\b[^>]*>/g;
  re.lastIndex = inicio;
  for (let m; (m = re.exec(s));) {
    prof += m[1] ? -1 : 1;
    if (prof === 0) return [inicio, m.index + m[0].length];
  }
  throw new Error('nav sem fechamento');
}

export function paginasPublicas(dir = RAIZ) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    if (['node_modules', 'test-results', 'tests', 'supabase', 'whatsapp-ai', 'scripts', 'database', 'artes', '.git', '.claude', '.impeccable', '.estilo', 'camera-cadeira', 'assets', 'css'].includes(nome)) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...paginasPublicas(p));
    else if (nome.endsWith('.html')) {
      const rel = relative(RAIZ, p).replace(/\\/g, '/');
      if (!rel.startsWith('admin') && !FORA.has(rel)) out.push(rel);
    }
  }
  return out.sort();
}

export function carimbar(rel, html) {
  let s = html;
  const modo = FLUXO.has(rel) ? 'fluxo' : 'completo';
  const juia = /juia-chat\.js/.test(s);
  let cta = null;
  // Destino do "Pular para o conteúdo": o id que o <main> já tiver, ou "conteudo".
  const main = s.match(/<main(?=[\s>])[^>]*>/);
  const idMain = main && (main[0].match(/\sid="([^"]+)"/) || [])[1];
  const alvo = idMain || 'conteudo';
  if (main && !idMain) s = s.replace(main[0], main[0].replace('<main', '<main id="conteudo"'));
  s = s.replace(/<a class="pular-conteudo" href="#[^"]*">Pular para o conteúdo<\/a>\s*/, '');
  const i = s.indexOf('<nav class="page-bar');
  if (i >= 0) {
    const [a, b] = blocoNav(s, i);
    const velho = s.slice(a, b);
    const m = velho.match(/<a class="page-bar-cta" href="([^"]+)">([^<]+)<\/a>/);
    // Mantém o CTA contextual (?servico=, e "Ver os planos" do contrato do Clube); /clube/ volta ao padrão.
    if (m && (m[1].includes('?servico=') || (rel === 'clube/contrato/index.html'))) cta = { href: m[1], label: m[2] };
    s = s.slice(0, a) + barra({ modo, atual: ATUAL[rel] || null, juia, cta, alvo }) + s.slice(b);
  } else {
    const nova = barra({ modo, atual: ATUAL[rel] || null, juia, cta, alvo });
    const grain = '<div class="bg-grain"></div>';
    if (s.includes(grain)) s = s.replace(grain, grain + '\n' + nova);
    else s = s.replace(/<body([^>]*)>/, (t) => t + '\n' + nova);
  }
  // Rodapé: troca o que existir; se não existir, entra logo depois do </main>.
  const f = s.match(/<footer[\s\S]*?<\/footer>/);
  if (f) s = s.replace(f[0], RODAPE);
  else if (s.includes('</main>')) s = s.replace('</main>', '</main>\n' + RODAPE);
  return s;
}

if ((process.argv[1] || '').replace(/\\/g, '/').endsWith('scripts/casca.mjs')) {
  const check = process.argv.includes('--check');
  let mudou = 0;
  for (const rel of paginasPublicas()) {
    const p = join(RAIZ, rel);
    const antes = readFileSync(p, 'utf8');
    const depois = carimbar(rel, antes);
    if (depois !== antes) {
      mudou++;
      if (check) console.log('fora do padrão:', rel);
      else writeFileSync(p, depois);
    }
  }
  console.log(check ? `${mudou} página(s) fora do padrão` : `${mudou} página(s) atualizada(s)`);
  process.exit(check && mudou ? 1 : 0);
}

# Barbearia do Ju — site, agendamento e painel

Site estático (sem build) da Barbearia do Ju, em Bragança Paulista/SP, com agendamento online e o painel "Barbearia OS". Publicado pelo GitHub Pages atrás do Cloudflare em https://www.barbeariadoju.com.br.

Antes de mexer em qualquer coisa:

- **`CLAUDE.md`** — como o projeto funciona, armadilhas que já custaram retrabalho e decisões que não devem ser revertidas.
- **`PRODUCT.md`** — para quem é, o que o site precisa fazer e o que a marca não faz.
- **`CHANGELOG.md`** — o que mudou, por quê e o que foi decidido contra o óbvio.

Rotina de publicação: `npm test` (unitários + navegador), `CHANGELOG.md`, `git push origin main`.

Ferramentas do próprio repositório:

- `node scripts/casca.mjs` — carimba a barra do topo e o rodapé padrão nas páginas públicas (`--check` só confere).
- `node scripts/bump-v.mjs <versão> <arquivo...>` — troca o `?v=` de um CSS/JS em todas as referências de uma vez (`--check` lista divergências).
- `ROTULO=antes npx playwright test -c playwright.estilo.config.js` e `node tests/estilo/comparar.mjs antes depois` — prova, por estilo calculado, que uma mudança de CSS não alterou nada além do pretendido.

Documentação de versões antigas (guias de instalação e atualização das versões 19 a 28): `docs/historico/`.

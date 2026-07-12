# Agenda própria — Barbearia do Ju

Esta versão inicia a segunda etapa sem alterar o funcionamento do site atual.

## O que já está pronto
- `agendar.html`: página responsiva de agendamento, com SEO, Open Graph, GTM e dados estruturados.
- `admin.html`: painel restrito para visualizar, confirmar e cancelar pedidos.
- `supabase-setup.sql`: banco, regras de segurança e prevenção de horários duplicados.
- `agenda-config.js`: local para inserir URL e chave pública do Supabase.
- vCard: removida a versão alternativa; mantida somente a versão com foto incorporada.

## Para ativar
1. Criar um projeto no Supabase.
2. Executar `supabase-setup.sql` no SQL Editor.
3. Criar o usuário administrador em Authentication > Users.
4. Copiar Project URL e anon public key para `agenda-config.js`.
5. Testar `agendar.html` e `admin.html`.
6. Somente depois trocar os botões do site e o link do Google para a agenda própria.

## SEO e publicação
`agendar.html` está temporariamente com `noindex,follow` para não indexar uma página ainda não conectada. Após a ativação, trocar para `index,follow` e incluir no `sitemap.xml`.

## Cloudflare
O arquivo `_headers` foi preservado para uma possível migração ao Cloudflare Pages. Brotli, HTTP/3 e minificação são configurações do painel da Cloudflare, não do HTML.

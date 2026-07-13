# Changelog
## 22.4 — Security & UX Release
- Adicionados Content-Security-Policy e X-Frame-Options.
- Implementado Consent Mode para Analytics/Ads e aviso de privacidade.
- Criada página `privacidade.html`.
- Adicionados toasts, carregamento global e tratamento visual de erros no painel.
- Atualizados cache, Service Worker e documentação.


## V22.3 — Experiência pós-atendimento

- Criada a página `404.html` com identidade visual da Barbearia do Ju e atalhos para início, serviços/agendamento e WhatsApp.
- Após marcar um atendimento como concluído, o painel pergunta se deseja agradecer e solicitar uma avaliação no Google pelo WhatsApp.
- A mensagem utiliza o link oficial de avaliação `https://g.page/r/CaQfC5axIQQIEBM/review`.
- Atualizado o Service Worker e o identificador de cache para evitar versões antigas.
- Nenhuma alteração no banco de dados ou nas Edge Functions.

## V22.1 — Estabilização
- Restringido o CORS da Edge Function `ju-ia-admin` ao domínio `https://www.barbeariadoju.com.br`.
- Mantido o mesmo padrão de CORS já aplicado à função `ju-ia-site`.
- Corrigida a documentação do vídeo: o código usa `preload="none"`, opção escolhida para desempenho.
- Adicionados `VERSAO.md`, `CHANGELOG.md` e `ROADMAP.md` para controle do projeto.
- Nenhuma alteração visual, de banco de dados ou de regras de agendamento nesta versão.

## V22 — Sprint 1
- Fresha removido da experiência pública.
- Horários oficiais alinhados.
- Modo Atendimento adicionado.
- Duplicações do GTM e de scripts corrigidas.

## V22.2 — Refinamentos pré-publicação

- Adicionadas regras `Disallow` para todas as páginas administrativas no `robots.txt`.
- Atualizada a descrição do `manifest.webmanifest`, removendo a referência antiga a agendamento pelo WhatsApp.
- Incluída orientação para validar o redirecionamento de `https://barbeariadoju.com.br` para `https://www.barbeariadoju.com.br` no Cloudflare.
- Nenhuma alteração visual, de banco, agenda, CRM ou Edge Functions.

V22.5 — Correção do carrinho de serviços, integração serviços/produtos/agenda e ordem de carregamento do Supabase.

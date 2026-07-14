# V24.3.3

- Oculta horários passados na agenda do mesmo dia.
- Exige antecedência mínima de 15 minutos para novos agendamentos.
- Usa o fuso horário America/Sao_Paulo no banco.
- Validação aplicada no SQL e também no navegador.
- Impede gravação direta de horários fora da margem de segurança.

# V24.3.2
- Corrige carrinho embaçado no desktop, Android e iPhone.
- Move o overlay escuro para trás do carrinho.
- Remove o backdrop-filter do overlay para compatibilidade entre navegadores.

# V24.3 — Carrinho mobile responsivo

- Corrige distorção e corte lateral do carrinho em Android e iOS.
- Carrinho abre como bottom sheet, limitado à viewport.
- Adiciona rolagem interna, safe area do iPhone e botões maiores.
- Oculta JuIA e botões flutuantes enquanto o carrinho está aberto.
- Bloqueia rolagem da página ao fundo.
- Mantém o funcionamento desktop.

## V23.0 — Cliente Inteligente + CRM Premium
- Nova página Minha Área com próximo horário, última visita, fidelidade e repetir serviço.
- CRM com VIP, etiquetas, preferências técnicas, serviços/produtos favoritos, pagamento e intervalo de retorno.
- Novo SQL 015 e contexto comercial ampliado para a JuIA.

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

## V22.6
- Sincroniza automaticamente clientes de agendamentos com o CRM para habilitar edição, arquivamento e exclusão.
- Corrige quebra visual do WhatsApp no bloco de contato desktop.
- Adiciona botão × para remover um serviço individualmente do carrinho.
- Melhora a mensagem de confirmação da JuIA no código-fonte da Edge Function.

## V24.2 — Revisão geral e estabilização
- Remove o link “Privacidade” inserido acidentalmente no card Corte + Barboterapia.
- Atualiza o identificador do cache do PWA e os parâmetros de versão dos arquivos estáticos.
- Adiciona `cliente.html` ao sitemap e ajusta sua atualização dinâmica no Service Worker.
- Sincroniza o código-fonte da Edge Function `ju-ia-site` com a V24 CRM Inteligente já implantada.
- Valida links internos e sintaxe dos arquivos JavaScript.
- Nenhuma alteração de banco de dados.

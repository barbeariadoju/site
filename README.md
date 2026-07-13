## V22.4 — Segurança e experiência

Inclui CSP, proteção contra clickjacking, consentimento de métricas, Política de Privacidade e feedback visual aprimorado no painel.

# Barbearia do Ju — V19.1

Versão auditada e limpa, com painel instalável como PWA no iPhone e Android.

## Melhorias móveis
- Uma única aplicação para iOS e Android.
- Barra inferior fixa com Início, Agenda, Agendar, Clientes e JuIA.
- Instalação orientada no Safari e Chrome.
- Botões maiores e layout adaptado para uso com uma mão.
- No Android, os atalhos do painel tentam abrir diretamente o WhatsApp Business, com fallback para o WhatsApp Web/instalado.
- Área administrativa sem cache persistente.

# Barbearia do Ju — versão auditada V18

Pacote limpo do site e do Barbearia OS, preparado para publicação no GitHub Pages.

## Estrutura

- Páginas públicas: site, serviços, produtos, agenda e páginas auxiliares.
- Painel administrativo: visão geral, agenda, CRM, novo agendamento e JuIA.
- `supabase/functions/ju-ia-admin/`: código da Edge Function da assistente.
- `database/migrations/`: histórico necessário para reconstrução do banco.

## Integrações preservadas

- Google Tag Manager: `GTM-T9KR76KB` somente nas páginas públicas.
- Supabase: URL e chave pública em `agenda-config-v6.js`.
- OpenAI: chave mantida exclusivamente nos Secrets do Supabase.

## Links Google padronizados

- Avaliação direta: `https://g.page/r/CaQfC5axIQQIEBM/review`
- Perfil da empresa: `https://share.google/RA6Z8daPoTwlHb7cW`

## Publicação

Publique o conteúdo desta pasta na raiz da branch `main`. Preserve as configurações do repositório, GitHub Pages, domínio personalizado e Cloudflare.


## V19 — App administrativo gratuito para iPhone
Abra /admin.html no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.

## Verificação final de domínio — V22.2

Após publicar, confirme que o domínio sem `www` redireciona automaticamente para o endereço canônico:

- origem: `https://barbeariadoju.com.br`
- destino esperado: `https://www.barbeariadoju.com.br`

Caso não redirecione, configure no Cloudflare uma regra de redirecionamento permanente (301) do domínio raiz para `https://www.barbeariadoju.com.br/$1`.


## V22.3

Inclui página 404 personalizada e ação pós-atendimento para enviar agradecimento e pedido de avaliação pelo WhatsApp. Não exige nova migração SQL.

# Auditoria consolidada — V28.0.0

## Ajustes aplicados nesta etapa

- CTA “Ver produtos” na primeira dobra da página inicial.
- CTA “Ver produtos” mantido na página de agendamento.
- Cache busting unificado para CSS e JavaScript.
- Novo identificador do cache do Service Worker.
- Documentação de instalação e testes.

## Itens revisados e mantidos

- A galeria da página inicial já possui quatro imagens em WebP com fallback JPG e carregamento tardio.
- O vídeo já está implementado com controles, `playsinline`, poster e `preload="none"`; portanto não foi ativado automaticamente nem removido.
- A chave `anon/publishable` do Supabase permanece no front-end porque é uma chave pública prevista para uso no navegador. A proteção continua dependendo das políticas RLS e das Edge Functions.
- A JuIA permanece na página inicial e, por isso, a configuração pública do Supabase não foi retirada dali.

## Próxima etapa recomendada

A consolidação estrutural do CSS deve ser feita separadamente, com comparação visual página a página. Não foi realizada automaticamente nesta versão para evitar regressões em agenda, carrinho, painel administrativo e iPhone.

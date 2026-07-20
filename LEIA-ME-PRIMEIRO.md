# Leia-me primeiro — Como publicar esta atualização (Fase 1)

Este guia foi escrito para quem nunca mexeu com programação. Siga na ordem. Se travar em algum passo, pare e me chame de volta na conversa, descrevendo exatamente onde travou.

## O que mudou nesta atualização

- Correções de segurança no painel administrativo e em duas Edge Functions do Supabase (`admin-booking-status` e `send-push`).
- Pequenas correções de SEO e acessibilidade no site público.
- Nenhuma funcionalidade foi removida. Nenhum preço, horário ou dado comercial foi alterado.
- **Não há alteração de banco de dados (SQL) nesta fase** — não é necessário rodar nada no SQL Editor do Supabase agora.

## Passo 1 — Backup do que está publicado agora

Antes de qualquer coisa, garanta que você consegue voltar atrás se precisar:

1. Abra o GitHub Desktop.
2. Clique em **"View on GitHub"** (ou acesse `github.com/SEU-USUARIO/site` no navegador).
3. Clique na aba **"Code"** → botão verde **"Code"** → **"Download ZIP"**.
4. Guarde esse ZIP baixado em uma pasta separada no seu computador, com um nome tipo `backup-antes-fase1.zip`. Esse é o seu "estado atual" — se algo der errado, você pode voltar para ele.

## Passo 2 — Extrair o novo ZIP por cima da pasta do site

1. Extraia o arquivo `barbearia-do-ju-auditoria-corrigida.zip` que eu te enviei.
2. Copie **todo o conteúdo** da pasta extraída para dentro de `C:\Users\Juliano\Documents\GitHub\site`, substituindo os arquivos existentes quando o Windows perguntar.

## Passo 3 — Conferir no GitHub Desktop

1. Abra o GitHub Desktop. Ele vai mostrar a lista de arquivos alterados na aba **"Changes"**.
2. Confira rapidamente se os arquivos batem com o que eu descrevi no `CHANGELOG.md` (não precisa entender o código, só conferir que a lista de arquivos parece condizente).

## Passo 4 — Publicar no GitHub (site público)

1. No campo **"Summary"** (embaixo à esquerda), escreva algo como: `Auditoria fase 1 - seguranca, SEO e acessibilidade`.
2. Clique em **"Commit to main"**.
3. Clique em **"Push origin"** (botão no topo).
4. Vá em `github.com/SEU-USUARIO/site/actions` e confirme que o run mais recente de **"pages build and deployment"** terminou com ✓ verde (pode levar 1-2 minutos). Se falhar com erro 503 de novo, é a mesma instabilidade do GitHub que já vimos antes — espere um pouco e use o botão **"Re-run jobs"**.

## Passo 5 — Publicar as duas Edge Functions corrigidas no Supabase

Essas duas funções (`admin-booking-status` e `send-push`) tiveram o código corrigido, mas isso só entra em vigor depois de você publicá-las no Supabase. Veja o passo a passo completo com os comandos exatos em **`COMANDOS-WINDOWS.md`** (seção "Publicar as Edge Functions corrigidas").

## Passo 6 — Limpar caches

1. **Cloudflare:** `dash.cloudflare.com` → domínio `barbeariadoju.com.br` → **Caching** → **Configuration** → **Purge Everything**.
2. **Seu navegador:** abra uma aba anônima/privada nova para testar (isso ignora qualquer cache antigo do seu próprio navegador).

## Passo 7 — Validar o site publicado

Use o `CHECKLIST-PUBLICACAO.md` como roteiro. Os pontos mais importantes:

- Abrir `https://www.barbeariadoju.com.br/sw.js` numa aba anônima e conferir que a primeira linha mostra `const CACHE = 'barbearia-os-v28-0-13';`.
- Repetir o fluxo: Início → Serviços → Ver produtos → adicionar produto → Ver meu carrinho → Adicionar serviços ao pedido → adicionar serviço → Ver meu carrinho → confirmar que os dois itens aparecem juntos.
- Abrir o painel de Fidelidade (`admin-fidelidade.html`) e confirmar que a lista de clientes aparece normalmente (a correção de segurança não deve mudar a aparência, só proteger contra um tipo de ataque).

## Passo 8 — Se algo der errado (voltar atrás)

1. Extraia o `backup-antes-fase1.zip` que você guardou no Passo 1.
2. Copie o conteúdo por cima da pasta `C:\Users\Juliano\Documents\GitHub\site` de novo, substituindo os arquivos.
3. No GitHub Desktop: **Commit to main** → **Push origin**.
4. Se você já publicou as Edge Functions no Passo 5 e quer reverter só elas, me avise nessa conversa — te devolvo o código anterior das duas funções para reimplantar.

## Sobre a "Fase 2"

Este ZIP resolve tudo que dava para verificar e corrigir com segurança olhando só o código. Alguns itens (detalhados no `RELATORIO-AUDITORIA.md`, seção 9) dependem de eu ver dados reais do seu Supabase — nada disso foi alterado agora. Quando quiser seguir para a Fase 2, me avise; vou te pedir para rodar algumas consultas de leitura no SQL Editor do Supabase e colar o resultado aqui, sem que eu precise de nenhuma senha sua.

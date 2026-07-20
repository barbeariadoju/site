# Checklist de publicação — Fase 1

## Antes de publicar

- [ ] Fiz o backup do repositório atual (Download ZIP do GitHub)
- [ ] Extraí o novo ZIP por cima da pasta `C:\Users\Juliano\Documents\GitHub\site`

## Publicação do site (GitHub Pages)

- [ ] Conferi as mudanças na aba "Changes" do GitHub Desktop
- [ ] Fiz o commit ("Commit to main")
- [ ] Enviei para o GitHub ("Push origin")
- [ ] Conferi em `github.com/SEU-USUARIO/site/actions` que o deploy terminou com ✓ verde

## Publicação das Edge Functions (Supabase)

- [ ] Rodei `supabase functions deploy admin-booking-status`
- [ ] Rodei `supabase functions deploy send-push`
- [ ] Conferi com `supabase functions list` que as duas mostram horário recente

## Limpeza de cache

- [ ] Limpei o cache da Cloudflare (Purge Everything)
- [ ] Testei numa aba anônima/privada nova (não só recarregando a aba antiga)

## Validação do site publicado

- [ ] `https://www.barbeariadoju.com.br/sw.js` mostra `const CACHE = 'barbearia-os-v28-0-13'` na primeira linha
- [ ] Início → Serviços: navegação fica na mesma aba
- [ ] Serviços → Ver produtos: navegação fica na mesma aba
- [ ] Adicionei um produto no carrinho
- [ ] Cliquei em "Ver meu carrinho" e o produto aparece
- [ ] Cliquei em "Adicionar serviços ao pedido" e voltei para Serviços na mesma aba
- [ ] Adicionei um serviço
- [ ] Abri o carrinho de novo: produto e serviço aparecem juntos
- [ ] Atualizei a página (F5): produto e serviço continuam no carrinho
- [ ] Testei "Finalizar pedido pelo WhatsApp" (ou "Continuar para data e horário") e a mensagem/fluxo inclui os dois itens

## Painel administrativo

- [ ] Login no painel administrativo funciona normalmente
- [ ] Painel de Fidelidade (`admin-fidelidade.html`) mostra a lista de clientes normalmente
- [ ] Central de Mensagens (`admin-mensagens.html`) mostra as mensagens normalmente

## Celular

- [ ] Testei o fluxo de carrinho no Android ou iPhone
- [ ] Nenhum botão aparece cortado
- [ ] O botão "Ver meu carrinho" não fica atrás de outro elemento

## Se algo falhar

- [ ] Segui o passo "Se algo der errado" do `LEIA-ME-PRIMEIRO.md`
- [ ] Anotei exatamente qual item deste checklist falhou, para me trazer o mais específico possível

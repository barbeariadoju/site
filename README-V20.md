# Barbearia do Ju V20 — JuIA no site

Inclui tudo da V19.1 e adiciona o atendimento da JuIA em todas as páginas públicas.

## Instalação
1. Publique todos os arquivos no GitHub.
2. Execute `database/migrations/012-juia-chat-site.sql` no SQL Editor do Supabase.
3. No Supabase, crie a Edge Function `ju-ia-site` pelo editor e cole o conteúdo de `supabase/functions/ju-ia-site/index.ts`.
4. Desative `Verify JWT with legacy secret` e faça o deploy.
5. Teste o chat em janela anônima.

A função usa a secret `OPENAI_API_KEY` já configurada. Nenhuma chave secreta fica no GitHub.

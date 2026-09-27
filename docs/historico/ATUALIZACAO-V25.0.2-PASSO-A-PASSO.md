# Atualização V25.0.2 — passo a passo

## 1. GitHub
Substitua os arquivos do site pelo conteúdo deste pacote, faça commit e Push.

## 2. Supabase — nova Edge Function
Crie/publice uma função chamada exatamente `create-public-booking` usando o arquivo:

`supabase/functions/create-public-booking/index.ts`

Mantenha a verificação JWT ativada. O site chama a função usando a chave pública do Supabase.

## 3. Supabase — atualizar JuIA
Substitua e publique novamente:

`supabase/functions/ju-ia-site/index.ts`

## 4. Segredos
Não é necessário criar novas chaves. As funções usam o segredo já existente:

`PUSH_WEBHOOK_SECRET`

## 5. SQL
Não há SQL novo nesta versão. Não repita a migration 020.

## 6. Teste
1. Faça um agendamento pelo site.
2. Confirme que entrou como Confirmado no admin.
3. Confirme o Push nos aparelhos.
4. No CRM, teste nome com e sem acento, parte do telefone, Enter, Buscar e Limpar.

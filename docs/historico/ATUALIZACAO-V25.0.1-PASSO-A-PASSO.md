# Atualização V25.0.1 — passo a passo

## O que muda

1. O cliente escolhe um horário disponível e o agendamento já entra como **Confirmado**.
2. A tela informa imediatamente que o horário está reservado.
3. A JuIA também confirma imediatamente quando consegue criar o agendamento.
4. No CRM, a pesquisa funciona durante a digitação e ao apertar **Enter**.
5. O Push administrativo continua funcionando como antes.

## Instalação

### 1. Atualizar o banco no Supabase

1. Entre no Supabase do projeto.
2. Abra **SQL Editor**.
3. Clique em **New query**.
4. Abra o arquivo `database/migrations/020-v25-0-1-confirmacao-automatica.sql` deste pacote.
5. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.
6. O resultado deve terminar sem erro.

### 2. Atualizar os arquivos no GitHub

Substitua os arquivos do repositório pelos arquivos deste pacote e faça commit/push.

### 3. Reimplantar a JuIA

Como o texto de confirmação da JuIA foi alterado, publique novamente a Edge Function:

`supabase/functions/ju-ia-site/index.ts`

No painel do Supabase, abra **Edge Functions > ju-ia-site** e substitua o código pelo novo arquivo, depois faça o deploy.

## Testes recomendados

1. Faça um agendamento de teste pelo site.
2. Confira se aparece “Agendamento confirmado com sucesso”.
3. No painel, confira se o status entrou como **Confirmado**.
4. Verifique se o Push chegou aos aparelhos administrativos.
5. No CRM, digite parte de um nome e depois teste a tecla Enter.
6. Faça um agendamento de teste pela JuIA e confira a nova mensagem.

## Observação

Esta versão ainda não adiciona cancelamento e reagendamento pelo próprio cliente. Isso será feito na V25.0.2, depois que esta etapa estiver validada.

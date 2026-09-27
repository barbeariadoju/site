# Comandos para Windows — Publicar as Edge Functions corrigidas

Esta fase só exige publicar 2 Edge Functions (`admin-booking-status` e `send-push`) — nenhum comando de SQL é necessário. Todos os comandos abaixo são para o **PowerShell** (o programa "PowerShell" ou "Windows PowerShell" que já vem no Windows).

## Passo 0 — O que é cada coisa (contexto rápido)

- **PowerShell**: um terminal (janela de texto) onde você digita comandos em vez de clicar em botões. Você vai copiar e colar os comandos abaixo, um de cada vez, apertando Enter depois de cada um.
- **Node.js**: um programa necessário para rodar ferramentas de linha de comando modernas, incluindo a CLI do Supabase.
- **Supabase CLI**: a ferramenta de linha de comando que envia o código das Edge Functions para o servidor do Supabase.
- **Project ref**: um código curto que identifica o seu projeto Supabase (você encontra em `supabase.com/dashboard` → seu projeto → **Project Settings** → **General** → campo "Reference ID").

## Passo 1 — Abrir o PowerShell na pasta certa

1. Abra o **Explorador de Arquivos** e vá até `C:\Users\Juliano\Documents\GitHub\site` (a mesma pasta do repositório).
2. Clique uma vez na barra de endereço lá em cima (onde mostra o caminho da pasta), apague o texto e digite `powershell`, depois aperte Enter. Isso abre o PowerShell já dentro dessa pasta.

Ou, alternativamente, abra o PowerShell normalmente e digite:

```powershell
cd "C:\Users\Juliano\Documents\GitHub\site"
```

Isso "entra" na pasta do projeto — todos os comandos seguintes precisam ser rodados de dentro dela.

## Passo 2 — Verificar se o Node.js está instalado

```powershell
node --version
```

Se aparecer um número de versão (ex: `v20.11.0`), está tudo certo, pule para o Passo 3.

Se aparecer erro tipo "não é reconhecido como comando", você precisa instalar o Node.js primeiro: acesse `https://nodejs.org`, baixe a versão "LTS" (recomendada), instale normalmente clicando em "Next" até o fim, e depois fecha e abre o PowerShell de novo antes de continuar.

## Passo 3 — Instalar a Supabase CLI (só na primeira vez)

```powershell
npm install -g supabase
```

Esse comando baixa e instala a ferramenta da Supabase no seu computador. Só precisa rodar uma vez; nas próximas atualizações você pode pular direto para o Passo 4.

Confira se instalou certo:

```powershell
supabase --version
```

## Passo 4 — Fazer login na Supabase

```powershell
supabase login
```

Isso vai abrir uma aba no seu navegador pedindo para você confirmar o login com a sua conta Supabase (a mesma que você usa em `supabase.com/dashboard`). Confirme lá, depois volte para o PowerShell — ele vai mostrar uma mensagem de sucesso.

## Passo 5 — Vincular o projeto local ao seu projeto Supabase (só na primeira vez)

Substitua `COLOQUE_AQUI_O_PROJECT_REF` pelo código do seu projeto (veja onde encontrar no Passo 0 acima):

```powershell
supabase link --project-ref COLOQUE_AQUI_O_PROJECT_REF
```

Se ele pedir uma senha de banco de dados, é a senha do Postgres do seu projeto Supabase (não é a senha da sua conta) — se você não lembra, pode redefini-la em `supabase.com/dashboard` → seu projeto → **Project Settings** → **Database** → **Reset database password**. Guarde essa senha em local seguro.

## Passo 6 — Publicar as duas funções corrigidas

```powershell
supabase functions deploy admin-booking-status
```

Explicando: esse comando pega o que está em `supabase/functions/admin-booking-status/index.ts` no seu computador e envia para rodar nos servidores do Supabase, substituindo a versão anterior.

```powershell
supabase functions deploy send-push
```

Mesma coisa, para a função `send-push`.

Se aparecer um aviso perguntando sobre `--no-verify-jwt`: **não use essa opção** para essas duas funções — elas exigem um usuário autenticado (JWT) por design, então o comando simples acima (sem `--no-verify-jwt`) é o correto.

Você deve ver uma mensagem de sucesso tipo `Deployed Function admin-booking-status` para cada uma.

## Passo 7 — Conferir que publicou certo

```powershell
supabase functions list
```

Isso mostra a lista de funções publicadas com a data/hora da última atualização — confira se `admin-booking-status` e `send-push` mostram um horário recente (agora há pouco).

## Passo 8 — Ver logs (se algo parecer errado depois)

```powershell
supabase functions logs admin-booking-status
```

```powershell
supabase functions logs send-push
```

Isso mostra as últimas mensagens de erro/atividade dessas funções — útil se algo no painel administrativo parar de funcionar depois da publicação, para eu conseguir te ajudar a diagnosticar.

## Se precisar reverter (rollback)

Como não guardamos automaticamente a versão anterior do código das funções, o jeito mais simples de reverter é: extrair o `backup-antes-fase1.zip` que você guardou (Passo 1 do `LEIA-ME-PRIMEIRO.md`), copiar de volta os arquivos `supabase/functions/admin-booking-status/index.ts` e `supabase/functions/send-push/index.ts` antigos para a pasta do projeto, e rodar de novo:

```powershell
supabase functions deploy admin-booking-status
supabase functions deploy send-push
```

Isso publica a versão anterior por cima, desfazendo a atualização.

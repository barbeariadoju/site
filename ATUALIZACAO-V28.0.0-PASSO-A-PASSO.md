# Atualização V28.0.0 — Fundação técnica e conversão

## O que muda

- Novo botão **Ver produtos** no topo da página inicial.
- Botão **Ver produtos** mantido em `/agendar/`.
- Versões de CSS e JavaScript padronizadas para evitar cache antigo.
- Service Worker atualizado para o cache `barbearia-os-v28-0-0`.
- Corrigida a geração do arquivo de calendário `.ics`.

## Instalação

1. Substitua os arquivos do repositório pelos arquivos deste pacote.
2. Faça **Commit** e **Push** no GitHub Desktop.
3. Aguarde a publicação do GitHub Pages/Cloudflare.
4. Abra o site em uma aba anônima e teste os botões.

## Testes obrigatórios

1. Página inicial: testar **Conheça os serviços / Agende**, **Ver produtos** e **Fale com o barbeiro**.
2. `/agendar/`: testar **Ver serviços**, **Ver produtos** e **Ir direto à agenda**.
3. Confirmar que a galeria e o vídeo continuam funcionando.
4. Fazer um agendamento de teste até a tela final.
5. Conferir o carrinho de produtos no celular.

## Supabase

Não há SQL novo, novos secrets ou Edge Functions para publicar nesta versão.

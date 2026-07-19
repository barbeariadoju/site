# Instalação — V27.0 URL profissional /agendar/

## O que mudou
O endereço oficial para serviços e início do agendamento passa a ser:

`https://www.barbeariadoju.com.br/agendar/`

O arquivo antigo `servicos.html` continua funcionando para não quebrar links já divulgados.

## Publicação
1. Substitua os arquivos do repositório pelos arquivos deste pacote.
2. Faça commit e push pelo GitHub Desktop.
3. Aguarde a publicação do GitHub Pages.
4. Teste em janela anônima:
   - `/agendar/`
   - `/servicos.html`
   - adicionar serviço e continuar para o horário

## Edge Functions que precisam de novo deploy
Como os links dos e-mails e da Ju IA foram atualizados, execute:

```cmd
npx.cmd supabase functions deploy booking-email
```

```cmd
npx.cmd supabase functions deploy ju-ia-site
```

Não há SQL novo nesta versão.

## Atualizações externas depois do teste
Use `/agendar/` no Perfil da Empresa no Google, Google Ads, Instagram, WhatsApp e futuros QR Codes.

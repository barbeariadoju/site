# IA no WhatsApp — instalação (Evolution API)

Pré-requisito: um servidor/VPS com Docker, e um domínio/subdomínio (`evolution.barbeariadoju.com.br`) apontando pro IP dele (registro DNS tipo A).

O código deste projeto já está pronto do lado do Supabase (migration `031-whatsapp-ai.sql`, Edge Function `whatsapp-webhook`, ambas já publicadas). Falta só subir a Evolution API no servidor e conectar as duas pontas.

## 1. Instalar Docker no servidor (se ainda não tiver)

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Copiar esta pasta pro servidor

Pode ser via `git clone` do repositório, ou copiando só a pasta `whatsapp-ai/` (ex: `scp -r whatsapp-ai usuario@SEU_IP:~/`).

## 3. Configurar o `.env`

Dentro da pasta `whatsapp-ai` no servidor:

```bash
cp .env.example .env
```

Gere duas chaves aleatórias:

```bash
openssl rand -hex 24   # use o resultado como POSTGRES_PASSWORD
openssl rand -hex 24   # use o resultado como AUTHENTICATION_API_KEY
```

Edite o `.env` e preencha `EVOLUTION_DOMAIN`, `SERVER_URL`, `POSTGRES_PASSWORD`, `AUTHENTICATION_API_KEY` e `DATABASE_CONNECTION_URI` (a senha ali dentro tem que ser igual à `POSTGRES_PASSWORD`).

## 4. Subir os containers

```bash
docker compose up -d
```

Aguarde um minuto e confirme que subiu:

```bash
docker compose ps
curl -s https://evolution.barbeariadoju.com.br
```

## 5. Criar a instância do WhatsApp já com o webhook configurado

Troque `SUA_AUTHENTICATION_API_KEY` e `SEU_WHATSAPP_WEBHOOK_SECRET` (esse segundo você inventa agora, um valor aleatório qualquer — vai ser usado nos dois lados):

```bash
curl -X POST https://evolution.barbeariadoju.com.br/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_AUTHENTICATION_API_KEY" \
  -d '{
    "instanceName": "barbearia-do-ju",
    "integration": "WHATSAPP-BAILEYS",
    "webhook": {
      "url": "https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/whatsapp-webhook",
      "byEvents": false,
      "base64": false,
      "headers": { "x-webhook-secret": "SEU_WHATSAPP_WEBHOOK_SECRET" },
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

## 6. Escanear o QR Code

```bash
curl -s https://evolution.barbeariadoju.com.br/instance/connect/barbearia-do-ju \
  -H "apikey: SUA_AUTHENTICATION_API_KEY"
```

A resposta traz um QR Code (base64). Abra no WhatsApp do número da barbearia: **Configurações → Aparelhos conectados → Conectar um aparelho**, e escaneie. A partir daqui o número continua funcionando normalmente no celular — a Evolution API entra como mais um "aparelho conectado", igual ao WhatsApp Web.

> Recomendado: testar esse processo inteiro primeiro com um número secundário/pessoal, e só depois refazer com o número real da barbearia, já que qualquer ajuste fica mais seguro fora do canal principal com clientes.

## 7. Configurar os secrets no Supabase

Em **Edge Functions → Secrets** (`https://supabase.com/dashboard/project/rpkqluaxhqsxnewunhfm/functions/secrets`), adicione:

| Secret | Valor |
|---|---|
| `WHATSAPP_WEBHOOK_SECRET` | o mesmo valor usado em `x-webhook-secret` no passo 5 |
| `EVOLUTION_API_URL` | `https://evolution.barbeariadoju.com.br` |
| `EVOLUTION_API_KEY` | a `AUTHENTICATION_API_KEY` do `.env` |
| `EVOLUTION_INSTANCE_NAME` | `barbearia-do-ju` |

## 8. Testar

Mande uma mensagem de outro celular para o número conectado. A JuIA deve responder em poucos segundos. Depois teste responder manualmente pelo próprio app — a IA deve parar de responder automaticamente naquela conversa (fica marcada como `human_takeover` em `whatsapp_conversations`).

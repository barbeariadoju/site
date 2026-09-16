# Pacote de citações locais — Barbearia do Ju

Preparado em 16/09/2026 (dia de folga, frente 1). **Correção do mesmo dia:** o Juliano avisou
que a barbearia JÁ TEM cadastro nos cinco diretórios. Então o trabalho não é criar, é **abrir
cada ficha e deixar os dados idênticos** aos da tabela abaixo (que são os do Google Business
Profile). O que foi possível conferir de fora:

| Diretório | O que apareceu em 16/09 | Situação |
|---|---|---|
| Guia de Bragança | Ficha em `https://guiadebraganca.com.br/clientefree/barbearia-do-ju/`: **"rua Antonio da Cruz n°481"** (o número certo é **482**, e falta o "Dr."), telefone certo, categoria "Barbearias"; **sem** CEP, horário, site, descrição e foto | **Corrigir primeiro** — endereço divergente é pior que ficha ausente |
| Facebook | Página existe (nome e cidade visíveis sem login) | Conferir endereço, telefone, horário, site e botão "Reservar" logado |
| Bing Places | Não aparece painel local na busca do Bing para "Barbearia do Ju" Bragança Paulista | Conferir no painel se a ficha está publicada e verificada |
| Apple Business Connect | Não dá pra conferir de fora | Conferir no painel |
| Solutudo | A ficha não foi localizada pela busca pública | Conferir no painel se está publicada |

Este arquivo é o que se compara campo a campo em cada uma.

**Regra de ouro (NAP consistente):** nome, endereço e telefone têm que ser IDÊNTICOS em todos
os diretórios e iguais ao Google Business Profile. Não abrevie "Rua" nem "Dr.", não troque a
ordem, não coloque o CEP em campo de complemento.

---

## 0. Dados oficiais (copiar exatamente assim)

| Campo | Valor |
|---|---|
| Nome | `Barbearia do Ju` |
| Endereço (linha 1) | `Rua Dr. Antônio da Cruz, 482` |
| Bairro | `Centro` |
| Cidade / UF | `Bragança Paulista` / `SP` |
| CEP | `12900-350` |
| País | `Brasil` |
| Telefone / WhatsApp | `(11) 96707-3038` — internacional: `+55 11 96707-3038` |
| Site | `https://www.barbeariadoju.com.br/` |
| Agendamento | `https://www.barbeariadoju.com.br/agendar/` (com UTM por diretório, ver cada bloco) |
| Instagram | `https://www.instagram.com/barbeariadoju_` (com o `_` no final) |
| E-mail de contato | o mesmo usado no Google Business Profile |
| Coordenadas | `-22.9540382, -46.5420126` |
| Google Maps | `https://maps.app.goo.gl/VJAfv4MJpd84tmDY7` |
| Categoria principal | `Barbearia` |
| Categorias secundárias | **nenhuma** (mesma regra do GBP: categoria falsa é pior que ausente) |
| Formas de pagamento | Dinheiro, Pix, cartão de débito, cartão de crédito |
| Atributos | Hora marcada · Atendimento individual · Wi-Fi · Café cortesia · Ar-condicionado · Acessível para cadeirante (banheiro adaptado) |
| Ano de abertura | preencher com o ano real (o Juliano sabe; não inventar) |

### Horário (idêntico ao GBP)

| Dia | Horário |
|---|---|
| Segunda | Fechado |
| Terça | 08:00 – 19:00 |
| Quarta | 08:00 – 19:00 |
| Quinta | 08:00 – 19:00 |
| Sexta | 08:00 – 19:00 |
| Sábado | 08:00 – 15:00 |
| Domingo | Fechado |

Feriados: fechado (marcar como "fechado em feriados" onde o diretório perguntar).

### Descrição curta (243 caracteres — cabe em qualquer campo de até 250)

```
Barbearia no Centro de Bragança Paulista com hora marcada e atendimento individual: um barbeiro, um cliente por vez. Corte, barba na navalha com toalha quente, sobrancelha e pigmentação. Nota 5,0 no Google. Agende pelo site ou WhatsApp.
```

### Descrição longa (até 750 caracteres)

```
A Barbearia do Ju fica na Rua Dr. Antônio da Cruz, 482, no Centro de Bragança Paulista. O atendimento é com hora marcada e individual: um barbeiro, um cliente por vez, sem fila. Quem atende é o Juliano, farmacêutico e barbeiro — orientação criteriosa sobre pele, couro cabeludo e produtos. Serviços: corte masculino e infantil, barba na navalha com toalha quente, Barboterapia com vaporizador de ozônio, Barba Express na máquina, sobrancelha, pigmentação, luzes e platinado. Café por conta da casa, Wi-Fi e ambiente climatizado. Cartão fidelidade automático: 10 atendimentos, 1 serviço por nossa conta. Nota 5,0 no Google. Terça a sexta, 8h às 19h; sábado, 8h às 15h. Agende em barbeariadoju.com.br ou pelo WhatsApp (11) 96707-3038.
```

Palavras que NÃO entram em nenhuma descrição (regra da casa): "premium", "de luxo",
"sofisticado", "alto padrão", "a melhor barbearia", "o melhor barbeiro", "referência da cidade";
nada de "garantia de ajuste"/"retoque"; nada de "agenda aberta"/"muitos horários"; nada de
preço (o catálogo muda em 01/10/2026 e o diretório não acompanha).

### As 5 fotos (mesmo conjunto em todos os diretórios, nesta ordem)

Conferidas uma a uma em 16/09. A foto de ambiente é a mais vista no GBP (2,21 mil
visualizações), por isso três das cinco são do interior.

| # | Arquivo no repositório | O que mostra | Uso |
|---|---|---|---|
| 1 | `assets/ambiente-corte.jpg` | Interior real, Juliano atendendo na cadeira, bancada, TV, geladeira | **Capa / principal** |
| 2 | `assets/ia-referencia/interior-1.jpeg` | Interior visto da porta: sofá de espera, poste de barbeiro, letreiro na parede | Ambiente |
| 3 | `assets/ia-referencia/interior-2.jpeg` | Cadeira, espelho com luz, geladeira de bebidas, poltrona, prateleira de produtos | Ambiente |
| 4 | `assets/fachada.jpg` | Fachada com a placa de horário **correta** (8h–19h / sáb 8h–15h) | Fachada / exterior |
| 5 | `assets/galeria-trio.jpg` | Café na poltrona, cliente no espelho, toalha quente na barba | Equipe / serviço |
| Logo | `assets/marca-selo-transparente.png` | Selo da marca, fundo transparente | Logotipo / avatar |

**Não usar** `assets/montagem-ambiente.jpg`: a placa que aparece nessa montagem tem o horário
antigo (8h30–18h). Também não usar foto de cliente real avulsa (regra de privacidade da casa).

---

## 1. Apple Business Connect (Apple Maps, Siri, Mapas do iPhone)

Cadastro: https://businessconnect.apple.com/ (redireciona para business.apple.com — entrar com
o ID Apple do Juliano; se não tiver, criar um ID Apple com o e-mail da barbearia).

| Campo no Apple Business Connect | Cole isto |
|---|---|
| Business name | `Barbearia do Ju` |
| Category | `Barbearia` (em inglês: Barber Shop) |
| Address | `Rua Dr. Antônio da Cruz, 482` · `Centro` · `Bragança Paulista` · `SP` · `12900-350` · `Brasil` |
| Phone | `+55 11 96707-3038` |
| Website | `https://www.barbeariadoju.com.br/` |
| Action link — "Reserve" / "Book" | `https://www.barbeariadoju.com.br/agendar/?utm_source=apple&utm_medium=citation&utm_campaign=citacoes-locais` |
| Hours | tabela de horário acima |
| Description | descrição longa acima (a Apple aceita até ~500 caracteres em alguns países: se cortar, usar a curta) |
| Photos | as 5 fotos + logo, na ordem |
| Showcase (opcional) | não criar oferta; se quiser, "Agende online, hora marcada" com o link de reserva |

Observação: a Apple pode pedir verificação por telefone ou documento. Fazer no celular dele.

---

## 2. Bing Places for Business (Bing, Microsoft Maps, Copilot, DuckDuckGo)

Cadastro: https://www.bingplaces.com/ (redireciona para bing.com/forbusiness). Entrar com
conta Microsoft. **Atalho:** o Bing oferece "Importar do Google Business Profile" — usar isso
na tela inicial evita digitar tudo e garante NAP idêntico. Depois só conferir os campos abaixo.

| Campo no Bing Places | Cole isto |
|---|---|
| Business name | `Barbearia do Ju` |
| Address | `Rua Dr. Antônio da Cruz, 482, Centro` · `Bragança Paulista` · `SP` · `12900-350` |
| Phone | `+55 11 96707-3038` |
| Website | `https://www.barbeariadoju.com.br/` |
| Category | `Barbearia` (Barber Shop) |
| Hours | tabela de horário acima |
| Description | descrição longa |
| Photos | as 5 fotos + logo |
| Social | Instagram `https://www.instagram.com/barbeariadoju_` |
| Link de ação (se aparecer "Booking URL") | `https://www.barbeariadoju.com.br/agendar/?utm_source=bing&utm_medium=citation&utm_campaign=citacoes-locais` |

Verificação: por telefone (ligação/SMS no 96707-3038) ou cartão postal. Escolher telefone.

---

## 3. Solutudo (guia de empresas por cidade)

Cadastro: https://www.solutudo.com.br/ → "Cadastre sua empresa" (plano gratuito basta).

| Campo no Solutudo | Cole isto |
|---|---|
| Nome fantasia | `Barbearia do Ju` |
| Categoria | `Barbearias` (se pedir subcategoria: `Barbearia`) |
| Endereço | `Rua Dr. Antônio da Cruz, 482` · Bairro `Centro` · CEP `12900-350` · `Bragança Paulista` · `SP` |
| Telefone / WhatsApp | `(11) 96707-3038` nos dois campos |
| Site | `https://www.barbeariadoju.com.br/?utm_source=solutudo&utm_medium=citation&utm_campaign=citacoes-locais` |
| Horário | tabela acima |
| Descrição | descrição longa |
| Fotos | as 5 fotos + logo |
| Redes | Instagram `barbeariadoju_` |

---

## 4. Guia de Bragança (guia local)

Site: https://guiadebraganca.com.br/ (o `www.` redireciona para sem `www.`). Procurar
"Anuncie" / "Cadastre sua empresa" no menu do site ou no rodapé; se o cadastro for por
formulário/WhatsApp do guia, mandar exatamente o bloco abaixo.

```
Nome: Barbearia do Ju
Categoria: Barbearia
Endereço: Rua Dr. Antônio da Cruz, 482 – Centro – Bragança Paulista/SP – CEP 12900-350
Telefone/WhatsApp: (11) 96707-3038
Site: https://www.barbeariadoju.com.br/?utm_source=guiadebraganca&utm_medium=citation&utm_campaign=citacoes-locais
Instagram: @barbeariadoju_
Horário: terça a sexta, 8h às 19h; sábado, 8h às 15h; domingo e segunda fechado
Descrição: [descrição longa acima]
Fotos: as 5 do pacote + logo
```

---

## 5. Página do Facebook (dados completos)

A página já existe (Barbearia do Ju, vinculada ao Instagram @barbeariadoju_). O trabalho aqui
é **completar e igualar** os dados: https://www.facebook.com/ → Página → "Editar detalhes"
(Sobre).

| Campo do Facebook | Cole isto |
|---|---|
| Nome da Página | `Barbearia do Ju` |
| Categoria | `Barbearia` |
| Endereço | `Rua Dr. Antônio da Cruz, 482, Centro` · `Bragança Paulista` · CEP `12900-350` (marcar "tem endereço físico" e conferir o pino no mapa) |
| Telefone | `+55 11 96707-3038` |
| WhatsApp | `+55 11 96707-3038` (botão "Enviar mensagem no WhatsApp") |
| Site | `https://www.barbeariadoju.com.br/?utm_source=facebook&utm_medium=citation&utm_campaign=citacoes-locais` |
| Botão de ação | "Reservar" → `https://www.barbeariadoju.com.br/agendar/?utm_source=facebook&utm_medium=citation&utm_campaign=citacoes-locais` |
| Horário | tabela acima |
| Faixa de preço | não preencher (ou "$$") — preço muda em 01/10 |
| Descrição (Sobre) | descrição curta no campo "Bio"; descrição longa em "Informações adicionais" |
| Foto do perfil | `assets/marca-selo-transparente.png` |
| Foto de capa | `assets/ambiente-corte.jpg` |
| Serviços | Corte de cabelo · Barba na navalha com toalha quente · Barboterapia com vaporizador de ozônio · Barba Express · Sobrancelha masculina · Pigmentação capilar · Pigmentação de barba (sem preço) |

---

## Checklist do Juliano (na ordem — ~30 minutos no total; os cadastros já existem)

1. **Guia de Bragança** (5 min): entrar na conta do guia (ou mandar pro contato deles, contato@guiadebraganca.com.br / (11) 4033-2000, se a edição for por eles) e corrigir: endereço `Rua Dr. Antônio da Cruz, 482` (está 481), CEP `12900-350`, horário, site com UTM do bloco 4, descrição longa, as 5 fotos + logo.
2. **Bing Places** (8 min): https://www.bingplaces.com/ → entrar → abrir a ficha existente → comparar com o bloco 2 campo a campo → se a ficha estiver "não verificada", pedir verificação por telefone.
3. **Apple Business Connect** (8 min): https://businessconnect.apple.com/ → abrir o local → comparar com o bloco 1 → conferir se o link "Reservar" está com a UTM → conferir se as fotos estão lá.
4. **Facebook** (5 min): Página → "Editar detalhes" → comparar com o bloco 5 → botão "Reservar" com o link de agendamento.
5. **Solutudo** (4 min): https://www.solutudo.com.br/ → entrar → conferir se a ficha está publicada e igual ao bloco 3.

Depois de cada um: me avisar ("Guia feito") que eu confiro de fora se a ficha ficou pública, se
o NAP bateu com o GBP e se o link com UTM está chegando no GA4 (`utm_medium=citation`).

Fotos: estão no repositório (pasta `assets/`) e também no ar, por exemplo
`https://www.barbeariadoju.com.br/assets/ambiente-corte.jpg` — dá pra baixar direto no celular
pelo endereço e subir de lá.

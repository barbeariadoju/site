# Relatório de Auditoria — Barbearia do Ju (Fase 1)

Data: 20/07/2026
Escopo desta fase: revisão completa do código-fonte estático do ZIP (site público, painel administrativo no que é lido do código, Edge Functions e migrations do Supabase). **Não houve acesso ao banco de dados ao vivo, ao painel Supabase, nem a credenciais** — por isso alguns itens ficam marcados como "Fase 2", precisando de verificação com acesso real (explicado no fim deste documento).

Classificação de gravidade usada: crítico, alto, médio, baixo, melhoria.

---

## 1. Os dois bugs que motivaram a auditoria (já resolvidos antes desta fase)

- **Link "Ver produtos" abrindo em nova aba** e **carrinho perdendo o produto ao adicionar um serviço**: investigados a fundo em sessão anterior. O código já estava correto (confirmado com testes automatizados de navegador simulando o fluxo completo); a causa real era que o **GitHub Pages não estava conseguindo publicar** as versões corrigidas (falha 503 temporária do GitHub Actions) — o site ficou preso numa versão de dezenas de commits atrás. Resolvido reexecutando o deploy no GitHub Actions após o serviço normalizar. Não há ação de código pendente aqui.

## 2. Navegação interna e links

**Resultado: nenhum link interno quebrado ou mal configurado.**

- Foi escrito um verificador automático que extrai todo `href`/`src` de todas as páginas HTML (inclusive respeitando `<base href="/">` em `agendar/index.html`) e confere se o arquivo de destino existe. Resultado: **0 links internos quebrados** em todo o site.
- Nenhum link interno usa `target="_blank"`. O único `window.open` do site é em `produtos.html`, para abrir o WhatsApp (destino externo, com fallback correto para `window.location.href` caso o navegador bloqueie o pop-up) — uso correto e intencional.
- **Achado baixo/melhoria:** `index.html` e `servicos.html` são as únicas páginas que linkam para `produtos.html`/`agendar/` sem o script de proteção extra `bdj-internal-navigation` (presente em `produtos.html` e `agendar/index.html`). Na prática isso não causa bug hoje — o problema real era a publicação, não esse script — mas por segurança e consistência, considere adicionar o mesmo script nessas duas páginas numa próxima rodada. Não apliquei essa mudança nesta fase para não mexer em páginas que já funcionam sem necessidade comprovada.
- **Achado informativo:** `servicos.html` não é linkada por nenhuma outra página do site (órfã) — parece ser uma versão anterior de `agendar/index.html`, mantida por compatibilidade com links antigos/QR codes. Ela já se autocanonicaliza corretamente para `/agendar/` (bom para SEO), então não há problema em mantê-la assim.

## 3. Carrinho unificado (produtos + serviços)

**Resultado: lógica correta e consistente em todas as páginas que usam carrinho.**

- Todas as páginas com carrinho (`produtos.html`, `agendar/index.html`, `servicos.html`) usam exatamente as mesmas chaves (`bdj_cart_v1` para produtos, `bdj_services_v1` para serviços), a mesma estrutura de dados, e o mesmo padrão de leitura (`localStorage` + `sessionStorage` mesclados) e gravação (grava nos dois storages a cada mudança).
- Testado automaticamente, de ponta a ponta, o fluxo completo: Início → Serviços → Ver produtos → adicionar produto → Ver meu carrinho → Adicionar serviços ao pedido → adicionar serviço → Ver meu carrinho. Produto e serviço permanecem juntos em todas as etapas, com o total e a contagem corretos.
- Não foram encontradas chaves de armazenamento duplicadas, antigas ou divergentes em nenhum arquivo do site.

## 4. Segurança do front-end

| Arquivo | Gravidade | Descrição | Status |
|---|---|---|---|
| `loyalty-admin-v21.js` | **Crítico** | Nome, telefone e e-mail do cliente eram inseridos via `innerHTML` **sem nenhum escape**, diferente de todos os outros painéis admin. Um cliente mal-intencionado podia agendar um horário com um nome contendo código malicioso, que executaria no navegador do administrador ao abrir o painel de Fidelidade (risco de sequestro de sessão administrativa). | **Corrigido** — agora usa a mesma função de escape (`esc()`) já usada nos outros painéis. |
| `admin-messages-v24-5.js` | Médio | O link "Página de origem" na Central de Mensagens podia conter um endereço `javascript:...` malicioso vindo do formulário de contato público, que executaria ao ser clicado pelo admin. | **Corrigido** — agora só aceita links que comecem com `http://`/`https://`; qualquer outra coisa é descartada. |
| `juia-chat.js` | Baixo | Mesma categoria de risco (URL de ação sem checagem de esquema), numa superfície menor (respostas da JuIA). | **Corrigido**, mesma validação aplicada. |
| `agenda-config-v6.js` | Informativo | Verificado: contém apenas a chave pública (`sb_publishable_...`), não é uma `service_role key`. Nenhum segredo privado encontrado em nenhum arquivo do front-end. | Nenhuma ação necessária. |

## 5. Supabase — Edge Functions (revisão de código)

| Item | Gravidade | Descrição | Status |
|---|---|---|---|
| `admin-booking-status/index.ts` | Alto | Em caso de erro, a função devolvia ao navegador o **stack trace completo** e detalhes internos do Postgres (código/mensagem/hint do erro). Facilita reconhecimento do banco por quem estiver tentando abusar do endpoint. | **Corrigido** — detalhes completos continuam só no log do servidor; o cliente recebe apenas mensagem genérica + um `request_id` para suporte. |
| `admin-booking-status/index.ts`, `send-push/index.ts` | Médio | CORS aceitava `Access-Control-Allow-Origin: *` (qualquer site) para dois endpoints que aceitam token de sessão administrativa. | **Corrigido** — restrito à mesma allowlist (`barbeariadoju.com.br`) já usada em `contact-form`/`ju-ia-site`. |
| Todas as demais Edge Functions com `Allow-Origin: *` (`booking-email`, `booking-reminder-24h`, `create-public-booking`, `create-rebooking`, `manage-booking`, `rebooking-context`, `satisfaction-dispatch`, `send-email`) | Baixo | Essas são majoritariamente chamadas via webhook/link com token (não diretamente por um navegador comum), então o risco é baixo — mas ainda vale endurecer por padrão de defesa em profundidade. | **Não corrigido nesta fase** — deixei para não aplicar uma mudança em cadeia grande sem poder testar cada função contra o ambiente real. Ver recomendação na Fase 2. |
| `create-public-booking`/fluxo de agendamento da JuIA | Médio | Sem limite de taxa (rate limit) — diferente do formulário de contato, que já limita a 5 mensagens/hora por telefone. Um script poderia inundar a agenda com horários falsos. | **Não corrigido nesta fase** — recomendo aplicar o mesmo padrão de `contact-form`, mas prefiro que você confirme que não há automações legítimas (ex.: integrações) que dependem do volume atual antes de eu limitar. |
| `admin-booking-status`, `ju-ia-admin`, `send-push` | Médio (arquitetural) | A autorização checa apenas "é um usuário autenticado do Supabase", não "é o administrador". Hoje isso funciona porque (presumivelmente) só existe uma conta cadastrada — mas não há uma trava explícita de papel/role. | **Fase 2** — depende de confirmar no painel Supabase se o cadastro público de novos usuários está desabilitado, e de decidir como marcar um usuário como admin (ver seção Fase 2 abaixo). |
| `manage-booking`, `create-rebooking`, `rebooking-context` | Baixo | Comparação de token de reagendamento não é "constant-time" (risco teórico de timing attack, baixíssima probabilidade prática dado o tamanho do token). | **Não corrigido nesta fase** — risco muito baixo, mencionado por completude. |
| `contact-form/index.ts` | Referência positiva | Já segue boas práticas: CORS restrito, `OPTIONS` tratado, limite de taxa, mensagens de erro genéricas ao cliente, sem concatenação de SQL. Serviu de modelo para as correções acima. | Nenhuma ação necessária. |

**Nenhuma chave privada (`service_role`) foi encontrada exposta em nenhum arquivo do ZIP**, nem em código, nem em Edge Function.

## 6. Banco de dados / SQL (revisão de código, sem acesso ao banco ao vivo)

| Item | Gravidade | Descrição | Status |
|---|---|---|---|
| `027-v27-1-crm-premium-experiencia.sql` **e** `027-v27-1-experiencia-crm-real.sql` | **Alto** | Duas migrations com o **mesmo número de versão (027)** criam a tabela `experience_requests` com **esquemas incompatíveis entre si** (colunas e nomes de parâmetros de função diferentes). O front-end tem duas páginas (`avaliacao.html` e `experiencia.html`) que esperam esquemas diferentes. | **Corrigido na Fase 2** (verificado ao vivo no Supabase — ver seção 10). O esquema realmente ativo é o de `avaliacao.html`; `experiencia-v27.js` foi corrigido para usar o mesmo contrato. |
| Políticas RLS (Row Level Security) | **Crítico** (reclassificado na Fase 2) | RLS está **habilitado** em todas as tabelas de dados de cliente (bom sinal), mas a maioria das políticas usa `using (true)` para qualquer usuário autenticado — ou seja, a proteção real dependia inteiramente de ninguém de fora conseguir criar uma conta. | **Mitigação crítica aplicada na Fase 2** (cadastro público desativado). Correção completa das políticas (checagem real de admin) ainda pendente — ver seção 10. |
| Comandos destrutivos (`DROP TABLE`, `TRUNCATE`, `DELETE` sem `WHERE`) | — | **Nenhum encontrado.** Todas as migrations usam `IF NOT EXISTS`/`CREATE OR REPLACE`, seguras para reexecução. Os únicos `DELETE FROM` encontrados estão dentro de uma função protegida, sempre com `WHERE` amarrado a um ID específico. | Nenhuma ação necessária — parabéns pela disciplina nas migrations anteriores. |

## 7. SEO técnico

| Página | Gravidade | Descrição | Status |
|---|---|---|---|
| `cliente.html` | Alto | Está no `sitemap.xml`, mas não tinha `<link rel="canonical">`. | **Corrigido.** |
| `meu-agendamento.html` | Alto | Mesmo problema. | **Corrigido.** |
| `robots.txt` | Médio | Bloqueava 7 de 9 páginas `admin-*.html`; faltavam `admin-mensagens.html` e `admin-notificacoes.html` na lista (o risco prático era baixo, pois ambas já têm `noindex` na própria página, mas a lista estava desatualizada). | **Corrigido.** |
| Geral | — | `produtos.html`: título, descrição, canonical, dados estruturados (JSON-LD) e presença no sitemap **todos corretos** — nenhum problema encontrado, ao contrário do que os primeiros sintomas relatados por você sugeriam. | Nenhuma ação necessária. |
| Geral | — | Nenhuma página pública-chave estava com `noindex` por engano. Sitemap sem entradas quebradas. `robots.txt` não bloqueia nenhuma página pública. | Nenhuma ação necessária. |
| `agendar.html` (raiz), `privacidade.html` | Baixo/melhoria | Faltam tags Twitter Card / Open Graph em algumas páginas secundárias. Baixo impacto (são páginas transacionais ou institucionais, não o foco de compartilhamento). | Não corrigido nesta fase — baixa prioridade. |

## 8. Acessibilidade

| Página | Gravidade | Descrição | Status |
|---|---|---|---|
| `produtos.html` | Alto | Botão de fechar do modal de produto (`×`) não tinha `aria-label`, diferente dos outros botões de fechar do site. | **Corrigido** — agora tem `aria-label="Fechar"`. |
| Geral | — | Nenhuma imagem sem `alt` em todo o site. Todos os outros botões ícone-somente já tinham `aria-label` correto. Modais fecham corretamente com Esc. Estrutura de headings (h1→h2→h3) correta nas páginas principais, sem pulos de nível. `lang="pt-BR"` presente em todas as páginas. | Nenhuma ação necessária. |

## 9. O que NÃO foi alterado nesta fase (e por quê)

Para seguir a regra de não mexer no que já funciona sem necessidade comprovada, e principalmente por **não ter acesso ao banco de dados ao vivo**, os seguintes itens ficam para a Fase 2, com um plano concreto de como avançar (veja a seção "Fase 2" abaixo, que vou te enviar em seguida):

- Confirmar qual dos dois esquemas de `experience_requests` está realmente ativo em produção.
- Fechar o CORS `*` nas demais Edge Functions menos sensíveis (é uma mudança segura, mas prefiro aplicar depois de você confirmar que nada externo depende do comportamento atual).
- Adicionar limite de taxa em `create-public-booking`.
- Introduzir uma marcação explícita de "papel administrador" nas políticas RLS e nas Edge Functions administrativas, hoje dependentes de só existir uma conta cadastrada.
- Qualquer teste real do painel administrativo, login, agendamento de ponta a ponta contra o Supabase de produção, e testes em dispositivos móveis reais — isso exige acesso ao ambiente ao vivo ou que você mesmo rode os testes com um roteiro que vou preparar.

**Importante sobre honestidade do processo:** esta auditoria não incluiu testes automatizados de navegador contra o site publicado (não havia navegador conectado nesta sessão), nem qualquer consulta ao banco de dados real. Tudo que está marcado como "corrigido" acima foi verificado por leitura cuidadosa do código e, no caso da navegação/carrinho, por um teste automatizado de navegador simulando o fluxo completo contra uma cópia local do site. Tudo que precisa de confirmação com dados reais está marcado como Fase 2, não como "corrigido".

## 10. Fase 2 — resultado (verificação ao vivo no Supabase, com sua autorização)

Consultas de leitura foram feitas diretamente no SQL Editor do seu projeto Supabase (via a extensão do Chrome, com a sessão já logada por você — em nenhum momento uma senha foi usada ou solicitada), e uma configuração foi alterada com sua autorização explícita.

**🔴 Achado crítico — corrigido:** as políticas de RLS nomeadas como "admin" (ex: `admin read customers`, `admin update`, `admin delete contact messages`) em `bookings`, `customer_profiles`, `contact_messages`, `loyalty_accounts`, `loyalty_events`, `schedule_blocks` e `booking_customer_actions` na verdade liberavam acesso para **qualquer usuário autenticado** (`using (true)`, role `{authenticated}`), sem checar se a pessoa era realmente admin. Ao mesmo tempo, a opção **"Allow new users to sign up"** estava **ativada** no Supabase Auth, e nenhuma página pública do site usa esse sistema de cadastro (só as páginas administrativas). Ou seja: qualquer pessoa podia criar uma conta grátis e, com ela, ler/editar/apagar dados de clientes.
- **Ação tomada:** desativei "Allow new users to sign up" (Authentication → Sign In/Providers), com sua autorização. Confirmei por consulta que existe apenas **1 conta** no projeto (a sua, criada em 12/07/2026) — não há indício de que a brecha tenha sido explorada por terceiros.
- **Pendente (não crítico agora que o cadastro está fechado):** reescrever as políticas RLS para checar de verdade um papel de admin (ex: tabela `admin_users` ou custom claim no JWT), como defesa em profundidade. Não fiz essa mudança sozinho por ser mais invasiva (risco de travar o próprio painel administrativo) e por não ter como testar contra o painel ao vivo sem suas credenciais. Recomendo fazer isso com calma, testando junto comigo.

**🟡 Achado confirmado — corrigido:** consultei a definição real das três funções usadas pela pesquisa de satisfação:
- `submit_experience_response(p_token uuid, p_response text, p_feedback text)` — aceita `p_response` com os valores `'satisfied'`, `'feedback'` ou `'review_clicked'`.
- `get_experience_context(p_token uuid)` — devolve `{valid, status, first_name, booking_date, services, feedback_text}`.
- `mark_experience_google_click(p_token uuid)`.

`avaliacao.html`/`avaliacao-v27.js` já usava exatamente esse contrato — confirmado que essa página funciona normalmente. `experiencia.html`/`experiencia-v27.js` usava um contrato antigo e incompatível (`p_answer`, `data.ok`, `data.answered`, `data.answer` — nenhum desses campos existe de verdade), o que fazia a página mostrar erro para 100% dos visitantes, desde o carregamento. Corrigido `experiencia-v27.js` para usar o mesmo contrato comprovado de `avaliacao.html`, preservando a interface visual própria da página. Nenhuma migration foi alterada — a correção foi só no JavaScript do site.

**O que NÃO foi verificado nesta rodada:** políticas RLS de tabelas fora do padrão "admin"/`using(true)` (podem existir políticas mais específicas não cobertas pela consulta feita), e nenhum teste de ponta a ponta logado no painel administrativo real (não usei suas credenciais).

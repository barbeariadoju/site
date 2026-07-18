# V25.0.2 — Correções da confirmação automática

- Corrigido o envio de Push ao criar agendamentos pelo site.
- Corrigido o envio de Push ao criar agendamentos pela JuIA.
- Nova Edge Function `create-public-booking` mantém o segredo do Push fora do navegador.
- Busca do CRM refeita com pesquisa por nome, telefone e e-mail.
- Busca ignora acentos e diferenças entre maiúsculas e minúsculas.
- Adicionados botões Buscar e Limpar, Enter e filtro automático com pequena espera.

# V25.0.1 — Confirmação automática e CRM

- Agendamentos públicos passam a ser gravados como confirmados.
- JuIA confirma o horário imediatamente após a reserva bem-sucedida.
- Tela pública não informa mais que o cliente deve aguardar confirmação.
- Busca do CRM continua instantânea e agora também responde à tecla Enter.
- Mantidos bloqueios de horário, margem mínima de 15 minutos e prevenção de conflitos.

# V24.6.3 — Push sincronizado e autorreparo
- Novo par VAPID sincronizado entre site e Supabase.
- Detecta automaticamente assinatura criada com chave antiga.
- Cancela assinatura antiga antes de criar a nova.
- Exibe entregas e falhas no teste de notificação.
- Atualiza Service Worker e cache para evitar versão antiga.

# V24.6.2
- Rotação completa das chaves VAPID.
- Novo segredo do webhook.
- Chave pública sincronizada com o site.

# V24.6.1 — Push multicliente e alerta sonoro no PC

- Notificações Web Push em Android, iPhone/iPad instalados e Chrome/Edge no computador.
- Notificação persistente no PC (`requireInteraction`) com som padrão do sistema.
- Campainha interna adicional quando o painel administrativo está aberto no computador.
- Vibração reforçada em dispositivos compatíveis.
- Tela administrativa para ativar, testar e desativar cada aparelho.
- Toque na notificação abre a agenda administrativa.

# V24.5.1 — Estabilização do formulário próprio

- Reescreve a Edge Function `contact-form` sem dependência externa do cliente Supabase.
- Compatibilidade com `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_SECRET_KEYS`.
- Tratamento global de erros e `request_id` para diagnóstico.
- Logs claros para contagem, gravação e envio opcional por e-mail.
- Mensagem permanece salva mesmo quando o Resend não está configurado ou falha.

# Changelog

## V24.5.0
- Remove dependência do FormSubmit.
- Salva dúvidas no Supabase.
- Nova tela Mensagens no painel.
- Resposta pelo WhatsApp, status, arquivo e exclusão.
- Envio opcional ao Zoho por Resend.
- Proteção antispam e limite por telefone.

## V24.4.8
- Corrige estouro horizontal da revisão do agendamento em celular, tablet e janela estreita.
- JuIA abre em tela cheia no celular com cabeçalho e botão fechar sempre visíveis.
- Bloqueia zoom causado por overflow e restaura a página ao fechar o chat.
- Mantém o formulário FormSubmit para nova tentativa de ativação.

## V24.4.6
- Corrige seleção de serviços no novo agendamento administrativo.
- Cartões inteiros clicáveis e destaque visual de seleção.
- Resumo de quantidade, duração e valor dos serviços selecionados.

## V24.4.4
- JuIA vira aba lateral compacta no celular.
- Evita sobreposição com botões principais e barra inferior.
- Desktop mantém o botão completo.

# V24.4.3 — etapa final responsiva

- Corrige ampliação/estouro horizontal na tela Confira e envie no iPhone.
- Permite quebra segura de nome, telefone, valores e horário.
- Mantém o formulário limitado à largura real da tela.
- Preserva zoom manual por acessibilidade.

# V24.4.1 — alinhamento do fluxo de agendamento

- Continuar e Voltar agora alinham no início útil do agendamento.
- A barra Atendimento, Horário, Seus dados e Confirmar permanece visível.
- Evita retorno ao cabeçalho grande da página em desktop e celular.

## V24.4.1 — Agendamento guiado
- Remove mensagem contraditória de indisponibilidade.
- Evita respostas antigas sobrepondo horários atuais.
- Avança com rolagem automática para a etapa correta.
- Barra de progresso fixa e clicável nas etapas concluídas.
- Ações principais sempre visíveis no celular.
- Resumo lateral oculto no mobile para reduzir rolagem.
- Layout de horários otimizado para telas pequenas.

# V24.3.4

- Agenda abre automaticamente no próximo dia útil reservável.
- Domingo e segunda avançam para terça-feira.
- Após o expediente, a seleção avança para o próximo dia de atendimento.
- Datas sem vagas avançam automaticamente para o próximo dia com disponibilidade.
- Mantida a margem mínima de 15 minutos para agendamentos no mesmo dia.

# V24.3.3

- Oculta horários passados na agenda do mesmo dia.
- Exige antecedência mínima de 15 minutos para novos agendamentos.
- Usa o fuso horário America/Sao_Paulo no banco.
- Validação aplicada no SQL e também no navegador.
- Impede gravação direta de horários fora da margem de segurança.

# V24.3.2
- Corrige carrinho embaçado no desktop, Android e iPhone.
- Move o overlay escuro para trás do carrinho.
- Remove o backdrop-filter do overlay para compatibilidade entre navegadores.

# V24.3 — Carrinho mobile responsivo

- Corrige distorção e corte lateral do carrinho em Android e iOS.
- Carrinho abre como bottom sheet, limitado à viewport.
- Adiciona rolagem interna, safe area do iPhone e botões maiores.
- Oculta JuIA e botões flutuantes enquanto o carrinho está aberto.
- Bloqueia rolagem da página ao fundo.
- Mantém o funcionamento desktop.

## V23.0 — Cliente Inteligente + CRM Premium
- Nova página Minha Área com próximo horário, última visita, fidelidade e repetir serviço.
- CRM com VIP, etiquetas, preferências técnicas, serviços/produtos favoritos, pagamento e intervalo de retorno.
- Novo SQL 015 e contexto comercial ampliado para a JuIA.

# Changelog
## 22.4 — Security & UX Release
- Adicionados Content-Security-Policy e X-Frame-Options.
- Implementado Consent Mode para Analytics/Ads e aviso de privacidade.
- Criada página `privacidade.html`.
- Adicionados toasts, carregamento global e tratamento visual de erros no painel.
- Atualizados cache, Service Worker e documentação.


## V22.3 — Experiência pós-atendimento

- Criada a página `404.html` com identidade visual da Barbearia do Ju e atalhos para início, serviços/agendamento e WhatsApp.
- Após marcar um atendimento como concluído, o painel pergunta se deseja agradecer e solicitar uma avaliação no Google pelo WhatsApp.
- A mensagem utiliza o link oficial de avaliação `https://g.page/r/CaQfC5axIQQIEBM/review`.
- Atualizado o Service Worker e o identificador de cache para evitar versões antigas.
- Nenhuma alteração no banco de dados ou nas Edge Functions.

## V22.1 — Estabilização
- Restringido o CORS da Edge Function `ju-ia-admin` ao domínio `https://www.barbeariadoju.com.br`.
- Mantido o mesmo padrão de CORS já aplicado à função `ju-ia-site`.
- Corrigida a documentação do vídeo: o código usa `preload="none"`, opção escolhida para desempenho.
- Adicionados `VERSAO.md`, `CHANGELOG.md` e `ROADMAP.md` para controle do projeto.
- Nenhuma alteração visual, de banco de dados ou de regras de agendamento nesta versão.

## V22 — Sprint 1
- Fresha removido da experiência pública.
- Horários oficiais alinhados.
- Modo Atendimento adicionado.
- Duplicações do GTM e de scripts corrigidas.

## V22.2 — Refinamentos pré-publicação

- Adicionadas regras `Disallow` para todas as páginas administrativas no `robots.txt`.
- Atualizada a descrição do `manifest.webmanifest`, removendo a referência antiga a agendamento pelo WhatsApp.
- Incluída orientação para validar o redirecionamento de `https://barbeariadoju.com.br` para `https://www.barbeariadoju.com.br` no Cloudflare.
- Nenhuma alteração visual, de banco, agenda, CRM ou Edge Functions.

V22.5 — Correção do carrinho de serviços, integração serviços/produtos/agenda e ordem de carregamento do Supabase.

## V22.6
- Sincroniza automaticamente clientes de agendamentos com o CRM para habilitar edição, arquivamento e exclusão.
- Corrige quebra visual do WhatsApp no bloco de contato desktop.
- Adiciona botão × para remover um serviço individualmente do carrinho.
- Melhora a mensagem de confirmação da JuIA no código-fonte da Edge Function.

## V24.2 — Revisão geral e estabilização
- Remove o link “Privacidade” inserido acidentalmente no card Corte + Barboterapia.
- Atualiza o identificador do cache do PWA e os parâmetros de versão dos arquivos estáticos.
- Adiciona `cliente.html` ao sitemap e ajusta sua atualização dinâmica no Service Worker.
- Sincroniza o código-fonte da Edge Function `ju-ia-site` com a V24 CRM Inteligente já implantada.
- Valida links internos e sintaxe dos arquivos JavaScript.
- Nenhuma alteração de banco de dados.

## V24.4.3 — Responsividade universal da etapa final
- Corrige estouro horizontal em iOS, Android, tablets e janelas estreitas no desktop.
- Permite quebra segura de nomes de serviços, produtos, valores, horários e dados do cliente.
- Adapta a confirmação para telas muito estreitas sem ampliar a página automaticamente.

## V24.4.6 — Horários inteligentes na JuIA
- Quando há muitos horários, a JuIA pergunta se o cliente prefere manhã, tarde ou final do dia.
- Mostra todos os horários disponíveis do período escolhido.
- Responde diretamente quando o cliente pergunta por um horário exato.
- Mantém no pacote as correções responsivas V24.4.3 e V24.4.4.
- Nenhuma alteração de banco de dados.

## V24.6.0 — Notificações do painel
- Ativação separada no iPhone e Android.
- Web Push para novos agendamentos.
- Notificação de teste e abertura direta da agenda.
- Service Worker preparado para alertas em segundo plano.


## V25.1.0 — Meu Agendamento
- Link seguro após a confirmação.
- Consulta, cancelamento e reagendamento pelo cliente.
- Liberação automática do horário cancelado ou anterior.
- Push administrativo em cancelamentos e reagendamentos.
- Google Agenda, arquivo de calendário e convite para instalar o PWA.

## V25.1.1 — Hotfix do link de gerenciamento
- Corrige a gravação do `booking_code` e do `management_token_hash`.
- Impede a entrega de links inválidos quando a gravação falhar.
- Adiciona função SQL atômica para vincular o gerenciamento ao agendamento.
- Melhora os logs da Edge Function `create-public-booking`.

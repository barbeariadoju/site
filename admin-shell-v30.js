// admin-shell-v30.js — CASCA ÚNICA do painel (v29.174.0, fase 2 da reforma do admin).
//
// Pedido do Juliano (11/09/2026): "repensa todo meu módulo admin pra ficar nível de software
// profissional". O inventário achou 5 menus laterais diferentes e 5 variações do cartão de login
// copiadas à mão nas 18 páginas. Agora cada página traz só dois espaços vazios —
//   <section id="admin-login" class="admin-auth-card" data-shell="login"></section>
//   <aside class="admin-sidebar" data-shell="sidebar"></aside>
// — e este arquivo preenche os dois, sempre iguais. Mudou uma vez, mudou nas 18.
//
// Precisa carregar ANTES dos scripts das páginas (eles procuram #admin-email, #admin-signin,
// #admin-signout, [data-admin-nav]) e DEPOIS do HTML (os espaços já existem): fica no fim do
// <body>, como primeiro script "admin-". O item ativo do menu vem de data-admin-page no <body>.
(() => {
  const page = document.body.dataset.adminPage || 'dashboard';
  // Mesma lista da fase 1 (v29.172.0), menos o Modo Atendimento (virou a tela Hoje na fase 3, v29.175.0): 17 destinos em 4 grupos.
  const GROUPS = [
    ['Dia a dia', [
      ['dashboard', 'admin.html', '⌂', 'Hoje'],
      ['agenda', 'admin-agenda.html', '▦', 'Agenda'],
      ['agendamento', 'admin-agendamento.html', '＋', 'Novo agendamento'],
      ['balcao', 'admin-balcao.html', '🚶', 'Atendimento Balcão'],
      ['espera', 'admin-espera.html', '⏳', 'Lista de espera'],
    ]],
    ['Clientes', [
      ['clientes', 'admin-clientes.html', '👥', 'CRM / Clientes'],
      ['fidelidade', 'admin-fidelidade.html', '🏆', 'Fidelidade'],
      ['vales', 'admin-vales.html', '🎁', 'Vales-presente'],
      ['leads', 'admin-leads.html', '🔥', 'Funil de Reativação'],
    ]],
    ['Dinheiro', [
      ['financeiro', 'admin-financeiro.html', '💰', 'Financeiro'],
      ['relatorios', 'admin-relatorios.html', '📈', 'Relatórios'],
      ['equipe', 'admin-equipe.html', '💈', 'Equipe'],
    ]],
    ['Comunicação', [
      ['mensagens', 'admin-mensagens.html', '✉', 'Mensagens'],
      ['notificacoes', 'admin-notificacoes.html', '🔔', 'Notificações'],
      ['assistente', 'admin-assistente.html', '✦', 'Assistente IA'],
      ['avaliacoes', 'admin-avaliacoes.html', '⭐', 'Avaliações Google'],
      ['conteudo', 'admin-conteudo.html', '🗂️', 'Central de Conteúdo'],
    ]],
  ];

  const loginHtml = '<div class="admin-auth-brand"><img src="assets/icon-192.png" alt="Barbearia do Ju"><div><p class="eyebrow">Área restrita</p><h1>Barbearia OS</h1></div></div>'
    + '<label>E-mail<input id="admin-email" type="email" autocomplete="email" placeholder="seu@email.com"></label>'
    + '<label>Senha<input id="admin-password" type="password" autocomplete="current-password" placeholder="••••••••"></label>'
    + '<button id="admin-signin" class="btn primary" type="button">Entrar</button><p id="admin-message" class="field-help"></p>';

  const navHtml = '<nav>' + GROUPS.map(([label, items]) =>
    `<small class="admin-nav-group">${label}</small>` + items.map(([key, href, icon, text]) =>
      `<a data-admin-nav="${key}"${key === page ? ' class="is-active"' : ''} href="${href}"><span>${icon}</span>${text}</a>`).join('')
  ).join('') + '</nav>';

  const sidebarHtml = '<a class="admin-brand" href="admin.html"><img src="assets/icon-192.png" alt=""><span><strong>Barbearia do Ju</strong><small>Barbearia OS</small></span></a>'
    + navHtml
    + '<div class="admin-sidebar-footer"><a href="/">← Voltar ao site</a><button id="admin-signout" type="button">Sair</button></div>';

  const login = document.querySelector('[data-shell="login"]');
  if (login && !login.children.length) login.innerHTML = loginHtml;
  const sidebar = document.querySelector('[data-shell="sidebar"]');
  if (sidebar && !sidebar.children.length) sidebar.innerHTML = sidebarHtml;

  // v29.179.0 — modo embutido (?embed=1): a tela abre dentro de um modal de outra tela (caso: Balcão
  // dentro da Hoje). Some menu, barra do celular e cabeçalho; o conteúdo fica sozinho.
  if (new URLSearchParams(location.search).get('embed') === '1') document.body.classList.add('is-embed');
  window.BDJ_SHELL = { page, groups: GROUPS };
})();

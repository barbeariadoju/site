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
  // Mesma lista da fase 1 (v29.172.0), menos o Modo Atendimento (virou a tela Hoje na fase 3, v29.175.0): 17 destinos em 4 grupos (18 com o Clube do Ju, v29.233.0).
  // v29.251.0 — auditoria impeccable (27/09/2026): os ícones eram emoji (…), cada sistema
  // desenhava de um jeito e o leitor de tela lia "pedestre Balcão". Agora é um jogo só de ícones em
  // traço (SVG, 24px, 1.75), usado no menu, na barra do celular e na folha "Mais". E um nome só por
  // tela: saíram "CRM / Clientes", "Funil de Reativação", "Assistente IA", "Central de Conteúdo" e os
  // apelidos da barra ("Finanças", "Números", "Recados", "Avisos"). O 5º campo é o nome curto da barra.
  const P = {
    hoje: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    agenda: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
    mais: 'M12 5v14M5 12h14',
    balcao: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14.5 12h.01',
    espera: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
    clientes: 'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-3.8-5.9',
    fidelidade: 'M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM8.6 13.9 7 21l5-3 5 3-1.6-7.1',
    vales: 'M4 8h16a1 1 0 0 1 1 1v3H3V9a1 1 0 0 1 1-1zM5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13M12 8C10.5 4 7 3.5 7 6s3 2 5 2M12 8c1.5-4 5-4.5 5-2s-3 2-5 2',
    clube: 'M4 6h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1zM14 6v2M14 11v2M14 16v2',
    reativar: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5',
    financeiro: 'M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM3 11h18M16 15.5h2M6 7l9-3.5 1.4 3.5',
    relatorios: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
    equipe: 'M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM8.3 7.9 20 18M8.3 16.1 20 6',
    mensagens: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 7l9 6 9-6',
    notificacoes: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 21h4',
    assistente: 'M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2zM8 9h8M8 13h5',
    avaliacoes: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
    conteudo: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8.5 13h7M8.5 17h7',
    menu: 'M4 7h16M4 12h16M4 17h16',
    fechado: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM5.6 5.6l12.8 12.8',
    cadeado: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
    alerta: 'M12 4 2.5 20h19zM12 10v4M12 17h.01',
  };
  const icone = (nome) => `<svg class="admin-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${P[nome]}"/></svg>`;
  const GROUPS = [
    ['Dia a dia', [
      ['dashboard', 'admin.html', icone('hoje'), 'Hoje'],
      ['agenda', 'admin-agenda.html', icone('agenda'), 'Agenda'],
      ['agendamento', 'admin-agendamento.html', icone('mais'), 'Novo agendamento', 'Agendar'],
      ['balcao', 'admin-balcao.html', icone('balcao'), 'Balcão'],
      ['espera', 'admin-espera.html', icone('espera'), 'Lista de espera', 'Espera'],
    ]],
    ['Clientes', [
      ['clientes', 'admin-clientes.html', icone('clientes'), 'Clientes'],
      ['fidelidade', 'admin-fidelidade.html', icone('fidelidade'), 'Fidelidade'],
      ['vales', 'admin-vales.html', icone('vales'), 'Vales-presente', 'Vales'],
      ['clube', 'admin-clube.html', icone('clube'), 'Clube'], // v29.233.0
      ['leads', 'admin-leads.html', icone('reativar'), 'Reativação'],
    ]],
    ['Dinheiro', [
      ['financeiro', 'admin-financeiro.html', icone('financeiro'), 'Financeiro'],
      ['relatorios', 'admin-relatorios.html', icone('relatorios'), 'Relatórios'],
      ['equipe', 'admin-equipe.html', icone('equipe'), 'Equipe'],
    ]],
    ['Comunicação', [
      ['mensagens', 'admin-mensagens.html', icone('mensagens'), 'Mensagens'],
      ['notificacoes', 'admin-notificacoes.html', icone('notificacoes'), 'Notificações'],
      ['assistente', 'admin-assistente.html', icone('assistente'), 'Assistente'],
      ['avaliacoes', 'admin-avaliacoes.html', icone('avaliacoes'), 'Avaliações'],
      ['conteudo', 'admin-conteudo.html', icone('conteudo'), 'Conteúdo'],
    ]],
  ];

  const loginHtml = '<div class="admin-auth-brand"><img src="assets/icon-192.png" alt="Barbearia do Ju"><div><h1>Barbearia OS</h1></div></div>'
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
  window.BDJ_SHELL = { page, groups: GROUPS, icone };
})();

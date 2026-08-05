// Ferramenta interna do Claude, desativada por padrão. Ver histórico de deploys.
// Último uso: 05/08/2026, apagou as 5 publicações reais da campanha Dia dos Pais que
// saíram cedo demais (confirmado: FB deletado, 2 IG deletados, 2 Status revogados) e
// resetou os 6 rascunhos da campanha pra 'rascunho' limpo.
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

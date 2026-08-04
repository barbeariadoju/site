// Ferramenta interna do Claude, desativada por padrão. Ver histórico de deploys.
// Último uso: 04/08/2026, teste do modo EDIÇÃO de imagem (mantém ambiente real fiel).
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

// Ferramenta interna do Claude, desativada por padrão. Ver histórico de deploys.
// Último uso: 04/08/2026, confirmado que a foto de referência real resolve o artefato
// de "cabeça sem corpo" na geração de imagem.
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

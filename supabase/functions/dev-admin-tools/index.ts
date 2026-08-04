// Ferramenta interna do Claude, desativada por padrão. Ver histórico de deploys.
// Último uso: 04/08/2026, descoberta de métricas válidas de Insights pra Fase 3.
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

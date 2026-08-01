// Ferramenta interna do Claude, desativada por padrão. Só é reativada (redeploy com a
// lógica real) no momento exato em que for realmente necessária — e volta a ficar assim
// logo depois de usada. Ver histórico de deploys. Último uso: 01/08/2026, teste do fix
// de confirmação de presença automática (v28.32.0).
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

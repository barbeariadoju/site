// Ferramenta interna do Claude, desativada por padrão. Só é reativada (redeploy com a
// lógica real) no momento exato em que for realmente necessária — e volta a ficar assim
// logo depois de usada. Ver histórico de deploys.
// Último uso: 04/08/2026, content-generate-image validado ponta a ponta (bucket
// content-images recriado corretamente, imagem real gerada e enviada ao Juliano).
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

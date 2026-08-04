// Ferramenta interna do Claude, desativada por padrão. Só é reativada (redeploy com a
// lógica real) no momento exato em que for realmente necessária — e volta a ficar assim
// logo depois de usada. Ver histórico de deploys.
// Último uso: 04/08/2026, sonda no token de Página regerado — instagram_manage_messages
// veio no token, mas pages_messaging ficou de fora (checkbox provavelmente não marcado
// na geração do token). Reconferir depois que o Juliano regerar de novo.
Deno.serve(() => new Response(JSON.stringify({ error: 'Ferramenta desativada.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))

// Shared development login would bypass required individual visitor entry.
Deno.serve(() => new Response(JSON.stringify({error:'Use individual account or guest sign-in'}), {status:410,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}}));

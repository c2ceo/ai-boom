import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function requestWithoutCredits(name: string, body: object) {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const queries: string[] = [];
  const client = {
    auth: {
      getClaims: async () => ({ data: { claims: { sub: 'early-account' } } }),
      getUser: async () => ({ data: { user: { id: 'early-account' } } }),
    },
    from(table: string) {
      queries.push(table);
      const result = {
        data: table === 'posts' ? { image_url: 'image.jpg', user_id: 'early-account' }
          : table === 'fal_credits' ? { credits_remaining: 0 }
          : table === 'profiles' ? [{ user_id: 'early-account' }] : null,
      };
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update']) chain[method] = () => chain;
      chain.single = chain.maybeSingle = async () => result;
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
      return chain;
    },
  };
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/const \{ createClient \} = await import\([^\n]+\);/, 'const createClient = () => client;')
    .replace(/Deno\.env\.get\(([^)]+)\)!/g, 'Deno.env.get($1)')
    .replace(/ as string/g, '').replace(/: any/g, '');
  const execute = new Function('serve', 'Deno', 'client', source);
  execute((callback: typeof handler) => { handler = callback; }, { env: { get: () => 'configured' } }, client);
  if (!handler) throw new Error('Missing request handler');
  const response = await handler(new Request('http://localhost', {
    method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body),
  }));
  return { response, data: await response.json(), queries };
}

describe('removed first-100 weekly allowance', () => {
  it('requires 35 paid credits for a five-second video, even for an early account', async () => {
    const { response, data, queries } = await requestWithoutCredits('generate-video', { action: 'submit', prompt: 'A bird', duration: 5 });
    expect(response.status).toBe(402);
    expect(data.error).toContain('35 credits');
    expect(queries).not.toContain('free_generations');
  });
  it('requires paid credits for evolution, even for an early account', async () => {
    const { response, data, queries } = await requestWithoutCredits('evolve-post', { post_id: 'own-post' });
    expect(response.status).toBe(402);
    expect(data.needs_credits).toBe(true);
    expect(queries).not.toContain('free_generations');
  });
});
import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.95.3/cors';
import { finishGuestExit } from './lifecycle.ts';

const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return reply({ error: 'Unauthorized' }, 401);
  try {
    const { data: admission, error } = await admin.from('visitor_admissions').select('is_guest').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!admission?.is_guest) return reply({ error: 'Guest account required' }, 403);
    let { data: registry, error: registryError } = await admin.from('platform_content_owner').select('user_id').eq('id', true).maybeSingle();
    if (registryError) throw registryError;
    if (!registry) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: `${crypto.randomUUID()}@platform.ai-boom.invalid`, password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true, ban_duration: '876000h', user_metadata: { username: `aiboom_${crypto.randomUUID().slice(0, 8)}`, display_name: 'AI-Boom' },
      });
      if (createError || !created.user) throw createError ?? new Error('Platform profile unavailable');
      const { error: insertError } = await admin.from('platform_content_owner').insert({ id: true, user_id: created.user.id });
      if (insertError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
        if (cleanupError) throw cleanupError;
        if (insertError.code !== '23505') throw insertError;
      }
      const result = await admin.from('platform_content_owner').select('user_id').eq('id', true).single();
      if (result.error) throw result.error;
      registry = result.data;
    }
    const owner = registry.user_id;
    await finishGuestExit({
      preserveContent: async () => {
        const { data: posts, error } = await admin.from('posts').select('id,image_url,is_private,video_url').eq('user_id', user.id);
        if (error) throw error;
        const mapping: Record<string, string> = {};
        for (const post of posts ?? []) {
          if (post.is_private || post.video_url) throw new Error('Unexpected guest media');
          if (!post.image_url) continue;
          const source = new URL(post.image_url);
          const marker = '/storage/v1/object/public/media/';
          const sourcePath = decodeURIComponent(source.pathname.split(marker)[1] ?? '');
          if (!sourcePath.startsWith(`${user.id}/`)) throw new Error('Unexpected guest media path');
          const { data: blob, error: downloadError } = await admin.storage.from('media').download(sourcePath);
          if (downloadError || !blob) throw downloadError ?? new Error('Photo unavailable');
          const destination = `${owner}/guest-posts/${post.id}/${sourcePath.split('/').pop()}`;
          const { error: uploadError } = await admin.storage.from('media').upload(destination, blob, { upsert: true, contentType: blob.type });
          if (uploadError) throw uploadError;
          mapping[post.image_url] = admin.storage.from('media').getPublicUrl(destination).data.publicUrl;
        }
        const { error: transferError } = await admin.rpc('transfer_guest_content', { p_guest: user.id, p_media: mapping });
        if (transferError) throw transferError;
      },
      removeGuestData: async () => {
        // Storage can prevent identity deletion; published media now has independent copies.
        const clearFolder = async (bucket: string, folder: string): Promise<void> => {
          while (true) {
            const { data: files, error } = await admin.storage.from(bucket).list(folder, { limit: 100 });
            if (error) throw error;
            if (!files?.length) break;
            for (const file of files) {
              const path = `${folder}/${file.name}`;
              if (!file.id) await clearFolder(bucket, path);
              else {
                const { error: removeError } = await admin.storage.from(bucket).remove([path]);
                if (removeError) throw removeError;
              }
            }
          }
        };
        await clearFolder('media', user.id);
        await clearFolder('private-media', user.id);
        for (const table of ['safe_media', 'verified_media', 'image_requests', 'joke_requests', 'video_jobs', 'fal_credits', 'free_generations', 'subscriptions', 'stripe_credit_purchases']) {
          const { error } = await admin.from(table).delete().eq('user_id', user.id);
          if (error) throw error;
        }
        const { error: requestsError } = await admin.from('follow_requests').delete().or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
        if (requestsError) throw requestsError;
        const { data: conversations, error: conversationError } = await admin.from('conversations').select('id').or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
        if (conversationError) throw conversationError;
        for (const conversation of conversations ?? []) {
          const { error: messagesError } = await admin.from('messages').delete().eq('conversation_id', conversation.id);
          if (messagesError) throw messagesError;
          const { error } = await admin.from('conversations').delete().eq('id', conversation.id);
          if (error) throw error;
        }
      },
      deleteIdentity: async () => {
        const { error } = await admin.auth.admin.deleteUser(user.id);
        if (error) throw error;
        const { error: admissionError } = await admin.from('visitor_admissions').delete().eq('user_id', user.id);
        if (admissionError) throw admissionError;
      },
    });
    return reply({ success: true });
  } catch (error) {
    console.error('Guest sign-out failed:', error instanceof Error ? error.message : 'Database or storage operation failed');
    return reply({ error: 'Unable to finish guest sign-out. Your published posts are protected; please try again.' }, 500);
  }
});
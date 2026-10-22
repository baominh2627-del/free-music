import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function defaultKey(variable: string, legacyVariable?: string) {
  const keySet = Deno.env.get(variable);
  if (keySet) {
    const keys = JSON.parse(keySet) as Record<string, string>;
    if (keys.default) return keys.default;
  }
  return legacyVariable ? Deno.env.get(legacyVariable) : undefined;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = defaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return respond(500, { error: 'Supabase function keys are not configured.' });
  }
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'Please sign in as an administrator.' });

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: 'Your sign-in session is invalid or expired.' });

  const { data: isAdmin, error: adminCheckError } = await caller.rpc('is_pink_tune_admin');
  if (adminCheckError || isAdmin !== true) return respond(403, { error: 'Only Pink Tune admins can create uploader accounts.' });

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email)) return respond(400, { error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return respond(400, { error: 'Password must be between 8 and 128 characters.' });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createError || !created.user) {
    const duplicate = createError?.code === 'email_exists' || createError?.message.toLowerCase().includes('already');
    return respond(duplicate ? 409 : 400, { error: duplicate ? 'Email này đã có tài khoản.' : createError?.message || 'Could not create account.' });
  }

  const { error: roleError } = await adminClient
    .from('pink_tune_uploaders')
    .insert({ user_id: created.user.id });
  if (roleError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return respond(500, { error: 'Account creation failed while assigning uploader access. Check that the uploader migration has run.' });
  }

  return respond(201, { id: created.user.id, email: created.user.email });
});

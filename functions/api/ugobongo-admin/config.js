import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json } from '../../_lib/http.js';
import { readConfig, saveConfig } from '../../_lib/ugobongoConfig.js';

export async function onRequestGet({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  return json(await readConfig(env));
}

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  await saveConfig(env, body);
  return json({ ok: true });
}

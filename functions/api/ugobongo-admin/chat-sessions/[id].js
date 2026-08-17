import { requireUgobongoAdmin } from '../../../_lib/ugobongoAuth.js';
import { json } from '../../../_lib/http.js';

export async function onRequestGet({ request, env, params }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const { results } = await env.DB.prepare(
    'SELECT role, content, image_url, created_at FROM ugobongo_chat_messages WHERE session_id = ? ORDER BY created_at ASC',
  ).bind(params.id).all();
  return json({ messages: results });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM ugobongo_chat_messages WHERE session_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM ugobongo_chat_sessions WHERE id = ?').bind(params.id),
  ]);
  return json({ ok: true });
}

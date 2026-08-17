import { requireUgobongoAdmin } from '../../../_lib/ugobongoAuth.js';
import { json, randomId } from '../../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const { results } = await env.DB.prepare(
    'SELECT id, title, updated_at FROM ugobongo_chat_sessions ORDER BY updated_at DESC LIMIT 50',
  ).all();
  return json({ sessions: results });
}

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const id = randomId();
  await env.DB.prepare(
    "INSERT INTO ugobongo_chat_sessions (id, title, created_at, updated_at) VALUES (?, 'New chat', datetime('now'), datetime('now'))",
  ).bind(id).run();

  return json({ id, title: 'New chat' }, { status: 201 });
}

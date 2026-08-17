import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json, badRequest } from '../../_lib/http.js';
import { readConfig, saveConfig } from '../../_lib/ugobongoConfig.js';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const JSON_ACTION_RE = /```json_action\s*([\s\S]*?)```/;

function systemPrompt(config) {
  return `You are the editing assistant embedded in the admin panel for a single web page ("ugobongo"). You can chat normally, and you can also edit the page's content and settings directly when the user asks you to.

The page's current saved configuration is this JSON object:
${JSON.stringify(config)}

Field meanings:
- title, subtitle: page header text.
- loading_ms: how long the loading screen shows, in milliseconds (0 removes it).
- loading_messages: an array of strings the loading screen cycles through.
- spinner_image_url: an image URL used as the spinning loader (null = default plain spinner).
- spinner_speed_ms: how many milliseconds one spin rotation takes.
- blocks: an array of content blocks rendered on the page in order. Each block is one of:
  - {"type":"heading","text":"..."}
  - {"type":"paragraph","html":"..."} (html is trusted, rendered as-is)
  - {"type":"image","url":"...","caption":"..."}
  - {"type":"gallery","images":["...", "..."]}
  - {"type":"button","label":"...","href":"..."}
  - {"type":"spacer","height":40}
  - {"type":"role","title":"...","meta":"...","items":["...", "..."]}
  - {"type":"columns","left":[...blocks...],"right":[...blocks...]} (left/right hold the simple block types above, not "columns" itself)
  Give each block a short unique "id" string.
- images: a legacy gallery array only used when "blocks" is empty; ignore it if blocks is set.
- bio_html: legacy fallback body only used when "blocks" is empty; ignore it if blocks is set.

When the user asks you to change something about the page, respond with a brief, plain sentence describing what you did, followed by a fenced code block labeled json_action containing the COMPLETE new configuration object (every field, not a partial patch — copy over any field you are not intentionally changing from the current configuration above). Example ending:

\`\`\`json_action
{"title": "...", "subtitle": "...", "bio_html": "", "images": [], "loading_ms": 12000, "loading_messages": [...], "spinner_image_url": null, "spinner_speed_ms": 2000, "blocks": [...]}
\`\`\`

Only include a json_action block when you are actually changing the saved page. For ordinary questions or conversation, just reply in plain text with no code block.`;
}

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;
  if (!env.AI) return json({ error: 'Workers AI is not configured for this project.' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return badRequest('messages array is required');

  const history = body.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!history.length) return badRequest('messages array is empty');

  const config = await readConfig(env);
  const messages = [{ role: 'system', content: systemPrompt(config) }, ...history];

  let result;
  try {
    result = await env.AI.run(MODEL, { messages, max_tokens: 2048 });
  } catch (err) {
    return json({ error: `AI request failed: ${err.message || err}` }, { status: 502 });
  }

  const raw = (result && result.response) || '';
  const match = JSON_ACTION_RE.exec(raw);
  let applied = false;
  let newConfig = null;

  if (match) {
    try {
      const proposed = JSON.parse(match[1]);
      newConfig = await saveConfig(env, proposed);
      applied = true;
    } catch (err) {
      return json({ reply: raw.replace(JSON_ACTION_RE, '').trim(), applied: false, error: `Proposed change was invalid, not saved: ${err.message || err}` });
    }
  }

  const reply = raw.replace(JSON_ACTION_RE, '').trim();
  return json({ reply, applied, config: newConfig });
}

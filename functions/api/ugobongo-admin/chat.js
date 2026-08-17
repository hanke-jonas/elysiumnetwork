import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json, badRequest, randomId } from '../../_lib/http.js';
import { readConfig, saveConfig } from '../../_lib/ugobongoConfig.js';
import { DAILY_NEURON_CAP, getTodayNeuronUsage, addNeuronUsage, estimateNeurons } from '../../_lib/aiUsage.js';
import { fetchAndExtractText } from '../../_lib/webFetch.js';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const JSON_ACTION_RE = /```json_action\s*([\s\S]*?)```/;
const FETCH_URL_RE = /```fetch_url\s*([\s\S]*?)```/;
const MAX_TOOL_ITERATIONS = 3;
// The model's real context window is 24,000 tokens (system prompt +
// history + this message + output combined) -- this cap is a sanity limit
// against a single pathological paste, not the real ceiling.
const MAX_MESSAGE_CHARS = 20000;
const MAX_HISTORY_MESSAGES = 30;

function systemPrompt(config) {
  return `You are the editing assistant embedded in the admin panel for a single web page ("ugobongo"). You can chat normally, edit the page's content directly, and look things up on the web when useful.

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

ACCURACY RULES — follow these strictly, they matter more than being helpful-sounding:
1. Never invent, generate, or guess a URL of any kind (image, button link, anything). Every URL you use in a json_action must come from one of exactly three places: (a) already present in the current configuration shown above, (b) given to you in a user's message as "[Attached file: URL]", or (c) a URL the user typed directly in the conversation. If none of those gives you a real URL for what's being asked, say so in plain text and ask the user to attach a file or provide the URL — do not include a json_action with a fabricated URL.
2. Never state a specific fact — a date, number, name, quote, or claim about the real world — as if certain, unless it is already present in the current configuration, was said earlier in this conversation, or came from a fetch_url result. If you are not sure, either use fetch_url to check, or say plainly that you don't have that information rather than guessing.
3. When you make an edit, only change what was actually asked. Copy every other field and every other block over unchanged from the current configuration — do not add, remove, or rewrite anything the user didn't ask about, even to be "helpful."
4. If you are not confident a json_action you are about to produce is accurate, don't send it — ask a clarifying question in plain text instead.

You have a second tool: to read a web page before answering, respond with ONLY a fenced code block labeled fetch_url containing {"url": "https://..."} and nothing else. The page's extracted text will be given back to you as the next message so you can continue. Use this when the user asks you to look something up or base an edit on something from a specific URL. You get at most a few fetches per turn, so use it purposefully.

When the user asks you to change something about the page, respond with a brief, plain sentence describing what you did, followed by a fenced code block labeled json_action containing the COMPLETE new configuration object (every field, not a partial patch — copy over any field you are not intentionally changing from the current configuration above). Example ending:

\`\`\`json_action
{"title": "...", "subtitle": "...", "bio_html": "", "images": [], "loading_ms": 12000, "loading_messages": [...], "spinner_image_url": null, "spinner_speed_ms": 2000, "blocks": [...]}
\`\`\`

Only include a json_action block when you are actually changing the saved page, and only include a fetch_url block when you need to read a page before responding. Never include both in the same reply. For ordinary questions or conversation, just reply in plain text with no code block.`;
}

export async function onRequestPost({ request, env, waitUntil }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;
  if (!env.AI) return json({ error: 'Workers AI is not configured for this project.' }, { status: 500 });
  if (!env.DB) return json({ error: 'Database not configured.' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.session_id !== 'string') return badRequest('session_id is required');
  const userMessage = typeof body.message === 'string' ? body.message.slice(0, MAX_MESSAGE_CHARS) : '';
  const imageUrl = typeof body.image_url === 'string' && body.image_url ? body.image_url.slice(0, 500) : null;
  if (!userMessage.trim() && !imageUrl) return badRequest('message is empty');

  const sessionId = body.session_id;
  const session = await env.DB.prepare('SELECT id, title FROM ugobongo_chat_sessions WHERE id = ?').bind(sessionId).first();
  if (!session) return badRequest('Unknown session_id');

  const userContent = userMessage + (imageUrl ? `\n\n[Attached file: ${imageUrl}]` : '');
  await env.DB.prepare("INSERT INTO ugobongo_chat_messages (id, session_id, role, content, image_url) VALUES (?, ?, 'user', ?, ?)")
    .bind(randomId(), sessionId, userContent, imageUrl).run();

  if (session.title === 'New chat') {
    const title = userMessage.slice(0, 60).trim() || 'New chat';
    await env.DB.prepare("UPDATE ugobongo_chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?").bind(title, sessionId).run();
  } else {
    await env.DB.prepare("UPDATE ugobongo_chat_sessions SET updated_at = datetime('now') WHERE id = ?").bind(sessionId).run();
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (event) => writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  async function run() {
    try {
      await send({ type: 'status', text: 'Thinking…' });

      let usedSoFar = await getTodayNeuronUsage(env);
      if (usedSoFar >= DAILY_NEURON_CAP) {
        await send({ type: 'error', error: "Daily AI usage budget reached — resets at midnight UTC. No charge was made; this limit exists to keep usage inside Cloudflare's free allocation.", budget: { used: usedSoFar, cap: DAILY_NEURON_CAP } });
        return;
      }

      const config = await readConfig(env);
      const { results: historyRows } = await env.DB.prepare(
        'SELECT role, content FROM ugobongo_chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?',
      ).bind(sessionId, MAX_HISTORY_MESSAGES).all();

      const messages = [{ role: 'system', content: systemPrompt(config) }, ...historyRows.map((r) => ({ role: r.role, content: r.content }))];

      let finalText = '';
      let applied = false;
      let newConfig = null;

      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        let result;
        try {
          result = await env.AI.run(MODEL, { messages, max_tokens: 2048 });
        } catch (err) {
          await send({ type: 'error', error: `AI request failed: ${err.message || err}`, budget: { used: Math.round(usedSoFar), cap: DAILY_NEURON_CAP } });
          return;
        }

        const measured = estimateNeurons(result && result.usage);
        const neurons = measured || (JSON.stringify(messages).length / 4) * (26668 / 1_000_000);
        await addNeuronUsage(env, neurons);
        usedSoFar += neurons;

        const raw = (result && result.response) || '';
        const isLastIteration = i === MAX_TOOL_ITERATIONS - 1;
        const fetchMatch = !isLastIteration && FETCH_URL_RE.exec(raw);

        if (fetchMatch) {
          let target = null;
          try { target = JSON.parse(fetchMatch[1]).url; } catch { /* ignore, handled below */ }
          if (target) {
            if (usedSoFar >= DAILY_NEURON_CAP) {
              await send({ type: 'error', error: 'Daily AI usage budget reached mid-response — resets at midnight UTC.', budget: { used: Math.round(usedSoFar), cap: DAILY_NEURON_CAP } });
              return;
            }
            await send({ type: 'status', text: `Reading ${target}…` });
            const fetched = await fetchAndExtractText(target);
            messages.push({ role: 'assistant', content: raw });
            messages.push({ role: 'user', content: fetched.error ? `Fetch failed: ${fetched.error}` : `Content of ${target}:\n${fetched.text}` });
            continue;
          }
        }

        const actionMatch = JSON_ACTION_RE.exec(raw);
        if (actionMatch) {
          await send({ type: 'status', text: 'Saving changes…' });
          try {
            const proposed = JSON.parse(actionMatch[1]);
            newConfig = await saveConfig(env, proposed);
            applied = true;
          } catch (err) {
            finalText = raw.replace(JSON_ACTION_RE, '').trim();
            await env.DB.prepare("INSERT INTO ugobongo_chat_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)")
              .bind(randomId(), sessionId, finalText).run();
            await send({ type: 'error', error: `Proposed change was invalid, not saved: ${err.message || err}`, budget: { used: Math.round(usedSoFar), cap: DAILY_NEURON_CAP } });
            return;
          }
        }

        finalText = raw.replace(JSON_ACTION_RE, '').replace(FETCH_URL_RE, '').trim();
        break;
      }

      await env.DB.prepare("INSERT INTO ugobongo_chat_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)")
        .bind(randomId(), sessionId, finalText || '(no reply)').run();

      await send({ type: 'done', reply: finalText, applied, config: newConfig, budget: { used: Math.round(usedSoFar), cap: DAILY_NEURON_CAP } });
    } catch (err) {
      await send({ type: 'error', error: `Unexpected error: ${err.message || err}` });
    } finally {
      await writer.close();
    }
  }

  waitUntil(run());

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

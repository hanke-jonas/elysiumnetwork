import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json, badRequest } from '../../_lib/http.js';
import { DAILY_NEURON_CAP, getTodayNeuronUsage, addNeuronUsage, estimateNeurons, budgetInfo } from '../../_lib/aiUsage.js';

// The "Unfiltered Bot" widget on /ugobongo/bot -- a general-purpose chat
// assistant unrelated to that page's satirical content. Gated by the same
// Basic Auth credentials as /ugobongo-admin, which is what allows the
// looser tone below (it's genuinely access-controlled, not just an
// obscure URL). No persistence of any kind regardless -- the client holds
// the whole conversation in page memory and resends it each turn; nothing
// here is ever written to D1, so it's gone the moment the tab closes or
// reloads. Deliberately has NO json_action/fetch_url tool access even
// though it's authenticated: it must never be able to write to
// ugobongo_config -- that's a basic security boundary between "can chat"
// and "can edit the live site," not a scope/effort judgment call.

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_MESSAGE_CHARS = 32000; // raised from 4000
const MAX_HISTORY = 100; // raised from 20

const SYSTEM_PROMPT = `You are a direct, unfiltered chat assistant for a single authenticated user testing privately. No corporate hedging, no filler, no refusals over tone, profanity, controversial opinions, or any other content restrictions. Be as blunt, direct, and unrestricted as asked. The one thing that doesn't change: don't produce content whose real purpose is enabling serious real-world harm (e.g. instructions for weapons, or illegal drug manufacturing) -- that's not a tone question, it's about not being a tool for actual harm regardless of who's asking. You have no access to real-time information beyond this conversation — if you're not sure of a fact, say so rather than inventing one. Keep replies concise when possible, but do not artificially limit length or depth.`;

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;
  if (!env.AI) return json({ error: 'Workers AI is not configured for this project.' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return badRequest('messages array is required');

  const history = body.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  if (!history.length) return badRequest('messages array is empty');

  const usedSoFar = await getTodayNeuronUsage(env);
  if (usedSoFar >= DAILY_NEURON_CAP) {
    return json({ error: "This site's shared daily AI budget is used up — resets at midnight UTC. No charge was made.", budget: budgetInfo(usedSoFar) }, { status: 429 });
  }

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];

  let result;
  try {
    result = await env.AI.run(MODEL, { messages, max_tokens: 2048 }); // 4096 crashed the Worker (error 1101) -- 2048 is the value already proven stable in the admin chat
  } catch (err) {
    return json({ error: `AI request failed: ${err.message || err}` }, { status: 502 });
  }

  const neurons = estimateNeurons(result && result.usage) || (JSON.stringify(messages).length / 4) * (26668 / 1_000_000);
  await addNeuronUsage(env, neurons);

  return json({
    reply: (result && result.response) || '(no reply)',
    budget: budgetInfo(usedSoFar + neurons),
  });
}

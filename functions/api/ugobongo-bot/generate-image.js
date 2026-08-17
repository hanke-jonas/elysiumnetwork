import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json, badRequest } from '../../_lib/http.js';
import { DAILY_NEURON_CAP, IMAGE_GEN_NEURON_ESTIMATE, getTodayNeuronUsage, addNeuronUsage, budgetInfo } from '../../_lib/aiUsage.js';

// Image generation for the Unfiltered Bot, gated by the same admin Basic
// Auth as the rest of /ugobongo/bot. Returns a base64 data: URL directly
// in the JSON response -- nothing is written to R2 or anywhere else, so a
// generated image genuinely disappears once the page is closed, matching
// the "nothing saved" design of this whole surface.
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT_CHARS = 800;

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;
  if (!env.AI) return json({ error: 'Workers AI is not configured for this project.' }, { status: 500 });

  const body = await request.json().catch(() => null);
  const prompt = body && typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : '';
  if (!prompt) return badRequest('prompt is required');

  const usedSoFar = await getTodayNeuronUsage(env);
  if (usedSoFar >= DAILY_NEURON_CAP) {
    return json({ error: "This site's shared daily AI budget is used up — resets at midnight UTC. No charge was made.", budget: budgetInfo(usedSoFar) }, { status: 429 });
  }

  let result;
  try {
    // The model's real parameter is "steps" (max 8) -- "num_steps" isn't a
    // recognized field for this model and was causing every call to fail
    // with a raw platform error instead of a normal response.
    result = await env.AI.run(MODEL, { prompt, steps: 4 });
  } catch (err) {
    return json({ error: `Image generation failed: ${err.message || err}` }, { status: 502 });
  }

  await addNeuronUsage(env, IMAGE_GEN_NEURON_ESTIMATE);

  // flux-1-schnell returns { image: "<base64>" } (raw base64, no data: prefix).
  const base64 = result && result.image;
  if (!base64) return json({ error: 'Image generation returned no image.' }, { status: 502 });

  return json({
    image_url: `data:image/jpeg;base64,${base64}`,
    budget: budgetInfo(usedSoFar + IMAGE_GEN_NEURON_ESTIMATE),
  });
}

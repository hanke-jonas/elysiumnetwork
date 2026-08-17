// Hard daily cap on Workers AI usage for the ugobongo chat assistant,
// enforced well under Cloudflare's 10,000-free-Neurons-per-day allocation
// (https://developers.cloudflare.com/workers-ai/platform/pricing/) so this
// feature can never push the account into billable usage, on the Free plan
// or the Paid one. Reuses the existing usage_counters table (period,
// metric, count) already used for R2 op tracking on the admin stats page.
//
// Neuron rates for @cf/meta/llama-3.3-70b-instruct-fp8-fast, per Cloudflare's
// pricing page: 26,668 neurons / M input tokens, 204,805 neurons / M output
// tokens.
const INPUT_NEURONS_PER_TOKEN = 26668 / 1_000_000;
const OUTPUT_NEURONS_PER_TOKEN = 204805 / 1_000_000;

// 7,000, not 10,000 -- a deliberate safety margin below the real free
// allocation, so estimation error or a burst of requests can't cross into
// billable territory.
export const DAILY_NEURON_CAP = 7000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayNeuronUsage(env) {
  const row = await env.DB.prepare('SELECT count FROM usage_counters WHERE period = ? AND metric = ?')
    .bind(today(), 'ugobongo_ai_neurons')
    .first();
  return row ? row.count : 0;
}

export async function addNeuronUsage(env, neurons) {
  await env.DB.prepare(`
    INSERT INTO usage_counters (period, metric, count)
    VALUES (?, 'ugobongo_ai_neurons', ?)
    ON CONFLICT(period, metric) DO UPDATE SET count = count + excluded.count
  `).bind(today(), Math.round(neurons)).run();
}

export function estimateNeurons(usage) {
  if (!usage) return 0;
  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  return input * INPUT_NEURONS_PER_TOKEN + output * OUTPUT_NEURONS_PER_TOKEN;
}

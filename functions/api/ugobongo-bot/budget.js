import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json } from '../../_lib/http.js';
import { getTodayNeuronUsage, budgetInfo } from '../../_lib/aiUsage.js';

// Read-only budget status, no AI call -- lets the bot page show today's
// usage the moment it loads, instead of only after the first message.
export async function onRequestGet({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const usedSoFar = await getTodayNeuronUsage(env);
  return json({ budget: budgetInfo(usedSoFar) });
}

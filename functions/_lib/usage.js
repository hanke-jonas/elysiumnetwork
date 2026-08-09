// Best-effort monthly counters for the admin Stats page — see
// usage_counters in d1/schema.sql for why these exist (R2's own Class A/B
// operation quotas aren't queryable from a Worker binding). Never awaited
// on the hot path: a failed or slow counter write must never affect an
// upload or a file view.
export function bumpUsage(env, metric) {
  if (!env.DB) return Promise.resolve();
  const period = new Date().toISOString().slice(0, 7);
  return env.DB.prepare(
    'INSERT INTO usage_counters (period, metric, count) VALUES (?, ?, 1) ON CONFLICT(period, metric) DO UPDATE SET count = count + 1'
  ).bind(period, metric).run().catch(() => {});
}

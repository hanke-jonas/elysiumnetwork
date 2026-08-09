import { requireStaff } from '../../_lib/guard.js';
import { json } from '../../_lib/http.js';

// Cloudflare's own free tier (checked against Cloudflare's published
// pricing, not something queryable live): R2 10GB storage / 1M Class A
// (write) ops / 10M Class B (read) ops per month; D1 5GB storage / 5M rows
// read / 100k rows written per day; Workers/Pages Functions 100k
// requests/day. Real bandwidth/egress isn't billed on R2 at all (free
// forever) and isn't billed on Workers/Pages either — the UI says so
// rather than treating a byte count as if it were a cost.
const FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
const FREE_UPLOADS_PER_MONTH = 1_000_000;
const FREE_VIEWS_PER_MONTH = 10_000_000;
const FREE_D1_ROWS_READ_PER_DAY = 5_000_000;
const FREE_D1_ROWS_WRITTEN_PER_DAY = 100_000;
const FREE_WORKERS_REQUESTS_PER_DAY = 100_000;

const CF_API = 'https://api.cloudflare.com/client/v4';
const WORKER_SCRIPT_NAME = 'elysiumnetwork';
const ZONE_NAME = 'elysium.ngo';

async function cfGraphQL(token, query, variables) {
  const res = await fetch(`${CF_API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`GraphQL HTTP ${res.status}`);
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

async function getZoneId(token) {
  const res = await fetch(`${CF_API}/zones?name=${encodeURIComponent(ZONE_NAME)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success || !body.result?.length) throw new Error('Zone lookup failed');
  return body.result[0].id;
}

// Every Cloudflare-sourced section is independent and wrapped separately —
// a single unavailable permission or an API shape change should degrade
// just that one card, never take down the whole page.
async function section(fn) {
  try {
    return { ok: true, ...(await fn()) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  let bytes = 0;
  let objectCount = 0;
  let cursor;
  do {
    const page = await env.UPLOADS.list({ cursor, limit: 1000 });
    for (const obj of page.objects) bytes += obj.size;
    objectCount += page.objects.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const period = new Date().toISOString().slice(0, 7);
  let uploads = 0;
  let views = 0;
  if (env.DB) {
    const rows = await env.DB.prepare('SELECT metric, count FROM usage_counters WHERE period = ?').bind(period).all();
    for (const row of rows.results || []) {
      if (row.metric === 'upload') uploads = row.count;
      if (row.metric === 'view') views = row.count;
    }
  }

  const result = {
    storage: { bytes, objectCount, freeBytes: FREE_STORAGE_BYTES },
    month: { period, uploads, views, freeUploads: FREE_UPLOADS_PER_MONTH, freeViews: FREE_VIEWS_PER_MONTH },
    cloudflare: { configured: Boolean(env.CF_API_TOKEN && env.CF_ACCOUNT_ID) },
  };

  if (!result.cloudflare.configured) return json(result);

  const token = env.CF_API_TOKEN;
  const accountTag = env.CF_ACCOUNT_ID;
  const now = new Date();
  const monthStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthStartDay = monthStartDate.slice(0, 10);
  const nowIso = now.toISOString();
  const nowDay = nowIso.slice(0, 10);
  // Storage gauges (r2Storage/d1Storage) are point-in-time snapshots, not
  // sums — a wide date range isn't needed to read the latest value, and
  // Cloudflare rejects any *StorageAdaptiveGroups query spanning more than
  // ~4.5 weeks, so this deliberately stays short regardless of month length.
  const recentWindowStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [r2Operations, r2Storage, d1Queries, d1Storage, workers, traffic] = await Promise.all([
    section(async () => {
      const data = await cfGraphQL(
        token,
        `query($accountTag: string!, $start: Time!, $end: Time!, $bucketName: string!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            r2OperationsAdaptiveGroups(limit: 100, filter: { datetime_geq: $start, datetime_leq: $end, bucketName: $bucketName }) {
              sum { requests }
              dimensions { actionType }
            }
          } }
        }`,
        { accountTag, start: monthStartDate, end: nowIso, bucketName: 'elysium-uploads' }
      );
      const groups = data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups || [];
      return { byAction: groups.map((g) => ({ actionType: g.dimensions.actionType, requests: g.sum.requests })) };
    }),
    section(async () => {
      const data = await cfGraphQL(
        token,
        `query($accountTag: string!, $start: Time!, $end: Time!, $bucketName: string!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            r2StorageAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, datetime_leq: $end, bucketName: $bucketName }, orderBy: [datetime_DESC]) {
              max { objectCount payloadSize metadataSize }
              dimensions { datetime }
            }
          } }
        }`,
        { accountTag, start: recentWindowStart, end: nowIso, bucketName: 'elysium-uploads' }
      );
      const g = data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0];
      return g ? { objectCount: g.max.objectCount, payloadSize: g.max.payloadSize, metadataSize: g.max.metadataSize } : { unavailable: true };
    }),
    section(async () => {
      const data = await cfGraphQL(
        token,
        `query($accountTag: string!, $start: Date!, $end: Date!, $databaseId: string!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $start, date_leq: $end, databaseId: $databaseId }) {
              sum { readQueries writeQueries rowsRead rowsWritten }
            }
          } }
        }`,
        { accountTag, start: monthStartDay, end: nowDay, databaseId: env.DB_ID || '85c9189a-8eb9-43e2-a39e-bd272b90b2cf' }
      );
      const groups = data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
      const totals = groups.reduce((acc, g) => ({
        readQueries: acc.readQueries + (g.sum.readQueries || 0),
        writeQueries: acc.writeQueries + (g.sum.writeQueries || 0),
        rowsRead: acc.rowsRead + (g.sum.rowsRead || 0),
        rowsWritten: acc.rowsWritten + (g.sum.rowsWritten || 0),
      }), { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 });
      return totals;
    }),
    section(async () => {
      const data = await cfGraphQL(
        token,
        `query($accountTag: string!, $start: Time!, $end: Time!, $databaseId: string!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            d1StorageAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, datetime_leq: $end, databaseId: $databaseId }, orderBy: [datetime_DESC]) {
              max { databaseSizeBytes }
              dimensions { datetime }
            }
          } }
        }`,
        { accountTag, start: recentWindowStart, end: nowIso, databaseId: env.DB_ID || '85c9189a-8eb9-43e2-a39e-bd272b90b2cf' }
      );
      const g = data?.viewer?.accounts?.[0]?.d1StorageAdaptiveGroups?.[0];
      return g ? { databaseSizeBytes: g.max.databaseSizeBytes } : { unavailable: true };
    }),
    section(async () => {
      const data = await cfGraphQL(
        token,
        `query($accountTag: string!, $start: string!, $end: string!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $start, datetime_leq: $end }) {
              sum { requests errors subrequests }
              quantiles { cpuTimeP50 cpuTimeP99 }
              dimensions { scriptName }
            }
          } }
        }`,
        { accountTag, start: monthStartDate, end: nowIso }
      );
      // Deliberately not filtered by scriptName: this account's Pages
      // Function script name in this dataset isn't confirmed to match the
      // "elysiumnetwork" name from the Workers Scripts API, so every
      // script's numbers are grouped here and the matching one picked out
      // — this also self-corrects if Cloudflare ever renames it internally.
      const allGroups = data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
      const groups = allGroups.filter((g) => g.dimensions.scriptName === WORKER_SCRIPT_NAME);
      // Confirmed live: this account's two standalone Workers scripts
      // (elysium-discovery-cron, erasmus-workshop-deck) show up here, but
      // the Pages project's own Functions never do — Cloudflare doesn't
      // attribute Pages Functions invocations to a scriptName in this
      // dataset at all, so there is nothing to sum. Total request volume
      // for the whole site (including every Function call) is still real
      // and available in the "Whole site" traffic section below.
      if (!groups.length) {
        throw new Error('Pages Functions aren’t broken out separately from Workers scripts in Cloudflare’s analytics — see "Whole site" traffic below for total request volume, which includes every Function call.');
      }
      const totals = groups.reduce((acc, g) => ({
        requests: acc.requests + (g.sum.requests || 0),
        errors: acc.errors + (g.sum.errors || 0),
        subrequests: acc.subrequests + (g.sum.subrequests || 0),
      }), { requests: 0, errors: 0, subrequests: 0 });
      const withQuantiles = groups.find((g) => g.quantiles);
      return { ...totals, cpuTimeP50: withQuantiles?.quantiles?.cpuTimeP50 ?? null, cpuTimeP99: withQuantiles?.quantiles?.cpuTimeP99 ?? null };
    }),
    section(async () => {
      const zoneTag = await getZoneId(token);
      const data = await cfGraphQL(
        token,
        `query($zoneTag: string!, $start: string!, $end: string!) {
          viewer { zones(filter: { zoneTag: $zoneTag }) {
            httpRequestsAdaptiveGroups(limit: 100, filter: { datetime_geq: $start, datetime_leq: $end }) {
              count
              sum { edgeResponseBytes }
            }
          } }
        }`,
        { zoneTag, start: monthStartDate, end: nowIso }
      );
      const groups = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
      return groups.reduce((acc, g) => ({
        requests: acc.requests + (g.count || 0),
        bytes: acc.bytes + (g.sum.edgeResponseBytes || 0),
      }), { requests: 0, bytes: 0 });
    }),
  ]);

  result.cloudflare.r2Operations = r2Operations;
  result.cloudflare.r2Storage = r2Storage;
  result.cloudflare.d1 = { ...d1Queries, freeRowsReadPerDay: FREE_D1_ROWS_READ_PER_DAY, freeRowsWrittenPerDay: FREE_D1_ROWS_WRITTEN_PER_DAY };
  result.cloudflare.d1Storage = d1Storage;
  result.cloudflare.workers = { ...workers, freeRequestsPerDay: FREE_WORKERS_REQUESTS_PER_DAY };
  result.cloudflare.traffic = traffic;

  return json(result);
}

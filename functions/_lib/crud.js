// Generic staff-only list/create/update/delete for the simple content
// tables (branches, team_members, calls, faqs). Table/primary-key/field
// names always come from this repo's own code (never from the request), so
// interpolating them into SQL is safe — only values are ever parameterized.
import { requireStaff } from './guard.js';
import { json, badRequest, randomId } from './http.js';
import { scheduleRebuild } from './rebuild.js';

function parseRow(row, jsonFields) {
  const out = { ...row };
  for (const f of jsonFields) {
    try { out[f] = JSON.parse(out[f] || '[]'); } catch (e) { out[f] = []; }
  }
  return out;
}

// D1 throws a plain Error whose message contains the SQLite error text —
// there's no structured error code to switch on, so this is a string match.
function isUniqueViolation(err) {
  return String(err).includes('UNIQUE constraint failed');
}

export function makeListCreate(table, pk, fields, jsonFields = []) {
  async function onRequestGet({ env }) {
    const rows = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY sort_order ASC`).all();
    return json({ items: rows.results.map((r) => parseRow(r, jsonFields)) });
  }

  async function onRequestPost({ request, env, waitUntil }) {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');

    const id = body[pk] || randomId();
    const cols = [pk, ...fields];
    const values = cols.map((f) => {
      if (f === pk) return id;
      let v = body[f];
      if (jsonFields.includes(f)) v = JSON.stringify(v || []);
      return v === undefined ? null : v;
    });
    const placeholders = cols.map(() => '?').join(', ');
    try {
      await env.DB.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        .bind(...values)
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) return badRequest(`A ${table.slice(0, -1)} with this ${pk} already exists`);
      return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
    }
    waitUntil(scheduleRebuild(env));
    return json({ [pk]: id }, { status: 201 });
  }

  return { onRequestGet, onRequestPost };
}

export function makeUpdateDelete(table, pk, fields, jsonFields = []) {
  async function onRequestPut({ request, env, params, waitUntil }) {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');

    const sets = [];
    const values = [];
    for (const f of fields) {
      if (!(f in body)) continue;
      let v = body[f];
      if (jsonFields.includes(f)) v = JSON.stringify(v || []);
      sets.push(`${f} = ?`);
      values.push(v === undefined ? null : v);
    }
    if (!sets.length) return badRequest('No fields to update');
    sets.push("updated_at = datetime('now')");
    values.push(params.id);
    try {
      await env.DB.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${pk} = ?`).bind(...values).run();
    } catch (err) {
      if (isUniqueViolation(err)) return badRequest(`A ${table.slice(0, -1)} with this ${pk} already exists`);
      return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
    }
    waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  }

  async function onRequestDelete({ request, env, params, waitUntil }) {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    await env.DB.prepare(`DELETE FROM ${table} WHERE ${pk} = ?`).bind(params.id).run();
    waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  }

  return { onRequestPut, onRequestDelete };
}

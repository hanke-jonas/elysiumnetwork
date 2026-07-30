// Password hashing via Web Crypto's PBKDF2 — the Workers runtime has no
// Node crypto/bcrypt, but crypto.subtle is available everywhere and PBKDF2
// with a high iteration count is a reasonable, dependency-free choice for
// this scale of user base.
// Cloudflare Workers' real edge runtime hard-caps PBKDF2 at 100,000
// iterations (confirmed in production: "NotSupportedError: Pbkdf2 failed:
// iteration counts above 100000 are not supported") even though local
// Miniflare happily runs higher counts — so 100,000 (the platform ceiling)
// is used here instead of OWASP's 210,000-iteration recommendation.
const ITERATIONS = 100000;

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2:${ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await deriveBits(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  // Constant-time compare — timing attacks on a login endpoint are a real,
  // well-known risk, not a theoretical one.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

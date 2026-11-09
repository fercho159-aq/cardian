// Almacén de datos del sistema. En Vercel usa Upstash Redis (REST) con las variables que
// crea la integración «Upstash for Redis» del Marketplace (KV_REST_API_URL / KV_REST_API_TOKEN
// o UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Sin esas variables (desarrollo local)
// guarda todo en .data/kv.json junto al sitio. Cada colección es un JSON completo bajo una llave:
// a esta escala (cientos de registros) es lo más simple y lo más fácil de respaldar.
const fs = require('fs');
const path = require('path');

// Acepta cualquier prefijo que ponga la integración de Vercel (KV_, STORAGE_, UPSTASH_REDIS_…):
// busca la primera variable que termine en _REST_API_URL / _REST_URL y su token correspondiente.
function variable(sufijos) {
  for (const s of sufijos) for (const [k, v] of Object.entries(process.env)) if (v && k.endsWith(s) && !k.includes('READ_ONLY')) return v;
  return '';
}
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || variable(['_REST_API_URL', '_REDIS_REST_URL']);
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || variable(['_REST_API_TOKEN', '_REDIS_REST_TOKEN']);
const PREFIX = 'cardian:';
const LOCAL = path.join(process.cwd(), '.data', 'kv.json');

const remoto = !!(URL_ && TOKEN);

async function llamar(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Upstash ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (j.error) throw new Error('Upstash: ' + j.error);
  return j.result;
}

function sinBase() { if (!remoto && process.env.VERCEL) throw new Error('Falta la base de datos: en Vercel → Storage conecta «Upstash for Redis» al proyecto'); }
function leerLocal() { try { return JSON.parse(fs.readFileSync(LOCAL, 'utf8')); } catch (e) { return {}; } }
function escribirLocal(obj) { fs.mkdirSync(path.dirname(LOCAL), { recursive: true }); fs.writeFileSync(LOCAL, JSON.stringify(obj, null, 1)); }

async function get(key, def) {
  sinBase();
  if (remoto) { const v = await llamar(['GET', PREFIX + key]); return v == null ? def : JSON.parse(v); }
  const all = leerLocal(); return key in all ? all[key] : def;
}
async function set(key, val) {
  sinBase();
  if (remoto) { await llamar(['SET', PREFIX + key, JSON.stringify(val)]); return val; }
  const all = leerLocal(); all[key] = val; escribirLocal(all); return val;
}
// Lee, modifica y guarda una colección (lista). fn recibe la lista y devuelve la lista nueva o undefined.
async function actualizar(key, fn, def = []) {
  const cur = await get(key, def);
  const out = await fn(cur);
  return set(key, out === undefined ? cur : out);
}
// Modo de almacenamiento, para mostrarlo en Ajustes.
function modo() { return remoto ? 'upstash' : 'local'; }

module.exports = { get, set, actualizar, modo };

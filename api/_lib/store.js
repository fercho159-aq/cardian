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
async function del(key) {
  sinBase();
  if (remoto) { await llamar(['DEL', PREFIX + key]); return; }
  const all = leerLocal(); delete all[key]; escribirLocal(all);
}

// ── Candado por colección ──
// Mientras una petición lee-modifica-guarda «ventas», otra que llegue al mismo tiempo espera su turno,
// así nadie pisa los cambios de otro. Es reentrante: dentro del mismo flujo se puede volver a pedir
// el mismo candado sin bloquearse (por ejemplo, actualizar() dentro de un manejador que ya lo tiene).
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
const tenidos = new AsyncLocalStorage();
const colasLocales = new Map();
const espera = ms => new Promise(r => setTimeout(r, ms));
const LIBERAR = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

async function conCandado(key, fn) {
  const actuales = tenidos.getStore() || new Set();
  if (actuales.has(key)) return fn();
  const dentro = () => tenidos.run(new Set([...actuales, key]), fn);
  if (!remoto) {
    // desarrollo local: cola en memoria por llave
    const previa = colasLocales.get(key) || Promise.resolve();
    let soltar; const turno = new Promise(r => { soltar = r; });
    colasLocales.set(key, previa.then(() => turno));
    await previa;
    try { return await dentro(); } finally { soltar(); }
  }
  const lk = PREFIX + 'lock:' + key, token = crypto.randomBytes(8).toString('hex');
  const limite = Date.now() + 8000;
  while (true) {
    const ok = await llamar(['SET', lk, token, 'NX', 'PX', '10000']);
    if (ok === 'OK') break;
    if (Date.now() > limite) throw new Error('El sistema está ocupado, intenta de nuevo en unos segundos');
    await espera(80 + Math.random() * 120);
  }
  try { return await dentro(); } finally { try { await llamar(['EVAL', LIBERAR, '1', lk, token]); } catch (e) {} }
}

// Lee, modifica y guarda una colección (lista) con candado. fn recibe la lista y devuelve la lista nueva o undefined.
async function actualizar(key, fn, def = []) {
  return conCandado(key, async () => {
    const cur = await get(key, def);
    const out = await fn(cur);
    return set(key, out === undefined ? cur : out);
  });
}

// Contador atómico (folios): nunca da el mismo número a dos pedidos simultáneos.
async function incr(key, inicio) {
  sinBase();
  if (remoto) {
    await llamar(['SET', PREFIX + key, String(inicio), 'NX']);
    return Number(await llamar(['INCR', PREFIX + key]));
  }
  return conCandado(key, async () => { const all = leerLocal(); const n = (Number(all[key]) || inicio) + 1; all[key] = n; escribirLocal(all); return n; });
}

// Límite de frecuencia: cuenta eventos por llave en una ventana de tiempo. Devuelve el conteo actual.

async function contar(key, ventanaSeg) {
  if (remoto) {
    const k = PREFIX + 'rl:' + key;
    const n = Number(await llamar(['INCR', k]));
    if (n === 1) await llamar(['EXPIRE', k, String(ventanaSeg)]);
    return n;
  }
  // local: en el archivo de datos, para que sobreviva a la recarga del servidor de pruebas
  const all = leerLocal(); const rl = all._rl || {}; const ahora = Date.now(); const c = rl[key];
  if (!c || c.hasta < ahora) rl[key] = { n: 1, hasta: ahora + ventanaSeg * 1000 }; else c.n++;
  all._rl = rl; escribirLocal(all); return rl[key].n;
}
async function verConteo(key) {
  if (remoto) return Number(await llamar(['GET', PREFIX + 'rl:' + key]) || 0);
  const c = (leerLocal()._rl || {})[key]; return c && c.hasta >= Date.now() ? c.n : 0;
}
async function borrarConteo(key) {
  if (remoto) { await llamar(['DEL', PREFIX + 'rl:' + key]); return; }
  const all = leerLocal(); if (all._rl) { delete all._rl[key]; escribirLocal(all); }
}

// Modo de almacenamiento, para mostrarlo en Ajustes.
function modo() { return remoto ? 'upstash' : 'local'; }
// Token privado de la base, solo para derivar la llave de firma (secreto.js).
function tokenBase() { return remoto ? TOKEN : ''; }

module.exports = { get, set, del, actualizar, conCandado, incr, contar, verConteo, borrarConteo, modo, tokenBase };

// Usuarios, contraseñas y sesión del sistema.
// Sesión: cookie firmada (HMAC) con el id del usuario; dura 30 días. La llave de firma es
// CARDIAN_SECRET en Vercel; si falta se usa una fija de desarrollo (y Ajustes lo avisa).
const crypto = require('crypto');
const store = require('./store');
const { cookies, id, ahora } = require('./http');

const SECRET = process.env.CARDIAN_SECRET || 'dev-cardian-cambia-esta-llave';
const COOKIE = 'cardian_s';
const DIAS = 30;

function hashear(pass, sal) {
  sal = sal || crypto.randomBytes(12).toString('hex');
  const h = crypto.scryptSync(String(pass), sal, 32).toString('hex');
  return sal + ':' + h;
}
function verificar(pass, guardado) {
  if (!guardado) return false;
  const [sal, h] = guardado.split(':');
  const h2 = crypto.scryptSync(String(pass), sal, 32).toString('hex');
  return h.length === h2.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(h2));
}
function firmar(s) { return crypto.createHmac('sha256', SECRET).update(s).digest('base64url'); }
function tokenDe(usuarioId) {
  const p = Buffer.from(JSON.stringify({ u: usuarioId, e: Date.now() + DIAS * 864e5 })).toString('base64url');
  return p + '.' + firmar(p);
}
function leerToken(t) {
  if (!t || !t.includes('.')) return null;
  const [p, f] = t.split('.');
  if (firmar(p) !== f) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.e > Date.now() ? o.u : null; } catch (e) { return null; }
}
function cookieSesion(token, borrar) {
  const base = `${COOKIE}=${borrar ? '' : token}; Path=/; HttpOnly; SameSite=Lax` + (process.env.VERCEL ? '; Secure' : '');
  return base + (borrar ? '; Max-Age=0' : `; Max-Age=${DIAS * 86400}`);
}

// Usuarios. Si no hay ninguno, se crea el administrador inicial (usuario admin, contraseña
// Cardian2026) marcado para cambiar la contraseña en el primer acceso.
async function usuarios() {
  let lista = await store.get('usuarios', []);
  if (!lista.length) {
    lista = [{ id: id(8), nombre: 'Administrador', usuario: 'admin', rol: 'admin', sucursal: '', whatsapp: '', activo: true, recibeLeads: false, cambiarClave: true, clave: hashear('Cardian2026'), creado: ahora() }];
    await store.set('usuarios', lista);
  }
  return lista;
}
function publico(u) { if (!u) return null; const { clave, ...resto } = u; return resto; }

async function usuarioActual(req) {
  const uid = leerToken(cookies(req)[COOKIE]);
  if (!uid) return null;
  const u = (await usuarios()).find(x => x.id === uid);
  return u && u.activo ? u : null;
}
// Exige sesión; con rol 'admin' exige administrador. Devuelve el usuario o manda el error.
async function exigir(req, res, rol) {
  const u = await usuarioActual(req);
  if (!u) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Inicia sesión' })); return null; }
  if (rol === 'admin' && u.rol !== 'admin') { res.statusCode = 403; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Solo el administrador puede hacer esto' })); return null; }
  return u;
}

module.exports = { hashear, verificar, tokenDe, cookieSesion, usuarios, publico, usuarioActual, exigir, COOKIE, secretoDefault: !process.env.CARDIAN_SECRET };

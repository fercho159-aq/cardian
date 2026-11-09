// Ayudas para las funciones de Vercel: cuerpo JSON, query, cookies y respuestas.
// Los manejadores usan solo req/res de Node para que también corran en el servidor local.
const crypto = require('crypto');

async function cuerpo(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
    return req.body;
  }
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function query(req) {
  const u = new URL(req.url, 'http://x');
  return Object.fromEntries(u.searchParams.entries());
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function json(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (headers) for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}
const ok = (res, obj, headers) => json(res, 200, obj, headers);
const error = (res, status, mensaje) => json(res, status, { error: mensaje });
const id = (n = 10) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const ahora = () => new Date().toISOString();
// Teléfono mexicano a 10 dígitos (quita +52, 521, espacios).
function tel10(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d.length === 10 ? d : '';
}

// Envoltura de un manejador: los errores salen como JSON 500 legible.
function seguro(fn) { return async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: e.message || 'Error del servidor' }); } }; }

module.exports = { cuerpo, query, cookies, json, ok, error, id, ahora, tel10, seguro };

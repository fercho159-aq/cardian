// Cliente HTTP al servidor de WhatsApp de MAW (maw-whatsapp-server).
// El servidor expone una sesión de Baileys por cuenta y una API protegida con X-Service-Token.
// Cardian solo lee chats/mensajes y manda mensajes: todo lo pesado (QR, sesión, media, Postgres)
// vive en el VPS. Si WA_SERVICE_TOKEN está vacío, waEnabled es false y la bandeja queda apagada.
//
// Variables en Vercel:
//   WA_API_URL          URL pública del servicio (ej. https://whats.appsoluciones.duckdns.org)
//   WA_SERVICE_TOKEN    token del servicio (mínimo 32 chars)
//   WA_ACCOUNT_ID       id numérico de la cuenta Cardian en ese servidor (ej. "8")
//   WA_ACT_AS           usuario del servicio en cuyo nombre actuamos (por defecto "admin")

const URL_ = (process.env.WA_API_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.WA_SERVICE_TOKEN || '';
const ACCOUNT = String(process.env.WA_ACCOUNT_ID || '').trim();
const ACT_AS = process.env.WA_ACT_AS || 'admin';

const waEnabled = Boolean(URL_ && TOKEN.length >= 32 && ACCOUNT);

function sinConfig() {
  const falta = [];
  if (!URL_) falta.push('WA_API_URL');
  if (TOKEN.length < 32) falta.push('WA_SERVICE_TOKEN');
  if (!ACCOUNT) falta.push('WA_ACCOUNT_ID');
  throw new Error('WhatsApp no configurado: faltan ' + falta.join(', '));
}

async function llamar(path, opts = {}) {
  if (!waEnabled) sinConfig();
  const timeoutMs = opts.timeoutMs || 8000;
  const r = await fetch(URL_ + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': TOKEN, 'X-Act-As': ACT_AS, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
  if (!r.ok) {
    const det = (j && j.error) || (typeof j === 'string' && j.slice(0, 200)) || ('HTTP ' + r.status);
    const err = new Error('WA ' + r.status + ': ' + det);
    err.status = r.status;
    throw err;
  }
  return j;
}

const q = (o) => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

// ───────── API ─────────

// Metadatos de las cuentas visibles para el usuario ACT_AS.
async function cuentas() { return llamar('/api/accounts'); }

// La cuenta de Cardian: estado de conexión, teléfono, label. null si no se encuentra.
async function miCuenta() {
  const lista = await cuentas();
  return lista.find(c => String(c.account) === ACCOUNT) || null;
}

// Lista de chats (bandeja). Acepta offset/limit/q/archived para paginación y búsqueda.
async function chats({ limit = 200, offset = 0, q: busca = '', archivados = false } = {}) {
  const qs = q({ limit, offset, q: busca, archived: archivados ? 1 : undefined });
  return llamar(`/api/accounts/${encodeURIComponent(ACCOUNT)}/chats${qs ? '?' + qs : ''}`);
}

// Hilo de mensajes de un chat (jid). Ordenados del más viejo al más reciente.
async function mensajes(jid, { limit = 50 } = {}) {
  return llamar(`/api/accounts/${encodeURIComponent(ACCOUNT)}/chats/${encodeURIComponent(jid)}/messages?limit=${limit}`);
}

// Envía un mensaje de texto al chat. Devuelve { id } con el waId del mensaje enviado.
async function enviar(jid, texto) {
  const body = String(texto || '').trim();
  if (!jid || !body) throw new Error('Faltan jid o texto');
  return llamar(`/api/accounts/${encodeURIComponent(ACCOUNT)}/send`, { method: 'POST', body: { jid, text: body.slice(0, 4000) } });
}

// URL pública del avatar (la pintamos desde el navegador; el servidor sirve PNG/JPG).
function avatarUrl(jid) { return `${URL_}/api/accounts/${encodeURIComponent(ACCOUNT)}/avatar/${encodeURIComponent(jid)}`; }

// De un jid de WhatsApp a 10 dígitos mexicanos (quita @s.whatsapp.net / @c.us, 52, 521).
function telDeJid(jid) {
  const s = String(jid || '').split('@')[0].replace(/\D/g, '');
  let d = s;
  if (d.startsWith('521') && d.length === 13) d = d.slice(3);
  else if (d.startsWith('52') && d.length === 12) d = d.slice(2);
  return d.length === 10 ? d : '';
}

// A la inversa: tel10 → jid de WhatsApp móvil (México: lada 52, sin el 1).
// El servidor normaliza el formato por su cuenta cuando enviamos.
function jidDeTel(tel10) {
  const d = String(tel10 || '').replace(/\D/g, '');
  if (d.length !== 10) return '';
  return '52' + d + '@s.whatsapp.net';
}

module.exports = { waEnabled, cuentas, miCuenta, chats, mensajes, enviar, avatarUrl, telDeJid, jidDeTel, ACCOUNT, ACT_AS, URL_ };

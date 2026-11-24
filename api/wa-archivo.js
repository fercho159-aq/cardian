// Adjuntos de WhatsApp (documentos, fotos, videos) desde la bandeja del sistema.
// POST /api/wa-archivo?accion=boleto            { jid }  → { url } para subir directo al servidor WA
// POST /api/wa-archivo?accion=enviar&jid=…&nombre=…&tipo=…&caption=…  (cuerpo = el archivo como application/octet-stream, máx. ~4 MB)
// POST /api/wa-archivo?accion=registro          { jid, nombre } → deja huella en el lead tras una subida directa
// Permisos: los mismos que /api/wa-send (si el chat tiene lead, solo su vendedor o un admin).
const A = require('./_lib/auth');
const store = require('./_lib/store');
const wa = require('./_lib/wa');
const { ok, error, cuerpo, query, seguro, ahora } = require('./_lib/http');

const MAX = 4 * 1024 * 1024;

function leerBinario(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const partes = []; let total = 0;
    req.on('data', c => { total += c.length; if (total > MAX + 1024) { reject(new Error('grande')); req.destroy(); } else partes.push(c); });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

async function permiso(u, jid) {
  const tel10 = wa.telDeJid(jid);
  const leads = await store.get('leads', []);
  const lead = tel10 ? leads.find(l => l.tel === tel10) : null;
  if (lead && u.rol !== 'admin' && u.rol !== 'supervisor' && lead.vendedorId && lead.vendedorId !== u.id) return { error: 'Ese chat lo lleva otro vendedor' };
  return { lead };
}

async function huella(lead, u, nombre) {
  if (!lead) return;
  await store.actualizar('leads', lista => {
    const L = lista.find(x => x.id === lead.id); if (!L) return;
    (L.historial = L.historial || []).push({ cuando: ahora(), quien: u.nombre, que: 'Mandó archivo por WhatsApp: ' + String(nombre || 'archivo').slice(0, 120) });
    L.ultimoMensaje = { cuando: ahora(), texto: '📎 ' + String(nombre || 'archivo').slice(0, 200), from: 'me' };
    if (L.estado === 'nuevo') L.estado = 'contactado';
  });
}

module.exports = seguro(async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  if (!wa.waEnabled) return error(res, 400, 'WhatsApp no configurado');
  const q = query(req);

  if (q.accion === 'enviar') {
    const jid = String(q.jid || '').trim(); if (!jid) return error(res, 400, 'Falta jid');
    const p = await permiso(u, jid); if (p.error) return error(res, 403, p.error);
    let buffer;
    try { buffer = await leerBinario(req); } catch (e) { return error(res, 413, 'El archivo pesa más de 4 MB'); }
    if (!buffer || !buffer.length) return error(res, 400, 'El archivo está vacío');
    if (buffer.length > MAX) return error(res, 413, 'El archivo pesa más de 4 MB');
    const nombre = String(q.nombre || 'archivo').slice(0, 120);
    try { await wa.enviarArchivo(jid, { buffer, mimetype: String(q.tipo || 'application/octet-stream').slice(0, 100), nombre, caption: q.caption ? String(q.caption).slice(0, 1000) : '' }); }
    catch (e) { return error(res, 502, 'WhatsApp no aceptó el archivo: ' + e.message); }
    await huella(p.lead, u, nombre);
    return ok(res, { ok: true });
  }

  const b = await cuerpo(req);
  const jid = String(b.jid || '').trim(); if (!jid) return error(res, 400, 'Falta jid');
  const p = await permiso(u, jid); if (p.error) return error(res, 403, p.error);
  if (q.accion === 'boleto') {
    try { return ok(res, await wa.boletoSubida(jid)); }
    catch (e) { return error(res, 502, 'No se pudo preparar la subida: ' + e.message); }
  }
  if (q.accion === 'registro') { await huella(p.lead, u, b.nombre); return ok(res, { ok: true }); }
  return error(res, 400, 'Acción desconocida');
});

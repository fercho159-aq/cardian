// GET /api/wa-messages?jid=…[&limit=50]  → hilo de mensajes de un chat de WhatsApp.
// Permisos: si el chat tiene lead, solo el vendedor asignado o admin lo ve. Si no hay lead
// (chat suelto), solo admin. Así un vendedor nunca abre un chat que no le toca.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const wa = require('./_lib/wa');
const { ok, error, query, seguro } = require('./_lib/http');

module.exports = seguro(async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method !== 'GET') return error(res, 405, 'Método no permitido');
  if (!wa.waEnabled) return error(res, 400, 'WhatsApp no configurado');

  const q = query(req);
  const jid = String(q.jid || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
  if (!jid) return error(res, 400, 'Falta jid');

  const tel10 = wa.telDeJid(jid);
  const esAdmin = u.rol === 'admin' || u.rol === 'supervisor'; // el admin de atención ve todos los chats
  if (!esAdmin) {
    const leads = await store.get('leads', []);
    const lead = tel10 ? leads.find(l => l.tel === tel10) : null;
    if (!lead || lead.vendedorId !== u.id) return error(res, 403, 'Ese chat es de otro vendedor');
  }

  try {
    const mensajes = await wa.mensajes(jid, { limit });
    const lista = (mensajes || []).map(m => ({
      id: m.id,
      fromMe: !!m.from_me || m.fromMe === true || m.from === 'me',
      remitente: m.sender_name || null,
      texto: m.text || m.body || '',
      hora: m.ts || m.hora || null,
      status: m.status || null,
      tipo: m.media_type || null,
      borrado: !!m.deleted,
    })).filter(m => !m.borrado);
    return ok(res, { jid, mensajes: lista });
  } catch (e) {
    return error(res, 502, 'No se pudo leer el chat: ' + e.message);
  }
});

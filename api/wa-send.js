// POST /api/wa-send  { jid, texto }  → envía un mensaje al chat a través del servidor WA.
// Permisos: vendedor asignado o admin. Si el jid no tiene lead aún, cualquier vendedor puede
// escribir (es un chat nuevo); el admin ve todo. Al enviar deja historial en el lead si existe.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const wa = require('./_lib/wa');
const { ok, error, cuerpo, seguro, ahora } = require('./_lib/http');
const B = require('./_lib/bitacora');

module.exports = seguro(async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  if (!wa.waEnabled) return error(res, 400, 'WhatsApp no configurado');

  const b = await cuerpo(req);
  const jid = String(b.jid || '').trim();
  const texto = String(b.texto || '').trim();
  if (!jid) return error(res, 400, 'Falta jid');
  if (!texto) return error(res, 400, 'El mensaje está vacío');
  if (texto.length > 4000) return error(res, 400, 'Máximo 4000 caracteres por mensaje');

  // Permiso: el vendedor escribe solo en los chats de sus leads; admin y admin de atención, en todos.
  const leads = await store.get('leads', []);
  const lead = wa.leadDeChat(leads, jid);
  if (!wa.puedeAtender(u, lead)) return error(res, 403, lead ? 'Ese chat lo lleva otro vendedor' : 'Ese chat no está asignado a ti. Pídele al administrador que te lo asigne.');

  let waId = null;
  try {
    const r = await wa.enviar(jid, texto);
    waId = r && (r.id || (r.messages && r.messages[0] && r.messages[0].id)) || null;
  } catch (e) {
    return error(res, 502, 'WhatsApp no aceptó el mensaje: ' + e.message);
  }

  // Si hay lead, dejar huella: historial, último mensaje y pasar de "nuevo" a "contactado".
  if (lead) {
    await store.actualizar('leads', lista => {
      const L = lista.find(x => x.id === lead.id);
      if (!L) return;
      L.historial = L.historial || [];
      L.historial.push({ cuando: ahora(), quien: u.nombre, que: 'Escribió por WhatsApp: ' + texto.slice(0, 160) });
      L.ultimoMensaje = { cuando: ahora(), texto: texto.slice(0, 400), from: 'me' };
      if (L.estado === 'nuevo') L.estado = 'contactado';
    });
  }

  const cliente = (lead && (lead.nombre || lead.tel)) || String(b.nombre || '').slice(0, 60) || jid;
  await B.anotar(u, 'WhatsApp', 'Le escribió a ' + cliente + ': «' + texto.slice(0, 300) + '»', jid);
  return ok(res, { ok: true, waId });
});

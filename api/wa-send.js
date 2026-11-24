// POST /api/wa-send  { jid, texto }  → envía un mensaje al chat a través del servidor WA.
// Permisos: vendedor asignado o admin. Si el jid no tiene lead aún, cualquier vendedor puede
// escribir (es un chat nuevo); el admin ve todo. Al enviar deja historial en el lead si existe.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const wa = require('./_lib/wa');
const { ok, error, cuerpo, seguro, ahora } = require('./_lib/http');

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

  const esAdmin = u.rol === 'admin' || u.rol === 'supervisor'; // el admin de atención ve todos los chats
  const tel10 = wa.telDeJid(jid);

  // Permiso: si hay lead, solo su vendedor o admin. Sin lead, cualquier usuario (es un chat nuevo).
  const leads = await store.get('leads', []);
  const lead = tel10 ? leads.find(l => l.tel === tel10) : null;
  if (lead && !esAdmin && lead.vendedorId && lead.vendedorId !== u.id) {
    return error(res, 403, 'Ese chat lo lleva otro vendedor');
  }

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

  return ok(res, { ok: true, waId });
});

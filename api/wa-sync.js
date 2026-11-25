// POST /api/wa-sync  → sincroniza los chats de WhatsApp con los leads del sistema.
// Para cada chat que no sea lead todavía (por tel10) crea uno nuevo con asignación «al azar parejo»,
// marcado como origen 'whatsapp'. Ignora grupos y broadcasts. Idempotente: no duplica.
// Throttled: solo corre si pasaron >60 s desde la última sync (el estado del throttle vive en KV).
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const wa = require('./_lib/wa');
const { ok, error, seguro, ahora } = require('./_lib/http');

const CADA_MS = 60 * 1000;

module.exports = seguro(async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  if (!wa.waEnabled) return ok(res, { ok: true, saltado: 'wa_deshabilitado', creados: 0 });

  const ultimo = await store.get('wa:sync', 0);
  if (Date.now() - (+ultimo || 0) < CADA_MS) return ok(res, { ok: true, saltado: 'throttle', creados: 0 });
  await store.set('wa:sync', Date.now());

  let lista;
  try { lista = await wa.chats({ limit: 300 }); } catch (e) { return ok(res, { ok: false, saltado: 'wa_error', error: e.message, creados: 0 }); }

  const usuarios = await A.usuarios();
  let creados = 0, actualizados = 0;

  await store.actualizar('leads', leads => {
    const porTel = new Map(), porJid = new Map();
    for (const l of leads) { if (l.tel) porTel.set(l.tel, l); if (l.waJid) porJid.set(l.waJid, l); }
    const RECIENTE = Date.now() / 1000 - 3 * 86400;

    for (const c of lista) {
      const jid = c.jid || c.id || '';
      if (/@g\.us$/.test(jid) || /^status@/i.test(jid)) continue;
      const tel = wa.telDeJid(c.phone_jid || jid);
      // WhatsApp a veces no da el teléfono (chat …@lid): el lead se liga por el jid. Para no llenar la lista con
      // conversaciones viejas, un chat sin teléfono solo se da de alta solo si tuvo mensajes en los últimos 3 días.
      const conocido = porJid.get(jid) || (tel ? porTel.get(tel) : null) || null;
      if (!tel && !conocido && !(c.last_ts && c.last_ts >= RECIENTE)) continue;

      const ultimoMsg = c.last_text ? { cuando: c.last_ts ? new Date(c.last_ts * 1000).toISOString() : ahora(), texto: String(c.last_text).slice(0, 400), from: 'cliente' } : null;
      const nombre = String(c.name || '').trim();

      const abierto = conocido;
      if (abierto && !['compro', 'no-compro'].includes(abierto.estado)) {
        let cambio = false;
        if (!abierto.nombre && nombre) { abierto.nombre = nombre; cambio = true; }
        if (ultimoMsg && (!abierto.ultimoMensaje || abierto.ultimoMensaje.cuando !== ultimoMsg.cuando)) { abierto.ultimoMensaje = ultimoMsg; cambio = true; }
        if (abierto.waJid !== jid) { abierto.waJid = jid; porJid.set(jid, abierto); cambio = true; }
        if (!abierto.tel && tel) { abierto.tel = tel; porTel.set(tel, abierto); cambio = true; }
        if (cambio) actualizados++;
        continue;
      }

      // Si el cliente ya compró antes, asignar a su vendedor anterior (fidelización).
      const anterior = conocido;
      const vendPrev = anterior && anterior.estado === 'compro' ? usuarios.find(x => x.id === anterior.vendedorId && x.activo) : null;
      const vend = vendPrev || M.elegirVendedor(usuarios, '', leads);
      const lead = M.nuevoLead({ nombre, tel, mensaje: c.last_text || '', origen: 'whatsapp', producto: '' }, vend, 'WhatsApp');
      lead.waJid = jid;
      if (c.last_ts) lead.creado = new Date(c.last_ts * 1000).toISOString();
      if (ultimoMsg) lead.ultimoMensaje = ultimoMsg;
      leads.unshift(lead);
      if (tel) porTel.set(tel, lead);
      porJid.set(jid, lead);
      creados++;
    }
  });

  return ok(res, { ok: true, creados, actualizados });
});

// GET /api/wa-chats → bandeja de WhatsApp de la cuenta Cardian, cruzada con los leads del sistema.
// Devuelve: { account, estado, chats:[{jid, nombre, ultimo, hora, noLeidos, tel10, lead:{...}}], waEnabled }
// Cada chat trae su lead asociado (por tel10) si existe, con vendedor y estado — así la UI pinta
// las etiquetas y permite reasignar en el acto.
// Permisos: vendedor ve solo los chats de SUS leads; admin ve todo.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const wa = require('./_lib/wa');
const { ok, error, seguro } = require('./_lib/http');

module.exports = seguro(async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method !== 'GET') return error(res, 405, 'Método no permitido');

  if (!wa.waEnabled) return ok(res, { waEnabled: false, account: null, estado: null, chats: [] });

  const [cuenta, lista] = await Promise.all([
    wa.miCuenta().catch(() => null),
    wa.chats({ limit: 300 }).catch(e => { console.warn('wa.chats:', e.message); return []; }),
  ]);

  const leads = await store.get('leads', []);
  const porTel = new Map();
  for (const l of leads) if (l.tel) porTel.set(l.tel, l);

  const esAdmin = u.rol === 'admin';
  const out = [];
  for (const c of lista) {
    const jid = c.jid || c.id || '';
    // Omitir grupos (@g.us) y broadcasts — WhatsApp Business solo chatea con clientes individuales.
    if (/@g\.us$/.test(jid) || /^status@/i.test(jid)) continue;
    const tel10 = wa.telDeJid(c.phone_jid || jid);
    const lead = tel10 ? porTel.get(tel10) || null : null;
    if (!esAdmin && (!lead || lead.vendedorId !== u.id)) continue;
    out.push({
      jid,
      phoneJid: c.phone_jid || null,
      nombre: c.name || c.nombre || tel10 || jid,
      ultimo: c.last_text || c.ultimo || null,
      hora: c.last_ts || c.hora || null,
      noLeidos: c.unread || 0,
      tel10,
      anuncio: c.first_ad_title || null,
      lead: lead ? { id: lead.id, estado: lead.estado, vendedorId: lead.vendedorId, origen: lead.origen, producto: lead.producto || '' } : null,
    });
  }
  // Más recientes primero.
  out.sort((a, b) => (b.hora || 0) - (a.hora || 0));

  return ok(res, {
    waEnabled: true,
    account: cuenta ? { id: cuenta.account, label: cuenta.label, estado: cuenta.status, telefono: cuenta.phone, puedeEnviar: cuenta.can_send } : null,
    chats: out,
  });
});

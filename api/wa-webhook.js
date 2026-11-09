// Receptor de WhatsApp (API oficial de Meta / Cloud API, también la reenvían los proveedores oficiales).
// Cada mensaje que un cliente manda al WhatsApp Business del negocio crea (o actualiza) su lead y
// lo asigna al azar parejo a un vendedor. No responde nada al cliente: el equipo sigue contestando
// desde la app de WhatsApp Business (coexistencia).
//
// Variables en Vercel:
//   WA_VERIFY_TOKEN  palabra que tú inventas y pegas también en Meta al registrar el webhook
//   WA_APP_SECRET    «Clave secreta de la app» de Meta (opcional pero recomendado: valida la firma)
//
// GET  /api/wa-webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…  → verificación de Meta
// POST /api/wa-webhook  → mensajes entrantes
const crypto = require('crypto');
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const { query, ok, error, tel10, seguro, ahora } = require('./_lib/http');

function crudo(req) {
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  if (req.body && typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));
  return new Promise(resolve => { let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); req.on('error', () => resolve('')); });
}
function firmaOk(req, raw) {
  const secret = process.env.WA_APP_SECRET; if (!secret) return true;
  const sig = String(req.headers['x-hub-signature-256'] || '');
  const esperado = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return sig.length === esperado.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
}
// Texto legible de cualquier tipo de mensaje
function textoDe(m) {
  if (m.type === 'text') return m.text && m.text.body || '';
  if (m.type === 'button') return m.button && m.button.text || '';
  if (m.type === 'interactive') { const i = m.interactive || {}; return (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || ''; }
  if (m.type === 'image') return '[Foto]' + (m.image && m.image.caption ? ' ' + m.image.caption : '');
  if (m.type === 'audio') return '[Audio]';
  if (m.type === 'video') return '[Video]';
  if (m.type === 'document') return '[Documento]';
  if (m.type === 'location') return '[Ubicación]';
  if (m.type === 'sticker') return '[Sticker]';
  return '[' + (m.type || 'mensaje') + ']';
}

module.exports = seguro(async (req, res) => {
  if (req.method === 'GET') {
    const q = query(req);
    if (q['hub.mode'] === 'subscribe') {
      if (process.env.WA_VERIFY_TOKEN && q['hub.verify_token'] === process.env.WA_VERIFY_TOKEN) { res.statusCode = 200; res.setHeader('Content-Type', 'text/plain'); return res.end(q['hub.challenge'] || ''); }
      return error(res, 403, 'Token de verificación incorrecto');
    }
    return ok(res, { ok: true, configurado: !!process.env.WA_VERIFY_TOKEN, firma: !!process.env.WA_APP_SECRET });
  }
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const raw = await crudo(req);
  if (!firmaOk(req, raw)) return error(res, 401, 'Firma inválida');
  let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { return ok(res, { ignorado: 'json' }); }

  // Junta los mensajes entrantes de todos los cambios (Meta puede agrupar varios)
  const entrantes = [];
  for (const en of b.entry || []) for (const ch of en.changes || []) {
    const v = ch.value || {}; if (ch.field && ch.field !== 'messages') continue;
    const nombres = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile && c.profile.name || '']));
    for (const m of v.messages || []) entrantes.push({ tel: tel10(m.from), nombre: nombres[m.from] || '', texto: textoDe(m).slice(0, 400), cuando: m.timestamp ? new Date(+m.timestamp * 1000).toISOString() : ahora(), id: m.id });
  }
  if (!entrantes.length) return ok(res, { ok: true, mensajes: 0 });

  const usuarios = await A.usuarios();
  let creados = 0, actualizados = 0;
  await store.actualizar('leads', leads => {
    for (const e of entrantes) {
      if (!e.tel) continue;
      const abierto = leads.find(l => l.tel === e.tel && !['compro', 'no-compro'].includes(l.estado));
      if (abierto) {
        if ((abierto.waIds || []).includes(e.id)) continue;
        abierto.waIds = (abierto.waIds || []).slice(-20).concat(e.id);
        abierto.ultimoMensaje = { cuando: e.cuando, texto: e.texto };
        if (!abierto.nombre && e.nombre) abierto.nombre = e.nombre;
        abierto.historial.push({ cuando: e.cuando, quien: 'WhatsApp', que: 'Escribió: ' + e.texto.slice(0, 160) });
        actualizados++;
      } else {
        const anterior = leads.find(l => l.tel === e.tel);
        const vend = anterior && anterior.estado === 'compro' ? usuarios.find(u => u.id === anterior.vendedorId && u.activo) : null; // cliente que ya compró: con su mismo vendedor
        const lead = M.nuevoLead({ nombre: e.nombre, tel: e.tel, mensaje: e.texto, origen: 'whatsapp' }, vend || M.elegirVendedor(usuarios, '', leads), 'WhatsApp');
        lead.creado = e.cuando; lead.waIds = [e.id]; lead.ultimoMensaje = { cuando: e.cuando, texto: e.texto };
        leads.unshift(lead); creados++;
      }
    }
  });
  return ok(res, { ok: true, creados, actualizados });
});

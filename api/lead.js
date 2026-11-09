// Público: el sitio registra un contacto (lead) cuando alguien pide informes por WhatsApp.
// Se asigna al azar a un vendedor activo y se devuelve a qué número abrir el chat.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const { cuerpo, ok, error, tel10 } = require('./_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req);
  const tel = tel10(b.tel);
  if (!tel) return error(res, 400, 'Escribe tu WhatsApp a 10 dígitos');
  if (String(b.nombre || '').trim().length < 2) return error(res, 400, 'Escribe tu nombre');
  const usuarios = await A.usuarios();
  const leads = await store.get('leads', []);
  const previo = leads.find(l => l.tel === tel && !['compro', 'no-compro'].includes(l.estado));
  let lead;
  if (previo) {
    // mismo cliente que vuelve a escribir: se queda con su vendedor y se anota el nuevo interés
    previo.historial.push({ cuando: new Date().toISOString(), quien: 'Sitio web', que: 'Volvió a pedir informes' + (b.producto ? ' · ' + String(b.producto).slice(0, 80) : '') });
    if (b.producto) previo.producto = String(b.producto).slice(0, 80);
    lead = previo;
  } else {
    lead = M.nuevoLead({ ...b, tel, origen: 'sitio' }, M.elegirVendedor(usuarios), 'Sitio web');
    leads.unshift(lead);
  }
  await store.set('leads', leads);
  const vend = usuarios.find(x => x.id === lead.vendedorId);
  const ajustes = await store.get('ajustes', {});
  const wa = (vend && vend.whatsapp) ? '52' + vend.whatsapp : (ajustes.waNegocio ? '52' + tel10(ajustes.waNegocio) : M.D().brand.wa);
  return ok(res, { id: lead.id, vendedor: vend ? vend.nombre.split(' ')[0] : null, wa });
};

// Mercado Pago (Checkout Pro). Usa MP_ACCESS_TOKEN (producción o TEST-…) desde las variables
// de Vercel. Sin token, el sitio funciona igual pero sin el botón de pago en línea.
const crypto = require('crypto');
const store = require('./store');
const M = require('./modelo');

const TOKEN = process.env.MP_ACCESS_TOKEN || '';
const configurado = () => !!TOKEN;

async function api(ruta, opts = {}) {
  const r = await fetch('https://api.mercadopago.com' + ruta, { ...opts, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status));
  return j;
}
function origen(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'cardianmuebles.com';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https');
  return proto + '://' + host;
}
// Crea la preferencia de pago de una venta. El monto sale del total ya calculado en el servidor.
async function crearPreferencia(v, req) {
  const base = origen(req);
  const k = M.llaveTicket(v.folio);
  const items = v.lineas.map(l => ({ id: l.id || 'manual', title: l.nombre + (l.colorNombre ? ' · ' + l.colorNombre : ''), quantity: l.qty, unit_price: l.unit, currency_id: 'MXN' }));
  if (v.costoEnvio) items.push({ id: 'envio', title: 'Envío y armado', quantity: 1, unit_price: v.costoEnvio, currency_id: 'MXN' });
  if (v.descuento) items.push({ id: 'descuento', title: 'Descuento', quantity: 1, unit_price: -v.descuento, currency_id: 'MXN' });
  const body = {
    items, external_reference: v.folio, statement_descriptor: 'CARDIAN MUEBLES',
    payer: { name: v.cliente.nombre, email: v.cliente.email || undefined, phone: v.cliente.tel ? { area_code: '52', number: v.cliente.tel } : undefined },
    back_urls: { success: `${base}/gracias?f=${v.folio}&k=${k}&mp=ok`, pending: `${base}/gracias?f=${v.folio}&k=${k}&mp=pendiente`, failure: `${base}/gracias?f=${v.folio}&k=${k}&mp=error` },
    auto_return: 'approved', notification_url: base.startsWith('https') ? `${base}/api/mp-webhook` : undefined,
    payment_methods: { installments: 12 }, metadata: { folio: v.folio }
  };
  return api('/checkout/preferences', { method: 'POST', body: JSON.stringify(body) });
}
async function pago(idPago) { return api('/v1/payments/' + idPago); }
// Pagos de los últimos N días en la cuenta de Mercado Pago.
async function pagosRecientes(dias = 30) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const j = await api(`/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=${encodeURIComponent(desde)}&end_date=NOW&limit=100`);
  return j.results || [];
}
// Aplica un pago de MP a la venta que le corresponde (por external_reference = folio).
// Devuelve la venta afectada o null si el pago no trae folio / no está aprobado.
async function aplicarPago(p) {
  if (!p || p.status !== 'approved') return null;
  const folio = p.external_reference || (p.metadata && p.metadata.folio);
  if (!folio) return null;
  let afectada = null;
  await store.actualizar('ventas', lista => {
    const v = lista.find(x => x.folio === folio); if (!v) return;
    if ((v.pagos || []).some(x => x.mpId === String(p.id))) { afectada = v; return; }
    v.pagos.push({ id: crypto.randomBytes(4).toString('hex'), mpId: String(p.id), cuando: p.date_approved || p.date_created, monto: Math.round(p.transaction_amount), metodo: 'mercado-pago', ref: (p.payment_method_id || '') + (p.installments > 1 ? ' · ' + p.installments + ' meses' : ''), quien: 'Mercado Pago' });
    v.estado = M.estadoPorPago(v);
    v.mp = { ...(v.mp || {}), ultimoPago: String(p.id), estado: p.status };
    (v.historial = v.historial || []).push({ cuando: new Date().toISOString(), quien: 'Mercado Pago', que: 'Pago aprobado $' + Math.round(p.transaction_amount).toLocaleString('es-MX') });
    afectada = v;
  });
  return afectada;
}
// Valida la firma x-signature del webhook (si hay MP_WEBHOOK_SECRET configurado).
function firmaValida(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET; if (!secret) return true;
  const sig = String(req.headers['x-signature'] || ''); const reqId = String(req.headers['x-request-id'] || '');
  const ts = (sig.match(/ts=([^,]+)/) || [])[1]; const v1 = (sig.match(/v1=([^,]+)/) || [])[1];
  if (!ts || !v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${ts};`;
  const h = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return h.length === v1.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(v1));
}

module.exports = { configurado, crearPreferencia, pago, pagosRecientes, aplicarPago, firmaValida };

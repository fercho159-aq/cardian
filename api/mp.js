// Mercado Pago desde el sistema: estado de la conexión, enlace de pago de una venta,
// verificar un pago al regresar del checkout y sincronizar los pagos recientes de la cuenta.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const MP = require('./_lib/mp');
const { cuerpo, query, ok, error, seguro } = require('./_lib/http');

module.exports = seguro(async (req, res) => {
  const q = query(req);
  // Público: al regresar de MP (/gracias) se revisa el pago por folio + llave del ticket.
  if (req.method === 'GET' && q.f && q.k) {
    if (M.llaveTicket(q.f) !== q.k) return error(res, 403, 'Llave inválida');
    if (!MP.configurado()) return ok(res, { configurado: false });
    try {
      if (q.payment_id) { const p = await MP.pago(q.payment_id); if ((p.external_reference || '') === q.f) await MP.aplicarPago(p); }
      const v = (await store.get('ventas', [])).find(x => x.folio === q.f);
      return ok(res, { configurado: true, estado: v ? v.estado : null, pagado: v ? M.pagado(v) : 0, total: v ? v.total : 0 });
    } catch (e) { return error(res, 500, e.message); }
  }
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method === 'GET') return ok(res, { configurado: MP.configurado(), prueba: (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-'), webhook: !!process.env.MP_WEBHOOK_SECRET });
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req);
  if (!MP.configurado()) return error(res, 400, 'Mercado Pago no está conectado: falta MP_ACCESS_TOKEN en Vercel');

  if (b.accion === 'enlace') {
    const ventas = await store.get('ventas', []); const v = ventas.find(x => x.folio === b.folio);
    if (!v) return error(res, 404, 'No existe esa venta');
    if (u.rol !== 'admin' && v.vendedorId !== u.id) return error(res, 403, 'Esta venta es de otro vendedor');
    if (M.saldo(v) <= 0) return error(res, 400, 'Esta venta ya está pagada');
    try {
      // enlace por el saldo pendiente
      const parcial = { ...v, lineas: [{ id: null, nombre: 'Pedido ' + v.folio + (M.pagado(v) ? ' (saldo)' : ''), colorNombre: '', qty: 1, unit: M.saldo(v) }], costoEnvio: 0, descuento: 0 };
      const pref = await MP.crearPreferencia(parcial, req);
      v.mp = { ...(v.mp || {}), preferenciaId: pref.id, enlace: pref.init_point, creado: new Date().toISOString() };
      (v.historial = v.historial || []).push({ cuando: new Date().toISOString(), quien: u.nombre, que: 'Generó enlace de pago de Mercado Pago' });
      await store.set('ventas', ventas);
      return ok(res, { url: pref.init_point });
    } catch (e) { return error(res, 500, 'Mercado Pago: ' + e.message); }
  }
  if (b.accion === 'sincronizar') {
    if (u.rol !== 'admin') return error(res, 403, 'Solo el administrador sincroniza');
    try {
      const pagos = await MP.pagosRecientes(+b.dias || 30);
      const ventas = await store.get('ventas', []);
      let aplicados = 0; const sueltos = [];
      for (const p of pagos) {
        if (p.status !== 'approved') continue;
        const folio = p.external_reference || (p.metadata && p.metadata.folio);
        const v = folio && ventas.find(x => x.folio === folio);
        if (v) { if (!(v.pagos || []).some(x => x.mpId === String(p.id))) { await MP.aplicarPago(p); aplicados++; } }
        else sueltos.push({ id: String(p.id), cuando: p.date_approved || p.date_created, monto: Math.round(p.transaction_amount), quien: (p.payer && (p.payer.email || (p.payer.first_name ? p.payer.first_name + ' ' + (p.payer.last_name || '') : ''))) || '', metodo: p.payment_method_id || '', descripcion: p.description || '' });
      }
      await store.set('mpSueltos', sueltos);
      return ok(res, { revisados: pagos.length, aplicados, sueltos });
    } catch (e) { return error(res, 500, 'Mercado Pago: ' + e.message); }
  }
  if (b.accion === 'ligar') {
    // liga un pago suelto de MP a una venta (p. ej. pagó con link manual sin folio)
    const sueltos = await store.get('mpSueltos', []); const p = sueltos.find(x => x.id === String(b.pagoId));
    if (!p) return error(res, 404, 'No está ese pago en la lista de sueltos');
    let venta = null;
    await store.actualizar('ventas', lista => { const v = lista.find(x => x.folio === b.folio); if (!v) return; if (v.pagos.some(x => x.mpId === p.id)) { venta = v; return; } v.pagos.push({ id: p.id.slice(-6), mpId: p.id, cuando: p.cuando, monto: p.monto, metodo: 'mercado-pago', ref: p.metodo, quien: u.nombre }); v.estado = M.estadoPorPago(v); v.historial.push({ cuando: new Date().toISOString(), quien: u.nombre, que: 'Ligó pago de Mercado Pago ' + p.id }); venta = v; });
    if (!venta) return error(res, 404, 'No existe esa venta');
    await store.set('mpSueltos', sueltos.filter(x => x.id !== p.id));
    return ok(res, { venta });
  }
  return error(res, 400, 'Acción desconocida');
});

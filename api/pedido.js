// Público: el checkout del sitio crea el pedido (venta origen «sitio») con el precio
// recalculado en el servidor y devuelve folio, llave del ticket y, si hay Mercado Pago, el enlace de pago.
const store = require('./_lib/store');
const A = require('./_lib/auth');
const M = require('./_lib/modelo');
const MP = require('./_lib/mp');
const { cuerpo, ok, error, tel10 } = require('./_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req);
  if (!Array.isArray(b.lineas) || !b.lineas.length) return error(res, 400, 'El carrito está vacío');
  if (!b.cliente || !tel10(b.cliente.tel) || !b.cliente.nombre) return error(res, 400, 'Faltan tus datos de contacto');
  const lineas = b.lineas.filter(l => l.id).map(l => ({ id: l.id, color: l.color, qty: l.qty }));
  if (!lineas.length) return error(res, 400, 'Carrito inválido');
  const envio = b.envio && b.envio.tipo === 'domicilio' ? { tipo: 'domicilio', estado: b.envio.estado, direccion: b.envio.direccion } : { tipo: 'bodega' };
  if (b.pago === 'spei') envio.descuento = Math.round(M.calcular(lineas, envio).sub * 0.05);
  const folio = await M.folioNuevo();
  // el pedido del sitio también se reparte al azar para que un vendedor le dé seguimiento
  const vend = M.elegirVendedor(await A.usuarios());
  const v = M.nuevaVenta({ folio, origen: 'sitio', vendedorId: vend ? vend.id : null, lineas, envio, cliente: b.cliente, notas: [b.pago ? 'Forma de pago elegida: ' + b.pago : '', b.notas || ''].filter(Boolean).join(' · '), factura: b.factura }, null);
  v.pagoElegido = ['mp', 'spei', 'cash'].includes(b.pago) ? b.pago : 'mp';
  await store.actualizar('ventas', l => { l.unshift(v); });
  const out = { folio, k: M.llaveTicket(folio), total: v.total };
  if (v.pagoElegido === 'mp' && MP.configurado()) {
    try { const pref = await MP.crearPreferencia(v, req); out.mpUrl = pref.init_point; await store.actualizar('ventas', l => { const x = l.find(y => y.folio === folio); if (x) x.mp = { preferenciaId: pref.id, creado: new Date().toISOString() }; }); }
    catch (e) { out.mpError = 'No se pudo abrir Mercado Pago: ' + e.message; }
  }
  return ok(res, out);
};

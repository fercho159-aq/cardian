// Reglas del negocio compartidas por las funciones: catálogo, precios, folios, ventas y leads.
const path = require('path');
const store = require('./store');
const { id, ahora, tel10 } = require('./http');

// El catálogo del sitio (assets/data.js) también sirve en el servidor: así el precio que se
// cobra siempre sale de la lista oficial y no de lo que mande el navegador.
function catalogo() {
  if (!global.window) global.window = {};
  if (!global.window.CARDIAN) require(path.join(process.cwd(), 'assets', 'data.js'));
  return global.window.CARDIAN;
}
const D = () => catalogo();

const ESTADOS_VENTA = ['pendiente', 'apartado', 'pagado', 'en-produccion', 'entregado', 'cancelado'];
// Etapas de entrega del pedido (aparte del estado de pago): lo que ve el cliente en su seguimiento.
const ETAPAS = ['recibido', 'fabricando', 'listo', 'en-camino', 'entregado'];
const ESTADOS_LEAD = ['nuevo', 'contactado', 'sin-respuesta', 'cotizado', 'compro', 'no-compro'];
const ORIGENES = ['sitio', 'mercado-pago', 'whatsapp', 'sucursal', 'telefono', 'otro'];

const precioUnitario = (p, color) => (p.price || 0) + (p.extras && color && p.extras[color] ? p.extras[color] : 0);

// Calcula las líneas y totales de una venta a partir de ids del catálogo (o de líneas libres
// para ventas manuales: {nombre, unit, qty}).
// opts.iva: el cliente pidió factura → se agrega el 16 % de IVA sobre (subtotal + envío − descuento).
const TASA_IVA = 0.16;
function calcular(lineasIn, envio, opts) {
  const d = D();
  const lineas = (lineasIn || []).map(l => {
    const p = l.id ? d.products.find(x => x.id === l.id) : null;
    const qty = Math.max(1, Math.min(99, parseInt(l.qty, 10) || 1));
    if (p) {
      const color = l.color && p.tapiz && p.tapiz.includes(l.color) ? l.color : null;
      return { id: p.id, nombre: p.name, color, colorNombre: color ? d.TAPIZ[color].name : '', qty, unit: precioUnitario(p, color), factor: p.factor || 1 };
    }
    return { id: null, nombre: String(l.nombre || 'Artículo').slice(0, 80), color: null, colorNombre: String(l.colorNombre || '').slice(0, 30), qty, unit: Math.max(0, Math.round(+l.unit || 0)), factor: 1 };
  }).filter(l => l.nombre);
  const sub = lineas.reduce((s, l) => s + l.unit * l.qty, 0);
  let costoEnvio = 0;
  if (envio && envio.tipo === 'domicilio' && envio.estado) {
    const base = d.rates[envio.estado];
    if (base) {
      // misma regla que el sitio: primera pieza al factor, las demás al 60 %
      const piezas = lineas.flatMap(l => Array(l.qty).fill(l.factor)).sort((a, b) => b - a);
      costoEnvio = Math.round(piezas.reduce((s, f, i) => s + base * f * (i ? 0.6 : 1), 0));
    }
  }
  if (envio && envio.costo !== undefined && envio.costo !== null && envio.costo !== '') costoEnvio = Math.max(0, Math.round(+envio.costo || 0));
  const descuento = Math.max(0, Math.round(+(envio && envio.descuento) || 0));
  const base = Math.max(0, sub + costoEnvio - descuento);
  const iva = opts && opts.iva ? Math.round(base * TASA_IVA) : 0;
  return { lineas, sub, envio: costoEnvio, descuento, iva, total: base + iva };
}

async function folioNuevo() {
  const n = await store.incr('folio', 1000);
  return 'CM-' + n;
}
function pagado(v) { return (v.pagos || []).reduce((s, p) => s + (+p.monto || 0), 0); }
function saldo(v) { return Math.max(0, (v.total || 0) - pagado(v)); }
function estadoPorPago(v) {
  if (v.estado === 'cancelado' || v.estado === 'entregado' || v.estado === 'en-produccion') return v.estado;
  const p = pagado(v);
  if (p <= 0) return 'pendiente';
  return p >= v.total ? 'pagado' : 'apartado';
}
// Llave pública del ticket: permite ver /ticket?f=CM-1001&k=… sin iniciar sesión.
function llaveTicket(folio) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', require('./secreto').SECRETO + '|ticket').update(folio).digest('base64url').slice(0, 12);
}

function nuevaVenta(datos, usuario) {
  const c = calcular(datos.lineas, datos.envio, { iva: !!datos.factura });
  const v = {
    folio: datos.folio, creado: ahora(), origen: ORIGENES.includes(datos.origen) ? datos.origen : 'otro',
    sucursal: String(datos.sucursal || '').slice(0, 60), vendedorId: datos.vendedorId || (usuario ? usuario.id : null),
    cliente: { nombre: String((datos.cliente && datos.cliente.nombre) || '').slice(0, 80), tel: tel10(datos.cliente && datos.cliente.tel), email: String((datos.cliente && datos.cliente.email) || '').slice(0, 100) },
    envio: { tipo: datos.envio && datos.envio.tipo === 'domicilio' ? 'domicilio' : 'bodega', estado: (datos.envio && datos.envio.estado) || '', direccion: String((datos.envio && datos.envio.direccion) || '').slice(0, 240) },
    lineas: c.lineas, sub: c.sub, costoEnvio: c.envio, descuento: c.descuento, iva: c.iva, total: c.total,
    etapa: 'recibido', etapas: [{ etapa: 'recibido', cuando: ahora() }], fechaEntrega: '',
    pagos: [], estado: 'pendiente', notas: String(datos.notas || '').slice(0, 500), factura: datos.factura ? { razon: String(datos.factura.razon || '').slice(0, 120), rfc: String(datos.factura.rfc || '').slice(0, 13) } : null,
    leadId: datos.leadId || null, mp: null, historial: [{ cuando: ahora(), quien: usuario ? usuario.nombre : 'Sitio web', que: 'Venta creada' }]
  };
  v.estado = estadoPorPago(v);
  return v;
}

// Reparto aleatorio entre vendedores activos que reciben leads (opcionalmente de una sucursal).
// «Al azar parejo»: entre los candidatos, solo concursan los que llevan menos leads asignados
// en los últimos 7 días, y de esos se escoge uno al azar. Así nadie se queda sin leads por mala suerte.
function elegirVendedor(usuarios, sucursal, leads) {
  let cand = usuarios.filter(u => u.activo && u.rol === 'vendedor' && u.recibeLeads !== false);
  if (sucursal) { const s = cand.filter(u => u.sucursal === sucursal); if (s.length) cand = s; }
  if (!cand.length) return null;
  if (leads && leads.length) {
    const desde = Date.now() - 7 * 864e5;
    const carga = id => leads.filter(l => l.vendedorId === id && new Date(l.creado) >= desde).length;
    const min = Math.min(...cand.map(u => carga(u.id)));
    cand = cand.filter(u => carga(u.id) === min);
  }
  return cand[Math.floor(Math.random() * cand.length)];
}
function nuevoLead(datos, vendedor, quien) {
  return {
    id: id(8), creado: ahora(), origen: ORIGENES.includes(datos.origen) ? datos.origen : 'whatsapp',
    nombre: String(datos.nombre || '').slice(0, 80), tel: tel10(datos.tel), mensaje: String(datos.mensaje || '').slice(0, 500),
    producto: String(datos.producto || '').slice(0, 80), sucursal: String(datos.sucursal || '').slice(0, 60),
    vendedorId: vendedor ? vendedor.id : null, estado: 'nuevo', notas: [], ventaFolio: null,
    historial: [{ cuando: ahora(), quien: quien || 'Sitio web', que: vendedor ? 'Lead creado y asignado a ' + vendedor.nombre : 'Lead creado, sin vendedor' }]
  };
}

module.exports = { D, calcular, folioNuevo, pagado, saldo, estadoPorPago, llaveTicket, nuevaVenta, elegirVendedor, nuevoLead, ESTADOS_VENTA, ESTADOS_LEAD, ETAPAS, ORIGENES };

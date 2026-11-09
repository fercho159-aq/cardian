// Datos del sistema (requiere sesión): ventas, leads, usuarios, sucursales y ajustes.
// GET  /api/datos?c=ventas|leads|usuarios|sucursales|ajustes|todo
// POST /api/datos?c=…  { accion, … }
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const { cuerpo, query, ok, error, id, ahora, tel10 } = require('./_lib/http');

const esAdmin = u => u.rol === 'admin';
const visiblesVentas = (lista, u) => esAdmin(u) ? lista : lista.filter(v => v.vendedorId === u.id);
const visiblesLeads = (lista, u) => esAdmin(u) ? lista : lista.filter(l => l.vendedorId === u.id);
const hist = (obj, quien, que) => { (obj.historial = obj.historial || []).push({ cuando: ahora(), quien, que }); };

module.exports = async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  const q = query(req); const c = q.c || 'todo';

  if (req.method === 'GET') {
    const out = {};
    const usuarios = await A.usuarios();
    if (c === 'ventas' || c === 'todo') out.ventas = visiblesVentas(await store.get('ventas', []), u);
    if (c === 'leads' || c === 'todo') out.leads = visiblesLeads(await store.get('leads', []), u);
    if (c === 'usuarios' || c === 'todo') out.usuarios = usuarios.map(x => esAdmin(u) ? A.publico(x) : { id: x.id, nombre: x.nombre, rol: x.rol, sucursal: x.sucursal, activo: x.activo });
    if (c === 'sucursales' || c === 'todo') out.sucursales = await store.get('sucursales', []);
    if (c === 'ajustes' || c === 'todo') out.ajustes = { almacen: store.modo(), secretoDefault: A.secretoDefault, mpConfigurado: !!process.env.MP_ACCESS_TOKEN, mpPrueba: !!(process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-'), mpWebhook: !!process.env.MP_WEBHOOK_SECRET, ...(await store.get('ajustes', {})) };
    out.yo = A.publico(u);
    out.catalogo = { productos: M.D().products.map(p => ({ id: p.id, nombre: p.name, precio: p.price || 0, cat: p.cat, tapiz: p.tapiz || [] })), tapiz: M.D().TAPIZ, estados: M.D().states, estadosVenta: M.ESTADOS_VENTA, estadosLead: M.ESTADOS_LEAD, origenes: M.ORIGENES };
    return ok(res, out);
  }
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req); const ac = b.accion;

  // ───── Ventas ─────
  if (c === 'ventas') {
    if (ac === 'crear') {
      if (!b.lineas || !b.lineas.length) return error(res, 400, 'Agrega al menos un artículo');
      const folio = await M.folioNuevo();
      const v = M.nuevaVenta({ ...b, folio, origen: b.origen || 'sucursal', vendedorId: esAdmin(u) && b.vendedorId ? b.vendedorId : u.id, sucursal: b.sucursal || u.sucursal }, u);
      if (b.pagoInicial && +b.pagoInicial.monto > 0) { v.pagos.push({ id: id(6), cuando: ahora(), monto: Math.round(+b.pagoInicial.monto), metodo: String(b.pagoInicial.metodo || 'efectivo'), ref: String(b.pagoInicial.ref || '').slice(0, 60), quien: u.nombre }); v.estado = M.estadoPorPago(v); }
      await store.actualizar('ventas', l => { l.unshift(v); });
      if (v.leadId) await store.actualizar('leads', l => { const x = l.find(y => y.id === v.leadId); if (x) { x.estado = 'compro'; x.ventaFolio = folio; hist(x, u.nombre, 'Compró · venta ' + folio); } });
      return ok(res, { venta: v, k: M.llaveTicket(folio) });
    }
    const ventas = await store.get('ventas', []);
    const v = ventas.find(x => x.folio === b.folio);
    if (!v) return error(res, 404, 'No existe esa venta');
    if (!esAdmin(u) && v.vendedorId !== u.id) return error(res, 403, 'Esta venta es de otro vendedor');
    if (ac === 'abonar') {
      const monto = Math.round(+b.monto || 0); if (monto <= 0) return error(res, 400, 'Escribe el monto del pago');
      if (monto > M.saldo(v) + 0.5 && !b.forzar) return error(res, 400, 'El pago (' + monto + ') es mayor al saldo (' + M.saldo(v) + ')');
      v.pagos.push({ id: id(6), cuando: b.cuando || ahora(), monto, metodo: String(b.metodo || 'efectivo').slice(0, 30), ref: String(b.ref || '').slice(0, 60), quien: u.nombre });
      v.estado = M.estadoPorPago(v); hist(v, u.nombre, 'Pago de $' + monto.toLocaleString('es-MX') + ' (' + v.pagos[v.pagos.length - 1].metodo + ')');
    } else if (ac === 'quitarPago') {
      if (!esAdmin(u)) return error(res, 403, 'Solo el administrador quita pagos');
      const i = v.pagos.findIndex(p => p.id === b.pagoId); if (i < 0) return error(res, 404, 'No existe ese pago');
      const [p] = v.pagos.splice(i, 1); v.estado = M.estadoPorPago(v); hist(v, u.nombre, 'Quitó pago de $' + p.monto.toLocaleString('es-MX'));
    } else if (ac === 'estado') {
      if (!M.ESTADOS_VENTA.includes(b.estado)) return error(res, 400, 'Estado inválido');
      v.estado = b.estado; hist(v, u.nombre, 'Estado: ' + b.estado);
    } else if (ac === 'editar') {
      if (b.cliente) v.cliente = { nombre: String(b.cliente.nombre || v.cliente.nombre).slice(0, 80), tel: tel10(b.cliente.tel) || v.cliente.tel, email: String(b.cliente.email ?? v.cliente.email).slice(0, 100) };
      if (b.sucursal !== undefined) v.sucursal = String(b.sucursal).slice(0, 60);
      if (b.notas !== undefined) v.notas = String(b.notas).slice(0, 500);
      if (b.envio) v.envio = { ...v.envio, ...{ tipo: b.envio.tipo === 'domicilio' ? 'domicilio' : 'bodega', estado: String(b.envio.estado || ''), direccion: String(b.envio.direccion || '').slice(0, 240) } };
      if (esAdmin(u) && b.vendedorId !== undefined) v.vendedorId = b.vendedorId || null;
      if (b.lineas && esAdmin(u)) { const cal = M.calcular(b.lineas, { tipo: v.envio.tipo, estado: v.envio.estado, costo: b.costoEnvio ?? v.costoEnvio, descuento: b.descuento ?? v.descuento }); Object.assign(v, { lineas: cal.lineas, sub: cal.sub, costoEnvio: cal.envio, descuento: cal.descuento, total: cal.total }); v.estado = M.estadoPorPago(v); }
      hist(v, u.nombre, 'Editó la venta');
    } else if (ac === 'nota') {
      hist(v, u.nombre, 'Nota: ' + String(b.texto || '').slice(0, 300));
    } else return error(res, 400, 'Acción desconocida');
    await store.set('ventas', ventas);
    return ok(res, { venta: v, k: M.llaveTicket(v.folio) });
  }

  // ───── Leads ─────
  if (c === 'leads') {
    const usuarios = await A.usuarios();
    if (ac === 'crear') {
      const tel = tel10(b.tel); if (!tel) return error(res, 400, 'El WhatsApp debe tener 10 dígitos');
      const leads = await store.get('leads', []);
      const repetido = leads.find(l => l.tel === tel && !['compro', 'no-compro'].includes(l.estado));
      if (repetido && !b.forzar) return error(res, 409, 'Ese número ya está como lead de ' + ((usuarios.find(x => x.id === repetido.vendedorId) || {}).nombre || 'nadie') + ' (' + repetido.estado + ')');
      let vend = null;
      if (!esAdmin(u)) vend = u; else if (b.vendedorId) vend = usuarios.find(x => x.id === b.vendedorId) || null; else if (b.repartir !== false) vend = M.elegirVendedor(usuarios, b.sucursal);
      const lead = M.nuevoLead({ ...b, tel, origen: b.origen || 'whatsapp' }, vend, u.nombre);
      await store.actualizar('leads', l => { l.unshift(lead); });
      return ok(res, { lead });
    }
    if (ac === 'repartir') {
      if (!esAdmin(u)) return error(res, 403, 'Solo el administrador reparte leads');
      let n = 0;
      await store.actualizar('leads', l => { l.forEach(x => { if (!x.vendedorId && !['compro', 'no-compro'].includes(x.estado)) { const v = M.elegirVendedor(usuarios, x.sucursal); if (v) { x.vendedorId = v.id; hist(x, u.nombre, 'Asignado a ' + v.nombre); n++; } } }); });
      return ok(res, { asignados: n });
    }
    const leads = await store.get('leads', []);
    const L = leads.find(x => x.id === b.id);
    if (!L) return error(res, 404, 'No existe ese lead');
    if (!esAdmin(u) && L.vendedorId !== u.id) return error(res, 403, 'Este lead es de otro vendedor');
    if (ac === 'estado') {
      if (!M.ESTADOS_LEAD.includes(b.estado)) return error(res, 400, 'Estado inválido');
      L.estado = b.estado; hist(L, u.nombre, 'Estado: ' + b.estado + (b.nota ? ' · ' + String(b.nota).slice(0, 200) : ''));
      if (b.nota) L.notas.push({ cuando: ahora(), quien: u.nombre, texto: String(b.nota).slice(0, 300) });
    } else if (ac === 'nota') {
      L.notas.push({ cuando: ahora(), quien: u.nombre, texto: String(b.texto || '').slice(0, 300) });
    } else if (ac === 'asignar') {
      if (!esAdmin(u)) return error(res, 403, 'Solo el administrador reasigna');
      const v = usuarios.find(x => x.id === b.vendedorId); L.vendedorId = v ? v.id : null; hist(L, u.nombre, v ? 'Reasignado a ' + v.nombre : 'Sin vendedor');
    } else if (ac === 'editar') {
      if (b.nombre !== undefined) L.nombre = String(b.nombre).slice(0, 80);
      if (b.tel !== undefined && tel10(b.tel)) L.tel = tel10(b.tel);
      if (b.producto !== undefined) L.producto = String(b.producto).slice(0, 80);
      if (b.sucursal !== undefined) L.sucursal = String(b.sucursal).slice(0, 60);
      if (b.mensaje !== undefined) L.mensaje = String(b.mensaje).slice(0, 500);
    } else return error(res, 400, 'Acción desconocida');
    await store.set('leads', leads);
    return ok(res, { lead: L });
  }

  // ───── Usuarios (vendedores y administradores) ─────
  if (c === 'usuarios') {
    if (!esAdmin(u)) return error(res, 403, 'Solo el administrador maneja usuarios');
    const lista = await A.usuarios();
    if (ac === 'crear') {
      const usuario = String(b.usuario || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (usuario.length < 3) return error(res, 400, 'El usuario debe tener al menos 3 letras (sin espacios ni acentos)');
      if (lista.some(x => x.usuario === usuario)) return error(res, 409, 'Ese usuario ya existe');
      if (!b.nombre) return error(res, 400, 'Escribe el nombre');
      const claveTemp = b.clave && String(b.clave).length >= 8 ? String(b.clave) : 'Cardian' + Math.floor(1000 + Math.random() * 9000);
      const nuevo = { id: id(8), nombre: String(b.nombre).slice(0, 80), usuario, rol: b.rol === 'admin' ? 'admin' : 'vendedor', sucursal: String(b.sucursal || '').slice(0, 60), whatsapp: tel10(b.whatsapp), activo: true, recibeLeads: b.recibeLeads !== false, cambiarClave: true, clave: A.hashear(claveTemp), creado: ahora() };
      lista.push(nuevo); await store.set('usuarios', lista);
      return ok(res, { usuario: A.publico(nuevo), claveTemp });
    }
    const x = lista.find(y => y.id === b.id); if (!x) return error(res, 404, 'No existe ese usuario');
    if (ac === 'editar') {
      if (b.nombre) x.nombre = String(b.nombre).slice(0, 80);
      if (b.sucursal !== undefined) x.sucursal = String(b.sucursal).slice(0, 60);
      if (b.whatsapp !== undefined) x.whatsapp = tel10(b.whatsapp);
      if (b.recibeLeads !== undefined) x.recibeLeads = !!b.recibeLeads;
      if (b.rol && x.id !== u.id) x.rol = b.rol === 'admin' ? 'admin' : 'vendedor';
      if (b.activo !== undefined && x.id !== u.id) x.activo = !!b.activo;
      await store.set('usuarios', lista);
      return ok(res, { usuario: A.publico(x) });
    }
    if (ac === 'clave') {
      const claveTemp = 'Cardian' + Math.floor(1000 + Math.random() * 9000);
      x.clave = A.hashear(claveTemp); x.cambiarClave = true; await store.set('usuarios', lista);
      return ok(res, { claveTemp });
    }
    return error(res, 400, 'Acción desconocida');
  }

  // ───── Sucursales y ajustes ─────
  if (c === 'sucursales') {
    if (!esAdmin(u)) return error(res, 403, 'Solo el administrador edita sucursales');
    const lista = (b.lista || []).map(s => String(s).trim().slice(0, 60)).filter(Boolean);
    await store.set('sucursales', [...new Set(lista)]);
    return ok(res, { sucursales: [...new Set(lista)] });
  }
  if (c === 'ajustes') {
    if (!esAdmin(u)) return error(res, 403, 'Solo el administrador cambia ajustes');
    const cur = await store.get('ajustes', {});
    const permitidos = ['negocio', 'leyendaTicket', 'waNegocio', 'msi'];
    permitidos.forEach(k => { if (b[k] !== undefined) cur[k] = String(b[k]).slice(0, 300); });
    await store.set('ajustes', cur);
    return ok(res, { ajustes: cur });
  }
  return error(res, 400, 'Colección desconocida');
};

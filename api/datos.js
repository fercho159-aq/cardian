// Datos del sistema (requiere sesión): ventas, leads, usuarios, sucursales y ajustes.
// GET  /api/datos?c=ventas|leads|usuarios|sucursales|ajustes|todo
// POST /api/datos?c=…  { accion, … }
const A = require('./_lib/auth');
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const { cuerpo, query, ok, error, id, ahora, tel10, seguro } = require('./_lib/http');

const esAdmin = u => u.rol === 'admin';
// Admin de atención («supervisor»): ve y reparte todos los leads y chats de WhatsApp, pero no ventas, usuarios ni ajustes.
const veTodo = u => u.rol === 'admin' || u.rol === 'supervisor';
const ROLES = ['admin', 'supervisor', 'vendedor'];
const rolDe = r => ROLES.includes(r) ? r : 'vendedor';
const visiblesVentas = (lista, u) => esAdmin(u) ? lista : lista.filter(v => v.vendedorId === u.id);
const visiblesLeads = (lista, u) => veTodo(u) ? lista : lista.filter(l => l.vendedorId === u.id);
const hist = (obj, quien, que) => { (obj.historial = obj.historial || []).push({ cuando: ahora(), quien, que }); };

const COLECCIONES = ['ventas', 'leads', 'usuarios', 'sucursales', 'ajustes', 'modelos', 'tienda'];
const T = require('./_lib/tienda');
// Modelos que agrega el equipo cuando venden algo que no está en el catálogo del sitio (id «x-…»).
const normal = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
module.exports = seguro(async (req, res) => {
  const col = query(req).c;
  if (req.method === 'POST' && COLECCIONES.includes(col)) return store.conCandado(col, () => manejar(req, res));
  return manejar(req, res);
});

async function manejar(req, res) {
  const u = await A.exigir(req, res); if (!u) return;
  const q = query(req); const c = q.c || 'todo';
  const tienda = await M.cargarTienda(); // el catálogo con las altas y cambios del administrador

  if (req.method === 'GET') {
    const out = {};
    const usuarios = await A.usuarios();
    if (c === 'ventas' || c === 'todo') out.ventas = visiblesVentas(await store.get('ventas', []), u);
    if (c === 'leads' || c === 'todo') out.leads = visiblesLeads(await store.get('leads', []), u);
    if (c === 'usuarios' || c === 'todo') out.usuarios = usuarios.map(x => esAdmin(u) ? A.publico(x) : { id: x.id, nombre: x.nombre, rol: x.rol, sucursal: x.sucursal, activo: x.activo });
    if (c === 'sucursales' || c === 'todo') out.sucursales = await store.get('sucursales', []);
    if (c === 'ajustes' || c === 'todo') out.ajustes = { almacen: store.modo(), secretoDefault: A.secretoDefault, mpConfigurado: !!process.env.MP_ACCESS_TOKEN, mpPrueba: !!(process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-'), mpWebhook: !!process.env.MP_WEBHOOK_SECRET, waConfigurado: !!process.env.WA_VERIFY_TOKEN, waFirma: !!process.env.WA_APP_SECRET, waBandeja: !!(process.env.WA_API_URL && (process.env.WA_SERVICE_TOKEN || '').length >= 32 && process.env.WA_ACCOUNT_ID), ...(await store.get('ajustes', {})) };
    if (esAdmin(u) && (c === 'ajustes' || c === 'todo')) { out.accesos = (await store.get('accesos', [])).slice(0, 40); out.eliminados = (await store.get('eliminados', [])).slice(0, 20); }
    out.yo = A.publico(u);
    const extras = (await store.get('modelos', [])).filter(m => m.activo !== false);
    out.catalogo = { productos: M.D().products.map(p => ({ id: p.id, nombre: p.name, precio: p.price || 0, cat: p.cat, tapiz: p.tapiz || [] })), tapiz: M.D().TAPIZ, estados: M.D().states, estadosVenta: M.ESTADOS_VENTA, estadosLead: M.ESTADOS_LEAD, origenes: M.ORIGENES, extras, tienda };
    return ok(res, out);
  }
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req); const ac = b.accion;

  // ───── Ventas ─────
  if (c === 'ventas') {
    if (ac === 'crear') {
      if (!b.lineas || !b.lineas.length) return error(res, 400, 'Agrega al menos un artículo');
      // Modelos agregados por el equipo: nombre y precio de la lista (el precio se puede ajustar en la venta).
      const extras = await store.get('modelos', []);
      b.lineas = b.lineas.map(l => { if (!l.id || !String(l.id).startsWith('x-')) return l; const e = extras.find(x => x.id === l.id); return e ? { id: null, extraId: e.id, nombre: e.nombre, unit: +l.unit > 0 ? +l.unit : e.precio, qty: l.qty } : { ...l, id: null }; });
      const folio = await M.folioNuevo();
      // El vendedor registra lo que vende en tienda, WhatsApp o teléfono; los orígenes del admin (sitio, Mercado Pago, Mercado Libre) se los asigna el administrador.
      const origen = !esAdmin(u) && M.ORIGENES_ADMIN.includes(b.origen) ? 'sucursal' : (b.origen || 'sucursal');
      const v = M.nuevaVenta({ ...b, folio, origen, vendedorId: esAdmin(u) && b.vendedorId ? b.vendedorId : u.id, sucursal: b.sucursal || u.sucursal }, u);
      // etapa inicial y fecha estimada que eligió el vendedor (pedido capturado a mano)
      if (b.etapa && M.ETAPAS.includes(b.etapa) && b.etapa !== 'recibido') { v.etapa = b.etapa; v.etapas.push({ etapa: b.etapa, cuando: ahora(), quien: u.nombre }); }
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(b.fechaEntrega || ''))) v.fechaEntrega = String(b.fechaEntrega);
      if (b.notaCliente) v.notaCliente = String(b.notaCliente).slice(0, 240);
      if (b.pagoInicial && +b.pagoInicial.monto > 0) { v.pagos.push({ id: id(6), cuando: ahora(), monto: Math.round(+b.pagoInicial.monto), metodo: String(b.pagoInicial.metodo || 'efectivo'), ref: String(b.pagoInicial.ref || '').slice(0, 60), quien: u.nombre }); v.estado = M.estadoPorPago(v); }
      await store.actualizar('ventas', l => { l.unshift(v); });
      if (v.leadId) await store.actualizar('leads', l => { const x = l.find(y => y.id === v.leadId); if (x) { x.estado = 'compro'; x.ventaFolio = folio; hist(x, u.nombre, 'Compró · venta ' + folio); } });
      return ok(res, { venta: v, k: M.llaveTicket(folio) });
    }
    if (ac === 'eliminar') {
      // Para limpiar pedidos de prueba: solo el administrador, escribiendo el folio para confirmar.
      if (!esAdmin(u)) return error(res, 403, 'Solo el administrador elimina pedidos');
      if (String(b.confirmar || '').trim().toUpperCase() !== String(b.folio || '').toUpperCase()) return error(res, 400, 'Escribe el folio exacto para confirmar');
      let quitado = null;
      await store.actualizar('ventas', l => { const i = l.findIndex(x => x.folio === b.folio); if (i >= 0) quitado = l.splice(i, 1)[0]; });
      if (!quitado) return error(res, 404, 'No existe esa venta');
      if (quitado.leadId) await store.actualizar('leads', l => { const x = l.find(y => y.id === quitado.leadId); if (x) { x.ventaFolio = null; hist(x, u.nombre, 'Se eliminó la venta ' + quitado.folio); } });
      await store.actualizar('eliminados', l => [{ cuando: ahora(), quien: u.nombre, tipo: 'Pedido', ref: quitado.folio, detalle: (quitado.cliente.nombre || '') + ' · $' + Math.round(quitado.total || 0).toLocaleString('es-MX') }, ...l].slice(0, 100));
      return ok(res, { ok: true });
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
    } else if (ac === 'etapa') {
      // Seguimiento del pedido: etapa, fecha estimada de entrega y nota para el cliente.
      if (b.etapa !== undefined && !M.ETAPAS.includes(b.etapa)) return error(res, 400, 'Etapa inválida');
      const NOM = { recibido: 'Recibido', fabricando: 'En fabricación', listo: 'Listo para entrega', 'en-camino': 'En camino', entregado: 'Entregado' };
      if (b.etapa && b.etapa !== (v.etapa || 'recibido')) { v.etapa = b.etapa; (v.etapas = v.etapas || []).push({ etapa: b.etapa, cuando: ahora(), quien: u.nombre }); hist(v, u.nombre, 'Pedido: ' + NOM[b.etapa]); if (b.etapa === 'entregado' && v.estado !== 'cancelado') v.estado = 'entregado'; }
      if (b.fechaEntrega !== undefined) { const fe = /^\d{4}-\d{2}-\d{2}$/.test(String(b.fechaEntrega)) ? String(b.fechaEntrega) : ''; if (fe !== (v.fechaEntrega || '')) { v.fechaEntrega = fe; hist(v, u.nombre, fe ? 'Fecha estimada de entrega: ' + fe : 'Quitó la fecha de entrega'); } }
      if (b.notaCliente !== undefined) v.notaCliente = String(b.notaCliente).slice(0, 240);
    } else if (ac === 'estado') {
      if (!M.ESTADOS_VENTA.includes(b.estado)) return error(res, 400, 'Estado inválido');
      // El estado del pago sale de los pagos registrados. El vendedor solo puede descartar o recuperar sus pedidos sin pago.
      if (!esAdmin(u) && !(M.pagado(v) === 0 && ['cancelado', 'pendiente'].includes(b.estado))) return error(res, 403, 'Solo el administrador cambia el estado del pago');
      v.estado = b.estado; hist(v, u.nombre, 'Estado: ' + b.estado);
    } else if (ac === 'editar') {
      if (b.cliente) v.cliente = { nombre: String(b.cliente.nombre || v.cliente.nombre).slice(0, 80), tel: tel10(b.cliente.tel) || v.cliente.tel, email: String(b.cliente.email ?? v.cliente.email).slice(0, 100) };
      if (b.sucursal !== undefined) v.sucursal = String(b.sucursal).slice(0, 60);
      if (b.notas !== undefined) v.notas = String(b.notas).slice(0, 500);
      if (b.envio) v.envio = { ...v.envio, ...{ tipo: b.envio.tipo === 'domicilio' ? 'domicilio' : 'bodega', estado: String(b.envio.estado || ''), direccion: String(b.envio.direccion || '').slice(0, 240) } };
      if (esAdmin(u) && b.vendedorId !== undefined && (b.vendedorId || null) !== (v.vendedorId || null)) { const nv = (await A.usuarios()).find(x => x.id === b.vendedorId); v.vendedorId = nv ? nv.id : null; hist(v, u.nombre, nv ? 'Asignada a ' + nv.nombre : 'Sin vendedor'); }
      if (b.lineas && esAdmin(u)) { const cal = M.calcular(b.lineas, { tipo: v.envio.tipo, estado: v.envio.estado, costo: b.costoEnvio ?? v.costoEnvio, descuento: b.descuento ?? v.descuento }, { iva: !!v.factura }); Object.assign(v, { lineas: cal.lineas, sub: cal.sub, costoEnvio: cal.envio, descuento: cal.descuento, iva: cal.iva, total: cal.total }); v.estado = M.estadoPorPago(v); }
      if (b.cliente || b.sucursal !== undefined || b.notas !== undefined || b.envio || b.lineas) hist(v, u.nombre, 'Editó la venta');
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
      // El admin puede escoger vendedor; un vendedor solo se lo queda si marca «lo atiendo yo». Si no, al azar parejo.
      if (veTodo(u) && b.vendedorId) vend = usuarios.find(x => x.id === b.vendedorId) || null;
      else if (!veTodo(u) && b.mio) vend = u;
      else if (b.repartir !== false) vend = M.elegirVendedor(usuarios, b.sucursal, leads);
      const lead = M.nuevoLead({ ...b, tel, origen: b.origen || 'whatsapp' }, vend, u.nombre);
      await store.actualizar('leads', l => { l.unshift(lead); });
      return ok(res, { lead });
    }
    if (ac === 'repartir') {
      if (!veTodo(u)) return error(res, 403, 'Solo el administrador reparte leads');
      let n = 0;
      await store.actualizar('leads', l => { l.forEach(x => { if (!x.vendedorId && !['compro', 'no-compro'].includes(x.estado)) { const v = M.elegirVendedor(usuarios, x.sucursal, l); if (v) { x.vendedorId = v.id; hist(x, u.nombre, 'Asignado a ' + v.nombre); n++; } } }); });
      return ok(res, { asignados: n });
    }
    if (ac === 'eliminar') {
      if (!esAdmin(u)) return error(res, 403, 'Solo el administrador elimina leads');
      let quitado = null;
      await store.actualizar('leads', l => { const i = l.findIndex(x => x.id === b.id); if (i >= 0) quitado = l.splice(i, 1)[0]; });
      if (!quitado) return error(res, 404, 'No existe ese lead');
      await store.actualizar('eliminados', l => [{ cuando: ahora(), quien: u.nombre, tipo: 'Lead', ref: quitado.tel || '', detalle: quitado.nombre || '' }, ...l].slice(0, 100));
      return ok(res, { ok: true });
    }
    const leads = await store.get('leads', []);
    const L = leads.find(x => x.id === b.id);
    if (!L) return error(res, 404, 'No existe ese lead');
    if (!veTodo(u) && L.vendedorId !== u.id) return error(res, 403, 'Este lead es de otro vendedor');
    if (ac === 'estado') {
      if (!M.ESTADOS_LEAD.includes(b.estado)) return error(res, 400, 'Estado inválido');
      L.estado = b.estado; hist(L, u.nombre, 'Estado: ' + b.estado + (b.nota ? ' · ' + String(b.nota).slice(0, 200) : ''));
      if (b.nota) L.notas.push({ cuando: ahora(), quien: u.nombre, texto: String(b.nota).slice(0, 300) });
    } else if (ac === 'nota') {
      L.notas.push({ cuando: ahora(), quien: u.nombre, texto: String(b.texto || '').slice(0, 300) });
    } else if (ac === 'asignar') {
      if (!veTodo(u)) return error(res, 403, 'Solo el administrador reasigna');
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
      if (b.clave && String(b.clave).length < 8) return error(res, 400, 'La contraseña debe tener al menos 8 caracteres');
      const claveTemp = b.clave ? String(b.clave) : 'Cardian' + Math.floor(1000 + Math.random() * 9000);
      const nuevo = { id: id(8), nombre: String(b.nombre).slice(0, 80), usuario, rol: rolDe(b.rol), sucursal: String(b.sucursal || '').slice(0, 60), whatsapp: tel10(b.whatsapp), activo: true, recibeLeads: b.recibeLeads !== false, cambiarClave: b.obligar !== false, clave: A.hashear(claveTemp), creado: ahora() };
      lista.push(nuevo); await store.set('usuarios', lista);
      return ok(res, { usuario: A.publico(nuevo), claveTemp });
    }
    const x = lista.find(y => y.id === b.id); if (!x) return error(res, 404, 'No existe ese usuario');
    if (ac === 'editar') {
      if (b.usuario !== undefined) {
        const nuevoU = String(b.usuario || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (nuevoU !== x.usuario) {
          if (nuevoU.length < 3) return error(res, 400, 'El usuario debe tener al menos 3 letras (sin espacios ni acentos)');
          if (lista.some(y => y.id !== x.id && y.usuario === nuevoU)) return error(res, 409, 'Ese usuario ya existe');
          x.usuario = nuevoU;
        }
      }
      if (b.nombre) x.nombre = String(b.nombre).slice(0, 80);
      if (b.sucursal !== undefined) x.sucursal = String(b.sucursal).slice(0, 60);
      if (b.whatsapp !== undefined) x.whatsapp = tel10(b.whatsapp);
      if (b.recibeLeads !== undefined) x.recibeLeads = !!b.recibeLeads;
      if (b.rol && x.id !== u.id) x.rol = rolDe(b.rol);
      if (b.activo !== undefined && x.id !== u.id) x.activo = !!b.activo;
      await store.set('usuarios', lista);
      return ok(res, { usuario: A.publico(x) });
    }
    if (ac === 'clave') {
      // El admin escribe la contraseña que quiera (8+ caracteres) o se genera una al azar.
      if (b.clave && String(b.clave).length < 8) return error(res, 400, 'La contraseña debe tener al menos 8 caracteres');
      const claveTemp = b.clave ? String(b.clave) : 'Cardian' + Math.floor(1000 + Math.random() * 9000);
      x.clave = A.hashear(claveTemp); x.cambiarClave = b.obligar !== false; await store.set('usuarios', lista);
      return ok(res, { claveTemp, obligar: x.cambiarClave });
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
  // ───── Productos de la tienda (página web): alta, edición, precio y ocultar. Solo el administrador. ─────
  if (c === 'tienda') {
    if (!esAdmin(u)) return error(res, 403, 'Solo el administrador da de alta o cambia productos de la tienda');
    const D = M.D(); const base = M.productosBase();
    const lista = await store.get('tienda', []);
    const original = b.id ? base.find(p => p.id === b.id) : null;
    let r = b.id ? lista.find(x => x.id === b.id) : null;
    if (ac === 'guardar') {
      let d; try { d = T.normalizar({ ...(original || {}), ...(b.datos || {}) }, D); } catch (e) { return error(res, 400, e.message); }
      if (original) {
        // producto del catálogo base: se guarda solo lo que cambió (si no cambió nada, el registro desaparece)
        if (!(b.datos || {}).tapiz || !(b.datos.tapiz || []).length) { delete d.tapiz; delete d.defaultColor; }
        const dif = T.diferencias(d, original);
        if (!r) { r = { id: original.id, base: true, creado: ahora(), creadoPor: u.nombre }; lista.push(r); }
        Object.assign(r, { datos: dif, oculto: !!b.oculto, editado: ahora(), editadoPor: u.nombre });
        if (!Object.keys(dif).length && !r.oculto) lista.splice(lista.indexOf(r), 1);
      } else if (r) {
        Object.assign(r, { datos: d, oculto: !!b.oculto, editado: ahora(), editadoPor: u.nombre });
      } else {
        if (b.id) return error(res, 404, 'No existe ese producto');
        let nid = T.slug(d.name) || 'producto'; if (nid.startsWith('x-')) nid = 'p-' + nid;
        const usados = new Set([...base.map(p => p.id), ...lista.map(x => x.id)]);
        let k = nid, n = 2; while (usados.has(k)) k = nid + '-' + n++;
        r = { id: k, base: false, oculto: !!b.oculto, datos: d, creado: ahora(), creadoPor: u.nombre, editado: ahora(), editadoPor: u.nombre };
        lista.push(r);
      }
      await store.set('tienda', lista);
      return ok(res, { producto: r, tienda: lista });
    }
    if (ac === 'eliminar') {
      // producto nuevo: se borra con sus fotos. Producto base: se quitan los cambios y vuelve a como estaba.
      if (!r) return error(res, 404, 'No existe ese producto');
      lista.splice(lista.indexOf(r), 1);
      await store.set('tienda', lista);
      if (!r.base) for (const src of ((r.datos || {}).imgs || [])) { const m = String(src).match(/^img\/tienda\/([\w-]+)\.jpg$/); if (m) await store.del('timg:' + m[1]).catch(() => {}); }
      await store.actualizar('eliminados', l => [{ cuando: ahora(), quien: u.nombre, tipo: r.base ? 'Cambios de producto' : 'Producto de tienda', ref: r.id, detalle: (r.datos || {}).name || '' }, ...l].slice(0, 100));
      return ok(res, { ok: true, tienda: lista });
    }
    return error(res, 400, 'Acción desconocida');
  }

  // ───── Modelos agregados por el equipo ─────
  if (c === 'modelos') {
    const lista = await store.get('modelos', []);
    if (ac === 'crear') {
      const nombre = String(b.nombre || '').trim().slice(0, 80); const precio = Math.max(0, Math.round(+b.precio || 0));
      if (nombre.length < 2) return error(res, 400, 'Escribe el nombre del modelo');
      const ya = lista.find(m => normal(m.nombre) === normal(nombre));
      if (ya) { if (ya.activo === false) { ya.activo = true; await store.set('modelos', lista); } return ok(res, { modelo: ya, existia: true }); }
      if (!precio) return error(res, 400, 'Escribe el precio del modelo');
      const m = { id: 'x-' + id(8), nombre, precio, creadoPor: u.id, creadoNombre: u.nombre, creado: ahora(), activo: true };
      lista.push(m); await store.set('modelos', lista);
      return ok(res, { modelo: m });
    }
    if (!esAdmin(u)) return error(res, 403, 'Solo el administrador cambia o quita modelos');
    const m = lista.find(x => x.id === b.id); if (!m) return error(res, 404, 'No existe ese modelo');
    if (ac === 'editar') { if (b.nombre) m.nombre = String(b.nombre).trim().slice(0, 80); if (b.precio !== undefined) m.precio = Math.max(0, Math.round(+b.precio || 0)); }
    else if (ac === 'quitar') m.activo = false;
    else return error(res, 400, 'Acción desconocida');
    await store.set('modelos', lista);
    return ok(res, { modelo: m });
  }
  if (c === 'ajustes') {
    if (!esAdmin(u)) return error(res, 403, 'Solo el administrador cambia ajustes');
    if (b.accion === 'limpiarBitacora') {
      await store.set('accesos', [{ cuando: ahora(), usuario: u.usuario, ip: '', ok: true, motivo: 'bitácora limpiada' }]);
      return ok(res, { ok: true });
    }
    const cur = await store.get('ajustes', {});
    const permitidos = ['negocio', 'leyendaTicket', 'waNegocio', 'msi', 'numeroCompartido'];
    permitidos.forEach(k => { if (b[k] !== undefined) cur[k] = String(b[k]).slice(0, 300); });
    await store.set('ajustes', cur);
    return ok(res, { ajustes: cur });
  }
  return error(res, 400, 'Colección desconocida');
}

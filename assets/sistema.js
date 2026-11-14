/* Sistema de ventas y leads de Cardian Muebles.
   Una sola página: inicia sesión, carga los datos de /api/datos y pinta la vista según el #hash.
   Admin: Hoy, Ventas, Leads, Vendedores, Ajustes. Vendedor: Hoy, Mis leads, Mis ventas, Mi cuenta. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = s => s ? new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const dia = s => s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
  const hace = s => { const m = Math.round((Date.now() - new Date(s)) / 6e4); if (m < 60) return 'hace ' + m + ' min'; const h = Math.round(m / 60); if (h < 48) return 'hace ' + h + ' h'; return 'hace ' + Math.round(h / 24) + ' días'; };
  const ESTADO_V = { pendiente: 'Pendiente de pago', apartado: 'Apartado', pagado: 'Pagado', 'en-produccion': 'En producción', entregado: 'Entregado', cancelado: 'Cancelado' };
  const ETAPA_V = { recibido: 'Recibido', fabricando: 'En fabricación', listo: 'Listo para entrega', 'en-camino': 'En camino', entregado: 'Entregado' };
  const ESTADO_L = { nuevo: 'Nuevo', contactado: 'Contactado', 'sin-respuesta': 'Sin respuesta', cotizado: 'Cotizado', compro: 'Compró', 'no-compro': 'No compró' };
  const ORIGEN = { sitio: 'Página web', 'mercado-pago': 'Mercado Pago', whatsapp: 'WhatsApp', sucursal: 'Tienda / local', telefono: 'Teléfono', otro: 'Otro' };
  const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'mercado-pago', 'deposito', 'otro'];
  let S = { yo: null, ventas: [], leads: [], usuarios: [], sucursales: [], ajustes: {}, catalogo: null, filtros: {} };
  let toastTimer;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); };

  async function api(url, body) {
    const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && S.yo) { S.yo = null; render(); }
    if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
    return j;
  }
  async function cargar() {
    const d = await api('/api/datos?c=todo');
    Object.assign(S, { ventas: d.ventas, leads: d.leads, usuarios: d.usuarios, sucursales: d.sucursales, ajustes: d.ajustes || {}, catalogo: d.catalogo, yo: d.yo, accesos: d.accesos || [] });
  }
  const admin = () => S.yo && S.yo.rol === 'admin';
  const nombreU = id => (S.usuarios.find(u => u.id === id) || {}).nombre || '—';
  const pagado = v => (v.pagos || []).reduce((s, p) => s + p.monto, 0);
  const saldo = v => Math.max(0, v.total - pagado(v));
  const waLink = (tel, txt) => `https://wa.me/52${tel}?text=${encodeURIComponent(txt)}`;
  const ticketUrl = (folio, k) => `/ticket?f=${folio}&k=${k}`;
  const badge = (e, map) => `<span class="badge ${e}">${esc((map || ESTADO_V)[e] || e)}</span>`;
  const opts = (list, val, vacio) => (vacio ? `<option value="">${vacio}</option>` : '') + list.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`; }).join('');

  // ───────── modal genérico ─────────
  function modal(titulo, cuerpo, botones, opciones = {}) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal" id="modal"><div class="box ${opciones.wide ? 'wide' : ''}"><header><h2>${titulo}</h2><button type="button" data-x aria-label="Cerrar">×</button></header><div class="body">${cuerpo}</div>${botones ? `<footer>${botones}</footer>` : ''}</div></div>`;
    const m = $('#modal');
    const cerrar = () => { root.innerHTML = ''; };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) cerrar(); });
    return { el: m, cerrar };
  }
  const cerrarModal = () => { $('#modal-root').innerHTML = ''; };

  // ───────── acceso ─────────
  function vistaLogin(err) {
    $('#app').innerHTML = `<div class="login"><form class="box" id="login">
      <img src="/img/logo.png" alt="Cardian Muebles"><h1>Sistema Cardian</h1><p>Ventas, pedidos y clientes</p>
      <div class="field"><label for="u">Usuario</label><input class="input" id="u" autocomplete="username" autofocus></div>
      <div class="field"><label for="p">Contraseña</label><input class="input" id="p" type="password" autocomplete="current-password"></div>
      ${err ? `<div class="err">${esc(err)}</div>` : ''}
      <button class="btn primary" style="width:100%" type="submit">Entrar</button>
      <p style="margin:16px 0 0;font-size:12px"><a href="/" style="color:var(--muted)">← Volver al sitio</a></p>
    </form></div>`;
    $('#login').onsubmit = async e => {
      e.preventDefault();
      try { await api('/api/auth', { accion: 'entrar', usuario: $('#u').value, clave: $('#p').value }); await cargar(); render(); if (S.yo.cambiarClave) pedirClave(true); }
      catch (x) { vistaLogin(x.message); }
    };
  }
  function pedirClave(forzado) {
    const m = modal(forzado ? 'Crea tu contraseña' : 'Cambiar mi contraseña', `
      ${forzado ? '<p class="note" style="margin-bottom:12px">Esta cuenta tiene una contraseña temporal. Escribe una nueva de al menos 10 caracteres.</p>' : `<div class="field"><label>Contraseña actual</label><input class="input" id="c0" type="password"></div>`}
      <div class="field"><label>Nueva contraseña</label><input class="input" id="c1" type="password" autocomplete="new-password"></div>
      <div class="field"><label>Repítela</label><input class="input" id="c2" type="password" autocomplete="new-password"></div>`,
      `<button class="btn primary sm" id="okc">Guardar</button>`);
    $('#okc').onclick = async () => {
      if ($('#c1').value !== $('#c2').value) return toast('Las contraseñas no coinciden');
      try { await api('/api/auth', { accion: 'clave', actual: $('#c0') ? $('#c0').value : '', nueva: $('#c1').value }); S.yo.cambiarClave = false; m.cerrar(); toast('Contraseña guardada'); } catch (e) { toast(e.message); }
    };
  }

  // ───────── armazón ─────────
  const ICO = {
    hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></svg>',
    ventas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16l-1.5 12h-13z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    leads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z"/></svg>',
    vendedores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    cuenta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
  };
  function ruta() { return (location.hash.replace('#/', '') || 'hoy').split('?')[0]; }
  function shell(contenido, titulo, sub, acciones) {
    const leadsNuevos = S.leads.filter(l => l.estado === 'nuevo').length;
    const pendientes = S.ventas.filter(v => v.estado === 'pendiente').length;
    const menu = admin()
      ? [['hoy', 'Hoy'], ['ventas', 'Ventas', pendientes], ['leads', 'Leads', leadsNuevos], ['vendedores', 'Usuarios'], ['ajustes', 'Ajustes']]
      : [['hoy', 'Hoy'], ['leads', 'Mis leads', leadsNuevos], ['ventas', 'Mis ventas', pendientes], ['cuenta', 'Mi cuenta']];
    const r = ruta();
    $('#app').innerHTML = `<div class="shell">
      <nav class="side" id="side"><div class="brand"><img src="/img/logo.png" alt=""><span>Sistema</span></div>
        ${menu.map(([k, t, n]) => `<a href="#/${k}" class="${r === k ? 'on' : ''}">${ICO[k] || ICO.cuenta}${t}${n ? `<span class="n">${n}</span>` : ''}</a>`).join('')}
        <div class="yo"><b>${esc(S.yo.nombre)}</b><small>${S.yo.rol === 'admin' ? 'Administrador' : 'Vendedor'}${S.yo.sucursal ? ' · ' + esc(S.yo.sucursal) : ''}</small><br><button type="button" id="salir">Cerrar sesión</button></div>
      </nav>
      <main class="main"><button class="menu-btn" id="menu">☰ Menú</button>
        <div class="top"><div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="acts">${acciones || ''}</div></div>
        ${contenido}</main></div>`;
    $('#salir').onclick = async () => { await api('/api/auth', { accion: 'salir' }); S.yo = null; render(); };
    $('#menu').onclick = () => $('#side').classList.toggle('open');
    $$('#side a').forEach(a => a.onclick = () => $('#side').classList.remove('open'));
  }

  // ───────── Hoy ─────────
  function vistaHoy() {
    const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
    const mes = S.ventas.filter(v => new Date(v.creado) >= ini && v.estado !== 'cancelado');
    const cobrado = mes.reduce((s, v) => s + pagado(v), 0);
    const porCobrar = S.ventas.filter(v => !['cancelado', 'entregado'].includes(v.estado)).reduce((s, v) => s + saldo(v), 0);
    const nuevos = S.leads.filter(l => l.estado === 'nuevo');
    const sinRespuesta = S.leads.filter(l => l.estado === 'sin-respuesta');
    const sitioPend = S.ventas.filter(v => v.origen === 'sitio' && v.estado === 'pendiente');
    const sinVendedor = S.leads.filter(l => !l.vendedorId && !['compro', 'no-compro'].includes(l.estado));
    const tareas = [];
    nuevos.slice(0, 6).forEach(l => tareas.push(`<li class="lead" data-lead="${l.id}"><div><b>${esc(l.nombre || 'Sin nombre')}</b> pidió informes ${l.producto ? 'de ' + esc(l.producto) : ''} <span class="badge origen">${ORIGEN[l.origen]}</span><div class="meta"><span>${hace(l.creado)}</span>${admin() ? `<span>${esc(nombreU(l.vendedorId))}</span>` : ''}</div></div><div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(l.tel, saludoLead(l))}" onclick="event.stopPropagation()">WhatsApp</a></div></li>`));
    sitioPend.slice(0, 4).forEach(v => tareas.push(`<li class="lead" data-venta="${v.folio}"><div><b>Pedido ${v.folio}</b> del sitio sin pago · ${esc(v.cliente.nombre)} · ${fmt(v.total)}<div class="meta"><span>${hace(v.creado)}</span><span>${v.pagoElegido === 'spei' ? 'Eligió transferencia' : v.pagoElegido === 'cash' ? 'Eligió efectivo' : 'Eligió Mercado Pago'}</span></div></div><div class="acts">${v.cliente.tel ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(v.cliente.tel, `Hola ${esc(v.cliente.nombre.split(' ')[0])}, soy de Cardian Muebles. Recibimos tu pedido ${v.folio} por ${fmt(v.total)}. ¿Te ayudo a completar el pago?`)}" onclick="event.stopPropagation()">WhatsApp</a>` : ''}</div></li>`));
    sinRespuesta.slice(0, 4).forEach(l => tareas.push(`<li class="lead" data-lead="${l.id}"><div><b>${esc(l.nombre || l.tel)}</b> no ha respondido · vuelve a intentar<div class="meta"><span>${hace(l.creado)}</span></div></div><div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(l.tel, `Hola ${esc((l.nombre || '').split(' ')[0])}, te escribo de Cardian Muebles por si sigues interesado${l.producto ? ' en ' + esc(l.producto) : ''}. ¿Te paso el precio?`)}" onclick="event.stopPropagation()">WhatsApp</a></div></li>`));
    shell(`
      <div class="grid kpis">
        <div class="kpi"><small>Ventas del mes</small><b>${fmt(mes.reduce((s, v) => s + v.total, 0))}</b><span>${mes.length} venta${mes.length === 1 ? '' : 's'}</span></div>
        <div class="kpi ok"><small>Cobrado este mes</small><b>${fmt(cobrado)}</b><span>pagos registrados</span></div>
        <div class="kpi warn"><small>Por cobrar</small><b>${fmt(porCobrar)}</b><span>saldos de ventas abiertas</span></div>
        <div class="kpi"><small>Leads nuevos</small><b>${nuevos.length}</b><span>${sinRespuesta.length} sin respuesta</span></div>
      </div>
      ${admin() && sinVendedor.length ? `<div class="aviso" style="margin-top:16px">Hay ${sinVendedor.length} lead${sinVendedor.length > 1 ? 's' : ''} sin vendedor. <a href="#" id="repartir">Repartir ahora</a> o da de alta vendedores que reciban leads.</div>` : ''}
      ${rapidaHtml()}
      ${!admin() && !S.yo.whatsapp && !compartido() ? `<div class="aviso" style="margin-top:16px">Tu cuenta no tiene WhatsApp registrado: los clientes del sitio llegan al número general. Pídele al administrador que lo agregue.</div>` : ''}
      <div class="two" style="margin-top:16px">
        <div class="box"><h2>Qué hacer hoy</h2>${tareas.length ? `<ul class="lead-list" style="list-style:none;padding:0;margin:0">${tareas.join('')}</ul>` : '<div class="empty">Todo al día. No hay leads nuevos ni pedidos sin pago.</div>'}</div>
        <div class="box"><h2>Últimas ventas</h2>${S.ventas.length ? `<table class="table"><tbody>${S.ventas.slice(0, 8).map(v => `<tr class="row" data-venta="${v.folio}"><td><b>${v.folio}</b><small>${esc(v.cliente.nombre)}</small></td><td>${badge(v.estado)}</td><td class="num">${fmt(v.total)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Aún no hay ventas.</div>'}</div>
      </div>`, `Hola, ${esc(S.yo.nombre.split(' ')[0])}`, new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
      `${'Notification' in window && Notification.permission === 'default' ? '<button class="btn sm" id="avisos">🔔 Activar avisos</button>' : ''}<button class="btn gold sm" id="nuevaVenta">+ Nuevo pedido</button><button class="btn sm" id="nuevoLead">+ Nuevo lead</button>`);
    enlazarComunes();
    const av = $('#avisos'); if (av) av.onclick = async () => { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Listo: te avisaremos cuando te llegue un lead' : 'No se activaron los avisos'); render(); };
    const rp = $('#repartir'); if (rp) rp.onclick = async e => { e.preventDefault(); const r = await api('/api/datos?c=leads', { accion: 'repartir' }); toast(r.asignados + ' leads asignados'); await cargar(); render(); };
  }
  const saludoLead = l => `Hola ${esc((l.nombre || '').split(' ')[0])}, soy ${S.yo.nombre.split(' ')[0]} de Cardian Muebles. Vi que pediste informes${l.producto ? ' de ' + l.producto : ''}. ¿Te paso el precio directo y los colores disponibles?`;
  // Captura rápida: quien ve un chat nuevo en el WhatsApp Business pega el número aquí y el sistema
  // lo asigna al azar parejo. Si el número ya es lead de alguien, avisa a quién le toca.
  function rapidaHtml() {
    return `<form class="box rapida" id="rapida" style="margin:16px 0;padding:14px 16px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline"><h2 style="margin:0 0 10px;font-size:14px">¿Llegó un chat nuevo al WhatsApp? Captúralo aquí</h2><span class="note">Pega el número tal como sale en WhatsApp; el sistema lo asigna solo.</span></div>
      <div style="display:grid;grid-template-columns:1.1fr 1fr 1fr auto;gap:8px" class="rapida-g">
        <input class="input" id="rT" inputmode="tel" placeholder="Número (+52 1 55…)" autocomplete="off">
        <input class="input" id="rN" placeholder="Nombre" autocomplete="off">
        <input class="input" id="rP" placeholder="¿Qué busca?" list="prodsR" autocomplete="off"><datalist id="prodsR">${S.catalogo.productos.map(p => `<option value="${esc(p.nombre)}">`).join('')}</datalist>
        <button class="btn gold sm" type="submit">Agregar y asignar</button>
      </div>${!admin() ? `<label class="chk" style="margin-top:8px"><input type="checkbox" id="rM"> Es un cliente que yo traje (me lo quedo)</label>` : ''}<div id="rRes" class="note" style="margin-top:8px"></div></form>`;
  }
  function enlazarRapida() {
    const f = $('#rapida'); if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault();
      const tel = $('#rT').value.replace(/\D/g, '');
      if (tel.length < 10) return toast('Pega el número completo');
      try {
        const r = await api('/api/datos?c=leads', { accion: 'crear', tel: $('#rT').value, nombre: $('#rN').value, producto: $('#rP').value, origen: 'whatsapp', mio: $('#rM') ? $('#rM').checked : false });
        const quien = r.lead.vendedorId ? nombreU(r.lead.vendedorId) : null;
        await cargar(); render();
        const res = $('#rRes'); if (res) res.innerHTML = quien ? `<b style="color:var(--ok)">Listo:</b> ${esc(r.lead.nombre || r.lead.tel)} quedó asignado a <b>${esc(quien)}</b>. Ponle la etiqueta «${esc(quien.split(' ')[0])}» en WhatsApp Business.` : `<b style="color:var(--warn)">Guardado sin vendedor:</b> no hay vendedores activos que reciban leads.`;
      } catch (x) { const res = $('#rRes'); if (res) res.innerHTML = `<b style="color:var(--warn)">${esc(x.message)}</b>`; else toast(x.message); }
    };
  }
  function enlazarComunes() {
    enlazarRapida();
    $$('[data-venta]').forEach(el => el.onclick = e => { if (e.target.closest('a,button')) return; detalleVenta(el.dataset.venta); });
    $$('[data-lead]').forEach(el => el.onclick = e => { if (e.target.closest('a,button')) return; detalleLead(el.dataset.lead); });
    const nv = $('#nuevaVenta'); if (nv) nv.onclick = () => formVenta();
    const nl = $('#nuevoLead'); if (nl) nl.onclick = () => formLead();
  }

  // ───────── Ventas ─────────
  function vistaVentas() {
    const f = S.filtros.v || (S.filtros.v = { q: '', estado: '', etapa: '', sucursal: '', origen: '', vendedor: '' });
    const lista = S.ventas.filter(v => (!f.estado || v.estado === f.estado) && (!f.etapa || (v.etapa || 'recibido') === f.etapa) && (!f.sucursal || v.sucursal === f.sucursal) && (!f.origen || v.origen === f.origen) && (!f.vendedor || v.vendedorId === f.vendedor)
      && (!f.q || (v.folio + ' ' + v.cliente.nombre + ' ' + v.cliente.tel + ' ' + v.lineas.map(l => l.nombre).join(' ')).toLowerCase().includes(f.q.toLowerCase())));
    const tot = lista.reduce((s, v) => s + (v.estado === 'cancelado' ? 0 : v.total), 0), cob = lista.reduce((s, v) => s + pagado(v), 0);
    shell(`
      <div class="filters">
        <input class="input buscar" id="fq" placeholder="Buscar folio, cliente, teléfono…" value="${esc(f.q)}">
        <select class="input" id="fe">${opts(Object.entries(ESTADO_V), f.estado, 'Todos los pagos')}</select>
        <select class="input" id="fet">${opts(Object.entries(ETAPA_V), f.etapa || '', 'Todas las etapas')}</select>
        ${S.sucursales.length ? `<select class="input" id="fs">${opts(S.sucursales, f.sucursal, 'Todas las sucursales')}</select>` : ''}
        <select class="input" id="fo">${opts(Object.entries(ORIGEN), f.origen, 'Todos los orígenes')}</select>
        ${admin() ? `<select class="input" id="fv">${opts(S.usuarios.filter(u => u.rol === 'vendedor' || S.ventas.some(v => v.vendedorId === u.id)).map(u => [u.id, u.nombre]), f.vendedor, 'Todos los vendedores')}</select>` : ''}
        <span class="note">${lista.length} venta${lista.length === 1 ? '' : 's'} · ${fmt(tot)} · cobrado ${fmt(cob)}</span>
      </div>
      <div class="table-wrap">${lista.length ? `<table class="table"><thead><tr><th>Folio</th><th>Cliente</th><th>Artículos</th><th>Pago</th><th>Pedido</th><th>Origen</th>${admin() ? '<th>Vendedor</th>' : ''}<th>Sucursal</th><th class="num">Total</th><th class="num">Saldo</th></tr></thead><tbody>
        ${lista.map(v => `<tr class="row" data-venta="${v.folio}"><td><b>${v.folio}</b><small>${dia(v.creado)}</small></td><td>${esc(v.cliente.nombre)}<small>${v.cliente.tel}</small></td><td>${v.lineas.map(l => `${l.qty} × ${esc(l.nombre)}${l.colorNombre ? ' · ' + esc(l.colorNombre) : ''}`).join('<br>')}</td><td>${badge(v.estado)}</td><td>${badge(v.etapa || 'recibido', ETAPA_V)}</td><td><span class="badge origen">${ORIGEN[v.origen] || v.origen}</span></td>${admin() ? `<td>${esc(nombreU(v.vendedorId))}</td>` : ''}<td>${esc(v.sucursal || '—')}</td><td class="num">${fmt(v.total)}</td><td class="num">${saldo(v) ? `<b style="color:var(--warn)">${fmt(saldo(v))}</b>` : '<span style="color:var(--ok)">Pagado</span>'}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No hay ventas con esos filtros.</div>'}</div>`,
      admin() ? 'Ventas' : 'Mis ventas', 'Pedidos del sitio, ventas de sucursal y pagos de Mercado Pago, en un solo lugar.',
      `<button class="btn gold sm" id="nuevaVenta">+ Nuevo pedido</button>${admin() && S.ajustes.mpConfigurado ? '<button class="btn sm" id="sync">Sincronizar Mercado Pago</button>' : ''}`);
    enlazarComunes();
    const on = (id, k) => { const el = $('#' + id); if (el) el.oninput = el.onchange = () => { f[k] = el.value; vistaVentas(); if (k === 'q') { const i = $('#fq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }; };
    on('fq', 'q'); on('fe', 'estado'); on('fet', 'etapa'); on('fs', 'sucursal'); on('fo', 'origen'); on('fv', 'vendedor');
    const sy = $('#sync'); if (sy) sy.onclick = sincronizarMP;
  }
  async function sincronizarMP() {
    toast('Consultando Mercado Pago…');
    try { const r = await api('/api/mp', { accion: 'sincronizar', dias: 30 }); toast(`${r.revisados} pagos revisados · ${r.aplicados} aplicados · ${r.sueltos.length} sin pedido`); await cargar(); render(); } catch (e) { toast(e.message); }
  }

  // Formulario de venta (nueva, o a partir de un lead)
  function formVenta(lead) {
    const C = S.catalogo; let lineas = [{ id: C.productos[0].id, color: '', qty: 1, unit: 0, nombre: '' }];
    const prodOpts = v => opts(C.productos.map(p => [p.id, p.nombre + ' · ' + fmt(p.precio)]).concat([['__manual', 'Otro artículo (escribir)']]), v);
    const lineaHtml = (l, i) => { const p = C.productos.find(x => x.id === l.id); return `<div class="linea" data-i="${i}">
      <select class="input" data-k="id">${prodOpts(l.id || '__manual')}</select>
      ${p ? `<select class="input" data-k="color">${opts([['', 'Color…']].concat(p.tapiz.map(t => [t, C.tapiz[t].name])), l.color)}</select>` : `<input class="input" data-k="nombre" placeholder="Nombre del artículo" value="${esc(l.nombre)}">`}
      <input class="input" data-k="qty" type="number" min="1" value="${l.qty}">
      <input class="input" data-k="unit" type="number" min="0" value="${p ? precioDe(p, l.color) : l.unit}" ${p ? 'readonly' : ''} title="${p ? 'Precio de lista' : 'Precio unitario'}">
      <button type="button" class="x" data-del>×</button></div>`; };
    const precioDe = (p, color) => p.precio;
    const calc = () => { const sub = lineas.reduce((s, l) => { const p = C.productos.find(x => x.id === l.id); return s + (p ? p.precio : +l.unit || 0) * (+l.qty || 1); }, 0); const env = +($('#envCosto') && $('#envCosto').value) || 0; const desc = +($('#desc') && $('#desc').value) || 0; const base = Math.max(0, sub + env - desc); const iva = $('#facV') && $('#facV').checked ? Math.round(base * 0.16) : 0; return { sub, env, desc, iva, total: base + iva }; };
    const m = modal(lead ? 'Registrar venta de ' + esc(lead.nombre || lead.tel) : 'Nuevo pedido', `
      <div class="fields">
        <div class="field"><label>Cliente</label><input class="input" id="cNombre" value="${esc(lead ? lead.nombre : '')}" placeholder="Nombre completo"></div>
        <div class="field"><label>WhatsApp (10 dígitos)</label><input class="input" id="cTel" inputmode="tel" value="${esc(lead ? lead.tel : '')}"></div>
        <div class="field"><label>Correo (opcional)</label><input class="input" id="cEmail" type="email"></div>
        <div class="field"><label>¿Dónde compró?</label><select class="input" id="origen">${opts(Object.entries(ORIGEN), lead ? (lead.origen === 'sitio' ? 'whatsapp' : lead.origen) : 'sucursal')}</select></div>
        <div class="field"><label>Sucursal</label>${S.sucursales.length ? `<select class="input" id="suc">${opts(S.sucursales, S.yo.sucursal || S.sucursales[0], 'Sin sucursal')}</select>` : `<input class="input" id="suc" value="${esc(S.yo.sucursal || '')}" placeholder="Opcional">`}</div>
        ${admin() ? `<div class="field"><label>Vendedor</label><select class="input" id="vend">${opts(S.usuarios.filter(u => u.activo).map(u => [u.id, u.nombre]), lead && lead.vendedorId ? lead.vendedorId : S.yo.id)}</select></div>` : ''}
      </div>
      <div class="field"><label>Artículos</label><div class="lineas" id="lineas"></div><button type="button" class="btn sm" id="addL" style="margin-top:8px">+ Agregar artículo</button></div>
      <div class="fields">
        <div class="field"><label>Entrega</label><select class="input" id="envTipo"><option value="bodega">Recoger en bodega</option><option value="domicilio">Envío a domicilio</option></select></div>
        <div class="field"><label>Estado de entrega</label><select class="input" id="envEstado">${opts(C.estados, 'Ciudad de México')}</select></div>
        <div class="field full" id="dirWrap" hidden><label>Dirección</label><input class="input" id="envDir" placeholder="Calle, número, colonia, municipio"></div>
        <div class="field"><label>Costo de envío</label><input class="input" id="envCosto" type="number" min="0" value="0"><span class="note">Se sugiere con la tarifa del estado; puedes cambiarlo.</span></div>
        <div class="field"><label>Descuento</label><input class="input" id="desc" type="number" min="0" value="0"></div>
        <div class="field"><label>Pago inicial (opcional)</label><input class="input" id="p0" type="number" min="0" placeholder="0"></div>
        <div class="field"><label>Método del pago</label><select class="input" id="p0m">${opts(METODOS, 'efectivo')}</select></div>
        <div class="field full"><label>Notas internas</label><input class="input" id="notas" placeholder="Referencia, acuerdos, lo que se platicó…"></div>
        <div class="field full"><label class="chk"><input type="checkbox" id="facV"> Necesita factura (se agrega IVA 16 %)</label></div>
        <div class="field" data-fac hidden><label>Razón social</label><input class="input" id="facR"></div>
        <div class="field" data-fac hidden><label>RFC</label><input class="input" id="facRfc" maxlength="13"></div>
      </div>
      <h2 style="font-size:14px;margin:16px 0 6px">Seguimiento del pedido</h2>
      <div class="fields">
        <div class="field"><label>Etapa</label><select class="input" id="etV">${opts(Object.entries(ETAPA_V), 'recibido')}</select></div>
        <div class="field"><label>Fecha estimada de entrega</label><input class="input" type="date" id="feV"></div>
        <div class="field full"><label>Nota para el cliente (opcional)</label><input class="input" id="ncV" maxlength="240" placeholder="Ej. Te llamamos un día antes de la entrega"></div>
        <div class="field full"><label class="chk"><input type="checkbox" id="avisarV" checked> Al guardar, mandarle al cliente su folio por WhatsApp</label></div>
      </div>
      <div class="totales" id="tot"></div>`,
      `<button class="btn primary sm" id="guardarV">Guardar y generar folio</button>`, { wide: true });
    const pintar = () => { $('#lineas').innerHTML = lineas.map(lineaHtml).join(''); $$('#lineas .linea').forEach(row => {
      const i = +row.dataset.i;
      $$('[data-k]', row).forEach(inp => inp.onchange = inp.oninput = () => { const k = inp.dataset.k; if (k === 'id') { if (inp.value === '__manual') { lineas[i] = { id: null, nombre: '', unit: 0, qty: lineas[i].qty, color: '' }; } else { lineas[i] = { id: inp.value, color: '', qty: lineas[i].qty }; } pintar(); } else { lineas[i][k] = inp.value; totales(); } });
      $('[data-del]', row).onclick = () => { if (lineas.length > 1) { lineas.splice(i, 1); pintar(); } };
    }); totales(); };
    const totales = () => { const c = calc(); $('#tot').innerHTML = `<div><span>Subtotal</span><span>${fmt(c.sub)}</span></div><div><span>Envío</span><span>${fmt(c.env)}</span></div>${c.desc ? `<div><span>Descuento</span><span>−${fmt(c.desc)}</span></div>` : ''}${c.iva ? `<div><span>IVA 16 % (factura)</span><span>${fmt(c.iva)}</span></div>` : ''}<div class="t"><span>Total</span><span>${fmt(c.total)}</span></div>`; };
    const sugerirEnvio = () => { if ($('#envTipo').value !== 'domicilio') { $('#envCosto').value = 0; totales(); return; } const D = window.CARDIAN; const base = D.rates[$('#envEstado').value] || 0; const piezas = lineas.flatMap(l => { const p = window.CARDIAN.products.find(x => x.id === l.id); return Array(+l.qty || 1).fill(p ? p.factor || 1 : 1); }).sort((a, b) => b - a); $('#envCosto').value = Math.round(piezas.reduce((s, f, i) => s + base * f * (i ? 0.6 : 1), 0)); totales(); };
    pintar();
    $('#addL').onclick = () => { lineas.push({ id: C.productos[0].id, color: '', qty: 1 }); pintar(); };
    $('#envTipo').onchange = () => { $('#dirWrap').hidden = $('#envTipo').value !== 'domicilio'; sugerirEnvio(); };
    $('#envEstado').onchange = sugerirEnvio; $('#envCosto').oninput = totales; $('#desc').oninput = totales;
    $('#facV').onchange = () => { $$('[data-fac]').forEach(x => x.hidden = !$('#facV').checked); totales(); };
    $('#guardarV').onclick = async () => {
      const tel = $('#cTel').value.replace(/\D/g, '');
      if ($('#cNombre').value.trim().length < 2) return toast('Escribe el nombre del cliente');
      if (tel.length !== 10) return toast('El WhatsApp debe tener 10 dígitos');
      if ($('#envTipo').value === 'domicilio' && $('#envDir').value.trim().length < 5) return toast('Escribe la dirección de entrega');
      if ($('#facV').checked && ($('#facR').value.trim().length < 2 || $('#facRfc').value.trim().length < 12)) return toast('Escribe razón social y RFC para la factura');
      try {
        const r = await api('/api/datos?c=ventas', { accion: 'crear', cliente: { nombre: $('#cNombre').value, tel, email: $('#cEmail').value }, origen: $('#origen').value, sucursal: $('#suc').value, vendedorId: $('#vend') ? $('#vend').value : undefined,
          lineas: lineas.map(l => ({ id: l.id, color: l.color || undefined, qty: +l.qty || 1, nombre: l.nombre, unit: +l.unit || 0 })),
          envio: { tipo: $('#envTipo').value, estado: $('#envEstado').value, direccion: $('#envDir').value, costo: +$('#envCosto').value || 0, descuento: +$('#desc').value || 0 },
          pagoInicial: +$('#p0').value ? { monto: +$('#p0').value, metodo: $('#p0m').value } : null, notas: $('#notas').value, leadId: lead ? lead.id : null,
          factura: $('#facV').checked ? { razon: $('#facR').value.trim(), rfc: $('#facRfc').value.trim().toUpperCase() } : null,
          etapa: $('#etV').value, fechaEntrega: $('#feV').value, notaCliente: $('#ncV').value.trim() });
        const avisar = $('#avisarV').checked;
        m.cerrar(); toast('Pedido ' + r.venta.folio + ' guardado'); await cargar(); render(); await detalleVenta(r.venta.folio, r.k);
        if (avisar) enviarEstado(r.venta.folio, r.k);
      } catch (e) { toast(e.message); }
    };
  }

  // Detalle de una venta: pagos, estado, ticket, WhatsApp, Mercado Pago
  async function detalleVenta(folio, kConocida) {
    const v = S.ventas.find(x => x.folio === folio); if (!v) return;
    let k = kConocida; if (!k) { try { k = (await api('/api/ticket?f=' + folio)).k; } catch (e) { k = ''; } }
    const url = location.origin + ticketUrl(folio, k);
    const waTicket = `Hola ${(v.cliente.nombre || '').split(' ')[0]}, te comparto tu ticket ${folio} de Cardian Muebles: total ${fmt(v.total)}, ${saldo(v) > 0 ? 'pagado ' + fmt(pagado(v)) + ', saldo ' + fmt(saldo(v)) : 'pagado completo'}. Lo puedes ver aquí: ${url}`;
    const pintar = () => {
      const vv = S.ventas.find(x => x.folio === folio);
      $('#dv').innerHTML = `
        <div class="two">
          <div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">${badge(vv.estado)}<span class="badge origen">${ORIGEN[vv.origen] || vv.origen}</span><span class="note">${fecha(vv.creado)}${vv.sucursal ? ' · ' + esc(vv.sucursal) : ''} · ${esc(nombreU(vv.vendedorId))}</span></div>
            <div class="box" style="padding:14px 16px;margin-bottom:12px"><b>${esc(vv.cliente.nombre)}</b> <span class="note">${vv.cliente.tel}${vv.cliente.email ? ' · ' + esc(vv.cliente.email) : ''}</span><div class="note" style="margin-top:4px">${vv.envio.tipo === 'domicilio' ? 'Envío a ' + esc(vv.envio.direccion || '') + ' · ' + esc(vv.envio.estado) : 'Recoger en bodega'}${vv.factura ? ' · Factura: ' + esc(vv.factura.razon) + ' ' + esc(vv.factura.rfc) : ''}</div>${vv.notas ? `<div class="note" style="margin-top:4px">Notas: ${esc(vv.notas)}</div>` : ''}</div>
            <table class="table"><tbody>${vv.lineas.map(l => `<tr><td>${l.qty} × ${esc(l.nombre)}${l.colorNombre ? `<small>Color ${esc(l.colorNombre)}</small>` : ''}</td><td class="num">${fmt(l.unit * l.qty)}</td></tr>`).join('')}</tbody></table>
            <div class="totales"><div><span>Subtotal</span><span>${fmt(vv.sub)}</span></div><div><span>Envío</span><span>${vv.costoEnvio ? fmt(vv.costoEnvio) : 'Gratis'}</span></div>${vv.descuento ? `<div><span>Descuento</span><span>−${fmt(vv.descuento)}</span></div>` : ''}${vv.iva ? `<div><span>IVA 16 % (factura)</span><span>${fmt(vv.iva)}</span></div>` : ''}<div class="t"><span>Total</span><span>${fmt(vv.total)}</span></div></div>
            <h2 style="font-size:14px;margin:16px 0 6px">Historial</h2><ul class="hist">${(vv.historial || []).slice().reverse().slice(0, 12).map(h => `<li><time>${fecha(h.cuando)}</time><span><b>${esc(h.quien)}</b> · ${esc(h.que)}</span></li>`).join('')}</ul>
          </div>
          <div>
            <div class="box" style="padding:14px 16px;margin-bottom:12px;border-color:var(--gold)"><h2 style="font-size:14px">Seguimiento del pedido</h2>
              <div class="etapas">${EstadoPedido.etapasDe(vv).map((e, n) => `<button type="button" data-et="${e.id}" class="${n < EstadoPedido.indice(vv) ? 'hecho' : ''} ${n === EstadoPedido.indice(vv) ? 'on hecho' : ''}"><i>${n <= EstadoPedido.indice(vv) ? '✓' : ''}</i>${e.t}<small>${n <= EstadoPedido.indice(vv) ? EstadoPedido.fechaCorta(EstadoPedido.cuandoEtapa(vv, e.id)) : ''}</small></button>`).join('')}</div>
              <div class="fields" style="margin-top:12px"><div class="field"><label>Fecha estimada de entrega</label><input class="input" type="date" id="feEnt" value="${vv.fechaEntrega || ''}"></div><div class="field"><label>Nota para el cliente (opcional)</label><input class="input" id="notaCli" maxlength="240" value="${esc(vv.notaCliente || '')}" placeholder="Ej. Te llamamos un día antes"></div></div>
              <div style="display:grid;gap:8px;margin-top:10px"><button class="btn sm" id="guardaSeg">Guardar fecha y nota</button><button class="btn gold sm" id="enviarEstado">Enviar estado al cliente</button></div>
            </div>
            <div class="box" style="padding:14px 16px"><h2 style="font-size:14px">Pagos</h2>
              <div class="pagos">${(vv.pagos || []).map(p => `<div><span>${fecha(p.cuando)}<br><small>${esc(p.metodo)}${p.ref ? ' · ' + esc(p.ref) : ''} · ${esc(p.quien || '')}</small></span><span class="num"><b>${fmt(p.monto)}</b>${admin() ? ` <button class="x" data-qp="${p.id}" title="Quitar" style="border:none;background:none;cursor:pointer;color:var(--muted)">×</button>` : ''}</span></div>`).join('') || '<div class="note">Sin pagos todavía.</div>'}</div>
              <div class="saldo"><span>${saldo(vv) > 0 ? 'Saldo por cobrar' : 'Pagado completo'}</span><b>${saldo(vv) > 0 ? fmt(saldo(vv)) : fmt(pagado(vv))}</b></div>
              ${saldo(vv) > 0 && vv.estado !== 'cancelado' ? `<div class="fields" style="margin-top:12px"><div class="field"><label>Registrar pago</label><input class="input" id="abMonto" type="number" min="1" placeholder="${saldo(vv)}"></div><div class="field"><label>Método</label><select class="input" id="abMet">${opts(METODOS, 'efectivo')}</select></div><div class="field full"><input class="input" id="abRef" placeholder="Referencia o nota (opcional)"></div></div><button class="btn primary sm" id="abonar" style="width:100%">Guardar pago</button>${S.ajustes.mpConfigurado ? `<button class="btn sm" id="mpLink" style="width:100%;margin-top:8px">Enlace de pago Mercado Pago</button>` : ''}` : ''}
            </div>
            <div class="box" style="padding:14px 16px;margin-top:12px"><h2 style="font-size:14px">Estado del pago</h2><select class="input" id="estV">${opts(Object.entries(ESTADO_V), vv.estado)}</select>
              <div style="display:grid;gap:8px;margin-top:12px"><a class="btn ink sm" style="background:var(--ink);color:var(--ink-fg)" href="${ticketUrl(folio, k)}" target="_blank" rel="noopener">Ver / imprimir ticket</a>${vv.cliente.tel ? `<a class="btn wa sm" href="${waLink(vv.cliente.tel, waTicket)}" target="_blank" rel="noopener">Mandar ticket por WhatsApp</a>` : ''}<button class="btn sm" id="editV">Editar datos del cliente</button><button class="btn sm" id="notaV">Agregar nota</button></div>
            </div>
          </div>
        </div>`;
      const ab = $('#abonar'); if (ab) ab.onclick = async () => { const monto = +$('#abMonto').value; if (!monto) return toast('Escribe el monto'); try { await api('/api/datos?c=ventas', { accion: 'abonar', folio, monto, metodo: $('#abMet').value, ref: $('#abRef').value }); toast('Pago registrado'); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      $$('[data-qp]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar este pago?')) return; try { await api('/api/datos?c=ventas', { accion: 'quitarPago', folio, pagoId: b.dataset.qp }); await cargar(); pintar(); } catch (e) { toast(e.message); } });
      const guardarSeg = async datos => { await api('/api/datos?c=ventas', { accion: 'etapa', folio, ...datos }); await cargar(); pintar(); };
      $$('[data-et]').forEach(b => b.onclick = async () => { try { await guardarSeg({ etapa: b.dataset.et, fechaEntrega: $('#feEnt').value, notaCliente: $('#notaCli').value }); toast('Pedido: ' + ETAPA_V[b.dataset.et]); enviarEstado(folio, k); } catch (e) { toast(e.message); } });
      $('#guardaSeg').onclick = async () => { try { await guardarSeg({ fechaEntrega: $('#feEnt').value, notaCliente: $('#notaCli').value }); toast('Guardado'); } catch (e) { toast(e.message); } };
      $('#enviarEstado').onclick = async () => { try { await guardarSeg({ fechaEntrega: $('#feEnt').value, notaCliente: $('#notaCli').value }); } catch (e) {} enviarEstado(folio, k); };
      $('#estV').onchange = async () => { try { await api('/api/datos?c=ventas', { accion: 'estado', folio, estado: $('#estV').value }); toast('Estado actualizado'); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      const mpb = $('#mpLink'); if (mpb) mpb.onclick = async () => { try { const r = await api('/api/mp', { accion: 'enlace', folio }); await navigator.clipboard.writeText(r.url).catch(() => {}); toast('Enlace de pago copiado'); window.open(r.url, '_blank'); } catch (e) { toast(e.message); } };
      $('#editV').onclick = () => { const vv2 = S.ventas.find(x => x.folio === folio); const m2 = modal('Editar venta ' + folio, `<div class="fields"><div class="field"><label>Nombre</label><input class="input" id="eN" value="${esc(vv2.cliente.nombre)}"></div><div class="field"><label>WhatsApp</label><input class="input" id="eT" value="${vv2.cliente.tel}"></div><div class="field"><label>Correo</label><input class="input" id="eE" value="${esc(vv2.cliente.email || '')}"></div><div class="field"><label>Sucursal</label><input class="input" id="eS" value="${esc(vv2.sucursal || '')}"></div>${admin() ? `<div class="field"><label>Vendedor</label><select class="input" id="eV">${opts(S.usuarios.map(u => [u.id, u.nombre]), vv2.vendedorId, 'Sin vendedor')}</select></div>` : ''}<div class="field full"><label>Dirección de entrega</label><input class="input" id="eD" value="${esc(vv2.envio.direccion || '')}"></div><div class="field full"><label>Notas</label><input class="input" id="eNo" value="${esc(vv2.notas || '')}"></div></div>`, `<button class="btn primary sm" id="okE">Guardar</button>`);
        $('#okE').onclick = async () => { try { await api('/api/datos?c=ventas', { accion: 'editar', folio, cliente: { nombre: $('#eN').value, tel: $('#eT').value, email: $('#eE').value }, sucursal: $('#eS').value, vendedorId: $('#eV') ? $('#eV').value : undefined, envio: { tipo: vv2.envio.tipo, estado: vv2.envio.estado, direccion: $('#eD').value }, notas: $('#eNo').value }); m2.cerrar(); await cargar(); detalleVenta(folio, k); } catch (e) { toast(e.message); } }; };
      $('#notaV').onclick = async () => { const t = prompt('Nota para esta venta:'); if (!t) return; try { await api('/api/datos?c=ventas', { accion: 'nota', folio, texto: t }); await cargar(); pintar(); } catch (e) { toast(e.message); } };
    };
    modal('Venta ' + folio, '<div id="dv"></div>', '', { wide: true });
    pintar();
  }

  // Enviar el estado del pedido al cliente: imagen, PDF y WhatsApp con el mensaje listo.
  async function enviarEstado(folio, k) {
    const v0 = S.ventas.find(x => x.folio === folio); if (!v0) return;
    const v = { ...v0, saldo: saldo(v0) };
    const linkTicket = location.origin + ticketUrl(folio, k);
    const puedeCompartir = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }));
    const m = modal('Enviar estado del pedido ' + folio, `<div class="envio-prev"><div><img id="prevEst" alt="Vista previa del estado"><div class="note" style="margin-top:8px;text-align:center">Imagen lista para WhatsApp</div></div>
      <div><div class="field"><label>Mensaje para ${esc((v.cliente.nombre || '').split(' ')[0] || 'el cliente')} · WhatsApp ${v.cliente.tel || 'sin número'}</label><textarea class="input" id="msgEst">${esc(EstadoPedido.mensaje(v, k))}</textarea></div>
        <div class="acts">
          ${puedeCompartir ? '<button class="btn wa" id="shEst">Compartir imagen y mensaje por WhatsApp</button>' : ''}
          ${v.cliente.tel ? '<a class="btn ' + (puedeCompartir ? '' : 'wa') + '" id="waEst" target="_blank" rel="noopener">Abrir WhatsApp del cliente con el mensaje</a>' : '<div class="aviso">Esta venta no tiene WhatsApp del cliente. Agrégalo en «Editar datos del cliente».</div>'}
          <button class="btn" id="dlEst">Descargar imagen</button>
          <a class="btn" href="${linkTicket}&imprimir=1" target="_blank" rel="noopener">Ver o guardar PDF</a>
          <button class="btn" id="cpEst">Copiar enlace de seguimiento</button>
        </div>
        <p class="note" style="margin-top:10px">${puedeCompartir ? 'En el celular, «Compartir» manda la imagen y el texto juntos: elige WhatsApp y al cliente.' : 'En computadora: descarga la imagen, abre el WhatsApp del cliente y adjúntala. El mensaje ya lleva el enlace de seguimiento.'}</p></div></div>`, '', { wide: true });
    EstadoPedido.dibujar(v).then(c => { const img = $('#prevEst'); if (img) img.src = c.toDataURL('image/png'); });
    const txt = () => $('#msgEst').value;
    const wa = $('#waEst'); if (wa) { const act = () => { wa.href = waLink(v.cliente.tel, txt()); }; act(); $('#msgEst').oninput = act; }
    const sh = $('#shEst'); if (sh) sh.onclick = async () => { const ok = await EstadoPedido.compartir({ ...v }, k).catch(() => false); if (!ok) toast('No se pudo compartir; descarga la imagen'); };
    $('#dlEst').onclick = () => EstadoPedido.descargar(v);
    $('#cpEst').onclick = () => navigator.clipboard.writeText(linkTicket).then(() => toast('Enlace copiado'));
    return m;
  }

  // ───────── Leads ─────────
  function vistaLeads() {
    const f = S.filtros.l || (S.filtros.l = { q: '', estado: '', vendedor: '', origen: '' });
    const lista = S.leads.filter(l => (!f.estado || l.estado === f.estado) && (!f.vendedor || (f.vendedor === '__sin' ? !l.vendedorId : l.vendedorId === f.vendedor)) && (!f.origen || l.origen === f.origen)
      && (!f.q || (l.nombre + ' ' + l.tel + ' ' + l.producto + ' ' + l.mensaje).toLowerCase().includes(f.q.toLowerCase())));
    const sinV = S.leads.filter(l => !l.vendedorId && !['compro', 'no-compro'].includes(l.estado)).length;
    shell(`
      ${rapidaHtml()}
      <div class="filters">
        <input class="input buscar" id="fq" placeholder="Buscar nombre, teléfono, producto…" value="${esc(f.q)}">
        <div class="sel-estado">${[['', 'Todos'], ...Object.entries(ESTADO_L)].map(([k, t]) => `<button type="button" data-fe="${k}" class="${f.estado === k ? 'on' : ''}">${t}${k ? ` (${S.leads.filter(l => l.estado === k).length})` : ''}</button>`).join('')}</div>
        ${admin() ? `<select class="input" id="fv">${opts([['__sin', 'Sin vendedor' + (sinV ? ' (' + sinV + ')' : '')]].concat(S.usuarios.filter(u => u.rol === 'vendedor').map(u => [u.id, u.nombre])), f.vendedor, 'Todos los vendedores')}</select>` : ''}
        <select class="input" id="fo">${opts(Object.entries(ORIGEN), f.origen, 'Todos los orígenes')}</select>
      </div>
      ${admin() && sinV ? `<div class="aviso">${sinV} lead${sinV > 1 ? 's' : ''} sin vendedor asignado. <a href="#" id="repartir">Repartir al azar entre los vendedores activos</a></div>` : ''}
      <div class="lead-list">${lista.length ? lista.map(l => `<div class="lead" data-lead="${l.id}">
        <div><b>${esc(l.nombre || 'Sin nombre')}</b> · ${l.tel} ${badge(l.estado, ESTADO_L)} <span class="badge origen">${ORIGEN[l.origen] || l.origen}</span>
          <div class="meta">${l.producto ? `<span>Interés: ${esc(l.producto)}</span>` : ''}<span>${hace(l.creado)}</span>${admin() ? `<span>${l.vendedorId ? esc(nombreU(l.vendedorId)) : '<b style="color:var(--warn)">sin vendedor</b>'}</span>` : ''}${l.sucursal ? `<span>${esc(l.sucursal)}</span>` : ''}${l.notas.length ? `<span>${l.notas.length} nota${l.notas.length > 1 ? 's' : ''}</span>` : ''}${l.ventaFolio ? `<span>Venta ${l.ventaFolio}</span>` : ''}</div>
          ${l.mensaje ? `<div class="note" style="margin-top:4px">«${esc(l.mensaje)}»</div>` : ''}${l.ultimoMensaje && l.ultimoMensaje.texto !== l.mensaje ? `<div class="note" style="margin-top:2px">Último mensaje ${hace(l.ultimoMensaje.cuando)}: «${esc(l.ultimoMensaje.texto)}»</div>` : ''}</div>
        <div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(l.tel, saludoLead(l))}">WhatsApp</a></div></div>`).join('') : '<div class="empty">No hay leads con esos filtros.</div>'}</div>`,
      admin() ? 'Leads' : 'Mis leads', 'Contactos que piden informes: del sitio, de WhatsApp Business o de sucursal. Cada uno se asigna al azar a un vendedor.',
      `<button class="btn gold sm" id="nuevoLead">+ Nuevo lead</button>`);
    enlazarComunes();
    $('#fq').oninput = () => { f.q = $('#fq').value; vistaLeads(); const i = $('#fq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $$('[data-fe]').forEach(b => b.onclick = () => { f.estado = b.dataset.fe; vistaLeads(); });
    const fv = $('#fv'); if (fv) fv.onchange = () => { f.vendedor = fv.value; vistaLeads(); };
    $('#fo').onchange = () => { f.origen = $('#fo').value; vistaLeads(); };
    const rp = $('#repartir'); if (rp) rp.onclick = async e => { e.preventDefault(); const r = await api('/api/datos?c=leads', { accion: 'repartir' }); toast(r.asignados + ' leads asignados'); await cargar(); render(); };
  }
  function formLead() {
    const m = modal('Nuevo lead', `
      <p class="note" style="margin-bottom:12px">Cuando te escriban por WhatsApp Business, anota aquí el contacto: así queda en el sistema y se le da seguimiento.</p>
      <div class="fields">
        <div class="field"><label>Nombre</label><input class="input" id="lN" placeholder="Como aparece en WhatsApp"></div>
        <div class="field"><label>WhatsApp (10 dígitos)</label><input class="input" id="lT" inputmode="tel"></div>
        <div class="field"><label>¿Qué le interesa?</label><input class="input" id="lP" list="prods" placeholder="Sala Tokio, comedor…"><datalist id="prods">${S.catalogo.productos.map(p => `<option value="${esc(p.nombre)}">`).join('')}</datalist></div>
        <div class="field"><label>Origen</label><select class="input" id="lO">${opts(Object.entries(ORIGEN).filter(([k]) => k !== 'sitio' && k !== 'mercado-pago'), 'whatsapp')}</select></div>
        ${S.sucursales.length ? `<div class="field"><label>Sucursal</label><select class="input" id="lS">${opts(S.sucursales, S.yo.sucursal, 'Sin sucursal')}</select></div>` : ''}
        ${admin() ? `<div class="field"><label>Asignar a</label><select class="input" id="lV">${opts([['', 'Al azar parejo entre vendedores activos']].concat(S.usuarios.filter(u => u.activo).map(u => [u.id, u.nombre])), '')}</select></div>` : `<div class="field" style="display:flex;align-items:end"><label class="chk"><input type="checkbox" id="lMio"> Es un cliente que yo traje (me lo quedo)</label></div>`}
        <div class="field full"><label>Mensaje o nota</label><input class="input" id="lM" placeholder="Lo que preguntó"></div>
      </div>`, `<button class="btn primary sm" id="okL">Guardar lead</button>`);
    $('#okL').onclick = async () => {
      try { const r = await api('/api/datos?c=leads', { accion: 'crear', nombre: $('#lN').value, tel: $('#lT').value, producto: $('#lP').value, origen: $('#lO').value, sucursal: $('#lS') ? $('#lS').value : '', vendedorId: $('#lV') ? $('#lV').value : undefined, mio: $('#lMio') ? $('#lMio').checked : false, mensaje: $('#lM').value }); m.cerrar(); toast('Lead guardado' + (r.lead.vendedorId ? ' · ' + nombreU(r.lead.vendedorId) : '')); await cargar(); render(); }
      catch (e) { if (/ya está como lead/.test(e.message) && confirm(e.message + '\n¿Guardarlo de todos modos?')) { try { await api('/api/datos?c=leads', { accion: 'crear', nombre: $('#lN').value, tel: $('#lT').value, producto: $('#lP').value, origen: $('#lO').value, mensaje: $('#lM').value, forzar: true }); m.cerrar(); await cargar(); render(); } catch (x) { toast(x.message); } } else toast(e.message); }
    };
  }
  function detalleLead(id) {
    const pintar = () => {
      const l = S.leads.find(x => x.id === id); if (!l) return cerrarModal();
      $('#dl').innerHTML = `
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">${badge(l.estado, ESTADO_L)}<span class="badge origen">${ORIGEN[l.origen] || l.origen}</span><span class="note">${fecha(l.creado)} · ${l.vendedorId ? esc(nombreU(l.vendedorId)) : 'sin vendedor'}${l.sucursal ? ' · ' + esc(l.sucursal) : ''}</span></div>
        <div class="two">
          <div>
            <div class="box" style="padding:14px 16px"><b style="font-size:16px">${esc(l.nombre || 'Sin nombre')}</b><div class="note">WhatsApp ${l.tel}${l.producto ? ' · Interés: ' + esc(l.producto) : ''}</div>${l.mensaje ? `<div style="margin-top:6px;font-size:13.5px">«${esc(l.mensaje)}»</div>` : ''}
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(l.tel, saludoLead(l))}">Escribirle por WhatsApp</a><a class="btn sm" href="tel:${l.tel}">Llamar</a>${l.estado !== 'compro' ? `<button class="btn gold sm" id="convertir">Registrar venta</button>` : `<button class="btn sm" id="verVenta">Ver venta ${l.ventaFolio}</button>`}</div></div>
            <h2 style="font-size:14px;margin:14px 0 6px">Estado del lead</h2>
            <div class="sel-estado">${Object.entries(ESTADO_L).map(([k, t]) => `<button type="button" data-est="${k}" class="${l.estado === k ? 'on' : ''}">${t}</button>`).join('')}</div>
            <div class="field" style="margin-top:12px"><label>Nota</label><div style="display:flex;gap:8px"><input class="input" id="nota" placeholder="Qué pasó en la llamada, qué cotizaste…"><button class="btn sm" id="okNota">Guardar</button></div></div>
            ${admin() ? `<div class="field"><label>Vendedor</label><select class="input" id="asig">${opts(S.usuarios.filter(u => u.activo).map(u => [u.id, u.nombre]), l.vendedorId, 'Sin vendedor')}</select></div>` : ''}
            <button class="btn sm" id="editL">Editar datos</button>
          </div>
          <div>
            <h2 style="font-size:14px;margin:0 0 6px">Notas</h2>${l.notas.length ? `<ul class="hist">${l.notas.slice().reverse().map(n => `<li><time>${fecha(n.cuando)}</time><span><b>${esc(n.quien)}</b> · ${esc(n.texto)}</span></li>`).join('')}</ul>` : '<div class="note">Sin notas.</div>'}
            <h2 style="font-size:14px;margin:14px 0 6px">Historial</h2><ul class="hist">${(l.historial || []).slice().reverse().map(h => `<li><time>${fecha(h.cuando)}</time><span>${esc(h.que)}</span></li>`).join('')}</ul>
          </div>
        </div>`;
      $$('[data-est]').forEach(b => b.onclick = async () => { try { await api('/api/datos?c=leads', { accion: 'estado', id, estado: b.dataset.est, nota: $('#nota').value }); await cargar(); pintar(); } catch (e) { toast(e.message); } });
      $('#okNota').onclick = async () => { if (!$('#nota').value.trim()) return; try { await api('/api/datos?c=leads', { accion: 'nota', id, texto: $('#nota').value }); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      const as = $('#asig'); if (as) as.onchange = async () => { try { await api('/api/datos?c=leads', { accion: 'asignar', id, vendedorId: as.value }); toast('Reasignado'); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      const cv = $('#convertir'); if (cv) cv.onclick = () => formVenta(l);
      const vv = $('#verVenta'); if (vv) vv.onclick = () => detalleVenta(l.ventaFolio);
      $('#editL').onclick = () => { const m2 = modal('Editar lead', `<div class="fields"><div class="field"><label>Nombre</label><input class="input" id="eN" value="${esc(l.nombre)}"></div><div class="field"><label>WhatsApp</label><input class="input" id="eT" value="${l.tel}"></div><div class="field full"><label>Interés</label><input class="input" id="eP" value="${esc(l.producto)}"></div><div class="field full"><label>Mensaje</label><input class="input" id="eM" value="${esc(l.mensaje)}"></div></div>`, `<button class="btn primary sm" id="okE">Guardar</button>`);
        $('#okE').onclick = async () => { try { await api('/api/datos?c=leads', { accion: 'editar', id, nombre: $('#eN').value, tel: $('#eT').value, producto: $('#eP').value, mensaje: $('#eM').value }); m2.cerrar(); await cargar(); detalleLead(id); } catch (e) { toast(e.message); } }; };
    };
    modal('Lead', '<div id="dl"></div>', '', { wide: true });
    pintar();
  }

  // ───────── Vendedores y sucursales (admin) ─────────
  const compartido = () => S.ajustes.numeroCompartido !== 'no';
  function vistaVendedores() {
    const lista = S.usuarios.slice().sort((a, b) => (b.activo - a.activo) || (a.rol === 'admin') - (b.rol === 'admin') || a.nombre.localeCompare(b.nombre));
    const hace7 = Date.now() - 7 * 864e5;
    const cuenta = u => ({ abiertos: S.leads.filter(l => l.vendedorId === u.id && !['compro', 'no-compro'].includes(l.estado)).length, semana: S.leads.filter(l => l.vendedorId === u.id && new Date(l.creado) >= hace7).length, ventas: S.ventas.filter(v => v.vendedorId === u.id && v.estado !== 'cancelado').reduce((s, v) => s + v.total, 0) });
    shell(`
      <div class="two">
        <div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Usuario</th><th>Sucursal</th><th>Leads abiertos</th><th>Leads 7 días</th><th class="num">Ventas</th><th></th></tr></thead><tbody>
          ${lista.map(u => { const c = cuenta(u); return `<tr><td><b>${esc(u.nombre)}</b><small>${u.rol === 'admin' ? 'Administrador' : 'Vendedor'}${!u.activo ? ' · <b style="color:#b4322b">desactivado</b>' : u.rol === 'vendedor' && u.recibeLeads === false ? ' · no recibe leads' : ''}${u.cambiarClave ? ' · debe cambiar contraseña' : ''}${!compartido() && u.whatsapp ? ' · WA ' + u.whatsapp : ''}</small></td><td>${esc(u.usuario)}</td><td>${esc(u.sucursal || '—')}</td><td>${c.abiertos}</td><td>${c.semana}</td><td class="num">${fmt(c.ventas)}</td><td style="white-space:nowrap"><button class="btn sm" data-edit="${u.id}">Editar</button> <button class="btn sm" data-clave="${u.id}">Contraseña</button></td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="box"><h2>Sucursales</h2><p class="note" style="margin:0 0 10px">Para filtrar ventas y leads por sucursal. Una por línea.</p><textarea class="input" id="sucs" style="min-height:110px">${esc(S.sucursales.join('\n'))}</textarea><button class="btn sm" id="okSucs" style="margin-top:8px">Guardar sucursales</button>
          <h2 style="margin-top:22px">Cómo se reparten los leads</h2><p class="note">Cada contacto nuevo (del sitio o capturado aquí) se asigna <b>al azar parejo</b>: entre los vendedores activos que reciben leads, le toca a uno de los que llevan menos en la semana. Si el lead trae sucursal y hay vendedores de esa sucursal, se reparte entre ellos.${compartido() ? ' Todos contestan desde el mismo WhatsApp Business del negocio, firmando con su nombre.' : ''}</p></div>
      </div>`, 'Usuarios', 'Agrega a tu equipo, asígnales contraseña y decide quién recibe leads. Cada quien ve solo sus leads y sus ventas.', `<button class="btn gold sm" id="nuevoU">+ Agregar usuario</button>`);
    $('#nuevoU').onclick = () => formUsuario();
    $$('[data-edit]').forEach(b => b.onclick = () => formUsuario(S.usuarios.find(u => u.id === b.dataset.edit)));
    $$('[data-clave]').forEach(b => b.onclick = () => formClave(S.usuarios.find(u => u.id === b.dataset.clave)));
    $('#okSucs').onclick = async () => { try { await api('/api/datos?c=sucursales', { lista: $('#sucs').value.split('\n') }); toast('Sucursales guardadas'); await cargar(); render(); } catch (e) { toast(e.message); } };
  }
  const datosAcceso = (nombre, usuario, clave, obligar) => `<div class="aviso ok">Pásale estos datos a ${esc(nombre)}:<br><br>Entrar en <span class="copy">${location.origin}/sistema</span><br>Usuario: <span class="copy">${esc(usuario)}</span> · Contraseña: <span class="copy">${esc(clave)}</span><br>${obligar ? 'Al entrar le pedirá crear su propia contraseña.' : 'Podrá seguir usando esta contraseña.'}</div>`;
  function formUsuario(u) {
    const m = modal(u ? 'Editar a ' + esc(u.nombre) : 'Agregar usuario', `
      <div class="fields">
        <div class="field"><label>Nombre</label><input class="input" id="uN" value="${esc(u ? u.nombre : '')}" placeholder="Nombre y apellido"></div>
        <div class="field"><label>Usuario para entrar</label><input class="input" id="uU" value="${esc(u ? u.usuario : '')}" ${u ? 'readonly' : 'placeholder="ej. maria (sin espacios)"'}></div>
        <div class="field"><label>Rol</label><select class="input" id="uR" ${u && u.id === S.yo.id ? 'disabled' : ''}>${opts([['vendedor', 'Vendedor (ve solo lo suyo)'], ['admin', 'Administrador (ve todo)']], u ? u.rol : 'vendedor')}</select></div>
        <div class="field"><label>Sucursal</label>${S.sucursales.length ? `<select class="input" id="uS">${opts(S.sucursales, u ? u.sucursal : '', 'Sin sucursal')}</select>` : `<input class="input" id="uS" value="${esc(u ? u.sucursal : '')}" placeholder="Opcional">`}</div>
        ${compartido() ? `<input type="hidden" id="uW" value="${u ? u.whatsapp || '' : ''}">` : `<div class="field"><label>WhatsApp propio (10 dígitos)</label><input class="input" id="uW" inputmode="tel" value="${u ? u.whatsapp || '' : ''}"><span class="note">A este número llegan los clientes del sitio que le toquen.</span></div>`}
        <div class="field" style="display:flex;flex-direction:column;justify-content:end;gap:8px"><label class="chk"><input type="checkbox" id="uL" ${!u || u.recibeLeads !== false ? 'checked' : ''}> Recibe leads del reparto</label>${u && u.id !== S.yo.id ? `<label class="chk"><input type="checkbox" id="uA" ${u.activo ? 'checked' : ''}> Cuenta activa (si la quitas, ya no puede entrar)</label>` : ''}</div>
        ${!u ? `<div class="field full"><label>Contraseña</label><input class="input" id="uC" placeholder="Escribe una (mínimo 10) o déjala vacía y se genera"><label class="chk" style="margin-top:8px"><input type="checkbox" id="uO" checked> Pedirle que la cambie la primera vez que entre</label></div>` : ''}
      </div>
      <div id="uTemp"></div>`,
      `${u ? `<button class="btn sm" id="uClave">Asignar contraseña</button>` : ''}<button class="btn primary sm" id="okU">${u ? 'Guardar cambios' : 'Crear usuario'}</button>`);
    $('#okU').onclick = async () => {
      try {
        const datos = { nombre: $('#uN').value, whatsapp: $('#uW').value, sucursal: $('#uS').value, rol: $('#uR').value, recibeLeads: $('#uL').checked, activo: $('#uA') ? $('#uA').checked : undefined };
        if (u) { await api('/api/datos?c=usuarios', { accion: 'editar', id: u.id, ...datos }); m.cerrar(); toast('Guardado'); }
        else { const r = await api('/api/datos?c=usuarios', { accion: 'crear', usuario: $('#uU').value, clave: $('#uC').value, obligar: $('#uO').checked, ...datos }); $('#uTemp').innerHTML = datosAcceso(r.usuario.nombre, r.usuario.usuario, r.claveTemp, $('#uO').checked); $('#okU').remove(); }
        await cargar(); if (u) render(); else vistaVendedores();
      } catch (e) { toast(e.message); }
    };
    const uc = $('#uClave'); if (uc) uc.onclick = () => formClave(u);
  }
  // El admin asigna o cambia la contraseña de cualquier usuario (la escribe él o se genera).
  function formClave(u) {
    const m = modal('Contraseña de ' + esc(u.nombre), `
      <p class="note" style="margin:0 0 12px">Usuario <b>${esc(u.usuario)}</b>. La contraseña anterior deja de servir en cuanto guardes.</p>
      <div class="field"><label>Nueva contraseña</label><div style="display:flex;gap:8px"><input class="input" id="kC" placeholder="Mínimo 10 caracteres"><button type="button" class="btn sm" id="kGen">Generar</button></div></div>
      <label class="chk"><input type="checkbox" id="kO" ${u.id === S.yo.id ? '' : 'checked'}> Pedirle que la cambie al entrar</label>
      <div id="kRes" style="margin-top:12px"></div>`,
      `<button class="btn primary sm" id="kOk">Guardar contraseña</button>`);
    $('#kGen').onclick = () => { $('#kC').value = 'Cardian' + Math.floor(1000 + Math.random() * 9000); };
    $('#kOk').onclick = async () => {
      const clave = $('#kC').value.trim();
      if (clave && clave.length < 10) return toast('Mínimo 10 caracteres');
      try { const r = await api('/api/datos?c=usuarios', { accion: 'clave', id: u.id, clave: clave || undefined, obligar: $('#kO').checked }); $('#kRes').innerHTML = datosAcceso(u.nombre, u.usuario, r.claveTemp, r.obligar); $('#kOk').remove(); await cargar(); }
      catch (e) { toast(e.message); }
    };
  }

  // ───────── Ajustes (admin) y Mi cuenta ─────────
  function vistaAjustes() {
    const a = S.ajustes;
    shell(`
      <div class="two">
        <div>
          <div class="box"><h2>Mercado Pago</h2>
            ${a.mpConfigurado ? `<div class="aviso ok">Conectado${a.mpPrueba ? ' en <b>modo prueba</b> (token TEST)' : ' en producción'}. ${a.mpWebhook ? 'Webhook con firma configurada.' : '<b>Falta MP_WEBHOOK_SECRET</b>: los avisos de pago se aceptan sin firma.'}</div><p class="note">Los pagos del sitio se aplican solos cuando Mercado Pago avisa. Si un pago no aparece, sincroniza: trae los pagos de los últimos 30 días de la cuenta y los liga por folio.</p><button class="btn sm" id="sync">Sincronizar ahora</button>` : `<div class="aviso">No conectado. En Vercel → proyecto → Settings → Environment Variables agrega <span class="copy">MP_ACCESS_TOKEN</span> (y <span class="copy">MP_WEBHOOK_SECRET</span> con la clave que da Mercado Pago en Webhooks). Al redesplegar, aquí aparece conectado.</div>`}
            <div id="sueltos"></div>
          </div>
          <div class="box" style="margin-top:14px"><h2>WhatsApp automático</h2>
            ${a.waConfigurado ? `<div class="aviso ok">Receptor listo${a.waFirma ? ' con firma de Meta' : ' (falta <b>WA_APP_SECRET</b> para validar la firma)'}. Cada mensaje nuevo al WhatsApp Business crea el lead y lo asigna solo.</div>` : `<div class="aviso">Aún no conectado. Mientras tanto, usa la captura rápida.</div>`}
            <p class="note">URL para Meta o el proveedor: <span class="copy">${location.origin}/api/wa-webhook</span><br>Variables en Vercel: <span class="copy">WA_VERIFY_TOKEN</span> (una palabra que inventas y pegas también en Meta) y <span class="copy">WA_APP_SECRET</span> (clave secreta de la app de Meta).</p>
          </div>
          <div class="box" style="margin-top:14px"><h2>Datos del negocio</h2>
            <div class="field"><label>Nombre en tickets</label><input class="input" id="aNeg" value="${esc(a.negocio || 'Cardian Muebles')}"></div>
            <div class="field"><label>WhatsApp Business del negocio (10 dígitos)</label><input class="input" id="aWa" value="${esc(a.waNegocio || '')}" placeholder="3347662784"><span class="note">El número al que escriben los clientes desde el sitio.</span></div>
            <div class="field"><label>¿Cómo atienden los vendedores?</label><select class="input" id="aComp">${opts([['si', 'Todos desde el mismo WhatsApp Business del negocio'], ['no', 'Cada vendedor con su propio número']], a.numeroCompartido === 'no' ? 'no' : 'si')}</select></div>
            <div class="field"><label>Leyenda del ticket</label><textarea class="input" id="aLey" style="min-height:80px">${esc(a.leyendaTicket || '')}</textarea></div>
            <button class="btn primary sm" id="okA">Guardar</button></div>
        </div>
        <div>
          <div class="box"><h2>Estado del sistema</h2>
            <div class="note">Datos guardados en: <b>${a.almacen === 'upstash' ? 'Upstash Redis (Vercel)' : 'archivo local de pruebas'}</b></div>
            ${a.almacen !== 'upstash' ? `<div class="aviso" style="margin-top:10px">En producción hace falta la base de datos: en Vercel → Storage → <b>Upstash for Redis</b> (plan gratis) → conectar al proyecto. Crea solas las variables KV_REST_API_URL y KV_REST_API_TOKEN.</div>` : ''}
            ${a.secretoDefault ? `<div class="aviso" style="margin-top:10px">Falta <span class="copy">CARDIAN_SECRET</span> en Vercel (cualquier texto largo al azar). Firma las sesiones y los enlaces de ticket.</div>` : ''}
            <h2 style="margin-top:18px">Mi contraseña</h2><button class="btn sm" id="clave">Cambiar mi contraseña</button>
            <h2 style="margin-top:18px">Últimos accesos</h2>${(S.accesos || []).length ? `<ul class="hist">${S.accesos.slice(0, 15).map(x => `<li><time>${fecha(x.cuando)}</time><span><b>${esc(x.usuario)}</b> · ${x.ok ? '<span style="color:var(--ok)">entró</span>' : '<span style="color:#b4322b">' + esc(x.motivo || 'falló') + '</span>'} · ${esc(x.ip)}</span></li>`).join('')}</ul>` : '<div class="note">Sin registros todavía.</div>'}
            <h2 style="margin-top:18px">Cómo usar WhatsApp Business con el sistema</h2>
            <ol style="font-size:13.5px;padding-left:18px;line-height:1.6;margin:0">
              <li><b>Del sitio:</b> los botones de WhatsApp piden nombre y número; el lead entra solo al sistema, asignado al azar parejo, y el chat llega al WhatsApp Business del negocio.</li>
              <li><b>Directo al WhatsApp:</b> quien vea un chat nuevo pega el número en «Captúralo aquí» (Hoy o Leads). El sistema dice a quién le tocó; ponle a ese chat la <b>etiqueta</b> con el nombre del vendedor en WhatsApp Business.</li>
              <li>Cada vendedor usa el WhatsApp Business del negocio en su compu o celular como <b>dispositivo vinculado</b> (WhatsApp → Dispositivos vinculados) y ve en «Mis leads» los que le tocan; contesta firmando con su nombre.</li>
              <li>Marca el estado de cada lead: contactado, sin respuesta, cotizado, compró o no compró. Si compra, <b>Registrar venta</b> genera folio y ticket.</li>
            </ol>
          </div>
        </div>
      </div>`, 'Ajustes', 'Conexiones, datos del negocio y cómo trabaja el equipo.');
    $('#okA').onclick = async () => { try { await api('/api/datos?c=ajustes', { negocio: $('#aNeg').value, waNegocio: $('#aWa').value, numeroCompartido: $('#aComp').value, leyendaTicket: $('#aLey').value }); toast('Guardado'); await cargar(); } catch (e) { toast(e.message); } };
    $('#clave').onclick = () => pedirClave(false);
    const sy = $('#sync'); if (sy) sy.onclick = async () => { await sincronizarMP(); try { const r = await api('/api/mp', { accion: 'sincronizar', dias: 30 }); if (r.sueltos.length) $('#sueltos').innerHTML = `<h2 style="margin-top:14px">Pagos sin pedido (${r.sueltos.length})</h2><p class="note">Pagos aprobados en la cuenta que no traen folio (links manuales, cobros en tienda). Lígalos a su venta:</p>${r.sueltos.map(p => `<div class="pagos"><div><span>${fecha(p.cuando)} · ${esc(p.quien)}<br><small>${esc(p.metodo)} ${esc(p.descripcion)}</small></span><span><b>${fmt(p.monto)}</b> <input class="input" style="width:110px;padding:6px;display:inline-block" placeholder="CM-1001" data-lig="${p.id}"></span></div></div>`).join('')}`; $$('[data-lig]').forEach(i => i.onchange = async () => { try { await api('/api/mp', { accion: 'ligar', pagoId: i.dataset.lig, folio: i.value.trim().toUpperCase() }); toast('Pago ligado'); await cargar(); vistaAjustes(); } catch (e) { toast(e.message); } }); } catch (e) {} };
  }
  function vistaCuenta() {
    shell(`<div class="box" style="max-width:520px"><h2>${esc(S.yo.nombre)}</h2><p class="note">Usuario <b>${esc(S.yo.usuario)}</b>${S.yo.sucursal ? ' · ' + esc(S.yo.sucursal) : ''}${S.yo.whatsapp ? ' · WhatsApp ' + S.yo.whatsapp : ''}</p><button class="btn sm" id="clave" style="margin-top:10px">Cambiar mi contraseña</button>
      <h2 style="margin-top:22px">Cómo trabajar</h2><ol style="font-size:13.5px;padding-left:18px;line-height:1.6;margin:0"><li>Abre el WhatsApp Business del negocio en tu compu o celular como <b>dispositivo vinculado</b> (en el teléfono del negocio: WhatsApp → Dispositivos vinculados → Vincular). Activa los avisos en <b>Hoy</b>.</li><li>En <b>Mis leads</b> ves los contactos que te tocaron. Escríbeles con el botón de WhatsApp y firma con tu nombre; si llega un chat nuevo, captúralo arriba.</li><li>Marca el estado de cada uno: contactado, sin respuesta, cotizado, compró o no compró, y deja una nota.</li><li>Si compra, pulsa <b>Registrar venta</b>: el sistema genera el folio y el ticket para mandárselo.</li><li>En <b>Mis ventas</b> registras los pagos que vayan haciendo y ves el saldo.</li></ol></div>`, 'Mi cuenta');
    $('#clave').onclick = () => pedirClave(false);
  }

  // ───────── router ─────────
  function render() {
    if (!S.yo) return vistaLogin();
    const r = ruta();
    const vistas = { hoy: vistaHoy, ventas: vistaVentas, leads: vistaLeads, vendedores: admin() ? vistaVendedores : vistaHoy, ajustes: admin() ? vistaAjustes : vistaCuenta, cuenta: vistaCuenta };
    (vistas[r] || vistaHoy)();
    const m = location.hash.match(/venta=([\w-]+)/); if (m) { detalleVenta(m[1]); history.replaceState(null, '', '#/' + r); }
  }
  window.addEventListener('hashchange', render);
  (async () => {
    try { const me = await api('/api/auth'); if (me.usuario) { await cargar(); render(); if (S.yo.cambiarClave) pedirClave(true); } else vistaLogin(); }
    catch (e) { vistaLogin(e.message); }
    // Cada 30 s revisa si hay leads nuevos; avisa con notificación del navegador (si se permitió) y en el título.
    let vistos = null;
    const revisar = () => {
      const mios = S.leads.filter(l => l.estado === 'nuevo' && (admin() ? true : l.vendedorId === S.yo.id));
      document.title = (mios.length ? '(' + mios.length + ') ' : '') + 'Sistema · Cardian Muebles';
      if (vistos) {
        const nuevos = mios.filter(l => !vistos.has(l.id));
        if (nuevos.length && 'Notification' in window && Notification.permission === 'granted') {
          const l = nuevos[0];
          const n = new Notification(nuevos.length > 1 ? nuevos.length + ' leads nuevos' : 'Lead nuevo: ' + (l.nombre || l.tel), { body: nuevos.length > 1 ? 'Ábrelos en el sistema' : (l.producto ? 'Le interesa ' + l.producto + ' · ' : '') + l.tel, icon: '/img/logo.png', tag: 'cardian-lead' });
          n.onclick = () => { window.focus(); location.hash = '#/leads'; n.close(); };
        }
      }
      vistos = new Set(mios.map(l => l.id));
    };
    if (S.yo) revisar();
    setInterval(async () => {
      if (!S.yo) return;
      try { await cargar(); } catch (e) { return; }
      revisar();
      const escribiendo = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!$('#modal') && !escribiendo) render();
    }, 30000);
  })();
})();

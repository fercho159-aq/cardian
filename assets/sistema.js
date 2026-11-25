/* Sistema de ventas y leads de Cardian Muebles.
   Una sola página: inicia sesión, carga los datos de /api/datos y pinta la vista según el #hash.
   Admin: Hoy, Ventas, Sin pago, Leads, Muebles, Usuarios, Ajustes. Vendedor: Hoy, Muebles, Mis leads, Mis ventas, Sin pago, Mi cuenta. */
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
  const ORIGEN = { sitio: 'Página web', 'mercado-pago': 'Mercado Pago', 'mercado-libre': 'Mercado Libre', whatsapp: 'WhatsApp', sucursal: 'Tienda / local', telefono: 'Teléfono', otro: 'Otro' };
  // Orígenes que solo registra el administrador (llegan solos o los asigna él, como las ventas de Mercado Libre).
  const ORIGEN_ADMIN = ['sitio', 'mercado-pago', 'mercado-libre'];
  const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'mercado-pago', 'mercado-libre', 'deposito', 'otro'];
  let S = { yo: null, ventas: [], leads: [], usuarios: [], sucursales: [], ajustes: {}, catalogo: null, filtros: {}, wa: { chats: [], account: null, waEnabled: false, activo: null, mensajes: [], busca: '', fEstado: '', fVend: '', sinLeads: false } };
  // timers del panel WhatsApp (bandeja + chat activo) para parar polling al salir
  let waTimers = { lista: null, msgs: null };
  function waStop() { clearInterval(waTimers.lista); clearInterval(waTimers.msgs); waTimers.lista = waTimers.msgs = null; }
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
    Object.assign(S, { ventas: d.ventas, leads: d.leads, usuarios: d.usuarios, sucursales: d.sucursales, ajustes: d.ajustes || {}, catalogo: d.catalogo, yo: d.yo, accesos: d.accesos || [], eliminados: d.eliminados || [], cupones: d.cupones || [] });
    if (window.CARDIAN && window.CARDIAN.aplicarTienda && d.catalogo) window.CARDIAN.aplicarTienda(d.catalogo.tienda || []);
  }
  // ───────── versión nueva ─────────
  // La app instalada puede quedarse abierta días: se compara la huella de este archivo en el servidor con la que
  // había al abrir. Si cambió, se recarga sola (al iniciar sesión, al volver a la app o cada par de minutos),
  // siempre que no haya una ventana abierta ni se esté escribiendo, para no perder lo capturado.
  let huella0 = null;
  const huellaServidor = async () => { try { const r = await fetch('/assets/sistema.js', { method: 'HEAD', cache: 'no-store' }); return r.ok ? (r.headers.get('etag') || '') : ''; } catch (e) { return ''; } };
  huellaServidor().then(h => { huella0 = h; });
  async function actualizarSiHayVersion(forzar) {
    if (!huella0) return false;
    const h = await huellaServidor();
    if (!h || h === huella0) return false;
    const escribiendo = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!forzar && ($('#modal') || escribiendo)) return false;
    location.reload(); return true;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizarSiHayVersion(false); });
  const admin = () => S.yo && S.yo.rol === 'admin';
  // Admin de atención («supervisor»): solo Muebles, Leads y WhatsApp, pero ve y reparte todos los leads y chats.
  const sup = () => S.yo && S.yo.rol === 'supervisor';
  const veTodo = () => admin() || sup();
  const ROL_N = { admin: 'Administrador', supervisor: 'Admin de atención', vendedor: 'Vendedor' };
  const SOLO_SUP = ['muebles', 'leads', 'whatsapp', 'cuenta'];
  const nombreU = id => (S.usuarios.find(u => u.id === id) || {}).nombre || '—';
  // Quién dio de alta el pedido: el primer registro del historial (un usuario, «Sitio web» o Mercado Pago).
  const altaDe = v => ((v.historial || [])[0] || {}).quien || '—';
  const celdaVend = v => `<td>${esc(nombreU(v.vendedorId))}<small>Alta: ${esc(altaDe(v))}</small></td>`;
  const pagado = v => (v.pagos || []).reduce((s, p) => s + p.monto, 0);
  const saldo = v => Math.max(0, v.total - pagado(v));
  // Una venta cuenta como venta cuando ya tiene al menos un pago; las demás viven en «Sin pago».
  const conPago = v => pagado(v) > 0;
  const sinPago = v => !conPago(v) && v.estado !== 'cancelado';
  const METODO_N = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', 'mercado-pago': 'Mercado Pago', 'mercado-libre': 'Mercado Libre', deposito: 'Depósito', otro: 'Otro' };
  const pagoCon = v => [...new Set((v.pagos || []).map(p => (METODO_N[p.metodo] || p.metodo) + (p.metodo === 'mercado-pago' && p.ref ? ' · ' + p.ref : '')))].join(', ');
  // Lead sin teléfono (chat de WhatsApp con id interno): el botón abre su chat dentro del sistema.
  const waLead = (l, txt) => l.tel ? waLink(l.tel, txt) : '/sistema#/whatsapp?chat=' + encodeURIComponent(l.waJid || '');
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
      ${window.CardianApp && !CardianApp.instalada() ? `<button type="button" class="app-link" id="appLogin"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5"/></svg>Descargar la app en este equipo</button>` : ''}
      <p style="margin:16px 0 0;font-size:12px"><a href="/" style="color:var(--muted)">← Volver al sitio</a></p>
    </form></div>`;
    if ($('#appLogin')) $('#appLogin').onclick = () => CardianApp.abrir();
    $('#login').onsubmit = async e => {
      e.preventDefault();
      try { await api('/api/auth', { accion: 'entrar', usuario: $('#u').value, clave: $('#p').value }); if (await actualizarSiHayVersion(true)) return; await cargar(); render(); if (S.yo.cambiarClave) pedirClave(true); }
      catch (x) { vistaLogin(x.message); }
    };
  }
  function pedirClave(forzado) {
    const m = modal(forzado ? 'Crea tu contraseña' : 'Cambiar mi contraseña', `
      ${forzado ? '<p class="note" style="margin-bottom:12px">Esta cuenta tiene una contraseña temporal. Escribe una nueva de al menos 8 caracteres.</p>' : `<div class="field"><label>Contraseña actual</label><input class="input" id="c0" type="password"></div>`}
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
    bitacora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h7M9 8h3"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    sinpago: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cuenta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.11 4.9A10 10 0 0 0 4.1 18.4L3 22l3.7-1A10 10 0 1 0 19.11 4.9zM12 20.3a8.3 8.3 0 0 1-4.24-1.17l-.3-.18-2.19.57.59-2.14-.2-.31A8.3 8.3 0 1 1 12 20.3zm4.56-6.22c-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.8.98-.14.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.25-1.49-1.4-1.74-.14-.25-.02-.38.11-.5.11-.11.25-.3.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.11 0 1.24.9 2.44 1.03 2.6.13.17 1.78 2.73 4.33 3.82.6.26 1.08.42 1.45.54.61.19 1.17.17 1.6.1.49-.07 1.48-.6 1.69-1.19.21-.59.21-1.09.15-1.19-.06-.1-.23-.17-.48-.3z"/></svg>'
,
    vendido: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    cupones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z"/><path d="M9.5 9.5h.01M14.5 14.5h.01M15 9l-6 6"/></svg>',
    muebles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 18v2M19 18v2"/></svg>'
  };
  function ruta() { return (location.hash.replace('#/', '') || 'hoy').split('?')[0]; }
  function shell(contenido, titulo, sub, acciones) {
    const leadsNuevos = S.leads.filter(l => l.estado === 'nuevo').length;
    const pendientes = S.ventas.filter(sinPago).length;
    const waNoLeidos = (S.wa && S.wa.chats || []).reduce((s, c) => s + (veTodo() || (c.lead && c.lead.vendedorId === S.yo.id) ? (c.noLeidos || 0) : 0), 0);
    const menu = sup()
      ? [['muebles', 'Muebles'], ['leads', 'Leads', leadsNuevos], ['whatsapp', 'WhatsApp', waNoLeidos], ['cuenta', 'Mi cuenta']]
      : admin()
      ? [['hoy', 'Hoy'], ['ventas', 'Ventas'], ['sinpago', 'Sin pago', pendientes], ['leads', 'Leads', leadsNuevos], ['whatsapp', 'WhatsApp', waNoLeidos], ['muebles', 'Muebles'], ['cupones', 'Cupones'], ['vendido', 'Lo vendido'], ['bitacora', 'Bitácora'], ['vendedores', 'Usuarios'], ['ajustes', 'Ajustes']]
      : [['hoy', 'Hoy'], ['muebles', 'Muebles'], ['leads', 'Mis leads', leadsNuevos], ['whatsapp', 'WhatsApp', waNoLeidos], ['ventas', 'Mis ventas'], ['vendido', 'Lo que vendí'], ['sinpago', 'Sin pago', pendientes], ['cuenta', 'Mi cuenta']];
    const r = ruta();
    $('#app').innerHTML = `<div class="shell">
      <nav class="side" id="side"><div class="brand"><img src="/img/logo.png" alt=""><span>Sistema</span></div>
        ${menu.map(([k, t, n]) => `<a href="#/${k}" class="${r === k ? 'on' : ''}">${ICO[k] || ICO.cuenta}${t}${n ? `<span class="n">${n}</span>` : ''}</a>`).join('')}
        <div class="yo"><b>${esc(S.yo.nombre)}</b><small>${ROL_N[S.yo.rol] || 'Vendedor'}${S.yo.sucursal ? ' · ' + esc(S.yo.sucursal) : ''}</small><br><button type="button" id="salir">Cerrar sesión</button>${window.CardianApp && !CardianApp.instalada() ? `<br><button type="button" class="app-link" id="appSide"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5"/></svg>Descargar app</button>` : ''}</div>
      </nav>
      <main class="main"><button class="menu-btn" id="menu">☰ Menú</button>
        <div class="top"><div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="acts">${acciones || ''}</div></div>
        ${contenido}</main></div>`;
    $('#salir').onclick = async () => { await api('/api/auth', { accion: 'salir' }); S.yo = null; render(); };
    if ($('#appSide')) $('#appSide').onclick = () => CardianApp.abrir();
    $('#menu').onclick = () => $('#side').classList.toggle('open');
    $$('#side a').forEach(a => a.onclick = () => $('#side').classList.remove('open'));
  }

  // ───────── Hoy ─────────
  function vistaHoy() {
    const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
    const mes = S.ventas.filter(v => new Date(v.creado) >= ini && v.estado !== 'cancelado' && conPago(v));
    const cobrado = mes.reduce((s, v) => s + pagado(v), 0);
    const porCobrar = S.ventas.filter(v => conPago(v) && v.estado !== 'cancelado').reduce((s, v) => s + saldo(v), 0);
    const sinPagoL = S.ventas.filter(sinPago);
    const nuevos = S.leads.filter(l => l.estado === 'nuevo');
    const sinRespuesta = S.leads.filter(l => l.estado === 'sin-respuesta');
    const sitioPend = S.ventas.filter(v => sinPago(v) && Date.now() - new Date(v.creado) < 7 * 864e5);
    const sinVendedor = S.leads.filter(l => !l.vendedorId && !['compro', 'no-compro'].includes(l.estado));
    const tareas = [];
    nuevos.slice(0, 6).forEach(l => tareas.push(`<li class="lead" data-lead="${l.id}"><div><b>${esc(l.nombre || 'Sin nombre')}</b> pidió informes ${l.producto ? 'de ' + esc(l.producto) : ''} <span class="badge origen">${ORIGEN[l.origen]}</span><div class="meta"><span>${hace(l.creado)}</span>${admin() ? `<span>${esc(nombreU(l.vendedorId))}</span>` : ''}</div></div><div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLead(l, saludoLead(l))}" onclick="event.stopPropagation()">WhatsApp</a></div></li>`));
    sitioPend.slice(0, 4).forEach(v => tareas.push(`<li class="lead" data-venta="${v.folio}"><div><b>Pedido ${v.folio}</b> sin pago · ${esc(v.cliente.nombre)} · ${fmt(v.total)}<div class="meta"><span>${hace(v.creado)}</span><span>${v.origen === 'sitio' ? 'Página web · eligió Mercado Pago' : (ORIGEN[v.origen] || v.origen)}</span></div></div><div class="acts">${v.cliente.tel ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(v.cliente.tel, `Hola ${esc(v.cliente.nombre.split(' ')[0])}, soy de Cardian Muebles. Recibimos tu pedido ${v.folio} por ${fmt(v.total)}. ¿Te ayudo a completar el pago?`)}" onclick="event.stopPropagation()">WhatsApp</a>` : ''}</div></li>`));
    sinRespuesta.slice(0, 4).forEach(l => tareas.push(`<li class="lead" data-lead="${l.id}"><div><b>${esc(l.nombre || l.tel)}</b> no ha respondido · vuelve a intentar<div class="meta"><span>${hace(l.creado)}</span></div></div><div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLead(l, `Hola ${esc((l.nombre || '').split(' ')[0])}, te escribo de Cardian Muebles por si sigues interesado${l.producto ? ' en ' + esc(l.producto) : ''}. ¿Te paso el precio?`)}" onclick="event.stopPropagation()">WhatsApp</a></div></li>`));
    shell(`
      <div class="grid kpis">
        <div class="kpi"><small>Ventas del mes</small><b>${fmt(mes.reduce((s, v) => s + v.total, 0))}</b><span>${mes.length} venta${mes.length === 1 ? '' : 's'}</span></div>
        <div class="kpi ok"><small>Cobrado este mes</small><b>${fmt(cobrado)}</b><span>pagos registrados</span></div>
        <div class="kpi warn"><small>Por cobrar</small><b>${fmt(porCobrar)}</b><span>saldos de ventas con anticipo</span></div>
        <div class="kpi"><small>Leads nuevos</small><b>${nuevos.length}</b><span>${sinRespuesta.length} sin respuesta</span></div>
      </div>
      ${sinPagoL.length ? `<div class="aviso" style="margin-top:16px">${sinPagoL.length} pedido${sinPagoL.length > 1 ? 's' : ''} sin pago por ${fmt(sinPagoL.reduce((s, v) => s + v.total, 0))} (no cuentan en ventas). <a href="#/sinpago">Ver y contactar</a></div>` : ''}
      ${admin() && sinVendedor.length ? `<div class="aviso" style="margin-top:16px">Hay ${sinVendedor.length} lead${sinVendedor.length > 1 ? 's' : ''} sin vendedor. <a href="#" id="repartir">Repartir ahora</a> o da de alta vendedores que reciban leads.</div>` : ''}
      ${rapidaHtml()}
      ${!admin() && !S.yo.whatsapp && !compartido() ? `<div class="aviso" style="margin-top:16px">Tu cuenta no tiene WhatsApp registrado: los clientes del sitio llegan al número general. Pídele al administrador que lo agregue.</div>` : ''}
      <div class="two" style="margin-top:16px">
        <div class="box"><h2>Qué hacer hoy</h2>${tareas.length ? `<ul class="lead-list" style="list-style:none;padding:0;margin:0">${tareas.join('')}</ul>` : '<div class="empty">Todo al día. No hay leads nuevos ni pedidos sin pago.</div>'}</div>
        <div class="box"><h2>Últimas ventas</h2>${S.ventas.some(conPago) ? `<table class="table"><tbody>${S.ventas.filter(conPago).slice(0, 8).map(v => `<tr class="row" data-venta="${v.folio}"><td><b>${v.folio}</b><small>${esc(v.cliente.nombre)}${admin() ? ' · ' + esc(nombreU(v.vendedorId)) : ''}</small></td><td>${badge(v.estado)} ${badge(v.etapa || 'recibido', ETAPA_V)}</td><td class="num">${fmt(v.total)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Aún no hay ventas.</div>'}</div>
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
      </div>${!veTodo() ? `<label class="chk" style="margin-top:8px"><input type="checkbox" id="rM"> Es un cliente que yo traje (me lo quedo)</label>` : ''}<div id="rRes" class="note" style="margin-top:8px"></div></form>`;
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

  // ───────── Muebles (catálogo para vender) ─────────
  // Lo que el vendedor ve de la tienda: modelos, precio de lista, colores y medidas, con botón para registrar la venta.
  function vistaMuebles() {
    const D = window.CARDIAN || { products: [], categories: [], TAPIZ: {} };
    const f = S.filtros.m || (S.filtros.m = { q: '', cat: '' });
    const lista = D.products.filter(p => (!f.cat || p.cat === f.cat) && (!f.q || (p.name + ' ' + (p.type || '') + ' ' + (p.short || '')).toLowerCase().includes(f.q.toLowerCase())));
    const extras = ((S.catalogo && S.catalogo.extras) || []).filter(e => !f.q || e.nombre.toLowerCase().includes(f.q.toLowerCase()));
    const regsT = (S.catalogo && S.catalogo.tienda) || [];
    const ocultos = regsT.filter(r => r.oculto && !r.eliminado);
    const eliminadosT = regsT.filter(r => r.eliminado).sort((a, b) => (b.eliminado.cuando || '').localeCompare(a.eliminado.cuando || ''));
    const bitT = (S.catalogo && S.catalogo.bitacoraTienda) || [];
    const nombreProd = r => (r.datos && r.datos.name) || ((D.productsBase || []).find(p => p.id === r.id) || {}).name || r.id;
    const medidas = p => p.dims ? `${(p.dims.largo / 100).toFixed(2)} × ${(p.dims.fondo / 100).toFixed(2)} m · alto ${p.dims.alto} cm` : '';
    const infoWa = p => `${p.name}${p.type ? ' (' + p.type + ')' : ''}\nPrecio directo: ${fmt(p.price)} *sin IVA\n${medidas(p) ? 'Medidas: ' + medidas(p) + '\n' : ''}${(p.tapiz || []).length ? 'Colores: ' + p.tapiz.map(t => (D.TAPIZ[t] || {}).name || t).join(', ') + '\n' : ''}Entrega: ${p.stock === 'pedido' ? 'sobre pedido, aprox. ' + (p.dias || 15) + ' días' : 'inmediata'}\n${location.origin}/producto?id=${p.id}`;
    shell(`
      <div class="filters">
        <input class="input buscar" id="mq" placeholder="Buscar modelo…" value="${esc(f.q)}">
        <div class="sel-estado">${[['', 'Todos'], ...D.categories.map(c => [c.id, c.name])].map(([k, t]) => `<button type="button" data-mc="${k}" class="${f.cat === k ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>
        <span class="note">${lista.length} modelo${lista.length === 1 ? '' : 's'} · *Precios sin IVA</span>
      </div>
      <div class="muebles">${lista.length ? lista.map(p => `<article class="mueble">
        <img src="/${esc((p.imgs || [])[0] || '')}" alt="${esc(p.name)}" loading="lazy">
        <div class="mb">
          <b>${esc(p.name)}</b><small>${esc(p.type || '')}</small>
          <div class="precio">${fmt(p.price)} <span>sin IVA</span>${p.oldPrice ? ` <s>${fmt(p.oldPrice)}</s> <em>Oferta −${Math.round((1 - p.price / p.oldPrice) * 100)} %</em>` : ''}</div>
          ${medidas(p) ? `<div class="note">${medidas(p)}</div>` : ''}
          ${(p.tapiz || []).length ? `<div class="tapiz">${p.tapiz.map(t => `<i title="${esc((D.TAPIZ[t] || {}).name || t)}" style="background:${(D.TAPIZ[t] || {}).hex || '#ccc'}"></i>`).join('')}</div>` : ''}
          <div class="note">${p.stock === 'pedido' ? 'Sobre pedido · aprox. ' + (p.dias || 15) + ' días' : 'Entrega inmediata'}</div>
          <div class="acts"><button class="btn gold sm" data-vender="${p.id}">Registrar venta</button><button class="btn sm" data-copiar="${p.id}">Copiar info</button>${admin() ? `<button class="btn sm" data-edprod="${p.id}">Editar / precio</button><button class="btn sm" data-delprod="${p.id}" style="color:#b4322b;border-color:#e7b9b4">Eliminar</button>` : ''}</div>
        </div></article>`).join('') : '<div class="empty">No hay modelos con esa búsqueda.</div>'}</div>
      ${admin() && ocultos.length ? `<h2 style="font-size:15px;margin:26px 0 10px">Ocultos de la tienda</h2><p class="note" style="margin:-4px 0 12px">No se ven en la página web ni se pueden comprar. Ábrelos para volver a publicarlos.</p><div class="table-wrap"><table class="table"><tbody>${ocultos.map(r => `<tr><td><b>${esc(nombreProd(r))}</b><small>${r.base ? 'Del catálogo' : 'Alta del sistema'} · oculto por ${esc(r.editadoPor || '—')}</small></td><td style="text-align:right"><button class="btn sm" data-edprod="${r.id}">Editar / publicar</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${extras.length ? `<h2 style="font-size:15px;margin:26px 0 10px">Modelos agregados por el equipo</h2><p class="note" style="margin:-4px 0 12px">Modelos que no estaban en el catálogo y alguien vendió en tienda. Solo existen dentro del sistema (no se publican en la página web) y quedan aquí para la próxima venta${admin() ? '; tú puedes cambiar su precio o quitarlos' : ''}.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Modelo</th><th>Agregado por</th><th class="num">Precio</th><th></th></tr></thead><tbody>${extras.map(e => `<tr><td><b>${esc(e.nombre)}</b></td><td>${esc(e.creadoNombre || '—')}<small>${dia(e.creado)}</small></td><td class="num">${fmt(e.precio)}</td><td style="white-space:nowrap;text-align:right"><button class="btn gold sm" data-vender="${e.id}">Registrar venta</button>${admin() ? ` <button class="btn sm" data-mxp="${e.id}">Precio</button> <button class="btn sm" data-mxq="${e.id}">Quitar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${admin() && eliminadosT.length ? `<h2 style="font-size:15px;margin:26px 0 10px">Productos eliminados</h2><p class="note" style="margin:-4px 0 12px">Ya no salen en la página web ni se pueden vender. Si fue un error, restáuralos.</p><div class="table-wrap"><table class="table"><tbody>${eliminadosT.map(r => `<tr><td><b>${esc(nombreProd(r))}</b><small>Eliminado por ${esc(r.eliminado.quien || '—')} · ${fecha(r.eliminado.cuando)}</small></td><td style="text-align:right"><button class="btn sm" data-resprod="${r.id}">Restaurar</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${admin() && bitT.length ? `<h2 style="font-size:15px;margin:26px 0 10px">Bitácora de productos</h2><p class="note" style="margin:-4px 0 12px">Altas, cambios de precio, eliminaciones y restauraciones: quién lo hizo y cuándo.</p><div class="table-wrap"><table class="table"><thead><tr><th>Cuándo</th><th>Quién</th><th>Movimiento</th><th>Producto</th><th>Detalle</th></tr></thead><tbody>${bitT.slice(0, 40).map(x => `<tr><td style="white-space:nowrap">${fecha(x.cuando)}</td><td>${esc(x.quien)}</td><td><span class="badge ${x.accion === 'Eliminó' ? 'cancelado' : x.accion === 'Alta' || x.accion === 'Restauró' ? 'pagado' : 'origen'}">${esc(x.accion)}</span></td><td><b>${esc(x.nombre)}</b></td><td>${esc(x.detalle)}</td></tr>`).join('')}</tbody></table></div>` : ''}`,
      'Muebles.', 'Modelos y precios de lista para atender y vender. Si vendiste algo que no está aquí, regístralo con «Modelo que no está en la lista».',
      `${admin() ? '<button class="btn sm" id="nuevoProd">+ Producto para la tienda</button>' : ''}<button class="btn gold sm" id="nuevaVenta">+ Registrar venta</button>`);
    enlazarComunes();
    const np = $('#nuevoProd'); if (np) np.onclick = () => formProducto(null);
    $$('[data-edprod]').forEach(b => b.onclick = () => formProducto(b.dataset.edprod));
    $$('[data-delprod]').forEach(b => b.onclick = () => eliminarProducto(b.dataset.delprod));
    $$('[data-resprod]').forEach(b => b.onclick = async () => { try { await api('/api/datos?c=tienda', { accion: 'restaurar', id: b.dataset.resprod }); toast('Producto restaurado: ya está otra vez en la tienda'); await cargar(); render(); } catch (e) { toast(e.message); } });
    $('#mq').oninput = () => { f.q = $('#mq').value; vistaMuebles(); const i = $('#mq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $$('[data-mc]').forEach(b => b.onclick = () => { f.cat = b.dataset.mc; vistaMuebles(); });
    $$('[data-vender]').forEach(b => b.onclick = () => formVenta(null, { id: b.dataset.vender }));
    $$('[data-mxp]').forEach(b => b.onclick = async () => { const e = S.catalogo.extras.find(x => x.id === b.dataset.mxp); const v = prompt('Nuevo precio de ' + e.nombre + ' (sin IVA):', e.precio); if (v === null) return; try { await api('/api/datos?c=modelos', { accion: 'editar', id: e.id, precio: +v }); toast('Precio actualizado'); await cargar(); vistaMuebles(); } catch (x) { toast(x.message); } });
    $$('[data-mxq]').forEach(b => b.onclick = async () => { const e = S.catalogo.extras.find(x => x.id === b.dataset.mxq); if (!confirm('¿Quitar «' + e.nombre + '» de la lista? Las ventas que ya lo tienen no cambian.')) return; try { await api('/api/datos?c=modelos', { accion: 'quitar', id: e.id }); toast('Modelo quitado de la lista'); await cargar(); vistaMuebles(); } catch (x) { toast(x.message); } });
    $$('[data-copiar]').forEach(b => b.onclick = () => { const p = D.products.find(x => x.id === b.dataset.copiar); navigator.clipboard.writeText(infoWa(p)).then(() => toast('Info copiada: pégala en WhatsApp'), () => toast('No se pudo copiar')); });
  }

  // ───────── Producto de la tienda (solo administrador): alta, edición, precio y publicar/ocultar ─────────
  // Reduce la foto a máx. 1600 px y la pasa a JPG para que cargue rápido en la tienda (no cambia colores).
  const comprimirFoto = file => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.86, out; do { out = c.toDataURL('image/jpeg', q); q -= 0.08; } while (out.length > 600000 && q > 0.35);
      URL.revokeObjectURL(img.src); res(out);
    };
    img.onerror = () => rej(new Error('No se pudo leer la foto «' + file.name + '»'));
    img.src = URL.createObjectURL(file);
  });
  async function eliminarProducto(id, alTerminar) {
    const p = (window.CARDIAN.products || []).find(x => x.id === id) || (window.CARDIAN.productsBase || []).find(x => x.id === id) || {};
    const reg = ((S.catalogo && S.catalogo.tienda) || []).find(r => r.id === id);
    const nombre = (reg && reg.datos && reg.datos.name) || p.name || id;
    if (!confirm('¿Eliminar «' + nombre + '» de la tienda?\n\nDeja de verse en la página web y ya no se podrá vender. Queda anotado en la bitácora con tu nombre y lo puedes restaurar después. Las ventas que ya lo tienen no cambian.')) return false;
    try { await api('/api/datos?c=tienda', { accion: 'eliminar', id }); if (alTerminar) alTerminar(); toast('Producto eliminado. Quedó en la bitácora.'); await cargar(); render(); return true; } catch (e) { toast(e.message); return false; }
  }
  function formProducto(id) {
    const D = window.CARDIAN; const regs = (S.catalogo && S.catalogo.tienda) || [];
    const reg = id ? regs.find(r => r.id === id) : null;
    const base = id ? (D.productsBase || []).find(p => p.id === id) : null;
    const p = id ? { ...(base || {}), ...((reg && reg.datos) || {}) } : { cat: 'salas', stock: 'pedido', dias: 15, imgs: [], tapiz: [], factor: 1, bultos: 1 };
    if (id && !base && !reg) return toast('No existe ese producto');
    // fotos: {src} ya guardadas (ruta) o {data} nuevas por subir
    let fotos = (p.imgs || []).map(src => ({ src }));
    let colores = new Set(p.tapiz || []);
    const m = modal(id ? 'Editar ' + esc(p.name) : 'Nuevo producto para la tienda', `
      <p class="note" style="margin:0 0 12px">${id ? 'Los cambios se ven en la página web en menos de un minuto.' : 'Al guardar aparece en la página web y el cliente lo puede comprar y pagar con Mercado Pago.'} *El precio va sin IVA.</p>
      <div class="fields">
        <div class="field"><label>Nombre del producto</label><input class="input" id="pN" maxlength="70" value="${esc(p.name || '')}" placeholder="Ej. Sala Roma"></div>
        <div class="field"><label>Categoría</label><select class="input" id="pC">${opts(D.categories.map(c => [c.id, c.name]), p.cat)}</select></div>
        <div class="field"><label>Precio (sin IVA)</label><input class="input" id="pP" type="number" min="1" step="1" value="${p.price || ''}" placeholder="Ej. 18500"></div>
        <div class="field"><label>Tipo (una línea)</label><input class="input" id="pT" maxlength="70" value="${esc(p.type || '')}" placeholder="Ej. Juego 3-2-1 con reposet"></div>
        <div class="field"><label>Precio de oferta (opcional)</label><input class="input" id="pOf" type="number" min="0" step="1" value="${(p.oferta && p.oferta.price) || ''}" placeholder="Déjalo vacío si no hay descuento"><span class="note" id="pOfN">En la tienda sale el precio normal tachado y este como precio a pagar.</span></div>
        <div class="field"><label>Oferta válida hasta (opcional)</label><input class="input" id="pOfH" type="date" value="${(p.oferta && p.oferta.hasta) || ''}"><span class="note">Ese día todavía aplica; al siguiente vuelve solo al precio normal.</span></div>
        <div class="field full"><label>Descripción corta</label><input class="input" id="pS" maxlength="180" value="${esc(p.short || '')}" placeholder="Lo que se lee junto al precio"></div>
        <div class="field full"><label>Descripción completa</label><textarea class="input" id="pD" maxlength="900" style="min-height:90px" placeholder="Materiales, qué incluye, para cuántas personas…">${esc(p.desc || '')}</textarea></div>
        <div class="field full"><label>Fotos (la primera es la principal)</label><div class="prod-fotos" id="pF"></div><input type="file" id="pFile" accept="image/*" multiple hidden><button type="button" class="btn sm" id="pAdd" style="margin-top:8px">+ Agregar fotos</button><span class="note" style="display:block;margin-top:6px">Usa fotos originales y nítidas del mueble. Máximo 6.</span></div>
        <div class="field full"><label>Colores disponibles (opcional)</label><div class="prod-colores" id="pCol">${Object.entries(D.TAPIZ).map(([k, t]) => `<label class="${colores.has(k) ? 'on' : ''}"><input type="checkbox" value="${k}" ${colores.has(k) ? 'checked' : ''}><i style="background:${t.hex}"></i>${esc(t.name)}</label>`).join('')}</div></div>
        <div class="field"><label>Entrega</label><select class="input" id="pSt">${opts([['pedido', 'Sobre pedido (se fabrica)'], ['inmediata', 'Entrega inmediata']], p.stock || 'pedido')}</select></div>
        <div class="field"><label>Días de fabricación</label><input class="input" id="pDi" type="number" min="1" max="120" value="${p.dias || 15}"></div>
        ${base ? '' : `<div class="field"><label>Largo (cm)</label><input class="input" id="pL" type="number" min="0" value="${(p.dims || {}).largo || ''}"></div>
        <div class="field"><label>Fondo (cm)</label><input class="input" id="pFo" type="number" min="0" value="${(p.dims || {}).fondo || ''}"></div>
        <div class="field"><label>Alto (cm)</label><input class="input" id="pA" type="number" min="0" value="${(p.dims || {}).alto || ''}"></div>
        <div class="field"><label>Tamaño para calcular el envío</label><select class="input" id="pFa">${opts([['0.5', 'Pieza chica (sofá cama, sillón)'], ['0.8', 'Mediano (comedor, sala chica)'], ['1', 'Sala o juego completo'], ['1.2', 'Modular grande']], String(p.factor || 1))}</select></div>`}
        <div class="field full"><label class="chk"><input type="checkbox" id="pPub" ${reg && reg.oculto ? '' : 'checked'}> Publicado en la tienda (los clientes lo ven y lo pueden comprar)</label></div>
      </div>`,
      `${id ? '<button class="btn sm" id="pDel" style="color:#b4322b;border-color:#e7b9b4">Eliminar producto</button>' : ''}${reg && reg.base && Object.keys(reg.datos || {}).length ? '<button class="btn sm" id="pOrig">Volver al original</button>' : ''}<button class="btn primary sm" id="pOk">${id ? 'Guardar cambios' : 'Publicar producto'}</button>`, { wide: true });
    const pintarFotos = () => { $('#pF').innerHTML = fotos.length ? fotos.map((x, i) => `<div class="pf"><img src="${x.data || '/' + esc(x.src)}" alt="">${i === 0 ? '<span>Principal</span>' : `<button type="button" data-pri="${i}" title="Poner como principal">★</button>`}<button type="button" class="x" data-qf="${i}" title="Quitar">×</button></div>`).join('') : '<div class="note">Aún no hay fotos.</div>';
      $$('[data-qf]', $('#pF')).forEach(b => b.onclick = () => { fotos.splice(+b.dataset.qf, 1); pintarFotos(); });
      $$('[data-pri]', $('#pF')).forEach(b => b.onclick = () => { const [x] = fotos.splice(+b.dataset.pri, 1); fotos.unshift(x); pintarFotos(); }); };
    pintarFotos();
    $('#pAdd').onclick = () => $('#pFile').click();
    $('#pFile').onchange = async () => { const fl = [...$('#pFile').files]; $('#pFile').value = ''; for (const file of fl) { if (fotos.length >= 6) { toast('Máximo 6 fotos'); break; } try { fotos.push({ data: await comprimirFoto(file) }); } catch (e) { toast(e.message); } } pintarFotos(); };
    $$('#pCol input').forEach(c => c.onchange = () => { c.checked ? colores.add(c.value) : colores.delete(c.value); c.parentElement.classList.toggle('on', c.checked); });
    const sync = () => { $('#pDi').disabled = $('#pSt').value === 'inmediata'; }; $('#pSt').onchange = sync; sync();
    const notaOf = () => { const n = +$('#pP').value, o = +$('#pOf').value; $('#pOfN').textContent = o > 0 && n > 0 ? (o < n ? 'Descuento de ' + Math.round((1 - o / n) * 100) + ' % (' + fmt(n - o) + ' menos). En la tienda sale ' + fmt(n) + ' tachado.' : 'Debe ser menor al precio normal.') : 'En la tienda sale el precio normal tachado y este como precio a pagar.'; };
    $('#pOf').oninput = notaOf; $('#pP').oninput = notaOf; notaOf();
    $('#pOk').onclick = async () => {
      if ($('#pN').value.trim().length < 3) return toast('Escribe el nombre del producto');
      if (!(+$('#pP').value > 0)) return toast('Escribe el precio (sin IVA)');
      if (+$('#pOf').value > 0 && +$('#pOf').value >= +$('#pP').value) return toast('El precio de oferta debe ser menor al precio normal');
      if (!fotos.length) return toast('Sube al menos una foto');
      const btn = $('#pOk'); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        for (const x of fotos) if (x.data) { const r = await api('/api/tienda', { data: x.data }); x.src = r.ruta; delete x.data; }
        const datos = { name: $('#pN').value, cat: $('#pC').value, price: +$('#pP').value, type: $('#pT').value, short: $('#pS').value, desc: $('#pD').value, imgs: fotos.map(x => x.src),
          tapiz: Object.keys(D.TAPIZ).filter(k => colores.has(k)), defaultColor: p.defaultColor, stock: $('#pSt').value, dias: +$('#pDi').value || 15,
          oferta: +$('#pOf').value > 0 ? { price: +$('#pOf').value, hasta: $('#pOfH').value } : null };
        if (!base) Object.assign(datos, { dims: { largo: +$('#pL').value || 0, fondo: +$('#pFo').value || 0, alto: +$('#pA').value || 0 }, factor: +$('#pFa').value || 1, bultos: p.bultos || 1 });
        await api('/api/datos?c=tienda', { accion: 'guardar', id: id || undefined, datos, oculto: !$('#pPub').checked });
        m.cerrar(); toast(id ? 'Producto actualizado' : 'Producto publicado en la tienda'); await cargar(); render();
      } catch (e) { toast(e.message); btn.disabled = false; btn.textContent = id ? 'Guardar cambios' : 'Publicar producto'; pintarFotos(); }
    };
    const del = $('#pDel'); if (del) del.onclick = () => eliminarProducto(id, () => m.cerrar());
    const orig = $('#pOrig'); if (orig) orig.onclick = async () => {
      if (!confirm('¿Quitar los cambios y dejar «' + p.name + '» como estaba originalmente (precio, textos y fotos)?')) return;
      try { await api('/api/datos?c=tienda', { accion: 'original', id }); m.cerrar(); toast('Producto como estaba originalmente'); await cargar(); render(); } catch (e) { toast(e.message); }
    };
  }

  // ───────── Cupones y ofertas (solo administrador) ─────────
  // Cupón: código que el cliente escribe al pagar en la página. Oferta: precio rebajado de un producto (se pone
  // en Muebles → Editar / precio). El descuento del cupón lo calcula siempre el servidor.
  const CUP_EST = { activo: ['Activo', 'pagado'], pausado: ['Pausado', 'origen'], vencido: ['Vencido', 'cancelado'], agotado: ['Agotado', 'cancelado'] };
  const cupDesc = c => c.tipo === 'monto' ? fmt(c.valor) : c.valor + ' %';
  const cupAlcance = a => { const D = window.CARDIAN; if (!a || a === 'todo') return 'Toda la tienda'; if (a.startsWith('cat:')) return 'Solo ' + ((D.categories.find(x => x.id === a.slice(4)) || {}).name || a.slice(4)).toLowerCase(); const p = (D.products || []).find(x => x.id === a.slice(5)) || (D.productsBase || []).find(x => x.id === a.slice(5)); return 'Solo ' + (p ? p.name : 'un producto que ya no está'); };
  const fechaCorta = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  function vistaCupones() {
    const D = window.CARDIAN; const lista = S.cupones || [];
    const enOferta = (D.products || []).filter(p => p.oldPrice);
    const msg = c => `Usa el cupón ${c.codigo} en cardianmuebles.com y llévate ${cupDesc(c)} de descuento${c.alcance && c.alcance !== 'todo' ? ' en ' + cupAlcance(c.alcance).replace('Solo ', '') : ''}${c.minimo ? ' en compras desde ' + fmt(c.minimo) : ''}${c.vence ? '. Válido hasta el ' + fechaCorta(c.vence) : ''}.`;
    shell(`
      <div class="table-wrap">${lista.length ? `<table class="table"><thead><tr><th>Código</th><th>Descuento</th><th>Aplica a</th><th>Condiciones</th><th class="num">Usos</th><th>Estado</th><th></th></tr></thead><tbody>
        ${lista.map(c => { const e = CUP_EST[c.estado] || CUP_EST.activo; return `<tr><td><b class="cup-cod">${esc(c.codigo)}</b>${c.nota ? `<small>${esc(c.nota)}</small>` : ''}</td><td><b>${cupDesc(c)}</b></td><td>${esc(cupAlcance(c.alcance))}</td>
          <td><small style="display:block">${c.minimo ? 'Compra mínima ' + fmt(c.minimo) : 'Sin compra mínima'}</small><small style="display:block">${c.vence ? 'Vence el ' + fechaCorta(c.vence) : 'Sin fecha de vencimiento'}</small></td>
          <td class="num"><b>${c.usos || 0}</b>${c.usosMax ? ' / ' + c.usosMax : ''}<small>${c.pedidos || 0} pedido${(c.pedidos || 0) === 1 ? '' : 's'} creados</small></td>
          <td><span class="badge ${e[1]}">${e[0]}</span></td>
          <td style="white-space:nowrap;text-align:right"><button class="btn sm" data-ccop="${esc(c.codigo)}">Copiar mensaje</button> <button class="btn sm" data-cpau="${esc(c.codigo)}">${c.activo === false ? 'Reactivar' : 'Pausar'}</button> <button class="btn sm" data-cedi="${esc(c.codigo)}">Editar</button> <button class="btn sm" data-celi="${esc(c.codigo)}" style="color:#b4322b;border-color:#e7b9b4">Eliminar</button></td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">Todavía no hay cupones. Crea el primero con «+ Nuevo cupón».</div>'}</div>
      <p class="note" style="margin-top:10px">«Usos» cuenta los pedidos que sí se pagaron con el cupón. El cliente lo escribe en la página al pagar, en «Cupón de descuento». El descuento se aplica a los productos, no al envío.</p>
      <h2 style="font-size:15px;margin:26px 0 10px">Productos con precio de oferta</h2>
      <p class="note" style="margin:-4px 0 12px">Para poner un producto en oferta: <a href="#/muebles">Muebles</a> → «Editar / precio» → «Precio de oferta». En la tienda sale el precio normal tachado.</p>
      <div class="table-wrap">${enOferta.length ? `<table class="table"><thead><tr><th>Producto</th><th class="num">Precio normal</th><th class="num">Precio de oferta</th><th>Descuento</th><th>Válida hasta</th><th></th></tr></thead><tbody>${enOferta.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="num"><s>${fmt(p.oldPrice)}</s></td><td class="num"><b>${fmt(p.price)}</b></td><td>−${Math.round((1 - p.price / p.oldPrice) * 100)} %</td><td>${p.oferta && p.oferta.hasta ? fechaCorta(p.oferta.hasta) : 'Sin fecha'}</td><td style="text-align:right"><button class="btn sm" data-edprod="${p.id}">Editar</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Ningún producto tiene precio de oferta ahora.</div>'}</div>`,
      'Cupones y ofertas', 'Códigos de descuento para que el cliente los use al pagar en la página, y productos con precio rebajado.', `<button class="btn gold sm" id="nuevoCup">+ Nuevo cupón</button>`);
    $('#nuevoCup').onclick = () => formCupon(null);
    const de = cod => lista.find(c => c.codigo === cod);
    $$('[data-cedi]').forEach(b => b.onclick = () => formCupon(de(b.dataset.cedi)));
    $$('[data-ccop]').forEach(b => b.onclick = () => navigator.clipboard.writeText(msg(de(b.dataset.ccop))).then(() => toast('Mensaje copiado: pégalo en WhatsApp o en redes'), () => toast('No se pudo copiar')));
    $$('[data-cpau]').forEach(b => b.onclick = async () => { const c = de(b.dataset.cpau); try { await api('/api/datos?c=cupones', { accion: 'editar', codigo: c.codigo, soloEstado: true, activo: c.activo === false }); toast(c.activo === false ? 'Cupón reactivado' : 'Cupón pausado: ya no se puede usar'); await cargar(); render(); } catch (e) { toast(e.message); } });
    $$('[data-celi]').forEach(b => b.onclick = async () => { const c = de(b.dataset.celi); if (!confirm('¿Eliminar el cupón ' + c.codigo + '? Ya nadie podrá usarlo. Los pedidos que ya lo usaron no cambian.')) return; try { await api('/api/datos?c=cupones', { accion: 'eliminar', codigo: c.codigo }); toast('Cupón eliminado'); await cargar(); render(); } catch (e) { toast(e.message); } });
    $$('[data-edprod]').forEach(b => b.onclick = () => formProducto(b.dataset.edprod));
  }
  function formCupon(c) {
    const D = window.CARDIAN;
    const alcances = `<option value="todo">Toda la tienda</option>${D.categories.map(x => `<option value="cat:${x.id}" ${c && c.alcance === 'cat:' + x.id ? 'selected' : ''}>Solo ${esc(x.name.toLowerCase())}</option>`).join('')}<optgroup label="Un solo producto">${(D.products || []).map(p => `<option value="prod:${p.id}" ${c && c.alcance === 'prod:' + p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`;
    const m = modal(c ? 'Editar cupón ' + esc(c.codigo) : 'Nuevo cupón', `
      <div class="fields">
        <div class="field full"><label>Código del cupón</label><div style="display:flex;gap:8px"><input class="input" id="kCod" maxlength="24" value="${esc(c ? c.codigo : '')}" ${c ? 'readonly' : 'placeholder="Ej. NAVIDAD10 (o déjalo vacío y se genera)"'} style="text-transform:uppercase">${c ? '' : '<button type="button" class="btn sm" id="kGenC">Generar</button>'}</div><span class="note">Letras y números, sin espacios. Es lo que el cliente escribe al pagar.</span></div>
        <div class="field"><label>Tipo de descuento</label><select class="input" id="kTipo">${opts([['porcentaje', 'Porcentaje (%)'], ['monto', 'Monto fijo ($)']], c ? c.tipo : 'porcentaje')}</select></div>
        <div class="field"><label id="kValL">Descuento</label><input class="input" id="kVal" type="number" min="1" step="1" value="${c ? c.valor : ''}"></div>
        <div class="field full"><label>¿A qué aplica?</label><select class="input" id="kAlc">${alcances}</select></div>
        <div class="field"><label>Compra mínima (opcional)</label><input class="input" id="kMin" type="number" min="0" step="1" value="${c && c.minimo ? c.minimo : ''}" placeholder="Sin mínimo"></div>
        <div class="field"><label>Máximo de usos (opcional)</label><input class="input" id="kUsos" type="number" min="0" step="1" value="${c && c.usosMax ? c.usosMax : ''}" placeholder="Sin límite"></div>
        <div class="field"><label>Vence (opcional)</label><input class="input" id="kVen" type="date" value="${c && c.vence ? c.vence : ''}"><span class="note">Ese día todavía sirve.</span></div>
        <div class="field"><label>Nota interna (opcional)</label><input class="input" id="kNota" maxlength="120" value="${esc(c ? c.nota || '' : '')}" placeholder="Ej. Campaña de Navidad"></div>
        <div class="field full"><label class="chk"><input type="checkbox" id="kAct" ${!c || c.activo !== false ? 'checked' : ''}> Activo (los clientes ya lo pueden usar)</label></div>
      </div>`, `<button class="btn primary sm" id="kOkC">${c ? 'Guardar cambios' : 'Crear cupón'}</button>`);
    const etiq = () => { $('#kValL').textContent = $('#kTipo').value === 'monto' ? 'Descuento en pesos' : 'Descuento en % (1 a 90)'; }; $('#kTipo').onchange = etiq; etiq();
    const gen = $('#kGenC'); if (gen) gen.onclick = () => { const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $('#kCod').value = 'CARDIAN-' + Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); };
    $('#kOkC').onclick = async () => {
      if (!(+$('#kVal').value > 0)) return toast('Escribe de cuánto es el descuento');
      try {
        await api('/api/datos?c=cupones', { accion: c ? 'editar' : 'crear', codigo: $('#kCod').value, tipo: $('#kTipo').value, valor: +$('#kVal').value, alcance: $('#kAlc').value, minimo: +$('#kMin').value || 0, usosMax: +$('#kUsos').value || 0, vence: $('#kVen').value, nota: $('#kNota').value, activo: $('#kAct').checked });
        m.cerrar(); toast(c ? 'Cupón actualizado' : 'Cupón creado'); await cargar(); render();
      } catch (e) { toast(e.message); }
    };
  }

  // ───────── Bitácora general (solo administrador) ─────────
  // Todo lo que hace el equipo: mensajes de WhatsApp (quién le escribió a quién), clientes, ventas, pagos,
  // productos, usuarios y accesos. Se pide aparte de los demás datos porque puede ser larga.
  const BIT = { lista: [], cuando: 0, cargando: false, f: { tipo: '', quien: '', q: '' } };
  const BIT_TIPOS = ['WhatsApp', 'Cliente', 'Venta', 'Producto', 'Cupón', 'Usuario', 'Acceso', 'Ajustes'];
  const BIT_CLASE = { WhatsApp: 'pagado', Venta: 'apartado', Cliente: 'recibido', Producto: 'listo', Usuario: 'origen', Acceso: 'origen', Ajustes: 'origen' };
  async function cargarBitacora() {
    if (BIT.cargando) return; BIT.cargando = true;
    try { const d = await api('/api/datos?c=bitacora&n=1000'); BIT.lista = d.bitacora || []; BIT.cuando = Date.now(); } catch (e) { toast(e.message); }
    BIT.cargando = false;
    if (ruta() === 'bitacora' && !$('#modal')) { const act = document.activeElement && document.activeElement.id === 'bq'; vistaBitacora(); if (act) { const i = $('#bq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function vistaBitacora() {
    const f = BIT.f;
    if (Date.now() - BIT.cuando > 25000) cargarBitacora();
    const nombres = [...new Set(BIT.lista.map(x => x.quien))].sort((a, b) => a.localeCompare(b));
    const q = f.q.toLowerCase();
    const lista = BIT.lista.filter(x => (!f.tipo || x.tipo === f.tipo) && (!f.quien || x.quien === f.quien) && (!q || (x.que + ' ' + x.quien + ' ' + (x.ref || '')).toLowerCase().includes(q)));
    const diaDe = s => new Date(s).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    let ultimoDia = '';
    const filas = lista.slice(0, 400).map(x => {
      const d = diaDe(x.cuando); const sep = d !== ultimoDia ? `<tr class="bit-dia"><td colspan="4">${esc(d)}</td></tr>` : ''; ultimoDia = d;
      return sep + `<tr><td style="white-space:nowrap">${new Date(x.cuando).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td><td><b>${esc(x.quien)}</b>${x.rol ? `<small>${esc(ROL_N[x.rol] || x.rol)}</small>` : ''}</td><td><span class="badge ${BIT_CLASE[x.tipo] || 'origen'}">${esc(x.tipo)}</span></td><td class="bit-que">${esc(x.que)}</td></tr>`;
    }).join('');
    shell(`
      <div class="filters">
        <input class="input buscar" id="bq" placeholder="Buscar cliente, folio, texto del mensaje…" value="${esc(f.q)}">
        <div class="sel-estado">${[['', 'Todo'], ...BIT_TIPOS.map(t => [t, t])].map(([k, t]) => `<button type="button" data-bt="${k}" class="${f.tipo === k ? 'on' : ''}">${t}${k ? ` (${BIT.lista.filter(x => x.tipo === k).length})` : ''}</button>`).join('')}</div>
        <select class="input" id="bu">${opts(nombres, f.quien, 'Todas las personas')}</select>
        <span class="note">${lista.length} movimiento${lista.length === 1 ? '' : 's'}${lista.length > 400 ? ' · se muestran los 400 más recientes' : ''}</span>
      </div>
      <div class="table-wrap">${filas ? `<table class="table bit"><thead><tr><th>Hora</th><th>Quién</th><th>Tipo</th><th>Qué hizo</th></tr></thead><tbody>${filas}</tbody></table>` : `<div class="empty">${BIT.cuando ? (BIT.lista.length ? 'Nada coincide con esos filtros.' : 'Todavía no hay movimientos. La bitácora empieza a llenarse desde hoy con lo que haga el equipo.') : 'Cargando la bitácora…'}</div>`}</div>`,
      'Bitácora', 'Todo lo que hace el equipo: quién le escribe a qué cliente por WhatsApp, altas y cambios de clientes, ventas, pagos, productos, usuarios y accesos.',
      `<button class="btn sm" id="bRef">↻ Actualizar</button>`);
    $('#bq').oninput = () => { f.q = $('#bq').value; vistaBitacora(); const i = $('#bq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $$('[data-bt]').forEach(b => b.onclick = () => { f.tipo = b.dataset.bt; vistaBitacora(); });
    $('#bu').onchange = () => { f.quien = $('#bu').value; vistaBitacora(); };
    $('#bRef').onclick = () => { BIT.cuando = 0; cargarBitacora(); };
  }

  // ───────── Lo vendido (control por modelo y por vendedor) ─────────
  // Cuenta las ventas con pago y no canceladas. El servidor ya filtra: el vendedor solo recibe sus ventas, el admin todas.
  function vistaVendido() {
    const f = S.filtros.r || (S.filtros.r = { periodo: 'mes', vendedor: '' });
    const hoy = new Date(); const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1); const iniAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const enPeriodo = v => { const d = new Date(v.creado); return f.periodo === 'mes' ? d >= ini : f.periodo === 'anterior' ? d >= iniAnt && d < ini : true; };
    const ventas = S.ventas.filter(v => conPago(v) && v.estado !== 'cancelado' && enPeriodo(v) && (!f.vendedor || v.vendedorId === f.vendedor));
    const X = (S.catalogo && S.catalogo.extras) || [];
    const modelos = new Map();
    ventas.forEach(v => v.lineas.forEach(l => {
      const tipo = l.id ? 'Catálogo' : l.extraId ? 'Agregado por el equipo' : 'Escrito a mano';
      const key = l.id || l.extraId || 'm:' + l.nombre.trim().toLowerCase();
      const m = modelos.get(key) || { nombre: l.nombre, tipo, piezas: 0, importe: 0, ventas: new Set(), vend: new Set() };
      m.piezas += l.qty; m.importe += l.unit * l.qty; m.ventas.add(v.folio); m.vend.add(v.vendedorId); modelos.set(key, m);
    }));
    const filas = [...modelos.values()].sort((a, b) => b.importe - a.importe);
    const porVend = new Map();
    ventas.forEach(v => { const r = porVend.get(v.vendedorId) || { ventas: 0, piezas: 0, total: 0, cobrado: 0 }; r.ventas++; r.piezas += v.lineas.reduce((s, l) => s + l.qty, 0); r.total += v.total; r.cobrado += pagado(v); porVend.set(v.vendedorId, r); });
    const tot = { piezas: filas.reduce((s, m) => s + m.piezas, 0), importe: ventas.reduce((s, v) => s + v.total, 0), cobrado: ventas.reduce((s, v) => s + pagado(v), 0) };
    shell(`
      <div class="filters">
        <select class="input" id="rp">${opts([['mes', 'Este mes'], ['anterior', 'Mes pasado'], ['todo', 'Todo']], f.periodo)}</select>
        ${admin() ? `<select class="input" id="rv">${opts(S.usuarios.filter(u => u.rol === 'vendedor' || S.ventas.some(v => v.vendedorId === u.id)).map(u => [u.id, u.nombre]), f.vendedor, 'Todos los vendedores')}</select>` : ''}
        <span class="note">Cuenta pedidos con pago o anticipo · *Precios sin IVA</span>
      </div>
      <div class="grid kpis">
        <div class="kpi"><small>Ventas</small><b>${ventas.length}</b><span>pedidos con pago</span></div>
        <div class="kpi"><small>Piezas vendidas</small><b>${tot.piezas}</b><span>${filas.length} modelo${filas.length === 1 ? '' : 's'} distintos</span></div>
        <div class="kpi"><small>Importe vendido</small><b>${fmt(tot.importe)}</b><span>total de los pedidos</span></div>
        <div class="kpi ok"><small>Cobrado</small><b>${fmt(tot.cobrado)}</b><span>pagos registrados</span></div>
      </div>
      <h2 style="font-size:15px;margin:22px 0 10px">Por modelo</h2>
      <div class="table-wrap">${filas.length ? `<table class="table"><thead><tr><th>Modelo</th><th>Tipo</th><th class="num">Piezas</th><th class="num">Pedidos</th>${admin() ? '<th>Vendedores</th>' : ''}<th class="num">Importe</th></tr></thead><tbody>
        ${filas.map(m => `<tr><td><b>${esc(m.nombre)}</b></td><td><span class="badge origen">${m.tipo}</span></td><td class="num">${m.piezas}</td><td class="num">${m.ventas.size}</td>${admin() ? `<td>${[...m.vend].map(id => esc(nombreU(id))).join(', ')}</td>` : ''}<td class="num">${fmt(m.importe)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No hay ventas con pago en este periodo.</div>'}</div>
      ${admin() && porVend.size ? `<h2 style="font-size:15px;margin:22px 0 10px">Por vendedor</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Vendedor</th><th class="num">Pedidos</th><th class="num">Piezas</th><th class="num">Vendido</th><th class="num">Cobrado</th></tr></thead><tbody>
        ${[...porVend.entries()].sort((a, b) => b[1].total - a[1].total).map(([id, r]) => `<tr><td><b>${esc(nombreU(id))}</b></td><td class="num">${r.ventas}</td><td class="num">${r.piezas}</td><td class="num">${fmt(r.total)}</td><td class="num">${fmt(r.cobrado)}</td></tr>`).join('')}
      </tbody></table></div>` : ''}`,
      admin() ? 'Lo vendido' : 'Lo que vendí', admin() ? 'Control de todo lo que se vende: por modelo (del catálogo, agregados por el equipo o escritos a mano) y por vendedor.' : 'Tus ventas por modelo. Solo ves lo que tú vendiste.');
    $('#rp').onchange = () => { f.periodo = $('#rp').value; vistaVendido(); };
    const rv = $('#rv'); if (rv) rv.onchange = () => { f.vendedor = rv.value; vistaVendido(); };
  }

  // ───────── Ventas ─────────
  function vistaVentas() {
    const f = S.filtros.v || (S.filtros.v = { q: '', estado: '', etapa: '', sucursal: '', origen: '', vendedor: '' });
    const lista = S.ventas.filter(v => conPago(v) && (!f.estado || v.estado === f.estado) && (!f.etapa || (v.etapa || 'recibido') === f.etapa) && (!f.sucursal || v.sucursal === f.sucursal) && (!f.origen || v.origen === f.origen) && (!f.vendedor || v.vendedorId === f.vendedor)
      && (!f.q || (v.folio + ' ' + v.cliente.nombre + ' ' + v.cliente.tel + ' ' + v.lineas.map(l => l.nombre).join(' ')).toLowerCase().includes(f.q.toLowerCase())));
    const tot = lista.reduce((s, v) => s + (v.estado === 'cancelado' ? 0 : v.total), 0), cob = lista.reduce((s, v) => s + pagado(v), 0);
    shell(`
      <div class="filters">
        <input class="input buscar" id="fq" placeholder="Buscar folio, cliente, teléfono…" value="${esc(f.q)}">
        <select class="input" id="fe">${opts(Object.entries(ESTADO_V).filter(([k]) => k !== 'pendiente'), f.estado, 'Todos los pagos')}</select>
        <select class="input" id="fet">${opts(Object.entries(ETAPA_V), f.etapa || '', 'Todas las etapas')}</select>
        ${S.sucursales.length ? `<select class="input" id="fs">${opts(S.sucursales, f.sucursal, 'Todas las sucursales')}</select>` : ''}
        <select class="input" id="fo">${opts(Object.entries(ORIGEN), f.origen, 'Todos los orígenes')}</select>
        ${admin() ? `<select class="input" id="fv">${opts(S.usuarios.filter(u => u.rol === 'vendedor' || S.ventas.some(v => v.vendedorId === u.id)).map(u => [u.id, u.nombre]), f.vendedor, 'Todos los vendedores')}</select>` : ''}
        <span class="note">${lista.length} venta${lista.length === 1 ? '' : 's'} · ${fmt(tot)} · cobrado ${fmt(cob)}</span>
      </div>
      <div class="table-wrap">${lista.length ? `<table class="table"><thead><tr><th>Folio</th><th>Cliente</th><th>Artículos</th><th>Pago</th><th>Pagó con</th><th>Pedido</th><th>Origen</th>${admin() ? '<th>Vendedor</th>' : ''}<th>Sucursal</th><th class="num">Total</th><th class="num">Saldo</th></tr></thead><tbody>
        ${lista.map(v => `<tr class="row" data-venta="${v.folio}"><td><b>${v.folio}</b><small>${dia(v.creado)}</small></td><td>${esc(v.cliente.nombre)}<small>${v.cliente.tel}</small></td><td>${v.lineas.map(l => `${l.qty} × ${esc(l.nombre)}${l.colorNombre ? ' · ' + esc(l.colorNombre) : ''}`).join('<br>')}</td><td>${badge(v.estado)}</td><td><small style="display:block;max-width:180px;white-space:normal">${esc(pagoCon(v))}</small></td><td>${badge(v.etapa || 'recibido', ETAPA_V)}</td><td><span class="badge origen">${ORIGEN[v.origen] || v.origen}</span></td>${admin() ? celdaVend(v) : ''}<td>${esc(v.sucursal || '—')}</td><td class="num">${fmt(v.total)}</td><td class="num">${saldo(v) ? `<b style="color:var(--warn)">${fmt(saldo(v))}</b>` : '<span style="color:var(--ok)">Pagado</span>'}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No hay ventas con esos filtros.</div>'}</div>`,
      admin() ? 'Ventas' : 'Mis ventas', 'Solo pedidos con pago o anticipo. Los que no han pagado están en «Sin pago».',
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
  function formVenta(lead, pre) {
    const C = S.catalogo; const X = C.extras || [];
    const exDe = id => X.find(e => e.id === id);
    const lineaDe = (id, qty) => { const e = exDe(id); return e ? { id, nombre: e.nombre, unit: e.precio, qty: qty || 1, color: '' } : { id, color: '', qty: qty || 1, unit: 0, nombre: '' }; };
    const ini = pre && (C.productos.some(p => p.id === pre.id) || exDe(pre.id)) ? pre.id : C.productos[0].id;
    let lineas = [lineaDe(ini)];
    // Catálogo del sitio, luego los modelos que ha agregado el equipo, y al final «escribir uno nuevo».
    const prodOpts = v => opts(C.productos.map(p => [p.id, p.nombre + ' · ' + fmt(p.precio)]), v) + (X.length ? `<optgroup label="Agregados por el equipo">${opts(X.map(e => [e.id, e.nombre + ' · ' + fmt(e.precio)]), v)}</optgroup>` : '') + opts([['__manual', '✎ Modelo que no está en la lista (escribir modelo y precio)']], v);
    const lineaHtml = (l, i) => { const p = C.productos.find(x => x.id === l.id); const e = exDe(l.id); return `<div class="linea" data-i="${i}">
      <select class="input" data-k="id">${prodOpts(l.id || '__manual')}</select>
      ${p ? `<select class="input" data-k="color">${opts([['', 'Color…']].concat(p.tapiz.map(t => [t, C.tapiz[t].name])), l.color)}</select>` : e ? `<input class="input" value="Agregado por ${esc((e.creadoNombre || '').split(' ')[0] || 'el equipo')}" readonly tabindex="-1">` : `<input class="input" data-k="nombre" placeholder="Modelo que vendiste" value="${esc(l.nombre)}">`}
      <input class="input" data-k="qty" type="number" min="1" value="${l.qty}" title="Cantidad">
      <input class="input" data-k="unit" type="number" min="0" value="${p ? precioDe(p, l.color) : (l.unit || '')}" ${p ? 'readonly' : 'placeholder="Precio"'} title="${p ? 'Precio de lista' : 'Precio unitario que cobraste'}">
      <button type="button" class="x" data-del>×</button>${!p && !e ? `<label class="chk guardar-modelo"><input type="checkbox" data-k="guardar" ${l.guardar !== false ? 'checked' : ''}> Agregar este modelo a la lista del sistema (no sale en la página web; queda para la próxima venta y el administrador lo ve en su control)</label>` : ''}</div>`; };
    const origenes = Object.entries(ORIGEN).filter(([k]) => admin() || !ORIGEN_ADMIN.includes(k));
    const vendedoresOpts = () => S.usuarios.filter(u => u.activo).sort((a, b) => (a.rol === 'admin') - (b.rol === 'admin') || a.nombre.localeCompare(b.nombre)).map(u => [u.id, u.nombre + (u.rol === 'admin' ? ' (admin)' : '')]);
    const precioDe = (p, color) => p.precio;
    const calc = () => { const sub = lineas.reduce((s, l) => { const p = C.productos.find(x => x.id === l.id); return s + (p ? p.precio : +l.unit || 0) * (+l.qty || 1); }, 0); const env = +($('#envCosto') && $('#envCosto').value) || 0; const desc = +($('#desc') && $('#desc').value) || 0; const base = Math.max(0, sub + env - desc); const iva = $('#facV') && $('#facV').checked ? Math.round(base * 0.16) : 0; return { sub, env, desc, iva, total: base + iva }; };
    const m = modal(lead ? 'Registrar venta de ' + esc(lead.nombre || lead.tel) : 'Nuevo pedido', `
      <div class="fields">
        <div class="field"><label>Cliente</label><input class="input" id="cNombre" value="${esc(lead ? lead.nombre : '')}" placeholder="Nombre completo"></div>
        <div class="field"><label>WhatsApp (10 dígitos)</label><input class="input" id="cTel" inputmode="tel" value="${esc(lead ? lead.tel : '')}"></div>
        <div class="field"><label>Correo (opcional)</label><input class="input" id="cEmail" type="email"></div>
        <div class="field"><label>¿Dónde compró?</label><select class="input" id="origen">${opts(origenes, lead ? (ORIGEN_ADMIN.includes(lead.origen) && !admin() ? 'whatsapp' : lead.origen === 'sitio' ? 'whatsapp' : lead.origen) : 'sucursal')}</select></div>
        <div class="field"><label>Sucursal</label>${S.sucursales.length ? `<select class="input" id="suc">${opts(S.sucursales, S.yo.sucursal || S.sucursales[0], 'Sin sucursal')}</select>` : `<input class="input" id="suc" value="${esc(S.yo.sucursal || '')}" placeholder="Opcional">`}</div>
        ${admin() ? `<div class="field"><label>Vendedor (a quién se le asigna)</label><select class="input" id="vend">${opts(vendedoresOpts(), lead && lead.vendedorId ? lead.vendedorId : S.yo.id)}</select><span class="note">Para ventas de Mercado Libre, elige el vendedor que la va a atender.</span></div>` : ''}
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
      $$('[data-k]', row).forEach(inp => inp.onchange = inp.oninput = () => { const k = inp.dataset.k; if (k === 'id') { if (inp.value === '__manual') { lineas[i] = { id: null, nombre: '', unit: 0, qty: lineas[i].qty, color: '', guardar: true }; } else { lineas[i] = lineaDe(inp.value, lineas[i].qty); } pintar(); } else { lineas[i][k] = inp.type === 'checkbox' ? inp.checked : inp.value; totales(); } });
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
      if (lineas.some(l => !l.id && (String(l.nombre || '').trim().length < 2 || !(+l.unit > 0)))) return toast('Escribe el modelo y el precio del artículo que no está en la lista');
      if (lineas.some(l => exDe(l.id) && !(+l.unit > 0))) return toast('Escribe el precio del modelo');
      // Los modelos nuevos marcados «Agregar a la lista» se guardan primero; así la venta ya queda ligada a la lista.
      for (const l of lineas.filter(x => !x.id && x.guardar !== false)) {
        try { const r = await api('/api/datos?c=modelos', { accion: 'crear', nombre: l.nombre, precio: +l.unit }); l.id = r.modelo.id; } catch (e) { return toast(e.message); }
      }
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
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">${badge(vv.estado)}<span class="badge origen">${ORIGEN[vv.origen] || vv.origen}</span><span class="note">${fecha(vv.creado)}${vv.sucursal ? ' · ' + esc(vv.sucursal) : ''} · Vendedor: ${esc(nombreU(vv.vendedorId))}${admin() ? ' · Alta: ' + esc(altaDe(vv)) : ''}</span></div>
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
              <div class="pagos">${(vv.pagos || []).map(p => `<div><span>${fecha(p.cuando)}<br><small>${esc(METODO_N[p.metodo] || p.metodo)}${p.ref ? ' · ' + esc(p.ref) : ''} · ${esc(p.quien || '')}</small></span><span class="num"><b>${fmt(p.monto)}</b>${admin() ? ` <button class="x" data-qp="${p.id}" title="Quitar" style="border:none;background:none;cursor:pointer;color:var(--muted)">×</button>` : ''}</span></div>`).join('') || '<div class="note">Sin pagos todavía.</div>'}</div>
              <div class="saldo"><span>${saldo(vv) > 0 ? 'Saldo por cobrar' : 'Pagado completo'}</span><b>${saldo(vv) > 0 ? fmt(saldo(vv)) : fmt(pagado(vv))}</b></div>
              ${saldo(vv) > 0 && vv.estado !== 'cancelado' ? `<div class="fields" style="margin-top:12px"><div class="field"><label>Registrar pago</label><input class="input" id="abMonto" type="number" min="1" placeholder="${saldo(vv)}"></div><div class="field"><label>Método</label><select class="input" id="abMet">${opts(METODOS, 'efectivo')}</select></div><div class="field full"><input class="input" id="abRef" placeholder="Referencia o nota (opcional)"></div></div><button class="btn primary sm" id="abonar" style="width:100%">Guardar pago</button>${S.ajustes.mpConfigurado ? `<button class="btn sm" id="mpLink" style="width:100%;margin-top:8px">Enlace de pago Mercado Pago</button>` : ''}` : ''}
            </div>
            <div class="box" style="padding:14px 16px;margin-top:12px"><h2 style="font-size:14px">Estado del pago</h2>${admin() ? `<select class="input" id="estV">${opts(Object.entries(ESTADO_V), vv.estado)}</select>
              <div class="field" style="margin-top:10px"><label>Vendedor asignado</label><select class="input" id="asigV">${opts(S.usuarios.filter(u => u.activo || u.id === vv.vendedorId).sort((a, b) => (a.rol === 'admin') - (b.rol === 'admin') || a.nombre.localeCompare(b.nombre)).map(u => [u.id, u.nombre + (u.rol === 'admin' ? ' (admin)' : '')]), vv.vendedorId, 'Sin vendedor')}</select></div>` : `<div>${badge(vv.estado)}</div><p class="note" style="margin:6px 0 0">Se actualiza solo al registrar pagos.</p>`}
              <div style="display:grid;gap:8px;margin-top:12px"><a class="btn ink sm" style="background:var(--ink);color:var(--ink-fg)" href="${ticketUrl(folio, k)}" target="_blank" rel="noopener">Ver / imprimir ticket</a>${vv.cliente.tel ? `<a class="btn wa sm" href="${waLink(vv.cliente.tel, waTicket)}" target="_blank" rel="noopener">Mandar ticket por WhatsApp</a>` : ''}<button class="btn sm" id="editV">Editar datos del cliente</button><button class="btn sm" id="notaV">Agregar nota</button>${admin() ? '<button class="btn sm" id="elimV" style="color:#b4322b;border-color:#e7b9b4">Eliminar pedido (prueba)</button>' : ''}</div>
            </div>
          </div>
        </div>`;
      const ab = $('#abonar'); if (ab) ab.onclick = async () => { const monto = +$('#abMonto').value; if (!monto) return toast('Escribe el monto'); try { await api('/api/datos?c=ventas', { accion: 'abonar', folio, monto, metodo: $('#abMet').value, ref: $('#abRef').value }); toast('Pago registrado'); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      $$('[data-qp]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar este pago?')) return; try { await api('/api/datos?c=ventas', { accion: 'quitarPago', folio, pagoId: b.dataset.qp }); await cargar(); pintar(); } catch (e) { toast(e.message); } });
      const guardarSeg = async datos => { await api('/api/datos?c=ventas', { accion: 'etapa', folio, ...datos }); await cargar(); pintar(); };
      $$('[data-et]').forEach(b => b.onclick = async () => { try { await guardarSeg({ etapa: b.dataset.et, fechaEntrega: $('#feEnt').value, notaCliente: $('#notaCli').value }); toast('Pedido: ' + ETAPA_V[b.dataset.et]); enviarEstado(folio, k); } catch (e) { toast(e.message); } });
      $('#guardaSeg').onclick = async () => { try { await guardarSeg({ fechaEntrega: $('#feEnt').value, notaCliente: $('#notaCli').value }); toast('Guardado'); } catch (e) { toast(e.message); } };
      $('#enviarEstado').onclick = async () => { try { await guardarSeg({ fechaEntrega: $('#feEnt').value, notaCliente: $('#notaCli').value }); } catch (e) {} enviarEstado(folio, k); };
      const est = $('#estV'); if (est) est.onchange = async () => { try { await api('/api/datos?c=ventas', { accion: 'estado', folio, estado: est.value }); toast('Estado actualizado'); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      const asg = $('#asigV'); if (asg) asg.onchange = async () => { try { await api('/api/datos?c=ventas', { accion: 'editar', folio, vendedorId: asg.value }); toast('Venta asignada a ' + nombreU(asg.value)); await cargar(); pintar(); } catch (e) { toast(e.message); } };
      const mpb = $('#mpLink'); if (mpb) mpb.onclick = async () => { try { const r = await api('/api/mp', { accion: 'enlace', folio }); await navigator.clipboard.writeText(r.url).catch(() => {}); toast('Enlace de pago copiado'); window.open(r.url, '_blank'); } catch (e) { toast(e.message); } };
      $('#editV').onclick = () => { const vv2 = S.ventas.find(x => x.folio === folio); const m2 = modal('Editar venta ' + folio, `<div class="fields"><div class="field"><label>Nombre</label><input class="input" id="eN" value="${esc(vv2.cliente.nombre)}"></div><div class="field"><label>WhatsApp</label><input class="input" id="eT" value="${vv2.cliente.tel}"></div><div class="field"><label>Correo</label><input class="input" id="eE" value="${esc(vv2.cliente.email || '')}"></div><div class="field"><label>Sucursal</label><input class="input" id="eS" value="${esc(vv2.sucursal || '')}"></div>${admin() ? `<div class="field"><label>Vendedor</label><select class="input" id="eV">${opts(S.usuarios.map(u => [u.id, u.nombre]), vv2.vendedorId, 'Sin vendedor')}</select></div>` : ''}<div class="field full"><label>Dirección de entrega</label><input class="input" id="eD" value="${esc(vv2.envio.direccion || '')}"></div><div class="field full"><label>Notas</label><input class="input" id="eNo" value="${esc(vv2.notas || '')}"></div></div>`, `<button class="btn primary sm" id="okE">Guardar</button>`);
        $('#okE').onclick = async () => { try { await api('/api/datos?c=ventas', { accion: 'editar', folio, cliente: { nombre: $('#eN').value, tel: $('#eT').value, email: $('#eE').value }, sucursal: $('#eS').value, vendedorId: $('#eV') ? $('#eV').value : undefined, envio: { tipo: vv2.envio.tipo, estado: vv2.envio.estado, direccion: $('#eD').value }, notas: $('#eNo').value }); m2.cerrar(); await cargar(); detalleVenta(folio, k); } catch (e) { toast(e.message); } }; };
      const elim = $('#elimV'); if (elim) elim.onclick = async () => {
        const t = prompt('Esto borra el pedido ' + folio + ' para siempre (úsalo solo con pedidos de prueba).\n\nPara confirmar, escribe el folio: ' + folio);
        if (t === null) return;
        if (t.trim().toUpperCase() !== folio.toUpperCase()) return toast('El folio no coincide; no se borró nada');
        try { await api('/api/datos?c=ventas', { accion: 'eliminar', folio, confirmar: t.trim() }); cerrarModal(); toast('Pedido ' + folio + ' eliminado'); await cargar(); render(); } catch (e) { toast(e.message); }
      };
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

  // ───────── Sin pago ─────────
  // Pedidos que nadie ha pagado: no cuentan como venta. Al registrar un pago (o al aprobarse en Mercado Pago) pasan solos a Ventas.
  function vistaSinPago() {
    const f = S.filtros.sp || (S.filtros.sp = { q: '', desc: false });
    const lista = S.ventas.filter(v => pagado(v) === 0 && (f.desc ? v.estado === 'cancelado' : v.estado !== 'cancelado'))
      .filter(v => !f.q || (v.folio + ' ' + v.cliente.nombre + ' ' + v.cliente.tel).toLowerCase().includes(f.q.toLowerCase()));
    const msg = v => `Hola ${(v.cliente.nombre || '').split(' ')[0]}, te escribo de Cardian Muebles. Vi que tu pedido ${v.folio} (${v.lineas.map(l => l.nombre).join(', ')}) por ${fmt(v.total)} quedó pendiente de pago. ¿Te ayudo a terminarlo o tienes alguna duda?`;
    shell(`
      <div class="filters">
        <input class="input buscar" id="spq" placeholder="Buscar folio, cliente, teléfono…" value="${esc(f.q)}">
        <label class="chk" style="margin:0"><input type="checkbox" id="spd" ${f.desc ? 'checked' : ''}> Ver descartados</label>
        <span class="note">${lista.length} pedido${lista.length === 1 ? '' : 's'} · ${fmt(lista.reduce((s, v) => s + v.total, 0))}</span>
      </div>
      <div class="table-wrap">${lista.length ? `<table class="table"><thead><tr><th>Folio</th><th>Cliente</th><th>Artículos</th><th>Origen</th>${admin() ? '<th>Vendedor</th>' : ''}<th class="num">Total</th><th></th></tr></thead><tbody>
        ${lista.map(v => `<tr data-sp="${v.folio}"><td><b>${v.folio}</b><small>${hace(v.creado)}</small></td><td>${esc(v.cliente.nombre)}<small>${v.cliente.tel}</small></td><td>${v.lineas.map(l => `${l.qty} × ${esc(l.nombre)}${l.colorNombre ? ' · ' + esc(l.colorNombre) : ''}`).join('<br>')}</td><td><span class="badge origen">${ORIGEN[v.origen] || v.origen}</span></td>${admin() ? celdaVend(v) : ''}<td class="num">${fmt(v.total)}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${v.cliente.tel ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(v.cliente.tel, msg(v))}">Escribirle</a>` : ''}<button class="btn sm" data-ver="${v.folio}">Ver / cobrar</button>${f.desc ? `<button class="btn sm" data-rec="${v.folio}">Recuperar</button>` : `<button class="btn sm" data-desc="${v.folio}">Descartar</button>`}</div></td></tr>`).join('')}
      </tbody></table>` : `<div class="empty">${f.desc ? 'No hay pedidos descartados.' : 'No hay pedidos sin pago. 🎉'}</div>`}</div>`,
      'Sin pago', 'Pedidos que aún no pagan. No cuentan en ventas; en cuanto registras un pago pasan a Ventas.',
      `<button class="btn gold sm" id="nuevaVenta">+ Nuevo pedido</button>`);
    enlazarComunes();
    const q = $('#spq'); q.oninput = () => { f.q = q.value; vistaSinPago(); const i = $('#spq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $('#spd').onchange = () => { f.desc = $('#spd').checked; vistaSinPago(); };
    $$('[data-ver]').forEach(b => b.onclick = () => detalleVenta(b.dataset.ver));
    const cambiar = async (folio, estado, txt) => { try { await api('/api/datos?c=ventas', { accion: 'estado', folio, estado }); toast(txt); await cargar(); vistaSinPago(); } catch (e) { toast(e.message); } };
    $$('[data-desc]').forEach(b => b.onclick = () => { if (confirm('¿Descartar el pedido ' + b.dataset.desc + '? Se marca como cancelado y sale de esta lista.')) cambiar(b.dataset.desc, 'cancelado', 'Pedido descartado'); });
    $$('[data-rec]').forEach(b => b.onclick = () => cambiar(b.dataset.rec, 'pendiente', 'Pedido recuperado'));
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
        ${veTodo() ? `<select class="input" id="fv">${opts([['__sin', 'Sin vendedor' + (sinV ? ' (' + sinV + ')' : '')]].concat(S.usuarios.filter(u => u.rol === 'vendedor').map(u => [u.id, u.nombre])), f.vendedor, 'Todos los vendedores')}</select>` : ''}
        <select class="input" id="fo">${opts(Object.entries(ORIGEN), f.origen, 'Todos los orígenes')}</select>
      </div>
      ${veTodo() && sinV ? `<div class="aviso">${sinV} lead${sinV > 1 ? 's' : ''} sin vendedor asignado. <a href="#" id="repartir">Repartir al azar entre los vendedores activos</a></div>` : ''}
      <div class="lead-list">${lista.length ? lista.map(l => `<div class="lead" data-lead="${l.id}">
        <div><b>${esc(l.nombre || 'Sin nombre')}</b> · ${l.tel} ${badge(l.estado, ESTADO_L)} <span class="badge origen">${ORIGEN[l.origen] || l.origen}</span>
          <div class="meta">${l.producto ? `<span>Interés: ${esc(l.producto)}</span>` : ''}<span>${hace(l.creado)}</span>${veTodo() ? `<span>${l.vendedorId ? esc(nombreU(l.vendedorId)) : '<b style="color:var(--warn)">sin vendedor</b>'}</span>` : ''}${l.sucursal ? `<span>${esc(l.sucursal)}</span>` : ''}${l.notas.length ? `<span>${l.notas.length} nota${l.notas.length > 1 ? 's' : ''}</span>` : ''}${l.ventaFolio ? `<span>Venta ${l.ventaFolio}</span>` : ''}</div>
          ${l.mensaje ? `<div class="note" style="margin-top:4px">«${esc(l.mensaje)}»</div>` : ''}${l.ultimoMensaje && l.ultimoMensaje.texto !== l.mensaje ? `<div class="note" style="margin-top:2px">Último mensaje ${hace(l.ultimoMensaje.cuando)}: «${esc(l.ultimoMensaje.texto)}»</div>` : ''}</div>
        <div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLead(l, saludoLead(l))}">WhatsApp</a></div></div>`).join('') : '<div class="empty">No hay leads con esos filtros.</div>'}</div>`,
      veTodo() ? 'Leads' : 'Mis leads', 'Contactos que piden informes: del sitio, de WhatsApp Business o de sucursal. Cada uno se asigna al azar a un vendedor.',
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
        <div class="field"><label>Origen</label><select class="input" id="lO">${opts(Object.entries(ORIGEN).filter(([k]) => k !== 'sitio' && k !== 'mercado-pago' && (veTodo() || k !== 'mercado-libre')), 'whatsapp')}</select></div>
        ${S.sucursales.length ? `<div class="field"><label>Sucursal</label><select class="input" id="lS">${opts(S.sucursales, S.yo.sucursal, 'Sin sucursal')}</select></div>` : ''}
        ${veTodo() ? `<div class="field"><label>Asignar a</label><select class="input" id="lV">${opts([['', 'Al azar parejo entre vendedores activos']].concat(S.usuarios.filter(u => u.activo).map(u => [u.id, u.nombre])), '')}</select></div>` : `<div class="field" style="display:flex;align-items:end"><label class="chk"><input type="checkbox" id="lMio"> Es un cliente que yo traje (me lo quedo)</label></div>`}
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
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${S.ajustes.waBandeja ? `<button class="btn wa sm" id="abrirChat">Abrir chat en el sistema</button>` : ''}${l.tel ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(l.tel, saludoLead(l))}">WhatsApp externo</a><a class="btn sm" href="tel:${l.tel}">Llamar</a>` : ''}${l.estado !== 'compro' ? `<button class="btn gold sm" id="convertir">Registrar venta</button>` : `<button class="btn sm" id="verVenta">Ver venta ${l.ventaFolio}</button>`}</div></div>
            <h2 style="font-size:14px;margin:14px 0 6px">Estado del lead</h2>
            <div class="sel-estado">${Object.entries(ESTADO_L).map(([k, t]) => `<button type="button" data-est="${k}" class="${l.estado === k ? 'on' : ''}">${t}</button>`).join('')}</div>
            <div class="field" style="margin-top:12px"><label>Nota</label><div style="display:flex;gap:8px"><input class="input" id="nota" placeholder="Qué pasó en la llamada, qué cotizaste…"><button class="btn sm" id="okNota">Guardar</button></div></div>
            ${veTodo() ? `<div class="field"><label>Vendedor</label><select class="input" id="asig">${opts(S.usuarios.filter(u => u.activo).map(u => [u.id, u.nombre]), l.vendedorId, 'Sin vendedor')}</select></div>` : ''}
            <button class="btn sm" id="editL">Editar datos</button>${admin() ? '<button class="btn sm" id="elimL" style="color:#b4322b;border-color:#e7b9b4;margin-left:6px">Eliminar lead (prueba)</button>' : ''}
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
      const ac = $('#abrirChat'); if (ac) ac.onclick = () => { cerrarModal(); const jid = l.waJid || ('52' + l.tel + '@s.whatsapp.net'); location.hash = '#/whatsapp?chat=' + encodeURIComponent(jid); };
      const elL = $('#elimL'); if (elL) elL.onclick = async () => { if (!confirm('¿Eliminar este lead para siempre? Úsalo solo con leads de prueba.')) return; try { await api('/api/datos?c=leads', { accion: 'eliminar', id }); cerrarModal(); toast('Lead eliminado'); await cargar(); render(); } catch (e) { toast(e.message); } };
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
          ${lista.map(u => { const c = cuenta(u); return `<tr><td><b>${esc(u.nombre)}</b><small>${ROL_N[u.rol] || 'Vendedor'}${!u.activo ? ' · <b style="color:#b4322b">desactivado</b>' : u.rol === 'vendedor' && u.recibeLeads === false ? ' · no recibe leads' : ''}${u.cambiarClave ? ' · debe cambiar contraseña' : ''}${!compartido() && u.whatsapp ? ' · WA ' + u.whatsapp : ''}</small></td><td>${esc(u.usuario)}</td><td>${esc(u.sucursal || '—')}</td><td>${c.abiertos}</td><td>${c.semana}</td><td class="num">${fmt(c.ventas)}</td><td style="white-space:nowrap"><button class="btn sm" data-edit="${u.id}">Editar</button> <button class="btn sm" data-clave="${u.id}">Contraseña</button></td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="box"><h2>Sucursales</h2><p class="note" style="margin:0 0 10px">Para filtrar ventas y leads por sucursal. Una por línea.</p><textarea class="input" id="sucs" style="min-height:110px">${esc(S.sucursales.join('\n'))}</textarea><button class="btn sm" id="okSucs" style="margin-top:8px">Guardar sucursales</button>
          <h2 style="margin-top:22px">Cómo se reparten los leads</h2><p class="note">Cada contacto nuevo (del sitio, del WhatsApp o capturado aquí) se asigna <b>al azar parejo solo entre los vendedores</b> activos que reciben leads (a los administradores no les llegan): le toca a uno de los que llevan menos en la semana. Si solo hay un vendedor, le llegan todos. Si el lead trae sucursal y hay vendedores de esa sucursal, se reparte entre ellos.${compartido() ? ' Todos contestan desde el mismo WhatsApp Business del negocio, firmando con su nombre.' : ''}</p></div>
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
        <div class="field"><label>Usuario para entrar</label><input class="input" id="uU" value="${esc(u ? u.usuario : '')}" placeholder="ej. maria (sin espacios)"></div>
        <div class="field"><label>Rol</label><select class="input" id="uR" ${u && u.id === S.yo.id ? 'disabled' : ''}>${opts([['vendedor', 'Vendedor (muebles, sus leads y sus ventas)'], ['supervisor', 'Admin de atención (Muebles, Leads y WhatsApp)'], ['admin', 'Administrador (ve todo)']], u ? u.rol : 'vendedor')}</select><span class="note">El vendedor ve el catálogo con precios, registra lo que vende (aunque el modelo no esté en la lista), imprime o manda el ticket, y solo ve sus leads y sus ventas. El admin de atención solo ve Muebles, Leads y WhatsApp, pero de todos los vendedores.</span></div>
        <div class="field"><label>Sucursal</label>${S.sucursales.length ? `<select class="input" id="uS">${opts(S.sucursales, u ? u.sucursal : '', 'Sin sucursal')}</select>` : `<input class="input" id="uS" value="${esc(u ? u.sucursal : '')}" placeholder="Opcional">`}</div>
        ${compartido() ? `<input type="hidden" id="uW" value="${u ? u.whatsapp || '' : ''}">` : `<div class="field"><label>WhatsApp propio (10 dígitos)</label><input class="input" id="uW" inputmode="tel" value="${u ? u.whatsapp || '' : ''}"><span class="note">A este número llegan los clientes del sitio que le toquen.</span></div>`}
        <div class="field" style="display:flex;flex-direction:column;justify-content:end;gap:8px"><label class="chk"><input type="checkbox" id="uL" ${!u || u.recibeLeads !== false ? 'checked' : ''}> Recibe leads del reparto</label>${u && u.id !== S.yo.id ? `<label class="chk"><input type="checkbox" id="uA" ${u.activo ? 'checked' : ''}> Cuenta activa (si la quitas, ya no puede entrar)</label>` : ''}</div>
        ${!u ? `<div class="field full"><label>Contraseña</label><input class="input" id="uC" placeholder="Escribe una (mínimo 8) o déjala vacía y se genera"><label class="chk" style="margin-top:8px"><input type="checkbox" id="uO" checked> Pedirle que la cambie la primera vez que entre</label></div>` : ''}
      </div>
      <div id="uTemp"></div>`,
      `${u ? `<button class="btn sm" id="uClave">Asignar contraseña</button>` : ''}<button class="btn primary sm" id="okU">${u ? 'Guardar cambios' : 'Crear usuario'}</button>`);
    $('#okU').onclick = async () => {
      try {
        const datos = { nombre: $('#uN').value, whatsapp: $('#uW').value, sucursal: $('#uS').value, rol: $('#uR').value, recibeLeads: $('#uL').checked, activo: $('#uA') ? $('#uA').checked : undefined };
        if (u) { await api('/api/datos?c=usuarios', { accion: 'editar', id: u.id, usuario: $('#uU').value, ...datos }); m.cerrar(); toast('Guardado'); }
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
      <div class="field"><label>Nueva contraseña</label><div style="display:flex;gap:8px"><input class="input" id="kC" placeholder="Mínimo 8 caracteres"><button type="button" class="btn sm" id="kGen">Generar</button></div></div>
      <label class="chk"><input type="checkbox" id="kO" ${u.id === S.yo.id ? '' : 'checked'}> Pedirle que la cambie al entrar</label>
      <div id="kRes" style="margin-top:12px"></div>`,
      `<button class="btn primary sm" id="kOk">Guardar contraseña</button>`);
    $('#kGen').onclick = () => { $('#kC').value = 'Cardian' + Math.floor(1000 + Math.random() * 9000); };
    $('#kOk').onclick = async () => {
      const clave = $('#kC').value.trim();
      if (clave && clave.length < 8) return toast('Mínimo 8 caracteres');
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
            ${a.waConfigurado ? `<div class="aviso ok">Receptor listo${a.waFirma ? ' con firma de Meta' : ' (falta <b>WA_APP_SECRET</b> para validar la firma)'}. Cada mensaje nuevo al WhatsApp Business crea el lead y lo asigna solo.</div>` : `<div class="aviso">Aún no conectado. Mientras tanto, usa la captura rápida o la bandeja de abajo.</div>`}
            <p class="note">URL para Meta o el proveedor: <span class="copy">${location.origin}/api/wa-webhook</span><br>Variables en Vercel: <span class="copy">WA_VERIFY_TOKEN</span> (una palabra que inventas y pegas también en Meta) y <span class="copy">WA_APP_SECRET</span> (clave secreta de la app de Meta).</p>
          </div>
          <div class="box" style="margin-top:14px"><h2>Bandeja de WhatsApp en el sistema</h2>
            ${a.waBandeja ? `<div class="aviso ok">Bandeja activa. Los vendedores ven sus chats y responden desde <a href="#/whatsapp">WhatsApp</a>.</div>` : `<div class="aviso">Bandeja apagada. Para encenderla, configura en Vercel estas tres variables:</div>`}
            <p class="note"><span class="copy">WA_API_URL</span> URL del servidor WA (ej. https://whats.appsoluciones.duckdns.org)<br><span class="copy">WA_SERVICE_TOKEN</span> token del servicio (mínimo 32 caracteres)<br><span class="copy">WA_ACCOUNT_ID</span> id numérico de la cuenta Cardian en ese servidor<br><span class="copy">WA_ACT_AS</span> <small>(opcional, por defecto <b>admin</b>)</small></p>
            <p class="note">Esta bandeja no reemplaza al WhatsApp Business del celular: lo <b>refleja</b>. Los vendedores pueden seguir contestando desde el celular; lo que escriban aquí sale por el mismo número.</p>
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
            <h2 style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:10px">Últimos accesos <button class="btn sm" id="limpiarBit" type="button">Limpiar bitácora</button></h2>${(S.accesos || []).length ? `<ul class="hist">${S.accesos.slice(0, 15).map(x => `<li><time>${fecha(x.cuando)}</time><span><b>${esc(x.usuario)}</b> · ${x.ok ? '<span style="color:var(--ok)">entró</span>' : '<span style="color:#b4322b">' + esc(x.motivo || 'falló') + '</span>'} · ${esc(x.ip)}</span></li>`).join('')}</ul>` : '<div class="note">Sin registros todavía.</div>'}
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
    const lb = $('#limpiarBit'); if (lb) lb.onclick = async () => { if (!confirm('¿Borrar la bitácora de accesos? Quedará solo el registro de esta limpieza.')) return; try { await api('/api/datos?c=ajustes', { accion: 'limpiarBitacora' }); toast('Bitácora limpia'); await cargar(); render(); } catch (e) { toast(e.message); } };
    $('#okA').onclick = async () => { try { await api('/api/datos?c=ajustes', { negocio: $('#aNeg').value, waNegocio: $('#aWa').value, numeroCompartido: $('#aComp').value, leyendaTicket: $('#aLey').value }); toast('Guardado'); await cargar(); } catch (e) { toast(e.message); } };
    $('#clave').onclick = () => pedirClave(false);
    const sy = $('#sync'); if (sy) sy.onclick = async () => { await sincronizarMP(); try { const r = await api('/api/mp', { accion: 'sincronizar', dias: 30 }); if (r.sueltos.length) $('#sueltos').innerHTML = `<h2 style="margin-top:14px">Pagos sin pedido (${r.sueltos.length})</h2><p class="note">Pagos aprobados en la cuenta que no traen folio (links manuales, cobros en tienda). Lígalos a su venta:</p>${r.sueltos.map(p => `<div class="pagos"><div><span>${fecha(p.cuando)} · ${esc(p.quien)}<br><small>${esc(p.metodo)} ${esc(p.descripcion)}</small></span><span><b>${fmt(p.monto)}</b> <input class="input" style="width:110px;padding:6px;display:inline-block" placeholder="CM-1001" data-lig="${p.id}"></span></div></div>`).join('')}`; $$('[data-lig]').forEach(i => i.onchange = async () => { try { await api('/api/mp', { accion: 'ligar', pagoId: i.dataset.lig, folio: i.value.trim().toUpperCase() }); toast('Pago ligado'); await cargar(); vistaAjustes(); } catch (e) { toast(e.message); } }); } catch (e) {} };
  }
  function vistaCuenta() {
    shell(`<div class="box" style="max-width:520px"><h2>${esc(S.yo.nombre)}</h2><p class="note">Usuario <b>${esc(S.yo.usuario)}</b>${S.yo.sucursal ? ' · ' + esc(S.yo.sucursal) : ''}${S.yo.whatsapp ? ' · WhatsApp ' + S.yo.whatsapp : ''}</p><button class="btn sm" id="clave" style="margin-top:10px">Cambiar mi contraseña</button>
      <h2 style="margin-top:22px">Cómo trabajar</h2><ol style="font-size:13.5px;padding-left:18px;line-height:1.6;margin:0"><li>Abre el WhatsApp Business del negocio en tu compu o celular como <b>dispositivo vinculado</b> (en el teléfono del negocio: WhatsApp → Dispositivos vinculados → Vincular). Activa los avisos en <b>Hoy</b>.</li><li>En <b>Mis leads</b> ves los contactos que te tocaron. Escríbeles con el botón de WhatsApp y firma con tu nombre; si llega un chat nuevo, captúralo arriba.</li><li>Marca el estado de cada uno: contactado, sin respuesta, cotizado, compró o no compró, y deja una nota.</li><li>Si compra, pulsa <b>Registrar venta</b>: el sistema genera el folio y el ticket para mandárselo.</li><li><b>¿Vendiste en tienda?</b> En <b>Muebles</b> pulsa «Registrar venta» en el modelo. Si el modelo no está en la lista, elige «Modelo que no está en la lista» y escribe el modelo y el precio que cobraste.</li><li>Al guardar puedes <b>imprimir el ticket</b> o <b>mandarle el estado del pedido</b> al cliente por WhatsApp.</li><li>En <b>Mis ventas</b> registras los pagos que vayan haciendo y ves el saldo. Las ventas de Mercado Libre que te asigne el administrador también aparecen ahí.</li></ol></div>`, 'Mi cuenta');
    $('#clave').onclick = () => pedirClave(false);
  }

  // ───────── WhatsApp (bandeja tipo WhatsApp Web) ─────────
  async function waCargarChats() {
    try {
      const d = await api('/api/wa-chats');
      S.wa.chats = d.chats || [];
      S.wa.account = d.account || null;
      S.wa.waEnabled = !!d.waEnabled;
    } catch (e) { /* silencio: quizá VPS caído, igual se pinta la última foto */ }
  }
  async function waCargarMensajes(jid) {
    try {
      const d = await api('/api/wa-messages?jid=' + encodeURIComponent(jid));
      S.wa.mensajes = d.mensajes || [];
    } catch (e) { /* silencio */ }
  }
  async function waEnviar(jid, texto) {
    try {
      const r = await api('/api/wa-send', { jid, texto, nombre: ((S.wa.chats || []).find(c => c.jid === jid) || {}).nombre || '' });
      await Promise.all([waCargarMensajes(jid), waCargarChats()]);
      return r;
    } catch (e) { toast(e.message); throw e; }
  }
  // Manda un archivo: primero directo al servidor de WhatsApp con un boleto de un solo uso (sin límite de Vercel);
  // si el navegador no puede llegar ahí (CORS), lo pasa por /api/wa-archivo (máx. 4 MB).
  // Antes de subir directo se prueba CORS con un OPTIONS: si el servidor no lo permite, el navegador lo corta sin
  // mandar nada, y así nunca se manda el archivo dos veces (un POST sin CORS sí llegaría aunque no se pueda leer la respuesta).
  async function waEnviarArchivo(jid, file, pie) {
    let g = null;
    try { g = await api('/api/wa-archivo?accion=boleto', { jid }); await fetch(g.url, { method: 'OPTIONS' }); }
    catch (e) { g = null; }
    if (g) {
      const fd = new FormData(); if (pie) fd.append('caption', pie); fd.append('file', file, file.name);
      const r = await fetch(g.url, { method: 'POST', body: fd });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error('WhatsApp no aceptó el archivo: ' + (j.error || 'error ' + r.status)); }
      api('/api/wa-archivo?accion=registro', { jid, nombre: file.name }).catch(() => {});
      return;
    }
    if (file.size > 4 * 1048576) throw new Error('El archivo pesa más de 4 MB. Mándalo más ligero o desde el WhatsApp del negocio.');
    const qs = new URLSearchParams({ accion: 'enviar', jid, nombre: file.name, tipo: file.type || 'application/octet-stream', caption: pie || '' });
    const r = await fetch('/api/wa-archivo?' + qs, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo enviar el archivo');
  }
  async function waSync() {
    try { await api('/api/wa-sync', {}); await cargar(); } catch (e) { /* throttled o VPS caído */ }
  }
  const waAvatar = jid => `/api/wa-avatar?jid=${encodeURIComponent(jid)}`; // (opcional, no implementado: usamos iniciales)
  const waIniciales = s => { const p = (s || '?').trim().split(/\s+/).map(x => x[0]).filter(Boolean).slice(0, 2).join(''); return (p || '?').toUpperCase(); };
  const waHora = ts => { if (!ts) return ''; const d = new Date(ts * 1000); const hoy = new Date(); return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-MX', d.getFullYear() === hoy.getFullYear() ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: '2-digit' }); };
  const waSepDia = ts => { if (!ts) return ''; const d = new Date(ts * 1000); const hoy = new Date(); const ayer = new Date(); ayer.setDate(hoy.getDate() - 1); if (d.toDateString() === hoy.toDateString()) return 'HOY'; if (d.toDateString() === ayer.toDateString()) return 'AYER'; return d.toLocaleDateString('es-MX', d.getFullYear() === hoy.getFullYear() ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(); };

  function vistaWhatsApp() {
    const estado = S.wa.account && S.wa.account.estado;
    if (!S.wa.waEnabled) {
      shell(`<div class="box wa-nolink">
        <h3>Bandeja de WhatsApp no activada</h3>
        <p>Para ver aquí los chats de tu WhatsApp Business y responder sin cambiar de pantalla, el administrador debe configurar tres variables en Vercel:</p>
        <p><span class="copy">WA_API_URL</span> <span class="copy">WA_SERVICE_TOKEN</span> <span class="copy">WA_ACCOUNT_ID</span></p>
        <p>La cuenta de WhatsApp vive en el servidor de MAW (${esc(location.host)}). Una vez vinculado, aquí aparecen los chats como en WhatsApp Web.</p>
      </div>`, 'WhatsApp', 'Bandeja de WhatsApp Business del negocio.');
      return;
    }
    const q = (S.wa.busca || '').toLowerCase();
    // Por defecto solo lo reciente: el WhatsApp del negocio trae meses de historial. Al buscar se revisan todos.
    const corteWa = Date.now() / 1000 - 30 * 86400;
    const esViejo = c => !(c.hora && c.hora >= corteWa);
    const nViejos = S.wa.chats.filter(esViejo).length;
    const chats = S.wa.chats.filter(c => {
      if (!S.wa.verViejos && !q && esViejo(c) && c.jid !== S.wa.activo) return false;
      if (S.wa.fEstado && (!c.lead || c.lead.estado !== S.wa.fEstado)) return false;
      if (S.wa.fVend === '__sin' && c.lead && c.lead.vendedorId) return false;
      if (S.wa.fVend && S.wa.fVend !== '__sin' && (!c.lead || c.lead.vendedorId !== S.wa.fVend)) return false;
      if (S.wa.sinLeads && c.lead) return false;
      if (q && !((c.nombre || '').toLowerCase().includes(q) || (c.tel10 || '').includes(q) || (c.ultimo || '').toLowerCase().includes(q))) return false;
      return true;
    });

    const activeJid = S.wa.activo;
    const active = activeJid ? S.wa.chats.find(c => c.jid === activeJid) : null;

    const itemHtml = c => {
      const lead = c.lead;
      const tags = [];
      if (lead) tags.push(`<span class="tag lead">lead</span>`); else tags.push(`<span class="tag sin">sin lead</span>`);
      if (lead && lead.estado) tags.push(`<span class="tag">${esc(ESTADO_L[lead.estado] || lead.estado)}</span>`);
      if (lead && lead.vendedorId) tags.push(`<span class="tag vend">${esc(nombreU(lead.vendedorId).split(' ')[0])}</span>`);
      return `<div class="wa-item ${activeJid === c.jid ? 'on' : ''}" data-jid="${esc(c.jid)}">
        <div class="av">${waIniciales(c.nombre)}</div>
        <div class="mid">
          <div class="n"><b>${esc(c.nombre || c.tel10 || c.jid)}</b><time>${waHora(c.hora)}</time></div>
          <div class="u">${esc(c.ultimo || '')}</div>
          <div class="tags">${tags.join('')}</div>
        </div>
        <div class="right">${c.noLeidos ? `<span class="badge-n">${c.noLeidos}</span>` : ''}</div>
      </div>`;
    };

    let chatHtml;
    if (!active) {
      chatHtml = `<div class="wa-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.11 4.9A10 10 0 0 0 4.1 18.4L3 22l3.7-1A10 10 0 1 0 19.11 4.9zM12 20.3a8.3 8.3 0 0 1-4.24-1.17l-.3-.18-2.19.57.59-2.14-.2-.31A8.3 8.3 0 1 1 12 20.3zm4.56-6.22c-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.8.98-.14.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.25-1.49-1.4-1.74-.14-.25-.02-.38.11-.5.11-.11.25-.3.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.11 0 1.24.9 2.44 1.03 2.6.13.17 1.78 2.73 4.33 3.82.6.26 1.08.42 1.45.54.61.19 1.17.17 1.6.1.49-.07 1.48-.6 1.69-1.19.21-.59.21-1.09.15-1.19-.06-.1-.23-.17-.48-.3z"/></svg>
        <h3>Bandeja de WhatsApp</h3>
        <p>Elige una conversación de la izquierda para leer el chat y responder desde aquí. Los mensajes llegan de tu WhatsApp Business del negocio.</p>
      </div>`;
    } else {
      const lead = active.lead;
      let hilo = '';
      let ultimoDia = '';
      (S.wa.mensajes || []).forEach(m => {
        const dia = waSepDia(m.hora);
        if (dia && dia !== ultimoDia) { hilo += `<div class="wa-day">${dia}</div>`; ultimoDia = dia; }
        const quien = m.fromMe ? 'me' : '';
        const st = m.status ? ` data-st="${esc(m.status)}"` : '';
        const sender = (!m.fromMe && m.remitente) ? `<span class="sender">${esc(m.remitente)}</span>` : '';
        const TIPO_M = { image: '📷 Foto', video: '🎬 Video', audio: '🎤 Audio', voice: '🎤 Nota de voz', document: '📄 Documento', sticker: 'Sticker' };
        const txt = (m.tipo ? '<span class="tipo">' + esc(TIPO_M[m.tipo] || m.tipo) + '</span>' + (m.texto ? '<br>' : '') : '') + esc(m.texto || '');
        hilo += `<div class="wa-msg ${quien}"${st}>${sender}${txt}<span class="meta">${m.hora ? new Date(m.hora * 1000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>`;
      });
      if (!hilo) hilo = `<div class="wa-msgs-vacio">Sin mensajes en este chat</div>`;

      const asignarSel = veTodo() ? `<select class="input" id="waAsig" title="Asignar a vendedor"><option value="">— Sin vendedor —</option>${S.usuarios.filter(u => u.activo).map(u => `<option value="${u.id}" ${lead && lead.vendedorId === u.id ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select>` : '';
      const estadoSel = lead ? `<select class="input" id="waEst" title="Estado del lead">${Object.entries(ESTADO_L).map(([k, t]) => `<option value="${k}" ${lead.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select>` : '';
      const crearLeadBtn = !lead ? `<button class="btn sm" id="waCrearLead" title="Crear lead para este contacto">+ Crear lead</button>` : '';

      chatHtml = `<div class="wa-chat">
        <div class="wa-chat-head">
          <button class="btn-back" id="waBack" title="Volver">←</button>
          <div class="av">${waIniciales(active.nombre)}</div>
          <div class="info"><b>${esc(active.nombre || active.tel10 || active.jid)}</b><small>${esc(active.tel10 || '')}${lead ? ' · ' + esc((S.usuarios.find(u => u.id === lead.vendedorId) || {}).nombre || 'sin vendedor') : ' · sin lead'}</small></div>
          <div class="acciones">${estadoSel}${asignarSel}${crearLeadBtn}${lead ? `<a class="btn sm" href="#/leads" data-ver-lead="${lead.id}" title="Abrir ficha del lead">Ficha</a>` : ''}</div>
        </div>
        <div class="wa-msgs" id="waMsgs">${hilo}</div>
        <form class="wa-input" id="waForm"><input type="file" id="waFile" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*,video/*,audio/*"><button type="button" class="btn wa-clip" id="waClip" title="Adjuntar documento, foto o video" ${estado !== 'connected' ? 'disabled' : ''}>📎</button><textarea id="waTxt" rows="1" placeholder="Escribe un mensaje…" ${estado !== 'connected' ? 'disabled title="La cuenta de WhatsApp no está conectada"' : ''}></textarea><button class="btn wa" type="submit" ${estado !== 'connected' ? 'disabled' : ''}>Enviar</button></form>
      </div>`;
    }

    const subEstado = estado === 'connected' ? '<span class="estado on">conectado</span>' : `<span class="estado off">${esc(estado || 'desconectado')}</span>`;
    const labelCuenta = (S.wa.account && S.wa.account.label) || 'Cardian';

    shell(`<div class="wa-wrap ${active ? 'enchat' : ''}" id="waWrap">
      <aside class="wa-side">
        <div class="wa-head">
          <div><h2>${esc(labelCuenta)}</h2><span class="sub">${esc((S.wa.account && S.wa.account.telefono) || '')} · ${subEstado}</span></div>
          <button class="btn sm" id="waRefresh" title="Actualizar">↻</button>
        </div>
        <div class="wa-search"><input id="waBusca" placeholder="Buscar en chats…" value="${esc(S.wa.busca)}"></div>
        <div class="wa-filtros">
          <button data-fe="" class="${!S.wa.fEstado ? 'on' : ''}">Todos</button>
          ${Object.entries(ESTADO_L).map(([k, t]) => `<button data-fe="${k}" class="${S.wa.fEstado === k ? 'on' : ''}">${t}</button>`).join('')}
          ${veTodo() ? `<select class="input" id="waFv" style="height:28px;padding:0 8px;font-size:11.5px;border-radius:999px"><option value="">Todos los vendedores</option><option value="__sin" ${S.wa.fVend === '__sin' ? 'selected' : ''}>Sin vendedor</option>${S.usuarios.filter(u => u.rol === 'vendedor').map(u => `<option value="${u.id}" ${S.wa.fVend === u.id ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select>` : ''}
          <button data-sinleads class="${S.wa.sinLeads ? 'on' : ''}">Sin lead</button>
          ${nViejos ? `<button data-viejos class="${S.wa.verViejos ? 'on' : ''}" title="Chats sin mensajes en los últimos 30 días">${S.wa.verViejos ? 'Ocultar anteriores' : 'Ver anteriores (' + nViejos + ')'}</button>` : ''}
        </div>
        <div class="wa-list" id="waList">
          ${chats.length ? chats.map(itemHtml).join('') : `<div class="wa-empty-list">${S.wa.chats.length ? (!S.wa.verViejos && !q && nViejos ? 'No hay chats de los últimos 30 días con ese filtro. Usa «Ver anteriores» o busca por nombre.' : 'Ningún chat coincide con el filtro.') : (estado === 'connected' ? 'Aún no llegan chats. Pide al cliente que te escriba.' : 'Esperando a que la cuenta de WhatsApp quede conectada…')}</div>`}
        </div>
      </aside>
      ${chatHtml}
    </div>`, 'WhatsApp', `${S.wa.chats.length - nViejos} chat${S.wa.chats.length - nViejos === 1 ? '' : 's'} de los últimos 30 días${nViejos ? ' · ' + nViejos + (nViejos === 1 ? ' anterior' : ' anteriores') : ''} · ${veTodo() ? 'Vista de administrador: todos los chats' : 'Solo tus leads asignados'}`);

    // Enlaces
    $('#waBusca').oninput = e => { S.wa.busca = e.target.value; vistaWhatsApp(); const i = $('#waBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $$('[data-fe]').forEach(b => b.onclick = () => { S.wa.fEstado = b.dataset.fe; vistaWhatsApp(); });
    const fv = $('#waFv'); if (fv) fv.onchange = () => { S.wa.fVend = fv.value; vistaWhatsApp(); };
    const sl = $('[data-sinleads]'); if (sl) sl.onclick = () => { S.wa.sinLeads = !S.wa.sinLeads; vistaWhatsApp(); };
    const vj = $('[data-viejos]'); if (vj) vj.onclick = () => { S.wa.verViejos = !S.wa.verViejos; vistaWhatsApp(); };
    $$('[data-jid]').forEach(el => el.onclick = async () => {
      S.wa.activo = el.dataset.jid; S.wa.mensajes = [];
      vistaWhatsApp();
      await waCargarMensajes(S.wa.activo);
      vistaWhatsApp();
      // Polling del chat activo cada 6s
      clearInterval(waTimers.msgs);
      waTimers.msgs = setInterval(async () => {
        if (ruta() !== 'whatsapp' || !S.wa.activo) { clearInterval(waTimers.msgs); return; }
        const before = S.wa.mensajes.length;
        await waCargarMensajes(S.wa.activo);
        const esc2 = document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName);
        if (S.wa.mensajes.length !== before && !esc2) vistaWhatsApp();
      }, 6000);
    });
    const rf = $('#waRefresh'); if (rf) rf.onclick = async () => { await Promise.all([waCargarChats(), waSync()]); vistaWhatsApp(); };
    const bk = $('#waBack'); if (bk) bk.onclick = () => { S.wa.activo = null; clearInterval(waTimers.msgs); vistaWhatsApp(); };

    // Scroll al final de los mensajes
    const ml = $('#waMsgs'); if (ml) ml.scrollTop = ml.scrollHeight;

    // Enviar
    const form = $('#waForm');
    if (form) {
      const ta = $('#waTxt');
      ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
      ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
      form.onsubmit = async e => {
        e.preventDefault();
        const t = ta.value.trim(); if (!t || !S.wa.activo) return;
        ta.disabled = true;
        try { await waEnviar(S.wa.activo, t); ta.value = ''; ta.style.height = 'auto'; } catch (x) { /* toast ya salió */ }
        ta.disabled = false; ta.focus();
        vistaWhatsApp();
      };
      // Adjuntar: el texto escrito en la caja va como pie del archivo.
      const clip = $('#waClip'), fi = $('#waFile');
      if (clip && fi) {
        clip.onclick = () => fi.click();
        fi.onchange = async () => {
          const file = fi.files[0]; fi.value = ''; if (!file || !S.wa.activo) return;
          const pie = ta.value.trim();
          if (!confirm(`¿Mandar «${file.name}» (${(file.size / 1048576).toFixed(1)} MB)${pie ? ' con el texto escrito como pie' : ''}?`)) return;
          clip.disabled = true; toast('Enviando ' + file.name + '…');
          try { await waEnviarArchivo(S.wa.activo, file, pie); ta.value = ''; toast('Archivo enviado'); }
          catch (x) { toast(x.message); }
          clip.disabled = false;
          await Promise.all([waCargarMensajes(S.wa.activo), waCargarChats()]); vistaWhatsApp();
        };
      }
    }

    // Estado del lead y reasignar
    const we = $('#waEst'); if (we) we.onchange = async () => {
      try { await api('/api/datos?c=leads', { accion: 'estado', id: active.lead.id, estado: we.value }); toast('Estado: ' + ESTADO_L[we.value]); await cargar(); vistaWhatsApp(); } catch (x) { toast(x.message); }
    };
    const wa2 = $('#waAsig'); if (wa2) wa2.onchange = async () => {
      try {
        // chat sin lead todavía: al elegir vendedor se da de alta el cliente ya asignado
        if (active.lead) await api('/api/datos?c=leads', { accion: 'asignar', id: active.lead.id, vendedorId: wa2.value });
        else if (wa2.value) await api('/api/datos?c=leads', { accion: 'crear', tel: active.tel10 || '', waJid: active.jid, nombre: active.nombre, origen: 'whatsapp', mensaje: active.ultimo || '', vendedorId: wa2.value, repartir: false });
        toast(wa2.value ? 'Asignado a ' + nombreU(wa2.value) : 'Sin vendedor'); await cargar(); await waCargarChats(); vistaWhatsApp(); } catch (x) { toast(x.message); }
    };
    const cl = $('#waCrearLead'); if (cl) cl.onclick = async () => {
      try {
        const r = await api('/api/datos?c=leads', { accion: 'crear', tel: active.tel10 || '', waJid: active.jid, nombre: active.nombre, origen: 'whatsapp', mensaje: active.ultimo || '', mio: !veTodo() });
        toast('Lead creado' + (r.lead.vendedorId ? ' · ' + nombreU(r.lead.vendedorId) : ''));
        await cargar(); await waCargarChats(); vistaWhatsApp();
      } catch (x) {
        if (/ya está como lead/.test(x.message)) { toast('Ya existe un lead con ese número'); await cargar(); await waCargarChats(); vistaWhatsApp(); }
        else toast(x.message);
      }
    };
    $$('[data-ver-lead]').forEach(a => a.onclick = e => { e.preventDefault(); detalleLead(a.dataset.verLead); });

    // Polling de la bandeja cada 15s + sync cada 60s (el sync se auto-throttle en el servidor)
    clearInterval(waTimers.lista);
    waTimers.lista = setInterval(async () => {
      if (ruta() !== 'whatsapp') { waStop(); return; }
      await Promise.all([waCargarChats(), waSync()]);
      const escribiendo = document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName);
      if (!escribiendo) vistaWhatsApp();
    }, 15000);
  }

  // ───────── router ─────────
  function render() {
    if (!S.yo) return vistaLogin();
    const r = ruta();
    // Si se sale de WhatsApp, para los timers
    if (r !== 'whatsapp') waStop();
    // El admin de atención solo entra a Muebles, Leads, WhatsApp y Mi cuenta.
    if (sup() && !SOLO_SUP.includes(r)) { location.replace('#/muebles'); return; }
    const vistas = { hoy: vistaHoy, muebles: vistaMuebles, vendido: vistaVendido, ventas: vistaVentas, sinpago: vistaSinPago, leads: vistaLeads, whatsapp: vistaWhatsApp, vendedores: admin() ? vistaVendedores : vistaHoy, cupones: admin() ? vistaCupones : vistaHoy, bitacora: admin() ? vistaBitacora : vistaHoy, ajustes: admin() ? vistaAjustes : vistaCuenta, cuenta: vistaCuenta };
    // La primera vez que se entra a WhatsApp, cargar en segundo plano y re-pintar
    if (r === 'whatsapp' && !S.wa._cargado) { S.wa._cargado = true; waCargarChats().then(() => { if (ruta() === 'whatsapp') vistaWhatsApp(); }); waSync(); }
    (vistas[r] || vistaHoy)();
    const m = location.hash.match(/venta=([\w-]+)/); if (m) { detalleVenta(m[1]); history.replaceState(null, '', '#/' + r); }
    const mw = location.hash.match(/chat=([^&]+)/); if (mw) { S.wa.activo = decodeURIComponent(mw[1]); history.replaceState(null, '', '#/whatsapp'); if (ruta() === 'whatsapp') { waCargarMensajes(S.wa.activo).then(() => vistaWhatsApp()); } }
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
    let vueltas = 0;
    setInterval(async () => {
      if (++vueltas % 4 === 0 && await actualizarSiHayVersion(false)) return;
      if (!S.yo) return;
      try { await cargar(); } catch (e) { return; }
      revisar();
      const escribiendo = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!$('#modal') && !escribiendo) render();
    }, 30000);
  })();
})();

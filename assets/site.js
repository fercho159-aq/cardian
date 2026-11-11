/* Cardian Muebles · script común: encabezado, pie, carrito, tarjetas, envío, utilidades. */
(function () {
  const D = window.CARDIAN;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const fmt = n => '$' + Math.round(n).toLocaleString('es-MX');
  const fmt2 = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- catálogo ---------- */
  const byId = id => D.products.find(p => p.id === id);
  const catOf = id => D.categories.find(c => c.id === id);
  const stockLabel = p => p.stock === 'inmediata' ? 'Entrega inmediata' : p.stock === 'medida' ? 'A medida · cotización en 24 h' : 'Se fabrica en ' + p.dias + ' días hábiles';
  const stockClass = p => p.stock === 'inmediata' ? 'ok' : p.stock === 'medida' ? 'medida' : 'pedido';
  const unitPrice = (p, opts) => {
    let u = p.price || 0;
    if (opts && opts.tapiz && p.extras && p.extras[opts.tapiz]) u += p.extras[opts.tapiz];
    if (opts && opts.mech && p.mech) { const m = p.mech.find(x => x.name === opts.mech); if (m) u += m.extra; }
    return u;
  };

  function card(p, i) {
    const c = catOf(p.cat);
    const sw = (p.tapiz || []).slice(0, 4).map(t => `<i style="background:${D.TAPIZ[t].hex}" title="${D.TAPIZ[t].name}"></i>`).join('');
    const alt = p.imgs[1] ? `<img class="alt" src="/${p.imgs[1]}" alt="" loading="lazy">` : '';
    return `<a class="card reveal" style="--d:${(i % 4) * 80}ms" href="/producto?id=${p.id}">
      <div class="ph"><img class="bgblur" src="/${p.imgs[0]}" alt="" aria-hidden="true" loading="lazy"><img src="/${p.imgs[0]}" alt="${p.name}" loading="lazy">${alt}<span class="tag ${stockClass(p)}">${p.stock === 'inmediata' ? 'Entrega inmediata' : p.stock === 'medida' ? 'A medida' : 'Hecho para ti'}</span></div>
      <div class="c"><div class="cat">${c.name}</div><h3>${p.name}</h3><div class="type">${p.type}</div>${sw ? `<div class="sw">${sw}</div>` : ''}
      <div class="price num">${p.quote ? 'Cotiza a tu medida' : fmt(p.price) + '<small>MXN</small>'}</div>
      <div class="msi num">${p.quote ? 'Precio según tus medidas, sin compromiso' : 'Paga a meses con Mercado Pago'}</div></div></a>`;
  }

  /* ---------- envío ---------- */
  // zoneOf devuelve el grupo del estado con la tarifa y el tránsito propios de ese estado
  const zoneOf = st => { const g = D.zones.find(z => z.states.includes(st)); return g ? { ...g, state: st, cost: D.rates[st], days: D.transit[st] } : null; };
  function shipping(state, items) {
    // items: [{factor, qty}] · tarifa base del estado × factor; la pieza mayor paga completo, las demás 60 %
    const z = zoneOf(state); if (!z) return { cost: 0, zone: null };
    if (z.cost === 0) return { cost: 0, zone: z };
    const list = [];
    items.forEach(it => { for (let i = 0; i < it.qty; i++) list.push(it.factor); });
    list.sort((a, b) => b - a);
    const cost = list.reduce((s, f, i) => s + z.cost * f * (i === 0 ? 1 : 0.6), 0);
    return { cost: Math.round(cost), zone: z };
  }

  /* ---------- carrito ---------- */
  const CK = 'cardian_cart';
  // Limpia carritos guardados con productos o colores que ya no existen (versiones anteriores del catálogo).
  function limpiarCarrito(c) {
    const out = [];
    for (const l of Array.isArray(c) ? c : []) {
      const p = l && byId(l.id); if (!p) continue;
      const tapiz = p.tapiz && p.tapiz.includes(l.tapiz) && D.TAPIZ[l.tapiz] ? l.tapiz : (p.tapiz ? (p.defaultColor && p.tapiz.includes(p.defaultColor) ? p.defaultColor : p.tapiz[0]) : null);
      const mech = p.mech && p.mech.some(m => m.name === l.mech) ? l.mech : null;
      const key = p.id + '|' + (tapiz || '') + '|' + (mech || '');
      const qty = Math.max(1, Math.min(99, parseInt(l.qty, 10) || 1));
      const prev = out.find(x => x.key === key);
      if (prev) prev.qty = Math.min(99, prev.qty + qty); else out.push({ key, id: p.id, tapiz, mech, qty });
    }
    return out;
  }
  const getCart = () => {
    let raw; try { raw = JSON.parse(localStorage.getItem(CK) || '[]'); } catch (e) { raw = []; }
    const limpio = limpiarCarrito(raw);
    if (JSON.stringify(limpio) !== JSON.stringify(raw)) { try { localStorage.setItem(CK, JSON.stringify(limpio)); } catch (e) {} }
    return limpio;
  };
  const setCart = c => { try { localStorage.setItem(CK, JSON.stringify(c)); } catch (e) {} renderCartCount(); };
  const cartCount = () => getCart().reduce((s, l) => s + l.qty, 0);
  function addToCart(id, opts, qty) {
    const cart = getCart(); const key = id + '|' + (opts.tapiz || '') + '|' + (opts.mech || '');
    const line = cart.find(l => l.key === key);
    if (line) line.qty += qty; else cart.push({ key, id, tapiz: opts.tapiz || null, mech: opts.mech || null, qty });
    setCart(cart);
    const b = $('#cartCount'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  }
  function renderCartCount() { const b = $('#cartCount'); if (b) { const n = cartCount(); b.textContent = n; b.hidden = n === 0; } }
  const cartLines = () => getCart().map(l => { const p = byId(l.id); return p ? { ...l, p, unit: unitPrice(p, l) } : null; }).filter(Boolean);
  const subtotal = () => cartLines().reduce((s, l) => s + l.unit * l.qty, 0);

  /* ---------- pedido en curso (checkout) ---------- */
  const OK = 'cardian_order';
  const getOrder = () => { try { return JSON.parse(sessionStorage.getItem(OK) || '{}'); } catch (e) { return {}; } };
  const setOrder = o => { try { sessionStorage.setItem(OK, JSON.stringify(o)); } catch (e) {} };

  /* ---------- UI común ---------- */
  const WA_SVG = '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.3.7 4.5 1.9 6.4L4 29l7.9-2a12.3 12.3 0 0 0 4.1.7c6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-1.3 0-2.6-.3-3.8-.9l-.3-.2-4.6 1.2 1.2-4.4-.2-.3a9.7 9.7 0 0 1-1.6-5.3c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.9-9.8 9.9zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"/></svg>';
  const wa = text => `https://wa.me/${D.brand.wa}?text=${encodeURIComponent(text || 'Hola Cardian Muebles, quiero información')}`;

  function header() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    const here = path + location.search; const cur = (h) => (here === h || (h.indexOf('?') < 0 && h !== '/' && path.startsWith(h))) ? ' aria-current="page"' : '';
    const links = [['/catalogo?c=salas', 'Salas'], ['/catalogo?c=comedores', 'Comedores'], ['/envios', 'Envíos'], ['/proyectos', 'Proyectos']];
    const nav = links.map(([h, t]) => `<a href="${h}"${cur(h)}>${t}</a>`).join('');
    return `
    <div class="promo" aria-label="Promociones"><div class="wrap"><div class="track">
      <span>Envío gratis en CDMX y Estado de México</span><span>Paga a meses con tarjeta en Mercado Pago</span><span>Precio directo, sin intermediarios</span><span>Hecho en México · Garantía de 1 año</span>
      <span aria-hidden="true">Envío gratis en CDMX y Estado de México</span><span aria-hidden="true">Paga a meses con tarjeta en Mercado Pago</span><span aria-hidden="true">Precio directo, sin intermediarios</span><span aria-hidden="true">Hecho en México · Garantía de 1 año</span>
    </div></div></div>
    <header class="site"><div class="wrap">
      <a class="logo" href="/" aria-label="Cardian Muebles, inicio"><img src="/img/logo.png" alt="Cardian Muebles"></a>
      <nav class="main" aria-label="Categorías">${nav}</nav>
      <div class="hdr-actions">
        <a class="cart-btn" href="/carrito" aria-label="Carrito"><span>Carrito</span><b id="cartCount" hidden>0</b></a>
        <button class="burger" type="button" id="burger" aria-label="Menú" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      </div></div>
      <div class="mobile-nav" id="mobileNav"><div class="wrap">${nav}<a href="/como-comprar">Cómo comprar</a><a href="/contacto">Contacto</a></div></div>
    </header>`;
  }
  function footer() {
    return `<footer class="site"><div class="wrap">
      <div class="top">
        <div class="brand"><img src="/img/logo.png" alt="Cardian Muebles"><p>Salas y comedores con precio directo. Envío a todo México.</p></div>
        <div><h4>Catálogo</h4><ul><li><a href="/catalogo?c=salas">Salas</a></li><li><a href="/catalogo?c=comedores">Comedores</a></li><li><a href="/catalogo?stock=inmediata">Entrega inmediata</a></li></ul></div>
        <div><h4>Ayuda</h4><ul><li><a href="/como-comprar">Cómo comprar</a></li><li><a href="/envios">Envíos y entregas</a></li><li><a href="/pagos">Pagos y garantía</a></li><li><a href="/preguntas">Preguntas frecuentes</a></li><li><a href="/contacto">Contacto</a></li></ul></div>
        <div><h4>Empresa</h4><ul><li><a href="/nosotros">Nosotros y fábrica</a></li><li><a href="/proyectos">Hoteles y oficinas</a></li><li><a href="${D.brand.ig}" target="_blank" rel="noopener">Instagram</a></li><li><a href="${D.brand.fb}" target="_blank" rel="noopener">Facebook</a></li><li><a href="/privacidad">Aviso de privacidad</a></li><li><a href="/terminos">Términos de compra</a></li></ul></div>
      </div>
      <div class="bottom"><span>© 2026 Cardian Muebles · Hecho en México · ${D.brand.email} · WhatsApp ${D.brand.phone}</span><div class="pay-logos"><span>Mercado Pago</span><span>Tarjeta</span><span>OXXO</span><span>CFDI 4.0</span></div></div>
    </div></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <a class="wa-float" id="waFloat" href="${wa()}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp"><span class="tip">¿Dudas? Escríbenos</span>${WA_SVG}</a>`;
  }

  let toastTimer;
  function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400); }

  function reveal() {
    if (!('IntersectionObserver' in window) || reduceMotion) { $$('.reveal').forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }

  function mount() {
    const h = $('#site-header'); if (h) h.innerHTML = header();
    const f = $('#site-footer'); if (f) f.innerHTML = footer();
    renderCartCount();
    const hdr = $('header.site');
    if (hdr) addEventListener('scroll', () => hdr.classList.toggle('scrolled', scrollY > 40), { passive: true });
    const bg = $('#burger'), mn = $('#mobileNav');
    if (bg) bg.onclick = () => { const o = mn.classList.toggle('open'); bg.setAttribute('aria-expanded', String(o)); };
    reveal();
  }
  // ── Leads: antes de abrir WhatsApp se piden nombre y número; el contacto queda en el sistema
  //    y se asigna al azar a un vendedor, cuyo WhatsApp es el que se abre.
  let leadAbierto = false;
  function leadModal(producto, texto) {
    if (leadAbierto) return; leadAbierto = true;
    const prev = (() => { try { return JSON.parse(localStorage.getItem('cardian_lead') || '{}'); } catch (e) { return {}; } })();
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'leadModal';
    const lbl = 'display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    m.innerHTML = `<form class="box" style="width:min(440px,100%)"><header><h2 style="font-size:18px">Te atendemos por WhatsApp</h2><button type="button" data-x aria-label="Cerrar">×</button></header>
      <div class="bd"><p class="muted" style="font-size:14px;margin:0 0 14px">Dinos cómo te llamas y tu WhatsApp; te contesta un asesor con el precio directo${producto ? ' de ' + producto : ''}.</p>
        <div style="margin-bottom:10px"><label for="ldN" style="${lbl}">Nombre</label><input class="input" id="ldN" autocomplete="name" value="${(prev.nombre || '').replace(/"/g, '&quot;')}" required></div>
        <div style="margin-bottom:14px"><label for="ldT" style="${lbl}">WhatsApp (10 dígitos)</label><input class="input" id="ldT" inputmode="tel" autocomplete="tel" value="${prev.tel || ''}" required></div>
        <input type="text" name="web" id="ldW" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
        <button class="btn primary" type="submit" style="width:100%;background:var(--wa);border-color:var(--wa);color:#fff">Abrir WhatsApp</button>
        <p class="muted" style="font-size:12px;margin:12px 0 0;text-align:center">Solo usamos tus datos para atender tu solicitud.</p></div></form>`;
    document.body.appendChild(m);
    const cerrar = () => { m.remove(); leadAbierto = false; };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) cerrar(); });
    setTimeout(() => $('#ldN', m).focus(), 50);
    $('form', m).onsubmit = async e => {
      e.preventDefault();
      const nombre = $('#ldN', m).value.trim(); let tel = $('#ldT', m).value.replace(/\D/g, '');
      if (tel.length === 12 && tel.startsWith('52')) tel = tel.slice(2); if (tel.length === 13 && tel.startsWith('521')) tel = tel.slice(3);
      if (nombre.length < 2) return toast('Escribe tu nombre');
      if (tel.length !== 10) return toast('El WhatsApp debe tener 10 dígitos');
      try { localStorage.setItem('cardian_lead', JSON.stringify({ nombre, tel })); } catch (x) {}
      const btn = $('button[type=submit]', m); btn.disabled = true; btn.textContent = 'Un momento…';
      let num = D.brand.wa;
      try { const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, tel, producto, mensaje: texto, web: $('#ldW', m) ? $('#ldW', m).value : '' }) }); const j = await r.json(); if (r.ok && j.wa) num = j.wa; } catch (x) {}
      cerrar();
      window.open('https://wa.me/' + num + '?text=' + encodeURIComponent('Hola, soy ' + nombre + '. ' + (texto || 'Quiero información.')), '_blank', 'noopener');
    };
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="wa.me/"]'); if (!a || a.dataset.directo !== undefined) return;
    e.preventDefault();
    const texto = decodeURIComponent((a.href.split('text=')[1] || '').replace(/\+/g, ' ')).replace(/^Hola,?\s*(Cardian Muebles,?\s*)?/i, '').trim();
    const h1 = $('h1'); const producto = a.dataset.producto || (location.pathname.startsWith('/producto') && h1 ? h1.textContent.trim() : '');
    leadModal(producto, texto);
  });
  document.addEventListener('DOMContentLoaded', mount);

  window.Cardian = { $, $$, fmt, fmt2, byId, catOf, stockLabel, stockClass, unitPrice, card, zoneOf, shipping, getCart, setCart, cartCount, addToCart, cartLines, subtotal, getOrder, setOrder, toast, reveal, wa, WA_SVG, reduceMotion };
})();

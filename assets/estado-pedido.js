/* Estado del pedido de Cardian Muebles: etapas, mensaje de WhatsApp e imagen para compartir.
   Lo usan el sistema (vendedores) y la página pública del pedido (/ticket). */
(function () {
  const ETAPAS = [
    { id: 'recibido', t: 'Pedido recibido', d: 'Ya está registrado en nuestro sistema.' },
    { id: 'fabricando', t: 'En fabricación', d: 'Estamos fabricando tus piezas.' },
    { id: 'listo', t: 'Listo para entrega', d: 'Terminado y revisado.' },
    { id: 'en-camino', t: 'En camino', d: 'Va rumbo a tu domicilio.' },
    { id: 'entregado', t: 'Entregado', d: 'Armado y revisado contigo.' },
  ];
  const BODEGA = { listo: { t: 'Listo para recoger', d: 'Ya puedes pasar por él.' }, 'en-camino': { t: 'Preparado en bodega', d: 'Te esperamos en el punto acordado.' } };
  const WA_NEGOCIO = '33 4766 2784';

  const etapasDe = v => ETAPAS.map(e => (v.envio && v.envio.tipo !== 'domicilio' && BODEGA[e.id]) ? { ...e, ...BODEGA[e.id] } : e);
  const indice = v => Math.max(0, ETAPAS.findIndex(e => e.id === (v.etapa || 'recibido')));
  const cuandoEtapa = (v, id) => { const x = (v.etapas || []).filter(e => e.etapa === id).pop(); return x ? x.cuando : (id === 'recibido' ? v.creado : ''); };
  const fechaLarga = s => { if (!s) return ''; const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s); return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const fechaCorta = s => s ? new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
  const enlace = (v, k) => location.origin + '/ticket?f=' + v.folio + '&k=' + k;

  // Texto listo para mandar por WhatsApp al cliente.
  function mensaje(v, k) {
    const nombre = ((v.cliente && v.cliente.nombre) || '').split(' ')[0];
    const et = etapasDe(v)[indice(v)];
    const frases = {
      recibido: `recibimos tu pedido *${v.folio}*. Ya está registrado y te avisaremos de cada avance.`,
      fabricando: `tu pedido *${v.folio}* ya se está fabricando.`,
      listo: v.envio && v.envio.tipo !== 'domicilio' ? `tu pedido *${v.folio}* está listo para recoger.` : `tu pedido *${v.folio}* está listo y lo estamos preparando para la entrega.`,
      'en-camino': v.envio && v.envio.tipo !== 'domicilio' ? `tu pedido *${v.folio}* está preparado en bodega.` : `tu pedido *${v.folio}* va en camino a tu domicilio.`,
      entregado: `tu pedido *${v.folio}* fue entregado. ¡Gracias por tu compra!`,
    };
    let txt = `Hola ${nombre}, te saluda Cardian Muebles: ${frases[et.id]}`;
    if (v.fechaEntrega && et.id !== 'entregado') txt += `\nFecha estimada de entrega: ${fechaLarga(v.fechaEntrega)}.`;
    if (v.notaCliente) txt += `\n${v.notaCliente}`;
    if (v.saldo > 0 && et.id !== 'entregado') txt += `\nSaldo pendiente: $${Math.round(v.saldo).toLocaleString('es-MX')}.`;
    if (k) txt += `\nConsulta el estado de tu pedido aquí: ${enlace(v, k)}`;
    return txt;
  }

  const cargarImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  function envolver(ctx, texto, x, y, ancho, alto) {
    const palabras = String(texto).split(' '); let linea = '', yy = y;
    for (const p of palabras) { const prueba = linea ? linea + ' ' + p : p; if (ctx.measureText(prueba).width > ancho && linea) { ctx.fillText(linea, x, yy); linea = p; yy += alto; } else linea = prueba; }
    if (linea) ctx.fillText(linea, x, yy); return yy + alto;
  }

  // Dibuja la tarjeta del estado (1080 × 1350, formato vertical para WhatsApp). Devuelve el canvas.
  async function dibujar(v) {
    try { await Promise.all(['400 30px Poppins', '500 30px Poppins', '600 30px Poppins', '300 30px Poppins'].map(f => document.fonts.load(f))); } catch (e) {}
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); const F = (peso, tam) => `${peso} ${tam}px Poppins, "Segoe UI", sans-serif`;
    const ORO = '#d2ad58', ORO2 = '#b08a35', CREMA = '#f3eadb', GRIS = '#a79d8a', TINTA = '#0d0c0a';
    const g = x.createRadialGradient(W * 0.2, 0, 50, W * 0.2, 0, H); g.addColorStop(0, '#26211a'); g.addColorStop(0.6, TINTA); g.addColorStop(1, TINTA);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(210,173,88,.45)'; x.lineWidth = 2; x.strokeRect(36, 36, W - 72, H - 72);

    const logo = await cargarImg('/img/logo.png');
    if (logo) { const lw = 220, lh = lw * logo.height / logo.width; x.drawImage(logo, (W - lw) / 2, 84, lw, lh); }
    x.textAlign = 'center'; x.fillStyle = GRIS; x.font = F(500, 24); x.letterSpacing = '6px';
    x.fillText('ESTADO DE TU PEDIDO', W / 2, 330); x.letterSpacing = '0px';
    x.fillStyle = CREMA; x.font = F(600, 64); x.fillText(v.folio, W / 2, 410);
    const nombre = ((v.cliente && v.cliente.nombre) || '').trim();
    if (nombre) { x.fillStyle = GRIS; x.font = F(400, 28); x.fillText(nombre, W / 2, 456); }

    // etapa actual destacada
    const ets = etapasDe(v), i = indice(v), act = ets[i];
    x.fillStyle = 'rgba(210,173,88,.12)'; const bx = 120, bw = W - 240; x.beginPath(); x.roundRect(bx, 500, bw, 130, 24); x.fill();
    x.strokeStyle = 'rgba(210,173,88,.6)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = ORO; x.font = F(600, 50); x.fillText(act.t, W / 2, 568);
    x.fillStyle = CREMA; x.font = F(400, 26); x.fillText(v.fechaEntrega && act.id !== 'entregado' ? 'Entrega estimada: ' + fechaLarga(v.fechaEntrega) : act.d, W / 2, 610);

    // línea de tiempo
    x.textAlign = 'left'; const tx = 200, ty0 = 700, paso = 92;
    ets.forEach((e, n) => {
      const y = ty0 + n * paso, hecho = n <= i;
      if (n < ets.length - 1) { x.strokeStyle = n < i ? ORO2 : 'rgba(167,157,138,.35)'; x.lineWidth = 4; x.beginPath(); x.moveTo(tx, y + 20); x.lineTo(tx, y + paso - 20); x.stroke(); }
      x.beginPath(); x.arc(tx, y, 18, 0, Math.PI * 2);
      if (hecho) { x.fillStyle = n === i ? ORO : ORO2; x.fill(); x.strokeStyle = TINTA; x.lineWidth = 4; x.beginPath(); x.moveTo(tx - 8, y); x.lineTo(tx - 2, y + 7); x.lineTo(tx + 9, y - 7); x.stroke(); }
      else { x.strokeStyle = 'rgba(167,157,138,.6)'; x.lineWidth = 3; x.stroke(); }
      x.fillStyle = hecho ? CREMA : GRIS; x.font = F(n === i ? 600 : 500, 32); x.fillText(e.t, tx + 46, y + 4);
      const cu = hecho ? cuandoEtapa(v, e.id) : ''; if (cu) { x.fillStyle = GRIS; x.font = F(400, 22); x.textAlign = 'right'; x.fillText(fechaCorta(cu), W - 150, y + 4); x.textAlign = 'left'; }
    });

    // artículos
    let y = ty0 + ets.length * paso + 10;
    x.strokeStyle = 'rgba(210,173,88,.3)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(120, y); x.lineTo(W - 120, y); x.stroke();
    y += 44; x.fillStyle = GRIS; x.font = F(400, 24);
    const arts = (v.lineas || []).map(l => `${l.qty} × ${l.nombre}${l.colorNombre ? ' · ' + l.colorNombre : ''}`);
    arts.slice(0, 2).forEach(a => { y = envolver(x, a, 120, y, W - 240, 32); });
    if (arts.length > 2) { x.fillText(`y ${arts.length - 2} artículo${arts.length - 2 > 1 ? 's' : ''} más`, 120, y); }

    x.textAlign = 'center'; x.fillStyle = GRIS; x.font = F(400, 22);
    x.fillText(`cardianmuebles.com  ·  WhatsApp ${WA_NEGOCIO}`, W / 2, H - 70);
    return c;
  }

  const aBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
  async function descargar(v) {
    const c = await dibujar(v); const b = await aBlob(c); const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `Pedido ${v.folio} - Cardian Muebles.png`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  // En celular abre el menú de compartir (WhatsApp incluido) con la imagen y el texto. Devuelve false si no se puede.
  async function compartir(v, k) {
    const c = await dibujar(v); const b = await aBlob(c);
    const file = new File([b], `Pedido ${v.folio}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: mensaje(v, k), title: 'Pedido ' + v.folio }); return true; } catch (e) { return e && e.name === 'AbortError'; }
    }
    return false;
  }

  window.EstadoPedido = { ETAPAS, etapasDe, indice, cuandoEtapa, fechaLarga, fechaCorta, mensaje, dibujar, descargar, compartir, enlace };
})();

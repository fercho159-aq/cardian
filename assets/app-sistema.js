/* App del sistema: registra el service worker, guarda el aviso de instalación del navegador
   y muestra un panel «Descargar app» con los pasos según el equipo (iPhone, Android, Windows, Mac).
   Uso: CardianApp.abrir() · CardianApp.instalada() · se abre solo con /sistema?instalar=1 */
(function () {
  let aviso = null;
  const listos = [];
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); aviso = e; listos.forEach(f => f()); });
  addEventListener('appinstalled', () => { aviso = null; cerrar(); avisar('App instalada. Ya la encuentras en tu pantalla de inicio.'); });
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw-sistema.js', { scope: '/sistema' }).catch(() => {}));

  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function equipo() {
    const ua = navigator.userAgent, ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    if (/iPhone|iPod/.test(ua)) return 'iphone';
    if (/iPad/.test(ua) || ipad) return 'ipad';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Macintosh/.test(ua)) return 'mac';
    return 'otro';
  }
  const nav = () => { const ua = navigator.userAgent; return /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : ''; };
  const NOMBRE = { iphone: 'iPhone', ipad: 'iPad', android: 'Android', windows: 'Windows', mac: 'Mac', otro: 'tu equipo' };
  const COMPARTIR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/></svg>';

  function pasos(eq, n) {
    if (eq === 'iphone' || eq === 'ipad') {
      if (n !== 'Safari') return ['Abre esta página en <b>Safari</b> (en otros navegadores del ' + NOMBRE[eq] + ' no se puede instalar).', 'Escribe <b>cardianmuebles.com/sistema</b> y entra.', 'Toca <b>Compartir</b> ' + COMPARTIR + ' y luego <b>Agregar a inicio</b>.'];
      return ['Toca el botón <b>Compartir</b> ' + COMPARTIR + ' (abajo en el iPhone, arriba en el iPad).', 'Baja y elige <b>Agregar a inicio</b>.', 'Toca <b>Agregar</b>. El ícono de Cardian queda en tu pantalla.'];
    }
    if (eq === 'android') return ['Toca el menú <b>⋮</b> de Chrome, arriba a la derecha.', 'Elige <b>Instalar app</b> (o <b>Agregar a la pantalla principal</b>).', 'Confirma con <b>Instalar</b>. El ícono de Cardian queda con tus apps.'];
    if (eq === 'mac' && n === 'Safari') return ['En la barra de arriba abre <b>Archivo</b>.', 'Elige <b>Agregar al Dock</b>.', 'Listo: la app queda en el Dock y en Launchpad.'];
    if (n === 'Firefox') return ['Firefox no instala apps web. Abre <b>cardianmuebles.com/sistema</b> en <b>Chrome</b> o <b>Edge</b>.', 'Ahí aparece el botón <b>Instalar app</b> en este mismo panel.'];
    return ['En la barra de direcciones, a la derecha, haz clic en el ícono de <b>instalar</b> (una pantallita con flecha).', 'O abre el menú <b>⋮</b> → <b>Transmitir, guardar y compartir</b> → <b>Instalar página como app</b>.', 'La app abre en su propia ventana y queda en el menú Inicio y en el escritorio.'];
  }

  function cerrar() { const m = document.getElementById('app-instalar'); if (m) m.remove(); }
  function avisar(t) { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3200); }

  function abrir() {
    cerrar();
    const eq = equipo(), n = nav(), m = document.createElement('div');
    m.id = 'app-instalar';
    m.innerHTML = `<div class="ai-fondo"></div><div class="ai-caja" role="dialog" aria-modal="true" aria-labelledby="ai-t">
      <button class="ai-x" type="button" aria-label="Cerrar">×</button>
      <img src="/img/app/icono-192.png" alt="" class="ai-ico">
      <h2 id="ai-t">Descarga la app del sistema</h2>
      <p class="ai-sub">Ventas, pedidos y leads de Cardian en tu ${NOMBRE[eq]}, con su propio ícono y en pantalla completa.</p>
      <div class="ai-cuerpo"></div>
      <div class="ai-otros"><span>Otros equipos:</span>${['iphone', 'android', 'windows', 'mac'].map(k => `<button type="button" data-eq="${k}" class="${k === eq ? 'on' : ''}">${NOMBRE[k]}</button>`).join('')}</div>
      <p class="ai-nota">Se entra con el mismo usuario y contraseña del sistema. No ocupa espacio como una app normal y se actualiza sola.</p>
    </div>`;
    document.body.appendChild(m);
    const cuerpo = m.querySelector('.ai-cuerpo');
    const pintar = (k, nv) => {
      m.querySelectorAll('.ai-otros button').forEach(b => b.classList.toggle('on', b.dataset.eq === k));
      if (instalada()) { cuerpo.innerHTML = '<div class="ai-ok">✓ Ya estás usando la app instalada.</div>'; return; }
      const boton = aviso && k === eq ? '<button type="button" class="btn primary ai-btn">Instalar app</button><p class="ai-o">o hazlo a mano:</p>' : '';
      cuerpo.innerHTML = boton + '<ol>' + pasos(k, nv).map(p => `<li>${p}</li>`).join('') + '</ol>';
      const b = cuerpo.querySelector('.ai-btn');
      if (b) b.onclick = async () => { const a = aviso; if (!a) return; a.prompt(); const r = await a.userChoice.catch(() => ({})); if (r.outcome === 'accepted') { aviso = null; cerrar(); } };
    };
    pintar(eq, n);
    listos.push(() => { if (document.body.contains(m)) pintar(eq, n); });
    m.querySelectorAll('.ai-otros button').forEach(b => b.onclick = () => pintar(b.dataset.eq, b.dataset.eq === 'mac' ? 'Chrome' : b.dataset.eq === eq ? n : (b.dataset.eq === 'iphone' ? 'Safari' : 'Chrome')));
    m.querySelector('.ai-x').onclick = cerrar;
    m.querySelector('.ai-fondo').onclick = cerrar;
  }

  window.CardianApp = { abrir, instalada };
  if (/[?&]instalar=1/.test(location.search)) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (!instalada()) addEventListener('load', () => setTimeout(abrir, 300));
  }
})();

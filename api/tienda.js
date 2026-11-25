// Tienda pública: productos y fotos que el administrador maneja desde el sistema.
// GET  /catalogo-extra.js          (rewrite → /api/tienda?js=1)   script que aplica altas y cambios sobre assets/data.js
// GET  /img/tienda/<id>.jpg        (rewrite → /api/tienda?img=id) foto subida desde el sistema
// POST /api/tienda  { data: 'data:image/jpeg;base64,…' }          sube una foto (solo administrador) → { ruta }
// El alta y la edición de productos viven en /api/datos?c=tienda (solo administrador).
const A = require('./_lib/auth');
const store = require('./_lib/store');
const T = require('./_lib/tienda');
const { cuerpo, query, ok, error, id, seguro } = require('./_lib/http');

const MAX_IMG = 700 * 1024; // el navegador ya la manda comprimida (≈1600 px, JPEG)

module.exports = seguro(async (req, res) => {
  const q = query(req);

  if (req.method === 'GET' && q.js) {
    let regs = [];
    try { regs = (await store.get('tienda', [])).map(r => ({ id: r.id, oculto: !!r.oculto, datos: r.datos || {} })); } catch (e) { regs = []; }
    const js = `/* Productos y precios que el administrador maneja desde el sistema */
(function(){try{var C=window.CARDIAN;if(!C)return;var fusionar=${T.fusionar.toString()};
C.productsBase=C.productsBase||C.products.slice();
C.aplicarTienda=function(regs){C.tienda=regs||[];C.products=fusionar(C.productsBase,C.tienda);};
C.aplicarTienda(${JSON.stringify(regs).replace(/</g, '\\u003c')});}catch(e){}})();`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    // La CDN lo guarda unos segundos: la tienda carga rápido y un cambio de precio se ve en menos de un minuto.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');
    return res.end(js);
  }

  if (req.method === 'GET' && q.img) {
    const clave = String(q.img).replace(/[^\w-]/g, '').slice(0, 40);
    const b64 = clave ? await store.get('timg:' + clave, null) : null;
    if (!b64) return error(res, 404, 'No existe esa foto');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // cada foto nueva tiene id nuevo
    return res.end(Buffer.from(b64, 'base64'));
  }

  if (req.method === 'POST') {
    const u = await A.exigir(req, res, 'admin'); if (!u) return;
    const b = await cuerpo(req);
    const m = String(b.data || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return error(res, 400, 'La foto debe ser una imagen JPG');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 2000 || buf[0] !== 0xff || buf[1] !== 0xd8) return error(res, 400, 'La foto no es válida');
    if (buf.length > MAX_IMG) return error(res, 413, 'La foto pesa demasiado; súbela más ligera');
    const clave = id(12).replace(/[^\w-]/g, 'x');
    await store.set('timg:' + clave, m[1]);
    return ok(res, { ruta: 'img/tienda/' + clave + '.jpg' });
  }
  return error(res, 405, 'Método no permitido');
});

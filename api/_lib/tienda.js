// Productos de la tienda que maneja el administrador desde el sistema (colección «tienda»):
//  - productos nuevos (no existen en assets/data.js), y
//  - cambios a los del catálogo base (precio, nombre, textos, fotos, colores, ocultar).
// Cada registro: { id, base, oculto, datos:{…campos del producto…}, creado, creadoPor, editado, editadoPor }.
// fusionar() es una función pura SIN dependencias: el servidor la usa para cobrar con el precio vigente y
// /catalogo-extra.js la manda tal cual al navegador (fusionar.toString()) para que la tienda muestre lo mismo.
function fusionar(base, regs) {
  var out = base.map(function (p) { return Object.assign({}, p); });
  (regs || []).forEach(function (r) {
    var i = out.findIndex(function (p) { return p.id === r.id; });
    if (r.oculto) { if (i >= 0) out.splice(i, 1); return; }
    if (i >= 0) Object.assign(out[i], r.datos || {});
    else if (r.datos && r.datos.name && r.datos.price > 0 && r.datos.imgs && r.datos.imgs.length) out.push(Object.assign({ id: r.id }, r.datos));
  });
  // Precio de oferta: mientras esté vigente, «price» es el de oferta y «oldPrice» el normal (sale tachado).
  var hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // fecha de México
  out.forEach(function (p) {
    var o = p.oferta;
    if (o && o.price > 0 && o.price < p.price && (!o.hasta || hoy <= o.hasta)) { p.oldPrice = p.price; p.price = o.price; p.enOferta = true; }
  });
  return out;
}

// Texto que termina dentro del HTML de la tienda: sin etiquetas ni comillas que rompan atributos.
const limpio = (s, n) => String(s == null ? '' : s).replace(/[<>`]/g, '').replace(/"/g, '”').replace(/\s+/g, ' ').trim().slice(0, n);
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const m2 = cm => (cm / 100).toFixed(2);

// Valida y normaliza lo que manda el formulario del admin. D = catálogo (categorías y colores válidos).
function normalizar(b, D) {
  const d = {};
  d.name = limpio(b.name, 70); if (d.name.length < 3) throw new Error('Escribe el nombre del producto');
  d.cat = D.categories.some(c => c.id === b.cat) ? b.cat : null; if (!d.cat) throw new Error('Elige la categoría');
  d.price = Math.round(+b.price || 0); if (!(d.price > 0) || d.price > 5000000) throw new Error('Escribe el precio (sin IVA)');
  d.type = limpio(b.type, 70) || D.categories.find(c => c.id === d.cat).name;
  d.short = limpio(b.short, 180) || d.type;
  d.desc = limpio(b.desc, 900) || d.short;
  d.stock = b.stock === 'inmediata' ? 'inmediata' : 'pedido';
  d.dias = Math.max(1, Math.min(120, Math.round(+b.dias || 15)));
  d.imgs = (Array.isArray(b.imgs) ? b.imgs : []).map(String).filter(s => /^img\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(s) && !s.includes('..')).slice(0, 6);
  if (!d.imgs.length) throw new Error('Sube al menos una foto del producto');
  const tap = (Array.isArray(b.tapiz) ? b.tapiz : []).filter(t => D.TAPIZ[t]);
  if (tap.length) { d.tapiz = tap; d.defaultColor = tap.includes(b.defaultColor) ? b.defaultColor : tap[0]; d.optLabel = d.cat === 'salas' ? 'Color de tapiz' : 'Color'; d.varImgs = false; }
  const L = Math.round(+((b.dims || {}).largo) || 0), F = Math.round(+((b.dims || {}).fondo) || 0), A = Math.round(+((b.dims || {}).alto) || 0);
  if (L > 0 && F > 0) d.dims = { largo: Math.min(L, 900), fondo: Math.min(F, 900), alto: Math.min(A || 0, 400) };
  const of = b.oferta || {}; const op = Math.round(+of.price || 0);
  if (op > 0) {
    if (op >= d.price) throw new Error('El precio de oferta debe ser menor al precio normal');
    d.oferta = { price: op, hasta: /^\d{4}-\d{2}-\d{2}$/.test(String(of.hasta || '')) ? String(of.hasta) : '' };
  }
  d.factor = [0.5, 0.6, 0.8, 0.9, 1, 1.2].includes(+b.factor) ? +b.factor : 1;
  d.bultos = Math.max(1, Math.min(12, Math.round(+b.bultos || 1)));
  d.specs = [];
  if (d.dims) d.specs.push(['Medidas', m2(d.dims.largo) + ' × ' + m2(d.dims.fondo) + ' m' + (d.dims.alto ? ' · alto ' + d.dims.alto + ' cm' : '')]);
  if (d.tapiz) d.specs.push(['Colores', d.tapiz.length + ' a elegir']);
  d.specs.push(['Entrega', d.stock === 'inmediata' ? 'Inmediata' : 'Sobre pedido, ' + d.dias + ' días hábiles']);
  return d;
}

// Para un producto del catálogo base se guarda solo lo que cambió respecto al original.
function diferencias(d, original) {
  const out = {};
  const campos = ['name', 'cat', 'price', 'type', 'short', 'desc', 'stock', 'dias', 'imgs', 'tapiz', 'defaultColor', 'oferta'];
  campos.forEach(k => { if (d[k] !== undefined && JSON.stringify(d[k]) !== JSON.stringify(original[k])) out[k] = d[k]; });
  return out;
}

module.exports = { fusionar, normalizar, diferencias, limpio, slug };

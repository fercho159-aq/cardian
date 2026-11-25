// Cupones de descuento de la tienda (colección «cupones»). Los crea el administrador desde el sistema y el
// cliente los escribe en el checkout. El descuento SIEMPRE se calcula aquí, en el servidor, con los precios
// vigentes: el navegador solo muestra lo que esta función devuelve.
// Cupón: { codigo, tipo: 'porcentaje'|'monto', valor, alcance: 'todo'|'cat:<id>'|'prod:<id>', minimo, usosMax,
//          vence: 'AAAA-MM-DD', activo, nota, usos (pedidos pagados), pedidos (pedidos creados), creado, creadoPor }
const store = require('./store');

const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 24);
// Fecha de hoy en México (UTC−6), para vigencias: un cupón que vence el 30 sirve todo el día 30.
const hoyMx = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
const pesos = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
// Código al azar sin letras que se confunden (O/0, I/1).
function generar(prefijo) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = require('crypto').randomBytes(6);
  return norm(prefijo || 'CARDIAN') + '-' + [...b].map(x => abc[x % abc.length]).join('');
}

// Estado del cupón para mostrarlo y para validar.
function estado(c) {
  if (!c) return 'inexistente';
  if (c.activo === false) return 'pausado';
  if (c.vence && hoyMx() > c.vence) return 'vencido';
  if (c.usosMax && (c.usos || 0) >= c.usosMax) return 'agotado';
  return 'activo';
}

// lineas: las de M.calcular() ({ id, nombre, qty, unit }). productos: catálogo vigente (para saber la categoría).
// Devuelve { ok, descuento, base } o { ok: false, motivo } con un texto listo para el cliente.
function evaluar(c, lineas, productos) {
  const e = estado(c);
  if (e === 'inexistente' || e === 'pausado') return { ok: false, motivo: 'Ese cupón no existe o ya no está activo.' };
  if (e === 'vencido') return { ok: false, motivo: 'Ese cupón ya venció.' };
  if (e === 'agotado') return { ok: false, motivo: 'Ese cupón ya se usó el máximo de veces.' };
  const alc = String(c.alcance || 'todo');
  const aplica = l => {
    if (!l.id) return false; // artículos escritos a mano no entran
    if (alc === 'todo') return true;
    if (alc.startsWith('prod:')) return l.id === alc.slice(5);
    if (alc.startsWith('cat:')) { const p = productos.find(x => x.id === l.id); return !!p && p.cat === alc.slice(4); }
    return false;
  };
  const base = lineas.filter(aplica).reduce((s, l) => s + l.unit * l.qty, 0);
  if (!base) return { ok: false, motivo: 'Ese cupón no aplica a los productos de tu carrito.' };
  if (c.minimo && base < c.minimo) return { ok: false, motivo: 'Ese cupón pide una compra mínima de ' + pesos(c.minimo) + '.' };
  const descuento = Math.max(0, Math.min(base, c.tipo === 'monto' ? Math.round(c.valor) : Math.round(base * c.valor / 100)));
  if (!descuento) return { ok: false, motivo: 'Ese cupón no tiene descuento que aplicar.' };
  return { ok: true, descuento, base };
}
const etiqueta = c => (c.tipo === 'monto' ? pesos(c.valor) : c.valor + ' %') + ' de descuento';

// Valida lo que manda el formulario del admin.
function normalizar(b, D) {
  const c = {};
  c.tipo = b.tipo === 'monto' ? 'monto' : 'porcentaje';
  c.valor = Math.round(+b.valor || 0);
  if (c.tipo === 'porcentaje' && !(c.valor >= 1 && c.valor <= 90)) throw new Error('El porcentaje debe estar entre 1 y 90');
  if (c.tipo === 'monto' && !(c.valor >= 1 && c.valor <= 500000)) throw new Error('Escribe el monto del descuento');
  const alc = String(b.alcance || 'todo');
  if (alc === 'todo') c.alcance = 'todo';
  else if (alc.startsWith('cat:') && D.categories.some(x => x.id === alc.slice(4))) c.alcance = alc;
  else if (alc.startsWith('prod:') && D.products.some(x => x.id === alc.slice(5))) c.alcance = alc;
  else throw new Error('Elige a qué productos aplica');
  c.minimo = Math.max(0, Math.round(+b.minimo || 0));
  c.usosMax = Math.max(0, Math.min(100000, Math.round(+b.usosMax || 0)));
  c.vence = /^\d{4}-\d{2}-\d{2}$/.test(String(b.vence || '')) ? String(b.vence) : '';
  c.activo = b.activo !== false;
  c.nota = String(b.nota || '').replace(/[<>]/g, '').slice(0, 120);
  return c;
}

// El uso se cuenta cuando el pedido recibe su primer pago (no al crearlo: muchos pedidos nunca se pagan).
async function sumarUso(codigo) {
  await store.actualizar('cupones', l => { const c = l.find(x => x.codigo === codigo); if (c) c.usos = (c.usos || 0) + 1; }).catch(() => {});
}
async function contarPago(folio) {
  let codigo = null;
  await store.actualizar('ventas', l => { const v = l.find(x => x.folio === folio); if (v && v.cupon && !v.cupon.contado) { v.cupon.contado = true; codigo = v.cupon.codigo; } });
  if (codigo) await sumarUso(codigo);
}

module.exports = { norm, hoyMx, generar, estado, evaluar, etiqueta, normalizar, sumarUso, contarPago, pesos };

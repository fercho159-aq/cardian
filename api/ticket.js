// Público: datos de un ticket por folio + llave (la llave va en el enlace que se le manda al cliente).
const store = require('./_lib/store');
const M = require('./_lib/modelo');
const A = require('./_lib/auth');
const { query, ok, error } = require('./_lib/http');

module.exports = async (req, res) => {
  const q = query(req);
  if (!q.f) return error(res, 400, 'Falta el folio');
  const u = q.k ? null : await A.usuarioActual(req);
  if (!u && M.llaveTicket(q.f) !== q.k) return error(res, 403, 'Enlace de ticket inválido');
  const v = (await store.get('ventas', [])).find(x => x.folio === q.f);
  if (!v) return error(res, 404, 'No existe ese pedido');
  if (u && u.rol !== 'admin' && v.vendedorId !== u.id) return error(res, 403, 'Esta venta es de otro vendedor');
  const usuarios = await A.usuarios(); const vend = usuarios.find(x => x.id === v.vendedorId);
  const ajustes = await store.get('ajustes', {});
  const { historial, ...resto } = v;
  return ok(res, { venta: { ...resto, pagado: M.pagado(v), saldo: M.saldo(v) }, vendedor: vend ? { nombre: vend.nombre, whatsapp: vend.whatsapp } : null, ajustes: { negocio: ajustes.negocio || 'Cardian Muebles', leyendaTicket: ajustes.leyendaTicket || '', waNegocio: ajustes.waNegocio || '' }, k: M.llaveTicket(v.folio) });
};

// Aviso de Mercado Pago cuando cambia un pago. Se valida la firma, se consulta el pago
// directamente en MP (nunca se confía en el cuerpo del aviso) y se aplica a la venta.
const MP = require('./_lib/mp');
const { cuerpo, query, ok, error } = require('./_lib/http');

module.exports = async (req, res) => {
  if (req.method === 'GET') return ok(res, { ok: true, configurado: MP.configurado() });
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  if (!MP.configurado()) return ok(res, { ignorado: 'sin token' });
  const q = query(req); const b = await cuerpo(req);
  const tipo = q.type || q.topic || b.type || b.topic || '';
  const idPago = (b.data && b.data.id) || q['data.id'] || q.id || '';
  if (!/payment/.test(tipo) || !idPago) return ok(res, { ignorado: tipo || 'sin tipo' });
  if (!MP.firmaValida(req, idPago)) return error(res, 401, 'Firma inválida');
  try {
    const p = await MP.pago(idPago);
    const v = await MP.aplicarPago(p);
    return ok(res, { ok: true, estado: p.status, folio: v ? v.folio : null });
  } catch (e) { return error(res, 500, e.message); }
};

// Archivos adjuntos de las respuestas rápidas de WhatsApp (PDF, fotos, documentos de hasta 4 MB).
// Se guardan en la base por partes (cada valor de Redis debe ser chico) y solo los ve quien inició sesión.
// POST { accion:'iniciar', nombre, tipo, tam }      → { id }
// POST { accion:'parte', id, n, data(base64) }       → { ok }
// POST { accion:'cerrar', id, partes }               → { adjunto: { nombre, tipo, tam, url } }
// GET  /api/adjuntos?id=…                            → el archivo
const A = require('./_lib/auth');
const store = require('./_lib/store');
const { cuerpo, query, ok, error, id, ahora, seguro } = require('./_lib/http');

const MAX = 4 * 1024 * 1024;       // tope de WhatsApp por el camino de respaldo
const PARTE = 600 * 1024;          // bytes por parte (en base64 ≈ 800 KB)
const TIPOS = /^(application\/pdf|image\/(jpeg|png|webp)|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.-]+|vnd\.ms-excel)|text\/plain)$/;
const limpio = s => String(s || 'archivo').replace(/[\\/:*?"<>|\r\n]/g, '').slice(0, 100) || 'archivo';

module.exports = seguro(async (req, res) => {
  const u = await A.exigir(req, res); if (!u) return;
  if (req.method === 'GET') {
    const q = query(req); const clave = String(q.id || '').replace(/[^\w-]/g, '').slice(0, 30);
    const meta = clave ? await store.get('adjmeta:' + clave, null) : null;
    if (!meta) return error(res, 404, 'No existe ese archivo');
    const partes = [];
    for (let n = 0; n < meta.partes; n++) { const b64 = await store.get('adj:' + clave + ':' + n, null); if (!b64) return error(res, 410, 'El archivo está incompleto'); partes.push(Buffer.from(b64, 'base64')); }
    res.statusCode = 200;
    res.setHeader('Content-Type', meta.tipo);
    res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(meta.nombre) + '"');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.end(Buffer.concat(partes));
  }
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req);
  if (b.accion === 'iniciar') {
    const tam = Math.round(+b.tam || 0), tipo = String(b.tipo || '');
    if (!(tam > 0)) return error(res, 400, 'El archivo está vacío');
    if (tam > MAX) return error(res, 413, 'El archivo pesa más de 4 MB. Súbelo más ligero.');
    if (!TIPOS.test(tipo)) return error(res, 415, 'Solo se pueden adjuntar PDF, fotos (JPG, PNG) o documentos de Word, Excel y texto.');
    const clave = id(14).replace(/[^\w-]/g, 'x');
    await store.set('adjsubida:' + clave, { nombre: limpio(b.nombre), tipo, tam, dueno: u.id, creado: ahora() });
    return ok(res, { id: clave, parte: PARTE });
  }
  const clave = String(b.id || '').replace(/[^\w-]/g, '').slice(0, 30);
  const sub = clave ? await store.get('adjsubida:' + clave, null) : null;
  if (!sub || sub.dueno !== u.id) return error(res, 404, 'La subida no existe o ya venció');
  if (b.accion === 'parte') {
    const n = Math.round(+b.n); const data = String(b.data || '');
    if (!(n >= 0 && n < Math.ceil(sub.tam / PARTE) + 1) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length > Math.ceil(PARTE / 3) * 4 + 8) return error(res, 400, 'Parte inválida');
    await store.set('adj:' + clave + ':' + n, data);
    return ok(res, { ok: true });
  }
  if (b.accion === 'cerrar') {
    const partes = Math.round(+b.partes || 0);
    if (partes !== Math.ceil(sub.tam / PARTE)) return error(res, 400, 'Faltan partes del archivo');
    let total = 0;
    for (let n = 0; n < partes; n++) { const b64 = await store.get('adj:' + clave + ':' + n, null); if (!b64) return error(res, 400, 'Falta una parte del archivo'); total += Buffer.from(b64, 'base64').length; }
    if (total !== sub.tam) return error(res, 400, 'El archivo llegó incompleto. Intenta de nuevo.');
    await store.set('adjmeta:' + clave, { ...sub, partes });
    await store.del('adjsubida:' + clave);
    return ok(res, { adjunto: { nombre: sub.nombre, tipo: sub.tipo, tam: sub.tam, url: '/api/adjuntos?id=' + clave } });
  }
  return error(res, 400, 'Acción desconocida');
});

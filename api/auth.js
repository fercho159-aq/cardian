// Sesión del sistema: entrar, salir, quién soy y cambiar mi contraseña.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const { cuerpo, ok, error, ahora } = require('./_lib/http');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const u = await A.usuarioActual(req);
    return ok(res, { usuario: A.publico(u) });
  }
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req);

  if (b.accion === 'entrar') {
    const lista = await A.usuarios();
    const u = lista.find(x => x.usuario.toLowerCase() === String(b.usuario || '').trim().toLowerCase());
    if (!u || !A.verificar(b.clave, u.clave)) return error(res, 401, 'Usuario o contraseña incorrectos');
    if (!u.activo) return error(res, 403, 'Esta cuenta está desactivada');
    await store.actualizar('usuarios', l => { const x = l.find(y => y.id === u.id); if (x) x.ultimoAcceso = ahora(); });
    return ok(res, { usuario: A.publico(u) }, { 'Set-Cookie': A.cookieSesion(A.tokenDe(u.id)) });
  }
  if (b.accion === 'salir') return ok(res, { ok: true }, { 'Set-Cookie': A.cookieSesion('', true) });

  if (b.accion === 'clave') {
    const u = await A.exigir(req, res); if (!u) return;
    if (!u.cambiarClave && !A.verificar(b.actual, u.clave)) return error(res, 400, 'La contraseña actual no coincide');
    if (String(b.nueva || '').length < 8) return error(res, 400, 'La contraseña nueva debe tener al menos 8 caracteres');
    await store.actualizar('usuarios', l => { const x = l.find(y => y.id === u.id); if (x) { x.clave = A.hashear(b.nueva); x.cambiarClave = false; } });
    return ok(res, { ok: true });
  }
  return error(res, 400, 'Acción desconocida');
};

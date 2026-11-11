// Sesión del sistema: entrar, salir, quién soy y cambiar mi contraseña.
const A = require('./_lib/auth');
const store = require('./_lib/store');
const { cuerpo, ok, error, ahora, seguro, ip } = require('./_lib/http');

// Bitácora de accesos (últimos 200), visible para el admin en Ajustes.
const anotar = (usuario, dir, okk, motivo) => store.actualizar('accesos', l => [{ cuando: ahora(), usuario, ip: dir, ok: okk, motivo: motivo || '' }, ...l].slice(0, 200)).catch(() => {});

module.exports = seguro(async (req, res) => {
  if (req.method === 'GET') {
    const u = await A.usuarioActual(req);
    return ok(res, { usuario: A.publico(u) });
  }
  if (req.method !== 'POST') return error(res, 405, 'Método no permitido');
  const b = await cuerpo(req);

  if (b.accion === 'entrar') {
    // Límite de intentos: 5 fallos por usuario+IP o 20 por IP en 15 minutos bloquean el acceso un rato.
    const usr = String(b.usuario || '').trim().toLowerCase().slice(0, 40), dir = ip(req);
    const kUsr = 'login:' + usr + ':' + dir, kIp = 'loginip:' + dir;
    if ((await store.verConteo(kUsr)) >= 5 || (await store.verConteo(kIp)) >= 20) { await anotar(usr, dir, false, 'bloqueado'); return error(res, 429, 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.'); }
    const lista = await A.usuarios();
    const u = lista.find(x => x.usuario.toLowerCase() === usr);
    if (!u || !A.verificar(b.clave, u.clave)) { await store.contar(kUsr, 900); await store.contar(kIp, 900); await anotar(usr, dir, false, 'contraseña incorrecta'); return error(res, 401, 'Usuario o contraseña incorrectos'); }
    if (!u.activo) { await anotar(usr, dir, false, 'cuenta desactivada'); return error(res, 403, 'Esta cuenta está desactivada'); }
    await store.borrarConteo(kUsr); await anotar(usr, dir, true);
    await store.actualizar('usuarios', l => { const x = l.find(y => y.id === u.id); if (x) x.ultimoAcceso = ahora(); });
    return ok(res, { usuario: A.publico(u) }, { 'Set-Cookie': A.cookieSesion(A.tokenDe(u.id)) });
  }
  if (b.accion === 'salir') return ok(res, { ok: true }, { 'Set-Cookie': A.cookieSesion('', true) });

  if (b.accion === 'clave') {
    const u = await A.exigir(req, res); if (!u) return;
    if (!u.cambiarClave && !A.verificar(b.actual, u.clave)) return error(res, 400, 'La contraseña actual no coincide');
    if (String(b.nueva || '').length < 10) return error(res, 400, 'La contraseña nueva debe tener al menos 10 caracteres');
    await store.actualizar('usuarios', l => { const x = l.find(y => y.id === u.id); if (x) { x.clave = A.hashear(b.nueva); x.cambiarClave = false; } });
    return ok(res, { ok: true });
  }
  return error(res, 400, 'Acción desconocida');
});

// Bitácora general del sistema: quién hizo qué y cuándo (mensajes de WhatsApp, clientes, ventas, pagos,
// usuarios, productos y accesos). Solo la lee el administrador (GET /api/datos?c=bitacora).
// Se guarda como lista de Redis (LPUSH + LTRIM): anotar cuesta lo mismo aunque haya miles de registros.
// Nunca debe tumbar la acción que se está registrando: cualquier fallo se ignora.
const store = require('./store');

const CLAVE = 'bitacoraGeneral';
const MAX = 5000;

// quien: el usuario ({ nombre, rol }) o un texto («Sitio web», «Mercado Pago»). tipo: WhatsApp | Cliente | Venta |
// Usuario | Producto | Acceso | Ajustes. que: frase completa en español. ref: folio, jid o id (para buscar).
async function anotar(quien, tipo, que, ref) {
  try {
    const nombre = quien && typeof quien === 'object' ? (quien.nombre || quien.usuario || '—') : String(quien || 'Sistema');
    const rol = quien && typeof quien === 'object' ? (quien.rol || '') : '';
    await store.listaPush(CLAVE, { cuando: new Date().toISOString(), quien: String(nombre).slice(0, 80), rol, tipo: String(tipo).slice(0, 20), que: String(que || '').slice(0, 500), ref: ref ? String(ref).slice(0, 90) : '' }, MAX);
  } catch (e) { /* la bitácora nunca rompe la operación */ }
}
const leer = n => store.listaLeer(CLAVE, Math.max(1, Math.min(MAX, n || 500)));

module.exports = { anotar, leer };

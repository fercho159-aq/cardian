// Respuestas rápidas de WhatsApp (colección «respuestas»). Las de «equipo» las ve todo el mundo y solo las
// cambia el administrador o el admin de atención; las «personales» solo las ve y cambia quien las creó.
// En el texto, {nombre} se cambia por el primer nombre del cliente y {vendedor} por el de quien escribe.
const WA = '33 4766 2784';
const CAT_SALAS = { nombre: 'Catálogo Salas - Cardian Muebles.pdf', tipo: 'application/pdf', url: '/pdf/catalogo-salas-cardian-muebles.pdf' };
const CAT_COMEDORES = { nombre: 'Catálogo Comedores - Cardian Muebles.pdf', tipo: 'application/pdf', url: '/pdf/catalogo-comedores-cardian-muebles.pdf' };

// Las que vienen listas la primera vez. Siguen las reglas del dueño: precios sin IVA, «a meses según tu tarjeta»,
// garantía de 6 meses, sin dirección de la fábrica (se recoge en bodega, coordinado por WhatsApp).
const INICIALES = [
  { atajo: 'hola', titulo: 'Saludo', texto: '¡Hola {nombre}! 👋 Soy {vendedor} de Cardian Muebles. Con gusto te ayudo. ¿Qué mueble estás buscando: sala, sofá cama o comedor? Te paso precios, colores y medidas.' },
  { atajo: 'salas', titulo: 'Catálogo de salas', texto: 'Te comparto nuestro catálogo de salas 🛋️ Son precios directo, sin intermediarios (*precios sin IVA*). Cada modelo viene en varios colores de tapiz. ¿Cuál te gustó? Te paso el precio final con envío.', adjunto: CAT_SALAS },
  { atajo: 'comedores', titulo: 'Catálogo de comedores', texto: 'Te comparto nuestro catálogo de comedores 🍽️ Tenemos para 4, 6 y 8 personas, a precio directo (*precios sin IVA*). ¿Para cuántas personas lo buscas?', adjunto: CAT_COMEDORES },
  { atajo: 'comprar', titulo: 'Cómo comprar', texto: 'Comprar es muy fácil 😊\n\n1️⃣ Entra a cardianmuebles.com y elige tu mueble y el color.\n2️⃣ Presiona «Comprar ahora» y llena tu nombre, WhatsApp y si quieres envío a domicilio o recoger en bodega.\n3️⃣ Presiona «Pagar con Mercado Pago» y paga con tarjeta, en OXXO o con tu saldo.\n\nSi prefieres, también te tomo el pedido por aquí y te mando tu ticket con el folio. ¿Te ayudo?' },
  { atajo: 'oxxo', titulo: 'Pagar en OXXO', texto: 'Sí puedes pagar en OXXO 🏪\n\n1️⃣ En cardianmuebles.com elige tu mueble y presiona «Comprar ahora».\n2️⃣ Llena tus datos y presiona «Pagar con Mercado Pago».\n3️⃣ En Mercado Pago elige «Efectivo» y luego «OXXO».\n4️⃣ Te da una referencia: guárdala (toma captura).\n5️⃣ En el OXXO di que vas a pagar Mercado Pago, da la referencia y paga en efectivo.\n\nLa referencia vence en unos días y OXXO tiene un límite por pago; si tu pedido es mayor, te ayudo con otra forma de pago. En cuanto se refleje, te confirmo por aquí. 🙌' },
  { atajo: 'pago', titulo: 'Formas de pago', texto: 'Puedes pagar con:\n💳 Tarjeta de crédito o débito (paga a meses según tu tarjeta)\n🏪 Efectivo en OXXO\n📲 Saldo de Mercado Pago o transferencia\n\nTodo es con pago seguro de Mercado Pago. Si quieres, puedes dejar un anticipo y liquidar antes de la entrega. *Precios sin IVA.' },
  { atajo: 'envio', titulo: 'Envío y entrega', texto: '🚚 El envío es gratis en CDMX y Estado de México, y te lo entregamos armado. A otros estados te cotizo el envío.\n\nSi prefieres, también puedes recogerlo en bodega sin costo; te confirmo por aquí el punto, la fecha y la hora. ¿A qué código postal sería?' },
  { atajo: 'tiempo', titulo: 'Tiempo de entrega', texto: 'Los muebles se fabrican sobre pedido: las salas tardan aprox. 15 días hábiles y los comedores aprox. 20 días hábiles, más el día de entrega. Te aviso cómo va tu pedido en cada paso. 😊' },
  { atajo: 'garantia', titulo: 'Garantía', texto: '✅ Todos nuestros muebles tienen garantía de 6 meses en estructura y mecanismos. Conserva tu ticket para cualquier aclaración.' },
  { atajo: 'factura', titulo: 'Factura e IVA', texto: 'Nuestros precios son *sin IVA*. Si necesitas factura, se agrega el 16 % de IVA y te la emitimos con tus datos fiscales (RFC y razón social). ¿La necesitas?' },
  { atajo: 'seguimiento', titulo: 'Seguimiento (no contestó)', texto: '¡Hola {nombre}! 😊 Te escribo para saber si pudiste ver la información. ¿Te paso el precio con envío o tienes alguna duda? Aquí estoy para ayudarte.' },
];

function iniciales() {
  const t = new Date().toISOString();
  return INICIALES.map((r, i) => ({ id: 'r-' + (i + 1), alcance: 'equipo', dueno: null, creadoPor: 'Sistema', creado: t, adjunto: null, ...r }));
}
const veEquipo = u => u.rol === 'admin' || u.rol === 'supervisor';
const visible = (r, u) => r.alcance === 'equipo' || r.dueno === u.id;
const puedeCambiar = (r, u) => r.alcance === 'equipo' ? veEquipo(u) : (r.dueno === u.id || u.rol === 'admin');

// Valida el formulario. El adjunto solo puede ser un PDF del sitio o un archivo subido al sistema.
function normalizar(b) {
  const titulo = String(b.titulo || '').replace(/[<>]/g, '').trim().slice(0, 60);
  if (titulo.length < 2) throw new Error('Escribe un título para la respuesta');
  const texto = String(b.texto || '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
  const atajo = String(b.atajo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '').slice(0, 20);
  let adjunto = null;
  if (b.adjunto && b.adjunto.url) {
    const url = String(b.adjunto.url);
    if (!/^\/pdf\/[\w.-]+\.pdf$/.test(url) && !/^\/api\/adjuntos\?id=[\w-]{4,30}$/.test(url)) throw new Error('Adjunto inválido');
    adjunto = { nombre: String(b.adjunto.nombre || 'archivo').replace(/[<>"]/g, '').slice(0, 100), tipo: String(b.adjunto.tipo || 'application/octet-stream').slice(0, 100), url, tam: Math.round(+b.adjunto.tam || 0) || undefined };
  }
  if (!texto && !adjunto) throw new Error('Escribe el mensaje o agrega un archivo');
  return { titulo, texto, atajo, adjunto };
}

module.exports = { iniciales, visible, puedeCambiar, veEquipo, normalizar, CAT_SALAS, CAT_COMEDORES, WA };

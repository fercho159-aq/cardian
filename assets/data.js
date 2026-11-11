/* Cardian Muebles · catálogo.
   Salas y comedores: productos, precios, medidas y colores reales del documento del cliente (noviembre de 2026).
   Cocinas y recámaras: fotos reales de trabajos de la fábrica; se cotizan a medida, sin precio publicado. */
window.CARDIAN = (function () {
  const brand = {
    name: 'Cardian Muebles',
    phone: '+52 1 33 4766 2784',
    wa: '523347662784',
    email: 'atencion@cardianmuebles.com',
    site: 'cardianmuebles.com',
    ig: 'https://instagram.com/muebles.cardian',
    fb: 'https://facebook.com/CardianMuebles'
  };

  const categories = [
    { id: 'salas',     name: 'Salas',     plural: 'salas',     img: 'img/sala-africa.jpg',      desc: 'Modulares, escuadras y juegos 3-2-1 con reposet. Seis colores de tapiz.' },
    { id: 'comedores', name: 'Comedores', plural: 'comedores', img: 'img/comedor-delta-8.jpg',  desc: 'Para 4, 6 y 8 personas en madera de pino, encino y vidrio templado.' }
  ];

  // Colores de tapiz y acabados de madera. El hex es la muestra que se ve en la página.
  const TAPIZ = {
    negro:      { name: 'Negro',            hex: '#1c1c1e' },
    grisOxford: { name: 'Gris oxford',      hex: '#4e545c' },
    grisPlata:  { name: 'Gris plata',       hex: '#a9aeb4' },
    cocoa:      { name: 'Cocoa',            hex: '#7d5c45' },
    chocolate:  { name: 'Chocolate',        hex: '#4a3226' },
    beige:      { name: 'Beige',            hex: '#cdb795' },
    azulMarino: { name: 'Azul marino',      hex: '#223355' },
    nogal:      { name: 'Nogal americano',  hex: '#6b4526' },
    magnolia:   { name: 'Magnolia',         hex: '#ece6d9' },
    grisMadera: { name: 'Gris',             hex: '#8a8d90' }
  };

  const TAPIZ_SALAS = ['negro', 'grisOxford', 'grisPlata', 'cocoa', 'chocolate', 'beige'];

  // factor: multiplica la tarifa base de envío. bultos: piezas en que viaja.
  // price: precio de lista del juego completo. quote: true = se cotiza, sin precio publicado.
  const products = [
    // ===== SALAS =====
    { id: 'sala-modular-africa', defaultColor: 'grisPlata', cat: 'salas', name: 'Sala modular África', type: 'Modular con reposet y consola central', price: 25000, stock: 'pedido', dias: 15,
      imgs: ['img/sala-africa.jpg'], featured: true,
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 360, fondo: 260, alto: 100 }, bultos: 4, factor: 1.2,
      short: 'Modular en escuadra con un reposet y consola central con portavasos.',
      desc: 'Nuestra sala más vendida. Modular en escuadra con un reposet y consola central con portavasos y compartimento. Tapizada en tela de alto tránsito sobre estructura de madera y espuma de alta densidad.',
      specs: [['Medidas', '2.60 × 3.60 m'], ['Reposet', '1 incluido'], ['Consola central', 'Con portavasos'], ['Colores', '6 a elegir']] },

    { id: 'sala-africa', defaultColor: 'cocoa', cat: 'salas', name: 'Sala África', type: 'Juego 3-2-1 con reposet', price: 25000, stock: 'pedido', dias: 15,
      imgs: ['img/sala-africa-321.jpg'], featured: true,
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 235, fondo: 95, alto: 100 }, bultos: 3, factor: 1.0,
      short: 'Sofá, loveseat y sillón, los tres con reposet.',
      desc: 'Juego de tres piezas con reposet en cada una: sofá, loveseat y sillón. La misma comodidad de la Sala modular África en formato de juego, ideal para salas rectangulares.',
      specs: [['Sofá', '2.35 m'], ['Loveseat', '1.80 m'], ['Sillón', '95 cm'], ['Reposet', 'En las tres piezas'], ['Colores', '6 a elegir']] },

    { id: 'sala-tokio', defaultColor: 'chocolate', cat: 'salas', name: 'Sala Tokio', type: 'Juego 3-2-1 con reposet', price: 25000, stock: 'pedido', dias: 15,
      imgs: ['img/sala-tokio.jpg'], featured: true,
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 235, fondo: 95, alto: 102 }, bultos: 3, factor: 1.0,
      short: 'Sofá, loveseat y sillón con reposet, líneas amplias y respaldo alto.',
      desc: 'Juego de tres piezas con reposet en cada una. Respaldos altos y brazos acolchados; se ve bien tanto en tela como en acabado tipo piel.',
      specs: [['Sofá', '2.35 m'], ['Loveseat', '1.80 m'], ['Sillón', '95 cm'], ['Reposet', 'En las tres piezas'], ['Colores', '6 a elegir']] },

    { id: 'sala-delta', defaultColor: 'cocoa', cat: 'salas', name: 'Sala Delta', type: 'Juego 3-2-1', price: 19500, stock: 'pedido', dias: 15,
      imgs: ['img/sala-delta.jpg'],
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 235, fondo: 95, alto: 95 }, bultos: 3, factor: 1.0,
      short: 'Sofá, loveseat y sillón de asiento amplio, sin mecanismo.',
      desc: 'Juego de tres piezas de asiento amplio y cojines sueltos de respaldo. Sin mecanismo reclinable, lo que la hace más ligera y más fácil de acomodar.',
      specs: [['Sofá', '2.35 m'], ['Loveseat', '1.80 m'], ['Sillón', '1.10 m'], ['Colores', '6 a elegir']] },

    { id: 'sala-paris', defaultColor: 'grisOxford', cat: 'salas', name: 'Sala París', type: 'Juego 3-2-1', price: 17000, stock: 'pedido', dias: 15,
      imgs: ['img/sala-paris.jpg'], featured: true,
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 205, fondo: 90, alto: 92 }, bultos: 3, factor: 0.9,
      short: 'Juego de tres piezas con respaldo capitonado. Para salas compactas.',
      desc: 'Juego de tres piezas con respaldo capitonado y brazos rectos. Es la opción más compacta de la línea y la que mejor entra en departamentos.',
      specs: [['Sofá', '2.05 m'], ['Loveseat', '1.55 m'], ['Sillón', '1.05 m'], ['Colores', '6 a elegir']] },

    { id: 'sala-africa-junior', defaultColor: 'grisOxford', cat: 'salas', name: 'Sala África Junior', type: 'Escuadra con diván y reclinable', price: 16000, stock: 'pedido', dias: 15,
      imgs: ['img/sala-africa-junior.jpg'], featured: true,
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 240, fondo: 160, alto: 100 }, bultos: 2, factor: 0.8,
      short: 'Escuadra con diván y reclinable. Con o sin portavasos.',
      desc: 'La versión compacta de la Sala África: escuadra con diván y reclinable. Puede llevar consola con portavasos, que agrega 30 cm al largo.',
      specs: [['Sin portavasos', '2.10 × 1.60 m'], ['Con portavasos', '2.40 × 1.60 m'], ['Reclinable', 'Incluido'], ['Colores', '6 a elegir']] },

    { id: 'sala-xcaret', defaultColor: 'grisOxford', cat: 'salas', name: 'Sala Xcaret', type: 'Escuadra con diván', price: 14500, stock: 'pedido', dias: 15,
      imgs: ['img/sala-xcaret.jpg'],
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 230, fondo: 180, alto: 85 }, bultos: 2, factor: 0.9,
      short: 'Escuadra con diván y cojines con cierre, desenfundables.',
      desc: 'Escuadra con diván y cojines con cierre, que se pueden desenfundar para lavar. Es nuestra sala más accesible en formato escuadra.',
      specs: [['Medidas', '2.30 × 1.80 m'], ['Cojines', 'Con cierre, desenfundables'], ['Colores', '6 a elegir']] },

    { id: 'sala-sorento', defaultColor: 'beige', cat: 'salas', name: 'Sala Sorento', type: 'Modular por piezas', price: 30500, stock: 'pedido', dias: 20,
      imgs: ['img/sala-sorento.jpg'], featured: true,
      tapiz: TAPIZ_SALAS, optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 320, fondo: 240, alto: 80 }, bultos: 5, factor: 1.2,
      short: 'Modular que armas como quieras: cada módulo mide 80 cm.',
      desc: 'Sala modular por piezas: cada módulo individual mide 80 cm y los módulos con brazo miden 1 metro. Se acomoda en línea, en escuadra o en U, y puedes agregar módulos después.',
      specs: [['Módulo individual', '80 cm'], ['Módulo con brazo', '1 m'], ['Configuración', 'En línea, escuadra o U'], ['Colores', '6 a elegir']] },

    { id: 'sofa-cama', defaultColor: 'azulMarino', cat: 'salas', name: 'Sofá cama', type: 'Sofá cama de 3 posiciones', price: 8500, stock: 'pedido', dias: 10,
      imgs: ['img/sofa-cama.jpg'],
      tapiz: ['negro', 'grisOxford', 'grisPlata', 'cocoa', 'chocolate', 'azulMarino', 'beige'], optLabel: 'Color de tapiz', varImgs: false,
      dims: { largo: 185, fondo: 100, alto: 80 }, bultos: 1, factor: 0.5,
      short: 'Tres posiciones: sentado, descanso y cama. En siete colores.',
      desc: 'Sofá cama de tres posiciones: sentado, descanso y cama. Ocupa poco y resuelve la visita; es la pieza que más se lleva para departamentos y cuartos de TV.',
      specs: [['Medidas', '1.85 m × 1.00 m de profundidad'], ['Posiciones', '3'], ['Colores', '7 a elegir']] },

    // ===== COMEDORES =====
    { id: 'comedor-delta-8', cat: 'comedores', name: 'Comedor Delta 8 personas', type: 'Mesa con pedestal y almacén, 8 sillas', price: 34000, stock: 'pedido', dias: 20,
      imgs: ['img/comedor-delta-8.jpg'], featured: true,
      tapiz: ['nogal', 'magnolia', 'chocolate'], optLabel: 'Acabado',
      dims: { largo: 200, fondo: 100, alto: 76 }, bultos: 9, factor: 0.9,
      short: 'Para 8 personas, enchapado de encino, con pedestal, puertas y almacén.',
      desc: 'Comedor para ocho personas enchapado de encino. La base es un pedestal con puertas que sirve de almacén para vajilla y mantelería.',
      specs: [['Mesa', '2.00 × 1.00 m'], ['Personas', '8'], ['Material', 'Enchapado de encino'], ['Extra', 'Pedestal con puertas y almacén']] },

    { id: 'comedor-dubai', cat: 'comedores', name: 'Comedor Dubai', type: 'Mesa de vidrio templado, 6 sillas', price: 28000, stock: 'pedido', dias: 20,
      imgs: ['img/comedor-dubai.jpg'], featured: true,
      tapiz: ['nogal', 'chocolate'], optLabel: 'Acabado',
      dims: { largo: 160, fondo: 100, alto: 76 }, bultos: 7, factor: 0.8,
      short: 'Para 6 personas, cubierta de vidrio templado sobre madera de pino.',
      desc: 'Comedor para seis personas con cubierta de vidrio templado y base de madera de pino. Las sillas son de respaldo curvo y asiento tapizado.',
      specs: [['Mesa', '1.60 × 1.00 m'], ['Personas', '6'], ['Cubierta', 'Vidrio templado'], ['Base', 'Madera de pino']] },

    { id: 'comedor-madrid', cat: 'comedores', name: 'Comedor Madrid', type: 'Mesa de vidrio templado, 6 sillas', price: 26000, stock: 'pedido', dias: 20,
      imgs: ['img/comedor-madrid.jpg'],
      tapiz: ['chocolate', 'grisMadera', 'nogal'], optLabel: 'Acabado',
      dims: { largo: 160, fondo: 100, alto: 76 }, bultos: 7, factor: 0.8,
      short: 'Para 6 personas, vidrio templado y madera de pino, líneas rectas.',
      desc: 'Comedor para seis personas con cubierta de vidrio templado y base de madera de pino. Sillas de líneas rectas con asiento tapizado.',
      specs: [['Mesa', '1.60 × 1.00 m'], ['Personas', '6'], ['Cubierta', 'Vidrio templado'], ['Base', 'Madera de pino']] },

    { id: 'comedor-delta-4', cat: 'comedores', name: 'Comedor Delta 4 personas', type: 'Mesa con pedestal y almacén, 4 sillas', price: 16500, stock: 'pedido', dias: 20,
      imgs: ['img/comedor-delta-4.jpg'],
      tapiz: ['nogal', 'magnolia', 'chocolate'], optLabel: 'Acabado',
      dims: { largo: 100, fondo: 100, alto: 76 }, bultos: 5, factor: 0.6,
      short: 'Para 4 personas, enchapado de encino, con pedestal y almacén.',
      desc: 'La versión de cuatro personas del Comedor Delta: mesa cuadrada enchapada de encino sobre pedestal con puertas y almacén.',
      specs: [['Mesa', '1.00 × 1.00 m'], ['Personas', '4'], ['Material', 'Enchapado de encino'], ['Extra', 'Pedestal con puertas y almacén']] }
  ];

  // Tarifa base de envío por estado (pesos, factor 1.0 = sala seccional de 3 bultos) y tránsito en días hábiles.
  // Calibrada el 3 de noviembre de 2026 con tablas de Kessa Muebles e IKEA y distancia por carretera desde el centro.
  const rates = { 'Ciudad de México': 0, 'Estado de México': 0, 'Hidalgo': 1290, 'Morelos': 1290, 'Tlaxcala': 1290, 'Puebla': 1490, 'Querétaro': 1490,
    'Guanajuato': 1890, 'Michoacán': 2090, 'San Luis Potosí': 2090, 'Veracruz': 2190, 'Guerrero': 2290, 'Aguascalientes': 2290, 'Jalisco': 2390, 'Zacatecas': 2490,
    'Oaxaca': 2690, 'Colima': 2690, 'Nayarit': 2790, 'Nuevo León': 2790, 'Tamaulipas': 2890, 'Tabasco': 2890, 'Coahuila': 2990, 'Durango': 2990, 'Chiapas': 3190,
    'Sinaloa': 3490, 'Chihuahua': 3490, 'Campeche': 3590, 'Yucatán': 3890, 'Quintana Roo': 3990, 'Sonora': 3990, 'Baja California': 4890, 'Baja California Sur': 5490 };
  const transit = { 'Ciudad de México': '3 a 5 días hábiles', 'Estado de México': '3 a 5 días hábiles', 'Hidalgo': '4 a 6 días hábiles', 'Morelos': '4 a 6 días hábiles', 'Tlaxcala': '4 a 6 días hábiles', 'Puebla': '4 a 6 días hábiles', 'Querétaro': '4 a 6 días hábiles',
    'Guanajuato': '5 a 7 días hábiles', 'Michoacán': '5 a 7 días hábiles', 'San Luis Potosí': '5 a 8 días hábiles', 'Veracruz': '5 a 8 días hábiles', 'Guerrero': '5 a 8 días hábiles', 'Aguascalientes': '6 a 8 días hábiles', 'Jalisco': '6 a 8 días hábiles', 'Zacatecas': '6 a 9 días hábiles',
    'Oaxaca': '6 a 9 días hábiles', 'Colima': '7 a 10 días hábiles', 'Nayarit': '7 a 10 días hábiles', 'Nuevo León': '7 a 10 días hábiles', 'Tamaulipas': '7 a 10 días hábiles', 'Tabasco': '8 a 11 días hábiles', 'Coahuila': '7 a 10 días hábiles', 'Durango': '8 a 11 días hábiles', 'Chiapas': '8 a 12 días hábiles',
    'Sinaloa': '10 a 14 días hábiles', 'Chihuahua': '10 a 14 días hábiles', 'Campeche': '10 a 14 días hábiles', 'Yucatán': '10 a 14 días hábiles', 'Quintana Roo': '12 a 15 días hábiles', 'Sonora': '12 a 15 días hábiles', 'Baja California': '14 a 20 días hábiles', 'Baja California Sur': '14 a 20 días hábiles' };

  // Zonas: agrupación para mostrar en la página de Envíos. cost = tarifa más baja del grupo, costMax = la más alta.
  const zoneGroups = [
    { id: 'centro', name: 'Zona centro', days: '3 a 5 días hábiles', states: ['Ciudad de México', 'Estado de México'] },
    { id: 'z1', name: 'Zona 1 · Vecinos del centro', days: '4 a 6 días hábiles', states: ['Hidalgo', 'Morelos', 'Tlaxcala', 'Puebla', 'Querétaro'] },
    { id: 'z2', name: 'Zona 2 · Bajío, Occidente y Golfo', days: '5 a 9 días hábiles', states: ['Guanajuato', 'Michoacán', 'San Luis Potosí', 'Veracruz', 'Guerrero', 'Aguascalientes', 'Jalisco', 'Zacatecas'] },
    { id: 'z3', name: 'Zona 3 · Norte, Pacífico y Sureste', days: '6 a 12 días hábiles', states: ['Oaxaca', 'Colima', 'Nayarit', 'Nuevo León', 'Tamaulipas', 'Tabasco', 'Coahuila', 'Durango', 'Chiapas'] },
    { id: 'z4', name: 'Zona 4 · Noroeste y Península', days: '10 a 20 días hábiles', states: ['Sinaloa', 'Chihuahua', 'Campeche', 'Yucatán', 'Quintana Roo', 'Sonora', 'Baja California', 'Baja California Sur'] }
  ];
  const zones = zoneGroups.map(z => ({ ...z, cost: Math.min(...z.states.map(s => rates[s])), costMax: Math.max(...z.states.map(s => rates[s])) }));
  const states = Object.keys(rates).sort((a, b) => a.localeCompare(b, 'es'));

  const payments = [
    { id: 'mp',   name: 'Mercado Pago', badge: 'Pago seguro', desc: 'Tarjeta de crédito o débito, a meses con tarjetas participantes, OXXO o saldo de Mercado Pago' }
  ];

  return { brand, categories, products, zones, rates, transit, states, payments, TAPIZ };
})();

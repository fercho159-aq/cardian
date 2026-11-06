/* Cardian Muebles · catálogo.
   Salas y comedores: productos, precios, medidas y colores reales del documento del cliente (noviembre de 2026).
   Cocinas y recámaras: fotos reales de trabajos del taller; se cotizan a medida, sin precio publicado. */
window.CARDIAN = (function () {
  const brand = {
    name: 'Cardian Muebles',
    phone: '+52 1 55 7006 0233',
    wa: '525570060233',
    email: 'atencion@cardianmuebles.com',
    site: 'cardianmuebles.com',
    ig: 'https://instagram.com/muebles.cardian',
    fb: 'https://facebook.com/CardianMuebles'
  };

  const categories = [
    { id: 'salas',     name: 'Salas',     plural: 'salas',     img: 'img/sala-africa.jpg',      desc: 'Modulares, escuadras y juegos 3-2-1 con reposet. Seis colores de tapiz.' },
    { id: 'comedores', name: 'Comedores', plural: 'comedores', img: 'img/comedor-delta-8.jpg',  desc: 'Para 4, 6 y 8 personas en madera de pino, encino y vidrio templado.' },
    { id: 'cocinas',   name: 'Cocinas',   plural: 'cocinas',   img: 'img/cocina-nocturna.jpg',  desc: 'Integrales a la medida de tu espacio. Se cotizan con tus medidas.' },
    { id: 'recamaras', name: 'Recámaras', plural: 'recámaras', img: 'img/closet-led.jpg',       desc: 'Clósets y vestidores a medida, con o sin iluminación.' }
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
      specs: [['Mesa', '1.00 × 1.00 m'], ['Personas', '4'], ['Material', 'Enchapado de encino'], ['Extra', 'Pedestal con puertas y almacén']] },

    // ===== COCINAS (a medida, sin precio publicado) =====
    { id: 'cocina-nocturna', cat: 'cocinas', name: 'Cocina Nocturna', type: 'Integral en U', quote: true, stock: 'medida',
      imgs: ['img/cocina-nocturna.jpg'], featured: true, bultos: 8, factor: 1.6,
      short: 'Nogal oscuro con cubierta de granito negro, vitrinas iluminadas y luz LED bajo alacenas.',
      desc: 'Cocina integral en U a la medida de tu espacio. Módulos en laminado nogal oscuro, cubierta de granito negro, vitrinas con luz, nichos abiertos y tira LED bajo las alacenas.',
      specs: [['Diseño', 'En U, a medida'], ['Cubierta', 'Granito negro'], ['Herrajes', 'Cierre suave'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-onix', cat: 'cocinas', name: 'Cocina Ónix Negra', type: 'Lineal con torre', quote: true, stock: 'medida',
      imgs: ['img/cocina-onix.jpg'], featured: true, bultos: 7, factor: 1.5,
      short: 'Negro mate con nichos de roble iluminados, torre para refrigerador y cubierta de piedra.',
      desc: 'Cocina lineal en laminado negro mate con tiradores ocultos, nichos abiertos en roble con luz LED, torre para refrigerador y espacio para microondas.',
      specs: [['Diseño', 'Lineal, a medida'], ['Cubierta', 'Piedra sinterizada'], ['Extra', 'Torre para refrigerador'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-bruma', cat: 'cocinas', name: 'Cocina Bruma', type: 'Integral en L', quote: true, stock: 'medida',
      imgs: ['img/cocina-bruma.jpg'], bultos: 6, factor: 1.3,
      short: 'Laminado brillo arena, cubierta de cuarzo y luz cálida bajo las alacenas.',
      desc: 'Cocina integral en L con puertas de alto brillo, cubierta de cuarzo blanco y campana integrada.',
      specs: [['Diseño', 'En L, a medida'], ['Cubierta', 'Cuarzo'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-nogal', cat: 'cocinas', name: 'Cocina Nogal', type: 'Lineal', quote: true, stock: 'medida',
      imgs: ['img/cocina-nogal.jpg'], bultos: 5, factor: 1.3,
      short: 'Alacenas completas, espacio para estufa y cubierta negra mate.',
      desc: 'Cocina lineal con alacenas superiores, gabinetes inferiores, hueco para estufa y cubierta laminada negra.',
      specs: [['Diseño', 'Lineal, a medida'], ['Cubierta', 'Laminado negro mate'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-ceniza', cat: 'cocinas', name: 'Cocina Ceniza', type: 'Integral en L', quote: true, stock: 'medida',
      imgs: ['img/cocina-ceniza.jpg'], bultos: 7, factor: 1.5,
      short: 'Roble gris de piso a techo con tira LED y torre de almacenamiento.',
      desc: 'Cocina en L con módulos hasta el techo, torre de despensa y luz LED continua.',
      specs: [['Diseño', 'En L, a medida'], ['Cubierta', 'Cuarzo gris'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-calacatta', cat: 'cocinas', name: 'Cocina Calacatta', type: 'Integral en L', quote: true, stock: 'medida',
      imgs: ['img/cocina-calacatta.jpg'], bultos: 6, factor: 1.3,
      short: 'Nogal con cubierta y muro en mármol Calacatta.',
      desc: 'Cocina en L con gabinetes en laminado nogal y cubierta de mármol tipo Calacatta.',
      specs: [['Diseño', 'En L, a medida'], ['Cubierta', 'Mármol Calacatta'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-chocolate', cat: 'cocinas', name: 'Cocina Chocolate', type: 'Integral en L', quote: true, stock: 'medida',
      imgs: ['img/cocina-chocolate.jpg'], bultos: 5, factor: 1.2,
      short: 'Laminado chocolate mate, jaladeras de aluminio y cubierta laminada.',
      desc: 'Cocina en L con laminado chocolate mate, jaladeras tipo barra y cubierta laminada.',
      specs: [['Diseño', 'En L, a medida'], ['Cubierta', 'Laminado'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-marquina', cat: 'cocinas', name: 'Cocina Marquina', type: 'Lineal con alacena', quote: true, stock: 'medida',
      imgs: ['img/cocina-marquina.jpg'], bultos: 4, factor: 1.1,
      short: 'Madera natural y negro, muro y cubierta en mármol Marquina.',
      desc: 'Cocina lineal con torre para despensa, alacena sobre el refrigerador y cubierta en mármol tipo Marquina.',
      specs: [['Diseño', 'Lineal, a medida'], ['Cubierta', 'Mármol Marquina'], ['Instalación', 'Incluida en CDMX y EdoMex']] },

    { id: 'cocina-compacta', cat: 'cocinas', name: 'Cocina Compacta Negra', type: 'Módulo con tarja', quote: true, stock: 'medida',
      imgs: ['img/cocina-compacta.jpg'], bultos: 3, factor: 0.8,
      short: 'Gabinete con tarja, cajones y alacena superior. Para departamentos y oficinas.',
      desc: 'Módulo de cocina con tarja de acero inoxidable, cubierta negra, cajones, puerta y alacena superior con repisa.',
      specs: [['Diseño', 'Módulo, a medida'], ['Tarja', 'Acero inoxidable incluida'], ['Cubierta', 'Laminado negro']] },

    // ===== RECÁMARAS (a medida, sin precio publicado) =====
    { id: 'closet-roble', cat: 'recamaras', name: 'Vestidor Roble', type: 'Vestidor completo a medida', quote: true, stock: 'medida',
      imgs: ['img/closet-roble.jpg', 'img/closet-roble-2.jpg'], featured: true, bultos: 9, factor: 1.6,
      short: 'Vestidor de piso a techo en roble claro con luz LED, cajoneras y colgadores en tres muros.',
      desc: 'Vestidor completo en tres muros con laminado roble claro, tira LED en cada cuerpo, cajoneras con cierre suave y colgadores a dos alturas.',
      specs: [['Diseño', 'Tres muros, a medida'], ['Cajones', 'Cierre suave'], ['Iluminación', 'LED en cada cuerpo']] },

    { id: 'closet-led', cat: 'recamaras', name: 'Clóset Lino', type: 'Tres cuerpos con luz LED', quote: true, stock: 'medida',
      imgs: ['img/closet-led.jpg'], featured: true, bultos: 5, factor: 1.2,
      short: 'Entrepaños, cajonera y colgador con tira LED vertical. A la medida de tu muro.',
      desc: 'Clóset abierto de tres cuerpos en laminado roble natural: entrepaños, cajones, barra para colgar y tira LED.',
      specs: [['Diseño', 'Tres cuerpos, a medida'], ['Cajones', 'Cierre suave'], ['Iluminación', 'LED cálida']] },

    { id: 'closet-grafito', cat: 'recamaras', name: 'Vestidor Grafito', type: 'Vestidor abierto en L', quote: true, stock: 'medida',
      imgs: ['img/closet-grafito.jpg'], bultos: 7, factor: 1.4,
      short: 'Vestidor en gris grafito con zapatera, cajonera y colgadores dobles.',
      desc: 'Vestidor abierto en L con laminado gris grafito: colgadores dobles, zapatera inclinada, cajonera y entrepaños.',
      specs: [['Diseño', 'En L, a medida'], ['Zapatera', 'Inclinada'], ['Colgadores', 'Dobles']] },

    { id: 'closet-tv', cat: 'recamaras', name: 'Clóset con centro de TV', type: 'Clóset con nicho para pantalla', quote: true, stock: 'medida',
      imgs: ['img/closet-tv.jpg'], bultos: 7, factor: 1.4,
      short: 'Clóset de muro completo con nicho iluminado para pantalla y cajoneras a los lados.',
      desc: 'Clóset de muro a muro con nicho central para pantalla, luz LED, cajoneras y maletero superior.',
      specs: [['Diseño', 'Muro completo, a medida'], ['Nicho', 'Para pantalla'], ['Iluminación', 'LED en nicho']] },

    { id: 'closet-arena', cat: 'recamaras', name: 'Clóset Arena', type: 'Clóset cerrado de puertas', quote: true, stock: 'medida',
      imgs: ['img/closet-arena.jpg'], bultos: 5, factor: 1.2,
      short: 'Clóset cerrado en laminado arena con puertas abatibles, cajones y maletero superior.',
      desc: 'Clóset de piso a techo con puertas abatibles, cajones al frente y maletero superior. Laminado arena con jaladeras de aluminio.',
      specs: [['Diseño', 'Cerrado, a medida'], ['Maletero', 'Incluido']] },

    { id: 'closet-negro', cat: 'recamaras', name: 'Clóset Negro Mate', type: 'Clóset cerrado con torre', quote: true, stock: 'medida',
      imgs: ['img/closet-negro.jpg'], bultos: 5, factor: 1.2,
      short: 'Negro mate con jaladeras largas, torre de cajones y maletero.',
      desc: 'Clóset cerrado en laminado negro mate con puertas abatibles, torre de cajones central y maletero.',
      specs: [['Diseño', 'Cerrado, a medida'], ['Torre', 'De cajones']] }
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
    { id: 'mp',   name: 'Mercado Pago', badge: '12 MSI', desc: 'Tarjeta de crédito o débito, hasta 12 meses sin intereses' },
    { id: 'spei', name: 'Transferencia SPEI', badge: '5 % de descuento', desc: 'Te enviamos CLABE; el pedido se confirma al acreditar' },
    { id: 'cash', name: 'Efectivo', badge: 'Apartado', desc: 'Anticipo del 50 % en OXXO o por depósito, el resto al recibir' }
  ];

  return { brand, categories, products, zones, rates, transit, states, payments, TAPIZ };
})();

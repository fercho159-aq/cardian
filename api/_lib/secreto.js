// Llave para firmar sesiones y enlaces de ticket.
// 1) CARDIAN_SECRET si existe en Vercel.
// 2) Si no, se deriva del token privado de la base (Upstash), que solo vive en el servidor.
//    Ojo: si algún día se regenera ese token, las sesiones y los enlaces de ticket viejos dejan de valer.
// 3) En desarrollo local, una fija.
const crypto = require('crypto');
const store = require('./store');

const propio = process.env.CARDIAN_SECRET || '';
const base = store.tokenBase ? store.tokenBase() : '';
const SECRETO = propio || (base ? crypto.createHash('sha256').update('cardian-firma|' + base).digest('hex') : 'dev-cardian-cambia-esta-llave');
const esDesarrollo = !propio && !base;

module.exports = { SECRETO, esDesarrollo };

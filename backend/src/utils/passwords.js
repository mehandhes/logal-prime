/**
 * Reglas de contraseña — única fuente de verdad.
 *
 * Deliberadamente moderadas: el equipo son conductores capturando datos
 * desde el celular, no una banca en línea. Se exige longitud (que es lo que
 * de verdad frena un ataque por fuerza bruta) y se bloquean las claves
 * obvias, sin obligar a símbolos raros que terminan escritos en un papel
 * pegado al tablero del carro.
 */

const LONGITUD_MINIMA = 8;

const CLAVES_PROHIBIDAS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'contrasena', 'contraseña',
  'qwertyui', 'logalprime', 'logal2024', 'logal2025', 'logal2026',
  'admin123', 'conductor', 'abcd1234', '11111111', '00000000'
]);

/**
 * Devuelve un mensaje de error si la contraseña no sirve, o null si está bien.
 * @param {string} password
 * @returns {string|null}
 */
function validarPassword(password) {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return 'La contraseña es obligatoria.';
  }
  if (password.length < LONGITUD_MINIMA) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`;
  }
  if (password.length > 128) {
    return 'La contraseña no puede superar los 128 caracteres.';
  }
  if (CLAVES_PROHIBIDAS.has(password.toLowerCase())) {
    return 'Esa contraseña es demasiado común. Elige otra.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'La contraseña debe combinar letras y números.';
  }
  return null;
}

/**
 * Genera una contraseña temporal legible para entregarle a un conductor
 * nuevo (evita caracteres ambiguos como l, 1, O, 0).
 */
function generarPasswordTemporal() {
  const letras = 'abcdefghijkmnpqrstuvwxyz';
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const pick = (set) => set[Math.floor(Math.random() * set.length)];

  let out = pick(mayus);
  for (let i = 0; i < 5; i++) out += pick(letras);
  for (let i = 0; i < 3; i++) out += pick(numeros);
  return out;
}

module.exports = { validarPassword, generarPasswordTemporal, LONGITUD_MINIMA };

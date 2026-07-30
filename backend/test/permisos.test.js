/**
 * Pruebas de la matriz de permisos por rol.
 * Ejecutar:  node test/permisos.test.js
 *
 * Dos capas:
 *   1. Las reglas puras de utils/permisos.js (qué puede hacer cada rol).
 *   2. Una auditoría de las rutas: verifica que cada endpoint declare el
 *      guard esperado. Si alguien agrega mañana una ruta sin protección,
 *      esta prueba falla.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  hoyLocal,
  puedeEditarRegistro,
  fechaPermitida,
  sanearEntradaRegistro,
  vistaRegistroSegunRol,
  DIAS_ATRAS_PERMITIDOS
} = require('../src/utils/permisos');

let pasadas = 0;
let fallidas = 0;

function test(nombre, fn) {
  try {
    fn();
    pasadas++;
    console.log('  ✓', nombre);
  } catch (e) {
    fallidas++;
    console.log('  ✗', nombre);
    console.log('     ', e.message);
  }
}

// ── Actores de prueba ─────────────────────────────────────────
const ADMIN = { id: 'admin1', rol: 'admin' };
const CONDUCTOR = { id: 'cond1', rol: 'conductor' };
const OTRO_CONDUCTOR = { id: 'cond2', rol: 'conductor' };

// Un jueves 30-jul-2026, 10:00 en Bogotá (= 15:00 UTC).
const AHORA = Date.parse('2026-07-30T15:00:00Z');
const dia = (iso) => new Date(iso + 'T00:00:00.000Z');

const registro = ({ creadoPor = CONDUCTOR.id, fecha = '2026-07-30', createdAt = '2026-07-30T14:00:00Z' } = {}) => ({
  _id: 'reg1',
  creadoPor,
  fecha: dia(fecha),
  createdAt: new Date(createdAt),
  totalIngresos: 250000,
  totalEgresos: 90000,
  utilidadNeta: 160000,
  pagoConductor: 70000,
  kmDia: 180
});

console.log('\n▸ Zona horaria');

test('hoyLocal usa la fecha de Colombia, no la UTC', () => {
  // 31-jul 02:00 UTC = 30-jul 21:00 en Bogotá → todavía es día 30.
  assert.strictEqual(hoyLocal(Date.parse('2026-07-31T02:00:00Z')), '2026-07-30');
  // 30-jul 04:00 UTC = 29-jul 23:00 en Bogotá → todavía es día 29.
  assert.strictEqual(hoyLocal(Date.parse('2026-07-30T04:00:00Z')), '2026-07-29');
});

console.log('\n▸ Edición de registros');

test('el admin edita cualquier registro, sin importar antigüedad ni autor', () => {
  const viejo = registro({ creadoPor: CONDUCTOR.id, fecha: '2026-06-01', createdAt: '2026-06-01T20:00:00Z' });
  assert.strictEqual(puedeEditarRegistro(ADMIN, viejo, AHORA).ok, true);
});

test('el conductor edita su propio registro del día', () => {
  assert.strictEqual(puedeEditarRegistro(CONDUCTOR, registro(), AHORA).ok, true);
});

test('el conductor NO puede editar el registro de otro conductor', () => {
  const ajeno = registro({ creadoPor: OTRO_CONDUCTOR.id });
  const r = puedeEditarRegistro(CONDUCTOR, ajeno, AHORA);
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /tú capturaste/);
});

test('el conductor NO puede editar un registro de hace días', () => {
  const viejo = registro({ fecha: '2026-07-27', createdAt: '2026-07-27T20:00:00Z' });
  const r = puedeEditarRegistro(CONDUCTOR, viejo, AHORA);
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /administrador/);
});

test('el turno que cierra después de medianoche sigue siendo editable (gracia de 6h)', () => {
  // Son las 00:00 del 30 en Bogotá; capturó el registro del 29 hace 2 horas.
  const medianoche = Date.parse('2026-07-30T05:00:00Z');
  const anoche = registro({ fecha: '2026-07-29', createdAt: '2026-07-30T03:00:00Z' });
  assert.strictEqual(puedeEditarRegistro(CONDUCTOR, anoche, medianoche).ok, true);
});

test('pasada la gracia, el registro de ayer queda cerrado', () => {
  const anoche = registro({ fecha: '2026-07-29', createdAt: '2026-07-29T22:00:00Z' });
  assert.strictEqual(puedeEditarRegistro(CONDUCTOR, anoche, AHORA).ok, false);
});

console.log('\n▸ Fechas permitidas al capturar');

test('el conductor no puede registrar días futuros', () => {
  assert.match(fechaPermitida(CONDUCTOR, dia('2026-07-31'), AHORA), /futuros/);
});

test('el conductor sí puede registrar días recientes', () => {
  assert.strictEqual(fechaPermitida(CONDUCTOR, dia('2026-07-30'), AHORA), null);
  assert.strictEqual(fechaPermitida(CONDUCTOR, dia('2026-07-27'), AHORA), null);
});

test(`el conductor no puede registrar más de ${DIAS_ATRAS_PERMITIDOS} días atrás`, () => {
  assert.strictEqual(fechaPermitida(CONDUCTOR, dia('2026-07-23'), AHORA), null); // 7 días justos
  assert.match(fechaPermitida(CONDUCTOR, dia('2026-07-22'), AHORA), /días hacia atrás/); // 8 días
});

test('el admin puede registrar cualquier fecha', () => {
  assert.strictEqual(fechaPermitida(ADMIN, dia('2025-01-15'), AHORA), null);
  assert.strictEqual(fechaPermitida(ADMIN, dia('2027-12-31'), AHORA), null);
});

test('una fecha inválida se rechaza', () => {
  assert.match(fechaPermitida(CONDUCTOR, 'no-es-fecha', AHORA), /no es válida/);
});

console.log('\n▸ Saneo del cuerpo de la petición');

test('el conductor no puede fijarse su propio pago', () => {
  const limpio = sanearEntradaRegistro(CONDUCTOR, { combustible: 50000, pagoConductor: 999999 });
  assert.strictEqual(limpio.pagoConductor, undefined);
  assert.strictEqual(limpio.combustible, 50000);
});

test('el admin sí puede fijar el pago al conductor', () => {
  const limpio = sanearEntradaRegistro(ADMIN, { pagoConductor: 800000 });
  assert.strictEqual(limpio.pagoConductor, 800000);
});

test('nadie puede falsificar la trazabilidad ni los totales calculados', () => {
  const intento = {
    creadoPor: 'otro-usuario', modificadoPor: 'otro-usuario',
    totalIngresos: 1, totalEgresos: 1, utilidadNeta: 99999999, kmDia: 5
  };
  for (const actor of [ADMIN, CONDUCTOR]) {
    const limpio = sanearEntradaRegistro(actor, intento);
    assert.strictEqual(limpio.creadoPor, undefined);
    assert.strictEqual(limpio.modificadoPor, undefined);
    assert.strictEqual(limpio.utilidadNeta, undefined);
    assert.strictEqual(limpio.totalIngresos, undefined);
    assert.strictEqual(limpio.kmDia, undefined);
  }
});

console.log('\n▸ Qué devuelve la API según el rol');

test('el conductor no recibe la utilidad ni el pago al conductor', () => {
  const vista = vistaRegistroSegunRol(CONDUCTOR, registro());
  assert.strictEqual(vista.utilidadNeta, undefined);
  assert.strictEqual(vista.pagoConductor, undefined);
  // Pero sí ve lo que él mismo capturó.
  assert.strictEqual(vista.totalIngresos, 250000);
  assert.strictEqual(vista.totalEgresos, 90000);
});

test('el admin recibe el registro completo', () => {
  const vista = vistaRegistroSegunRol(ADMIN, registro());
  assert.strictEqual(vista.utilidadNeta, 160000);
  assert.strictEqual(vista.pagoConductor, 70000);
});

// ── Auditoría de las rutas ────────────────────────────────────
console.log('\n▸ Auditoría de guards en las rutas');

const DIR_RUTAS = path.join(__dirname, '..', 'src', 'routes');

// Guard esperado por endpoint. 'admin' = solo administrador;
// 'auth' = cualquier usuario autenticado (el control fino va dentro).
const ESPERADO = {
  'auth.js': {
    'POST /login': 'publico',
    'POST /setup': 'publico',
    'GET /me': 'auth',
    'POST /cambiar-password': 'auth'
  },
  'usuarios.js': '*admin',            // router.use(auth.soloAdmin) en todo el archivo
  'stats.js': { 'GET /dashboard': 'admin', 'GET /historico': 'admin' },
  'pagos.js': {
    'GET /': 'admin', 'GET /:id': 'admin', 'POST /previsualizar': 'admin',
    'POST /generar': 'admin', 'POST /': 'admin', 'PUT /:id': 'admin', 'DELETE /:id': 'admin'
  },
  'anticipos.js': {
    'GET /': 'admin', 'POST /': 'admin', 'POST /:id/aplicar': 'admin', 'DELETE /:id': 'admin'
  },
  'mantenimiento.js': {
    'GET /': 'admin', 'POST /': 'admin', 'PUT /:id': 'admin', 'DELETE /:id': 'admin'
  },
  'vehicles.js': {
    // El conductor necesita la lista para elegir sobre qué carro reporta.
    'GET /': 'auth', 'GET /:id': 'auth',
    'POST /': 'admin', 'PUT /:id': 'admin', 'DELETE /:id': 'admin'
  },
  'clientes.js': {
    // El conductor necesita los clientes para desglosar los ingresos del día.
    'GET /': 'auth',
    'GET /:id/resumen': 'admin', 'POST /': 'admin', 'PUT /:id': 'admin', 'DELETE /:id': 'admin'
  },
  'registros.js': {
    'GET /ultimo': 'auth', 'GET /': 'auth', 'GET /:id': 'auth', 'POST /': 'auth',
    'PUT /:id': 'auth',            // dentro valida autoría y ventana de edición
    'POST /importar': 'admin', 'DELETE /:id': 'admin'
  }
};

function guardsDeArchivo(archivo) {
  const src = fs.readFileSync(path.join(DIR_RUTAS, archivo), 'utf8');
  if (/router\.use\(auth\.soloAdmin\)/.test(src)) return '*admin';

  const encontrados = {};
  const re = /router\.(get|post|put|delete)\(\s*'([^']+)'\s*,\s*([A-Za-z0-9_.]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, verbo, ruta, guard] = m;
    encontrados[`${verbo.toUpperCase()} ${ruta}`] =
      guard === 'auth.soloAdmin' ? 'admin' : guard === 'auth' ? 'auth' : guard;
  }
  // Rutas declaradas sin guard alguno (ej. login) se marcan aparte.
  const rePublica = /router\.(get|post|put|delete)\(\s*'([^']+)'\s*,\s*async/g;
  while ((m = rePublica.exec(src)) !== null) {
    encontrados[`${m[1].toUpperCase()} ${m[2]}`] = 'publico';
  }
  return encontrados;
}

for (const [archivo, esperado] of Object.entries(ESPERADO)) {
  test(`${archivo}: los guards son los esperados`, () => {
    const real = guardsDeArchivo(archivo);
    assert.deepStrictEqual(real, esperado);
  });
}

test('ninguna ruta protegida quedó sin guard por descuido', () => {
  const archivos = fs.readdirSync(DIR_RUTAS).filter(f => f.endsWith('.js'));
  const sinCubrir = archivos.filter(f => !Object.hasOwn(ESPERADO, f));
  assert.deepStrictEqual(sinCubrir, [],
    `Hay archivos de rutas sin auditar en esta prueba: ${sinCubrir.join(', ')}`);
});

console.log(`\n${fallidas === 0 ? '✅' : '❌'} ${pasadas} pruebas pasaron, ${fallidas} fallaron.\n`);
process.exit(fallidas === 0 ? 0 : 1);

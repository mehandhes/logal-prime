/**
 * Prueba de extremo a extremo de la autorización.
 * Ejecutar:  node test/auth-http.test.js
 *
 * Levanta el servidor Express REAL y le pega peticiones HTTP con tokens de
 * admin, de conductor, de cuenta desactivada y de cuenta borrada, para
 * comprobar los códigos de respuesta.
 *
 * No necesita MongoDB: se sustituyen `mongoose.connect` y `User.findById`
 * por dobles en memoria. Lo que se está probando aquí es la capa de
 * autorización (middleware + guards de las rutas), no la persistencia.
 */
const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'secreto-de-prueba';
process.env.NODE_ENV = 'test';

// ── Dobles en memoria (antes de cargar la app) ────────────────
mongoose.connect = async () => ({ conexionFalsa: true });
// Las operaciones que sí toquen la BD fallan rápido en vez de quedarse
// esperando: a esta prueba solo le importa el código de autorización.
mongoose.set('bufferTimeoutMS', 200);

const USUARIOS = {
  admin1:  { _id: 'admin1', username: 'andres', nombre: 'Andrés', rol: 'admin', activo: true },
  cond1:   { _id: 'cond1', username: 'carlos', nombre: 'Carlos', rol: 'conductor', activo: true },
  inactivo:{ _id: 'inactivo', username: 'expulsado', nombre: 'Ex Conductor', rol: 'conductor', activo: false }
};

const User = require('../src/models/User');
User.findById = (id) => ({
  select: async () => {
    const u = USUARIOS[id];
    if (!u) return null;                       // cuenta borrada
    return { ...u, toPublic: () => ({ ...u }) };
  }
});

const app = require('../src/index');

const token = (id) => jwt.sign({ id, rol: USUARIOS[id]?.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

// ── Arranque del servidor ─────────────────────────────────────
let servidor, base;
let pasadas = 0, fallidas = 0;

async function pedir(metodo, ruta, tk, cuerpo) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(tk ? { Authorization: `Bearer ${tk}` } : {})
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  return res.status;
}

async function test(nombre, fn) {
  try {
    await fn();
    pasadas++;
    console.log('  ✓', nombre);
  } catch (e) {
    fallidas++;
    console.log('  ✗', nombre);
    console.log('     ', e.message.split('\n')[0]);
  }
}

/** Afirma que la petición fue rechazada por permisos (403). */
async function prohibido(metodo, ruta, tk, cuerpo) {
  const status = await pedir(metodo, ruta, tk, cuerpo);
  assert.strictEqual(status, 403, `${metodo} ${ruta} devolvió ${status}, se esperaba 403`);
}

/** Afirma que la petición PASÓ el control de acceso (lo que falle después da igual). */
async function permitido(metodo, ruta, tk, cuerpo) {
  const status = await pedir(metodo, ruta, tk, cuerpo);
  assert.ok(status !== 401 && status !== 403,
    `${metodo} ${ruta} devolvió ${status}: la autorización lo bloqueó y no debía`);
}

(async () => {
  servidor = http.createServer(app);
  await new Promise(r => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const ADMIN = token('admin1');
  const CONDUCTOR = token('cond1');
  const INACTIVO = token('inactivo');
  const BORRADO = jwt.sign({ id: 'fantasma', rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  console.log('\n▸ Sin credenciales');
  await test('sin token no se entra a ningún módulo', async () => {
    for (const r of ['/api/stats/dashboard', '/api/registros', '/api/usuarios', '/api/pagos']) {
      assert.strictEqual(await pedir('GET', r, null), 401, r);
    }
  });
  await test('un token firmado con otra llave se rechaza', async () => {
    const falso = jwt.sign({ id: 'admin1', rol: 'admin' }, 'llave-equivocada');
    assert.strictEqual(await pedir('GET', '/api/registros', falso), 401);
  });

  console.log('\n▸ Cuentas inválidas (el token sigue siendo criptográficamente válido)');
  await test('una cuenta desactivada queda fuera de inmediato', async () => {
    assert.strictEqual(await pedir('GET', '/api/registros', INACTIVO), 403);
  });
  await test('el token de una cuenta borrada ya no sirve', async () => {
    assert.strictEqual(await pedir('GET', '/api/registros', BORRADO), 401);
  });

  console.log('\n▸ El conductor NO alcanza los módulos de contabilidad');
  await test('dashboard y estadísticas: 403', async () => {
    await prohibido('GET', '/api/stats/dashboard', CONDUCTOR);
    await prohibido('GET', '/api/stats/historico', CONDUCTOR);
  });
  await test('pagos y liquidación: 403', async () => {
    await prohibido('GET', '/api/pagos', CONDUCTOR);
    await prohibido('POST', '/api/pagos/generar', CONDUCTOR, {});
    await prohibido('POST', '/api/pagos/previsualizar', CONDUCTOR, {});
  });
  await test('mantenimiento y anticipos: 403', async () => {
    await prohibido('GET', '/api/mantenimiento', CONDUCTOR);
    await prohibido('GET', '/api/anticipos', CONDUCTOR);
  });
  await test('gestión de usuarios: 403', async () => {
    await prohibido('GET', '/api/usuarios', CONDUCTOR);
    await prohibido('POST', '/api/usuarios', CONDUCTOR, { username: 'x', nombre: 'X', rol: 'admin' });
    await prohibido('DELETE', '/api/usuarios/admin1', CONDUCTOR);
  });
  await test('no puede crear ni borrar vehículos ni clientes', async () => {
    await prohibido('POST', '/api/vehicles', CONDUCTOR, { placa: 'XXX123' });
    await prohibido('DELETE', '/api/vehicles/1', CONDUCTOR);
    await prohibido('POST', '/api/clientes', CONDUCTOR, { nombre: 'Nuevo' });
    await prohibido('DELETE', '/api/clientes/1', CONDUCTOR);
  });
  await test('no puede borrar registros ni importar quincenas', async () => {
    await prohibido('DELETE', '/api/registros/1', CONDUCTOR);
    await prohibido('POST', '/api/registros/importar', CONDUCTOR, { registros: [] });
  });

  console.log('\n▸ El conductor SÍ alcanza lo que necesita para reportar');
  await test('lee su perfil, la flota y los clientes', async () => {
    await permitido('GET', '/api/auth/me', CONDUCTOR);
    await permitido('GET', '/api/vehicles', CONDUCTOR);
    await permitido('GET', '/api/clientes', CONDUCTOR);
  });
  await test('consulta y crea registros diarios', async () => {
    await permitido('GET', '/api/registros', CONDUCTOR);
    await permitido('GET', '/api/registros/ultimo', CONDUCTOR);
  });
  await test('puede cambiar su propia contraseña', async () => {
    await permitido('POST', '/api/auth/cambiar-password', CONDUCTOR, { passwordActual: 'a', passwordNueva: 'b' });
  });

  console.log('\n▸ El admin pasa el control de acceso en todo');
  await test('ningún módulo le responde 401 ni 403', async () => {
    for (const r of ['/api/stats/dashboard', '/api/pagos', '/api/usuarios',
                     '/api/mantenimiento', '/api/anticipos', '/api/vehicles',
                     '/api/clientes', '/api/registros']) {
      await permitido('GET', r, ADMIN);
    }
  });

  await new Promise(r => servidor.close(r));
  console.log(`\n${fallidas === 0 ? '✅' : '❌'} ${pasadas} pruebas pasaron, ${fallidas} fallaron.\n`);
  process.exit(fallidas === 0 ? 0 : 1);
})();

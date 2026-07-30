/**
 * Reglas de permiso — única fuente de verdad.
 *
 * Vive aparte de las rutas (igual que contabilidad.js) para poder probarla
 * sin levantar Express ni MongoDB, y para que las reglas no queden
 * repartidas por el código.
 *
 * Roles:
 *   admin     — acceso total.
 *   conductor — solo reporta ingresos y egresos, y ve su propio historial.
 */

const TZ = 'America/Bogota';

// Ventana en la que un conductor puede corregir un registro que él capturó:
// mientras la fecha del registro sea HOY, o mientras no hayan pasado más de
// 6 horas desde que lo creó (cubre el turno que cierra después de medianoche).
const HORAS_GRACIA_EDICION = 6;

// Cuántos días hacia atrás puede registrar un conductor. Evita que se toquen
// quincenas ya liquidadas. El admin no tiene este límite.
const DIAS_ATRAS_PERMITIDOS = 7;

/** Fecha de hoy en Colombia, en formato YYYY-MM-DD. */
function hoyLocal(ahora = Date.now()) {
  return new Date(ahora).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Parte de fecha (YYYY-MM-DD) de un valor guardado como fecha-solo en UTC. */
function soloFecha(valor) {
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Diferencia en días entre dos cadenas YYYY-MM-DD (a − b). */
function diasEntre(a, b) {
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
}

const esAdmin = (usuario) => usuario?.rol === 'admin';

/**
 * ¿Este usuario puede modificar este registro?
 * @returns {{ok: boolean, message?: string}}
 */
function puedeEditarRegistro(usuario, registro, ahora = Date.now()) {
  if (esAdmin(usuario)) return { ok: true };
  if (!registro) return { ok: false, message: 'Registro no encontrado.' };

  if (String(registro.creadoPor || '') !== String(usuario?.id || '')) {
    return { ok: false, message: 'Solo puedes modificar los registros que tú capturaste.' };
  }

  const esDeHoy = soloFecha(registro.fecha) === hoyLocal(ahora);
  const creado = registro.createdAt ? new Date(registro.createdAt).getTime() : null;
  const horas = creado ? (ahora - creado) / 3600000 : Infinity;

  if (esDeHoy || horas <= HORAS_GRACIA_EDICION) return { ok: true };

  return {
    ok: false,
    message: 'Este registro ya no se puede editar. Pídele el ajuste al administrador.'
  };
}

/**
 * Valida la fecha que envía un conductor al crear o editar.
 * @returns {string|null} mensaje de error, o null si la fecha es válida.
 */
function fechaPermitida(usuario, fecha, ahora = Date.now()) {
  if (esAdmin(usuario)) return null;

  const f = soloFecha(fecha);
  if (!f) return 'La fecha del registro no es válida.';

  const diff = diasEntre(f, hoyLocal(ahora));
  if (diff > 0) return 'No puedes registrar días futuros.';
  if (diff < -DIAS_ATRAS_PERMITIDOS) {
    return `Solo puedes registrar hasta ${DIAS_ATRAS_PERMITIDOS} días hacia atrás. Para fechas anteriores, pídele el registro al administrador.`;
  }
  return null;
}

/**
 * Quita del cuerpo de la petición los campos que el cliente no puede fijar.
 * La trazabilidad la pone el servidor; los totales los recalcula el modelo; y
 * el pago al conductor es decisión de la empresa, no de quien conduce.
 */
function sanearEntradaRegistro(usuario, body = {}) {
  const limpio = { ...body };

  delete limpio.creadoPor;
  delete limpio.modificadoPor;
  delete limpio.totalIngresos;
  delete limpio.totalEgresos;
  delete limpio.utilidadNeta;
  delete limpio.kmDia;

  if (!esAdmin(usuario)) delete limpio.pagoConductor;

  return limpio;
}

/**
 * Vista de un registro según el rol. El conductor ve lo que capturó, pero no
 * los indicadores de rentabilidad de la empresa.
 */
function vistaRegistroSegunRol(usuario, registro) {
  const obj = registro?.toObject ? registro.toObject() : { ...registro };
  if (esAdmin(usuario)) return obj;

  delete obj.utilidadNeta;
  delete obj.pagoConductor;
  return obj;
}

module.exports = {
  TZ,
  HORAS_GRACIA_EDICION,
  DIAS_ATRAS_PERMITIDOS,
  hoyLocal,
  soloFecha,
  diasEntre,
  esAdmin,
  puedeEditarRegistro,
  fechaPermitida,
  sanearEntradaRegistro,
  vistaRegistroSegunRol
};

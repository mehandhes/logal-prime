/**
 * contabilidad.js — Única fuente de verdad para los cálculos contables.
 *
 * No depende de mongoose ni de Express: es lógica pura y testeable.
 * La usan el modelo RegistroDiario (pre-save), las rutas y las pruebas.
 */

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Devuelve la suma de los ingresos por cliente de un registro,
 * soportando el formato nuevo (ingresosPorCliente[]) y el heredado
 * (ingresos.cliente1 / ingresos.cliente2).
 */
function sumarIngresosPorCliente(reg) {
  const ing = reg.ingresos || {};
  const lista = Array.isArray(reg.ingresosPorCliente) ? reg.ingresosPorCliente : [];
  if (lista.length > 0) {
    return lista.reduce((s, c) => s + num(c && c.valor), 0);
  }
  // Compat: esquema anterior con dos clientes fijos.
  return num(ing.cliente1) + num(ing.cliente2);
}

/**
 * Calcula todos los campos derivados de un registro diario.
 *
 *   Total Ingresos (K) = pasajes + Σ ingresos por cliente
 *   Total Egresos  (R) = combustible + peajes + lavadas + indrive + otros
 *   Km del día     (F) = kmFin - kmInicio   (nunca negativo)
 *   Saldo/Utilidad (T) = totalIngresos - totalEgresos
 *
 * Los galones (M) son cantidad, NO dinero: no entran en egresos.
 * El pago al conductor (S) NO se descuenta del saldo diario; se
 * descuenta al cierre del período (ver liquidarPeriodo).
 */
function calcularTotales(reg) {
  const ing = reg.ingresos || {};
  const efectivo = num(ing.efectivo);
  const consignacion = num(ing.consignacion);
  // Ingreso general del día por método de pago (efectivo + consignación).
  // Compat: si un registro antiguo no tiene efectivo/consignación pero sí
  // 'pasajes'/'valor', se usa ese monto como base (efectivo).
  const base = (efectivo || consignacion)
    ? (efectivo + consignacion)
    : num(ing.pasajes != null ? ing.pasajes : ing.valor);
  const pasajes = base; // se mantiene el nombre 'pasajes' como base general
  const ingresosClientes = sumarIngresosPorCliente(reg);

  // Total del día = Efectivo + Consignación + Σ ingresos por cliente.
  const totalIngresos = base + ingresosClientes;

  const totalEgresos =
    num(reg.combustible) +
    num(reg.peajes) +
    num(reg.lavadas) +
    num(reg.indrive) +
    num(reg.otros);

  const kmBruto = num(reg.kmFin) - num(reg.kmInicio);
  const kmDia = kmBruto > 0 ? kmBruto : 0;

  const utilidadNeta = totalIngresos - totalEgresos;

  return { pasajes, ingresosClientes, totalIngresos, totalEgresos, kmDia, utilidadNeta };
}

/**
 * Aplica los totales calculados sobre el propio documento/objeto.
 * Devuelve el mismo objeto para encadenar.
 */
function aplicarTotales(reg) {
  const t = calcularTotales(reg);
  if (!reg.ingresos) reg.ingresos = {};
  reg.ingresos.pasajes = t.pasajes;
  // 'valor' queda como espejo del total para compatibilidad hacia atrás.
  reg.ingresos.valor = t.totalIngresos;
  reg.totalIngresos = t.totalIngresos;
  reg.totalEgresos = t.totalEgresos;
  reg.kmDia = t.kmDia;
  reg.utilidadNeta = t.utilidadNeta;
  return reg;
}

/**
 * Reglas de negocio para la liquidación de un período (quincena).
 *
 *   utilidadOperativa = Σ (ingresos - egresos)      -> resultado de la operación
 *   sueldoConductor   = según modo elegido           -> costo de mano de obra
 *   netoEmpresa       = utilidadOperativa - sueldo   -> lo que le queda al dueño
 */
function liquidarPeriodo(registros, opciones = {}) {
  const { modo = 'registros', montoConductor = 0, porcentajeConductor = 30 } = opciones;

  const acc = registros.reduce((a, r) => {
    const t = calcularTotales(r);
    a.totalIngresos += t.totalIngresos;
    a.totalEgresos += t.totalEgresos;
    a.totalKm += t.kmDia;
    a.galones += num(r.galones);
    a.pagosRegistrados += num(r.pagoConductor);
    a.totalViajes += num((r.ingresos && r.ingresos.numViajes) || 1) || 1;
    return a;
  }, { totalIngresos: 0, totalEgresos: 0, totalKm: 0, galones: 0, pagosRegistrados: 0, totalViajes: 0 });

  const utilidadOperativa = acc.totalIngresos - acc.totalEgresos;

  let sueldoConductor;
  if (modo === 'fijo') sueldoConductor = num(montoConductor);
  else if (modo === 'porcentaje') sueldoConductor = (utilidadOperativa * num(porcentajeConductor)) / 100;
  else sueldoConductor = acc.pagosRegistrados; // 'registros'

  const netoEmpresa = utilidadOperativa - sueldoConductor;

  return {
    ...acc,
    utilidadOperativa,
    sueldoConductor,
    netoEmpresa,
    // KPIs de flota
    rendimientoKmGalon: acc.galones > 0 ? acc.totalKm / acc.galones : 0,
    costoPorKm: acc.totalKm > 0 ? acc.totalEgresos / acc.totalKm : 0,
    ingresoPorKm: acc.totalKm > 0 ? acc.totalIngresos / acc.totalKm : 0
  };
}

/**
 * Validaciones de captura. Devuelve un arreglo de advertencias (no bloquean,
 * solo alertan) para el registro `reg`, opcionalmente comparando contra el
 * registro anterior `prev` del mismo vehículo.
 */
function validarRegistro(reg, prev = null) {
  const avisos = [];
  const kmInicio = num(reg.kmInicio);
  const kmFin = num(reg.kmFin);

  if (kmInicio && kmFin && kmFin < kmInicio) {
    avisos.push({ campo: 'kmFin', tipo: 'error', mensaje: 'El kilometraje final es menor que el inicial.' });
  }
  if (prev && num(prev.kmFin) && kmInicio && kmInicio < num(prev.kmFin)) {
    avisos.push({ campo: 'kmInicio', tipo: 'error', mensaje: `El odómetro retrocede: el día anterior cerró en ${num(prev.kmFin).toLocaleString('es-CO')} km.` });
  }
  if (kmInicio && kmFin && (kmFin - kmInicio) > 800) {
    avisos.push({ campo: 'kmFin', tipo: 'aviso', mensaje: 'Más de 800 km en un día; verifica el kilometraje.' });
  }

  const { totalIngresos, totalEgresos } = calcularTotales(reg);
  const combustible = num(reg.combustible);
  if (combustible > 250000) {
    avisos.push({ campo: 'combustible', tipo: 'aviso', mensaje: 'Gasto de combustible atípicamente alto.' });
  }
  if (totalEgresos > totalIngresos && totalIngresos > 0) {
    avisos.push({ campo: 'general', tipo: 'aviso', mensaje: 'Los egresos superan a los ingresos: el saldo del día es negativo.' });
  }
  if (num(reg.galones) > 0 && combustible === 0) {
    avisos.push({ campo: 'combustible', tipo: 'aviso', mensaje: 'Registraste galones pero no el valor del combustible.' });
  }

  return avisos;
}

module.exports = {
  num,
  calcularTotales,
  aplicarTotales,
  liquidarPeriodo,
  validarRegistro,
  sumarIngresosPorCliente
};

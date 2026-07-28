/**
 * Pruebas unitarias de la lógica contable.
 * Ejecutar:  node test/contabilidad.test.js
 *
 * Los casos replican filas y bloques reales de la hoja "Reporte Diario"
 * para blindar la contabilidad ante cambios futuros.
 */
const assert = require('assert');
const {
  calcularTotales,
  liquidarPeriodo,
  validarRegistro
} = require('../src/utils/contabilidad');

let pasadas = 0;
function test(nombre, fn) {
  fn();
  pasadas++;
  console.log('  ✓', nombre);
}

console.log('contabilidad.calcularTotales');

test('Total Ingresos = pasajes + clientes (corrige bug K=G+J de la hoja)', () => {
  const r = { ingresos: { pasajes: 131700 }, ingresosPorCliente: [
    { nombre: 'Familia Rojas', valor: 16000 }, // I27 que la hoja NO sumaba
    { nombre: 'Sofi', valor: 15000 }
  ] };
  const t = calcularTotales(r);
  assert.strictEqual(t.totalIngresos, 162700);
});

test('Total Egresos = L+N+O+P+Q, sin galones', () => {
  const r = { combustible: 130000, peajes: 0, lavadas: 0, indrive: 22000, otros: 10000, galones: 12.7 };
  const t = calcularTotales(r);
  assert.strictEqual(t.totalEgresos, 162000); // los galones NO suman
});

test('Km del día = kmFin - kmInicio, nunca negativo (corrige bug F=D-E)', () => {
  assert.strictEqual(calcularTotales({ kmInicio: 197046, kmFin: 197256 }).kmDia, 210);
  assert.strictEqual(calcularTotales({ kmInicio: 197256, kmFin: 197046 }).kmDia, 0);
});

test('Saldo = ingresos - egresos, NO suma kilometraje (corrige bug T=D+K-R)', () => {
  const r = { ingresos: { pasajes: 272300 }, combustible: 130000, indrive: 22000, kmInicio: 195019, kmFin: 195217 };
  const t = calcularTotales(r);
  assert.strictEqual(t.utilidadNeta, 272300 - 152000); // 120300, sin los 195019 km
});

test('Compatibilidad: registro antiguo con ingresos.valor', () => {
  const t = calcularTotales({ ingresos: { valor: 225000 } });
  assert.strictEqual(t.totalIngresos, 225000);
});

test('Total = Efectivo + Consignación + clientes', () => {
  const r = {
    ingresos: { efectivo: 150000, consignacion: 50000 },
    ingresosPorCliente: [{ nombre: 'Familia Rojas', valor: 16000 }]
  };
  const t = calcularTotales(r);
  assert.strictEqual(t.totalIngresos, 216000);
});

console.log('contabilidad.liquidarPeriodo');

test('Utilidad operativa vs neto empresa (modo registros)', () => {
  const registros = [
    { ingresos: { pasajes: 200000 }, combustible: 50000, pagoConductor: 0 },
    { ingresos: { pasajes: 300000 }, combustible: 80000, pagoConductor: 664000 }
  ];
  const liq = liquidarPeriodo(registros, { modo: 'registros' });
  assert.strictEqual(liq.utilidadOperativa, 500000 - 130000); // 370000
  assert.strictEqual(liq.sueldoConductor, 664000);
  assert.strictEqual(liq.netoEmpresa, 370000 - 664000); // -294000
});

test('Modo fijo y porcentaje', () => {
  const registros = [{ ingresos: { pasajes: 1000000 }, combustible: 0 }];
  assert.strictEqual(liquidarPeriodo(registros, { modo: 'fijo', montoConductor: 400000 }).sueldoConductor, 400000);
  assert.strictEqual(liquidarPeriodo(registros, { modo: 'porcentaje', porcentajeConductor: 30 }).sueldoConductor, 300000);
});

test('Rendimiento km/galón y costo por km', () => {
  const registros = [{ ingresos: { pasajes: 0 }, combustible: 130000, kmInicio: 0, kmFin: 200, galones: 10 }];
  const liq = liquidarPeriodo(registros);
  assert.strictEqual(liq.rendimientoKmGalon, 20);
  assert.strictEqual(liq.costoPorKm, 650);
});

console.log('contabilidad.validarRegistro');

test('Detecta km final menor al inicial', () => {
  const avisos = validarRegistro({ kmInicio: 200, kmFin: 100 });
  assert.ok(avisos.some(a => a.campo === 'kmFin' && a.tipo === 'error'));
});

test('Detecta odómetro que retrocede vs día anterior', () => {
  const avisos = validarRegistro({ kmInicio: 195000, kmFin: 195100 }, { kmFin: 195200 });
  assert.ok(avisos.some(a => a.campo === 'kmInicio' && a.tipo === 'error'));
});

test('Registro correcto no genera errores', () => {
  const avisos = validarRegistro({ kmInicio: 195000, kmFin: 195200, ingresos: { pasajes: 200000 }, combustible: 50000 }, { kmFin: 195000 });
  assert.ok(!avisos.some(a => a.tipo === 'error'));
});

console.log(`\n${pasadas} pruebas pasaron ✅`);

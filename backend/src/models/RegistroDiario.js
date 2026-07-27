const mongoose = require('mongoose');
const { aplicarTotales } = require('../utils/contabilidad');

/**
 * RegistroDiario — alineado con la hoja "Reporte Diario" de LOGAL Prime.
 *
 * Mapeo de columnas de la hoja de cálculo:
 *   A Fecha              -> fecha
 *   B Vehículo           -> vehiculo / placa
 *   C Conductor          -> conductor
 *   D Kilometraje Inicio -> kmInicio
 *   E Kilometraje Final  -> kmFin
 *   F Km x Día           -> kmDia            (calculado = kmFin - kmInicio)
 *   G Ingresos Pasajes   -> ingresos.pasajes
 *   I Cliente 1 (Rojas)  -> ingresos.cliente1
 *   J Cliente 2 (Sofi)   -> ingresos.cliente2
 *   K Total Ingresos     -> totalIngresos    (calculado = pasajes + cliente1 + cliente2)
 *   L Combustible        -> combustible
 *   M Galones            -> galones          (cantidad, NO se suma a egresos)
 *   N Peajes             -> peajes
 *   O Lavadas            -> lavadas
 *   P Indrive            -> indrive
 *   Q Otros Egresos      -> otros
 *   R Total Egresos      -> totalEgresos     (calculado = L + N + O + P + Q)
 *   S Pagos Conductor    -> pagoConductor
 *   T Saldo Final        -> utilidadNeta     (calculado = totalIngresos - totalEgresos)
 *   U Observaciones      -> observaciones
 */
const registroDiarioSchema = new mongoose.Schema({
  fecha: {
    type: Date,
    required: true
  },
  vehiculo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  placa: {
    type: String,
    required: true
  },
  conductor: {
    type: String,
    required: true
  },

  // ── Ingresos ────────────────────────────────────────────────
  ingresos: {
    tipo: {
      type: String,
      enum: ['Empresarial', 'Ejecutivo', 'Aeropuerto', 'Turismo', 'Otro'],
      default: 'Empresarial'
    },
    // G — Ingresos por pasajes / carreras del día
    pasajes: {
      type: Number,
      default: 0,
      min: 0
    },
    // I — Cliente 1 (Familia Rojas)
    cliente1: {
      type: Number,
      default: 0,
      min: 0
    },
    // J — Cliente 2 (Sofi)
    cliente2: {
      type: Number,
      default: 0,
      min: 0
    },
    // Compat: 'valor' se mantiene como espejo del total de ingresos
    // para no romper registros/consumidores anteriores.
    valor: {
      type: Number,
      default: 0,
      min: 0
    },
    descripcion: String,
    numViajes: {
      type: Number,
      default: 1
    }
  },

  // Ingresos por cliente (modelo flexible que reemplaza a cliente1/cliente2).
  // Cada entrada referencia opcionalmente un Cliente y guarda su nombre
  // desnormalizado para reportes rápidos.
  ingresosPorCliente: [{
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
    nombre: String,
    valor: { type: Number, default: 0, min: 0 },
    // Si este ingreso se cubrió con un anticipo del cliente.
    desdeAnticipo: { type: Boolean, default: false }
  }],

  // ── Egresos ─────────────────────────────────────────────────
  combustible: { type: Number, default: 0 },   // L
  galones: { type: Number, default: 0 },        // M (cantidad, no dinero)
  peajes: { type: Number, default: 0 },         // N
  lavadas: { type: Number, default: 0 },        // O
  indrive: { type: Number, default: 0 },        // P
  otros: { type: Number, default: 0 },          // Q
  otrosDescripcion: String,

  // ── Kilometraje ─────────────────────────────────────────────
  kmInicio: { type: Number, default: 0 },       // D
  kmFin: { type: Number, default: 0 },          // E
  kmDia: { type: Number, default: 0 },          // F (calculado)

  // ── Pago al conductor ───────────────────────────────────────
  // S — Pago puntual registrado en el día (ej. liquidación de quincena).
  pagoConductor: { type: Number, default: 0 },

  // ── Calculados ──────────────────────────────────────────────
  totalIngresos: { type: Number, default: 0 },  // K
  totalEgresos: { type: Number, default: 0 },   // R
  utilidadNeta: { type: Number, default: 0 },   // T (Saldo Final)

  observaciones: String
}, { timestamps: true });

// La lógica de cálculo vive en utils/contabilidad.js (única fuente de verdad).
registroDiarioSchema.statics.recalcular = aplicarTotales;

registroDiarioSchema.pre('save', function(next) {
  aplicarTotales(this);
  next();
});

// Índice para acelerar el dashboard, filtros y reportes por vehículo y fecha.
registroDiarioSchema.index({ vehiculo: 1, fecha: -1 });

module.exports = mongoose.model('RegistroDiario', registroDiarioSchema);

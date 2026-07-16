const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  periodo: {
    tipo: {
      type: String,
      enum: ['semanal', 'quincenal', 'mensual'],
      default: 'semanal'
    },
    fechaInicio: {
      type: Date,
      required: true
    },
    fechaFin: {
      type: Date,
      required: true
    }
  },
  vehiculo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  placa: String,
  conductor: String,
  // Resumen del período
  totalIngresos: {
    type: Number,
    default: 0
  },
  totalEgresos: {
    type: Number,
    default: 0
  },
  totalKm: {
    type: Number,
    default: 0
  },
  totalViajes: {
    type: Number,
    default: 0
  },
  // Liquidación
  porcentajeConductor: {
    type: Number,
    default: 30  // % al conductor
  },
  liquidacionConductor: {
    type: Number,
    default: 0
  },
  utilidadEmpresa: {
    type: Number,
    default: 0
  },
  // Estado
  estado: {
    type: String,
    enum: ['pendiente', 'pagado', 'parcial'],
    default: 'pendiente'
  },
  fechaPago: Date,
  metodoPago: {
    type: String,
    enum: ['efectivo', 'transferencia', 'nequi', 'daviplata', 'otro'],
    default: 'efectivo'
  },
  observaciones: String,
  // Referencia a registros incluidos
  registros: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistroDiario'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Pago', pagoSchema);

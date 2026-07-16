const mongoose = require('mongoose');

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
  // Ingresos
  ingresos: {
    tipo: {
      type: String,
      enum: ['Empresarial', 'Ejecutivo', 'Aeropuerto', 'Turismo', 'Otro'],
      default: 'Empresarial'
    },
    valor: {
      type: Number,
      required: true,
      min: 0
    },
    descripcion: String,
    numViajes: {
      type: Number,
      default: 1
    }
  },
  // Egresos
  combustible: {
    type: Number,
    default: 0
  },
  peajes: {
    type: Number,
    default: 0
  },
  otros: {
    type: Number,
    default: 0
  },
  otrosDescripcion: String,
  // Kilometraje
  kmInicio: {
    type: Number,
    default: 0
  },
  kmFin: {
    type: Number,
    default: 0
  },
  // Calculados
  totalEgresos: {
    type: Number,
    default: 0
  },
  utilidadNeta: {
    type: Number,
    default: 0
  },
  observaciones: String
}, { timestamps: true });

// Auto-calculate totals before saving
registroDiarioSchema.pre('save', function(next) {
  this.totalEgresos = (this.combustible || 0) + (this.peajes || 0) + (this.otros || 0);
  this.utilidadNeta = (this.ingresos?.valor || 0) - this.totalEgresos;
  next();
});

module.exports = mongoose.model('RegistroDiario', registroDiarioSchema);

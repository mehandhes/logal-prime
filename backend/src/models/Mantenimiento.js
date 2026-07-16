const mongoose = require('mongoose');

const mantenimientoSchema = new mongoose.Schema({
  vehiculo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  placa: String,
  tipo: {
    type: String,
    enum: ['Cambio aceite', 'Llantas', 'Frenos', 'Revisión técnica', 'Lavado', 'Reparación', 'Otro'],
    required: true
  },
  descripcion: String,
  fecha: {
    type: Date,
    required: true
  },
  costo: {
    type: Number,
    required: true,
    min: 0
  },
  kmAlMomento: Number,
  taller: String,
  estado: {
    type: String,
    enum: ['programado', 'en_proceso', 'completado'],
    default: 'programado'
  },
  observaciones: String
}, { timestamps: true });

module.exports = mongoose.model('Mantenimiento', mantenimientoSchema);

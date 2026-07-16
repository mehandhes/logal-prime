const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  placa: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  nombre: {
    type: String,
    required: true
  },
  marca: String,
  modelo: String,
  año: Number,
  conductor: {
    type: String,
    required: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  kmActual: {
    type: Number,
    default: 0
  },
  proximoMantenimientoKm: {
    type: Number,
    default: null
  },
  observaciones: String
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);

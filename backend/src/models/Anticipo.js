const mongoose = require('mongoose');

/**
 * Anticipo — dinero que un cliente consigna por adelantado.
 *
 * Es un PASIVO / saldo a favor del cliente, NO un ingreso del día
 * (ej. "Carlos Rojas consignó $150.000 de adelanto"). El ingreso se
 * reconoce cuando el servicio se presta y el anticipo se "aplica".
 */
const anticipoSchema = new mongoose.Schema({
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true
  },
  clienteNombre: String,
  fecha: { type: Date, required: true, default: Date.now },
  monto: { type: Number, required: true, min: 0 },
  // Parte del anticipo ya consumida al prestar servicios.
  montoAplicado: { type: Number, default: 0, min: 0 },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'transferencia', 'nequi', 'daviplata', 'consignacion', 'otro'],
    default: 'transferencia'
  },
  estado: {
    type: String,
    enum: ['disponible', 'parcial', 'aplicado'],
    default: 'disponible'
  },
  observaciones: String
}, { timestamps: true });

anticipoSchema.virtual('saldoDisponible').get(function () {
  return Math.max(0, (this.monto || 0) - (this.montoAplicado || 0));
});

anticipoSchema.index({ cliente: 1, fecha: -1 });

module.exports = mongoose.model('Anticipo', anticipoSchema);

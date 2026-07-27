const mongoose = require('mongoose');

/**
 * Cliente — entidad para modelar los clientes (antes columnas fijas
 * "Familia Rojas" y "Sofi"). Permite facturación por cliente, cartera
 * y control de anticipos sin tocar el código al agregar nuevos clientes.
 */
const clienteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['fijo', 'ocasional', 'empresa'],
    default: 'fijo'
  },
  contacto: {
    telefono: String,
    email: String
  },
  // Tarifa pactada (informativa, para referencia al registrar ingresos).
  tarifaDia: { type: Number, default: 0 },
  // Saldo a favor del cliente por anticipos aún no aplicados.
  saldoAnticipos: { type: Number, default: 0 },
  activo: { type: Boolean, default: true },
  notas: String
}, { timestamps: true });

clienteSchema.index({ nombre: 1 });

module.exports = mongoose.model('Cliente', clienteSchema);

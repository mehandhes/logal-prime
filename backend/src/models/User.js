const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Roles del sistema
 *
 *   admin     — Acceso total: dashboard, estadísticas, pagos y liquidación,
 *               mantenimiento, clientes, anticipos, vehículos y gestión de
 *               usuarios. Puede editar y borrar cualquier registro.
 *
 *   conductor — Acceso restringido a la operación diaria: solo puede crear
 *               registros de ingresos y egresos, ver los registros que él
 *               mismo capturó y corregirlos el mismo día. No ve utilidades
 *               consolidadas, liquidaciones ni ningún otro módulo.
 */
const ROLES = ['admin', 'conductor'];

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'El usuario debe tener al menos 3 caracteres.']
  },
  password: {
    type: String,
    required: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  // Rol del usuario. El default es 'admin' a propósito: el documento creado
  // antes de esta migración (el administrador original) no tiene el campo, y
  // Mongoose aplica el default al hidratarlo, conservando su acceso. Las
  // rutas de creación SIEMPRE exigen el rol de forma explícita.
  rol: {
    type: String,
    enum: {
      values: ROLES,
      message: 'Rol inválido. Debe ser "admin" o "conductor".'
    },
    default: 'admin'
  },
  activo: {
    type: Boolean,
    default: true
  },
  empresa: {
    type: String,
    default: 'LOGAL Prime'
  },
  ultimoAcceso: {
    type: Date,
    default: null
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Hash de la contraseña antes de guardar (solo si cambió).
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.esAdmin = function () {
  return this.rol === 'admin';
};

// Vista segura del usuario: nunca expone el hash de la contraseña.
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    _id: this._id,
    username: this.username,
    nombre: this.nombre,
    rol: this.rol,
    activo: this.activo,
    empresa: this.empresa,
    ultimoAcceso: this.ultimoAcceso,
    createdAt: this.createdAt
  };
};

const User = mongoose.model('User', userSchema);
User.ROLES = ROLES;

module.exports = User;

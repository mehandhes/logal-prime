const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { validarPassword, generarPasswordTemporal } = require('../utils/passwords');

// Todas las rutas de este módulo son exclusivas del administrador.
router.use(auth.soloAdmin);

/** Cuenta cuántos administradores activos quedarían excluyendo a `exceptoId`. */
async function otrosAdminsActivos(exceptoId) {
  return User.countDocuments({
    _id: { $ne: exceptoId },
    rol: 'admin',
    activo: { $ne: false }
  });
}

function errorDuplicado(err, res) {
  if (err && err.code === 11000) {
    res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });
    return true;
  }
  return false;
}

// GET /api/usuarios — listar todos los usuarios
router.get('/', async (req, res) => {
  try {
    const usuarios = await User.find().sort({ rol: 1, nombre: 1 });
    res.json({ usuarios: usuarios.map(u => u.toPublic()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/usuarios — crear un usuario (admin o conductor)
router.post('/', async (req, res) => {
  try {
    const { username, nombre, rol } = req.body;
    let { password } = req.body;

    if (!username || !nombre) {
      return res.status(400).json({ message: 'Usuario y nombre son obligatorios.' });
    }
    if (!User.ROLES.includes(rol)) {
      return res.status(400).json({ message: 'Debes indicar un rol válido: "admin" o "conductor".' });
    }

    // Si no se envía contraseña, se genera una temporal y se devuelve UNA
    // sola vez para que el admin se la entregue al conductor.
    let temporal = false;
    if (!password) {
      password = generarPasswordTemporal();
      temporal = true;
    } else {
      const problema = validarPassword(password);
      if (problema) return res.status(400).json({ message: problema });
    }

    const limpio = String(username).toLowerCase().trim();
    if (await User.exists({ username: limpio })) {
      return res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });
    }

    const usuario = new User({
      username: limpio,
      password,
      nombre: String(nombre).trim(),
      rol,
      activo: req.body.activo !== false,
      creadoPor: req.user.id
    });

    await usuario.save();

    res.status(201).json({
      usuario: usuario.toPublic(),
      passwordTemporal: temporal ? password : undefined,
      message: temporal
        ? 'Usuario creado. Guarda la contraseña temporal: no se vuelve a mostrar.'
        : 'Usuario creado.'
    });
  } catch (err) {
    if (errorDuplicado(err, res)) return;
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/usuarios/:id — editar nombre, rol o estado
router.put('/:id', async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const esYoMismo = String(usuario._id) === req.user.id;

    if (req.body.nombre !== undefined) usuario.nombre = String(req.body.nombre).trim();

    if (req.body.username !== undefined) {
      const limpio = String(req.body.username).toLowerCase().trim();
      if (limpio !== usuario.username && await User.exists({ username: limpio })) {
        return res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });
      }
      usuario.username = limpio;
    }

    if (req.body.rol !== undefined) {
      if (!User.ROLES.includes(req.body.rol)) {
        return res.status(400).json({ message: 'Rol inválido. Debe ser "admin" o "conductor".' });
      }
      if (esYoMismo && req.body.rol !== 'admin') {
        return res.status(400).json({ message: 'No puedes quitarte a ti mismo el rol de administrador.' });
      }
      // Nunca dejar el sistema sin un administrador activo.
      if (usuario.rol === 'admin' && req.body.rol !== 'admin') {
        if (await otrosAdminsActivos(usuario._id) === 0) {
          return res.status(400).json({ message: 'Debe quedar al menos un administrador activo.' });
        }
      }
      usuario.rol = req.body.rol;
    }

    if (req.body.activo !== undefined) {
      const activo = req.body.activo === true || req.body.activo === 'true';
      if (esYoMismo && !activo) {
        return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta.' });
      }
      if (!activo && usuario.rol === 'admin' && await otrosAdminsActivos(usuario._id) === 0) {
        return res.status(400).json({ message: 'Debe quedar al menos un administrador activo.' });
      }
      usuario.activo = activo;
    }

    await usuario.save();
    res.json({ usuario: usuario.toPublic(), message: 'Usuario actualizado.' });
  } catch (err) {
    if (errorDuplicado(err, res)) return;
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/usuarios/:id/password — el admin restablece la clave de alguien
router.put('/:id/password', async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado.' });

    let { password } = req.body;
    let temporal = false;

    if (!password) {
      password = generarPasswordTemporal();
      temporal = true;
    } else {
      const problema = validarPassword(password);
      if (problema) return res.status(400).json({ message: problema });
    }

    usuario.password = password;
    await usuario.save();

    res.json({
      message: `Contraseña de ${usuario.nombre} actualizada.`,
      passwordTemporal: temporal ? password : undefined
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/usuarios/:id — eliminar un usuario
router.delete('/:id', async (req, res) => {
  try {
    if (String(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });
    }

    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado.' });

    if (usuario.rol === 'admin' && await otrosAdminsActivos(usuario._id) === 0) {
      return res.status(400).json({ message: 'Debe quedar al menos un administrador activo.' });
    }

    await usuario.deleteOne();
    res.json({ message: 'Usuario eliminado.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

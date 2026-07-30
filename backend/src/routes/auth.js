const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validarPassword } = require('../utils/passwords');

const JWT_SECRET = process.env.JWT_SECRET || 'logal_prime_secret_2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function firmarToken(user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
    }

    const user = await User.findOne({ username: String(username).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Una cuenta desactivada no puede iniciar sesión, aunque la contraseña
    // sea correcta.
    if (user.activo === false) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacta al administrador.' });
    }

    user.ultimoAcceso = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      token: firmarToken(user),
      user: user.toPublic()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// POST /api/auth/setup — crear el primer administrador (solo si no hay usuarios)
router.post('/setup', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      return res.status(400).json({ message: 'Ya existe un usuario administrador.' });
    }

    const { username, password, nombre } = req.body;
    if (!username || !password || !nombre) {
      return res.status(400).json({ message: 'Username, password y nombre son requeridos.' });
    }

    const problema = validarPassword(password);
    if (problema) return res.status(400).json({ message: problema });

    const user = new User({
      username: String(username).toLowerCase().trim(),
      password,
      nombre,
      rol: 'admin',
      activo: true,
      empresa: 'LOGAL Prime'
    });

    await user.save();

    res.status(201).json({ message: 'Usuario administrador creado exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// GET /api/auth/me — verificar el token y devolver el perfil (con rol)
router.get('/me', auth, async (req, res) => {
  try {
    res.json(req.usuarioDoc.toPublic());
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// POST /api/auth/cambiar-password — cualquier usuario cambia SU propia clave
router.post('/cambiar-password', auth, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ message: 'Debes enviar la contraseña actual y la nueva.' });
    }

    const problema = validarPassword(passwordNueva);
    if (problema) return res.status(400).json({ message: problema });

    // Se recarga con el hash porque req.usuarioDoc viene sin contraseña.
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const isMatch = await user.comparePassword(passwordActual);
    if (!isMatch) {
      return res.status(401).json({ message: 'La contraseña actual no es correcta.' });
    }

    user.password = passwordNueva;
    await user.save();

    // Se emite un token nuevo para que la sesión actual siga viva.
    res.json({ message: 'Contraseña actualizada.', token: firmarToken(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'logal_prime_secret_2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        nombre: user.nombre,
        empresa: user.empresa
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// POST /api/auth/setup - crear usuario inicial (solo si no existe ninguno)
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

    const user = new User({
      username: username.toLowerCase(),
      password,
      nombre,
      empresa: 'LOGAL Prime'
    });

    await user.save();

    res.status(201).json({ message: 'Usuario administrador creado exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// GET /api/auth/me - verificar token
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'logal_prime_secret_2024';

/**
 * Middleware de autenticación.
 *
 * Verifica el JWT y — a diferencia de la versión anterior — vuelve a cargar
 * el usuario desde la base de datos en cada petición. Esto es intencional:
 *
 *   1. El rol viaja en el token, pero el token dura 7 días. Si el admin
 *      cambia el rol de alguien o lo desactiva, el cambio debe aplicar de
 *      inmediato, no cuando expire su sesión.
 *   2. Los tokens emitidos antes de esta actualización no traen `rol`.
 *      Leyéndolo de la BD siguen funcionando sin obligar a nadie a
 *      volver a iniciar sesión.
 *
 * Deja en `req.user` un objeto plano y en `req.usuarioDoc` el documento
 * completo de Mongoose por si la ruta lo necesita.
 */
async function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Token requerido.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }

  try {
    const usuario = await User.findById(decoded.id).select('-password');

    if (!usuario) {
      return res.status(401).json({ message: 'La cuenta ya no existe.' });
    }
    if (usuario.activo === false) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacta al administrador.' });
    }

    req.usuarioDoc = usuario;
    req.user = {
      id: String(usuario._id),
      username: usuario.username,
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: usuario.activo
    };
    next();
  } catch (err) {
    console.error('Error verificando usuario:', err.message);
    res.status(500).json({ message: 'Error del servidor al verificar la sesión.' });
  }
}

/**
 * Exige que el usuario autenticado tenga alguno de los roles indicados.
 * Se usa siempre encadenado después de `auth`.
 */
function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Acceso denegado. Token requerido.' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        message: 'No tienes permisos para realizar esta acción.',
        rolRequerido: roles.join(' o '),
        tuRol: req.user.rol
      });
    }
    next();
  };
}

// Atajos listos para usar en las rutas: router.get('/', auth.soloAdmin, ...)
auth.exigirRol = exigirRol;
auth.soloAdmin = [auth, exigirRol('admin')];
auth.requiereRol = (...roles) => [auth, exigirRol(...roles)];

module.exports = auth;

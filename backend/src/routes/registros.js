const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RegistroDiario = require('../models/RegistroDiario');
const Vehicle = require('../models/Vehicle');
const { validarRegistro } = require('../utils/contabilidad');
const {
  esAdmin: usuarioEsAdmin,
  puedeEditarRegistro,
  fechaPermitida: validarFecha,
  sanearEntradaRegistro,
  vistaRegistroSegunRol
} = require('../utils/permisos');

// Adaptadores finos sobre utils/permisos.js (la fuente de verdad).
const esAdmin = (req) => usuarioEsAdmin(req.user);
const puedeEditar = (req, registro) => puedeEditarRegistro(req.user, registro);
const fechaPermitida = (req, fecha) => validarFecha(req.user, fecha);
const sanearEntrada = (req) => sanearEntradaRegistro(req.user, req.body);
const vistaSegunRol = (req, registro) => vistaRegistroSegunRol(req.user, registro);

// Busca el registro anterior del mismo vehículo (para validar el odómetro).
async function registroAnterior(vehiculoId, fecha) {
  if (!vehiculoId) return null;
  return RegistroDiario.findOne({
    vehiculo: vehiculoId,
    fecha: { $lt: new Date(fecha) }
  }).sort({ fecha: -1 });
}

// GET /api/registros/ultimo?vehiculo= — último registro, para precargar el odómetro
router.get('/ultimo', auth, async (req, res) => {
  try {
    if (!req.query.vehiculo) return res.json({ registro: null });
    const registro = await RegistroDiario.findOne({ vehiculo: req.query.vehiculo }).sort({ fecha: -1 });
    // Solo se devuelve el odómetro: es lo único que el formulario necesita
    // precargar y así el conductor no ve las cifras del día de otro turno.
    if (registro && !esAdmin(req)) {
      return res.json({
        registro: {
          _id: registro._id,
          fecha: registro.fecha,
          kmFin: registro.kmFin,
          kmInicio: registro.kmInicio,
          vehiculo: registro.vehiculo
        }
      });
    }
    res.json({ registro });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registros?vehiculo=&desde=&hasta=&limit=&page=
// El admin ve todo; el conductor solo su propio historial.
router.get('/', auth, async (req, res) => {
  try {
    const { vehiculo, desde, hasta, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (!esAdmin(req)) filter.creadoPor = req.user.id;

    if (vehiculo) filter.vehiculo = vehiculo;
    if (desde || hasta) {
      filter.fecha = {};
      if (desde) filter.fecha.$gte = new Date(desde);
      if (hasta) filter.fecha.$lte = new Date(hasta + 'T23:59:59');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await RegistroDiario.countDocuments(filter);
    const registros = await RegistroDiario.find(filter)
      .populate('vehiculo', 'placa nombre conductor')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      registros: registros.map(r => vistaSegunRol(req, r)),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registros/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const registro = await RegistroDiario.findById(req.params.id)
      .populate('vehiculo', 'placa nombre conductor');
    if (!registro) return res.status(404).json({ message: 'Registro no encontrado.' });

    if (!esAdmin(req) && String(registro.creadoPor || '') !== req.user.id) {
      return res.status(403).json({ message: 'Solo puedes ver los registros que tú capturaste.' });
    }

    res.json(vistaSegunRol(req, registro));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registros — admin y conductor
router.post('/', auth, async (req, res) => {
  try {
    const datos = sanearEntrada(req);

    const problemaFecha = fechaPermitida(req, datos.fecha);
    if (problemaFecha) return res.status(403).json({ message: problemaFecha });

    const registro = new RegistroDiario({
      ...datos,
      creadoPor: req.user.id,
      modificadoPor: req.user.id
    });
    await registro.save();

    if (datos.kmFin && datos.vehiculo) {
      await Vehicle.findByIdAndUpdate(datos.vehiculo, { kmActual: datos.kmFin });
    }

    // Advertencias de captura (no bloquean; informan al usuario).
    const prev = await registroAnterior(datos.vehiculo, datos.fecha);
    const advertencias = validarRegistro(datos, prev);

    res.status(201).json({ registro: vistaSegunRol(req, registro), advertencias });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/registros/importar — carga masiva (solo admin)
// Espera { registros: [ {fecha, vehiculo, placa, conductor, ingresos, ...}, ... ] }
router.post('/importar', auth.soloAdmin, async (req, res) => {
  try {
    const filas = Array.isArray(req.body.registros) ? req.body.registros : [];
    if (filas.length === 0) return res.status(400).json({ message: 'No se recibieron filas para importar.' });

    const resultados = { insertados: 0, errores: [] };
    for (let i = 0; i < filas.length; i++) {
      try {
        const doc = new RegistroDiario({
          ...filas[i],
          creadoPor: req.user.id,
          modificadoPor: req.user.id
        });
        await doc.save();
        resultados.insertados++;
      } catch (e) {
        resultados.errores.push({ fila: i + 1, mensaje: e.message });
      }
    }

    // Actualiza el km del vehículo con el mayor kmFin importado.
    const vehiculoId = filas[0].vehiculo;
    const maxKm = Math.max(...filas.map(f => Number(f.kmFin) || 0), 0);
    if (vehiculoId && maxKm > 0) {
      await Vehicle.findByIdAndUpdate(vehiculoId, { kmActual: maxKm });
    }

    res.status(201).json(resultados);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/registros/:id — admin siempre; conductor solo lo suyo y en caliente
router.put('/:id', auth, async (req, res) => {
  try {
    const registro = await RegistroDiario.findById(req.params.id);
    if (!registro) return res.status(404).json({ message: 'Registro no encontrado.' });

    const permiso = puedeEditar(req, registro);
    if (!permiso.ok) return res.status(403).json({ message: permiso.message });

    const datos = sanearEntrada(req);

    if (datos.fecha !== undefined) {
      const problemaFecha = fechaPermitida(req, datos.fecha);
      if (problemaFecha) return res.status(403).json({ message: problemaFecha });
    }

    // Asignar solo campos editables; los derivados (totalIngresos,
    // totalEgresos, kmDia, utilidadNeta) los recalcula el hook pre-save.
    const campos = [
      'fecha', 'vehiculo', 'placa', 'conductor',
      'combustible', 'galones', 'peajes', 'lavadas', 'indrive', 'otros', 'otrosDescripcion',
      'kmInicio', 'kmFin', 'pagoConductor', 'observaciones'
    ];
    campos.forEach((c) => {
      if (datos[c] !== undefined) registro[c] = datos[c];
    });
    if (datos.ingresos) {
      const actual = registro.ingresos?.toObject ? registro.ingresos.toObject() : (registro.ingresos || {});
      registro.ingresos = { ...actual, ...datos.ingresos };
    }
    if (datos.ingresosPorCliente !== undefined) {
      registro.ingresosPorCliente = datos.ingresosPorCliente;
    }

    registro.modificadoPor = req.user.id;
    await registro.save(); // ejecuta recalcular()

    if (datos.kmFin && registro.vehiculo) {
      await Vehicle.findByIdAndUpdate(registro.vehiculo, { kmActual: datos.kmFin });
    }

    res.json(vistaSegunRol(req, registro));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/registros/:id — solo admin
router.delete('/:id', auth.soloAdmin, async (req, res) => {
  try {
    const registro = await RegistroDiario.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ message: 'Registro no encontrado.' });
    res.json({ message: 'Registro eliminado.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

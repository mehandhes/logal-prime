const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RegistroDiario = require('../models/RegistroDiario');
const Vehicle = require('../models/Vehicle');
const { validarRegistro } = require('../utils/contabilidad');

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
    res.json({ registro });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registros?vehiculo=&desde=&hasta=&limit=&page=
router.get('/', auth, async (req, res) => {
  try {
    const { vehiculo, desde, hasta, limit = 50, page = 1 } = req.query;
    const filter = {};

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
      registros,
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
    res.json(registro);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registros
router.post('/', auth, async (req, res) => {
  try {
    const registro = new RegistroDiario(req.body);
    await registro.save();

    // Update vehicle km if provided
    if (req.body.kmFin && req.body.vehiculo) {
      await Vehicle.findByIdAndUpdate(req.body.vehiculo, {
        kmActual: req.body.kmFin
      });
    }

    // Advertencias de captura (no bloquean; informan al usuario).
    const prev = await registroAnterior(req.body.vehiculo, req.body.fecha);
    const advertencias = validarRegistro(req.body, prev);

    res.status(201).json({ registro, advertencias });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/registros/importar — carga masiva (ej. importar quincena desde Excel)
// Espera { registros: [ {fecha, vehiculo, placa, conductor, ingresos, ...}, ... ] }
router.post('/importar', auth, async (req, res) => {
  try {
    const filas = Array.isArray(req.body.registros) ? req.body.registros : [];
    if (filas.length === 0) return res.status(400).json({ message: 'No se recibieron filas para importar.' });

    const resultados = { insertados: 0, errores: [] };
    for (let i = 0; i < filas.length; i++) {
      try {
        const doc = new RegistroDiario(filas[i]);
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

// PUT /api/registros/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const registro = await RegistroDiario.findById(req.params.id);
    if (!registro) return res.status(404).json({ message: 'Registro no encontrado.' });

    // Asignar solo campos editables; los derivados (totalIngresos,
    // totalEgresos, kmDia, utilidadNeta) los recalcula el hook pre-save.
    const campos = [
      'fecha', 'vehiculo', 'placa', 'conductor',
      'combustible', 'galones', 'peajes', 'lavadas', 'indrive', 'otros', 'otrosDescripcion',
      'kmInicio', 'kmFin', 'pagoConductor', 'observaciones'
    ];
    campos.forEach((c) => {
      if (req.body[c] !== undefined) registro[c] = req.body[c];
    });
    if (req.body.ingresos) {
      const actual = registro.ingresos?.toObject ? registro.ingresos.toObject() : (registro.ingresos || {});
      registro.ingresos = { ...actual, ...req.body.ingresos };
    }

    await registro.save(); // ejecuta recalcular()

    if (req.body.kmFin && registro.vehiculo) {
      await Vehicle.findByIdAndUpdate(registro.vehiculo, { kmActual: req.body.kmFin });
    }

    res.json(registro);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/registros/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const registro = await RegistroDiario.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ message: 'Registro no encontrado.' });
    res.json({ message: 'Registro eliminado.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RegistroDiario = require('../models/RegistroDiario');
const Vehicle = require('../models/Vehicle');

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

    res.status(201).json(registro);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/registros/:id
router.put('/:id', auth, async (req, res) => {
  try {
    // Recalculate totals
    const totalEgresos = (req.body.combustible || 0) + (req.body.peajes || 0) + (req.body.otros || 0);
    const utilidadNeta = (req.body.ingresos?.valor || 0) - totalEgresos;

    const registro = await RegistroDiario.findByIdAndUpdate(
      req.params.id,
      { ...req.body, totalEgresos, utilidadNeta },
      { new: true, runValidators: true }
    );
    if (!registro) return res.status(404).json({ message: 'Registro no encontrado.' });
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

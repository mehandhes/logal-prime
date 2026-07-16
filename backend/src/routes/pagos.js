const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Pago = require('../models/Pago');
const RegistroDiario = require('../models/RegistroDiario');

// GET /api/pagos
router.get('/', auth, async (req, res) => {
  try {
    const { vehiculo, estado, limit = 20, page = 1 } = req.query;
    const filter = {};
    if (vehiculo) filter.vehiculo = vehiculo;
    if (estado) filter.estado = estado;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Pago.countDocuments(filter);
    const pagos = await Pago.find(filter)
      .populate('vehiculo', 'placa nombre conductor')
      .sort({ 'periodo.fechaFin': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ pagos, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/pagos/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const pago = await Pago.findById(req.params.id)
      .populate('vehiculo')
      .populate('registros');
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado.' });
    res.json(pago);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/pagos/generar - genera liquidación automática desde registros
router.post('/generar', auth, async (req, res) => {
  try {
    const { vehiculoId, fechaInicio, fechaFin, tipo = 'semanal', porcentajeConductor = 30 } = req.body;

    // Obtener registros del período
    const registros = await RegistroDiario.find({
      vehiculo: vehiculoId,
      fecha: {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin + 'T23:59:59')
      }
    });

    if (registros.length === 0) {
      return res.status(400).json({ message: 'No hay registros para este período.' });
    }

    const totalIngresos = registros.reduce((s, r) => s + (r.ingresos?.valor || 0), 0);
    const totalEgresos = registros.reduce((s, r) => s + (r.totalEgresos || 0), 0);
    const totalKm = registros.reduce((s, r) => s + ((r.kmFin || 0) - (r.kmInicio || 0)), 0);
    const totalViajes = registros.reduce((s, r) => s + (r.ingresos?.numViajes || 1), 0);
    const utilidadNeta = totalIngresos - totalEgresos;
    const liquidacionConductor = (utilidadNeta * porcentajeConductor) / 100;
    const utilidadEmpresa = utilidadNeta - liquidacionConductor;

    // Get vehicle info from first registro
    const primerRegistro = registros[0];

    const pago = new Pago({
      periodo: { tipo, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin) },
      vehiculo: vehiculoId,
      placa: primerRegistro.placa,
      conductor: primerRegistro.conductor,
      totalIngresos,
      totalEgresos,
      totalKm,
      totalViajes,
      porcentajeConductor,
      liquidacionConductor,
      utilidadEmpresa,
      registros: registros.map(r => r._id)
    });

    await pago.save();
    res.status(201).json(pago);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/pagos
router.post('/', auth, async (req, res) => {
  try {
    const pago = new Pago(req.body);
    await pago.save();
    res.status(201).json(pago);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/pagos/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const pago = await Pago.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado.' });
    res.json(pago);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/pagos/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const pago = await Pago.findByIdAndDelete(req.params.id);
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado.' });
    res.json({ message: 'Liquidación eliminada.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

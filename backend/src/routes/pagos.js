const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Pago = require('../models/Pago');
const RegistroDiario = require('../models/RegistroDiario');
const { liquidarPeriodo } = require('../utils/contabilidad');

// Trae los registros de un período y calcula la liquidación (sin guardar).
async function calcularLiquidacion({ vehiculoId, fechaInicio, fechaFin, tipoLiquidacion, montoConductor, porcentajeConductor }) {
  const registros = await RegistroDiario.find({
    vehiculo: vehiculoId,
    fecha: { $gte: new Date(fechaInicio), $lte: new Date(fechaFin + 'T23:59:59') }
  }).sort({ fecha: 1 });

  const liq = liquidarPeriodo(registros, {
    modo: tipoLiquidacion || 'registros',
    montoConductor,
    porcentajeConductor
  });
  return { registros, liq };
}

// GET /api/pagos
router.get('/', auth.soloAdmin, async (req, res) => {
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
router.get('/:id', auth.soloAdmin, async (req, res) => {
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

// POST /api/pagos/previsualizar - calcula la liquidación SIN guardar (paso 2 del asistente)
router.post('/previsualizar', auth.soloAdmin, async (req, res) => {
  try {
    const { registros, liq } = await calcularLiquidacion(req.body);
    if (registros.length === 0) return res.status(400).json({ message: 'No hay registros para este período.' });
    res.json({
      numRegistros: registros.length,
      totalIngresos: liq.totalIngresos,
      totalEgresos: liq.totalEgresos,
      totalKm: liq.totalKm,
      totalViajes: liq.totalViajes,
      galones: liq.galones,
      rendimientoKmGalon: Math.round(liq.rendimientoKmGalon * 100) / 100,
      utilidadOperativa: liq.utilidadOperativa,
      sueldoConductor: liq.sueldoConductor,
      netoEmpresa: liq.netoEmpresa
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/pagos/generar - genera y GUARDA la liquidación desde los registros
router.post('/generar', auth.soloAdmin, async (req, res) => {
  try {
    const {
      vehiculoId, fechaInicio, fechaFin, tipo = 'quincenal',
      // tipoLiquidacion: 'registros' (suma de pagoConductor de la hoja, col. S),
      // 'fijo' (monto pactado) o 'porcentaje' (% de la utilidad).
      tipoLiquidacion = 'registros',
      porcentajeConductor = 30
    } = req.body;

    const { registros, liq } = await calcularLiquidacion(req.body);
    if (registros.length === 0) {
      return res.status(400).json({ message: 'No hay registros para este período.' });
    }

    const primerRegistro = registros[0];
    const pago = new Pago({
      periodo: { tipo, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin) },
      vehiculo: vehiculoId,
      placa: primerRegistro.placa,
      conductor: primerRegistro.conductor,
      totalIngresos: liq.totalIngresos,
      totalEgresos: liq.totalEgresos,
      totalKm: liq.totalKm,
      totalViajes: liq.totalViajes,
      tipoLiquidacion,
      porcentajeConductor,
      liquidacionConductor: liq.sueldoConductor,
      utilidadEmpresa: liq.netoEmpresa,
      registros: registros.map(r => r._id)
    });

    await pago.save();
    res.status(201).json(pago);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/pagos
router.post('/', auth.soloAdmin, async (req, res) => {
  try {
    const pago = new Pago(req.body);
    await pago.save();
    res.status(201).json(pago);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/pagos/:id
router.put('/:id', auth.soloAdmin, async (req, res) => {
  try {
    const pago = await Pago.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado.' });
    res.json(pago);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/pagos/:id
router.delete('/:id', auth.soloAdmin, async (req, res) => {
  try {
    const pago = await Pago.findByIdAndDelete(req.params.id);
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado.' });
    res.json({ message: 'Liquidación eliminada.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

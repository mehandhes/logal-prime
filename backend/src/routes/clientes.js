const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cliente = require('../models/Cliente');
const Anticipo = require('../models/Anticipo');
const RegistroDiario = require('../models/RegistroDiario');

// GET /api/clientes?activo=true
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.activo !== undefined) filter.activo = req.query.activo === 'true';
    const clientes = await Cliente.find(filter).sort({ nombre: 1 });
    res.json({ clientes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/clientes/:id/resumen — ingresos históricos + anticipos
router.get('/:id/resumen', auth.soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado.' });

    const registros = await RegistroDiario.find({ 'ingresosPorCliente.cliente': cliente._id });
    const totalFacturado = registros.reduce((s, r) => {
      const items = (r.ingresosPorCliente || []).filter(i => String(i.cliente) === String(cliente._id));
      return s + items.reduce((a, i) => a + (i.valor || 0), 0);
    }, 0);

    const anticipos = await Anticipo.find({ cliente: cliente._id }).sort({ fecha: -1 });
    const saldoAnticipos = anticipos.reduce((s, a) => s + Math.max(0, (a.monto || 0) - (a.montoAplicado || 0)), 0);

    res.json({
      cliente,
      totalFacturado,
      numServicios: registros.length,
      saldoAnticipos,
      anticipos
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/clientes
router.post('/', auth.soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.create(req.body);
    res.status(201).json(cliente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/clientes/:id
router.put('/:id', auth.soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado.' });
    res.json(cliente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/clientes/:id  (baja lógica)
router.delete('/:id', auth.soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, { activo: false }, { new: true });
    if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado.' });
    res.json({ message: 'Cliente desactivado.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

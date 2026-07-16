const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Mantenimiento = require('../models/Mantenimiento');

// GET /api/mantenimiento
router.get('/', auth, async (req, res) => {
  try {
    const { vehiculo, estado } = req.query;
    const filter = {};
    if (vehiculo) filter.vehiculo = vehiculo;
    if (estado) filter.estado = estado;

    const items = await Mantenimiento.find(filter)
      .populate('vehiculo', 'placa nombre conductor')
      .sort({ fecha: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/mantenimiento
router.post('/', auth, async (req, res) => {
  try {
    const item = new Mantenimiento(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/mantenimiento/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Mantenimiento.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Registro no encontrado.' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/mantenimiento/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Mantenimiento.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Registro no encontrado.' });
    res.json({ message: 'Eliminado.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

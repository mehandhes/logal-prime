const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Anticipo = require('../models/Anticipo');
const Cliente = require('../models/Cliente');

// Recalcula el saldo de anticipos de un cliente a partir de sus anticipos.
async function refrescarSaldoCliente(clienteId) {
  const anticipos = await Anticipo.find({ cliente: clienteId });
  const saldo = anticipos.reduce((s, a) => s + Math.max(0, (a.monto || 0) - (a.montoAplicado || 0)), 0);
  await Cliente.findByIdAndUpdate(clienteId, { saldoAnticipos: saldo });
  return saldo;
}

// GET /api/anticipos?cliente=
router.get('/', auth.soloAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cliente) filter.cliente = req.query.cliente;
    const anticipos = await Anticipo.find(filter).populate('cliente', 'nombre').sort({ fecha: -1 });
    res.json({ anticipos });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/anticipos — registra un adelanto (pasivo, NO ingreso del día)
router.post('/', auth.soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.body.cliente);
    if (!cliente) return res.status(400).json({ message: 'Cliente inválido.' });

    const anticipo = await Anticipo.create({
      ...req.body,
      clienteNombre: cliente.nombre,
      estado: 'disponible'
    });
    await refrescarSaldoCliente(cliente._id);
    res.status(201).json(anticipo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/anticipos/:id/aplicar — consume parte del anticipo contra un servicio
router.post('/:id/aplicar', auth.soloAdmin, async (req, res) => {
  try {
    const monto = Number(req.body.monto) || 0;
    const anticipo = await Anticipo.findById(req.params.id);
    if (!anticipo) return res.status(404).json({ message: 'Anticipo no encontrado.' });

    const saldo = (anticipo.monto || 0) - (anticipo.montoAplicado || 0);
    if (monto <= 0 || monto > saldo) {
      return res.status(400).json({ message: `Monto inválido. Saldo disponible: ${saldo}.` });
    }

    anticipo.montoAplicado += monto;
    anticipo.estado = anticipo.montoAplicado >= anticipo.monto ? 'aplicado' : 'parcial';
    await anticipo.save();
    await refrescarSaldoCliente(anticipo.cliente);

    res.json(anticipo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/anticipos/:id
router.delete('/:id', auth.soloAdmin, async (req, res) => {
  try {
    const anticipo = await Anticipo.findByIdAndDelete(req.params.id);
    if (!anticipo) return res.status(404).json({ message: 'Anticipo no encontrado.' });
    await refrescarSaldoCliente(anticipo.cliente);
    res.json({ message: 'Anticipo eliminado.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

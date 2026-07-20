require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware básico
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Health check (no requiere DB)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LOGAL Prime API running' });
});

// MongoDB - conexión con caché para serverless
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logal-prime';
let cachedConnection = null;

async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) return cachedConnection;
  cachedConnection = await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  });
  console.log('✅ MongoDB conectado');
  return cachedConnection;
}

// Middleware DB (ANTES de las rutas)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ Error MongoDB:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// Routes (DESPUÉS del middleware DB)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/registros', require('./routes/registros'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/mantenimiento', require('./routes/mantenimiento'));
app.use('/api/stats', require('./routes/stats'));

// Arranque local
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
  });
}

module.exports = app;
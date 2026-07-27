const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RegistroDiario = require('../models/RegistroDiario');
const Mantenimiento = require('../models/Mantenimiento');

// GET /api/stats/dashboard?vehiculo=&desde=&hasta=
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { vehiculo, desde, hasta } = req.query;
    const filter = {};
    if (vehiculo) filter.vehiculo = vehiculo;

    // Default: current week (Mon-Sun)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    filter.fecha = {
      $gte: desde ? new Date(desde) : weekStart,
      $lte: hasta ? new Date(hasta + 'T23:59:59') : weekEnd
    };

    const registros = await RegistroDiario.find(filter);

    // Total de ingresos del registro (K); compat con registros antiguos.
    const ingresoDe = (r) => (r.totalIngresos ?? r.ingresos?.valor ?? 0) || 0;

    const totalIngresos = registros.reduce((s, r) => s + ingresoDe(r), 0);
    const totalEgresos = registros.reduce((s, r) => s + (r.totalEgresos || 0), 0);
    const totalKm = registros.reduce((s, r) => s + ((r.kmFin || 0) - (r.kmInicio || 0)), 0);
    const totalViajes = registros.reduce((s, r) => s + (r.ingresos?.numViajes || 1), 0);
    // Dos niveles de resultado:
    //  - utilidadOperativa: ingresos - egresos (resultado de la operación)
    //  - netoEmpresa: utilidadOperativa - sueldo del conductor (lo que queda al dueño)
    const utilidadNeta = totalIngresos - totalEgresos;   // = utilidad operativa
    const pagosConductorTotal = registros.reduce((s, r) => s + (r.pagoConductor || 0), 0);
    const netoEmpresa = utilidadNeta - pagosConductorTotal;
    const margenPct = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;
    const costoKm = totalKm > 0 ? totalEgresos / totalKm : 0;
    const ingresoKm = totalKm > 0 ? totalIngresos / totalKm : 0;

    // KPIs de flota: rendimiento (km/galón) y costo por km real.
    const galonesPeriodo = registros.reduce((s, r) => s + (r.galones || 0), 0);
    const rendimientoKmGalon = galonesPeriodo > 0 ? totalKm / galonesPeriodo : 0;

    // Ingresos por cliente (nuevo modelo ingresosPorCliente).
    const ingresosPorClienteMap = {};
    registros.forEach(r => (r.ingresosPorCliente || []).forEach(i => {
      const key = i.nombre || 'Sin nombre';
      ingresosPorClienteMap[key] = (ingresosPorClienteMap[key] || 0) + (i.valor || 0);
    }));
    const ingresosPorCliente = Object.entries(ingresosPorClienteMap)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor);

    // Projection based on avg daily
    const diasConRegistros = new Set(registros.map(r => r.fecha.toISOString().split('T')[0])).size;
    const avgDiario = diasConRegistros > 0 ? totalIngresos / diasConRegistros : 0;
    const proyeccionSemanal = avgDiario * 7;

    // Egresos breakdown (alineado con columnas L, N, O, P, Q de la hoja)
    const combustibleTotal = registros.reduce((s, r) => s + (r.combustible || 0), 0);
    const peajesTotal = registros.reduce((s, r) => s + (r.peajes || 0), 0);
    const lavadasTotal = registros.reduce((s, r) => s + (r.lavadas || 0), 0);
    const indriveTotal = registros.reduce((s, r) => s + (r.indrive || 0), 0);
    const otrosTotal = registros.reduce((s, r) => s + (r.otros || 0), 0);
    const galonesTotal = galonesPeriodo;

    // Daily data for chart (last 7 days of the period)
    const dailyData = [];
    const startDate = filter.fecha.$gte;
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      const dayStr = day.toISOString().split('T')[0];
      const dayRegistros = registros.filter(r =>
        r.fecha.toISOString().split('T')[0] === dayStr
      );
      dailyData.push({
        fecha: dayStr,
        dia: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day.getDay()],
        ingresos: dayRegistros.reduce((s, r) => s + ingresoDe(r), 0),
        egresos: dayRegistros.reduce((s, r) => s + (r.totalEgresos || 0), 0),
        utilidad: dayRegistros.reduce((s, r) => s + (r.utilidadNeta || 0), 0)
      });
    }

    // Mantenimiento pendiente
    const mantenimientosPendientes = await Mantenimiento.find({
      ...(vehiculo ? { vehiculo } : {}),
      estado: { $in: ['programado', 'en_proceso'] }
    }).populate('vehiculo', 'placa').sort({ fecha: 1 }).limit(3);

    res.json({
      periodo: {
        desde: filter.fecha.$gte,
        hasta: filter.fecha.$lte
      },
      kpis: {
        totalIngresos,
        totalEgresos,
        utilidadNeta,                 // utilidad operativa (día/período)
        utilidadOperativa: utilidadNeta,
        pagosConductor: pagosConductorTotal,
        netoEmpresa,                  // después de pagar al conductor
        margenPct: Math.round(margenPct * 10) / 10,
        totalKm,
        totalViajes,
        costoKm: Math.round(costoKm),
        ingresoKm: Math.round(ingresoKm),
        proyeccionSemanal: Math.round(proyeccionSemanal),
        galonesTotal: Math.round(galonesTotal * 100) / 100,
        rendimientoKmGalon: Math.round(rendimientoKmGalon * 100) / 100
      },
      ingresosPorCliente,
      egresoBreakdown: [
        { label: 'Combustible', valor: combustibleTotal },
        { label: 'Peajes', valor: peajesTotal },
        { label: 'Lavadas', valor: lavadasTotal },
        { label: 'Indrive', valor: indriveTotal },
        { label: 'Otros', valor: otrosTotal }
      ].filter(b => b.valor > 0 || ['Combustible', 'Peajes'].includes(b.label)),
      dailyData,
      mantenimientosPendientes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stats/historico?vehiculo=&meses=6
router.get('/historico', auth, async (req, res) => {
  try {
    const { vehiculo, meses = 6 } = req.query;
    const filter = {};
    if (vehiculo) filter.vehiculo = vehiculo;

    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - parseInt(meses));
    fechaInicio.setDate(1);
    fechaInicio.setHours(0, 0, 0, 0);
    filter.fecha = { $gte: fechaInicio };

    const registros = await RegistroDiario.find(filter).sort({ fecha: 1 });

    // Group by month
    const monthly = {};
    registros.forEach(r => {
      const key = r.fecha.toISOString().substring(0, 7); // YYYY-MM
      if (!monthly[key]) {
        monthly[key] = { mes: key, ingresos: 0, egresos: 0, km: 0, viajes: 0 };
      }
      monthly[key].ingresos += (r.totalIngresos ?? r.ingresos?.valor ?? 0) || 0;
      monthly[key].egresos += r.totalEgresos || 0;
      monthly[key].km += (r.kmFin || 0) - (r.kmInicio || 0);
      monthly[key].viajes += r.ingresos?.numViajes || 1;
    });

    // Format month labels in Spanish
    const meses_es = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyData = Object.values(monthly).map(m => ({
      ...m,
      label: meses_es[parseInt(m.mes.split('-')[1]) - 1] + ' ' + m.mes.split('-')[0].slice(2),
      utilidad: m.ingresos - m.egresos,
      margenPct: m.ingresos > 0 ? Math.round(((m.ingresos - m.egresos) / m.ingresos) * 1000) / 10 : 0
    }));

    const avgMensual = monthlyData.length > 0
      ? monthlyData.reduce((s, m) => s + m.ingresos, 0) / monthlyData.length
      : 0;

    // Proyección: regresión lineal por mínimos cuadrados sobre el histórico,
    // suavizada con un promedio móvil de los últimos 3 meses. Capta tendencia
    // sin sobre-reaccionar a un mes atípico. Si hay <2 meses, usa el promedio.
    const n = monthlyData.length;
    let pendiente = 0, intercepto = avgMensual;
    if (n >= 2) {
      const xs = monthlyData.map((_, i) => i);
      const ys = monthlyData.map(m => m.ingresos);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sumXX = xs.reduce((a, x) => a + x * x, 0);
      const denom = (n * sumXX - sumX * sumX) || 1;
      pendiente = (n * sumXY - sumX * sumY) / denom;
      intercepto = (sumY - pendiente * sumX) / n;
    }
    // Promedio móvil de los últimos 3 meses (piso conservador).
    const ultimos = monthlyData.slice(-3);
    const promMovil = ultimos.length > 0
      ? ultimos.reduce((s, m) => s + m.ingresos, 0) / ultimos.length
      : avgMensual;

    const proyecciones = [];
    for (let i = 1; i <= 3; i++) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() + i);
      const mesLabel = meses_es[fecha.getMonth()] + ' ' + String(fecha.getFullYear()).slice(2);
      const tendencia = intercepto + pendiente * (n - 1 + i);
      // Mezcla tendencia (60%) con promedio móvil (40%); nunca negativa.
      const proyeccion = Math.max(0, Math.round(tendencia * 0.6 + promMovil * 0.4));
      proyecciones.push({ label: mesLabel, proyeccion, tipo: 'proyectado' });
    }

    res.json({
      historico: monthlyData,
      proyecciones,
      metodoProyeccion: n >= 2 ? 'Regresión lineal + promedio móvil (3m)' : 'Promedio histórico',
      resumen: {
        totalPeriodo: monthlyData.reduce((s, m) => s + m.ingresos, 0),
        promedioMensual: Math.round(avgMensual),
        tendenciaMensual: Math.round(pendiente),
        mejorMes: monthlyData.length > 0 ? monthlyData.reduce((a, b) => a.ingresos > b.ingresos ? a : b) : null
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

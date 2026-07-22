import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import api, { fmt, fmtShort } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';
import { useIsMobile } from '../hooks/useIsMobile';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1F2833', border: '1px solid rgba(197,198,199,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <div style={{ color: '#8B98A3', marginBottom: '6px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#FFFFFF', marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmtShort(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Estadisticas() {
  const { selectedVehicle } = useVehicles();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState(6);

  useEffect(() => {
    setLoading(true);
    api.get('/stats/historico', {
      params: { vehiculo: selectedVehicle?._id, meses }
    }).then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedVehicle, meses]);

  if (loading) return <LoadState />;
  if (!data) return null;

  const { historico, proyecciones, resumen } = data;
  const combinado = [
    ...historico.map(h => ({ ...h, tipo: 'real' })),
    ...proyecciones.map(p => ({ label: p.label, ingresos: p.proyeccion, tipo: 'proyectado' }))
  ];

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '72px 16px 90px' : '36px 44px 60px', overflowX: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Análisis
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
            Estadísticas y Proyecciones
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[3, 6, 12].map(m => (
            <button key={m} onClick={() => setMeses(m)} style={{
              padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: '8px', fontSize: '13px',
              background: meses === m ? '#C5C6C7' : '#1F2833',
              color: meses === m ? '#0B0C10' : '#C5C6C7',
              border: '1px solid rgba(197,198,199,0.2)', cursor: 'pointer', fontWeight: 600
            }}>
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total período', value: fmtShort(resumen.totalPeriodo), sub: `últimos ${meses} meses` },
          { label: 'Promedio mensual', value: fmtShort(resumen.promedioMensual), sub: 'ingresos' },
          { label: 'Mejor mes', value: resumen.mejorMes?.label || '—', sub: resumen.mejorMes ? fmtShort(resumen.mejorMes.ingresos) : '' },
          {
            label: 'Margen promedio',
            value: historico.length > 0
              ? `${(historico.reduce((s, h) => s + h.margenPct, 0) / historico.length).toFixed(1)}%`
              : '—',
            sub: 'utilidad / ingresos'
          }
        ].map(c => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontSize: '12px', color: '#8B98A3', marginBottom: '10px' }}>{c.label}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '24px', fontWeight: 600, color: '#FFFFFF' }}>
              {c.value}
            </div>
            {c.sub && <div style={{ fontSize: '11.5px', color: '#7C8994', marginTop: '4px' }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Area chart: Ingresos históricos + proyección */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginBottom: '4px' }}>
          Ingresos Históricos y Proyección
        </div>
        <div style={{ fontSize: '11.5px', color: '#7C8994', marginBottom: '24px' }}>
          Datos reales + proyección a 3 meses
        </div>
        {combinado.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={combinado}>
              <defs>
                <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C5C6C7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#C5C6C7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(197,198,199,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B98A3' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="ingresos" name="Ingresos"
                stroke="#C5C6C7" fill="url(#ingGrad)" strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx} cy={cy} r={4}
                      fill={payload.tipo === 'proyectado' ? '#7C8994' : '#C5C6C7'}
                      stroke={payload.tipo === 'proyectado' ? 'rgba(197,198,199,0.3)' : '#C5C6C7'}
                      strokeWidth={payload.tipo === 'proyectado' ? 2 : 0}
                      strokeDasharray={payload.tipo === 'proyectado' ? '4 2' : '0'}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div style={{ display: 'flex', gap: '24px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(197,198,199,0.06)', fontSize: '12px', color: '#B7C0C8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '20px', height: '2px', background: '#C5C6C7' }} />
            Datos reales
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '20px', height: '2px', background: '#7C8994', borderTop: '2px dashed #7C8994' }} />
            Proyección
          </div>
        </div>
      </div>

      {/* Bar chart: Ingresos vs Egresos por mes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginBottom: '24px' }}>
            Ingresos vs. Egresos por Mes
          </div>
          {historico.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={historico} barGap={4}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B98A3' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#C5C6C7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="egresos" name="Egresos" fill="#3D4A55" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginBottom: '24px' }}>
            Margen de Utilidad (%)
          </div>
          {historico.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={historico}>
                <CartesianGrid stroke="rgba(197,198,199,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B98A3' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Margen']} />
                <ReferenceLine y={0} stroke="rgba(197,198,199,0.3)" />
                <Bar dataKey="margenPct" name="Margen %" radius={[4, 4, 0, 0]}
                  fill="#8FD9B0"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly table */}
      {historico.length > 0 && (
        <div style={{ ...cardStyle, marginTop: '16px', overflowX: 'auto' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginBottom: '18px' }}>
            Resumen por Mes
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,198,199,0.1)' }}>
                {['Mes', 'Ingresos', 'Egresos', 'Utilidad', 'Margen', 'Km', 'Viajes'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map(m => (
                <tr key={m.mes} style={{ borderBottom: '1px solid rgba(197,198,199,0.06)' }}>
                  <td style={tdStyle}>{m.label}</td>
                  <td style={{ ...tdStyle, color: '#C5C6C7', fontWeight: 600 }}>{fmt(m.ingresos)}</td>
                  <td style={{ ...tdStyle, color: '#93A0AB' }}>{fmt(m.egresos)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: m.utilidad >= 0 ? '#8FD9B0' : '#f87171' }}>{fmt(m.utilidad)}</td>
                  <td style={{ ...tdStyle, color: m.margenPct >= 15 ? '#8FD9B0' : '#f59e0b' }}>{m.margenPct}%</td>
                  <td style={tdStyle}>{m.km?.toLocaleString('es-CO')}</td>
                  <td style={tdStyle}>{m.viajes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const EmptyChart = () => (
  <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B6672', fontSize: '13px' }}>
    Sin datos registrados para este período.
  </div>
);

const LoadState = () => (
  <main style={{ flex: 1, padding: '36px 44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ color: '#7C8994' }}>Cargando estadísticas...</div>
  </main>
);

const cardStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', padding: '24px' };
const thStyle = { padding: '10px 16px', textAlign: 'left', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7680', fontWeight: 600 };
const tdStyle = { padding: '12px 16px', fontSize: '13px', color: '#D7DCE0' };

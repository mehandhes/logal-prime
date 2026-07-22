import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line
} from 'recharts';
import api, { fmt, fmtShort, fmtDate } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';
import { useIsMobile } from '../hooks/useIsMobile';

const COLORS = { ingresos: '#C5C6C7', egresos: '#3D4A55', utilidad: '#8FD9B0' };

function KPICard({ label, value, delta, sub, deltaPositive }) {
  return (
    <div style={{
      background: '#151920',
      border: '1px solid rgba(197,198,199,0.1)',
      borderRadius: '14px',
      padding: '20px 22px'
    }}>
      <div style={{ fontSize: '12px', color: '#8B98A3', marginBottom: '14px', fontWeight: 500 }}>{label}</div>
      <div style={{
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '27px',
        fontWeight: 600,
        color: '#FFFFFF',
        marginBottom: '10px'
      }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: deltaPositive === false ? '#f87171' : deltaPositive === true ? '#8FD9B0' : '#C5C6C7'
        }}>
          {delta}
        </span>
        {sub && <span style={{ fontSize: '11.5px', color: '#6B7680' }}>{sub}</span>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1F2833',
      border: '1px solid rgba(197,198,199,0.2)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '12px'
    }}>
      <div style={{ color: '#8B98A3', marginBottom: '6px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#FFFFFF', marginBottom: '2px' }}>
          {p.name}: {fmtShort(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { selectedVehicle } = useVehicles();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/stats/dashboard', {
      params: { vehiculo: selectedVehicle?._id }
    }).then(res => {
      setData(res.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedVehicle]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const { kpis, egresoBreakdown, dailyData, mantenimientosPendientes, periodo } = data;
  const maxBar = Math.max(...dailyData.map(d => Math.max(d.ingresos, d.egresos)), 1);

  const fechaLabel = (() => {
    const d = new Date(periodo.desde);
    const h = new Date(periodo.hasta);
    return `${d.getDate()} – ${h.getDate()} ${h.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`;
  })();

  const maxEgreso = Math.max(...egresoBreakdown.map(b => b.valor), 1);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '72px 16px 90px' : '36px 44px 60px', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Panel General
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
            Dashboard
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ padding: '7px 12px', border: '1px solid rgba(197,198,199,0.22)', borderRadius: '9px', fontSize: '12px', color: '#C5C6C7' }}>
            {fechaLabel}
          </div>
          {selectedVehicle && (
            <div style={{ padding: '7px 12px', background: '#1F2833', borderRadius: '9px', fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>
              {selectedVehicle.placa}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        <KPICard
          label="Ingresos semana"
          value={fmtShort(kpis.totalIngresos)}
          delta={`${kpis.totalViajes} viajes`}
          deltaPositive={null}
          sub="período actual"
        />
        <KPICard
          label="Egresos semana"
          value={fmtShort(kpis.totalEgresos)}
          delta={`${kpis.totalKm} km`}
          sub="recorridos"
          deltaPositive={null}
        />
        <KPICard
          label="Utilidad neta"
          value={fmtShort(kpis.utilidadNeta)}
          delta={`${kpis.margenPct}% margen`}
          deltaPositive={kpis.utilidadNeta >= 0}
          sub=""
        />
        <KPICard
          label="Proyección semanal"
          value={fmtShort(kpis.proyeccionSemanal)}
          delta={`$${kpis.ingresoKm.toLocaleString('es-CO')}/km`}
          sub="ingreso"
          deltaPositive={null}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Bar chart: Ingresos vs Egresos */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '22px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>Ingresos vs. Egresos</div>
            <div style={{ fontSize: '11.5px', color: '#7C8994' }}>Esta semana</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} barGap={4} barCategoryGap="30%">
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#8B98A3' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ingresos" name="Ingresos" fill={COLORS.ingresos} radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill={COLORS.egresos} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '22px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(197,198,199,0.08)' }}>
            {[['Ingresos', '#C5C6C7'], ['Egresos', '#3D4A55']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#B7C0C8' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, display: 'inline-block' }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Egreso breakdown */}
        <div style={cardStyle}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginBottom: '4px' }}>Desglose de Egresos</div>
          <div style={{ fontSize: '11.5px', color: '#7C8994', marginBottom: '20px' }}>Período actual</div>
          {egresoBreakdown.map(b => (
            <div key={b.label} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '7px' }}>
                <span style={{ color: '#D7DCE0' }}>{b.label}</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{fmt(b.valor)}</span>
              </div>
              <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(197,198,199,0.1)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${maxEgreso > 0 ? (b.valor / maxEgreso) * 100 : 0}%`,
                  background: '#C5C6C7',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Break-even ring */}
        <div style={{ ...cardStyle, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', alignSelf: 'flex-start', marginBottom: '16px' }}>
            Punto de Equilibrio
          </div>
          <div style={{ position: 'relative', width: '128px', height: '128px', marginBottom: '16px' }}>
            <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(197,198,199,0.1)" strokeWidth="10" />
              <circle
                cx="64" cy="64" r="54"
                fill="none"
                stroke={kpis.margenPct >= 0 ? '#C5C6C7' : '#f87171'}
                strokeWidth="10"
                strokeDasharray={`${Math.min(Math.abs(kpis.margenPct), 100) * 3.39} 339`}
                strokeLinecap="round"
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                {kpis.margenPct}%
              </div>
              <div style={{ fontSize: '9.5px', color: '#7C8994', letterSpacing: '0.04em' }}>MARGEN</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#7C8994' }}>Costo / km</div>
              <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '2px' }}>
                ${kpis.costoKm.toLocaleString('es-CO')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#7C8994' }}>Ingreso / km</div>
              <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '2px' }}>
                ${kpis.ingresoKm.toLocaleString('es-CO')}
              </div>
            </div>
          </div>
        </div>

        {/* Weekly projection */}
        <div style={cardStyle}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>Proyección Semanal</div>
          <div style={{ fontSize: '11.5px', color: '#7C8994', marginBottom: '18px' }}>Al ritmo del período</div>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '24px', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px'
          }}>
            {fmtShort(kpis.proyeccionSemanal)}
          </div>
          <div style={{ fontSize: '12px', color: '#7C8994', marginBottom: '16px' }}>
            Utilidad neta: {fmtShort(kpis.utilidadNeta)}
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(197,198,199,0.1)', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, kpis.margenPct > 0 ? kpis.margenPct : 0)}%`,
              background: kpis.margenPct >= 20 ? '#8FD9B0' : kpis.margenPct >= 0 ? '#C5C6C7' : '#f87171',
              borderRadius: '4px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ fontSize: '12.5px', color: '#8FD9B0', fontWeight: 600 }}>
            {kpis.margenPct >= 20 ? '✓ Rentabilidad saludable' :
              kpis.margenPct >= 0 ? '▲ Margen positivo' : '⚠ Margen negativo'}
          </div>
        </div>

        {/* Mantenimiento pendiente */}
        <div style={{ ...cardStyle, background: '#1F2833', border: '1px solid rgba(197,198,199,0.16)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'rgba(197,198,199,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', flexShrink: 0
            }}>⚠</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Mantenimiento Pendiente</div>
          </div>
          {mantenimientosPendientes.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#7C8994' }}>Sin mantenimientos pendientes.</div>
          ) : mantenimientosPendientes.map(m => (
            <div key={m._id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(197,198,199,0.08)' }}>
              <div style={{ fontSize: '13.5px', color: '#D7DCE0', marginBottom: '4px' }}>
                <strong style={{ color: '#FFFFFF' }}>{m.tipo}</strong> · {m.placa || m.vehiculo?.placa}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>
                  {fmt(m.costo)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#93A0AB' }}>{fmtDate(m.fecha)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <main style={{ flex: 1, padding: '36px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#7C8994' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⟳</div>
        <div>Cargando dashboard...</div>
      </div>
    </main>
  );
}

const cardStyle = {
  background: '#151920',
  border: '1px solid rgba(197,198,199,0.1)',
  borderRadius: '14px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column'
};

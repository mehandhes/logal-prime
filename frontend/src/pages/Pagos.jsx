import React, { useState, useEffect } from 'react';
import api, { fmt, fmtDate } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';
import { useIsMobile } from '../hooks/useIsMobile';

const ESTADO_COLORS = { pendiente: '#f59e0b', pagado: '#8FD9B0', parcial: '#C5C6C7' };

export default function Pagos() {
  const { vehicles, selectedVehicle } = useVehicles();
  const isMobile = useIsMobile();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({
    vehiculoId: '', fechaInicio: '', fechaFin: '',
    tipo: 'quincenal', tipoLiquidacion: 'registros',
    montoConductor: '', porcentajeConductor: 30
  });
  const [generating, setGenerating] = useState(false);
  const [showPago, setShowPago] = useState(null);
  const [preview, setPreview] = useState(null);

  const fetchPagos = () => {
    setLoading(true);
    api.get('/pagos').then(res => setPagos(res.data.pagos)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPagos();
    if (selectedVehicle) setGenForm(f => ({ ...f, vehiculoId: selectedVehicle._id }));
  }, [selectedVehicle]);

  // Paso 1 -> 2: previsualiza el resumen sin guardar.
  const handlePrevisualizar = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.post('/pagos/previsualizar', genForm);
      setPreview(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo calcular el resumen.');
    } finally {
      setGenerating(false);
    }
  };

  // Paso 2: confirma y guarda la liquidación.
  const handleConfirmar = async () => {
    setGenerating(true);
    try {
      await api.post('/pagos/generar', genForm);
      setShowGen(false);
      setPreview(null);
      fetchPagos();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al generar liquidación.');
    } finally {
      setGenerating(false);
    }
  };

  const cerrarGen = () => { setShowGen(false); setPreview(null); };

  const handleMarcarPagado = async (id) => {
    await api.put(`/pagos/${id}`, {
      estado: 'pagado',
      fechaPago: new Date().toISOString().split('T')[0]
    });
    fetchPagos();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta liquidación?')) return;
    await api.delete(`/pagos/${id}`);
    fetchPagos();
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '84px 16px 90px' : '36px 44px 60px', overflowX: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Liquidaciones
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
            Pagos y Liquidación
          </h1>
        </div>
        <button onClick={() => { setPreview(null); setShowGen(true); }} style={btnPrimary}>
          + Generar Liquidación
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total liquidaciones', value: pagos.length, sub: '' },
          {
            label: 'Pendientes de pago',
            value: pagos.filter(p => p.estado === 'pendiente').length,
            sub: 'liquidaciones'
          },
          {
            label: 'Total a conductores',
            value: fmt(pagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.liquidacionConductor, 0)),
            sub: 'por pagar'
          },
          {
            label: 'Utilidad empresa',
            value: fmt(pagos.reduce((s, p) => s + p.utilidadEmpresa, 0)),
            sub: 'acumulado'
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

      {/* Generate form modal */}
      {showGen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>
              Cierre de quincena {preview ? '· Paso 2: Resumen' : '· Paso 1: Período'}
            </h2>
            <div style={{ fontSize: '12px', color: '#7C8994', marginBottom: '20px' }}>
              {preview ? 'Revisa el resultado antes de guardar la liquidación.' : 'Elige el vehículo, el período y cómo se paga al conductor.'}
            </div>
            {!preview ? (
            <form onSubmit={handlePrevisualizar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Label>Vehículo</Label>
                <select
                  value={genForm.vehiculoId}
                  onChange={e => setGenForm({ ...genForm, vehiculoId: e.target.value })}
                  required style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {vehicles.map(v => (
                    <option key={v._id} value={v._id} style={{ background: '#161920' }}>{v.placa} · {v.conductor}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Label>Fecha inicio</Label>
                  <input type="date" value={genForm.fechaInicio}
                    onChange={e => setGenForm({ ...genForm, fechaInicio: e.target.value })} required style={inputStyle} />
                </div>
                <div>
                  <Label>Fecha fin</Label>
                  <input type="date" value={genForm.fechaFin}
                    onChange={e => setGenForm({ ...genForm, fechaFin: e.target.value })} required style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Label>Periodicidad</Label>
                  <select value={genForm.tipo} onChange={e => setGenForm({ ...genForm, tipo: e.target.value })} style={inputStyle}>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <Label>Sueldo del conductor</Label>
                  <select value={genForm.tipoLiquidacion}
                    onChange={e => setGenForm({ ...genForm, tipoLiquidacion: e.target.value })} style={inputStyle}>
                    <option value="registros">Según pagos registrados (col. S)</option>
                    <option value="fijo">Monto fijo pactado</option>
                    <option value="porcentaje">% de la utilidad</option>
                  </select>
                </div>
              </div>
              {genForm.tipoLiquidacion === 'fijo' && (
                <div>
                  <Label>Monto a pagar al conductor ($COP)</Label>
                  <input type="number" min="0" step="1000" value={genForm.montoConductor}
                    onChange={e => setGenForm({ ...genForm, montoConductor: e.target.value })}
                    style={inputStyle} required />
                </div>
              )}
              {genForm.tipoLiquidacion === 'porcentaje' && (
                <div>
                  <Label>% Conductor sobre la utilidad</Label>
                  <input type="number" min="0" max="100" value={genForm.porcentajeConductor}
                    onChange={e => setGenForm({ ...genForm, porcentajeConductor: parseInt(e.target.value) })}
                    style={inputStyle} />
                </div>
              )}
              <div style={{ padding: '12px 16px', background: '#0B0C10', borderRadius: '8px', fontSize: '12px', color: '#8B98A3' }}>
                {genForm.tipoLiquidacion === 'registros'
                  ? 'El sueldo del conductor se toma de la suma de "Pago al conductor" anotado en los registros del período (como la columna S de la hoja).'
                  : genForm.tipoLiquidacion === 'fijo'
                    ? 'Se descontará el monto fijo indicado como sueldo del conductor.'
                    : 'El sueldo del conductor será el porcentaje indicado sobre la utilidad del período.'}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" disabled={generating} style={btnPrimary}>
                  {generating ? 'Calculando...' : 'Ver resumen →'}
                </button>
                <button type="button" onClick={cerrarGen} style={btnSecondary}>Cancelar</button>
              </div>
            </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  ['Registros del período', preview.numRegistros],
                  ['Total ingresos', fmt(preview.totalIngresos)],
                  ['Total egresos', fmt(preview.totalEgresos)],
                  ['Km recorridos', `${(preview.totalKm || 0).toLocaleString('es-CO')} km`],
                  ['Rendimiento', `${preview.rendimientoKmGalon || 0} km/gal`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#B7C0C8', padding: '6px 0', borderBottom: '1px solid rgba(197,198,199,0.07)' }}>
                    <span>{k}</span><span style={{ color: '#FFFFFF' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '8px 0' }}>
                  <span style={{ color: '#C5C6C7' }}>Utilidad operativa</span>
                  <span style={{ color: '#C5C6C7', fontWeight: 600 }}>{fmt(preview.utilidadOperativa)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#f59e0b' }}>− Sueldo del conductor</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt(preview.sueldoConductor)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700, borderTop: '1px solid rgba(197,198,199,0.15)', paddingTop: '12px', marginTop: '4px' }}>
                  <span style={{ color: '#FFFFFF' }}>Neto empresa</span>
                  <span style={{ color: preview.netoEmpresa >= 0 ? '#8FD9B0' : '#f87171' }}>{fmt(preview.netoEmpresa)}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                  <button onClick={handleConfirmar} disabled={generating} style={btnPrimary}>
                    {generating ? 'Guardando...' : 'Confirmar y guardar'}
                  </button>
                  <button onClick={() => setPreview(null)} style={btnSecondary}>← Volver</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pago detail modal */}
      {showPago && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>Detalle de Liquidación</h2>
              <button onClick={() => setShowPago(null)} style={{ background: 'none', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                ['Vehículo', showPago.placa],
                ['Conductor', showPago.conductor],
                ['Período', `${fmtDate(showPago.periodo?.fechaInicio)} – ${fmtDate(showPago.periodo?.fechaFin)}`],
                ['Tipo', showPago.periodo?.tipo],
                ['Total ingresos', fmt(showPago.totalIngresos)],
                ['Total egresos', fmt(showPago.totalEgresos)],
                ['Utilidad neta', fmt(showPago.totalIngresos - showPago.totalEgresos)],
                [showPago.tipoLiquidacion === 'porcentaje'
                  ? `Sueldo conductor (${showPago.porcentajeConductor}%)`
                  : 'Sueldo del conductor', fmt(showPago.liquidacionConductor)],
                ['Utilidad empresa', fmt(showPago.utilidadEmpresa)],
                ['Km recorridos', `${showPago.totalKm?.toLocaleString('es-CO')} km`],
                ['Viajes realizados', showPago.totalViajes],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(197,198,199,0.07)', fontSize: '13px' }}>
                  <span style={{ color: '#8B98A3' }}>{k}</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            {showPago.estado === 'pendiente' && (
              <button onClick={() => { handleMarcarPagado(showPago._id); setShowPago(null); }} style={{ ...btnPrimary, marginTop: '24px', width: '100%' }}>
                Marcar como Pagado
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pagos list */}
      <div style={{ background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(197,198,199,0.1)' }}>
              {['Período', 'Vehículo', 'Conductor', 'Ingresos', 'Para conductor', 'Utilidad', 'Estado', ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Cargando...</td></tr>
            ) : pagos.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>
                Sin liquidaciones. Genera la primera desde los registros.
              </td></tr>
            ) : pagos.map(p => (
              <tr key={p._id} style={{ borderBottom: '1px solid rgba(197,198,199,0.06)' }}>
                <td style={tdStyle}>
                  <div style={{ fontSize: '13px', color: '#D7DCE0' }}>
                    {fmtDate(p.periodo?.fechaInicio)} – {fmtDate(p.periodo?.fechaFin)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#7C8994', textTransform: 'capitalize' }}>{p.periodo?.tipo}</div>
                </td>
                <td style={tdStyle}>{p.placa}</td>
                <td style={tdStyle}>{p.conductor}</td>
                <td style={{ ...tdStyle, color: '#C5C6C7', fontWeight: 600 }}>{fmt(p.totalIngresos)}</td>
                <td style={{ ...tdStyle, color: '#f59e0b' }}>{fmt(p.liquidacionConductor)}</td>
                <td style={{ ...tdStyle, color: '#8FD9B0', fontWeight: 600 }}>{fmt(p.utilidadEmpresa)}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    background: `${ESTADO_COLORS[p.estado]}22`,
                    color: ESTADO_COLORS[p.estado],
                    textTransform: 'capitalize'
                  }}>{p.estado}</span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  <button onClick={() => setShowPago(p)} style={iconBtn}>👁</button>
                  <button onClick={() => handleDelete(p._id)} style={{ ...iconBtn, color: '#f87171' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>{children}</label>
);
const inputStyle = { width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '10px 20px', background: '#1F2833', color: '#C5C6C7', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px', fontSize: '13px', cursor: 'pointer' };
const iconBtn = { padding: '4px 8px', background: 'transparent', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' };
const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7680', fontWeight: 600 };
const tdStyle = { padding: '14px 16px', fontSize: '13px', color: '#D7DCE0' };
const cardStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', padding: '20px 22px' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' };
const modalStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' };

import React, { useState, useEffect } from 'react';
import api, { fmt, fmtDate } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';
import { useIsMobile } from '../hooks/useIsMobile';

const TIPOS_INGRESO = ['Empresarial', 'Ejecutivo', 'Aeropuerto', 'Turismo', 'Otro'];

const emptyForm = () => ({
  fecha: new Date().toISOString().split('T')[0],
  ingresos: { tipo: 'Empresarial', valor: '', descripcion: '', numViajes: 1 },
  combustible: '',
  peajes: '',
  otros: '',
  otrosDescripcion: '',
  kmInicio: '',
  kmFin: '',
  observaciones: ''
});

export default function RegistroDiario() {
  const { vehicles, selectedVehicle } = useVehicles();
  const isMobile = useIsMobile();
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState('');

  const fetchRegistros = () => {
    setLoading(true);
    api.get('/registros', {
      params: { vehiculo: filterVehicle || selectedVehicle?._id, page, limit: 20 }
    }).then(res => {
      setRegistros(res.data.registros);
      setTotal(res.data.total);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRegistros(); }, [selectedVehicle, page, filterVehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vehiculoId = form.vehiculoId || selectedVehicle?._id;
      const vehiculo = vehicles.find(v => v._id === vehiculoId);
      const payload = {
        ...form,
        vehiculo: vehiculoId,
        placa: vehiculo?.placa || '',
        conductor: vehiculo?.conductor || '',
        ingresos: {
          ...form.ingresos,
          valor: parseFloat(form.ingresos.valor) || 0,
          numViajes: parseInt(form.ingresos.numViajes) || 1
        },
        combustible: parseFloat(form.combustible) || 0,
        peajes: parseFloat(form.peajes) || 0,
        otros: parseFloat(form.otros) || 0,
        kmInicio: parseInt(form.kmInicio) || 0,
        kmFin: parseInt(form.kmFin) || 0
      };

      if (editId) {
        await api.put(`/registros/${editId}`, payload);
      } else {
        await api.post('/registros', payload);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      fetchRegistros();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setForm({
      fecha: r.fecha?.split('T')[0] || '',
      vehiculoId: r.vehiculo?._id || r.vehiculo,
      ingresos: { ...r.ingresos, valor: r.ingresos?.valor?.toString() || '' },
      combustible: r.combustible?.toString() || '',
      peajes: r.peajes?.toString() || '',
      otros: r.otros?.toString() || '',
      otrosDescripcion: r.otrosDescripcion || '',
      kmInicio: r.kmInicio?.toString() || '',
      kmFin: r.kmFin?.toString() || '',
      observaciones: r.observaciones || ''
    });
    setEditId(r._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await api.delete(`/registros/${id}`);
    fetchRegistros();
  };

  const totalPages = Math.ceil(total / 20);

  const grid2 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' };
  const grid3 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '84px 16px 90px' : '36px 44px 60px', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Movimientos
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
            Registro Diario
          </h1>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }} style={btnPrimary}>
          + Nuevo Registro
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '24px' }}>
              {editId ? 'Editar Registro' : 'Nuevo Registro'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={grid2}>
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                </div>
                <div>
                  <Label>Vehículo</Label>
                  <select
                    value={form.vehiculoId || selectedVehicle?._id || ''}
                    onChange={e => setForm({ ...form, vehiculoId: e.target.value })}
                    style={inputStyle}
                  >
                    {vehicles.map(v => (
                      <option key={v._id} value={v._id} style={{ background: '#161920' }}>{v.placa} · {v.conductor}</option>
                    ))}
                  </select>
                </div>
              </div>

              <SectionTitle>Ingresos</SectionTitle>
              <div style={grid2}>
                <div>
                  <Label>Tipo de servicio</Label>
                  <select
                    value={form.ingresos.tipo}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, tipo: e.target.value } })}
                    style={inputStyle}
                  >
                    {TIPOS_INGRESO.map(t => <option key={t} value={t} style={{ background: '#161920' }}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Número de viajes</Label>
                  <Input type="number" min="1" value={form.ingresos.numViajes}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, numViajes: e.target.value } })} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Valor total de ingresos ($COP)</Label>
                  <Input type="number" min="0" step="100" value={form.ingresos.valor}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, valor: e.target.value } })} required />
                </div>
              </div>

              <SectionTitle>Egresos</SectionTitle>
              <div style={grid3}>
                <div>
                  <Label>Combustible</Label>
                  <Input type="number" min="0" step="100" value={form.combustible}
                    onChange={e => setForm({ ...form, combustible: e.target.value })} />
                </div>
                <div>
                  <Label>Peajes</Label>
                  <Input type="number" min="0" step="100" value={form.peajes}
                    onChange={e => setForm({ ...form, peajes: e.target.value })} />
                </div>
                <div>
                  <Label>Otros gastos</Label>
                  <Input type="number" min="0" step="100" value={form.otros}
                    onChange={e => setForm({ ...form, otros: e.target.value })} />
                </div>
              </div>

              <SectionTitle>Kilometraje</SectionTitle>
              <div style={grid2}>
                <div>
                  <Label>Km inicio</Label>
                  <Input type="number" min="0" value={form.kmInicio}
                    onChange={e => setForm({ ...form, kmInicio: e.target.value })} />
                </div>
                <div>
                  <Label>Km fin</Label>
                  <Input type="number" min="0" value={form.kmFin}
                    onChange={e => setForm({ ...form, kmFin: e.target.value })} />
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <Label>Observaciones</Label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Novedades del día..."
                />
              </div>

              {/* Preview */}
              {form.ingresos.valor && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: '#0B0C10', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B98A3', marginBottom: '4px' }}>
                    <span>Ingresos:</span>
                    <span style={{ color: '#C5C6C7' }}>{fmt(parseFloat(form.ingresos.valor) || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B98A3', marginBottom: '4px' }}>
                    <span>Egresos:</span>
                    <span style={{ color: '#C5C6C7' }}>{fmt((parseFloat(form.combustible) || 0) + (parseFloat(form.peajes) || 0) + (parseFloat(form.otros) || 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid rgba(197,198,199,0.1)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ color: '#FFFFFF' }}>Utilidad neta:</span>
                    <span style={{ color: (parseFloat(form.ingresos.valor) - (parseFloat(form.combustible) || 0) - (parseFloat(form.peajes) || 0) - (parseFloat(form.otros) || 0)) >= 0 ? '#8FD9B0' : '#f87171' }}>
                      {fmt((parseFloat(form.ingresos.valor) || 0) - (parseFloat(form.combustible) || 0) - (parseFloat(form.peajes) || 0) - (parseFloat(form.otros) || 0))}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" disabled={saving} style={btnPrimary}>
                  {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,198,199,0.1)' }}>
                {['Fecha', 'Vehículo', 'Conductor', 'Tipo', 'Ingresos', 'Egresos', 'Utilidad', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Cargando...</td></tr>
              ) : registros.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>
                  Sin registros. ¡Agrega el primero!
                </td></tr>
              ) : registros.map(r => (
                <tr key={r._id} style={{ borderBottom: '1px solid rgba(197,198,199,0.06)', transition: 'background 0.1s' }}>
                  <td style={tdStyle}>{fmtDate(r.fecha)}</td>
                  <td style={tdStyle}>{r.placa}</td>
                  <td style={tdStyle}>{r.conductor}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px',
                      background: 'rgba(197,198,199,0.1)',
                      fontSize: '11px', color: '#C5C6C7'
                    }}>{r.ingresos?.tipo}</span>
                  </td>
                  <td style={{ ...tdStyle, color: '#C5C6C7', fontWeight: 600 }}>{fmt(r.ingresos?.valor)}</td>
                  <td style={{ ...tdStyle, color: '#93A0AB' }}>{fmt(r.totalEgresos)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: r.utilidadNeta >= 0 ? '#8FD9B0' : '#f87171' }}>
                    {fmt(r.utilidadNeta)}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEdit(r)} style={iconBtn}>✏</button>
                    <button onClick={() => handleDelete(r._id)} style={{ ...iconBtn, color: '#f87171' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', borderTop: '1px solid rgba(197,198,199,0.08)' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btnSecondary}>← Ant.</button>
            <span style={{ padding: '8px 16px', fontSize: '13px', color: '#8B98A3' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btnSecondary}>Sig. →</button>
          </div>
        )}
      </div>
    </main>
  );
}

// Small helpers
const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>{children}</label>
);
const Input = (props) => (
  <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />
);
const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5B6672', margin: '20px 0 12px' }}>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)',
  borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px',
  outline: 'none', fontFamily: 'inherit'
};
const btnPrimary = {
  padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10',
  border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700,
  cursor: 'pointer', letterSpacing: '0.02em'
};
const btnSecondary = {
  padding: '10px 20px', background: '#1F2833', color: '#C5C6C7',
  border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px',
  fontSize: '13px', fontWeight: 500, cursor: 'pointer'
};
const iconBtn = {
  padding: '4px 8px', background: 'transparent', border: 'none',
  color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px'
};
const thStyle = {
  padding: '12px 16px', textAlign: 'left', fontSize: '10.5px',
  letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7680',
  fontWeight: 600
};
const tdStyle = {
  padding: '14px 16px', fontSize: '13px', color: '#D7DCE0'
};
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '16px'
};
const modalStyle = {
  background: '#151920', border: '1px solid rgba(197,198,199,0.15)',
  borderRadius: '16px', padding: '24px 20px',
  width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto'
};

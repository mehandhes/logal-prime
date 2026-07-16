import React, { useState, useEffect } from 'react';
import api, { fmt, fmtDate } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';

const TIPOS = ['Cambio aceite', 'Llantas', 'Frenos', 'Revisión técnica', 'Lavado', 'Reparación', 'Otro'];
const ESTADO_COLORS = { programado: '#f59e0b', en_proceso: '#C5C6C7', completado: '#8FD9B0' };

export default function Mantenimiento() {
  const { vehicles, selectedVehicle } = useVehicles();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehiculoId: '', tipo: TIPOS[0], descripcion: '', fecha: new Date().toISOString().split('T')[0], costo: '', kmAlMomento: '', taller: '', estado: 'programado', observaciones: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    api.get('/mantenimiento').then(res => setItems(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    if (selectedVehicle) setForm(f => ({ ...f, vehiculoId: selectedVehicle._id }));
  }, [selectedVehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vehiculo = vehicles.find(v => v._id === form.vehiculoId);
      const payload = {
        ...form,
        vehiculo: form.vehiculoId,
        placa: vehiculo?.placa || '',
        costo: parseFloat(form.costo) || 0,
        kmAlMomento: parseInt(form.kmAlMomento) || undefined
      };
      if (editId) {
        await api.put(`/mantenimiento/${editId}`, payload);
      } else {
        await api.post('/mantenimiento', payload);
      }
      setShowForm(false);
      setEditId(null);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setForm({
      vehiculoId: item.vehiculo?._id || item.vehiculo || '',
      tipo: item.tipo,
      descripcion: item.descripcion || '',
      fecha: item.fecha?.split('T')[0] || '',
      costo: item.costo?.toString() || '',
      kmAlMomento: item.kmAlMomento?.toString() || '',
      taller: item.taller || '',
      estado: item.estado,
      observaciones: item.observaciones || ''
    });
    setEditId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await api.delete(`/mantenimiento/${id}`);
    fetchItems();
  };

  const totalCosto = items.filter(i => i.estado === 'completado').reduce((s, i) => s + i.costo, 0);
  const pendientes = items.filter(i => i.estado !== 'completado');

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '36px 44px 60px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Flota
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '32px', color: '#FFFFFF' }}>
            Mantenimiento
          </h1>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); }} style={btnPrimary}>
          + Agregar Mantenimiento
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Pendientes', value: pendientes.length, color: '#f59e0b' },
          { label: 'Completados', value: items.filter(i => i.estado === 'completado').length, color: '#8FD9B0' },
          { label: 'Costo total completados', value: fmt(totalCosto), color: '#C5C6C7' }
        ].map(c => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontSize: '12px', color: '#8B98A3', marginBottom: '10px' }}>{c.label}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 600, color: c.color }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '24px' }}>
              {editId ? 'Editar Mantenimiento' : 'Nuevo Mantenimiento'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Label>Vehículo</Label>
                  <select value={form.vehiculoId} onChange={e => setForm({ ...form, vehiculoId: e.target.value })} required style={inputStyle}>
                    <option value="">Seleccionar...</option>
                    {vehicles.map(v => <option key={v._id} value={v._id} style={{ background: '#161920' }}>{v.placa}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                    {TIPOS.map(t => <option key={t} value={t} style={{ background: '#161920' }}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Label>Fecha</Label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required style={inputStyle} />
                </div>
                <div>
                  <Label>Costo ($COP)</Label>
                  <input type="number" min="0" step="100" value={form.costo} onChange={e => setForm({ ...form, costo: e.target.value })} required style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Label>Km al momento</Label>
                  <input type="number" min="0" value={form.kmAlMomento} onChange={e => setForm({ ...form, kmAlMomento: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <Label>Taller</Label>
                  <input type="text" value={form.taller} onChange={e => setForm({ ...form, taller: e.target.value })} style={inputStyle} placeholder="Nombre del taller" />
                </div>
              </div>
              <div>
                <Label>Estado</Label>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>
                  <option value="programado">Programado</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="completado">Completado</option>
                </select>
              </div>
              <div>
                <Label>Descripción / Observaciones</Label>
                <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={btnSecondary}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {loading ? (
          <div style={{ color: '#7C8994', padding: '40px' }}>Cargando...</div>
        ) : items.length === 0 ? (
          <div style={{ ...cardStyle, gridColumn: '1/-1', textAlign: 'center', color: '#7C8994', padding: '60px' }}>
            Sin registros de mantenimiento.
          </div>
        ) : items.map(item => (
          <div key={item._id} style={{ ...cardStyle, background: item.estado === 'completado' ? '#151920' : '#1A1E28' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{item.tipo}</div>
                <div style={{ fontSize: '12px', color: '#7C8994', marginTop: '2px' }}>
                  {item.placa || item.vehiculo?.placa} · {fmtDate(item.fecha)}
                </div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                background: `${ESTADO_COLORS[item.estado]}22`,
                color: ESTADO_COLORS[item.estado],
                textTransform: 'capitalize'
              }}>
                {item.estado.replace('_', ' ')}
              </span>
            </div>
            {item.observaciones && (
              <div style={{ fontSize: '13px', color: '#8B98A3', marginBottom: '12px', lineHeight: 1.5 }}>{item.observaciones}</div>
            )}
            {item.taller && (
              <div style={{ fontSize: '12px', color: '#7C8994', marginBottom: '8px' }}>Taller: {item.taller}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(197,198,199,0.08)' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
                {fmt(item.costo)}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(item)} style={iconBtn}>✏</button>
                <button onClick={() => handleDelete(item._id)} style={{ ...iconBtn, color: '#f87171' }}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

const Label = ({ children }) => <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>{children}</label>;
const inputStyle = { width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '10px 20px', background: '#1F2833', color: '#C5C6C7', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px', fontSize: '13px', cursor: 'pointer' };
const iconBtn = { padding: '4px 8px', background: 'transparent', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' };
const cardStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', padding: '20px' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' };
const modalStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' };

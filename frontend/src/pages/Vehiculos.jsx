import React, { useState, useEffect } from 'react';
import api, { fmtDate } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Vehiculos() {
  const { vehicles, setVehicles } = useVehicles();
  const isMobile = useIsMobile();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ placa: '', nombre: '', marca: '', modelo: '', año: '', conductor: '', kmActual: '', observaciones: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, año: parseInt(form.año) || undefined, kmActual: parseInt(form.kmActual) || 0 };
      let res;
      if (editId) {
        res = await api.put(`/vehicles/${editId}`, payload);
        setVehicles(v => v.map(x => x._id === editId ? res.data : x));
      } else {
        res = await api.post('/vehicles', payload);
        setVehicles(v => [...v, res.data]);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ placa: '', nombre: '', marca: '', modelo: '', año: '', conductor: '', kmActual: '', observaciones: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (v) => {
    setForm({ placa: v.placa, nombre: v.nombre, marca: v.marca || '', modelo: v.modelo || '', año: v.año?.toString() || '', conductor: v.conductor, kmActual: v.kmActual?.toString() || '', observaciones: v.observaciones || '' });
    setEditId(v._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este vehículo? Los registros asociados quedarán huérfanos.')) return;
    await api.delete(`/vehicles/${id}`);
    setVehicles(v => v.filter(x => x._id !== id));
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '72px 16px 90px' : '36px 44px 60px' }}>
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>Flota</div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>Vehículos</h1>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); }} style={btnPrimary}>+ Agregar Vehículo</button>
      </div>

      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '24px' }}>
              {editId ? 'Editar Vehículo' : 'Nuevo Vehículo'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><Label>Placa *</Label><Input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} required placeholder="HDL802" /></div>
                <div><Label>Nombre del vehículo</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Sprinter 2022" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div><Label>Marca</Label><Input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Mercedes" /></div>
                <div><Label>Modelo</Label><Input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} placeholder="Sprinter" /></div>
                <div><Label>Año</Label><Input type="number" value={form.año} onChange={e => setForm({ ...form, año: e.target.value })} placeholder="2022" min="2000" max="2030" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><Label>Conductor *</Label><Input value={form.conductor} onChange={e => setForm({ ...form, conductor: e.target.value })} required placeholder="Jose García" /></div>
                <div><Label>Km actuales</Label><Input type="number" value={form.kmActual} onChange={e => setForm({ ...form, kmActual: e.target.value })} placeholder="150000" /></div>
              </div>
              <div><Label>Observaciones</Label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={btnSecondary}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {vehicles.length === 0 ? (
          <div style={{ ...cardStyle, gridColumn: '1/-1', textAlign: 'center', color: '#7C8994', padding: '60px' }}>
            Sin vehículos. Agrega el primero.
          </div>
        ) : vehicles.map(v => (
          <div key={v._id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#1F2833', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#C5C6C7' }}>
                  {v.placa?.slice(-3)}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>{v.placa}</div>
                  <div style={{ fontSize: '12px', color: '#7C8994' }}>{v.marca} {v.modelo} {v.año}</div>
                </div>
              </div>
              <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', background: v.activo ? 'rgba(143,217,176,0.15)' : 'rgba(197,198,199,0.1)', color: v.activo ? '#8FD9B0' : '#7C8994' }}>
                {v.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div><span style={{ color: '#7C8994' }}>Conductor: </span><span style={{ color: '#FFFFFF' }}>{v.conductor}</span></div>
              <div><span style={{ color: '#7C8994' }}>Km: </span><span style={{ color: '#FFFFFF' }}>{v.kmActual?.toLocaleString('es-CO')}</span></div>
            </div>
            {v.observaciones && <div style={{ fontSize: '12px', color: '#7C8994', marginBottom: '12px' }}>{v.observaciones}</div>}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(197,198,199,0.08)' }}>
              <button onClick={() => handleEdit(v)} style={{ ...btnSecondary, flex: 1, textAlign: 'center' }}>Editar</button>
              <button onClick={() => handleDelete(v._id)} style={{ ...iconBtn, color: '#f87171', fontSize: '13px' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

const Label = ({ children }) => <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>{children}</label>;
const Input = (props) => <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
const inputStyle = { width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '8px 16px', background: '#1F2833', color: '#C5C6C7', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px', fontSize: '13px', cursor: 'pointer' };
const iconBtn = { padding: '4px 8px', background: 'transparent', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' };
const cardStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', padding: '20px' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' };
const modalStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' };

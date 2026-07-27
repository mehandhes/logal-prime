import React, { useState, useEffect } from 'react';
import api, { fmt, fmtDate } from '../utils/api';
import { useIsMobile } from '../hooks/useIsMobile';

const TIPOS = ['fijo', 'ocasional', 'empresa'];
const emptyForm = () => ({ nombre: '', tipo: 'fijo', contacto: { telefono: '', email: '' }, tarifaDia: '', notas: '' });

export default function Clientes() {
  const isMobile = useIsMobile();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [detalle, setDetalle] = useState(null); // resumen de un cliente

  const fetch = () => {
    setLoading(true);
    api.get('/clientes').then(res => setClientes(res.data.clientes || [])).finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, tarifaDia: parseFloat(form.tarifaDia) || 0 };
    try {
      if (editId) await api.put(`/clientes/${editId}`, payload);
      else await api.post('/clientes', payload);
      setShowForm(false); setEditId(null); setForm(emptyForm()); fetch();
    } catch (err) { alert(err.response?.data?.message || 'Error al guardar.'); }
  };

  const edit = (c) => {
    setForm({ nombre: c.nombre, tipo: c.tipo, contacto: c.contacto || { telefono: '', email: '' }, tarifaDia: c.tarifaDia?.toString() || '', notas: c.notas || '' });
    setEditId(c._id); setShowForm(true);
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar este cliente?')) return;
    await api.delete(`/clientes/${id}`); fetch();
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '84px 16px 90px' : '36px 44px 60px', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>Cartera</div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>Clientes</h1>
        </div>
        <button onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true); }} style={btnPrimary}>+ Nuevo Cliente</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={overlayStyle}><div style={modalStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '20px' }}>{editId ? 'Editar' : 'Nuevo'} Cliente</h2>
          <form onSubmit={submit}>
            <Label>Nombre</Label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required style={{ ...inputStyle, marginBottom: '12px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div><Label>Tipo</Label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                  {TIPOS.map(t => <option key={t} value={t} style={{ background: '#161920' }}>{t}</option>)}
                </select></div>
              <div><Label>Tarifa día (opcional)</Label>
                <input type="number" value={form.tarifaDia} onChange={e => setForm({ ...form, tarifaDia: e.target.value })} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div><Label>Teléfono</Label>
                <input value={form.contacto.telefono} onChange={e => setForm({ ...form, contacto: { ...form.contacto, telefono: e.target.value } })} style={inputStyle} /></div>
              <div><Label>Email</Label>
                <input value={form.contacto.email} onChange={e => setForm({ ...form, contacto: { ...form.contacto, email: e.target.value } })} style={inputStyle} /></div>
            </div>
            <Label>Notas</Label>
            <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: '18px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" style={btnPrimary}>{editId ? 'Actualizar' : 'Crear'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={btnSecondary}>Cancelar</button>
            </div>
          </form>
        </div></div>
      )}

      {/* Detalle cliente + anticipos */}
      {detalle && <ClienteDetalle clienteId={detalle} onClose={() => setDetalle(null)} />}

      {/* Table */}
      <div style={{ background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(197,198,199,0.1)' }}>
              {['Cliente', 'Tipo', 'Contacto', 'Saldo anticipos', 'Estado', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Cargando...</td></tr>
                : clientes.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Sin clientes. Crea el primero (ej. Familia Rojas, Sofi).</td></tr>
                : clientes.map(c => (
                  <tr key={c._id} style={{ borderBottom: '1px solid rgba(197,198,199,0.06)', opacity: c.activo ? 1 : 0.5 }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }} onClick={() => setDetalle(c._id)}>{c.nombre}</td>
                    <td style={tdStyle}><span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(197,198,199,0.1)', fontSize: '11px', color: '#C5C6C7' }}>{c.tipo}</span></td>
                    <td style={{ ...tdStyle, color: '#93A0AB' }}>{c.contacto?.telefono || '—'}</td>
                    <td style={{ ...tdStyle, color: c.saldoAnticipos > 0 ? '#8FD9B0' : '#93A0AB', fontWeight: 600 }}>{fmt(c.saldoAnticipos)}</td>
                    <td style={tdStyle}>{c.activo ? 'Activo' : 'Inactivo'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => setDetalle(c._id)} style={iconBtn}>👁</button>
                      <button onClick={() => edit(c)} style={iconBtn}>✏</button>
                      <button onClick={() => desactivar(c._id)} style={{ ...iconBtn, color: '#f87171' }}>✕</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

// ── Detalle de cliente con anticipos ────────────────────────────
function ClienteDetalle({ clienteId, onClose }) {
  const [data, setData] = useState(null);
  const [anticipo, setAnticipo] = useState({ monto: '', metodoPago: 'transferencia', fecha: new Date().toISOString().split('T')[0], observaciones: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/clientes/${clienteId}/resumen`).then(res => setData(res.data));
  useEffect(() => { load(); }, [clienteId]);

  const addAnticipo = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/anticipos', { ...anticipo, cliente: clienteId, monto: parseFloat(anticipo.monto) || 0 });
      setAnticipo({ ...anticipo, monto: '', observaciones: '' });
      load();
    } catch (err) { alert(err.response?.data?.message || 'Error.'); }
    finally { setSaving(false); }
  };

  const eliminarAnticipo = async (id) => {
    if (!confirm('¿Eliminar anticipo?')) return;
    await api.delete(`/anticipos/${id}`); load();
  };

  return (
    <div style={overlayStyle}><div style={{ ...modalStyle, maxWidth: '620px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>{data?.cliente?.nombre || 'Cliente'}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '20px' }}>×</button>
      </div>

      {!data ? <div style={{ color: '#7C8994' }}>Cargando...</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            <Stat label="Facturado" value={fmt(data.totalFacturado)} />
            <Stat label="Servicios" value={data.numServicios} />
            <Stat label="Saldo anticipos" value={fmt(data.saldoAnticipos)} accent />
          </div>

          <SectionTitle>Registrar anticipo (adelanto)</SectionTitle>
          <form onSubmit={addAnticipo} style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <input type="number" placeholder="Monto" value={anticipo.monto} onChange={e => setAnticipo({ ...anticipo, monto: e.target.value })} required style={{ ...inputStyle, flex: 1, minWidth: '110px' }} />
            <select value={anticipo.metodoPago} onChange={e => setAnticipo({ ...anticipo, metodoPago: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: '120px' }}>
              {['transferencia', 'efectivo', 'nequi', 'daviplata', 'consignacion', 'otro'].map(m => <option key={m} value={m} style={{ background: '#161920' }}>{m}</option>)}
            </select>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving ? '...' : 'Agregar'}</button>
          </form>

          <SectionTitle>Historial de anticipos</SectionTitle>
          {data.anticipos.length === 0 ? <div style={{ color: '#7C8994', fontSize: '13px' }}>Sin anticipos registrados.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.anticipos.map(a => (
                <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0B0C10', borderRadius: '8px', fontSize: '13px' }}>
                  <div>
                    <div style={{ color: '#FFFFFF', fontWeight: 600 }}>{fmt(a.monto)} <span style={{ fontSize: '11px', color: '#7C8994' }}>· {a.metodoPago}</span></div>
                    <div style={{ fontSize: '11.5px', color: '#7C8994' }}>{fmtDate(a.fecha)} · {a.estado} · disp. {fmt(Math.max(0, (a.monto || 0) - (a.montoAplicado || 0)))}</div>
                  </div>
                  <button onClick={() => eliminarAnticipo(a._id)} style={{ ...iconBtn, color: '#f87171' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div></div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div style={{ padding: '12px', background: '#0B0C10', borderRadius: '10px' }}>
    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B6672', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '16px', fontWeight: 700, color: accent ? '#8FD9B0' : '#FFFFFF' }}>{value}</div>
  </div>
);
const Label = ({ children }) => <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>{children}</label>;
const SectionTitle = ({ children }) => <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5B6672', margin: '16px 0 12px' }}>{children}</div>;

const inputStyle = { width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '10px 20px', background: '#1F2833', color: '#C5C6C7', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' };
const iconBtn = { padding: '4px 8px', background: 'transparent', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' };
const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7680', fontWeight: 600 };
const tdStyle = { padding: '14px 16px', fontSize: '13px', color: '#D7DCE0' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' };
const modalStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '16px', padding: '24px 20px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' };

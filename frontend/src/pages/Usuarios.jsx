import React, { useState, useEffect } from 'react';
import api, { fmtDate } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const emptyForm = () => ({ username: '', nombre: '', rol: 'conductor', password: '' });

const DESCRIPCION_ROL = {
  admin: 'Acceso total: dashboard, estadísticas, liquidaciones, clientes, vehículos y usuarios.',
  conductor: 'Solo reporta ingresos y egresos del día y ve su propio historial.'
};

export default function Usuarios() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Contraseña temporal recién generada — se muestra UNA sola vez.
  const [credencial, setCredencial] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get('/usuarios');
      setUsuarios(res.data.usuarios || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setForm(emptyForm());
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const abrirEdicion = (u) => {
    setForm({ username: u.username, nombre: u.nombre, rol: u.rol, password: '' });
    setEditId(u._id);
    setError('');
    setShowForm(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editId) {
        const res = await api.put(`/usuarios/${editId}`, {
          nombre: form.nombre,
          username: form.username,
          rol: form.rol
        });
        setUsuarios(list => list.map(u => u._id === editId ? res.data.usuario : u));
      } else {
        const res = await api.post('/usuarios', {
          username: form.username,
          nombre: form.nombre,
          rol: form.rol,
          // Vacío = el servidor genera una contraseña temporal.
          password: form.password || undefined
        });
        setUsuarios(list => [...list, res.data.usuario]);
        if (res.data.passwordTemporal) {
          setCredencial({ nombre: res.data.usuario.nombre, username: res.data.usuario.username, password: res.data.passwordTemporal });
        }
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const alternarActivo = async (u) => {
    try {
      const res = await api.put(`/usuarios/${u._id}`, { activo: !u.activo });
      setUsuarios(list => list.map(x => x._id === u._id ? res.data.usuario : x));
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo cambiar el estado.');
    }
  };

  const restablecerPassword = async (u) => {
    const manual = prompt(
      `Nueva contraseña para ${u.nombre}.\n\nDéjala vacía y presiona Aceptar para que el sistema genere una temporal.`,
      ''
    );
    if (manual === null) return; // canceló
    try {
      const res = await api.put(`/usuarios/${u._id}/password`, { password: manual || undefined });
      if (res.data.passwordTemporal) {
        setCredencial({ nombre: u.nombre, username: u.username, password: res.data.passwordTemporal });
      } else {
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo cambiar la contraseña.');
    }
  };

  const eliminar = async (u) => {
    if (!confirm(`¿Eliminar a ${u.nombre}? Los registros que capturó se conservan.`)) return;
    try {
      await api.delete(`/usuarios/${u._id}`);
      setUsuarios(list => list.filter(x => x._id !== u._id));
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo eliminar.');
    }
  };

  const admins = usuarios.filter(u => u.rol === 'admin').length;
  const conductores = usuarios.filter(u => u.rol === 'conductor').length;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '84px 16px 90px' : '36px 44px 60px' }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Administración
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
            Usuarios y Accesos
          </h1>
          <div style={{ fontSize: '13px', color: '#8B98A3', marginTop: '6px' }}>
            {admins} administrador{admins === 1 ? '' : 'es'} · {conductores} conductor{conductores === 1 ? '' : 'es'}
          </div>
        </div>
        <button onClick={abrirNuevo} style={btnPrimary}>+ Nuevo Usuario</button>
      </div>

      {/* Contraseña temporal generada */}
      {credencial && (
        <div style={{
          ...cardStyle, marginBottom: '20px',
          borderColor: 'rgba(143,217,176,0.35)', background: 'rgba(143,217,176,0.06)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#8FD9B0', marginBottom: '10px' }}>
            Credenciales de {credencial.nombre}
          </div>
          <div style={{ fontSize: '13px', color: '#C5C6C7', marginBottom: '4px' }}>
            Usuario: <b style={{ fontFamily: 'monospace', fontSize: '15px' }}>{credencial.username}</b>
          </div>
          <div style={{ fontSize: '13px', color: '#C5C6C7' }}>
            Contraseña: <b style={{ fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.05em' }}>{credencial.password}</b>
          </div>
          <div style={{ fontSize: '12px', color: '#e0b055', marginTop: '10px' }}>
            Cópiala ahora y entrégasela en persona: no se vuelve a mostrar. Pídele que la cambie desde "Mi cuenta".
          </div>
          <button onClick={() => setCredencial(null)} style={{ ...btnSecondary, marginTop: '14px' }}>
            Ya la copié
          </button>
        </div>
      )}

      {error && !showForm && (
        <div style={{ ...cardStyle, marginBottom: '20px', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <form onSubmit={guardar} style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '20px' }}>
              {editId ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>

            <div style={{ marginBottom: '14px' }}>
              <Label>Nombre completo</Label>
              <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                style={inputStyle} placeholder="Ej. Carlos Ramírez" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <Label>Usuario (para iniciar sesión)</Label>
              <input required minLength={3} value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                style={inputStyle} placeholder="Ej. carlos" autoCapitalize="none" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <Label>Rol</Label>
              <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} style={inputStyle}>
                <option value="conductor" style={{ background: '#161920' }}>Conductor</option>
                <option value="admin" style={{ background: '#161920' }}>Administrador</option>
              </select>
              <div style={{ fontSize: '12px', color: '#8B98A3', marginTop: '8px', lineHeight: 1.5 }}>
                {DESCRIPCION_ROL[form.rol]}
              </div>
            </div>

            {!editId && (
              <div style={{ marginBottom: '14px' }}>
                <Label>Contraseña (opcional)</Label>
                <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  style={inputStyle} placeholder="Déjala vacía para generar una temporal" autoComplete="new-password" />
                <div style={{ fontSize: '12px', color: '#8B98A3', marginTop: '8px' }}>
                  Mínimo 8 caracteres, con letras y números.
                </div>
              </div>
            )}

            {error && (
              <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '14px' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" disabled={saving} style={btnPrimary}>
                {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear usuario'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={btnSecondary}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div style={{ background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,198,199,0.1)' }}>
                {['Nombre', 'Usuario', 'Rol', 'Estado', 'Último acceso', ''].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Cargando...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Sin usuarios.</td></tr>
              ) : usuarios.map(u => {
                const soyYo = u._id === (user?.id || user?._id);
                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid rgba(197,198,199,0.06)' }}>
                    <td style={{ ...tdStyle, color: '#FFFFFF', fontWeight: 600 }}>
                      {u.nombre}
                      {soyYo && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#7C8994', fontWeight: 400 }}>(tú)</span>}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{u.username}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: u.rol === 'admin' ? 'rgba(197,198,199,0.14)' : 'rgba(143,217,176,0.14)',
                        color: u.rol === 'admin' ? '#C5C6C7' : '#8FD9B0',
                      }}>
                        {u.rol === 'admin' ? 'ADMIN' : 'CONDUCTOR'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: u.activo ? '#8FD9B0' : '#f87171', fontSize: '12.5px' }}>
                        {u.activo ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#7C8994', fontSize: '12.5px' }}>
                      {u.ultimoAcceso ? fmtDate(u.ultimoAcceso) : 'Nunca'}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => abrirEdicion(u)} style={iconBtn} title="Editar">✏</button>
                      <button onClick={() => restablecerPassword(u)} style={iconBtn} title="Restablecer contraseña">🔑</button>
                      {!soyYo && (
                        <button onClick={() => alternarActivo(u)} style={iconBtn} title={u.activo ? 'Desactivar' : 'Activar'}>
                          {u.activo ? '⏸' : '▶'}
                        </button>
                      )}
                      {!soyYo && (
                        <button onClick={() => eliminar(u)} style={{ ...iconBtn, color: '#f87171' }} title="Eliminar">✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '18px', fontSize: '12.5px', color: '#7C8994', lineHeight: 1.6, maxWidth: '640px' }}>
        Desactivar una cuenta cierra su sesión de inmediato sin borrar nada: los registros que capturó
        se conservan. Siempre debe quedar al menos un administrador activo.
      </div>
    </main>
  );
}

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: '11.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B98A3', marginBottom: '6px' }}>
    {children}
  </label>
);

const inputStyle = { width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '8px 16px', background: '#1F2833', color: '#C5C6C7', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px', fontSize: '13px', cursor: 'pointer' };
const iconBtn = { padding: '4px 8px', background: 'transparent', border: 'none', color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px' };
const cardStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', padding: '20px' };
const thStyle = { textAlign: 'left', padding: '13px 16px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7C8994', fontWeight: 600 };
const tdStyle = { padding: '13px 16px', fontSize: '13.5px', color: '#C5C6C7' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' };
const modalStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' };

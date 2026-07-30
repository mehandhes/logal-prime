import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * Página disponible para cualquier usuario autenticado: ver su perfil y
 * cambiar su propia contraseña. Es la contraparte de la contraseña temporal
 * que entrega el administrador al crear una cuenta.
 */
export default function MiCuenta() {
  const { user, esAdmin, cambiarPassword, logout } = useAuth();
  const isMobile = useIsMobile();

  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [estado, setEstado] = useState({ tipo: null, mensaje: '' });
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEstado({ tipo: null, mensaje: '' });

    if (form.nueva !== form.confirmar) {
      return setEstado({ tipo: 'error', mensaje: 'La nueva contraseña y su confirmación no coinciden.' });
    }
    if (form.nueva === form.actual) {
      return setEstado({ tipo: 'error', mensaje: 'La nueva contraseña debe ser distinta a la actual.' });
    }

    setGuardando(true);
    try {
      await cambiarPassword(form.actual, form.nueva);
      setForm({ actual: '', nueva: '', confirmar: '' });
      setEstado({ tipo: 'ok', mensaje: 'Contraseña actualizada. Úsala la próxima vez que inicies sesión.' });
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.response?.data?.message || 'No se pudo cambiar la contraseña.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '84px 16px 90px' : '36px 44px 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
          Sesión
        </div>
        <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
          Mi cuenta
        </h1>
      </div>

      <div style={{ display: 'grid', gap: '20px', maxWidth: '520px' }}>
        {/* Perfil */}
        <div style={cardStyle}>
          <Fila etiqueta="Nombre" valor={user?.nombre} />
          <Fila etiqueta="Usuario" valor={user?.username} mono />
          <Fila
            etiqueta="Rol"
            valor={esAdmin ? 'Administrador · acceso total' : 'Conductor · reporte de ingresos y egresos'}
          />
        </div>

        {/* Cambio de contraseña */}
        <form onSubmit={enviar} style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '18px' }}>
            Cambiar mi contraseña
          </h2>

          <div style={{ marginBottom: '14px' }}>
            <Label>Contraseña actual</Label>
            <input type="password" required autoComplete="current-password" value={form.actual}
              onChange={e => setForm({ ...form, actual: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <Label>Nueva contraseña</Label>
            <input type="password" required minLength={8} autoComplete="new-password" value={form.nueva}
              onChange={e => setForm({ ...form, nueva: e.target.value })} style={inputStyle} />
            <div style={{ fontSize: '12px', color: '#8B98A3', marginTop: '6px' }}>
              Mínimo 8 caracteres, con letras y números.
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <Label>Confirmar nueva contraseña</Label>
            <input type="password" required minLength={8} autoComplete="new-password" value={form.confirmar}
              onChange={e => setForm({ ...form, confirmar: e.target.value })} style={inputStyle} />
          </div>

          {estado.tipo && (
            <div style={{
              fontSize: '13px', marginBottom: '14px', padding: '10px 14px', borderRadius: '8px',
              color: estado.tipo === 'ok' ? '#8FD9B0' : '#f87171',
              background: estado.tipo === 'ok' ? 'rgba(143,217,176,0.08)' : 'rgba(248,113,113,0.08)',
            }}>
              {estado.mensaje}
            </div>
          )}

          <button type="submit" disabled={guardando} style={btnPrimary}>
            {guardando ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>

        <button onClick={logout} style={btnSecondary}>Cerrar sesión</button>
      </div>
    </main>
  );
}

const Fila = ({ etiqueta, valor, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '9px 0', borderBottom: '1px solid rgba(197,198,199,0.07)' }}>
    <span style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C8994' }}>{etiqueta}</span>
    <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>{valor || '—'}</span>
  </div>
);

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: '11.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B98A3', marginBottom: '6px' }}>
    {children}
  </label>
);

const inputStyle = { width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '10px 16px', background: '#1F2833', color: '#C5C6C7', border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px', fontSize: '13px', cursor: 'pointer' };
const cardStyle = { background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', padding: '22px' };

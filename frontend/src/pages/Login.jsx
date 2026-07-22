import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'setup'
  const [form, setForm] = useState({ username: '', password: '', nombre: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'setup') {
        await api.post('/auth/setup', form);
        setMode('login');
        setError('');
        alert('Administrador creado. Inicia sesión.');
      } else {
        await login(form.username, form.password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0C10',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img
            src="/logo.png"
            alt="LOGAL Prime"
            style={{
              width: '440px',
              maxWidth: '95%',
              height: 'auto',
              display: 'block',
              margin: '0 auto 12px auto'
            }}
          />
          <div style={{
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#7C8994',
            fontFamily: "'Montserrat', sans-serif"
          }}>
            Sistema Contable · Transporte Ejecutivo
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#111319',
          border: '1px solid rgba(197,198,199,0.12)',
          borderRadius: '16px',
          padding: '36px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#FFFFFF',
            marginBottom: '28px',
            fontFamily: "'Montserrat', sans-serif"
          }}>
            {mode === 'login' ? 'Iniciar sesión' : 'Configurar administrador'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'setup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Andrés López"
                  required
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>
                Usuario
              </label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                required
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px',
                background: '#C5C6C7',
                color: '#0B0C10',
                border: 'none',
                borderRadius: '9px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '4px',
                letterSpacing: '0.02em'
              }}
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear administrador'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            {mode === 'login' ? (
              <button
                onClick={() => setMode('setup')}
                style={{ background: 'none', border: 'none', color: '#7C8994', fontSize: '13px', cursor: 'pointer' }}
              >
                Primera vez? Configurar administrador →
              </button>
            ) : (
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: '#7C8994', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Volver al login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#161920',
  border: '1px solid rgba(197,198,199,0.15)',
  borderRadius: '8px',
  color: '#FFFFFF',
  padding: '10px 14px',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit'
};

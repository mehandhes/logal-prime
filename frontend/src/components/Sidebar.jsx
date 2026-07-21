import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../context/VehicleContext';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/registro-diario', label: 'Registro Diario' },
  { path: '/pagos', label: 'Pagos y Liquidación' },
  { path: '/estadisticas', label: 'Estadísticas' },
  { path: '/proyecciones', label: 'Proyecciones' },
  { path: '/mantenimiento', label: 'Mantenimiento' },
  { path: '/vehiculos', label: 'Vehículos' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { selectedVehicle, vehicles, setSelectedVehicle } = useVehicles();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: '264px',
      flexShrink: 0,
      background: '#111319',
      borderRight: '1px solid rgba(197,198,199,0.12)',
      display: 'flex',
      flexDirection: 'column',
      padding: '32px 22px',
      minHeight: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '36px' }}>
        <img
          src="/logo.png"
          alt="LOGAL Prime"
          style={{
            width: '180px',
            height: 'auto',
            display: 'block',
            marginBottom: '6px'
          }}
        />
        <div style={{
          fontSize: '10px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#7C8994',
          fontFamily: "'Montserrat', sans-serif"
        }}>
          Transporte Ejecutivo
        </div>
      </div>

      {/* Vehicle selector */}
      {vehicles.length > 1 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '10.5px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#5B6672',
            marginBottom: '8px'
          }}>Vehículo</div>
          <select
            value={selectedVehicle?._id || ''}
            onChange={e => {
              const v = vehicles.find(x => x._id === e.target.value);
              setSelectedVehicle(v);
            }}
            style={{
              width: '100%',
              background: '#161920',
              border: '1px solid rgba(197,198,199,0.15)',
              borderRadius: '8px',
              color: '#FFFFFF',
              padding: '8px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {vehicles.map(v => (
              <option key={v._id} value={v._id} style={{ background: '#161920' }}>
                {v.placa} · {v.conductor}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nav section label */}
      <div style={{
        fontSize: '10.5px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#5B6672',
        marginBottom: '14px'
      }}>
        Contabilidad
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '32px' }}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '8px',
              background: isActive ? '#1F2833' : 'transparent',
              color: isActive ? '#FFFFFF' : '#93A0AB',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isActive ? '#C5C6C7' : 'transparent',
                  border: isActive ? 'none' : '1px solid rgba(147,160,171,0.4)',
                  flexShrink: 0
                }} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Vehicle info + user */}
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(197,198,199,0.1)' }}>
        {selectedVehicle && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            background: '#161920',
            borderRadius: '10px',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#1F2833',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              color: '#C5C6C7',
              letterSpacing: '0.02em',
              flexShrink: 0
            }}>
              {selectedVehicle.placa?.slice(-3)}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{selectedVehicle.placa}</div>
              <div style={{ fontSize: '11.5px', color: '#7C8994' }}>Conductor: {selectedVehicle.conductor}</div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '9px 14px',
            background: 'transparent',
            border: '1px solid rgba(197,198,199,0.15)',
            borderRadius: '8px',
            color: '#7C8994',
            fontSize: '13px',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '16px' }}>↩</span>
          Cerrar sesión · {user?.nombre?.split(' ')[0]}
        </button>
      </div>
    </aside>
  );
}

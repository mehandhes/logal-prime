import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VehicleProvider } from './context/VehicleContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RegistroDiario from './pages/RegistroDiario';
import Pagos from './pages/Pagos';
import Estadisticas from './pages/Estadisticas';
import Mantenimiento from './pages/Mantenimiento';
import Vehiculos from './pages/Vehiculos';
import { useIsMobile } from './hooks/useIsMobile';

const BOTTOM_NAV = [
  { path: '/dashboard',      label: 'Dashboard',  icon: '📊' },
  { path: '/registro-diario',label: 'Registro',   icon: '📝' },
  { path: '/pagos',          label: 'Pagos',      icon: '💰' },
  { path: '/estadisticas',   label: 'Stats',      icon: '📈' },
  { path: '/mantenimiento',  label: 'Mantto',     icon: '🔧' },
];

function MobileTopBar({ onMenuClick }) {
  return (
    <div
      className="mobile-top-bar"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '68px',
        background: '#111319', borderBottom: '1px solid rgba(197,198,199,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 150,
      }}
    >
      <button
        onClick={onMenuClick}
        style={{
          background: 'rgba(197,198,199,0.08)', border: 'none',
          borderRadius: '8px', color: '#C5C6C7', width: '38px', height: '38px',
          fontSize: '18px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        ☰
      </button>
      <img src="/logo.png" alt="LOGAL Prime" style={{ height: '52px', width: 'auto' }} />
      <div style={{ width: '38px' }} /> {/* Spacer to center logo */}
    </div>
  );
}

function MobileBottomNav() {
  return (
    <div
      className="mobile-bottom-nav"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#111319', borderTop: '1px solid rgba(197,198,199,0.12)',
        display: 'flex', zIndex: 150,
      }}
    >
      {BOTTOM_NAV.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '10px 4px 12px',
            textDecoration: 'none',
            color: isActive ? '#C5C6C7' : '#5B6672',
            background: isActive ? 'rgba(197,198,199,0.06)' : 'transparent',
            borderTop: isActive ? '2px solid #C5C6C7' : '2px solid transparent',
            transition: 'all 0.15s ease',
          })}
        >
          <span style={{ fontSize: '18px', lineHeight: 1, marginBottom: '4px' }}>{item.icon}</span>
          <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.02em' }}>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0B0C10',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: '28px', color: '#C5C6C7', letterSpacing: '0.04em',
        }}>
          LOGAL Prime
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <VehicleProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0B0C10' }}>
        {/* Mobile top bar */}
        {isMobile && <MobileTopBar onMenuClick={() => setSidebarOpen(true)} />}

        {/* Sidebar — desktop: fixed left; mobile: drawer */}
        <Sidebar
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Drawer overlay — closes sidebar when tapping outside */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 199,
            }}
          />
        )}

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>

        {/* Mobile bottom navigation */}
        {isMobile && <MobileBottomNav />}
      </div>
    </VehicleProvider>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/registro-diario" element={<ProtectedLayout><RegistroDiario /></ProtectedLayout>} />
      <Route path="/pagos" element={<ProtectedLayout><Pagos /></ProtectedLayout>} />
      <Route path="/estadisticas" element={<ProtectedLayout><Estadisticas /></ProtectedLayout>} />
      <Route path="/proyecciones" element={<ProtectedLayout><Estadisticas /></ProtectedLayout>} />
      <Route path="/mantenimiento" element={<ProtectedLayout><Mantenimiento /></ProtectedLayout>} />
      <Route path="/vehiculos" element={<ProtectedLayout><Vehiculos /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

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
import Clientes from './pages/Clientes';
import Usuarios from './pages/Usuarios';
import MiCuenta from './pages/MiCuenta';
import { useIsMobile } from './hooks/useIsMobile';

// Navegación inferior (móvil) según el rol.
const BOTTOM_NAV_ADMIN = [
  { path: '/dashboard',      label: 'Dashboard',  icon: '📊' },
  { path: '/registro-diario',label: 'Registro',   icon: '📝' },
  { path: '/pagos',          label: 'Pagos',      icon: '💰' },
  { path: '/estadisticas',   label: 'Stats',      icon: '📈' },
  { path: '/mantenimiento',  label: 'Mantto',     icon: '🔧' },
];

// El conductor solo reporta: su formulario, su historial y su cuenta.
const BOTTOM_NAV_CONDUCTOR = [
  { path: '/registro-diario', label: 'Registrar', icon: '📝' },
  { path: '/mi-cuenta',       label: 'Mi cuenta', icon: '👤' },
];

// Ruta de inicio de cada rol.
const INICIO_POR_ROL = { admin: '/dashboard', conductor: '/registro-diario' };

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
  const { esConductor } = useAuth();
  const items = esConductor ? BOTTOM_NAV_CONDUCTOR : BOTTOM_NAV_ADMIN;
  return (
    <div
      className="mobile-bottom-nav"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#111319', borderTop: '1px solid rgba(197,198,199,0.12)',
        display: 'flex', zIndex: 150,
      }}
    >
      {items.map(item => (
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

/**
 * Envuelve una página que solo puede ver el administrador. Si entra un
 * conductor (escribiendo la URL a mano, por ejemplo) se le devuelve a su
 * pantalla de trabajo en vez de mostrarle un error.
 *
 * Esto es solo la capa visual: el backend rechaza igual la petición con 403
 * aunque alguien manipule el frontend.
 */
function SoloAdmin({ children }) {
  const { esAdmin } = useAuth();
  if (!esAdmin) return <Navigate to="/registro-diario" replace />;
  return children;
}

function AppRoutes() {
  const { user, rol } = useAuth();
  const inicio = INICIO_POR_ROL[rol] || '/registro-diario';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={inicio} replace /> : <Login />} />

      {/* Compartidas: el conductor entra aquí a reportar */}
      <Route path="/registro-diario" element={<ProtectedLayout><RegistroDiario /></ProtectedLayout>} />
      <Route path="/mi-cuenta" element={<ProtectedLayout><MiCuenta /></ProtectedLayout>} />

      {/* Exclusivas del administrador */}
      <Route path="/dashboard" element={<ProtectedLayout><SoloAdmin><Dashboard /></SoloAdmin></ProtectedLayout>} />
      <Route path="/pagos" element={<ProtectedLayout><SoloAdmin><Pagos /></SoloAdmin></ProtectedLayout>} />
      <Route path="/estadisticas" element={<ProtectedLayout><SoloAdmin><Estadisticas /></SoloAdmin></ProtectedLayout>} />
      <Route path="/proyecciones" element={<ProtectedLayout><SoloAdmin><Estadisticas /></SoloAdmin></ProtectedLayout>} />
      <Route path="/mantenimiento" element={<ProtectedLayout><SoloAdmin><Mantenimiento /></SoloAdmin></ProtectedLayout>} />
      <Route path="/vehiculos" element={<ProtectedLayout><SoloAdmin><Vehiculos /></SoloAdmin></ProtectedLayout>} />
      <Route path="/clientes" element={<ProtectedLayout><SoloAdmin><Clientes /></SoloAdmin></ProtectedLayout>} />
      <Route path="/usuarios" element={<ProtectedLayout><SoloAdmin><Usuarios /></SoloAdmin></ProtectedLayout>} />

      <Route path="*" element={<Navigate to={inicio} replace />} />
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

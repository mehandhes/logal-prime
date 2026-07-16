import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0B0C10',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '32px', color: '#C5C6C7', letterSpacing: '0.04em'
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
        <Sidebar />
        {children}
      </div>
    </VehicleProvider>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      } />
      <Route path="/registro-diario" element={
        <ProtectedLayout><RegistroDiario /></ProtectedLayout>
      } />
      <Route path="/pagos" element={
        <ProtectedLayout><Pagos /></ProtectedLayout>
      } />
      <Route path="/estadisticas" element={
        <ProtectedLayout><Estadisticas /></ProtectedLayout>
      } />
      <Route path="/proyecciones" element={
        <ProtectedLayout><Estadisticas /></ProtectedLayout>
      } />
      <Route path="/mantenimiento" element={
        <ProtectedLayout><Mantenimiento /></ProtectedLayout>
      } />
      <Route path="/vehiculos" element={
        <ProtectedLayout><Vehiculos /></ProtectedLayout>
      } />
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

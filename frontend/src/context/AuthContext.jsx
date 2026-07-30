import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('logal_user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se revalida el token contra el servidor en cada carga. Esto también
    // refresca el rol: si el admin cambió los permisos de alguien, aplica
    // sin esperar a que caduque la sesión.
    const token = localStorage.getItem('logal_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          localStorage.setItem('logal_user', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('logal_token');
          localStorage.removeItem('logal_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('logal_token', res.data.token);
    localStorage.setItem('logal_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('logal_token');
    localStorage.removeItem('logal_user');
    setUser(null);
  };

  const cambiarPassword = async (passwordActual, passwordNueva) => {
    const res = await api.post('/auth/cambiar-password', { passwordActual, passwordNueva });
    if (res.data.token) localStorage.setItem('logal_token', res.data.token);
    return res.data;
  };

  // El rol es la única fuente de verdad para la interfaz. Ojo: esto solo
  // controla lo que se muestra; quien manda de verdad es el backend, que
  // valida el rol en cada endpoint.
  const rol = user?.rol || null;
  const esAdmin = rol === 'admin';
  const esConductor = rol === 'conductor';

  return (
    <AuthContext.Provider value={{
      user, rol, esAdmin, esConductor,
      login, logout, cambiarPassword, loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

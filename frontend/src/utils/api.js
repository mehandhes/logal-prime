import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('logal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('logal_token');
      localStorage.removeItem('logal_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Helpers ──────────────────────────────────────────────────
const nfCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// Moneda en pesos colombianos, siempre con el valor completo: $147.000
// Intl mete un espacio duro (U+00A0) entre el símbolo y la cifra ("$ 147.000").
// Se elimina para que se lea compacto y quepa en las tarjetas del dashboard.
export const fmt = (n) => {
  const v = Number(n);
  return nfCOP.format(Number.isFinite(v) ? v : 0).replace(/[\s\u00A0\u202F]/g, '');
};

// Antes abreviaba a "$147k" / "$1.0M". En una app contable el usuario necesita
// la cifra exacta en pesos, no la escala, así que ya no se abrevia.
// Se mantiene el nombre exportado para no romper los imports existentes.
export const fmtShort = fmt;

// Como las cifras van completas, una cifra larga ($12.450.000) puede desbordar
// una tarjeta. Esto reduce el tamaño de letra de forma proporcional.
// `base`  = tamaño en px cuando la cifra cabe holgada
// `holgura` = cuántos caracteres caben a ese tamaño en la columna más angosta
export const fmtFontSize = (value, base = 27, holgura = 9, min = 16) => {
  const len = String(value ?? '').length;
  if (len <= holgura) return `${base}px`;
  return `${Math.max(min, Math.round((base * holgura) / len))}px`;
};

export const fmtDate = (d) => {
  if (!d) return '—';
  // Las fechas se guardan como fecha-solo en UTC (medianoche). Se formatea en
  // UTC para que NO se corra un día en zonas horarias negativas (ej. Colombia UTC-5).
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

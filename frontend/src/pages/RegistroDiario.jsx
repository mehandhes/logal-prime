import React, { useState, useEffect } from 'react';
import api, { fmt, fmtDate } from '../utils/api';
import { useVehicles } from '../context/VehicleContext';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { exportarRegistrosExcel, leerExcel, imprimirPDF } from '../utils/exportar';

const TIPOS_INGRESO = ['Empresarial', 'Ejecutivo', 'Aeropuerto', 'Turismo', 'Otro'];

// Espejo de la regla del backend (backend/src/routes/registros.js): el
// conductor corrige su registro mientras sea de hoy o lleve menos de 6 horas
// de creado. Aquí solo se usa para no mostrar un botón que va a fallar.
const HORAS_GRACIA_EDICION = 6;
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

function conductorPuedeEditar(r) {
  if (!r) return false;
  const esDeHoy = new Date(r.fecha).toISOString().slice(0, 10) === hoyBogota();
  const horas = r.createdAt ? (Date.now() - new Date(r.createdAt).getTime()) / 3600000 : Infinity;
  return esDeHoy || horas <= HORAS_GRACIA_EDICION;
}

const emptyForm = () => ({
  fecha: new Date().toISOString().split('T')[0],
  conductor: '',
  ingresos: { tipo: 'Empresarial', efectivo: '', consignacion: '', descripcion: '', numViajes: 1 },
  ingresosPorCliente: [],   // [{ clienteId, nombre, valor }]
  combustible: '',
  galones: '',
  peajes: '',
  lavadas: '',
  indrive: '',
  otros: '',
  otrosDescripcion: '',
  kmInicio: '',
  kmFin: '',
  pagoConductor: '',
  observaciones: ''
});

// Suma segura de campos numéricos del formulario
const n = (v) => parseFloat(v) || 0;

// Mapea una fila cruda de Excel a un payload de registro, para importar.
function mapearFilaExcel(fila, vehiculo, clientes) {
  const keys = Object.keys(fila);
  const buscar = (re) => {
    const k = keys.find(k => re.test(k));
    return k ? fila[k] : '';
  };
  const numero = (v) => {
    if (typeof v === 'number') return v;
    const x = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(x) ? x : 0;
  };
  let fecha = buscar(/fecha/i);
  if (fecha instanceof Date) fecha = fecha.toISOString().split('T')[0];
  else if (typeof fecha === 'string' && fecha) {
    const d = new Date(fecha);
    if (!isNaN(d)) fecha = d.toISOString().split('T')[0];
  }

  // Ingresos por cliente: columnas cuyo encabezado menciona "Cliente".
  const ingresosPorCliente = [];
  keys.filter(k => /cliente/i.test(k)).forEach(k => {
    const valor = numero(fila[k]);
    if (valor > 0) {
      const nombre = k.replace(/cliente\s*\d*/i, '').trim() || k.trim();
      const match = clientes.find(c => nombre && c.nombre.toLowerCase().includes(nombre.toLowerCase().split(' ')[0]));
      ingresosPorCliente.push({ cliente: match?._id, nombre: match?.nombre || nombre, valor });
    }
  });

  return {
    fecha,
    vehiculo: vehiculo?._id,
    placa: vehiculo?.placa || '',
    conductor: vehiculo?.conductor || buscar(/conductor/i) || '',
    ingresos: {
      tipo: 'Empresarial',
      pasajes: numero(buscar(/pasaje|ingreso.*pasaje|^ingresos$/i)),
      numViajes: 1
    },
    ingresosPorCliente,
    combustible: numero(buscar(/combustible/i)),
    galones: numero(buscar(/galon/i)),
    peajes: numero(buscar(/peaje/i)),
    lavadas: numero(buscar(/lavad/i)),
    indrive: numero(buscar(/indrive/i)),
    otros: numero(buscar(/otros?\s*egreso|otros/i)),
    kmInicio: numero(buscar(/inicio/i)),
    kmFin: numero(buscar(/final|fin/i)),
    pagoConductor: numero(buscar(/pago.*conductor/i)),
    observaciones: String(buscar(/observ/i) || '')
  };
}

export default function RegistroDiario() {
  const { vehicles, selectedVehicle } = useVehicles();
  const { esAdmin, esConductor } = useAuth();
  const isMobile = useIsMobile();
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState('');
  const [clientes, setClientes] = useState([]);
  const [advertencias, setAdvertencias] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ show: false, nombre: '', frecuenciaPago: 'mensual', saving: false });

  const fetchRegistros = () => {
    setLoading(true);
    api.get('/registros', {
      params: { vehiculo: filterVehicle || selectedVehicle?._id, page, limit: 20 }
    }).then(res => {
      setRegistros(res.data.registros);
      setTotal(res.data.total);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRegistros(); }, [selectedVehicle, page, filterVehicle]);

  const fetchClientes = () => api.get('/clientes', { params: { activo: true } })
    .then(res => { setClientes(res.data.clientes || []); return res.data.clientes || []; })
    .catch(() => { setClientes([]); return []; });
  useEffect(() => { fetchClientes(); }, []);

  // Crea un cliente nuevo desde el formulario y lo agrega como fila de ingreso.
  const crearClienteRapido = async () => {
    if (!nuevoCliente.nombre.trim()) return;
    setNuevoCliente(nc => ({ ...nc, saving: true }));
    try {
      const res = await api.post('/clientes', {
        nombre: nuevoCliente.nombre.trim(),
        frecuenciaPago: nuevoCliente.frecuenciaPago,
        tipo: 'fijo'
      });
      await fetchClientes();
      setForm(f => ({ ...f, ingresosPorCliente: [...f.ingresosPorCliente, { clienteId: res.data._id, nombre: res.data.nombre, valor: '' }] }));
      setNuevoCliente({ show: false, nombre: '', frecuenciaPago: 'mensual', saving: false });
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo crear el cliente.');
      setNuevoCliente(nc => ({ ...nc, saving: false }));
    }
  };

  // Precarga el km inicio con el km fin del último registro del vehículo.
  const precargarOdometro = (vehiculoId) => {
    if (!vehiculoId) return;
    api.get('/registros/ultimo', { params: { vehiculo: vehiculoId } })
      .then(res => {
        const km = res.data.registro?.kmFin;
        if (km) setForm(f => ({ ...f, kmInicio: f.kmInicio || String(km) }));
      }).catch(() => {});
  };

  const openNuevo = () => {
    const vId = selectedVehicle?._id;
    setEditId(null);
    setForm({ ...emptyForm(), vehiculoId: vId, conductor: selectedVehicle?.conductor || '' });
    setAdvertencias([]);
    setShowForm(true);
    precargarOdometro(vId);
  };

  const addCliente = () => setForm(f => ({
    ...f, ingresosPorCliente: [...f.ingresosPorCliente, { clienteId: '', nombre: '', valor: '' }]
  }));
  const updateCliente = (i, patch) => setForm(f => {
    const lista = [...f.ingresosPorCliente];
    lista[i] = { ...lista[i], ...patch };
    return { ...f, ingresosPorCliente: lista };
  });
  const removeCliente = (i) => setForm(f => ({
    ...f, ingresosPorCliente: f.ingresosPorCliente.filter((_, idx) => idx !== i)
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vehiculoId = form.vehiculoId || selectedVehicle?._id;
      const vehiculo = vehicles.find(v => v._id === vehiculoId);
      const ingresosPorCliente = form.ingresosPorCliente
        .filter(c => n(c.valor) > 0)
        .map(c => {
          const cli = clientes.find(x => x._id === c.clienteId);
          return { cliente: c.clienteId || undefined, nombre: cli?.nombre || c.nombre || 'Cliente', valor: n(c.valor) };
        });
      const payload = {
        vehiculo: vehiculoId,
        placa: vehiculo?.placa || '',
        conductor: form.conductor || vehiculo?.conductor || '',
        fecha: form.fecha,
        ingresos: {
          tipo: form.ingresos.tipo,
          descripcion: form.ingresos.descripcion,
          efectivo: n(form.ingresos.efectivo),
          consignacion: n(form.ingresos.consignacion),
          numViajes: parseInt(form.ingresos.numViajes) || 1
        },
        ingresosPorCliente,
        combustible: n(form.combustible),
        galones: n(form.galones),
        peajes: n(form.peajes),
        lavadas: n(form.lavadas),
        indrive: n(form.indrive),
        otros: n(form.otros),
        otrosDescripcion: form.otrosDescripcion,
        kmInicio: parseInt(form.kmInicio) || 0,
        kmFin: parseInt(form.kmFin) || 0,
        pagoConductor: n(form.pagoConductor),
        observaciones: form.observaciones
      };

      if (editId) {
        await api.put(`/registros/${editId}`, payload);
        cerrarForm();
      } else {
        const res = await api.post('/registros', payload);
        const avisos = res.data?.advertencias || [];
        if (avisos.length > 0) {
          setAdvertencias(avisos);
          // No cerrar el modal; mostrar las advertencias y dejar continuar.
        } else {
          cerrarForm();
        }
      }
      fetchRegistros();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const cerrarForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
    setAdvertencias([]);
  };

  const handleEdit = (r) => {
    setForm({
      fecha: r.fecha?.split('T')[0] || '',
      vehiculoId: r.vehiculo?._id || r.vehiculo,
      conductor: r.conductor || '',
      ingresos: {
        tipo: r.ingresos?.tipo || 'Empresarial',
        descripcion: r.ingresos?.descripcion || '',
        numViajes: r.ingresos?.numViajes || 1,
        // Compat: registros viejos guardaban en pasajes/valor -> se muestra en efectivo.
        efectivo: (r.ingresos?.efectivo ?? r.ingresos?.pasajes ?? r.ingresos?.valor)?.toString() || '',
        consignacion: r.ingresos?.consignacion?.toString() || ''
      },
      ingresosPorCliente: (r.ingresosPorCliente || []).map(i => ({
        clienteId: i.cliente?._id || i.cliente || '', nombre: i.nombre || '', valor: i.valor?.toString() || ''
      })),
      combustible: r.combustible?.toString() || '',
      galones: r.galones?.toString() || '',
      peajes: r.peajes?.toString() || '',
      lavadas: r.lavadas?.toString() || '',
      indrive: r.indrive?.toString() || '',
      otros: r.otros?.toString() || '',
      otrosDescripcion: r.otrosDescripcion || '',
      kmInicio: r.kmInicio?.toString() || '',
      kmFin: r.kmFin?.toString() || '',
      pagoConductor: r.pagoConductor?.toString() || '',
      observaciones: r.observaciones || ''
    });
    setEditId(r._id);
    setAdvertencias([]);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await api.delete(`/registros/${id}`);
    fetchRegistros();
  };

  const exportarExcel = () => exportarRegistrosExcel(registros, 'logal-prime-registros');
  const exportarPDF = () => {
    const filas = registros.map(r => `<tr>
      <td>${fmtDate(r.fecha)}</td><td>${r.placa || ''}</td>
      <td>${fmt(r.totalIngresos ?? r.ingresos?.valor)}</td>
      <td>${fmt(r.totalEgresos)}</td>
      <td>${fmt(r.utilidadNeta)}</td></tr>`).join('');
    const tabla = `<table><thead><tr><th>Fecha</th><th>Vehículo</th><th>Ingresos</th><th>Egresos</th><th>Utilidad</th></tr></thead><tbody>${filas}</tbody></table>`;
    const tot = registros.reduce((a, r) => {
      a.i += r.totalIngresos ?? r.ingresos?.valor ?? 0; a.e += r.totalEgresos || 0; a.u += r.utilidadNeta || 0; return a;
    }, { i: 0, e: 0, u: 0 });
    const resumen = `<div><span>Total ingresos</span><span>${fmt(tot.i)}</span></div>
      <div><span>Total egresos</span><span>${fmt(tot.e)}</span></div>
      <div><b>Utilidad operativa</b><b>${fmt(tot.u)}</b></div>`;
    imprimirPDF('Registro Diario', tabla, resumen);
  };

  const totalPages = Math.ceil(total / 20);
  const grid2 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' };
  const grid3 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' };

  const totalIngresosForm = n(form.ingresos.efectivo) + n(form.ingresos.consignacion) + form.ingresosPorCliente.reduce((s, c) => s + n(c.valor), 0);
  const totalEgresosForm = n(form.combustible) + n(form.peajes) + n(form.lavadas) + n(form.indrive) + n(form.otros);
  const kmDiaForm = Math.max(0, (parseInt(form.kmFin) || 0) - (parseInt(form.kmInicio) || 0));

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '84px 16px 90px' : '36px 44px 60px', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', marginBottom: '24px', gap: isMobile ? '12px' : '0',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C8994', marginBottom: '8px' }}>
            Movimientos
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: isMobile ? '26px' : '32px', color: '#FFFFFF' }}>
            {esConductor ? 'Mis Registros' : 'Registro Diario'}
          </h1>
          {esConductor && (
            <div style={{ fontSize: '13px', color: '#8B98A3', marginTop: '6px' }}>
              Reporta los ingresos y egresos del día. Puedes corregir el registro de hoy;
              después solo lo ajusta el administrador.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Importar y exportar son herramientas de contabilidad: solo admin */}
          {esAdmin && <button onClick={() => setShowImport(true)} style={btnSecondary}>⭳ Importar Excel</button>}
          {esAdmin && <button onClick={exportarExcel} style={btnSecondary} disabled={!registros.length}>⭱ Excel</button>}
          {esAdmin && <button onClick={exportarPDF} style={btnSecondary} disabled={!registros.length}>🖶 PDF</button>}
          <button onClick={openNuevo} style={btnPrimary}>+ Nuevo Registro</button>
        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          vehicles={vehicles}
          selectedVehicle={selectedVehicle}
          clientes={clientes}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); fetchRegistros(); }}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '24px' }}>
              {editId ? 'Editar Registro' : 'Nuevo Registro'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={grid2}>
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                </div>
                <div>
                  <Label>Vehículo</Label>
                  <select
                    value={form.vehiculoId || selectedVehicle?._id || ''}
                    onChange={e => {
                      const v = vehicles.find(x => x._id === e.target.value);
                      setForm({ ...form, vehiculoId: e.target.value, conductor: v?.conductor || form.conductor });
                      precargarOdometro(e.target.value);
                    }}
                    style={inputStyle}
                  >
                    {vehicles.map(v => (
                      <option key={v._id} value={v._id} style={{ background: '#161920' }}>{v.placa} · {v.conductor}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: isMobile ? 'auto' : '1/-1' }}>
                  <Label>Conductor</Label>
                  <Input value={form.conductor} onChange={e => setForm({ ...form, conductor: e.target.value })} placeholder="Nombre del conductor" />
                </div>
              </div>

              <SectionTitle>Ingresos</SectionTitle>
              <div style={grid2}>
                <div>
                  <Label>Efectivo</Label>
                  <Input type="number" min="0" step="100" value={form.ingresos.efectivo}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, efectivo: e.target.value } })} />
                </div>
                <div>
                  <Label>Consignación</Label>
                  <Input type="number" min="0" step="100" value={form.ingresos.consignacion}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, consignacion: e.target.value } })} />
                </div>
                <div>
                  <Label>Tipo de servicio</Label>
                  <select
                    value={form.ingresos.tipo}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, tipo: e.target.value } })}
                    style={inputStyle}
                  >
                    {TIPOS_INGRESO.map(t => <option key={t} value={t} style={{ background: '#161920' }}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Número de viajes</Label>
                  <Input type="number" min="1" value={form.ingresos.numViajes}
                    onChange={e => setForm({ ...form, ingresos: { ...form.ingresos, numViajes: e.target.value } })} />
                </div>
              </div>

              {/* Ingresos por cliente (dinámico) */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <Label>Ingresos por cliente</Label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={addCliente} style={{ ...btnSecondary, padding: '4px 12px', fontSize: '12px' }}>+ Cliente</button>
                    <button type="button" onClick={() => setNuevoCliente(nc => ({ ...nc, show: !nc.show }))} style={{ ...btnSecondary, padding: '4px 12px', fontSize: '12px' }}>+ Nuevo cliente</button>
                  </div>
                </div>

                {/* Crear cliente nuevo al vuelo */}
                {nuevoCliente.show && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', padding: '10px', background: '#0B0C10', borderRadius: '8px', flexWrap: 'wrap' }}>
                    <input placeholder="Nombre del cliente" value={nuevoCliente.nombre}
                      onChange={e => setNuevoCliente(nc => ({ ...nc, nombre: e.target.value }))}
                      style={{ ...inputStyle, flex: 2, minWidth: '140px' }} />
                    <select value={nuevoCliente.frecuenciaPago}
                      onChange={e => setNuevoCliente(nc => ({ ...nc, frecuenciaPago: e.target.value }))}
                      style={{ ...inputStyle, flex: 1, minWidth: '120px' }}>
                      {['diario', 'semanal', 'quincenal', 'mensual'].map(f => <option key={f} value={f} style={{ background: '#161920' }}>{f}</option>)}
                    </select>
                    <button type="button" onClick={crearClienteRapido} disabled={nuevoCliente.saving} style={{ ...btnPrimary, padding: '8px 14px', fontSize: '12px' }}>
                      {nuevoCliente.saving ? '...' : 'Crear'}
                    </button>
                  </div>
                )}

                {form.ingresosPorCliente.length === 0 && !nuevoCliente.show && (
                  <div style={{ fontSize: '12px', color: '#5B6672', marginBottom: '4px' }}>
                    {clientes.length === 0
                      ? 'No hay clientes aún. Usa "+ Nuevo cliente" para crear el primero (ej. Familia Rojas, Sofi).'
                      : 'Agrega los ingresos de clientes fijos, o crea uno nuevo.'}
                  </div>
                )}
                {form.ingresosPorCliente.map((c, i) => {
                  const cli = clientes.find(x => x._id === c.clienteId);
                  return (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={c.clienteId} onChange={e => updateCliente(i, { clienteId: e.target.value })}
                          style={{ ...inputStyle, flex: 2 }}>
                          <option value="" style={{ background: '#161920' }}>Selecciona cliente…</option>
                          {clientes.map(cl => <option key={cl._id} value={cl._id} style={{ background: '#161920' }}>{cl.nombre}</option>)}
                        </select>
                        <input type="number" min="0" step="100" placeholder="Valor" value={c.valor}
                          onChange={e => updateCliente(i, { valor: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <button type="button" onClick={() => removeCliente(i)} style={{ ...iconBtn, color: '#f87171' }}>✕</button>
                      </div>
                      {cli && (
                        <div style={{ fontSize: '11px', color: '#5B6672', marginTop: '3px', marginLeft: '2px' }}>
                          Frecuencia de pago: {cli.frecuenciaPago || 'mensual'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <SectionTitle>Egresos</SectionTitle>
              <div style={grid3}>
                <div><Label>Combustible</Label>
                  <Input type="number" min="0" step="100" value={form.combustible} onChange={e => setForm({ ...form, combustible: e.target.value })} /></div>
                <div><Label>Galones (cantidad)</Label>
                  <Input type="number" min="0" step="0.001" value={form.galones} onChange={e => setForm({ ...form, galones: e.target.value })} /></div>
                <div><Label>Peajes</Label>
                  <Input type="number" min="0" step="100" value={form.peajes} onChange={e => setForm({ ...form, peajes: e.target.value })} /></div>
                <div><Label>Lavadas</Label>
                  <Input type="number" min="0" step="100" value={form.lavadas} onChange={e => setForm({ ...form, lavadas: e.target.value })} /></div>
                <div><Label>Indrive</Label>
                  <Input type="number" min="0" step="100" value={form.indrive} onChange={e => setForm({ ...form, indrive: e.target.value })} /></div>
                <div><Label>Otros gastos</Label>
                  <Input type="number" min="0" step="100" value={form.otros} onChange={e => setForm({ ...form, otros: e.target.value })} /></div>
              </div>

              <SectionTitle>{esAdmin ? 'Kilometraje y pago al conductor' : 'Kilometraje'}</SectionTitle>
              <div style={esAdmin ? grid3 : grid2}>
                <div><Label>Km inicio</Label>
                  <Input type="number" min="0" value={form.kmInicio} onChange={e => setForm({ ...form, kmInicio: e.target.value })} /></div>
                <div><Label>Km fin</Label>
                  <Input type="number" min="0" value={form.kmFin} onChange={e => setForm({ ...form, kmFin: e.target.value })} /></div>
                {/* El pago al conductor lo decide la empresa: el backend ignora
                    este campo si lo envía un conductor. */}
                {esAdmin && (
                  <div><Label>Pago al conductor</Label>
                    <Input type="number" min="0" step="100" value={form.pagoConductor} onChange={e => setForm({ ...form, pagoConductor: e.target.value })} /></div>
                )}
              </div>
              <div style={{ marginTop: '10px', padding: '8px 14px', background: '#0B0C10', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B98A3' }}>Total Km del día:</span>
                <span style={{ color: '#C5C6C7', fontWeight: 600 }}>{kmDiaForm.toLocaleString('es-CO')} km</span>
              </div>

              <div style={{ marginTop: '16px' }}>
                <Label>Observaciones</Label>
                <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Novedades del día..." />
              </div>

              {/* Advertencias de validación */}
              {advertencias.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', marginBottom: '6px' }}>Revisa estas alertas:</div>
                  {advertencias.map((a, i) => (
                    <div key={i} style={{ fontSize: '12.5px', color: a.tipo === 'error' ? '#f87171' : '#e0b055', marginBottom: '3px' }}>• {a.mensaje}</div>
                  ))}
                  <div style={{ fontSize: '11.5px', color: '#8B98A3', marginTop: '6px' }}>El registro ya se guardó. Puedes cerrar o editarlo.</div>
                </div>
              )}

              {/* Preview */}
              {(totalIngresosForm > 0 || totalEgresosForm > 0) && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: '#0B0C10', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B98A3', marginBottom: '4px' }}>
                    <span>Total ingresos:</span><span style={{ color: '#C5C6C7' }}>{fmt(totalIngresosForm)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B98A3', marginBottom: '4px' }}>
                    <span>Total egresos:</span><span style={{ color: '#C5C6C7' }}>{fmt(totalEgresosForm)}</span>
                  </div>
                  {esAdmin && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid rgba(197,198,199,0.1)', paddingTop: '8px', marginTop: '8px' }}>
                      <span style={{ color: '#FFFFFF' }}>Saldo del día (utilidad):</span>
                      <span style={{ color: (totalIngresosForm - totalEgresosForm) >= 0 ? '#8FD9B0' : '#f87171' }}>{fmt(totalIngresosForm - totalEgresosForm)}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" disabled={saving} style={btnPrimary}>
                  {saving ? 'Guardando...' : editId ? 'Actualizar' : advertencias.length ? 'Guardar de nuevo' : 'Registrar'}
                </button>
                <button type="button" onClick={cerrarForm} style={btnSecondary}>
                  {advertencias.length ? 'Cerrar' : 'Cancelar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151920', border: '1px solid rgba(197,198,199,0.1)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,198,199,0.1)' }}>
                {(esAdmin
                  ? ['Fecha', 'Vehículo', 'Conductor', 'Tipo', 'Ingresos', 'Egresos', 'Utilidad', '']
                  : ['Fecha', 'Vehículo', 'Conductor', 'Tipo', 'Ingresos', 'Egresos', '']
                ).map((h, i) => (
                  <th key={`${h}-${i}`} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={esAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>Cargando...</td></tr>
              ) : registros.length === 0 ? (
                <tr><td colSpan={esAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: '#7C8994' }}>
                  Sin registros. ¡Agrega el primero!
                </td></tr>
              ) : registros.map(r => (
                <tr key={r._id} style={{ borderBottom: '1px solid rgba(197,198,199,0.06)', transition: 'background 0.1s' }}>
                  <td style={tdStyle}>{fmtDate(r.fecha)}</td>
                  <td style={tdStyle}>{r.placa}</td>
                  <td style={tdStyle}>{r.conductor}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(197,198,199,0.1)', fontSize: '11px', color: '#C5C6C7' }}>{r.ingresos?.tipo}</span>
                  </td>
                  <td style={{ ...tdStyle, color: '#C5C6C7', fontWeight: 600 }}>{fmt(r.totalIngresos ?? r.ingresos?.valor)}</td>
                  <td style={{ ...tdStyle, color: '#93A0AB' }}>{fmt(r.totalEgresos)}</td>
                  {esAdmin && (
                    <td style={{ ...tdStyle, fontWeight: 600, color: r.utilidadNeta >= 0 ? '#8FD9B0' : '#f87171' }}>{fmt(r.utilidadNeta)}</td>
                  )}
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {(esAdmin || conductorPuedeEditar(r)) ? (
                      <button onClick={() => handleEdit(r)} style={iconBtn} title="Editar">✏</button>
                    ) : (
                      <span title="Cerrado: pídele el ajuste al administrador"
                        style={{ color: '#5B6672', fontSize: '13px', padding: '0 6px' }}>🔒</span>
                    )}
                    {esAdmin && (
                      <button onClick={() => handleDelete(r._id)} style={{ ...iconBtn, color: '#f87171' }} title="Eliminar">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', borderTop: '1px solid rgba(197,198,199,0.08)' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btnSecondary}>← Ant.</button>
            <span style={{ padding: '8px 16px', fontSize: '13px', color: '#8B98A3' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btnSecondary}>Sig. →</button>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Modal de importación desde Excel ────────────────────────────
function ImportModal({ vehicles, selectedVehicle, clientes, onClose, onDone }) {
  const [vehiculoId, setVehiculoId] = useState(selectedVehicle?._id || vehicles[0]?._id || '');
  const [filas, setFilas] = useState([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const vehiculo = vehicles.find(v => v._id === vehiculoId);
      const crudas = await leerExcel(file);
      const mapeadas = crudas
        .map(f => mapearFilaExcel(f, vehiculo, clientes))
        .filter(r => r.fecha && (r.ingresos.pasajes > 0 || r.ingresosPorCliente.length > 0 || r.kmFin > 0));
      setFilas(mapeadas);
    } catch (err) {
      alert('No se pudo leer el archivo: ' + err.message);
    }
  };

  const importar = async () => {
    if (!vehiculoId || filas.length === 0) return;
    setImportando(true);
    try {
      const vehiculo = vehicles.find(v => v._id === vehiculoId);
      const registros = filas.map(f => ({ ...f, vehiculo: vehiculoId, placa: vehiculo?.placa, conductor: vehiculo?.conductor || f.conductor }));
      const res = await api.post('/registros/importar', { registros });
      setResultado(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al importar.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '8px' }}>Importar quincena desde Excel</h2>
        <p style={{ fontSize: '12.5px', color: '#8B98A3', marginBottom: '18px' }}>
          Sube tu hoja (columnas Fecha, Kilometraje, Pasajes, Combustible, Peajes, etc.). Se asignan al vehículo elegido.
        </p>

        {!resultado && (
          <>
            <Label>Vehículo destino</Label>
            <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} style={{ ...inputStyle, marginBottom: '14px' }}>
              {vehicles.map(v => <option key={v._id} value={v._id} style={{ background: '#161920' }}>{v.placa} · {v.conductor}</option>)}
            </select>

            <Label>Archivo Excel (.xlsx)</Label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile}
              style={{ ...inputStyle, padding: '8px', marginBottom: '14px' }} />

            {filas.length > 0 && (
              <div style={{ padding: '12px 16px', background: '#0B0C10', borderRadius: '8px', fontSize: '13px', color: '#C5C6C7', marginBottom: '16px' }}>
                Se detectaron <b>{filas.length}</b> filas válidas para importar.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={importar} disabled={importando || filas.length === 0} style={btnPrimary}>
                {importando ? 'Importando...' : `Importar ${filas.length || ''} registros`}
              </button>
              <button onClick={onClose} style={btnSecondary}>Cancelar</button>
            </div>
          </>
        )}

        {resultado && (
          <>
            <div style={{ padding: '14px 16px', background: '#0B0C10', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              <div style={{ color: '#8FD9B0', fontWeight: 600 }}>✓ {resultado.insertados} registros importados</div>
              {resultado.errores?.length > 0 && (
                <div style={{ marginTop: '8px', color: '#f87171' }}>
                  {resultado.errores.length} con error:
                  {resultado.errores.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: '12px' }}>Fila {e.fila}: {e.mensaje}</div>)}
                </div>
              )}
            </div>
            <button onClick={onDone} style={btnPrimary}>Listo</button>
          </>
        )}
      </div>
    </div>
  );
}

// Small helpers
const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: '12px', color: '#8B98A3', marginBottom: '6px' }}>{children}</label>
);
const Input = (props) => (
  <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />
);
const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5B6672', margin: '20px 0 12px' }}>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', background: '#0B0C10', border: '1px solid rgba(197,198,199,0.15)',
  borderRadius: '8px', color: '#FFFFFF', padding: '10px 14px', fontSize: '14px',
  outline: 'none', fontFamily: 'inherit'
};
const btnPrimary = {
  padding: '10px 20px', background: '#C5C6C7', color: '#0B0C10',
  border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700,
  cursor: 'pointer', letterSpacing: '0.02em'
};
const btnSecondary = {
  padding: '10px 20px', background: '#1F2833', color: '#C5C6C7',
  border: '1px solid rgba(197,198,199,0.15)', borderRadius: '9px',
  fontSize: '13px', fontWeight: 500, cursor: 'pointer'
};
const iconBtn = {
  padding: '4px 8px', background: 'transparent', border: 'none',
  color: '#8B98A3', cursor: 'pointer', fontSize: '14px', borderRadius: '4px'
};
const thStyle = {
  padding: '12px 16px', textAlign: 'left', fontSize: '10.5px',
  letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7680',
  fontWeight: 600
};
const tdStyle = {
  padding: '14px 16px', fontSize: '13px', color: '#D7DCE0'
};
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '16px'
};
const modalStyle = {
  background: '#151920', border: '1px solid rgba(197,198,199,0.15)',
  borderRadius: '16px', padding: '24px 20px',
  width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto'
};

import { fmt } from './api';

// xlsx se carga bajo demanda (dynamic import) para no inflar el bundle inicial.

// ── Exportar registros a Excel (.xlsx) ──────────────────────────
export async function exportarRegistrosExcel(registros, nombreArchivo = 'reporte-logal-prime') {
  const XLSX = await import('xlsx');
  const filas = registros.map(r => ({
    Fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-CO') : '',
    Vehículo: r.placa || '',
    Conductor: r.conductor || '',
    'Km inicio': r.kmInicio || 0,
    'Km fin': r.kmFin || 0,
    'Km día': r.kmDia ?? Math.max(0, (r.kmFin || 0) - (r.kmInicio || 0)),
    Pasajes: r.ingresos?.pasajes ?? r.ingresos?.valor ?? 0,
    'Ingresos clientes': (r.ingresosPorCliente || []).reduce((s, i) => s + (i.valor || 0), 0),
    'Total ingresos': r.totalIngresos ?? r.ingresos?.valor ?? 0,
    Combustible: r.combustible || 0,
    Galones: r.galones || 0,
    Peajes: r.peajes || 0,
    Lavadas: r.lavadas || 0,
    Indrive: r.indrive || 0,
    Otros: r.otros || 0,
    'Total egresos': r.totalEgresos || 0,
    'Pago conductor': r.pagoConductor || 0,
    'Saldo (utilidad)': r.utilidadNeta || 0,
    Observaciones: r.observaciones || ''
  }));

  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte Diario');
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// ── Leer un Excel y devolver filas crudas (para importar) ───────
export function leerExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(filas);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Exportar a PDF vía ventana de impresión del navegador ───────
// No requiere dependencias: abre una ventana con HTML formateado y llama print().
export function imprimirPDF(titulo, tablaHtml, resumenHtml = '') {
  const win = window.open('', '_blank');
  if (!win) { alert('Permite las ventanas emergentes para exportar a PDF.'); return; }
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${titulo}</title>
    <style>
      * { font-family: Arial, Helvetica, sans-serif; }
      body { margin: 28px; color: #111; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
      th { background: #f2f2f2; text-align: right; }
      th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
      .resumen { margin-top: 18px; font-size: 13px; }
      .resumen div { display: flex; justify-content: space-between; max-width: 340px; padding: 4px 0; border-bottom: 1px solid #eee; }
      @media print { body { margin: 12px; } }
    </style></head><body>
    <h1>LOGAL Prime — ${titulo}</h1>
    <div class="sub">Generado el ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    ${tablaHtml}
    ${resumenHtml ? `<div class="resumen">${resumenHtml}</div>` : ''}
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

export { fmt };

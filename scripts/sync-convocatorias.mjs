// Sincroniza src/lib/convocatorias-data.json con la hoja de Google Sheets
// (fuente canonica). Uso:
//   node scripts/sync-convocatorias.mjs [path/to/hoja.csv]
// Si se pasa un CSV local lo usa; si no, descarga la hoja en vivo via gviz/tq.
// Conserva los criterios de elegibilidad de los registros ya existentes (por
// nombre normalizado) y deriva criterios basicos (alcance geografico desde
// ambito, ODS numericos desde la columna ODS) para los nuevos.
// Pensado para correr a mano o desde GitHub Actions (workflow semanal del domingo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = process.env.SHEET_ID || '19OG6UmhE1ezxyOrZCqxw8UX2PA4nX1S5u8xquJlsCPU';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'src', 'lib', 'convocatorias-data.json');

async function descargarCsv() {
  const res = await fetch(SHEET_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Descarga de la hoja fallo: HTTP ${res.status}`);
  return await res.text();
}

function parseCSV(txt) {
  txt = txt.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (inQ) {
      if (ch === '"') {
        if (txt[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && txt[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cur += ch;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function extraerOds(txt) {
  const out = new Set();
  const re = /ODS\s+([\d,\s]+)/g;
  let m;
  while ((m = re.exec(txt))) {
    m[1].match(/\d+/g).forEach((n) => {
      const v = Number(n);
      if (v >= 1 && v <= 17) out.add(v);
    });
  }
  return Array.from(out).sort((a, b) => a - b);
}

const ESTADOS = [
  'aguascalientes', 'baja california', 'baja california sur', 'campeche', 'chiapas',
  'chihuahua', 'coahuila', 'colima', 'durango', 'estado de mexico', 'guanajuato',
  'guerrero', 'hidalgo', 'jalisco', 'michoacan', 'morelos', 'nayarit', 'nuevo leon',
  'oaxaca', 'puebla', 'queretaro', 'quintana roo', 'san luis potosi', 'sinaloa',
  'sonora', 'tabasco', 'tamaulipas', 'tlaxcala', 'veracruz', 'yucatan', 'zacatecas',
];

function derivarCriterios(ambito, odsTxt) {
  const a = ambito.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let alcance = null;
  let estado = null;
  if (a.includes('internacional') || a.includes('ibero')) {
    alcance = 'internacional';
  } else if (a.includes('mexico') || a.includes('nacional') || a.includes('regional')) {
    alcance = 'mexico';
  }
  for (const e of ESTADOS) {
    if (a.includes(e)) {
      estado = e.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      alcance = 'estatal';
      break;
    }
  }
  return {
    alcance_geo: alcance,
    estado,
    tipos_elegibles: [],
    ods_num: extraerOds(odsTxt),
    edad_min: null,
    edad_max: null,
    anios_min_operacion: null,
    anios_max_operacion: null,
    liderazgo: null,
  };
}

async function main() {
  const csvPath = process.argv[2];
  const csv = csvPath
    ? fs.readFileSync(csvPath, 'utf8')
    : await descargarCsv();

  const rows = parseCSV(csv);
  const data = rows.slice(3).filter((r) => r[0]);
  if (data.length === 0) throw new Error('La hoja no trae registros (verifica encabezados/permisos).');

  const OLD = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));

  // Guarda de seguridad: si la hoja trae muchos menos registros que el JSON
  // actual, lo mas probable es un problema temporal de la hoja (permisos,
  // pestana equivocada, borrado accidental) y NO una actualizacion legitima.
  // Abortamos sin tocar el JSON en vez de sobrescribir con datos truncados.
  // Umbral: se permite una caida de hasta 20% respecto al conteo anterior.
  const UMBRAL_CAIDA = 0.20;
  if (OLD.length > 0 && data.length < OLD.length * (1 - UMBRAL_CAIDA)) {
    throw new Error(
      `Caida sospechosa de registros: la hoja trae ${data.length} filas pero el JSON actual tiene ${OLD.length} ` +
      `(caida de ${Math.round((1 - data.length / OLD.length) * 100)}%, umbral permitido ${UMBRAL_CAIDA * 100}%). ` +
      `Se aborta el sync sin sobrescribir convocatorias-data.json. Verifica manualmente la hoja de Google ` +
      '(permisos, pestana correcta, filas borradas por error) antes de reintentar.'
    );
  }

  const oldMap = new Map(OLD.map((c) => [norm(c.convocatoria), c]));

  const salida = data.map((r) => {
    const nombre = r[0];
    const previo = oldMap.get(norm(nombre));
    const criterios = previo
      ? JSON.parse(JSON.stringify(previo.criterios || null))
      : derivarCriterios(r[2], r[3]);
    return {
      convocatoria: nombre,
      tipo: r[1],
      ambito: r[2],
      ods: r[3],
      descripcion: r[4],
      requisitos: r[5],
      monto: r[6],
      fecha_limite: r[7],
      estatus: r[8],
      liga: r[9],
      criterios,
    };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(salida, null, 2) + '\n', 'utf8');

  const conCriterios = salida.filter((c) => c.criterios).length;
  const derivados = salida.filter((c) => c.criterios && c.criterios.tipos_elegibles.length === 0);
  console.log('Registros escritos:', salida.length);
  console.log('Con criterios:', conCriterios);
  console.log('Con criterios derivados (sin tipos_elegibles):', derivados.length);
  console.log('OK ->', OUT_PATH);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

// Busqueda semanal de convocatorias con Gemini (Google Search grounding).
// Uso:
//   GEMINI_API_KEY=... node scripts/buscar-convocatorias.mjs            # solo imprime candidatas
//   GEMINI_API_KEY=... SHEETS_WEB_APP_URL=... node scripts/buscar-convocatorias.mjs --insertar
// Lee el catalogo actual (src/lib/convocatorias-data.json) para no duplicar,
// pide a Gemini candidatas nuevas (11 columnas de la hoja), las deduplica
// contra lo existente y, con --insertar, las manda al endpoint de Apps Script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src', 'lib', 'convocatorias-data.json');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const INSERTAR = process.argv.includes('--insertar');
const WEB_APP_URL = process.env.SHEETS_WEB_APP_URL;
const LIMITE = Number(process.env.LIMITE_CANDIDATAS || '20');

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const EXISTENTES = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const normExistentes = new Set(EXISTENTES.map((c) => norm(c.convocatoria)));

const PROMPT = `
Eres un investigador de fondos para organizaciones en México. Busca en la web
(Google Search grounding) convocatorias, fondos, premios, becas y subvenciones
VIGENTES hoy para OSC, emprendimientos, academia y personas físicas en México.
Prioriza convocatorias de: (a) buscadores internacionales de fondos
(GrantStation, FundsForNGOs, Devex Funding, Candid, Portal UE, Banco Mundial
eConsultant2, Climate Funds Update, TerraViva), (b) agregadores de América
Latina (Innpactia, Fondos y Convocatorias MX, Rossel Consultores, Difusión con
Causa), (c) plataformas de fondos en EE.UU./inglés con elegibilidad
internacional (Grants.gov, Hello Alice, GrantWatch, The Grant Portal),
(d) datos IATI de cooperación hacia México. Excluye convocatorias de gobierno
mexicano (por ejemplo, presupuestos federales) salvo que sean abiertas a OSC.
Para cada candidata devuelve un objeto JSON con EXACTAMENTE estas claves:
- convocatoria (nombre con año, ej. "Premio X 2027")
- tipo (uno de: Fondo / Subvención, Premio, Beca, Apoyo, Convocatoria de servicios)
- ambito (Internacional, América Latina y el Caribe, Nacional (México), o el estado)
- ods (texto "ODS n Nombre; ODS m Nombre" solo los que apliquen de verdad)
- descripcion (3-4 líneas concisas, en español)
- requisitos (quién puede aplicar, en español)
- monto (en USD o MXN; si no hay, "Por confirmar")
- fecha_limite (YYYY-MM-DD; si es permanente "Permanente")
- estatus ("Abierta" si está vigente, "Cerrada" si ya cerró)
- liga (URL oficial verificada)
- elegibilidad_mexico ("Sí" con una línea de por qué, o "No")
Responde SOLO con un arreglo JSON de máximo ${LIMITE} objetos, sin markdown.
Si no encuentras nada nuevo, responde [].
`.trim();

async function llamarGemini() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        tools: [{ google_search: {} }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('\n');
}

function parsearCandidatas(txt) {
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('No se pudo extraer el arreglo JSON de la respuesta: ' + txt.slice(0, 200));
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr)) throw new Error('La respuesta no es un arreglo.');
  return arr;
}

function aFila(c) {
  return [
    c.convocatoria || '',
    c.tipo || '',
    c.ambito || '',
    c.ods || '',
    c.descripcion || '',
    c.requisitos || '',
    c.monto || 'Por confirmar',
    c.fecha_limite || '',
    c.estatus || 'Abierta',
    c.liga || '',
    '',
  ];
}

async function main() {
  if (!API_KEY) {
    console.error('ERROR: falta GEMINI_API_KEY (env).');
    process.exit(1);
  }
  console.log('Modelo:', MODEL, '| Candidatas máx:', LIMITE, '| Insertar:', INSERTAR);
  const txt = await llamarGemini();
  const candidatas = parsearCandidatas(txt);

  const nuevas = candidatas.filter((c) => c && c.convocatoria && !normExistentes.has(norm(c.convocatoria)));
  const dupes = candidatas.filter((c) => c && c.convocatoria && normExistentes.has(norm(c.convocatoria)));

  console.log('Candidatas (IA):', candidatas.length);
  console.log('Nuevas (no en catálogo):', nuevas.length);
  console.log('Duplicadas (ya en catálogo):', dupes.length);

  nuevas.forEach((c) => {
    console.log(' -', c.convocatoria, '|', c.fecha_limite, '|', c.estatus, '|', c.ambito);
  });

  if (!nuevas.length) {
    console.log('Sin candidatas nuevas; nada que insertar.');
    return;
  }

  if (!INSERTAR) {
    console.log('Para insertar en la hoja: SHEETS_WEB_APP_URL=... node scripts/buscar-convocatorias.mjs --insertar');
    return;
  }

  if (!WEB_APP_URL) {
    console.error('ERROR: falta SHEETS_WEB_APP_URL (env) para insertar.');
    process.exit(1);
  }

  const body = { filas: nuevas.map(aFila) };
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const resp = await res.json();
  console.log('Apps Script:', res.status, JSON.stringify(resp));
  if (res.status >= 400 || resp.ok !== true) process.exit(2);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

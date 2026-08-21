/**
 * Endpoint web para que el GitHub Actions semanal inserte filas nuevas de
 * convocatorias en la hoja canónica.
 *
 * Instalación (una sola vez, en la hoja "Convocatorias, Premios y Grants..."):
 *  1. En la hoja: Extensiones > Apps Script.
 *  2. Pega todo este archivo en el editor (reemplaza el contenido por defecto).
 *  3. Guarda, y ejecuta una vez `configurarEncabezado` (botón Play) + autoriza.
 *  4. Implementar → Nueva implementación → Aplicación web:
 *       - Ejecutar como: "Yo"
 *       - Tener acceso: "Cualquier persona"
 *  5. Copia la URL (https://script.google.com/macros/s/AKfy.../exec) y úsala como
 *     secreto SHEETS_WEB_APP_URL en GitHub (Settings → Secrets and variables → Actions).
 *
 * El workflow semanal hace POST { "filas": [ [c1..c11], ... ] }. Cada fila
 * respeta las 11 columnas de la fila 3 de la hoja. Se hace deduplicado por
 * nombre normalizado contra lo que ya existe para no escribir duplicados.
 *
 * El panel de administración (al agregar o editar una convocatoria a mano)
 * hace POST { "fila": [c1..c11] } (una sola fila, sin corchetes anidados):
 * si ya existe un renglon con ese nombre normalizado lo actualiza, si no
 * existe lo agrega al final.
 */

var HOJA_NOMBRE = 'Convocatorias, Premios y Grants alineados a los ODS — Organizaciones en México';
var ENCABEZADO = [
  'Convocatoria', 'Tipo', 'Ámbito', 'ODS alineados', 'Descripción',
  'Información solicitada / Requisitos', 'Monto', 'Fecha límite', 'Estatus',
  'Liga', 'Última revisión',
];

function normalizar(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function obtenerHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(HOJA_NOMBRE);
  if (!h) h = ss.getSheets()[0];
  return h;
}

function configurarEncabezado() {
  var h = obtenerHoja();
  h.getRange(3, 1, 1, ENCABEZADO.length).setValues([ENCABEZADO]).setFontWeight('bold');
  return 'Encabezado OK';
}

function doGet(e) {
  return jsonResp({
    ok: true,
    status: 'Endpoint activo. POST {filas:[[c1..c11],...]} (bulk) o {fila:[c1..c11]} (una sola, upsert).',
  });
}

// Agrega o actualiza UN renglon (usado por el panel de administración al
// agregar/editar una convocatoria a mano). Si ya existe un renglon con el
// mismo nombre normalizado, lo sobreescribe; si no existe, lo agrega al
// final de la hoja.
function upsertUnaFila(filaEntrada) {
  var f = filaEntrada.slice(0, 11);
  while (f.length < 11) f.push('');
  var n = normalizar(f[0]);
  if (!n) return jsonResp({ ok: false, error: 'La convocatoria necesita un nombre.' }, 400);

  var h = obtenerHoja();
  if (h.getLastRow() < 3) {
    h.getRange(3, 1, 1, ENCABEZADO.length).setValues([ENCABEZADO]);
  }
  var ultima = h.getLastRow();
  var existentes = ultima >= 4 ? h.getRange(4, 1, ultima - 3, 11).getValues() : [];

  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  if (!f[10]) f[10] = hoy;

  for (var i = 0; i < existentes.length; i++) {
    if (normalizar(existentes[i][0]) === n) {
      h.getRange(4 + i, 1, 1, 11).setValues([f]);
      return jsonResp({ ok: true, accion: 'actualizado' });
    }
  }

  var filaInicio = h.getLastRow() + 1;
  h.getRange(filaInicio, 1, 1, 11).setValues([f]);
  return jsonResp({ ok: true, accion: 'insertado' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body && Array.isArray(body.fila)) {
      return upsertUnaFila(body.fila);
    }

    if (!body || !Array.isArray(body.filas) || body.filas.length === 0 || !Array.isArray(body.filas[0])) {
      return jsonResp({ ok: false, error: 'Espera { "filas": [[c1..c11], ...] } o { "fila": [c1..c11] }' }, 400);
    }
    var h = obtenerHoja();
    if (h.getLastRow() < 3) {
      h.getRange(3, 1, 1, ENCABEZADO.length).setValues([ENCABEZADO]);
    }
    var ultima = h.getLastRow();
    var existentes = ultima >= 4 ? h.getRange(4, 1, ultima - 3, 11).getValues() : [];
    var mapaExiste = {};
    existentes.forEach(function (r) { mapaExiste[normalizar(r[0])] = true; });

    var nuevas = [];
    var duplicados = [];
    body.filas.forEach(function (fila) {
      var f = fila.slice(0, 11);
      while (f.length < 11) f.push('');
      var n = normalizar(f[0]);
      if (!n) return;
      if (mapaExiste[n]) { duplicados.push(f[0]); return; }
      mapaExiste[n] = true;
      nuevas.push(f);
    });

    var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    var escritas = nuevas.map(function (f) { var fila = f.slice(); fila[10] = fila[10] || hoy; return fila; });

    if (escritas.length) {
      var filaInicio = h.getLastRow() + 1;
      h.getRange(filaInicio, 1, escritas.length, 11).setValues(escritas);
    }

    return jsonResp({ ok: true, insertadas: escritas.length, duplicados: duplicados.length, duplicadosNombre: duplicados });
  } catch (err) {
    return jsonResp({ ok: false, error: String(err) }, 500);
  }
}

function jsonResp(obj, code) {
  if (code === undefined) code = 200;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
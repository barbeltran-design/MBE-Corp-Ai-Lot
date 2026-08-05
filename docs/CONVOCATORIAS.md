# Convocatorias y fondos — Proceso de actualización

Página: `/babel/convocatorias` ("Convocatorias y fondos" en el menú lateral).
Datos: `src/lib/convocatorias-data.json` → render: `src/components/babel/ConvocatoriasBuilder.tsx`.

## Fuente canónica: una hoja de Google Sheets

Toda convocatoria que aparece en la página vive primero en una hoja de Google Sheets
(pública, de solo lectura para la app):

| Campo de la hoja | Campo en el JSON |
|---|---|
| Convocatoria | `convocatoria` |
| Tipo | `tipo` |
| Ámbito | `ambito` |
| ODS alineados | `ods` |
| Descripción | `descripcion` |
| Información solicitada / Requisitos | `requisitos` |
| Monto | `monto` |
| Fecha límite | `fecha_limite` (formato `YYYY-MM-DD`) |
| Estatus | `estatus` |
| Liga | `liga` |
| Última revisión | (no se modela) |

La hoja además trae un encabezado (título y "Actualizado: …") en la fila 1–2 y los
encabezados de columna en la fila 3; el script lee los datos a partir de la fila 4.

### Columna 11: Criterios de elegibilidad

El buscador "Encuentra tus convocatorias" necesita, además de los campos visibles, un
bloque `criterios` por registro:

```json
"criterios": {
  "alcance_geo": "internacional | mexico | estatal",
  "estado": "Chihuahua",
  "tipos_elegibles": ["osc", "empresa", "emprendimiento_idea"],
  "ods_num": [5, 8],
  "edad_min": null, "edad_max": null,
  "anios_min_operacion": null, "anios_max_operacion": null,
  "liderazgo": "mujeres | indigenas | null
}
```

La hoja **no tiene** una columna de criterios. Por eso la sincronización los maneja así:

1. **Registros ya existentes** (`convocatoria` normalizada) → se conservan sus `criterios` tal cual.
2. **Registros nuevos** → se derivan automáticamente: el alcance desde `Ámbito`
   (internacional/iberoamericano → `internacional`; México/nacional/regional → `mexico`;
   nombre de un estado → `estatal` + `estado`) y los `ods_num` desde la columna `ODS alineados`
   (regex `ODS n`). `tipos_elegibles` queda vacío (sin restricción de tipo) hasta que alguien
   lo enriquezca a mano en el JSON.

## Sincronización

Para traer la hoja al JSON (conserva criterios, deriva los nuevos):

```bash
node scripts/sync-convocatorias.mjs                # descarga la hoja en vivo
node scripts/sync-convocatorias.mjs ruta/hoja.csv  # o usa un CSV ya descargado
```

El script normaliza nombres (minúsculas, sin acentos) para el match, respeta el orden de la
hoja y verifica que no venga vacío. Es idempotente: si la hoja no cambió, el JSON no cambia.

> **Verificación del ID de la hoja.** El script usa el endpoint público `gviz/tq` de Google con el
> `SHEET_ID`. Si la hoja cambia de URL, actualiza `SHEET_ID` en `scripts/sync-convocatorias.mjs`.

## Actualización semanal automática (cada domingo)

El workflow GitHub Actions `.github/workflows/sync-convocatorias.yml` corre **cada domingo a las
08:00 UTC** (02:00–03:00 CDMX) con dos jobs:

**1. Job `busqueda`** (busca candidatas nuevas con IA y las inserta en la hoja):

```bash
node scripts/buscar-convocatorias.mjs --insertar
```

- Llama a **Gemini** (`GEMINI_API_KEY`) con *Google Search grounding* (búsqueda en la web real)
  y un prompt que recorre las 4 categorías de fuentes: buscadores internacionales de fondos,
  agregadores de América Latina, plataformas EE.UU./inglés y datos IATI de cooperación a México.
- Pide hasta `LIMITE_CANDIDATAS` (default 20) objetos con las **11 columnas de la hoja**.
- **Deduplica** contra `src/lib/convocatorias-data.json` (nombre normalizado) para no repetir.
- Con `--insertar` hace `POST {filas:[...]}` al **Apps Script Web App** (`SHEETS_WEB_APP_URL`),
  que inserta las filas nuevas en la hoja (también deduplica del lado de Google).
- Sin `SHEETS_WEB_APP_URL` imprime las candidatas y no inserta. Sin `GEMINI_API_KEY` se omite
  todo y solo queda el sync.

**2. Job `sync`** (depende del anterior): `node scripts/sync-convocatorias.mjs` y, si el JSON
cambió, commit `Convocatorias y fondos: sync semanal automatico…` + push.

Se puede disparar a mano desde la pestaña **Actions → Sync convocatorias (domingo) → Run workflow**.

### Setup de una sola vez (para que la búsqueda funcione)

1. **Desplegar el Apps Script** (`apps-script/convocatorias-hook.gs`) en la hoja:
   Extensiones → Apps Script → pegar el código → guardar → ejecutar `configurarEncabezado` una vez
   (autorizar) → Implementar → Nueva implementación → **Aplicación web** (Ejecutar como: "Yo";
   Tener acceso: "Cualquier persona") → copiar la URL (`https://script.google.com/macros/s/.../exec`).
2. **Configurar secrets en GitHub** (Settings → Secrets and variables → Actions):
   - `GEMINI_API_KEY` — la llave de Gemini (la misma que está en Vercel/.env.prod).
   - `SHEETS_WEB_APP_URL` — la URL del paso anterior.
   - (opcional) `GEMINI_MODEL` y `LIMITE_CANDIDATAS` como variables del repo.
3. Probar con **Run workflow** en Actions (o localmente con las mismas env vars).

### Búsqueda local (sin GitHub)

```bash
$env:GEMINI_API_KEY = "..."  # tu llave de Gemini
$env:SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
node scripts/buscar-convocatorias.mjs          # solo imprime candidatas
node scripts/buscar-convocatorias.mjs --insertar
```

## Proceso semanal (revisión de lo que insertó la IA)

La búsqueda la hace el Action del domingo (job `busqueda`). Tu tarea semanal es de **validación**
sobre lo que la IA dejó en la hoja (o, si aún no configuras `SHEETS_WEB_APP_URL`, hacer la
búsqueda a mano con el mismo prompt):

1. **Ver lo que insertó la IA** en la hoja (filas de la semana) y/o el log del Action
   (Actions → Sync convocatorias → job `busqueda`).
2. Las 4 categorías de fuentes que recorre el prompt automático:
   - **Buscadores internacionales de fondos:** GrantStation, FundsForNGOs, Devex Funding, Candid
     (Foundation Directory), Portal UE · Funding & Tenders, Banco Mundial eConsultant2, Climate
     Funds Update, TerraViva Grants.
   - **Agregadores de convocatorias en América Latina:** Innpactia, Fondos y Convocatorias MX,
     Rossel Consultores, Difusión con Causa.
   - **Inteligencia: cuánto dinero entra a México y quién lo entrega:** IATI Country Data · México
     (datos abiertos de cooperación: montos, donantes y sectores).
   - **Plataformas de fondos en EE.UU. / en inglés (revisar elegibilidad internacional):**
     Grants.gov, Hello Alice, GrantWatch, The Grant Portal, USA Funding Applications.
3. Para cada candidata nueva, **validar con el ojo humano**: abrir la liga, confirmar la fecha
   límite, que el monto estimado sea razonable, y apuntar observaciones de elegibilidad
   (¿acepta OSC mexicanas? ¿internacionales?). Corrige en la hoja lo que la IA haya inventado
   o mal copiado.
4. **Sincronizar**: correr el script a mano o dejar que el Action del domingo lo haga.
5. En el JSON resultante, **enriquecer los `criterios`** de los registros nuevos con
   `tipos_elegibles`, `ods_num`, `anios_min_operacion`, `liderazgo`, etc. (el derivado solo
   funciona de base).

### Prompt de ejemplo para el asistente

```
Busca convocatorias, fondos, premios y becas nuevos (2026) para organizaciones en México,
abiertas en este mes. Usa fuentes oficiales. Para cada una devuelve exactamente:
- Convocatoria
- Tipo (Fondo/Subvención, Premio, Beca, Apoyo, Convocatoria de servicios…)
- Ámbito (Internacional, América Latina y el Caribe, Nacional (México), o el estado)
- ODS alineados (números y nombre que correspondan)
- Descripción (3 a 4 líneas concisas)
- Información solicitada / Requisitos (quién puede aplicar)
- Monto (en USD o MXN, o "Por confirmar")
- Fecha límite (YYYY-MM-DD)
- Estatus (Abierta/Cerrada)
- Liga oficial (URL)
- Elegibilidad para México: sí/no y qué dice
Entrega todo en texto plano, sin markdown.
```

## Notas

- Los `criterios` del JSON son el único lugar donde se define la elegibilidad por perfil; la hoja
  no los tiene. Al agregar un registro nuevo a mano, revisa que el derivado tenga sentido.
- El estatus Abierta/Cerrada se calcula **en vivo** contra la fecha actual** en el cliente
  (`estatusReal`), así que la columna Estatus de la hoja se usa solo para las convocatorias sin
  fecha (texto "Anual/Permanente").
- `tsc --noEmit` y `next build` deben pasar tras cualquier cambio en `convocatorias-data.*`.
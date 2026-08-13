$ErrorActionPreference = 'Stop'

function Aplicar-Reemplazo {
    param(
        [string]$RutaArchivo,
        [string]$Buscar,
        [string]$Reemplazar,
        [string]$Descripcion
    )
    if (-not (Test-Path $RutaArchivo)) {
        Write-Host "ERROR: no se encontro el archivo $RutaArchivo" -ForegroundColor Red
        return $false
    }
    $contenidoOriginal = [System.IO.File]::ReadAllText($RutaArchivo)
    $contenidoLF = $contenidoOriginal -replace "`r`n", "`n"
    if ($contenidoLF.IndexOf($Buscar) -lt 0) {
        Write-Host "ERROR: no se encontro el texto esperado para '$Descripcion' en $RutaArchivo." -ForegroundColor Red
        Write-Host "        Es posible que el archivo ya haya cambiado desde la ultima entrega. No se modifico nada; avisa a Claude." -ForegroundColor Red
        return $false
    }
    $nuevoContenido = $contenidoLF.Replace($Buscar, $Reemplazar)
    $utf8SinBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($RutaArchivo, $nuevoContenido, $utf8SinBom)
    Write-Host "OK: $Descripcion" -ForegroundColor Green
    return $true
}

$raiz = Get-Location
$exitoTotal = $true

Write-Host ""
Write-Host "== Aplicando cambios: mentor por perspectiva + avatares mas grandes ==" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1. src/lib/mentores.ts
#    Agrega el mapa PERSPECTIVA_MENTOR y la funcion mentorPorPerspectiva().
# ---------------------------------------------------------------------------
$archivo1 = Join-Path $raiz "src\lib\mentores.ts"

$buscar1 = @'
  return mejorMentor;
}

// ---------------------------------------------------------------------------
// System prompts por mentor
// ---------------------------------------------------------------------------
'@

$reemplazar1 = @'
  return mejorMentor;
}

// Mapea la perspectiva del Balanced Scorecard del objetivo (ver PERSPECTIVAS
// en src/lib/plan-accion.ts) al mentor que le corresponde. Se usa como
// segundo respaldo cuando el catalogo de Buenas Practicas no encuentra
// coincidencia: Financieros -> Fisnando, Clientes -> Karmetin, Procesos ->
// Atech, Aprendizaje -> Babel, Socioambientales -> Normau.
export const PERSPECTIVA_MENTOR: Record<string, MentorId> = {
  financiera: 'Fisnando',
  clientes: 'Karmetin',
  procesos_internos: 'Atech',
  aprendizaje_crecimiento: 'Babel',
  socioambiental: 'Normau',
};

export function mentorPorPerspectiva(perspectiva: string): MentorId | null {
  const key = (perspectiva || '').trim();
  if (!key) return null;
  const mentor = PERSPECTIVA_MENTOR[key];
  return mentor || null;
}

// ---------------------------------------------------------------------------
// System prompts por mentor
// ---------------------------------------------------------------------------
'@

if (-not (Aplicar-Reemplazo -RutaArchivo $archivo1 -Buscar $buscar1 -Reemplazar $reemplazar1 -Descripcion "mentores.ts: agregar mapa perspectiva -> mentor")) { $exitoTotal = $false }

# ---------------------------------------------------------------------------
# 2. src/app/api/babel/clasificar-mentor/route.ts
#    Acepta "perspectiva" en el body e inserta la nueva etapa de respaldo.
# ---------------------------------------------------------------------------
$archivo2 = Join-Path $raiz "src\app\api\babel\clasificar-mentor\route.ts"

$buscar2a = @'
import { callMentorLLM, esMentorValido, matchMentorPorTexto, MentorId } from '@/lib/mentores';
'@
$reemplazar2a = @'
import { callMentorLLM, esMentorValido, matchMentorPorTexto, mentorPorPerspectiva, MentorId } from '@/lib/mentores';
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo2 -Buscar $buscar2a -Reemplazar $reemplazar2a -Descripcion "clasificar-mentor/route.ts: import de mentorPorPerspectiva")) { $exitoTotal = $false }

$buscar2b = @'
// 1) Intenta primero el catalogo de src/lib/buenas-practicas.ts (fuente de
//    verdad de las areas por accion).
// 2) Si la accion no coincide con nada del catalogo, clasifica por contexto
//    con una sola llamada corta a la IA.
// 3) Si todo falla, regresa 'Babel' como respaldo seguro.
'@
$reemplazar2b = @'
// 1) Intenta primero el catalogo de src/lib/buenas-practicas.ts (fuente de
//    verdad de las areas por accion).
// 2) Si la accion no coincide con nada del catalogo, y se conoce la
//    perspectiva del Balanced Scorecard del objetivo, asigna el mentor por
//    perspectiva (Financieros->Fisnando, Clientes->Karmetin,
//    Procesos->Atech, Aprendizaje->Babel, Socioambientales->Normau).
// 3) Si tampoco hay perspectiva conocida, clasifica por contexto con una
//    sola llamada corta a la IA.
// 4) Si todo falla, regresa 'Babel' como respaldo seguro.
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo2 -Buscar $buscar2b -Reemplazar $reemplazar2b -Descripcion "clasificar-mentor/route.ts: actualizar comentario de cabecera")) { $exitoTotal = $false }

$buscar2c = @'
    const body = await req.json().catch(() => ({}));
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const language = body.language === 'en' ? 'en' : 'es';

    if (!descripcion) {
      return NextResponse.json({ mentor: 'Babel', origen: 'vacio' });
    }

    const porCatalogo = matchMentorPorTexto(descripcion);
    if (porCatalogo) {
      return NextResponse.json({ mentor: porCatalogo, origen: 'catalogo' });
    }

    const prompt =
'@
$reemplazar2c = @'
    const body = await req.json().catch(() => ({}));
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const perspectiva = typeof body.perspectiva === 'string' ? body.perspectiva.trim() : '';
    const language = body.language === 'en' ? 'en' : 'es';

    if (!descripcion) {
      return NextResponse.json({ mentor: 'Babel', origen: 'vacio' });
    }

    const porCatalogo = matchMentorPorTexto(descripcion);
    if (porCatalogo) {
      return NextResponse.json({ mentor: porCatalogo, origen: 'catalogo' });
    }

    const porPerspectiva = mentorPorPerspectiva(perspectiva);
    if (porPerspectiva) {
      return NextResponse.json({ mentor: porPerspectiva, origen: 'perspectiva' });
    }

    const prompt =
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo2 -Buscar $buscar2c -Reemplazar $reemplazar2c -Descripcion "clasificar-mentor/route.ts: insertar etapa de respaldo por perspectiva")) { $exitoTotal = $false }

# ---------------------------------------------------------------------------
# 3. src/components/babel/ObjetivoPlanBuilder.tsx
#    Envia la perspectiva del objetivo al clasificar, y agranda el boton
#    del avatar + "?" de cada accion para que llame mas la atencion.
# ---------------------------------------------------------------------------
$archivo3 = Join-Path $raiz "src\components\babel\ObjetivoPlanBuilder.tsx"

$buscar3a = @'
  const clasificarSiFalta = (a: Accion) => {
    if (a.mentor || a.descripcion.trim().length < 4) return;
    fetch('/api/babel/clasificar-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: a.descripcion, language: lang }),
    })
'@
$reemplazar3a = @'
  const clasificarSiFalta = (a: Accion) => {
    if (a.mentor || a.descripcion.trim().length < 4) return;
    fetch('/api/babel/clasificar-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: a.descripcion, language: lang, perspectiva: objetivo?.perspectiva || '' }),
    })
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo3 -Buscar $buscar3a -Reemplazar $reemplazar3a -Descripcion "ObjetivoPlanBuilder.tsx: enviar perspectiva del objetivo al clasificar")) { $exitoTotal = $false }

$buscar3b = @'
          <button
            type="button"
            onClick={() => abrirTip(a)}
            title={lang === 'en' ? 'Ask ' + mentorDe(a) + ' for help with this action' : 'Pide ayuda a ' + mentorDe(a) + ' con esta accion'}
            className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
          >
            <AgentAvatar agente={mentorDe(a)} pose="reposando" size={22} />
            <span>?</span>
          </button>
'@
$reemplazar3b = @'
          <button
            type="button"
            onClick={() => abrirTip(a)}
            title={lang === 'en' ? 'Ask ' + mentorDe(a) + ' for help with this action' : 'Pide ayuda a ' + mentorDe(a) + ' con esta accion'}
            className="group inline-flex items-center gap-1.5 rounded-full border-2 border-teal-300 bg-white py-1 pl-1 pr-3 shadow-sm ring-2 ring-teal-100 transition hover:border-teal-400 hover:shadow-md"
          >
            <AgentAvatar agente={mentorDe(a)} pose="reposando" size={40} />
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white animate-pulse group-hover:animate-none">
              ?
            </span>
          </button>
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo3 -Buscar $buscar3b -Reemplazar $reemplazar3b -Descripcion "ObjetivoPlanBuilder.tsx: agrandar avatar + boton de ayuda por accion")) { $exitoTotal = $false }

# ---------------------------------------------------------------------------
# 4. src/components/babel/PlanAccionBuilder.tsx
#    Agrega perspectivaDeFd() y la envia al clasificar acciones sugeridas
#    por IA.
# ---------------------------------------------------------------------------
$archivo4 = Join-Path $raiz "src\components\babel\PlanAccionBuilder.tsx"

$buscar4a = @'
  const sugerirAccionesPlanConIA = async () => {
    if (pasoGenerando) return;
'@
$reemplazar4a = @'
  // Busca la perspectiva del Balanced Scorecard del objetivo vinculado a
  // esta Fortaleza/Debilidad (via sus Amenazas/Oportunidades), para usarla
  // como respaldo al clasificar el mentor de una accion nueva cuando el
  // catalogo de buenas practicas no encuentra coincidencia.
  const perspectivaDeFd = (fdId: string): string => {
    const fd = fds.find((f) => f.id === fdId);
    if (!fd) return '';
    for (let i = 0; i < fd.entornoIds.length; i++) {
      const entorno = entornos.find((e) => e.id === fd.entornoIds[i]);
      if (!entorno) continue;
      for (let j = 0; j < entorno.objetivoIds.length; j++) {
        const obj = objetivos.find((o) => o.id === entorno.objetivoIds[j]);
        if (obj && obj.perspectiva) return obj.perspectiva;
      }
    }
    return '';
  };

  const sugerirAccionesPlanConIA = async () => {
    if (pasoGenerando) return;
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo4 -Buscar $buscar4a -Reemplazar $reemplazar4a -Descripcion "PlanAccionBuilder.tsx: agregar helper perspectivaDeFd")) { $exitoTotal = $false }

$buscar4b = @'
      const nuevosProyectos: Proyecto[] = [];
      const nuevas: Accion[] = [];
      (data.sugerencias as RawAccionIA[]).forEach((raw) => {
        const fdId = (raw.fdId || '').trim();
        const descripcion = (raw.descripcion || '').trim();
        if (!fdId || fdIds.indexOf(fdId) === -1) return;
        if (!descripcion) return;
        const clave = descripcion.toLowerCase();
        if (existentes[clave]) return;
        existentes[clave] = true;
        let proyecto = findProyectoByFd(fdId);
        if (!proyecto) {
          proyecto = newProyecto(fdId);
          nuevosProyectos.push(proyecto);
        }
        const nueva = newAccion(proyecto.id, priorityRank('media', 'medio'));
        nueva.descripcion = descripcion;
        nueva.entregable = (raw.entregable || '').trim();
        nuevas.push(nueva);
      });
      if (nuevosProyectos.length > 0) {
        setProyectos((prev) => prev.concat(nuevosProyectos));
      }
      if (nuevas.length > 0) {
        setAcciones((prev) => prev.concat(nuevas));
        // Identifica en paralelo, con base en el catalogo de buenas practicas
        // (y contexto por IA si una accion no coincide con nada del
        // catalogo), que mentor puede ayudar a implementar cada accion
        // sugerida.
        Promise.all(
          nuevas.map((n) =>
            fetch('/api/babel/clasificar-mentor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ descripcion: n.descripcion, language: lang }),
            })
              .then((r) => r.json())
              .then((d) => ({ id: n.id, mentor: typeof d?.mentor === 'string' ? d.mentor : '' }))
              .catch(() => ({ id: n.id, mentor: '' }))
          )
        ).then((resultados) => {
'@
$reemplazar4b = @'
      const nuevosProyectos: Proyecto[] = [];
      const nuevas: Accion[] = [];
      const fdPorAccionId: Record<string, string> = {};
      (data.sugerencias as RawAccionIA[]).forEach((raw) => {
        const fdId = (raw.fdId || '').trim();
        const descripcion = (raw.descripcion || '').trim();
        if (!fdId || fdIds.indexOf(fdId) === -1) return;
        if (!descripcion) return;
        const clave = descripcion.toLowerCase();
        if (existentes[clave]) return;
        existentes[clave] = true;
        let proyecto = findProyectoByFd(fdId);
        if (!proyecto) {
          proyecto = newProyecto(fdId);
          nuevosProyectos.push(proyecto);
        }
        const nueva = newAccion(proyecto.id, priorityRank('media', 'medio'));
        nueva.descripcion = descripcion;
        nueva.entregable = (raw.entregable || '').trim();
        nuevas.push(nueva);
        fdPorAccionId[nueva.id] = fdId;
      });
      if (nuevosProyectos.length > 0) {
        setProyectos((prev) => prev.concat(nuevosProyectos));
      }
      if (nuevas.length > 0) {
        setAcciones((prev) => prev.concat(nuevas));
        // Identifica en paralelo, con base en el catalogo de buenas practicas
        // (y, si no hay coincidencia, la perspectiva del Balanced Scorecard
        // del objetivo asociado, y como ultimo recurso contexto por IA), que
        // mentor puede ayudar a implementar cada accion sugerida.
        Promise.all(
          nuevas.map((n) =>
            fetch('/api/babel/clasificar-mentor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                descripcion: n.descripcion,
                language: lang,
                perspectiva: perspectivaDeFd(fdPorAccionId[n.id] || ''),
              }),
            })
              .then((r) => r.json())
              .then((d) => ({ id: n.id, mentor: typeof d?.mentor === 'string' ? d.mentor : '' }))
              .catch(() => ({ id: n.id, mentor: '' }))
          )
        ).then((resultados) => {
'@
if (-not (Aplicar-Reemplazo -RutaArchivo $archivo4 -Buscar $buscar4b -Reemplazar $reemplazar4b -Descripcion "PlanAccionBuilder.tsx: enviar perspectiva al clasificar acciones sugeridas por IA")) { $exitoTotal = $false }

Write-Host ""
if ($exitoTotal) {
    Write-Host "== Todos los cambios se aplicaron correctamente. ==" -ForegroundColor Cyan
    Write-Host "Siguiente paso: revisa 'git diff' y luego sigue las instrucciones del archivo .md" -ForegroundColor Cyan
} else {
    Write-Host "== Uno o mas cambios NO se pudieron aplicar (ver errores en rojo arriba). ==" -ForegroundColor Yellow
    Write-Host "No sigas con 'npm run build' ni con 'git push' todavia: avisale a Claude con el mensaje de error exacto." -ForegroundColor Yellow
}
Write-Host ""

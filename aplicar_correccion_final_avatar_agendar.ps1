$ErrorActionPreference = 'Stop'

# IMPORTANTE: este es el script definitivo. NO uses los dos anteriores
# (aplicar_chooser_avatar_y_agendar_unica_tarjeta.ps1 y
#  aplicar_correccion_avatar_agendar.ps1) despues de este, para evitar
# volver a duplicar cosas. Si quieres, puedes borrarlos de tu carpeta.
#
# Este script:
#  1) Quita 3 duplicados que quedaron en ObjetivoPlanBuilder.tsx por haber
#     corrido el script viejo dos veces (import de useRouter, estado
#     eleccionAccionId, efecto de scroll automatico).
#  2) Agrega el aviso emergente "IA o Mentor" que nunca se pudo insertar.
#  3) Aplica los 3 cambios pendientes en la pagina Agendar (ese archivo
#     sigue intacto, nunca se toco).

function Leer-ContenidoLF {
    param([string]$RutaArchivo)
    if (-not (Test-Path -LiteralPath $RutaArchivo)) {
        Write-Host "ERROR: no se encontro el archivo $RutaArchivo" -ForegroundColor Red
        return $null
    }
    $original = [System.IO.File]::ReadAllText($RutaArchivo)
    return ($original -replace "`r`n", "`n")
}

function Guardar-Contenido {
    param([string]$RutaArchivo, [string]$Contenido)
    $utf8SinBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($RutaArchivo, $Contenido, $utf8SinBom)
}

function Aplicar-ReemplazoLiteral {
    param([string]$RutaArchivo, [string]$Buscar, [string]$Reemplazar, [string]$Descripcion)
    $contenido = Leer-ContenidoLF -RutaArchivo $RutaArchivo
    if ($null -eq $contenido) { return $false }
    if ($contenido.IndexOf($Buscar) -lt 0) {
        Write-Host "ERROR: no se encontro el texto esperado para '$Descripcion' en $RutaArchivo." -ForegroundColor Red
        Write-Host "        Es posible que el archivo ya haya cambiado. No se modifico nada; avisa a Claude." -ForegroundColor Red
        return $false
    }
    $nuevo = $contenido.Replace($Buscar, $Reemplazar)
    Guardar-Contenido -RutaArchivo $RutaArchivo -Contenido $nuevo
    Write-Host "OK: $Descripcion" -ForegroundColor Green
    return $true
}

function Aplicar-ReemplazoDeBloque {
    param([string]$RutaArchivo, [string]$InicioLiteral, [string]$FinLiteral, [string]$Reemplazar, [string]$Descripcion)
    $contenido = Leer-ContenidoLF -RutaArchivo $RutaArchivo
    if ($null -eq $contenido) { return $false }
    $patron = "(?s)" + [regex]::Escape($InicioLiteral) + ".*?" + [regex]::Escape($FinLiteral)
    $coincidencias = [regex]::Matches($contenido, $patron)
    if ($coincidencias.Count -eq 0) {
        Write-Host "ERROR: no se encontro el bloque esperado para '$Descripcion' en $RutaArchivo." -ForegroundColor Red
        Write-Host "        Es posible que el archivo ya haya cambiado. No se modifico nada; avisa a Claude." -ForegroundColor Red
        return $false
    }
    if ($coincidencias.Count -gt 1) {
        Write-Host "ERROR: se encontraron $($coincidencias.Count) coincidencias para '$Descripcion' en $RutaArchivo (se esperaba solo 1)." -ForegroundColor Red
        Write-Host "        No se modifico nada; avisa a Claude." -ForegroundColor Red
        return $false
    }
    $m = $coincidencias[0]
    $nuevo = $contenido.Substring(0, $m.Index) + $Reemplazar + $contenido.Substring($m.Index + $m.Length)
    Guardar-Contenido -RutaArchivo $RutaArchivo -Contenido $nuevo
    Write-Host "OK: $Descripcion" -ForegroundColor Green
    return $true
}

$raiz = Get-Location
$exitoTotal = $true

Write-Host ""
Write-Host "== Paso 1: quitar duplicados en ObjetivoPlanBuilder.tsx ==" -ForegroundColor Cyan
Write-Host ""

$archivo1 = Join-Path $raiz "src\components\babel\ObjetivoPlanBuilder.tsx"

# 1.a Quitar import duplicado
$bDupA = @'
import { useRouter } from 'next/navigation';
import { useRouter } from 'next/navigation';
'@
$rDupA = @'
import { useRouter } from 'next/navigation';
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo1 -Buscar $bDupA -Reemplazar $rDupA -Descripcion "Quitar import duplicado de useRouter")) { $exitoTotal = $false }

# 1.b Quitar estado duplicado
$bDupB = @'
  const [eleccionAccionId, setEleccionAccionId] = React.useState('');
  const [eleccionAccionId, setEleccionAccionId] = React.useState('');
'@
$rDupB = @'
  const [eleccionAccionId, setEleccionAccionId] = React.useState('');
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo1 -Buscar $bDupB -Reemplazar $rDupB -Descripcion "Quitar estado eleccionAccionId duplicado")) { $exitoTotal = $false }

# 1.c Quitar efecto de scroll duplicado
$bDupC = @'
  React.useEffect(() => {
    if (!ayudaAccionId) return;
    const el = document.getElementById('ayuda-panel-' + ayudaAccionId);
    if (el) {
      const idTimeout = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => window.clearTimeout(idTimeout);
    }
  }, [ayudaAccionId]);
  React.useEffect(() => {
    if (!ayudaAccionId) return;
    const el = document.getElementById('ayuda-panel-' + ayudaAccionId);
    if (el) {
      const idTimeout = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => window.clearTimeout(idTimeout);
    }
  }, [ayudaAccionId]);
'@
$rDupC = @'
  React.useEffect(() => {
    if (!ayudaAccionId) return;
    const el = document.getElementById('ayuda-panel-' + ayudaAccionId);
    if (el) {
      const idTimeout = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => window.clearTimeout(idTimeout);
    }
  }, [ayudaAccionId]);
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo1 -Buscar $bDupC -Reemplazar $rDupC -Descripcion "Quitar efecto de scroll automatico duplicado")) { $exitoTotal = $false }

Write-Host ""
Write-Host "== Paso 2: agregar el aviso emergente IA vs Mentor (faltaba) ==" -ForegroundColor Cyan
Write-Host ""

$b1h = @'
      {wizardOpen ? (
'@
$r1h = @'
      {eleccionAccionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEleccionAccionId('')}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            {(() => {
              const accionEligiendo = acciones.find((x) => x.id === eleccionAccionId);
              if (!accionEligiendo) return null;
              return (
                <>
                  <AgentAvatar agente={mentorDe(accionEligiendo)} pose="reposando" size={56} className="mx-auto" />
                  <h4 className="mt-3 text-base font-bold text-slate-800">
                    {lang === 'en' ? 'How would you like help?' : 'Como quieres que te ayudemos?'}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {lang === 'en'
                      ? 'Chat now with the AI mentor, or book a FREE 30-minute session with a real mentor.'
                      : 'Quieres ayuda de la IA o prefieres una asesoria gratuita de 30 minutos con un mentor?'}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEleccionAccionId('');
                        abrirTip(accionEligiendo);
                      }}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      {lang === 'en' ? 'AI help (chat)' : 'Ayuda de la IA (chat)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEleccionAccionId('');
                        router.push('/' + lang + '/agendar');
                      }}
                      className="rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      {lang === 'en' ? 'Free 30-min mentor session' : 'Asesoria gratuita de 30 min con un mentor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEleccionAccionId('')}
                      className="mt-1 text-xs font-medium text-slate-500 hover:underline"
                    >
                      {lang === 'en' ? 'Cancel' : 'Cancelar'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {wizardOpen ? (
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo1 -Buscar $b1h -Reemplazar $r1h -Descripcion "ObjetivoPlanBuilder: aviso emergente IA vs Mentor")) { $exitoTotal = $false }

Write-Host ""
Write-Host "== Paso 3: pagina Agendar como una sola tarjeta (archivo intacto, primera vez que se toca) ==" -ForegroundColor Cyan
Write-Host ""

$archivo2 = Join-Path $raiz "src\app\[locale]\agendar\page.tsx"

# 3.1 Nuevo estado: tema elegido por el usuario
$b2a = @'
  const [abierto, setAbierto] = React.useState<string | null>(null);
'@
$r2a = @'
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [temaSeleccionado, setTemaSeleccionado] = React.useState('');
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo2 -Buscar $b2a -Reemplazar $r2a -Descripcion "Agendar: nuevo estado temaSeleccionado")) { $exitoTotal = $false }

# 3.2 Funcion que dibuja el detalle de UN tema
$b2b = @'
  const mentoresDe = (area: Area) =>
    especialistas.filter((e) => e.temas.some((tm) => tm.id === area.temaId));

  const toggle = (id: string) => setAbierto((prev) => (prev === id ? null : id));

  return (
'@
$r2b = @'
  const mentoresDe = (area: Area) =>
    especialistas.filter((e) => e.temas.some((tm) => tm.id === area.temaId));

  const toggle = (id: string) => setAbierto((prev) => (prev === id ? null : id));

  const areaSeleccionada = AREAS.find((a) => a.id === temaSeleccionado);

  const renderDetalleArea = (area: Area) => {
    const mentores = mentoresDe(area);
    const open = abierto === area.id;
    return (
      <div>
        <h2 className="font-semibold text-foreground">
          {area.titulo.es === area.titulo.en ? area.titulo.es : area.titulo[dispLang]}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{area.explicacion[dispLang]}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            `${mentores.length} mentor${mentores.length === 1 ? '' : 'es'} disponible${mentores.length === 1 ? '' : 's'} para este tema.`,
            `${mentores.length} mentor${mentores.length === 1 ? '' : 's'} available for this topic.`
          )}
        </p>
        <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => toggle(area.id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            {t('Agenda Cita de orientacion GRATIS', 'Book FREE orientation session')}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {area.id === 'certificacion' ? (
            <button
              type="button"
              onClick={() => handlePagar('certificacion_mbe')}
              disabled={payLoading !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-transparent px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
            >
              {payLoading === 'certificacion_mbe' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {t('Contratar Certificacion Anual', 'Purchase Annual Certification')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handlePagar('apoyo_ondemand')}
                disabled={payLoading !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-transparent px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                {payLoading === 'apoyo_ondemand' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t('Contratar Apoyo On Demand (1 entregable)', 'Purchase On-Demand Support (1 deliverable)')}
              </button>
              <button
                type="button"
                onClick={() => handlePagar('paquete_especialista')}
                disabled={payLoading !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-transparent px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                {payLoading === 'paquete_especialista' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t('Contratar Paquete Mentor (Hasta 4 entregables)', 'Purchase Mentor Package (Up to 4 deliverables)')}
              </button>
            </>
          )}
        </div>
        {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
        {open && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mentores.map((e) => (
              <a
                key={e.uid}
                href={bookingHref(e)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {e.nombre || t('Mentor', 'Mentor')}
              </a>
            ))}
            {mentores.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {t('Proximamente habra mentores para este tema.', 'Mentors for this topic coming soon.')}
              </span>
            )}
          </div>
        )}
        {open && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--glass-border)' }}>
            <p className="text-xs font-medium text-foreground">
              {t('Calendarios de los mentores de este tema', 'Mentors calendars for this topic')}
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {mentores.map((e) => (
                <div key={e.uid} className="glass-panel flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.nombre || t('Mentor', 'Mentor')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{e.email}</p>
                  </div>
                  {bookingHref(e) ? (
                    <a
                      href={bookingHref(e)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('Abrir calendario', 'Open calendar')}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t('Sin agenda configurada', 'No calendar set up')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo2 -Buscar $b2b -Reemplazar $r2b -Descripcion "Agendar: funcion renderDetalleArea (un solo tema a la vez)")) { $exitoTotal = $false }

# 3.3 El return principal: una sola tarjeta con selector de tema
$inicio2c = '<div className="px-4 py-8">'
$fin2c = @'
        <p className="text-xs text-muted-foreground">
          {t('¿Eres mentor? Configura tu agenda y datos bancarios desde tu sección "Panel de Mentor".', 'Are you a mentor? Set up your calendar and bank details in your "Mentor Panel" section.')}
        </p>
      </div>
    </div>
  );
}
'@
$r2c = @'
<div className="px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t('Agenda con un mentor', 'Schedule a meeting with a mentor')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'Elige el tema que tu empresa necesita y agenda una cita de orientación GRATIS con un mentor de nivel directivo.',
              'Pick the topic your company needs and book a FREE orientation session with a director-level mentor.'
            )}
          </p>
        </div>

        {loading && (
          <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">
            {t('Cargando...', 'Loading...')}
          </div>
        )}

        {!loading && especialistas.length === 0 && (
          <div className="glass-panel p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t('Todavía no hay mentores con agenda configurada.', 'There are no mentors with a calendar set up yet.')}
            </p>
          </div>
        )}

        {!loading && especialistas.length > 0 && (
          <div className="glass-panel p-5">
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="agendar-tema-select">
              {t('1. Elige el tema en el que necesitas apoyo', '1. Choose the topic you need support with')}
            </label>
            <select
              id="agendar-tema-select"
              value={temaSeleccionado}
              onChange={(ev) => {
                setTemaSeleccionado(ev.target.value);
                setAbierto(null);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground dark:bg-transparent"
            >
              <option value="">{t('-- Selecciona un tema --', '-- Select a topic --')}</option>
              {AREAS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.titulo.es === area.titulo.en ? area.titulo.es : area.titulo[dispLang]}
                </option>
              ))}
            </select>

            {areaSeleccionada ? (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--glass-border)' }}>
                {renderDetalleArea(areaSeleccionada)}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {t(
                  '2. Al elegir un tema veras aqui como agendar tu cita gratis o contratar apoyo para ese tema.',
                  '2. Once you pick a topic, you will see how to book your free session or hire support for it.'
                )}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t('¿Eres mentor? Configura tu agenda y datos bancarios desde tu sección "Panel de Mentor".', 'Are you a mentor? Set up your calendar and bank details in your "Mentor Panel" section.')}
        </p>
      </div>
    </div>
  );
}
'@
if (-not (Aplicar-ReemplazoDeBloque -RutaArchivo $archivo2 -InicioLiteral $inicio2c -FinLiteral $fin2c -Reemplazar $r2c -Descripcion "Agendar: una sola tarjeta con selector de tema")) { $exitoTotal = $false }

Write-Host ""
if ($exitoTotal) {
    Write-Host "== Todos los cambios se aplicaron correctamente. ==" -ForegroundColor Cyan
    Write-Host "Siguiente paso: revisa 'git diff' (presiona 'q' para salir del visor) y luego 'npm run build'." -ForegroundColor Cyan
} else {
    Write-Host "== Uno o mas cambios NO se pudieron aplicar (ver errores en rojo arriba). ==" -ForegroundColor Yellow
    Write-Host "No sigas con 'npm run build' ni con 'git push' todavia: avisale a Claude con el mensaje de error exacto." -ForegroundColor Yellow
}
Write-Host ""

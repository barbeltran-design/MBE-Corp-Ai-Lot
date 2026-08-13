$ErrorActionPreference = 'Stop'

# Este es el ultimo paso pendiente. Los pasos anteriores (avatares, aviso
# emergente IA vs Mentor, y los dos primeros cambios de Agendar) ya
# quedaron guardados correctamente, no se repiten aqui.
#
# Este script solo arregla la pagina Agendar (la convierte en una sola
# tarjeta con un selector de tema). El intento anterior fallo porque el
# texto de busqueda incluia acentos y comillas especiales ("seccion",
# signo de interrogacion invertido, comillas curvas) que no coincidieron
# byte por byte. Esta version busca solo usando texto simple (sin acentos)
# y por eso la ultima frase del texto queda sin acentos ("seccion" en vez
# de "sección"). Es un cambio minimo y se puede corregir despues si se
# quiere.

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
Write-Host "== Pagina Agendar: reemplazar el listado de 14 tarjetas por una sola tarjeta ==" -ForegroundColor Cyan
Write-Host ""

$archivo2 = Join-Path $raiz "src\app\[locale]\agendar\page.tsx"

$inicio2c = '<div className="px-4 py-8">'
$fin2c = @'
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
              'Elige el tema que tu empresa necesita y agenda una cita de orientacion GRATIS con un mentor de nivel directivo.',
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
              {t('Todavia no hay mentores con agenda configurada.', 'There are no mentors with a calendar set up yet.')}
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
          {t('Eres mentor? Configura tu agenda y datos bancarios desde tu seccion "Panel de Mentor".', 'Are you a mentor? Set up your calendar and bank details in your "Mentor Panel" section.')}
        </p>
      </div>
    </div>
  );
}
'@
if (-not (Aplicar-ReemplazoDeBloque -RutaArchivo $archivo2 -InicioLiteral $inicio2c -FinLiteral $fin2c -Reemplazar $r2c -Descripcion "Agendar: una sola tarjeta con selector de tema")) { $exitoTotal = $false }

Write-Host ""
if ($exitoTotal) {
    Write-Host "== Cambio aplicado correctamente. Ya no falta nada. ==" -ForegroundColor Cyan
    Write-Host "Siguiente paso: revisa 'git diff' (presiona 'q' para salir del visor) y luego 'npm run build'." -ForegroundColor Cyan
} else {
    Write-Host "== El cambio NO se pudo aplicar (ver error en rojo arriba). ==" -ForegroundColor Yellow
    Write-Host "No sigas con 'npm run build' ni con 'git push' todavia: avisale a Claude con el mensaje de error exacto." -ForegroundColor Yellow
}
Write-Host ""

$ErrorActionPreference = 'Stop'

# Este script hace que el mentor de cada tarea SIEMPRE se calcule segun
# la perspectiva del objetivo (Financiero, Clientes, Procesos, Aprendizaje,
# Socioambiental), sin importar lo que ya haya quedado guardado en tareas
# creadas antes. Con esto, los planes de accion que ya existian tambien se
# corrigen, sin necesidad de volver a crearlos.

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

$raiz = Get-Location
$exitoTotal = $true

Write-Host ""
Write-Host "== Mentor siempre segun la perspectiva del objetivo ==" -ForegroundColor Cyan
Write-Host ""

$archivo = Join-Path $raiz "src\components\babel\ObjetivoPlanBuilder.tsx"

$buscar = "const mentorDe = (a: Accion): MentorId => (esMentorValido(a.mentor) ? a.mentor : 'Babel');"
$reemplazar = @'
const mentorDe = (_a: Accion): MentorId => {
    const p = (objetivo?.perspectiva || '').toLowerCase();
    if (p.includes('financ')) return 'Fisnando';
    if (p.includes('client')) return 'Karmetin';
    if (p.includes('proceso')) return 'Atech';
    if (p.includes('aprendiz')) return 'Babel';
    if (p.includes('socioambient') || p.includes('ambient')) return 'Normau';
    return 'Babel';
  };
'@

if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo -Buscar $buscar -Reemplazar $reemplazar -Descripcion "ObjetivoPlanBuilder: mentor calculado siempre por perspectiva (tareas nuevas y ya existentes)")) { $exitoTotal = $false }

Write-Host ""
if ($exitoTotal) {
    Write-Host "== Cambio aplicado correctamente. ==" -ForegroundColor Cyan
    Write-Host "Siguiente paso: revisa 'git diff' (presiona 'q' para salir del visor) y luego 'npm run build'." -ForegroundColor Cyan
} else {
    Write-Host "== El cambio NO se pudo aplicar (ver error en rojo arriba). ==" -ForegroundColor Yellow
    Write-Host "No sigas con 'npm run build' ni con 'git push' todavia: avisale a Claude con el mensaje de error exacto." -ForegroundColor Yellow
}
Write-Host ""

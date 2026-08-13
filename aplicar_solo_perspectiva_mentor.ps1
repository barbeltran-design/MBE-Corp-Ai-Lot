$ErrorActionPreference = 'Stop'

function Leer-ContenidoLF {
    param([string]$RutaArchivo)
    if (-not (Test-Path $RutaArchivo)) {
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
    # Reemplaza todo el texto que va desde $InicioLiteral hasta $FinLiteral
    # (ambos incluidos), sin necesidad de conocer el contenido exacto de en
    # medio. Falla si no encuentra el bloque, o si encuentra mas de uno
    # (ambiguo), sin modificar el archivo en ninguno de esos casos.
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
Write-Host "== Simplificando la asignacion de mentor: solo por tipo de objetivo ==" -ForegroundColor Cyan
Write-Host ""

$archivo = Join-Path $raiz "src\app\api\babel\clasificar-mentor\route.ts"

# ---------------------------------------------------------------------------
# 1. Import: ya no se necesita el catalogo ni la IA para clasificar, solo
#    mentorPorPerspectiva.
# ---------------------------------------------------------------------------
$buscar1 = @'
import { callMentorLLM, esMentorValido, matchMentorPorTexto, mentorPorPerspectiva, MentorId } from '@/lib/mentores';
'@
$reemplazar1 = @'
import { mentorPorPerspectiva } from '@/lib/mentores';
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo -Buscar $buscar1 -Reemplazar $reemplazar1 -Descripcion "route.ts: simplificar import (ya no se usa catalogo ni IA)")) { $exitoTotal = $false }

# ---------------------------------------------------------------------------
# 2. Comentario de cabecera: explica que ahora es solo por perspectiva.
# ---------------------------------------------------------------------------
$buscar2 = @'
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
$reemplazar2 = @'
// El mentor de cada accion se determina UNICAMENTE por la perspectiva del
// Balanced Scorecard del objetivo al que pertenece (ver PERSPECTIVAS en
// src/lib/plan-accion.ts): Financieros->Fisnando, Clientes->Karmetin,
// Procesos->Atech, Aprendizaje->Babel, Socioambientales->Normau.
// Si la accion pertenece a un objetivo sin perspectiva conocida, se usa
// 'Babel' como respaldo seguro. Ya no se usa el catalogo de buenas
// practicas ni clasificacion por IA para determinar el mentor.
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo -Buscar $buscar2 -Reemplazar $reemplazar2 -Descripcion "route.ts: actualizar comentario de cabecera")) { $exitoTotal = $false }

# ---------------------------------------------------------------------------
# 3. Quitar la variable "language" que ya no se usa (era solo para el
#    prompt de IA que se elimina).
# ---------------------------------------------------------------------------
$buscar3 = @'
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const perspectiva = typeof body.perspectiva === 'string' ? body.perspectiva.trim() : '';
    const language = body.language === 'en' ? 'en' : 'es';
'@
$reemplazar3 = @'
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const perspectiva = typeof body.perspectiva === 'string' ? body.perspectiva.trim() : '';
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivo -Buscar $buscar3 -Reemplazar $reemplazar3 -Descripcion "route.ts: quitar variable 'language' sin uso")) { $exitoTotal = $false }

# ---------------------------------------------------------------------------
# 4. Reemplazar todo el bloque de catalogo + IA por la asignacion directa
#    y unica por perspectiva. Usa un reemplazo "por bloque" (desde el
#    inicio del catalogo hasta el return final) para no depender del texto
#    exacto del prompt de IA que hay en medio.
# ---------------------------------------------------------------------------
$inicioBloque = "const porCatalogo = matchMentorPorTexto(descripcion);"
$finBloque = "return NextResponse.json({ mentor, origen: resultado ? 'ia' : 'fallback' });"
$reemplazar4 = @'
    const porPerspectiva = mentorPorPerspectiva(perspectiva);
    if (porPerspectiva) {
      return NextResponse.json({ mentor: porPerspectiva, origen: 'perspectiva' });
    }

    return NextResponse.json({ mentor: 'Babel', origen: 'sin_perspectiva' });
'@
if (-not (Aplicar-ReemplazoDeBloque -RutaArchivo $archivo -InicioLiteral $inicioBloque -FinLiteral $finBloque -Reemplazar $reemplazar4 -Descripcion "route.ts: la asignacion de mentor ahora es SOLO por perspectiva del objetivo")) { $exitoTotal = $false }

Write-Host ""
if ($exitoTotal) {
    Write-Host "== Todos los cambios se aplicaron correctamente. ==" -ForegroundColor Cyan
    Write-Host "Siguiente paso: revisa 'git diff' (presiona 'q' para salir del visor) y luego 'npm run build'." -ForegroundColor Cyan
} else {
    Write-Host "== Uno o mas cambios NO se pudieron aplicar (ver errores en rojo arriba). ==" -ForegroundColor Yellow
    Write-Host "No sigas con 'npm run build' ni con 'git push' todavia: avisale a Claude con el mensaje de error exacto." -ForegroundColor Yellow
}
Write-Host ""

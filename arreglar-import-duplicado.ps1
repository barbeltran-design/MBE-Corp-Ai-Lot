# arreglar-import-duplicado.ps1
#
# Corrige un bug del script anterior (corregir-tutoriales.ps1): si se corrio
# mas de una vez, la linea del import de BABEL_AYUDA_EVENT en
# ConvocatoriasBuilder.tsx se duplicaba (porque esa linea en particular no
# tenia forma de detectar que ya estaba puesta).
#
# Este script:
#   1) Deja UNA sola copia de ese import (elimina las copias de mas).
#   2) Verifica, con conteos exactos, que nada mas haya quedado duplicado
#      en ConvocatoriasBuilder.tsx, InicioBuilder.tsx y WorldsBuilder.tsx.
#
# Corre esto desde la raiz del proyecto (donde esta la carpeta 'src'):
#   powershell -ExecutionPolicy Bypass -File .\arreglar-import-duplicado.ps1

$ErrorActionPreference = "Stop"

function Read-Utf8NoBom($path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
        $text = $text.Substring(1)
    }
    return $text
}

function Write-Utf8NoBom($path, $text) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

function Count-Matches($content, $pattern) {
    $regex = New-Object System.Text.RegularExpressions.Regex($pattern)
    return $regex.Matches($content).Count
}

# ---------------------------------------------------------------------------
# Paso 1: colapsar el import duplicado en ConvocatoriasBuilder.tsx
# ---------------------------------------------------------------------------
$convoPath = "src\components\babel\ConvocatoriasBuilder.tsx"

if (-not (Test-Path -LiteralPath $convoPath)) {
    Write-Error "No encontre '$convoPath'. Corre este script desde la raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullConvoPath = (Resolve-Path -LiteralPath $convoPath).Path
$convoContent = Read-Utf8NoBom $fullConvoPath

$dupPattern = "(?:import \{ BABEL_AYUDA_EVENT \} from '@/components/babel/BabelAvatar';\r?\n){2,}"
$dupRegex = New-Object System.Text.RegularExpressions.Regex($dupPattern)
$dupMatch = $dupRegex.Match($convoContent)

if ($dupMatch.Success) {
    $originalBlock = $dupMatch.Value
    $copias = ($originalBlock -split "import \{ BABEL_AYUDA_EVENT \}").Count - 1
    $replacement = "import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';`r`n"
    $convoContent = $convoContent.Substring(0, $dupMatch.Index) + $replacement + $convoContent.Substring($dupMatch.Index + $dupMatch.Length)
    Write-Utf8NoBom $fullConvoPath $convoContent
    Write-Host "[OK] Se encontraron $copias copias del import duplicado y se dejo solo 1."
}
else {
    $count = Count-Matches $convoContent "import \{ BABEL_AYUDA_EVENT \} from '@/components/babel/BabelAvatar';"
    if ($count -eq 1) {
        Write-Host "[OK - ya estaba bien] El import de BABEL_AYUDA_EVENT ya aparecia una sola vez. No se modifico nada."
    }
    elseif ($count -eq 0) {
        Write-Warning "[FALTA] No encontre el import de BABEL_AYUDA_EVENT en $convoPath. Revisa el archivo a mano."
    }
    else {
        Write-Warning "[REVISAR] El import aparece $count veces pero no de forma consecutiva. Pegame las primeras 15 lineas de $convoPath."
    }
}

# ---------------------------------------------------------------------------
# Paso 2: verificacion de conteos exactos (detecta cualquier otra duplicacion)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- Verificacion de duplicados en los 3 archivos ---"

function Check-Count($label, $content, $pattern, $expected) {
    $count = Count-Matches $content $pattern
    if ($count -eq $expected) {
        Write-Host "[OK] $label -> aparece $count vez/veces (esperado: $expected)."
    }
    else {
        Write-Warning "[REVISAR] $label -> aparece $count vez/veces (esperado: $expected). Pegame este resultado para revisarlo."
    }
}

$finalConvo = [System.IO.File]::ReadAllText($fullConvoPath)
Check-Count "Convocatorias: import BABEL_AYUDA_EVENT" $finalConvo "import \{ BABEL_AYUDA_EVENT \} from '@/components/babel/BabelAvatar';" 1
Check-Count "Convocatorias: onClick del avatar Ecori"  $finalConvo [regex]::Escape("onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))}") 2
Check-Count "Convocatorias: id agendar"                $finalConvo [regex]::Escape('id="convocatorias-agendar"') 1
Check-Count "Convocatorias: id stats"                  $finalConvo [regex]::Escape('id="convocatorias-stats"') 1
Check-Count "Convocatorias: paso tour 'title'"          $finalConvo "selector: '#convocatorias-title'" 2
Check-Count "Convocatorias: paso tour 'agendar'"        $finalConvo "selector: '#convocatorias-agendar'" 2
Check-Count "Convocatorias: paso tour 'stats'"          $finalConvo "selector: '#convocatorias-stats'" 2
Check-Count "Convocatorias: paso tour 'buscar'"         $finalConvo "selector: '#convocatorias-buscar'" 2
Check-Count "Convocatorias: paso tour 'resultados'"     $finalConvo "selector: '#convocatorias-resultados'" 2
Check-Count "Convocatorias: paso tour 'catalogo'"       $finalConvo "selector: '#convocatorias-catalogo'" 2

$inicioPath = "src\components\babel\InicioBuilder.tsx"
if (Test-Path -LiteralPath $inicioPath) {
    $finalInicio = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $inicioPath).Path)
    Check-Count "Inicio: paso tour 'inicio-dual'" $finalInicio "selector: '#inicio-dual'" 2
}

$wbPath = "src\components\worlds\WorldsBuilder.tsx"
if (Test-Path -LiteralPath $wbPath) {
    $finalWb = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $wbPath).Path)
    Check-Count "Worlds: paso tour 'worlds-saludo'"        $finalWb "selector: '#worlds-saludo'" 1
    Check-Count "Worlds: paso tour 'worlds-mundo-partida'" $finalWb "selector: '#worlds-mundo-partida'" 1
    Check-Count "Worlds: paso tour 'worlds-misiones'"      $finalWb "selector: '#worlds-misiones'" 1
    Check-Count "Worlds: paso tour 'estrategia-plan-accion'" $finalWb "selector: '#estrategia-plan-accion'" 1
}

Write-Host ""
Write-Host "Si TODO dice [OK], ya puedes correr: git add -A ; git commit -m 'Corrige import duplicado en ConvocatoriasBuilder' ; git push"
Write-Host "Si algo dice [REVISAR], pegame exactamente ese renglon (no corras nada mas todavia)."

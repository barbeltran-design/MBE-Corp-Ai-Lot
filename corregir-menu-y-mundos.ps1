# corregir-menu-y-mundos.ps1
#
# Corrige 3 cosas en la app:
#   1) En vista de celular, el menu lateral aparece contraido por default.
#   2) El menu "Toolbox" aparece desplegado por default.
#   3) En /worlds?v=estrategia (o cualquier mundo), dar clic en una tarjeta de
#      "Mundo del Cliente / Normativo / Operativo / Cultura / Estrategia" SI
#      lleva a la liga de ese mundo (antes solo cambiaba la vista interna,
#      sin actualizar la URL, por eso "no llevaba a ningun lado").
#
# Corre esto desde la raiz del proyecto (donde esta la carpeta 'src'):
#   powershell -ExecutionPolicy Bypass -File .\corregir-menu-y-mundos.ps1

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

# ---------------------------------------------------------------------------
# Archivo 1: src\components\executive-shell.tsx  (menu lateral)
# ---------------------------------------------------------------------------
$shellPath = "src\components\executive-shell.tsx"

if (-not (Test-Path -LiteralPath $shellPath)) {
    Write-Error "No encontre '$shellPath'. Corre este script desde la raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullShellPath = (Resolve-Path -LiteralPath $shellPath).Path
$shellContent = Read-Utf8NoBom $fullShellPath
$shellChanged = $false

# --- Fix 1: menu contraido por default en celular ---
$pattern1 = "function readSidebarCollapsed\(\): boolean \{\r?\n" + `
            "[ \t]*try \{\r?\n" + `
            "[ \t]*return window\.localStorage\.getItem\(SIDEBAR_STORAGE_KEY\) === '1';\r?\n" + `
            "[ \t]*\} catch \{\r?\n" + `
            "[ \t]*return sidebarCollapsedCache;\r?\n" + `
            "[ \t]*\}\r?\n" + `
            "\}"
$regex1 = New-Object System.Text.RegularExpressions.Regex($pattern1)
$m1 = $regex1.Matches($shellContent)

if ($m1.Count -eq 1) {
    $new1 = @'
function readSidebarCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === '1';
    // No hay preferencia guardada todavia: en pantallas de celular el menu
    // lateral arranca contraido por default (el usuario lo puede volver a
    // expandir con el boton de abajo; esa eleccion se recuerda).
    return window.innerWidth < 768;
  } catch {
    return sidebarCollapsedCache;
  }
}
'@
    $match = $m1[0]
    $shellContent = $shellContent.Substring(0, $match.Index) + $new1 + $shellContent.Substring($match.Index + $match.Length)
    $shellChanged = $true
    Write-Host "[OK] Menu lateral: se aplico el contraido por default en celular."
}
elseif ($shellContent -match [regex]::Escape("return window.innerWidth < 768")) {
    Write-Host "[OK - ya estaba bien] El menu lateral ya arranca contraido por default en celular. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre la funcion 'readSidebarCollapsed' tal cual la esperaba en $shellPath. No se modifico esta parte. Pegame las lineas 60 a 100 de ese archivo."
}

# --- Fix 2: Toolbox desplegado por default ---
$pattern2 = "const \[openSections, setOpenSections\] = React\.useState<Record<string, boolean>>\(\{\}\);"
$regex2 = New-Object System.Text.RegularExpressions.Regex($pattern2)
$m2 = $regex2.Matches($shellContent)

if ($m2.Count -eq 1) {
    $new2 = "const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({ Toolbox: true });"
    $match = $m2[0]
    $shellContent = $shellContent.Substring(0, $match.Index) + $new2 + $shellContent.Substring($match.Index + $match.Length)
    $shellChanged = $true
    Write-Host "[OK] Menu lateral: 'Toolbox' ahora aparece desplegado por default."
}
elseif ($shellContent -match [regex]::Escape("{ Toolbox: true }")) {
    Write-Host "[OK - ya estaba bien] 'Toolbox' ya aparece desplegado por default. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre la linea de 'openSections' tal cual la esperaba en $shellPath. No se modifico esta parte. Pegame las lineas 160 a 175 de ese archivo."
}

if ($shellChanged) {
    Write-Utf8NoBom $fullShellPath $shellContent
}

# ---------------------------------------------------------------------------
# Archivo 2: src\components\worlds\WorldsBuilder.tsx  (tarjetas de mundos)
# ---------------------------------------------------------------------------
$wbPath = "src\components\worlds\WorldsBuilder.tsx"

if (-not (Test-Path -LiteralPath $wbPath)) {
    Write-Error "No encontre '$wbPath'. Corre este script desde la raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullWbPath = (Resolve-Path -LiteralPath $wbPath).Path
$wbContent = Read-Utf8NoBom $fullWbPath
$wbChanged = $false

$pattern3 = "const abrirMundo = React\.useCallback\(\(destino: Vista\) => \{\r?\n" + `
            "[ \t]*setVista\(destino\);\r?\n" + `
            "[ \t]*\}, \[\]\);"
$regex3 = New-Object System.Text.RegularExpressions.Regex($pattern3)
$m3 = $regex3.Matches($wbContent)

if ($m3.Count -eq 1) {
    $new3 = @'
const abrirMundo = React.useCallback((destino: Vista) => {
    setVista(destino);
    router.replace(`/${lang === 'es' ? 'es' : 'en'}/worlds?v=${destino}`);
  }, [lang, router]);
'@
    $match = $m3[0]
    $wbContent = $wbContent.Substring(0, $match.Index) + $new3 + $wbContent.Substring($match.Index + $match.Length)
    $wbChanged = $true
    Write-Host "[OK] Tarjetas de mundos: al dar clic ahora si actualizan la liga (URL) del mundo."
}
elseif ($wbContent -match [regex]::Escape("v=`${destino}")) {
    Write-Host "[OK - ya estaba bien] Las tarjetas de mundos ya actualizan la liga del mundo. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre la funcion 'abrirMundo' tal cual la esperaba en $wbPath. No se modifico esta parte. Pegame las lineas 460 a 470 de ese archivo."
}

if ($wbChanged) {
    Write-Utf8NoBom $fullWbPath $wbContent
}

# ---------------------------------------------------------------------------
# Verificacion final
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- Verificacion final ---"

$finalShell = [System.IO.File]::ReadAllText($fullShellPath)
if ($finalShell -match [regex]::Escape("window.innerWidth < 768")) {
    Write-Host "[OK] executive-shell.tsx: menu contraido por default en celular -> presente."
} else {
    Write-Warning "[FALTA] executive-shell.tsx: no encontre 'window.innerWidth < 768'. Revisa el archivo a mano."
}
if ($finalShell -match [regex]::Escape("{ Toolbox: true }")) {
    Write-Host "[OK] executive-shell.tsx: 'Toolbox' desplegado por default -> presente."
} else {
    Write-Warning "[FALTA] executive-shell.tsx: no encontre '{ Toolbox: true }'. Revisa el archivo a mano."
}

$finalWb = [System.IO.File]::ReadAllText($fullWbPath)
if ($finalWb -match [regex]::Escape("v=`${destino}")) {
    Write-Host "[OK] WorldsBuilder.tsx: tarjetas de mundos actualizan la liga -> presente."
} else {
    Write-Warning "[FALTA] WorldsBuilder.tsx: no encontre el router.replace esperado. Revisa el archivo a mano."
}

Write-Host ""
Write-Host "Listo. Si todo dice [OK], sigue con: git add -A ; git commit -m 'Menu lateral: contraido en celular, Toolbox abierto, tarjetas de mundos navegan' ; git push"

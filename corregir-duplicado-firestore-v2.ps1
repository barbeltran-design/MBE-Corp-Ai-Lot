# corregir-duplicado-firestore-v2.ps1
#
# Corrige la duplicacion de "mercadoPagoPreapprovalId" y "planCanceladoAt"
# en src\types\firestore.ts (el error TS2300 que rompio el build de Vercel).
#
# A diferencia del script anterior, este NO compara el bloque completo como
# texto exacto. En vez de eso usa un patron que se ancla solo en los nombres
# de los campos (que el propio error de Vercel confirma que aparecen 2 veces
# cada uno) y tolera diferencias de salto de linea (CRLF/LF), espacios y
# tabs. Es mas robusto contra pequenas diferencias invisibles.
#
# Corre esto desde la raiz del proyecto:
#   powershell -ExecutionPolicy Bypass -File .\corregir-duplicado-firestore-v2.ps1

$ErrorActionPreference = "Stop"

$path = "src\types\firestore.ts"

if (-not (Test-Path -LiteralPath $path)) {
    Write-Error "No encontre '$path'. Corre este script desde la carpeta raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullPath = (Resolve-Path -LiteralPath $path).Path
$bytes = [System.IO.File]::ReadAllBytes($fullPath)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Si el archivo tiene BOM (marca de orden de bytes) al inicio, la quitamos
# antes de trabajar el texto; lo volvemos a escribir sin BOM al final.
if ($content.Length -gt 0 -and $content[0] -eq [char]0xFEFF) {
    $content = $content.Substring(1)
}

# Patron de un "bloque": opcionalmente 2 lineas de comentario, seguidas de
# la linea de mercadoPagoPreapprovalId y la linea de planCanceladoAt.
# Tolera CRLF o LF, y espacios/tabs de mas.
$pattern = '(?:[ \t]*//[^\r\n]*\r?\n[ \t]*//[^\r\n]*\r?\n)?' + `
           '[ \t]*mercadoPagoPreapprovalId\?:\s*string;[ \t]*\r?\n' + `
           '[ \t]*planCanceladoAt\?:\s*string;[ \t]*\r?\n'

$regex = New-Object System.Text.RegularExpressions.Regex($pattern)
$matches = $regex.Matches($content)

if ($matches.Count -eq 2) {
    # Hay 2 bloques completos (duplicado real) -> eliminamos el segundo
    # completo (incluyendo sus comentarios si los tiene), dejando solo el
    # primero.
    $m2 = $matches[1]
    $newContent = $content.Substring(0, $m2.Index) + $content.Substring($m2.Index + $m2.Length)

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($fullPath, $newContent, $utf8NoBom)

    Write-Host "[OK] Se elimino la copia duplicada de 'mercadoPagoPreapprovalId' / 'planCanceladoAt' en $path."
}
elseif ($matches.Count -le 1) {
    $preapprovalCount = ([regex]::Matches($content, "mercadoPagoPreapprovalId")).Count
    if ($preapprovalCount -eq 1) {
        Write-Host "[OK - ya estaba bien] $path ya tiene una sola declaracion de 'mercadoPagoPreapprovalId'. No se modifico el archivo."
    } else {
        Write-Warning "No pude aislar 2 bloques completos (comentario + los 2 campos), pero 'mercadoPagoPreapprovalId' aparece $preapprovalCount veces en el archivo. No se modifico nada. Pegame de nuevo las lineas 25 a 50 (con mas contexto) de src\types\firestore.ts."
    }
}
else {
    Write-Warning "Encontre $($matches.Count) copias del bloque (esperaba exactamente 2). No modifique el archivo para evitar un error. Pegame el archivo completo src\types\firestore.ts para revisarlo a mano."
}

# Verificacion final (se hace siempre, se haya modificado el archivo o no)
$finalContent = [System.IO.File]::ReadAllText($fullPath)
$finalCount = ([regex]::Matches($finalContent, "mercadoPagoPreapprovalId")).Count

if ($finalCount -eq 1) {
    Write-Host "[OK] Verificacion final: 'mercadoPagoPreapprovalId' aparece 1 vez en $path. Archivo correcto."
} else {
    Write-Warning "[FALTA] Verificacion final: 'mercadoPagoPreapprovalId' aparece $finalCount veces en $path (deberia ser 1). Revisa el archivo a mano o pegame el contenido completo."
}

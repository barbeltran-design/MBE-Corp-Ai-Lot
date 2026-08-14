# ============================================================
# Diagnostico: por que no coincidieron los archivos
# ============================================================
# Este script NO modifica nada de tu codigo.
# Solo hace: git status, git add, git commit y git push,
# para que yo (Claude) pueda ver en GitHub exactamente
# como estan tus archivos ahora mismo y arreglar el script.
# ============================================================

$ruta = "C:\Users\barbe\Desktop\MBE-Corpilot-AI"

if (-not (Test-Path -LiteralPath $ruta)) {
    Write-Host "ERROR: no se encontro la carpeta $ruta" -ForegroundColor Red
    exit 1
}

Set-Location -LiteralPath $ruta

Write-Host ""
Write-Host "== Estado actual del repositorio ==" -ForegroundColor Cyan
git status

Write-Host ""
Write-Host "== Guardando tus cambios actuales (por si acaso) ==" -ForegroundColor Cyan
git add -A
$hayCambios = git status --porcelain
if ([string]::IsNullOrWhiteSpace($hayCambios)) {
    Write-Host "No hay cambios nuevos que guardar (ya estaba todo guardado)." -ForegroundColor Yellow
} else {
    git commit -m "Diagnostico: guardar estado actual antes de aplicar Babel/Worlds premium"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR al hacer commit. Copia este mensaje completo y avisa a Claude." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: cambios guardados localmente (commit hecho)." -ForegroundColor Green
}

Write-Host ""
Write-Host "== Subiendo a GitHub ==" -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR al subir a GitHub (git push fallo)." -ForegroundColor Red
    Write-Host "Copia TODO el mensaje de arriba (incluyendo el de git push) y pasaselo a Claude." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "== LISTO ==" -ForegroundColor Green
Write-Host "Tus archivos ya estan subidos a GitHub. Avisale a Claude que ya se subieron," -ForegroundColor Green
Write-Host "para que revise el repositorio y prepare el script corregido." -ForegroundColor Green

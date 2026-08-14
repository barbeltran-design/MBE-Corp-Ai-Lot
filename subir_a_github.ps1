# ============================================================
# Subir los cambios a GitHub
# ============================================================
# Esto guarda (commit) y sube (push) los cambios que ya se
# aplicaron con el script anterior. No hace ningun cambio
# nuevo de codigo, solo los sube a internet.
# ============================================================

$ruta = "C:\Users\barbe\Desktop\MBE-Corpilot-AI"

if (-not (Test-Path -LiteralPath $ruta)) {
    Write-Host "ERROR: no se encontro la carpeta $ruta" -ForegroundColor Red
    exit 1
}

Set-Location -LiteralPath $ruta

Write-Host ""
Write-Host "== Que se va a subir ==" -ForegroundColor Cyan
git status

Write-Host ""
Write-Host "== Guardando los cambios ==" -ForegroundColor Cyan
git add -A
$hayCambios = git status --porcelain
if ([string]::IsNullOrWhiteSpace($hayCambios)) {
    Write-Host "No hay cambios nuevos que subir (ya estaba todo subido)." -ForegroundColor Yellow
} else {
    git commit -m "Babel Madurez y Mundos Premium: avatares, quitar seccion duplicada, IA vs mentor, paywall del plan mensual"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR al hacer commit. Copia este mensaje completo y avisa a Claude." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: cambios guardados localmente." -ForegroundColor Green
}

Write-Host ""
Write-Host "== Subiendo a GitHub ==" -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR al subir (git push fallo). Copia TODO el mensaje y avisa a Claude." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "== LISTO ==" -ForegroundColor Green
Write-Host "Tus cambios ya estan en GitHub. En unos minutos Vercel los debe" -ForegroundColor Green
Write-Host "publicar automaticamente en https://mbe-ai-copilot.vercel.app/" -ForegroundColor Green

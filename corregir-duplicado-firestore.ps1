<#
========================================================================
 corregir-duplicado-firestore.ps1

 QUE HACE ESTE SCRIPT:

 Corrige src/types/firestore.ts, que quedo con los campos
 mercadoPagoPreapprovalId y planCanceladoAt declarados DOS VECES (por
 eso el deploy de Vercel fallo con "Duplicate identifier"). Esto paso
 porque el script de migracion se corrio mas de una vez sobre ese
 archivo -- tenia un bug mio de idempotencia, ya identificado.

 Este script SOLO toca src/types/firestore.ts. No vuelve a tocar
 perfil/page.tsx (ese ya quedo bien, sin errores en el build).

 COMO CORRERLO:
   1) Abre PowerShell.
   2) Ve a la raiz de tu repo:
        cd C:\Users\barbe\Desktop\MBE-Corpilot-AI
   3) Ejecuta:
        powershell -ExecutionPolicy Bypass -File .\corregir-duplicado-firestore.ps1
   4) Debes ver "[OK] firestore.ts: quitar declaracion duplicada".
   5) git diff  (para confirmar que solo se quito la duplicacion)
      git add -A
      git commit -m "Quitar declaracion duplicada en firestore.ts"
      git push
   6) Vercel deberia desplegar sin el error de "Duplicate identifier".
========================================================================
#>

$ErrorActionPreference = 'Stop'

$firestorePath = "src\types\firestore.ts"

if (-not (Test-Path -LiteralPath $firestorePath)) {
    throw "No se encontro $firestorePath . Ejecuta este script desde la raiz del repo."
}

$content = [System.IO.File]::ReadAllText($firestorePath)

$oldCrlf = @'
  mercadoPagoPaymentId?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
'@

$newCrlf = @'
  mercadoPagoPaymentId?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
'@

$oldLf = @'
  mercadoPagoPaymentId?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
'@

$newLf = @'
  mercadoPagoPaymentId?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
'@

$countCrlf = ([regex]::Matches($content, [regex]::Escape($oldCrlf))).Count
$countLf = ([regex]::Matches($content, [regex]::Escape($oldLf))).Count

if ($countCrlf -eq 1) {
    $newContent = $content.Replace($oldCrlf, $newCrlf)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($firestorePath, $newContent, $utf8NoBom)
    Write-Host "[OK] firestore.ts: quitar declaracion duplicada (formato CRLF)" -ForegroundColor Green
} elseif ($countLf -eq 1) {
    $newContent = $content.Replace($oldLf, $newLf)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($firestorePath, $newContent, $utf8NoBom)
    Write-Host "[OK] firestore.ts: quitar declaracion duplicada (formato LF)" -ForegroundColor Green
} else {
    $preapprovalCount = ([regex]::Matches($content, "mercadoPagoPreapprovalId")).Count
    if ($preapprovalCount -eq 1) {
        Write-Host "[OK - ya estaba bien] firestore.ts no tiene duplicados." -ForegroundColor Cyan
    } else {
        Write-Warning "No pude encontrar el patron exacto duplicado que esperaba (aparece $preapprovalCount veces 'mercadoPagoPreapprovalId'). No se modifico el archivo. Pegame las lineas 25 a 45 de src\types\firestore.ts para revisar a mano."
    }
}

Write-Host ""
$finalContent = [System.IO.File]::ReadAllText($firestorePath)
$finalCount = ([regex]::Matches($finalContent, "mercadoPagoPreapprovalId")).Count
if ($finalCount -eq 1) {
    Write-Host "[OK] Verificacion final: mercadoPagoPreapprovalId aparece 1 sola vez." -ForegroundColor Green
} else {
    Write-Host "[FALTA] Verificacion final: mercadoPagoPreapprovalId aparece $finalCount veces (deberia ser 1). Revisa el archivo a mano." -ForegroundColor Red
}

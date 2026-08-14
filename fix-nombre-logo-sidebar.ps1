<#
.SYNOPSIS
  Corrige el nombre 'MBE Corpilot AI' -> 'MBE Corp-AI-Lot' y agranda el logo
  en la barra lateral de la app (pagina de Inicio y demas paginas internas).
.NOTES
  Ejecutar desde la carpeta raiz del repo (donde esta la carpeta src).
#>

$ErrorActionPreference = 'Stop'

function Set-Utf8NoBom([string]$Path, [string]$Content) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Replace-Exactly([string]$Path, [string]$Old, [string]$New, [string]$Label) {
  $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  $count = ([regex]::Matches($content, [regex]::Escape($Old))).Count
  if ($count -eq 0) {
    Write-Host "  [SALTADO] $Label -> no se encontro el texto original (puede que ya este aplicado o el archivo cambio). Revisa manualmente." -ForegroundColor Yellow
    return $false
  }
  if ($count -gt 1) {
    throw "[$Label] se encontraron $count coincidencias en $Path (se esperaba 1). Abortando para evitar cambios incorrectos."
  }
  $newContent = $content.Replace($Old, $New)
  Set-Utf8NoBom -Path $Path -Content $newContent
  Write-Host "  [OK] $Label" -ForegroundColor Green
  return $true
}

$appShellPath    = Join-Path $PSScriptRoot 'src\components\app-shell.tsx'
$execShellPath   = Join-Path $PSScriptRoot 'src\components\executive-shell.tsx'
$execPreviewPath = Join-Path $PSScriptRoot 'src\app\[locale]\executive-preview\page.tsx'

foreach ($p in @($appShellPath, $execShellPath, $execPreviewPath)) {
  if (-not (Test-Path $p)) { throw "No se encontro el archivo: $p . Ejecuta este script desde la raiz del repo." }
}

Write-Host 'Corrigiendo nombre de marca y tamano de logo en la barra lateral...' -ForegroundColor Cyan
$old1 = @'
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
'@
$new1 = @'
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corp-AI-Lot" logoSrc="/logo-mbe.png">
'@
Replace-Exactly -Path $appShellPath -Old $old1 -New $new1 -Label 'app-shell.tsx: nombre de marca en la barra lateral' | Out-Null

$old2 = @'
      <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
        <BackgroundBlobs />
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <GlassCard className="animate-fade-in">
'@
$new2 = @'
      <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corp-AI-Lot" logoSrc="/logo-mbe.png">
        <BackgroundBlobs />
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <GlassCard className="animate-fade-in">
'@
Replace-Exactly -Path $execPreviewPath -Old $old2 -New $new2 -Label 'executive-preview/page.tsx: nombre de marca (pantalla de inicio de sesion)' | Out-Null

$old3 = @'
    <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
      <BackgroundBlobs />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div id="resumen-titulo" className="animate-fade-in">
'@
$new3 = @'
    <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corp-AI-Lot" logoSrc="/logo-mbe.png">
      <BackgroundBlobs />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div id="resumen-titulo" className="animate-fade-in">
'@
Replace-Exactly -Path $execPreviewPath -Old $old3 -New $new3 -Label 'executive-preview/page.tsx: nombre de marca (resumen ejecutivo)' | Out-Null

$old4 = @'
  brandLabel = 'MBE Corpilot AI',
'@
$new4 = @'
  brandLabel = 'MBE Corp-AI-Lot',
'@
Replace-Exactly -Path $execShellPath -Old $old4 -New $new4 -Label 'executive-shell.tsx: nombre de marca por defecto' | Out-Null

$old5 = @'
              <img src={logoSrc} alt={brandLabel} className="h-6 w-6 shrink-0 rounded" onError={() => setLogoFailed(true)} />
'@
$new5 = @'
              <img src={logoSrc} alt={brandLabel} className="h-9 w-9 shrink-0 rounded" onError={() => setLogoFailed(true)} />
'@
Replace-Exactly -Path $execShellPath -Old $old5 -New $new5 -Label 'executive-shell.tsx: logo mas grande (icono)' | Out-Null

$old6 = @'
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
'@
$new6 = @'
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
'@
Replace-Exactly -Path $execShellPath -Old $old6 -New $new6 -Label 'executive-shell.tsx: logo mas grande (respaldo sin imagen)' | Out-Null

Write-Host ''
Write-Host 'Listo. Ahora corre:' -ForegroundColor Cyan
Write-Host '  npm run build'
Write-Host 'y si todo compila:'
Write-Host '  git add -A'
Write-Host '  git commit -m "Nombre de marca y logo mas grande en barra lateral"'
Write-Host '  git push'

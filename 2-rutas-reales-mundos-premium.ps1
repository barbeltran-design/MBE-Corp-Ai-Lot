#requires -Version 5.1
<#
  Parche B: crea rutas reales para los 5 mundos premium que faltaban
  (Dinero, Cliente, Normativo, Operativo, Cultura) y actualiza el menu
  lateral y la pagina de Inicio para que usen esas rutas reales en vez
  de "?v=" en la URL.

  Esto corrige el bug donde, al dar clic a un segundo mundo premium
  distinto en el menu, la vista no cambiaba (se quedaba en el primer
  mundo que abriste).

  Ejecuta este script DESDE LA RAIZ del repo clonado (donde esta la
  carpeta "src"). Es idempotente: si lo corres dos veces no rompe nada.
#>

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "[SKIP] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Read-Utf8NoBom([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    }
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-Utf8NoBom([string]$path, [string]$content) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $content, $enc)
}

# Windows suele guardar los .tsx con CRLF; normaliza a LF antes de comparar y
# restaura el salto de linea original justo antes de guardar (igual que en el
# Parche A), para que las comparaciones de texto no dependan del tipo de salto
# de linea del archivo.
function ConvertTo-Lf([string]$text) {
    return $text.Replace("`r`n", "`n")
}

function Restore-Eol([string]$text, [bool]$eraCrlf) {
    if ($eraCrlf) {
        return $text.Replace("`n", "`r`n")
    }
    return $text
}

function Apply-Replace {
    param(
        [string]$FilePath,
        [ref]$Content,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    if (-not $Content.Value.Contains($Old)) {
        Write-Err "No se encontro el bloque esperado para: $Label"
        Write-Err "Archivo: $FilePath"
        throw "Anclaje no encontrado: $Label"
    }
    $Content.Value = $Content.Value.Replace($Old, $New)
    Write-Ok "Aplicado: $Label"
}

$repoRoot = Get-Location
$worldsDir = Join-Path $repoRoot 'src/app/[locale]/worlds'

if (-not ([System.IO.Directory]::Exists($worldsDir))) {
    Write-Err "No se encontro $worldsDir. Corre este script desde la raiz del repo."
    exit 1
}

# ---------------------------------------------------------------------------
# 1) Crear las 5 rutas reales que faltan (copiando el patron de estrategia/partida)
# ---------------------------------------------------------------------------
$mundos = @(
    @{ id = 'dinero';     fn = 'WorldsDineroPage' },
    @{ id = 'cliente';    fn = 'WorldsClientePage' },
    @{ id = 'normativo';  fn = 'WorldsNormativoPage' },
    @{ id = 'operativo';  fn = 'WorldsOperativoPage' },
    @{ id = 'cultura';    fn = 'WorldsCulturaPage' }
)

foreach ($m in $mundos) {
    $dir = Join-Path $worldsDir $m.id
    $pagePath = Join-Path $dir 'page.tsx'

    if ([System.IO.File]::Exists($pagePath)) {
        Write-Skip "Ya existe la ruta /worlds/$($m.id) (page.tsx). No se toca."
        continue
    }

    [System.IO.Directory]::CreateDirectory($dir) | Out-Null

    $pageContent = @"
'use client';

import { WorldsBuilder } from '@/components/worlds/WorldsBuilder';

export default function $($m.fn)() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <WorldsBuilder vistaInicial="$($m.id)" />
      </div>
    </div>
  );
}
"@

    Write-Utf8NoBom $pagePath $pageContent
    Write-Ok "Creada ruta /worlds/$($m.id) ($pagePath)"
}

# ---------------------------------------------------------------------------
# 2) Actualizar el menu lateral (app-shell.tsx) para usar las rutas reales
# ---------------------------------------------------------------------------
$shellPath = Join-Path $repoRoot 'src/components/app-shell.tsx'
if (-not ([System.IO.File]::Exists($shellPath))) {
    Write-Err "No se encontro $shellPath."
    exit 1
}

$shellContent = Read-Utf8NoBom $shellPath
$shellEraCrlf = $shellContent.Contains("`r`n")
$shellContent = ConvertTo-Lf $shellContent

if ($shellContent.Contains('/worlds/estrategia`,')) {
    Write-Skip "app-shell.tsx ya usa rutas reales para Mundos Premium. No se toca."
} else {
    Write-Info "Actualizando enlaces de Mundos Premium en app-shell.tsx..."

    $sOld1 = "href: ``/`${locale}/worlds?v=estrategia``,"
    $sNew1 = "href: ``/`${locale}/worlds/estrategia``,"
    Apply-Replace -FilePath $shellPath -Content ([ref]$shellContent) -Old $sOld1 -New $sNew1 -Label 'enlace Estrategia (app-shell.tsx)'

    $sOld2 = "{ href: ``/`${locale}/worlds?v=dinero``,"
    $sNew2 = "{ href: ``/`${locale}/worlds/dinero``,"
    Apply-Replace -FilePath $shellPath -Content ([ref]$shellContent) -Old $sOld2 -New $sNew2 -Label 'enlace Dinero (app-shell.tsx)'

    $sOld3 = "{ href: ``/`${locale}/worlds?v=cliente``,"
    $sNew3 = "{ href: ``/`${locale}/worlds/cliente``,"
    Apply-Replace -FilePath $shellPath -Content ([ref]$shellContent) -Old $sOld3 -New $sNew3 -Label 'enlace Cliente (app-shell.tsx)'

    $sOld4 = "{ href: ``/`${locale}/worlds?v=normativo``,"
    $sNew4 = "{ href: ``/`${locale}/worlds/normativo``,"
    Apply-Replace -FilePath $shellPath -Content ([ref]$shellContent) -Old $sOld4 -New $sNew4 -Label 'enlace Normativo (app-shell.tsx)'

    $sOld5 = "{ href: ``/`${locale}/worlds?v=operativo``,"
    $sNew5 = "{ href: ``/`${locale}/worlds/operativo``,"
    Apply-Replace -FilePath $shellPath -Content ([ref]$shellContent) -Old $sOld5 -New $sNew5 -Label 'enlace Operativo (app-shell.tsx)'

    $sOld6 = "{ href: ``/`${locale}/worlds?v=cultura``,"
    $sNew6 = "{ href: ``/`${locale}/worlds/cultura``,"
    Apply-Replace -FilePath $shellPath -Content ([ref]$shellContent) -Old $sOld6 -New $sNew6 -Label 'enlace Cultura (app-shell.tsx)'

    $shellContent = Restore-Eol $shellContent $shellEraCrlf
    Write-Utf8NoBom $shellPath $shellContent
    Write-Ok "app-shell.tsx actualizado."
}

# ---------------------------------------------------------------------------
# 3) Actualizar la pagina de Inicio (InicioBuilder.tsx) para usar las rutas reales
# ---------------------------------------------------------------------------
$inicioPath = Join-Path $repoRoot 'src/components/babel/InicioBuilder.tsx'
if (-not ([System.IO.File]::Exists($inicioPath))) {
    Write-Err "No se encontro $inicioPath."
    exit 1
}

$inicioContent = Read-Utf8NoBom $inicioPath
$inicioEraCrlf = $inicioContent.Contains("`r`n")
$inicioContent = ConvertTo-Lf $inicioContent

if ($inicioContent.Contains("href: '/worlds/estrategia',")) {
    Write-Skip "InicioBuilder.tsx ya usa rutas reales para Mundos Premium. No se toca."
} else {
    Write-Info "Actualizando enlaces de Mundos Premium en InicioBuilder.tsx..."

    $iOld1 = "href: '/worlds?v=estrategia',"
    $iNew1 = "href: '/worlds/estrategia',"
    Apply-Replace -FilePath $inicioPath -Content ([ref]$inicioContent) -Old $iOld1 -New $iNew1 -Label 'enlace Estrategia (InicioBuilder.tsx)'

    $iOld2 = "href: '/worlds?v=dinero',"
    $iNew2 = "href: '/worlds/dinero',"
    Apply-Replace -FilePath $inicioPath -Content ([ref]$inicioContent) -Old $iOld2 -New $iNew2 -Label 'enlace Dinero (InicioBuilder.tsx)'

    $iOld3 = "href: '/worlds?v=cliente',"
    $iNew3 = "href: '/worlds/cliente',"
    Apply-Replace -FilePath $inicioPath -Content ([ref]$inicioContent) -Old $iOld3 -New $iNew3 -Label 'enlace Cliente (InicioBuilder.tsx)'

    $iOld4 = "href: '/worlds?v=normativo',"
    $iNew4 = "href: '/worlds/normativo',"
    Apply-Replace -FilePath $inicioPath -Content ([ref]$inicioContent) -Old $iOld4 -New $iNew4 -Label 'enlace Normativo (InicioBuilder.tsx)'

    $iOld5 = "href: '/worlds?v=operativo',"
    $iNew5 = "href: '/worlds/operativo',"
    Apply-Replace -FilePath $inicioPath -Content ([ref]$inicioContent) -Old $iOld5 -New $iNew5 -Label 'enlace Operativo (InicioBuilder.tsx)'

    $iOld6 = "href: '/worlds?v=cultura',"
    $iNew6 = "href: '/worlds/cultura',"
    Apply-Replace -FilePath $inicioPath -Content ([ref]$inicioContent) -Old $iOld6 -New $iNew6 -Label 'enlace Cultura (InicioBuilder.tsx)'

    $inicioContent = Restore-Eol $inicioContent $inicioEraCrlf
    Write-Utf8NoBom $inicioPath $inicioContent
    Write-Ok "InicioBuilder.tsx actualizado."
}

Write-Host ""
Write-Ok "Parche B completo."
Write-Host "Revisa los cambios con: git status  y  git diff --stat" -ForegroundColor Cyan

#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$RutaProyecto = "C:\Users\barbe\Desktop\MBE-Corpilot-AI"
Set-Location -LiteralPath $RutaProyecto

function Leer-Contenido {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No se encontro el archivo: $Path (revisa que estas en la carpeta correcta del proyecto)"
    }
    $full = (Resolve-Path -LiteralPath $Path).Path
    $raw = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
    # Normalizamos fin de linea (Windows CRLF -> LF) para que la comparacion funcione
    # sin importar como este guardado el archivo en este equipo.
    return $raw -replace "`r`n", "`n"
}

function Guardar-Contenido {
    param([string]$Path, [string]$Content)
    $utf8SinBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8SinBom)
}

function Aplicar-Reemplazo {
    param(
        [string]$Path,
        [string]$Old,
        [string]$New,
        [int]$EsperadoCount = 1
    )
    $contenido = Leer-Contenido -Path $Path
    $countOld = ([regex]::Matches($contenido, [regex]::Escape($Old))).Count
    if ($countOld -eq $EsperadoCount) {
        $nuevo = $contenido.Replace($Old, $New)
        Guardar-Contenido -Path $Path -Content $nuevo
        Write-Host "  OK -> $Path" -ForegroundColor Green
        return
    }
    $countNew = ([regex]::Matches($contenido, [regex]::Escape($New))).Count
    if ($countOld -eq 0 -and $countNew -ge 1) {
        Write-Host "  (ya estaba aplicado) $Path" -ForegroundColor Yellow
        return
    }
    throw "El contenido de '$Path' no coincide con lo esperado (encontradas $countOld coincidencias, se esperaban $EsperadoCount). No se modifico nada mas en ese archivo. Copia este mensaje y compartelo con Claude."
}

Write-Host ""
Write-Host "=== Aplicando cambios en MBE Corp-AI-lot ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "-- src/app/[locale]/page.tsx --" -ForegroundColor DarkCyan
$old0_0 = @'
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mbe.png" alt={tCommon('appName')} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-slate-900">{tCommon('appName')}</span>
'@
$new0_0 = @'
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mbe.png" alt={tCommon('appName')} className="h-16 w-16 object-contain" />
          <span className="text-lg font-semibold text-slate-900">{tCommon('appName')}</span>
'@
Aplicar-Reemplazo -Path "src/app/[locale]/page.tsx" -Old $old0_0 -New $new0_0 -EsperadoCount 1
$old0_1 = @'
      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {tCommon('appName')}. {tFooter('rights')}
      </footer>
'@
$new0_1 = @'
      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {tFooter('brand')}. {tFooter('rights')}
      </footer>
'@
Aplicar-Reemplazo -Path "src/app/[locale]/page.tsx" -Old $old0_1 -New $new0_1 -EsperadoCount 1

Write-Host "-- src/components/agentes/AgentAvatar.tsx --" -ForegroundColor DarkCyan
$old1_0 = @'

export type AgenteAvatarId = 'Babel' | 'Fisnando' | 'Karmetin' | 'Normau' | 'Atech';
export type AgentePose = 'reposando' | 'guiando';
'@
$new1_0 = @'

export type AgenteAvatarId = 'Babel' | 'Fisnando' | 'Karmetin' | 'Normau' | 'Atech' | 'Ecori';
export type AgentePose = 'reposando' | 'guiando';
'@
Aplicar-Reemplazo -Path "src/components/agentes/AgentAvatar.tsx" -Old $old1_0 -New $new1_0 -EsperadoCount 1
$old1_1 = @'
  Atech: 'atech',
};
'@
$new1_1 = @'
  Atech: 'atech',
  Ecori: 'ecori',
};
'@
Aplicar-Reemplazo -Path "src/components/agentes/AgentAvatar.tsx" -Old $old1_1 -New $new1_1 -EsperadoCount 1

Write-Host "-- src/components/babel/ConvocatoriasBuilder.tsx --" -ForegroundColor DarkCyan
$old2_0 = @'
      <div className="flex items-center gap-3">
        <AgentAvatar size={56} className="shrink-0" />
        <div>
'@
$new2_0 = @'
      <div className="flex items-center gap-3">
        <AgentAvatar agente="Ecori" size={56} className="shrink-0" />
        <div>
'@
Aplicar-Reemplazo -Path "src/components/babel/ConvocatoriasBuilder.tsx" -Old $old2_0 -New $new2_0 -EsperadoCount 2
$old2_1 = @'
      <div className="flex items-center gap-3">
        <AgentAvatar size={56} className="shrink-0" />
        <div>
'@
$new2_1 = @'
      <div className="flex items-center gap-3">
        <AgentAvatar agente="Ecori" size={56} className="shrink-0" />
        <div>
'@
Aplicar-Reemplazo -Path "src/components/babel/ConvocatoriasBuilder.tsx" -Old $old2_1 -New $new2_1 -EsperadoCount 2

Write-Host "-- src/components/babel/InicioBuilder.tsx --" -ForegroundColor DarkCyan
$old3_0 = @'

// Orden oficial del usuario: Babel, Fisnando, Karmetin, Normau, Atech.
const CORPILOTES: CorpiloteInfo[] = [
'@
$new3_0 = @'

// Orden oficial del usuario: Babel, Fisnando, Karmetin, Normau, Atech, Ecori.
const CORPILOTES: CorpiloteInfo[] = [
'@
Aplicar-Reemplazo -Path "src/components/babel/InicioBuilder.tsx" -Old $old3_0 -New $new3_0 -EsperadoCount 1
$old3_1 = @'
    rasgo: ['Te estructura y facilita decisiones', 'Structures you and eases decisions'],
  },
'@
$new3_1 = @'
    rasgo: ['Te estructura y facilita decisiones', 'Structures you and eases decisions'],
  },
  {
    agente: 'Ecori',
    temas: ['Convocatorias | Fondos', 'Calls | Funds'],
    rasgo: ['Te guía a ganar', 'Guides you to win'],
  },
'@
Aplicar-Reemplazo -Path "src/components/babel/InicioBuilder.tsx" -Old $old3_1 -New $new3_1 -EsperadoCount 1
$old3_2 = @'

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CORPILOTES.map((ag) => (
'@
$new3_2 = @'

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {CORPILOTES.map((ag) => (
'@
Aplicar-Reemplazo -Path "src/components/babel/InicioBuilder.tsx" -Old $old3_2 -New $new3_2 -EsperadoCount 1

Write-Host "-- src/components/landing/agents-preview.tsx --" -ForegroundColor DarkCyan
$old4_0 = @'

const AGENTES: AgenteAvatarId[] = ['Babel', 'Fisnando', 'Karmetin', 'Normau', 'Atech'];

'@
$new4_0 = @'

const AGENTES: AgenteAvatarId[] = ['Babel', 'Fisnando', 'Karmetin', 'Normau', 'Atech', 'Ecori'];

'@
Aplicar-Reemplazo -Path "src/components/landing/agents-preview.tsx" -Old $old4_0 -New $new4_0 -EsperadoCount 1
$old4_1 = @'

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {AGENTES.map((agente) => {
'@
$new4_1 = @'

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {AGENTES.map((agente) => {
'@
Aplicar-Reemplazo -Path "src/components/landing/agents-preview.tsx" -Old $old4_1 -New $new4_1 -EsperadoCount 1

Write-Host "-- src/components/landing/hero.tsx --" -ForegroundColor DarkCyan
$old5_0 = @'
import { Sparkles } from 'lucide-react';

'@
$new5_0 = @'
import { Sparkles } from 'lucide-react';

const HERO_COVER_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_3GKSOWtJRYR8ZbKliULo84biwzL/hf_20260814_015644_b2eab912-9908-446d-9e44-e56c82142d11.png';

'@
Aplicar-Reemplazo -Path "src/components/landing/hero.tsx" -Old $old5_0 -New $new5_0 -EsperadoCount 1
$old5_1 = @'
      </h1>
      <p className="mt-5 text-lg text-slate-600">{t('subtitle')}</p>
      <p className="mt-4 text-sm text-slate-400">{t('socialProof')}</p>
'@
$new5_1 = @'
      </h1>
      <p className="mt-5 whitespace-pre-line text-lg text-slate-600">{t('subtitle')}</p>
      <p className="mt-4 text-sm text-slate-400">{t('socialProof')}</p>
'@
Aplicar-Reemplazo -Path "src/components/landing/hero.tsx" -Old $old5_1 -New $new5_1 -EsperadoCount 1
$old5_2 = @'
      <p className="mt-4 text-sm text-slate-400">{t('socialProof')}</p>
    </div>
'@
$new5_2 = @'
      <p className="mt-4 text-sm text-slate-400">{t('socialProof')}</p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_COVER_URL}
        alt={t('title')}
        className="mt-6 w-full max-w-sm rounded-2xl border border-emerald-100 object-cover shadow-lg"
        loading="lazy"
      />
    </div>
'@
Aplicar-Reemplazo -Path "src/components/landing/hero.tsx" -Old $old5_2 -New $new5_2 -EsperadoCount 1

Write-Host "-- src/messages/en.json --" -ForegroundColor DarkCyan
$old6_0 = @'
  "common": {
    "appName": "MBE AI Copilot",
    "download": "Download",
'@
$new6_0 = @'
  "common": {
    "appName": "MBE Corp-AI-lot",
    "download": "Download",
'@
Aplicar-Reemplazo -Path "src/messages/en.json" -Old $old6_0 -New $new6_0 -EsperadoCount 1
$old6_1 = @'
      "eyebrow": "Powered by Gemini on Google Cloud",
      "title": "Transform your small business into a world-class company with AI",
      "subtitle": "5 specialized AI agents diagnose your business and hand you real plans, contracts and spreadsheets — not generic advice.",
      "ctaPrimary": "Create free account",
'@
$new6_1 = @'
      "eyebrow": "Powered by Gemini on Google Cloud",
      "title": "⚠️ Let's be honest: what's stopping you from growing?",
      "subtitle": "No access to money? - We give it to you 💸\nNo team to work with? - We connect you with Mentors and AI Agents 🐙🛡️\nDon't know where to start? - We guide you step by step 📈\n\n🔥 Start FREE today - Sign up now!\n\nYou no longer have a (©#!%&@º) excuse",
      "ctaPrimary": "Create free account",
'@
Aplicar-Reemplazo -Path "src/messages/en.json" -Old $old6_1 -New $new6_1 -EsperadoCount 1
$old6_2 = @'
          "name": "Normau",
          "domain": "Partnerships"
        },
'@
$new6_2 = @'
          "name": "Normau",
          "domain": "Legal Compliance"
        },
'@
Aplicar-Reemplazo -Path "src/messages/en.json" -Old $old6_2 -New $new6_2 -EsperadoCount 1
$old6_3 = @'
          "domain": "Operations"
        }
'@
$new6_3 = @'
          "domain": "Operations"
        },
        "ecori": {
          "name": "Ecori",
          "domain": "Calls & Grants"
        }
'@
Aplicar-Reemplazo -Path "src/messages/en.json" -Old $old6_3 -New $new6_3 -EsperadoCount 1
$old6_4 = @'
  "footer": {
    "rights": "All rights reserved."
'@
$new6_4 = @'
  "footer": {
    "brand": "MBE Corp",
    "rights": "All rights reserved."
'@
Aplicar-Reemplazo -Path "src/messages/en.json" -Old $old6_4 -New $new6_4 -EsperadoCount 1

Write-Host "-- src/messages/es.json --" -ForegroundColor DarkCyan
$old7_0 = @'
  "common": {
    "appName": "MBE AI Copilot",
    "download": "Descargar",
'@
$new7_0 = @'
  "common": {
    "appName": "MBE Corp-AI-lot",
    "download": "Descargar",
'@
Aplicar-Reemplazo -Path "src/messages/es.json" -Old $old7_0 -New $new7_0 -EsperadoCount 1
$old7_1 = @'
      "eyebrow": "Con Gemini de Google Cloud",
      "title": "Transforma tu PyME en una empresa de clase mundial con IA",
      "subtitle": "5 agentes de IA especializados diagnostican tu negocio y te entregan planes, contratos y hojas de cálculo reales — no consejos genéricos.",
      "ctaPrimary": "Crear cuenta gratis",
'@
$new7_1 = @'
      "eyebrow": "Con Gemini de Google Cloud",
      "title": "⚠️ Seamos honestos: ¿Qué te detiene para crecer?",
      "subtitle": "¿No tienes acceso a dinero? - Te lo damos 💸\n¿No tienes equipo de trabajo? - Nosotros te acercamos Mentores y Agentes de IA 🐙🛡️\n¿No sabes por dónde empezar? - Te guiamos paso a paso 📈\n\n🔥 Inicia GRATIS hoy mismo ¡Inscríbete!\n\nYa no tienes un (©#!%&@º) pretexto",
      "ctaPrimary": "Crear cuenta gratis",
'@
Aplicar-Reemplazo -Path "src/messages/es.json" -Old $old7_1 -New $new7_1 -EsperadoCount 1
$old7_2 = @'
          "name": "Normau",
          "domain": "Alianzas"
        },
'@
$new7_2 = @'
          "name": "Normau",
          "domain": "Cumplimiento legal"
        },
'@
Aplicar-Reemplazo -Path "src/messages/es.json" -Old $old7_2 -New $new7_2 -EsperadoCount 1
$old7_3 = @'
          "domain": "Operación"
        }
'@
$new7_3 = @'
          "domain": "Operación"
        },
        "ecori": {
          "name": "Ecori",
          "domain": "Convocatorias y Fondos"
        }
'@
Aplicar-Reemplazo -Path "src/messages/es.json" -Old $old7_3 -New $new7_3 -EsperadoCount 1
$old7_4 = @'
  "footer": {
    "rights": "Todos los derechos reservados."
'@
$new7_4 = @'
  "footer": {
    "brand": "MBE Corp",
    "rights": "Todos los derechos reservados."
'@
Aplicar-Reemplazo -Path "src/messages/es.json" -Old $old7_4 -New $new7_4 -EsperadoCount 1

Write-Host "-- public/avatars (Ecori) --" -ForegroundColor DarkCyan
$carpetaOrigen = $PSScriptRoot
$avatar1 = Join-Path $carpetaOrigen "ecori-reposando.png"
$avatar2 = Join-Path $carpetaOrigen "ecori-guiando.png"
if (-not (Test-Path -LiteralPath $avatar1) -or -not (Test-Path -LiteralPath $avatar2)) {
    throw "No encuentro ecori-reposando.png y/o ecori-guiando.png en la misma carpeta que este script ($carpetaOrigen). Asegurate de guardar las 2 imagenes junto al script antes de ejecutarlo."
}
New-Item -ItemType Directory -Force -Path "public\avatars" | Out-Null
Copy-Item -LiteralPath $avatar1 -Destination "public\avatars\ecori-reposando.png" -Force
Copy-Item -LiteralPath $avatar2 -Destination "public\avatars\ecori-guiando.png" -Force
Write-Host "  OK -> public\avatars\ecori-reposando.png y ecori-guiando.png" -ForegroundColor Green

Write-Host ""
Write-Host "=== Listo. Todos los cambios se aplicaron correctamente. ===" -ForegroundColor Cyan
Write-Host "Ahora puedes revisar con: npm run dev"
Write-Host "O subir los cambios a GitHub con el script de siempre."
Write-Host ""

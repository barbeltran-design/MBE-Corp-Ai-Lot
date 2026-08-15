#requires -Version 5.1
<#
  Parche A: agrega avatar y tutorial (tour) a Reference Place y a Juntas de
  Mentoria (Club), que hoy no tienen ninguno de los dos.

  - Reference Place  -> avatar Karmetin (tema Marketing/Ventas/Atencion al cliente)
  - Club / Juntas     -> avatar Babel (mentoria general)

  Ejecuta este script DESDE LA RAIZ del repo clonado (donde esta la carpeta
  "src"). Es idempotente: si lo corres dos veces no rompe nada, detecta lo
  que ya esta aplicado y lo salta.
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

# Windows suele guardar los .tsx con saltos de linea CRLF (retorno de carro + salto
# de linea), mientras que los anclajes de este script se escribieron con LF (solo
# salto de linea). Para que las comparaciones de texto encuentren los bloques sin
# importar el tipo de salto de linea del archivo, se normaliza todo a LF antes de
# comparar, y se restaura el salto de linea original justo antes de guardar.
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

# ---------------------------------------------------------------------------
# 1) CLUB (Juntas de Mentoria) -> avatar Babel + tutorial
# ---------------------------------------------------------------------------
$clubPath = Join-Path $repoRoot 'src/components/club/ClubBuilder.tsx'
if (-not ([System.IO.File]::Exists($clubPath))) {
    Write-Err "No se encontro $clubPath. Corre este script desde la raiz del repo."
    exit 1
}

$clubContent = Read-Utf8NoBom $clubPath
$clubEraCrlf = $clubContent.Contains("`r`n")
$clubContent = ConvertTo-Lf $clubContent

if ($clubContent.Contains('id="club-title"')) {
    Write-Skip "ClubBuilder.tsx ya tiene el avatar y tutorial aplicados. No se toca."
} else {
    Write-Info "Aplicando parche a ClubBuilder.tsx..."

    # --- 1.1 imports ---
    $old1 = @'
import { useUserRoles } from '@/lib/use-user-roles';
'@
    $new1 = @'
import { useUserRoles } from '@/lib/use-user-roles';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old1 -New $new1 -Label 'imports (Club)'

    # --- 1.2 pasos del tour ---
    $old2 = @'
import { nivelMinimoNoticiasLabel } from '@/lib/premium';
'@
    $new2 = @'
import { nivelMinimoNoticiasLabel } from '@/lib/premium';

const PASOS_TOUR_CLUB: Record<'es' | 'en', TourStep[]> = {
  es: [
    {
      selector: '#club-title',
      title: 'Comunidad de Mentoria Semanal',
      description:
        'Aqui participas en las juntas semanales de mentoria: revisas el tema de la semana, tus puntos, tu nivel y las noticias de la comunidad.',
    },
    {
      selector: '#club-progreso',
      title: 'Tu progreso',
      description:
        'Aqui ves tu nivel actual, tus puntos acumulados y cuantos puntos te faltan para el siguiente nivel.',
    },
    {
      selector: '#club-tabs',
      title: 'Secciones de la comunidad',
      description:
        'Cambia entre la junta semanal, tus puntos y niveles, la organizacion de las juntas y las noticias de la comunidad.',
    },
  ],
  en: [
    {
      selector: '#club-title',
      title: 'Weekly Mentoring Community',
      description:
        'Here you take part in the weekly mentoring meetings: check this week topic, your points, your level and the community news.',
    },
    {
      selector: '#club-progreso',
      title: 'Your progress',
      description:
        'See your current level, your accumulated points and how many points you need for the next level.',
    },
    {
      selector: '#club-tabs',
      title: 'Community sections',
      description:
        'Switch between the weekly meeting, your points and levels, meeting organization and community news.',
    },
  ],
};
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old2 -New $new2 -Label 'PASOS_TOUR_CLUB (Club)'

    # --- 1.3 avatar junto al titulo ---
    $old3 = @'
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Comunidad de Mentoría Semanal', 'Weekly Mentoring Community')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
'@
    $new3 = @'
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AgentAvatar agente="Babel" size={48} className="mt-0.5 shrink-0" onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))} />
          <div>
          <h1 id="club-title" className="text-xl font-semibold text-foreground">{t('Comunidad de Mentoría Semanal', 'Weekly Mentoring Community')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old3 -New $new3 -Label 'avatar junto al titulo (Club)'

    # --- 1.4 cerrar el div extra antes del boton Actualizar ---
    $old4 = @'
          </p>
        </div>
        <button
          type="button"
          onClick={recargar}
'@
    $new4 = @'
          </p>
          </div>
        </div>
        <button
          type="button"
          onClick={recargar}
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old4 -New $new4 -Label 'cierre del div del titulo (Club)'

    # --- 1.5 id en tarjeta "Mi progreso" ---
    $old5 = @'
          {/* Mi progreso */}
          {yo && (
            <div className="glass-panel p-4">
'@
    $new5 = @'
          {/* Mi progreso */}
          {yo && (
            <div id="club-progreso" className="glass-panel p-4">
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old5 -New $new5 -Label 'id en Mi progreso (Club)'

    # --- 1.6 id en barra de pestanas ---
    $old6 = @'
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {([
              ['semana', 'Junta semanal', Users],
'@
    $new6 = @'
          {/* Tabs */}
          <div id="club-tabs" className="flex flex-wrap gap-2">
            {([
              ['semana', 'Junta semanal', Users],
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old6 -New $new6 -Label 'id en pestanas (Club)'

    # --- 1.7 PageTour al final ---
    $old7 = @'
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
'@
    $new7 = @'
              </div>
            )}
          </div>
        </div>
      )}
      <PageTour pageId="club" steps={dispLang === 'en' ? PASOS_TOUR_CLUB.en : PASOS_TOUR_CLUB.es} lang={dispLang} />
    </div>
  );
}
'@
    Apply-Replace -FilePath $clubPath -Content ([ref]$clubContent) -Old $old7 -New $new7 -Label 'PageTour al final (Club)'

    $clubContent = Restore-Eol $clubContent $clubEraCrlf
    Write-Utf8NoBom $clubPath $clubContent
    Write-Ok "ClubBuilder.tsx actualizado."
}

# ---------------------------------------------------------------------------
# 2) REFERENCE PLACE -> avatar Karmetin + tutorial
# ---------------------------------------------------------------------------
$refPath = Join-Path $repoRoot 'src/components/refplace/ReferencePlaceBuilder.tsx'
if (-not ([System.IO.File]::Exists($refPath))) {
    Write-Err "No se encontro $refPath. Corre este script desde la raiz del repo."
    exit 1
}

$refContent = Read-Utf8NoBom $refPath
$refEraCrlf = $refContent.Contains("`r`n")
$refContent = ConvertTo-Lf $refContent

if ($refContent.Contains('id="refplace-title"')) {
    Write-Skip "ReferencePlaceBuilder.tsx ya tiene el avatar y tutorial aplicados. No se toca."
} else {
    Write-Info "Aplicando parche a ReferencePlaceBuilder.tsx..."

    # --- 2.1 imports ---
    $rold1 = @'
import { useDisplayLang } from '@/components/display-lang-provider';
'@
    $rnew1 = @'
import { useDisplayLang } from '@/components/display-lang-provider';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold1 -New $rnew1 -Label 'imports (Reference Place)'

    # --- 2.2 pasos del tour ---
    $rold2 = @'
} from '@/lib/refplace';
'@
    $rnew2 = @'
} from '@/lib/refplace';

const PASOS_TOUR_REFPLACE: Record<'es' | 'en', TourStep[]> = {
  es: [
    {
      selector: '#refplace-title',
      title: 'Reference Place',
      description:
        'Aqui encuentras el mercado de referencias, agendas reuniones B2B con la comunidad y consultas perfiles publicos de miembros certificados MBE.',
    },
    {
      selector: '#refplace-perfil',
      title: 'Tu perfil comunitario',
      description:
        'Aqui ves tu nivel, si ya estas certificado y si tienes acceso a reuniones B2B y a solicitar referencias.',
    },
    {
      selector: '#refplace-tabs',
      title: 'Secciones de Reference Place',
      description:
        'Cambia entre Referencias y Rep Sales, Reuniones B2B y el directorio de la Comunidad.',
    },
  ],
  en: [
    {
      selector: '#refplace-title',
      title: 'Reference Place',
      description:
        'Here you find the referral marketplace, schedule B2B meetings with the community, and check public profiles of certified MBE members.',
    },
    {
      selector: '#refplace-perfil',
      title: 'Your community profile',
      description:
        'See your level, whether you are already certified, and whether you have access to B2B meetings and to request referrals.',
    },
    {
      selector: '#refplace-tabs',
      title: 'Reference Place sections',
      description:
        'Switch between Referrals & Sales Reps, B2B Meetings and the Community directory.',
    },
  ],
};
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold2 -New $rnew2 -Label 'PASOS_TOUR_REFPLACE (Reference Place)'

    # --- 2.3 avatar junto al titulo ---
    $rold3 = @'
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Reference Place', 'Reference Place')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
'@
    $rnew3 = @'
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AgentAvatar agente="Karmetin" size={48} className="mt-0.5 shrink-0" onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))} />
          <div>
          <h1 id="refplace-title" className="text-xl font-semibold text-foreground">{t('Reference Place', 'Reference Place')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold3 -New $rnew3 -Label 'avatar junto al titulo (Reference Place)'

    # --- 2.4 cerrar el div extra antes del boton Actualizar ---
    $rold4 = @'
          </p>
        </div>
        <button
          type="button"
          onClick={recargar}
'@
    $rnew4 = @'
          </p>
          </div>
        </div>
        <button
          type="button"
          onClick={recargar}
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold4 -New $rnew4 -Label 'cierre del div del titulo (Reference Place)'

    # --- 2.5 id en tarjeta de perfil comunitario ---
    $rold5 = @'
          {/* Tarjeta de mi perfil comunitario */}
          <div className="glass-panel p-4">
'@
    $rnew5 = @'
          {/* Tarjeta de mi perfil comunitario */}
          <div id="refplace-perfil" className="glass-panel p-4">
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold5 -New $rnew5 -Label 'id en tarjeta de perfil (Reference Place)'

    # --- 2.6 id en barra de pestanas ---
    $rold6 = @'
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {([
              ['mercado', 'Referencias y Rep Sales', Store],
'@
    $rnew6 = @'
          {/* Tabs */}
          <div id="refplace-tabs" className="flex flex-wrap gap-2">
            {([
              ['mercado', 'Referencias y Rep Sales', Store],
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold6 -New $rnew6 -Label 'id en pestanas (Reference Place)'

    # --- 2.7 PageTour al final ---
    $rold7 = @'
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'@
    $rnew7 = @'
            </div>
          </div>
        </div>
      )}
      <PageTour pageId="refplace" steps={dispLang === 'en' ? PASOS_TOUR_REFPLACE.en : PASOS_TOUR_REFPLACE.es} lang={dispLang} />
    </div>
  );
}
'@
    Apply-Replace -FilePath $refPath -Content ([ref]$refContent) -Old $rold7 -New $rnew7 -Label 'PageTour al final (Reference Place)'

    $refContent = Restore-Eol $refContent $refEraCrlf
    Write-Utf8NoBom $refPath $refContent
    Write-Ok "ReferencePlaceBuilder.tsx actualizado."
}

Write-Host ""
Write-Ok "Parche A completo."
Write-Host "Revisa los cambios con: git diff --stat" -ForegroundColor Cyan

<#
========================================================================
 corregir-boton-cancelar-perfil.ps1

 QUE HACE ESTE SCRIPT:

 Corrige especificamente src/app/[locale]/perfil/page.tsx para agregar
 el boton "Cancelar suscripcion" que se quedo pendiente la vez pasada
 (el script anterior no encontro el texto porque tu archivo real tenia
 una estructura distinta a la que se uso para escribir ese parche).

 Este script fue escrito leyendo tu archivo REAL (el que subiste), asi
 que los textos que busca coinciden exactamente.

 Agrega:
   1) Dos variables de estado nuevas: cancelLoading y cancelError.
   2) Una funcion handleCancelarSuscripcion() que llama a
      /api/pagos/cancelar-suscripcion (esa ruta ya la creo el script
      anterior -- si no la corriste todavia, hazlo primero).
   3) Un boton "Cancelar suscripcion" dentro de la tarjeta "Tu plan",
      visible solo cuando el usuario tiene el plan activo.

 REQUISITO: debes haber corrido antes actualizar-suscripcion-mercadopago-v2.ps1
 (o que /api/pagos/cancelar-suscripcion ya exista en tu proyecto), porque
 este boton llama a esa ruta.

 COMO CORRERLO:
   1) Abre PowerShell.
   2) Ve a la carpeta raiz de tu repo (donde esta la carpeta "src"), ej:
        cd C:\Users\barbe\Desktop\MBE-Corpilot-AI
   3) Ejecuta:
        powershell -ExecutionPolicy Bypass -File .\corregir-boton-cancelar-perfil.ps1
   4) Si ves los tres "[OK]" en verde, funciono. Revisa con "git diff".
   5) git add -A
      git commit -m "Agregar boton de cancelar suscripcion en /perfil"
      git push
========================================================================
#>

$ErrorActionPreference = 'Stop'

function Replace-Exactly {
    param(
        [string]$Path,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    if ([string]::IsNullOrEmpty($Path) -or [string]::IsNullOrEmpty($Old) -or [string]::IsNullOrEmpty($New) -or [string]::IsNullOrEmpty($Label)) {
        throw "Replace-Exactly: faltan argumentos (Path/Old/New/Label). Esto indica un problema en el script mismo, no en tu proyecto."
    }
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No se encontro el archivo: $Path . Ejecuta este script desde la raiz del repo."
    }
    $content = [System.IO.File]::ReadAllText($Path)
    $count = ([regex]::Matches($content, [regex]::Escape($Old))).Count
    if ($count -eq 0) {
        if ($content.Contains($New)) {
            Write-Host "  [OK - ya aplicado antes] $Label" -ForegroundColor Cyan
        } else {
            Write-Warning "  [OMITIDO] [$Label] No se encontro el texto esperado en $Path. Puede que el archivo haya cambiado de nuevo desde que se escribio este script. Avisame y reviso otra vez con tu archivo actual."
        }
        return
    }
    if ($count -gt 1) {
        throw "[$Label] El texto a reemplazar aparece $count veces en $Path -- se esperaba 1. Revisa manualmente antes de continuar."
    }
    $newContent = $content.Replace($Old, $New)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $newContent, $utf8NoBom)
    Write-Host "  [OK] $Label" -ForegroundColor Green
}

function Test-FileContains {
    param(
        [string]$Path,
        [string]$Needle,
        [string]$Label
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "  [FALTA] $Label (el archivo no existe: $Path)" -ForegroundColor Red
        return
    }
    $content = [System.IO.File]::ReadAllText($Path)
    if ($content.Contains($Needle)) {
        Write-Host "  [OK] $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FALTA] $Label" -ForegroundColor Red
    }
}

$perfilPath = "src\app\[locale]\perfil\page.tsx"

if (-not (Test-Path -LiteralPath $perfilPath)) {
    throw "No se encontro $perfilPath . Ejecuta este script desde la raiz del repo (la carpeta que contiene la carpeta 'src')."
}
Write-Host "Raiz del repo detectada correctamente." -ForegroundColor Green
Write-Host ""

$perfilOldB = @'
  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState('');
'@

$perfilNewB = @'
  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState('');
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [cancelError, setCancelError] = React.useState('');
'@

$perfilOldC = @'
      setPayError(t('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.', 'Could not start the payment. Try again in a few seconds.'));
      setPayLoading(false);
    }
  }

  async function handleLogout() {
'@

$perfilNewC = @'
      setPayError(t('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.', 'Could not start the payment. Try again in a few seconds.'));
      setPayLoading(false);
    }
  }

  async function handleCancelarSuscripcion() {
    if (!user) return;
    const confirmado = window.confirm(
      t(
        '¿Seguro que quieres cancelar tu suscripción? Perderás el acceso al plan completo de inmediato.',
        'Are you sure you want to cancel your subscription? You will lose access to the full plan immediately.'
      )
    );
    if (!confirmado) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pagos/cancelar-suscripcion', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cancelar la suscripción.');
      }
      setSubscription('cancelled');
      setPlanStatus('cancelled');
    } catch (err) {
      console.error(err);
      setCancelError(t('No se pudo cancelar la suscripción. Intenta de nuevo en unos segundos.', 'Could not cancel the subscription. Try again in a few seconds.'));
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleLogout() {
'@

$perfilOldD = @'
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="font-medium text-emerald-800">{t('Plan completo activo', 'Full plan active')}</p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      {planActivatedAt
                        ? t('Activado el ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 'Activated on ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }))
                        : t('Acceso completo a todas las herramientas de MBE Corpilot AI.', 'Full access to all MBE Corpilot AI tools.')}
                    </p>
                  </div>
                </div>
              ) : (
'@

$perfilNewD = @'
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="font-medium text-emerald-800">{t('Plan completo activo', 'Full plan active')}</p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      {planActivatedAt
                        ? t('Activado el ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 'Activated on ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }))
                        : t('Acceso completo a todas las herramientas de MBE Corpilot AI.', 'Full access to all MBE Corpilot AI tools.')}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-1">
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={handleCancelarSuscripcion}
                      disabled={cancelLoading}
                    >
                      {cancelLoading ? t('Cancelando...', 'Cancelling...') : t('Cancelar suscripción', 'Cancel subscription')}
                    </Button>
                    {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
                  </div>
                </div>
              ) : (
'@

Write-Host "Corrigiendo src/app/[locale]/perfil/page.tsx" -ForegroundColor White
Replace-Exactly -Path $perfilPath -Old $perfilOldB -New $perfilNewB -Label "perfil: agregar estado cancelLoading/cancelError"
Replace-Exactly -Path $perfilPath -Old $perfilOldC -New $perfilNewC -Label "perfil: agregar funcion handleCancelarSuscripcion"
Replace-Exactly -Path $perfilPath -Old $perfilOldD -New $perfilNewD -Label "perfil: agregar boton Cancelar suscripcion en Tu plan"
Write-Host ""

Write-Host "========================================================================" -ForegroundColor White
Write-Host "VERIFICACION FINAL" -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor White
Test-FileContains -Path $perfilPath -Needle "cancelLoading" -Label "perfil/page.tsx tiene el estado cancelLoading"
Test-FileContains -Path $perfilPath -Needle "handleCancelarSuscripcion" -Label "perfil/page.tsx tiene el boton de cancelar"
Test-FileContains -Path $perfilPath -Needle "cancelar-suscripcion" -Label "perfil/page.tsx llama a /api/pagos/cancelar-suscripcion"
Write-Host ""
Write-Host "Si los tres dicen [OK], revisa con 'git diff' y luego 'git add -A; git commit -m ...; git push'." -ForegroundColor White

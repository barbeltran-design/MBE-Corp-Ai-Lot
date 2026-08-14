<#
.SYNOPSIS
  Mueve el mensaje de acceso premium: ya no aparece al abrir un Mundo Premium,
  ahora aparece solo al intentar entrar a una MISION dentro de un mundo premium.
  Tambien corrige may/min de 'MBE Corp-AI-Lot' en es.json/en.json.
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

$worldsPath = Join-Path $PSScriptRoot 'src\components\worlds\WorldsBuilder.tsx'
$esPath     = Join-Path $PSScriptRoot 'src\messages\es.json'
$enPath     = Join-Path $PSScriptRoot 'src\messages\en.json'

foreach ($p in @($worldsPath, $esPath, $enPath)) {
  if (-not (Test-Path $p)) { throw "No se encontro el archivo: $p . Ejecuta este script desde la raiz del repo." }
}

Write-Host 'Aplicando cambios en WorldsBuilder.tsx...' -ForegroundColor Cyan
$old1 = @'
function MisionPlanAccion({
  agente,
  lang,
  planAccionDefinido,
  respuestas,
  plan,
  onIrPlan,
}: {
  agente: MentorAgente;
  lang: 'es' | 'en';
  planAccionDefinido: boolean;
  respuestas: Record<string, string[]> | null;
  plan: PlanMadurezLeido;
  onIrPlan: () => void;
}) {
  const en = t2(lang);
  return (
    <div className="world-glass world-grain p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
            planAccionDefinido
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {planAccionDefinido ? `✓ ${en(I.listoTag)}` : `🔒 ${en(I.bloqueadaTag)}`}
        </span>
      </div>
      <div className="mt-3 text-4xl">📋</div>
      <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">{en(I.misPA)}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misPADesc)}</p>
      {!planAccionDefinido ? (
'@
$new1 = @'
function MisionPlanAccion({
  agente,
  lang,
  planAccionDefinido,
  respuestas,
  plan,
  onIrPlan,
  esPremium,
}: {
  agente: MentorAgente;
  lang: 'es' | 'en';
  planAccionDefinido: boolean;
  respuestas: Record<string, string[]> | null;
  plan: PlanMadurezLeido;
  onIrPlan: () => void;
  esPremium: boolean;
}) {
  const en = t2(lang);
  const desbloqueada = planAccionDefinido && esPremium;
  return (
    <div className="world-glass world-grain p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
            desbloqueada
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {desbloqueada ? `✓ ${en(I.listoTag)}` : `🔒 ${en(I.bloqueadaTag)}`}
        </span>
      </div>
      <div className="mt-3 text-4xl">📋</div>
      <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">{en(I.misPA)}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misPADesc)}</p>
      {!desbloqueada ? (
'@
Replace-Exactly -Path $worldsPath -Old $old1 -New $new1 -Label 'MisionPlanAccion: props + condicion desbloqueada' | Out-Null

$old2 = @'
  // Mundos Premium: visibles para todos, pero solo se puede entrar si el
  // usuario tiene acceso premium (pagó el plan, o un admin se lo otorgó
  // manualmente, o es admin — ver src/lib/premium.ts / /api/worlds).
  const [premiumLock, setPremiumLock] = React.useState(false);
  const [insigniaNuevaId, setInsigniaNuevaId] = React.useState<string | null>(null);
  const esPremium = yo?.premium === true;
  const abrirMundo = React.useCallback(
    (destino: Vista) => {
      if (!esPremium) {
        setPremiumLock(true);
        return;
      }
      setVista(destino);
    },
    [esPremium]
  );
'@
$new2 = @'
  // Mundos Premium: visibles y abiertos para todos. La barrera de pago
  // solo aparece al intentar entrar/interactuar con una MISIÓN dentro de
  // un mundo premium (pagó el plan, o un admin se lo otorgó manualmente,
  // o es admin — ver src/lib/premium.ts / /api/worlds).
  const [premiumLock, setPremiumLock] = React.useState(false);
  const [insigniaNuevaId, setInsigniaNuevaId] = React.useState<string | null>(null);
  const esPremium = yo?.premium === true;
  const abrirMundo = React.useCallback((destino: Vista) => {
    setVista(destino);
  }, []);

  // La barrera de pago ya NO se muestra al entrar a un mundo premium.
  // Se muestra al intentar ENTRAR/INTERACTUAR con una misión dentro de un
  // mundo premium (Estrategia o cualquiera de los 5 mundos: dinero,
  // cliente, normativo, operativo, cultura).
  const abrirMision = React.useCallback(
    (accion: () => void) => {
      if (!esPremium) {
        setPremiumLock(true);
        return;
      }
      accion();
    },
    [esPremium]
  );
'@
Replace-Exactly -Path $worldsPath -Old $old2 -New $new2 -Label 'abrirMundo: quitar bloqueo premium al abrir un mundo' | Out-Null

$old3 = @'
  React.useEffect(() => {
    if (cargando) return; // espera a conocer yo.premium antes de decidir
    const v = new URLSearchParams(window.location.search).get('v');
    const validas: string[] = ['partida', 'tablero', 'estrategia', ...VISTAS_PREMIUM];
    const premiumVistas: string[] = ['estrategia', ...VISTAS_PREMIUM];
    if (!v || !validas.includes(v)) return;
    if (premiumVistas.includes(v) && !esPremium) {
      setPremiumLock(true);
      return;
    }
    setVista(v as Vista);
  }, [cargando, esPremium]);
'@
$new3 = @'
  React.useEffect(() => {
    if (cargando) return;
    const v = new URLSearchParams(window.location.search).get('v');
    const validas: string[] = ['partida', 'tablero', 'estrategia', ...VISTAS_PREMIUM];
    if (!v || !validas.includes(v)) return;
    // Los mundos premium (incluida Estrategia) ahora se pueden ABRIR sin
    // pagar; la barrera de pago aparece solo al intentar entrar a una misión.
    setVista(v as Vista);
  }, [cargando]);
'@
Replace-Exactly -Path $worldsPath -Old $old3 -New $new3 -Label 'Deep-link ?v=: quitar bloqueo premium' | Out-Null

$old4 = @'
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={irAgendar}
                  >
'@
$new4 = @'
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={() => abrirMision(irAgendar)}
                  >
'@
Replace-Exactly -Path $worldsPath -Old $old4 -New $new4 -Label 'Misión 1: gatear boton Apoyo de Especialistas' | Out-Null

$old5 = @'
                  <MisionPlanAccion
                    agente={mundoVista.agente}
                    lang={lang === 'es' ? 'es' : 'en'}
                    planAccionDefinido={planAccionDefinido}
                    respuestas={respuestas}
                    plan={planMadurez}
                    onIrPlan={irPlanAccion}
                  />
'@
$new5 = @'
                  <MisionPlanAccion
                    agente={mundoVista.agente}
                    lang={lang === 'es' ? 'es' : 'en'}
                    planAccionDefinido={planAccionDefinido}
                    respuestas={respuestas}
                    plan={planMadurez}
                    onIrPlan={() => abrirMision(irPlanAccion)}
                    esPremium={esPremium}
                  />
'@
Replace-Exactly -Path $worldsPath -Old $old5 -New $new5 -Label 'MisionPlanAccion: pasar esPremium y gatear onIrPlan' | Out-Null

$old6 = @'
                        <button
                          className="mt-3 rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                          onClick={() => router.push(s.ruta)}
                        >
'@
$new6 = @'
                        <button
                          className="mt-3 rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                          onClick={() => abrirMision(() => router.push(s.ruta))}
                        >
'@
Replace-Exactly -Path $worldsPath -Old $old6 -New $new6 -Label 'Submundos de Estrategia: gatear boton Abrir' | Out-Null

$old7 = @'
                    <button
                      className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                      onClick={irAgendar}
                    >
                      {en(I.agendarMentor)} →
                    </button>
                  </div>
                </div>

                <div id="estrategia-plan-accion" className="world-glass world-grain mt-6 p-5">
'@
$new7 = @'
                    <button
                      className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                      onClick={() => abrirMision(irAgendar)}
                    >
                      {en(I.agendarMentor)} →
                    </button>
                  </div>
                </div>

                <div id="estrategia-plan-accion" className="world-glass world-grain mt-6 p-5">
'@
Replace-Exactly -Path $worldsPath -Old $old7 -New $new7 -Label 'Mision 7 (Estrategia): gatear boton Apoyo de Especialistas' | Out-Null

$old8 = @'
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.misPADesc)}</p>
                  {!planAccionDefinido ? (
                    <div className="mt-3 rounded-xl border border-slate-300/50 bg-white/40 p-4 dark:bg-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🔒 {en(I.paLockDesc)}</p>
                      <button
                        className="mt-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                        onClick={irPlanAccion}
                      >
                        {en(I.crearMiPA)}
                      </button>
                    </div>
                  ) : (
'@
$new8 = @'
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.misPADesc)}</p>
                  {!planAccionDefinido || !esPremium ? (
                    <div className="mt-3 rounded-xl border border-slate-300/50 bg-white/40 p-4 dark:bg-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🔒 {en(I.paLockDesc)}</p>
                      <button
                        className="mt-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                        onClick={() => abrirMision(irPlanAccion)}
                      >
                        {en(I.crearMiPA)}
                      </button>
                    </div>
                  ) : (
'@
Replace-Exactly -Path $worldsPath -Old $old8 -New $new8 -Label 'Panel Plan de Accion (Estrategia): gatear y requerir premium' | Out-Null

Write-Host ''
Write-Host 'Corrigiendo mayuscula en appName (es.json / en.json)...' -ForegroundColor Cyan
$oldName = 'MBE Corp-AI-lot'
$newName = 'MBE Corp-AI-Lot'
Replace-Exactly -Path $esPath -Old $oldName -New $newName -Label 'es.json appName' | Out-Null
Replace-Exactly -Path $enPath -Old $oldName -New $newName -Label 'en.json appName' | Out-Null

Write-Host ''
Write-Host 'Listo. Ahora corre:' -ForegroundColor Cyan
Write-Host '  npm run build'
Write-Host 'y si todo compila:'
Write-Host '  git add -A'
Write-Host '  git commit -m "Paywall en misiones (no en mundos) + fix nombre app"'
Write-Host '  git push'

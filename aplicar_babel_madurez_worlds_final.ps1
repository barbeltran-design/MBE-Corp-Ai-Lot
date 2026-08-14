$ErrorActionPreference = 'Stop'

$rutaRepo = "C:\Users\barbe\Desktop\MBE-Corpilot-AI"
if (-not (Test-Path -LiteralPath $rutaRepo)) {
    Write-Host "ERROR: no se encontro la carpeta $rutaRepo" -ForegroundColor Red
    Write-Host "        Avisa a Claude con este mensaje." -ForegroundColor Red
    exit 1
}
Set-Location -LiteralPath $rutaRepo

# ============================================================================
# Cambios en /babel/madurez y /worlds
#
# 1) Arregla el error: al hacer clic en los avatares de "Siguiente practica
#    por agente" y "Plan del mes" se abria el tutorial de la pagina (no
#    deberia pasar).
# 2) Quita la seccion "Siguiente practica por agente" (se duplicaba con
#    "Plan del mes").
# 3) En "Plan del mes", cada avatar ahora tiene el mismo comportamiento que
#    en el Plan de Accion: avatar mas grande con un signo de interrogacion;
#    al hacer clic, pregunta si quieres ayuda de la IA o una asesoria
#    gratuita de 30 min con un mentor. Si eliges IA, se abre el chat y hace
#    scroll automatico hacia el. Si eliges mentor, te lleva a Agendar.
# 4) Si no has pagado el plan mensual, al elegir "ayuda de la IA" aparece un
#    aviso para contratar el plan, con un boton "Pagar plan mensual por solo
#    $X" (el monto se lee en vivo desde el catalogo).
# 5) En los Mundos Premium, el aviso para poder interactuar con las misiones
#    ahora explica que se necesita el plan mensual y tiene el mismo boton
#    de pago con el monto en vivo.
#
# Este script SOLO modifica archivos de tu repositorio local. No sube nada a
# internet ni hace ningun pago. Al final te dira los siguientes pasos.
#
# Este script se puede correr mas de una vez sin problema: si un cambio ya
# esta aplicado, lo detecta y lo salta.
# ============================================================================

function Leer-ContenidoLF {
    param([string]$RutaArchivo)
    if (-not (Test-Path -LiteralPath $RutaArchivo)) {
        Write-Host "ERROR: no se encontro el archivo $RutaArchivo" -ForegroundColor Red
        return $null
    }
    $original = [System.IO.File]::ReadAllText($RutaArchivo)
    return ($original -replace "`r`n", "`n")
}

function Guardar-Contenido {
    param([string]$RutaArchivo, [string]$Contenido)
    $utf8SinBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($RutaArchivo, $Contenido, $utf8SinBom)
}

function Aplicar-ReemplazoLiteral {
    param([string]$RutaArchivo, [string]$Buscar, [string]$Reemplazar, [string]$Descripcion)
    $contenido = Leer-ContenidoLF -RutaArchivo $RutaArchivo
    if ($null -eq $contenido) { return $false }
    if ($contenido.Contains($Reemplazar) -and -not $contenido.Contains($Buscar)) {
        Write-Host "OK (ya estaba aplicado): $Descripcion" -ForegroundColor Green
        return $true
    }
    $veces = ([regex]::Matches($contenido, [regex]::Escape($Buscar))).Count
    if ($veces -eq 0) {
        Write-Host "ERROR: no se encontro el texto esperado para '$Descripcion' en $RutaArchivo." -ForegroundColor Red
        Write-Host "        No se modifico nada; avisa a Claude." -ForegroundColor Red
        return $false
    }
    if ($veces -gt 1) {
        Write-Host "ERROR: el texto para '$Descripcion' aparece $veces veces en $RutaArchivo (se esperaba 1)." -ForegroundColor Red
        Write-Host "        No se modifico nada; avisa a Claude." -ForegroundColor Red
        return $false
    }
    $nuevo = $contenido.Replace($Buscar, $Reemplazar)
    Guardar-Contenido -RutaArchivo $RutaArchivo -Contenido $nuevo
    Write-Host "OK: $Descripcion" -ForegroundColor Green
    return $true
}

function Aplicar-ArchivoCompleto {
    param([string]$RutaArchivo, [string]$ContenidoOriginalEsperado, [string]$ContenidoNuevo, [string]$Descripcion)
    $actual = Leer-ContenidoLF -RutaArchivo $RutaArchivo
    if ($null -eq $actual) { return $false }
    if ($actual -eq $ContenidoNuevo) {
        Write-Host "OK (ya estaba aplicado): $Descripcion" -ForegroundColor Green
        return $true
    }
    if ($actual -ne $ContenidoOriginalEsperado) {
        Write-Host "ERROR: el archivo $RutaArchivo no coincide con lo que se esperaba (puede que ya haya cambiado)." -ForegroundColor Red
        Write-Host "        No se modifico nada; avisa a Claude con este mensaje." -ForegroundColor Red
        return $false
    }
    Guardar-Contenido -RutaArchivo $RutaArchivo -Contenido $ContenidoNuevo
    Write-Host "OK: $Descripcion" -ForegroundColor Green
    return $true
}

$raiz = Get-Location
Write-Host "Trabajando en: $raiz" -ForegroundColor DarkGray
$exitoTotal = $true

Write-Host ""
Write-Host "== Paso 1: crear el endpoint que da el precio actual del plan mensual ==" -ForegroundColor Cyan
Write-Host ""

$carpetaPrecio = Join-Path $raiz "src\app\api\pagos\precio-plan"
$archivoPrecio = Join-Path $carpetaPrecio "route.ts"
if (-not (Test-Path -LiteralPath $carpetaPrecio)) {
    New-Item -ItemType Directory -Path $carpetaPrecio -Force | Out-Null
}
$contenidoPrecio = @'
// ─────────────────────────────────────────────────────────────────────────
// GET /api/pagos/precio-plan
//
// Regresa el precio actual (configurado en el catalogo de Firestore, o el
// valor por defecto si aun no existe) del plan mensual, para que los
// botones de pago puedan mostrar el monto real en vez de un numero fijo.
//
// Requiere: Authorization: Bearer <token de Firebase del usuario logueado>
// Respuesta: { precio: number, moneda: 'MXN' }
// Si algo falla, de todas formas responde 200 con el precio por defecto
// para que el boton de pago nunca se rompa por esto.
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { defaultCatalogItem } from '@/lib/catalog';

const PRODUCT_ID = 'plan_mensual';

export async function GET(req: NextRequest) {
  const def = defaultCatalogItem(PRODUCT_ID);
  const precioDefault = def?.precio ?? 99;
  try {
    await requireAuth(req);
    const db = getAdminDb();
    const snap = await db.collection('catalog').doc(PRODUCT_ID).get();
    const data = snap.exists ? snap.data() : null;
    const precio =
      typeof data?.promocion === 'number' && data?.promocionActiva === true
        ? data.promocion
        : typeof data?.precio === 'number'
          ? data.precio
          : precioDefault;
    return NextResponse.json({ precio, moneda: 'MXN' });
  } catch (err) {
    console.error('[precio-plan] Error:', err);
    return NextResponse.json({ precio: precioDefault, moneda: 'MXN' });
  }
}

'@
$actualPrecio = $null
if (Test-Path -LiteralPath $archivoPrecio) { $actualPrecio = Leer-ContenidoLF -RutaArchivo $archivoPrecio }
if ($actualPrecio -eq $contenidoPrecio) {
    Write-Host "OK (ya estaba aplicado): endpoint /api/pagos/precio-plan" -ForegroundColor Green
} else {
    Guardar-Contenido -RutaArchivo $archivoPrecio -Contenido $contenidoPrecio
    Write-Host "OK: endpoint /api/pagos/precio-plan creado" -ForegroundColor Green
}

Write-Host ""
Write-Host "== Paso 2: permitir que el pago regrese a /babel/madurez y /worlds ==" -ForegroundColor Cyan
Write-Host ""

$archivoCrear = Join-Path $raiz "src\app\api\pagos\crear-preferencia\route.ts"
$buscarCP = @'
if (typeof body?.returnPath === 'string' && ['/perfil', '/dashboard'].includes(body.returnPath)) {
'@
$reemplazarCP = @'
if (typeof body?.returnPath === 'string' && ['/perfil', '/dashboard', '/babel/madurez', '/worlds'].includes(body.returnPath)) {
'@
if (-not (Aplicar-ReemplazoLiteral -RutaArchivo $archivoCrear -Buscar $buscarCP -Reemplazar $reemplazarCP -Descripcion "crear-preferencia: permitir regresar a /babel/madurez y /worlds")) { $exitoTotal = $false }

Write-Host ""
Write-Host "== Paso 3: pagina /babel/madurez (avatares, quitar seccion duplicada, IA vs mentor, paywall) ==" -ForegroundColor Cyan
Write-Host ""

$archivoMadurez = Join-Path $raiz "src\components\babel\MaturityPlanBuilder.tsx"
$madurezOriginal = @'
'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import { getFirebaseAuth } from '@/lib/firebase';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { DIMENSION_IDS, getMaturityDimensions, type DimensionId } from '@/lib/maturity-dimensions';
import { MENTORES, PRACTICAS_POR_TEMA, type MentorAgente, type PracticaMadurez } from '@/lib/madurez-practicas';
import type { DimensionAnswers } from '@/lib/maturity-scoring';

type PlanLang = 'es' | 'en';
type Estatus = 'pendiente' | 'en_progreso' | 'completada';
type TareaEstatus = 'todo' | 'doing' | 'done';

const PLAN_KEY = 'babel_madurez_plan_v1';

interface Compromiso {
  id: string;
  themeId: DimensionId;
  nivel: number;
  practica: string;
  mentor: MentorAgente;
  estatus: Estatus;
}

interface TareaScrum {
  id: string;
  texto: string;
  estatus: TareaEstatus;
}

interface Sprint {
  accion: string; // "themeId|nivel" o ''
  tareas: TareaScrum[];
}

interface PlanMadurez {
  v: number;
  completados: Partial<Record<DimensionId, number>>;
  compromisos: Record<string, Compromiso[]>;
  sprints: Record<string, Sprint>;
}

const LEVEL_LABELS: Record<PlanLang, string[]> = {
  es: ['Ejecucion', 'Estandar', 'Control', 'Optimizacion', 'Excelencia', 'Influencer'],
  en: ['Execution', 'Standard', 'Control', 'Optimization', 'Excellence', 'Influencer'],
};

const MESES: Record<PlanLang, string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const MENTOR_COLOR: Record<MentorAgente, string> = {
  Babel: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  Fisnando: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  Karmetin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  Normau: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  Atech: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
};

const LABELS = {
  es: {
    title: 'Plan de Madurez',
    subtitle:
      'Cada mes se trabaja una practica con cada agente (Babel, Fisnando, Karmetin, Normau y Atech) en el orden de los temas de la Evaluacion de Madurez: se parte del nivel mas bajo de Rumbo Estrategico y se avanza hasta Cultura Organizacional, para regresar en ciclo al siguiente nivel de cada tema. Las practicas sugeridas salen de tu evaluacion (el nivel mas bajo no completado) y todo es editable.',
    sinEvaluacion:
      'Aun no se encontro tu Evaluacion de Madurez. Completa el diagnostico para que las sugerencias partan de tu nivel real; mientras tanto el plan parte del nivel Ejecucion.',
    agentesTitle: 'Siguiente practica por agente',
    agenteSinPendientes: 'No quedan practicas pendientes',
    planMensualTitle: 'Plan del mes',
    planMensualHint: 'Cada mes se agenda una practica con cada agente. Actualiza el estatus cuando la completes.',
    actualizarMes: 'Actualizar plan del mes',
    temaCol: 'Tema',
    nivelCol: 'Nivel',
    practicaCol: 'Buena practica',
    estatusCol: 'Estatus',
    eliminar: 'Eliminar',
    pendiente: 'Pendiente',
    enProgreso: 'En progreso',
    completada: 'Completada',
    marcarCompletada: 'Marcar completada',
    temasTitle: 'Practicas por tema',
    temaCompleto: 'Tema al maximo (6 niveles)',
    siguienteCol: 'Siguiente practica',
    scrumTitle: 'Scrum semanal',
    scrumHint: 'Cada semana se decide UNA accion a realizar y se divide en tareas. Toca una tarjeta para moverla de columna.',
    accionSemana: 'Accion de la semana',
    accionSinOpciones: 'No hay practicas pendientes para elegir',
    tareaPlaceholder: 'Describe la tarea de la semana...',
    agregarTarea: 'Agregar',
    colTodo: 'A realizar',
    colDoing: 'En curso',
    colDone: 'Hechas',
    guardado: 'Los cambios se guardan automaticamente en este navegador.',
    semanaLabel: 'Semana del {desde} al {hasta}',
    mesLabel: '{mes} {anio}',
    sinAccion: 'Elige una accion para esta semana',
    emptyMes: 'Este mes no tiene compromisos. Toca "Actualizar plan del mes".',
    sinCompromiso: 'Sin practica asignada este mes',
  },
  en: {
    title: 'Maturity Plan',
    subtitle:
      'Each month you work on one practice with each agent (Babel, Fisnando, Karmetin, Normau and Atech) following the order of the Maturity Assessment topics: starting from the lowest level of Strategic Direction and advancing through Organizational Culture, then cycling back to the next level of each topic. Suggested practices come from your assessment (lowest incomplete level) and everything is editable.',
    sinEvaluacion:
      'Your Maturity Assessment was not found yet. Complete the diagnosis so suggestions start from your real level; in the meantime the plan starts from the Execution level.',
    agentesTitle: 'Next practice per agent',
    agenteSinPendientes: 'No pending practices left',
    planMensualTitle: 'Monthly plan',
    planMensualHint: 'Each month schedules one practice per agent. Update the status when you complete it.',
    actualizarMes: 'Refresh monthly plan',
    temaCol: 'Topic',
    nivelCol: 'Level',
    practicaCol: 'Good practice',
    estatusCol: 'Status',
    eliminar: 'Remove',
    pendiente: 'Pending',
    enProgreso: 'In progress',
    completada: 'Completed',
    marcarCompletada: 'Mark as completed',
    temasTitle: 'Practices by topic',
    temaCompleto: 'Topic at maximum (6 levels)',
    siguienteCol: 'Next practice',
    scrumTitle: 'Weekly scrum',
    scrumHint: 'Each week ONE action is chosen and broken into tasks. Tap a card to move it across columns.',
    accionSemana: 'Action of the week',
    accionSinOpciones: 'No pending practices to choose from',
    tareaPlaceholder: "Describe this week's task...",
    agregarTarea: 'Add',
    colTodo: 'To do',
    colDoing: 'In progress',
    colDone: 'Done',
    guardado: 'Changes are saved automatically in this browser.',
    semanaLabel: 'Week of {desde} to {hasta}',
    mesLabel: '{mes} {anio}',
    sinAccion: 'Pick an action for this week',
    emptyMes: 'This month has no commitments. Tap "Refresh monthly plan".',
    sinCompromiso: 'No practice assigned this month',
  },
};

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function monthKeyOf(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function addMonths(monthKey: string, delta: number): string {
  const parts = monthKey.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(monthKey: string, lang: PlanLang): string {
  const parts = monthKey.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return LABELS[lang].mesLabel.replace('{mes}', MESES[lang][d.getMonth()]).replace('{anio}', String(d.getFullYear()));
}

function lunesDe(date: Date): Date {
  const c = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
}

function addWeeks(monday: Date, delta: number): Date {
  const c = new Date(monday);
  c.setDate(c.getDate() + delta * 7);
  return c;
}

function weekKeyOf(monday: Date): string {
  return (
    monday.getFullYear() +
    '-' +
    String(monday.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(monday.getDate()).padStart(2, '0')
  );
}

function fmtDay(date: Date, lang: PlanLang): string {
  return date.getDate() + ' ' + MESES[lang][date.getMonth()];
}

const PASOS_TOUR: Record<PlanLang, TourStep[]> = {
  es: [
    { selector: '#madurez-plan-title', title: 'Mejora del Nivel de Madurez', description: 'Aquí defines las acciones para mejorar la madurez de tu organización: cada mes una práctica con cada agente, en el orden de los temas de la evaluación.' },
    { selector: '#madurez-scrum', title: 'Scrum semanal', description: 'Semana a semana se elige UNA acción y se divide en tareas. Toca una tarjeta para moverla entre columnas.' },
    { selector: '#madurez-agentes', title: 'Siguiente práctica por agente', description: 'Cada agente (Babel, Fisnando, Karmetin, Normau y Atech) tiene asignada la siguiente práctica sugerida, partiendo del nivel más bajo no completado de tu evaluación.' },
    { selector: '#madurez-mensual', title: 'Plan del mes', description: 'Cada mes se agenda una práctica con cada agente. Actualiza el estatus a Completada para avanzar automáticamente al siguiente nivel del tema.' },
    { selector: '#madurez-temas', title: 'Prácticas por tema', description: 'El detalle de los 11 temas: la siguiente práctica a trabajar y, si ya la dominas, márcala completada.' },
  ],
  en: [
    { selector: '#madurez-plan-title', title: 'Maturity Level Improvement', description: 'This is where you define the actions to improve your organization\'s maturity: one practice with each agent per month, following the assessment topic order.' },
    { selector: '#madurez-scrum', title: 'Weekly scrum', description: 'Week by week you choose ONE action and break it into tasks. Tap a card to move it across columns.' },
    { selector: '#madurez-agentes', title: 'Next practice per agent', description: 'Each agent (Babel, Fisnando, Karmetin, Normau and Atech) has its next suggested practice, starting from the lowest incomplete level of your assessment.' },
    { selector: '#madurez-mensual', title: 'Monthly plan', description: 'Each month schedules one practice per agent. Update the status to Completed to automatically advance to the next level of the topic.' },
    { selector: '#madurez-temas', title: 'Practices by topic', description: 'The detail of the 11 topics: the next practice to work on and, if you already master it, mark it as completed.' },
  ],
};

export default function MaturityPlanBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const dimensions = React.useMemo(() => getMaturityDimensions(lang), [lang]);
  const temaDe = React.useMemo(() => {
    const m: Record<string, string> = {};
    dimensions.forEach((d) => {
      m[d.id] = d.tema;
    });
    return m;
  }, [dimensions]);

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [answers, setAnswers] = React.useState<DimensionAnswers | null>(null);
  const [plan, setPlan] = React.useState<PlanMadurez>(() => ({ v: 1, completados: {}, compromisos: {}, sprints: {} }));
  const [loaded, setLoaded] = React.useState(false);
  const [mesSel, setMesSel] = React.useState<string>(() => monthKeyOf(new Date()));
  const [semanaOffset, setSemanaOffset] = React.useState(0);
  const [nuevaTarea, setNuevaTarea] = React.useState('');

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const ans = await getLatestAssessmentAnswers(user.uid);
        if (!cancelled) setAnswers(ans);
      } catch (err) {
        console.error('[MBE Madurez] failed to load assessment', err);
        if (!cancelled) setAnswers(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setPlan({
            v: 1,
            completados: parsed.completados ?? {},
            compromisos: parsed.compromisos ?? {},
            sprints: parsed.sprints ?? {},
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    } catch (err) {
      console.error(err);
    }
  }, [plan, loaded]);

  const baseNivel = React.useCallback(
    (themeId: DimensionId): number => {
      if (!answers) return 0;
      const arr = answers[themeId];
      if (!arr) return 0;
      for (let i = 0; i < 6; i++) {
        if (arr[i] !== 'yes') return i;
      }
      return 6;
    },
    [answers]
  );

  const siguienteNivel = React.useCallback(
    (themeId: DimensionId): number => {
      const b = baseNivel(themeId) + (plan.completados[themeId] ?? 0);
      return b > 6 ? 6 : b;
    },
    [baseNivel, plan.completados]
  );

  const proximaPractica = React.useCallback(
    (themeId: DimensionId): { nivel: number; practica: PracticaMadurez } | null => {
      const n = siguienteNivel(themeId);
      if (n >= 6) return null;
      return { nivel: n, practica: PRACTICAS_POR_TEMA[themeId][n] };
    },
    [siguienteNivel]
  );

  const siguienteDeAgente = React.useCallback(
    (mentor: MentorAgente): { themeId: DimensionId; nivel: number; practica: PracticaMadurez } | null => {
      for (const id of DIMENSION_IDS) {
        const sig = proximaPractica(id);
        if (sig && sig.practica.mentor === mentor) return { themeId: id, ...sig };
      }
      return null;
    },
    [proximaPractica]
  );

  const generarMes = (mesKey: string) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const nuevos = [...actuales];
      let cambio = false;
      const findSig = (mentor: MentorAgente): { themeId: DimensionId; nivel: number; practica: PracticaMadurez } | null => {
        for (const id of DIMENSION_IDS) {
          if (nuevos.some((c) => c.themeId === id)) continue;
          const n = baseNivel(id) + (prev.completados[id] ?? 0);
          if (n >= 6) continue;
          const pr = PRACTICAS_POR_TEMA[id][n];
          if (pr.mentor === mentor) return { themeId: id, nivel: n, practica: pr };
        }
        return null;
      };
      for (const mentor of MENTORES) {
        if (nuevos.some((c) => c.mentor === mentor)) continue;
        const sig = findSig(mentor);
        if (sig) {
          nuevos.push({
            id: generateId(),
            themeId: sig.themeId,
            nivel: sig.nivel,
            practica: sig.practica.practica,
            mentor,
            estatus: 'pendiente',
          });
          cambio = true;
        }
      }
      if (!cambio) return prev;
      return { ...prev, compromisos: { ...prev.compromisos, [mesKey]: nuevos } };
    });
  };

  const cambiarEstatus = (mesKey: string, id: string, estatus: Estatus) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const comp = actuales.find((c) => c.id === id);
      if (!comp) return prev;
      const completados = { ...prev.completados };
      if (estatus === 'completada' && comp.estatus !== 'completada') {
        completados[comp.themeId] = (completados[comp.themeId] ?? 0) + 1;
      } else if (estatus !== 'completada' && comp.estatus === 'completada') {
        const v = (completados[comp.themeId] ?? 0) - 1;
        completados[comp.themeId] = v > 0 ? v : 0;
      }
      return {
        ...prev,
        completados,
        compromisos: {
          ...prev.compromisos,
          [mesKey]: actuales.map((c) => (c.id === id ? { ...c, estatus } : c)),
        },
      };
    });
  };

  const eliminarCompromiso = (mesKey: string, id: string) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const comp = actuales.find((c) => c.id === id);
      if (!comp) return prev;
      const completados = { ...prev.completados };
      if (comp.estatus === 'completada') {
        const v = (completados[comp.themeId] ?? 0) - 1;
        completados[comp.themeId] = v > 0 ? v : 0;
      }
      return {
        ...prev,
        completados,
        compromisos: { ...prev.compromisos, [mesKey]: actuales.filter((c) => c.id !== id) },
      };
    });
  };

  const marcarTemaCompletado = (themeId: DimensionId) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesSel] ?? [];
      const n = baseNivel(themeId) + (prev.completados[themeId] ?? 0);
      if (n >= 6) return prev;
      const pr = PRACTICAS_POR_TEMA[themeId][n];
      const existente = actuales.find((c) => c.themeId === themeId);
      const yaCompletada = Boolean(existente && existente.estatus === 'completada');
      const compromisos = existente
        ? actuales.map((c) => (c.themeId === themeId ? { ...c, estatus: 'completada' as Estatus } : c))
        : actuales.concat([
            {
              id: generateId(),
              themeId,
              nivel: n,
              practica: pr.practica,
              mentor: pr.mentor,
              estatus: 'completada' as Estatus,
            },
          ]);
      return {
        ...prev,
        completados: {
          ...prev.completados,
          [themeId]: (prev.completados[themeId] ?? 0) + (yaCompletada ? 0 : 1),
        },
        compromisos: { ...prev.compromisos, [mesSel]: compromisos },
      };
    });
  };

  // ── Scrum semanal ─────────────────────────────────────────────────────────
  const semanaLunes = React.useMemo(() => addWeeks(lunesDe(new Date()), semanaOffset), [semanaOffset]);
  const semKey = weekKeyOf(semanaLunes);
  const sprint = plan.sprints[semKey];

  const accionPorDefecto = React.useMemo(() => {
    const mesKey = monthKeyOf(semanaLunes);
    const comps = plan.compromisos[mesKey] ?? [];
    for (const c of comps) {
      if (c.estatus !== 'completada') return c.themeId + '|' + c.nivel;
    }
    for (const id of DIMENSION_IDS) {
      const sig = proximaPractica(id);
      if (sig) return id + '|' + sig.nivel;
    }
    return '';
  }, [plan.compromisos, proximaPractica, semanaLunes]);

  const accionSel = sprint ? sprint.accion : accionPorDefecto;

  const opcionesAccion = React.useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const mesKey = monthKeyOf(semanaLunes);
    const comps = plan.compromisos[mesKey] ?? [];
    comps.forEach((c) => {
      if (c.estatus !== 'completada') {
        opts.push({ value: c.themeId + '|' + c.nivel, label: (temaDe[c.themeId] || c.themeId) + ' - ' + c.practica });
      }
    });
    DIMENSION_IDS.forEach((id) => {
      const sig = proximaPractica(id);
      if (!sig) return;
      const value = id + '|' + sig.nivel;
      if (opts.some((o) => o.value === value)) return;
      opts.push({
        value,
        label: (temaDe[id] || id) + ' (' + LEVEL_LABELS[lang][sig.nivel] + ') - ' + sig.practica.practica,
      });
    });
    return opts;
  }, [plan.compromisos, proximaPractica, semanaLunes, lang, temaDe]);

  const labelDeAccion = React.useCallback(
    (value: string): string => {
      const parts = value.split('|');
      const id = parts[0] as DimensionId;
      const n = Number(parts[1] || 0);
      const pr = PRACTICAS_POR_TEMA[id]?.[n];
      return (temaDe[id] || id) + ' (' + LEVEL_LABELS[lang][n] + ') - ' + (pr?.practica || '');
    },
    [lang, temaDe]
  );

  const opcionesEfectivas = React.useMemo(() => {
    if (!accionSel) return opcionesAccion;
    if (opcionesAccion.some((o) => o.value === accionSel)) return opcionesAccion;
    return [{ value: accionSel, label: labelDeAccion(accionSel) }, ...opcionesAccion];
  }, [accionSel, opcionesAccion, labelDeAccion]);

  const fijarAccion = (value: string) => {
    setPlan((prev) => ({
      ...prev,
      sprints: { ...prev.sprints, [semKey]: { accion: value, tareas: prev.sprints[semKey]?.tareas ?? [] } },
    }));
  };

  const agregarTarea = () => {
    const texto = nuevaTarea.trim();
    if (!texto) return;
    setPlan((prev) => ({
      ...prev,
      sprints: {
        ...prev.sprints,
        [semKey]: {
          accion: prev.sprints[semKey]?.accion ?? accionPorDefecto,
          tareas: (prev.sprints[semKey]?.tareas ?? []).concat([{ id: generateId(), texto, estatus: 'todo' as TareaEstatus }]),
        },
      },
    }));
    setNuevaTarea('');
  };

  const moverTarea = (id: string) => {
    setPlan((prev) => {
      const s = prev.sprints[semKey];
      if (!s) return prev;
      return {
        ...prev,
        sprints: {
          ...prev.sprints,
          [semKey]: {
            ...s,
            tareas: s.tareas.map((ta) =>
              ta.id === id
                ? { ...ta, estatus: (ta.estatus === 'todo' ? 'doing' : ta.estatus === 'doing' ? 'done' : 'todo') as TareaEstatus }
                : ta
            ),
          },
        },
      };
    });
  };

  const eliminarTarea = (id: string) => {
    setPlan((prev) => {
      const s = prev.sprints[semKey];
      if (!s) return prev;
      return { ...prev, sprints: { ...prev.sprints, [semKey]: { ...s, tareas: s.tareas.filter((ta) => ta.id !== id) } } };
    });
  };

  const tareas = sprint?.tareas ?? [];
  const semanaFin = (() => {
    const d = new Date(semanaLunes);
    d.setDate(d.getDate() + 6);
    return d;
  })();
  const semanaLabel = t.semanaLabel.replace('{desde}', fmtDay(semanaLunes, lang)).replace('{hasta}', fmtDay(semanaFin, lang));
  const compromisosMes = plan.compromisos[mesSel] ?? [];
  const sinEvaluacion = loaded && answers === null && user !== undefined;

  const estatusLabel = (e: Estatus): string =>
    e === 'completada' ? t.completada : e === 'en_progreso' ? t.enProgreso : t.pendiente;

  return (
    <div>
      <div className="flex items-center gap-3">
        <AgentAvatar agente="Babel" size={56} className="shrink-0" />
        <div>
          <h3 id="madurez-plan-title" className="text-xl font-bold text-slate-800">
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      {sinEvaluacion ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t.sinEvaluacion}
        </div>
      ) : null}

      {/* Scrum semanal */}
      <div id="madurez-scrum" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{t.scrumTitle}</h4>
            <button
              type="button"
              onClick={() => setSemanaOffset((o) => o - 1)}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-medium text-slate-800">{semanaLabel}</span>
            <button
              type="button"
              onClick={() => setSemanaOffset((o) => o + 1)}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.scrumHint}</p>

        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.accionSemana}</label>
          <select
            value={accionSel}
            onChange={(ev) => fijarAccion(ev.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            {opcionesEfectivas.length > 0 ? (
              opcionesEfectivas.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            ) : (
              <option value="">{t.accionSinOpciones}</option>
            )}
          </select>
          {!accionSel && opcionesAccion.length > 0 ? <p className="mt-1 text-xs text-slate-400">{t.sinAccion}</p> : null}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={nuevaTarea}
            onChange={(ev) => setNuevaTarea(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') agregarTarea();
            }}
            placeholder={t.tareaPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={agregarTarea}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t.agregarTarea}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ['todo', t.colTodo],
              ['doing', t.colDoing],
              ['done', t.colDone],
            ] as [TareaEstatus, string][]
          ).map(([estatus, header]) => (
            <div key={estatus} className="glass-panel p-2">
              <p className="px-1 pb-1 text-xs font-semibold text-slate-500">{header}</p>
              <div className="space-y-1.5">
                {tareas
                  .filter((ta) => ta.estatus === estatus)
                  .map((ta) => (
                    <div
                      key={ta.id}
                      onClick={() => moverTarea(ta.id)}
                      title="Clic para mover"
                      className={
                        'flex cursor-pointer items-start justify-between gap-2 px-2 py-1.5 text-xs ' +
                        (ta.estatus === 'done'
                          ? 'rounded-md border border-green-200 bg-green-50 text-green-800 line-through'
                          : 'glass-panel glass-panel-hover text-slate-700')
                      }
                    >
                      <span className="min-w-0">{ta.texto}</span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          eliminarTarea(ta.id);
                        }}
                        className="shrink-0 text-red-500 hover:text-red-700"
                        aria-label="Eliminar tarea"
                      >
                        x
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Siguiente practica por agente */}
      <div id="madurez-agentes" className="mt-6">
        <h4 className="text-sm font-semibold text-slate-700">{t.agentesTitle}</h4>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {MENTORES.map((mentor) => {
            const sig = siguienteDeAgente(mentor);
            return (
              <div key={mentor} className="glass-panel p-3">
                <div className="flex items-center gap-2">
                  <AgentAvatar agente={mentor} size={24} />
                  <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + MENTOR_COLOR[mentor]}>
                    {mentor}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">                  {sig ? (
                    <>
                      <span className="font-semibold text-slate-800">{temaDe[sig.themeId]}</span> ({LEVEL_LABELS[lang][sig.nivel]}) -{' '}
                      {sig.practica.practica}
                    </>
                  ) : (
                    t.agenteSinPendientes
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan mensual */}
      <div id="madurez-mensual" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{t.planMensualTitle}</h4>
            <button
              type="button"
              onClick={() => setMesSel((m) => addMonths(m, -1))}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[110px] text-center text-sm font-medium text-slate-800">{monthLabel(mesSel, lang)}</span>
            <button
              type="button"
              onClick={() => setMesSel((m) => addMonths(m, 1))}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => generarMes(mesSel)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            {t.actualizarMes}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.planMensualHint}</p>

        {compromisosMes.length === 0 && MENTORES.every((m) => !siguienteDeAgente(m)) ? (
          <div className="glass-panel mt-2 p-3 text-sm text-slate-500">{t.emptyMes}</div>
        ) : (
          <div className="mt-2 space-y-2">
            {MENTORES.map((mentor) => {
              const comp = compromisosMes.find((c) => c.mentor === mentor);
              return (
                <div
                  key={mentor}
                  className="glass-panel grid items-center gap-2 p-3 sm:grid-cols-[110px_1fr_90px_130px_auto]"
                >
                  <span className="flex w-fit items-center gap-1.5">
                    <AgentAvatar agente={mentor} size={20} />
                    <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + MENTOR_COLOR[mentor]}>
                      {mentor}
                    </span>
                  </span>
                  {comp ? (
                    <>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {temaDe[comp.themeId]} - {comp.practica}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.nivelCol}: {LEVEL_LABELS[lang][comp.nivel]}
                        </p>
                      </div>
                      <select
                        value={comp.estatus}
                        onChange={(ev) => cambiarEstatus(mesSel, comp.id, ev.target.value as Estatus)}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
                      >
                        <option value="pendiente">{t.pendiente}</option>
                        <option value="en_progreso">{t.enProgreso}</option>
                        <option value="completada">{t.completada}</option>
                      </select>
                      <span
                        className={
                          'rounded-full px-2.5 py-1 text-xs font-medium ' +
                          (comp.estatus === 'completada'
                            ? 'bg-green-100 text-green-800'
                            : comp.estatus === 'en_progreso'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600')
                        }
                      >
                        {estatusLabel(comp.estatus)}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarCompromiso(mesSel, comp.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        {t.eliminar}
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">{t.sinCompromiso}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Practicas por tema */}
      <div id="madurez-temas" className="mt-6">
        <h4 className="text-sm font-semibold text-slate-700">{t.temasTitle}</h4>
        <div className="mt-2 space-y-2">
          {DIMENSION_IDS.map((id) => {
            const sig = proximaPractica(id);
            return (
              <div key={id} className="glass-panel flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{temaDe[id]}</p>
                  {sig ? (
                    <p className="mt-0.5 text-xs text-slate-600">
                      {t.siguienteCol}: ({LEVEL_LABELS[lang][sig.nivel]}) {sig.practica.practica}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-green-700">{t.temaCompleto}</p>
                  )}
                </div>
                {sig ? (
                  <button
                    type="button"
                    onClick={() => marcarTemaCompletado(id)}
                    className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    {t.marcarCompletada}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.guardado}</p>
      <PageTour pageId="madurez" steps={lang === 'en' ? PASOS_TOUR.en : PASOS_TOUR.es} lang={lang} />
    </div>
  );
}

'@
$madurezNuevo = @'
'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { DIMENSION_IDS, getMaturityDimensions, type DimensionId } from '@/lib/maturity-dimensions';
import { MENTORES, PRACTICAS_POR_TEMA, type MentorAgente, type PracticaMadurez } from '@/lib/madurez-practicas';
import type { DimensionAnswers } from '@/lib/maturity-scoring';

type PlanLang = 'es' | 'en';
type Estatus = 'pendiente' | 'en_progreso' | 'completada';
type TareaEstatus = 'todo' | 'doing' | 'done';

const PLAN_KEY = 'babel_madurez_plan_v1';

interface Compromiso {
  id: string;
  themeId: DimensionId;
  nivel: number;
  practica: string;
  mentor: MentorAgente;
  estatus: Estatus;
}

interface TareaScrum {
  id: string;
  texto: string;
  estatus: TareaEstatus;
}

interface Sprint {
  accion: string; // "themeId|nivel" o ''
  tareas: TareaScrum[];
}

interface PlanMadurez {
  v: number;
  completados: Partial<Record<DimensionId, number>>;
  compromisos: Record<string, Compromiso[]>;
  sprints: Record<string, Sprint>;
}

const LEVEL_LABELS: Record<PlanLang, string[]> = {
  es: ['Ejecucion', 'Estandar', 'Control', 'Optimizacion', 'Excelencia', 'Influencer'],
  en: ['Execution', 'Standard', 'Control', 'Optimization', 'Excellence', 'Influencer'],
};

const MESES: Record<PlanLang, string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const MENTOR_COLOR: Record<MentorAgente, string> = {
  Babel: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  Fisnando: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  Karmetin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  Normau: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  Atech: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
};

const LABELS = {
  es: {
    title: 'Plan de Madurez',
    subtitle:
      'Cada mes se trabaja una practica con cada agente (Babel, Fisnando, Karmetin, Normau y Atech) en el orden de los temas de la Evaluacion de Madurez: se parte del nivel mas bajo de Rumbo Estrategico y se avanza hasta Cultura Organizacional, para regresar en ciclo al siguiente nivel de cada tema. Las practicas sugeridas salen de tu evaluacion (el nivel mas bajo no completado) y todo es editable.',
    sinEvaluacion:
      'Aun no se encontro tu Evaluacion de Madurez. Completa el diagnostico para que las sugerencias partan de tu nivel real; mientras tanto el plan parte del nivel Ejecucion.',
    planMensualTitle: 'Plan del mes',
    planMensualHint: 'Cada mes se agenda una practica con cada agente. Actualiza el estatus cuando la completes.',
    actualizarMes: 'Actualizar plan del mes',
    temaCol: 'Tema',
    nivelCol: 'Nivel',
    practicaCol: 'Buena practica',
    estatusCol: 'Estatus',
    eliminar: 'Eliminar',
    pendiente: 'Pendiente',
    enProgreso: 'En progreso',
    completada: 'Completada',
    marcarCompletada: 'Marcar completada',
    temasTitle: 'Practicas por tema',
    temaCompleto: 'Tema al maximo (6 niveles)',
    siguienteCol: 'Siguiente practica',
    scrumTitle: 'Scrum semanal',
    scrumHint: 'Cada semana se decide UNA accion a realizar y se divide en tareas. Toca una tarjeta para moverla de columna.',
    accionSemana: 'Accion de la semana',
    accionSinOpciones: 'No hay practicas pendientes para elegir',
    tareaPlaceholder: 'Describe la tarea de la semana...',
    agregarTarea: 'Agregar',
    colTodo: 'A realizar',
    colDoing: 'En curso',
    colDone: 'Hechas',
    guardado: 'Los cambios se guardan automaticamente en este navegador.',
    semanaLabel: 'Semana del {desde} al {hasta}',
    mesLabel: '{mes} {anio}',
    sinAccion: 'Elige una accion para esta semana',
    emptyMes: 'Este mes no tiene compromisos. Toca "Actualizar plan del mes".',
    sinCompromiso: 'Sin practica asignada este mes',
    pedirAyuda: 'Pedir ayuda',
    eleccionTitulo: '¿Cómo quieres que te ayudemos?',
    eleccionDesc: '¿Quieres ayuda de la IA o prefieres una asesoría gratuita de 30 minutos con un mentor?',
    opcionIA: 'Ayuda de la IA (chat)',
    opcionMentor: 'Asesoría gratuita de 30 min con un mentor',
    cancelar: 'Cancelar',
    cerrarChat: 'Cerrar',
    escribeAqui: 'Escribe tu pregunta...',
    enviar: 'Enviar',
    pensando: 'Pensando...',
    paywallTitulo: 'Necesitas el plan mensual',
    paywallDesc: 'Para obtener ayuda de la IA, contrata el plan mensual.',
    pagarPlan: 'Pagar plan mensual por solo \${monto}',
    pagarCargando: 'Procesando...',
  },
  en: {
    title: 'Maturity Plan',
    subtitle:
      'Each month you work on one practice with each agent (Babel, Fisnando, Karmetin, Normau and Atech) following the order of the Maturity Assessment topics: starting from the lowest level of Strategic Direction and advancing through Organizational Culture, then cycling back to the next level of each topic. Suggested practices come from your assessment (lowest incomplete level) and everything is editable.',
    sinEvaluacion:
      'Your Maturity Assessment was not found yet. Complete the diagnosis so suggestions start from your real level; in the meantime the plan starts from the Execution level.',
    planMensualTitle: 'Monthly plan',
    planMensualHint: 'Each month schedules one practice per agent. Update the status when you complete it.',
    actualizarMes: 'Refresh monthly plan',
    temaCol: 'Topic',
    nivelCol: 'Level',
    practicaCol: 'Good practice',
    estatusCol: 'Status',
    eliminar: 'Remove',
    pendiente: 'Pending',
    enProgreso: 'In progress',
    completada: 'Completed',
    marcarCompletada: 'Mark as completed',
    temasTitle: 'Practices by topic',
    temaCompleto: 'Topic at maximum (6 levels)',
    siguienteCol: 'Next practice',
    scrumTitle: 'Weekly scrum',
    scrumHint: 'Each week ONE action is chosen and broken into tasks. Tap a card to move it across columns.',
    accionSemana: 'Action of the week',
    accionSinOpciones: 'No pending practices to choose from',
    tareaPlaceholder: "Describe this week's task...",
    agregarTarea: 'Add',
    colTodo: 'To do',
    colDoing: 'In progress',
    colDone: 'Done',
    guardado: 'Changes are saved automatically in this browser.',
    semanaLabel: 'Week of {desde} to {hasta}',
    mesLabel: '{mes} {anio}',
    sinAccion: 'Pick an action for this week',
    emptyMes: 'This month has no commitments. Tap "Refresh monthly plan".',
    sinCompromiso: 'No practice assigned this month',
    pedirAyuda: 'Get help',
    eleccionTitulo: 'How would you like help?',
    eleccionDesc: 'Do you want AI help or would you rather book a free 30-minute session with a mentor?',
    opcionIA: 'AI help (chat)',
    opcionMentor: 'Free 30-min session with a mentor',
    cancelar: 'Cancel',
    cerrarChat: 'Close',
    escribeAqui: 'Type your question...',
    enviar: 'Send',
    pensando: 'Thinking...',
    paywallTitulo: 'You need the monthly plan',
    paywallDesc: 'To get AI help, subscribe to the monthly plan.',
    pagarPlan: 'Pay monthly plan for only \${monto}',
    pagarCargando: 'Processing...',
  },
};

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function monthKeyOf(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function addMonths(monthKey: string, delta: number): string {
  const parts = monthKey.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(monthKey: string, lang: PlanLang): string {
  const parts = monthKey.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return LABELS[lang].mesLabel.replace('{mes}', MESES[lang][d.getMonth()]).replace('{anio}', String(d.getFullYear()));
}

function lunesDe(date: Date): Date {
  const c = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
}

function addWeeks(monday: Date, delta: number): Date {
  const c = new Date(monday);
  c.setDate(c.getDate() + delta * 7);
  return c;
}

function weekKeyOf(monday: Date): string {
  return (
    monday.getFullYear() +
    '-' +
    String(monday.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(monday.getDate()).padStart(2, '0')
  );
}

function fmtDay(date: Date, lang: PlanLang): string {
  return date.getDate() + ' ' + MESES[lang][date.getMonth()];
}

const PASOS_TOUR: Record<PlanLang, TourStep[]> = {
  es: [
    { selector: '#madurez-plan-title', title: 'Mejora del Nivel de Madurez', description: 'Aquí defines las acciones para mejorar la madurez de tu organización: cada mes una práctica con cada agente, en el orden de los temas de la evaluación.' },
    { selector: '#madurez-scrum', title: 'Scrum semanal', description: 'Semana a semana se elige UNA acción y se divide en tareas. Toca una tarjeta para moverla entre columnas.' },
    { selector: '#madurez-mensual', title: 'Plan del mes', description: 'Cada mes se agenda una práctica con cada agente. Actualiza el estatus a Completada para avanzar automáticamente al siguiente nivel del tema.' },
    { selector: '#madurez-temas', title: 'Prácticas por tema', description: 'El detalle de los 11 temas: la siguiente práctica a trabajar y, si ya la dominas, márcala completada.' },
  ],
  en: [
    { selector: '#madurez-plan-title', title: 'Maturity Level Improvement', description: 'This is where you define the actions to improve your organization\'s maturity: one practice with each agent per month, following the assessment topic order.' },
    { selector: '#madurez-scrum', title: 'Weekly scrum', description: 'Week by week you choose ONE action and break it into tasks. Tap a card to move it across columns.' },
    { selector: '#madurez-mensual', title: 'Monthly plan', description: 'Each month schedules one practice per agent. Update the status to Completed to automatically advance to the next level of the topic.' },
    { selector: '#madurez-temas', title: 'Practices by topic', description: 'The detail of the 11 topics: the next practice to work on and, if you already master it, mark it as completed.' },
  ],
};

export default function MaturityPlanBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const dimensions = React.useMemo(() => getMaturityDimensions(lang), [lang]);
  const temaDe = React.useMemo(() => {
    const m: Record<string, string> = {};
    dimensions.forEach((d) => {
      m[d.id] = d.tema;
    });
    return m;
  }, [dimensions]);

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [answers, setAnswers] = React.useState<DimensionAnswers | null>(null);
  const [plan, setPlan] = React.useState<PlanMadurez>(() => ({ v: 1, completados: {}, compromisos: {}, sprints: {} }));
  const [loaded, setLoaded] = React.useState(false);
  const [mesSel, setMesSel] = React.useState<string>(() => monthKeyOf(new Date()));
  const [semanaOffset, setSemanaOffset] = React.useState(0);
  const [nuevaTarea, setNuevaTarea] = React.useState('');
  const router = useRouter();
  const [eleccionMentor, setEleccionMentor] = React.useState<MentorAgente | null>(null);
  const [paywallMentor, setPaywallMentor] = React.useState<MentorAgente | null>(null);
  const [ayudaMentor, setAyudaMentor] = React.useState<MentorAgente | null>(null);
  const [ayudaHistorial, setAyudaHistorial] = React.useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [ayudaInput, setAyudaInput] = React.useState('');
  const [ayudaCargando, setAyudaCargando] = React.useState(false);
  const [esPremium, setEsPremium] = React.useState(false);
  const [precioPlan, setPrecioPlan] = React.useState<number | null>(null);
  const [pagando, setPagando] = React.useState(false);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const ans = await getLatestAssessmentAnswers(user.uid);
        if (!cancelled) setAnswers(ans);
      } catch (err) {
        console.error('[MBE Madurez] failed to load assessment', err);
        if (!cancelled) setAnswers(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    if (!user) {
      setEsPremium(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/worlds', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setEsPremium(Boolean(data?.yo?.premium));
        }
      } catch (err) {
        console.error('[MBE Madurez] failed to load premium status', err);
      }
      try {
        const token2 = await user.getIdToken();
        const res2 = await fetch('/api/pagos/precio-plan', { headers: { Authorization: `Bearer ${token2}` } });
        if (res2.ok) {
          const data2 = await res2.json();
          if (!cancelled && typeof data2?.precio === 'number') setPrecioPlan(data2.precio);
        }
      } catch (err) {
        console.error('[MBE Madurez] failed to load plan price', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setPlan({
            v: 1,
            completados: parsed.completados ?? {},
            compromisos: parsed.compromisos ?? {},
            sprints: parsed.sprints ?? {},
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    } catch (err) {
      console.error(err);
    }
  }, [plan, loaded]);

  const baseNivel = React.useCallback(
    (themeId: DimensionId): number => {
      if (!answers) return 0;
      const arr = answers[themeId];
      if (!arr) return 0;
      for (let i = 0; i < 6; i++) {
        if (arr[i] !== 'yes') return i;
      }
      return 6;
    },
    [answers]
  );

  const siguienteNivel = React.useCallback(
    (themeId: DimensionId): number => {
      const b = baseNivel(themeId) + (plan.completados[themeId] ?? 0);
      return b > 6 ? 6 : b;
    },
    [baseNivel, plan.completados]
  );

  const proximaPractica = React.useCallback(
    (themeId: DimensionId): { nivel: number; practica: PracticaMadurez } | null => {
      const n = siguienteNivel(themeId);
      if (n >= 6) return null;
      return { nivel: n, practica: PRACTICAS_POR_TEMA[themeId][n] };
    },
    [siguienteNivel]
  );

  const siguienteDeAgente = React.useCallback(
    (mentor: MentorAgente): { themeId: DimensionId; nivel: number; practica: PracticaMadurez } | null => {
      for (const id of DIMENSION_IDS) {
        const sig = proximaPractica(id);
        if (sig && sig.practica.mentor === mentor) return { themeId: id, ...sig };
      }
      return null;
    },
    [proximaPractica]
  );

  const contextoDeMentor = React.useCallback(
    (mentor: MentorAgente): { descripcion: string; entregable: string } => {
      const comp = (plan.compromisos[mesSel] ?? []).find((c) => c.mentor === mentor);
      if (comp) return { descripcion: `${temaDe[comp.themeId]} - ${comp.practica}`, entregable: comp.practica };
      const sig = siguienteDeAgente(mentor);
      if (sig) return { descripcion: `${temaDe[sig.themeId]} - ${sig.practica.practica}`, entregable: sig.practica.practica };
      return { descripcion: mentor, entregable: '' };
    },
    [plan.compromisos, mesSel, temaDe, siguienteDeAgente]
  );

  const cerrarAyuda = () => {
    setAyudaMentor(null);
    setAyudaHistorial([]);
    setAyudaInput('');
  };

  const abrirChatMentor = (mentor: MentorAgente) => {
    setAyudaMentor(mentor);
    setAyudaHistorial([]);
    setAyudaInput('');
    setAyudaCargando(true);
    const ctx = contextoDeMentor(mentor);
    fetch('/api/mentores/ayuda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentor, modo: 'tip', language: lang, accion: ctx }),
    })
      .then((r) => r.json())
      .then((d) => {
        const respuesta = typeof d?.reply === 'string' ? d.reply : d?.error || (lang === 'en' ? 'No response.' : 'Sin respuesta.');
        setAyudaHistorial([{ role: 'assistant', content: respuesta }]);
      })
      .catch(() =>
        setAyudaHistorial([
          { role: 'assistant', content: lang === 'en' ? 'Could not reach the mentor.' : 'No se pudo contactar al mentor.' },
        ])
      )
      .finally(() => setAyudaCargando(false));
  };

  React.useEffect(() => {
    if (!ayudaMentor) return;
    const el = document.getElementById('ayuda-mentor-panel-' + ayudaMentor);
    if (el) {
      const idTimeout = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => window.clearTimeout(idTimeout);
    }
  }, [ayudaMentor]);

  const enviarMensajeMentor = (mentor: MentorAgente) => {
    const texto = ayudaInput.trim();
    if (!texto || ayudaCargando) return;
    const historialNuevo = ayudaHistorial.concat([{ role: 'user' as const, content: texto }]);
    setAyudaHistorial(historialNuevo);
    setAyudaInput('');
    setAyudaCargando(true);
    const ctx = contextoDeMentor(mentor);
    fetch('/api/mentores/ayuda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentor, modo: 'chat', language: lang, accion: ctx, mensajes: historialNuevo }),
    })
      .then((r) => r.json())
      .then((d) => {
        const respuesta = typeof d?.reply === 'string' ? d.reply : d?.error || (lang === 'en' ? 'No response.' : 'Sin respuesta.');
        setAyudaHistorial((prev) => prev.concat([{ role: 'assistant' as const, content: respuesta }]));
      })
      .catch(() => {
        setAyudaHistorial((prev) =>
          prev.concat([{ role: 'assistant' as const, content: lang === 'en' ? 'Could not reach the mentor.' : 'No se pudo contactar al mentor.' }])
        );
      })
      .finally(() => setAyudaCargando(false));
  };

  const elegirIA = (mentor: MentorAgente) => {
    setEleccionMentor(null);
    if (!esPremium) {
      setPaywallMentor(mentor);
      return;
    }
    abrirChatMentor(mentor);
  };

  const elegirMentorHumano = () => {
    setEleccionMentor(null);
    router.push('/' + lang + '/agendar');
  };

  const pagarPlanMensual = async () => {
    if (!user || pagando) return;
    setPagando(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locale: lang, returnPath: '/babel/madurez' }),
      });
      const data = await res.json();
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('[MBE Madurez] crear-preferencia sin checkoutUrl', data);
        setPagando(false);
      }
    } catch (err) {
      console.error('[MBE Madurez] error al iniciar pago', err);
      setPagando(false);
    }
  };

  const generarMes = (mesKey: string) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const nuevos = [...actuales];
      let cambio = false;
      const findSig = (mentor: MentorAgente): { themeId: DimensionId; nivel: number; practica: PracticaMadurez } | null => {
        for (const id of DIMENSION_IDS) {
          if (nuevos.some((c) => c.themeId === id)) continue;
          const n = baseNivel(id) + (prev.completados[id] ?? 0);
          if (n >= 6) continue;
          const pr = PRACTICAS_POR_TEMA[id][n];
          if (pr.mentor === mentor) return { themeId: id, nivel: n, practica: pr };
        }
        return null;
      };
      for (const mentor of MENTORES) {
        if (nuevos.some((c) => c.mentor === mentor)) continue;
        const sig = findSig(mentor);
        if (sig) {
          nuevos.push({
            id: generateId(),
            themeId: sig.themeId,
            nivel: sig.nivel,
            practica: sig.practica.practica,
            mentor,
            estatus: 'pendiente',
          });
          cambio = true;
        }
      }
      if (!cambio) return prev;
      return { ...prev, compromisos: { ...prev.compromisos, [mesKey]: nuevos } };
    });
  };

  const cambiarEstatus = (mesKey: string, id: string, estatus: Estatus) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const comp = actuales.find((c) => c.id === id);
      if (!comp) return prev;
      const completados = { ...prev.completados };
      if (estatus === 'completada' && comp.estatus !== 'completada') {
        completados[comp.themeId] = (completados[comp.themeId] ?? 0) + 1;
      } else if (estatus !== 'completada' && comp.estatus === 'completada') {
        const v = (completados[comp.themeId] ?? 0) - 1;
        completados[comp.themeId] = v > 0 ? v : 0;
      }
      return {
        ...prev,
        completados,
        compromisos: {
          ...prev.compromisos,
          [mesKey]: actuales.map((c) => (c.id === id ? { ...c, estatus } : c)),
        },
      };
    });
  };

  const eliminarCompromiso = (mesKey: string, id: string) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const comp = actuales.find((c) => c.id === id);
      if (!comp) return prev;
      const completados = { ...prev.completados };
      if (comp.estatus === 'completada') {
        const v = (completados[comp.themeId] ?? 0) - 1;
        completados[comp.themeId] = v > 0 ? v : 0;
      }
      return {
        ...prev,
        completados,
        compromisos: { ...prev.compromisos, [mesKey]: actuales.filter((c) => c.id !== id) },
      };
    });
  };

  const marcarTemaCompletado = (themeId: DimensionId) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesSel] ?? [];
      const n = baseNivel(themeId) + (prev.completados[themeId] ?? 0);
      if (n >= 6) return prev;
      const pr = PRACTICAS_POR_TEMA[themeId][n];
      const existente = actuales.find((c) => c.themeId === themeId);
      const yaCompletada = Boolean(existente && existente.estatus === 'completada');
      const compromisos = existente
        ? actuales.map((c) => (c.themeId === themeId ? { ...c, estatus: 'completada' as Estatus } : c))
        : actuales.concat([
            {
              id: generateId(),
              themeId,
              nivel: n,
              practica: pr.practica,
              mentor: pr.mentor,
              estatus: 'completada' as Estatus,
            },
          ]);
      return {
        ...prev,
        completados: {
          ...prev.completados,
          [themeId]: (prev.completados[themeId] ?? 0) + (yaCompletada ? 0 : 1),
        },
        compromisos: { ...prev.compromisos, [mesSel]: compromisos },
      };
    });
  };

  // ── Scrum semanal ─────────────────────────────────────────────────────────
  const semanaLunes = React.useMemo(() => addWeeks(lunesDe(new Date()), semanaOffset), [semanaOffset]);
  const semKey = weekKeyOf(semanaLunes);
  const sprint = plan.sprints[semKey];

  const accionPorDefecto = React.useMemo(() => {
    const mesKey = monthKeyOf(semanaLunes);
    const comps = plan.compromisos[mesKey] ?? [];
    for (const c of comps) {
      if (c.estatus !== 'completada') return c.themeId + '|' + c.nivel;
    }
    for (const id of DIMENSION_IDS) {
      const sig = proximaPractica(id);
      if (sig) return id + '|' + sig.nivel;
    }
    return '';
  }, [plan.compromisos, proximaPractica, semanaLunes]);

  const accionSel = sprint ? sprint.accion : accionPorDefecto;

  const opcionesAccion = React.useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const mesKey = monthKeyOf(semanaLunes);
    const comps = plan.compromisos[mesKey] ?? [];
    comps.forEach((c) => {
      if (c.estatus !== 'completada') {
        opts.push({ value: c.themeId + '|' + c.nivel, label: (temaDe[c.themeId] || c.themeId) + ' - ' + c.practica });
      }
    });
    DIMENSION_IDS.forEach((id) => {
      const sig = proximaPractica(id);
      if (!sig) return;
      const value = id + '|' + sig.nivel;
      if (opts.some((o) => o.value === value)) return;
      opts.push({
        value,
        label: (temaDe[id] || id) + ' (' + LEVEL_LABELS[lang][sig.nivel] + ') - ' + sig.practica.practica,
      });
    });
    return opts;
  }, [plan.compromisos, proximaPractica, semanaLunes, lang, temaDe]);

  const labelDeAccion = React.useCallback(
    (value: string): string => {
      const parts = value.split('|');
      const id = parts[0] as DimensionId;
      const n = Number(parts[1] || 0);
      const pr = PRACTICAS_POR_TEMA[id]?.[n];
      return (temaDe[id] || id) + ' (' + LEVEL_LABELS[lang][n] + ') - ' + (pr?.practica || '');
    },
    [lang, temaDe]
  );

  const opcionesEfectivas = React.useMemo(() => {
    if (!accionSel) return opcionesAccion;
    if (opcionesAccion.some((o) => o.value === accionSel)) return opcionesAccion;
    return [{ value: accionSel, label: labelDeAccion(accionSel) }, ...opcionesAccion];
  }, [accionSel, opcionesAccion, labelDeAccion]);

  const fijarAccion = (value: string) => {
    setPlan((prev) => ({
      ...prev,
      sprints: { ...prev.sprints, [semKey]: { accion: value, tareas: prev.sprints[semKey]?.tareas ?? [] } },
    }));
  };

  const agregarTarea = () => {
    const texto = nuevaTarea.trim();
    if (!texto) return;
    setPlan((prev) => ({
      ...prev,
      sprints: {
        ...prev.sprints,
        [semKey]: {
          accion: prev.sprints[semKey]?.accion ?? accionPorDefecto,
          tareas: (prev.sprints[semKey]?.tareas ?? []).concat([{ id: generateId(), texto, estatus: 'todo' as TareaEstatus }]),
        },
      },
    }));
    setNuevaTarea('');
  };

  const moverTarea = (id: string) => {
    setPlan((prev) => {
      const s = prev.sprints[semKey];
      if (!s) return prev;
      return {
        ...prev,
        sprints: {
          ...prev.sprints,
          [semKey]: {
            ...s,
            tareas: s.tareas.map((ta) =>
              ta.id === id
                ? { ...ta, estatus: (ta.estatus === 'todo' ? 'doing' : ta.estatus === 'doing' ? 'done' : 'todo') as TareaEstatus }
                : ta
            ),
          },
        },
      };
    });
  };

  const eliminarTarea = (id: string) => {
    setPlan((prev) => {
      const s = prev.sprints[semKey];
      if (!s) return prev;
      return { ...prev, sprints: { ...prev.sprints, [semKey]: { ...s, tareas: s.tareas.filter((ta) => ta.id !== id) } } };
    });
  };

  const tareas = sprint?.tareas ?? [];
  const semanaFin = (() => {
    const d = new Date(semanaLunes);
    d.setDate(d.getDate() + 6);
    return d;
  })();
  const semanaLabel = t.semanaLabel.replace('{desde}', fmtDay(semanaLunes, lang)).replace('{hasta}', fmtDay(semanaFin, lang));
  const compromisosMes = plan.compromisos[mesSel] ?? [];
  const sinEvaluacion = loaded && answers === null && user !== undefined;

  const estatusLabel = (e: Estatus): string =>
    e === 'completada' ? t.completada : e === 'en_progreso' ? t.enProgreso : t.pendiente;

  return (
    <div>
      <div className="flex items-center gap-3">
        <AgentAvatar agente="Babel" size={56} className="shrink-0" />
        <div>
          <h3 id="madurez-plan-title" className="text-xl font-bold text-slate-800">
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      {sinEvaluacion ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t.sinEvaluacion}
        </div>
      ) : null}

      {/* Scrum semanal */}
      <div id="madurez-scrum" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{t.scrumTitle}</h4>
            <button
              type="button"
              onClick={() => setSemanaOffset((o) => o - 1)}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-medium text-slate-800">{semanaLabel}</span>
            <button
              type="button"
              onClick={() => setSemanaOffset((o) => o + 1)}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.scrumHint}</p>

        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.accionSemana}</label>
          <select
            value={accionSel}
            onChange={(ev) => fijarAccion(ev.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            {opcionesEfectivas.length > 0 ? (
              opcionesEfectivas.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            ) : (
              <option value="">{t.accionSinOpciones}</option>
            )}
          </select>
          {!accionSel && opcionesAccion.length > 0 ? <p className="mt-1 text-xs text-slate-400">{t.sinAccion}</p> : null}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={nuevaTarea}
            onChange={(ev) => setNuevaTarea(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') agregarTarea();
            }}
            placeholder={t.tareaPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={agregarTarea}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t.agregarTarea}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ['todo', t.colTodo],
              ['doing', t.colDoing],
              ['done', t.colDone],
            ] as [TareaEstatus, string][]
          ).map(([estatus, header]) => (
            <div key={estatus} className="glass-panel p-2">
              <p className="px-1 pb-1 text-xs font-semibold text-slate-500">{header}</p>
              <div className="space-y-1.5">
                {tareas
                  .filter((ta) => ta.estatus === estatus)
                  .map((ta) => (
                    <div
                      key={ta.id}
                      onClick={() => moverTarea(ta.id)}
                      title="Clic para mover"
                      className={
                        'flex cursor-pointer items-start justify-between gap-2 px-2 py-1.5 text-xs ' +
                        (ta.estatus === 'done'
                          ? 'rounded-md border border-green-200 bg-green-50 text-green-800 line-through'
                          : 'glass-panel glass-panel-hover text-slate-700')
                      }
                    >
                      <span className="min-w-0">{ta.texto}</span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          eliminarTarea(ta.id);
                        }}
                        className="shrink-0 text-red-500 hover:text-red-700"
                        aria-label="Eliminar tarea"
                      >
                        x
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan mensual */}
      <div id="madurez-mensual" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{t.planMensualTitle}</h4>
            <button
              type="button"
              onClick={() => setMesSel((m) => addMonths(m, -1))}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[110px] text-center text-sm font-medium text-slate-800">{monthLabel(mesSel, lang)}</span>
            <button
              type="button"
              onClick={() => setMesSel((m) => addMonths(m, 1))}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => generarMes(mesSel)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            {t.actualizarMes}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.planMensualHint}</p>

        {compromisosMes.length === 0 && MENTORES.every((m) => !siguienteDeAgente(m)) ? (
          <div className="glass-panel mt-2 p-3 text-sm text-slate-500">{t.emptyMes}</div>
        ) : (
          <div className="mt-2 space-y-2">
            {MENTORES.map((mentor) => {
              const comp = compromisosMes.find((c) => c.mentor === mentor);
              return (
                <React.Fragment key={mentor}>
                  <div className="glass-panel grid items-center gap-2 p-3 sm:grid-cols-[140px_1fr_90px_130px_auto]">
                    <span className="flex w-fit items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEleccionMentor(mentor)}
                        className="relative shrink-0 rounded-full outline-none ring-teal-400 focus-visible:ring-2"
                        title={t.pedirAyuda}
                      >
                        <AgentAvatar agente={mentor} size={36} onClick={() => setEleccionMentor(mentor)} />
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white shadow">
                          ?
                        </span>
                      </button>
                      <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + MENTOR_COLOR[mentor]}>
                        {mentor}
                      </span>
                    </span>
                    {comp ? (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {temaDe[comp.themeId]} - {comp.practica}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t.nivelCol}: {LEVEL_LABELS[lang][comp.nivel]}
                          </p>
                        </div>
                        <select
                          value={comp.estatus}
                          onChange={(ev) => cambiarEstatus(mesSel, comp.id, ev.target.value as Estatus)}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
                        >
                          <option value="pendiente">{t.pendiente}</option>
                          <option value="en_progreso">{t.enProgreso}</option>
                          <option value="completada">{t.completada}</option>
                        </select>
                        <span
                          className={
                            'rounded-full px-2.5 py-1 text-xs font-medium ' +
                            (comp.estatus === 'completada'
                              ? 'bg-green-100 text-green-800'
                              : comp.estatus === 'en_progreso'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600')
                          }
                        >
                          {estatusLabel(comp.estatus)}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarCompromiso(mesSel, comp.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          {t.eliminar}
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">{t.sinCompromiso}</p>
                    )}
                  </div>
                  {ayudaMentor === mentor ? (
                    <div id={'ayuda-mentor-panel-' + mentor} className="rounded-lg border border-teal-200 bg-teal-50 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs font-semibold text-teal-800">
                          <AgentAvatar agente={mentor} size={18} />
                          {mentor}
                        </span>
                        <button type="button" onClick={cerrarAyuda} className="text-xs text-slate-500 hover:underline">
                          {t.cerrarChat}
                        </button>
                      </div>
                      <div>
                        {ayudaHistorial.map((m, i) => (
                          <p
                            key={i}
                            className={
                              'mt-1 whitespace-pre-wrap text-xs ' + (m.role === 'user' ? 'font-medium text-slate-800' : 'text-slate-700')
                            }
                          >
                            {m.content}
                          </p>
                        ))}
                        {ayudaCargando ? <p className="mt-1 text-xs text-slate-500">{t.pensando}</p> : null}
                        <div className="mt-2 flex gap-1">
                          <input
                            type="text"
                            value={ayudaInput}
                            onChange={(ev) => setAyudaInput(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') enviarMensajeMentor(mentor);
                            }}
                            placeholder={t.escribeAqui}
                            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => enviarMensajeMentor(mentor)}
                            disabled={ayudaCargando}
                            className="rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                          >
                            {t.enviar}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Practicas por tema */}
      <div id="madurez-temas" className="mt-6">
        <h4 className="text-sm font-semibold text-slate-700">{t.temasTitle}</h4>
        <div className="mt-2 space-y-2">
          {DIMENSION_IDS.map((id) => {
            const sig = proximaPractica(id);
            return (
              <div key={id} className="glass-panel flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{temaDe[id]}</p>
                  {sig ? (
                    <p className="mt-0.5 text-xs text-slate-600">
                      {t.siguienteCol}: ({LEVEL_LABELS[lang][sig.nivel]}) {sig.practica.practica}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-green-700">{t.temaCompleto}</p>
                  )}
                </div>
                {sig ? (
                  <button
                    type="button"
                    onClick={() => marcarTemaCompletado(id)}
                    className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    {t.marcarCompletada}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.guardado}</p>

      {eleccionMentor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEleccionMentor(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <AgentAvatar agente={eleccionMentor} size={56} className="mx-auto" />
            <h4 className="mt-3 text-base font-bold text-slate-800">{t.eleccionTitulo}</h4>
            <p className="mt-1 text-sm text-slate-600">{t.eleccionDesc}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => elegirIA(eleccionMentor)}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                {t.opcionIA}
              </button>
              <button
                type="button"
                onClick={elegirMentorHumano}
                className="rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
              >
                {t.opcionMentor}
              </button>
              <button
                type="button"
                onClick={() => setEleccionMentor(null)}
                className="mt-1 text-xs font-medium text-slate-500 hover:underline"
              >
                {t.cancelar}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paywallMentor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPaywallMentor(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <AgentAvatar agente={paywallMentor} size={56} className="mx-auto" />
            <h4 className="mt-3 text-base font-bold text-slate-800">{t.paywallTitulo}</h4>
            <p className="mt-1 text-sm text-slate-600">{t.paywallDesc}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={pagarPlanMensual}
                disabled={pagando}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {pagando ? t.pagarCargando : t.pagarPlan.replace('${monto}', String(precioPlan ?? 99))}
              </button>
              <button
                type="button"
                onClick={() => setPaywallMentor(null)}
                className="mt-1 text-xs font-medium text-slate-500 hover:underline"
              >
                {t.cancelar}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PageTour pageId="madurez" steps={lang === 'en' ? PASOS_TOUR.en : PASOS_TOUR.es} lang={lang} />
    </div>
  );
}

'@
if (-not (Aplicar-ArchivoCompleto -RutaArchivo $archivoMadurez -ContenidoOriginalEsperado $madurezOriginal -ContenidoNuevo $madurezNuevo -Descripcion "MaturityPlanBuilder.tsx actualizado")) { $exitoTotal = $false }

Write-Host ""
Write-Host "== Paso 4: Mundos Premium (aviso y boton de pago del plan mensual) ==" -ForegroundColor Cyan
Write-Host ""

$archivoWorlds = Join-Path $raiz "src\components\worlds\WorldsBuilder.tsx"
$worldsOriginal = @'
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { getMaturityDimensions, DIMENSION_IDS, type DimensionId } from '@/lib/maturity-dimensions';
import { nivelDesdePuntos } from '@/lib/club';
import { getBabelSessionIfExists } from '@/lib/babel-session';
import { MENTORES, PRACTICAS_POR_TEMA, type MentorAgente } from '@/lib/madurez-practicas';
import {
  MISIONES_PART_LABELS,
  SUBMUNDOS_ESTRATEGIA_LABELS,
  MUNDOS_PREMIUM_LABELS,
  nivelLabelPuntos,
} from '@/lib/worlds';
import { WorldsBg } from '@/components/worlds/worlds-bg';
import { InsigniaCelebracion } from '@/components/worlds/InsigniaCelebracion';
import { insigniasNuevas, insigniasVistas, marcarInsigniasVistas } from '@/lib/insignias';
import PageTour from '@/components/ui/executive/PageTour';
import type { TourStep } from '@/components/ui/executive/PageTour';

type Vista = 'mapa' | 'partida' | 'tablero' | 'estrategia' | 'dinero' | 'cliente' | 'normativo' | 'operativo' | 'cultura';
type VistaPremium = 'dinero' | 'cliente' | 'normativo' | 'operativo' | 'cultura';

const VISTAS_PREMIUM: VistaPremium[] = ['dinero', 'cliente', 'normativo', 'operativo', 'cultura'];

interface Progreso {
  nombre: string;
  puntos: number;
  nivel: string;
  partida: number[];
  tablero: boolean;
  premium?: boolean;
}

// Traducciones es/en (estilo de los builders existentes).
const I = {
  cargando: ['Cargando el mapa de mundos…', 'Loading the worlds map…'],
  sinSesion: ['Inicia sesión para comenzar tu partida.', 'Sign in to start your game.'],
  volver: ['← Volver al mapa', '← Back to the map'],
  chipPuntos: ['Puntos del Club', 'Club points'],
  chipRacha: ['Racha', 'Streak'],
  rachaDemo: ['4 días (Fase B real)', '4 days (real in Phase B)'],
  saludo: ['¡Hola', 'Hi'],
  progreso: ['Tu progreso', 'Your progress'],
  misionesDe: ['misiones', 'missions'],
  partidaEnCurso: ['Mundo de Partida en curso', 'Starting World in progress'],
  partidaCompleta: ['Mundo de Partida ✓ completo', 'Starting World ✓ complete'],
  tableroBloqueado: ['Tablero: bloqueado', 'Board: locked'],
  tableroListo: ['Tablero: desbloqueado ✓', 'Board: unlocked ✓'],
  estrategiaCurso: ['Estrategia (premium) en curso', 'Strategy (premium) in progress'],
  gratisTag: ['Gratis · Activo', 'Free · Active'],
  mundoPartida: ['Mundo de Partida', 'Starting World'],
  mundoPartidaDesc: [
    'Anfitrión Babel · 2 misiones para calibrar tu empresa antes de la aventura. Al completarlas desbloqueas el Tablero de Retos.',
    'Hosted by Babel · 2 missions to calibrate your company before the adventure. Completing them unlocks the Challenges Board.',
  ],
  entrarPartida: ['► Entrar al mundo', '► Enter the world'],
  tableroCard: ['Tablero de Retos', 'Challenges Board'],
  tableroDesc: [
    'Retos semanales y mensuales sobre tus 11 temas de madurez. Se desbloquea terminando el Mundo de Partida.',
    'Weekly and monthly challenges over your 11 maturity topics. Unlocks by finishing the Starting World.',
  ],
  reqTablero: ['🔒 Requisito: «Objetivos Estratégicos»', '🔒 Requirement: «Strategic Objectives»'],
  tagUnlock: ['Desbloqueado', 'Unlocked'],
  tagLock: ['Bloqueado', 'Locked'],
  premTitle: ['Mundos Premium', 'Premium Worlds'],
  premKey: ['🔑 plan_mensual', '🔑 monthly plan'],
  enConstruccion: ['En construcción', 'Under construction'],
  verMundo: ['► Ver mundo', '► View world'],
  host: ['Anfitrión', 'Host'],
  submundos: ['submundos', 'subworlds'],
  faseALista: ['Fase A lista', 'Phase A ready'],
  wipMundo: ['🔨 Este mundo estará disponible en la siguiente fase.', '🔨 This world will be available in the next phase.'],
  misAnterior: ['🔒 Completa primero la misión anterior.', '🔒 Complete the previous mission first.'],
  misNum: ['Misión', 'Mission'],
  repetible: ['Repetible (3m)', 'Repeatable (3m)'],
  completadaTag: ['Completada', 'Completed'],
  pts: ['pts', 'pts'],
  rutaReal: ['Ruta real', 'Real route'],
  abrirHerramienta: ['Abrir herramienta', 'Open tool'],
  jugarMision: ['🎖 Jugar misión', '🎖 Play mission'],
  cerrarMision: ['⭐ Completar misión final', '⭐ Complete final mission'],
  terminando: ['Completando…', 'Completing…'],
  tiendaPartida: ['🛠️ Tienda del Mundo de Partida', '🛠️ Starting World shop'],
  tiendaPartidaDesc: [
    'Herramientas gratuitas que abren su versión real dentro de la plataforma.',
    'Free tools that open their real version inside the platform.',
  ],
  checklist: ['Checklist de arranque', 'Startup checklist'],
  fondos: ['Fondos sin prisa', 'Grant finder'],
  mapaMadurez: ['Mapa de madurez', 'Maturity map'],
  listoTag: ['Listo', 'Ready'],
  enCursoTag: ['En curso', 'In progress'],
  pendienteTag: ['Pendiente', 'Pending'],
  abrirSub: ['Abrir misión', 'Open mission'],
  tiendaEstrategia: ['🛠️ Tienda del Mundo Estrategia', '🛒 Strategy World shop'],
  tiendaEstrategiaDesc: [
    'Herramientas para aplicar cada fase a tu empresa (demo en esta fase).',
    'Tools to apply each phase to your company (demo in this phase).',
  ],
  canvas: ['Canvas Propuesta de Valor', 'Value Proposition Canvas'],
  foda: ['Matriz FODA', 'SWOT Matrix'],
  plantilla: ['Plantilla Plan de Acción', 'Action Plan Template'],
  toolToast: ['Herramienta descargada (demo)', 'Tool downloaded (demo)'],
  retoSemanal: ['Reto semanal — Finanzas · Nivel 2 (Estándar)', 'Weekly challenge — Finance · Level 2 (Standard)'],
  retoSemanalDesc: [
    'Práctica: «Controla tu flujo de caja» · Anfitrión: Fisnando. Completa las 5 casillas para el cofre semanal (+20 pts). La agenda real llega en la siguiente fase.',
    'Practice: "Control your cash flow" · Host: Fisnando. Complete the 5 tiles for the weekly chest (+20 pts). Real scheduling arrives in the next phase.',
  ],
  retoMensual: ['Reto mensual — una práctica por agente', 'Monthly challenge — one practice per agent'],
  retoMensualDesc: [
    'Practica con cada agente según tu Plan de Madurez (demo).',
    'Practice with each agent from your Maturity Plan (demo).',
  ],
  mapaProgreso: ['Mapa de progreso · 11 temas × 6 niveles', 'Progress map · 11 topics × 6 levels'],
  tema: ['Tema', 'Topic'],
  leyendaMapa: [
    'Verde = dominado · Ámbar = en curso · Rojo = pendiente. Los retos semanales/mensuales reales llegan en la Fase B.',
    'Green = mastered · Amber = in progress · Red = pending. Real weekly/monthly challenges arrive in Phase B.',
  ],
  sinEvaluacion: [
    'Aún no tienes evaluación. Llena la Evaluación de Madurez para poblar tu mapa.',
    'No assessment yet. Complete the Maturity Assessment to fill your map.',
  ],
  tableroLockedTitle: ['Tablero bloqueado', 'Board locked'],
  tableroLockedDesc: [
    'Completa el Mundo de Partida para desbloquear el Tablero de Retos.',
    'Complete the Starting World to unlock the Challenges Board.',
  ],
  irCalibracion: ['→ Ir al Mundo de Partida', '→ Go to the Starting World'],
  misionCompleta: ['¡Misión completada!', 'Mission complete!'],
  tableroGanado: ['¡Tablero de Retos desbloqueado!', 'Challenges Board unlocked!'],
  errorProcesar: ['No se pudo procesar la acción.', 'Could not process the action.'],
  temaAria: ['Cambiar tema claro/oscuro', 'Toggle light/dark theme'],
  misApoyo: ['Apoyo de Especialistas', 'Specialist Support'],
  misApoyoDesc: [
    'Agenda una sesión con un mentor experto (Babel, Fisnando, Karmetin, Normau o Atech) para desatorar tu misión y avanzar con acompañamiento.',
    'Book a session with an expert mentor (Babel, Fisnando, Karmetin, Normau or Atech) to unblock your mission and move forward with support.',
  ],
  agendarMentor: ['Agendar con un mentor', 'Book a mentor session'],
  misPA: ['Misión de Plan de Acción', 'Action Plan Mission'],
  misPADesc: [
    'Se desbloquea cuando defines tu Plan de Acción. Conecta los temas de cada agente con las buenas prácticas a trabajar, mes a mes.',
    "Unlocks once you define your Action Plan. It connects each agent's topics with the practices to work on, month by month.",
  ],
  bloqueadaTag: ['Bloqueada', 'Locked'],
  paLockDesc: [
    'Define primero tu Plan de Acción (Plan de Acción Socioambiental de la Reflexión Estratégica) para desbloquear esta misión y ver tus actividades por agente.',
    'Define your Action Plan first (Socioenvironmental Action Plan of the Strategic Reflection) to unlock this mission and see your activities per agent.',
  ],
  crearMiPA: ['Definir mi Plan de Acción', 'Define my Action Plan'],
  verPA: ['Abrir el Plan de Acción', 'Open the Action Plan'],
  panelAgente: ['Agente', 'Agent'],
  panelTemas: ['Temas asignados a', 'Topics assigned to'],
  panelTodos: ['Actividades por agente', 'Activities per agent'],
  temaCol: ['Tema', 'Topic'],
  practicaCol: ['Siguiente práctica', 'Next practice'],
  nivelCol: ['Nivel', 'Level'],
  mesCol: ['Este mes', 'This month'],
  dominadoTag: ['Dominado', 'Mastered'],
  sinPend: ['Sin prácticas pendientes', 'No pending practices'],
  notaPanel: [
    'Las actividades parten de tu Evaluación de Madurez (el nivel más bajo no completado de cada tema) y del Plan de Madurez del mes actual.',
    "Activities come from your Maturity Assessment (the lowest incomplete level of each topic) and this month's Maturity Plan.",
  ],
} as const;

type Params = readonly [string, string];
const t2 = (lang: 'es' | 'en') => (p: Params) => (lang === 'en' ? p[1] : p[0]);

// ── Misiones "Plan de Acción" de los mundos: panel de actividades por agente ─
// Los temas asignados a cada agente salen del catálogo de prácticas de madurez
// (PRACTICAS_POR_TEMA: mentor por tema) y las actividades del nivel más bajo
// no completado de la evaluación + el Plan de Madurez del mes actual.

const NIVELES_ACT: Record<'es' | 'en', string[]> = {
  es: ['Ejecución', 'Estándar', 'Control', 'Optimización', 'Excelencia', 'Influencer'],
  en: ['Execution', 'Standard', 'Control', 'Optimization', 'Excellence', 'Influencer'],
};

interface CompromisoLeido {
  themeId?: string;
  estatus?: 'pendiente' | 'en_progreso' | 'completada';
}

interface PlanMadurezLeido {
  completados: Record<string, number>;
  compromisos: Record<string, CompromisoLeido[]>;
}

interface Actividad {
  themeId: DimensionId;
  terminado: boolean;
  practica: string | null;
  nivel: number;
  comp: CompromisoLeido | undefined;
}

function monthKeyOf(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function baseNivelDe(respuestas: Record<string, string[]> | null, themeId: DimensionId): number {
  const arr = respuestas?.[themeId];
  if (!arr) return 0;
  for (let i = 0; i < 6; i++) {
    if (arr[i] !== 'yes') return i;
  }
  return 6;
}

function PanelActividades({
  agente,
  lang,
  respuestas,
  plan,
}: {
  agente: MentorAgente | 'todos';
  lang: 'es' | 'en';
  respuestas: Record<string, string[]> | null;
  plan: PlanMadurezLeido;
}) {
  const en = t2(lang);
  const dims = React.useMemo(() => getMaturityDimensions(lang), [lang]);
  const temaDe = React.useMemo(() => {
    const m: Record<string, string> = {};
    dims.forEach((d) => {
      m[d.id] = d.tema;
    });
    return m;
  }, [dims]);
  const mesKey = monthKeyOf(new Date());
  const agentes: MentorAgente[] = agente === 'todos' ? MENTORES : [agente];

  const filas = React.useMemo(() => {
    const comps = plan.compromisos[mesKey] ?? [];
    return agentes.map((a) => {
      const fs: Actividad[] = [];
      for (const id of DIMENSION_IDS) {
        const prs = PRACTICAS_POR_TEMA[id];
        if (!prs.some((p) => p.mentor === a)) continue;
        const n = Math.min(6, baseNivelDe(respuestas, id) + (plan.completados[id] ?? 0));
        fs.push({
          themeId: id,
          terminado: n >= 6,
          practica: n < 6 ? prs[n].practica : null,
          nivel: n < 6 ? n : -1,
          comp: comps.find((c) => c.themeId === id),
        });
      }
      return { agente: a, filas: fs };
    });
  }, [agentes, plan, respuestas, mesKey]);

  const colSpan = agente === 'todos' ? 5 : 4;

  const chip = (c: CompromisoLeido | undefined) => {
    if (!c) {
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }
    const cls =
      c.estatus === 'completada'
        ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
        : c.estatus === 'en_progreso'
          ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200'
          : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
    const lbl =
      c.estatus === 'completada' ? en(I.completadaTag) : c.estatus === 'en_progreso' ? en(I.enCursoTag) : en(I.pendienteTag);
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{lbl}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {agente === 'todos' && <th className="pb-2">{en(I.panelAgente)}</th>}
            <th className="pb-2">{en(I.temaCol)}</th>
            <th className="pb-2">{en(I.practicaCol)}</th>
            <th className="pb-2 text-center">{en(I.nivelCol)}</th>
            <th className="pb-2">{en(I.mesCol)}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ agente: a, filas: fs }) => (
            <React.Fragment key={a}>
              {agente === 'todos' && (
                <tr className="border-t border-slate-300/40 dark:border-slate-600/40">
                  <td colSpan={colSpan} className="py-1.5 pt-2.5">
                    <span className="flex items-center gap-2 font-extrabold text-slate-700 dark:text-slate-200">
                      <AgentAvatar agente={a} size={20} className="shrink-0" onClick={() => undefined} />
                      {a}
                    </span>
                  </td>
                </tr>
              )}
              {fs.length === 0 && (
                <tr className="border-t border-slate-300/40 dark:border-slate-600/40">
                  <td colSpan={colSpan} className="py-1.5 text-slate-500 dark:text-slate-400">
                    {en(I.sinPend)}
                  </td>
                </tr>
              )}
              {fs.map((f) => (
                <tr key={f.themeId} className="border-t border-slate-300/40 dark:border-slate-600/40">
                  {agente === 'todos' && <td className="py-1.5 pr-2" />}
                  <td className="py-1.5 pr-2 font-bold text-slate-700 dark:text-slate-200">{temaDe[f.themeId] ?? f.themeId}</td>
                  <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-300">
                    {f.terminado ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">✓ {en(I.dominadoTag)}</span>
                    ) : (
                      f.practica
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    {f.terminado ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">6/6</span>
                    ) : (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-extrabold text-teal-700 dark:bg-teal-900 dark:text-teal-200">
                        {NIVELES_ACT[lang][f.nivel]}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pl-2">{chip(f.comp)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
        <div className="mt-3 rounded-xl border border-slate-300/50 bg-white/40 p-4 dark:bg-white/5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🔒 {en(I.paLockDesc)}</p>
          <button
            className="mt-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            onClick={onIrPlan}
          >
            {en(I.crearMiPA)}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-extrabold text-slate-700 dark:text-slate-200">
            {en(I.panelTemas)}{' '}
            <b className="text-teal-700 dark:text-teal-300">{agente}</b>
          </p>
          <div className="mt-2">
            <PanelActividades agente={agente} lang={lang} respuestas={respuestas} plan={plan} />
          </div>
          <button
            className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            onClick={onIrPlan}
          >
            {en(I.verPA)} →
          </button>
        </>
      )}
    </div>
  );
}

function Confetti({ seed }: { seed: number }) {
  const hosts = React.useMemo(() => {
    if (seed <= 0) return [];
    const colors = ['#0d9488', '#f59e0b', '#f472b6', '#a78bfa', '#34d399', '#38bdf8'];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      dur: 1.4 + Math.random() * 1.9,
      delay: Math.random() * 0.6,
    }));
  }, [seed]);
  if (seed <= 0) return null;
  return (
    <div className="world-confetti-host">
      {hosts.map((h) => (
        <i
          key={`${seed}-${h.id}`}
          style={{ left: `${h.left}vw`, background: h.color, animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}
        />
      ))}
    </div>
  );
}

export function WorldsBuilder({ vistaInicial }: { vistaInicial?: Vista }) {
  const router = useRouter();
  const { lang, setLang } = useDisplayLang();
  const T = t2(lang === 'es' ? 'es' : 'en');
  const en = (p: Params) => T(p);

  const [yo, setYo] = React.useState<Progreso | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [vista, setVista] = React.useState<Vista>(vistaInicial ?? 'mapa');
  const [toast, setToast] = React.useState<string | null>(null);
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const [completando, setCompletando] = React.useState<number | null>(null);
  const [uid, setUid] = React.useState<string | null>(null);
  const [respuestas, setRespuestas] = React.useState<Record<string, string[]> | null>(null);
  // Misión 0 del Mundo de Estrategia (Calibración): se marca COMPLETADA cuando
  // la Fase 0 de Babel ya fue aprobada por el usuario en su sesión.
  const [fase0Aprobada, setFase0Aprobada] = React.useState(false);
  const [planMadurez, setPlanMadurez] = React.useState<PlanMadurezLeido>({ completados: {}, compromisos: {} });
  const [planAccionDefinido, setPlanAccionDefinido] = React.useState(false);

  const notificar = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2900);
  }, []);

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
  const irAPagar = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/perfil`);
  }, [router, lang]);

  const festejar = React.useCallback(() => {
    const seed = Date.now();
    setConfettiSeed(seed);
    window.setTimeout(() => setConfettiSeed(0), 4300);
  }, []);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr: User | null) => {
      if (!usr) {
        setCargando(false);
        return;
      }
      setUid(usr.uid);
      try {
        const token = await usr.getIdToken();
        const res = await fetch('/api/worlds', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = (await res.json()) as { yo: Progreso };
          setYo(data.yo);
          const nuevas = insigniasNuevas(usr.uid, {
            partida: data.yo.partida,
            tablero: data.yo.tablero,
            premium: data.yo.premium,
          });
          if (nuevas.length > 0) {
            setInsigniaNuevaId(nuevas[0]);
            festejar();
          }
        }
      } catch (err) {
        console.error('[worlds] carga', err);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (!uid) return;
    let vivo = true;
    getLatestAssessmentAnswers(uid)
      .then((answers) => {
        if (!vivo || !answers) return;
        const mapa: Record<string, string[]> = {};
        for (const id of Object.keys(answers)) {
          mapa[id] = (answers as unknown as Record<string, string[]>)[id];
        }
        setRespuestas(mapa);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  // Misión 0 (Calibración) del Mundo de Estrategia: lee la sesión de Babel del
  // usuario y marca COMPLETADA si la Fase 0 ya fue aprobada.
  React.useEffect(() => {
    if (!uid) return;
    let vivo = true;
    getBabelSessionIfExists(uid)
      .then((session) => {
        if (!vivo || !session) return;
        const aprobada = (session.phases ?? []).some((p) => p.phase === 0 && p.approved);
        setFase0Aprobada(aprobada);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  const irAgendar = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/agendar`);
  }, [router, lang]);

  const irPlanAccion = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/babel/plan-accion`);
  }, [router, lang]);

  // Lee el Plan de Madurez y el Plan de Acción del usuario (localStorage) para
  // las misiones "Plan de Acción" de cada mundo (panel de actividades por
  // agente). El plan de acción se considera DEFINIDO cuando ya tiene acciones.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('babel_madurez_plan_v1');
      if (raw) {
        const p = JSON.parse(raw) as { completados?: Record<string, number>; compromisos?: Record<string, CompromisoLeido[]> };
        setPlanMadurez({ completados: p?.completados ?? {}, compromisos: p?.compromisos ?? {} });
      }
    } catch (err) {
      console.error('[worlds] plan de madurez', err);
    }
    try {
      const raw = window.localStorage.getItem('babel_plan_accion_v2');
      if (raw) {
        const p = JSON.parse(raw) as { acciones?: unknown[] };
        setPlanAccionDefinido(Array.isArray(p?.acciones) && p.acciones.length > 0);
      }
    } catch (err) {
      console.error('[worlds] plan de accion', err);
    }
  }, []);

  async function completarMision(n: number) {
    if (!yo || completando !== null) return;
    if (n > 1 && !yo.partida.includes(n - 1)) {
      notificar(en(I.misAnterior));
      return;
    }
    const auth = getFirebaseAuth();
    const usr = auth.currentUser;
    if (!usr) return;
    setCompletando(n);
    try {
      const token = await usr.getIdToken();
      const res = await fetch('/api/worlds', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'completar-mision', mision: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setYo((prev) =>
          prev
            ? {
                ...prev,
                puntos: data.puntos,
                partida: data.partida,
                tablero: data.tablero,
                nivel: nivelDesdePuntos(data.puntos),
              }
            : prev
        );
        festejar();
        const esFinalPartida = n === MISIONES_PART_LABELS.length;
        notificar(`+${data.pts} ${en(I.pts)} · ${esFinalPartida ? en(I.tableroGanado) : en(I.misionCompleta)}`);
        if (esFinalPartida) setVista('mapa');
      } else {
        notificar(String(data.error ?? en(I.errorProcesar)));
      }
    } catch (err) {
      notificar(en(I.errorProcesar));
    } finally {
      setCompletando(null);
    }
  }

  // Soporta /worlds?v=partida|tablero|estrategia para abrir directo una vista
  // (los enlaces del Inicio llevan este parámetro).
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

  const hechas = yo?.partida ?? [];
  const mundoVista = MUNDOS_PREMIUM_LABELS.find((m) => m.id === vista);
  const vistaPremium = mundoVista?.id;

  return (
    <div className="relative min-h-screen">
      <WorldsBg />
      <Confetti seed={confettiSeed} />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[99] w-max max-w-[92vw] -translate-x-1/2 rounded-full border border-teal-300/50 bg-[#0b2430]/90 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
          ⭐ {toast}
        </div>
      )}

      <InsigniaCelebracion
        insigniaId={insigniaNuevaId}
        lang={lang === 'en' ? 'en' : 'es'}
        onClose={() => {
          if (uid && insigniaNuevaId) {
            marcarInsigniasVistas(uid, [...insigniasVistas(uid), insigniaNuevaId]);
          }
          setInsigniaNuevaId(null);
        }}
      />

      {premiumLock && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setPremiumLock(false)}
        >
          <div
            className="world-glass world-grain max-w-sm rounded-2xl p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl">🔒</div>
            <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">
              {en(['Este mundo es Premium', 'This world is Premium'])}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {en([
                'Para entrar necesitas activar tu plan MBE Copilot. Puedes ver todos los Mundos Premium desde el mapa, pero solo se desbloquean con el plan activo.',
                'To enter you need to activate your MBE Copilot plan. You can see every Premium World from the map, but they only unlock with an active plan.',
              ])}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                className="rounded-full bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:bg-teal-700"
                onClick={irAPagar}
              >
                {en(['Ir a activar mi plan →', 'Activate my plan →'])}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setPremiumLock(false)}
              >
                {en(['Cerrar', 'Close'])}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="world-glass world-grain mb-6 flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
            <span className="text-2xl">🌍</span>{' '}
            {vistaPremium && mundoVista
              ? `${en(['Universo MBE - ', 'MBE Universe - '])}${lang === 'en' ? mundoVista.en : mundoVista.es}`
              : en([
                  vista === 'partida' ? 'Universo MBE - Mundo de partida'
                    : vista === 'tablero' ? 'Universo MBE - Tablero de retos'
                    : vista === 'estrategia' ? 'Universo MBE - Mundo de la Estrategia'
                    : 'Universo MBE - Mundos',
                  vista === 'partida' ? 'MBE Universe - Starting World'
                    : vista === 'tablero' ? 'MBE Universe - Challenges Board'
                    : vista === 'estrategia' ? 'MBE Universe - Strategy World'
                    : 'MBE Universe - Worlds',
                ])}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-100">
            <span className="rounded-full border border-teal-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              🪙 {yo ? yo.puntos.toLocaleString('en-US') : '—'} {en(I.pts)} · {en(I.chipPuntos)}
            </span>
            <span className="rounded-full border border-fuchsia-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              ⭐ {yo ? nivelLabelPuntos(yo.nivel, lang === 'es' ? 'es' : 'en') : '—'}
            </span>
            <span className="rounded-full border border-amber-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              🔥 {en(I.chipRacha)} {en(I.rachaDemo)}
            </span>
          </div>
        </div>

        <div id="worlds-saludo" className="world-glass mb-6 flex items-start gap-4 p-5">
          <AgentAvatar agente="Babel" pose="guiando" size={56} className="shrink-0" />
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-100">
            <p>
              <b className="text-teal-700 dark:text-teal-300">
                {en(I.saludo)}
                {yo?.nombre ? `, ${yo.nombre}!` : '!'} —
              </b>{' '}
              {en([
                'Completa todas las misiones para desbloquear tu Zona de Dinero y Equipo de trabajo Real. Todas las misiones puedes volverlas a hacer cuando consideres un cambio en tu empresa.',
                'Complete all missions to unlock your Money Zone and Real Working Team. You can redo every mission whenever you consider a change in your company.',
              ])}
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="world-glass p-10 text-center text-sm text-slate-600 dark:text-slate-300">{en(I.cargando)}</div>
        ) : !yo ? (
          <div className="world-glass p-10 text-center text-sm text-slate-600 dark:text-slate-300">{en(I.sinSesion)}</div>
        ) : (
          <>
            {vista !== 'mapa' && (
              <button
                className="world-glass world-glass-hover mb-5 px-4 py-2 text-sm font-extrabold text-slate-700 dark:text-slate-100"
                onClick={() => setVista('mapa')}
              >
                {en(I.volver)}
              </button>
            )}

            {vista === 'mapa' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button id="worlds-mundo-partida" className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => setVista('partida')}>
                    <span className="mb-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                      {en(I.gratisTag)}
                    </span>
                    <div className="text-4xl">🎓</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.mundoPartida)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.mundoPartidaDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.entrarPartida)} · {hechas.length}/{MISIONES_PART_LABELS.length}
                    </p>
                  </button>

                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={() => (yo.tablero ? setVista('tablero') : notificar(en(I.reqTablero)))}
                  >
                    <span
                      className={`mb-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        yo.tablero
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {yo.tablero ? en(I.tagUnlock) : en(I.tagLock)}
                    </span>
                    <div className="text-4xl">🎯</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.tableroCard)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.tableroDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{en(I.reqTablero)}</p>
                  </button>
                </div>

                <h2 className="mb-3 mt-8 text-lg font-extrabold text-slate-800 dark:text-white">
                  {en(I.premTitle)}{' '}
                  <span className="ml-1 inline-block rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-extrabold text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200">
                    {en(I.premKey)}
                  </span>
                </h2>

                <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <button className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => abrirMundo('estrategia')}>
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                      {esPremium ? 'Premium' : '🔒 Premium'}
                    </span>
                    <div className="text-4xl">🧭</div>
                    <div className="mt-3 flex items-center gap-2">
                      <AgentAvatar agente="Babel" size={28} className="ring-2 ring-fuchsia-300/60" onClick={() => undefined} />
                      <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Estrategia</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {en(I.host)} <b>Babel</b> · {SUBMUNDOS_ESTRATEGIA_LABELS.length} {en(I.submundos)} · {en(I.faseALista)}.
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                  </button>

                  {MUNDOS_PREMIUM_LABELS.map((m) => (
                    <button
                      key={m.id}
                      className="world-glass world-glass-hover world-grain p-5 text-left"
                      onClick={() => abrirMundo(m.id)}
                    >
                      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {esPremium ? 'Premium' : '🔒 Premium'}
                      </span>
                      <div className="text-4xl">{m.icon}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <AgentAvatar agente={m.agente} size={28} className="ring-2 ring-fuchsia-300/60" onClick={() => undefined} />
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">{lang === 'en' ? m.en : m.es}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {en(I.host)} <b>{m.agente}</b> · {en(I.misNum)} 1 · {en(I.misApoyo)} + {en(I.misPA)}.
                      </p>
                      <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {vista === 'partida' && (
              <>
                <div id="worlds-misiones" className="grid gap-4 sm:grid-cols-2">
                  {MISIONES_PART_LABELS.map((m) => {
                    const done = hechas.includes(m.n);
                    const bloqueada = m.n > 1 && !hechas.includes(m.n - 1);
                    const repetible = 'repetible' in m && m.repetible;
                    return (
                      <div key={m.n} className={`world-glass world-grain p-5 ${bloqueada && !done ? 'opacity-70' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              done
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                : repetible
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                  : 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200'
                            }`}
                          >
                            {done ? en(I.completadaTag) : repetible ? en(I.repetible) : `${en(I.misNum)} ${m.n}`}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                            +{m.pts} {en(I.pts)}
                          </span>
                        </div>
                        <div className="mt-3 text-4xl">{m.icon}</div>
                        <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
                          {en(I.misNum)} {m.n} · {lang === 'en' ? m.en : m.es}
                        </h3>
                        <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? m.enDesc : m.esDesc}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {'ruta' in m && (
                            <button
                              className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                              onClick={() => router.push(`/${lang === 'es' ? 'es' : 'en'}${m.ruta}`)}
                            >
                              {en(I.abrirHerramienta)}
                            </button>
                          )}
                          {!done && (
                            <button
                              className="rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                              disabled={bloqueada || completando !== null}
                              onClick={() => completarMision(m.n)}
                            >
                              {completando === m.n ? en(I.terminando) : 'final' in m && m.final ? en(I.cerrarMision) : en(I.jugarMision)}
                            </button>
                          )}
                          {done && <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">✓ {en(I.completadaTag)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {vista === 'tablero' && (
              <>
                {!yo.tablero ? (
                  <div className="world-glass world-grain p-8 text-center">
                    <div className="text-4xl">🔒</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.tableroLockedTitle)}</h3>
                    <p className="mx-auto mt-1 max-w-md text-xs text-slate-600 dark:text-slate-300">{en(I.tableroLockedDesc)}</p>
                    <button
                      className="mt-4 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-teal-500/30"
                      onClick={() => setVista('partida')}
                    >
                      {en(I.irCalibracion)}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="world-glass world-grain p-5">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">📅 {en(I.retoSemanal)}</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.retoSemanalDesc)}</p>
                        <div className="mt-3 flex gap-2">
                          {[
                            { d: 'Lun', ok: true },
                            { d: 'Mar', ok: true },
                            { d: 'Mié', ok: true },
                            { d: 'Jue', ok: false },
                            { d: 'Vie', ok: false },
                          ].map((x) => (
                            <div
                              key={x.d}
                              className={`flex h-14 w-11 flex-col items-center justify-center rounded-xl border text-[10px] font-extrabold ${
                                x.ok
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                  : 'border-slate-300 bg-white/40 text-slate-500 dark:border-slate-600 dark:bg-white/5'
                              }`}
                            >
                              <span className="text-sm">{x.ok ? '✓' : '◦'}</span>
                              {x.d}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="world-glass world-grain p-5">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{en(I.retoMensual)}</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.retoMensualDesc)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { icon: '🧭', a: 'Babel' },
                            { icon: '💰', a: 'Fisnando' },
                            { icon: '🤝', a: 'Karmetin' },
                            { icon: '⚖️', a: 'Normau' },
                            { icon: '⚙️', a: 'Atech' },
                          ].map((g) => (
                            <button
                              key={g.a}
                              className="rounded-lg border border-teal-400/50 bg-white/40 px-3 py-1.5 text-xs font-bold text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                              onClick={() => notificar(`${g.icon} ${g.a} ✓ +20`)}
                            >
                              {g.icon} {g.a} ✓ +20
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="world-glass world-grain mt-6 p-5">
                      <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">🗺️ {en(I.mapaProgreso)}</h2>
                      {respuestas ? (
                        <>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[620px] text-xs">
                              <thead>
                                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  <th className="pb-2">{en(I.tema)}</th>
                                  {[1, 2, 3, 4, 5, 6].map((n) => (
                                    <th key={n} className="pb-2 text-center">
                                      N{n}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {getMaturityDimensions(lang === 'en' ? 'en' : 'es').map((dim) => {
                                  const cells = respuestas[dim.id] ?? [];
                                  return (
                                    <tr key={dim.id} className="border-t border-slate-300/40 dark:border-slate-600/40">
                                      <td className="py-1.5 pr-2 font-bold text-slate-700 dark:text-slate-200">{dim.tema}</td>
                                      {cells.map((c, i) => (
                                        <td key={i} className="py-1.5 text-center">
                                          <span
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-extrabold ${
                                              c === 'yes'
                                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                                : c === 'partial'
                                                  ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                                  : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-200'
                                            }`}
                                          >
                                            {c === 'yes' ? '✓' : c === 'partial' ? '◦' : '✕'}
                                          </span>
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{en(I.leyendaMapa)}</p>
                        </>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{en(I.sinEvaluacion)}</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {vistaPremium && mundoVista && (
              <>
                <div className="world-glass world-glass-hover world-grain mb-5 flex items-start gap-4 p-5">
                  <AgentAvatar agente={mundoVista.agente} pose="guiando" size={56} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                      {mundoVista.icon} {lang === 'en' ? mundoVista.en : mundoVista.es}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {lang === 'en' ? mundoVista.enDesc : mundoVista.esDesc}
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.host)} <b>{mundoVista.agente}</b>
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={irAgendar}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {en(I.misNum)} 1
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {en(I.listoTag)}
                      </span>
                    </div>
                    <div className="mt-3 text-4xl">🤝</div>
                    <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
                      {lang === 'es' ? 'Misión 1. Apoyo de Especialistas' : 'Mission 1. Specialist Support'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misApoyoDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.agendarMentor)} →</p>
                  </button>

                  <MisionPlanAccion
                    agente={mundoVista.agente}
                    lang={lang === 'es' ? 'es' : 'en'}
                    planAccionDefinido={planAccionDefinido}
                    respuestas={respuestas}
                    plan={planMadurez}
                    onIrPlan={irPlanAccion}
                  />
                </div>
              </>
            )}

            {vista === 'estrategia' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBMUNDOS_ESTRATEGIA_LABELS.map((s) => {
                    // Misión 0 (Calibración) es la única con estado dinámico:
                    // COMPLETADA si la Fase 0 de Babel ya fue aprobada. Las
                    // demás misiones conservan su estado estático de worlds.ts.
                    const estadoEfectivo = s.n === 0 && fase0Aprobada ? 'completada' : s.estado;
                    return (
                      <div key={s.n} className="world-glass world-grain p-5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              estadoEfectivo === 'completada'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200'
                                : estadoEfectivo === 'listo'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                  : estadoEfectivo === 'wip'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {estadoEfectivo === 'completada'
                              ? en(I.completadaTag)
                              : estadoEfectivo === 'listo'
                                ? en(I.listoTag)
                                : estadoEfectivo === 'wip'
                                  ? en(I.enCursoTag)
                                  : en(I.pendienteTag)}
                          </span>
                          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-300">
                            +{s.pts} {en(I.pts)}
                          </span>
                        </div>
                        <div className="mt-3 text-4xl">{s.icon}</div>
                        <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                          {lang === 'en' ? `Mission ${s.n}. ${s.en}` : `Misión ${s.n}. ${s.es}`}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? s.enDesc : s.esDesc}</p>
                        <button
                          className="mt-3 rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                          onClick={() => router.push(s.ruta)}
                        >
                          {en(I.abrirSub)} →
                        </button>
                      </div>
                    );
                  })}
                <div key="apoyo-especialistas" className="world-glass world-grain p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {en(I.misNum)} 7
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {en(I.listoTag)}
                      </span>
                    </div>
                    <div className="mt-3 text-4xl">🤝</div>
                    <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                      {lang === 'es' ? 'Misión 7. Apoyo de Especialistas' : 'Mission 7. Specialist Support'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misApoyoDesc)}</p>
                    <button
                      className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                      onClick={irAgendar}
                    >
                      {en(I.agendarMentor)} →
                    </button>
                  </div>
                </div>

                <div id="estrategia-plan-accion" className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">📋 {en(I.misPA)}</h2>
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
                    <>
                      <p className="mt-3 text-xs font-extrabold text-slate-700 dark:text-slate-200">🌐 {en(I.panelTodos)}</p>
                      <div className="mt-2">
                        <PanelActividades agente="todos" lang={lang === 'es' ? 'es' : 'en'} respuestas={respuestas} plan={planMadurez} />
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{en(I.notaPanel)}</p>
                    </>
                  )}
                </div>

                <div className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">{en(I.tiendaEstrategia)}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.tiendaEstrategiaDesc)}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: '🎨', name: en(I.canvas) },
                      { icon: '🌐', name: en(I.foda) },
                      { icon: '📋', name: en(I.plantilla) },
                    ].map((h) => (
                      <button key={h.icon} className="world-glass world-glass-hover p-4 text-left" onClick={() => notificar(en(I.toolToast))}>
                        <div className="text-2xl">{h.icon}</div>
                        <p className="mt-1 text-xs font-extrabold text-slate-800 dark:text-white">{h.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <PageTour
        pageId="worlds-vista"
        lang={lang === 'es' ? 'es' : 'en'}
        steps={[
          {
            selector: '#worlds-saludo',
            title: lang === 'es' ? 'Mundo de Partida' : 'Starting World',
            description: lang === 'es'
              ? 'Babel te da la bienvenida. Aquí calibras tu empresa: completa las misiones en orden y desbloquearás el Tablero de Retos.'
              : 'Babel welcomes you. Calibrate your company here: complete the missions in order and you will unlock the Challenges Board.',
          },
          {
            selector: '#worlds-mundo-partida',
            title: lang === 'es' ? `Las ${MISIONES_PART_LABELS.length} misiones` : `The ${MISIONES_PART_LABELS.length} missions`,
            description: lang === 'es'
              ? 'Cada misión abre una herramienta real (Dashboard u Objetivos estratégicos). Puedes repetirlas cuando cambie tu empresa.'
              : 'Each mission opens a real tool (Dashboard or Strategic Objectives). You can redo them whenever your company changes.',
          },
        ]}
      />
    </div>
  );
}
'@
$worldsNuevo = @'
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { getMaturityDimensions, DIMENSION_IDS, type DimensionId } from '@/lib/maturity-dimensions';
import { nivelDesdePuntos } from '@/lib/club';
import { getBabelSessionIfExists } from '@/lib/babel-session';
import { MENTORES, PRACTICAS_POR_TEMA, type MentorAgente } from '@/lib/madurez-practicas';
import {
  MISIONES_PART_LABELS,
  SUBMUNDOS_ESTRATEGIA_LABELS,
  MUNDOS_PREMIUM_LABELS,
  nivelLabelPuntos,
} from '@/lib/worlds';
import { WorldsBg } from '@/components/worlds/worlds-bg';
import { InsigniaCelebracion } from '@/components/worlds/InsigniaCelebracion';
import { insigniasNuevas, insigniasVistas, marcarInsigniasVistas } from '@/lib/insignias';
import PageTour from '@/components/ui/executive/PageTour';
import type { TourStep } from '@/components/ui/executive/PageTour';

type Vista = 'mapa' | 'partida' | 'tablero' | 'estrategia' | 'dinero' | 'cliente' | 'normativo' | 'operativo' | 'cultura';
type VistaPremium = 'dinero' | 'cliente' | 'normativo' | 'operativo' | 'cultura';

const VISTAS_PREMIUM: VistaPremium[] = ['dinero', 'cliente', 'normativo', 'operativo', 'cultura'];

interface Progreso {
  nombre: string;
  puntos: number;
  nivel: string;
  partida: number[];
  tablero: boolean;
  premium?: boolean;
}

// Traducciones es/en (estilo de los builders existentes).
const I = {
  cargando: ['Cargando el mapa de mundos…', 'Loading the worlds map…'],
  sinSesion: ['Inicia sesión para comenzar tu partida.', 'Sign in to start your game.'],
  volver: ['← Volver al mapa', '← Back to the map'],
  chipPuntos: ['Puntos del Club', 'Club points'],
  chipRacha: ['Racha', 'Streak'],
  rachaDemo: ['4 días (Fase B real)', '4 days (real in Phase B)'],
  saludo: ['¡Hola', 'Hi'],
  progreso: ['Tu progreso', 'Your progress'],
  misionesDe: ['misiones', 'missions'],
  partidaEnCurso: ['Mundo de Partida en curso', 'Starting World in progress'],
  partidaCompleta: ['Mundo de Partida ✓ completo', 'Starting World ✓ complete'],
  tableroBloqueado: ['Tablero: bloqueado', 'Board: locked'],
  tableroListo: ['Tablero: desbloqueado ✓', 'Board: unlocked ✓'],
  estrategiaCurso: ['Estrategia (premium) en curso', 'Strategy (premium) in progress'],
  gratisTag: ['Gratis · Activo', 'Free · Active'],
  mundoPartida: ['Mundo de Partida', 'Starting World'],
  mundoPartidaDesc: [
    'Anfitrión Babel · 2 misiones para calibrar tu empresa antes de la aventura. Al completarlas desbloqueas el Tablero de Retos.',
    'Hosted by Babel · 2 missions to calibrate your company before the adventure. Completing them unlocks the Challenges Board.',
  ],
  entrarPartida: ['► Entrar al mundo', '► Enter the world'],
  tableroCard: ['Tablero de Retos', 'Challenges Board'],
  tableroDesc: [
    'Retos semanales y mensuales sobre tus 11 temas de madurez. Se desbloquea terminando el Mundo de Partida.',
    'Weekly and monthly challenges over your 11 maturity topics. Unlocks by finishing the Starting World.',
  ],
  reqTablero: ['🔒 Requisito: «Objetivos Estratégicos»', '🔒 Requirement: «Strategic Objectives»'],
  tagUnlock: ['Desbloqueado', 'Unlocked'],
  tagLock: ['Bloqueado', 'Locked'],
  premTitle: ['Mundos Premium', 'Premium Worlds'],
  premKey: ['🔑 plan_mensual', '🔑 monthly plan'],
  enConstruccion: ['En construcción', 'Under construction'],
  verMundo: ['► Ver mundo', '► View world'],
  host: ['Anfitrión', 'Host'],
  submundos: ['submundos', 'subworlds'],
  faseALista: ['Fase A lista', 'Phase A ready'],
  wipMundo: ['🔨 Este mundo estará disponible en la siguiente fase.', '🔨 This world will be available in the next phase.'],
  misAnterior: ['🔒 Completa primero la misión anterior.', '🔒 Complete the previous mission first.'],
  misNum: ['Misión', 'Mission'],
  repetible: ['Repetible (3m)', 'Repeatable (3m)'],
  completadaTag: ['Completada', 'Completed'],
  pts: ['pts', 'pts'],
  rutaReal: ['Ruta real', 'Real route'],
  abrirHerramienta: ['Abrir herramienta', 'Open tool'],
  jugarMision: ['🎖 Jugar misión', '🎖 Play mission'],
  cerrarMision: ['⭐ Completar misión final', '⭐ Complete final mission'],
  terminando: ['Completando…', 'Completing…'],
  tiendaPartida: ['🛠️ Tienda del Mundo de Partida', '🛠️ Starting World shop'],
  tiendaPartidaDesc: [
    'Herramientas gratuitas que abren su versión real dentro de la plataforma.',
    'Free tools that open their real version inside the platform.',
  ],
  checklist: ['Checklist de arranque', 'Startup checklist'],
  fondos: ['Fondos sin prisa', 'Grant finder'],
  mapaMadurez: ['Mapa de madurez', 'Maturity map'],
  listoTag: ['Listo', 'Ready'],
  enCursoTag: ['En curso', 'In progress'],
  pendienteTag: ['Pendiente', 'Pending'],
  abrirSub: ['Abrir misión', 'Open mission'],
  tiendaEstrategia: ['🛠️ Tienda del Mundo Estrategia', '🛒 Strategy World shop'],
  tiendaEstrategiaDesc: [
    'Herramientas para aplicar cada fase a tu empresa (demo en esta fase).',
    'Tools to apply each phase to your company (demo in this phase).',
  ],
  canvas: ['Canvas Propuesta de Valor', 'Value Proposition Canvas'],
  foda: ['Matriz FODA', 'SWOT Matrix'],
  plantilla: ['Plantilla Plan de Acción', 'Action Plan Template'],
  toolToast: ['Herramienta descargada (demo)', 'Tool downloaded (demo)'],
  retoSemanal: ['Reto semanal — Finanzas · Nivel 2 (Estándar)', 'Weekly challenge — Finance · Level 2 (Standard)'],
  retoSemanalDesc: [
    'Práctica: «Controla tu flujo de caja» · Anfitrión: Fisnando. Completa las 5 casillas para el cofre semanal (+20 pts). La agenda real llega en la siguiente fase.',
    'Practice: "Control your cash flow" · Host: Fisnando. Complete the 5 tiles for the weekly chest (+20 pts). Real scheduling arrives in the next phase.',
  ],
  retoMensual: ['Reto mensual — una práctica por agente', 'Monthly challenge — one practice per agent'],
  retoMensualDesc: [
    'Practica con cada agente según tu Plan de Madurez (demo).',
    'Practice with each agent from your Maturity Plan (demo).',
  ],
  mapaProgreso: ['Mapa de progreso · 11 temas × 6 niveles', 'Progress map · 11 topics × 6 levels'],
  tema: ['Tema', 'Topic'],
  leyendaMapa: [
    'Verde = dominado · Ámbar = en curso · Rojo = pendiente. Los retos semanales/mensuales reales llegan en la Fase B.',
    'Green = mastered · Amber = in progress · Red = pending. Real weekly/monthly challenges arrive in Phase B.',
  ],
  sinEvaluacion: [
    'Aún no tienes evaluación. Llena la Evaluación de Madurez para poblar tu mapa.',
    'No assessment yet. Complete the Maturity Assessment to fill your map.',
  ],
  tableroLockedTitle: ['Tablero bloqueado', 'Board locked'],
  tableroLockedDesc: [
    'Completa el Mundo de Partida para desbloquear el Tablero de Retos.',
    'Complete the Starting World to unlock the Challenges Board.',
  ],
  irCalibracion: ['→ Ir al Mundo de Partida', '→ Go to the Starting World'],
  misionCompleta: ['¡Misión completada!', 'Mission complete!'],
  tableroGanado: ['¡Tablero de Retos desbloqueado!', 'Challenges Board unlocked!'],
  errorProcesar: ['No se pudo procesar la acción.', 'Could not process the action.'],
  temaAria: ['Cambiar tema claro/oscuro', 'Toggle light/dark theme'],
  misApoyo: ['Apoyo de Especialistas', 'Specialist Support'],
  misApoyoDesc: [
    'Agenda una sesión con un mentor experto (Babel, Fisnando, Karmetin, Normau o Atech) para desatorar tu misión y avanzar con acompañamiento.',
    'Book a session with an expert mentor (Babel, Fisnando, Karmetin, Normau or Atech) to unblock your mission and move forward with support.',
  ],
  agendarMentor: ['Agendar con un mentor', 'Book a mentor session'],
  misPA: ['Misión de Plan de Acción', 'Action Plan Mission'],
  misPADesc: [
    'Se desbloquea cuando defines tu Plan de Acción. Conecta los temas de cada agente con las buenas prácticas a trabajar, mes a mes.',
    "Unlocks once you define your Action Plan. It connects each agent's topics with the practices to work on, month by month.",
  ],
  bloqueadaTag: ['Bloqueada', 'Locked'],
  paLockDesc: [
    'Define primero tu Plan de Acción (Plan de Acción Socioambiental de la Reflexión Estratégica) para desbloquear esta misión y ver tus actividades por agente.',
    'Define your Action Plan first (Socioenvironmental Action Plan of the Strategic Reflection) to unlock this mission and see your activities per agent.',
  ],
  crearMiPA: ['Definir mi Plan de Acción', 'Define my Action Plan'],
  verPA: ['Abrir el Plan de Acción', 'Open the Action Plan'],
  panelAgente: ['Agente', 'Agent'],
  panelTemas: ['Temas asignados a', 'Topics assigned to'],
  panelTodos: ['Actividades por agente', 'Activities per agent'],
  temaCol: ['Tema', 'Topic'],
  practicaCol: ['Siguiente práctica', 'Next practice'],
  nivelCol: ['Nivel', 'Level'],
  mesCol: ['Este mes', 'This month'],
  dominadoTag: ['Dominado', 'Mastered'],
  sinPend: ['Sin prácticas pendientes', 'No pending practices'],
  notaPanel: [
    'Las actividades parten de tu Evaluación de Madurez (el nivel más bajo no completado de cada tema) y del Plan de Madurez del mes actual.',
    "Activities come from your Maturity Assessment (the lowest incomplete level of each topic) and this month's Maturity Plan.",
  ],
} as const;

type Params = readonly [string, string];
const t2 = (lang: 'es' | 'en') => (p: Params) => (lang === 'en' ? p[1] : p[0]);

// ── Misiones "Plan de Acción" de los mundos: panel de actividades por agente ─
// Los temas asignados a cada agente salen del catálogo de prácticas de madurez
// (PRACTICAS_POR_TEMA: mentor por tema) y las actividades del nivel más bajo
// no completado de la evaluación + el Plan de Madurez del mes actual.

const NIVELES_ACT: Record<'es' | 'en', string[]> = {
  es: ['Ejecución', 'Estándar', 'Control', 'Optimización', 'Excelencia', 'Influencer'],
  en: ['Execution', 'Standard', 'Control', 'Optimization', 'Excellence', 'Influencer'],
};

interface CompromisoLeido {
  themeId?: string;
  estatus?: 'pendiente' | 'en_progreso' | 'completada';
}

interface PlanMadurezLeido {
  completados: Record<string, number>;
  compromisos: Record<string, CompromisoLeido[]>;
}

interface Actividad {
  themeId: DimensionId;
  terminado: boolean;
  practica: string | null;
  nivel: number;
  comp: CompromisoLeido | undefined;
}

function monthKeyOf(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function baseNivelDe(respuestas: Record<string, string[]> | null, themeId: DimensionId): number {
  const arr = respuestas?.[themeId];
  if (!arr) return 0;
  for (let i = 0; i < 6; i++) {
    if (arr[i] !== 'yes') return i;
  }
  return 6;
}

function PanelActividades({
  agente,
  lang,
  respuestas,
  plan,
}: {
  agente: MentorAgente | 'todos';
  lang: 'es' | 'en';
  respuestas: Record<string, string[]> | null;
  plan: PlanMadurezLeido;
}) {
  const en = t2(lang);
  const dims = React.useMemo(() => getMaturityDimensions(lang), [lang]);
  const temaDe = React.useMemo(() => {
    const m: Record<string, string> = {};
    dims.forEach((d) => {
      m[d.id] = d.tema;
    });
    return m;
  }, [dims]);
  const mesKey = monthKeyOf(new Date());
  const agentes: MentorAgente[] = agente === 'todos' ? MENTORES : [agente];

  const filas = React.useMemo(() => {
    const comps = plan.compromisos[mesKey] ?? [];
    return agentes.map((a) => {
      const fs: Actividad[] = [];
      for (const id of DIMENSION_IDS) {
        const prs = PRACTICAS_POR_TEMA[id];
        if (!prs.some((p) => p.mentor === a)) continue;
        const n = Math.min(6, baseNivelDe(respuestas, id) + (plan.completados[id] ?? 0));
        fs.push({
          themeId: id,
          terminado: n >= 6,
          practica: n < 6 ? prs[n].practica : null,
          nivel: n < 6 ? n : -1,
          comp: comps.find((c) => c.themeId === id),
        });
      }
      return { agente: a, filas: fs };
    });
  }, [agentes, plan, respuestas, mesKey]);

  const colSpan = agente === 'todos' ? 5 : 4;

  const chip = (c: CompromisoLeido | undefined) => {
    if (!c) {
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }
    const cls =
      c.estatus === 'completada'
        ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
        : c.estatus === 'en_progreso'
          ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200'
          : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
    const lbl =
      c.estatus === 'completada' ? en(I.completadaTag) : c.estatus === 'en_progreso' ? en(I.enCursoTag) : en(I.pendienteTag);
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{lbl}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {agente === 'todos' && <th className="pb-2">{en(I.panelAgente)}</th>}
            <th className="pb-2">{en(I.temaCol)}</th>
            <th className="pb-2">{en(I.practicaCol)}</th>
            <th className="pb-2 text-center">{en(I.nivelCol)}</th>
            <th className="pb-2">{en(I.mesCol)}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ agente: a, filas: fs }) => (
            <React.Fragment key={a}>
              {agente === 'todos' && (
                <tr className="border-t border-slate-300/40 dark:border-slate-600/40">
                  <td colSpan={colSpan} className="py-1.5 pt-2.5">
                    <span className="flex items-center gap-2 font-extrabold text-slate-700 dark:text-slate-200">
                      <AgentAvatar agente={a} size={20} className="shrink-0" onClick={() => undefined} />
                      {a}
                    </span>
                  </td>
                </tr>
              )}
              {fs.length === 0 && (
                <tr className="border-t border-slate-300/40 dark:border-slate-600/40">
                  <td colSpan={colSpan} className="py-1.5 text-slate-500 dark:text-slate-400">
                    {en(I.sinPend)}
                  </td>
                </tr>
              )}
              {fs.map((f) => (
                <tr key={f.themeId} className="border-t border-slate-300/40 dark:border-slate-600/40">
                  {agente === 'todos' && <td className="py-1.5 pr-2" />}
                  <td className="py-1.5 pr-2 font-bold text-slate-700 dark:text-slate-200">{temaDe[f.themeId] ?? f.themeId}</td>
                  <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-300">
                    {f.terminado ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">✓ {en(I.dominadoTag)}</span>
                    ) : (
                      f.practica
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    {f.terminado ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">6/6</span>
                    ) : (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-extrabold text-teal-700 dark:bg-teal-900 dark:text-teal-200">
                        {NIVELES_ACT[lang][f.nivel]}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pl-2">{chip(f.comp)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
        <div className="mt-3 rounded-xl border border-slate-300/50 bg-white/40 p-4 dark:bg-white/5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🔒 {en(I.paLockDesc)}</p>
          <button
            className="mt-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            onClick={onIrPlan}
          >
            {en(I.crearMiPA)}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-extrabold text-slate-700 dark:text-slate-200">
            {en(I.panelTemas)}{' '}
            <b className="text-teal-700 dark:text-teal-300">{agente}</b>
          </p>
          <div className="mt-2">
            <PanelActividades agente={agente} lang={lang} respuestas={respuestas} plan={plan} />
          </div>
          <button
            className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            onClick={onIrPlan}
          >
            {en(I.verPA)} →
          </button>
        </>
      )}
    </div>
  );
}

function Confetti({ seed }: { seed: number }) {
  const hosts = React.useMemo(() => {
    if (seed <= 0) return [];
    const colors = ['#0d9488', '#f59e0b', '#f472b6', '#a78bfa', '#34d399', '#38bdf8'];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      dur: 1.4 + Math.random() * 1.9,
      delay: Math.random() * 0.6,
    }));
  }, [seed]);
  if (seed <= 0) return null;
  return (
    <div className="world-confetti-host">
      {hosts.map((h) => (
        <i
          key={`${seed}-${h.id}`}
          style={{ left: `${h.left}vw`, background: h.color, animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}
        />
      ))}
    </div>
  );
}

export function WorldsBuilder({ vistaInicial }: { vistaInicial?: Vista }) {
  const router = useRouter();
  const { lang, setLang } = useDisplayLang();
  const T = t2(lang === 'es' ? 'es' : 'en');
  const en = (p: Params) => T(p);

  const [yo, setYo] = React.useState<Progreso | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [vista, setVista] = React.useState<Vista>(vistaInicial ?? 'mapa');
  const [toast, setToast] = React.useState<string | null>(null);
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const [completando, setCompletando] = React.useState<number | null>(null);
  const [uid, setUid] = React.useState<string | null>(null);
  const [respuestas, setRespuestas] = React.useState<Record<string, string[]> | null>(null);
  // Misión 0 del Mundo de Estrategia (Calibración): se marca COMPLETADA cuando
  // la Fase 0 de Babel ya fue aprobada por el usuario en su sesión.
  const [fase0Aprobada, setFase0Aprobada] = React.useState(false);
  const [planMadurez, setPlanMadurez] = React.useState<PlanMadurezLeido>({ completados: {}, compromisos: {} });
  const [planAccionDefinido, setPlanAccionDefinido] = React.useState(false);
  const [precioPlan, setPrecioPlan] = React.useState<number | null>(null);
  const [pagando, setPagando] = React.useState(false);

  const notificar = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2900);
  }, []);

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
  const festejar = React.useCallback(() => {
    const seed = Date.now();
    setConfettiSeed(seed);
    window.setTimeout(() => setConfettiSeed(0), 4300);
  }, []);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr: User | null) => {
      if (!usr) {
        setCargando(false);
        return;
      }
      setUid(usr.uid);
      try {
        const token = await usr.getIdToken();
        const res = await fetch('/api/worlds', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = (await res.json()) as { yo: Progreso };
          setYo(data.yo);
          const nuevas = insigniasNuevas(usr.uid, {
            partida: data.yo.partida,
            tablero: data.yo.tablero,
            premium: data.yo.premium,
          });
          if (nuevas.length > 0) {
            setInsigniaNuevaId(nuevas[0]);
            festejar();
          }
        }
        try {
          const res2 = await fetch('/api/pagos/precio-plan', { headers: { Authorization: `Bearer ${token}` } });
          if (res2.ok) {
            const data2 = await res2.json();
            if (typeof data2?.precio === 'number') setPrecioPlan(data2.precio);
          }
        } catch (err) {
          console.error('[worlds] precio-plan', err);
        }
      } catch (err) {
        console.error('[worlds] carga', err);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (!uid) return;
    let vivo = true;
    getLatestAssessmentAnswers(uid)
      .then((answers) => {
        if (!vivo || !answers) return;
        const mapa: Record<string, string[]> = {};
        for (const id of Object.keys(answers)) {
          mapa[id] = (answers as unknown as Record<string, string[]>)[id];
        }
        setRespuestas(mapa);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  // Misión 0 (Calibración) del Mundo de Estrategia: lee la sesión de Babel del
  // usuario y marca COMPLETADA si la Fase 0 ya fue aprobada.
  React.useEffect(() => {
    if (!uid) return;
    let vivo = true;
    getBabelSessionIfExists(uid)
      .then((session) => {
        if (!vivo || !session) return;
        const aprobada = (session.phases ?? []).some((p) => p.phase === 0 && p.approved);
        setFase0Aprobada(aprobada);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  const irAgendar = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/agendar`);
  }, [router, lang]);

  const irPlanAccion = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/babel/plan-accion`);
  }, [router, lang]);

  // Lee el Plan de Madurez y el Plan de Acción del usuario (localStorage) para
  // las misiones "Plan de Acción" de cada mundo (panel de actividades por
  // agente). El plan de acción se considera DEFINIDO cuando ya tiene acciones.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('babel_madurez_plan_v1');
      if (raw) {
        const p = JSON.parse(raw) as { completados?: Record<string, number>; compromisos?: Record<string, CompromisoLeido[]> };
        setPlanMadurez({ completados: p?.completados ?? {}, compromisos: p?.compromisos ?? {} });
      }
    } catch (err) {
      console.error('[worlds] plan de madurez', err);
    }
    try {
      const raw = window.localStorage.getItem('babel_plan_accion_v2');
      if (raw) {
        const p = JSON.parse(raw) as { acciones?: unknown[] };
        setPlanAccionDefinido(Array.isArray(p?.acciones) && p.acciones.length > 0);
      }
    } catch (err) {
      console.error('[worlds] plan de accion', err);
    }
  }, []);

  async function completarMision(n: number) {
    if (!yo || completando !== null) return;
    if (n > 1 && !yo.partida.includes(n - 1)) {
      notificar(en(I.misAnterior));
      return;
    }
    const auth = getFirebaseAuth();
    const usr = auth.currentUser;
    if (!usr) return;
    setCompletando(n);
    try {
      const token = await usr.getIdToken();
      const res = await fetch('/api/worlds', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'completar-mision', mision: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setYo((prev) =>
          prev
            ? {
                ...prev,
                puntos: data.puntos,
                partida: data.partida,
                tablero: data.tablero,
                nivel: nivelDesdePuntos(data.puntos),
              }
            : prev
        );
        festejar();
        const esFinalPartida = n === MISIONES_PART_LABELS.length;
        notificar(`+${data.pts} ${en(I.pts)} · ${esFinalPartida ? en(I.tableroGanado) : en(I.misionCompleta)}`);
        if (esFinalPartida) setVista('mapa');
      } else {
        notificar(String(data.error ?? en(I.errorProcesar)));
      }
    } catch (err) {
      notificar(en(I.errorProcesar));
    } finally {
      setCompletando(null);
    }
  }

  async function pagarPlanMensual() {
    if (pagando) return;
    const auth = getFirebaseAuth();
    const usr = auth.currentUser;
    if (!usr) return;
    setPagando(true);
    try {
      const token = await usr.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: lang, returnPath: '/worlds' }),
      });
      const data = await res.json();
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('[worlds] crear-preferencia sin checkoutUrl', data);
        setPagando(false);
      }
    } catch (err) {
      console.error('[worlds] error al iniciar pago', err);
      setPagando(false);
    }
  }

  // Soporta /worlds?v=partida|tablero|estrategia para abrir directo una vista
  // (los enlaces del Inicio llevan este parámetro).
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

  const hechas = yo?.partida ?? [];
  const mundoVista = MUNDOS_PREMIUM_LABELS.find((m) => m.id === vista);
  const vistaPremium = mundoVista?.id;

  return (
    <div className="relative min-h-screen">
      <WorldsBg />
      <Confetti seed={confettiSeed} />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[99] w-max max-w-[92vw] -translate-x-1/2 rounded-full border border-teal-300/50 bg-[#0b2430]/90 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
          ⭐ {toast}
        </div>
      )}

      <InsigniaCelebracion
        insigniaId={insigniaNuevaId}
        lang={lang === 'en' ? 'en' : 'es'}
        onClose={() => {
          if (uid && insigniaNuevaId) {
            marcarInsigniasVistas(uid, [...insigniasVistas(uid), insigniaNuevaId]);
          }
          setInsigniaNuevaId(null);
        }}
      />

      {premiumLock && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setPremiumLock(false)}
        >
          <div
            className="world-glass world-grain max-w-sm rounded-2xl p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl">🔒</div>
            <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">
              {en(['Este mundo es Premium', 'This world is Premium'])}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {en([
                'Para interactuar en las misiones de este mundo necesitas contratar el plan mensual.',
                'To interact with the missions in this world you need to subscribe to the monthly plan.',
              ])}
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                className="rounded-full bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:bg-teal-700 disabled:opacity-50"
                onClick={pagarPlanMensual}
                disabled={pagando}
              >
                {pagando
                  ? en(['Procesando...', 'Processing...'])
                  : en([`Pagar plan mensual por solo $${precioPlan ?? 99}`, `Pay monthly plan for only $${precioPlan ?? 99}`])}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setPremiumLock(false)}
              >
                {en(['Cerrar', 'Close'])}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="world-glass world-grain mb-6 flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
            <span className="text-2xl">🌍</span>{' '}
            {vistaPremium && mundoVista
              ? `${en(['Universo MBE - ', 'MBE Universe - '])}${lang === 'en' ? mundoVista.en : mundoVista.es}`
              : en([
                  vista === 'partida' ? 'Universo MBE - Mundo de partida'
                    : vista === 'tablero' ? 'Universo MBE - Tablero de retos'
                    : vista === 'estrategia' ? 'Universo MBE - Mundo de la Estrategia'
                    : 'Universo MBE - Mundos',
                  vista === 'partida' ? 'MBE Universe - Starting World'
                    : vista === 'tablero' ? 'MBE Universe - Challenges Board'
                    : vista === 'estrategia' ? 'MBE Universe - Strategy World'
                    : 'MBE Universe - Worlds',
                ])}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-100">
            <span className="rounded-full border border-teal-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              🪙 {yo ? yo.puntos.toLocaleString('en-US') : '—'} {en(I.pts)} · {en(I.chipPuntos)}
            </span>
            <span className="rounded-full border border-fuchsia-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              ⭐ {yo ? nivelLabelPuntos(yo.nivel, lang === 'es' ? 'es' : 'en') : '—'}
            </span>
            <span className="rounded-full border border-amber-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              🔥 {en(I.chipRacha)} {en(I.rachaDemo)}
            </span>
          </div>
        </div>

        <div id="worlds-saludo" className="world-glass mb-6 flex items-start gap-4 p-5">
          <AgentAvatar agente="Babel" pose="guiando" size={56} className="shrink-0" />
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-100">
            <p>
              <b className="text-teal-700 dark:text-teal-300">
                {en(I.saludo)}
                {yo?.nombre ? `, ${yo.nombre}!` : '!'} —
              </b>{' '}
              {en([
                'Completa todas las misiones para desbloquear tu Zona de Dinero y Equipo de trabajo Real. Todas las misiones puedes volverlas a hacer cuando consideres un cambio en tu empresa.',
                'Complete all missions to unlock your Money Zone and Real Working Team. You can redo every mission whenever you consider a change in your company.',
              ])}
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="world-glass p-10 text-center text-sm text-slate-600 dark:text-slate-300">{en(I.cargando)}</div>
        ) : !yo ? (
          <div className="world-glass p-10 text-center text-sm text-slate-600 dark:text-slate-300">{en(I.sinSesion)}</div>
        ) : (
          <>
            {vista !== 'mapa' && (
              <button
                className="world-glass world-glass-hover mb-5 px-4 py-2 text-sm font-extrabold text-slate-700 dark:text-slate-100"
                onClick={() => setVista('mapa')}
              >
                {en(I.volver)}
              </button>
            )}

            {vista === 'mapa' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button id="worlds-mundo-partida" className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => setVista('partida')}>
                    <span className="mb-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                      {en(I.gratisTag)}
                    </span>
                    <div className="text-4xl">🎓</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.mundoPartida)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.mundoPartidaDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.entrarPartida)} · {hechas.length}/{MISIONES_PART_LABELS.length}
                    </p>
                  </button>

                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={() => (yo.tablero ? setVista('tablero') : notificar(en(I.reqTablero)))}
                  >
                    <span
                      className={`mb-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        yo.tablero
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {yo.tablero ? en(I.tagUnlock) : en(I.tagLock)}
                    </span>
                    <div className="text-4xl">🎯</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.tableroCard)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.tableroDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{en(I.reqTablero)}</p>
                  </button>
                </div>

                <h2 className="mb-3 mt-8 text-lg font-extrabold text-slate-800 dark:text-white">
                  {en(I.premTitle)}{' '}
                  <span className="ml-1 inline-block rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-extrabold text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200">
                    {en(I.premKey)}
                  </span>
                </h2>

                <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <button className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => abrirMundo('estrategia')}>
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                      {esPremium ? 'Premium' : '🔒 Premium'}
                    </span>
                    <div className="text-4xl">🧭</div>
                    <div className="mt-3 flex items-center gap-2">
                      <AgentAvatar agente="Babel" size={28} className="ring-2 ring-fuchsia-300/60" onClick={() => undefined} />
                      <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Estrategia</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {en(I.host)} <b>Babel</b> · {SUBMUNDOS_ESTRATEGIA_LABELS.length} {en(I.submundos)} · {en(I.faseALista)}.
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                  </button>

                  {MUNDOS_PREMIUM_LABELS.map((m) => (
                    <button
                      key={m.id}
                      className="world-glass world-glass-hover world-grain p-5 text-left"
                      onClick={() => abrirMundo(m.id)}
                    >
                      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {esPremium ? 'Premium' : '🔒 Premium'}
                      </span>
                      <div className="text-4xl">{m.icon}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <AgentAvatar agente={m.agente} size={28} className="ring-2 ring-fuchsia-300/60" onClick={() => undefined} />
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">{lang === 'en' ? m.en : m.es}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {en(I.host)} <b>{m.agente}</b> · {en(I.misNum)} 1 · {en(I.misApoyo)} + {en(I.misPA)}.
                      </p>
                      <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {vista === 'partida' && (
              <>
                <div id="worlds-misiones" className="grid gap-4 sm:grid-cols-2">
                  {MISIONES_PART_LABELS.map((m) => {
                    const done = hechas.includes(m.n);
                    const bloqueada = m.n > 1 && !hechas.includes(m.n - 1);
                    const repetible = 'repetible' in m && m.repetible;
                    return (
                      <div key={m.n} className={`world-glass world-grain p-5 ${bloqueada && !done ? 'opacity-70' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              done
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                : repetible
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                  : 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200'
                            }`}
                          >
                            {done ? en(I.completadaTag) : repetible ? en(I.repetible) : `${en(I.misNum)} ${m.n}`}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                            +{m.pts} {en(I.pts)}
                          </span>
                        </div>
                        <div className="mt-3 text-4xl">{m.icon}</div>
                        <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
                          {en(I.misNum)} {m.n} · {lang === 'en' ? m.en : m.es}
                        </h3>
                        <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? m.enDesc : m.esDesc}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {'ruta' in m && (
                            <button
                              className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                              onClick={() => router.push(`/${lang === 'es' ? 'es' : 'en'}${m.ruta}`)}
                            >
                              {en(I.abrirHerramienta)}
                            </button>
                          )}
                          {!done && (
                            <button
                              className="rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                              disabled={bloqueada || completando !== null}
                              onClick={() => completarMision(m.n)}
                            >
                              {completando === m.n ? en(I.terminando) : 'final' in m && m.final ? en(I.cerrarMision) : en(I.jugarMision)}
                            </button>
                          )}
                          {done && <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">✓ {en(I.completadaTag)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {vista === 'tablero' && (
              <>
                {!yo.tablero ? (
                  <div className="world-glass world-grain p-8 text-center">
                    <div className="text-4xl">🔒</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.tableroLockedTitle)}</h3>
                    <p className="mx-auto mt-1 max-w-md text-xs text-slate-600 dark:text-slate-300">{en(I.tableroLockedDesc)}</p>
                    <button
                      className="mt-4 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-teal-500/30"
                      onClick={() => setVista('partida')}
                    >
                      {en(I.irCalibracion)}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="world-glass world-grain p-5">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">📅 {en(I.retoSemanal)}</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.retoSemanalDesc)}</p>
                        <div className="mt-3 flex gap-2">
                          {[
                            { d: 'Lun', ok: true },
                            { d: 'Mar', ok: true },
                            { d: 'Mié', ok: true },
                            { d: 'Jue', ok: false },
                            { d: 'Vie', ok: false },
                          ].map((x) => (
                            <div
                              key={x.d}
                              className={`flex h-14 w-11 flex-col items-center justify-center rounded-xl border text-[10px] font-extrabold ${
                                x.ok
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                  : 'border-slate-300 bg-white/40 text-slate-500 dark:border-slate-600 dark:bg-white/5'
                              }`}
                            >
                              <span className="text-sm">{x.ok ? '✓' : '◦'}</span>
                              {x.d}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="world-glass world-grain p-5">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{en(I.retoMensual)}</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.retoMensualDesc)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { icon: '🧭', a: 'Babel' },
                            { icon: '💰', a: 'Fisnando' },
                            { icon: '🤝', a: 'Karmetin' },
                            { icon: '⚖️', a: 'Normau' },
                            { icon: '⚙️', a: 'Atech' },
                          ].map((g) => (
                            <button
                              key={g.a}
                              className="rounded-lg border border-teal-400/50 bg-white/40 px-3 py-1.5 text-xs font-bold text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                              onClick={() => notificar(`${g.icon} ${g.a} ✓ +20`)}
                            >
                              {g.icon} {g.a} ✓ +20
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="world-glass world-grain mt-6 p-5">
                      <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">🗺️ {en(I.mapaProgreso)}</h2>
                      {respuestas ? (
                        <>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[620px] text-xs">
                              <thead>
                                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  <th className="pb-2">{en(I.tema)}</th>
                                  {[1, 2, 3, 4, 5, 6].map((n) => (
                                    <th key={n} className="pb-2 text-center">
                                      N{n}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {getMaturityDimensions(lang === 'en' ? 'en' : 'es').map((dim) => {
                                  const cells = respuestas[dim.id] ?? [];
                                  return (
                                    <tr key={dim.id} className="border-t border-slate-300/40 dark:border-slate-600/40">
                                      <td className="py-1.5 pr-2 font-bold text-slate-700 dark:text-slate-200">{dim.tema}</td>
                                      {cells.map((c, i) => (
                                        <td key={i} className="py-1.5 text-center">
                                          <span
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-extrabold ${
                                              c === 'yes'
                                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                                : c === 'partial'
                                                  ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                                  : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-200'
                                            }`}
                                          >
                                            {c === 'yes' ? '✓' : c === 'partial' ? '◦' : '✕'}
                                          </span>
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{en(I.leyendaMapa)}</p>
                        </>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{en(I.sinEvaluacion)}</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {vistaPremium && mundoVista && (
              <>
                <div className="world-glass world-glass-hover world-grain mb-5 flex items-start gap-4 p-5">
                  <AgentAvatar agente={mundoVista.agente} pose="guiando" size={56} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                      {mundoVista.icon} {lang === 'en' ? mundoVista.en : mundoVista.es}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {lang === 'en' ? mundoVista.enDesc : mundoVista.esDesc}
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.host)} <b>{mundoVista.agente}</b>
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={irAgendar}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {en(I.misNum)} 1
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {en(I.listoTag)}
                      </span>
                    </div>
                    <div className="mt-3 text-4xl">🤝</div>
                    <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
                      {lang === 'es' ? 'Misión 1. Apoyo de Especialistas' : 'Mission 1. Specialist Support'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misApoyoDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.agendarMentor)} →</p>
                  </button>

                  <MisionPlanAccion
                    agente={mundoVista.agente}
                    lang={lang === 'es' ? 'es' : 'en'}
                    planAccionDefinido={planAccionDefinido}
                    respuestas={respuestas}
                    plan={planMadurez}
                    onIrPlan={irPlanAccion}
                  />
                </div>
              </>
            )}

            {vista === 'estrategia' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBMUNDOS_ESTRATEGIA_LABELS.map((s) => {
                    // Misión 0 (Calibración) es la única con estado dinámico:
                    // COMPLETADA si la Fase 0 de Babel ya fue aprobada. Las
                    // demás misiones conservan su estado estático de worlds.ts.
                    const estadoEfectivo = s.n === 0 && fase0Aprobada ? 'completada' : s.estado;
                    return (
                      <div key={s.n} className="world-glass world-grain p-5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              estadoEfectivo === 'completada'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200'
                                : estadoEfectivo === 'listo'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                  : estadoEfectivo === 'wip'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {estadoEfectivo === 'completada'
                              ? en(I.completadaTag)
                              : estadoEfectivo === 'listo'
                                ? en(I.listoTag)
                                : estadoEfectivo === 'wip'
                                  ? en(I.enCursoTag)
                                  : en(I.pendienteTag)}
                          </span>
                          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-300">
                            +{s.pts} {en(I.pts)}
                          </span>
                        </div>
                        <div className="mt-3 text-4xl">{s.icon}</div>
                        <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                          {lang === 'en' ? `Mission ${s.n}. ${s.en}` : `Misión ${s.n}. ${s.es}`}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? s.enDesc : s.esDesc}</p>
                        <button
                          className="mt-3 rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                          onClick={() => router.push(s.ruta)}
                        >
                          {en(I.abrirSub)} →
                        </button>
                      </div>
                    );
                  })}
                <div key="apoyo-especialistas" className="world-glass world-grain p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {en(I.misNum)} 7
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {en(I.listoTag)}
                      </span>
                    </div>
                    <div className="mt-3 text-4xl">🤝</div>
                    <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                      {lang === 'es' ? 'Misión 7. Apoyo de Especialistas' : 'Mission 7. Specialist Support'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misApoyoDesc)}</p>
                    <button
                      className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                      onClick={irAgendar}
                    >
                      {en(I.agendarMentor)} →
                    </button>
                  </div>
                </div>

                <div id="estrategia-plan-accion" className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">📋 {en(I.misPA)}</h2>
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
                    <>
                      <p className="mt-3 text-xs font-extrabold text-slate-700 dark:text-slate-200">🌐 {en(I.panelTodos)}</p>
                      <div className="mt-2">
                        <PanelActividades agente="todos" lang={lang === 'es' ? 'es' : 'en'} respuestas={respuestas} plan={planMadurez} />
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{en(I.notaPanel)}</p>
                    </>
                  )}
                </div>

                <div className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">{en(I.tiendaEstrategia)}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.tiendaEstrategiaDesc)}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: '🎨', name: en(I.canvas) },
                      { icon: '🌐', name: en(I.foda) },
                      { icon: '📋', name: en(I.plantilla) },
                    ].map((h) => (
                      <button key={h.icon} className="world-glass world-glass-hover p-4 text-left" onClick={() => notificar(en(I.toolToast))}>
                        <div className="text-2xl">{h.icon}</div>
                        <p className="mt-1 text-xs font-extrabold text-slate-800 dark:text-white">{h.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <PageTour
        pageId="worlds-vista"
        lang={lang === 'es' ? 'es' : 'en'}
        steps={[
          {
            selector: '#worlds-saludo',
            title: lang === 'es' ? 'Mundo de Partida' : 'Starting World',
            description: lang === 'es'
              ? 'Babel te da la bienvenida. Aquí calibras tu empresa: completa las misiones en orden y desbloquearás el Tablero de Retos.'
              : 'Babel welcomes you. Calibrate your company here: complete the missions in order and you will unlock the Challenges Board.',
          },
          {
            selector: '#worlds-mundo-partida',
            title: lang === 'es' ? `Las ${MISIONES_PART_LABELS.length} misiones` : `The ${MISIONES_PART_LABELS.length} missions`,
            description: lang === 'es'
              ? 'Cada misión abre una herramienta real (Dashboard u Objetivos estratégicos). Puedes repetirlas cuando cambie tu empresa.'
              : 'Each mission opens a real tool (Dashboard or Strategic Objectives). You can redo them whenever your company changes.',
          },
        ]}
      />
    </div>
  );
}
'@
if (-not (Aplicar-ArchivoCompleto -RutaArchivo $archivoWorlds -ContenidoOriginalEsperado $worldsOriginal -ContenidoNuevo $worldsNuevo -Descripcion "WorldsBuilder.tsx actualizado")) { $exitoTotal = $false }

Write-Host ""
if ($exitoTotal) {
    Write-Host "== Todos los cambios se aplicaron correctamente. ==" -ForegroundColor Cyan
    Write-Host "Siguiente paso: revisa 'git diff' (presiona 'q' para salir del visor) y luego corre 'npm run build'." -ForegroundColor Cyan
} else {
    Write-Host "== Uno o mas cambios NO se pudieron aplicar (ver errores en rojo arriba). ==" -ForegroundColor Yellow
    Write-Host "No sigas con 'npm run build' ni con 'git push' todavia: avisale a Claude con el mensaje de error exacto." -ForegroundColor Yellow
}
Write-Host ""

export type PlanLang = 'es' | 'en';
export type EntornoTipo = 'amenaza' | 'oportunidad';
export type FDTipo = 'fortaleza' | 'debilidad';
export type Factibilidad = 'alta' | 'media' | 'baja' | 'nula';
export type Impacto = 'alto' | 'medio' | 'bajo' | 'nulo';
export type Estatus = 'pendiente' | 'en_proceso' | 'terminado';

export type RoleOption = { key: string; nameEs: string; nameEn: string };

export type Objetivo = { id: string; texto: string; validado: boolean; perspectiva?: string };
export type AmenazaOportunidad = { id: string; objetivoIds: string[]; tipo: EntornoTipo; descripcion: string; validado: boolean };
export type FortalezaDebilidad = { id: string; entornoIds: string[]; tipo: FDTipo; descripcion: string; validado: boolean };
export type Proyecto = { id: string; fdId: string; nombre: string; responsableRoleKey: string; responsableNombre: string; validado: boolean };
export type Accion = {
  id: string;
  proyectoId: string;
  descripcion: string;
  responsableRoleKey: string;
  responsableNombre: string;
  crossRoleKeys: string[];
  entregable: string;
  inversion: string;
  factibilidad: Factibilidad;
  impacto: Impacto;
  fecha: string;
  estatus: Estatus;
  validado: boolean;
  // Mentor de IA sugerido para ayudar a implementar esta accion (Babel,
  // Karmetin, Normau, Fisnando o Atech). Vacio = aun no clasificada.
  mentor?: string;
};
export type Contacto = { id: string; nombre: string; celular: string; correo: string; roleKeys: string[] };
export type OrgAssignments = Record<string, { person: string }>;
export type PlanData = {
  objetivos: Objetivo[];
  entornos: AmenazaOportunidad[];
  fds: FortalezaDebilidad[];
  proyectos: Proyecto[];
  acciones: Accion[];
};

export const STORAGE_KEY = 'babel_plan_accion_v2';
export const CONTACTS_KEY = 'babel_plan_accion_contactos_v1';
export const ORG_KEY = 'babel_orgchart_v1';
export const BOARD_KEY = 'babel_orgchart_board_v1';
export const INDICADORES_KEY = 'babel_indicadores_v1';

export const ROLE_OPTIONS: RoleOption[] = [
  { key: 'consejo_administrativo', nameEs: 'Consejo Administrativo', nameEn: 'Board of Directors' },
  { key: 'planeacion_estrategica', nameEs: 'Planeacion Estrategica', nameEn: 'Strategic Planning' },
  { key: 'finanzas', nameEs: 'Finanzas', nameEn: 'Finance' },
  { key: 'cobranza', nameEs: 'Cobranza', nameEn: 'Collections' },
  { key: 'facturacion', nameEs: 'Facturacion', nameEn: 'Invoicing' },
  { key: 'contabilidad', nameEs: 'Contabilidad', nameEn: 'Accounting' },
  { key: 'pago_proveedores', nameEs: 'Pago a Proveedores', nameEn: 'Vendor Payments' },
  { key: 'administracion', nameEs: 'Administracion', nameEn: 'Administration' },
  { key: 'recursos_humanos', nameEs: 'Recursos Humanos', nameEn: 'Human Resources' },
  { key: 'legal', nameEs: 'Legal', nameEn: 'Legal' },
  { key: 'comercial', nameEs: 'Comercial', nameEn: 'Commercial' },
  { key: 'mercadotecnia', nameEs: 'Mercadotecnia', nameEn: 'Marketing' },
  { key: 'relaciones_publicas', nameEs: 'Relaciones Publicas', nameEn: 'Public Relations' },
  { key: 'servicio_clientes', nameEs: 'Servicio a Clientes', nameEn: 'Customer Service' },
  { key: 'ventas', nameEs: 'Ventas', nameEn: 'Sales' },
  { key: 'operacion', nameEs: 'Operacion', nameEn: 'Operations' },
  { key: 'procesos', nameEs: 'Procesos', nameEn: 'Processes' },
  { key: 'sistemas', nameEs: 'Sistemas', nameEn: 'Systems' },
  { key: 'desarrollo_proveedores', nameEs: 'Desarrollo de Proveedores', nameEn: 'Vendor Development' },
];

export const FACTIBILIDAD_OPTIONS: { value: Factibilidad; labelEs: string; labelEn: string }[] = [
  { value: 'alta', labelEs: 'Alta', labelEn: 'High' },
  { value: 'media', labelEs: 'Media', labelEn: 'Medium' },
  { value: 'baja', labelEs: 'Baja', labelEn: 'Low' },
  { value: 'nula', labelEs: 'Nula', labelEn: 'None' },
];

export const IMPACTO_OPTIONS: { value: Impacto; labelEs: string; labelEn: string }[] = [
  { value: 'alto', labelEs: 'Alto', labelEn: 'High' },
  { value: 'medio', labelEs: 'Medio', labelEn: 'Medium' },
  { value: 'bajo', labelEs: 'Bajo', labelEn: 'Low' },
  { value: 'nulo', labelEs: 'Nulo', labelEn: 'None' },
];

export const ESTATUS_OPTIONS: { value: Estatus; labelEs: string; labelEn: string }[] = [
  { value: 'pendiente', labelEs: 'Pendiente', labelEn: 'Pending' },
  { value: 'en_proceso', labelEs: 'En proceso', labelEn: 'In progress' },
  { value: 'terminado', labelEs: 'Terminado', labelEn: 'Done' },
];

const PRIORITY_ORDER: [Factibilidad, Impacto][] = [
  ['alta', 'alto'],
  ['media', 'alto'],
  ['alta', 'medio'],
  ['media', 'medio'],
  ['baja', 'alto'],
  ['alta', 'bajo'],
  ['baja', 'medio'],
  ['media', 'bajo'],
  ['baja', 'bajo'],
  ['nula', 'alto'],
  ['nula', 'medio'],
  ['nula', 'bajo'],
  ['alta', 'nulo'],
  ['media', 'nulo'],
  ['baja', 'nulo'],
  ['nula', 'nulo'],
];

export function priorityRank(factibilidad: Factibilidad, impacto: Impacto): number {
  let idx = -1;
  for (let i = 0; i < PRIORITY_ORDER.length; i++) {
    if (PRIORITY_ORDER[i][0] === factibilidad && PRIORITY_ORDER[i][1] === impacto) {
      idx = i;
      break;
    }
  }
  return idx === -1 ? 16 : idx + 1;
}

export function priorityTier(rank: number, lang: PlanLang): { label: string; classes: string } {
  if (rank <= 3) return { label: lang === 'en' ? 'Very high priority' : 'Prioridad muy alta', classes: 'bg-purple-100 text-purple-800' };
  if (rank <= 6) return { label: lang === 'en' ? 'High priority' : 'Prioridad alta', classes: 'bg-blue-100 text-blue-800' };
  if (rank <= 9) return { label: lang === 'en' ? 'Medium priority' : 'Prioridad media', classes: 'bg-yellow-100 text-yellow-800' };
  if (rank <= 12) return { label: lang === 'en' ? 'Low priority' : 'Prioridad baja', classes: 'bg-orange-100 text-orange-800' };
  return { label: lang === 'en' ? 'Not worth pursuing' : 'Prioridad nula', classes: 'bg-slate-100 text-slate-500' };
}

export function isFactibilidad(value: string): value is Factibilidad {
  return value === 'alta' || value === 'media' || value === 'baja' || value === 'nula';
}

export function isImpacto(value: string): value is Impacto {
  return value === 'alto' || value === 'medio' || value === 'bajo' || value === 'nulo';
}

export function isEntornoTipo(value: string): value is EntornoTipo {
  return value === 'amenaza' || value === 'oportunidad';
}

export function isFDTipo(value: string): value is FDTipo {
  return value === 'fortaleza' || value === 'debilidad';
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function suggestedDate(rank: number): string {
  const today = new Date();
  if (rank <= 3) return addDays(today, 14);
  if (rank <= 6) return addDays(today, 30);
  if (rank <= 9) return addDays(today, 60);
  if (rank <= 12) return addDays(today, 90);
  return addDays(today, 180);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function roleLabel(roleKey: string, lang: PlanLang): string {
  let found: RoleOption | null = null;
  for (let i = 0; i < ROLE_OPTIONS.length; i++) {
    if (ROLE_OPTIONS[i].key === roleKey) {
      found = ROLE_OPTIONS[i];
      break;
    }
  }
  if (!found) return '';
  return lang === 'en' ? found.nameEn : found.nameEs;
}

export function whatsappLink(celular: string, mensaje: string): string {
  const clean = celular.replace(/[^0-9]/g, '');
  return 'https://api.whatsapp.com/send?phone=' + clean + '&text=' + encodeURIComponent(mensaje);
}

export function daysUntil(fecha: string): number {
  if (!fecha) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(fecha + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function reminderMessage(lang: PlanLang, nombre: string, tarea: string, proyecto: string, fecha: string, entregable: string): string {
  const entregableTxt = entregable ? entregable : (lang === 'en' ? 'not set' : 'sin definir');
  const proyectoClauseEn = proyecto ? ' for project "' + proyecto + '"' : '';
  const proyectoClauseEs = proyecto ? ' del proyecto "' + proyecto + '"' : '';
  if (lang === 'en') {
    return 'Hi ' + nombre + ', your task "' + tarea + '"' + proyectoClauseEn + ' is due ' + fecha + '. Expected deliverable: ' + entregableTxt + '. Please confirm your progress.';
  }
  return 'Hola ' + nombre + ', tu tarea "' + tarea + '"' + proyectoClauseEs + ' tiene fecha compromiso ' + fecha + '. Entregable esperado: ' + entregableTxt + '. Por favor confirma como vas.';
}

export function newObjetivo(): Objetivo {
  return { id: generateId(), texto: '', validado: false };
}

export function objetivosDe(raw: { objetivoIds?: string[]; objetivoId?: unknown }): string[] {
  if (Array.isArray(raw.objetivoIds)) return raw.objetivoIds;
  return typeof raw.objetivoId === 'string' && raw.objetivoId ? [raw.objetivoId] : [];
}

export function entornosDe(raw: { entornoIds?: string[]; entornoId?: unknown }): string[] {
  if (Array.isArray(raw.entornoIds)) return raw.entornoIds;
  return typeof raw.entornoId === 'string' && raw.entornoId ? [raw.entornoId] : [];
}

export function newEntorno(objetivoIds: string[], tipo: EntornoTipo): AmenazaOportunidad {
  return { id: generateId(), objetivoIds: objetivoIds, tipo: tipo, descripcion: '', validado: false };
}

export function newFD(entornoIds: string[], tipo: FDTipo): FortalezaDebilidad {
  return { id: generateId(), entornoIds: entornoIds, tipo: tipo, descripcion: '', validado: false };
}

export function newProyecto(fdId: string): Proyecto {
  return { id: generateId(), fdId: fdId, nombre: '', responsableRoleKey: '', responsableNombre: '', validado: false };
}

export function newAccion(proyectoId: string, rank: number): Accion {
  return {
    id: generateId(),
    proyectoId: proyectoId,
    descripcion: '',
    responsableRoleKey: '',
    responsableNombre: '',
    crossRoleKeys: [],
    entregable: '',
    inversion: '',
    factibilidad: 'media',
    impacto: 'medio',
    fecha: suggestedDate(rank),
    estatus: 'pendiente',
    validado: false,
    mentor: '',
  };
}

export type PerspectivaEstilo = { key: string; es: string; en: string; chip: string; soft: string; border: string; text: string };

export const PERSPECTIVAS: PerspectivaEstilo[] = [
  { key: 'financiera', es: 'Financieros', en: 'Financial', chip: 'bg-teal-100 text-teal-800', soft: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800' },
  { key: 'clientes', es: 'Clientes', en: 'Customer', chip: 'bg-cyan-100 text-cyan-800', soft: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800' },
  { key: 'procesos_internos', es: 'Procesos', en: 'Processes', chip: 'bg-indigo-100 text-indigo-800', soft: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  { key: 'aprendizaje_crecimiento', es: 'Aprendizaje', en: 'Learning', chip: 'bg-purple-100 text-purple-800', soft: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  { key: 'socioambiental', es: 'Socioambientales', en: 'Social-Environmental', chip: 'bg-green-100 text-green-800', soft: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
];

export const SIN_PERSPECTIVA_STYLE: PerspectivaEstilo = {
  key: 'sin_perspectiva',
  es: 'Sin perspectiva',
  en: 'No perspective',
  chip: 'bg-slate-100 text-slate-600',
  soft: 'bg-slate-50',
  border: 'border-slate-200',
  text: 'text-slate-600',
};

export function perspectivaLabel(key: string, lang: PlanLang): string {
  if (!key) return lang === 'en' ? SIN_PERSPECTIVA_STYLE.en : SIN_PERSPECTIVA_STYLE.es;
  for (let i = 0; i < PERSPECTIVAS.length; i++) {
    if (PERSPECTIVAS[i].key === key) return lang === 'en' ? PERSPECTIVAS[i].en : PERSPECTIVAS[i].es;
  }
  return key;
}

export function perspectivaEstilo(key: string): PerspectivaEstilo {
  for (let i = 0; i < PERSPECTIVAS.length; i++) {
    if (PERSPECTIVAS[i].key === key) return PERSPECTIVAS[i];
  }
  return SIN_PERSPECTIVA_STYLE;
}

export function loadPlanAccion(): PlanData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      objetivos: Array.isArray(parsed.objetivos) ? parsed.objetivos : [],
      entornos: Array.isArray(parsed.entornos) ? parsed.entornos.map((e: { objetivoIds?: string[]; objetivoId?: unknown }) => Object.assign({}, e, { objetivoIds: objetivosDe(e) })) : [],
      fds: Array.isArray(parsed.fds) ? parsed.fds.map((f: { entornoIds?: string[]; entornoId?: unknown }) => Object.assign({}, f, { entornoIds: entornosDe(f) })) : [],
      proyectos: Array.isArray(parsed.proyectos) ? parsed.proyectos : [],
      acciones: Array.isArray(parsed.acciones) ? parsed.acciones : [],
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

export function savePlanAccion(data: PlanData) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        objetivos: data.objetivos,
        entornos: data.entornos,
        fds: data.fds,
        proyectos: data.proyectos,
        acciones: data.acciones,
      })
    );
  } catch (err) {
    console.error(err);
  }
}

export function loadContactos(): Contacto[] {
  try {
    const rawC = window.localStorage.getItem(CONTACTS_KEY);
    if (rawC) {
      const parsedC = JSON.parse(rawC);
      if (Array.isArray(parsedC)) return parsedC;
    }
  } catch (err) {
    console.error(err);
  }
  return [];
}

export type OrgData = {
  assignments: OrgAssignments;
  presidente: string;
  secretario: string;
  consejeros: { id: string; nombre: string }[];
};

export function loadOrgData(): OrgData {
  const result: OrgData = { assignments: {}, presidente: '', secretario: '', consejeros: [] };
  try {
    const rawOrg = window.localStorage.getItem(ORG_KEY);
    if (rawOrg) {
      const parsedOrg = JSON.parse(rawOrg);
      if (parsedOrg && typeof parsedOrg === 'object') result.assignments = parsedOrg;
    }
  } catch (err) {
    console.error(err);
  }
  try {
    const rawBoard = window.localStorage.getItem(BOARD_KEY);
    if (rawBoard) {
      const parsedBoard = JSON.parse(rawBoard);
      if (parsedBoard && typeof parsedBoard.presidente === 'string') result.presidente = parsedBoard.presidente;
      if (parsedBoard && typeof parsedBoard.secretario === 'string') result.secretario = parsedBoard.secretario;
      if (parsedBoard && Array.isArray(parsedBoard.consejeros)) {
        result.consejeros = parsedBoard.consejeros
          .filter((c: unknown) => c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string')
          .map((c: { id: string; nombre?: unknown }) => ({ id: c.id, nombre: typeof c.nombre === 'string' ? c.nombre : '' }));
      }
    }
  } catch (err) {
    console.error(err);
  }
  return result;
}

export function resolvePersonForRole(roleKey: string, org: OrgData): string {
  if (!roleKey) return '';
  if (roleKey === 'consejo_administrativo') return org.presidente;
  const a = org.assignments[roleKey];
  return a && a.person ? a.person : '';
}

export function resolveCelular(nombre: string, roleKey: string | undefined, contactos: Contacto[]): string {
  if (roleKey) {
    for (let i = 0; i < contactos.length; i++) {
      const keys = contactos[i].roleKeys;
      if (Array.isArray(keys) && keys.indexOf(roleKey) !== -1) return contactos[i].celular;
    }
  }
  if (!nombre) return '';
  for (let i = 0; i < contactos.length; i++) {
    if (contactos[i].nombre.trim().toLowerCase() === nombre.trim().toLowerCase()) {
      return contactos[i].celular;
    }
  }
  return '';
}

export function accionesDeObjetivo(objetivoId: string, data: PlanData): Accion[] {
  const out: Accion[] = [];
  const vistos: Record<string, boolean> = {};
  data.entornos
    .filter((e) => e.objetivoIds.indexOf(objetivoId) !== -1)
    .forEach((e) => {
      data.fds
        .filter((f) => f.entornoIds.indexOf(e.id) !== -1)
        .forEach((f) => {
          data.proyectos
            .filter((p) => p.fdId === f.id)
            .forEach((p) => {
              data.acciones
                .filter((a) => a.proyectoId === p.id)
                .forEach((a) => {
                  if (vistos[a.id]) return;
                  vistos[a.id] = true;
                  out.push(a);
                });
            });
        });
    });
  return out;
}

export function entornosDeObjetivo(objetivoId: string, data: PlanData): AmenazaOportunidad[] {
  return data.entornos.filter((e) => e.objetivoIds.indexOf(objetivoId) !== -1);
}

export function fdsDeEntorno(entornoId: string, data: PlanData): FortalezaDebilidad[] {
  return data.fds.filter((f) => f.entornoIds.indexOf(entornoId) !== -1);
}

export function proyectoDeFd(fdId: string, data: PlanData): Proyecto | undefined {
  for (let i = 0; i < data.proyectos.length; i++) {
    if (data.proyectos[i].fdId === fdId) return data.proyectos[i];
  }
  return undefined;
}

export function proyectoDeAccion(accionId: string, data: PlanData): Proyecto | undefined {
  const accion = data.acciones.find((a) => a.id === accionId);
  if (!accion) return undefined;
  return data.proyectos.find((p) => p.id === accion.proyectoId);
}

export type ResumenObjetivo = {
  total: number;
  pendientes: number;
  vencidas: number;
  porVencer: number;
  validados: number;
};

export function resumenDeObjetivo(objetivoId: string, data: PlanData): ResumenObjetivo {
  const acciones = accionesDeObjetivo(objetivoId, data);
  let vencidas = 0;
  let porVencer = 0;
  let validados = 0;
  let pendientes = 0;
  acciones.forEach((a) => {
    const d = daysUntil(a.fecha);
    if (a.estatus !== 'terminado') {
      pendientes = pendientes + 1;
      if (d < 0) vencidas = vencidas + 1;
      if (d >= 0 && d <= 7) porVencer = porVencer + 1;
    }
    if (a.validado) validados = validados + 1;
  });
  return { total: acciones.length, pendientes, vencidas, porVencer, validados };
}

export const LABELS = {
  es: {
    title: 'Plan de Accion Estrategico',
    subtitle: 'Por cada objetivo de negocio, registra las amenazas u oportunidades del entorno, tus fortalezas o debilidades frente a ellas, el proyecto que las atiende y las acciones concretas para lograrlo.',
    summaryObjetivos: 'Objetivos',
    summaryAcciones: 'Acciones totales',
    summaryVencidas: 'Acciones vencidas',
    summaryPorVencer: 'Por vencer en 7 dias',
    summaryValidar: 'Elementos pendientes de validar',
    sugerirPrioridadSubtitle:
      'Babel revisara cada accion de tu plan y propondra su Factibilidad e Impacto economico, y asignara un Responsable segun tu organigrama; podras validar o corregir cada uno desde el menu correspondiente.',
    sugerirPrioridadBtn: 'Sugerir Factibilidad e Impacto con IA',
    sugerirPrioridadGenerando: 'Analizando acciones...',
    sugerirPrioridadErrorHint: 'Puedes seguir asignando Factibilidad e Impacto manualmente mientras tanto.',
    planIaTitle: 'Construye tu Plan de Accion con Babel',
    planIaSubtitle:
      'Sigue los pasos en orden: Babel detecta el entorno, sugiere fortalezas y debilidades, despues las acciones y finalmente prioriza. Puedes editar y validar cada sugerencia.',
    detectaEntornosBtn: 'Detecta Amenazas y Oportunidades',
    detectaEntornosSubtitle:
      'Analiza las secciones 1.2, 1.4, 2.1, 2.2, 2.3 y 4.1 de tu reflexion estrategica y las relaciona con cada objetivo.',
    detectaEntornosGenerando: 'Babel esta analizando el entorno...',
    detectaEntornosNeed: 'Primero agrega al menos un Objetivo Estrategico (se llenan desde la pagina de Objetivos Estrategicos).',
    fdsBtn: 'Sugiere Fortalezas y Debilidades',
    fdsSubtitle:
      'Revisa las secciones 1.1, 1.3, 3.1, 3.2, 3.3 y 4.2 de tu reflexion estrategica, junto con los niveles bajos de tu Evaluacion de Madurez.',
    fdsGenerando: 'Babel esta revisando capacidades y madurez...',
    fdsNeedEntornos: 'Primero detecta las Amenazas y Oportunidades, o agrega al menos una manualmente.',
    accionesBtn: 'Sugiere Acciones',
    accionesSubtitle:
      'Disena acciones para blindar fortalezas y mejorar debilidades, apoyandose en las fases, la madurez pendiente y un catalogo de buenas practicas.',
    accionesGenerando: 'Babel esta construyendo el plan de acciones...',
    accionesNeedFds: 'Primero sugiere las Fortalezas y Debilidades, o agrega al menos una manualmente.',
    planErrorHint: 'Puedes seguir editando manualmente mientras tanto.',
    addObjetivo: 'Agregar objetivo de negocio',
    objetivoLabel: 'Objetivo de negocio',
    objetivoPlaceholder: 'Ej. Incrementar utilidad a 10% anual',
    validado: 'Validado',
    pendienteValidar: 'Pendiente de validar',
    eliminar: 'Eliminar',
    mostrar: 'Mostrar',
    ocultar: 'Ocultar',
    addEntorno: 'Agregar amenaza u oportunidad',
    entornoTipo: 'Tipo',
    amenaza: 'Amenaza',
    oportunidad: 'Oportunidad',
    entornoDesc: 'Descripcion (que detectamos en el entorno)',
    entornoPlaceholder: 'Ej. Inflacion en insumos importados',
    addFD: 'Agregar fortaleza o debilidad',
    fortaleza: 'Fortaleza',
    debilidad: 'Debilidad',
    fdDesc: 'Descripcion',
    fdPlaceholder: 'Ej. Maquinaria propia con capacidad instalada',
    definirProyecto: 'Definir proyecto',
    proyectoLabel: 'Nombre del proyecto',
    proyectoPlaceholder: 'Ej. Automatizar inteligencia de negocio (ERP)',
    responsableLabel: 'Responsable (rol del organigrama)',
    responsableNombreLabel: 'Nombre del responsable',
    addAccion: 'Agregar accion',
    accionDesc: 'Descripcion de la accion',
    accionPlaceholder: 'Ej. Cotizar 3 proveedores de ERP',
    entregableLabel: 'Entregable (evidencia de que se hizo)',
    entregablePlaceholder: 'Ej. Lista de asistencia, cotizacion firmada',
    inversionLabel: 'Inversion requerida',
    inversionPlaceholder: 'Ej. 15000 pesos o Sin costo',
    factibilidadLabel: 'Factibilidad',
    impactoLabel: 'Impacto economico',
    prioridadLabel: 'Prioridad calculada',
    fechaLabel: 'Fecha de implementacion',
    estatusLabel: 'Estatus',
    sendReminder: 'Enviar recordatorio por WhatsApp',
    noPhone: 'Agrega el celular de esta persona en el Directorio de Contactos para poder enviar el recordatorio.',
    savedNote: 'Los cambios se guardan automaticamente en este navegador.',
    dueSoon: 'Vence pronto',
    overdue: 'Vencida',
    mapaTitle: 'Mapa del Plan de Accion',
    mapaSubtitle: 'Cada objetivo abre su propia pagina con sus acciones y su diagnostico (amenazas, oportunidades, fortalezas y debilidades).',
    verPlan: 'Ver plan',
    sinPerspectiva: 'Sin perspectiva',
    perspectivaLabel: 'Perspectiva',
    mapaAvance: 'Avance',
    accionesShort: 'acciones',
    pendientesShort: 'pendientes',
    vencidasShort: 'vencidas',
    etapaBotonMostrar: 'Mostrar generacion con Babel',
    etapaBotonOcultar: 'Ocultar generacion con Babel',
    tabAcciones: 'Acciones',
    tabDiagnostico: 'Diagnostico (referencia)',
    diagnosticoNota: 'El diagnostico de este objetivo esta en solo lectura: las amenazas u oportunidades del entorno y las fortalezas o debilidades que las sustentan. Para modificarlas, vuelve a generarlas con Babel desde el Plan de Accion.',
    filtroTodas: 'Todas',
    filtroProximas: 'Proximas 30 dias',
    filtroVencidas: 'Vencidas',
    sinAcciones: 'Aun no hay acciones para este objetivo. Agrega una manualmente o genera el plan con Babel desde el Plan de Accion.',
    wizardObjetivo: 'Objetivo relacionado',
    wizardEntorno: 'Amenaza u oportunidad relacionada',
    wizardEntornoHint: 'Primero genera las Amenazas y Oportunidades de este objetivo con Babel en el Plan de Accion.',
    wizardFD: 'Fortaleza o debilidad relacionada',
    wizardSinFD: 'Sin fortaleza/debilidad especifica',
    wizardProyecto: 'Nombre del proyecto (opcional)',
    wizardProyectoPlaceholder: 'Ej. Automatizar inteligencia de negocio (ERP)',
    wizardCrear: 'Crear accion',
    wizardCancelar: 'Cancelar',
    proyectoChip: 'Proyecto',
    noEncontrado: 'No encontramos ese objetivo en tu plan.',
    volver: 'Volver al Plan de Accion',
    breadcrumbPlan: 'Plan de Accion',
  },
  en: {
    title: 'Strategic Action Plan',
    subtitle: 'For each business objective, log the threats or opportunities in the environment, your strengths or weaknesses facing them, the project that addresses them, and the concrete actions to get it done.',
    summaryObjetivos: 'Objectives',
    summaryAcciones: 'Total actions',
    summaryVencidas: 'Overdue actions',
    summaryPorVencer: 'Due within 7 days',
    summaryValidar: 'Items pending validation',
    sugerirPrioridadSubtitle:
      'Babel will review every action in your plan, propose its Feasibility and Economic Impact, and assign a Responsible based on your org chart; you can validate or correct each one from its dropdown.',
    sugerirPrioridadBtn: 'Suggest Feasibility & Impact with AI',
    sugerirPrioridadGenerando: 'Analyzing actions...',
    sugerirPrioridadErrorHint: 'You can keep assigning Feasibility and Impact manually in the meantime.',
    planIaTitle: 'Build your Action Plan with Babel',
    planIaSubtitle:
      'Follow the steps in order: Babel detects the environment, suggests strengths and weaknesses, then the actions, and finally prioritizes. You can edit and validate every suggestion.',
    detectaEntornosBtn: 'Detect Threats and Opportunities',
    detectaEntornosSubtitle:
      'Analyzes sections 1.2, 1.4, 2.1, 2.2, 2.3 and 4.1 of your strategic reflection and links them to each objective.',
    detectaEntornosGenerando: 'Babel is analyzing the environment...',
    detectaEntornosNeed: 'First add at least one Strategic Objective (they are filled from the Strategic Objectives page).',
    fdsBtn: 'Suggest Strengths and Weaknesses',
    fdsSubtitle:
      'Reviews sections 1.1, 1.3, 3.1, 3.2, 3.3 and 4.2 of your strategic reflection, plus the low levels of your Maturity Assessment.',
    fdsGenerando: 'Babel is reviewing capabilities and maturity...',
    fdsNeedEntornos: 'First detect the Threats and Opportunities, or add at least one manually.',
    accionesBtn: 'Suggest Actions',
    accionesSubtitle:
      'Designs actions to strengthen strengths and improve weaknesses, using the phases, pending maturity steps and a best practices catalog.',
    accionesGenerando: 'Babel is building the action plan...',
    accionesNeedFds: 'First suggest the Strengths and Weaknesses, or add at least one manually.',
    planErrorHint: 'You can keep editing manually in the meantime.',
    addObjetivo: 'Add business objective',
    objetivoLabel: 'Business objective',
    objetivoPlaceholder: 'E.g. Increase profit to 10% annually',
    validado: 'Validated',
    pendienteValidar: 'Pending validation',
    eliminar: 'Remove',
    mostrar: 'Show',
    ocultar: 'Hide',
    addEntorno: 'Add threat or opportunity',
    entornoTipo: 'Type',
    amenaza: 'Threat',
    oportunidad: 'Opportunity',
    entornoDesc: 'Description (what we detected in the environment)',
    entornoPlaceholder: 'E.g. Inflation on imported supplies',
    addFD: 'Add strength or weakness',
    fortaleza: 'Strength',
    debilidad: 'Weakness',
    fdDesc: 'Description',
    fdPlaceholder: 'E.g. Own machinery with installed capacity',
    definirProyecto: 'Define project',
    proyectoLabel: 'Project name',
    proyectoPlaceholder: 'E.g. Automate business intelligence (ERP)',
    responsableLabel: 'Owner (org chart role)',
    responsableNombreLabel: 'Owner name',
    addAccion: 'Add action',
    accionDesc: 'Action description',
    accionPlaceholder: 'E.g. Get quotes from 3 ERP vendors',
    entregableLabel: 'Deliverable (evidence the action happened)',
    entregablePlaceholder: 'E.g. Attendance list, signed quote',
    inversionLabel: 'Investment required',
    inversionPlaceholder: 'E.g. 15000 MXN or No cost',
    factibilidadLabel: 'Feasibility',
    impactoLabel: 'Economic impact',
    prioridadLabel: 'Calculated priority',
    fechaLabel: 'Implementation date',
    estatusLabel: 'Status',
    sendReminder: 'Send WhatsApp reminder',
    noPhone: 'Add this phone number in the Contact Directory to send the reminder.',
    savedNote: 'Changes are saved automatically in this browser.',
    dueSoon: 'Due soon',
    overdue: 'Overdue',
    mapaTitle: 'Action Plan Map',
    mapaSubtitle: 'Each objective opens its own page with its actions and its diagnosis (threats, opportunities, strengths and weaknesses).',
    verPlan: 'View plan',
    sinPerspectiva: 'No perspective',
    perspectivaLabel: 'Perspective',
    mapaAvance: 'Progress',
    accionesShort: 'actions',
    pendientesShort: 'pending',
    vencidasShort: 'overdue',
    etapaBotonMostrar: 'Show Babel generation',
    etapaBotonOcultar: 'Hide Babel generation',
    tabAcciones: 'Actions',
    tabDiagnostico: 'Diagnosis (reference)',
    diagnosticoNota: 'This objective diagnosis is read-only: the threats or opportunities in the environment and the strengths or weaknesses that support them. To modify them, regenerate them with Babel from the Action Plan.',
    filtroTodas: 'All',
    filtroProximas: 'Next 30 days',
    filtroVencidas: 'Overdue',
    sinAcciones: 'There are no actions for this objective yet. Add one manually or generate the plan with Babel from the Action Plan.',
    wizardObjetivo: 'Related objective',
    wizardEntorno: 'Related threat or opportunity',
    wizardEntornoHint: 'First generate the Threats and Opportunities of this objective with Babel in the Action Plan.',
    wizardFD: 'Related strength or weakness',
    wizardSinFD: 'No specific strength or weakness',
    wizardProyecto: 'Project name (optional)',
    wizardProyectoPlaceholder: 'E.g. Automate business intelligence (ERP)',
    wizardCrear: 'Create action',
    wizardCancelar: 'Cancel',
    proyectoChip: 'Project',
    noEncontrado: 'We could not find that objective in your plan.',
    volver: 'Back to the Action Plan',
    breadcrumbPlan: 'Action Plan',
  },
};

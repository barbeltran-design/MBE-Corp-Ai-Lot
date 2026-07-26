'use client';
import React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type AssessmentResult } from '@/lib/maturity-scoring';
import { getBabelSessionIfExists } from '@/lib/babel-session';

const MATURITY_LEVEL_LABEL: Record<string, { es: string; en: string }> = {
  execution: { es: 'Ejecucion', en: 'Execution' },
  standard: { es: 'Estandar', en: 'Standard' },
  control: { es: 'Control', en: 'Control' },
  optimization: { es: 'Optimizacion', en: 'Optimization' },
  excellence: { es: 'Excelencia', en: 'Excellence' },
  influencer: { es: 'Influencer', en: 'Influencer' },
};

type PlanLang = 'es' | 'en';
type Perspectiva = 'financiera' | 'clientes' | 'procesos_internos' | 'aprendizaje_crecimiento';
type EntornoTipo = 'amenaza' | 'oportunidad';
type FDTipo = 'fortaleza' | 'debilidad';
type ConvocatoriaTipo = 'internacional' | 'nacional';
type Factibilidad = 'alta' | 'media' | 'baja' | 'nula';
type Impacto = 'alto' | 'medio' | 'bajo' | 'nulo';
type Estatus = 'pendiente' | 'en_proceso' | 'terminado';

type RoleOption = { key: string; nameEs: string; nameEn: string };

type Objetivo = { id: string; perspectiva: Perspectiva; texto: string; validado: boolean };
type AmenazaOportunidad = { id: string; objetivoId: string; tipo: EntornoTipo; descripcion: string; validado: boolean };
type FortalezaDebilidad = { id: string; entornoId: string; tipo: FDTipo; descripcion: string; validado: boolean };
type Proyecto = { id: string; fdId: string; nombre: string; responsableRoleKey: string; responsableNombre: string; validado: boolean };
type Accion = {
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
};
type Convocatoria = { id: string; tipo: ConvocatoriaTipo; nombre: string; requisito: string; validado: boolean };
type Contacto = { id: string; nombre: string; celular: string; correo: string; roleKeys: string[] };
type ExpandedMap = Record<string, boolean>;
type OrgAssignments = Record<string, { person: string }>;

const STORAGE_KEY = 'babel_plan_accion_v2';
const CONTACTS_KEY = 'babel_plan_accion_contactos_v1';
const ORG_KEY = 'babel_orgchart_v1';
const BOARD_KEY = 'babel_orgchart_board_v1';
const FIN_GOALS_KEY = 'babel_financial_goals_v1';
const BOARD_PRESIDENTE_KEY = '__board_presidente';
const BOARD_SECRETARIO_KEY = '__board_secretario';

interface FinGoalsSaved {
  input: {
    language?: 'es' | 'en';
    unitPrice?: number;
    channels?: { name: string; pct: number }[];
    desiredProfit?: number;
  };
  result: {
    fixedTotal?: number;
    breakEven?: number;
    targetRevenue?: number;
  };
  savedAt?: string;
}

const ROLE_OPTIONS: RoleOption[] = [
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

const BOARD_CONSEJERO_PREFIX = '__board_consejero_';

// Lista corta de codigos de pais para el pulldown del Directorio de Contactos.
// No pretende ser exhaustiva: cubre los paises mas probables para esta herramienta
// (Mexico primero, luego el resto de LatAm y Espana/EEUU-Canada).
const COUNTRY_CODES: { code: string; flag: string; nameEs: string; nameEn: string }[] = [
  { code: '52', flag: '🇲🇽', nameEs: 'Mexico', nameEn: 'Mexico' },
  { code: '1', flag: '🇺🇸', nameEs: 'EEUU / Canada', nameEn: 'US / Canada' },
  { code: '34', flag: '🇪🇸', nameEs: 'Espana', nameEn: 'Spain' },
  { code: '54', flag: '🇦🇷', nameEs: 'Argentina', nameEn: 'Argentina' },
  { code: '56', flag: '🇨🇱', nameEs: 'Chile', nameEn: 'Chile' },
  { code: '57', flag: '🇨🇴', nameEs: 'Colombia', nameEn: 'Colombia' },
  { code: '51', flag: '🇵🇪', nameEs: 'Peru', nameEn: 'Peru' },
  { code: '502', flag: '🇬🇹', nameEs: 'Guatemala', nameEn: 'Guatemala' },
  { code: '503', flag: '🇸🇻', nameEs: 'El Salvador', nameEn: 'El Salvador' },
  { code: '504', flag: '🇭🇳', nameEs: 'Honduras', nameEn: 'Honduras' },
  { code: '505', flag: '🇳🇮', nameEs: 'Nicaragua', nameEn: 'Nicaragua' },
  { code: '506', flag: '🇨🇷', nameEs: 'Costa Rica', nameEn: 'Costa Rica' },
  { code: '507', flag: '🇵🇦', nameEs: 'Panama', nameEn: 'Panama' },
  { code: '591', flag: '🇧🇴', nameEs: 'Bolivia', nameEn: 'Bolivia' },
  { code: '593', flag: '🇪🇨', nameEs: 'Ecuador', nameEn: 'Ecuador' },
  { code: '595', flag: '🇵🇾', nameEs: 'Paraguay', nameEn: 'Paraguay' },
  { code: '598', flag: '🇺🇾', nameEs: 'Uruguay', nameEn: 'Uruguay' },
];

// Antepone el codigo de pais elegido al numero que ya este escrito, sin
// duplicarlo si ya empieza con ese mismo codigo. No intenta adivinar ni
// quitar un codigo distinto que ya este ahi (si el usuario elige mal el
// pais, debe borrar el campo y volver a escribir).
function applyCountryCode(currentCelular: string, code: string): string {
  const digits = currentCelular.replace(/[^0-9]/g, '');
  if (!digits) return code;
  if (digits.indexOf(code) === 0) return digits;
  return code + digits;
}

const PERSPECTIVA_OPTIONS: { value: Perspectiva; labelEs: string; labelEn: string }[] = [
  { value: 'financiera', labelEs: 'Financiera', labelEn: 'Financial' },
  { value: 'clientes', labelEs: 'Clientes', labelEn: 'Customer' },
  { value: 'procesos_internos', labelEs: 'Procesos Internos', labelEn: 'Internal Processes' },
  { value: 'aprendizaje_crecimiento', labelEs: 'Aprendizaje y Crecimiento', labelEn: 'Learning and Growth' },
];

const FACTIBILIDAD_OPTIONS: { value: Factibilidad; labelEs: string; labelEn: string }[] = [
  { value: 'alta', labelEs: 'Alta', labelEn: 'High' },
  { value: 'media', labelEs: 'Media', labelEn: 'Medium' },
  { value: 'baja', labelEs: 'Baja', labelEn: 'Low' },
  { value: 'nula', labelEs: 'Nula', labelEn: 'None' },
];

const IMPACTO_OPTIONS: { value: Impacto; labelEs: string; labelEn: string }[] = [
  { value: 'alto', labelEs: 'Alto', labelEn: 'High' },
  { value: 'medio', labelEs: 'Medio', labelEn: 'Medium' },
  { value: 'bajo', labelEs: 'Bajo', labelEn: 'Low' },
  { value: 'nulo', labelEs: 'Nulo', labelEn: 'None' },
];

const ESTATUS_OPTIONS: { value: Estatus; labelEs: string; labelEn: string }[] = [
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

function priorityRank(factibilidad: Factibilidad, impacto: Impacto): number {
  let idx = -1;
  for (let i = 0; i < PRIORITY_ORDER.length; i++) {
    if (PRIORITY_ORDER[i][0] === factibilidad && PRIORITY_ORDER[i][1] === impacto) {
      idx = i;
      break;
    }
  }
  return idx === -1 ? 16 : idx + 1;
}

function priorityTier(rank: number, lang: PlanLang): { label: string; classes: string } {
  if (rank <= 3) return { label: lang === 'en' ? 'Very high priority' : 'Prioridad muy alta', classes: 'bg-purple-100 text-purple-800' };
  if (rank <= 6) return { label: lang === 'en' ? 'High priority' : 'Prioridad alta', classes: 'bg-blue-100 text-blue-800' };
  if (rank <= 9) return { label: lang === 'en' ? 'Medium priority' : 'Prioridad media', classes: 'bg-yellow-100 text-yellow-800' };
  if (rank <= 12) return { label: lang === 'en' ? 'Low priority' : 'Prioridad baja', classes: 'bg-orange-100 text-orange-800' };
  return { label: lang === 'en' ? 'Not worth pursuing' : 'Prioridad nula', classes: 'bg-slate-100 text-slate-500' };
}

function isFactibilidad(value: string): value is Factibilidad {
  return value === 'alta' || value === 'media' || value === 'baja' || value === 'nula';
}

function isImpacto(value: string): value is Impacto {
  return value === 'alto' || value === 'medio' || value === 'bajo' || value === 'nulo';
}

function isEntornoTipo(value: string): value is EntornoTipo {
  return value === 'amenaza' || value === 'oportunidad';
}

interface RawEntornoIA {
  objetivoId?: string;
  tipo?: string;
  descripcion?: string;
}

interface RawCapacidadIA {
  entornoId?: string;
  descripcion?: string;
}

interface RawObjetivoBSCIA {
  perspectiva?: string;
  texto?: string;
}

interface RawAccionIA {
  descripcion?: string;
  entregable?: string;
  responsableRoleKey?: string;
}

function isPerspectivaBSC(value: string): value is 'clientes' | 'procesos_internos' | 'aprendizaje_crecimiento' {
  return value === 'clientes' || value === 'procesos_internos' || value === 'aprendizaje_crecimiento';
}

const PERSPECTIVA_ORDER: Record<Perspectiva, number> = {
  financiera: 0,
  clientes: 1,
  procesos_internos: 2,
  aprendizaje_crecimiento: 3,
};

function sortObjetivosPorPerspectiva(list: Objetivo[]): Objetivo[] {
  return list.slice().sort((a, b) => PERSPECTIVA_ORDER[a.perspectiva] - PERSPECTIVA_ORDER[b.perspectiva]);
}

interface RawConvocatoriaIA {
  tipo?: string;
  nombre?: string;
  requisito?: string;
}

function isConvocatoriaTipo(value: string): value is ConvocatoriaTipo {
  return value === 'internacional' || value === 'nacional';
}

interface RawPrioridadIA {
  id?: string;
  factibilidad?: string;
  impacto?: string;
  justificacion?: string;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function suggestedDate(rank: number): string {
  const today = new Date();
  if (rank <= 3) return addDays(today, 14);
  if (rank <= 6) return addDays(today, 30);
  if (rank <= 9) return addDays(today, 60);
  if (rank <= 12) return addDays(today, 90);
  return addDays(today, 180);
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function roleLabel(roleKey: string, lang: PlanLang): string {
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

function whatsappLink(celular: string, mensaje: string): string {
  const clean = celular.replace(/[^0-9]/g, '');
  return 'https://api.whatsapp.com/send?phone=' + clean + '&text=' + encodeURIComponent(mensaje);
}

function daysUntil(fecha: string): number {
  if (!fecha) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(fecha + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function reminderMessage(lang: PlanLang, nombre: string, tarea: string, proyecto: string, fecha: string, entregable: string): string {
  const entregableTxt = entregable ? entregable : (lang === 'en' ? 'not set' : 'sin definir');
  const proyectoClauseEn = proyecto ? ' for project "' + proyecto + '"' : '';
  const proyectoClauseEs = proyecto ? ' del proyecto "' + proyecto + '"' : '';
  if (lang === 'en') {
    return 'Hi ' + nombre + ', your task "' + tarea + '"' + proyectoClauseEn + ' is due ' + fecha + '. Expected deliverable: ' + entregableTxt + '. Please confirm your progress.';
  }
  return 'Hola ' + nombre + ', tu tarea "' + tarea + '"' + proyectoClauseEs + ' tiene fecha compromiso ' + fecha + '. Entregable esperado: ' + entregableTxt + '. Por favor confirma como vas.';
}

const LABELS = {
  es: {
    title: 'Plan de Accion Estrategico',
    subtitle: 'Por cada objetivo de negocio, registra las amenazas u oportunidades del entorno, tus fortalezas o debilidades frente a ellas, el proyecto que las atiende y las acciones concretas para lograrlo.',
    contactsTitle: 'Directorio de Contactos',
    contactsSubtitle: 'Nombre y celular de cada responsable, para poder enviar recordatorios por WhatsApp.',
    addContact: 'Agregar contacto',
    contactName: 'Nombre',
    contactPhone: 'Celular (con codigo de pais, ej. 52...)',
    contactEmail: 'Correo electronico',
    contactsShow: 'Mostrar directorio',
    contactsHide: 'Ocultar directorio',
    summaryObjetivos: 'Objetivos',
    summaryAcciones: 'Acciones totales',
    summaryVencidas: 'Acciones vencidas',
    summaryPorVencer: 'Por vencer en 7 dias',
    summaryValidar: 'Elementos pendientes de validar',
    sugerirPrioridadSubtitle:
      'Babel revisara cada accion de tu plan y propondra su Factibilidad e Impacto economico; podras validar o corregir cada una desde el menu correspondiente.',
    sugerirPrioridadBtn: 'Sugerir Factibilidad e Impacto con IA',
    sugerirPrioridadGenerando: 'Analizando acciones...',
    sugerirPrioridadErrorHint: 'Puedes seguir asignando Factibilidad e Impacto manualmente mientras tanto.',
    entornoIaTitle: 'Amenazas y Oportunidades con IA',
    entornoIaSubtitle:
      'Pega aqui el resumen de tu Fase 2 (Analisis de Mercado: PESTEL, Fuerzas del Mercado, Tendencias y Prospectiva a 5 anos). La IA tambien considera aspectos de Responsabilidad Socio Ambiental (ESG) dentro del mismo texto.',
    entornoIaPlaceholder: 'Pega aqui el resumen de tu Fase 2...',
    entornoStakeholderHint:
      'Ya tienes pegado tu resumen de la Fase 5: la IA tambien usara la Matriz de Impacto en Stakeholders que contiene para identificar amenazas y oportunidades por grupo de interes (empleados, accionistas, clientes, proveedores, medio ambiente, sociedad y gobierno).',
    entornoStakeholderMissingHint:
      'Consejo: si primero pegas tu resumen de la Fase 5 en la tarjeta de Objetivos BSC (mas abajo), la IA tambien podra usar su Matriz de Impacto en Stakeholders para relacionar cada amenaza u oportunidad con un grupo de interes especifico (empleados, accionistas, clientes, proveedores, medio ambiente, sociedad y gobierno). Es opcional: si no lo haces, esta tarjeta funciona igual.',
    entornoIaBtn: 'Sugerir Amenazas y Oportunidades con IA',
    entornoIaBtnAgain: 'Volver a sugerir Amenazas y Oportunidades con IA',
    entornoIaGenerando: 'Analizando el resumen...',
    entornoIaErrorHint: 'Puedes seguir agregando Amenazas y Oportunidades manualmente mientras tanto.',
    capacidadIaTitle: 'Capacidades con IA',
    capacidadIaSubtitle:
      'Pega aqui el resumen de tu Fase 3 (Capacidades Clave: basicas y diferenciadoras). Necesitas al menos una Amenaza u Oportunidad ya registrada para poder vincular las capacidades.',
    capacidadIaPlaceholder: 'Pega aqui el resumen de tu Fase 3...',
    capacidadIaBtn: 'Sugerir Capacidades con IA',
    capacidadIaBtnAgain: 'Volver a sugerir Capacidades con IA',
    capacidadIaGenerando: 'Analizando el resumen...',
    capacidadIaErrorHint: 'Puedes seguir agregando fortalezas y debilidades manualmente mientras tanto.',
    objetivoBscIaTitle: 'Objetivos BSC con IA',
    objetivoBscIaSubtitle:
      'Pega aqui el resumen de tu Fase 5 (Balanced Scorecard + OKRs). Solo se sugeriran objetivos para Clientes, Procesos Internos y Aprendizaje/Crecimiento (la perspectiva Financiera se captura en Objetivos Financieros).',
    objetivoBscIaPlaceholder: 'Pega aqui el resumen de tu Fase 5...',
    objetivoBscIaBtn: 'Sugerir Objetivos con IA',
    objetivoBscIaBtnAgain: 'Volver a sugerir Objetivos con IA',
    objetivoBscIaGenerando: 'Analizando el resumen...',
    objetivoBscIaErrorHint: 'Puedes seguir agregando objetivos manualmente mientras tanto.',
    convocatoriaIaTitle: 'Convocatorias y Fondos con IA',
    convocatoriaIaSubtitle:
      'Pega aqui el resumen de tu Fase 1, punto 5 (Vinculacion con los ODS y Fondos). Estas convocatorias cambian de fecha con frecuencia: verifica siempre vigencia y requisitos exactos antes de aplicar.',
    convocatoriaIaPlaceholder: 'Pega aqui el resumen de tu Fase 1...',
    convocatoriaIaBtn: 'Sugerir Convocatorias con IA',
    convocatoriaIaBtnAgain: 'Volver a sugerir Convocatorias con IA',
    convocatoriaIaGenerando: 'Analizando el resumen...',
    convocatoriaIaErrorHint: 'Puedes seguir agregando convocatorias manualmente mientras tanto.',
    addConvocatoria: 'Agregar convocatoria o fondo',
    convocatoriaTipo: 'Tipo',
    internacional: 'Internacional',
    nacional: 'Nacional/local',
    convocatoriaNombre: 'Nombre del fondo o programa',
    convocatoriaNombrePlaceholder: 'Ej. Fondo Multilateral de Inversiones (FOMIN)',
    convocatoriaRequisito: 'Requisito clave',
    convocatoriaRequisitoPlaceholder: 'Ej. Empresas con impacto socioambiental verificable',
    addObjetivo: 'Agregar objetivo de negocio',
    perspectivaLabel: 'Perspectiva (Balanced Scorecard)',
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
    sugerirAccionesBtn: 'Sugerir acciones con IA',
    sugerirAccionesGenerando: 'Proponiendo acciones...',
    accionDesc: 'Descripcion de la accion',
    accionPlaceholder: 'Ej. Cotizar 3 proveedores de ERP',
    crossLabel: 'Areas de apoyo (crossfuncional)',
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
  },
  en: {
    title: 'Strategic Action Plan',
    subtitle: 'For each business objective, log the threats or opportunities in the environment, your strengths or weaknesses facing them, the project that addresses them, and the concrete actions to get it done.',
    contactsTitle: 'Contact Directory',
    contactsSubtitle: 'Name and phone number for each owner, so reminders can be sent over WhatsApp.',
    addContact: 'Add contact',
    contactName: 'Name',
    contactPhone: 'Phone (with country code, e.g. 52...)',
    contactEmail: 'Email',
    contactsShow: 'Show directory',
    contactsHide: 'Hide directory',
    summaryObjetivos: 'Objectives',
    summaryAcciones: 'Total actions',
    summaryVencidas: 'Overdue actions',
    summaryPorVencer: 'Due within 7 days',
    summaryValidar: 'Items pending validation',
    sugerirPrioridadSubtitle:
      'Babel will review every action in your plan and propose its Feasibility and Economic Impact; you can validate or correct each one from its dropdown.',
    sugerirPrioridadBtn: 'Suggest Feasibility & Impact with AI',
    sugerirPrioridadGenerando: 'Analyzing actions...',
    sugerirPrioridadErrorHint: 'You can keep assigning Feasibility and Impact manually in the meantime.',
    entornoIaTitle: 'Threats and Opportunities with AI',
    entornoIaSubtitle:
      'Paste your Phase 2 summary here (Market Analysis: PESTEL, Market Forces, Trends and 5-Year Outlook). The AI also considers Environmental, Social and Governance (ESG) aspects within the same text.',
    entornoIaPlaceholder: 'Paste your Phase 2 summary here...',
    entornoStakeholderHint:
      'You already have your Phase 5 summary pasted: the AI will also use its Stakeholder Impact Matrix to identify threats and opportunities by stakeholder group (employees, shareholders, customers, suppliers, environment, society and government).',
    entornoStakeholderMissingHint:
      'Tip: if you paste your Phase 5 summary in the BSC Objectives card (further below) first, the AI will also be able to use its Stakeholder Impact Matrix to tie each threat or opportunity to a specific stakeholder group (employees, shareholders, customers, suppliers, environment, society and government). This is optional: this card works the same either way.',
    entornoIaBtn: 'Suggest Threats and Opportunities with AI',
    entornoIaBtnAgain: 'Suggest Threats and Opportunities again with AI',
    entornoIaGenerando: 'Analyzing summary...',
    entornoIaErrorHint: 'You can keep adding Threats and Opportunities manually in the meantime.',
    capacidadIaTitle: 'Capabilities with AI',
    capacidadIaSubtitle:
      'Paste your Phase 3 summary here (Key Capabilities: basic and differentiating). You need at least one Threat or Opportunity already registered to link the capabilities to.',
    capacidadIaPlaceholder: 'Paste your Phase 3 summary here...',
    capacidadIaBtn: 'Suggest Capabilities with AI',
    capacidadIaBtnAgain: 'Suggest Capabilities again with AI',
    capacidadIaGenerando: 'Analyzing summary...',
    capacidadIaErrorHint: 'You can keep adding strengths and weaknesses manually in the meantime.',
    objetivoBscIaTitle: 'BSC Objectives with AI',
    objetivoBscIaSubtitle:
      'Paste your Phase 5 summary here (Balanced Scorecard + OKRs). Only Customer, Internal Processes, and Learning & Growth objectives will be suggested (the Financial perspective is captured in Financial Objectives).',
    objetivoBscIaPlaceholder: 'Paste your Phase 5 summary here...',
    objetivoBscIaBtn: 'Suggest Objectives with AI',
    objetivoBscIaBtnAgain: 'Suggest Objectives again with AI',
    objetivoBscIaGenerando: 'Analyzing summary...',
    objetivoBscIaErrorHint: 'You can keep adding objectives manually in the meantime.',
    convocatoriaIaTitle: 'Funding Calls with AI',
    convocatoriaIaSubtitle:
      'Paste your Phase 1 summary here, point 5 (SDG and Funding Alignment). These calls change deadlines frequently: always verify current validity and exact requirements before applying.',
    convocatoriaIaPlaceholder: 'Paste your Phase 1 summary here...',
    convocatoriaIaBtn: 'Suggest Funding Calls with AI',
    convocatoriaIaBtnAgain: 'Suggest Funding Calls again with AI',
    convocatoriaIaGenerando: 'Analyzing summary...',
    convocatoriaIaErrorHint: 'You can keep adding funding calls manually in the meantime.',
    addConvocatoria: 'Add funding call or program',
    convocatoriaTipo: 'Type',
    internacional: 'International',
    nacional: 'National/local',
    convocatoriaNombre: 'Fund or program name',
    convocatoriaNombrePlaceholder: 'E.g. Multilateral Investment Fund (MIF)',
    convocatoriaRequisito: 'Key requirement',
    convocatoriaRequisitoPlaceholder: 'E.g. Companies with verifiable socio-environmental impact',
    addObjetivo: 'Add business objective',
    perspectivaLabel: 'Perspective (Balanced Scorecard)',
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
    sugerirAccionesBtn: 'Suggest actions with AI',
    sugerirAccionesGenerando: 'Proposing actions...',
    accionDesc: 'Action description',
    accionPlaceholder: 'E.g. Get quotes from 3 ERP vendors',
    crossLabel: 'Supporting areas (cross-functional)',
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
  },
};

function newObjetivo(): Objetivo {
  return { id: generateId(), perspectiva: 'financiera', texto: '', validado: false };
}
function newEntorno(objetivoId: string, tipo: EntornoTipo): AmenazaOportunidad {
  return { id: generateId(), objetivoId: objetivoId, tipo: tipo, descripcion: '', validado: false };
}
function newFD(entornoId: string, tipo: FDTipo): FortalezaDebilidad {
  return { id: generateId(), entornoId: entornoId, tipo: tipo, descripcion: '', validado: false };
}
function newConvocatoria(tipo: ConvocatoriaTipo): Convocatoria {
  return { id: generateId(), tipo: tipo, nombre: '', requisito: '', validado: false };
}
function newProyecto(fdId: string): Proyecto {
  return { id: generateId(), fdId: fdId, nombre: '', responsableRoleKey: '', responsableNombre: '', validado: false };
}
function newAccion(proyectoId: string, rank: number): Accion {
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
  };
}

export default function PlanAccionBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const [objetivos, setObjetivos] = React.useState<Objetivo[]>([]);
  const [entornos, setEntornos] = React.useState<AmenazaOportunidad[]>([]);
  const [fds, setFds] = React.useState<FortalezaDebilidad[]>([]);
  const [proyectos, setProyectos] = React.useState<Proyecto[]>([]);
  const [acciones, setAcciones] = React.useState<Accion[]>([]);
  const [convocatorias, setConvocatorias] = React.useState<Convocatoria[]>([]);
  const [contactos, setContactos] = React.useState<Contacto[]>([]);
  const [expanded, setExpanded] = React.useState<ExpandedMap>({});
  const [prioGenerating, setPrioGenerating] = React.useState(false);
  const [prioGenError, setPrioGenError] = React.useState('');
  const [resumenFase2, setResumenFase2] = React.useState('');
  const [entornoGenerating, setEntornoGenerating] = React.useState(false);
  const [entornoGenError, setEntornoGenError] = React.useState('');
  const [entornoYaSugerido, setEntornoYaSugerido] = React.useState(false);
  const [resumenFase3, setResumenFase3] = React.useState('');
  const [capacidadGenerating, setCapacidadGenerating] = React.useState(false);
  const [capacidadGenError, setCapacidadGenError] = React.useState('');
  const [capacidadYaSugerido, setCapacidadYaSugerido] = React.useState(false);
  const [resumenFase5, setResumenFase5] = React.useState('');
  const [objetivoBscGenerating, setObjetivoBscGenerating] = React.useState(false);
  const [objetivoBscGenError, setObjetivoBscGenError] = React.useState('');
  const [objetivoBscYaSugerido, setObjetivoBscYaSugerido] = React.useState(false);
  const [resumenFase1, setResumenFase1] = React.useState('');
  const [convocatoriaGenerating, setConvocatoriaGenerating] = React.useState(false);
  const [convocatoriaGenError, setConvocatoriaGenError] = React.useState('');
  const [convocatoriaYaSugerido, setConvocatoriaYaSugerido] = React.useState(false);
  const [accionGenerating, setAccionGenerating] = React.useState<Record<string, boolean>>({});
  const [accionGenError, setAccionGenError] = React.useState<Record<string, string>>({});
  const [loaded, setLoaded] = React.useState(false);
  const [orgAssignments, setOrgAssignments] = React.useState<OrgAssignments>({});
  const [boardPresidente, setBoardPresidente] = React.useState('');
  const [boardSecretario, setBoardSecretario] = React.useState('');
  const [boardConsejeros, setBoardConsejeros] = React.useState<{ id: string; nombre: string }[]>([]);
  const [contactosOpen, setContactosOpen] = React.useState(false);
  const [finGoalsData, setFinGoalsData] = React.useState<FinGoalsSaved | null>(null);
  const [authUser, setAuthUser] = React.useState<User | null>(null);
  const [madurezResult, setMadurezResult] = React.useState<AssessmentResult | null>(null);
  const [babelFase1Summary, setBabelFase1Summary] = React.useState('');
  const [babelFase2Summary, setBabelFase2Summary] = React.useState('');
  const [babelFase3Summary, setBabelFase3Summary] = React.useState('');
  const [babelFase5Summary, setBabelFase5Summary] = React.useState('');

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!authUser) {
      setMadurezResult(null);
      setBabelFase1Summary('');
      setBabelFase2Summary('');
      setBabelFase3Summary('');
      setBabelFase5Summary('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const answers = await getLatestAssessmentAnswers(authUser.uid);
        if (!cancelled && answers) {
          const dims = getMaturityDimensions(lang);
          setMadurezResult(computeResults(dims, answers));
        }
      } catch (err) {
        console.error(err);
      }
      try {
        const session = await getBabelSessionIfExists(authUser.uid);
        if (!cancelled && session) {
          const phases = session.phases || [];
          const fase1 = phases.find((p) => p.phase === 1 && p.approved);
          const fase2 = phases.find((p) => p.phase === 2 && p.approved);
          const fase3 = phases.find((p) => p.phase === 3 && p.approved);
          const fase5 = phases.find((p) => p.phase === 5 && p.approved);
          if (fase1 && fase1.summary) setBabelFase1Summary(fase1.summary);
          if (fase2 && fase2.summary) setBabelFase2Summary(fase2.summary);
          if (fase3 && fase3.summary) setBabelFase3Summary(fase3.summary);
          if (fase5 && fase5.summary) setBabelFase5Summary(fase5.summary);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, lang]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.objetivos)) setObjetivos(parsed.objetivos);
        if (parsed && Array.isArray(parsed.entornos)) setEntornos(parsed.entornos);
        if (parsed && Array.isArray(parsed.fds)) setFds(parsed.fds);
        if (parsed && Array.isArray(parsed.proyectos)) setProyectos(parsed.proyectos);
        if (parsed && Array.isArray(parsed.acciones)) setAcciones(parsed.acciones);
        if (parsed && Array.isArray(parsed.convocatorias)) setConvocatorias(parsed.convocatorias);
        if (parsed && typeof parsed.resumenFase1 === 'string') setResumenFase1(parsed.resumenFase1);
        if (parsed && typeof parsed.resumenFase2 === 'string') setResumenFase2(parsed.resumenFase2);
        if (parsed && typeof parsed.resumenFase3 === 'string') setResumenFase3(parsed.resumenFase3);
        if (parsed && typeof parsed.resumenFase5 === 'string') setResumenFase5(parsed.resumenFase5);
        if (parsed && typeof parsed.convocatoriaYaSugerido === 'boolean') setConvocatoriaYaSugerido(parsed.convocatoriaYaSugerido);
        if (parsed && typeof parsed.entornoYaSugerido === 'boolean') setEntornoYaSugerido(parsed.entornoYaSugerido);
        if (parsed && typeof parsed.capacidadYaSugerido === 'boolean') setCapacidadYaSugerido(parsed.capacidadYaSugerido);
        if (parsed && typeof parsed.objetivoBscYaSugerido === 'boolean') setObjetivoBscYaSugerido(parsed.objetivoBscYaSugerido);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawC = window.localStorage.getItem(CONTACTS_KEY);
      if (rawC) {
        const parsedC = JSON.parse(rawC);
        if (Array.isArray(parsedC)) setContactos(parsedC);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawOrg = window.localStorage.getItem(ORG_KEY);
      if (rawOrg) {
        const parsedOrg = JSON.parse(rawOrg);
        if (parsedOrg && typeof parsedOrg === 'object') setOrgAssignments(parsedOrg);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawBoard = window.localStorage.getItem(BOARD_KEY);
      if (rawBoard) {
        const parsedBoard = JSON.parse(rawBoard);
        if (parsedBoard && typeof parsedBoard.presidente === 'string') setBoardPresidente(parsedBoard.presidente);
        if (parsedBoard && typeof parsedBoard.secretario === 'string') setBoardSecretario(parsedBoard.secretario);
        if (parsedBoard && Array.isArray(parsedBoard.consejeros)) {
          setBoardConsejeros(
            parsedBoard.consejeros
              .filter((c: unknown) => c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string')
              .map((c: { id: string; nombre?: unknown }) => ({ id: c.id, nombre: typeof c.nombre === 'string' ? c.nombre : '' }))
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawFin = window.localStorage.getItem(FIN_GOALS_KEY);
      if (rawFin) {
        const parsedFin = JSON.parse(rawFin);
        if (parsedFin && parsedFin.input && parsedFin.result) setFinGoalsData(parsedFin);
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      const blob = {
        objetivos: objetivos,
        entornos: entornos,
        fds: fds,
        proyectos: proyectos,
        acciones: acciones,
        convocatorias: convocatorias,
        resumenFase1: resumenFase1,
        resumenFase2: resumenFase2,
        resumenFase3: resumenFase3,
        resumenFase5: resumenFase5,
        convocatoriaYaSugerido: convocatoriaYaSugerido,
        entornoYaSugerido: entornoYaSugerido,
        capacidadYaSugerido: capacidadYaSugerido,
        objetivoBscYaSugerido: objetivoBscYaSugerido,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } catch (err) {
      console.error(err);
    }
  }, [
    objetivos,
    entornos,
    fds,
    proyectos,
    acciones,
    convocatorias,
    resumenFase1,
    resumenFase2,
    resumenFase3,
    resumenFase5,
    convocatoriaYaSugerido,
    entornoYaSugerido,
    capacidadYaSugerido,
    objetivoBscYaSugerido,
    loaded,
  ]);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(contactos));
    } catch (err) {
      console.error(err);
    }
  }, [contactos, loaded]);

  React.useEffect(() => {
    if (!loaded) return;
    const roster = orgRosterEntries();
    const claimedKeys: Record<string, boolean> = {};
    contactos.forEach((c) => {
      (Array.isArray(c.roleKeys) ? c.roleKeys : []).forEach((k) => {
        claimedKeys[k] = true;
      });
    });
    const toAdd = roster.filter((e) => !claimedKeys[e.key]);
    if (toAdd.length === 0) return;
    // Antes de crear una fila nueva por cada rol sin reclamar, revisa si ya
    // existe un contacto con ese MISMO nombre (comparacion sin mayusculas ni
    // espacios extra) y, de ser asi, le agrega el rol ahi en vez de duplicar
    // la fila. Asi "Baruch Beltran" en dos roles distintos del organigrama
    // termina en una sola fila del directorio, no en dos.
    setContactos((prev) => {
      let next = prev;
      let changed = false;
      toAdd.forEach((e) => {
        const nombreNorm = e.nombre.trim().toLowerCase();
        const matchIdx = next.findIndex((c) => c.nombre.trim().toLowerCase() === nombreNorm && nombreNorm !== '');
        if (matchIdx !== -1) {
          const existente = next[matchIdx];
          const keysExistentes = Array.isArray(existente.roleKeys) ? existente.roleKeys : [];
          if (keysExistentes.indexOf(e.key) === -1) {
            const copia = next.slice();
            copia[matchIdx] = Object.assign({}, existente, { roleKeys: keysExistentes.concat([e.key]) });
            next = copia;
            changed = true;
          }
        } else {
          next = next.concat([{ id: generateId(), nombre: e.nombre, celular: '', correo: '', roleKeys: [e.key] }]);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [loaded, orgAssignments, boardPresidente, boardSecretario, boardConsejeros, contactos]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = Object.assign({}, prev);
      next[id] = !prev[id];
      return next;
    });
  };

  const resolvePersonForRole = (roleKey: string): string => {
    if (!roleKey) return '';
    if (roleKey === 'consejo_administrativo') return boardPresidente;
    const a = orgAssignments[roleKey];
    return a && a.person ? a.person : '';
  };

  const roleLabelFor = (roleKey: string): string => {
    if (roleKey === BOARD_PRESIDENTE_KEY) return lang === 'en' ? 'Board President' : 'Presidente del Consejo';
    if (roleKey === BOARD_SECRETARIO_KEY) return lang === 'en' ? 'Board Secretary' : 'Secretario del Consejo';
    if (roleKey.indexOf(BOARD_CONSEJERO_PREFIX) === 0) return lang === 'en' ? 'Board Member' : 'Consejero';
    for (let i = 0; i < ROLE_OPTIONS.length; i++) {
      if (ROLE_OPTIONS[i].key === roleKey) return lang === 'en' ? ROLE_OPTIONS[i].nameEn : ROLE_OPTIONS[i].nameEs;
    }
    return roleKey;
  };

  const orgRosterEntries = (): { key: string; nombre: string }[] => {
    const list: { key: string; nombre: string }[] = [];
    if (boardPresidente.trim()) list.push({ key: BOARD_PRESIDENTE_KEY, nombre: boardPresidente });
    if (boardSecretario.trim()) list.push({ key: BOARD_SECRETARIO_KEY, nombre: boardSecretario });
    boardConsejeros.forEach((c) => {
      if (c.nombre.trim()) list.push({ key: BOARD_CONSEJERO_PREFIX + c.id, nombre: c.nombre });
    });
    ROLE_OPTIONS.forEach((r) => {
      if (r.key === 'consejo_administrativo') return;
      const nombre = resolvePersonForRole(r.key);
      if (nombre.trim()) list.push({ key: r.key, nombre: nombre });
    });
    return list;
  };

  const syncNameToOrgChart = (roleKeys: string[], nombre: string) => {
    if (!Array.isArray(roleKeys) || roleKeys.length === 0) return;
    let boardChanged = false;
    let nextPresidente = boardPresidente;
    let nextSecretario = boardSecretario;
    let nextAssignments = orgAssignments;
    let assignmentsChanged = false;
    let nextConsejeros = boardConsejeros;
    let consejerosChanged = false;
    roleKeys.forEach((rk) => {
      if (rk === BOARD_PRESIDENTE_KEY) {
        nextPresidente = nombre;
        boardChanged = true;
      } else if (rk === BOARD_SECRETARIO_KEY) {
        nextSecretario = nombre;
        boardChanged = true;
      } else if (rk.indexOf(BOARD_CONSEJERO_PREFIX) === 0) {
        const consejeroId = rk.slice(BOARD_CONSEJERO_PREFIX.length);
        if (!consejerosChanged) nextConsejeros = boardConsejeros.slice();
        nextConsejeros = nextConsejeros.map((c) => (c.id === consejeroId ? Object.assign({}, c, { nombre: nombre }) : c));
        consejerosChanged = true;
      } else {
        if (!assignmentsChanged) nextAssignments = Object.assign({}, orgAssignments);
        nextAssignments[rk] = Object.assign({}, orgAssignments[rk], { person: nombre });
        assignmentsChanged = true;
      }
    });
    if (boardChanged || consejerosChanged) {
      if (boardChanged) {
        setBoardPresidente(nextPresidente);
        setBoardSecretario(nextSecretario);
      }
      if (consejerosChanged) setBoardConsejeros(nextConsejeros);
      try {
        const rawBoard = window.localStorage.getItem(BOARD_KEY);
        const parsedBoard = rawBoard ? JSON.parse(rawBoard) : {};
        const blobPatch: Record<string, unknown> = {};
        if (boardChanged) {
          blobPatch.presidente = nextPresidente;
          blobPatch.secretario = nextSecretario;
        }
        if (consejerosChanged) {
          // Conserva el resto de los campos de cada consejero (tipo, especialidad,
          // derecho a voto, etc.) tal como los guardo el Organigrama; aqui solo se
          // actualiza el nombre.
          const rawConsejeros = Array.isArray(parsedBoard.consejeros) ? parsedBoard.consejeros : [];
          blobPatch.consejeros = rawConsejeros.map((rc: { id?: string }) => {
            const match = nextConsejeros.find((nc) => nc.id === rc.id);
            return match ? Object.assign({}, rc, { nombre: match.nombre }) : rc;
          });
        }
        const blob = Object.assign({}, parsedBoard, blobPatch);
        window.localStorage.setItem(BOARD_KEY, JSON.stringify(blob));
      } catch (err) {
        console.error(err);
      }
    }
    if (assignmentsChanged) {
      setOrgAssignments(nextAssignments);
      try {
        window.localStorage.setItem(ORG_KEY, JSON.stringify(nextAssignments));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const addRoleToContacto = (contactoId: string, roleKey: string) => {
    setContactos((prev) => {
      // Recuerda a que contactos se les quito el rol en esta operacion, para
      // poder borrar despues la fila si quedo vacia (sin roles, sin celular
      // y sin correo) — asi "es la misma persona que..." no deja una fila
      // fantasma repetida con el mismo nombre.
      const idsQueSePuedenQuedarVacios: Record<string, boolean> = {};
      const mapped = prev.map((c) => {
        if (c.id === contactoId) {
          const existing = Array.isArray(c.roleKeys) ? c.roleKeys : [];
          if (existing.indexOf(roleKey) !== -1) return c;
          return Object.assign({}, c, { roleKeys: existing.concat([roleKey]) });
        }
        const otherKeys = Array.isArray(c.roleKeys) ? c.roleKeys : [];
        if (otherKeys.indexOf(roleKey) !== -1) {
          idsQueSePuedenQuedarVacios[c.id] = true;
          return Object.assign({}, c, { roleKeys: otherKeys.filter((k) => k !== roleKey) });
        }
        return c;
      });
      return mapped.filter((c) => {
        if (!idsQueSePuedenQuedarVacios[c.id]) return true;
        const sinRoles = !Array.isArray(c.roleKeys) || c.roleKeys.length === 0;
        const sinCelular = c.celular.trim() === '';
        const sinCorreo = (c.correo || '').trim() === '';
        return !(sinRoles && sinCelular && sinCorreo);
      });
    });
  };

  const removeRoleFromContacto = (contactoId: string, roleKey: string) => {
    setContactos((prev) =>
      prev.map((c) =>
        c.id === contactoId
          ? Object.assign({}, c, { roleKeys: (Array.isArray(c.roleKeys) ? c.roleKeys : []).filter((k) => k !== roleKey) })
          : c
      )
    );
  };

  const resolveCelular = (nombre: string, roleKey?: string): string => {
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
  };

  const findProyectoByFd = (fdId: string): Proyecto | undefined => {
    for (let i = 0; i < proyectos.length; i++) {
      if (proyectos[i].fdId === fdId) return proyectos[i];
    }
    return undefined;
  };

  const addContacto = () => setContactos((prev) => prev.concat([{ id: generateId(), nombre: '', celular: '', correo: '', roleKeys: [] }]));
  const updateContacto = (id: string, patch: Partial<Contacto>) =>
    setContactos((prev) => prev.map((c) => (c.id === id ? Object.assign({}, c, patch) : c)));
  const removeContacto = (id: string) => setContactos((prev) => prev.filter((c) => c.id !== id));

  const addObjetivo = () => setObjetivos((prev) => prev.concat([newObjetivo()]));
  const agregarObjetivosFinancieros = () => {
    if (!finGoalsData) return;
    const input = finGoalsData.input || {};
    const result = finGoalsData.result || {};
    const nuevos: Objetivo[] = [];
    const targetRevenue = typeof result.targetRevenue === 'number' ? result.targetRevenue : null;
    const channels = Array.isArray(input.channels) ? input.channels : [];
    channels.forEach((c) => {
      if (!c || !c.name) return;
      const monto = targetRevenue !== null ? Math.round(targetRevenue * c.pct) : null;
      const texto =
        lang === 'en'
          ? monto !== null
            ? 'Reach $' + monto.toLocaleString() + ' in revenue through the "' + c.name + '" channel'
            : 'Grow revenue through the "' + c.name + '" channel'
          : monto !== null
            ? 'Alcanzar $' + monto.toLocaleString() + ' de ingresos a traves del canal "' + c.name + '"'
            : 'Aumentar los ingresos del canal "' + c.name + '"';
      nuevos.push({ id: generateId(), perspectiva: 'financiera', texto: texto, validado: false });
    });
    if (typeof result.fixedTotal === 'number' && typeof result.breakEven === 'number') {
      const texto =
        lang === 'en'
          ? 'Cover fixed costs of $' + Math.round(result.fixedTotal).toLocaleString() + ' and reach the break-even point of $' + Math.round(result.breakEven).toLocaleString() + ' in sales'
          : 'Cubrir gastos fijos de $' + Math.round(result.fixedTotal).toLocaleString() + ' y alcanzar el punto de equilibrio de $' + Math.round(result.breakEven).toLocaleString() + ' en ventas';
      nuevos.push({ id: generateId(), perspectiva: 'financiera', texto: texto, validado: false });
    }
    if (typeof input.desiredProfit === 'number' && input.desiredProfit > 0) {
      const texto =
        lang === 'en'
          ? 'Reach a profit of $' + Math.round(input.desiredProfit).toLocaleString()
          : 'Alcanzar una utilidad de $' + Math.round(input.desiredProfit).toLocaleString();
      nuevos.push({ id: generateId(), perspectiva: 'financiera', texto: texto, validado: false });
    }
    if (nuevos.length === 0) return;
    setObjetivos((prev) => sortObjetivosPorPerspectiva(prev.concat(nuevos)));
  };
  const updateObjetivo = (id: string, patch: Partial<Objetivo>) =>
    setObjetivos((prev) => prev.map((o) => (o.id === id ? Object.assign({}, o, patch) : o)));
  const removeObjetivo = (id: string) => {
    const entornosToRemove = entornos.filter((e) => e.objetivoId === id).map((e) => e.id);
    const fdsToRemove = fds.filter((f) => entornosToRemove.indexOf(f.entornoId) !== -1).map((f) => f.id);
    const proyectosToRemove = proyectos.filter((p) => fdsToRemove.indexOf(p.fdId) !== -1).map((p) => p.id);
    setObjetivos((prev) => prev.filter((o) => o.id !== id));
    setEntornos((prev) => prev.filter((e) => e.objetivoId !== id));
    setFds((prev) => prev.filter((f) => entornosToRemove.indexOf(f.entornoId) === -1));
    setProyectos((prev) => prev.filter((p) => fdsToRemove.indexOf(p.fdId) === -1));
    setAcciones((prev) => prev.filter((a) => proyectosToRemove.indexOf(a.proyectoId) === -1));
  };

  const addConvocatoria = (tipo: ConvocatoriaTipo) => setConvocatorias((prev) => prev.concat([newConvocatoria(tipo)]));
  const updateConvocatoria = (id: string, patch: Partial<Convocatoria>) =>
    setConvocatorias((prev) => prev.map((c) => (c.id === id ? Object.assign({}, c, patch) : c)));
  const removeConvocatoria = (id: string) => setConvocatorias((prev) => prev.filter((c) => c.id !== id));

  const addEntorno = (objetivoId: string, tipo: EntornoTipo) => setEntornos((prev) => prev.concat([newEntorno(objetivoId, tipo)]));
  const updateEntorno = (id: string, patch: Partial<AmenazaOportunidad>) =>
    setEntornos((prev) => prev.map((e) => (e.id === id ? Object.assign({}, e, patch) : e)));
  const removeEntorno = (id: string) => {
    const fdsToRemove = fds.filter((f) => f.entornoId === id).map((f) => f.id);
    const proyectosToRemove = proyectos.filter((p) => fdsToRemove.indexOf(p.fdId) !== -1).map((p) => p.id);
    setEntornos((prev) => prev.filter((e) => e.id !== id));
    setFds((prev) => prev.filter((f) => f.entornoId !== id));
    setProyectos((prev) => prev.filter((p) => fdsToRemove.indexOf(p.fdId) === -1));
    setAcciones((prev) => prev.filter((a) => proyectosToRemove.indexOf(a.proyectoId) === -1));
  };

  const addFD = (entornoId: string, tipo: FDTipo) => {
    const fd = newFD(entornoId, tipo);
    setFds((prev) => prev.concat([fd]));
    setProyectos((prev) => prev.concat([newProyecto(fd.id)]));
  };
  const updateFD = (id: string, patch: Partial<FortalezaDebilidad>) =>
    setFds((prev) => prev.map((f) => (f.id === id ? Object.assign({}, f, patch) : f)));
  const removeFD = (id: string) => {
    const proyectosToRemove = proyectos.filter((p) => p.fdId === id).map((p) => p.id);
    setFds((prev) => prev.filter((f) => f.id !== id));
    setProyectos((prev) => prev.filter((p) => p.fdId !== id));
    setAcciones((prev) => prev.filter((a) => proyectosToRemove.indexOf(a.proyectoId) === -1));
  };

  const addProyecto = (fdId: string) => setProyectos((prev) => prev.concat([newProyecto(fdId)]));
  const updateProyecto = (id: string, patch: Partial<Proyecto>) =>
    setProyectos((prev) => prev.map((p) => (p.id === id ? Object.assign({}, p, patch) : p)));
  const removeProyecto = (id: string) => {
    setProyectos((prev) => prev.filter((p) => p.id !== id));
    setAcciones((prev) => prev.filter((a) => a.proyectoId !== id));
  };

  const addAccion = (proyectoId: string) => setAcciones((prev) => prev.concat([newAccion(proyectoId, priorityRank('media', 'medio'))]));
  const updateAccion = (id: string, patch: Partial<Accion>) =>
    setAcciones((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const merged = Object.assign({}, a, patch);
        const oldSuggested = suggestedDate(priorityRank(a.factibilidad, a.impacto));
        if ((patch.factibilidad || patch.impacto) && (!a.fecha || a.fecha === oldSuggested)) {
          merged.fecha = suggestedDate(priorityRank(merged.factibilidad, merged.impacto));
        }
        return merged;
      })
    );
  const removeAccion = (id: string) => setAcciones((prev) => prev.filter((a) => a.id !== id));

  const buildAccionesParaIA = (): Array<{ id: string; descripcion: string; entregable: string; contexto: string }> => {
    const out: Array<{ id: string; descripcion: string; entregable: string; contexto: string }> = [];
    objetivos.forEach((o) => {
      const entornosDeO = entornos.filter((e) => e.objetivoId === o.id);
      entornosDeO.forEach((e) => {
        const fdsDeE = fds.filter((f) => f.entornoId === e.id);
        fdsDeE.forEach((f) => {
          const proyectosDeF = proyectos.filter((p) => p.fdId === f.id);
          proyectosDeF.forEach((p) => {
            const accionesDeP = acciones.filter((a) => a.proyectoId === p.id && !a.validado);
            accionesDeP.forEach((a) => {
              const contexto =
                'Objetivo: ' + o.texto + ' | ' + (e.tipo === 'amenaza' ? 'Amenaza' : 'Oportunidad') + ': ' + e.descripcion;
              out.push({ id: a.id, descripcion: a.descripcion, entregable: a.entregable, contexto: contexto });
            });
          });
        });
      });
    });
    return out;
  };

  const sugerirAccionesConIA = async (proyectoId: string, f: FortalezaDebilidad, e: AmenazaOportunidad, o: Objetivo) => {
    setAccionGenerating((prev) => Object.assign({}, prev, { [proyectoId]: true }));
    setAccionGenError((prev) => Object.assign({}, prev, { [proyectoId]: '' }));
    setExpanded((prev) => Object.assign({}, prev, { [proyectoId]: true }));
    try {
      const rolesParaIA = ROLE_OPTIONS.map((r) => ({ key: r.key, nombre: roleLabel(r.key, lang) }));
      const res = await fetch('/api/babel/extractor-acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          objetivo: o.texto,
          entornoTipo: e.tipo,
          entornoDescripcion: e.descripcion,
          fdTipo: f.tipo,
          fdDescripcion: f.descripcion,
          roles: rolesParaIA,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        const msg = (data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.');
        setAccionGenError((prev) => Object.assign({}, prev, { [proyectoId]: msg }));
        return;
      }
      const roleKeysValidos = ROLE_OPTIONS.map((r) => r.key);
      const nuevas: Accion[] = [];
      (data.sugerencias as RawAccionIA[]).forEach((raw) => {
        const descripcion = (raw.descripcion || '').trim();
        if (!descripcion) return;
        const nueva = newAccion(proyectoId, priorityRank('media', 'medio'));
        nueva.descripcion = descripcion;
        nueva.entregable = (raw.entregable || '').trim();
        const roleKey = (raw.responsableRoleKey || '').trim();
        if (roleKey && roleKeysValidos.indexOf(roleKey) !== -1) {
          const person = resolvePersonForRole(roleKey);
          nueva.responsableRoleKey = roleKey;
          nueva.responsableNombre = person ? person : '';
        }
        nuevas.push(nueva);
      });
      if (nuevas.length > 0) {
        setAcciones((prev) => prev.concat(nuevas));
      }
    } finally {
      setAccionGenerating((prev) => Object.assign({}, prev, { [proyectoId]: false }));
    }
  };

  const sugerirPrioridadConIA = async () => {
    setPrioGenerating(true);
    setPrioGenError('');
    try {
      const payload = buildAccionesParaIA();
      if (payload.length === 0) {
        setPrioGenError(lang === 'en' ? 'There are no actions yet to evaluate.' : 'Todavia no hay acciones para evaluar.');
        return;
      }
      const res = await fetch('/api/babel/indicadores/priorizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, acciones: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setPrioGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      (data.sugerencias as RawPrioridadIA[]).forEach((raw) => {
        const id = (raw.id || '').trim();
        if (!id) return;
        const existe = acciones.some((a) => a.id === id);
        if (!existe) return;
        const factRaw = (raw.factibilidad || '').trim().toLowerCase();
        const impRaw = (raw.impacto || '').trim().toLowerCase();
        if (!isFactibilidad(factRaw) || !isImpacto(impRaw)) return;
        updateAccion(id, { factibilidad: factRaw, impacto: impRaw, validado: false });
      });
    } finally {
      setPrioGenerating(false);
    }
  };

  const sugerirEntornosConIA = async () => {
    setEntornoGenerating(true);
    setEntornoGenError('');
    try {
      const resumen = resumenFase2.trim();
      if (!resumen) {
        setEntornoGenError(lang === 'en' ? 'Paste your Phase 2 summary first.' : 'Primero pega el resumen de tu Fase 2.');
        return;
      }
      if (objetivos.length === 0) {
        setEntornoGenError(lang === 'en' ? 'Add at least one Strategic Objective first.' : 'Primero agrega al menos un Objetivo Estrategico.');
        return;
      }
      const objetivosParaIA = objetivos.map((o) => ({ id: o.id, perspectiva: o.perspectiva, texto: o.texto }));
      const res = await fetch('/api/babel/extractor-entornos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          resumenFase2: resumen,
          objetivos: objetivosParaIA,
          resumenFase5: resumenFase5.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setEntornoGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      setEntornoYaSugerido(true);
      const objetivoIds = objetivos.map((o) => o.id);
      const nuevos: AmenazaOportunidad[] = [];
      (data.sugerencias as RawEntornoIA[]).forEach((raw) => {
        const objetivoId = (raw.objetivoId || '').trim();
        const tipoRaw = (raw.tipo || '').trim().toLowerCase();
        const descripcion = (raw.descripcion || '').trim();
        if (!objetivoId || objetivoIds.indexOf(objetivoId) === -1) return;
        if (!isEntornoTipo(tipoRaw)) return;
        if (!descripcion) return;
        const eo = newEntorno(objetivoId, tipoRaw);
        eo.descripcion = descripcion;
        nuevos.push(eo);
      });
      if (nuevos.length > 0) {
        setEntornos((prev) => prev.concat(nuevos));
      }
    } finally {
      setEntornoGenerating(false);
    }
  };

  const usarResumenBabelFase3 = () => {
    if (!babelFase3Summary) return;
    if (
      resumenFase3.trim() &&
      !window.confirm(
        lang === 'en'
          ? 'Replace the current text with your Phase 3 summary from Babel?'
          : 'Reemplazar el texto actual con tu resumen de la Fase 3 de Babel?'
      )
    ) {
      return;
    }
    setResumenFase3(babelFase3Summary);
  };

  const usarResumenBabelFase1 = () => {
    if (!babelFase1Summary) return;
    if (
      resumenFase1.trim() &&
      !window.confirm(
        lang === 'en'
          ? 'Replace the current text with your Phase 1 summary from Babel?'
          : 'Reemplazar el texto actual con tu resumen de la Fase 1 de Babel?'
      )
    ) {
      return;
    }
    setResumenFase1(babelFase1Summary);
  };

  const usarResumenBabelFase2 = () => {
    if (!babelFase2Summary) return;
    if (
      resumenFase2.trim() &&
      !window.confirm(
        lang === 'en'
          ? 'Replace the current text with your Phase 2 summary from Babel?'
          : 'Reemplazar el texto actual con tu resumen de la Fase 2 de Babel?'
      )
    ) {
      return;
    }
    setResumenFase2(babelFase2Summary);
  };

  const usarResumenBabelFase5 = () => {
    if (!babelFase5Summary) return;
    if (
      resumenFase5.trim() &&
      !window.confirm(
        lang === 'en'
          ? 'Replace the current text with your Phase 5 summary from Babel?'
          : 'Reemplazar el texto actual con tu resumen de la Fase 5 de Babel?'
      )
    ) {
      return;
    }
    setResumenFase5(babelFase5Summary);
  };

  const agregarPerfilMadurez = () => {
    if (!madurezResult) return;
    const lines = madurezResult.dimensions.map((d) => {
      const labelSet = MATURITY_LEVEL_LABEL[d.level];
      const label = labelSet ? labelSet[lang] : d.level;
      return '- ' + d.tema + ': ' + label;
    });
    const bloque =
      (lang === 'en' ? 'Maturity profile (self-assessment):\n' : 'Perfil de madurez (autodiagnostico):\n') +
      lines.join('\n');
    setResumenFase3((prev) => (prev.trim() ? prev.trim() + '\n\n' + bloque : bloque));
  };

  const sugerirCapacidadesConIA = async () => {
    setCapacidadGenerating(true);
    setCapacidadGenError('');
    try {
      const resumen = resumenFase3.trim();
      if (!resumen) {
        setCapacidadGenError(lang === 'en' ? 'Paste your Phase 3 summary first.' : 'Primero pega el resumen de tu Fase 3.');
        return;
      }
      if (entornos.length === 0) {
        setCapacidadGenError(lang === 'en' ? 'Add at least one Threat/Opportunity first.' : 'Primero agrega al menos una Amenaza/Oportunidad.');
        return;
      }
      const entornosParaIA = entornos.map((e) => ({ id: e.id, tipo: e.tipo, descripcion: e.descripcion }));
      const res = await fetch('/api/babel/extractor-capacidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, resumenFase3: resumen, entornos: entornosParaIA }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setCapacidadGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      setCapacidadYaSugerido(true);
      const entornoIds = entornos.map((e) => e.id);
      const nuevos: FortalezaDebilidad[] = [];
      (data.sugerencias as RawCapacidadIA[]).forEach((raw) => {
        const entornoId = (raw.entornoId || '').trim();
        const descripcion = (raw.descripcion || '').trim();
        if (!entornoId || entornoIds.indexOf(entornoId) === -1) return;
        if (!descripcion) return;
        const fd = newFD(entornoId, 'fortaleza');
        fd.descripcion = descripcion;
        nuevos.push(fd);
      });
      if (nuevos.length > 0) {
        setFds((prev) => prev.concat(nuevos));
      }
    } finally {
      setCapacidadGenerating(false);
    }
  };

  const sugerirObjetivosBSCConIA = async () => {
    setObjetivoBscGenerating(true);
    setObjetivoBscGenError('');
    try {
      const resumen = resumenFase5.trim();
      if (!resumen) {
        setObjetivoBscGenError(lang === 'en' ? 'Paste your Phase 5 summary first.' : 'Primero pega el resumen de tu Fase 5.');
        return;
      }
      const res = await fetch('/api/babel/extractor-objetivos-bsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, resumenFase5: resumen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setObjetivoBscGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      setObjetivoBscYaSugerido(true);
      const nuevos: Objetivo[] = [];
      (data.sugerencias as RawObjetivoBSCIA[]).forEach((raw) => {
        const perspectiva = (raw.perspectiva || '').trim();
        const texto = (raw.texto || '').trim();
        if (!isPerspectivaBSC(perspectiva)) return;
        if (!texto) return;
        nuevos.push({ id: generateId(), perspectiva: perspectiva, texto: texto, validado: false });
      });
      if (nuevos.length > 0) {
        setObjetivos((prev) => sortObjetivosPorPerspectiva(prev.concat(nuevos)));
      }
    } finally {
      setObjetivoBscGenerating(false);
    }
  };

  const sugerirConvocatoriasConIA = async () => {
    setConvocatoriaGenerating(true);
    setConvocatoriaGenError('');
    try {
      const resumen = resumenFase1.trim();
      if (!resumen) {
        setConvocatoriaGenError(lang === 'en' ? 'Paste your Phase 1 summary first.' : 'Primero pega el resumen de tu Fase 1.');
        return;
      }
      const res = await fetch('/api/babel/extractor-convocatorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, resumenFase1: resumen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setConvocatoriaGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      setConvocatoriaYaSugerido(true);
      const nuevas: Convocatoria[] = [];
      (data.sugerencias as RawConvocatoriaIA[]).forEach((raw) => {
        const tipo = (raw.tipo || '').trim();
        const nombre = (raw.nombre || '').trim();
        const requisito = (raw.requisito || '').trim();
        if (!isConvocatoriaTipo(tipo)) return;
        if (!nombre || !requisito) return;
        nuevas.push({ id: generateId(), tipo: tipo, nombre: nombre, requisito: requisito, validado: false });
      });
      if (nuevas.length > 0) {
        setConvocatorias((prev) => prev.concat(nuevas));
      }
    } finally {
      setConvocatoriaGenerating(false);
    }
  };

  const vencidas = acciones.filter((a) => a.estatus !== 'terminado' && daysUntil(a.fecha) < 0);
  const porVencer = acciones.filter((a) => {
    const d = daysUntil(a.fecha);
    return a.estatus !== 'terminado' && d >= 0 && d <= 7;
  });
  let pendientesValidar = 0;
  objetivos.forEach((o) => {
    if (!o.validado) pendientesValidar = pendientesValidar + 1;
  });
  entornos.forEach((e) => {
    if (!e.validado) pendientesValidar = pendientesValidar + 1;
  });
  fds.forEach((f) => {
    if (!f.validado) pendientesValidar = pendientesValidar + 1;
  });
  proyectos.forEach((p) => {
    if (!p.validado) pendientesValidar = pendientesValidar + 1;
  });
  acciones.forEach((a) => {
    if (!a.validado) pendientesValidar = pendientesValidar + 1;
  });

  const ValidateBadge = (props: { validado: boolean; onToggle: () => void }) => {
    return (
      <button
        type="button"
        onClick={props.onToggle}
        className={
          'rounded-full px-2.5 py-1 text-xs font-medium ' +
          (props.validado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')
        }
      >
        {props.validado ? t.validado : t.pendienteValidar}
      </button>
    );
  };

  const renderAccion = (proyectoNombre: string, a: Accion) => {
    const rank = priorityRank(a.factibilidad, a.impacto);
    const tier = priorityTier(rank, lang);
    const celular = resolveCelular(a.responsableNombre, a.responsableRoleKey);
    const d = daysUntil(a.fecha);
    const showDue = a.estatus !== 'terminado' && d <= 7;
    return (
      <div key={a.id} className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.accionDesc}</label>
            <input
              type="text"
              value={a.descripcion}
              onChange={(ev) => updateAccion(a.id, { descripcion: ev.target.value })}
              placeholder={t.accionPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.responsableLabel}</label>
            <select
              value={a.responsableRoleKey}
              onChange={(ev) => {
                const roleKey = ev.target.value;
                const person = resolvePersonForRole(roleKey);
                updateAccion(a.id, { responsableRoleKey: roleKey, responsableNombre: person ? person : a.responsableNombre });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t.responsableLabel}</option>
              {ROLE_OPTIONS.map((opt) => {
                const person = resolvePersonForRole(opt.key);
                const label = roleLabel(opt.key, lang) + (person ? ' - ' + person : '');
                return (
                  <option key={opt.key} value={opt.key}>
                    {label}
                  </option>
                );
              })}
            </select>
            <input
              type="text"
              value={a.responsableNombre}
              onChange={(ev) => updateAccion(a.id, { responsableNombre: ev.target.value })}
              placeholder={t.responsableNombreLabel}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.crossLabel}</label>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
              {ROLE_OPTIONS.map((opt) => {
                const active = a.crossRoleKeys.indexOf(opt.key) !== -1;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      const next = active ? a.crossRoleKeys.filter((k) => k !== opt.key) : a.crossRoleKeys.concat([opt.key]);
                      updateAccion(a.id, { crossRoleKeys: next });
                    }}
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (active ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-400' : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {roleLabel(opt.key, lang)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.entregableLabel}</label>
            <input
              type="text"
              value={a.entregable}
              onChange={(ev) => updateAccion(a.id, { entregable: ev.target.value })}
              placeholder={t.entregablePlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.inversionLabel}</label>
            <input
              type="text"
              value={a.inversion}
              onChange={(ev) => updateAccion(a.id, { inversion: ev.target.value })}
              placeholder={t.inversionPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.factibilidadLabel}</label>
            <select
              value={a.factibilidad}
              onChange={(ev) => updateAccion(a.id, { factibilidad: ev.target.value as Factibilidad })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {FACTIBILIDAD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.impactoLabel}</label>
            <select
              value={a.impacto}
              onChange={(ev) => updateAccion(a.id, { impacto: ev.target.value as Impacto })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {IMPACTO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.prioridadLabel}</label>
            <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + tier.classes}>
              {'#' + rank + ' - ' + tier.label}
            </span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.fechaLabel}</label>
            <input
              type="date"
              value={a.fecha}
              onChange={(ev) => updateAccion(a.id, { fecha: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            {showDue ? (
              <span
                className={
                  'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ' +
                  (d < 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')
                }
              >
                {d < 0 ? t.overdue : t.dueSoon}
              </span>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.estatusLabel}</label>
            <select
              value={a.estatus}
              onChange={(ev) => updateAccion(a.id, { estatus: ev.target.value as Estatus })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {ESTATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <ValidateBadge validado={a.validado} onToggle={() => updateAccion(a.id, { validado: !a.validado })} />
          <button type="button" onClick={() => removeAccion(a.id)} className="text-xs font-medium text-red-600 hover:underline">
            {t.eliminar}
          </button>
        </div>
        <div className="mt-2">
          {celular ? (
            <a
              href={whatsappLink(celular, reminderMessage(lang, a.responsableNombre, a.descripcion, proyectoNombre, a.fecha, a.entregable))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {t.sendReminder}
            </a>
          ) : (
            <p className="text-xs text-slate-400">{t.noPhone}</p>
          )}
        </div>
      </div>
    );
  };

  const renderProyecto = (p: Proyecto, f: FortalezaDebilidad, e: AmenazaOportunidad, o: Objetivo) => {
    const isExpanded = expanded[p.id] === true;
    const accionesDeP = acciones.filter((a) => a.proyectoId === p.id);
    const generating = accionGenerating[p.id] === true;
    const genError = accionGenError[p.id] || '';
    return (
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => toggleExpanded(p.id)} className="text-xs font-medium text-blue-600 hover:underline">
            {(isExpanded ? t.ocultar : t.mostrar) + ' ' + t.addAccion + ' (' + accionesDeP.length + ')'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => sugerirAccionesConIA(p.id, f, e, o)}
              disabled={generating}
              className="rounded-full border border-blue-400 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {generating ? t.sugerirAccionesGenerando : t.sugerirAccionesBtn}
            </button>
            <ValidateBadge validado={p.validado} onToggle={() => updateProyecto(p.id, { validado: !p.validado })} />
            <button type="button" onClick={() => removeProyecto(p.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t.eliminar}
            </button>
          </div>
        </div>
        {genError ? <p className="mt-2 text-xs text-red-700">{genError}</p> : null}
        {isExpanded ? (
          <div className="mt-3">
            {accionesDeP.map((a) => renderAccion('', a))}
            <button type="button" onClick={() => addAccion(p.id)} className="mt-1 text-xs font-medium text-blue-600 hover:underline">
              {t.addAccion}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderFD = (f: FortalezaDebilidad, e: AmenazaOportunidad, o: Objetivo) => {
    const proyecto = findProyectoByFd(f.id);
    return (
      <div key={f.id} className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.entornoTipo}</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => updateFD(f.id, { tipo: 'fortaleza' })}
                className={
                  'rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (f.tipo === 'fortaleza' ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-slate-100 text-slate-600')
                }
              >
                {t.fortaleza}
              </button>
              <button
                type="button"
                onClick={() => updateFD(f.id, { tipo: 'debilidad' })}
                className={
                  'rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (f.tipo === 'debilidad' ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-slate-100 text-slate-600')
                }
              >
                {t.debilidad}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.fdDesc}</label>
            <textarea
              value={f.descripcion}
              onChange={(ev) => updateFD(f.id, { descripcion: ev.target.value })}
              placeholder={t.fdPlaceholder}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-1.5 text-sm leading-snug"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div></div>
          <div className="flex items-center gap-2">
            <ValidateBadge validado={f.validado} onToggle={() => updateFD(f.id, { validado: !f.validado })} />
            <button type="button" onClick={() => removeFD(f.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t.eliminar}
            </button>
          </div>
        </div>
        {proyecto ? (
          renderProyecto(proyecto, f, e, o)
        ) : (
          <button type="button" onClick={() => addProyecto(f.id)} className="mt-2 text-xs font-medium text-blue-600 hover:underline">
            {t.addAccion}
          </button>
        )}
      </div>
    );
  };

  const renderEntorno = (e: AmenazaOportunidad, o: Objetivo) => {
    const isExpanded = expanded[e.id] === true;
    const fdsDeE = fds.filter((f) => f.entornoId === e.id);
    return (
      <div key={e.id} className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.entornoTipo}</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => updateEntorno(e.id, { tipo: 'amenaza' })}
                className={
                  'rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (e.tipo === 'amenaza' ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-slate-100 text-slate-600')
                }
              >
                {t.amenaza}
              </button>
              <button
                type="button"
                onClick={() => updateEntorno(e.id, { tipo: 'oportunidad' })}
                className={
                  'rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (e.tipo === 'oportunidad' ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-slate-100 text-slate-600')
                }
              >
                {t.oportunidad}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.entornoDesc}</label>
            <textarea
              value={e.descripcion}
              onChange={(ev) => updateEntorno(e.id, { descripcion: ev.target.value })}
              placeholder={t.entornoPlaceholder}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-1.5 text-sm leading-snug"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => toggleExpanded(e.id)} className="text-xs font-medium text-blue-600 hover:underline">
            {(isExpanded ? t.ocultar : t.mostrar) + ' ' + t.fortaleza + '/' + t.debilidad + ' (' + fdsDeE.length + ')'}
          </button>
          <div className="flex items-center gap-2">
            <ValidateBadge validado={e.validado} onToggle={() => updateEntorno(e.id, { validado: !e.validado })} />
            <button type="button" onClick={() => removeEntorno(e.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t.eliminar}
            </button>
          </div>
        </div>
        {isExpanded ? (
          <div className="mt-3">
            {fdsDeE.map((f) => renderFD(f, e, o))}
            <div className="flex gap-3">
              <button type="button" onClick={() => addFD(e.id, 'fortaleza')} className="text-xs font-medium text-blue-600 hover:underline">
                {t.addFD + ' (' + t.fortaleza + ')'}
              </button>
              <button type="button" onClick={() => addFD(e.id, 'debilidad')} className="text-xs font-medium text-blue-600 hover:underline">
                {t.addFD + ' (' + t.debilidad + ')'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderObjetivo = (o: Objetivo) => {
    const isExpanded = expanded[o.id] === true;
    const entornosDeO = entornos.filter((e) => e.objetivoId === o.id);
    return (
      <div key={o.id} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.perspectivaLabel}</label>
            <select
              value={o.perspectiva}
              onChange={(ev) => updateObjetivo(o.id, { perspectiva: ev.target.value as Perspectiva })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {PERSPECTIVA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.objetivoLabel}</label>
            <textarea
              value={o.texto}
              onChange={(ev) => updateObjetivo(o.id, { texto: ev.target.value })}
              placeholder={t.objetivoPlaceholder}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-1.5 text-sm leading-snug"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => toggleExpanded(o.id)} className="text-xs font-medium text-blue-600 hover:underline">
            {(isExpanded ? t.ocultar : t.mostrar) + ' ' + t.amenaza + '/' + t.oportunidad + ' (' + entornosDeO.length + ')'}
          </button>
          <div className="flex items-center gap-2">
            <ValidateBadge validado={o.validado} onToggle={() => updateObjetivo(o.id, { validado: !o.validado })} />
            <button type="button" onClick={() => removeObjetivo(o.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t.eliminar}
            </button>
          </div>
        </div>
        {isExpanded ? (
          <div className="mt-3">
            {entornosDeO.map((e) => renderEntorno(e, o))}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => addEntorno(o.id, 'amenaza')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                {t.addEntorno + ' (' + t.amenaza + ')'}
              </button>
              <button
                type="button"
                onClick={() => addEntorno(o.id, 'oportunidad')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                {t.addEntorno + ' (' + t.oportunidad + ')'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderConvocatoria = (c: Convocatoria) => {
    return (
      <div key={c.id} className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.convocatoriaTipo}</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => updateConvocatoria(c.id, { tipo: 'internacional' })}
                className={
                  'rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (c.tipo === 'internacional' ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500' : 'bg-slate-100 text-slate-600')
                }
              >
                {t.internacional}
              </button>
              <button
                type="button"
                onClick={() => updateConvocatoria(c.id, { tipo: 'nacional' })}
                className={
                  'rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (c.tipo === 'nacional' ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-500' : 'bg-slate-100 text-slate-600')
                }
              >
                {t.nacional}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.convocatoriaNombre}</label>
            <input
              type="text"
              value={c.nombre}
              onChange={(ev) => updateConvocatoria(c.id, { nombre: ev.target.value })}
              placeholder={t.convocatoriaNombrePlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.convocatoriaRequisito}</label>
          <input
            type="text"
            value={c.requisito}
            onChange={(ev) => updateConvocatoria(c.id, { requisito: ev.target.value })}
            placeholder={t.convocatoriaRequisitoPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <ValidateBadge validado={c.validado} onToggle={() => updateConvocatoria(c.id, { validado: !c.validado })} />
          <button type="button" onClick={() => removeConvocatoria(c.id)} className="text-xs font-medium text-red-600 hover:underline">
            {t.eliminar}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h3 className="text-xl font-bold text-slate-800">{t.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setContactosOpen(!contactosOpen)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <h4 className="mb-1 text-sm font-semibold text-slate-700">{t.contactsTitle}</h4>
            <p className="text-xs text-slate-400">{t.contactsSubtitle}</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-blue-600">
            {contactosOpen ? t.contactsHide : t.contactsShow}
          </span>
        </button>
        {contactosOpen ? (
          <div className="mt-3">
            {contactos.map((c) => {
              const roleKeys = Array.isArray(c.roleKeys) ? c.roleKeys : [];
              const disponibles = orgRosterEntries().filter((e) => roleKeys.indexOf(e.key) === -1);
              return (
                <div key={c.id} className="mb-2 rounded-lg border border-slate-100 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={c.nombre}
                      onChange={(ev) => {
                        updateContacto(c.id, { nombre: ev.target.value });
                        if (roleKeys.length > 0) syncNameToOrgChart(roleKeys, ev.target.value);
                      }}
                      placeholder={t.contactName}
                      className="min-w-[140px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <select
                      value=""
                      onChange={(ev) => {
                        if (ev.target.value) updateContacto(c.id, { celular: applyCountryCode(c.celular, ev.target.value) });
                      }}
                      className="rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs text-slate-500"
                    >
                      <option value="">{lang === 'en' ? 'Code' : 'Cod.'}</option>
                      {COUNTRY_CODES.map((cc) => (
                        <option key={cc.code} value={cc.code}>
                          {cc.flag + ' +' + cc.code + ' ' + (lang === 'en' ? cc.nameEn : cc.nameEs)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={c.celular}
                      onChange={(ev) => updateContacto(c.id, { celular: ev.target.value })}
                      placeholder={t.contactPhone}
                      className="min-w-[140px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <input
                      type="email"
                      value={c.correo || ''}
                      onChange={(ev) => updateContacto(c.id, { correo: ev.target.value })}
                      placeholder={t.contactEmail}
                      className="min-w-[140px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <button type="button" onClick={() => removeContacto(c.id)} className="text-xs font-medium text-red-600 hover:underline">
                      {t.eliminar}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {roleKeys.length === 0 ? (
                      <span className="text-xs italic text-slate-400">
                        {lang === 'en' ? '(manually added, not linked to the org chart)' : '(agregado manualmente, no ligado al organigrama)'}
                      </span>
                    ) : (
                      roleKeys.map((rk) => (
                        <span key={rk} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {roleLabelFor(rk)}
                          <button type="button" onClick={() => removeRoleFromContacto(c.id, rk)} className="font-bold text-blue-400 hover:text-blue-700">
                            ×
                          </button>
                        </span>
                      ))
                    )}
                    {disponibles.length > 0 ? (
                      <select
                        value=""
                        onChange={(ev) => {
                          if (ev.target.value) addRoleToContacto(c.id, ev.target.value);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs text-slate-500"
                      >
                        <option value="">
                          {lang === 'en' ? '+ same person as...' : '+ es la misma persona que...'}
                        </option>
                        {disponibles.map((e) => (
                          <option key={e.key} value={e.key}>
                            {roleLabelFor(e.key) + ' (' + e.nombre + ')'}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={addContacto} className="text-xs font-medium text-blue-600 hover:underline">
              {t.addContact}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{objetivos.length}</div>
          <div className="text-xs text-slate-500">{t.summaryObjetivos}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{acciones.length}</div>
          <div className="text-xs text-slate-500">{t.summaryAcciones}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <div className="text-lg font-bold text-red-700">{vencidas.length}</div>
          <div className="text-xs text-red-600">{t.summaryVencidas}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
          <div className="text-lg font-bold text-amber-700">{porVencer.length}</div>
          <div className="text-xs text-amber-600">{t.summaryPorVencer}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{pendientesValidar}</div>
          <div className="text-xs text-slate-500">{t.summaryValidar}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h4 className="text-sm font-semibold text-amber-900">
          {lang === 'en' ? 'Financial objectives (from your Break-Even tool)' : 'Objetivos financieros (desde tu herramienta de Punto de Equilibrio)'}
        </h4>
        {finGoalsData ? (
          <>
            <p className="mt-1 text-sm text-amber-900">
              {lang === 'en'
                ? 'We found saved data from your Break-Even / Financial Goals tool. Add it as financial objectives so you can review and edit each one below.'
                : 'Encontramos datos guardados de tu herramienta de Punto de Equilibrio / Metas Financieras. Agregalos como objetivos financieros para revisar y editar cada uno abajo.'}
            </p>
            <button
              type="button"
              onClick={agregarObjetivosFinancieros}
              className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              {lang === 'en' ? 'Add as financial objectives' : 'Agregar como objetivos financieros'}
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-amber-900">
            {lang === 'en'
              ? 'You have not filled out the Break-Even / Financial Goals tool yet (in the main Babel page). Once you do, its data (revenue by channel, fixed costs, profit target) will appear here.'
              : 'Todavia no has llenado la herramienta de Punto de Equilibrio / Metas Financieras (en la pagina principal de Babel). En cuanto la llenes, sus datos (ingresos por canal, gastos fijos, utilidad objetivo) apareceran aqui.'}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <h4 className="text-sm font-semibold text-violet-900">{t.objetivoBscIaTitle}</h4>
        <p className="mt-1 text-sm text-violet-900">{t.objetivoBscIaSubtitle}</p>
        {babelFase5Summary ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/60 p-2 text-xs text-violet-900">
            <button
              type="button"
              onClick={usarResumenBabelFase5}
              className="rounded-full border border-violet-400 bg-white px-3 py-1 font-medium text-violet-700 hover:bg-violet-100"
            >
              {lang === 'en' ? 'Use my Babel Phase 5 summary' : 'Usar mi resumen de la Fase 5 (Babel)'}
            </button>
          </div>
        ) : null}
        <textarea
          value={resumenFase5}
          onChange={(ev) => setResumenFase5(ev.target.value)}
          placeholder={t.objetivoBscIaPlaceholder}
          rows={5}
          className="mt-2 w-full rounded-lg border border-violet-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sugerirObjetivosBSCConIA}
            disabled={objetivoBscGenerating}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {objetivoBscGenerating ? t.objetivoBscIaGenerando : objetivoBscYaSugerido ? t.objetivoBscIaBtnAgain : t.objetivoBscIaBtn}
          </button>
        </div>
        {objetivoBscGenError ? (
          <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{objetivoBscGenError}</p>
            <p className="mt-0.5">{t.objetivoBscIaErrorHint}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <h4 className="text-sm font-semibold text-teal-900">{t.entornoIaTitle}</h4>
        <p className="mt-1 text-sm text-teal-900">{t.entornoIaSubtitle}</p>
        {babelFase2Summary ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/60 p-2 text-xs text-teal-900">
            <button
              type="button"
              onClick={usarResumenBabelFase2}
              className="rounded-full border border-teal-400 bg-white px-3 py-1 font-medium text-teal-700 hover:bg-teal-100"
            >
              {lang === 'en' ? 'Use my Babel Phase 2 summary' : 'Usar mi resumen de la Fase 2 (Babel)'}
            </button>
          </div>
        ) : null}
        <p className="mt-1 rounded-lg bg-white/60 p-2 text-xs text-teal-900">
          {resumenFase5.trim() ? t.entornoStakeholderHint : t.entornoStakeholderMissingHint}
        </p>
        <textarea
          value={resumenFase2}
          onChange={(ev) => setResumenFase2(ev.target.value)}
          placeholder={t.entornoIaPlaceholder}
          rows={5}
          className="mt-2 w-full rounded-lg border border-teal-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sugerirEntornosConIA}
            disabled={entornoGenerating}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {entornoGenerating ? t.entornoIaGenerando : entornoYaSugerido ? t.entornoIaBtnAgain : t.entornoIaBtn}
          </button>
        </div>
        {entornoGenError ? (
          <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{entornoGenError}</p>
            <p className="mt-0.5">{t.entornoIaErrorHint}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
        <h4 className="text-sm font-semibold text-cyan-900">{t.capacidadIaTitle}</h4>
        <p className="mt-1 text-sm text-cyan-900">{t.capacidadIaSubtitle}</p>
        {(babelFase3Summary || madurezResult) ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/60 p-2 text-xs text-cyan-900">
            {babelFase3Summary ? (
              <button
                type="button"
                onClick={usarResumenBabelFase3}
                className="rounded-full border border-cyan-400 bg-white px-3 py-1 font-medium text-cyan-700 hover:bg-cyan-100"
              >
                {lang === 'en' ? 'Use my Babel Phase 3 summary' : 'Usar mi resumen de la Fase 3 (Babel)'}
              </button>
            ) : null}
            {madurezResult ? (
              <button
                type="button"
                onClick={agregarPerfilMadurez}
                className="rounded-full border border-cyan-400 bg-white px-3 py-1 font-medium text-cyan-700 hover:bg-cyan-100"
              >
                {lang === 'en' ? 'Add my maturity profile' : 'Agregar mi perfil de madurez'}
              </button>
            ) : null}
          </div>
        ) : null}
        <textarea
          value={resumenFase3}
          onChange={(ev) => setResumenFase3(ev.target.value)}
          placeholder={t.capacidadIaPlaceholder}
          rows={5}
          className="mt-2 w-full rounded-lg border border-cyan-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sugerirCapacidadesConIA}
            disabled={capacidadGenerating}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {capacidadGenerating ? t.capacidadIaGenerando : capacidadYaSugerido ? t.capacidadIaBtnAgain : t.capacidadIaBtn}
          </button>
        </div>
        {capacidadGenError ? (
          <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{capacidadGenError}</p>
            <p className="mt-0.5">{t.capacidadIaErrorHint}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {sortObjetivosPorPerspectiva(objetivos).map((o) => renderObjetivo(o))}
        <button type="button" onClick={addObjetivo} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
          {t.addObjetivo}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h4 className="text-sm font-semibold text-emerald-900">{t.convocatoriaIaTitle}</h4>
        <p className="mt-1 text-sm text-emerald-900">{t.convocatoriaIaSubtitle}</p>
        {babelFase1Summary ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/60 p-2 text-xs text-emerald-900">
            <button
              type="button"
              onClick={usarResumenBabelFase1}
              className="rounded-full border border-emerald-400 bg-white px-3 py-1 font-medium text-emerald-700 hover:bg-emerald-100"
            >
              {lang === 'en' ? 'Use my Babel Phase 1 summary' : 'Usar mi resumen de la Fase 1 (Babel)'}
            </button>
          </div>
        ) : null}
        <textarea
          value={resumenFase1}
          onChange={(ev) => setResumenFase1(ev.target.value)}
          placeholder={t.convocatoriaIaPlaceholder}
          rows={5}
          className="mt-2 w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sugerirConvocatoriasConIA}
            disabled={convocatoriaGenerating}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {convocatoriaGenerating ? t.convocatoriaIaGenerando : convocatoriaYaSugerido ? t.convocatoriaIaBtnAgain : t.convocatoriaIaBtn}
          </button>
        </div>
        {convocatoriaGenError ? (
          <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{convocatoriaGenError}</p>
            <p className="mt-0.5">{t.convocatoriaIaErrorHint}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {convocatorias.map((c) => renderConvocatoria(c))}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => addConvocatoria('internacional')}
            className="mt-2 text-sm font-medium text-blue-600 hover:underline"
          >
            {t.addConvocatoria + ' (' + t.internacional + ')'}
          </button>
          <button
            type="button"
            onClick={() => addConvocatoria('nacional')}
            className="mt-2 text-sm font-medium text-blue-600 hover:underline"
          >
            {t.addConvocatoria + ' (' + t.nacional + ')'}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm text-indigo-900">{t.sugerirPrioridadSubtitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sugerirPrioridadConIA}
            disabled={prioGenerating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {prioGenerating ? t.sugerirPrioridadGenerando : t.sugerirPrioridadBtn}
          </button>
        </div>
        {prioGenError ? (
          <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{prioGenError}</p>
            <p className="mt-0.5">{t.sugerirPrioridadErrorHint}</p>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>
    </div>
  );
}

'use client';
import React from 'react';

type PlanLang = 'es' | 'en';
type Perspectiva = 'financiera' | 'clientes' | 'procesos_internos' | 'aprendizaje_crecimiento';
type EntornoTipo = 'amenaza' | 'oportunidad';
type FDTipo = 'fortaleza' | 'debilidad';
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
type Contacto = { id: string; nombre: string; celular: string; correo: string };
type ExpandedMap = Record<string, boolean>;
type OrgAssignments = Record<string, { person: string }>;

const STORAGE_KEY = 'babel_plan_accion_v2';
const CONTACTS_KEY = 'babel_plan_accion_contactos_v1';
const ORG_KEY = 'babel_orgchart_v1';
const BOARD_KEY = 'babel_orgchart_board_v1';

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
  if (lang === 'en') {
    return 'Hi ' + nombre + ', your task "' + tarea + '" for project "' + proyecto + '" is due ' + fecha + '. Expected deliverable: ' + entregableTxt + '. Please confirm your progress.';
  }
  return 'Hola ' + nombre + ', tu tarea "' + tarea + '" del proyecto "' + proyecto + '" tiene fecha compromiso ' + fecha + '. Entregable esperado: ' + entregableTxt + '. Por favor confirma como vas.';
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
  const [contactos, setContactos] = React.useState<Contacto[]>([]);
  const [expanded, setExpanded] = React.useState<ExpandedMap>({});
  const [prioGenerating, setPrioGenerating] = React.useState(false);
  const [prioGenError, setPrioGenError] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [orgAssignments, setOrgAssignments] = React.useState<OrgAssignments>({});
  const [boardPresidente, setBoardPresidente] = React.useState('');

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
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      const blob = { objetivos: objetivos, entornos: entornos, fds: fds, proyectos: proyectos, acciones: acciones };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } catch (err) {
      console.error(err);
    }
  }, [objetivos, entornos, fds, proyectos, acciones, loaded]);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(contactos));
    } catch (err) {
      console.error(err);
    }
  }, [contactos, loaded]);

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

  const resolveCelular = (nombre: string): string => {
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

  const addContacto = () => setContactos((prev) => prev.concat([{ id: generateId(), nombre: '', celular: '', correo: '' }]));
  const updateContacto = (id: string, patch: Partial<Contacto>) =>
    setContactos((prev) => prev.map((c) => (c.id === id ? Object.assign({}, c, patch) : c)));
  const removeContacto = (id: string) => setContactos((prev) => prev.filter((c) => c.id !== id));

  const addObjetivo = () => setObjetivos((prev) => prev.concat([newObjetivo()]));
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

  const addFD = (entornoId: string, tipo: FDTipo) => setFds((prev) => prev.concat([newFD(entornoId, tipo)]));
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
                'Objetivo: ' + o.texto + ' | ' + (e.tipo === 'amenaza' ? 'Amenaza' : 'Oportunidad') + ': ' + e.descripcion + ' | Proyecto: ' + p.nombre;
              out.push({ id: a.id, descripcion: a.descripcion, entregable: a.entregable, contexto: contexto });
            });
          });
        });
      });
    });
    return out;
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
    const celular = resolveCelular(a.responsableNombre);
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

  const renderProyecto = (p: Proyecto) => {
    const isExpanded = expanded[p.id] === true;
    const accionesDeP = acciones.filter((a) => a.proyectoId === p.id);
    return (
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.proyectoLabel}</label>
            <input
              type="text"
              value={p.nombre}
              onChange={(ev) => updateProyecto(p.id, { nombre: ev.target.value })}
              placeholder={t.proyectoPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.responsableLabel}</label>
            <select
              value={p.responsableRoleKey}
              onChange={(ev) => {
                const roleKey = ev.target.value;
                const person = resolvePersonForRole(roleKey);
                updateProyecto(p.id, { responsableRoleKey: roleKey, responsableNombre: person ? person : p.responsableNombre });
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
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => toggleExpanded(p.id)} className="text-xs font-medium text-blue-600 hover:underline">
            {(isExpanded ? t.ocultar : t.mostrar) + ' ' + t.addAccion + ' (' + accionesDeP.length + ')'}
          </button>
          <div className="flex items-center gap-2">
            <ValidateBadge validado={p.validado} onToggle={() => updateProyecto(p.id, { validado: !p.validado })} />
            <button type="button" onClick={() => removeProyecto(p.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t.eliminar}
            </button>
          </div>
        </div>
        {isExpanded ? (
          <div className="mt-3">
            {accionesDeP.map((a) => renderAccion(p.nombre, a))}
            <button type="button" onClick={() => addAccion(p.id)} className="mt-1 text-xs font-medium text-blue-600 hover:underline">
              {t.addAccion}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderFD = (f: FortalezaDebilidad) => {
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
            <input
              type="text"
              value={f.descripcion}
              onChange={(ev) => updateFD(f.id, { descripcion: ev.target.value })}
              placeholder={t.fdPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
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
          renderProyecto(proyecto)
        ) : (
          <button type="button" onClick={() => addProyecto(f.id)} className="mt-2 text-xs font-medium text-blue-600 hover:underline">
            {t.definirProyecto}
          </button>
        )}
      </div>
    );
  };

  const renderEntorno = (e: AmenazaOportunidad) => {
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
            <input
              type="text"
              value={e.descripcion}
              onChange={(ev) => updateEntorno(e.id, { descripcion: ev.target.value })}
              placeholder={t.entornoPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
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
            {fdsDeE.map((f) => renderFD(f))}
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
            <input
              type="text"
              value={o.texto}
              onChange={(ev) => updateObjetivo(o.id, { texto: ev.target.value })}
              placeholder={t.objetivoPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
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
            {entornosDeO.map((e) => renderEntorno(e))}
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

  return (
    <div className="mx-auto max-w-4xl">
      <h3 className="text-xl font-bold text-slate-800">{t.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-1 text-sm font-semibold text-slate-700">{t.contactsTitle}</h4>
        <p className="mb-2 text-xs text-slate-400">{t.contactsSubtitle}</p>
        {contactos.map((c) => (
          <div key={c.id} className="mb-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={c.nombre}
              onChange={(ev) => updateContacto(c.id, { nombre: ev.target.value })}
              placeholder={t.contactName}
              className="min-w-[140px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
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
        ))}
        <button type="button" onClick={addContacto} className="text-xs font-medium text-blue-600 hover:underline">
          {t.addContact}
        </button>
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

      <div className="mt-6">
        {objetivos.map((o) => renderObjetivo(o))}
        <button type="button" onClick={addObjetivo} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
          {t.addObjetivo}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>
    </div>
  );
}

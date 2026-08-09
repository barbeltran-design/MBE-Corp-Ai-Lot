// MBE Worlds — gamificación sobre la infraestructura de puntos del Club.
// Misiones del Mundo de Partida, submundos del Mundo de la Estrategia y
// catálogo de mundos premium (es/en, rutas reales de la app).

export const MISIONES_PART_LABELS = [
  { n: 1, icon: '📊', ruta: '/dashboard', pts: 10, es: 'Evaluación de Madurez', en: 'Maturity Assessment', esDesc: 'Los 11 temas × 6 niveles. Se repite cuando consideres un cambio en tu empresa (insignia Reevaluado).', enDesc: '11 topics × 6 levels. Repeat it whenever you consider a change in your company (Re-evaluated badge).', sello: 'Caminante', repetible: true },
  { n: 2, icon: '🎯', ruta: '/babel/indicadores', pts: 15, es: 'Objetivos Estratégicos', en: 'Strategic Objectives', esDesc: 'Declaración de guerra: define tus objetivos BSC con meta numérica.', enDesc: 'Declaration of war: define your BSC objectives with a numeric target.', sello: '' },
  { n: 3, icon: '⭐', ruta: '/babel/calibracion', pts: 25, es: 'Calibración Inicial', en: 'Initial Calibration', esDesc: 'Babel resume tu empresa en 5 líneas (gamer mode) y te da tu nivel de salida. Al completarla se desbloquea el Tablero de Retos.', enDesc: 'Babel summarizes your company in 5 lines (gamer mode) and gives you your starting level. Completing it unlocks the Challenges Board.', sello: 'Tablero', final: true },
] as const;

export function puntosDeMision(n: number): number {
  const m = MISIONES_PART_LABELS.find((x) => x.n === n);
  return m ? m.pts : 0;
}

export function misionLabel(n: number, lang: 'es' | 'en'): string {
  const m = MISIONES_PART_LABELS.find((x) => x.n === n);
  return m ? (lang === 'en' ? m.en : m.es) : '';
}

// Estado de cada submundo del Mundo de la Estrategia. Los submundos 1-4 se
// alimentan de la Reflexión Estratégica (rutas reales); 5 del organigrama y
// 6 del Plan de Acción.
export const SUBMUNDOS_ESTRATEGIA_LABELS = [
  { n: 1, icon: '🧭', ruta: '/babel/proposito', es: 'Propósito y Propuesta de Valor', en: 'Purpose & Value Proposition', estado: 'listo', esDesc: 'Se toma de la Fase 1 de la Reflexión Estratégica.', enDesc: 'Taken from Phase 1 of the Strategic Reflection.', pts: 25, sello: 'Estratega' },
  { n: 2, icon: '🌐', ruta: '/babel/entorno', es: 'El Entorno', en: 'The Environment', estado: 'listo', esDesc: 'Se toma de la Fase 2: amenazas y oportunidades.', enDesc: 'Taken from Phase 2: threats and opportunities.', pts: 25, sello: '' },
  { n: 3, icon: '⚖️', ruta: '/babel/capacidades', es: 'Mis Capacidades', en: 'My Capabilities', estado: 'listo', esDesc: 'Se toma de la Fase 3: fortalezas y debilidades.', enDesc: 'Taken from Phase 3: strengths and weaknesses.', pts: 25, sello: '' },
  { n: 4, icon: '🧭', ruta: '/babel/enfoque', es: 'El Enfoque Estratégico', en: 'The Strategic Focus', estado: 'listo', esDesc: 'Se toma de la Fase 4: rumbo y prioridades.', enDesc: 'Taken from Phase 4: course and priorities.', pts: 25, sello: '' },
  { n: 5, icon: '🏢', ruta: '/babel/organigrama', es: 'Organigrama y Roles', en: 'Org Chart & Roles', estado: 'wip', esDesc: 'Define tu estructura y los responsables de cada acción.', enDesc: 'Define your structure and who owns each action.', pts: 25, sello: '' },
  { n: 6, icon: '📋', ruta: '/babel/plan-accion', es: 'Plan de Acción Socioambiental', en: 'Socio-environmental Action Plan', estado: 'pendiente', esDesc: 'Cumplimiento de acciones del plan (el pegamento que conecta todos los mundos).', enDesc: 'Compliance with the plan actions (the glue connecting every world).', pts: 25, sello: 'Mundo' },
] as const;

export const MUNDOS_PREMIUM_LABELS = [
  { id: 'dinero', icon: '💰', agente: 'Fisnando', subs: 5, es: 'Dinero', en: 'Money', esDesc: 'Evaluación fiscal, presupuesto anual, resultados mensuales…', enDesc: 'Tax review, annual budget, monthly results…' },
  { id: 'cliente', icon: '🤝', agente: 'Karmetin', subs: 6, es: 'Cliente', en: 'Customer', esDesc: 'Imagen, plan MKT, buyer persona, canales…', enDesc: 'Brand image, marketing plan, buyer persona, channels…' },
  { id: 'normativo', icon: '⚖️', agente: 'Normau', subs: 4, es: 'Normativo', en: 'Compliance', esDesc: 'Marca y patente, plan de normatividad…', enDesc: 'Brand & patent, compliance plan…' },
  { id: 'operativo', icon: '⚙️', agente: 'Atech', subs: 5, es: 'Operativo', en: 'Operations', esDesc: 'Digitalización, decisiones, resultados…', enDesc: 'Digitalization, decisions, results…' },
  { id: 'cultura', icon: '🌱', agente: 'Babel', subs: 5, es: 'Cultura', en: 'Culture', esDesc: 'Clima laboral, plan de carrera, 9 cajas…', enDesc: 'Work climate, career plan, 9 boxes…' },
] as const;

// Tabla de niveles de puntos (misma que el Club; aquí solo se exponen las
// etiquetas para el encabezado del mapa).
import { NIVEL_PUNTOS } from '@/lib/club';

export function nivelLabelPuntos(id: string, lang: 'es' | 'en'): string {
  const n = NIVEL_PUNTOS.find((x) => x.id === id);
  return n ? (lang === 'en' ? n.en : n.es) : id;
}
// Juntas semanales de mentoría del club MBE — agenda de 90 minutos, roles,
// catálogo de puntos y niveles derivados del acumulado de puntos del usuario.

// Temática del Tutorial de Prácticas y/o Retos según la semana del mes.
export const TEMATICAS_MES: { semana: number; es: string; en: string }[] = [
  {
    semana: 1,
    es: 'Consejo Administrativo',
    en: 'Administrative Council',
  },
  { semana: 2, es: 'Prácticas y Herramientas de Ventas y Mkt', en: 'Sales & Marketing Practices and Tools' },
  { semana: 3, es: 'Prácticas y Herramientas de Administración y Finanzas', en: 'Administration & Finance Practices and Tools' },
  { semana: 4, es: 'Prácticas y Herramientas Operativas', en: 'Operational Practices and Tools' },
  {
    semana: 5,
    es: 'Desarrollo de habilidades empresariales: Comunicación, Negociación, Creatividad, Manejo del tiempo, Pensamiento estratégico, Manejo del estrés, Inteligencia emocional, Liderazgo, Trabajo en equipo',
    en: 'Entrepreneurial skills development: Communication, Negotiation, Creativity, Time Management, Strategic Thinking, Stress Management, Emotional Intelligence, Leadership, Teamwork',
  },
];

export function tematicaDeSemana(semana: number, lang: 'es' | 'en'): string {
  const t = TEMATICAS_MES.find((t) => t.semana === semana) ?? TEMATICAS_MES[0];
  return lang === 'en' ? t.en : t.es;
}

// Roles de la junta directiva (a asignar entes de la junta).
export const ROLES_JUNTA = [
  { id: 'coordinador', es: 'Coordinador de la reunión', en: 'Meeting Coordinator' },
  { id: 'mentor_dinamica', es: 'Mentor de Dinámica Empresarial', en: 'Business Dynamics Mentor' },
  { id: 'mentor_crecimiento', es: 'Mentor de Crecimiento', en: 'Growth Mentor' },
  { id: 'mentor_b2b', es: 'Mentor B2B', en: 'B2B Mentor' },
  { id: 'mentor_calidad', es: 'Mentor de Calidad', en: 'Quality Mentor' },
] as const;

export type RolJuntaId = (typeof ROLES_JUNTA)[number]['id'];

export function rolLabel(rol: string, lang: 'es' | 'en'): string {
  const r = ROLES_JUNTA.find((x) => x.id === rol);
  return r ? (lang === 'en' ? r.en : r.es) : rol;
}

// Agenda base de la junta semanal (90 minutos). El coordinador puede reordenar
// y ajustar duraciones mientras la suma sea 90.
export interface AgendaItemDef {
  id: string;
  titulo: string;
  descripcion: string;
  responsable: RolJuntaId | string; // rol que lidera el bloque
  duracionMin: number;
  oculto?: boolean; // si es true, no se muestra a los miembros (solo coordinador/admin lo ven, atenuado)
}

export const AGENDA_JUNTA: { es: AgendaItemDef[]; en: AgendaItemDef[] } = {
  es: [
    {
      id: 'bienvenida',
      titulo: 'Bienvenida',
      descripcion:
        'Objetivo de la Junta: Trabajar en mi empresa mediante un equipo de trabajo y acceso a fuentes de financiamiento. Propósito común: ¡Impulsar empresas que transformen el mundo! Presentación de mentores: Nombre, a qué se dedican, WhatsApp. Señalar los roles de la junta directiva.',
      responsable: 'coordinador',
      duracionMin: 10,
    },
    {
      id: 'dinamica',
      titulo: 'Dinámica empresarial',
      descripcion:
        'El coordinador prepara una dinámica empresarial como puede ser: 1. Debate (temas empresariales o de actualidad que generen puntos de vista encontrados). 2. Simulación Empresarial (Comercial, Consejo directivo, Inversionistas). 3. Afinar presentación de ventas de un nuevo ejecutivo ante un cliente simulado. 4. Vender tu producto/servicio sin mencionar qué es. 5. Roast de Pitch.',
      responsable: 'mentor_dinamica',
      duracionMin: 25,
    },
    {
      id: 'tutorial',
      titulo: 'Tutorial de Prácticas y/o Retos Empresariales',
      descripcion:
        'Semana 1: Consejo Directivo — presentación de puntajes del mes y del trimestre, incumplimiento de objetivos y soluciones (Meses 1 y 2), mentoreo a ganadores (Mes 3). Semana 2: Ventas o Mercadotecnia. Semana 3: Administración o Finanzas. Semana 4: Operativas. Semana 5: Habilidades Directivas.',
      responsable: 'mentor_crecimiento',
      duracionMin: 40,
    },
    {
      id: 'b2b',
      titulo: 'Resultados B2B',
      descripcion:
        'Pide informes de los resultados CATAR (Comprar, Asesorar, Trucular, Alianza, Referir) de cada reunión. Próximas reuniones.',
      responsable: 'mentor_b2b',
      duracionMin: 5,
    },
    {
      id: 'evaluacion',
      titulo: 'Evaluación de la junta',
      descripcion:
        'Cumplimiento y mejoras de cada sección de la junta directiva. Qué nos llevamos y qué debemos mejorar en general.',
      responsable: 'mentor_calidad',
      duracionMin: 5,
    },
    {
      id: 'siguiente_junta',
      titulo: 'Roles de la siguiente junta',
      descripcion: 'Se definen y asignan los roles de la siguiente junta semanal.',
      responsable: 'coordinador',
      duracionMin: 5,
    },
  ],
  en: [
    {
      id: 'bienvenida',
      titulo: 'Welcome',
      descripcion:
        'Meeting Objective: Work on my company through a team and access to funding sources. Common Purpose: Empowering companies that change the world! Mentor introductions: name, what they do, WhatsApp. Highlight the board roles.',
      responsable: 'coordinador',
      duracionMin: 10,
    },
    {
      id: 'dinamica',
      titulo: 'Business dynamics activity',
      descripcion:
        'The coordinator prepares an activity such as: 1. Debate (topical business topics that generate opposing views). 2. Business Simulation (sales, board of directors, investors). 3. Polishing the sales pitch of a new executive to a simulated client. 4. Selling your product without mentioning what it is. 5. Pitch Roast.',
      responsable: 'mentor_dinamica',
      duracionMin: 25,
    },
    {
      id: 'tutorial',
      titulo: 'Practices and Business Challenges Tutorial',
      descripcion:
        'Week 1: Board — scores presentation for the month and quarter, unfulfilled objectives and solutions (Months 1 and 2), mentoring to winners (Month 3). Week 2: Sales or Marketing. Week 3: Management or Finance. Week 4: Operational. Week 5: Executive Skills.',
      responsable: 'mentor_crecimiento',
      duracionMin: 40,
    },
    {
      id: 'b2b',
      titulo: 'B2B results',
      descripcion:
        'Request CATAR results reports (Buy, Advise, Barter, Ally, Refer) from every meeting, plus upcoming meetings.',
      responsable: 'mentor_b2b',
      duracionMin: 5,
    },
    {
      id: 'evaluacion',
      titulo: 'Board evaluation',
      descripcion:
        'Fulfillment and improvements for each section of the board. What we take with us and what we must improve in general.',
      responsable: 'mentor_calidad',
      duracionMin: 5,
    },
    {
      id: 'siguiente_junta',
      titulo: 'Roles for the next meeting',
      descripcion: 'Roles for the next weekly meeting are assigned here.',
      responsable: 'coordinador',
      duracionMin: 5,
    },
  ],
};

export const AGENDA_JUNTA_TOTAL = AGENDA_JUNTA.es.reduce((a, i) => a + i.duracionMin, 0); // 90

// Cambios "permanentes" a la agenda base (hechos por un admin desde el Club)
// se guardan en Firestore como overrides por id de bloque, y se aplican aqui
// sobre AGENDA_JUNTA.es para calcular la agenda que se copia a cada junta
// nueva. Si no hay overrides, el comportamiento es identico al original.
export interface AgendaOverrideItem {
  titulo?: string;
  descripcion?: string;
  duracionMin?: number;
  oculto?: boolean;
}

export function aplicarAgendaMaestra(
  overrides: Record<string, AgendaOverrideItem> | null | undefined
): AgendaItemDef[] {
  return AGENDA_JUNTA.es.map((base) => {
    const o = overrides?.[base.id];
    if (!o) return { ...base };
    return {
      ...base,
      titulo: typeof o.titulo === 'string' && o.titulo.trim() ? o.titulo : base.titulo,
      descripcion: typeof o.descripcion === 'string' && o.descripcion.trim() ? o.descripcion : base.descripcion,
      duracionMin: typeof o.duracionMin === 'number' && o.duracionMin > 0 ? o.duracionMin : base.duracionMin,
      oculto: o.oculto === true,
    };
  });
}

// Catálogo de puntos que otorga el Mentor de Calidad (y que el admin puede
// ajustar). valor = puntos que se suman/restan al asistente.
export const CATALOGO_PUNTOS = [
  { id: 'asistencia', es: 'Asistencia', en: 'Attendance', valor: 1 },
  { id: 'puntualidad', es: 'Puntualidad', en: 'Punctuality', valor: 1 },
  { id: 'recomendar_ejecutivos', es: 'Recomendar nuevos ejecutivos', en: 'Refer new executives', valor: 1 },
  { id: 'rol_junta', es: 'Tomar un rol en la junta', en: 'Take a board role', valor: 2 },
  { id: 'dinamica_tutorial', es: 'Presentar dinámica / Tutorial / Retos empresariales', en: 'Lead activity / Tutorial / Business challenges', valor: 2 },
  { id: 'referencia_basica', es: 'Referencias básicas', en: 'Basic referrals', valor: 2 },
  { id: 'referencia_hot', es: 'Referencias Hot', en: 'Hot referrals', valor: 3 },
  { id: 'asesoria_1a1', es: 'Dar asesoría / Mentoría uno a uno', en: 'Give 1-on-1 mentoring', valor: 3 },
  { id: 'compra_miembro', es: 'Comprar a otro miembro del club', en: 'Buy from another club member', valor: 5 },
  { id: 'evento_social', es: 'Hacer un evento social', en: 'Hold a social event', valor: 5 },
  { id: 'trueque_alianza', es: 'Hacer trueque o alianza con otro miembro', en: 'Barter or ally with another member', valor: 5 },
  { id: 'entrega_mala', es: 'Entregar mal y/o fuera de tiempo', en: 'Deliver badly and/or late', valor: -5 },
  { id: 'no_cumplir', es: 'No cumplir compromisos', en: 'Break commitments', valor: -5 },
] as const;

export type PuntoCatalogoId = (typeof CATALOGO_PUNTOS)[number]['id'];

export function puntoLabel(id: string, lang: 'es' | 'en'): string {
  const p = CATALOGO_PUNTOS.find((x) => x.id === id);
  return p ? (lang === 'en' ? p.en : p.es) : id;
}

export function puntoValor(id: string): number {
  const p = CATALOGO_PUNTOS.find((x) => x.id === id);
  return p ? p.valor : 0;
}

// Niveles derivados del acumulado de puntos del club (misma tabla que la del
// Reference Place; aquí se automatiza el avance por participación).
export const NIVEL_PUNTOS = [
  { id: 'godin_wannabe', umbral: 0, es: 'Godín Wannabe', en: 'Wannabe Godin' },
  { id: 'freelancero', umbral: 50, es: 'Freelancero', en: 'Freelancer' },
  { id: 'emprendedor', umbral: 200, es: 'Emprendedor', en: 'Entrepreneur' },
  { id: 'empresario_orquesta', umbral: 500, es: 'Empresario Orquesta', en: 'Orchestra Business Owner' },
  { id: 'director_general', umbral: 900, es: 'Director General', en: 'CEO / General Director' },
  { id: 'presidente', umbral: 1500, es: 'Presidente', en: 'President' },
  { id: 'inversionista', umbral: 2500, es: 'Inversionista', en: 'Investor' },
  { id: 'mentor', umbral: 4000, es: 'Mentor', en: 'Mentor' },
] as const;

// Devuelve el nivel alcanzado según los puntos totales del usuario.
export function nivelDesdePuntos(puntos: number): string {
  let nivel = 'godin_wannabe';
  for (const n of NIVEL_PUNTOS) {
    if (puntos >= n.umbral) nivel = n.id;
  }
  return nivel;
}

// Siguiente nivel (para mostrar cuántos puntos faltan).
export function siguienteNivel(puntos: number): { id: string; es: string; en: string; puntosFaltan: number } | null {
  for (const n of NIVEL_PUNTOS) {
    if (puntos < n.umbral) {
      return {
        id: n.id,
        es: n.es,
        en: n.en,
        puntosFaltan: n.umbral - puntos,
      };
    }
  }
  return null;
}

export function trimestreActual(fecha?: string): string {
  const d = fecha ? new Date(fecha) : new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

// Una junta/evento guardada en la colección `juntas_club/{id}`.
export interface JuntaClubDoc {
  tipo: 'junta' | 'evento';
  nombre: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  liga?: string;
  ubicacion?: string;
  objetivo?: string;
  precio?: number; // solo eventos
  semanaMes?: number; // 1-5 para juntas semanales
  agenda?: { id: string; titulo: string; descripcion: string; responsable: string; duracionMin: number; oculto?: boolean }[];
  roles?: Record<string, string | null>; // RolJuntaId -> uid
  temaDefinido?: string; // tema del tutorial definido por el mentor de crecimiento
  asistentes?: Record<string, boolean>; // uid -> confirmado
  creadoPor: string;
  creadoEn: string;
  estatus: 'programada' | 'realizada' | 'cancelada';
}
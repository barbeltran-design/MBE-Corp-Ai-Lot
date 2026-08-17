// Modelo del Reference Place (Marketplace B2B) — compartido cliente/servidor.

// Niveles de la comunidad MBE, en orden ascendente, con los puntos del club
// necesarios para alcanzarlos (tabla oficial del usuario). El nivel se muestra
// en el perfil de cada usuario y habilita acciones:
//   - Godín Wannabe hasta Mentor: pueden participar en reuniones B2B.
//   - Empresario Orquesta en adelante: pueden solicitar referencias.
//   - Director General en adelante: acceso a Inversiones.
export const NIVELES_COMUNIDAD = [
  { id: 'godin_wannabe', es: 'Godín Wannabe', en: 'Wannabe Godin', puntos: 1, desc: { es: 'Empleado con visión emprendedora', en: 'Employee with an entrepreneurial vision' }, b2b: true, referencias: false, inversiones: false },
  { id: 'freelancero', es: 'Freelancero', en: 'Freelancer', puntos: 50, desc: { es: 'Profesionista Independiente', en: 'Independent professional' }, b2b: true, referencias: false, inversiones: false },
  { id: 'emprendedor', es: 'Emprendedor', en: 'Entrepreneur', puntos: 200, desc: { es: 'Inicias una empresa', en: 'You start a company' }, b2b: true, referencias: false, inversiones: false },
  { id: 'empresario_orquesta', es: 'Empresario Orquesta', en: 'Orchestra Business Owner', puntos: 500, desc: { es: 'Haces todo', en: 'You do it all' }, b2b: true, referencias: true, inversiones: false },
  { id: 'director_general', es: 'Director General', en: 'CEO / General Director', puntos: 900, desc: { es: 'Tienes un equipo', en: 'You have a team' }, b2b: true, referencias: true, inversiones: true },
  { id: 'presidente', es: 'Presidente', en: 'President', puntos: 1500, desc: { es: 'Eres la cabeza del consejo', en: 'You lead the board' }, b2b: true, referencias: true, inversiones: true },
  { id: 'inversionista', es: 'Inversionista', en: 'Investor', puntos: 2500, desc: { es: 'Apoyas otros emprendimientos', en: 'You support other ventures' }, b2b: true, referencias: true, inversiones: true },
  { id: 'mentor', es: 'Mentor', en: 'Mentor', puntos: 4000, desc: { es: 'Guías otros empresarios', en: 'You guide other business owners' }, b2b: true, referencias: true, inversiones: true },
] as const;

export type NivelComunidad = (typeof NIVELES_COMUNIDAD)[number]['id'];

export function nivelIndex(nivel: string | null | undefined): number {
  const i = NIVELES_COMUNIDAD.findIndex((n) => n.id === nivel);
  return i === -1 ? 0 : i;
}

export function puedeReunionesB2B(_nivel: string | null | undefined): boolean {
  return true; // desde Godín Wannabe (1 punto) todos participan en reuniones B2B
}

export function puedeSolicitarReferencias(nivel: string | null | undefined): boolean {
  return nivelIndex(nivel) >= 3;
}

export function puedeInversiones(nivel: string | null | undefined): boolean {
  return nivelIndex(nivel) >= 4;
}

// Nivel alcanzado según los puntos acumulados del club.
export function nivelPorPuntos(puntos: number): NivelComunidad {
  let nivel: NivelComunidad = 'godin_wannabe';
  for (const n of NIVELES_COMUNIDAD) {
    if (puntos >= n.puntos) nivel = n.id;
  }
  return nivel;
}

export function nivelLabel(nivel: string | null | undefined, lang: 'es' | 'en'): string {
  const n = NIVELES_COMUNIDAD[nivelIndex(nivel)];
  return n ? (lang === 'en' ? n.en : n.es) : '';
}

export function nivelDesc(nivel: string | null | undefined, lang: 'es' | 'en'): string {
  const n = NIVELES_COMUNIDAD[nivelIndex(nivel)];
  return n ? (lang === 'en' ? n.desc.en : n.desc.es) : '';
}

export const TIPOS_REUNION = [
  { id: 'compra', es: 'Compra', en: 'Purchase' },
  { id: 'asesoria', es: 'Asesoría', en: 'Advisory' },
  { id: 'trueque', es: 'Trueque', en: 'Barter' },
  { id: 'alianza', es: 'Alianza Estratégica', en: 'Strategic Alliance' },
  { id: 'referencia', es: 'Referencia', en: 'Referral' },
] as const;
export type TipoReunion = (typeof TIPOS_REUNION)[number]['id'];

export const TIPOS_RESULTADO = TIPOS_REUNION;
export type TipoResultado = TipoReunion;

// Un resultado de reunión B2B. Si el resultado es una compra, un trueque o
// una referencia, se debe indicar el monto en dinero.
export interface ResultadoB2B {
  uid: string;
  nombre: string;
  tipo: TipoResultado;
  monto: number;
  descripcion: string;
  createdAt: string;
}

// Reunión B2B entre 2+ usuarios.
export interface ReunionB2B {
  id: string;
  uidCreador: string;
  creadorNombre: string;
  titulo: string;
  tipo: TipoReunion;
  descripcion: string;
  participantes: { uid: string; nombre: string }[];
  estatus: 'propuesta' | 'aceptada' | 'completada' | 'cancelada';
  fechaPropuesta: string;
  resultados: ResultadoB2B[];
  createdAt: string;
}

// Solicitud de referencia: alguien pide que la comunidad (o un Rep Sale
// específico) le consiga una cita con una empresa, a cambio de un % de comisión.
export interface SolicitudReferencia {
  id: string;
  uid: string;
  nombre: string;
  empresaObjetivo: string;
  rubro: string;
  descripcion: string;
  comisionPct: number;
  repSaleUid: string | null;
  repSaleNombre: string | null;
  estatus: 'abierta' | 'cerrada';
  createdAt: string;
}

// Oferta de un Rep Sale: con qué empresas puede referir a la comunidad.
export interface OfertaRepSale {
  id: string;
  uid: string;
  nombre: string;
  empresa: string;
  rubro: string;
  descripcion: string;
  comisionPct: number;
  estatus: 'activa' | 'inactiva';
  createdAt: string;
}

// Miembro visible en la comunidad certificada (usuarios con nivel + Rep Sales).
export interface MiembroComunidad {
  uid: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  giro: string;
  pais: string;
  nivel: NivelComunidad | '';
  certificado: boolean;
  madurez: number | null; // totalScore 0-120 de la última evaluación
  rolRepSale: boolean;
  reunionesCompletadas: number;
  montoResultados: number;
  puntosClub: number; // Puntos de la comunidad (nivel), para ordenar el directorio.
}

export function montoRequerido(tipo: TipoResultado): boolean {
  return tipo === 'compra' || tipo === 'trueque' || tipo === 'referencia';
}

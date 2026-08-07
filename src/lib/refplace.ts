// Modelo del Reference Place (Marketplace B2B) — compartido cliente/servidor.

// Niveles de la comunidad MBE, en orden ascendente. El nivel se muestra en el
// perfil de cada usuario y habilita acciones:
//   - Godín Wannabe: solo puede ver la comunidad.
//   - Freelancero y Emprendedor: pueden solicitar/participar en reuniones B2B.
//   - Empresario Orquesta en adelante: también pueden solicitar referencias.
export const NIVELES_COMUNIDAD = [
  { id: 'godin_wannabe', es: 'Godín Wannabe', en: 'Wannabe Godin', b2b: false, referencias: false },
  { id: 'freelancero', es: 'Freelancero', en: 'Freelancer', b2b: true, referencias: false },
  { id: 'emprendedor', es: 'Emprendedor', en: 'Entrepreneur', b2b: true, referencias: false },
  { id: 'empresario_orquesta', es: 'Empresario Orquesta', en: 'Orchestra Business Owner', b2b: true, referencias: true },
  { id: 'director_general', es: 'Director General', en: 'CEO / General Director', b2b: true, referencias: true },
  { id: 'presidente', es: 'Presidente', en: 'President', b2b: true, referencias: true },
  { id: 'inversionista', es: 'Inversionista', en: 'Investor', b2b: true, referencias: true },
  { id: 'mentor', es: 'Mentor', en: 'Mentor', b2b: true, referencias: true },
] as const;

export type NivelComunidad = (typeof NIVELES_COMUNIDAD)[number]['id'];

export function nivelIndex(nivel: string | null | undefined): number {
  const i = NIVELES_COMUNIDAD.findIndex((n) => n.id === nivel);
  return i === -1 ? 0 : i;
}

export function puedeReunionesB2B(nivel: string | null | undefined): boolean {
  return nivelIndex(nivel) >= 1;
}

export function puedeSolicitarReferencias(nivel: string | null | undefined): boolean {
  return nivelIndex(nivel) >= 3;
}

export function nivelLabel(nivel: string | null | undefined, lang: 'es' | 'en'): string {
  const n = NIVELES_COMUNIDAD[nivelIndex(nivel)];
  return n ? (lang === 'en' ? n.en : n.es) : '';
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
}

export function montoRequerido(tipo: TipoResultado): boolean {
  return tipo === 'compra' || tipo === 'trueque' || tipo === 'referencia';
}

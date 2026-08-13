import type { Timestamp } from 'firebase/firestore';

export type Language = 'es' | 'en';
export type SubscriptionStatus = 'free' | 'pro' | 'active' | 'cancelled' | 'premium';
export type Industry = 'manufacturing' | 'services' | 'commerce' | 'tech';
export type CompanySize = '1-5' | '6-20' | '21-50' | '50+';
export type AgentId = 'babel' | 'karmetin' | 'fisnando' | 'normau' | 'atech';
export type MaturityLevel =
  | 'execution'
  | 'standard'
  | 'control'
  | 'optimization'
  | 'excellence'
  | 'influencer';

/** Firestore collection: users/{uid} */
export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  language: Language;
  country: string;
  photoURL?: string;
  avatarColor?: number;
  createdAt: Timestamp;
  subscription: SubscriptionStatus;
  subscriptionStart?: Timestamp;
  stripeCustomerId?: string;
  planStatus?: string;
  planActivatedAt?: string;
  mercadoPagoPaymentId?: string;
  currentMonth: number; // 1-12
  totalMaturity: number; // 0-120
  assessmentCompleted?: boolean; // true once saveAssessment() has run at least once
  // Roles del ecosistema MBE (uno o varios): 'admin' | 'rep_sale' |
  // 'especialista' | 'usuario'. Ver src/lib/roles.ts.
  roles?: string[];
  // Temas de madurez asignados a un usuario con rol 'especialista'.
  especialistaTemas?: string[];
  // Agenda de reuniones del especialista (Calendly / Google Calendar).
  agenda?: { plataforma?: string; link?: string; usuario?: string } | null;
  // Datos bancarios del especialista para recibir pagos.
  banco?: { clabe?: string; banco?: string; titular?: string; email?: string } | null;
  // Reference Place: nivel en la comunidad (ver src/lib/refplace.ts NIVELES_COMUNIDAD).
  // Default 'godin_wannabe' para todos los usuarios nuevos.
  nivelComunidad?: string;
  // Teléfono celular visible en el perfil público del Reference Place.
  telefono?: string;
  // true cuando el usuario pagó/obtuvo la certificación MBE (certificacion_mbe).
  certificado?: boolean;
  certificadoDesde?: string;
  // Fecha de nacimiento (YYYY-MM-DD) — usada para felicitaciones de cumpleaños
  // en Comunidad > Noticias.
  fechaNacimiento?: string;
  // Acceso manual a Mundos Premium otorgado por un administrador sin que el
  // usuario haya pagado un plan (ver src/lib/premium.ts).
  accesoManualPremium?: boolean;
  accesoManualPor?: string; // uid del admin que otorgó el acceso
  accesoManualAt?: string; // ISO date
  // Suma de pagos.monto (colección `pagos`) para este usuario. Se calcula al
  // vuelo en /api/admin/users, no se persiste aquí; se documenta por
  // completitud del tipo.
  totalInvertido?: number;
  // Club de juntas semanales: puntos acumulados, semanas asistidas y fecha de
  // la primera junta confirmada (los nivela el sistema desde puntosClub).
  puntosClub?: number;
  semanasJunta?: number;
  primerJuntaAt?: string;
  // MBE Worlds: misiones completadas del Mundo de Partida (1-2) y desbloqueo
  // del Tablero de Retos (true al cerrar la misión 2, Objetivos Estratégicos).
  worlds?: { partida?: number[]; tablero?: boolean };
}

/** Firestore collection: companies/{uid} */
export interface CompanyDoc {
  uid: string;
  name: string;
  industry: Industry;
  size: CompanySize;
  country: string;
  website?: string;
  createdAt: Timestamp;
}

export interface DimensionScore {
  score: number;
  level: MaturityLevel;
}

/** Firestore collection: assessments/{uid}/entries/{entryId} */
export interface AssessmentDoc {
  uid: string;
  timestamp: Timestamp;
  // Raw per-level answers ('yes'|'partial'|'no'), keyed by dimension id, 6
  // values per dimension in level order. Kept alongside the computed
  // `dimensions` snapshot below so the dashboard can regenerate results (and
  // localized text) in whatever language the user is currently viewing.
  answers: Record<string, string[]>;
  dimensions: {
    strategic: DimensionScore;
    finance: DimensionScore;
    hr: DimensionScore;
    sales: DimensionScore;
    operations: DimensionScore;
    esg: DimensionScore;
    compliance: DimensionScore;
    knowledge: DimensionScore;
    alliances: DimensionScore;
    customerService: DimensionScore;
    culture: DimensionScore;
  };
  totalScore: number;
  totalLevel: MaturityLevel;
}

export interface ChatDeliverableRef {
  name: string;
  type: 'pdf' | 'excel' | 'docx';
  url: string;
  generatedAt: Timestamp;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
  deliverables?: ChatDeliverableRef[];
}

/** Fase 0-4 de Babel AI. Cada fase se cierra con un resumen de Babel y avanza
 * solo cuando el usuario la aprueba explícitamente (ver src/lib/babel-session.ts
 * y src/lib/babel-constants.ts). approvedAt usa Timestamp.now() en vez de
 * serverTimestamp() porque Firestore no permite ese sentinel dentro de arreglos. */
export interface BabelPhaseRecord {
  phase: number; // 0-4
  approved: boolean;
  approvedAt: Timestamp;
  summary: string;
}

/** Firestore collection: sessions/{sessionId} */
export interface SessionDoc {
  uid: string;
  sessionId: string;
  agentId: AgentId;
  month: number;
  week: number;
  topic: string;
  createdAt: Timestamp;
  messages: ChatMessage[];
  locale?: 'es' | 'en';
  // Solo se usa cuando agentId === 'babel'.
  currentPhase?: number;
  phases?: BabelPhaseRecord[];
  phaseData?: Record<string, any>;
}

/** Firestore collection: deliverables/{deliverableId} */
export interface DeliverableDoc {
  uid: string;
  deliverableId: string;
  name: string;
  type: 'pdf' | 'excel' | 'docx';
  category: string;
  storageUrl: string;
  generatedAt: Timestamp;
  agentId: AgentId;
  sessionTopic: string;
  phdReferences: number[];
}

/** Firestore collection: phds/{id} — RAG knowledge base entries */
export interface PhdDoc {
  id: number; // 1-153
  tema: string;
  subtema: string;
  marcoReferencia: string;
  buenaPractica: string;
  beneficio: string;
  aplicaMBE: boolean;
}

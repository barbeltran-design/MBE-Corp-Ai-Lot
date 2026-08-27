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
  // 'active' | 'pending' | 'paused' | 'pending_cancellation' | 'cancelled'.
  // 'pending_cancellation': el usuario canceló, pero YA PAGÓ el mes en
  // curso — sigue teniendo acceso pro hasta planCancelaEn (ver
  // src/lib/premium.ts). Después de esa fecha se comporta como 'cancelled'.
  planStatus?: string;
  planActivatedAt?: string;
  // Fecha (ISO) del cobro exitoso más reciente de la suscripción — se pone
  // la primera vez que se autoriza y se actualiza en cada cobro mensual
  // aprobado. Se usa SOLO internamente para calcular planCancelaEn cuando el
  // usuario cancela (ultimoCobroAt + 1 mes) — no se muestra al usuario.
  ultimoCobroAt?: string;
  // Fecha (ISO) hasta la que el usuario conserva el acceso pro después de
  // cancelar (= ultimoCobroAt + 1 mes en el momento de la cancelación). Solo
  // tiene sentido cuando planStatus === 'pending_cancellation'.
  planCancelaEn?: string;
  mercadoPagoPaymentId?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
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
  // Consentimiento legal capturado en el registro (checkbox de Términos de
  // Uso + Aviso de Privacidad). ISO date string, no Timestamp, porque se
  // genera en el cliente antes de llamar a Firebase Auth.
  aceptoTerminosAt?: string;
  // true si el usuario declaró ser menor de edad al registrarse; en ese caso
  // se requieren los tres campos de tutor a continuación.
  esMenorDeEdad?: boolean;
  tutorNombre?: string;
  tutorEmail?: string;
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

// ---------------------------------------------------------------------------
// Notificaciones (Fase 1: email vía Resend, digest semanal + eventos).
// ---------------------------------------------------------------------------

/** Categorías de notificación soportadas (ver src/lib/notificaciones.ts). */
export type NotificacionCategoria =
  | 'juntaClub'
  | 'reunionB2B'
  | 'referenciaAplicada'
  | 'retoSemanal'
  | 'actividadesVencen'
  | 'nuevaConvocatoria'
  | 'misionesPendientes'
  | 'ranking'
  | 'mentorReunionAgendada';

export type NotificacionCanal = 'email' | 'whatsapp' | 'sms';

/** Firestore collection: notificationPreferences/{uid} */
export interface NotificationPreferencesDoc {
  uid: string;
  canales: { email: boolean; sms: boolean; whatsapp: boolean };
  telefonoWhatsapp?: string;
  digestSemanal: boolean; // resumen de los lunes
  categoriasActivas: Record<NotificacionCategoria, boolean>;
  horaPreferida?: string; // 'HH:mm', reservado para fases futuras
  updatedAt?: string; // ISO
}

/** Firestore collection: notificationLog/{id} */
export interface NotificationLogDoc {
  id: string;
  uid: string;
  categoria: NotificacionCategoria;
  canal: NotificacionCanal;
  estatus: 'enviado' | 'fallido' | 'omitido';
  disparadoPor: 'digest_semanal' | 'evento';
  contenidoResumen: string;
  enviadoEn: string; // ISO
}

/** Firestore collection: puntosLog/{id} — historial fechado de puntos del
 * Club (UserDoc.puntosClub solo guarda el total acumulado; este log permite
 * calcular "puntos ganados esta semana" para el digest de ranking). */
export interface PuntosLogDoc {
  id: string;
  uid: string;
  puntos: number; // puede ser negativo (ver CATALOGO_PUNTOS en club.ts)
  motivo: string;
  fecha: string; // ISO
}

/** Firestore collection: mentorBookingIntents/{id} — se crea cuando un
 * usuario hace clic para agendar con un especialista/mentor (antes de salir
 * a Calendly/Google Calendar), para poder notificar a ese mentor con quién
 * solicitó la cita. No confirma que la reunión realmente se agendó en el
 * calendario externo (ver limitación documentada en la propuesta). */
export interface MentorBookingIntentDoc {
  id: string;
  mentorUid: string;
  mentorNombre: string;
  temaId: string;
  solicitanteUid: string;
  solicitanteNombre: string;
  createdAt: string; // ISO
  notificado: boolean;
}

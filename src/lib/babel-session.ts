import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { babelPhaseTopics } from '@/lib/babel-constants';
import type { BabelPhaseRecord, ChatMessage, SessionDoc } from '@/types/firestore';

// Un solo documento de sesión de Babel por usuario (a diferencia de los demás
// copilots, Fase 3 todavía no se repite mes a mes) — id determinístico para
// que getOrCreateBabelSession nunca compita consigo misma entre pestañas.
function babelSessionId(uid: string): string {
  return `babel_${uid}`;
}

export async function getOrCreateBabelSession(
  uid: string,
  language: 'es' | 'en'
): Promise<SessionDoc> {
  const db = getFirebaseDb();
  const ref = doc(db, 'sessions', babelSessionId(uid));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as SessionDoc;
  }

  const topics = babelPhaseTopics(language);
  const fresh: SessionDoc = {
    uid,
    sessionId: babelSessionId(uid),
    agentId: 'babel',
    month: 1,
    week: 1,
    topic: topics[0],
    createdAt: serverTimestamp() as SessionDoc['createdAt'],
    messages: [],
    currentPhase: 0,
    phases: [],
  };
  await setDoc(ref, fresh);
  return fresh;
}

/**
 * Lee la sesión de Babel de un usuario SIN crearla si no existe. A diferencia
 * de getOrCreateBabelSession, esta función es de solo lectura — pensada para
 * pantallas fuera del chat de Babel (como Plan de Acción) que quieren
 * ofrecer "traer mi resumen de Fase X" sin generar por accidente un
 * documento de sesión vacío para alguien que nunca ha usado Babel.
 */
export async function getBabelSessionIfExists(uid: string): Promise<SessionDoc | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'sessions', babelSessionId(uid)));
  return snap.exists() ? (snap.data() as SessionDoc) : null;
}

export async function saveBabelMessages(uid: string, messages: ChatMessage[]): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'sessions', babelSessionId(uid)), { messages });
}

/**
 * Marca la fase actual como aprobada y avanza currentPhase. Usa
 * Timestamp.now() (no serverTimestamp()) para approvedAt porque Firestore
 * rechaza el sentinel de serverTimestamp() dentro de un arreglo.
 */
export async function approveBabelPhase(
  uid: string,
  phase: number,
  summary: string,
  language: 'es' | 'en'
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, 'sessions', babelSessionId(uid));
  const snap = await getDoc(ref);
  const existing = (snap.data() as SessionDoc | undefined)?.phases ?? [];
  const nextPhase = phase + 1;
  const topics = babelPhaseTopics(language);

  const record: BabelPhaseRecord = {
    phase,
    approved: true,
    approvedAt: Timestamp.now(),
    summary,
  };

  await updateDoc(ref, {
    phases: [...existing, record],
    currentPhase: nextPhase,
    topic: topics[nextPhase] ?? topics[topics.length - 1],
  });
}

/**
 * Actualiza el resumen de una fase aprobada. Busca la fase por su número y
 * reemplaza su summary. Útil para que el usuario edite y precise el análisis
 * generado por la IA después de aprobarlo.
 */
export async function updateBabelPhaseSummary(
  uid: string,
  phase: number,
  newSummary: string
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, 'sessions', babelSessionId(uid));
  const snap = await getDoc(ref);
  const existing = (snap.data() as SessionDoc | undefined)?.phases ?? [];

  const updated = existing.map((p) =>
    p.phase === phase ? { ...p, summary: newSummary } : p
  );

  await updateDoc(ref, { phases: updated });
}

/**
 * /compilar — concatena los resúmenes de todas las fases aprobadas, en orden,
 * sin resumir ni recortar nada. Con solo Fase 0 implementada por ahora,
 * devuelve lo que haya aprobado hasta este momento.
 */
export function compileApprovedPhases(session: SessionDoc): string {
  return [...(session.phases ?? [])]
    .sort((a, b) => a.phase - b.phase)
    .map((p) => p.summary)
    .join('\n\n---\n\n');
}
/**
 * Reinicia por completo la sesión de Babel: borra todos los mensajes, fases
 * aprobadas y el avance de fase, y crea el documento desde cero como si el
 * usuario nunca hubiera empezado. A diferencia de getOrCreateBabelSession,
 * esta función SIEMPRE sobreescribe el documento existente (setDoc sin
 * merge), así que no queda nada de la información anterior.
 */
export async function resetBabelSession(
  uid: string,
  language: 'es' | 'en'
): Promise<SessionDoc> {
  const db = getFirebaseDb();
  const ref = doc(db, 'sessions', babelSessionId(uid));
  const topics = babelPhaseTopics(language);
  const fresh: SessionDoc = {
    uid,
    sessionId: babelSessionId(uid),
    agentId: 'babel',
    month: 1,
    week: 1,
    topic: topics[0],
    createdAt: serverTimestamp() as SessionDoc['createdAt'],
    messages: [],
    currentPhase: 0,
    phases: [],
  };
  await setDoc(ref, fresh);
  return fresh;
}

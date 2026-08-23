import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { AssessmentDoc, MaturityLevel } from '@/types/firestore';
import { DIMENSION_IDS } from '@/lib/maturity-dimensions';
import { buildDimensionsDoc, type AssessmentResult, type DimensionAnswers, type Answer } from '@/lib/maturity-scoring';

/**
 * Guarda un diagnóstico completo como un documento nuevo bajo
 * assessments/{uid}/entries/{entryId} — una subcolección real (4 segmentos de
 * ruta), no el patrón assessments/{uid}/{assessmentId} (3 segmentos) que
 * había en firestore.rules originalmente. Ese patrón de 3 segmentos no
 * resuelve a un documento válido, así que cualquier escritura ahí habría sido
 * denegada en silencio por las reglas por defecto. firestore.rules ya se
 * actualizó para reflejar esta forma real (assessments/{uid}/entries/{entryId}),
 * y las reglas solo permiten leer/escribir al dueño del uid (isOwner(uid)).
 *
 * También guarda las respuestas crudas (`answers`) además del puntaje ya
 * calculado (`dimensions`), y marca users/{uid}.assessmentCompleted = true —
 * el flujo obligatorio pedido por el usuario usa ese campo para decidir si
 * un usuario que inicia sesión debe ir al cuestionario o directo al
 * dashboard.
 */
export async function saveAssessment(
  uid: string,
  answers: DimensionAnswers,
  result: AssessmentResult
): Promise<void> {
  const db = getFirebaseDb();
  const entryRef = doc(collection(db, 'assessments', uid, 'entries'));

  const answersDoc: Record<string, string[]> = {};
  for (const id of DIMENSION_IDS) {
    answersDoc[id] = (answers[id] ?? []).map((a) => a ?? 'no');
  }

  const assessmentDoc: AssessmentDoc = {
    uid,
    timestamp: serverTimestamp() as AssessmentDoc['timestamp'],
    answers: answersDoc,
    dimensions: buildDimensionsDoc(result.dimensions),
    totalScore: result.overallScore,
    totalLevel: result.overallLevel,
  };

  await setDoc(entryRef, assessmentDoc);
  await setDoc(
    doc(db, 'users', uid),
    { totalMaturity: Math.round(result.overallScore), assessmentCompleted: true },
    { merge: true }
  );
}

/**
 * Lee el diagnóstico más reciente de un usuario (o null si nunca ha
 * completado uno). Usado por /dashboard para reconstruir los resultados —
 * guardamos las respuestas crudas, no el texto ya traducido, así que esto
 * siempre se puede volver a mostrar correctamente sin importar en qué
 * idioma esté viendo la página el usuario en ese momento.
 */
export async function getLatestAssessmentAnswers(uid: string): Promise<DimensionAnswers | null> {
  const db = getFirebaseDb();
  const entriesQuery = query(collection(db, 'assessments', uid, 'entries'), orderBy('timestamp', 'desc'), limit(1));
  const snap = await getDocs(entriesQuery);
  if (snap.empty) return null;

  const raw = snap.docs[0].data() as AssessmentDoc;
  const answers = {} as DimensionAnswers;
  for (const id of DIMENSION_IDS) {
    answers[id] = (raw.answers?.[id] ?? new Array(6).fill('no')) as Answer[];
  }
  return answers;
}

export interface AssessmentHistoryPoint {
  timestamp: Date;
  totalScore: number; // 0-120
}

/**
 * Lee hasta `max` diagnósticos recientes (más reciente primero). Usado por el
 * resumen ejecutivo para pintar la tendencia de madurez y el delta vs. el
 * diagnóstico anterior.
 */
export async function getAssessmentHistory(uid: string, max = 8): Promise<AssessmentHistoryPoint[]> {
  const db = getFirebaseDb();
  const entriesQuery = query(collection(db, 'assessments', uid, 'entries'), orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(entriesQuery);
  return snap.docs.map((d) => {
    const raw = d.data() as AssessmentDoc;
    return {
      timestamp: raw.timestamp instanceof Timestamp ? raw.timestamp.toDate() : new Date(),
      totalScore: typeof raw.totalScore === 'number' ? raw.totalScore : 0,
    };
  });
}

export interface AssessmentSnapshot {
  timestamp: Date;
  totalScore: number;
  totalLevel: MaturityLevel;
  dimensions: AssessmentDoc['dimensions'];
}

export interface AssessmentComparison {
  current: AssessmentSnapshot;
  previous: AssessmentSnapshot | null;
}

function toSnapshot(raw: AssessmentDoc): AssessmentSnapshot {
  return {
    timestamp: raw.timestamp instanceof Timestamp ? raw.timestamp.toDate() : new Date(),
    totalScore: typeof raw.totalScore === 'number' ? raw.totalScore : 0,
    totalLevel: raw.totalLevel,
    dimensions: raw.dimensions,
  };
}

/**
 * Lee los 2 diagnósticos más recientes (el actual y, si existe, el
 * inmediatamente anterior) para que el Dashboard pueda mostrar "tu último
 * diagnóstico vs este nuevo" después de que el usuario vuelve a hacer la
 * evaluación (botón "Vuelve a hacer el diagnóstico"). `previous` es null si
 * este es el único diagnóstico que el usuario ha guardado — en ese caso no
 * hay nada que comparar todavía.
 */
export async function getAssessmentComparison(uid: string): Promise<AssessmentComparison | null> {
  const db = getFirebaseDb();
  const entriesQuery = query(collection(db, 'assessments', uid, 'entries'), orderBy('timestamp', 'desc'), limit(2));
  const snap = await getDocs(entriesQuery);
  if (snap.empty) return null;

  const docs = snap.docs.map((d) => d.data() as AssessmentDoc);
  return {
    current: toSnapshot(docs[0]),
    previous: docs[1] ? toSnapshot(docs[1]) : null,
  };
}

/**
 * Borra todos los diagnósticos guardados del usuario (assessments/{uid}/entries/*)
 * y revierte users/{uid}.assessmentCompleted a false (más totalMaturity a 0),
 * para que el flujo obligatorio de registro/login -> ¿tiene diagnóstico? lo
 * vuelva a mandar a /onboarding la próxima vez. Usado por el botón "Borrar mi
 * nivel de madurez" del Dashboard. Acción irreversible — la pantalla que la
 * llama debe confirmar con el usuario antes de invocarla.
 */
export async function deleteAllAssessments(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const entriesQuery = query(collection(db, 'assessments', uid, 'entries'));
  const snap = await getDocs(entriesQuery);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await setDoc(doc(db, 'users', uid), { assessmentCompleted: false, totalMaturity: 0 }, { merge: true });
}

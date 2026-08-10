import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { nivelDesdePuntos, trimestreActual } from '@/lib/club';
import { MISIONES_PART_LABELS, puntosDeMision } from '@/lib/worlds';

// Progreso guardado en users/{uid}.worlds = { partida: number[], tablero: boolean }
interface WorldsDoc {
  partida?: number[];
  tablero?: boolean;
}

function parseNum(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function nowISO(): string {
  return new Date().toISOString();
}

// GET /api/worlds — estado de gamificación del usuario autenticado.
export async function GET(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireAuth(req);
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }

  try {
    const db = getAdminDb();
    const uSnap = await db.collection('users').doc(uid).get();
    const uData = uSnap.exists ? (uSnap.data() as Record<string, unknown>) : {};
    const worldsRaw = (uData.worlds as WorldsDoc | undefined) ?? {};
    const partida = Array.isArray(worldsRaw.partida)
      ? worldsRaw.partida.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= MISIONES_PART_LABELS.length)
      : [];
    const puntos = parseNum(uData.puntosClub, 0);
    return NextResponse.json({
      yo: {
        uid,
        nombre: String(uData.name ?? ''),
        puntos,
        nivel: nivelDesdePuntos(puntos),
        partida,
        tablero: worldsRaw.tablero === true,
      },
    });
  } catch (err) {
    console.error('[worlds] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer el progreso.' }, { status: 500 });
  }
}

// POST /api/worlds
//   completar-mision  {mision: 1..2}  — autenticado; valida secuencia, otorga
//     los puntos de la misión una sola vez y desbloquea el Tablero al cerrar
//     la última misión del Mundo de Partida (misión 2, Objetivos Estratégicos).
export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireAuth(req);
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }

  try {
    const body = await req.json();
    const accion = String(body?.accion ?? '');
    const db = getAdminDb();
    const now = nowISO();

    if (accion === 'completar-mision') {
      const mision = Math.round(parseNum(body?.mision, 0));
      const misionesValidas = MISIONES_PART_LABELS.map((m) => m.n);
      if (!misionesValidas.includes(mision)) {
        return NextResponse.json({ error: 'Misión inválida.' }, { status: 400 });
      }
      const userRef = db.collection('users').doc(uid);
      const uSnap = await userRef.get();
      const uData = uSnap.exists ? (uSnap.data() as Record<string, unknown>) : {};
      const worldsRaw = (uData.worlds as WorldsDoc | undefined) ?? {};
      const partida = Array.isArray(worldsRaw.partida)
        ? worldsRaw.partida.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [];

      if (partida.includes(mision)) {
        return NextResponse.json({ error: 'Esta misión ya está completada.' }, { status: 409 });
      }
      // Encadenamiento: la misión N solo se puede completar si la N-1 ya está.
      if (mision > 1 && !partida.includes(mision - 1)) {
        return NextResponse.json({ error: 'Completa la misión anterior primero.' }, { status: 400 });
      }

      const pts = puntosDeMision(mision);
      const nuevaPartida = [...partida, mision].sort((a, b) => a - b);
      const esFinalPartida = mision === MISIONES_PART_LABELS.length;
      const tablero = esFinalPartida ? true : worldsRaw.tablero === true;
      const uDataPuntos = parseNum(uData.puntosClub, 0);

      // Puntos + log + progreso en un solo batch.
      const batch = db.batch();
      batch.update(userRef, {
        puntosClub: uDataPuntos + pts,
        worlds: { partida: nuevaPartida, tablero },
      });
      const log = db.collection('puntos_club').doc();
      batch.set(log, {
        userId: uid,
        juntaId: '',
        origen: 'worlds',
        categoria: `mision_mundos_${mision}`,
        valor: pts,
        trimestre: trimestreActual(),
        fecha: now,
        nota: `Mundo de Partida · Misión ${mision}`,
        otorgadoPor: uid,
      });
      await batch.commit();

      return NextResponse.json({
        ok: true,
        mision,
        pts,
        partida: nuevaPartida,
        tablero,
        puntos: uDataPuntos + pts,
        desbloqueo: tablero ? (esFinalPartida ? { tablero: true } : {}) : {},
      });
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  } catch (err) {
    console.error('[worlds] POST error', err);
    return NextResponse.json({ error: 'No se pudo procesar la acción.' }, { status: 500 });
  }
}
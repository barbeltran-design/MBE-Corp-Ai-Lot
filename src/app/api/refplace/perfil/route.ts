import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { nivelLabel, nivelPorPuntos } from '@/lib/refplace';

function parseNum(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function nivelAuto(u: Record<string, unknown>): string {
  const puntos = parseNum(u.puntosClub, 0);
  if (puntos > 0) return nivelPorPuntos(puntos);
  const manual = typeof u.nivelComunidad === 'string' ? u.nivelComunidad : '';
  return manual || 'godin_wannabe';
}

// GET /api/refplace/perfil?uid=xxx — perfil público de un miembro de la
// comunidad certificada con madurez, niveles, teléfono, correo, certificación,
// historial de reuniones y resultados con montos.
export async function GET(req: NextRequest) {
  let me: string;
  try {
    me = await requireAuth(req);
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }

  const uid = req.nextUrl.searchParams.get('uid') || me;
  try {
    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    const u = userSnap.data() as Record<string, unknown>;

    const companySnap = await db.collection('companies').doc(uid).get();
    const c = companySnap.exists ? (companySnap.data() as Record<string, unknown>) : {};

    // Madurez: última evaluación (totales por área + score global)
    const assSnap = await db
      .collection('assessments').doc(uid).collection('entries')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    let madurez: Record<string, unknown> | null = null;
    if (!assSnap.empty) {
      const entry = assSnap.docs[0].data() as Record<string, unknown>;
      madurez = {
        totalScore: typeof entry.totalScore === 'number' ? entry.totalScore : null,
        nivelGlobal: entry.nivelGlobal ?? entry.totalLevel ?? null,
        areas: entry.areas ?? entry.results ?? null,
        fecha: String(entry.timestamp ?? ''),
      };
    }

    // Reuniones completadas y resultados
    const reunSnap = await db.collection('reuniones_b2b').where('estatus', '==', 'completada').get();
    let reunionesCompletadas = 0;
    let montoResultados = 0;
    const resultadosAgregados: { tipo: string; monto: number; descripcion: string; createdAt: string }[] = [];
    for (const doc of reunSnap.docs) {
      const r = doc.data() as Record<string, unknown>;
      const participantes = Array.isArray(r.participantes) ? (r.participantes as unknown[]) : [];
      if (!participantes.some((p) => (p as { uid?: string })?.uid === uid)) continue;
      reunionesCompletadas += 1;
      const resultados = Array.isArray(r.resultados) ? (r.resultados as Record<string, unknown>[]) : [];
      resultados.forEach((res) => {
        if ((res?.uid as string) !== uid) return;
        const m = parseNum(res?.monto, 0);
        montoResultados += m;
        resultadosAgregados.push({
          tipo: String(res?.tipo ?? ''),
          monto: m,
          descripcion: String(res?.descripcion ?? ''),
          createdAt: String(res?.createdAt ?? ''),
        });
      });
    }

    const roles = Array.isArray(u.roles) ? (u.roles as unknown[]).map(String) : [];
    return NextResponse.json({
      perfil: {
        uid,
        nombre: (u.name as string) || '',
        email: (u.email as string) || '',
        telefono: (u.telefono as string) || '',
        empresa: (c.name as string) || '',
        giro: (c.industry as string) || '',
        website: (c.website as string) || '',
        pais: (u.country as string) || ((c.country as string) || ''),
        puntosClub: parseNum(u.puntosClub, 0),
        juntasAsistidas: parseNum(u.semanasJunta, 0),
        nivel: {
          id: nivelAuto(u),
          es: nivelLabel(nivelAuto(u), 'es'),
          en: nivelLabel(nivelAuto(u), 'en'),
        },
        certificado: u.certificado === true,
        rolRepSale: roles.includes('rep_sale'),
        madurez,
        reunionesCompletadas,
        montoResultados,
        resultados: resultadosAgregados,
      },
    });
  } catch (err) {
    console.error('[refplace/perfil] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer el perfil.' }, { status: 500 });
  }
}
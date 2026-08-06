import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';
import { TEMAS_ESPECIALISTA, dimensionDeTema, TEMA_LABELS, type TemaEspecialista } from '@/lib/roles';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type Answer, type DimensionAnswers } from '@/lib/maturity-scoring';
import { DIMENSION_IDS } from '@/lib/maturity-dimensions';

// GET /api/especialista/panel — panel del especialista:
//  - usuarios con nivel de madurez en sus temas (+ pendientes de plan de
//    acción y de madurez de cada usuario en esos temas)
//  - actividades que ha realizado el especialista
//  - pagos que ha recibido
//  - su perfil (banco + agenda)
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'especialista');
  if (guard instanceof NextResponse) return guard;
  const uid = guard.uid;

  try {
    const db = getAdminDb();

    const perfilSnap = await db.collection('users').doc(uid).get();
    const perfil = perfilSnap.exists ? (perfilSnap.data() as Record<string, unknown>) : {};
    const temas: TemaEspecialista[] = (Array.isArray(perfil.especialistaTemas)
      ? (perfil.especialistaTemas as unknown[])
      : []
    )
      .map((t) => String(t))
      .filter((t) => (TEMAS_ESPECIALISTA as readonly string[]).includes(t)) as TemaEspecialista[];

    // ── Usuarios y su madurez en los temas del especialista ─────────────
    const dims = getMaturityDimensions('es');
    const dimsEn = getMaturityDimensions('en');
    const usersSnap = await db.collection('users').limit(500).get();

    const usuarios: {
      uid: string;
      nombre: string;
      email: string;
      temas: { id: string; nivel: string; nivelEn: string; nextStep: string }[];
      planAccionPendientes: number;
      madurezPendientes: number;
    }[] = [];

    for (const userSnap of usersSnap.docs) {
      const userData = userSnap.data() as Record<string, unknown>;
      const u = userSnap.id;
      if (u === uid) continue;

      // Último assessment del usuario.
      const assSnap = await db
        .collection('assessments')
        .doc(u)
        .collection('entries')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      if (assSnap.empty) continue;

      const ass = assSnap.docs[0].data() as Record<string, unknown>;
      const rawAnswers = ass.answers as Record<string, string[] | undefined> | undefined;
      const answers: DimensionAnswers = {} as DimensionAnswers;
      for (const id of DIMENSION_IDS) {
        answers[id] = ((rawAnswers?.[id] as string[] | undefined) ?? new Array(6).fill('no')).map(
          (a) => (a === 'yes' || a === 'partial' ? a : 'no')
        ) as Answer[];
      }
      const result = computeResults(dims, answers);
      const resultEn = computeResults(dimsEn, answers);

      const temasInfo = temas
        .map((temaId) => {
          const dimId = dimensionDeTema(temaId);
          if (!dimId) {
            return { id: temaId, nivel: '', nivelEn: '', nextStep: '' };
          }
          const dimIdx = dims.findIndex((d) => d.id === dimId);
          if (dimIdx < 0) return null;
          const res = result.dimensions[dimIdx];
          const resEn = resultEn.dimensions[dimIdx];
          return {
            id: temaId,
            nivel: String(res.level),
            nivelEn: String(resEn.level),
            nextStep: res.nextStep ? res.nextStep.description : '',
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Pendientes del usuario en sus secciones (sincronizadas a Firestore).
      const planSnap = await db.collection('users').doc(u).collection('workspace').doc('plan-accion').get();
      const madSnap = await db.collection('users').doc(u).collection('workspace').doc('madurez-plan').get();

      const planAccionPendientes = planSnap.exists
        ? countPlanPendientes(planSnap.data()?.data)
        : 0;
      const madurezPendientes = madSnap.exists
        ? countMadurezPendientes(madSnap.data()?.data)
        : 0;

      usuarios.push({
        uid: u,
        nombre: (userData.name as string) ?? '',
        email: (userData.email as string) ?? '',
        temas: temasInfo,
        planAccionPendientes,
        madurezPendientes,
      });
    }

    // ── Actividades realizadas por el especialista ──────────────────────
    const actSnap = await db
      .collection('actividadesEspecialista')
      .where('especialistaUid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const actividades = actSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // ── Pagos recibidos ─────────────────────────────────────────────────
    const pagosSnap = await db
      .collection('pagosEspecialistas')
      .where('especialistaUid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const pagosRecibidos = pagosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({
      perfil: {
        uid,
        nombre: perfil.name ?? '',
        email: perfil.email ?? '',
        temas,
        temasLabels: temas.map((t) => TEMA_LABELS[t].es),
        agenda: perfil.agenda ?? null,
        banco: perfil.banco ?? null,
      },
      usuarios,
      actividades,
      pagosRecibidos,
    });
  } catch (err) {
    console.error('[especialista/panel] error', err);
    return NextResponse.json({ error: 'No se pudo cargar el panel.' }, { status: 500 });
  }
}

// POST /api/especialista/perfil — guarda datos bancarios y/o link de agenda
// (calendly / google calendar) del especialista.
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'especialista');
  if (guard instanceof NextResponse) return guard;
  const uid = guard.uid;

  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (body?.agenda !== undefined) {
      const agenda = body.agenda as Record<string, unknown> | null;
      patch.agenda = agenda && (typeof agenda.link === 'string' || typeof agenda.usuario === 'string')
        ? {
            plataforma: agenda.plataforma === 'google' ? 'google' : 'calendly',
            link: typeof agenda.link === 'string' ? agenda.link : '',
            usuario: typeof agenda.usuario === 'string' ? agenda.usuario : '',
          }
        : null;
    }
    if (body?.banco !== undefined) {
      const banco = body.banco as Record<string, unknown> | null;
      patch.banco = banco
        ? {
            clabe: typeof banco.clabe === 'string' ? banco.clabe : '',
            banco: typeof banco.banco === 'string' ? banco.banco : '',
            titular: typeof banco.titular === 'string' ? banco.titular : '',
            email: typeof banco.email === 'string' ? banco.email : '',
          }
        : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada que guardar.' }, { status: 400 });
    }
    await getAdminDb().collection('users').doc(uid).set(patch, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[especialista/perfil] error', err);
    return NextResponse.json({ error: 'No se pudo guardar el perfil.' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function countPlanPendientes(raw: unknown): number {
  try {
    if (typeof raw !== 'string') return 0;
    const plan = JSON.parse(raw);
    const acciones = Array.isArray(plan?.acciones) ? plan.acciones : [];
    return acciones.filter((a: Record<string, unknown>) => !a.validado).length;
  } catch {
    return 0;
  }
}

function countMadurezPendientes(raw: unknown): number {
  try {
    if (typeof raw !== 'string') return 0;
    const plan = JSON.parse(raw);
    const compromisos: unknown[] = Object.values(plan?.compromisos ?? {});
    const flat = compromisos.flatMap((c) => (Array.isArray(c) ? c : []));
    return flat.filter((c) => (c as Record<string, unknown>).estado !== 'Completada').length;
  } catch {
    return 0;
  }
}

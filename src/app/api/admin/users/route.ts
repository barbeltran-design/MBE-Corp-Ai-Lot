import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';
import { APP_ROLES, TEMAS_ESPECIALISTA } from '@/lib/roles';

// GET /api/admin/users — lista usuarios con sus roles, empresa, madurez y
// actividad registrada en la aplicación (assessments, sesiones babel, pagos).
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const usersSnap = await db.collection('users').limit(500).get();

    const users = await Promise.all(
      usersSnap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;

        // Actividad por secciones (todas bajo el uid del usuario).
        const [assessmentsSnap, sessionsSnap, pagosSnap] = await Promise.all([
          db.collection('assessments').doc(uid).collection('entries').limit(20).get(),
          db.collection('sessions').where('uid', '==', uid).limit(50).get(),
          db.collection('pagos').where('uid', '==', uid).limit(50).get(),
        ]);

        return {
          uid,
          name: data.name ?? '',
          email: data.email ?? '',
          roles: Array.isArray(data.roles) ? data.roles : [],
          especialistaTemas: Array.isArray(data.especialistaTemas) ? data.especialistaTemas : [],
          certificado: data.certificado === true,
          subscription: data.subscription ?? 'free',
          planStatus: data.planStatus ?? '',
          totalMaturity: typeof data.totalMaturity === 'number' ? data.totalMaturity : null,
          assessmentCompleted: data.assessmentCompleted === true,
          companyName: data.companyName ?? '',
          createdAt: data.createdAt ?? null,
          actividad: {
            assessments: assessmentsSnap.size,
            ultimaAssessment: assessmentsSnap.docs[0]?.data().timestamp ?? null,
            sesionesBabel: sessionsSnap.docs.length,
            pagos: pagosSnap.docs.length,
          },
        };
      })
    );

    users.sort((a, b) => {
      const aAdmin = a.roles.includes('admin') ? 1 : 0;
      const bAdmin = b.roles.includes('admin') ? 1 : 0;
      if (aAdmin !== bAdmin) return bAdmin - aAdmin;
      return (a.name || '').localeCompare(b.name || '');
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[admin/users] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer los usuarios.' }, { status: 500 });
  }
}

// POST /api/admin/users/roles — asigna roles y temas de especialista a un usuario.
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const uid = body?.uid;
    if (typeof uid !== 'string' || !uid) {
      return NextResponse.json({ error: 'Falta el uid del usuario.' }, { status: 400 });
    }
    const roles = Array.isArray(body?.roles)
      ? (body.roles as unknown[]).filter((r): r is string => APP_ROLES.includes(r as (typeof APP_ROLES)[number]))
      : [];
    const temas = Array.isArray(body?.especialistaTemas)
      ? (body.especialistaTemas as unknown[]).filter((t): t is string => (TEMAS_ESPECIALISTA as readonly string[]).includes(String(t))).map(String)
      : [];
    if (roles.length === 0 && !body?.roles) {
      return NextResponse.json({ error: 'Faltan los roles.' }, { status: 400 });
    }
    const certificado = typeof body?.certificado === 'boolean' ? body.certificado : undefined;

    const patch: Record<string, unknown> = {
      roles: roles.length ? roles : ['usuario'],
      especialistaTemas: temas,
    };
    if (certificado !== undefined) patch.certificado = certificado;

    await getAdminDb().collection('users').doc(uid).set(patch, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/users/roles] POST error', err);
    return NextResponse.json({ error: 'No se pudieron guardar los roles.' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { requireRole, requireAdminSeccion } from '@/lib/server-roles';
import { APP_ROLES, SECCIONES_ADMIN, TEMAS_ESPECIALISTA } from '@/lib/roles';

// GET /api/admin/users — lista usuarios con sus roles, empresa, madurez y
// actividad registrada en la aplicación (assessments, sesiones babel, pagos).
// Accesible para el admin general o para un admin de la seccion 'users'
// (solo lectura; los cambios de roles siguen reservados al admin general).
export async function GET(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'users');
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

        // Suma de lo invertido: cada doc en `pagos` guarda `monto` (MXN, ver
        // /api/webhooks/mercadopago). Se ignoran montos no numéricos.
        const totalInvertido = pagosSnap.docs.reduce((acc, d) => {
          const m = d.data().monto;
          return acc + (typeof m === 'number' && Number.isFinite(m) ? m : 0);
        }, 0);

        return {
          uid,
          name: data.name ?? '',
          email: data.email ?? '',
          roles: Array.isArray(data.roles) ? data.roles : [],
          adminSecciones: Array.isArray(data.adminSecciones)
            ? data.adminSecciones
            : [],
          especialistaTemas: Array.isArray(data.especialistaTemas) ? data.especialistaTemas : [],
          certificado: data.certificado === true,
          estatus: data.estatus === 'cancelado' ? 'cancelado' : 'activo',
          subscription: data.subscription ?? 'free',
          planStatus: data.planStatus ?? '',
          planCancelaEn: typeof data.planCancelaEn === 'string' ? data.planCancelaEn : null,
          accesoManualPremium: data.accesoManualPremium === true,
          totalInvertido,
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
    // Administracion por seccion: solo claves validas. Reservado al admin
    // general (esta ruta ya exige el rol 'admin' completo).
    const secciones = Array.isArray(body?.adminSecciones)
      ? (body.adminSecciones as unknown[])
          .map((s) => String(s))
          .filter((s): s is (typeof SECCIONES_ADMIN)[number] =>
            (SECCIONES_ADMIN as readonly string[]).includes(s)
          )
      : [];
    if (roles.length === 0 && !body?.roles) {
      return NextResponse.json({ error: 'Faltan los roles.' }, { status: 400 });
    }
    const certificado = typeof body?.certificado === 'boolean' ? body.certificado : undefined;
    const accesoManualPremium = typeof body?.accesoManualPremium === 'boolean' ? body.accesoManualPremium : undefined;

    const patch: Record<string, unknown> = {
      roles: roles.length ? roles : ['usuario'],
      especialistaTemas: temas,
      adminSecciones: secciones,
    };
    if (certificado !== undefined) patch.certificado = certificado;
    if (accesoManualPremium !== undefined) {
      patch.accesoManualPremium = accesoManualPremium;
      patch.accesoManualPor = accesoManualPremium ? guard.uid : null;
      patch.accesoManualAt = accesoManualPremium ? new Date().toISOString() : null;
    }

    await getAdminDb().collection('users').doc(uid).set(patch, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/users/roles] POST error', err);
    return NextResponse.json({ error: 'No se pudieron guardar los roles.' }, { status: 500 });
  }
}

// PATCH /api/admin/users — cambia el estatus de un usuario (activo/cancelado)
// sin tocar sus roles. Se usa desde el botón "Cancelar"/"Reactivar" del panel.
export async function PATCH(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const uid = body?.uid;
    const estatus = body?.estatus;
    if (typeof uid !== 'string' || !uid) {
      return NextResponse.json({ error: 'Falta el uid del usuario.' }, { status: 400 });
    }
    if (estatus !== 'activo' && estatus !== 'cancelado') {
      return NextResponse.json({ error: 'Estatus inválido.' }, { status: 400 });
    }

    await getAdminDb().collection('users').doc(uid).set(
      {
        estatus,
        estatusPor: guard.uid,
        estatusAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/users] PATCH error', err);
    return NextResponse.json({ error: 'No se pudo actualizar el estatus.' }, { status: 500 });
  }
}

// DELETE /api/admin/users?uid=... — borra al usuario por completo: su cuenta
// de acceso (Firebase Auth) y su documento en Firestore (users/{uid}). No
// borra el historial que haya dejado en otras colecciones (evaluaciones,
// sesiones, pagos) para no perder esos registros contables/históricos.
export async function DELETE(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const uid = req.nextUrl.searchParams.get('uid');
    if (!uid) {
      return NextResponse.json({ error: 'Falta el uid del usuario.' }, { status: 400 });
    }
    if (uid === guard.uid) {
      return NextResponse.json({ error: 'No puedes borrar tu propia cuenta de administrador.' }, { status: 400 });
    }

    try {
      await getAdminAuth().deleteUser(uid);
    } catch (authErr) {
      // Si ya no existe en Firebase Auth (por ejemplo, se borró antes),
      // seguimos adelante y borramos igual el documento en Firestore.
      console.warn('[admin/users] no se pudo borrar en Firebase Auth (se ignora):', authErr);
    }

    await getAdminDb().collection('users').doc(uid).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/users] DELETE error', err);
    return NextResponse.json({ error: 'No se pudo borrar el usuario.' }, { status: 500 });
  }
}
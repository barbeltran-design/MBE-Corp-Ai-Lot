import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';
import { TEMAS_ESPECIALISTA, type AppRole } from '@/lib/roles';

// Peticiones de rol: colección `solicitudes/{id}`
// { uid, nombre, email, tipo: 'especialista'|'rep_sale', temas: string[],
//   mensaje, estado: 'pendiente'|'aprobada'|'rechazada', createdAt }

// GET /api/admin/solicitudes — solicitudes de convertir usuario en
// especialista / rep sale (pendientes primero).
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const snap = await db.collection('solicitudes').orderBy('createdAt', 'desc').limit(200).get();
    const solicitudes: Record<string, unknown>[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    solicitudes.sort((a, b) => {
      const pa = a.estado === 'pendiente' ? 0 : 1;
      const pb = b.estado === 'pendiente' ? 0 : 1;
      return pa - pb;
    });
    return NextResponse.json({ solicitudes });
  } catch (err) {
    console.error('[admin/solicitudes] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer las solicitudes.' }, { status: 500 });
  }
}

// POST /api/admin/solicitudes — aprueba o rechaza una solicitud. Al aprobar,
// agrega el rol y (para especialista) los temas al perfil del usuario.
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const id = body?.id;
    const aprobar = body?.aprobar === true;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('solicitudes').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'La solicitud no existe.' }, { status: 404 });
    }
    const data = snap.data();
    const uid = data?.uid;
    const tipo = data?.tipo;
    if (typeof uid !== 'string' || !uid || (tipo !== 'especialista' && tipo !== 'rep_sale')) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }

    await ref.update({
      estado: aprobar ? 'aprobada' : 'rechazada',
      atendidaPor: guard.uid,
      atendidaEn: new Date().toISOString(),
    });

    if (aprobar) {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const current = (userSnap.data() as Record<string, unknown>) ?? {};
      const currentRoles: string[] = Array.isArray(current.roles)
        ? (current.roles as unknown[]).map(String)
        : [];
      const newRole: AppRole = tipo === 'especialista' ? 'especialista' : 'rep_sale';
      const roles = Array.from(new Set([...currentRoles, newRole]));
      const temas: string[] = Array.isArray(data.temas)
        ? (data.temas as unknown[])
            .map((t) => String(t))
            .filter((t) => (TEMAS_ESPECIALISTA as readonly string[]).includes(t))
        : [];
      await userRef.set(
        {
          roles,
          especialistaTemas: tipo === 'especialista' ? temas : userRefTemas(current),
        },
        { merge: true } // merge: solo agrega roles/temas, no borra el resto del perfil
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/solicitudes] POST error', err);
    return NextResponse.json({ error: 'No se pudo procesar la solicitud.' }, { status: 500 });
  }
}

function userRefTemas(data: unknown): string[] {
  return Array.isArray((data as { especialistaTemas?: unknown })?.especialistaTemas)
    ? ((data as { especialistaTemas: unknown[] }).especialistaTemas.map((t) => String(t)))
    : [];
}
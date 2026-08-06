import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';

// POST /api/especialista/actividad — registra una actividad realizada por el
// especialista (p. ej. una reunión de asesoría con un usuario).
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'especialista');
  if (guard instanceof NextResponse) return guard;
  const uid = guard.uid;

  try {
    const body = await req.json();
    const descripcion = body?.descripcion;
    if (typeof descripcion !== 'string' || !descripcion.trim()) {
      return NextResponse.json({ error: 'Falta la descripción.' }, { status: 400 });
    }
    const db = getAdminDb();
    const ref = db.collection('actividadesEspecialista').doc();
    await ref.set({
      especialistaUid: uid,
      usuarioUid: typeof body?.usuarioUid === 'string' ? body.usuarioUid : '',
      usuarioNombre: typeof body?.usuarioNombre === 'string' ? body.usuarioNombre : '',
      tema: typeof body?.tema === 'string' ? body.tema : '',
      tipo: typeof body?.tipo === 'string' ? body.tipo : 'reunion',
      descripcion: descripcion.trim(),
      fecha: typeof body?.fecha === 'string' && body.fecha ? body.fecha : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[especialista/actividad] error', err);
    return NextResponse.json({ error: 'No se pudo registrar la actividad.' }, { status: 500 });
  }
}
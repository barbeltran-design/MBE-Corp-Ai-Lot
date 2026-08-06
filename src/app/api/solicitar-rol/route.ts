import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { TEMAS_ESPECIALISTA } from '@/lib/roles';

// POST /api/solicitar-rol — el usuario logueado solicita convertirse en
// especialista o rep sale.
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
    const tipo = body?.tipo;
    if (tipo !== 'especialista' && tipo !== 'rep_sale') {
      return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    }
    const temas = tipo === 'especialista'
      ? (Array.isArray(body?.temas) ? (body.temas as unknown[]).map(String).filter((t) => (TEMAS_ESPECIALISTA as readonly string[]).includes(t)) : [])
      : [];

    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    const nombre = typeof userData.name === 'string' ? userData.name : '';
    const email = typeof userData.email === 'string' ? userData.email : '';

    // No duplicar solicitudes pendientes del mismo tipo.
    const existingSnap = await db
      .collection('solicitudes')
      .where('uid', '==', uid)
      .where('tipo', '==', tipo)
      .where('estado', '==', 'pendiente')
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'Ya tienes una solicitud pendiente.' }, { status: 409 });
    }

    await db.collection('solicitudes').add({
      uid,
      nombre,
      email,
      tipo,
      temas,
      mensaje: typeof body?.mensaje === 'string' ? body.mensaje : '',
      estado: 'pendiente',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[solicitar-rol] error', err);
    return NextResponse.json({ error: 'No se pudo crear la solicitud.' }, { status: 500 });
  }
}

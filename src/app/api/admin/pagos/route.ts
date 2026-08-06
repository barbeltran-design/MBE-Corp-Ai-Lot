import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';

// GET /api/admin/pagos — todos los pagos recibidos vía Mercado Pago
// (la colección `pagos` la llena el webhook de mercadopago).
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const snap = await db.collection('pagos').orderBy('createdAt', 'desc').limit(200).get();
    const pagos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ pagos });
  } catch (err) {
    console.error('[admin/pagos] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer los pagos.' }, { status: 500 });
  }
}
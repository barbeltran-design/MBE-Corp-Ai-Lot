import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';

// GET /api/admin/pagos-especialistas — pagos registrados a especialistas.
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const snap = await db.collection('pagosEspecialistas').orderBy('createdAt', 'desc').limit(200).get();
    const pagos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ pagos });
  } catch (err) {
    console.error('[admin/pagos-especialistas] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer los pagos.' }, { status: 500 });
  }
}

// POST /api/admin/pagos-especialistas — registra un pago manual a un especialista.
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const especialistaUid = body?.especialistaUid;
    const monto = Number(body?.monto);
    if (typeof especialistaUid !== 'string' || !especialistaUid || !Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ error: 'Faltan el especialista y/o el monto.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('pagosEspecialistas').doc();
    await ref.set({
      especialistaUid,
      especialistaNombre: typeof body?.especialistaNombre === 'string' ? body.especialistaNombre : '',
      monto,
      moneda: 'MXN',
      concepto: typeof body?.concepto === 'string' ? body.concepto : 'Honorarios',
      metodo: typeof body?.metodo === 'string' ? body.metodo : 'Transferencia',
      fechaPago: typeof body?.fechaPago === 'string' && body.fechaPago ? body.fechaPago : new Date().toISOString(),
      registradoPor: guard.uid,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[admin/pagos-especialistas] POST error', err);
    return NextResponse.json({ error: 'No se pudo registrar el pago.' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdminSeccion } from '@/lib/server-roles';

// GET /api/admin/pagos-especialistas — pagos registrados a especialistas.
export async function GET(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'pagosEsp');
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
  const guard = await requireAdminSeccion(req, 'pagosEsp');
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
      estatus: 'activo',
      registradoPor: guard.uid,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[admin/pagos-especialistas] POST error', err);
    return NextResponse.json({ error: 'No se pudo registrar el pago.' }, { status: 500 });
  }
}

// PATCH /api/admin/pagos-especialistas — modifica un pago existente (monto,
// concepto, método, fecha) y/o cambia su estatus (activo/cancelado).
export async function PATCH(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'pagosEsp');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Falta el id del pago.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};

    if (body?.monto !== undefined) {
      const monto = Number(body.monto);
      if (!Number.isFinite(monto) || monto <= 0) {
        return NextResponse.json({ error: 'El monto no es válido.' }, { status: 400 });
      }
      patch.monto = monto;
    }
    if (typeof body?.concepto === 'string') patch.concepto = body.concepto;
    if (typeof body?.metodo === 'string') patch.metodo = body.metodo;
    if (typeof body?.fechaPago === 'string' && body.fechaPago) patch.fechaPago = body.fechaPago;
    if (typeof body?.especialistaNombre === 'string') patch.especialistaNombre = body.especialistaNombre;
    if (body?.estatus === 'activo' || body?.estatus === 'cancelado') patch.estatus = body.estatus;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No hay cambios que guardar.' }, { status: 400 });
    }

    patch.editadoPor = guard.uid;
    patch.editadoAt = new Date().toISOString();

    await getAdminDb().collection('pagosEspecialistas').doc(id).set(patch, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/pagos-especialistas] PATCH error', err);
    return NextResponse.json({ error: 'No se pudo modificar el pago.' }, { status: 500 });
  }
}
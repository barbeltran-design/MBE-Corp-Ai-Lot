import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdminSeccion } from '@/lib/server-roles';

function parseNum(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// GET /api/admin/refplace — todas las solicitudes de referencia y ofertas de
// Rep Sale (incluye cerradas/inactivas), para que administración las pueda
// revisar, editar o borrar.
export async function GET(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'refplace');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const solSnap = await db
      .collection('solicitudes_referencia')
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get();
    const solicitudes = solSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const ofSnap = await db
      .collection('ofertas_rep_sale')
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get();
    const ofertas = ofSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ solicitudes, ofertas });
  } catch (err) {
    console.error('[admin/refplace] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer las referencias.' }, { status: 500 });
  }
}

// PATCH /api/admin/refplace — edita una solicitud de referencia o una oferta
// de Rep Sale (cualquier campo, sin importar quién la creó).
//   body: { tipo: 'solicitud'|'oferta', id, empresaObjetivo?, empresa?, rubro?, descripcion?, comisionPct?, estatus? }
export async function PATCH(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'refplace');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const tipo = body?.tipo as string;
    const id = String(body?.id ?? '');
    if (!id || (tipo !== 'solicitud' && tipo !== 'oferta')) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const db = getAdminDb();
    const coleccion = tipo === 'solicitud' ? 'solicitudes_referencia' : 'ofertas_rep_sale';
    const ref = db.collection(coleccion).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

    const cambios: Record<string, unknown> = { editadaEn: new Date().toISOString(), editadaPorAdmin: guard.uid };
    if (tipo === 'solicitud') {
      if (body.empresaObjetivo !== undefined) cambios.empresaObjetivo = String(body.empresaObjetivo).trim();
    } else {
      if (body.empresa !== undefined) cambios.empresa = String(body.empresa).trim();
    }
    if (body.rubro !== undefined) cambios.rubro = String(body.rubro).trim();
    if (body.descripcion !== undefined) cambios.descripcion = String(body.descripcion).trim();
    if (body.comisionPct !== undefined) cambios.comisionPct = parseNum(body.comisionPct, 0);
    if (body.estatus !== undefined) cambios.estatus = String(body.estatus);

    await ref.update(cambios);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/refplace] PATCH error', err);
    return NextResponse.json({ error: 'No se pudo editar.' }, { status: 500 });
  }
}

// DELETE /api/admin/refplace?tipo=solicitud|oferta&id=... — borra una
// solicitud de referencia o una oferta de Rep Sale, la haya creado quien sea.
export async function DELETE(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'refplace');
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const id = searchParams.get('id');
    if (!id || (tipo !== 'solicitud' && tipo !== 'oferta')) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }
    const db = getAdminDb();
    const coleccion = tipo === 'solicitud' ? 'solicitudes_referencia' : 'ofertas_rep_sale';
    await db.collection(coleccion).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/refplace] DELETE error', err);
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 });
  }
}

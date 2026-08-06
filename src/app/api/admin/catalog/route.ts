import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';
import { DEFAULT_CATALOG, productIdValido, type CatalogItem } from '@/lib/catalog';

// GET /api/admin/catalog — catálogo de precios (uno por producto pago).
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const snap = await db.collection('catalog').get();
    const items: CatalogItem[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      items.push({
        id: docSnap.id,
        titulo: data.titulo ?? '',
        tituloEn: data.tituloEn ?? '',
        precio: typeof data.precio === 'number' ? data.precio : 0,
        moneda: 'MXN',
        promocion: typeof data.promocion === 'number' ? data.promocion : null,
        promocionActiva: data.promocionActiva === true,
        activo: data.activo !== false,
        updatedAt: data.updatedAt ?? '',
      });
    }
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[admin/catalog] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer el catálogo.' }, { status: 500 });
  }
}

// PUT /api/admin/catalog — actualiza precio/promoción/estado de un producto.
export async function PUT(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const id = body?.id;
    if (typeof id !== 'string' || !productIdValido(id)) {
      return NextResponse.json({ error: 'Producto inválido.' }, { status: 400 });
    }
    const allowedFields = ['precio', 'promocion', 'promocionActiva', 'activo', 'titulo', 'tituloEn'] as const;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowedFields) {
      if (body?.[key] !== undefined) {
        patch[key] = body[key];
      }
    }
    await getAdminDb().collection('catalog').doc(id).set(patch, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/catalog] PUT error', err);
    return NextResponse.json({ error: 'No se pudo guardar el catálogo.' }, { status: 500 });
  }
}

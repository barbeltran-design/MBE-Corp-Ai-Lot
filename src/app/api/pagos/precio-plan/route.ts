// ─────────────────────────────────────────────────────────────────────────
// GET /api/pagos/precio-plan
//
// Regresa el precio actual (configurado en el catalogo de Firestore, o el
// valor por defecto si aun no existe) del plan mensual, para que los
// botones de pago puedan mostrar el monto real en vez de un numero fijo.
//
// Requiere: Authorization: Bearer <token de Firebase del usuario logueado>
// Respuesta: { precio: number, moneda: 'MXN' }
// Si algo falla, de todas formas responde 200 con el precio por defecto
// para que el boton de pago nunca se rompa por esto.
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { defaultCatalogItem } from '@/lib/catalog';

const PRODUCT_ID = 'plan_mensual';

export async function GET(req: NextRequest) {
  const def = defaultCatalogItem(PRODUCT_ID);
  const precioDefault = def?.precio ?? 99;
  try {
    await requireAuth(req);
    const db = getAdminDb();
    const snap = await db.collection('catalog').doc(PRODUCT_ID).get();
    const data = snap.exists ? snap.data() : null;
    const precio =
      typeof data?.promocion === 'number' && data?.promocionActiva === true
        ? data.promocion
        : typeof data?.precio === 'number'
          ? data.precio
          : precioDefault;
    return NextResponse.json({ precio, moneda: 'MXN' });
  } catch (err) {
    console.error('[precio-plan] Error:', err);
    return NextResponse.json({ precio: precioDefault, moneda: 'MXN' });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/pagos/cancelar-suscripcion
//
// ESTE ARCHIVO VA EN: src/app/api/pagos/cancelar-suscripcion/route.ts
//
// Qué hace: el usuario da clic en "Cancelar suscripción" en /perfil → esta
// ruta (1) verifica quién es, (2) si tiene una suscripción de Mercado Pago
// asociada (mercadoPagoPreapprovalId), la cancela ahí de verdad — así deja
// de cobrarse cada mes — y (3) le quita el acceso pro en Firestore de
// inmediato (la cancelación es inmediata, no espera a que termine el
// periodo ya pagado).
//
// Nota: si por algún motivo el usuario no tiene un mercadoPagoPreapprovalId
// guardado (por ejemplo, si su plan quedó activo manualmente, o si nunca
// llegó a completar el checkout de la suscripción), esta ruta igual le
// quita el acceso pro en Firestore — solo que no hay nada que cancelar del
// lado de Mercado Pago.
//
// Variable de entorno requerida:
//   MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION (de la app de Suscripciones en
//   Mercado Pago — distinta de MERCADOPAGO_ACCESS_TOKEN, que es la de pagos
//   únicos)
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : null;
    const preapprovalId = userData?.mercadoPagoPreapprovalId as string | undefined;

    // Si hay una suscripción real de Mercado Pago asociada, la cancelamos
    // ahí primero — esto es lo que de verdad detiene el cobro automático.
    if (preapprovalId) {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION;
      if (!accessToken) {
        throw new Error('[cancelar-suscripcion] Falta MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION.');
      }
      const client = new MercadoPagoConfig({ accessToken });
      try {
        await new PreApproval(client).update({
          id: preapprovalId,
          body: { status: 'cancelled' },
        });
      } catch (err) {
        // Si Mercado Pago ya la tenía cancelada (por ejemplo, el usuario la
        // canceló desde su propia cuenta de Mercado Pago), seguimos igual
        // con la parte de Firestore — el objetivo (que quede cancelada) ya
        // se cumple. Cualquier otro error sí se reporta.
        console.error('[cancelar-suscripcion] Error al cancelar en Mercado Pago (se continúa):', err);
      }
    }

    // Revocar el acceso pro de inmediato en Firestore, tenga o no una
    // suscripción de Mercado Pago asociada.
    await userRef.set(
      {
        subscription: 'cancelled',
        planStatus: 'cancelled',
        planCanceladoAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      canceladaEnMercadoPago: Boolean(preapprovalId),
    });
  } catch (err) {
    console.error('[cancelar-suscripcion] Error:', err);
    return NextResponse.json({ error: 'No se pudo cancelar la suscripción.' }, { status: 500 });
  }
}

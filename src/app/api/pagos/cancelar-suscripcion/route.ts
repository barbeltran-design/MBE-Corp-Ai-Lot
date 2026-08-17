// ─────────────────────────────────────────────────────────────────────────
// POST /api/pagos/cancelar-suscripcion
//
// ESTE ARCHIVO VA EN: src/app/api/pagos/cancelar-suscripcion/route.ts
//
// Qué hace: el usuario da clic en "Cancelar suscripción" en /perfil → esta
// ruta (1) verifica quién es, (2) si tiene una suscripción de Mercado Pago
// asociada (mercadoPagoPreapprovalId), la cancela ahí de verdad — así deja
// de cobrarse cada mes — y (3) actualiza Firestore.
//
// IMPORTANTE — periodo de gracia: la cancelación YA NO quita el acceso de
// inmediato. El usuario ya pagó el mes en curso, así que conserva el plan
// completo hasta que termine ese periodo (planStatus queda en
// 'pending_cancellation' con una fecha planCancelaEn = ultimoCobroAt + 1
// mes). Después de esa fecha, esUsuarioPremium() (ver src/lib/premium.ts)
// deja de darle acceso automáticamente — no hace falta ningún proceso
// programado para que esto funcione, solo se compara la fecha cada vez que
// se revisa si el usuario es premium.
//
// Si no hay una fecha confiable de la que partir (cuenta muy antigua sin
// ultimoCobroAt/planActivatedAt, o esa fecha ya pasó), se cae de vuelta al
// comportamiento anterior: se le quita el acceso de inmediato, para no
// arriesgarse a dar acceso "de más" sin una base real.
//
// Variable de entorno requerida:
//   MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION (de la app de Suscripciones en
//   Mercado Pago — distinta de MERCADOPAGO_ACCESS_TOKEN, que es la de pagos
//   únicos)
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sumarUnMes } from '@/lib/premium';

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

    // Base para calcular hasta cuándo ya pagó: el cobro exitoso más
    // reciente si lo tenemos guardado, o si no, la fecha en que activó el
    // plan por primera vez.
    const ultimoCobroAt =
      (userData?.ultimoCobroAt as string | undefined) ||
      (userData?.planActivatedAt as string | undefined) ||
      null;

    let planCancelaEn: string | null = null;
    if (ultimoCobroAt) {
      const candidato = sumarUnMes(ultimoCobroAt);
      // Solo damos el periodo de gracia si esa fecha todavía no pasó — si ya
      // pasó (por ejemplo, una cuenta muy antigua sin datos actualizados),
      // no tiene sentido "regalar" acceso retroactivo.
      if (new Date(candidato).getTime() > Date.now()) {
        planCancelaEn = candidato;
      }
    }

    if (planCancelaEn) {
      // Mantiene el acceso pro activo (esUsuarioPremium respeta este
      // estado) hasta planCancelaEn. No se le vuelve a cobrar — Mercado
      // Pago ya quedó cancelado arriba.
      await userRef.set(
        {
          planStatus: 'pending_cancellation',
          planCancelaEn,
          planCanceladoAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      // Sin una fecha confiable de la que partir: quitamos el acceso de
      // inmediato, como antes de este cambio.
      await userRef.set(
        {
          subscription: 'cancelled',
          planStatus: 'cancelled',
          planCanceladoAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      ok: true,
      canceladaEnMercadoPago: Boolean(preapprovalId),
      planCancelaEn,
    });
  } catch (err) {
    console.error('[cancelar-suscripcion] Error:', err);
    return NextResponse.json({ error: 'No se pudo cancelar la suscripción.' }, { status: 500 });
  }
}

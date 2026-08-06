// ─────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/mercadopago
//
// ESTE ARCHIVO VA EN: src/app/api/webhooks/mercadopago/route.ts
// (o app/api/webhooks/mercadopago/route.ts si tu proyecto no usa carpeta "src").
//
// Qué hace: Mercado Pago llama a esta URL cada vez que el estado de un pago
// cambia. Este código: (1) confirma que la notificación de verdad viene de
// Mercado Pago y no es un engaño, (2) pide el pago real a Mercado Pago (nunca
// confía en el contenido de la notificación por sí solo), y (3) si el pago
// está aprobado, activa el plan del usuario correspondiente en Firestore.
//
// Configura esta URL en Mercado Pago: "Tus integraciones" → tu app →
// Webhooks → Configurar notificaciones → evento "Pagos" →
//   https://TU-DOMINIO.vercel.app/api/webhooks/mercadopago
//
// Variables de entorno requeridas:
//   MERCADOPAGO_ACCESS_TOKEN    (para pedir el pago real)
//   MERCADOPAGO_WEBHOOK_SECRET  (para verificar que la notificación es legítima
//                                 — se genera al guardar la URL de arriba en
//                                 Mercado Pago, dentro de "Tus integraciones")
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import {
  MercadoPagoConfig,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  const dataId = req.nextUrl.searchParams.get('data.id');
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[webhook mercadopago] Falta MERCADOPAGO_WEBHOOK_SECRET.');
    // Respondemos 200 igual para que Mercado Pago no reintente sin parar,
    // pero el error queda registrado en los logs de Vercel (Runtime Logs).
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!dataId || !xSignature || !xRequestId) {
    return NextResponse.json({ error: 'Notificación incompleta.' }, { status: 400 });
  }

  try {
    // Paso 1: confirmar que esta notificación de verdad viene de Mercado Pago
    // (y no de alguien que descubrió la URL e inventó una notificación falsa).
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.error('[webhook mercadopago] Firma inválida — posible notificación falsa.');
      return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
    }
    throw err;
  }

  try {
    // Paso 2: la notificación solo avisa "algo cambió" — nunca confiamos en
    // su contenido. Pedimos el pago real directamente a Mercado Pago.
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN.');

    const client = new MercadoPagoConfig({ accessToken });
    const payment = await new Payment(client).get({ id: dataId });

    const uid = payment.external_reference;
    if (!uid) {
      console.error('[webhook mercadopago] Pago sin external_reference (uid).', dataId);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const db = getAdminDb();

    // Registrar el pago recibido en la colección `pagos` (visible en /admin),
    // pase lo que pase con el estado — así el administrador ve el histórico
    // completo (aprobados, pendientes, rechazados).
    const metadata = payment.metadata as Record<string, unknown> | null | undefined;
    const productIdRaw = metadata?.productId;
    const productId =
      typeof productIdRaw === 'string' && productIdRaw ? productIdRaw : 'plan_mensual';
    const numId = Number(payment.id);
    const pagoId = `${numId}`;

    try {
      await db.collection('pagos').doc(pagoId).set(
        {
          uid,
          productoId: productId,
          monto: payment.transaction_amount ?? payment.transaction_details?.total_paid_amount ?? null,
          moneda: payment.currency_id ?? 'MXN',
          status: payment.status,
          statusDetail: payment.status_detail ?? '',
          mercadoPagoPaymentId: String(payment.id),
          fechaPago: payment.date_approved ?? null,
          externalReference: uid,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('[webhook mercadopago] No se pudo registrar el pago en Firestore:', err);
    }

    if (payment.status === 'approved') {
      if (productId === 'plan_mensual') {
        await db.collection('users').doc(uid).set(
          {
            subscription: 'pro',
            planStatus: 'active',
            mercadoPagoPaymentId: String(payment.id),
            planActivatedAt: new Date().toISOString(),
          },
          { merge: true } // merge: true = solo agrega/actualiza estos campos, no borra los demás
        );
      }
      // Otros productos (apoyo_ondemand, certificacion_mbe, paquete_especialista):
      // se registran en `pagos` pero no activan el plan completo — pueden activar
      // flags específicos si se requiere más adelante.
      console.log(`[webhook mercadopago] Pago aprobado ${dataId} producto ${productId}`);
    } else {
      // pending, rejected, in_process, etc. — se registra pero no se activa el plan.
      console.log(`[webhook mercadopago] Pago ${dataId} con estado: ${payment.status}`);
    }

    // Responder rápido con 200 (Mercado Pago espera respuesta en 22 segundos).
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[webhook mercadopago] Error procesando el pago:', err);
    // 500 hace que Mercado Pago reintente más tarde — correcto si fue un
    // error temporal nuestro (ej. Firestore caído un instante).
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

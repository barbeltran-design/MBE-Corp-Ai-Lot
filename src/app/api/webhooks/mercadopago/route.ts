// ─────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/mercadopago
//
// ESTE ARCHIVO VA EN: src/app/api/webhooks/mercadopago/route.ts
//
// Qué hace: Mercado Pago llama a esta URL cada vez que pasa algo relevante.
// Ahora maneja TRES tipos de notificación (antes solo manejaba una):
//
//   1) type=payment                     → pago único (certificación, etc.)
//   2) type=subscription_preapproval    → cambio de estado en una suscripción
//                                          (autorizada, pausada, cancelada)
//   3) type=subscription_authorized_payment → un cobro mensual automático
//                                          de una suscripción ya activa
//
// En todos los casos: (1) confirma que la notificación de verdad viene de
// Mercado Pago y no es un engaño, (2) pide el recurso real a Mercado Pago
// (nunca confía en el contenido de la notificación por sí solo), y
// (3) actualiza Firestore según corresponda.
//
// Los pagos únicos y las suscripciones viven en DOS aplicaciones distintas
// de Mercado Pago (cada una con su propio Access Token y su propio Webhook
// Secret) — este archivo elige cuál usar según el tipo de evento, ANTES de
// validar la firma y de pedir el recurso real.
//
// Configura esta misma URL en AMBAS aplicaciones de Mercado Pago
// ("Tus integraciones" → elige la app → Webhooks → Configurar notificaciones):
//   https://TU-DOMINIO.vercel.app/api/webhooks/mercadopago
//   - App de pagos únicos (CheckoutPro, la que ya usas): evento "Pagos".
//   - App de Suscripciones: eventos "Pagos" Y "Suscripciones".
//
// Variables de entorno requeridas:
//   MERCADOPAGO_ACCESS_TOKEN                (app de pagos únicos — la que ya tienes)
//   MERCADOPAGO_WEBHOOK_SECRET               (secreto de esa misma app)
//   MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION     (app de Suscripciones — nueva)
//   MERCADOPAGO_WEBHOOK_SECRET_SUSCRIPCION   (secreto de la app de Suscripciones)
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import {
  MercadoPagoConfig,
  Payment,
  PreApproval,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { sumarUnMes } from '@/lib/premium';

export async function POST(req: NextRequest) {
  const dataId = req.nextUrl.searchParams.get('data.id');
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  // Mercado Pago manda el tipo de evento en "type" (formato nuevo) o "topic"
  // (formato viejo, todavía se ve en algunas notificaciones). Si no viene
  // ninguno, asumimos "payment" para no romper el comportamiento anterior.
  const type =
    req.nextUrl.searchParams.get('type') || req.nextUrl.searchParams.get('topic') || 'payment';
  const esEventoDeSuscripcion =
    type === 'subscription_preapproval' || type === 'subscription_authorized_payment';

  // Cada tipo de evento viene de una aplicación distinta de Mercado Pago —
  // usamos el secreto de la app correspondiente para validar la firma.
  const secret = esEventoDeSuscripcion
    ? process.env.MERCADOPAGO_WEBHOOK_SECRET_SUSCRIPCION
    : process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error(
      esEventoDeSuscripcion
        ? '[webhook mercadopago] Falta MERCADOPAGO_WEBHOOK_SECRET_SUSCRIPCION.'
        : '[webhook mercadopago] Falta MERCADOPAGO_WEBHOOK_SECRET.'
    );
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

  const accessToken = esEventoDeSuscripcion
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION
    : process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(
      esEventoDeSuscripcion
        ? '[webhook mercadopago] Falta MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION.'
        : '[webhook mercadopago] Falta MERCADOPAGO_ACCESS_TOKEN.'
    );
    return NextResponse.json({ received: true }, { status: 200 });
  }
  const client = new MercadoPagoConfig({ accessToken });
  const db = getAdminDb();

  // ───────────────────────────────────────────────────────────────────────
  // Rama 1: cambios de estado de una SUSCRIPCIÓN (PreApproval).
  // Se dispara cuando el usuario autoriza, pausa, o cancela su suscripción
  // (ya sea desde el checkout de Mercado Pago, o desde su propia cuenta de
  // Mercado Pago — no solo desde nuestro botón "Cancelar suscripción").
  // ───────────────────────────────────────────────────────────────────────
  if (type === 'subscription_preapproval') {
    try {
      const preapproval = await new PreApproval(client).get({ id: dataId });
      const uid = preapproval.external_reference;
      if (!uid) {
        console.error('[webhook mercadopago] Preapproval sin external_reference (uid).', dataId);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      if (preapproval.status === 'authorized') {
        const ahora = new Date().toISOString();
        await db.collection('users').doc(uid).set(
          {
            subscription: 'pro',
            planStatus: 'active',
            mercadoPagoPreapprovalId: dataId,
            planActivatedAt: ahora,
            // Ancla para calcular el periodo de gracia si más adelante se
            // cancela (ver planCancelaEn en src/types/firestore.ts).
            ultimoCobroAt: ahora,
          },
          { merge: true }
        );
      } else if (preapproval.status === 'cancelled') {
        // Esta rama también se dispara cuando el usuario cancela DIRECTO
        // desde su propia cuenta de Mercado Pago (no solo desde nuestro
        // botón "Cancelar suscripción", que ya escribe este mismo estado
        // en /api/pagos/cancelar-suscripcion). Le damos el mismo periodo de
        // gracia aquí: conserva el acceso hasta que termine el mes ya
        // pagado, calculado desde el último cobro que tenemos guardado.
        const uSnap = await db.collection('users').doc(uid).get();
        const uData = uSnap.exists ? uSnap.data() : null;
        const yaEnGracia =
          uData?.planStatus === 'pending_cancellation' &&
          typeof uData?.planCancelaEn === 'string' &&
          new Date(uData.planCancelaEn as string).getTime() > Date.now();

        if (yaEnGracia) {
          // Nuestro propio botón de cancelar ya dejó todo bien configurado
          // hace un momento — no lo pisamos, solo confirmamos el estado.
          console.log(`[webhook mercadopago] Preapproval ${dataId} ya estaba en periodo de gracia para ${uid}.`);
        } else {
          const ultimoCobroAt =
            (uData?.ultimoCobroAt as string | undefined) ||
            (uData?.planActivatedAt as string | undefined) ||
            null;
          const candidato = ultimoCobroAt ? sumarUnMes(ultimoCobroAt) : null;
          const planCancelaEn =
            candidato && new Date(candidato).getTime() > Date.now() ? candidato : null;

          if (planCancelaEn) {
            await db.collection('users').doc(uid).set(
              {
                planStatus: 'pending_cancellation',
                planCancelaEn,
                planCanceladoAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } else {
            await db.collection('users').doc(uid).set(
              {
                subscription: 'cancelled',
                planStatus: 'cancelled',
                planCanceladoAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      } else if (preapproval.status === 'paused') {
        // Pausada (ej. por falta de fondos varias veces seguidas) — le
        // quitamos el acceso pro sin borrar el id de la suscripción, por
        // si Mercado Pago la reactiva sola más adelante.
        await db.collection('users').doc(uid).set(
          { planStatus: 'paused' },
          { merge: true }
        );
      } else {
        // pending u otro estado transitorio — solo lo registramos.
        await db.collection('users').doc(uid).set(
          { planStatus: preapproval.status ?? 'pending', mercadoPagoPreapprovalId: dataId },
          { merge: true }
        );
      }

      console.log(`[webhook mercadopago] Preapproval ${dataId} usuario ${uid} estado: ${preapproval.status}`);
      return NextResponse.json({ received: true }, { status: 200 });
    } catch (err) {
      console.error('[webhook mercadopago] Error procesando preapproval:', err);
      return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Rama 2: un COBRO MENSUAL AUTOMÁTICO de una suscripción ya activa. Cada
  // cobro recurrente es, en sí mismo, un recurso de Pago normal — se
  // registra en `pagos` igual que un pago único, para que quede visible en
  // /admin, pero normalmente NO hace falta reactivar nada en el usuario
  // (ya está activo desde que se autorizó la suscripción).
  // ───────────────────────────────────────────────────────────────────────
  if (type === 'subscription_authorized_payment') {
    try {
      const payment = await new Payment(client).get({ id: dataId });
      const uid = payment.external_reference;
      if (uid) {
        await db.collection('pagos').doc(`${payment.id}`).set(
          {
            uid,
            productoId: 'plan_mensual',
            monto: payment.transaction_amount ?? null,
            moneda: payment.currency_id ?? 'MXN',
            status: payment.status,
            statusDetail: payment.status_detail ?? '',
            mercadoPagoPaymentId: String(payment.id),
            fechaPago: payment.date_approved ?? null,
            externalReference: uid,
            esCobroRecurrente: true,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
        if (payment.status === 'approved') {
          // Refuerza el estado activo por si el webhook de preapproval no
          // llegó a procesarse por alguna razón, y actualiza ultimoCobroAt
          // — la ancla que usamos para calcular el periodo de gracia si el
          // usuario cancela más adelante.
          await db.collection('users').doc(uid).set(
            {
              subscription: 'pro',
              planStatus: 'active',
              ultimoCobroAt: payment.date_approved || new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } else {
        console.error('[webhook mercadopago] Cobro recurrente sin external_reference (uid).', dataId);
      }
      console.log(`[webhook mercadopago] Cobro recurrente ${dataId} estado: ${payment.status}`);
      return NextResponse.json({ received: true }, { status: 200 });
    } catch (err) {
      console.error('[webhook mercadopago] Error procesando cobro recurrente:', err);
      return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Rama 3 (comportamiento original, sin cambios): PAGO ÚNICO — el flujo que
  // ya existía para certificacion_mbe y demás productos de pago único.
  // ───────────────────────────────────────────────────────────────────────
  try {
    // Paso 2: la notificación solo avisa "algo cambió" — nunca confiamos en
    // su contenido. Pedimos el pago real directamente a Mercado Pago.
    const payment = await new Payment(client).get({ id: dataId });

    const uid = payment.external_reference;
    if (!uid) {
      console.error('[webhook mercadopago] Pago sin external_reference (uid).', dataId);
      return NextResponse.json({ received: true }, { status: 200 });
    }

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
      } else if (productId === 'certificacion_mbe') {
        // Marca al usuario como certificado en la comunidad del Reference Place.
        await db.collection('users').doc(uid).set(
          {
            certificado: true,
            certificadoDesde: new Date().toISOString(),
            mercadoPagoPaymentId: String(payment.id),
          },
          { merge: true }
        );
      }
      // Otros productos (apoyo_ondemand, paquete_especialista):
      // se registran en `pagos` pero no activan el plan completo ni flags.
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

<#
 ============================================================================
  actualizar-credenciales-mercadopago.ps1
 ============================================================================

  QUE HACE ESTE SCRIPT
  --------------------
  Separa las credenciales de Mercado Pago en DOS aplicaciones distintas:

    1) Pagos unicos (certificacion_mbe, etc.) -> app "MBE-Corpilot-AI"
       (CheckoutPro) -> sigue usando las variables que YA tienes en Vercel
       sin ningun cambio: MERCADOPAGO_ACCESS_TOKEN y MERCADOPAGO_WEBHOOK_SECRET.

    2) Suscripcion mensual (plan_mensual) -> app "MBE Corp-AI-Lot plan"
       (Suscripciones) -> usara DOS variables NUEVAS que tendras que crear
       en Vercel: MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION y
       MERCADOPAGO_WEBHOOK_SECRET_SUSCRIPCION.

  Este script funciona sin importar si ya corriste antes el script anterior
  (actualizar-suscripcion-mercadopago.ps1) o no. Detecta el estado actual de
  cada archivo y aplica lo que falte. Si algo ya esta aplicado, lo dice y no
  lo toca de nuevo.

  COMO EJECUTARLO
  ----------------
  1. Abre PowerShell.
  2. Ve a la carpeta raiz de tu proyecto (donde esta la carpeta "src"):
       cd "C:\ruta\a\tu\proyecto\MBE-Corpilot-AI"
  3. Ejecuta:
       powershell -ExecutionPolicy Bypass -File .\actualizar-credenciales-mercadopago.ps1
  4. Lee el resumen final — te dira exactamente que hacer en Mercado Pago
     y en Vercel para que todo funcione (son 4 pasos manuales, no se pueden
     automatizar porque requieren tu sesion en esos sitios).

 ============================================================================
#>

$ErrorActionPreference = 'Stop'

function Write-Section($t) {
  Write-Host ""
  Write-Host "=== $t ===" -ForegroundColor Magenta
}

function Set-FileFull {
  param(
    [string]$Path,
    [string]$Content,
    [string]$AlreadyAppliedMarker,
    [string]$Label
  )
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  if (Test-Path -LiteralPath $Path) {
    $current = Get-Content -LiteralPath $Path -Raw
    if ($current.Contains($AlreadyAppliedMarker)) {
      Write-Host "[OK - ya aplicado antes] $Label" -ForegroundColor Cyan
      return
    }
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
  Write-Host "[OK] $Label actualizado." -ForegroundColor Green
}

function Test-FileContains {
  param([string]$Path, [string]$Needle, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "[FALTA] $Label -> no existe el archivo: $Path" -ForegroundColor Red
    return
  }
  $content = Get-Content -LiteralPath $Path -Raw
  if ($content.Contains($Needle)) {
    Write-Host "[OK] $Label" -ForegroundColor Green
  } else {
    Write-Host "[FALTA] $Label" -ForegroundColor Red
  }
}

Write-Section "Verificando ubicacion"
if (-not (Test-Path -LiteralPath "src\app\[locale]\perfil\page.tsx")) {
  throw "No se encontro src\app\[locale]\perfil\page.tsx. Ejecuta este script desde la RAIZ del proyecto (la carpeta que contiene 'src')."
}
Write-Host "[OK] Carpeta correcta." -ForegroundColor Green

Write-Section "Aplicando cambios"

$webhookContent = @'
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
        await db.collection('users').doc(uid).set(
          {
            subscription: 'pro',
            planStatus: 'active',
            mercadoPagoPreapprovalId: dataId,
            planActivatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else if (preapproval.status === 'cancelled') {
        await db.collection('users').doc(uid).set(
          {
            subscription: 'cancelled',
            planStatus: 'cancelled',
            planCanceladoAt: new Date().toISOString(),
          },
          { merge: true }
        );
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
          // llegó a procesarse por alguna razón.
          await db.collection('users').doc(uid).set(
            { subscription: 'pro', planStatus: 'active' },
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

'@
Set-FileFull -Path "src\app\api\webhooks\mercadopago\route.ts" -Content $webhookContent -AlreadyAppliedMarker "MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION" -Label "Webhook (src/app/api/webhooks/mercadopago/route.ts)"

$crearSuscripcionContent = @'
// ─────────────────────────────────────────────────────────────────────────
// POST /api/pagos/crear-suscripcion
//
// ESTE ARCHIVO VA EN: src/app/api/pagos/crear-suscripcion/route.ts
//
// Qué hace: a diferencia de /api/pagos/crear-preferencia (que crea un cobro
// ÚNICO), esta ruta crea una SUSCRIPCIÓN real en Mercado Pago (recurso
// "PreApproval") para el plan mensual. Mercado Pago cobrará automáticamente
// cada mes hasta que la suscripción se cancele (ver
// /api/pagos/cancelar-suscripcion) o el usuario la cancele desde su propia
// cuenta de Mercado Pago.
//
// El usuario da clic en "Pagar plan completo" → esta ruta crea la
// suscripción en estado "pending" y regresa la URL de autorización
// (init_point) → el navegador redirige ahí → el usuario ingresa su tarjeta
// y autoriza → Mercado Pago manda un webhook (type=subscription_preapproval)
// que activa el plan (ver /api/webhooks/mercadopago).
//
// Variable de entorno requerida:
//   MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION (de la app de Suscripciones en
//   Mercado Pago — distinta de MERCADOPAGO_ACCESS_TOKEN, que es la de pagos
//   únicos)
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { locales } from '@/i18n/routing';
import { defaultCatalogItem } from '@/lib/catalog';
import { seedCatalogIfNeeded } from '@/lib/catalog-seed';

const PRODUCT_ID = 'plan_mensual';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    // Verificar el token aquí (en el servidor) es lo que impide que alguien
    // pueda fingir ser otro usuario — el uid y el email de abajo quedan
    // garantizados.
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const payerEmail = decoded.email;
    if (!payerEmail) {
      return NextResponse.json(
        { error: 'Tu cuenta no tiene un correo verificado. No se puede crear la suscripción.' },
        { status: 400 }
      );
    }

    // El botón manda el idioma actual y a dónde regresar (mismo patrón que
    // crear-preferencia). Si no viene o viene inválido, usamos respaldos
    // seguros para no armar una URL de regreso rota.
    let requestedLocale: string | undefined;
    let returnPath = '/perfil';
    try {
      const body = await req.json();
      requestedLocale = body?.locale;
      if (typeof body?.returnPath === 'string' && ['/perfil', '/dashboard', '/babel/madurez', '/worlds'].includes(body.returnPath)) {
        returnPath = body.returnPath;
      }
    } catch {
      // Sin body o body inválido — seguimos con el respaldo.
    }
    const locale = locales.includes(requestedLocale as (typeof locales)[number])
      ? requestedLocale!
      : 'es';

    // Precio y título se leen del catálogo de Firestore (admin), igual que
    // en crear-preferencia — así una promoción activa aplica también aquí.
    const db = getAdminDb();
    await seedCatalogIfNeeded();
    const catalogSnap = await db.collection('catalog').doc(PRODUCT_ID).get();
    const catalogData = catalogSnap.exists ? catalogSnap.data() : null;
    const def = defaultCatalogItem(PRODUCT_ID);
    const precio =
      typeof catalogData?.promocion === 'number' && catalogData?.promocionActiva === true
        ? catalogData.promocion
        : typeof catalogData?.precio === 'number'
          ? catalogData.precio
          : def?.precio ?? 99;
    const titulo =
      locale === 'en'
        ? (typeof catalogData?.tituloEn === 'string' ? catalogData.tituloEn : def?.tituloEn ?? '')
        : (typeof catalogData?.titulo === 'string' ? catalogData.titulo : def?.titulo ?? '');
    const titleFinal = titulo || def?.titulo || 'MBE Corpilot AI — Plan completo';

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION;
    if (!accessToken) {
      throw new Error('[crear-suscripcion] Falta MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION.');
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preapproval = new PreApproval(client);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mbe-ai-copilot.vercel.app';

    // Sin preapproval_plan_id ni card_token_id: Mercado Pago crea la
    // suscripción como "pending" y regresa init_point — el usuario ingresa
    // su tarjeta directamente en el checkout de Mercado Pago (igual que en
    // el pago único, no hay que construir un formulario de tarjeta propio).
    const result = await preapproval.create({
      body: {
        reason: titleFinal,
        external_reference: uid,
        payer_email: payerEmail,
        back_url: `${siteUrl}/${locale}${returnPath}?suscripcion=procesando`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: precio,
          currency_id: 'MXN',
        },
      },
    });

    if (!result.init_point || !result.id) {
      console.error('[crear-suscripcion] Respuesta de Mercado Pago sin init_point/id:', result);
      return NextResponse.json({ error: 'No se pudo iniciar la suscripción.' }, { status: 500 });
    }

    // Guardamos el id de la suscripción de inmediato en estado "pending" —
    // así, si el usuario abandona el checkout, el sistema no le da acceso
    // pro (esUsuarioPremium exige planStatus === 'active'), y si sí autoriza,
    // el webhook ya sabe qué id activar. Esto también asegura que el botón
    // de cancelar siempre tenga un id de Mercado Pago disponible.
    await db.collection('users').doc(uid).set(
      {
        mercadoPagoPreapprovalId: result.id,
        planStatus: 'pending',
      },
      { merge: true }
    );

    return NextResponse.json({ checkoutUrl: result.init_point });
  } catch (err) {
    console.error('[crear-suscripcion] Error:', err);
    return NextResponse.json({ error: 'No se pudo iniciar la suscripción.' }, { status: 500 });
  }
}

'@
Set-FileFull -Path "src\app\api\pagos\crear-suscripcion\route.ts" -Content $crearSuscripcionContent -AlreadyAppliedMarker "MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION" -Label "Crear suscripcion (src/app/api/pagos/crear-suscripcion/route.ts)"

$cancelarSuscripcionContent = @'
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

'@
Set-FileFull -Path "src\app\api\pagos\cancelar-suscripcion\route.ts" -Content $cancelarSuscripcionContent -AlreadyAppliedMarker "MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION" -Label "Cancelar suscripcion (src/app/api/pagos/cancelar-suscripcion/route.ts)"

Write-Section "Verificacion"
Test-FileContains -Path "src\app\api\webhooks\mercadopago\route.ts" -Needle "MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION" -Label "Webhook usa token separado para suscripciones"
Test-FileContains -Path "src\app\api\webhooks\mercadopago\route.ts" -Needle "MERCADOPAGO_WEBHOOK_SECRET_SUSCRIPCION" -Label "Webhook usa secreto separado para suscripciones"
Test-FileContains -Path "src\app\api\pagos\crear-suscripcion\route.ts" -Needle "MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION" -Label "crear-suscripcion usa token de la app Suscripciones"
Test-FileContains -Path "src\app\api\pagos\cancelar-suscripcion\route.ts" -Needle "MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION" -Label "cancelar-suscripcion usa token de la app Suscripciones"

Write-Section "SIGUE ESTOS 4 PASOS MANUALES (no se pueden automatizar)"
Write-Host ""
Write-Host "1) ACTIVAR credenciales de produccion en la app 'MBE Corp-AI-Lot plan':" -ForegroundColor Yellow
Write-Host "   - Entra a Mercado Pago -> Tus integraciones -> elige 'MBE Corp-AI-Lot plan'."
Write-Host "   - Ve a 'Credenciales de produccion'. Si te pide Industria y Sitio web,"
Write-Host "     completalos (sitio web: https://mbe-ai-copilot.vercel.app) y acepta"
Write-Host "     terminos para activarlas."
Write-Host "   - Copia el 'Access Token' que aparece ahi (NO el de prueba)."
Write-Host ""
Write-Host "2) CONFIGURAR el webhook en esa misma app:" -ForegroundColor Yellow
Write-Host "   - Dentro de 'MBE Corp-AI-Lot plan' -> Webhooks -> Configurar notificaciones."
Write-Host "   - URL: https://mbe-ai-copilot.vercel.app/api/webhooks/mercadopago"
Write-Host "   - Eventos a marcar: 'Pagos' Y 'Suscripciones' (ambos)."
Write-Host "   - Guarda. Mercado Pago te mostrara un 'Secreto' (Webhook Secret) -- copialo."
Write-Host ""
Write-Host "3) AGREGAR 2 variables nuevas en Vercel:" -ForegroundColor Yellow
Write-Host "   - Ve a vercel.com -> tu proyecto -> Settings -> Environment Variables."
Write-Host "   - Agrega:"
Write-Host "       MERCADOPAGO_ACCESS_TOKEN_SUSCRIPCION   = el Access Token del paso 1"
Write-Host "       MERCADOPAGO_WEBHOOK_SECRET_SUSCRIPCION = el Secreto del paso 2"
Write-Host "   - NO toques MERCADOPAGO_ACCESS_TOKEN ni MERCADOPAGO_WEBHOOK_SECRET"
Write-Host "     existentes -- esos siguen igual para pagos unicos."
Write-Host "   - Marca 'Production' (y 'Preview' si pruebas ahi tambien)."
Write-Host ""
Write-Host "4) Hacer commit, push, y luego re-deploy en Vercel:" -ForegroundColor Yellow
Write-Host "   git add ."
Write-Host "   git commit -m 'Separar credenciales de Mercado Pago: pagos unicos vs suscripciones'"
Write-Host "   git push"
Write-Host "   (Vercel hace redeploy solo al detectar el push; si agregaste las"
Write-Host "    variables de entorno DESPUES del ultimo deploy, hazle 'Redeploy' manual"
Write-Host "    una vez desde el dashboard de Vercel para que las tome.)"
Write-Host ""
Write-Host "Cuando termines los 4 pasos, prueba pagando el plan mensual con una"
Write-Host "tarjeta de prueba de Mercado Pago y confirma en Firestore que el usuario"
Write-Host "quedo con planStatus: 'active'. Luego prueba 'Cancelar suscripcion' en"
Write-Host "/perfil y confirma que quedo con planStatus: 'cancelled'."
Write-Host ""

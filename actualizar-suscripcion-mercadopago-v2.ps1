<# 
========================================================================
 actualizar-suscripcion-mercadopago.ps1

 QUE HACE ESTE SCRIPT (leelo antes de correrlo):

 Migra el pago del "plan mensual" de un cobro UNICO en Mercado Pago a una
 SUSCRIPCION REAL con cobro automatico cada mes, y agrega un boton para
 cancelarla desde /perfil -> "Tu plan".

 Archivos que crea (nuevos):
   - src/app/api/pagos/crear-suscripcion/route.ts
   - src/app/api/pagos/cancelar-suscripcion/route.ts

 Archivos que modifica (existentes):
   - src/types/firestore.ts
   - src/app/api/webhooks/mercadopago/route.ts
   - src/app/[locale]/perfil/page.tsx
   - src/components/babel/MaturityPlanBuilder.tsx
   - src/components/worlds/WorldsBuilder.tsx

 COMO CORRERLO:
   1) Abre PowerShell.
   2) Ve a la carpeta raiz de tu repo (donde esta la carpeta "src"), ej:
        cd C:\Users\barbe\Desktop\MBE-Corpilot-AI
   3) Ejecuta:
        powershell -ExecutionPolicy Bypass -File .\actualizar-suscripcion-mercadopago.ps1
   4) Lee el resumen final (checklist verde/amarillo) que imprime el script.
   5) Revisa los cambios con "git diff", y si todo se ve bien:
        git add -A
        git commit -m "Migrar plan mensual a suscripcion real de Mercado Pago + boton cancelar"
        git push

 IMPORTANTE ANTES DE CONFIAR EN ESTO EN PRODUCCION:
   - En Mercado Pago ("Tus integraciones" -> tu app -> Webhooks) activa TAMBIEN
     el evento "Suscripciones" (no solo "Pagos") para la misma URL de webhook.
   - Prueba el flujo completo con una tarjeta de prueba de Mercado Pago en su
     entorno de pruebas (sandbox) antes de que un cliente real pague:
       1. Entra a /perfil con un usuario en plan gratuito.
       2. Da clic en "Pagar plan completo" y completa el checkout con una tarjeta
          de prueba.
       3. Confirma que el usuario queda con acceso Pro.
       4. Da clic en "Cancelar suscripcion", confirma el aviso.
       5. Confirma que el usuario pierde el acceso Pro de inmediato, y que en tu
          panel de Mercado Pago la suscripcion aparece como "Cancelada".
   - La cancelacion es INMEDIATA (no espera a que termine el mes ya pagado). Si
     prefieres que el usuario conserve el acceso hasta el fin del periodo pagado,
     dimelo y lo ajustamos.
========================================================================
#>

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------------
# Funciones de ayuda
# ------------------------------------------------------------------------

function Replace-Exactly {
    param(
        [string]$Path,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    if ([string]::IsNullOrEmpty($Path) -or [string]::IsNullOrEmpty($Old) -or [string]::IsNullOrEmpty($New) -or [string]::IsNullOrEmpty($Label)) {
        throw "Replace-Exactly: faltan argumentos (Path/Old/New/Label). Esto indica un problema en el script mismo, no en tu proyecto."
    }
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No se encontro el archivo: $Path . Ejecuta este script desde la raiz del repo."
    }
    $content = [System.IO.File]::ReadAllText($Path)
    $count = ([regex]::Matches($content, [regex]::Escape($Old))).Count
    if ($count -eq 0) {
        if ($content.Contains($New)) {
            Write-Host "  [OK - ya aplicado antes] $Label" -ForegroundColor Cyan
        } else {
            Write-Warning "  [OMITIDO] [$Label] No se encontro el texto esperado en $Path. Puede que el archivo haya cambiado. Revisa manualmente."
        }
        return
    }
    if ($count -gt 1) {
        throw "[$Label] El texto a reemplazar aparece $count veces en $Path -- se esperaba 1. Revisa manualmente antes de continuar."
    }
    $newContent = $content.Replace($Old, $New)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $newContent, $utf8NoBom)
    Write-Host "  [OK] $Label" -ForegroundColor Green
}

function New-FileWithContent {
    param(
        [string]$Path,
        [string]$Content,
        [string]$MarkerText,
        [string]$Label
    )
    if ([string]::IsNullOrEmpty($Path) -or [string]::IsNullOrEmpty($Content) -or [string]::IsNullOrEmpty($MarkerText) -or [string]::IsNullOrEmpty($Label)) {
        throw "New-FileWithContent: faltan argumentos (Path/Content/MarkerText/Label). Esto indica un problema en el script mismo, no en tu proyecto."
    }
    if (Test-Path -LiteralPath $Path) {
        $current = [System.IO.File]::ReadAllText($Path)
        if ($current.Contains($MarkerText)) {
            Write-Host "  [OK - ya existia con el contenido esperado] $Label" -ForegroundColor Cyan
        } else {
            Write-Warning "  [OMITIDO] [$Label] Ya existe un archivo en $Path pero con otro contenido. No se sobreescribe para no perder tu trabajo. Revisa manualmente: $Path"
        }
        return
    }
    $dir = Split-Path -LiteralPath $Path -Parent
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
    Write-Host "  [OK - creado] $Label" -ForegroundColor Green
}

$results = @()

# ------------------------------------------------------------------------
# Verificacion inicial: ¿estamos en la raiz del repo?
# ------------------------------------------------------------------------

if (-not (Test-Path -LiteralPath "src\app\[locale]\perfil\page.tsx")) {
    throw "No se encontro src\app\[locale]\perfil\page.tsx . Ejecuta este script desde la raiz del repo (la carpeta que contiene la carpeta 'src')."
}
Write-Host "Raiz del repo detectada correctamente." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------
# Contenido de los cambios
# ------------------------------------------------------------------------
$firestoreOld = @'
  mercadoPagoPaymentId?: string;
'@

$firestoreNew = @'
  mercadoPagoPaymentId?: string;
  // id de la suscripcion (PreApproval) activa en Mercado Pago; se usa
  // para poder cancelarla desde /perfil (ver /api/pagos/cancelar-suscripcion).
  mercadoPagoPreapprovalId?: string;
  planCanceladoAt?: string;
'@

$webhookOld = @'
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

$webhookNew = @'
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
// Configura esta URL en Mercado Pago: "Tus integraciones" → tu app →
// Webhooks → Configurar notificaciones → eventos "Pagos" Y "Suscripciones" →
//   https://TU-DOMINIO.vercel.app/api/webhooks/mercadopago
//
// Variables de entorno requeridas:
//   MERCADOPAGO_ACCESS_TOKEN    (para pedir el recurso real)
//   MERCADOPAGO_WEBHOOK_SECRET  (para verificar que la notificación es legítima
//                                 — se genera al guardar la URL de arriba en
//                                 Mercado Pago, dentro de "Tus integraciones")
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
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  // Mercado Pago manda el tipo de evento en "type" (formato nuevo) o "topic"
  // (formato viejo, todavía se ve en algunas notificaciones). Si no viene
  // ninguno, asumimos "payment" para no romper el comportamiento anterior.
  const type =
    req.nextUrl.searchParams.get('type') || req.nextUrl.searchParams.get('topic') || 'payment';

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

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[webhook mercadopago] Falta MERCADOPAGO_ACCESS_TOKEN.');
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
//   MERCADOPAGO_ACCESS_TOKEN
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

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('[crear-suscripcion] Falta MERCADOPAGO_ACCESS_TOKEN.');
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
//   MERCADOPAGO_ACCESS_TOKEN
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
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('[cancelar-suscripcion] Falta MERCADOPAGO_ACCESS_TOKEN.');
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

$perfilOldA = @'
      const res = await fetch('/api/pagos/crear-preferencia', {
'@

$perfilNewA = @'
      const res = await fetch('/api/pagos/crear-suscripcion', {
'@

$perfilOldB = @'
  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState('');
'@

$perfilNewB = @'
  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState('');
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [cancelError, setCancelError] = React.useState('');
'@

$perfilOldC = @'
      setPayError(t('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.', 'Could not start the payment. Try again in a few seconds.'));
      setPayLoading(false);
    }
  }

  async function handleLogout() {
'@

$perfilNewC = @'
      setPayError(t('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.', 'Could not start the payment. Try again in a few seconds.'));
      setPayLoading(false);
    }
  }

  async function handleCancelarSuscripcion() {
    if (!user) return;
    const confirmado = window.confirm(
      t(
        '¿Seguro que quieres cancelar tu suscripción? Perderás el acceso al plan completo de inmediato y Mercado Pago dejará de cobrarte cada mes.',
        'Are you sure you want to cancel your subscription? You will lose access to the full plan immediately and Mercado Pago will stop charging you every month.'
      )
    );
    if (!confirmado) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pagos/cancelar-suscripcion', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cancelar la suscripción.');
      }
      setSubscription('cancelled');
      setPlanStatus('cancelled');
    } catch (err) {
      console.error(err);
      setCancelError(t('No se pudo cancelar la suscripción. Intenta de nuevo en unos segundos.', 'Could not cancel the subscription. Try again in a few seconds.'));
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleLogout() {
'@

$perfilOldD = @'
                  <div>
                    <p className="font-medium text-emerald-800">{t('Plan completo activo', 'Full plan active')}</p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      {planActivatedAt
                        ? t('Activado el ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 'Activated on ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }))
                        : t('Acceso completo a todas las herramientas de MBE Corpilot AI.', 'Full access to all MBE Corpilot AI tools.')}
                    </p>
                  </div>
                </div>
              ) : (
'@

$perfilNewD = @'
                  <div>
                    <p className="font-medium text-emerald-800">{t('Plan completo activo', 'Full plan active')}</p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      {planActivatedAt
                        ? t('Activado el ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 'Activated on ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }))
                        : t('Acceso completo a todas las herramientas de MBE Corpilot AI.', 'Full access to all MBE Corpilot AI tools.')}
                    </p>
                  </div>
                </div>
                <div>
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={handleCancelarSuscripcion}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? t('Cancelando...', 'Cancelling...') : t('Cancelar suscripción', 'Cancel subscription')}
                  </Button>
                  {cancelError && <p className="mt-2 text-sm text-red-600">{cancelError}</p>}
                </div>
              ) : (
'@

$builderOld = @'
      const res = await fetch('/api/pagos/crear-preferencia', {
'@

$builderNew = @'
      const res = await fetch('/api/pagos/crear-suscripcion', {
'@

# ------------------------------------------------------------------------
# 1) src/types/firestore.ts -- agregar campos nuevos
# ------------------------------------------------------------------------
Write-Host "1) src/types/firestore.ts"
Replace-Exactly -Path "src\types\firestore.ts" -Old $firestoreOld -New $firestoreNew -Label "firestore.ts: agregar mercadoPagoPreapprovalId y planCanceladoAt"
Write-Host ""

# ------------------------------------------------------------------------
# 2) src/app/api/pagos/crear-suscripcion/route.ts -- NUEVO archivo
# ------------------------------------------------------------------------
Write-Host "2) src/app/api/pagos/crear-suscripcion/route.ts (nuevo)"
New-FileWithContent -Path "src\app\api\pagos\crear-suscripcion\route.ts" -Content $crearSuscripcionContent -MarkerText "PreApproval } from 'mercadopago'" -Label "crear-suscripcion/route.ts"
Write-Host ""

# ------------------------------------------------------------------------
# 3) src/app/api/pagos/cancelar-suscripcion/route.ts -- NUEVO archivo
# ------------------------------------------------------------------------
Write-Host "3) src/app/api/pagos/cancelar-suscripcion/route.ts (nuevo)"
New-FileWithContent -Path "src\app\api\pagos\cancelar-suscripcion\route.ts" -Content $cancelarSuscripcionContent -MarkerText "cancelar-suscripcion" -Label "cancelar-suscripcion/route.ts"
Write-Host ""

# ------------------------------------------------------------------------
# 4) src/app/api/webhooks/mercadopago/route.ts -- reemplazo completo
# ------------------------------------------------------------------------
Write-Host "4) src/app/api/webhooks/mercadopago/route.ts"
Replace-Exactly -Path "src\app\api\webhooks\mercadopago\route.ts" -Old $webhookOld -New $webhookNew -Label "webhook: manejar subscription_preapproval y subscription_authorized_payment"
Write-Host ""

# ------------------------------------------------------------------------
# 5) src/app/[locale]/perfil/page.tsx -- 4 cambios
# ------------------------------------------------------------------------
Write-Host "5) src/app/[locale]/perfil/page.tsx"
$perfilPath = "src\app\[locale]\perfil\page.tsx"
Replace-Exactly -Path $perfilPath -Old $perfilOldA -New $perfilNewA -Label "perfil: boton pagar -> crear-suscripcion"
Replace-Exactly -Path $perfilPath -Old $perfilOldB -New $perfilNewB -Label "perfil: agregar estado cancelLoading/cancelError"
Replace-Exactly -Path $perfilPath -Old $perfilOldC -New $perfilNewC -Label "perfil: agregar funcion handleCancelarSuscripcion"
Replace-Exactly -Path $perfilPath -Old $perfilOldD -New $perfilNewD -Label "perfil: agregar boton Cancelar suscripcion en Tu plan"
Write-Host ""

# ------------------------------------------------------------------------
# 6) src/components/babel/MaturityPlanBuilder.tsx
# ------------------------------------------------------------------------
Write-Host "6) src/components/babel/MaturityPlanBuilder.tsx"
Replace-Exactly -Path "src\components\babel\MaturityPlanBuilder.tsx" -Old $builderOld -New $builderNew -Label "MaturityPlanBuilder: boton pagar -> crear-suscripcion"
Write-Host ""

# ------------------------------------------------------------------------
# 7) src/components/worlds/WorldsBuilder.tsx
# ------------------------------------------------------------------------
Write-Host "7) src/components/worlds/WorldsBuilder.tsx"
Replace-Exactly -Path "src\components\worlds\WorldsBuilder.tsx" -Old $builderOld -New $builderNew -Label "WorldsBuilder: boton pagar -> crear-suscripcion"
Write-Host ""

# ------------------------------------------------------------------------
# Verificacion final -- checklist de que todo quedo en su lugar
# ------------------------------------------------------------------------
Write-Host "========================================================================"
Write-Host " VERIFICACION FINAL"
Write-Host "========================================================================"

function Test-FileContains {
    param([string]$Path, [string]$Needle, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "  [FALTA] $Label -- no existe el archivo $Path" -ForegroundColor Red
        return
    }
    $c = [System.IO.File]::ReadAllText($Path)
    if ($c.Contains($Needle)) {
        Write-Host "  [OK] $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FALTA] $Label" -ForegroundColor Red
    }
}

Test-FileContains -Path "src\types\firestore.ts" -Needle "mercadoPagoPreapprovalId" -Label "firestore.ts tiene mercadoPagoPreapprovalId"
Test-FileContains -Path "src\app\api\pagos\crear-suscripcion\route.ts" -Needle "PreApproval" -Label "crear-suscripcion/route.ts existe y usa PreApproval"
Test-FileContains -Path "src\app\api\pagos\cancelar-suscripcion\route.ts" -Needle "status: 'cancelled'" -Label "cancelar-suscripcion/route.ts existe y cancela en Mercado Pago"
Test-FileContains -Path "src\app\api\webhooks\mercadopago\route.ts" -Needle "subscription_preapproval" -Label "webhook maneja subscription_preapproval"
Test-FileContains -Path "src\app\api\webhooks\mercadopago\route.ts" -Needle "subscription_authorized_payment" -Label "webhook maneja subscription_authorized_payment"
Test-FileContains -Path "src\app\[locale]\perfil\page.tsx" -Needle "handleCancelarSuscripcion" -Label "perfil/page.tsx tiene el boton de cancelar"
Test-FileContains -Path "src\app\[locale]\perfil\page.tsx" -Needle "crear-suscripcion" -Label "perfil/page.tsx paga via crear-suscripcion"
Test-FileContains -Path "src\components\babel\MaturityPlanBuilder.tsx" -Needle "crear-suscripcion" -Label "MaturityPlanBuilder.tsx paga via crear-suscripcion"
Test-FileContains -Path "src\components\worlds\WorldsBuilder.tsx" -Needle "crear-suscripcion" -Label "WorldsBuilder.tsx paga via crear-suscripcion"

Write-Host ""
Write-Host "Si todo dice [OK], revisa 'git diff', luego haz commit y push." -ForegroundColor Cyan
Write-Host "Si algo dice [FALTA] u [OMITIDO], copia y pegame ese mensaje completo." -ForegroundColor Yellow

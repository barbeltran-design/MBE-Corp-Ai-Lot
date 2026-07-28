// ─────────────────────────────────────────────────────────────────────────
// POST /api/pagos/crear-preferencia
//
// ESTE ARCHIVO REEMPLAZA A: src/app/api/pagos/crear-preferencia/route.ts
// (el mismo que ya tienes — el único cambio es que ahora arma las
// back_urls con el prefijo de idioma correcto, ej. "/es/dashboard" en vez
// de "/dashboard", que era lo que rompía el regreso desde Mercado Pago).
//
// Qué hace: cuando el usuario da clic en "Pagar", el navegador llama a esta
// ruta. Esta ruta verifica quién es el usuario (con su token de Firebase),
// crea una "preferencia de pago" en Mercado Pago, y regresa la URL de pago
// a la que hay que redirigir al navegador.
//
// Variable de entorno requerida:
//   MERCADOPAGO_ACCESS_TOKEN
//
// Encabezado requerido en la petición (esto ya lo maneja el código del
// botón de pago, no algo que tengas que configurar tú manualmente):
//   Authorization: Bearer <token de Firebase del usuario logueado>
//
// Cuerpo (body) requerido en la petición (esto también lo maneja ya el
// botón de pago del dashboard):
//   { "locale": "es" }   ← el idioma actual del usuario
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAdminAuth } from '@/lib/firebase-admin';
import { locales } from '@/i18n/routing';

// TODO: ajusta este precio al precio real de tu plan de pago.
const PLAN_PRICE_MXN = 20;
const PLAN_TITLE = 'MBE Corpilot AI — Plan completo';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    // Verificar el token aquí (en el servidor) es lo que impide que alguien
    // pueda fingir ser otro usuario — el uid de abajo queda garantizado.
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // El dashboard manda el idioma actual en el body. Si por alguna razón
    // no viene, o viene un valor que no es un idioma soportado, usamos
    // "es" como respaldo — así nunca se arma una URL de regreso rota.
    let requestedLocale: string | undefined;
    try {
      const body = await req.json();
      requestedLocale = body?.locale;
    } catch {
      // Sin body o body inválido — seguimos con el respaldo.
    }
    const locale = locales.includes(requestedLocale as (typeof locales)[number])
      ? requestedLocale!
      : 'es';

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('[crear-preferencia] Falta MERCADOPAGO_ACCESS_TOKEN.');
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mbe-ai-copilot.vercel.app';

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'plan-completo',
            title: PLAN_TITLE,
            quantity: 1,
            unit_price: PLAN_PRICE_MXN,
            currency_id: 'MXN',
          },
        ],
        // external_reference es cómo, cuando llegue la confirmación (webhook),
        // sabremos a qué usuario (uid de Firebase) corresponde ese pago.
        external_reference: uid,
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${siteUrl}/${locale}/dashboard?pago=exitoso`,
          failure: `${siteUrl}/${locale}/dashboard?pago=fallido`,
          pending: `${siteUrl}/${locale}/dashboard?pago=pendiente`,
        },
        auto_return: 'approved',
      },
    });

    return NextResponse.json({ checkoutUrl: result.init_point });
  } catch (err) {
    console.error('[crear-preferencia] Error:', err);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
}

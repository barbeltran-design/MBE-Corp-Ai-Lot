// ─────────────────────────────────────────────────────────────────────────
// POST /api/pagos/crear-preferencia
//
// ESTE ARCHIVO VA EN: src/app/api/pagos/crear-preferencia/route.ts
// (o app/api/pagos/crear-preferencia/route.ts si tu proyecto no usa carpeta "src").
// Usa la misma base que ya tienen tus otras rutas de API — si ya existe una
// carpeta "api" en tu repo, las carpetas "pagos/crear-preferencia" van ADENTRO
// de esa carpeta que ya existe, no crees una carpeta "api" nueva y separada.
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
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAdminAuth } from '@/lib/firebase-admin';

// TODO: ajusta este precio al precio real de tu plan de pago.
const PLAN_PRICE_MXN = 99;
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
          success: `${siteUrl}/dashboard?pago=exitoso`,
          failure: `${siteUrl}/dashboard?pago=fallido`,
          pending: `${siteUrl}/dashboard?pago=pendiente`,
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

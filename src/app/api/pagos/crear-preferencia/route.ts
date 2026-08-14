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
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { locales } from '@/i18n/routing';
import { productIdValido, defaultCatalogItem } from '@/lib/catalog';
import { seedCatalogIfNeeded } from '@/lib/catalog-seed';

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
    // El producto a cobrar. Si no viene, se asume el plan completo por defecto.
    let requestedLocale: string | undefined;
    let returnPath = '/perfil';
    let productId = 'plan_mensual';
    try {
      const body = await req.json();
      requestedLocale = body?.locale;
      if (typeof body?.productId === 'string' && productIdValido(body.productId)) {
        productId = body.productId;
      }
      if (typeof body?.returnPath === 'string' && ['/perfil', '/dashboard', '/babel/madurez', '/worlds'].includes(body.returnPath)) {
        returnPath = body.returnPath;
      }
    } catch {
      // Sin body o body inválido — seguimos con el respaldo.
    }
    const locale = locales.includes(requestedLocale as (typeof locales)[number])
      ? requestedLocale!
      : 'es';

    // Precio y título se leen del catálogo de Firestore (admin) con fallback
    // a los defaults de cada producto.
    const db = getAdminDb();
    await seedCatalogIfNeeded();
    const catalogSnap = await db.collection('catalog').doc(productId).get();
    const catalogData = catalogSnap.exists ? catalogSnap.data() : null;
    const def = defaultCatalogItem(productId);
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
      throw new Error('[crear-preferencia] Falta MERCADOPAGO_ACCESS_TOKEN.');
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mbe-ai-copilot.vercel.app';

    const result = await preference.create({
      body: {
        items: [
          {
            id: productId,
            title: titleFinal,
            quantity: 1,
            unit_price: precio,
            currency_id: 'MXN',
          },
        ],
        metadata: { productId, catalogVersion: catalogData?.updatedAt ?? '' },
        // external_reference es cómo, cuando llegue la confirmación (webhook),
        // sabremos a qué usuario (uid de Firebase) corresponde ese pago.
        external_reference: uid,
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${siteUrl}/${locale}${returnPath}?pago=exitoso`,
          failure: `${siteUrl}/${locale}${returnPath}?pago=fallido`,
          pending: `${siteUrl}/${locale}${returnPath}?pago=pendiente`,
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

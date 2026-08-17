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
        // NOTA: a diferencia de crear-preferencia (pagos únicos), la API de
        // suscripciones de Mercado Pago (POST /preapproval) NO acepta un
        // campo notification_url por suscripción — se intentó, pero el SDK
        // oficial lo rechaza porque ese endpoint no lo soporta (confirmado
        // en la documentación oficial de Mercado Pago). Para suscripciones,
        // el aviso de los cobros SIEMPRE depende de que el webhook esté
        // registrado en el dashboard de la app de Suscripciones ("Tus
        // integraciones" → esa app → Webhooks), suscrito a "Suscripciones"
        // y "Pagos". Ver instrucciones dadas al usuario.
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

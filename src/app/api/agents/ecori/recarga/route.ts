import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-roles';
import { solicitarRecargaEcori } from '@/lib/ia-recarga';
import { leerEstadoProveedores, leerRecargasRecientes } from '@/lib/ecori-ledger';

// ---------------------------------------------------------------------------
// Ruta proxy autenticada del presupuesto de datos de los agentes (Ecori).
// El cliente nunca toca Circle ni Cloud Run directamente:
//   GET  /api/agents/ecori/recarga         -> config + estado de proveedores
//        + ultimas recargas (para la tarjeta UX del chat/perfil).
//   POST /api/agents/ecori/recarga         -> dispara una recarga manual de
//        prueba { proveedor, estado } llamando al servicio de Ecori y
//        registrando el resultado en Firestore.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const [proveedores, recientes] = await Promise.all([
    leerEstadoProveedores(),
    leerRecargasRecientes(10),
  ]);

  return NextResponse.json({
    config: {
      topePorTransaccionUsd: 1.0,
      topeDiarioUsd: 5.0,
      servicio: process.env.ECORI_SERVICE_URL ? 'configurado' : 'no_configurado',
    },
    proveedores,
    recientes,
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  let body: { proveedor?: string; estado?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const proveedor = typeof body.proveedor === 'string' ? body.proveedor.toLowerCase() : '';
  const estadoRaw = typeof body.estado === 'string' ? body.estado.toLowerCase() : '';

  if (!['gemini', 'groq', 'openrouter', 'deepseek'].includes(proveedor)) {
    return NextResponse.json({ error: 'Proveedor no permitido.' }, { status: 400 });
  }
  if (estadoRaw !== 'quota_excedida' && estadoRaw !== 'sin_balance') {
    return NextResponse.json({ error: 'Estado desconocido.' }, { status: 400 });
  }

  const resultado = await solicitarRecargaEcori(proveedor as 'gemini' | 'groq' | 'openrouter' | 'deepseek', estadoRaw, undefined);

  return NextResponse.json(resultado, { status: resultado.recargada ? 200 : 502 });
}
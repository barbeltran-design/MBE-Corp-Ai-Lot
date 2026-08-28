import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSeccion } from '@/lib/server-roles';
import { obtenerHorarioDigest, guardarHorarioDigest } from '@/lib/notificaciones';

// ---------------------------------------------------------------------------
// GET  /api/admin/notificaciones-horario — devuelve el horario vigente del
//                                           digest semanal (día/hora/zona
//                                           horaria), o el valor por defecto
//                                           si el admin nunca lo ha guardado.
// PUT  /api/admin/notificaciones-horario — guarda {diaSemana, hora, timezone}.
//                                           Este horario aplica a TODOS los
//                                           usuarios (no es por-usuario): el
//                                           plan gratuito de Vercel solo
//                                           permite 1 disparo diario por cada
//                                           entrada de cron, así que
//                                           vercel.json define 24 crons (uno
//                                           por hora UTC) y este valor decide,
//                                           en cada invocación, si "ahora" (en
//                                           el timezone elegido) coincide con
//                                           el día/hora configurados.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'notificaciones');
  if (guard instanceof NextResponse) return guard;

  try {
    const horario = await obtenerHorarioDigest();
    return NextResponse.json({ horario });
  } catch (err) {
    console.error('[admin/notificaciones-horario] GET error', err);
    return NextResponse.json({ error: 'Error al leer el horario' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'notificaciones');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const diaSemana = Number(body?.diaSemana);
    const hora = Number(body?.hora);
    const timezone = typeof body?.timezone === 'string' ? body.timezone.trim() : '';

    if (
      !Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6 ||
      !Number.isInteger(hora) || hora < 0 || hora > 23 ||
      !timezone
    ) {
      return NextResponse.json({ error: 'diaSemana (0-6), hora (0-23) y timezone son requeridos' }, { status: 400 });
    }

    // Validar que el timezone sea uno reconocido por el motor de JS del
    // servidor (evita guardar un valor inválido que rompería esHoraDeEnviar).
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      return NextResponse.json({ error: `Zona horaria no reconocida: ${timezone}` }, { status: 400 });
    }

    await guardarHorarioDigest({ diaSemana, hora, timezone }, guard.uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/notificaciones-horario] PUT error', err);
    return NextResponse.json({ error: 'Error al guardar el horario' }, { status: 500 });
  }
}

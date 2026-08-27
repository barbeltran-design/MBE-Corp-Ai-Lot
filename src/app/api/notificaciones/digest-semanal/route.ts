// Cron semanal (lunes por la mañana, configurado en vercel.json) que arma y
// envía el digest de cada usuario. Ver src/lib/notificaciones.ts para el
// dispatcher de Resend y src/types/firestore.ts para el esquema.
//
// LIMITACIÓN CONOCIDA: "nuevaConvocatoria" solo detecta convocatorias
// agregadas manualmente por un admin (colección convocatorias_extra, con
// campo creadaEn). Las convocatorias que llegan por el sync automático
// semanal (Google Sheets -> PR -> src/lib/convocatorias-data.json) NO
// disparan esta notificación porque ese archivo estático no tiene timestamp
// consultable en tiempo real desde un cron. Ver nota en la respuesta al
// usuario.
//
// Autenticación: Vercel adjunta automáticamente el header
// "Authorization: Bearer <CRON_SECRET>" cuando el cron se dispara, siempre
// que la variable de entorno CRON_SECRET esté configurada en el proyecto de
// Vercel. Si CRON_SECRET no está configurada todavía, se permite la
// ejecución igualmente (con advertencia en consola) para no bloquear las
// pruebas manuales antes de que el usuario la agregue.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { enviarDigestSemanal, type SeccionDigest } from '@/lib/notificaciones';
import { daysUntil, type PlanData, type Accion } from '@/lib/plan-accion';
import { rolLabel, nivelDesdePuntos, NIVEL_PUNTOS } from '@/lib/club';
import { MISIONES_PART_LABELS, misionLabel } from '@/lib/worlds';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // requiere plan Vercel Pro para superar 10s (Hobby)

function nivelLabelEs(id: string): string {
  const n = NIVEL_PUNTOS.find((x) => x.id === id);
  return n ? n.es : id;
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[digest-semanal] CRON_SECRET no configurada — ejecutando sin verificar origen. Configúrala en Vercel para asegurar este endpoint.');
    return true;
  }
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

interface JuntaSemana {
  fecha: string;
  hora: string;
  roles?: Record<string, string | null>;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = getAdminDb();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const enSieteDias = new Date(hoy);
  enSieteDias.setDate(enSieteDias.getDate() + 7);
  const hace7Dias = new Date(hoy);
  hace7Dias.setDate(hace7Dias.getDate() - 7);
  const hoyStr = hoy.toISOString().slice(0, 10);
  const finSemanaStr = enSieteDias.toISOString().slice(0, 10);

  // --- Contenido global (igual para todos los usuarios) ---------------

  // Junta de esta semana: se filtra en memoria (no por query compuesta) para
  // no depender de un índice compuesto de Firestore que no existe todavía.
  const juntasSnap = await db.collection('juntas_club').where('estatus', '==', 'programada').get();
  let juntaSemana: JuntaSemana | null = null;
  juntasSnap.forEach((doc) => {
    const d = doc.data();
    if (d.fecha >= hoyStr && d.fecha <= finSemanaStr) {
      if (!juntaSemana || d.fecha < juntaSemana.fecha) {
        juntaSemana = { fecha: d.fecha, hora: d.hora, roles: d.roles };
      }
    }
  });

  // Convocatorias agregadas manualmente por un admin en los últimos 7 días.
  const convocatoriasSnap = await db
    .collection('convocatorias_extra')
    .where('creadaEn', '>=', hace7Dias.toISOString())
    .get();
  const convocatoriasNuevas: string[] = [];
  convocatoriasSnap.forEach((doc) => {
    const d = doc.data();
    if (d?.nombre) convocatoriasNuevas.push(String(d.nombre));
  });

  // --- Por usuario ------------------------------------------------------

  const usersSnap = await db.collection('users').get();
  let procesados = 0;
  let conContenido = 0;

  for (const userDoc of usersSnap.docs) {
    procesados++;
    const uid = userDoc.id;
    const user = userDoc.data();
    const secciones: SeccionDigest[] = [];

    // 1) Junta de la semana + rol asignado
    if (juntaSemana) {
      const j = juntaSemana as JuntaSemana;
      const miRol = j.roles ? Object.entries(j.roles).find(([, v]) => v === uid)?.[0] : undefined;
      const rolTxt = miRol ? ` Tienes el rol de <strong>${rolLabel(miRol, 'es')}</strong>.` : '';
      secciones.push({
        categoria: 'juntaClub',
        tituloHtml: '<h3>📅 Tu junta de esta semana</h3>',
        contenidoHtml: `<p>Hay junta el <strong>${j.fecha}</strong> a las <strong>${j.hora}</strong>.${rolTxt}</p>`,
        resumenTexto: `Junta el ${j.fecha} ${j.hora}${miRol ? ` (rol: ${miRol})` : ''}`,
      });
    }

    // 2) Plan de acción: vencidas/por vencer (actividadesVencen) + reto de la semana
    const workspaceSnap = await db.collection('users').doc(uid).collection('workspace').doc('plan-accion').get();
    if (workspaceSnap.exists) {
      try {
        const raw = workspaceSnap.data()?.data;
        const plan: PlanData = typeof raw === 'string' ? JSON.parse(raw) : null;
        const acciones: Accion[] = plan?.acciones ?? [];
        const pendientes = acciones
          .filter((a) => a.estatus !== 'terminado' && a.fecha)
          .map((a) => ({ ...a, dias: daysUntil(a.fecha) }))
          .filter((a) => a.dias <= 7)
          .sort((a, b) => a.dias - b.dias);

        if (pendientes.length > 0) {
          const items = pendientes
            .slice(0, 8)
            .map((a) => {
              const estadoTxt = a.dias < 0 ? `vencida hace ${Math.abs(a.dias)} día(s)` : a.dias === 0 ? 'vence hoy' : `vence en ${a.dias} día(s)`;
              return `<li>${a.descripcion || '(sin descripción)'} — <em>${estadoTxt}</em></li>`;
            })
            .join('');
          secciones.push({
            categoria: 'actividadesVencen',
            tituloHtml: '<h3>⏰ Actividades vencidas o por vencer</h3>',
            contenidoHtml: `<ul>${items}</ul>`,
            resumenTexto: `${pendientes.length} actividad(es) vencida(s)/por vencer`,
          });

          const masUrgente = pendientes[0];
          secciones.push({
            categoria: 'retoSemanal',
            tituloHtml: '<h3>🎯 Tu reto de la semana</h3>',
            contenidoHtml: `<p>${masUrgente.descripcion || '(sin descripción)'}${masUrgente.entregable ? ` — entregable: ${masUrgente.entregable}` : ''}</p>`,
            resumenTexto: `Reto: ${masUrgente.descripcion}`,
          });
        }
      } catch (err) {
        console.error(`[digest-semanal] error parseando plan-accion de ${uid}`, err);
      }
    }

    // 3) Misiones pendientes del Mundo de Partida
    const partida: number[] = Array.isArray(user.worlds?.partida) ? user.worlds.partida : [];
    const faltantes = MISIONES_PART_LABELS.filter((m) => !partida.includes(m.n));
    if (faltantes.length > 0) {
      const items = faltantes.map((m) => `<li>${misionLabel(m.n, 'es')}</li>`).join('');
      secciones.push({
        categoria: 'misionesPendientes',
        tituloHtml: '<h3>🧭 Misiones pendientes</h3>',
        contenidoHtml: `<ul>${items}</ul>`,
        resumenTexto: `${faltantes.length} misión(es) pendiente(s)`,
      });
    }

    // 4) Ranking: puntos acumulados + nivel + delta semanal (si hay puntosLog)
    const puntosClub = typeof user.puntosClub === 'number' ? user.puntosClub : 0;
    if (puntosClub > 0) {
      const nivel = nivelDesdePuntos(puntosClub);
      const logSnap = await db
        .collection('puntosLog')
        .where('uid', '==', uid)
        .where('fecha', '>=', hace7Dias.toISOString())
        .get();
      let delta = 0;
      logSnap.forEach((doc) => {
        const p = doc.data()?.puntos;
        if (typeof p === 'number') delta += p;
      });
      const deltaTxt = delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta} esta semana)` : '';
      secciones.push({
        categoria: 'ranking',
        tituloHtml: '<h3>🏆 Tu ranking en el Club</h3>',
        contenidoHtml: `<p>Tienes <strong>${puntosClub} puntos</strong> — nivel <strong>${nivelLabelEs(nivel)}</strong>${deltaTxt}.</p>`,
        resumenTexto: `${puntosClub} pts, nivel ${nivel}${deltaTxt}`,
      });
    }

    // 5) Nuevas convocatorias (contenido global, igual para todos)
    if (convocatoriasNuevas.length > 0) {
      const items = convocatoriasNuevas.map((n) => `<li>${n}</li>`).join('');
      secciones.push({
        categoria: 'nuevaConvocatoria',
        tituloHtml: '<h3>📢 Nuevas convocatorias esta semana</h3>',
        contenidoHtml: `<ul>${items}</ul>`,
        resumenTexto: `${convocatoriasNuevas.length} convocatoria(s) nueva(s)`,
      });
    }

    if (secciones.length > 0) {
      conContenido++;
      await enviarDigestSemanal(uid, secciones);
    }
  }

  return NextResponse.json({ ok: true, usuariosProcesados: procesados, digestsEnviados: conContenido });
}

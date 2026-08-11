import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth, readUserRoles } from '@/lib/server-roles';
import { esAdmin } from '@/lib/roles';
import {
  AGENDA_JUNTA,
  AGENDA_JUNTA_TOTAL,
  CATALOGO_PUNTOS,
  puntoValor,
  NIVEL_PUNTOS,
  nivelDesdePuntos,
  siguienteNivel,
  trimestreActual,
  tematicaDeSemana,
  type JuntaClubDoc,
} from '@/lib/club';

const ROLES_JUNTA_IDS = ['coordinador', 'mentor_dinamica', 'mentor_crecimiento', 'mentor_b2b', 'mentor_calidad'] as const;

function parseNum(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Semana del mes (1-5) de una fecha YYYY-MM-DD (o de hoy).
function semanaDeMes(fechaStr?: string): number {
  const d = fechaStr ? new Date(fechaStr) : new Date();
  if (Number.isNaN(d.getTime())) return 1;
  return Math.min(5, Math.floor((d.getDate() - 1) / 7) + 1);
}

// Lunes de esta semana como ISO con +00:00 para filtrar puntos recientes.
function lunesSemanaISO(): string {
  const d = new Date();
  const day = d.getDay() || 7; // lunes=1 ... domingo=7
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function sortKey(doc: { fecha?: string; hora?: string }): string {
  return `${doc.fecha ?? '9999-99-99'}T${doc.hora ?? '00:00'}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// GET /api/club — vista del Club (autenticado): juntas y eventos, roles con
// nombres de quienes los ocupan, mis datos/puntos, rankings y catálogo.
export async function GET(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireAuth(req);
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }

  try {
    const db = getAdminDb();

    const usersSnap = await db.collection('users').limit(400).get();
    const users = new Map<string, Record<string, unknown>>();
    usersSnap.forEach((d) => users.set(d.id, d.data() as Record<string, unknown>));

    // --- Juntas y eventos (ordenados por fecha) ---
    const juntasSnap = await db.collection('juntas_club').limit(120).get();
    const juntas = juntasSnap.docs
      .map((d) => {
        const data = d.data() as Partial<JuntaClubDoc>;
        const rolesRaw = (data.roles as Record<string, unknown> | undefined) ?? {};
        const asistentesRaw = (data.asistentes as Record<string, unknown> | undefined) ?? {};
        return {
          id: d.id,
          tipo: String(data.tipo ?? 'junta'),
          nombre: String(data.nombre ?? ''),
          fecha: String(data.fecha ?? ''),
          hora: String(data.hora ?? ''),
          liga: String(data.liga ?? ''),
          ubicacion: String(data.ubicacion ?? ''),
          objetivo: String(data.objetivo ?? ''),
          precio: parseNum(data.precio, 0),
          semanaMes: parseNum(data.semanaMes, semanaDeMes(data.fecha)),
          temaDefinido: String(data.temaDefinido ?? ''),
          agenda: Array.isArray(data.agenda) ? data.agenda : undefined,
          roles: Object.fromEntries(
            Object.entries(rolesRaw).map(([k, v]) => {
              const u = users.get(String(v));
              return [k, u ? { uid: String(v), nombre: String(u.name ?? '') } : null];
            })
          ),
          asistentes: Object.fromEntries(
            Object.entries(asistentesRaw).map(([k, v]) => [k, { confirmado: v === true }])
          ),
          estatus: String(data.estatus ?? 'programada'),
        };
      })
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    const juntasProgramadas = juntas.filter((j) => j.tipo === 'junta' && j.estatus === 'programada');
    const juntaActual = juntasProgramadas[0] ?? null;

    const yoRaw = (users.get(uid) as Record<string, unknown> | undefined) ?? {};
    const yoPuntos = parseNum(yoRaw.puntosClub, 0);
    const misRolesJunta = juntaActual
      ? Object.entries(juntaActual.roles)
          .filter(([, v]) => v && v.uid === uid)
          .map(([k]) => k)
      : [];

    // --- Puntos de la semana (para el Mentor de Calidad) ---
    const puntosSnap = await db
      .collection('puntos_club')
      .where('fecha', '>=', lunesSemanaISO())
      .limit(300)
      .get();
    const puntosSemana = puntosSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        userId: String(data.userId ?? ''),
        categoria: String(data.categoria ?? ''),
        valor: parseNum(data.valor, 0),
        fecha: String(data.fecha ?? ''),
        nota: String(data.nota ?? ''),
      };
    });

    // --- Ranking histórico (puntos acumulados) y trimestral ---
    const trim = trimestreActual();
    const ptrTrimSnap = await db.collection('puntos_club').where('trimestre', '==', trim).get();
    const porUsuarioTrim = new Map<string, number>();
    ptrTrimSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const pid = String(data.userId ?? '');
      porUsuarioTrim.set(pid, (porUsuarioTrim.get(pid) ?? 0) + parseNum(data.valor, 0));
    });

    const miembrosHistorico = Array.from(users.entries())
      .map(([id, u]) => ({
        uid: id,
        nombre: String(u.name ?? ''),
        puntos: parseNum(u.puntosClub, 0),
        nivel: nivelDesdePuntos(parseNum(u.puntosClub, 0)),
      }))
      .filter((m) => m.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 100)
      .map((m, i) => ({ ...m, posicion: i + 1 }));

    const rankingTrimestre = Array.from(porUsuarioTrim.entries())
      .map(([id, pts]) => ({
        uid: id,
        nombre: String(users.get(id)?.name ?? ''),
        puntos: pts,
      }))
      .filter((m) => m.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 100)
      .map((m, i) => ({ ...m, posicion: i + 1 }));

    const siguiente = siguienteNivel(yoPuntos);
    return NextResponse.json({
      yo: {
        uid,
        nombre: String(yoRaw.name ?? ''),
        puntos: yoPuntos,
        nivel: nivelDesdePuntos(yoPuntos),
        puntosFaltan: siguiente ? siguiente.puntosFaltan : 0,
        siguienteNivel: siguiente ? { id: siguiente.id, es: siguiente.es, en: siguiente.en } : null,
        primerJuntaAt: String(yoRaw.primerJuntaAt ?? ''),
        semanasJunta: parseNum(yoRaw.semanasJunta, 0),
      },
      miembros: Array.from(users.entries())
        .map(([id, u]) => ({
          uid: id,
          nombre: String(u.name ?? ''),
          puntos: parseNum(u.puntosClub, 0),
          nivel: nivelDesdePuntos(parseNum(u.puntosClub, 0)),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      semanaActual: semanaDeMes(undefined),
      trimestre: trim,
      tematicaSemana: { es: tematicaDeSemana(semanaDeMes(undefined), 'es'), en: tematicaDeSemana(semanaDeMes(undefined), 'en') },
      juntaActual,
      juntas,
      misRolesJunta,
      rankings: {
        trimestre: rankingTrimestre,
        historico: miembrosHistorico,
      },
      puntosSemana,
      niveles: NIVEL_PUNTOS.map((n) => ({ id: n.id, umbral: n.umbral, es: n.es, en: n.en })),
      catalogo: CATALOGO_PUNTOS.map((c) => ({ id: c.id, es: c.es, en: c.en, valor: c.valor })),
      agendaEjemplo: AGENDA_JUNTA.es,
      totalMinutosAgenda: AGENDA_JUNTA_TOTAL,
    });
  } catch (err) {
    console.error('[club] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer el Club.' }, { status: 500 });
  }
}

// POST /api/club — acciones autenticadas.
//   crear-junta      {fecha, hora, liga?}                        (admin)
//   crear-evento     {nombre, fecha, hora, ubicacion, objetivo, precio?} (admin)
//   asignar-roles    {juntaId, roles: {rolId: uid|null}}         (admin o coord. de esa junta)
//   definir-tema     {juntaId, tema}                             (admin o mentor_crecimiento)
//   reordenar-agenda {juntaId, agenda: [{id, duracionMin}]}      (admin o coord.; suma 90)
//   confirmar        {juntaId, confirmado}                       (cualquiera)
//   otorgar-puntos   {juntaId, items: [{userId, categorias[]}]}  (admin o mentor_calidad)
//   ajustar-puntos   {userId, valor, nota?}                      (solo admin)
//   cerrar-junta     {juntaId}                                   (admin o coord.)
export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireAuth(req);
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }

  try {
    const body = await req.json();
    const accion = String(body?.accion ?? '');
    const db = getAdminDb();
    const now = nowISO();
    const userRoles = await readUserRoles(uid);
    const esAdminFlag = esAdmin(userRoles);

    const userSnap = await db.collection('users').doc(uid).get();
    const userName = (userSnap.exists ? userSnap.data() : {})?.name ?? '';

    if (accion === 'crear-junta') {
      if (!esAdminFlag) return NextResponse.json({ error: 'No tienes permisos.' }, { status: 403 });
      const fecha = String(body?.fecha ?? '').trim();
      const hora = String(body?.hora ?? '').trim();
      if (!fecha || !hora) return NextResponse.json({ error: 'Faltan fecha u hora.' }, { status: 400 });
      const semana = semanaDeMes(fecha);
      let liga = String(body?.liga ?? '').trim();
      if (liga && !/^https?:\/\//i.test(liga)) liga = 'https://' + liga;
      const doc: JuntaClubDoc = {
        tipo: 'junta',
        nombre: `Junta ${semana === 1 ? 'de Consejo' : 'semanal'} · Semana ${semana}`,
        fecha,
        hora,
        liga,
        semanaMes: semana,
        agenda: AGENDA_JUNTA.es.map((i) => ({ ...i })),
        roles: { coordinador: null, mentor_dinamica: null, mentor_crecimiento: null, mentor_b2b: null, mentor_calidad: null },
        asistentes: {},
        temaDefinido: '',
        creadoPor: uid,
        creadoEn: now,
        estatus: 'programada',
      };
      const ref = await db.collection('juntas_club').add(doc);
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (accion === 'crear-evento') {
      if (!esAdminFlag) return NextResponse.json({ error: 'No tienes permisos.' }, { status: 403 });
      const nombre = String(body?.nombre ?? '').trim();
      const fecha = String(body?.fecha ?? '').trim();
      const hora = String(body?.hora ?? '').trim();
      if (!nombre || !fecha || !hora) return NextResponse.json({ error: 'Faltan nombre, fecha u hora.' }, { status: 400 });
      const doc: JuntaClubDoc = {
        tipo: 'evento',
        nombre,
        fecha,
        hora,
        ubicacion: String(body?.ubicacion ?? '').trim(),
        objetivo: String(body?.objetivo ?? '').trim(),
        precio: body?.precio !== undefined && body?.precio !== '' ? parseNum(body.precio, 0) : undefined,
        asistentes: {},
        creadoPor: uid,
        creadoEn: now,
        estatus: 'programada',
      };
      const ref = await db.collection('juntas_club').add(doc);
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (accion === 'asignar-roles') {
      const juntaId = String(body?.juntaId ?? '');
      const rolesRaw = (body?.roles as Record<string, unknown> | undefined) ?? {};
      const roles: Record<string, string | null> = {};
      for (const rol of ROLES_JUNTA_IDS) {
        const v = rolesRaw[rol];
        if (v === null || v === undefined || v === '') roles[rol] = null;
        else if (typeof v === 'string') roles[rol] = v;
      }
      const juntaSnap = await db.collection('juntas_club').doc(juntaId).get();
      if (!juntaSnap.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = juntaSnap.data() as JuntaClubDoc;
      const coord = jData.roles?.coordinador;
      const soyCoord = coord === uid;
      if (!esAdminFlag && !soyCoord) {
        return NextResponse.json({ error: 'Solo el coordinador o un admin puede asignar roles.' }, { status: 403 });
      }
      await db.collection('juntas_club').doc(juntaId).update({ roles });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'definir-tema') {
      const juntaId = String(body?.juntaId ?? '');
      const tema = String(body?.tema ?? '').trim();
      const snapDoc = await db.collection('juntas_club').doc(juntaId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = snapDoc.data() as Partial<JuntaClubDoc>;
      const esMentorCrecimiento = jData.roles?.mentor_crecimiento === uid;
      if (!esAdminFlag && !esMentorCrecimiento) {
        return NextResponse.json({ error: 'Solo el Mentor de Crecimiento o un admin puede definir el tema.' }, { status: 403 });
      }
      if (!tema) return NextResponse.json({ error: 'Falta el tema.' }, { status: 400 });
      await db.collection('juntas_club').doc(juntaId).update({ temaDefinido: tema });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'reordenar-agenda') {
      const juntaId = String(body?.juntaId ?? '');
      const agendaRaw = Array.isArray(body?.agenda) ? body.agenda : [];
      const agenda: { id: string; titulo: string; descripcion: string; responsable: string; duracionMin: number }[] = [];
      for (const item of agendaRaw) {
        const i = item as Record<string, unknown>;
        if (typeof i?.id !== 'string') continue;
        let dur = Math.round(parseNum(i?.duracionMin, 0));
        if (!Number.isFinite(dur) || dur < 1) dur = 1;
        const base = AGENDA_JUNTA.es.find((a) => a.id === i.id);
        agenda.push({
          id: i.id,
          titulo: String(i?.titulo ?? base?.titulo ?? i.id),
          descripcion: String(i?.descripcion ?? base?.descripcion ?? ''),
          responsable: String(i?.responsable ?? base?.responsable ?? ''),
          duracionMin: dur,
        });
      }
      const total = agenda.reduce((a, x) => a + x.duracionMin, 0);
      if (total !== AGENDA_JUNTA_TOTAL) {
        return NextResponse.json(
          { error: `La agenda debe sumar ${AGENDA_JUNTA_TOTAL} minutos (ahora suma ${total}).` },
          { status: 400 }
        );
      }
      const snapDoc = await db.collection('juntas_club').doc(juntaId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = snapDoc.data() as Partial<JuntaClubDoc>;
      const soyCoord = jData.roles?.coordinador === uid;
      if (!esAdminFlag && !soyCoord) {
        return NextResponse.json({ error: 'Solo el coordinador o un admin puede ajustar la agenda.' }, { status: 403 });
      }
      await db.collection('juntas_club').doc(juntaId).update({ agenda });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'confirmar-asistencia') {
      const juntaId = String(body?.juntaId ?? '');
      const confirmado = body?.confirmado === true;
      const snapDoc = await db.collection('juntas_club').doc(juntaId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = snapDoc.data() as Partial<JuntaClubDoc>;
      const asistentes = (jData.asistentes as Record<string, boolean> | undefined) ?? {};
      asistentes[uid] = confirmado;
      await db.collection('juntas_club').doc(juntaId).update({ asistentes });
      if (confirmado) {
        // Registra la primera junta confirmada.
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const uData = userDoc.exists ? (userDoc.data() as Record<string, unknown>) : {};
        if (!uData.primerJuntaAt) {
          await userRef.update({ primerJuntaAt: now });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (accion === 'otorgar-puntos') {
      const juntaId = String(body?.juntaId ?? '');
      const itemsRaw = Array.isArray(body?.items) ? body.items : [];
      const snapDoc = await db.collection('juntas_club').doc(juntaId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = snapDoc.data() as Partial<JuntaClubDoc>;
      const soyCalidad = jData.roles?.mentor_calidad === uid;
      if (!esAdminFlag && !soyCalidad) {
        return NextResponse.json({ error: 'Solo el Mentor de Calidad o un admin puede otorgar puntos.' }, { status: 403 });
      }
      const trim = trimestreActual();
      const batch = db.batch();
      let valorTotal = 0;
      for (const item of itemsRaw) {
        const it = item as Record<string, unknown>;
        const targetUid = String(it?.userId ?? '');
        const categorias = Array.isArray(it?.categorias) ? it.categorias.map(String) : [];
        if (!targetUid || categorias.length === 0) continue;
        const suma = categorias.reduce((a, c) => a + puntoValor(c), 0);
        const docRef = db.collection('puntos_club').doc();
        batch.set(docRef, {
          userId: targetUid,
          juntaId,
          categoria: categorias.join(','),
          valor: suma,
          trimestre: trim,
          fecha: now,
          nota: String(it?.nota ?? ''),
          otorgadoPor: uid,
        });
        // Actualiza el total en users/{uid}
        const uSnap = await db.collection('users').doc(targetUid).get();
        const uData = uSnap.exists ? (uSnap.data() as Record<string, unknown>) : {};
        batch.update(db.collection('users').doc(targetUid), {
          puntosClub: parseNum(uData.puntosClub, 0) + suma,
          ...(uData.primerJuntaAt ? {} : { primerJuntaAt: now }),
        });
        valorTotal += suma;
      }
      await batch.commit();
      return NextResponse.json({ ok: true, valorTotal });
    }

    if (accion === 'ajustar-puntos') {
      if (!esAdminFlag) return NextResponse.json({ error: 'Solo un admin puede ajustar puntos.' }, { status: 403 });
      const targetUid = String(body?.userId ?? '');
      const valor = Math.round(parseNum(body?.valor, 0));
      if (!targetUid || valor === 0) return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
      const uSnap = await db.collection('users').doc(targetUid).get();
      const uData = uSnap.exists ? (uSnap.data() as Record<string, unknown>) : {};
      await db.collection('users').doc(targetUid).update({ puntosClub: parseNum(uData.puntosClub, 0) + valor });
      await db.collection('puntos_club').add({
        userId: targetUid,
        juntaId: '',
        categoria: 'ajuste_admin',
        valor,
        trimestre: trimestreActual(),
        fecha: now,
        nota: String(body?.nota ?? ''),
        otorgadoPor: uid,
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'cerrar-junta') {
      const juntaId = String(body?.juntaId ?? '');
      const snapDoc = await db.collection('juntas_club').doc(juntaId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = snapDoc.data() as Partial<JuntaClubDoc>;
      const soyCoord = jData.roles?.coordinador === uid;
      if (!esAdminFlag && !soyCoord) {
        return NextResponse.json({ error: 'Solo el coordinador o un admin puede cerrar la junta.' }, { status: 403 });
      }
      // Cada asistente gana asistencia automática: suma al total y agrega log.
      const asistentes = (jData.asistentes as Record<string, boolean> | undefined) ?? {};
      const trim = trimestreActual();
      const batch = db.batch();
      for (const [aUid, conf] of Object.entries(asistentes)) {
        if (conf !== true) continue;
        const uSnap = await db.collection('users').doc(aUid).get();
        const uData = uSnap.exists ? (uSnap.data() as Record<string, unknown>) : {};
        batch.update(db.collection('users').doc(aUid), {
          puntosClub: parseNum(uData.puntosClub, 0) + 1,
          semanasJunta: parseNum(uData.semanasJunta, 0) + 1,
          ...(uData.primerJuntaAt ? {} : { primerJuntaAt: now }),
        });
        batch.set(db.collection('puntos_club').doc(), {
          userId: aUid,
          juntaId,
          categoria: 'asistencia',
          valor: 1,
          trimestre: trimestreActual(),
          fecha: now,
          nota: 'Asistencia a junta',
          otorgadoPor: uid,
        });
      }
      await batch.commit();
      await db.collection('juntas_club').doc(juntaId).update({ estatus: 'realizada' });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  } catch (err) {
    console.error('[club] POST error', err);
    return NextResponse.json({ error: 'No se pudo procesar la acción.' }, { status: 500 });
  }
}
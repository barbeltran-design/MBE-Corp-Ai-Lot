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
  mesActual,
  tematicaDeSemana,
  aplicarAgendaMaestra,
  type JuntaClubDoc,
  type AgendaOverrideItem,
  type PuntoCatalogoItem,
  type NivelClubItem,
} from '@/lib/club';
import { nivelPorPuntos } from '@/lib/refplace';
import { puedeCrearNoticias, nivelMinimoNoticiasInfo } from '@/lib/premium';

interface NoticiaClubDoc {
  titulo: string;
  contenido: string;
  autorUid: string;
  autorNombre: string;
  estatus: 'pendiente' | 'aprobada' | 'rechazada';
  creadoEn: string;
  aprobadoPor?: string;
  aprobadoEn?: string;
  motivoRechazo?: string;
}

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

// Overrides "permanentes" de la agenda base, guardados por un admin desde el
// Club (accion reordenar-agenda con permanente:true). Si el documento no
// existe todavia, se usa la agenda original tal cual (sin cambios).
const AGENDA_MAESTRA_DOC = 'config/agenda_junta_maestra';

async function leerAgendaMaestra(db: FirebaseFirestore.Firestore): Promise<Record<string, AgendaOverrideItem>> {
  try {
    const snap = await db.doc(AGENDA_MAESTRA_DOC).get();
    if (!snap.exists) return {};
    const data = snap.data() as { overrides?: Record<string, AgendaOverrideItem> } | undefined;
    return data?.overrides ?? {};
  } catch (err) {
    console.error('[club] leerAgendaMaestra error', err);
    return {};
  }
}

// Catalogo de puntos editable por administradores (doc config/catalogo_puntos).
// Si no existe o esta vacio, se usa la constante CATALOGO_PUNTOS.
const CATALOGO_PUNTOS_DOC = 'config/catalogo_puntos';
const NIVELES_CLUB_DOC = 'config/niveles_club';

async function leerCatalogoPuntos(db: FirebaseFirestore.Firestore): Promise<PuntoCatalogoItem[]> {
  try {
    const snap = await db.doc(CATALOGO_PUNTOS_DOC).get();
    const items = snap.exists ? (snap.data() as { items?: unknown }).items : null;
    if (Array.isArray(items) && items.length) {
      const out = items
        .map((raw) => {
          const c = raw as Record<string, unknown>;
          return { id: String(c.id ?? ''), es: String(c.es ?? ''), en: String(c.en ?? ''), valor: parseNum(c.valor, 0) };
        })
        .filter((c) => c.id);
      if (out.length) return out;
    }
  } catch (err) {
    console.error('[club] leerCatalogoPuntos error', err);
  }
  return CATALOGO_PUNTOS.map((c) => ({ ...c }));
}

async function leerNivelesClub(db: FirebaseFirestore.Firestore): Promise<NivelClubItem[]> {
  try {
    const snap = await db.doc(NIVELES_CLUB_DOC).get();
    const items = snap.exists ? (snap.data() as { items?: unknown }).items : null;
    if (Array.isArray(items) && items.length) {
      const out = items
        .map((raw) => {
          const n = raw as Record<string, unknown>;
          return {
            id: String(n.id ?? ''),
            umbral: parseNum(n.umbral, 0),
            es: String(n.es ?? ''),
            en: String(n.en ?? ''),
            accesos: Array.isArray(n.accesos) ? n.accesos.map(String) : [],
          };
        })
        .filter((n) => n.id);
      if (out.length) return out;
    }
  } catch (err) {
    console.error('[club] leerNivelesClub error', err);
  }
  return NIVEL_PUNTOS.map((n) => ({ ...n, accesos: [] as string[] }));
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
    const userRoles = await readUserRoles(uid);
    const esAdminFlag = esAdmin(userRoles);
    const agendaOverrides = await leerAgendaMaestra(db);
    const agendaBase = aplicarAgendaMaestra(agendaOverrides);

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
          temaDinamica: String(data.temaDinamica ?? ''),
          agenda: Array.isArray(data.agenda) ? data.agenda : undefined,
          roles: Object.fromEntries(
            Object.entries(rolesRaw).map(([k, v]) => {
              const u = users.get(String(v));
              return [k, u ? { uid: String(v), nombre: String(u.name ?? '') || String(u.email ?? '') } : null];
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
    // La junta "actual" es la PROXIMA por venir (fecha+hora >= ahora). Si ya
    // no queda ninguna futura, se muestra la ultima programada (pasada) para
    // que la seccion no quede vacia; el cliente permite navegar entre juntas.
    const ahoraD = new Date();
    const ahoraKey = `${hoyLocal()}T${String(ahoraD.getHours()).padStart(2, '0')}:${String(ahoraD.getMinutes()).padStart(2, '0')}`;
    const juntasFuturas = juntasProgramadas.filter((j) => sortKey(j) >= ahoraKey);
    const juntaActual = juntasFuturas[0] ?? juntasProgramadas[juntasProgramadas.length - 1] ?? null;

    const yoRaw = (users.get(uid) as Record<string, unknown> | undefined) ?? {};
    const yoPuntos = parseNum(yoRaw.puntosClub, 0);
    const yoNivelComunidad = nivelPorPuntos(yoPuntos);
    const yoCertificado = yoRaw.certificado === true;
    const yoPuedeCrearNoticias =
      esAdminFlag || puedeCrearNoticias({ roles: userRoles, nivelComunidad: yoNivelComunidad, certificado: yoCertificado });
    const misRolesJunta = juntaActual
      ? Object.entries(juntaActual.roles)
          .filter(([, v]) => v && v.uid === uid)
          .map(([k]) => k)
      : [];

    // --- Noticias de la comunidad (Junta semanal > Noticias) ---
    const noticiasSnap = await db.collection('noticias_club').orderBy('creadoEn', 'desc').limit(80).get();
    const todasNoticias = noticiasSnap.docs.map((d) => {
      const nd = d.data() as Partial<NoticiaClubDoc>;
      return {
        id: d.id,
        titulo: String(nd.titulo ?? ''),
        contenido: String(nd.contenido ?? ''),
        autorUid: String(nd.autorUid ?? ''),
        autorNombre: String(nd.autorNombre ?? ''),
        estatus: (nd.estatus as NoticiaClubDoc['estatus']) ?? 'pendiente',
        creadoEn: String(nd.creadoEn ?? ''),
        aprobadoPor: nd.aprobadoPor ? String(nd.aprobadoPor) : undefined,
        aprobadoEn: nd.aprobadoEn ? String(nd.aprobadoEn) : undefined,
        motivoRechazo: nd.motivoRechazo ? String(nd.motivoRechazo) : undefined,
      };
    });
    const noticiasAprobadas = todasNoticias.filter((n) => n.estatus === 'aprobada');
    const noticiasPendientes = esAdminFlag ? todasNoticias.filter((n) => n.estatus === 'pendiente') : [];

    // --- Cumpleaños de hoy (a partir de users.fechaNacimiento, formato YYYY-MM-DD) ---
    const hoyMesDia = (() => {
      const d = new Date();
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const cumpleanosHoy = Array.from(users.entries())
      .filter(([, u]) => {
        const fn = typeof u.fechaNacimiento === 'string' ? u.fechaNacimiento : '';
        return fn.length >= 10 && fn.slice(5, 10) === hoyMesDia;
      })
      .map(([id, u]) => ({ uid: id, nombre: String(u.name ?? '') || 'Miembro' }));

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

    // --- Ranking histórico (puntos acumulados), trimestral y mensual ---
    const trim = trimestreActual();
    const mes = mesActual();
    const ptrTrimSnap = await db.collection('puntos_club').where('trimestre', '==', trim).get();
    const porUsuarioTrim = new Map<string, number>();
    const porUsuarioMes = new Map<string, number>();
    ptrTrimSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const pid = String(data.userId ?? '');
      const val = parseNum(data.valor, 0);
      porUsuarioTrim.set(pid, (porUsuarioTrim.get(pid) ?? 0) + val);
      // El ranking del mes se deriva del trimestre filtrando por mes de `fecha`.
      if (String(data.fecha ?? '').slice(0, 7) === mes) {
        porUsuarioMes.set(pid, (porUsuarioMes.get(pid) ?? 0) + val);
      }
    });

    // Los rankings del periodo incluyen a TODOS los usuarios (con 0 puntos si
    // no tienen movimientos). El nombre cae al correo electronico cuando el
    // usuario no tiene `name`, para no mostrar filas en blanco.
    function rankingDePeriodo(mapa: Map<string, number>) {
      return Array.from(users.entries())
        .map(([id, u]) => ({
          uid: id,
          nombre: String(u.name ?? '') || String(u.email ?? ''),
          puntos: mapa.get(id) ?? 0,
        }))
        .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
        .map((m, i) => ({ ...m, posicion: i + 1 }));
    }

    const miembrosHistorico = Array.from(users.entries())
      .map(([id, u]) => ({
        uid: id,
        nombre: String(u.name ?? '') || String(u.email ?? ''),
        puntos: parseNum(u.puntosClub, 0),
        nivel: nivelDesdePuntos(parseNum(u.puntosClub, 0)),
      }))
      .filter((m) => m.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 100)
      .map((m, i) => ({ ...m, posicion: i + 1 }));

    const rankingTrimestre = rankingDePeriodo(porUsuarioTrim);
    const rankingMes = rankingDePeriodo(porUsuarioMes);

    const [catalogoCfg, nivelesCfg] = await Promise.all([leerCatalogoPuntos(db), leerNivelesClub(db)]);

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
        certificado: yoCertificado,
        nivelComunidad: yoNivelComunidad,
        puedeCrearNoticias: yoPuedeCrearNoticias,
      },
      miembros: Array.from(users.entries())
        .map(([id, u]) => ({
          uid: id,
          nombre: String(u.name ?? '') || String(u.email ?? ''),
          email: String(u.email ?? ''),
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
        mes: rankingMes,
        historico: miembrosHistorico,
      },
      puntosSemana,
      niveles: nivelesCfg,
      catalogo: catalogoCfg,
      agendaEjemplo: agendaBase,
      totalMinutosAgenda: AGENDA_JUNTA_TOTAL,
      noticiasAprobadas,
      noticiasPendientes,
      cumpleanosHoy,
      nivelMinimoNoticias: nivelMinimoNoticiasInfo(),
    });
  } catch (err) {
    console.error('[club] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer el Club.' }, { status: 500 });
  }
}

// POST /api/club — acciones autenticadas.
//   crear-junta        {fecha, hora, liga?}                        (admin)
//   generar-juntas-mes {anio, mes?, modo?: 'mes'|'anio', diaSemana?: 0-6, hora?}
//                                                                   (admin) — crea de un jalón las juntas
//                                                                   que falten (una por cada `diaSemana` de
//                                                                   cada mes cubierto). Si no se manda
//                                                                   `diaSemana`, se toma el día de la semana
//                                                                   de la última junta creada (o viernes=5
//                                                                   si no hay ninguna todavía).
//   crear-evento       {nombre, fecha, hora, ubicacion, objetivo, precio?} (admin)
//   asignar-roles      {juntaId, roles: {rolId: uid|null}}         (admin o coord. de esa junta)
//   definir-tema       {juntaId, tema, tipo?: 'tutorial'|'dinamica'} (tutorial: admin/coord/mentor_crecimiento; dinamica: admin/coord/mentor_dinamica)
//   cancelar-junta     {juntaId}                                   (solo admin)
//   reordenar-agenda   {juntaId, agenda: [{id, duracionMin}]}      (admin o coord.; suma 90)
//   confirmar          {juntaId, confirmado}                       (cualquiera)
//   otorgar-puntos     {juntaId, items: [{userId, categorias[]}]}  (admin o mentor_calidad)
//   ajustar-puntos     {userId, valor, nota?}                      (solo admin)
//   cerrar-junta       {juntaId}                                   (admin o coord.)
//   crear-noticia      {titulo, contenido}                         (nivel Empresario Orquesta+, certificado, o admin)
//   aprobar-noticia    {noticiaId}                                 (solo admin)
//   rechazar-noticia   {noticiaId, motivo?}                        (solo admin)
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
      const agendaOverridesNueva = await leerAgendaMaestra(db);
      const doc: JuntaClubDoc = {
        tipo: 'junta',
        nombre: `Junta ${semana === 1 ? 'de Consejo' : 'semanal'} · Semana ${semana}`,
        fecha,
        hora,
        liga,
        semanaMes: semana,
        agenda: aplicarAgendaMaestra(agendaOverridesNueva),
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

    if (accion === 'generar-juntas-mes') {
      // Crea de un jalón las juntas que falten para un mes (modo:'mes', default)
      // o para los 12 meses de un año (modo:'anio'), una por cada `diaSemana`
      // (0=domingo … 6=sábado) de cada mes cubierto, sin duplicar fechas que ya
      // tengan junta programada.
      // Body: { anio, mes (1-12, requerido si modo!=='anio'), modo?: 'mes'|'anio',
      //         diaSemana? (0-6; si no se manda, se usa el día de la semana de
      //         la última junta creada, o viernes=5 si todavía no hay ninguna),
      //         hora? (default '18:00') }.
      if (!esAdminFlag) return NextResponse.json({ error: 'No tienes permisos.' }, { status: 403 });
      const anio = Math.round(parseNum(body?.anio, 0));
      const modo = String(body?.modo ?? 'mes') === 'anio' ? 'anio' : 'mes';
      const mes = Math.round(parseNum(body?.mes, 0));
      const hora = String(body?.hora ?? '18:00').trim();
      if (!anio) {
        return NextResponse.json({ error: 'Falta el año.' }, { status: 400 });
      }
      if (modo === 'mes' && (!mes || mes < 1 || mes > 12)) {
        return NextResponse.json({ error: 'Falta un mes válido.' }, { status: 400 });
      }

      // Una sola lectura (where simple, sin orderBy en otro campo — así no
      // depende de ningún índice compuesto de Firestore) que sirve para dos
      // cosas: saber qué fechas ya tienen junta (evitar duplicados) y, si el
      // admin no mandó `diaSemana`, deducirlo de la última junta creada.
      const existentesSnap = await db.collection('juntas_club').where('tipo', '==', 'junta').get();
      const fechasExistentesArr = existentesSnap.docs.map((d) => String(d.data().fecha ?? '')).filter(Boolean);
      const fechasExistentes = new Set(fechasExistentesArr);

      // Día de la semana objetivo: el que mande el admin (0-6) o, si no manda
      // nada, el mismo día de la última junta ya creada (para no romper la
      // cadencia existente); si todavía no hay ninguna junta, viernes (5).
      let diaSemana = Math.round(parseNum(body?.diaSemana, NaN));
      if (!Number.isFinite(diaSemana) || diaSemana < 0 || diaSemana > 6) {
        const ultimaFecha = fechasExistentesArr.sort().pop();
        if (ultimaFecha) {
          const [y, m, dd] = ultimaFecha.split('-').map(Number);
          diaSemana = new Date(y, (m || 1) - 1, dd || 1).getDay();
        } else {
          diaSemana = 5; // viernes, día por default del formulario "Crear junta"
        }
      }

      const mesesCubrir = modo === 'anio' ? Array.from({ length: 12 }, (_, i) => i + 1) : [mes];
      const fechasGenerar: string[] = [];
      for (const m of mesesCubrir) {
        const cursor = new Date(anio, m - 1, 1);
        while (cursor.getMonth() === m - 1) {
          if (cursor.getDay() === diaSemana) {
            fechasGenerar.push(
              `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
            );
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const agendaOverridesNueva = await leerAgendaMaestra(db);
      const agendaBase = aplicarAgendaMaestra(agendaOverridesNueva);

      const pendientes = fechasGenerar.filter((fecha) => !fechasExistentes.has(fecha));
      const creadas: string[] = [];
      // Firestore limita ~500 escrituras por batch; se manda en bloques de 400
      // para quedar con margen (relevante sobre todo en modo 'anio').
      const TAM_BLOQUE = 400;
      for (let i = 0; i < pendientes.length; i += TAM_BLOQUE) {
        const bloque = pendientes.slice(i, i + TAM_BLOQUE);
        const batch = db.batch();
        for (const fecha of bloque) {
          const semana = semanaDeMes(fecha);
          const doc: JuntaClubDoc = {
            tipo: 'junta',
            nombre: `Junta ${semana === 1 ? 'de Consejo' : 'semanal'} · Semana ${semana}`,
            fecha,
            hora,
            liga: '',
            semanaMes: semana,
            agenda: agendaBase,
            roles: { coordinador: null, mentor_dinamica: null, mentor_crecimiento: null, mentor_b2b: null, mentor_calidad: null },
            asistentes: {},
            temaDefinido: '',
            creadoPor: uid,
            creadoEn: now,
            estatus: 'programada',
          };
          const ref = db.collection('juntas_club').doc();
          batch.set(ref, doc);
          creadas.push(fecha);
        }
        await batch.commit();
      }

      return NextResponse.json({
        ok: true,
        modo,
        diaSemana,
        creadas: creadas.length,
        fechas: creadas,
        omitidasPorDuplicado: fechasGenerar.length - creadas.length,
      });
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
      const tipo = String(body?.tipo ?? 'tutorial') === 'dinamica' ? 'dinamica' : 'tutorial';
      const snapDoc = await db.collection('juntas_club').doc(juntaId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
      const jData = snapDoc.data() as Partial<JuntaClubDoc>;
      const esCoord = jData.roles?.coordinador === uid;
      const esMentorCrecimiento = jData.roles?.mentor_crecimiento === uid;
      const esMentorDinamica = jData.roles?.mentor_dinamica === uid;
      // Tutorial: coordinador, Mentor de Crecimiento o admin.
      // Dinamica empresarial: coordinador, Mentor de Dinamica Empresarial o admin.
      const autorizado =
        tipo === 'dinamica'
          ? esAdminFlag || esCoord || esMentorDinamica
          : esAdminFlag || esCoord || esMentorCrecimiento;
      if (!autorizado) {
        return NextResponse.json(
          {
            error:
              tipo === 'dinamica'
                ? 'Solo el coordinador, el Mentor de Dinámica Empresarial o un admin puede definir el tema de la dinámica.'
                : 'Solo el coordinador, el Mentor de Crecimiento o un admin puede definir el tema del tutorial.',
          },
          { status: 403 }
        );
      }
      if (!tema) return NextResponse.json({ error: 'Falta el tema.' }, { status: 400 });
      await db
        .collection('juntas_club')
        .doc(juntaId)
        .update(tipo === 'dinamica' ? { temaDinamica: tema } : { temaDefinido: tema });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'cancelar-junta') {
      if (!esAdminFlag) return NextResponse.json({ error: 'Solo un administrador puede cancelar la junta.' }, { status: 403 });
      const juntaId = String(body?.juntaId ?? '');
      if (!juntaId) return NextResponse.json({ error: 'Falta la junta.' }, { status: 400 });
      await db.collection('juntas_club').doc(juntaId).update({ estatus: 'cancelada' });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'reordenar-agenda') {
      const juntaId = String(body?.juntaId ?? '');
      const permanente = body?.permanente === true;
      if (permanente && !esAdminFlag) {
        return NextResponse.json(
          { error: 'Solo un administrador puede guardar un cambio permanente en la agenda (que aplique a todas las juntas futuras). Puedes guardar el cambio solo para la junta de hoy.' },
          { status: 403 }
        );
      }
      const agendaRaw = Array.isArray(body?.agenda) ? body.agenda : [];
      const agenda: { id: string; titulo: string; descripcion: string; responsable: string; duracionMin: number; oculto: boolean }[] = [];
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
          oculto: i?.oculto === true,
        });
      }
      // Solo los temas visibles cuentan para el total de 90 minutos; un tema
      // oculto no ocupa tiempo en la junta de ese dia.
      const total = agenda.filter((x) => !x.oculto).reduce((a, x) => a + x.duracionMin, 0);
      if (total !== AGENDA_JUNTA_TOTAL) {
        return NextResponse.json(
          { error: `Los temas visibles de la agenda deben sumar ${AGENDA_JUNTA_TOTAL} minutos (ahora suman ${total}). Los temas ocultos no cuentan en la suma.` },
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
      // Cambio solo para esta junta (siempre se guarda, sea permanente o no).
      await db.collection('juntas_club').doc(juntaId).update({ agenda });

      // Si se pidio que sea permanente (solo admin, ya validado arriba),
      // ademas se guarda como override de la agenda maestra: asi, la proxima
      // vez que se cree una junta nueva, nacera ya con estos cambios. Si no
      // es permanente, la agenda maestra no se toca y la proxima junta nueva
      // aparecera con los temas originales.
      if (permanente) {
        const existentes = await leerAgendaMaestra(db);
        const overrides: Record<string, AgendaOverrideItem> = { ...existentes };
        for (const item of agenda) {
          overrides[item.id] = {
            titulo: item.titulo,
            descripcion: item.descripcion,
            duracionMin: item.duracionMin,
            oculto: item.oculto,
          };
        }
        await db.doc(AGENDA_MAESTRA_DOC).set({ overrides }, { merge: false });
      }

      return NextResponse.json({ ok: true, permanente });
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
      // Los valores se leen del catalogo configurable (config/catalogo_puntos);
      // si el admin no lo ha personalizado, equivale a las constantes.
      const catalogoCfg = await leerCatalogoPuntos(db);
      const valorDe = (id: string) => catalogoCfg.find((c) => c.id === id)?.valor ?? puntoValor(id);
      const batch = db.batch();
      let valorTotal = 0;
      for (const item of itemsRaw) {
        const it = item as Record<string, unknown>;
        const targetUid = String(it?.userId ?? '');
        const categorias = Array.isArray(it?.categorias) ? it.categorias.map(String) : [];
        if (!targetUid || categorias.length === 0) continue;
        const suma = categorias.reduce((a, c) => a + valorDe(c), 0);
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

    if (accion === 'crear-noticia') {
      const titulo = String(body?.titulo ?? '').trim();
      const contenido = String(body?.contenido ?? '').trim();
      if (!titulo || !contenido) return NextResponse.json({ error: 'Falta título o contenido.' }, { status: 400 });
      if (titulo.length > 140) return NextResponse.json({ error: 'El título es demasiado largo (máx. 140 caracteres).' }, { status: 400 });
      if (contenido.length > 4000) return NextResponse.json({ error: 'El contenido es demasiado largo (máx. 4000 caracteres).' }, { status: 400 });
      const uData = (userSnap.exists ? userSnap.data() : {}) as Record<string, unknown>;
      const nivelComunidad = nivelPorPuntos(parseNum(uData.puntosClub, 0));
      const autorizado =
        esAdminFlag || puedeCrearNoticias({ roles: userRoles, nivelComunidad, certificado: uData.certificado === true });
      if (!autorizado) {
        return NextResponse.json(
          { error: 'Solo miembros con nivel Empresario Orquesta o superior, o con certificación MBE, pueden crear noticias.' },
          { status: 403 }
        );
      }
      const ref = await db.collection('noticias_club').add({
        titulo,
        contenido,
        autorUid: uid,
        autorNombre: userName || '',
        estatus: 'pendiente',
        creadoEn: now,
      });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (accion === 'aprobar-noticia') {
      if (!esAdminFlag) return NextResponse.json({ error: 'Solo un administrador puede aprobar noticias.' }, { status: 403 });
      const noticiaId = String(body?.noticiaId ?? '');
      if (!noticiaId) return NextResponse.json({ error: 'Falta la noticia.' }, { status: 400 });
      const nSnap = await db.collection('noticias_club').doc(noticiaId).get();
      if (!nSnap.exists) return NextResponse.json({ error: 'Noticia no encontrada.' }, { status: 404 });
      await db.collection('noticias_club').doc(noticiaId).update({ estatus: 'aprobada', aprobadoPor: uid, aprobadoEn: now });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'rechazar-noticia') {
      if (!esAdminFlag) return NextResponse.json({ error: 'Solo un administrador puede rechazar noticias.' }, { status: 403 });
      const noticiaId = String(body?.noticiaId ?? '');
      if (!noticiaId) return NextResponse.json({ error: 'Falta la noticia.' }, { status: 400 });
      const nSnap = await db.collection('noticias_club').doc(noticiaId).get();
      if (!nSnap.exists) return NextResponse.json({ error: 'Noticia no encontrada.' }, { status: 404 });
      await db.collection('noticias_club').doc(noticiaId).update({
        estatus: 'rechazada',
        aprobadoPor: uid,
        aprobadoEn: now,
        motivoRechazo: String(body?.motivo ?? '').trim(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  } catch (err) {
    console.error('[club] POST error', err);
    return NextResponse.json({ error: 'No se pudo procesar la acción.' }, { status: 500 });
  }
}

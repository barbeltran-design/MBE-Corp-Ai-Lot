import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth, readUserRoles } from '@/lib/server-roles';
import {
  NIVELES_COMUNIDAD,
  nivelIndex,
  nivelPorPuntos,
  type MiembroComunidad,
  type OfertaRepSale,
  type SolicitudReferencia,
  type ReunionB2B,
} from '@/lib/refplace';

const GIRO_LABELS: Record<string, string> = {
  manufacturing: 'Manufactura',
  services: 'Servicios',
  commerce: 'Comercio',
  tech: 'Tecnología',
};

function parseNum(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// GET /api/refplace — vista del Reference Place (autenticado): comunidad,
// solicitudes de referencia, ofertas de Rep Sales y reuniones B2B.
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

    // --- Comunidad: usuarios con nivel (automático por puntos o asignado) + su empresa ---
    const usersSnap = await db.collection('users').limit(400).get();
    const companiesSnap = await db.collection('companies').get();
    const companiesById = new Map<string, Record<string, unknown>>();
    companiesSnap.forEach((d) => companiesById.set(d.id, d.data() as Record<string, unknown>));

    // --- Estadísticas de reuniones completadas por usuario ---
    const statsReunion = new Map<string, { completadas: number; monto: number }>();
    const reunBulkSnap = await db.collection('reuniones_b2b').where('estatus', '==', 'completada').get();
    for (const doc of reunBulkSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const participantes = Array.isArray(data.participantes) ? (data.participantes as unknown[]) : [];
      const resultados = Array.isArray(data.resultados) ? (data.resultados as Record<string, unknown>[]) : [];
      const montoTotal = resultados.reduce((a, r) => a + parseNum(r?.monto, 0), 0);
      for (const p of participantes) {
        const pObj = p as { uid?: string };
        if (!pObj || typeof pObj.uid !== 'string') continue;
        const cur = statsReunion.get(pObj.uid) || { completadas: 0, monto: 0 };
        cur.completadas += 1;
        cur.monto += montoTotal;
        statsReunion.set(pObj.uid, cur);
      }
    }

    const miembros: MiembroComunidad[] = [];
    // Madurez por usuario en paralelo (una consulta por usuario).
    const madurezList = await Promise.all(
      usersSnap.docs.map(async (doc) => {
        try {
          const assSnap = await db
            .collection('assessments').doc(doc.id).collection('entries')
            .orderBy('timestamp', 'desc').limit(1).get();
          if (!assSnap.empty) {
            const t = assSnap.docs[0].data()?.totalScore;
            if (typeof t === 'number') return t;
          }
        } catch {
          // Sin evaluacion: madurez null.
        }
        return null;
      })
    );

    for (const [i, doc] of usersSnap.docs.entries()) {
      const data = doc.data() as Record<string, unknown>;
      const roles = Array.isArray(data.roles) ? (data.roles as unknown[]).map(String) : [];
      const nivelRaw = typeof data.nivelComunidad === 'string' ? data.nivelComunidad : '';
      const esRep = roles.includes('rep_sale');
      const puntosClub = parseNum(data.puntosClub, 0);
      const nivelAuto = puntosClub > 0 ? nivelPorPuntos(puntosClub) : '';
      const nivelManual = NIVELES_COMUNIDAD.some((n) => n.id === nivelRaw) ? nivelRaw : '';
      const nivelFinal = nivelAuto || nivelManual;

      const company = companiesById.get(doc.id) as Record<string, unknown> | undefined;
      const stats = statsReunion.get(doc.id) || { completadas: 0, monto: 0 };

      miembros.push({
        uid: doc.id,
        nombre: (data.name as string) || (data.email as string) || '',
        email: (data.email as string) || '',
        telefono: (data.telefono as string) || '',
        empresa: (company?.name as string) || '',
        giro: GIRO_LABELS[String(company?.industry ?? '')] ?? '',
        pais: (data.country as string) || ((company?.country as string) || ''),
        nivel: (nivelFinal || 'godin_wannabe') as MiembroComunidad['nivel'],
        certificado: data.certificado === true,
        madurez: madurezList[i],
        rolRepSale: esRep,
        reunionesCompletadas: stats.completadas,
        montoResultados: stats.monto,
        puntosClub,
      });
    }

    // --- Solicitudes de referencia (abiertas) ---
    const solicitudes: SolicitudReferencia[] = [];
    const solSnap = await db.collection('solicitudes_referencia').where('estatus', '==', 'abierta').get();
    solSnap.forEach((d) => {
      const s = d.data() as Record<string, unknown>;
      solicitudes.push({
        id: d.id,
        uid: (s.uid as string) || '',
        nombre: (s.nombre as string) || '',
        empresaObjetivo: (s.empresaObjetivo as string) || '',
        rubro: (s.rubro as string) || '',
        descripcion: (s.descripcion as string) || '',
        comisionPct: parseNum(s.comisionPct, 0),
        repSaleUid: (s.repSaleUid as string) || null,
        repSaleNombre: (s.repSaleNombre as string) || null,
        estatus: 'abierta',
        createdAt: String(s.createdAt ?? ''),
      });
    });

    // --- Ofertas de Rep Sales (activas) ---
    const ofertas: OfertaRepSale[] = [];
    const ofSnap = await db.collection('ofertas_rep_sale').where('estatus', '==', 'activa').get();
    ofSnap.forEach((d) => {
      const o = d.data() as Record<string, unknown>;
      ofertas.push({
        id: d.id,
        uid: (o.uid as string) || '',
        nombre: (o.nombre as string) || '',
        empresa: (o.empresa as string) || '',
        rubro: (o.rubro as string) || '',
        descripcion: (o.descripcion as string) || '',
        comisionPct: parseNum(o.comisionPct, 0),
        estatus: 'activa' as const,
        createdAt: String(o.createdAt ?? ''),
      });
    });

    // --- Reuniones B2B (limitadas; el cliente filtra las propias) ---
    const reuniones: ReunionB2B[] = [];
    const reunSnap = await db
      .collection('reuniones_b2b')
      .orderBy('fechaPropuesta', 'desc')
      .limit(200)
      .get();
    reunSnap.forEach((d) => {
      const r = d.data() as Record<string, unknown>;
      reuniones.push({
        id: d.id,
        uidCreador: (r.uidCreador as string) || '',
        creadorNombre: (r.creadorNombre as string) || '',
        titulo: (r.titulo as string) || '',
        tipo: (r.tipo as ReunionB2B['tipo']) || 'asesoria',
        descripcion: (r.descripcion as string) || '',
        participantes: Array.isArray(r.participantes) ? (r.participantes as { uid: string; nombre: string }[]) : [],
        estatus: (r.estatus as ReunionB2B['estatus']) || 'propuesta',
        fechaPropuesta: String(r.fechaPropuesta ?? ''),
        resultados: Array.isArray(r.resultados) ? (r.resultados as ReunionB2B['resultados']) : [],
        createdAt: String(r.createdAt ?? ''),
      });
    });

    // Miembro actual (el que llama) para conocer su nivel y permisos.
    const yoSnap = await db.collection('users').doc(uid).get();
    const yoData = yoSnap.exists ? (yoSnap.data() as Record<string, unknown>) : {};
    const yoRoles = Array.isArray(yoData.roles) ? (yoData.roles as unknown[]).map(String) : [];
    const yoPuntos = parseNum(yoData.puntosClub, 0);
    const yoNivel = yoPuntos > 0
      ? nivelPorPuntos(yoPuntos)
      : NIVELES_COMUNIDAD.some((n) => n.id === yoData.nivelComunidad)
        ? (yoData.nivelComunidad as string)
        : 'godin_wannabe';

    return NextResponse.json({
      yo: {
        uid,
        nombre: (yoData.name as string) || '',
        email: (yoData.email as string) || '',
        telefono: (yoData.telefono as string) || '',
        nivel: yoNivel,
        certificado: yoData.certificado === true,
        rolRepSale: yoRoles.includes('rep_sale'),
        puedeB2B: true, // desde Godín Wannabe todos participan en reuniones B2B
        puedeReferencias: nivelIndex(yoNivel) >= 3 || yoRoles.includes('rep_sale'),
      },
      miembros,
      solicitudes,
      ofertas,
      reuniones,
    });
  } catch (err) {
    console.error('[refplace] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer el Reference Place.' }, { status: 500 });
  }
}

// POST /api/refplace — acciones del usuario actual.
//   'crear-solicitud'   {empresaObjetivo, descripcion, comisionPct, repSaleUid?} (nivel >= Empresario Orquesta o rep_sale)
//   'crear-oferta'      {empresa, rubro, descripcion, comisionPct}                (solo rep_sale)
//   'crear-reunion'     {titulo, tipo, descripcion, participantes[], fechaPropuesta} (nivel >= Freelancero)
//   'aceptar-reunion'   {reunionId}      (cualquier participante)
//   'borrar-reunion'    {reunionId}      (quien la creo o un admin)
//   'registrar-resultado' {reunionId, tipo, monto, descripcion} (cualquier participante)
//   'cerrar-solicitud'  {solicitudId}    (el autor o un rep_sale)
//   'editar-solicitud'  {solicitudId, empresaObjetivo, descripcion, comisionPct, rubro?, repSaleUid?} (solo el autor)
//   'borrar-solicitud'  {solicitudId}    (solo el autor)
//   'editar-oferta'     {ofertaId, empresa, rubro, descripcion, comisionPct} (solo el autor)
//   'borrar-oferta'     {ofertaId}       (solo el autor)
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
    const accion = body?.accion as string;
    const db = getAdminDb();
    const now = new Date().toISOString();

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = (userSnap.exists ? userSnap.data() : {}) as Record<string, unknown>;
    const roles = await readUserRoles(uid);
    const esRep = roles.includes('rep_sale');
    const nombre = (userData.name as string) || '';

    if (accion === 'crear-solicitud') {
      const nivelClub = parseNum(userData.puntosClub, 0);
      const nivelAuto = nivelClub > 0 ? nivelPorPuntos(nivelClub) : '';
      const nivelRaw = nivelAuto || (typeof userData.nivelComunidad === 'string' ? userData.nivelComunidad : '');
      if (!esRep && nivelIndex(nivelRaw) < 3) {
        return NextResponse.json(
          { error: 'Tu nivel aún no permite solicitar referencias. Necesitas ser al menos Empresario Orquesta.' },
          { status: 403 }
        );
      }
      const empresaObjetivo = String(body?.empresaObjetivo ?? '').trim();
      if (!empresaObjetivo) {
        return NextResponse.json({ error: 'Falta la empresa objetivo.' }, { status: 400 });
      }
      let repSaleUid: string | null = null;
      let repSaleNombre: string | null = null;
      const repUid = (body?.repSaleUid as string | undefined) || '';
      if (repUid) {
        repSaleUid = repUid;
        const rsSnap = await db.collection('users').doc(repUid).get();
        if (rsSnap.exists) repSaleNombre = (rsSnap.data()?.name as string) || '';
      }
      await db.collection('solicitudes_referencia').add({
        uid,
        nombre,
        empresaObjetivo,
        rubro: String(body?.rubro ?? '').trim(),
        descripcion: String(body?.descripcion ?? '').trim(),
        comisionPct: parseNum(body?.comisionPct, 0),
        repSaleUid,
        repSaleNombre,
        estatus: 'abierta',
        createdAt: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'crear-oferta') {
      if (!esRep) {
        return NextResponse.json({ error: 'Solo los Rep Sales pueden ofertar.' }, { status: 403 });
      }
      const empresa = String(body?.empresa ?? '').trim();
      if (!empresa) return NextResponse.json({ error: 'Falta la empresa.' }, { status: 400 });
      await db.collection('ofertas_rep_sale').add({
        uid,
        nombre,
        empresa,
        rubro: String(body?.rubro ?? '').trim(),
        descripcion: String(body?.descripcion ?? '').trim(),
        comisionPct: parseNum(body?.comisionPct, 0),
        estatus: 'activa',
        createdAt: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'crear-reunion') {
      const titulo = String(body?.titulo ?? '').trim();
      const participantesRaw = Array.isArray(body?.participantes) ? body.participantes : [];
      const participantes: { uid: string; nombre: string }[] = [];
      for (const p of participantesRaw) {
        const pUid = typeof p === 'string' ? p : (p as { uid?: string })?.uid;
        if (typeof pUid !== 'string' || !pUid) continue;
        const pSnap = await db.collection('users').doc(pUid).get();
        const pNombre = pSnap.exists ? (pSnap.data()?.name as string) || '' : '';
        participantes.push({ uid: pUid, nombre: pNombre });
      }
      const todos = Array.from(new Set([uid, ...participantes.map((p) => p.uid)]));
      if (todos.length < 2) {
        return NextResponse.json({ error: 'La reunión B2B necesita al menos 2 participantes.' }, { status: 400 });
      }
      await db.collection('reuniones_b2b').add({
        uidCreador: uid,
        creadorNombre: nombre,
        titulo: titulo || 'Reunión B2B',
        tipo: String(body?.tipo ?? 'asesoria'),
        descripcion: String(body?.descripcion ?? '').trim(),
        participantes: todos.map((p) => ({
          uid: p,
          nombre: p === uid ? nombre : participantes.find((x) => x.uid === p)?.nombre || '',
        })),
        estatus: 'propuesta',
        fechaPropuesta: String(body?.fechaPropuesta ?? now),
        resultados: [],
        createdAt: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'aceptar-reunion') {
      const reunionId = String(body?.reunionId ?? '');
      if (!reunionId) return NextResponse.json({ error: 'Falta la reunión.' }, { status: 400 });
      const ref = db.collection('reuniones_b2b').doc(reunionId);
      const rSnap = await ref.get();
      if (!rSnap.exists) return NextResponse.json({ error: 'Reunión no encontrada.' }, { status: 404 });
      const r = rSnap.data() as Record<string, unknown>;
      const participa = Array.isArray(r.participantes) && r.participantes.some((p) => (p as { uid?: string })?.uid === uid);
      if (!participa) return NextResponse.json({ error: 'No participas en esta reunión.' }, { status: 403 });
      if (r.estatus !== 'propuesta') {
        return NextResponse.json({ error: 'La reunión ya no está como propuesta.' }, { status: 400 });
      }
      await ref.update({ estatus: 'aceptada', aceptadaEn: now });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'registrar-resultado') {
      const reunionId = String(body?.reunionId ?? '');
      const tipo = String(body?.tipo ?? '');
      if (!reunionId || !tipo) return NextResponse.json({ error: 'Faltan datos del resultado.' }, { status: 400 });
      const monto = parseNum(body?.monto, 0);
      const descripcion = String(body?.descripcion ?? '').trim();
      const ref = db.collection('reuniones_b2b').doc(reunionId);
      const rSnap = await ref.get();
      if (!rSnap.exists) return NextResponse.json({ error: 'Reunión no encontrada.' }, { status: 404 });
      const r = rSnap.data() as Record<string, unknown>;
      const participa = Array.isArray(r.participantes) && r.participantes.some((p) => (p as { uid?: string })?.uid === uid);
      if (!participa) return NextResponse.json({ error: 'Solo los participantes pueden registrar resultados.' }, { status: 403 });
      if (r.estatus === 'completada') {
        return NextResponse.json({ error: 'La reunión ya tiene resultado registrado.' }, { status: 400 });
      }
      await ref.update({
        estatus: 'completada',
        completadaEn: now,
        resultados: [
          ...(Array.isArray(r.resultados) ? (r.resultados as unknown[]) : []),
          { uid, nombre, tipo, monto, descripcion, createdAt: now },
        ],
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'borrar-reunion') {
      const reunionId = String(body?.reunionId ?? '');
      if (!reunionId) return NextResponse.json({ error: 'Falta la reunión.' }, { status: 400 });
      const ref = db.collection('reuniones_b2b').doc(reunionId);
      const rSnap = await ref.get();
      if (!rSnap.exists) return NextResponse.json({ error: 'Reunión no encontrada.' }, { status: 404 });
      const r = rSnap.data() as Record<string, unknown>;
      // Puede borrarla quien la creo o un administrador.
      if (r.uidCreador !== uid && !roles.includes('admin')) {
        return NextResponse.json({ error: 'Solo quien creó la reunión o un admin puede eliminarla.' }, { status: 403 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true });
    }

    if (accion === 'cerrar-solicitud') {
      const solicitudId = String(body?.solicitudId ?? '');
      if (!solicitudId) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });
      const ref = db.collection('solicitudes_referencia').doc(solicitudId);
      const sSnap = await ref.get();
      if (!sSnap.exists) return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
      const s = sSnap.data() as Record<string, unknown>;
      if (!esRep && s.uid !== uid) {
        return NextResponse.json({ error: 'No puedes cerrar esta solicitud.' }, { status: 403 });
      }
      await ref.update({ estatus: 'cerrada', cerradaEn: now });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'editar-solicitud') {
      const solicitudId = String(body?.solicitudId ?? '');
      if (!solicitudId) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });
      const ref = db.collection('solicitudes_referencia').doc(solicitudId);
      const sSnap = await ref.get();
      if (!sSnap.exists) return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
      const s = sSnap.data() as Record<string, unknown>;
      if (s.uid !== uid) {
        return NextResponse.json({ error: 'Solo el autor puede editar esta solicitud.' }, { status: 403 });
      }
      const empresaObjetivo = String(body?.empresaObjetivo ?? '').trim();
      if (!empresaObjetivo) {
        return NextResponse.json({ error: 'Falta la empresa objetivo.' }, { status: 400 });
      }
      let repSaleUid: string | null = null;
      let repSaleNombre: string | null = null;
      const repUid = (body?.repSaleUid as string | undefined) || '';
      if (repUid) {
        repSaleUid = repUid;
        const rsSnap = await db.collection('users').doc(repUid).get();
        if (rsSnap.exists) repSaleNombre = (rsSnap.data()?.name as string) || '';
      }
      await ref.update({
        empresaObjetivo,
        rubro: String(body?.rubro ?? '').trim(),
        descripcion: String(body?.descripcion ?? '').trim(),
        comisionPct: parseNum(body?.comisionPct, 0),
        repSaleUid,
        repSaleNombre,
        editadaEn: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'borrar-solicitud') {
      const solicitudId = String(body?.solicitudId ?? '');
      if (!solicitudId) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });
      const ref = db.collection('solicitudes_referencia').doc(solicitudId);
      const sSnap = await ref.get();
      if (!sSnap.exists) return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
      const s = sSnap.data() as Record<string, unknown>;
      if (s.uid !== uid) {
        return NextResponse.json({ error: 'Solo el autor puede borrar esta solicitud.' }, { status: 403 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true });
    }

    if (accion === 'editar-oferta') {
      const ofertaId = String(body?.ofertaId ?? '');
      if (!ofertaId) return NextResponse.json({ error: 'Falta la oferta.' }, { status: 400 });
      const ref = db.collection('ofertas_rep_sale').doc(ofertaId);
      const oSnap = await ref.get();
      if (!oSnap.exists) return NextResponse.json({ error: 'Oferta no encontrada.' }, { status: 404 });
      const o = oSnap.data() as Record<string, unknown>;
      if (o.uid !== uid) {
        return NextResponse.json({ error: 'Solo el autor puede editar esta oferta.' }, { status: 403 });
      }
      const empresa = String(body?.empresa ?? '').trim();
      if (!empresa) return NextResponse.json({ error: 'Falta la empresa.' }, { status: 400 });
      await ref.update({
        empresa,
        rubro: String(body?.rubro ?? '').trim(),
        descripcion: String(body?.descripcion ?? '').trim(),
        comisionPct: parseNum(body?.comisionPct, 0),
        editadaEn: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'borrar-oferta') {
      const ofertaId = String(body?.ofertaId ?? '');
      if (!ofertaId) return NextResponse.json({ error: 'Falta la oferta.' }, { status: 400 });
      const ref = db.collection('ofertas_rep_sale').doc(ofertaId);
      const oSnap = await ref.get();
      if (!oSnap.exists) return NextResponse.json({ error: 'Oferta no encontrada.' }, { status: 404 });
      const o = oSnap.data() as Record<string, unknown>;
      if (o.uid !== uid) {
        return NextResponse.json({ error: 'Solo el autor puede borrar esta oferta.' }, { status: 403 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (err) {
    console.error('[refplace] POST error', err);
    return NextResponse.json({ error: 'No se pudo completar la acción.' }, { status: 500 });
  }
}
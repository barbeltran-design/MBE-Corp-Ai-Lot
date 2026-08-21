import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';

// Mismo algoritmo de normalizacion que scripts/sync-convocatorias.mjs y
// apps-script/convocatorias-hook.gs, para que el "nombre normalizado" que usa
// esta ruta para ocultar/restaurar coincida siempre con el que usan esos dos.
function norm(s: string): string {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface CriteriosBody {
  alcance_geo?: string | null;
  estado?: string | null;
  tipos_elegibles?: string[];
  ods_num?: number[];
  edad_min?: number | null;
  edad_max?: number | null;
  anios_min_operacion?: number | null;
  anios_max_operacion?: number | null;
  liderazgo?: string | null;
}

interface NuevaConvocatoriaBody {
  convocatoria?: string;
  tipo?: string;
  ambito?: string;
  ods?: string;
  descripcion?: string;
  requisitos?: string;
  monto?: string;
  fecha_limite?: string;
  estatus?: string;
  liga?: string;
  fuenteUrl?: string;
  criterios?: CriteriosBody;
}

// Construye el renglon de 11 columnas para la hoja de Google, en el mismo
// orden que ENCABEZADO en apps-script/convocatorias-hook.gs.
function filaParaHoja(doc: {
  convocatoria: string;
  tipo: string;
  ambito: string;
  ods: string;
  descripcion: string;
  requisitos: string;
  monto: string;
  fecha_limite: string;
  estatus: string;
  liga: string;
}): string[] {
  return [
    doc.convocatoria,
    doc.tipo,
    doc.ambito,
    doc.ods,
    doc.descripcion,
    doc.requisitos,
    doc.monto,
    doc.fecha_limite,
    doc.estatus,
    doc.liga,
    new Date().toISOString().slice(0, 10),
  ];
}

// Manda la convocatoria a la hoja de Google (el Apps Script la crea si no
// existe un renglon con ese nombre, o la actualiza si ya existia). Nunca
// revienta la peticion si la hoja no esta configurada o si falla: la
// convocatoria ya quedo guardada en Firestore de todas formas, y el fallo
// solo se registra en el log del servidor.
async function upsertEnHoja(doc: Parameters<typeof filaParaHoja>[0]): Promise<void> {
  const url = process.env.SHEETS_WEB_APP_URL;
  if (!url) {
    console.warn('[admin/convocatorias] SHEETS_WEB_APP_URL no configurada; no se escribio en la hoja.');
    return;
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fila: filaParaHoja(doc) }),
    });
    if (!resp.ok) {
      console.warn(`[admin/convocatorias] upsertEnHoja: HTTP ${resp.status}`);
    }
  } catch (err) {
    console.warn('[admin/convocatorias] upsertEnHoja error', err);
  }
}

// GET /api/admin/convocatorias — lista lo agregado a mano (convocatorias_extra)
// y lo oculto del catalogo de la hoja (convocatorias_ocultas), para la pestana
// "Convocatorias" del panel de administracion.
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const [extraSnap, ocultasSnap] = await Promise.all([
      db.collection('convocatorias_extra').orderBy('creadaEn', 'desc').get(),
      db.collection('convocatorias_ocultas').get(),
    ]);
    const extra = extraSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ocultas = ocultasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ extra, ocultas });
  } catch (err) {
    console.error('[admin/convocatorias] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer las convocatorias.' }, { status: 500 });
  }
}

// POST /api/admin/convocatorias — publica una convocatoria nueva (agregada a
// mano desde /admin, normalmente tras extraerla de una URL y revisarla).
// Se guarda directo como publicada: esta ruta ES la unica instancia de
// revision (el administrador ya vio/edito los campos en /admin antes de
// llamar aqui).
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = (await req.json()) as NuevaConvocatoriaBody;
    const convocatoria = String(body.convocatoria || '').trim();
    const liga = String(body.liga || '').trim();
    if (!convocatoria || !liga) {
      return NextResponse.json({ error: 'Faltan el nombre de la convocatoria y/o la liga.' }, { status: 400 });
    }

    const cr = body.criterios || {};
    const criterios = {
      alcance_geo: cr.alcance_geo || null,
      estado: cr.estado || null,
      tipos_elegibles: Array.isArray(cr.tipos_elegibles) ? cr.tipos_elegibles : [],
      ods_num: Array.isArray(cr.ods_num) ? cr.ods_num : [],
      edad_min: cr.edad_min ?? null,
      edad_max: cr.edad_max ?? null,
      anios_min_operacion: cr.anios_min_operacion ?? null,
      anios_max_operacion: cr.anios_max_operacion ?? null,
      liderazgo: cr.liderazgo || null,
    };

    const doc = {
      convocatoria,
      tipo: String(body.tipo || '').trim(),
      ambito: String(body.ambito || '').trim(),
      ods: String(body.ods || '').trim(),
      descripcion: String(body.descripcion || '').trim(),
      requisitos: String(body.requisitos || '').trim(),
      monto: String(body.monto || '').trim() || 'Por confirmar',
      fecha_limite: String(body.fecha_limite || '').trim(),
      estatus: String(body.estatus || '').trim() || 'Abierta',
      liga,
      criterios,
      fuenteUrl: String(body.fuenteUrl || liga),
      creadaEn: new Date().toISOString(),
      creadaPor: guard.uid,
    };

    const db = getAdminDb();
    const ref = await db.collection('convocatorias_extra').add(doc);
    await upsertEnHoja(doc);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[admin/convocatorias] POST error', err);
    return NextResponse.json({ error: 'No se pudo publicar la convocatoria.' }, { status: 500 });
  }
}

// PUT /api/admin/convocatorias — edita una convocatoria agregada a mano
// (convocatorias_extra), identificada por su "id" de Firestore. Recibe los
// mismos campos que POST mas "id". Tambien actualiza (o crea, si el nombre
// cambio y ya no coincide con ningun renglon) la fila correspondiente en la
// hoja de Google.
export async function PUT(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = (await req.json()) as NuevaConvocatoriaBody & { id?: string };
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Falta el id de la convocatoria a editar.' }, { status: 400 });

    const convocatoria = String(body.convocatoria || '').trim();
    const liga = String(body.liga || '').trim();
    if (!convocatoria || !liga) {
      return NextResponse.json({ error: 'Faltan el nombre de la convocatoria y/o la liga.' }, { status: 400 });
    }

    const cr = body.criterios || {};
    const criterios = {
      alcance_geo: cr.alcance_geo || null,
      estado: cr.estado || null,
      tipos_elegibles: Array.isArray(cr.tipos_elegibles) ? cr.tipos_elegibles : [],
      ods_num: Array.isArray(cr.ods_num) ? cr.ods_num : [],
      edad_min: cr.edad_min ?? null,
      edad_max: cr.edad_max ?? null,
      anios_min_operacion: cr.anios_min_operacion ?? null,
      anios_max_operacion: cr.anios_max_operacion ?? null,
      liderazgo: cr.liderazgo || null,
    };

    const doc = {
      convocatoria,
      tipo: String(body.tipo || '').trim(),
      ambito: String(body.ambito || '').trim(),
      ods: String(body.ods || '').trim(),
      descripcion: String(body.descripcion || '').trim(),
      requisitos: String(body.requisitos || '').trim(),
      monto: String(body.monto || '').trim() || 'Por confirmar',
      fecha_limite: String(body.fecha_limite || '').trim(),
      estatus: String(body.estatus || '').trim() || 'Abierta',
      liga,
      criterios,
      fuenteUrl: String(body.fuenteUrl || liga),
      editadaEn: new Date().toISOString(),
      editadaPor: guard.uid,
    };

    const db = getAdminDb();
    await db.collection('convocatorias_extra').doc(id).set(doc, { merge: true });
    await upsertEnHoja(doc);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/convocatorias] PUT error', err);
    return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 });
  }
}

// DELETE /api/admin/convocatorias — tres casos:
//   ?origen=extra&id=<docId>      -> borra definitivamente una convocatoria
//                                     agregada a mano (nunca estuvo en la hoja).
//   ?origen=sheet&nombre=<texto>  -> oculta una convocatoria del catalogo de
//                                     la hoja de Google (no se puede borrar el
//                                     renglon de la hoja desde aqui; solo se
//                                     deja de mostrar en la pagina publica).
//   ?origen=restaurar&nombre=<texto> -> quita el ocultamiento anterior.
export async function DELETE(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const origen = searchParams.get('origen');
    const db = getAdminDb();

    if (origen === 'extra') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      await db.collection('convocatorias_extra').doc(id).delete();
      return NextResponse.json({ ok: true });
    }

    if (origen === 'sheet') {
      const nombre = searchParams.get('nombre');
      if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
      const idNorm = norm(nombre);
      if (!idNorm) return NextResponse.json({ error: 'Nombre invalido.' }, { status: 400 });
      await db.collection('convocatorias_ocultas').doc(idNorm).set({
        nombre,
        ocultaEn: new Date().toISOString(),
        ocultaPor: guard.uid,
      });
      return NextResponse.json({ ok: true });
    }

    if (origen === 'restaurar') {
      const nombre = searchParams.get('nombre');
      if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
      const idNorm = norm(nombre);
      await db.collection('convocatorias_ocultas').doc(idNorm).delete();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'origen invalido (usa extra, sheet o restaurar).' }, { status: 400 });
  } catch (err) {
    console.error('[admin/convocatorias] DELETE error', err);
    return NextResponse.json({ error: 'No se pudo completar la accion.' }, { status: 500 });
  }
}

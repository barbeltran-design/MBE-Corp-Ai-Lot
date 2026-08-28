// Dispatcher central de notificaciones (Fase 1: solo email vía Resend).
// Uso: await enviarNotificacion(uid, 'reunionB2B', { asunto, mensajeHtml });
//
// Lee las preferencias del usuario en notificationPreferences/{uid}. Si no
// existen (usuario nunca configuró nada), se asume: email activado, digest
// semanal activado, todas las categorías activas — opt-out, no opt-in, para
// que nadie deje de recibir alertas por no haber entrado a configurarlas.
//
// WhatsApp y SMS quedan como no-op documentado (Fase 3/4): si el usuario
// tiene el canal activado pero no está implementado, se registra en el log
// como 'omitido' en vez de fallar silenciosamente.

import { Resend } from 'resend';
import { getAdminDb } from '@/lib/firebase-admin';
import type {
  NotificationPreferencesDoc,
  NotificationLogDoc,
  NotificacionCategoria,
  NotificacionHorarioDoc,
  NotificacionEstadoDoc,
  Language,
} from '@/types/firestore';

const DEFAULT_CATEGORIAS: Record<NotificacionCategoria, boolean> = {
  juntaClub: true,
  reunionB2B: true,
  referenciaAplicada: true,
  retoSemanal: true,
  actividadesVencen: true,
  nuevaConvocatoria: true,
  misionesPendientes: true,
  ranking: true,
  mentorReunionAgendada: true,
};

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'MBE Corpilot <notificaciones@mbe-ai-copilot.vercel.app>';

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

// ---------------------------------------------------------------------------
// Horario del digest semanal (Fase 2): un admin general elige día+hora+zona
// horaria desde /admin > Notificaciones. Como el plan gratuito de Vercel solo
// permite 1 disparo diario POR cron individual, vercel.json define 24 crons
// (uno por hora UTC) que llaman al mismo endpoint cada hora; esHoraDeEnviar()
// decide, en cada invocación, si "ahora" (evaluado en el timezone elegido)
// coincide con el día/hora que configuró el admin.
// ---------------------------------------------------------------------------

export const DEFAULT_HORARIO: NotificacionHorarioDoc = {
  diaSemana: 1, // lunes
  hora: 8,
  timezone: 'America/Mexico_City',
};

export async function obtenerHorarioDigest(): Promise<NotificacionHorarioDoc> {
  const db = getAdminDb();
  const snap = await db.collection('config').doc('notificaciones_horario').get();
  if (!snap.exists) return { ...DEFAULT_HORARIO };
  const data = snap.data() as Partial<NotificacionHorarioDoc>;
  return {
    diaSemana: typeof data.diaSemana === 'number' ? data.diaSemana : DEFAULT_HORARIO.diaSemana,
    hora: typeof data.hora === 'number' ? data.hora : DEFAULT_HORARIO.hora,
    timezone: typeof data.timezone === 'string' && data.timezone ? data.timezone : DEFAULT_HORARIO.timezone,
    actualizadoPor: data.actualizadoPor,
    actualizadoEn: data.actualizadoEn,
  };
}

export async function guardarHorarioDigest(
  horario: { diaSemana: number; hora: number; timezone: string },
  uid: string
): Promise<void> {
  const db = getAdminDb();
  await db.collection('config').doc('notificaciones_horario').set(
    {
      diaSemana: horario.diaSemana,
      hora: horario.hora,
      timezone: horario.timezone,
      actualizadoPor: uid,
      actualizadoEn: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * ¿"Ahora" coincide con el día/hora configurados, evaluados en el timezone
 * del horario? Se compara solo por hora exacta (sin minutos): Vercel
 * garantiza que un cron se dispara "dentro de la hora programada", no en el
 * minuto exacto, así que cualquier ejecución dentro de esa hora cuenta.
 */
export function esHoraDeEnviar(horario: NotificacionHorarioDoc, ahora: Date = new Date()): boolean {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: horario.timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(ahora);

  const weekdayStr = partes.find((p) => p.type === 'weekday')?.value ?? '';
  const horaStr = partes.find((p) => p.type === 'hour')?.value ?? '';

  const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const diaActual = DIAS[weekdayStr];
  let horaActual = parseInt(horaStr, 10);
  if (horaActual === 24) horaActual = 0; // Intl con hour12:false puede devolver "24" a medianoche

  return diaActual === horario.diaSemana && horaActual === horario.hora;
}

/**
 * Evita reenviar el digest si el chequeo horario (cada hora, ver vercel.json)
 * coincide más de una vez con el horario configurado — por ejemplo si Vercel
 * reintenta la invocación o dos de los 24 crons horarios se solapan cerca de
 * un cambio de hora. Se considera "ya enviado" si el último envío exitoso
 * ocurrió hace menos de 6 días (deja margen frente al intervalo semanal real
 * de 7 días, sin depender de cálculos de número de semana ISO que se
 * complican en cambios de año).
 */
export async function yaEnviadoRecientemente(): Promise<boolean> {
  const db = getAdminDb();
  const snap = await db.collection('config').doc('notificaciones_estado').get();
  if (!snap.exists) return false;
  const data = snap.data() as Partial<NotificacionEstadoDoc>;
  if (!data.ultimoEnvioEn) return false;
  const ultimo = new Date(data.ultimoEnvioEn).getTime();
  if (Number.isNaN(ultimo)) return false;
  const SEIS_DIAS_MS = 6 * 24 * 60 * 60 * 1000;
  return Date.now() - ultimo < SEIS_DIAS_MS;
}

export async function marcarEnviado(): Promise<void> {
  const db = getAdminDb();
  await db.collection('config').doc('notificaciones_estado').set(
    { ultimoEnvioEn: new Date().toISOString() },
    { merge: true }
  );
}

export interface NotificacionPayload {
  asunto: string;
  mensajeHtml: string;
  mensajeTexto?: string; // fallback plano; si no se da, se deriva del html
}

async function obtenerPreferencias(uid: string): Promise<NotificationPreferencesDoc> {
  const db = getAdminDb();
  const snap = await db.collection('notificationPreferences').doc(uid).get();
  if (!snap.exists) {
    return {
      uid,
      canales: { email: true, sms: false, whatsapp: false },
      digestSemanal: true,
      categoriasActivas: { ...DEFAULT_CATEGORIAS },
    };
  }
  const data = snap.data() as Partial<NotificationPreferencesDoc>;
  return {
    uid,
    canales: {
      email: data.canales?.email ?? true,
      sms: data.canales?.sms ?? false,
      whatsapp: data.canales?.whatsapp ?? false,
    },
    telefonoWhatsapp: data.telefonoWhatsapp,
    digestSemanal: data.digestSemanal ?? true,
    categoriasActivas: { ...DEFAULT_CATEGORIAS, ...(data.categoriasActivas ?? {}) },
    horaPreferida: data.horaPreferida,
    updatedAt: data.updatedAt,
  };
}

async function registrarLog(entry: Omit<NotificationLogDoc, 'id'>): Promise<void> {
  const db = getAdminDb();
  await db.collection('notificationLog').add(entry);
}

/**
 * Envía una notificación a un usuario respetando sus preferencias.
 * disparadoPor distingue el digest semanal (lunes) de un evento inmediato
 * (reunión B2B, referencia aplicada, mentor agendado, etc.).
 */
export async function enviarNotificacion(
  uid: string,
  categoria: NotificacionCategoria,
  payload: NotificacionPayload,
  disparadoPor: 'digest_semanal' | 'evento' = 'evento'
): Promise<void> {
  const prefs = await obtenerPreferencias(uid);

  if (!prefs.categoriasActivas[categoria]) {
    await registrarLog({
      uid,
      categoria,
      canal: 'email',
      estatus: 'omitido',
      disparadoPor,
      contenidoResumen: `Categoría desactivada por el usuario: ${payload.asunto}`,
      enviadoEn: new Date().toISOString(),
    });
    return;
  }

  if (prefs.canales.email) {
    await enviarPorEmail(uid, categoria, payload, disparadoPor);
  }
  if (prefs.canales.whatsapp) {
    await registrarLog({
      uid,
      categoria,
      canal: 'whatsapp',
      estatus: 'omitido',
      disparadoPor,
      contenidoResumen: `WhatsApp aún no implementado (Fase 3): ${payload.asunto}`,
      enviadoEn: new Date().toISOString(),
    });
  }
  if (prefs.canales.sms) {
    await registrarLog({
      uid,
      categoria,
      canal: 'sms',
      estatus: 'omitido',
      disparadoPor,
      contenidoResumen: `SMS aún no implementado (Fase 4): ${payload.asunto}`,
      enviadoEn: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Digest semanal (lunes): UNA sola llamada a Resend por usuario que combina
// todas las secciones activas, en vez de una notificación separada por
// categoría (evita mandar 6 correos el mismo día). Cada sección se filtra por
// categoriasActivas y se registra su propio NotificationLogDoc para conservar
// trazabilidad por categoría, aunque el envío físico sea uno solo.
// ---------------------------------------------------------------------------

export interface SeccionDigest {
  categoria: NotificacionCategoria; // qué preferencia gobierna esta sección
  tituloHtml: string; // ej. '<h3>📅 Tu junta de esta semana</h3>'
  contenidoHtml: string; // cuerpo de la sección (párrafo, lista, etc.)
  resumenTexto: string; // para el log (una línea, sin HTML)
}

function construirHtmlDigest(secciones: SeccionDigest[], lang: Language): string {
  const bloques = secciones.map((s) => `${s.tituloHtml}${s.contenidoHtml}`).join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">');
  const titulo = lang === 'en' ? 'Your weekly summary — MBE Corpilot' : 'Tu resumen semanal — MBE Corpilot';
  const pie =
    lang === 'en'
      ? 'You can adjust what you receive in Profile &gt; Notification preferences.'
      : 'Puedes ajustar qué recibes en Perfil &gt; Preferencias de notificaciones.';
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <h2 style="color:#0f172a;">${titulo}</h2>
      ${bloques}
      <p style="margin-top:24px;font-size:12px;color:#6b7280;">
        ${pie}
      </p>
    </div>
  `;
}

/**
 * Envía el digest semanal de un usuario combinando en un solo correo las
 * secciones que le corresponden. Secciones vacías (sin contenido para ese
 * usuario) simplemente no se pasan — esta función no decide qué mostrar,
 * solo filtra por preferencias y arma/envía el correo.
 */
export async function enviarDigestSemanal(uid: string, secciones: SeccionDigest[], lang: Language = 'es'): Promise<void> {
  if (secciones.length === 0) return; // nada que reportar esta semana para este usuario

  const prefs = await obtenerPreferencias(uid);
  const ahora = new Date().toISOString();

  if (!prefs.digestSemanal) {
    await registrarLog({
      uid,
      categoria: secciones[0].categoria,
      canal: 'email',
      estatus: 'omitido',
      disparadoPor: 'digest_semanal',
      contenidoResumen: 'Digest semanal desactivado por el usuario',
      enviadoEn: ahora,
    });
    return;
  }

  const activas = secciones.filter((s) => prefs.categoriasActivas[s.categoria]);
  if (activas.length === 0) {
    await registrarLog({
      uid,
      categoria: secciones[0].categoria,
      canal: 'email',
      estatus: 'omitido',
      disparadoPor: 'digest_semanal',
      contenidoResumen: 'Todas las categorías del digest estaban desactivadas por el usuario',
      enviadoEn: ahora,
    });
    return;
  }

  if (!prefs.canales.email) {
    for (const s of activas) {
      await registrarLog({
        uid,
        categoria: s.categoria,
        canal: 'email',
        estatus: 'omitido',
        disparadoPor: 'digest_semanal',
        contenidoResumen: `Canal email desactivado: ${s.resumenTexto}`,
        enviadoEn: ahora,
      });
    }
    return;
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  const email = (userSnap.data()?.email as string) || '';
  const resend = getResend();

  if (!resend || !email) {
    for (const s of activas) {
      await registrarLog({
        uid,
        categoria: s.categoria,
        canal: 'email',
        estatus: 'fallido',
        disparadoPor: 'digest_semanal',
        contenidoResumen: !resend ? 'RESEND_API_KEY no configurada en el entorno' : `Usuario ${uid} sin email registrado`,
        enviadoEn: ahora,
      });
    }
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Your weekly summary — MBE Corpilot' : 'Tu resumen semanal — MBE Corpilot',
      html: construirHtmlDigest(activas, lang),
    });
    for (const s of activas) {
      await registrarLog({
        uid,
        categoria: s.categoria,
        canal: 'email',
        estatus: 'enviado',
        disparadoPor: 'digest_semanal',
        contenidoResumen: s.resumenTexto,
        enviadoEn: ahora,
      });
    }
  } catch (err) {
    console.error('[notificaciones] error enviando digest semanal', err);
    for (const s of activas) {
      await registrarLog({
        uid,
        categoria: s.categoria,
        canal: 'email',
        estatus: 'fallido',
        disparadoPor: 'digest_semanal',
        contenidoResumen: `Error Resend: ${(err as Error).message}`,
        enviadoEn: ahora,
      });
    }
  }
}

async function enviarPorEmail(
  uid: string,
  categoria: NotificacionCategoria,
  payload: NotificacionPayload,
  disparadoPor: 'digest_semanal' | 'evento'
): Promise<void> {
  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  const email = (userSnap.data()?.email as string) || '';

  const resend = getResend();
  if (!resend || !email) {
    await registrarLog({
      uid,
      categoria,
      canal: 'email',
      estatus: 'fallido',
      disparadoPor,
      contenidoResumen: !resend
        ? 'RESEND_API_KEY no configurada en el entorno'
        : `Usuario ${uid} sin email registrado`,
      enviadoEn: new Date().toISOString(),
    });
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: payload.asunto,
      html: payload.mensajeHtml,
      text: payload.mensajeTexto,
    });
    await registrarLog({
      uid,
      categoria,
      canal: 'email',
      estatus: 'enviado',
      disparadoPor,
      contenidoResumen: payload.asunto,
      enviadoEn: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[notificaciones] error enviando email', err);
    await registrarLog({
      uid,
      categoria,
      canal: 'email',
      estatus: 'fallido',
      disparadoPor,
      contenidoResumen: `Error Resend: ${(err as Error).message}`,
      enviadoEn: new Date().toISOString(),
    });
  }
}

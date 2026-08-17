// Acceso a Mundos Premium y permisos relacionados con el nivel de comunidad /
// certificación. Centraliza la lógica para que la API y los componentes de
// cliente usen la misma regla.
//
// Umbral confirmado con el usuario: "empresario_orquesta" ("Empresario
// Orquesta", 500 pts en NIVELES_COMUNIDAD, src/lib/refplace.ts). Es el mismo
// nivel que ya desbloquea "solicitar referencias" (puedeSolicitarReferencias
// en refplace.ts), así que crear noticias queda alineado con ese precedente.
import { NIVELES_COMUNIDAD, nivelIndex } from '@/lib/refplace';

export const NIVEL_MINIMO_NOTICIAS: string = 'empresario_orquesta';

/**
 * Un usuario tiene acceso a los Mundos Premium si:
 *  - es administrador (rol 'admin'), o
 *  - tiene una suscripción activa (subscription 'pro'/'active'/'premium' con
 *    planStatus 'active'), o
 *  - un administrador le otorgó acceso manual (accesoManualPremium === true).
 */
export function esUsuarioPremium(u: {
  roles?: string[] | null;
  subscription?: string | null;
  planStatus?: string | null;
  // Solo relevante cuando planStatus === 'pending_cancellation': fecha (ISO)
  // hasta la que el usuario conserva el acceso pro tras cancelar (ver
  // planCancelaEn en src/types/firestore.ts). Después de esa fecha ya no es
  // premium, aunque el registro en Firestore todavía no se haya actualizado.
  planCancelaEn?: string | null;
  accesoManualPremium?: boolean | null;
}): boolean {
  if (Array.isArray(u.roles) && u.roles.includes('admin')) return true;
  if (u.accesoManualPremium === true) return true;
  const sub = u.subscription ?? '';
  const activa = ['pro', 'active', 'premium'].includes(sub);
  if (!activa) return false;
  if (u.planStatus === 'active' || !u.planStatus) return true;
  if (u.planStatus === 'pending_cancellation' && u.planCancelaEn) {
    const finGracia = new Date(u.planCancelaEn).getTime();
    if (!Number.isNaN(finGracia) && finGracia > Date.now()) return true;
  }
  return false;
}

// Suma un mes (calendario) a una fecha ISO, respetando fin de mes (ej. 31 de
// enero + 1 mes = 28/29 de febrero, no "3 de marzo" como haría un
// setMonth() ingenuo). Se usa para calcular hasta cuándo queda pagado el
// plan cuando alguien cancela su suscripción — ver cancelar-suscripcion y el
// webhook de Mercado Pago.
export function sumarUnMes(fechaIso: string): string {
  const original = new Date(fechaIso);
  if (Number.isNaN(original.getTime())) return fechaIso;
  const diaOriginal = original.getDate();
  const d = new Date(original.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const ultimoDiaDelMesDestino = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDiaDelMesDestino));
  return d.toISOString();
}

/**
 * Un usuario puede crear noticias de comunidad si:
 *  - es administrador, o
 *  - su nivelComunidad es NIVEL_MINIMO_NOTICIAS o superior, o
 *  - tiene certificado === true.
 */
export function puedeCrearNoticias(u: {
  roles?: string[] | null;
  nivelComunidad?: string | null;
  certificado?: boolean | null;
}): boolean {
  if (Array.isArray(u.roles) && u.roles.includes('admin')) return true;
  if (u.certificado === true) return true;
  if (u.nivelComunidad && nivelIndex(u.nivelComunidad) >= nivelIndex(NIVEL_MINIMO_NOTICIAS)) return true;
  return false;
}

export function nivelMinimoNoticiasLabel(lang: 'es' | 'en'): string {
  const n = NIVELES_COMUNIDAD.find((x) => x.id === NIVEL_MINIMO_NOTICIAS);
  return n ? (lang === 'en' ? n.en : n.es) : NIVEL_MINIMO_NOTICIAS;
}

/**
 * Info completa (id + es + en) del nivel mínimo para crear noticias, lista
 * para exponer en una respuesta de API sin duplicar la búsqueda en cada ruta.
 */
export function nivelMinimoNoticiasInfo(): { id: string; es: string; en: string } | null {
  const n = NIVELES_COMUNIDAD.find((x) => x.id === NIVEL_MINIMO_NOTICIAS);
  return n ? { id: n.id, es: n.es, en: n.en } : null;
}

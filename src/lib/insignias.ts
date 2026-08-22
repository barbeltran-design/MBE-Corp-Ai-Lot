// Catálogo mínimo de insignias de Mundos MBE. Se calculan a partir del
// progreso que ya devuelve /api/worlds (yo: {partida, tablero, premium}) — no
// requiere una colección nueva. Cuando el usuario alcanza una insignia nueva
// (comparado contra lo que ya vio, guardado en localStorage), el cliente
// muestra una celebración — ver src/components/worlds/InsigniaCelebracion.tsx.
export interface InsigniaDef {
  id: string;
  es: string;
  en: string;
  descEs: string;
  descEn: string;
  icon: string;
}

export const INSIGNIAS: InsigniaDef[] = [
  {
    id: 'diagnostico_completo',
    es: 'Diagnóstico Completo',
    en: 'Assessment Completed',
    descEs: 'Completaste tu Diagnóstico de Madurez de los 11 temas.',
    descEn: 'You completed your 11-topic Maturity Assessment.',
    icon: '🧭',
  },
  {
    id: 'caminante',
    es: 'Caminante',
    en: 'Wayfarer',
    descEs: 'Completaste el Mundo de Partida.',
    descEn: 'You completed the Starting World.',
    icon: '🥾',
  },
  {
    id: 'tablero_desbloqueado',
    es: 'Tablero Desbloqueado',
    en: 'Board Unlocked',
    descEs: 'Desbloqueaste el Tablero de Retos.',
    descEn: 'You unlocked the Challenges Board.',
    icon: '🎯',
  },
  {
    id: 'miembro_premium',
    es: 'Miembro Premium',
    en: 'Premium Member',
    descEs: 'Tienes acceso a los Mundos Premium.',
    descEn: 'You have access to the Premium Worlds.',
    icon: '👑',
  },
];

export function insigniaPorId(id: string): InsigniaDef | undefined {
  return INSIGNIAS.find((i) => i.id === id);
}

/** Insignias que el progreso actual ya cumple, por id. */
export function insigniasGanadas(yo: { partida: number[]; tablero: boolean; premium?: boolean }): string[] {
  const ids: string[] = [];
  if (Array.isArray(yo.partida) && yo.partida.length >= 2) ids.push('caminante');
  if (yo.tablero === true) ids.push('tablero_desbloqueado');
  if (yo.premium === true) ids.push('miembro_premium');
  return ids;
}

function storageKey(uid: string): string {
  return `mbe_insignias_vistas_${uid}`;
}

/** Lee del localStorage qué insignias ya se le celebraron a este uid. */
export function insigniasVistas(uid: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function marcarInsigniasVistas(uid: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(ids));
  } catch {
    /* almacenamiento no disponible; no es crítico */
  }
}

/**
 * Compara las insignias ganadas contra las ya vistas y devuelve las nuevas
 * (sin marcarlas todavía como vistas — eso lo hace el componente después de
 * mostrar la celebración, para no perder la notificación si el usuario
 * recarga a mitad de la animación).
 */
export function insigniasNuevas(uid: string, yo: { partida: number[]; tablero: boolean; premium?: boolean }): string[] {
  const ganadas = insigniasGanadas(yo);
  const vistas = new Set(insigniasVistas(uid));
  return ganadas.filter((id) => !vistas.has(id));
}

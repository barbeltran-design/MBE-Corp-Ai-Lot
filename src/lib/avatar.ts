// Utilidades compartidas para el avatar del usuario (iniciales + color).
// El color se guarda en Firestore como un índice numérico (avatarColor),
// así no depende de Storage ni de URLs externas. Se usan colores hex con
// style inline para que siempre se rendericen (las clases de Tailwind
// pueden no generarse si no aparecen en archivos escaneados).

export const AVATAR_COLORS = [
  '#4f46e5', // indigo
  '#059669', // emerald
  '#f59e0b', // amber
  '#e11d48', // rose
  '#0284c7', // sky
  '#7c3aed', // violet
  '#0d9488', // teal
  '#475569', // slate
] as const;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : '';
  const second = parts.length > 1 ? parts[1][0] : '';
  return (first + second).toUpperCase() || '?';
}

export function avatarBgColor(colorIndex: number | undefined): string {
  const i = typeof colorIndex === 'number' && isFinite(colorIndex) ? colorIndex : 0;
  return AVATAR_COLORS[Math.abs(Math.trunc(i)) % AVATAR_COLORS.length];
}

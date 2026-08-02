// Utilidades compartidas para el avatar del usuario (iniciales + color).
// El color se guarda en Firestore como un índice numérico (avatarColor),
// así no depende de Storage ni de URLs externas.

export const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-rose-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-slate-600',
] as const;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : '';
  const second = parts.length > 1 ? parts[1][0] : '';
  return (first + second).toUpperCase() || '?';
}

export function avatarBgClass(colorIndex: number | undefined): string {
  const i = typeof colorIndex === 'number' && isFinite(colorIndex) ? colorIndex : 0;
  return AVATAR_COLORS[Math.abs(Math.trunc(i)) % AVATAR_COLORS.length];
}

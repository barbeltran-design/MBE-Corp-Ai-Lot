// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const locales = ['es', 'en'] as const;
export const defaultLocale = 'es' as const;

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Opcional: si quieres que la URL por defecto no tenga el prefijo /es
  // localePrefix: 'as-needed'
});

// Exporta los helpers de navegación para usarlos en tus componentes.
// `createSharedPathnamesNavigation` fue eliminado en next-intl v4; el
// reemplazo es `createNavigation`, que recibe el mismo objeto `routing`
// de `defineRouting` y expone el mismo set de helpers (más `getPathname`
// y `permanentRedirect`, no usados aquí).
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

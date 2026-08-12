import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Skip Next internals, API routes and static files
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};

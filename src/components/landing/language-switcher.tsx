'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { locales, localeFlags, localeNames, type Locale } from '@/i18n/config';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const rest = pathname.split('/').slice(2).join('/');
    const qs = typeof window !== 'undefined' ? window.location.search : '';
    router.push(`/${next}/${rest}${qs}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-sm">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            l === locale ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
          aria-label={localeNames[l]}
        >
          {localeFlags[l]} {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

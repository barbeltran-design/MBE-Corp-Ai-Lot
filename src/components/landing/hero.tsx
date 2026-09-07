import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

export function Hero() {
  const t = useTranslations('landing.hero');

  return (
    <div className="max-w-xl rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-md sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <Sparkles className="h-3.5 w-3.5" />
        {t('eyebrow')}
      </span>
      <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        {t('title')}
      </h1>
      <p className="mt-5 whitespace-pre-line text-lg text-slate-600">
        {t.rich('subtitle', { b: (chunks) => <strong className="font-semibold text-slate-900">{chunks}</strong> })}
      </p>
    </div>
  );
}

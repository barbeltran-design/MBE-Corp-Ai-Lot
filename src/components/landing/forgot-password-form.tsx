'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendPasswordReset } from '@/lib/auth';

/**
 * Formulario de recuperación de contraseña. Por diseño (ver sendPasswordReset
 * en src/lib/auth.ts) SIEMPRE muestra el mismo mensaje de éxito, exista o no
 * una cuenta con ese correo — así nadie puede usar este formulario para
 * averiguar qué correos están registrados en la plataforma.
 */
const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const t = useTranslations('forgotPassword');
  const locale = useLocale();
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      await sendPasswordReset(values.email);
      // Siempre mostramos éxito, exista o no la cuenta (ver comentario arriba).
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setServerError(code === 'auth/invalid-email' ? t('errors.invalidEmail') : t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
      <h2 className="text-xl font-semibold text-slate-900">{t('title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      {sent ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {t('successMessage')}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input id="email" type="email" placeholder={t('fields.emailPlaceholder')} {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{t('errors.invalidEmail')}</p>}
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        <a href={`/${locale}/login`} className="text-primary underline">
          {t('backToLoginLink')}
        </a>
      </p>
    </div>
  );
}

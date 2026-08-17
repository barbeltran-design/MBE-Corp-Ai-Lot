'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithEmail, signInWithGoogle, mapAuthErrorToMessageKey } from '@/lib/auth';

/**
 * Pantalla de inicio de sesión (login) para usuarios que YA se registraron.
 * A diferencia de RegisterForm, este formulario nunca crea cuentas nuevas:
 * signInWithEmail() y signInWithGoogle() (src/lib/auth.ts) están diseñadas
 * a propósito para rechazar el intento si la cuenta no existe, en vez de
 * crearla sin pasar por el consentimiento legal del registro.
 */
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const t = useTranslations('login');
  const locale = useLocale();
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [googleSubmitting, setGoogleSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      await signInWithEmail(values.email, values.password);
      router.push(`/${locale}/perfil`);
    } catch (err) {
      setServerError(t(`errors.${mapAuthErrorToMessageKey(err)}`));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleClick() {
    setGoogleSubmitting(true);
    setServerError(null);
    try {
      await signInWithGoogle();
      router.push(`/${locale}/perfil`);
    } catch (err) {
      setServerError(t(`errors.${mapAuthErrorToMessageKey(err)}`));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
      <h2 className="text-xl font-semibold text-slate-900">{t('title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full"
        onClick={onGoogleClick}
        disabled={googleSubmitting}
      >
        {googleSubmitting ? t('submitting') : t('googleCta')}
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        {t('orDivider')}
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">{t('fields.email')}</Label>
          <Input id="email" type="email" placeholder={t('fields.emailPlaceholder')} {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{t('errors.invalidEmail')}</p>}
        </div>

        <div>
          <Label htmlFor="password">{t('fields.password')}</Label>
          <Input id="password" type="password" {...register('password')} />
          {errors.password && <p className="mt-1 text-xs text-red-600">{t('errors.required')}</p>}
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <div className="flex justify-end">
          <a href={`/${locale}/recuperar-contrasena`} className="text-xs text-primary underline">
            {t('forgotPasswordLink')}
          </a>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        {t('noAccountPrefix')}{' '}
        <a href={`/${locale}`} className="text-primary underline">
          {t('registerLink')}
        </a>
      </p>
    </div>
  );
}

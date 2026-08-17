"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";

/**
 * Bloque de consentimiento legal (Términos de Uso + Aviso de Privacidad),
 * incluyendo el flujo de consentimiento de tutor para menores de edad.
 *
 * CÓMO USARLO (3 pasos):
 *
 * 1) Tu formulario de registro debe estar envuelto en <FormProvider {...methods}>
 *    (react-hook-form). Si ya usas useForm() + handleSubmit, casi seguro ya
 *    tienes esto o es muy fácil agregarlo.
 *
 * 2) Combina `legalConsentSchema` con tu esquema de zod existente y agrega
 *    la validación de menores con `.superRefine(legalConsentRefine)`:
 *
 *      const formSchema = tuEsquemaDeRegistroExistente
 *        .merge(legalConsentSchema)
 *        .superRefine(legalConsentRefine);
 *
 * 3) Coloca <LegalConsentSection /> dentro de tu <form>, justo antes del
 *    botón de enviar.
 *
 * Valores por defecto recomendados al inicializar el formulario:
 *   acceptedTerms: false, isMinor: false, guardianName: "", guardianEmail: "", guardianConsent: false
 */

export const legalConsentSchema = z.object({
  acceptedTerms: z.literal(true, {
    message: "Debes aceptar los Términos de Uso y el Aviso de Privacidad.",
  }),
  isMinor: z.boolean().default(false),
  guardianName: z.string().optional(),
  guardianEmail: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo del tutor inválido.",
    }),
  guardianConsent: z.boolean().optional(),
});

export function legalConsentRefine(data: any, ctx: z.RefinementCtx) {
  if (data.isMinor) {
    if (!data.guardianName || data.guardianName.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianName"],
        message: "Escribe el nombre completo del padre, madre o tutor.",
      });
    }
    if (!data.guardianEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianEmail"],
        message: "Escribe el correo del padre, madre o tutor.",
      });
    }
    if (!data.guardianConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianConsent"],
        message: "El padre, madre o tutor debe aceptar en representación del menor.",
      });
    }
  }
}

const TEXT = {
  es: {
    termsLabel: "Términos de Uso",
    privacyLabel: "Aviso de Privacidad",
    acceptPrefix: "He leído y acepto los",
    acceptJoin: "y el",
    minorLabel: "Quien se está registrando es menor de edad",
    guardianTitle: "Datos del padre, madre o tutor legal",
    guardianName: "Nombre completo del padre, madre o tutor",
    guardianEmail: "Correo electrónico del padre, madre o tutor",
    guardianConsent:
      "Yo, como padre, madre o tutor legal, acepto los Términos de Uso y el Aviso de Privacidad en representación del menor y asumo la responsabilidad de su uso de la plataforma.",
  },
  en: {
    termsLabel: "Terms of Use",
    privacyLabel: "Privacy Notice",
    acceptPrefix: "I have read and accept the",
    acceptJoin: "and the",
    minorLabel: "The person registering is a minor",
    guardianTitle: "Parent or legal guardian information",
    guardianName: "Full name of parent or guardian",
    guardianEmail: "Email of parent or guardian",
    guardianConsent:
      "As parent or legal guardian, I accept the Terms of Use and Privacy Notice on behalf of the minor and take responsibility for their use of the platform.",
  },
} as const;

export function LegalConsentSection() {
  const rawLocale = useLocale();
  const locale = (rawLocale === "en" ? "en" : "es") as "es" | "en";
  const t = TEXT[locale];

  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  const isMinor = watch("isMinor");

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <Controller
        name="acceptedTerms"
        control={control}
        render={({ field }) => (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              className="mt-1"
            />
            <span>
              {t.acceptPrefix}{" "}
              <Link href={`/${locale}/legal/terminos`} target="_blank" className="underline">
                {t.termsLabel}
              </Link>{" "}
              {t.acceptJoin}{" "}
              <Link href={`/${locale}/legal/privacidad`} target="_blank" className="underline">
                {t.privacyLabel}
              </Link>{" "}
              de MBE AI Copilot.
            </span>
          </label>
        )}
      />
      {errors.acceptedTerms && (
        <p className="text-sm text-red-600">{String(errors.acceptedTerms.message)}</p>
      )}

      <Controller
        name="isMinor"
        control={control}
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
            <span>{t.minorLabel}</span>
          </label>
        )}
      />

      {isMinor && (
        <div className="space-y-3 rounded-md bg-gray-50 p-3">
          <p className="text-sm font-medium">{t.guardianTitle}</p>

          <Controller
            name="guardianName"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                placeholder={t.guardianName}
                className="w-full rounded border border-gray-300 p-2 text-sm"
              />
            )}
          />
          {errors.guardianName && (
            <p className="text-sm text-red-600">{String(errors.guardianName.message)}</p>
          )}

          <Controller
            name="guardianEmail"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="email"
                placeholder={t.guardianEmail}
                className="w-full rounded border border-gray-300 p-2 text-sm"
              />
            )}
          />
          {errors.guardianEmail && (
            <p className="text-sm text-red-600">{String(errors.guardianEmail.message)}</p>
          )}

          <Controller
            name="guardianConsent"
            control={control}
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-1"
                />
                <span>{t.guardianConsent}</span>
              </label>
            )}
          />
          {errors.guardianConsent && (
            <p className="text-sm text-red-600">{String(errors.guardianConsent.message)}</p>
          )}
        </div>
      )}
    </div>
  );
}

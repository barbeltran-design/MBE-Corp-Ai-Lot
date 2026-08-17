import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Página pública: /[locale]/legal/privacidad
 * Muestra el Aviso de Privacidad / Privacy Notice según el idioma de la URL.
 * Redactado conforme a la Ley Federal de Protección de Datos Personales en
 * Posesión de los Particulares (DOF 20-mar-2025, en vigor desde 21-mar-2025).
 * Enlazada desde el checkbox de consentimiento en register-form.tsx.
 */

export const metadata: Metadata = {
  title: 'Aviso de Privacidad | MBE AI Copilot',
};

const ES_SECTIONS: { h: string; p: string[]; list?: string[] }[] = [
  {
    h: '1. Identidad y domicilio del Responsable',
    p: [
      'Baruch Alfredo Beltrán Suárez, RFC BESB760722FR0 (el "Responsable"), es responsable del tratamiento de sus datos personales conforme a este Aviso de Privacidad.',
      'Nota: el domicilio físico del Responsable se agregará a este Aviso antes de su publicación definitiva, conforme lo exige la ley.',
    ],
  },
  {
    h: '2. Datos personales que recabamos',
    p: ['Recabamos las siguientes categorías de datos:'],
    list: [
      'Datos de identificación y contacto: nombre, correo electrónico, teléfono.',
      'Datos de la empresa o negocio del Usuario: giro de negocio, número de personas que la integran, ingresos, utilidades, costos, nivel de madurez del negocio e información estratégica proporcionada voluntariamente para fines de diagnóstico y mentoría.',
      'Datos de pago: los datos de tarjeta o cuenta son capturados directamente por MercadoPago; el Responsable únicamente recibe confirmación de la transacción, monto y estatus del pago, no los datos completos de la tarjeta.',
      'Datos de uso de la plataforma: interacciones con la herramienta, contenidos consultados, progreso en programas o talleres.',
      'Datos de menores de edad y de su tutor, cuando aplique (ver Sección 8).',
    ],
  },
  {
    h: '3. Datos financieros y aclaración sobre datos sensibles',
    p: [
      'Los datos financieros y de negocio (ingresos, utilidades, costos, etc.) descritos arriba tienen naturaleza patrimonial/comercial. Conforme al Artículo 3 de la ley, los "datos personales sensibles" son únicamente aquellos referentes a origen racial o étnico, estado de salud, información genética, creencias religiosas, filosóficas o morales, afiliación sindical, opiniones políticas y preferencia sexual. Los datos financieros de su negocio no se consideran datos sensibles bajo esta definición, pero son tratados con las mismas medidas de seguridad administrativas, técnicas y físicas que el resto de sus datos.',
    ],
  },
  {
    h: '4. Finalidades del tratamiento',
    p: ['Sus datos se utilizan para las siguientes finalidades:'],
    list: [
      'Primarias (necesarias para el servicio): crear y administrar su cuenta; brindar el servicio de mentoría, diagnóstico y acompañamiento; procesar pagos y facturación; dar soporte y atender solicitudes.',
      'Secundarias (requieren su consentimiento, opcionales): enviarle boletines, invitaciones a convocatorias internacionales alineadas a los ODS, y comunicaciones de mercadotecnia sobre nuevos servicios. Usted puede oponerse a estas finalidades en cualquier momento sin que ello afecte el servicio principal contratado.',
    ],
  },
  {
    h: '5. Fundamento y tipo de consentimiento',
    p: [
      'El tratamiento de sus datos para las finalidades primarias se basa en la relación jurídica que usted establece con el Responsable al registrarse y usar la plataforma (consentimiento tácito, válido conforme a la ley salvo que se requiera consentimiento expreso).',
      'Para el tratamiento de datos de menores de edad y para las finalidades secundarias de mercadotecnia, se requiere su consentimiento expreso, mismo que se recaba mediante casillas de verificación (checkbox) específicas al momento del registro, separadas de la aceptación general de este Aviso.',
    ],
  },
  {
    h: '6. Transferencias de datos',
    p: [
      'Sus datos de pago se comparten con MercadoPago (u otro proveedor de pagos habilitado) únicamente para procesar la transacción. Podemos compartir datos con proveedores de infraestructura tecnológica (por ejemplo, servicios de hospedaje y de inteligencia artificial) estrictamente necesarios para operar la plataforma, quienes están obligados contractualmente a proteger sus datos y no usarlos para fines distintos a los aquí señalados.',
      'No vendemos ni compartimos sus datos personales con terceros para fines de mercadotecnia ajenos a MBE AI Copilot.',
    ],
  },
  {
    h: '7. Plazo de conservación',
    p: [
      'Sus datos se conservarán mientras mantenga una cuenta activa y, posteriormente, durante el plazo necesario para cumplir obligaciones legales, fiscales o contables aplicables. Una vez cumplido dicho plazo, sus datos serán bloqueados y, en su momento, suprimidos conforme al procedimiento que establece la ley.',
    ],
  },
  {
    h: '8. Menores de edad y consentimiento del tutor',
    p: [
      'MBE AI Copilot permite el registro de menores de edad únicamente cuando su padre, madre o tutor legal proporciona su propio nombre, correo electrónico y acepta expresamente este Aviso de Privacidad y los Términos de Uso en representación del menor. El tutor es responsable de supervisar el uso que el menor haga de la plataforma.',
    ],
  },
  {
    h: '9. Derechos ARCO y cómo ejercerlos',
    p: [
      'Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse ("derechos ARCO") al tratamiento de sus datos personales, así como a revocar su consentimiento en cualquier momento.',
      'Para ejercer estos derechos, envíe su solicitud a: atencion@mbecorp.org, indicando: (a) su nombre completo y datos de contacto; (b) el derecho específico que desea ejercer; (c) una descripción clara de los datos sobre los que desea ejercer el derecho; y (d) cualquier documento que facilite localizar sus datos. Si actúa en representación de otra persona (por ejemplo, como tutor de un menor), deberá acreditar dicha representación.',
      'Responderemos su solicitud dentro de los plazos que establece la ley.',
    ],
  },
  {
    h: '10. Autoridad competente',
    p: [
      'A partir del 21 de marzo de 2025, las funciones de autoridad en materia de protección de datos personales que anteriormente correspondían al INAI (disuelto en esa fecha) fueron asumidas por la Secretaría Anticorrupción y Buen Gobierno (SABG). Si considera que sus derechos no fueron atendidos adecuadamente, puede acudir ante dicha autoridad. El Reglamento de la nueva ley aún no ha sido publicado a la fecha de este Aviso, por lo que los procedimientos específicos ante la autoridad podrían actualizarse.',
    ],
  },
  {
    h: '11. Cambios a este Aviso de Privacidad',
    p: [
      'Este Aviso podrá actualizarse para reflejar cambios legislativos, operativos o de negocio. La versión vigente estará siempre disponible en esta misma página, indicando su fecha de última actualización.',
    ],
  },
];

const EN_SECTIONS: { h: string; p: string[]; list?: string[] }[] = [
  {
    h: '1. Identity and Address of the Controller',
    p: [
      'Baruch Alfredo Beltrán Suárez, RFC BESB760722FR0 (the "Controller"), is responsible for the processing of your personal data under this Privacy Notice.',
      "Note: the Controller's physical address will be added to this Notice before its final publication, as required by law.",
    ],
  },
  {
    h: '2. Personal Data We Collect',
    p: ['We collect the following categories of data:'],
    list: [
      'Identification and contact data: name, email address, phone number.',
      'Business data: business sector, number of people in the business, revenue, profits, costs, business maturity level, and strategic information voluntarily provided for diagnostic and mentoring purposes.',
      "Payment data: card or account data is captured directly by MercadoPago; the Controller only receives transaction confirmation, amount, and payment status, not full card details.",
      'Platform usage data: interactions with the tool, content viewed, progress in programs or workshops.',
      'Data of minors and their guardian, where applicable (see Section 8).',
    ],
  },
  {
    h: '3. Financial Data and Note on Sensitive Data',
    p: [
      'The financial and business data described above (revenue, profits, costs, etc.) is commercial/financial in nature. Under the applicable Mexican data protection law, "sensitive personal data" refers only to data concerning racial or ethnic origin, health status, genetic information, religious, philosophical or moral beliefs, union membership, political opinions, and sexual preference. Your business\'s financial data is not considered sensitive data under this definition, but is treated with the same administrative, technical, and physical security measures as your other data.',
    ],
  },
  {
    h: '4. Purposes of Processing',
    p: ['Your data is used for the following purposes:'],
    list: [
      'Primary (necessary for the service): creating and managing your account; providing mentoring, diagnostic, and coaching services; processing payments and billing; providing support and handling requests.',
      'Secondary (require your consent, optional): sending newsletters, invitations to international calls aligned with the SDGs, and marketing communications about new services. You may opt out of these purposes at any time without affecting the core service you contracted.',
    ],
  },
  {
    h: '5. Legal Basis and Type of Consent',
    p: [
      'Processing for primary purposes is based on the legal relationship you establish with the Controller by registering and using the platform (implied consent, valid under applicable law unless express consent is required).',
      "Processing of minors' data and secondary marketing purposes require your express consent, obtained through specific checkboxes at registration, separate from general acceptance of this Notice.",
    ],
  },
  {
    h: '6. Data Transfers',
    p: [
      'Your payment data is shared with MercadoPago (or another authorized payment provider) solely to process the transaction. We may share data with technology infrastructure providers (e.g., hosting and AI services) strictly necessary to operate the platform, who are contractually bound to protect your data and not use it for purposes other than those stated here.',
      'We do not sell or share your personal data with third parties for marketing purposes unrelated to MBE AI Copilot.',
    ],
  },
  {
    h: '7. Retention Period',
    p: [
      'Your data will be retained while you maintain an active account and, thereafter, for the period necessary to comply with applicable legal, tax, or accounting obligations. Once that period ends, your data will be blocked and, in due course, deleted per the procedure established by law.',
    ],
  },
  {
    h: '8. Minors and Guardian Consent',
    p: [
      "MBE AI Copilot allows minors to register only when a parent or legal guardian provides their own name and email address and expressly accepts this Privacy Notice and the Terms of Use on the minor's behalf. The guardian is responsible for supervising the minor's use of the platform.",
    ],
  },
  {
    h: '9. Your Rights (Access, Rectification, Cancellation, Objection) and How to Exercise Them',
    p: [
      'You have the right to Access, Rectify, Cancel, or Object ("ARCO rights") to the processing of your personal data, and to revoke your consent at any time.',
      'To exercise these rights, send your request to: atencion@mbecorp.org, indicating: (a) your full name and contact details; (b) the specific right you wish to exercise; (c) a clear description of the data involved; and (d) any documents that help locate your data. If acting on behalf of someone else (e.g., as a minor\'s guardian), you must prove such representation.',
      'We will respond to your request within the timeframes established by law.',
    ],
  },
  {
    h: '10. Competent Authority',
    p: [
      'As of March 21, 2025, the data-protection authority functions previously held by INAI (dissolved on that date) were assumed by the Secretaría Anticorrupción y Buen Gobierno (SABG). If you believe your rights were not adequately addressed, you may contact that authority. The implementing regulation for the new law has not yet been published as of this Notice, so specific procedures before the authority may be updated.',
    ],
  },
  {
    h: '11. Changes to This Privacy Notice',
    p: [
      'This Notice may be updated to reflect legislative, operational, or business changes. The current version will always be available on this page, showing its last-updated date.',
    ],
  },
];

export default async function PrivacidadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEN = locale === 'en';
  const sections = isEN ? EN_SECTIONS : ES_SECTIONS;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-foreground">
      <Link href={`/${locale}`} className="text-sm text-primary underline">
        {isEN ? '← Back to home' : '← Volver al inicio'}
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-bold">
        {isEN ? 'Privacy Notice' : 'Aviso de Privacidad'}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {isEN
          ? 'MBE AI Copilot — last updated: to be confirmed on publication.'
          : 'MBE AI Copilot — última actualización: pendiente de confirmar al publicar.'}
      </p>

      {sections.map((s) => (
        <section key={s.h} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{s.h}</h2>
          {s.p.map((para, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed text-muted-foreground">
              {para}
            </p>
          ))}
          {s.list && (
            <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
              {s.list.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}

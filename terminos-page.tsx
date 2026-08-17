import type { Metadata } from "next";

/**
 * Página pública: /[locale]/legal/terminos
 * Muestra los Términos de Uso / Terms of Use según el idioma de la URL.
 * Contenido idéntico en sustancia al documento .docx entregado al Responsable;
 * esta página es la versión "siempre visible" en el sitio.
 */

export const metadata: Metadata = {
  title: "Términos de Uso | MBE AI Copilot",
};

const ES_SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Identificación del prestador del servicio",
    p: [
      "MBE AI Copilot es operado por Baruch Alfredo Beltrán Suárez, persona física con actividad empresarial, RFC BESB760722FR0 (el \"Responsable\" o \"nosotros\"). Al usar este sitio y sus servicios, usted (el \"Usuario\") acepta estos Términos de Uso.",
    ],
  },
  {
    h: "2. Descripción del servicio",
    p: [
      "MBE AI Copilot es una plataforma de mentoría y desarrollo empresarial que ofrece contenidos, herramientas, diagnósticos y acompañamiento asistido por inteligencia artificial dirigidos a microempresas, emprendimientos y profesionistas independientes.",
    ],
  },
  {
    h: "3. Elegibilidad y menores de edad",
    p: [
      "El uso de la plataforma está permitido a menores de edad únicamente con el consentimiento expreso de su padre, madre o tutor legal, quien deberá registrar sus propios datos de contacto y aceptar estos Términos y el Aviso de Privacidad en representación del menor, asumiendo la responsabilidad del uso que éste haga de la plataforma.",
    ],
  },
  {
    h: "4. Registro y cuenta de usuario",
    p: [
      "El Usuario es responsable de la veracidad de la información proporcionada durante el registro y de mantener la confidencialidad de sus credenciales de acceso. El Responsable no es responsable por accesos no autorizados derivados del mal manejo de dichas credenciales por parte del Usuario.",
    ],
  },
  {
    h: "5. Pagos",
    p: [
      "Los pagos realizados en la plataforma se procesan a través de MercadoPago u otros proveedores de pago habilitados. El Responsable no almacena datos de tarjetas ni información financiera sensible; dicha información es capturada y procesada directamente por el proveedor de pagos conforme a sus propias políticas de seguridad y privacidad.",
      "Los precios, membresías y condiciones de pago se muestran al momento de la contratación y pueden modificarse con aviso previo razonable para suscripciones activas.",
    ],
  },
  {
    h: "6. Uso aceptable",
    p: [
      "El Usuario se compromete a no utilizar la plataforma para fines ilícitos, a no intentar vulnerar su seguridad, a no reproducir o distribuir sin autorización los contenidos protegidos, y a no proporcionar información falsa sobre sí mismo o su empresa.",
    ],
  },
  {
    h: "7. Propiedad intelectual",
    p: [
      "Todo el contenido, marca, software, metodologías y materiales disponibles en MBE AI Copilot son propiedad del Responsable o se usan bajo licencia. Se otorga al Usuario una licencia limitada, no exclusiva e intransferible para uso personal conforme a estos Términos.",
    ],
  },
  {
    h: "8. Naturaleza informativa del servicio",
    p: [
      "El contenido, diagnósticos y recomendaciones generados por la plataforma —incluyendo los asistidos por inteligencia artificial— tienen fines informativos y de acompañamiento general. No constituyen asesoría legal, fiscal, financiera o profesional individualizada, y no sustituyen el criterio de un asesor calificado para el caso concreto del Usuario.",
    ],
  },
  {
    h: "9. Limitación de responsabilidad",
    p: [
      "En la máxima medida permitida por la legislación aplicable, el Responsable no será responsable por daños indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso de la plataforma, incluyendo pérdidas de ingresos, datos o oportunidades de negocio, salvo en los casos en que la ley disponga expresamente lo contrario.",
      "La plataforma se ofrece \"tal cual\" y \"según disponibilidad\", sin garantías de ningún tipo, expresas o implícitas, sobre resultados específicos de negocio.",
    ],
  },
  {
    h: "10. Indemnización",
    p: [
      "El Usuario acepta sacar en paz y a salvo al Responsable frente a cualquier reclamación de terceros derivada del incumplimiento de estos Términos o del uso indebido de la plataforma por parte del Usuario.",
    ],
  },
  {
    h: "11. Suspensión y terminación",
    p: [
      "El Responsable podrá suspender o cancelar el acceso de un Usuario que incumpla estos Términos, sin perjuicio de las acciones legales que correspondan.",
    ],
  },
  {
    h: "12. Enlaces y servicios de terceros",
    p: [
      "La plataforma puede integrar o enlazar servicios de terceros (por ejemplo, procesadores de pago o proveedores de inteligencia artificial). El Responsable no controla ni se hace responsable de las políticas o el funcionamiento de dichos terceros.",
    ],
  },
  {
    h: "13. Modificaciones a estos Términos",
    p: [
      "El Responsable podrá modificar estos Términos en cualquier momento. Los cambios sustanciales serán notificados a través de la plataforma o por correo electrónico. El uso continuado del servicio tras la publicación de los cambios constituye la aceptación de los mismos.",
    ],
  },
  {
    h: "14. Legislación aplicable y jurisdicción",
    p: [
      "Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia relacionada con estos Términos, las partes se someten a los tribunales competentes del Estado de México, renunciando a cualquier otro fuero que pudiera corresponderles por razón de su domicilio presente o futuro.",
    ],
  },
  {
    h: "15. Contacto",
    p: ["Para dudas sobre estos Términos de Uso: atencion@mbecorp.org"],
  },
];

const EN_SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Service Provider",
    p: [
      "MBE AI Copilot is operated by Baruch Alfredo Beltrán Suárez, an individual with business activity registered in Mexico, RFC BESB760722FR0 (the \"Controller\" or \"we\"). By using this site and its services, you (the \"User\") accept these Terms of Use.",
    ],
  },
  {
    h: "2. Description of the Service",
    p: [
      "MBE AI Copilot is a mentoring and business-development platform offering AI-assisted content, tools, diagnostics, and guidance for microbusinesses, entrepreneurs, and independent professionals.",
    ],
  },
  {
    h: "3. Eligibility and Minors",
    p: [
      "Minors may use the platform only with the express consent of a parent or legal guardian, who must register their own contact information and accept these Terms and the Privacy Notice on the minor's behalf, assuming responsibility for the minor's use of the platform.",
    ],
  },
  {
    h: "4. Registration and Account",
    p: [
      "The User is responsible for the accuracy of the information provided during registration and for keeping their access credentials confidential. The Controller is not liable for unauthorized access resulting from the User's mishandling of credentials.",
    ],
  },
  {
    h: "5. Payments",
    p: [
      "Payments are processed through MercadoPago or other authorized payment providers. The Controller does not store card data or sensitive financial information; such information is captured and processed directly by the payment provider under its own security and privacy policies.",
      "Prices, memberships, and payment terms are shown at the time of purchase and may be modified with reasonable prior notice for active subscriptions.",
    ],
  },
  {
    h: "6. Acceptable Use",
    p: [
      "The User agrees not to use the platform for unlawful purposes, not to attempt to compromise its security, not to reproduce or distribute protected content without authorization, and not to provide false information about themselves or their business.",
    ],
  },
  {
    h: "7. Intellectual Property",
    p: [
      "All content, trademarks, software, methodologies, and materials available on MBE AI Copilot are owned by the Controller or used under license. Users are granted a limited, non-exclusive, non-transferable license for personal use under these Terms.",
    ],
  },
  {
    h: "8. Informational Nature of the Service",
    p: [
      "Content, diagnostics, and recommendations generated by the platform — including AI-assisted ones — are for general informational and guidance purposes only. They do not constitute individualized legal, tax, financial, or professional advice, and do not replace the judgment of a qualified advisor for the User's specific situation.",
    ],
  },
  {
    h: "9. Limitation of Liability",
    p: [
      "To the maximum extent permitted by applicable law, the Controller shall not be liable for indirect, incidental, special, or consequential damages arising from use or inability to use the platform, including loss of revenue, data, or business opportunities, except where the law expressly provides otherwise.",
      "The platform is provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, regarding specific business outcomes.",
    ],
  },
  {
    h: "10. Indemnification",
    p: [
      "The User agrees to hold the Controller harmless from any third-party claim arising from a breach of these Terms or misuse of the platform by the User.",
    ],
  },
  {
    h: "11. Suspension and Termination",
    p: [
      "The Controller may suspend or terminate the access of a User who breaches these Terms, without prejudice to any legal actions that may apply.",
    ],
  },
  {
    h: "12. Third-Party Links and Services",
    p: [
      "The platform may integrate or link to third-party services (for example, payment processors or AI providers). The Controller does not control and is not responsible for the policies or operation of such third parties.",
    ],
  },
  {
    h: "13. Changes to These Terms",
    p: [
      "The Controller may modify these Terms at any time. Material changes will be notified through the platform or by email. Continued use of the service after changes are published constitutes acceptance of them.",
    ],
  },
  {
    h: "14. Governing Law and Jurisdiction",
    p: [
      "These Terms are governed by the laws of Mexico. For any dispute related to these Terms, the parties submit to the competent courts of the Estado de México, waiving any other jurisdiction that might correspond to them due to their present or future domicile.",
    ],
  },
  {
    h: "15. Governing Version",
    p: [
      "This English version is provided for convenience. In case of any discrepancy, the Spanish-language version of these Terms shall prevail.",
    ],
  },
  {
    h: "16. Contact",
    p: ["For questions about these Terms of Use: atencion@mbecorp.org"],
  },
];

export default async function TerminosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEN = locale === "en";
  const sections = isEN ? EN_SECTIONS : ES_SECTIONS;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        {isEN ? "Terms of Use" : "Términos de Uso"}
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        {isEN
          ? "MBE AI Copilot — last updated: to be confirmed on publication."
          : "MBE AI Copilot — última actualización: pendiente de confirmar al publicar."}
      </p>

      {sections.map((s) => (
        <section key={s.h} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{s.h}</h2>
          {s.p.map((para, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed text-gray-700">
              {para}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}

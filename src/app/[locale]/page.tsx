import { redirect } from 'next/navigation';

// La raiz del sitio (https://mbe-ai-copilot.vercel.app/ -> /{locale}) ahora
// manda directo al login, en vez de mostrar la landing/registro. El
// contenido que antes vivia aqui (Hero + RegisterForm + AgentsPreview) se
// movio, sin cambios, a /{locale}/registro (ver esa carpeta).
export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/login`);
}

import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export default async function PerfilLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AppShell locale={locale}>{children}</AppShell>;
}

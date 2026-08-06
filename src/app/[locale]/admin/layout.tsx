import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export default function AdminLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  return <AppShell locale={locale}>{children}</AppShell>;
}
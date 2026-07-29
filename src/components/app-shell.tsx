'use client';

// Wrapper client-side que aplica el ExecutiveShell (sidebar + header + ⌘K)
// de forma consistente a las rutas internas de la app (dashboard, babel y
// sus sub-páginas, onboarding). NO se usa en la landing pública (src/app/
// [locale]/page.tsx) porque esa página es de registro/pre-login y tiene su
// propio diseño de marketing.
import * as React from 'react';
import { ClipboardList, Gauge, Sparkles } from 'lucide-react';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';

export function AppShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const navItems: ExecutiveNavItem[] = [
    { href: `/${locale}/dashboard`, label: 'Dashboard', icon: Gauge },
    { href: `/${locale}/babel`, label: 'Babel AI', icon: Sparkles },
    { href: `/${locale}/onboarding`, label: 'Diagnóstico', icon: ClipboardList },
  ];

  return (
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corpilot AI">
      {children}
    </ExecutiveShell>
  );
}

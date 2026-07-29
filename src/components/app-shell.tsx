'use client';

import * as React from 'react';
import { ClipboardList, Gauge, LayoutDashboard, Sparkles, TrendingUp, Users } from 'lucide-react';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';
import { BackgroundBlobs } from '@/components/ui/executive/background-blobs';

export function AppShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const navItems: ExecutiveNavItem[] = [
    { href: `/${locale}/executive-preview`, label: 'Resumen ejecutivo', icon: LayoutDashboard },
    { href: `/${locale}/babel`, label: 'Babel AI', icon: Sparkles },
    { href: `/${locale}/babel/organigrama`, label: 'Organigrama y roles', icon: Users },
    { href: `/${locale}/babel/plan-accion`, label: 'Plan de acción', icon: ClipboardList },
    { href: `/${locale}/babel/indicadores`, label: 'Objetivos financieros', icon: TrendingUp },
    { href: `/${locale}/dashboard`, label: 'Evaluación de madurez', icon: Gauge },
    { href: `/${locale}/onboarding`, label: 'Diagnóstico', icon: ClipboardList },
  ];

  return (
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corpilot AI">
      <BackgroundBlobs />
      {children}
    </ExecutiveShell>
  );
}

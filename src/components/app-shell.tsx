'use client';

import * as React from 'react';
import { ClipboardList, Gauge, LayoutDashboard, Sparkles, TrendingUp, Users } from 'lucide-react';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';
import { BackgroundBlobs } from '@/components/ui/executive/background-blobs';
import { DisplayLangProvider, useDisplayLang } from '@/components/display-lang-provider';

function AppShellInner({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const { lang } = useDisplayLang();
  const navLabel = (es: string, en: string) => lang === 'en' ? en : es;

  const navItems: ExecutiveNavItem[] = [
    { href: `/${locale}/executive-preview`, label: navLabel('Resumen ejecutivo', 'Executive Summary'), icon: LayoutDashboard },
    { href: `/${locale}/dashboard`, label: navLabel('Evaluación de madurez', 'Maturity Assessment'), icon: Gauge },
    { href: `/${locale}/babel/indicadores`, label: navLabel('Objetivos estratégicos', 'Strategic Objectives'), icon: TrendingUp },
    { href: `/${locale}/babel`, label: navLabel('Reflexión estratégica', 'Strategic Reflection'), icon: Sparkles },
    { href: `/${locale}/babel/organigrama`, label: navLabel('Organigrama y roles', 'Org Chart & Roles'), icon: Users },
    { href: `/${locale}/babel/plan-accion`, label: navLabel('Plan de acción estratégico', 'Strategic Action Plan'), icon: ClipboardList },
  ];

  return (
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
      <BackgroundBlobs />
      {children}
    </ExecutiveShell>
  );
}

export function AppShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <DisplayLangProvider initialLang={locale as 'es' | 'en'}>
      <AppShellInner locale={locale}>{children}</AppShellInner>
    </DisplayLangProvider>
  );
}

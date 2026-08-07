'use client';

import * as React from 'react';
import { CalendarClock, ClipboardList, Gauge, Home, LayoutDashboard, LineChart, Megaphone, ShieldCheck, Sparkles, TrendingUp, UserCheck2, Users } from 'lucide-react';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';
import { BackgroundBlobs } from '@/components/ui/executive/background-blobs';
import { DisplayLangProvider, useDisplayLang } from '@/components/display-lang-provider';
import { WorkspaceSyncer } from '@/components/workspace-syncer';
import { useUserRoles } from '@/lib/use-user-roles';

function AppShellInner({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const { lang } = useDisplayLang();
  const { administracion, especialista } = useUserRoles();
  const navLabel = (es: string, en: string) => lang === 'en' ? en : es;

  const navItems: ExecutiveNavItem[] = [
    { href: `/${locale}/inicio`, label: navLabel('Inicio', 'Home'), icon: Home },
    { href: `/${locale}/babel/convocatorias`, label: navLabel('Convocatorias y fondos', 'Calls & Grants'), icon: Megaphone },
    { href: `/${locale}/executive-preview`, label: navLabel('Resumen ejecutivo', 'Executive Summary'), icon: LayoutDashboard },
    { href: `/${locale}/babel/indicadores`, label: navLabel('Objetivos estratégicos', 'Strategic Objectives'), icon: TrendingUp },
    { href: `/${locale}/dashboard`, label: navLabel('Evaluación de madurez', 'Maturity Assessment'), icon: Gauge },
    { href: `/${locale}/babel/madurez`, label: navLabel('Mejora del Nivel de Madurez', 'Maturity Level Improvement'), icon: LineChart },
    { href: `/${locale}/babel`, label: navLabel('Reflexión estratégica', 'Strategic Reflection'), icon: Sparkles, group: navLabel('Estrategia Socioambiental', 'Socio-environmental Strategy') },
    { href: `/${locale}/babel/organigrama`, label: navLabel('Organigrama y roles', 'Org Chart & Roles'), icon: Users, group: navLabel('Estrategia Socioambiental', 'Socio-environmental Strategy') },
    { href: `/${locale}/babel/plan-accion`, label: navLabel('Plan de acción estratégico', 'Strategic Action Plan'), icon: ClipboardList, group: navLabel('Estrategia Socioambiental', 'Socio-environmental Strategy') },
  ];

  // Grupo "Admin" solo para administradores; "Mentor" para usuarios con
  // rol de mentor. Se agregan DESPUÉS del grupo socioambiental, como
  // grupo propio al final del menú.
  if (administracion) {
    navItems.push({ href: `/${locale}/admin`, label: navLabel('Administración', 'Administration'), icon: ShieldCheck });
  }
  if (especialista) {
    navItems.push({ href: `/${locale}/especialista`, label: navLabel('Panel de Mentor', 'Mentor Panel'), icon: UserCheck2 });
  }
  // Agendar con mentores: visible para todos los usuarios autenticados.
  navItems.push({ href: `/${locale}/agendar`, label: navLabel('Agenda con mentores', 'Book a mentor'), icon: CalendarClock });

  return (
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
      <WorkspaceSyncer />
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

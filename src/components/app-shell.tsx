'use client';

import * as React from 'react';
import { Coins, Cog, Compass, Crown, Globe, Handshake, Home, Landmark, LayoutDashboard, Medal, Scale, ShieldCheck, UserCheck2, Wrench } from 'lucide-react';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';
import { BackgroundBlobs } from '@/components/ui/executive/background-blobs';
import { DisplayLangProvider, useDisplayLang } from '@/components/display-lang-provider';
import { WorkspaceSyncer } from '@/components/workspace-syncer';
import { useUserRoles } from '@/lib/use-user-roles';
import { MISIONES_PART_LABELS, SUBMUNDOS_ESTRATEGIA_LABELS } from '@/lib/worlds';

function AppShellInner({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const { lang } = useDisplayLang();
  const { administracion, especialista } = useUserRoles();
  const navLabel = (es: string, en: string) => (lang === 'en' ? en : es);
  const misionLabel = (n: number, es: string, en: string) => navLabel(`Misión ${n}: ${es}`, `Mission ${n}: ${en}`);
  // Misiones comunes de los mundos premium: Apoyo de Especialistas y Plan de Acción.
  const premiumMisiones = () => [
    { href: `/${locale}/agendar`, label: navLabel('Misión 1: Apoyo de Especialistas', 'Mission 1: Specialist Support') },
    { href: `/${locale}/babel/plan-accion`, label: navLabel('Misión de Plan de Acción', 'Action Plan Mission') },
  ];

  // Orden del menú = orden de la página de Inicio: Inicio → Resumen ejecutivo →
  // Mundo de Partida (misiones) → Mundo de Retos → Toolbox (herramientas) →
  // Mundos Premium (Estrategia con sus misiones + los demás mundos).
  const navItems: ExecutiveNavItem[] = [
    { href: `/${locale}/inicio`, label: navLabel('Inicio', 'Home'), icon: Home },
    { href: `/${locale}/executive-preview`, label: navLabel('Resumen ejecutivo', 'Executive Summary'), icon: LayoutDashboard },
    {
      href: `/${locale}/worlds/partida`,
      label: navLabel('Mundo de Partida', 'Starting World'),
      icon: Globe,
      children: MISIONES_PART_LABELS.map((m) => ({
        href: `/${locale}${m.ruta}`,
        label: misionLabel(m.n, m.es, m.en),
      })),
    },
    { href: `/${locale}/babel/madurez`, label: navLabel('Mundo de Retos', 'Challenges World'), icon: Medal },
    {
      label: navLabel('Toolbox', 'Toolbox'),
      icon: Wrench,
      titleOnly: true,
      children: [
        { href: `/${locale}/babel/convocatorias`, label: navLabel('Convocatorias y fondos', 'Calls & Grants') },
        { href: `/${locale}/refplace`, label: navLabel('Reference Place', 'Reference Place') },
        { href: `/${locale}/club`, label: navLabel('Juntas de Mentoría', 'Mentoring Meetings') },
      ],
    },
    {
      label: navLabel('Mundos Premium', 'Premium Worlds'),
      icon: Crown,
      titleOnly: true,
      children: [
        {
          href: `/${locale}/worlds?v=estrategia`,
          label: navLabel('Mundo de la Estrategia', 'Strategy World'),
          icon: Compass,
          children: [
            ...SUBMUNDOS_ESTRATEGIA_LABELS.map((m) => ({
              href: `/${locale}${m.ruta}`,
              label: misionLabel(m.n, m.es, m.en),
            })),
            { href: `/${locale}/agendar`, label: misionLabel(7, 'Apoyo de Especialistas', 'Specialist Support') },
          ],
        },
        { href: `/${locale}/worlds?v=dinero`, label: navLabel('Mundo del Dinero', 'Money World'), icon: Coins, children: premiumMisiones() },
        { href: `/${locale}/worlds?v=cliente`, label: navLabel('Mundo del Cliente', 'Customer World'), icon: Handshake, children: premiumMisiones() },
        { href: `/${locale}/worlds?v=normativo`, label: navLabel('Mundo Normativo', 'Compliance World'), icon: Scale, children: premiumMisiones() },
        { href: `/${locale}/worlds?v=operativo`, label: navLabel('Mundo Operativo', 'Operations World'), icon: Cog, children: premiumMisiones() },
        { href: `/${locale}/worlds?v=cultura`, label: navLabel('Mundo de la Cultura', 'Culture World'), icon: Landmark, children: premiumMisiones() },
      ],
    },
  ];

  // Grupo "Admin" solo para administradores; "Mentor" para usuarios con
  // rol de mentor. Se agregan al final del menú.
  if (administracion) {
    navItems.push({ href: `/${locale}/admin`, label: navLabel('Administración', 'Administration'), icon: ShieldCheck });
  }
  if (especialista) {
    navItems.push({ href: `/${locale}/especialista`, label: navLabel('Panel de Mentor', 'Mentor Panel'), icon: UserCheck2 });
  }

  return (
    <ExecutiveShell navItems={navItems} brandLabel="MBE Corp-AI-Lot" logoSrc="/logo-mbe.png">
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

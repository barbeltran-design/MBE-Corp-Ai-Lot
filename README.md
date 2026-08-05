# MBE AI Copilot

Plataforma SaaS que democratiza la consultoría empresarial de clase mundial mediante 5 agentes de IA (Babel, Karmetin, Fisnando, Normau, Atech) para PyMEs latinoamericanas. Proyecto para el hackatón **Build with Gemini XPRIZE** (deadline: 17 agosto 2026).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Firebase (Auth, Firestore, Storage) — SDK cliente
- next-intl (i18n ES/EN, `localePrefix: 'always'`, rutas `/es/...` y `/en/...`)
- react-hook-form + zod para validación de formularios

## Estado actual: Fase 1 — Fundación ✅

- [x] Scaffold Next.js 14 + Tailwind + TypeScript
- [x] i18n ES/EN completo (landing + registro)
- [x] Landing page (Pantalla 1) con hero y selector de idioma
- [x] Formulario de registro (email/password + Google Sign-In) que escribe en Firestore `users/{uid}` y `companies/{uid}`
- [x] Reglas de seguridad de Firestore y Storage (`firestore.rules`, `storage.rules`)
- [x] `next build` y `next start` verificados localmente (ver nota de credenciales abajo)

Pendiente para fases siguientes: diagnóstico de madurez (Fase 2), chat con Gemini + RAG (Fase 3), generación de entregables (Fase 4), Stripe + dashboard (Fase 5), agentes especializados + Calendar (Fase 6).

## Cómo correrlo localmente

```bash
npm install
cp .env.example .env.local   # y llena tus llaves reales (ver abajo)
npm run dev                  # http://localhost:3000 → redirige a /es
```

## Credenciales necesarias (`.env.local`)

Copia `.env.example` a `.env.local` y llena:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase Console > Project settings > General > Your apps (Web app). Necesarios para que Auth/Firestore funcionen de verdad; sin ellos Firebase lanza `auth/invalid-api-key` (esto es intencional — la app falla ruidosamente en vez de fallar en silencio).
- `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — no se usan todavía en Fase 1, se activan en Fase 3 y Fase 5 respectivamente.

**Antes de habilitar Google Sign-In**, agrega tu dominio de despliegue (o `localhost`) a Firebase Console > Authentication > Settings > Authorized domains.

**Reglas de seguridad:** despliega `firestore.rules` y `storage.rules` con `firebase deploy --only firestore:rules,storage:rules` (requiere Firebase CLI configurado con tu proyecto).

## Convocatorias y fondos (`/babel/convocatorias`)

Tablero de convocatorias, premios, becas y fondos alineados a los ODS para organizaciones en
México. Los datos viven en `src/lib/convocatorias-data.json` y su fuente canónica es una hoja de
Google Sheets sincronizada cada domingo por GitHub Actions.

- Proceso completo (fuentes de búsqueda, sync, criterios de elegibilidad): [`docs/CONVOCATORIAS.md`](docs/CONVOCATORIAS.md)
- Sync manual: `node scripts/sync-convocatorias.mjs`

## Estructura relevante

```
src/
  app/[locale]/            # rutas con prefijo de idioma (es|en)
    page.tsx               # Pantalla 1: landing + registro
    onboarding/page.tsx     # placeholder de Pantalla 2, se completa en Fase 3
  components/
    landing/                # Hero, RegisterForm, LanguageSwitcher
    ui/                      # primitivos estilo shadcn (Button, Input, Select, Label, Card)
  lib/
    firebase.ts             # init del SDK cliente de Firebase
    auth.ts                 # registro (email/password y Google) + escritura en Firestore
  types/firestore.ts         # interfaces TS de las 6 colecciones (users, companies, assessments, sessions, deliverables, phds)
  messages/{es,en}.json       # copys traducidos
firestore.rules
storage.rules
.env.example
```

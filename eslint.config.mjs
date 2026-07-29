// eslint.config.mjs
//
// ESLint 10 exige "flat config" (este archivo) — el formato clásico
// `.eslintrc.*` ya no se reconoce. `eslint-config-next@16.2.12` exporta
// directamente un array de flat config (core-web-vitals + reglas TS), así
// que basta con reexportarlo tal cual; no hace falta el shim FlatCompat
// que usan los proyectos scaffoldeados con versiones anteriores de Next.
import nextConfig from 'eslint-config-next';

export default nextConfig;

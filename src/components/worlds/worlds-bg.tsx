'use client';

// Fondo glassmorphism de MBE Worlds: gradiente profundo con esferas
// flotantes desenfocadas detrás de los paneles de vidrio (dark) y blobs
// pastel sobre fondo claro (light), más grano sutil general.
export function WorldsBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* grano sobre todo el fondo */}
      <div className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: '200px 200px',
        }}
      />

      {/* orbes de color principales (dark: neón / light: pastel) */}
      <div className="world-orb -left-40 -top-44 h-[640px] w-[640px] bg-teal-300/60 dark:bg-teal-500/40" />
      <div className="world-orb world-orb-pastel -right-36 top-1/4 h-[560px] w-[560px] bg-fuchsia-300/50 dark:bg-fuchsia-500/25" />
      <div className="world-orb bottom-0 left-1/3 h-[520px] w-[820px] -translate-x-1/2 bg-sky-300/50 dark:bg-indigo-500/25" />
      <div className="world-orb -bottom-24 right-1/4 h-[420px] w-[420px] bg-amber-200/70 dark:bg-purple-500/20" />
      <div className="world-orb world-orb-pastel left-1/4 top-1/3 h-[300px] w-[300px] bg-rose-200/60 dark:bg-rose-500/15" />

      {/* viñeta para profundidad */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(13,26,38,0.16)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
'use client';

export function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-dot-pattern" />
      <div className="absolute -left-32 -top-32 h-[700px] w-[700px] rounded-full bg-[hsl(189_64%_50%_/_0.5)] blur-[130px]" />
      <div className="absolute -right-20 top-0 h-[600px] w-[600px] rounded-full bg-[hsl(189_34%_50%_/_0.12)] blur-[130px]" />
      <div className="absolute bottom-0 left-1/3 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[hsl(189_64%_50%_/_0.25)] blur-[150px]" />
      <div className="absolute -bottom-20 right-1/4 h-[400px] w-[400px] rounded-full bg-[hsl(189_64%_50%_/_0.2)] blur-[110px]" />
      <div className="absolute left-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-[hsl(340_80%_60%_/_0.12)] blur-[100px]" />
    </div>
  );
}

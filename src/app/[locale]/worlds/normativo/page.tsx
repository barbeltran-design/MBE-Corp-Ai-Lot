'use client';

import { WorldsBuilder } from '@/components/worlds/WorldsBuilder';

export default function WorldsNormativoPage() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <WorldsBuilder vistaInicial="normativo" />
      </div>
    </div>
  );
}
'use client';

import { WorldsBuilder } from '@/components/worlds/WorldsBuilder';

export default function WorldsOperativoPage() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <WorldsBuilder vistaInicial="operativo" />
      </div>
    </div>
  );
}
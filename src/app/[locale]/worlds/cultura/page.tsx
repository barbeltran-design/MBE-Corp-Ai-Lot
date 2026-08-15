'use client';

import { WorldsBuilder } from '@/components/worlds/WorldsBuilder';

export default function WorldsCulturaPage() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <WorldsBuilder vistaInicial="cultura" />
      </div>
    </div>
  );
}
'use client';

import { ReferencePlaceBuilder } from '@/components/refplace/ReferencePlaceBuilder';

export default function RefplacePage() {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <ReferencePlaceBuilder />
      </div>
    </div>
  );
}
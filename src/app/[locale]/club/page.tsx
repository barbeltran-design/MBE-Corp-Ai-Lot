'use client';

import { ClubBuilder } from '@/components/club/ClubBuilder';

export default function ClubPage() {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <ClubBuilder />
      </div>
    </div>
  );
}
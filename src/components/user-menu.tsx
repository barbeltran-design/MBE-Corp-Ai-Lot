'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';

type ProfileDoc = {
  name?: string;
  photoURL?: string;
  subscription?: string;
  planStatus?: string;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : '';
  const second = parts.length > 1 ? parts[1][0] : '';
  return (first + second).toUpperCase() || '?';
}

export function UserMenu() {
  const locale = useLocale() as 'es' | 'en';
  const router = useRouter();
  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [profile, setProfile] = React.useState<ProfileDoc | null>(null);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    let unsubscribeDoc: Unsubscribe | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      if (!u) {
        setProfile(null);
        return;
      }
      const db = getFirebaseDb();
      unsubscribeDoc = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          if (snap.exists()) setProfile(snap.data() as ProfileDoc);
        },
        (err) => console.error('[UserMenu] failed to watch profile', err)
      );
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  if (!user) return null;

  const name = profile?.name || user.displayName || '';
  const photoURL = profile?.photoURL || user.photoURL || '';
  const isPro = profile?.subscription === 'pro' && profile?.planStatus === 'active';
  const planLabel = isPro
    ? (locale === 'en' ? 'Pro plan' : 'Plan Pro')
    : (locale === 'en' ? 'Free' : 'Gratis');

  return (
    <button
      type="button"
      onClick={() => router.push(`/${locale}/perfil`)}
      title={locale === 'en' ? 'My profile' : 'Mi perfil'}
      className="flex shrink-0 items-center gap-2 rounded-full border border-glass-border bg-glass p-1 pl-1.5 pr-2.5 transition-colors duration-150 hover:bg-accent"
    >
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
        {photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoURL} alt={name} className="h-full w-full object-cover" />
        ) : (
          initialsOf(name)
        )}
        <span
          className={
            'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background ' +
            (isPro ? 'bg-emerald-500' : 'bg-slate-400')
          }
        />
      </span>
      <span className="hidden flex-col items-start leading-tight md:flex">
        <span className="max-w-[9rem] truncate text-xs font-medium text-foreground">{name || (locale === 'en' ? 'My profile' : 'Mi perfil')}</span>
        <span className={'text-[10px] font-medium ' + (isPro ? 'text-emerald-600' : 'text-muted-foreground')}>{planLabel}</span>
      </span>
    </button>
  );
}

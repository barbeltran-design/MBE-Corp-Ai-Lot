'use client';

import * as React from 'react';

type Lang = 'es' | 'en';

const DisplayLangContext = React.createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
}>({ lang: 'es', setLang: () => {} });

export function DisplayLangProvider({ children, initialLang }: { children: React.ReactNode; initialLang?: Lang }) {
  const [lang, setLang] = React.useState<Lang>(initialLang ?? 'es');
  return <DisplayLangContext.Provider value={{ lang, setLang }}>{children}</DisplayLangContext.Provider>;
}

export function useDisplayLang() {
  return React.useContext(DisplayLangContext);
}

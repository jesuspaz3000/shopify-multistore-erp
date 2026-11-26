'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createUiStore, type UiStore } from './ui-store';

type UiStoreApi = ReturnType<typeof createUiStore>;

const UiStoreContext = createContext<UiStoreApi | undefined>(undefined);

export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createUiStore());
  return <UiStoreContext value={store}>{children}</UiStoreContext>;
}

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const store = useContext(UiStoreContext);
  if (!store) {
    throw new Error('useUiStore debe usarse dentro de <UiStoreProvider>');
  }
  return useStore(store, selector);
}

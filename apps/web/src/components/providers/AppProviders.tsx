'use client';

import type { ReactNode } from 'react';
import { UiStoreProvider } from '@/stores/UiStoreProvider';

// Agrupa los providers de cliente (stores de zustand, notificaciones, etc.).
export default function AppProviders({ children }: { children: ReactNode }) {
  return <UiStoreProvider>{children}</UiStoreProvider>;
}

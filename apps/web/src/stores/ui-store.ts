import { createStore } from 'zustand/vanilla';

// Estado de UI global (solo cliente). El tenant y la tienda activa viven en la URL, no aquí.
export type UiState = {
  /** Menú lateral abierto en pantallas pequeñas (en escritorio siempre está visible). */
  mobileNavOpen: boolean;
  /**
   * Aviso global ("Producto creado"): lo muestra el AppShell, así sobrevive a una navegación
   * (ej. crear un producto y volver a la lista).
   */
  notice: Notice | null;
};

export type Notice = { id: number; message: string; severity: 'success' | 'error' | 'info' };

export type UiActions = {
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
  /** Muestra un aviso arriba al centro (éxito por defecto). */
  notify: (message: string, severity?: Notice['severity']) => void;
  clearNotice: () => void;
};

export type UiStore = UiState & UiActions;

export const defaultUiState: UiState = {
  mobileNavOpen: false,
  notice: null,
};

let noticeCounter = 0;

// Fábrica: se crea un store por árbol de React (nunca un store global en el servidor).
export const createUiStore = (initState: UiState = defaultUiState) =>
  createStore<UiStore>()((set) => ({
    ...initState,
    setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
    toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
    // Un id por aviso: el mismo mensaje dos veces seguidas vuelve a mostrarse y reinicia el tiempo.
    notify: (message, severity = 'success') => set({ notice: { id: ++noticeCounter, message, severity } }),
    clearNotice: () => set({ notice: null }),
  }));

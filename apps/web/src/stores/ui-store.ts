import { createStore } from 'zustand/vanilla';

// Estado de UI global (solo cliente). El tenant y la tienda activa viven en la URL, no aquí.
export type UiState = {
  /** Menú lateral abierto en pantallas pequeñas (en escritorio siempre está visible). */
  mobileNavOpen: boolean;
};

export type UiActions = {
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
};

export type UiStore = UiState & UiActions;

export const defaultUiState: UiState = {
  mobileNavOpen: false,
};

// Fábrica: se crea un store por árbol de React (nunca un store global en el servidor).
export const createUiStore = (initState: UiState = defaultUiState) =>
  createStore<UiStore>()((set) => ({
    ...initState,
    setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
    toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  }));

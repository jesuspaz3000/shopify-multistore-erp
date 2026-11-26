import { createStore } from 'zustand/vanilla';

// Estado de UI global (solo cliente). El tenant y la tienda activa viven en la URL, no aquí.
export type UiState = {
  sidebarOpen: boolean;
};

export type UiActions = {
  toggleSidebar: () => void;
};

export type UiStore = UiState & UiActions;

export const defaultUiState: UiState = {
  sidebarOpen: true,
};

// Fábrica: se crea un store por árbol de React (nunca un store global en el servidor).
export const createUiStore = (initState: UiState = defaultUiState) =>
  createStore<UiStore>()((set) => ({
    ...initState,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  }));

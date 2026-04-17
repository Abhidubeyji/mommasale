import { create } from "zustand"

export type ViewType = "dashboard" | "users" | "categories" | "products" | "shopkeepers" | "orders" | "payments"

interface AppState {
  currentView: ViewType
  sidebarOpen: boolean
  setCurrentView: (view: ViewType) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  reset: () => void
}

const initialState = {
  currentView: "dashboard" as ViewType,
  sidebarOpen: true,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setCurrentView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  reset: () => set(initialState)
}))

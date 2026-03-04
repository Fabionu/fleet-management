import { create } from 'zustand';

const useStore = create((set) => ({
  trucks: [],
  setTrucks: (trucks) => set({ trucks }),
  updateTruck: (id, updates) => set((state) => ({
    trucks: state.trucks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
}));

export default useStore;
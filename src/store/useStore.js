import { create } from 'zustand';

const useStore = create((set) => ({
  trucks: [],
  setTrucks: (newTrucksOrFn) => set((state) => ({
    trucks: typeof newTrucksOrFn === 'function' ? newTrucksOrFn(state.trucks) : newTrucksOrFn
  })),
  updateTruck: (id, updates) => set((state) => ({
    trucks: state.trucks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
}));

export default useStore;
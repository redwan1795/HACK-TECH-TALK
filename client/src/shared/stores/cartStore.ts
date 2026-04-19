import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  listingId: string;
  title: string;
  priceCents: number;
  unit: string;
  quantity: number;
  producerName: string;
  category: string;
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clear: () => void;
  subtotalCents: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => set((s) => {
        const existing = s.items.find((i) => i.listingId === item.listingId);
        if (existing) {
          return {
            items: s.items.map((i) =>
              i.listingId === item.listingId
                ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.maxQuantity) }
                : i
            ),
          };
        }
        return { items: [...s.items, item] };
      }),

      removeItem: (listingId) => set((s) => ({
        items: s.items.filter((i) => i.listingId !== listingId),
      })),

      updateQuantity: (listingId, quantity) => set((s) => ({
        items: s.items.map((i) =>
          i.listingId === listingId
            ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) }
            : i
        ),
      })),

      clear: () => set({ items: [] }),

      subtotalCents: () =>
        get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'cg-cart' }
  )
);

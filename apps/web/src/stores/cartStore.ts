import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Listing } from '@community-garden/types';

export interface CartItem {
  listing: Listing;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (listing: Listing, quantity?: number) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (listing, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.listing.id === listing.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.listing.id === listing.id
                  ? {
                      ...i,
                      quantity: Math.min(
                        i.quantity + quantity,
                        listing.quantityAvailable
                      ),
                    }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { listing, quantity: Math.min(quantity, listing.quantityAvailable) },
            ],
          };
        });
      },

      removeItem: (listingId) =>
        set((state) => ({ items: state.items.filter((i) => i.listing.id !== listingId) })),

      updateQuantity: (listingId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.listing.id === listingId
              ? { ...i, quantity: Math.min(quantity, i.listing.quantityAvailable) }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      subtotal: () =>
        get().items.reduce(
          (sum, i) => sum + (i.listing.priceCents ?? 0) * i.quantity,
          0
        ),
    }),
    { name: 'cart' }
  )
);

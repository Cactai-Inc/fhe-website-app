import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { FunnelType, SelectedService } from '../lib/supabase';
import { groupByCadence } from '../lib/cart';
import type { CartItem, CadenceGroup } from '../lib/cart';

export type { CartItem, CadenceGroup } from '../lib/cart';

// ─── Types ────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  funnel: FunnelType | null;
  qualifierAnswers: Record<string, string>;
}

type CartAction =
  | { type: 'SET_FUNNEL'; funnel: FunnelType }
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; serviceId: string; tierId: string }
  | { type: 'TOGGLE_ITEM'; item: CartItem }
  | { type: 'SET_QUALIFIER'; key: string; value: string }
  | { type: 'CLEAR_CART' };

interface CartContextValue {
  state: CartState;
  setFunnel: (funnel: FunnelType) => void;
  addItem: (item: CartItem) => void;
  removeItem: (serviceId: string, tierId: string) => void;
  toggleItem: (item: CartItem) => void;
  setQualifier: (key: string, value: string) => void;
  clearCart: () => void;
  isSelected: (serviceId: string, tierId: string) => boolean;
  subtotal: number;
  itemCount: number;
  toSelectedServices: () => SelectedService[];
  inquirySummary: CadenceGroup[];
}

// ─── Reducer ─────────────────────────────────────────────────────────────

const initialState: CartState = {
  items: [],
  funnel: null,
  qualifierAnswers: {},
};

const STORAGE_KEY = 'fhe-cart-v1';

function loadInitialState(): CartState {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      funnel: parsed.funnel ?? null,
      qualifierAnswers: parsed.qualifierAnswers ?? {},
    };
  } catch {
    return initialState;
  }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_FUNNEL':
      // Preserve selected items across funnel switches so cross-sell is real.
      // Only the active funnel changes; qualifier answers persist too (they are
      // keyed per-question and harmless to keep). This fixes the "cart wipe" bug
      // where moving between Rider/Horse/Support silently cleared selections.
      if (state.funnel === action.funnel) return state;
      return { ...state, funnel: action.funnel };

    case 'ADD_ITEM': {
      const exists = state.items.some(
        (i) => i.serviceId === action.item.serviceId && i.tierId === action.item.tierId
      );
      if (exists) return state;
      return { ...state, items: [...state.items, action.item] };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          (i) => !(i.serviceId === action.serviceId && i.tierId === action.tierId)
        ),
      };

    case 'TOGGLE_ITEM': {
      const exists = state.items.some(
        (i) => i.serviceId === action.item.serviceId && i.tierId === action.item.tierId
      );
      if (exists) {
        return {
          ...state,
          items: state.items.filter(
            (i) => !(i.serviceId === action.item.serviceId && i.tierId === action.item.tierId)
          ),
        };
      }
      // When selecting a new tier for the same service, replace any other tier from that service
      const withoutService = state.items.filter((i) => i.serviceId !== action.item.serviceId);
      return { ...state, items: [...withoutService, action.item] };
    }

    case 'SET_QUALIFIER':
      return {
        ...state,
        qualifierAnswers: { ...state.qualifierAnswers, [action.key]: action.value },
      };

    case 'CLEAR_CART':
      return initialState;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadInitialState);

  // Persist the cart for the session so a refresh mid-flow does not lose it.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable (private mode, etc.) — degrade gracefully */
    }
  }, [state]);

  const setFunnel = useCallback((funnel: FunnelType) => {
    dispatch({ type: 'SET_FUNNEL', funnel });
  }, []);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', item });
  }, []);

  const removeItem = useCallback((serviceId: string, tierId: string) => {
    dispatch({ type: 'REMOVE_ITEM', serviceId, tierId });
  }, []);

  const toggleItem = useCallback((item: CartItem) => {
    dispatch({ type: 'TOGGLE_ITEM', item });
  }, []);

  const setQualifier = useCallback((key: string, value: string) => {
    dispatch({ type: 'SET_QUALIFIER', key, value });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const isSelected = useCallback(
    (serviceId: string, tierId: string) =>
      state.items.some((i) => i.serviceId === serviceId && i.tierId === tierId),
    [state.items]
  );

  const subtotal = state.items.reduce((sum, i) => sum + i.price, 0);
  const itemCount = state.items.length;
  const inquirySummary = groupByCadence(state.items);

  const toSelectedServices = useCallback((): SelectedService[] =>
    state.items.map((i) => ({
      serviceId: i.serviceId,
      serviceName: i.serviceName,
      tierId: i.tierId,
      tierLabel: i.tierLabel,
      price: i.price,
      unit: i.unit,
    })),
  [state.items]);

  return (
    <CartContext.Provider
      value={{
        state,
        setFunnel,
        addItem,
        removeItem,
        toggleItem,
        setQualifier,
        clearCart,
        isSelected,
        subtotal,
        itemCount,
        toSelectedServices,
        inquirySummary,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

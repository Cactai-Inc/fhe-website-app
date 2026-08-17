import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { FunnelType, SelectedService } from '../lib/supabase';
import { groupByCadence } from '../lib/cart';
import type { CartItem, CadenceGroup } from '../lib/cart';

export type { CartItem, CadenceGroup } from '../lib/cart';

// ─── Types ────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  funnel: FunnelType | null;
  /** THE answer store — one map, keyed `subject.questionId` (ASKRIGHT §A2b).
   *  There is no second store: free text, choices and follow-up detail boxes
   *  all land here. */
  qualifierAnswers: Record<string, string>;
  /** ASKRIGHT §A3c — which answers the SYSTEM concluded rather than the visitor
   *  giving. Metadata about `qualifierAnswers`, not a parallel copy of it: a key
   *  is present only while its answer is still derived and untouched, and the
   *  value names the question it was derived from, so staff can tell a
   *  conclusion from something typed. The moment the visitor edits the answer
   *  themselves the entry is deleted and the answer is theirs for good. */
  answerOrigins: Record<string, string>;
}

type CartAction =
  | { type: 'SET_FUNNEL'; funnel: FunnelType }
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; offeringId: string }
  | { type: 'TOGGLE_ITEM'; item: CartItem }
  | { type: 'SET_ITEM_CONFIG'; offeringId: string; config: CartItem['config'] }
  | { type: 'SET_QUALIFIER'; key: string; value: string }
  | { type: 'SET_DERIVED_QUALIFIER'; key: string; value: string; because: string }
  | { type: 'WITHDRAW_DERIVED'; key: string }
  | { type: 'CLEAR_CART' };

interface CartContextValue {
  state: CartState;
  setFunnel: (funnel: FunnelType) => void;
  addItem: (item: CartItem) => void;
  removeItem: (offeringId: string) => void;
  toggleItem: (item: CartItem) => void;
  setItemConfig: (offeringId: string, config: CartItem['config']) => void;
  setQualifier: (key: string, value: string) => void;
  /** Write an answer the system concluded (ASKRIGHT §A3c). Refuses to overwrite
   *  an answer the visitor has given or edited — the implication runs one way
   *  and never over the top of a person. */
  setDerivedQualifier: (key: string, value: string, because: string) => void;
  /** The implication no longer concludes anything: drop the derived answer,
   *  but only while it is still untouched. */
  withdrawDerived: (key: string) => void;
  clearCart: () => void;
  isSelected: (offeringId: string) => boolean;
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
  answerOrigins: {},
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
      answerOrigins: parsed.answerOrigins ?? {},
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
      const exists = state.items.some((i) => i.offeringId === action.item.offeringId);
      if (exists) return state;
      return { ...state, items: [...state.items, action.item] };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.offeringId !== action.offeringId),
      };

    case 'TOGGLE_ITEM': {
      const exists = state.items.some((i) => i.offeringId === action.item.offeringId);
      if (exists) {
        return {
          ...state,
          items: state.items.filter((i) => i.offeringId !== action.item.offeringId),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }

    case 'SET_ITEM_CONFIG':
      return {
        ...state,
        items: state.items.map((i) =>
          i.offeringId === action.offeringId ? { ...i, config: action.config } : i),
      };

    case 'SET_QUALIFIER': {
      // The visitor touched it, so it is theirs: the derived marker comes off
      // and no later implication may overwrite it (ASKRIGHT §A3c).
      const { [action.key]: _dropped, ...origins } = state.answerOrigins;
      return {
        ...state,
        qualifierAnswers: { ...state.qualifierAnswers, [action.key]: action.value },
        answerOrigins: origins,
      };
    }

    case 'SET_DERIVED_QUALIFIER': {
      const answered = (state.qualifierAnswers[action.key] ?? '') !== '';
      const isDerived = action.key in state.answerOrigins;
      // Only fill a blank, or refresh a derived answer the visitor has not
      // edited. Anything they gave themselves is never overwritten.
      if (answered && !isDerived) return state;
      if (state.qualifierAnswers[action.key] === action.value && isDerived) return state;
      return {
        ...state,
        qualifierAnswers: { ...state.qualifierAnswers, [action.key]: action.value },
        answerOrigins: { ...state.answerOrigins, [action.key]: action.because },
      };
    }

    case 'WITHDRAW_DERIVED': {
      // The source changed and no longer proves anything. Withdraw the
      // conclusion — but only if it is still a conclusion.
      if (!(action.key in state.answerOrigins)) return state;
      const { [action.key]: _origin, ...origins } = state.answerOrigins;
      const { [action.key]: _answer, ...answers } = state.qualifierAnswers;
      return { ...state, qualifierAnswers: answers, answerOrigins: origins };
    }

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

  const removeItem = useCallback((offeringId: string) => {
    dispatch({ type: 'REMOVE_ITEM', offeringId });
  }, []);

  const toggleItem = useCallback((item: CartItem) => {
    dispatch({ type: 'TOGGLE_ITEM', item });
  }, []);

  const setItemConfig = useCallback((offeringId: string, config: CartItem['config']) => {
    dispatch({ type: 'SET_ITEM_CONFIG', offeringId, config });
  }, []);

  const setQualifier = useCallback((key: string, value: string) => {
    dispatch({ type: 'SET_QUALIFIER', key, value });
  }, []);

  const setDerivedQualifier = useCallback((key: string, value: string, because: string) => {
    dispatch({ type: 'SET_DERIVED_QUALIFIER', key, value, because });
  }, []);

  const withdrawDerived = useCallback((key: string) => {
    dispatch({ type: 'WITHDRAW_DERIVED', key });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const isSelected = useCallback(
    (offeringId: string) =>
      state.items.some((i) => i.offeringId === offeringId),
    [state.items]
  );

  const subtotal = state.items.reduce((sum, i) => sum + i.price, 0);
  const itemCount = state.items.length;
  const inquirySummary = groupByCadence(state.items);

  const toSelectedServices = useCallback((): SelectedService[] =>
    state.items.map((i) => ({
      offeringId: i.offeringId,
      offeringName: i.offeringName,
      serviceType: i.serviceType,
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
        setItemConfig,
        setQualifier,
        setDerivedQualifier,
        withdrawDerived,
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

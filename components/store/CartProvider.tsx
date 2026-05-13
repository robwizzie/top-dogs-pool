"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clientCartCreate,
  clientCartDiscountUpdate,
  clientCartGet,
  clientCartLinesAdd,
  clientCartLinesRemove,
  clientCartLinesUpdate,
  type Cart,
} from "@/lib/shopify";

const STORAGE_KEY = "topdogs-cart-id";

type CartState = {
  cart: Cart | null;
  isLoading: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  clearDiscounts: () => Promise<void>;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    (async () => {
      try {
        if (stored) {
          const existing = await clientCartGet(stored);
          if (existing) {
            setCart(existing);
            return;
          }
        }
      } catch {
        // fall through and create a fresh cart
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const ensureCart = useCallback(async (): Promise<Cart> => {
    if (cart) return cart;
    const created = await clientCartCreate();
    localStorage.setItem(STORAGE_KEY, created.id);
    setCart(created);
    return created;
  }, [cart]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      setIsLoading(true);
      try {
        const c = await ensureCart();
        const next = await clientCartLinesAdd(c.id, variantId, quantity);
        setCart(next);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureCart],
  );

  const updateLine = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart) return;
      setIsLoading(true);
      try {
        const next = await clientCartLinesUpdate(cart.id, lineId, quantity);
        setCart(next);
      } finally {
        setIsLoading(false);
      }
    },
    [cart],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!cart) return;
      setIsLoading(true);
      try {
        const next = await clientCartLinesRemove(cart.id, [lineId]);
        setCart(next);
      } finally {
        setIsLoading(false);
      }
    },
    [cart],
  );

  const applyDiscount = useCallback(
    async (code: string) => {
      const c = await ensureCart();
      setIsLoading(true);
      try {
        const next = await clientCartDiscountUpdate(c.id, [code]);
        setCart(next);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureCart],
  );

  const clearDiscounts = useCallback(async () => {
    if (!cart) return;
    setIsLoading(true);
    try {
      const next = await clientCartDiscountUpdate(cart.id, []);
      setCart(next);
    } finally {
      setIsLoading(false);
    }
  }, [cart]);

  const value = useMemo<CartState>(
    () => ({
      cart,
      isLoading,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((o) => !o),
      addItem,
      updateLine,
      removeLine,
      applyDiscount,
      clearDiscounts,
    }),
    [cart, isLoading, isOpen, addItem, updateLine, removeLine, applyDiscount, clearDiscounts],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

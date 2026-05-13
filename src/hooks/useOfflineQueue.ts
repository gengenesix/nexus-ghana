import { useState, useEffect, useCallback } from "react";

const QUEUE_KEY = "nexus_offline_sale_queue";

export interface QueuedSale {
  id: string;
  receiptNum: string;
  businessId: string;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  staffId: string | null;
  customerId: string | null;
  redeemPoints: boolean;
  pointsToRedeem: number;
  cart: Array<{ id: string; name: string; price: number; qty: number }>;
  queuedAt: number;
}

function loadQueue(): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedSale[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [queue, setQueue] = useState<QueuedSale[]>(loadQueue);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const enqueue = useCallback((sale: Omit<QueuedSale, "id" | "queuedAt">) => {
    const item: QueuedSale = { ...sale, id: crypto.randomUUID(), queuedAt: Date.now() };
    setQueue(prev => {
      const next = [...prev, item];
      saveQueue(next);
      return next;
    });
    return item;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const next = prev.filter(s => s.id !== id);
      saveQueue(next);
      return next;
    });
  }, []);

  return { isOnline, queue, enqueue, removeFromQueue };
}
